import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  diagnoseFailure: vi.fn(),
  fetchWorkflowEvidence: vi.fn(),
  notifySlack: vi.fn(),
  savePipelineEvent: vi.fn(),
  savePipelineRun: vi.fn(),
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

function signedRequest() {
  const body = JSON.stringify(workflowPayload);
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

beforeEach(() => {
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GitHub webhook persistence ordering", () => {
  it("stops before optional work when event storage is unavailable", async () => {
    mocks.savePipelineEvent.mockResolvedValue("unavailable");

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
    expect(mocks.diagnoseFailure).not.toHaveBeenCalled();
    expect(mocks.notifySlack).not.toHaveBeenCalled();
  });

  it("does not repeat optional work for a duplicate delivery", async () => {
    mocks.savePipelineEvent.mockResolvedValue("duplicate");

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true });
    expect(mocks.savePipelineRun).not.toHaveBeenCalled();
    expect(mocks.diagnoseFailure).not.toHaveBeenCalled();
    expect(mocks.notifySlack).not.toHaveBeenCalled();
  });

  it("stops before optional work when normalized run storage fails", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(false);

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(mocks.diagnoseFailure).not.toHaveBeenCalled();
    expect(mocks.notifySlack).not.toHaveBeenCalled();
  });

  it("reports every persisted workflow failure to Slack", async () => {
    mocks.savePipelineEvent.mockResolvedValue("stored");
    mocks.savePipelineRun.mockResolvedValue(true);
    mocks.fetchWorkflowEvidence.mockResolvedValue([]);
    mocks.diagnoseFailure.mockResolvedValue(null);
    mocks.notifySlack.mockResolvedValue(true);

    const response = await POST(signedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      persisted: true,
      status: "failure",
      diagnosed: false,
    });
    expect(mocks.notifySlack).toHaveBeenCalledOnce();
    expect(mocks.notifySlack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "12345",
        status: "failure",
      }),
    );
    expect(mocks.savePipelineRun.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.notifySlack.mock.invocationCallOrder[0],
    );
  });
});
