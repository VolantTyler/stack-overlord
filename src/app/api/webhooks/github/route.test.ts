import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => void | Promise<void>>,
  diagnoseFailure: vi.fn(),
  fetchWorkflowEvidence: vi.fn(),
  notifySlack: vi.fn(),
  savePipelineEvent: vi.fn(),
  savePipelineRun: vi.fn(),
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
}));
vi.mock("@/lib/github", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/github")>();
  return { ...original, fetchWorkflowEvidence: mocks.fetchWorkflowEvidence };
});

import { POST } from "./route";

const secret = "test-secret";
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
      "x-github-delivery": "delivery-123",
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
  mocks.fetchWorkflowEvidence.mockResolvedValue([]);
  mocks.diagnoseFailure.mockResolvedValue(null);
  mocks.notifySlack.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GitHub webhook persistence ordering", () => {
  it("responds successfully without waiting for deliberately slow diagnosis", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(true);
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
    mocks.savePipelineRun.mockResolvedValue(true);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.savePipelineEvent).toHaveBeenCalledBefore(mocks.savePipelineRun);
    expect(mocks.savePipelineRun).toHaveBeenCalledBefore(
      vi.mocked(await import("next/server")).after,
    );
  });

  it("starts optional work only after persistence and after the post-response callback runs", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(true);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    expect(mocks.fetchWorkflowEvidence).not.toHaveBeenCalled();
    await runAfterCallbacks();
    expect(mocks.savePipelineRun).toHaveBeenCalledBefore(mocks.fetchWorkflowEvidence);
    expect(mocks.fetchWorkflowEvidence).toHaveBeenCalledOnce();
    expect(mocks.diagnoseFailure).toHaveBeenCalledOnce();
    expect(mocks.notifySlack).toHaveBeenCalledOnce();
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
    mocks.savePipelineRun.mockResolvedValue(true);

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
    mocks.savePipelineRun.mockResolvedValue(true);
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

  it("returns unsupported-payload status after event persistence only", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    const response = await POST(signedRequest({ action: "completed", repository: {} }));

    expect(response.status).toBe(422);
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
  });
});
