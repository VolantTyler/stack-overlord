import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = {
      parse: mocks.parse,
    };
  },
}));

import {
  analyzePipelineRun,
  diagnoseFailure,
} from "@/lib/diagnosis";
import type { PipelineRun, WorkflowEvidence } from "@/lib/pipeline";

const run: PipelineRun = {
  id: "12345",
  repository: "VolantTyler/cognitive-bridge-demo",
  branch: "main",
  commitSha: "abcdef0123456789",
  commitMessage: "test: exercise grounded analysis",
  workflowName: "Deploy sandbox",
  status: "failure",
  environment: "firebase-sandbox",
  sourceEvent: "push",
  startedAt: "2026-07-16T16:00:00.000Z",
  completedAt: "2026-07-16T16:02:05.000Z",
  durationSeconds: 125,
  runUrl:
    "https://github.com/VolantTyler/cognitive-bridge-demo/actions/runs/12345",
  deploymentUrl: null,
  actor: "VolantTyler",
  diagnosis: null,
  isReplay: false,
};

const workflowEvidence: WorkflowEvidence = {
  items: [
    {
      id: "job:7788",
      source: "github_actions_jobs",
      fact:
        'GitHub Actions job "Deploy sandbox" has status "completed" and conclusion "failure".',
    },
  ],
  status: "available",
  note: null,
};

function parsedResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "resp_live_123",
    model: "gpt-5.6-sol-2026-06-01",
    output_parsed: {
      summary:
        "The workflow has a verified failure in the deployment job. The supplied context identifies the failed job but does not contain raw error output.",
      likelyCause:
        "The underlying cause is not established by the supplied context because only the job conclusion is available.",
      evidence: ["run:status", "job:7788"],
      confidence: "high",
      limitations: ["Raw workflow logs and command output were not supplied."],
      recommendations: [
        {
          priority: 1,
          action: "Open the failed GitHub Actions job and inspect its first error.",
          rationale:
            "The job conclusion localizes the failure, while the missing output prevents a narrower diagnosis.",
          verification:
            "Confirm the first error matches the component selected for remediation.",
        },
      ],
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-5.6");
  mocks.parse.mockResolvedValue(parsedResponse());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analyzePipelineRun", () => {
  it("requests GPT-5.6 with high verbosity and records resolved provenance", async () => {
    const analysis = await analyzePipelineRun(run, workflowEvidence);

    expect(mocks.parse).toHaveBeenCalledOnce();
    expect(mocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        max_output_tokens: 8_000,
        model: "gpt-5.6",
        reasoning: { effort: "medium" },
        text: expect.objectContaining({ verbosity: "high" }),
      }),
    );
    expect(analysis).toMatchObject({
      model: "gpt-5.6-sol-2026-06-01",
      requestedModel: "gpt-5.6",
      responseId: "resp_live_123",
      provenance: "openai-api",
      schemaVersion: 2,
      promptVersion: "pipeline-analysis-v2",
      confidence: "medium",
      context: {
        status: "failure",
        githubEvidenceStatus: "available",
      },
    });
    expect(analysis?.inputDigest).toMatch(/^[a-f0-9]{64}$/);

    const request = mocks.parse.mock.calls[0][0] as {
      input: Array<{ role: string; content: string }>;
    };
    const suppliedContext = JSON.parse(request.input[1].content) as {
      context: { evidence: Array<{ id: string }> };
    };
    expect(suppliedContext.context.evidence.map((item) => item.id)).toContain(
      "job:7788",
    );
    expect(request.input[1].content).not.toContain('"diagnosis"');
  });

  it("supports on-demand analysis for non-failure rows while the webhook wrapper does not", async () => {
    const successfulRun = { ...run, status: "success" as const };
    mocks.parse.mockResolvedValue(
      parsedResponse({
        summary:
          "GitHub records a successful workflow conclusion. The supplied context supports that outcome without implying anything about later deployment health.",
        likelyCause:
          "No failure cause applies; the defensible interpretation is limited to the recorded successful workflow outcome.",
        confidence: "high",
      }),
    );

    await expect(
      analyzePipelineRun(successfulRun, workflowEvidence),
    ).resolves.toMatchObject({ confidence: "high" });
    await expect(
      diagnoseFailure(successfulRun, workflowEvidence),
    ).resolves.toBeNull();
    expect(mocks.parse).toHaveBeenCalledOnce();
  });

  it("rejects model-authored evidence references that were not supplied", async () => {
    mocks.parse.mockResolvedValue(
      parsedResponse({ evidence: ["run:status", "log:invented"] }),
    );

    await expect(analyzePipelineRun(run, workflowEvidence)).rejects.toThrow(
      "evidence that was not supplied",
    );
  });
});
