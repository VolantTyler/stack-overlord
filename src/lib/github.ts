import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type {
  AnalysisEvidence,
  PipelineRun,
  PipelineStatus,
  WorkflowEvidence,
} from "@/lib/pipeline";

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
  total_count: z.number().int().nonnegative(),
  jobs: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      status: z.string(),
      conclusion: z.string().nullable(),
      started_at: z.string().nullable().optional(),
      completed_at: z.string().nullable().optional(),
      steps: z
        .array(
          z.object({
            number: z.number(),
            name: z.string(),
            status: z.string(),
            conclusion: z.string().nullable(),
          }),
        )
        .optional(),
    }),
  ),
});

function workflowEvidenceUnavailable(note: string): WorkflowEvidence {
  return {
    items: [],
    status: "unavailable",
    note,
  };
}

function jobFact(job: z.infer<typeof workflowJobsSchema>["jobs"][number]) {
  const conclusion = job.conclusion
    ? ` and conclusion "${job.conclusion}"`
    : " and no conclusion";
  const timing =
    job.started_at && job.completed_at
      ? ` It ran from ${job.started_at} to ${job.completed_at}.`
      : "";

  return `GitHub Actions job "${job.name}" has status "${job.status}"${conclusion}.${timing}`;
}

type WorkflowEvidenceFetchOptions = {
  authentication?: "configured" | "anonymous";
};

type RankedEvidence = {
  evidence: AnalysisEvidence;
  priority: number;
  order: number;
};

const failureConclusions = new Set([
  "action_required",
  "failure",
  "startup_failure",
  "stale",
  "timed_out",
]);

function evidencePriority(status: string, conclusion: string | null) {
  if (conclusion && failureConclusions.has(conclusion)) return 0;
  if (status !== "completed" || conclusion !== "success") return 1;
  return 2;
}

export async function fetchWorkflowEvidence(
  run: PipelineRun,
  options: WorkflowEvidenceFetchOptions = {},
): Promise<WorkflowEvidence> {
  const headers: HeadersInit = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "stack-overlord",
  };

  if (
    options.authentication !== "anonymous" &&
    process.env.GITHUB_TOKEN
  ) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${run.repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
      { headers, cache: "no-store" },
    );

    if (!response.ok) {
      console.error(`GitHub job evidence request failed with ${response.status}.`);
      return workflowEvidenceUnavailable(
        `GitHub Actions job details were unavailable (HTTP ${response.status}).`,
      );
    }

    const parsed = workflowJobsSchema.safeParse(await response.json());
    if (!parsed.success) {
      return workflowEvidenceUnavailable(
        "GitHub Actions returned job details in an unsupported format.",
      );
    }

    const rankedEvidence: RankedEvidence[] = [];
    let order = 0;
    for (const job of parsed.data.jobs) {
      rankedEvidence.push({
        evidence: {
          id: `job:${job.id}`,
          source: "github_actions_jobs",
          fact: jobFact(job),
        },
        priority: evidencePriority(job.status, job.conclusion),
        order: order++,
      });

      for (const step of job.steps ?? []) {
        if (step.conclusion === "success" && step.status === "completed") continue;

        const conclusion = step.conclusion
          ? ` and conclusion "${step.conclusion}"`
          : " and no conclusion";
        rankedEvidence.push({
          evidence: {
            id: `step:${job.id}:${step.number}`,
            source: "github_actions_jobs",
            fact: `Step ${step.number}, "${step.name}", in job "${job.name}" has status "${step.status}"${conclusion}.`,
          },
          priority: evidencePriority(step.status, step.conclusion),
          order: order++,
        });
      }
    }

    const evidence = rankedEvidence
      .sort((left, right) =>
        left.priority === right.priority
          ? left.order - right.order
          : left.priority - right.priority,
      )
      .map(({ evidence: item }) => item);

    const contextNotes: string[] = [];
    if (parsed.data.total_count > parsed.data.jobs.length) {
      contextNotes.push(
        `GitHub reported ${parsed.data.total_count} jobs, but evidence retrieval was limited to the first API page of ${parsed.data.jobs.length}; later-page jobs and steps were not provided.`,
      );
    }
    if (evidence.length > 12) {
      contextNotes.push(
        "GitHub Actions evidence was limited to the 12 highest-priority job and relevant step records, with failures and other non-success states first.",
      );
    }

    return {
      items: evidence.slice(0, 12),
      status: "available",
      note: contextNotes.length ? contextNotes.join(" ") : null,
    };
  } catch (error) {
    console.error("GitHub job evidence could not be loaded.", error);
    return workflowEvidenceUnavailable(
      "GitHub Actions job details could not be loaded.",
    );
  }
}
