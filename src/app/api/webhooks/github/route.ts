import { after } from "next/server";

import { diagnoseFailure } from "@/lib/diagnosis";
import {
  fetchWorkflowEvidence,
  verifyGitHubSignature,
  webhookMetadata,
  workflowRunFromPayload,
} from "@/lib/github";
import type { PipelineRun } from "@/lib/pipeline";
import {
  savePipelineEvent,
  savePipelineRun,
  savePipelineRunAnalysis,
} from "@/lib/repository";
import { notifySlack } from "@/lib/slack";

export const runtime = "nodejs";
export const maxDuration = 60;

type WebhookLogContext = {
  deliveryId: string;
  eventName: string;
  repository?: string;
  runId?: string;
};

function logWebhookTiming(
  message: string,
  context: WebhookLogContext,
  startedAt: number,
  extra: Record<string, unknown> = {},
) {
  console.info(
    JSON.stringify({
      message,
      deliveryId: context.deliveryId,
      event: context.eventName,
      repository: context.repository ?? "unknown",
      runId: context.runId ?? null,
      elapsedMs: Math.round(performance.now() - startedAt),
      ...extra,
    }),
  );
}

async function runOptionalFailureWork(
  run: PipelineRun,
  context: WebhookLogContext,
  expectedUpdatedAt: string,
) {
  const optionalStartedAt = performance.now();
  logWebhookTiming("github_webhook_optional_started", context, optionalStartedAt);

  try {
    const evidence = await fetchWorkflowEvidence(run);
    run.diagnosis = await diagnoseFailure(run, evidence);
    if (run.diagnosis) {
      const saved = await savePipelineRunAnalysis(
        run.id,
        run.status,
        run.diagnosis,
        expectedUpdatedAt,
      );
      if (saved !== "saved") {
        run.diagnosis = null;
        logWebhookTiming(
          "github_webhook_diagnosis_discarded_stale",
          context,
          optionalStartedAt,
        );
      }
    }
    logWebhookTiming("github_webhook_diagnosis_finished", context, optionalStartedAt, {
      diagnosed: Boolean(run.diagnosis),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "github_webhook_diagnosis_failed",
        deliveryId: context.deliveryId,
        event: context.eventName,
        repository: context.repository ?? "unknown",
        runId: context.runId ?? null,
        elapsedMs: Math.round(performance.now() - optionalStartedAt),
      }),
      error,
    );
  }

  try {
    await notifySlack(run);
    logWebhookTiming("github_webhook_slack_finished", context, optionalStartedAt);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "github_webhook_slack_failed",
        deliveryId: context.deliveryId,
        event: context.eventName,
        repository: context.repository ?? "unknown",
        runId: context.runId ?? null,
        elapsedMs: Math.round(performance.now() - optionalStartedAt),
      }),
      error,
    );
  }
}

function scheduleOptionalFailureWork(
  run: PipelineRun,
  context: WebhookLogContext,
  expectedUpdatedAt: string,
) {
  after(async () => {
    await runOptionalFailureWork(run, context, expectedUpdatedAt);
  });
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const eventName = request.headers.get("x-github-event") ?? "unknown";
  const deliveryId = request.headers.get("x-github-delivery") ?? crypto.randomUUID();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const baseContext = { deliveryId, eventName };

  if (!secret) {
    return Response.json(
      { error: "GitHub webhook verification is not configured." },
      { status: 503 },
    );
  }

  if (!verifyGitHubSignature(rawBody, signature, secret)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Webhook body is not valid JSON." }, { status: 400 });
  }

  const metadata = webhookMetadata(payload);
  const context = { ...baseContext, repository: metadata.repository };
  logWebhookTiming("github_webhook_verified", context, startedAt);

  const persistence = await savePipelineEvent({
    deliveryId,
    eventName,
    action: metadata.action,
    repository: metadata.repository,
    payload,
  });

  if (persistence === "unavailable") {
    return Response.json(
      {
        accepted: false,
        persisted: false,
        error: "Pipeline telemetry storage is not configured.",
      },
      { status: 503 },
    );
  }

  if (persistence === "duplicate") {
    logWebhookTiming("github_webhook_duplicate_acknowledged", context, startedAt);
    return Response.json({
      accepted: true,
      persisted: false,
      duplicate: true,
      eventName,
    });
  }

  const persisted = true;
  logWebhookTiming("github_webhook_event_persisted", context, startedAt);

  if (eventName !== "workflow_run") {
    logWebhookTiming("github_webhook_acknowledged", context, startedAt);
    return Response.json({ accepted: true, persisted, eventName });
  }

  const run = workflowRunFromPayload(payload);
  if (!run) {
    return Response.json(
      { error: "Unsupported workflow_run payload." },
      { status: 422 },
    );
  }

  const runContext = { ...context, runId: run.id };
  const runPersisted = await savePipelineRun(run);
  if (!runPersisted) {
    return Response.json(
      {
        accepted: false,
        persisted: false,
        eventPersisted: true,
        error: "Pipeline run storage is not configured.",
      },
      { status: 503 },
    );
  }

  logWebhookTiming("github_webhook_run_persisted", runContext, startedAt, {
    status: run.status,
  });

  if (run.status === "failure") {
    scheduleOptionalFailureWork(run, runContext, runPersisted);
  }

  logWebhookTiming("github_webhook_acknowledged", runContext, startedAt, {
    status: run.status,
  });

  return Response.json({
    accepted: true,
    persisted,
    runId: run.id,
    status: run.status,
    diagnosisScheduled: run.status === "failure",
  });
}
