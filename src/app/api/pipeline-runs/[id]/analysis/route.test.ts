import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzePipelineRun: vi.fn(),
  fetchWorkflowEvidence: vi.fn(),
  getPipelineRunById: vi.fn(),
  isOpenAIAnalysisConfigured: vi.fn(),
  savePipelineRunAnalysis: vi.fn(),
}));

vi.mock("@/lib/diagnosis", () => ({
  analyzePipelineRun: mocks.analyzePipelineRun,
  isOpenAIAnalysisConfigured: mocks.isOpenAIAnalysisConfigured,
}));
vi.mock("@/lib/github", () => ({
  fetchWorkflowEvidence: mocks.fetchWorkflowEvidence,
}));
vi.mock("@/lib/repository", () => ({
  getPipelineRunById: mocks.getPipelineRunById,
  savePipelineRunAnalysis: mocks.savePipelineRunAnalysis,
}));

import type { Diagnosis, PipelineRun } from "@/lib/pipeline";

import { POST, resetAnalysisGenerationRateLimits } from "./route";

const revision = "2026-07-20T12:59:00.000Z";
const accessToken = "test-analysis-access-token";

const run: PipelineRun = {
  id: "12345",
  repository: "VolantTyler/cognitive-bridge-demo",
  branch: "main",
  commitSha: "abcdef0123456789",
  commitMessage: "test: exercise on-demand analysis",
  workflowName: "Deploy sandbox",
  status: "success",
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

const analysis: Diagnosis = {
  summary:
    "GitHub records a successful workflow conclusion. The supplied context supports that outcome without claiming later deployment health.",
  likelyCause:
    "No failure cause applies; the defensible interpretation is limited to the recorded successful workflow outcome.",
  evidence: ["run:status"],
  confidence: "high",
  limitations: ["Deployment-provider records were not supplied."],
  recommendations: [
    {
      priority: 1,
      action: "Confirm the expected sandbox release is reachable.",
      rationale:
        "A successful workflow conclusion does not independently verify runtime availability.",
      verification: "Open the sandbox health check and confirm a successful response.",
    },
  ],
  model: "gpt-5.6-sol-2026-06-01",
  requestedModel: "gpt-5.6",
  responseId: "resp_live_success",
  generatedAt: "2026-07-20T13:00:00.000Z",
  provenance: "openai-api",
  schemaVersion: 2,
  promptVersion: "pipeline-analysis-v2",
  context: {
    status: "success",
    evidence: [
      {
        id: "run:status",
        source: "github_workflow_run",
        fact: 'GitHub records workflow status "success".',
      },
    ],
    githubEvidenceStatus: "available",
    githubEvidenceNote: null,
    notProvided: ["Raw workflow logs"],
  },
};

function requestFor(
  id: string,
  headers: Record<string, string> = {},
) {
  return POST(
    new Request(`http://localhost/api/pipeline-runs/${id}/analysis`, {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "sec-fetch-site": "same-origin",
        authorization: `Bearer ${accessToken}`,
        ...headers,
      },
    }),
    {
      params: Promise.resolve({ id }),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANALYSIS_ACCESS_TOKEN", accessToken);
  resetAnalysisGenerationRateLimits();
  mocks.getPipelineRunById.mockResolvedValue({
    run,
    source: "postgres",
    updatedAt: revision,
    revision,
  });
  mocks.isOpenAIAnalysisConfigured.mockReturnValue(true);
  mocks.fetchWorkflowEvidence.mockResolvedValue({
    items: [],
    status: "available",
    note: null,
  });
  mocks.analyzePipelineRun.mockResolvedValue(analysis);
  mocks.savePipelineRunAnalysis.mockResolvedValue("saved");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("on-demand pipeline analysis", () => {
  it("rejects cross-origin browser requests before loading a run", async () => {
    const response = await requestFor(run.id, {
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
    });

    expect(response.status).toBe(403);
    expect(mocks.getPipelineRunById).not.toHaveBeenCalled();
  });

  it("rejects non-browser requests without an Origin header", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/pipeline-runs/${run.id}/analysis`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: run.id }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.getPipelineRunById).not.toHaveBeenCalled();
  });

  it("accepts same-origin browser metadata when the server normalizes its request URL host", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/pipeline-runs/${run.id}/analysis`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            origin: "http://127.0.0.1",
            "sec-fetch-site": "same-origin",
          },
        },
      ),
      { params: Promise.resolve({ id: run.id }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.analyzePipelineRun).toHaveBeenCalledOnce();
  });

  it("rejects invalid and unknown canonical run ids", async () => {
    const invalid = await requestFor("not valid");
    expect(invalid.status).toBe(400);
    expect(mocks.getPipelineRunById).not.toHaveBeenCalled();

    mocks.getPipelineRunById.mockResolvedValueOnce({
      run: null,
      source: "postgres",
      updatedAt: null,
      revision: null,
    });
    const missing = await requestFor("99999");
    expect(missing.status).toBe(404);
    expect(mocks.analyzePipelineRun).not.toHaveBeenCalled();
  });

  it("returns a stored analysis without another GitHub or OpenAI request", async () => {
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", "");
    mocks.getPipelineRunById.mockResolvedValue({
      run: { ...run, diagnosis: analysis },
      source: "postgres",
      updatedAt: revision,
      revision,
    });

    const response = await requestFor(run.id, { authorization: "" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      analysis,
      cached: true,
      run: { ...run, diagnosis: analysis },
    });
    expect(mocks.fetchWorkflowEvidence).not.toHaveBeenCalled();
    expect(mocks.analyzePipelineRun).not.toHaveBeenCalled();
    expect(mocks.savePipelineRunAnalysis).not.toHaveBeenCalled();
  });

  it("returns 503 before a model call when analysis access is not configured", async () => {
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", "");

    const response = await requestFor(run.id);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("ANALYSIS_ACCESS_TOKEN"),
      accessTokenConfigured: false,
    });
    expect(mocks.isOpenAIAnalysisConfigured).not.toHaveBeenCalled();
    expect(mocks.fetchWorkflowEvidence).not.toHaveBeenCalled();
    expect(mocks.analyzePipelineRun).not.toHaveBeenCalled();
    expect(mocks.savePipelineRunAnalysis).not.toHaveBeenCalled();
  });

  it("returns the same 401 contract for missing and invalid bearer tokens", async () => {
    const missing = await requestFor(run.id, { authorization: "" });
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({
      requiresAccessToken: true,
    });
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");

    const invalid = await requestFor(run.id, {
      authorization: "Bearer wrong-analysis-access-token",
    });
    expect(invalid.status).toBe(401);
    await expect(invalid.json()).resolves.toMatchObject({
      requiresAccessToken: true,
    });
    expect(mocks.isOpenAIAnalysisConfigured).not.toHaveBeenCalled();
    expect(mocks.fetchWorkflowEvidence).not.toHaveBeenCalled();
    expect(mocks.analyzePipelineRun).not.toHaveBeenCalled();
    expect(mocks.savePipelineRunAnalysis).not.toHaveBeenCalled();
  });

  it("accepts the valid bearer token, analyzes the server-loaded run, and updates only its analysis", async () => {
    const response = await requestFor(run.id);

    expect(response.status).toBe(200);
    expect(mocks.fetchWorkflowEvidence).toHaveBeenCalledWith(run, {
      authentication: "anonymous",
    });
    expect(mocks.analyzePipelineRun).toHaveBeenCalledWith(
      run,
      expect.objectContaining({ status: "available" }),
    );
    expect(mocks.savePipelineRunAnalysis).toHaveBeenCalledWith(
      run.id,
      "success",
      analysis,
      revision,
    );
    await expect(response.json()).resolves.toMatchObject({
      analysis,
      cached: false,
      run: { ...run, diagnosis: analysis },
    });
  });

  it("regenerates legacy Postgres analyses instead of treating them as current", async () => {
    mocks.getPipelineRunById.mockResolvedValue({
      run: {
        ...run,
        diagnosis: {
          ...analysis,
          promptVersion: "pipeline-analysis-v1",
        },
      },
      source: "postgres",
      updatedAt: revision,
      revision,
    });

    const response = await requestFor(run.id);

    expect(response.status).toBe(200);
    expect(mocks.analyzePipelineRun).toHaveBeenCalledOnce();
    expect(mocks.savePipelineRunAnalysis).toHaveBeenCalledWith(
      run.id,
      run.status,
      analysis,
      revision,
    );
  });

  it("serves only seeded demo analyses and never generates for demo records", async () => {
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", "");
    const fixtureAnalysis = {
      ...analysis,
      model: "not-applicable",
      requestedModel: undefined,
      responseId: null,
      provenance: "demo-fixture" as const,
      promptVersion: undefined,
      fixtureVersion: "demo-fixture-v2",
    };
    mocks.getPipelineRunById.mockResolvedValueOnce({
      run: { ...run, diagnosis: fixtureAnalysis },
      source: "demo",
      updatedAt: null,
      revision: null,
    });

    const seeded = await requestFor(run.id, { authorization: "" });
    expect(seeded.status).toBe(200);
    const seededPayload = await seeded.json();
    expect(seededPayload).toMatchObject({
      analysis: {
        fixtureVersion: "demo-fixture-v2",
        model: "not-applicable",
        provenance: "demo-fixture",
        responseId: null,
      },
      cached: true,
      run: {
        id: run.id,
        diagnosis: {
          fixtureVersion: "demo-fixture-v2",
          provenance: "demo-fixture",
        },
      },
    });
    expect(seededPayload.analysis).not.toHaveProperty("requestedModel");
    expect(seededPayload.analysis).not.toHaveProperty("promptVersion");

    mocks.getPipelineRunById.mockResolvedValueOnce({
      run: { ...run, diagnosis: null },
      source: "demo",
      updatedAt: null,
      revision: null,
    });
    const unseeded = await requestFor(run.id, { authorization: "" });
    expect(unseeded.status).toBe(503);
    await expect(unseeded.json()).resolves.toMatchObject({
      error: expect.stringContaining("never sent to OpenAI"),
    });
    expect(mocks.fetchWorkflowEvidence).not.toHaveBeenCalled();
    expect(mocks.analyzePipelineRun).not.toHaveBeenCalled();
  });

  it("keeps factual state intact when OpenAI is unavailable or the run changes", async () => {
    mocks.isOpenAIAnalysisConfigured.mockReturnValueOnce(false);
    const unavailable = await requestFor(run.id);
    expect(unavailable.status).toBe(503);
    expect(mocks.fetchWorkflowEvidence).not.toHaveBeenCalled();
    expect(mocks.savePipelineRunAnalysis).not.toHaveBeenCalled();

    mocks.savePipelineRunAnalysis.mockResolvedValueOnce("stale");
    const stale = await requestFor(run.id);
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: expect.stringContaining("workflow changed"),
    });
  });

  it("rate limits only new per-client generations while cached analysis stays available", async () => {
    for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
      const response = await requestFor(run.id, {
        "x-forwarded-for": "198.51.100.8",
      });
      expect(response.status).toBe(200);
    }

    const limited = await requestFor(run.id, {
      "x-forwarded-for": "198.51.100.8",
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(mocks.analyzePipelineRun).toHaveBeenCalledTimes(5);

    mocks.getPipelineRunById.mockResolvedValueOnce({
      run: { ...run, diagnosis: analysis },
      source: "postgres",
      updatedAt: revision,
      revision,
    });
    const cached = await requestFor(run.id, {
      "x-forwarded-for": "198.51.100.8",
    });
    expect(cached.status).toBe(200);
    await expect(cached.json()).resolves.toMatchObject({ cached: true });
    expect(mocks.analyzePipelineRun).toHaveBeenCalledTimes(5);
  });

  it("applies a per-instance generation limit across distinct clients", async () => {
    for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
      const response = await requestFor(run.id, {
        "x-forwarded-for": `198.51.100.${requestNumber}`,
      });
      expect(response.status).toBe(200);
    }

    const limited = await requestFor(run.id, {
      "x-forwarded-for": "203.0.113.250",
    });
    expect(limited.status).toBe(429);
    expect(mocks.analyzePipelineRun).toHaveBeenCalledTimes(60);
  });

  it("shares concurrent generation for the same stored run", async () => {
    let resolveAnalysis: (value: Diagnosis) => void = () => undefined;
    mocks.analyzePipelineRun.mockReturnValue(
      new Promise<Diagnosis>((resolve) => {
        resolveAnalysis = resolve;
      }),
    );

    const firstResponse = requestFor(run.id);
    const secondResponse = requestFor(run.id);

    await vi.waitFor(() => {
      expect(mocks.analyzePipelineRun).toHaveBeenCalledOnce();
    });
    resolveAnalysis(analysis);

    const [first, second] = await Promise.all([firstResponse, secondResponse]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.savePipelineRunAnalysis).toHaveBeenCalledOnce();
    const payloads = await Promise.all([first.json(), second.json()]);
    expect(payloads.some((payload) => payload.sharedRequest === true)).toBe(true);
  });
});
