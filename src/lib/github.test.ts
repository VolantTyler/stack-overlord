import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWorkflowEvidence,
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

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

  it("uses an explicit dispatch run name as the dashboard workflow label", () => {
    const run = workflowRunFromPayload({
      ...workflowPayload,
      workflow_run: {
        ...workflowPayload.workflow_run,
        name: "Sandbox Deployment Demo",
        display_title: "Sandbox Deploy: Fail",
        event: "workflow_dispatch",
      },
    });

    expect(run?.workflowName).toBe("Sandbox Deploy: Fail");
  });

  it("keeps commit messages out of workflow labels for push events", () => {
    const run = workflowRunFromPayload(workflowPayload);

    expect(run?.workflowName).toBe("Deploy to Firebase Hosting on Merge");
    expect(run?.commitMessage).toBe("feat: improve dashboard");
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

describe("fetchWorkflowEvidence", () => {
  it("returns stable GitHub job and relevant step evidence for any run state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        total_count: 1,
        jobs: [
          {
            id: 7788,
            name: "Deploy sandbox",
            status: "completed",
            conclusion: "failure",
            started_at: "2026-07-16T16:00:00.000Z",
            completed_at: "2026-07-16T16:02:05.000Z",
            steps: [
              {
                number: 1,
                name: "Build",
                status: "completed",
                conclusion: "success",
              },
              {
                number: 2,
                name: "Authenticate",
                status: "completed",
                conclusion: "failure",
              },
            ],
          },
        ],
      }),
    );

    const run = workflowRunFromPayload(workflowPayload);
    expect(run).not.toBeNull();

    await expect(fetchWorkflowEvidence(run!)).resolves.toEqual({
      items: [
        {
          id: "job:7788",
          source: "github_actions_jobs",
          fact:
            'GitHub Actions job "Deploy sandbox" has status "completed" and conclusion "failure". It ran from 2026-07-16T16:00:00.000Z to 2026-07-16T16:02:05.000Z.',
        },
        {
          id: "step:7788:2",
          source: "github_actions_jobs",
          fact:
            'Step 2, "Authenticate", in job "Deploy sandbox" has status "completed" and conclusion "failure".',
        },
      ],
      status: "available",
      note: null,
    });
  });

  it("records unavailable job context without inventing evidence", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const run = workflowRunFromPayload(workflowPayload);

    await expect(fetchWorkflowEvidence(run!)).resolves.toEqual({
      items: [],
      status: "unavailable",
      note: "GitHub Actions job details were unavailable (HTTP 404).",
    });
  });

  it("omits the configured GitHub token when anonymous evidence is requested", async () => {
    vi.stubEnv("GITHUB_TOKEN", "github-secret-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ total_count: 0, jobs: [] }),
    );
    const run = workflowRunFromPayload(workflowPayload);

    await fetchWorkflowEvidence(run!, { authentication: "anonymous" });

    const anonymousHeaders = new Headers(
      (fetchMock.mock.calls[0][1] as RequestInit).headers,
    );
    expect(anonymousHeaders.has("authorization")).toBe(false);

    await fetchWorkflowEvidence(run!);
    const configuredHeaders = new Headers(
      (fetchMock.mock.calls[1][1] as RequestInit).headers,
    );
    expect(configuredHeaders.get("authorization")).toBe(
      "Bearer github-secret-token",
    );
  });

  it("retains failed job and step evidence when more than 12 records are available", async () => {
    const successfulJobs = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `Successful job ${index + 1}`,
      status: "completed",
      conclusion: "success",
      steps: [],
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        total_count: 13,
        jobs: [
          ...successfulJobs,
          {
            id: 99,
            name: "Deploy sandbox",
            status: "completed",
            conclusion: "failure",
            steps: [
              {
                number: 4,
                name: "Release",
                status: "completed",
                conclusion: "failure",
              },
            ],
          },
        ],
      }),
    );
    const run = workflowRunFromPayload(workflowPayload);

    const result = await fetchWorkflowEvidence(run!);

    expect(result.items).toHaveLength(12);
    expect(result.items.slice(0, 2).map((item) => item.id)).toEqual([
      "job:99",
      "step:99:4",
    ]);
    expect(result.note).toContain("failures and other non-success states first");
  });

  it("discloses when GitHub has more jobs than the first API page supplied", async () => {
    const firstPageJobs = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `Matrix job ${index + 1}`,
      status: "completed",
      conclusion: "success",
      steps: [],
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        total_count: 101,
        jobs: firstPageJobs,
      }),
    );
    const run = workflowRunFromPayload(workflowPayload);

    const result = await fetchWorkflowEvidence(run!);

    expect(result.note).toContain("first API page of 100");
    expect(result.note).toContain("later-page jobs and steps were not provided");
  });
});
