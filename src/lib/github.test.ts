import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  verifyGitHubSignature,
  webhookMetadata,
  workflowRunFromPayload,
} from "@/lib/github";

const workflowPayload = {
  action: "completed",
  repository: { full_name: "VolantTyler/cognitive-bridge-demo" },
  workflow_run: {
    id: 12345,
    name: "Deploy to Firebase Hosting on Merge",
    display_title: "feat: improve dashboard",
    head_branch: "main",
    head_sha: "abcdef0123456789",
    status: "completed",
    conclusion: "failure",
    event: "push",
    created_at: "2026-07-16T16:00:00.000Z",
    updated_at: "2026-07-16T16:02:05.000Z",
    html_url: "https://github.com/VolantTyler/cognitive-bridge-demo/actions/runs/12345",
    actor: { login: "VolantTyler" },
  },
};

describe("verifyGitHubSignature", () => {
  it("accepts a valid sha256 signature", () => {
    const body = JSON.stringify({ hello: "overlord" });
    const secret = "test-secret";
    const signature = `sha256=${createHmac("sha256", secret)
      .update(body)
      .digest("hex")}`;

    expect(verifyGitHubSignature(body, signature, secret)).toBe(true);
  });

  it("rejects missing and invalid signatures", () => {
    expect(verifyGitHubSignature("{}", null, "secret")).toBe(false);
    expect(verifyGitHubSignature("{}", "sha256=bad", "secret")).toBe(false);
  });
});

describe("workflowRunFromPayload", () => {
  it("maps a completed GitHub failure without asking a model for status", () => {
    const run = workflowRunFromPayload(workflowPayload);

    expect(run).toMatchObject({
      id: "12345",
      repository: "VolantTyler/cognitive-bridge-demo",
      status: "failure",
      commitSha: "abcdef0123456789",
      durationSeconds: 125,
      diagnosis: null,
    });
  });

  it("maps an unfinished workflow to running", () => {
    const run = workflowRunFromPayload({
      ...workflowPayload,
      workflow_run: {
        ...workflowPayload.workflow_run,
        status: "in_progress",
        conclusion: null,
      },
    });

    expect(run?.status).toBe("running");
    expect(run?.completedAt).toBeNull();
  });

  it("returns null for unsupported payloads", () => {
    expect(workflowRunFromPayload({ action: "completed" })).toBeNull();
  });
});

describe("webhookMetadata", () => {
  it("extracts repository and action from push and PR events", () => {
    expect(webhookMetadata(workflowPayload)).toEqual({
      action: "completed",
      repository: "VolantTyler/cognitive-bridge-demo",
    });
  });
});
