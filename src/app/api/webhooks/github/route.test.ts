import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => void | Promise<void>>,
  diagnoseFailure: vi.fn(),
  fetchWorkflowEvidence: vi.fn(),
  notifySlack: vi.fn(),
  savePipelineEvent: vi.fn(),
  savePipelineRun: vi.fn(),
  savePipelineRunAnalysis: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => void | Promise<void>) => {
    mocks.afterCallbacks.push(callback);
  }),
}));
vi.mock("@/lib/diagnosis", () => ({
  diagnoseFailure: mocks.diagnoseFailure,
}));
vi.mock("@/lib/slack", () => ({ notifySlack: mocks.notifySlack }));
vi.mock("@/lib/repository", () => ({
  savePipelineEvent: mocks.savePipelineEvent,
  savePipelineRun: mocks.savePipelineRun,
  savePipelineRunAnalysis: mocks.savePipelineRunAnalysis,
}));
vi.mock("@/lib/github", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/github")>();
  return { ...original, fetchWorkflowEvidence: mocks.fetchWorkflowEvidence };
});

import { POST } from "./route";

const secret = "test-secret";
const runRevision = "2026-07-20T13:00:00.000Z";
const diagnosis = {
  summary:
    "The deployment job has a verified failure. The supplied evidence localizes it to the authentication step.",
  likelyCause:
    "The authentication step is the narrowest supported cause hypothesis in the available job context.",
  evidence: ["run:status", "step:7788:2"],
  confidence: "medium" as const,
  limitations: ["Raw workflow logs were not supplied."],
  recommendations: [
    {
      priority: 1,
      action: "Inspect the failed authentication step.",
      rationale: "The supplied job record identifies that step as failed.",
      verification: "Confirm the first error before changing credentials.",
    },
  ],
  model: "gpt-5.6-sol",
  requestedModel: "gpt-5.6",
  responseId: "resp_test",
  generatedAt: "2026-07-20T13:00:00.000Z",
  provenance: "openai-api" as const,
};
const workflowPayload = {
  action: "completed",
  repository: { full_name: "VolantTyler/cognitive-bridge-demo" },
  workflow_run: {
    id: 12345,
    name: "Deploy sandbox",
    display_title: "test: controlled failure",
    head_branch: "main",
    head_sha: "abcdef0123456789",
    status: "completed",
    conclusion: "failure",
    event: "push",
    created_at: "2026-07-16T16:00:00.000Z",
    updated_at: "2026-07-16T16:02:05.000Z",
    html_url:
      "https://github.com/VolantTyler/cognitive-bridge-demo/actions/runs/12345",
    actor: { login: "VolantTyler" },
  },
};

function signedRequest(payload: Record<string, unknown> = workflowPayload) {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  return new Request("http://localhost/api/webhooks/github", {
    method: "POST",
    body,
    headers: {
      "x-github-delivery": "550e8400-e29b-41d4-a716-446655440000",
      "x-github-event": "workflow_run",
      "x-hub-signature-256": signature,
    },
  });
}

async function runAfterCallbacks() {
  const callbacks = [...mocks.afterCallbacks];
  mocks.afterCallbacks.length = 0;
  await Promise.all(callbacks.map((callback) => callback()));
}

beforeEach(() => {
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  mocks.fetchWorkflowEvidence.mockResolvedValue({
    items: [],
    status: "available",
    note: null,
  });
  mocks.diagnoseFailure.mockResolvedValue(null);
  mocks.notifySlack.mockResolvedValue(true);
  mocks.savePipelineRunAnalysis.mockResolvedValue("saved");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GitHub webhook persistence ordering", () => {
  it("responds successfully without waiting for deliberately slow diagnosis", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(runRevision);
    mocks.diagnoseFailure.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(null), 60_000)),
    );

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      persisted: true,
      status: "failure",
      diagnosisScheduled: true,
    });
    expect(mocks.diagnoseFailure).not.toHaveBeenCalled();
    expect(mocks.notifySlack).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(1);
  });

  it("persists event and normalized run before acknowledgement", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(runRevision);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.savePipelineEvent).toHaveBeenCalledBefore(mocks.savePipelineRun);
    expect(mocks.savePipelineRun).toHaveBeenCalledBefore(
      vi.mocked(await import("next/server")).after,
    );
  });

  it("starts optional work only after persistence and after the post-response callback runs", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(runRevision);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.fetchWorkflowEvidence).not.toHaveBeenCalled();
    await runAfterCallbacks();
    expect(mocks.savePipelineRun).toHaveBeenCalledBefore(mocks.fetchWorkflowEvidence);
    expect(mocks.fetchWorkflowEvidence).toHaveBeenCalledOnce();
    expect(mocks.diagnoseFailure).toHaveBeenCalledOnce();
    expect(mocks.notifySlack).toHaveBeenCalledOnce();
  });

  it("stores model output with an analysis-only update", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(runRevision);
    mocks.diagnoseFailure.mockResolvedValue(diagnosis);

    const response = await POST(signedRequest());
    await runAfterCallbacks();

    expect(response.status).toBe(200);
    expect(mocks.savePipelineRun).toHaveBeenCalledOnce();
    expect(mocks.savePipelineRunAnalysis).toHaveBeenCalledWith(
      "12345",
      "failure",
      diagnosis,
      runRevision,
    );
  });

  it("discards an analysis when a newer run revision arrives before optional work finishes", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(runRevision);
    mocks.diagnoseFailure.mockResolvedValue(diagnosis);
    mocks.savePipelineRunAnalysis.mockResolvedValue("stale");

    const response = await POST(signedRequest());
    await runAfterCallbacks();

    expect(response.status).toBe(200);
    expect(mocks.savePipelineRunAnalysis).toHaveBeenCalledWith(
      "12345",
      "failure",
      diagnosis,
      runRevision,
    );
    expect(mocks.notifySlack).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosis: null }),
    );
  });

  it("stops before optional work when event storage is unavailable", async () => {
    mocks.savePipelineEvent.mockResolvedValue("unavailable");

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
    expect(mocks.diagnoseFailure).not.toHaveBeenCalled();
    expect(mocks.notifySlack).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  it("does not repeat optional work or notify twice for a duplicate delivery", async () => {
    mocks.savePipelineEvent.mockResolvedValueOnce("stored").mockResolvedValueOnce("duplicate");
    mocks.savePipelineRun.mockResolvedValue(runRevision);

    const first = await POST(signedRequest());
    const retry = await POST(signedRequest());
    await runAfterCallbacks();

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.notifySlack).toHaveBeenCalledOnce();
  });

  it("stops before optional work when normalized run storage fails", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(false);

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(mocks.diagnoseFailure).not.toHaveBeenCalled();
    expect(mocks.notifySlack).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  it("keeps diagnosis and Slack failures outside the accepted response", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(runRevision);
    mocks.diagnoseFailure.mockRejectedValue(new Error("slow model failed"));
    mocks.notifySlack.mockRejectedValue(new Error("slack failed"));

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      diagnosisScheduled: true,
    });
    await expect(runAfterCallbacks()).resolves.toBeUndefined();
    expect(mocks.savePipelineRun).toHaveBeenCalledOnce();
  });

  it("rejects invalid signatures before persistence", async () => {
    const request = signedRequest();
    request.headers.set("x-hub-signature-256", "sha256=invalid");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.savePipelineEvent).not.toHaveBeenCalled();
  });

  it("requires a signed GitHub event header before persistence", async () => {
    const request = signedRequest();
    request.headers.delete("x-github-event");

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.savePipelineEvent).not.toHaveBeenCalled();
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
  });

  it("requires a GitHub delivery GUID before persistence", async () => {
    const request = signedRequest();
    request.headers.set("x-github-delivery", "delivery-123");

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.savePipelineEvent).not.toHaveBeenCalled();
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
  });

  it("acknowledges a signed GitHub ping without persisting it", async () => {
    const request = signedRequest({ zen: "Keep it logically awesome." });
    request.headers.set("x-github-event", "ping");

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      persisted: false,
      eventName: "ping",
    });
    expect(mocks.savePipelineEvent).not.toHaveBeenCalled();
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
  });

  it("rejects signed unsupported events before persistence", async () => {
    const request = signedRequest();
    request.headers.set("x-github-event", "push");

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(mocks.savePipelineEvent).not.toHaveBeenCalled();
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
  });

  it("accepts signed workflow runs from any configured repository", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(runRevision);
    const response = await POST(
      signedRequest({
        ...workflowPayload,
        repository: { full_name: "VolantTyler/another-repository" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.savePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({ repository: "VolantTyler/another-repository" }),
    );
    expect(mocks.savePipelineRun).toHaveBeenCalledWith(
      expect.objectContaining({ repository: "VolantTyler/another-repository" }),
    );
  });

  it("rejects malformed workflow payloads before event persistence", async () => {
    const response = await POST(signedRequest({ action: "completed", repository: {} }));

    expect(response.status).toBe(422);
    expect(mocks.savePipelineEvent).not.toHaveBeenCalled();
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });
});
