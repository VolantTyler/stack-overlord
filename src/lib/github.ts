import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { PipelineRun, PipelineStatus } from "@/lib/pipeline";

const workflowRunPayloadSchema = z.object({
  action: z.string(),
  repository: z.object({ full_name: z.string() }),
  workflow_run: z.object({
    id: z.number(),
    name: z.string(),
    display_title: z.string().optional(),
    head_branch: z.string().nullable(),
    head_sha: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    event: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    html_url: z.string().url(),
    actor: z.object({ login: z.string() }),
  }),
});

export function verifyGitHubSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
) {
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function mapConclusion(status: string, conclusion: string | null): PipelineStatus {
  if (status !== "completed") return "running";
  if (conclusion === "success") return "success";
  if (["cancelled", "skipped", "neutral"].includes(conclusion ?? "")) {
    return "cancelled";
  }
  return "failure";
}

export function workflowRunFromPayload(payload: unknown): PipelineRun | null {
  const parsed = workflowRunPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;

  const workflow = parsed.data.workflow_run;
  const startedAt = new Date(workflow.created_at);
  const completedAt =
    workflow.status === "completed" ? new Date(workflow.updated_at) : null;
  const workflowName =
    workflow.event === "workflow_dispatch"
      ? workflow.display_title ?? workflow.name
      : workflow.name;

  return {
    id: String(workflow.id),
    repository: parsed.data.repository.full_name,
    branch: workflow.head_branch ?? "detached",
    commitSha: workflow.head_sha,
    commitMessage: workflow.display_title ?? workflow.name,
    workflowName,
    status: mapConclusion(workflow.status, workflow.conclusion),
    environment: workflow.name.toLowerCase().includes("preview")
      ? "firebase-preview"
      : "firebase-sandbox",
    sourceEvent: workflow.event,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt?.toISOString() ?? null,
    durationSeconds: completedAt
      ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
      : null,
    runUrl: workflow.html_url,
    deploymentUrl: null,
    actor: workflow.actor.login,
    diagnosis: null,
    isReplay: false,
  };
}

export function webhookMetadata(payload: unknown) {
  const object = typeof payload === "object" && payload ? payload : {};
  const record = object as Record<string, unknown>;
  const repository = record.repository as Record<string, unknown> | undefined;

  return {
    action: typeof record.action === "string" ? record.action : null,
    repository:
      typeof repository?.full_name === "string"
        ? repository.full_name
        : "unknown/unknown",
  };
}

const workflowJobsSchema = z.object({
  jobs: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      conclusion: z.string().nullable(),
      steps: z
        .array(
          z.object({
            name: z.string(),
            status: z.string(),
            conclusion: z.string().nullable(),
          }),
        )
        .optional(),
    }),
  ),
});

export async function fetchWorkflowEvidence(run: PipelineRun) {
  const headers: HeadersInit = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "stack-overlord",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${run.repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
      { headers, cache: "no-store" },
    );

    if (!response.ok) {
      console.error(`GitHub job evidence request failed with ${response.status}.`);
      return [];
    }

    const parsed = workflowJobsSchema.safeParse(await response.json());
    if (!parsed.success) return [];

    const evidence: string[] = [];
    for (const job of parsed.data.jobs) {
      if (job.conclusion === "failure") {
        evidence.push(`Job "${job.name}" concluded with failure.`);
      }

      for (const step of job.steps ?? []) {
        if (step.conclusion === "failure") {
          evidence.push(
            `Step "${step.name}" in job "${job.name}" concluded with failure.`,
          );
        }
      }
    }

    return evidence.slice(0, 12);
  } catch (error) {
    console.error("GitHub job evidence could not be loaded.", error);
    return [];
  }
}
