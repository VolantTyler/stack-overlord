import { diagnoseFailure } from "@/lib/diagnosis";
import { notifyDiscord } from "@/lib/discord";
import {
  fetchWorkflowEvidence,
  verifyGitHubSignature,
  webhookMetadata,
  workflowRunFromPayload,
} from "@/lib/github";
import { savePipelineEvent, savePipelineRun } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const eventName = request.headers.get("x-github-event") ?? "unknown";
  const deliveryId = request.headers.get("x-github-delivery") ?? crypto.randomUUID();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

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
  const persisted = await savePipelineEvent({
    deliveryId,
    eventName,
    action: metadata.action,
    repository: metadata.repository,
    payload,
  });

  if (eventName !== "workflow_run") {
    return Response.json({ accepted: true, persisted, eventName });
  }

  const run = workflowRunFromPayload(payload);
  if (!run) {
    return Response.json(
      { error: "Unsupported workflow_run payload." },
      { status: 422 },
    );
  }

  await savePipelineRun(run);

  if (run.status === "failure") {
    try {
      const evidence = await fetchWorkflowEvidence(run);
      run.diagnosis = await diagnoseFailure(run, evidence);
      if (run.diagnosis) await savePipelineRun(run);
    } catch (error) {
      console.error("GPT-5.6 diagnosis failed after the run was stored.", error);
    }

    try {
      await notifyDiscord(run);
    } catch (error) {
      console.error("Discord notification failed after the run was stored.", error);
    }
  }

  return Response.json({
    accepted: true,
    persisted,
    runId: run.id,
    status: run.status,
    diagnosed: Boolean(run.diagnosis),
  });
}
