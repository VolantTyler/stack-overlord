import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  analyzePipelineRun,
  isOpenAIAnalysisConfigured,
} from "@/lib/diagnosis";
import { fetchWorkflowEvidence } from "@/lib/github";
import type { Diagnosis } from "@/lib/pipeline";
import {
  getPipelineRunById,
  savePipelineRunAnalysis,
} from "@/lib/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

const runIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

const inFlightAnalyses = new Map<string, Promise<Diagnosis>>();

const generationWindowMs = 60_000;
const perClientGenerationLimit = 5;
const instanceGenerationLimit = 60;
const maxClientRateLimitBuckets = 1_024;

type RateLimitBucket = {
  count: number;
  startedAt: number;
};

const clientGenerationBuckets = new Map<string, RateLimitBucket>();
const instanceGenerationBucket: RateLimitBucket = {
  count: 0,
  startedAt: 0,
};

class AnalysisRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isCurrentLiveAnalysis(diagnosis: Diagnosis | null) {
  return Boolean(
    diagnosis &&
      diagnosis.schemaVersion === 2 &&
      diagnosis.promptVersion === "pipeline-analysis-v2" &&
      diagnosis.provenance === "openai-api" &&
      diagnosis.context,
  );
}

function configuredAnalysisAccessToken() {
  const token = process.env.ANALYSIS_ACCESS_TOKEN?.trim();
  return token || null;
}

function hasValidAnalysisAccessToken(
  request: Request,
  configuredToken: string,
) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer[ \t]+(\S+)$/i);

  if (!match) {
    return false;
  }

  const configuredDigest = createHash("sha256")
    .update(configuredToken, "utf8")
    .digest();
  const suppliedDigest = createHash("sha256")
    .update(match[1], "utf8")
    .digest();

  return timingSafeEqual(configuredDigest, suppliedDigest);
}

function isAllowedBrowserOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite) {
    return fetchSite === "same-origin";
  }

  if (!origin) return false;

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",", 1)[0]
      ?.trim();
    const host =
      forwardedHost || request.headers.get("host")?.trim() || requestUrl.host;
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",", 1)[0]
      ?.trim();
    const protocol = forwardedProtocol || requestUrl.protocol.replace(":", "");

    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

function requestClientKey(request: Request) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  const clientAddress =
    forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";

  return clientAddress.slice(0, 128);
}

function pruneClientRateLimitBuckets(now: number) {
  for (const [key, bucket] of clientGenerationBuckets) {
    if (now - bucket.startedAt >= generationWindowMs) {
      clientGenerationBuckets.delete(key);
    }
  }

  while (clientGenerationBuckets.size >= maxClientRateLimitBuckets) {
    const oldestKey = clientGenerationBuckets.keys().next().value;
    if (!oldestKey) break;
    clientGenerationBuckets.delete(oldestKey);
  }
}

function consumeGenerationCapacity(
  request: Request,
  now = Date.now(),
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  pruneClientRateLimitBuckets(now);

  if (
    instanceGenerationBucket.startedAt === 0 ||
    now - instanceGenerationBucket.startedAt >= generationWindowMs
  ) {
    instanceGenerationBucket.startedAt = now;
    instanceGenerationBucket.count = 0;
  }

  const clientKey = requestClientKey(request);
  let clientBucket = clientGenerationBuckets.get(clientKey);
  if (
    !clientBucket ||
    now - clientBucket.startedAt >= generationWindowMs
  ) {
    clientBucket = { count: 0, startedAt: now };
  }

  const clientBlocked = clientBucket.count >= perClientGenerationLimit;
  const instanceBlocked =
    instanceGenerationBucket.count >= instanceGenerationLimit;

  if (clientBlocked || instanceBlocked) {
    const retryAt = Math.max(
      clientBlocked
        ? clientBucket.startedAt + generationWindowMs
        : now,
      instanceBlocked
        ? instanceGenerationBucket.startedAt + generationWindowMs
        : now,
    );
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1_000)),
    };
  }

  clientBucket.count += 1;
  clientGenerationBuckets.set(clientKey, clientBucket);
  instanceGenerationBucket.count += 1;
  return { allowed: true };
}

export function resetAnalysisGenerationRateLimits() {
  clientGenerationBuckets.clear();
  instanceGenerationBucket.count = 0;
  instanceGenerationBucket.startedAt = 0;
}

async function generateAnalysis(
  run: NonNullable<Awaited<ReturnType<typeof getPipelineRunById>>["run"]>,
  expectedUpdatedAt: string,
) {
  const evidence = await fetchWorkflowEvidence(run, {
    authentication: "anonymous",
  });
  const analysis = await analyzePipelineRun(run, evidence);

  if (!analysis) {
    throw new AnalysisRequestError(
      "OpenAI did not return a structured analysis for this run.",
      503,
    );
  }

  const persistence = await savePipelineRunAnalysis(
    run.id,
    run.status,
    analysis,
    expectedUpdatedAt,
  );

  if (persistence !== "saved") {
    throw new AnalysisRequestError(
      "The workflow changed while it was being analyzed. Retry with its current state.",
      409,
    );
  }

  return analysis;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAllowedBrowserOrigin(request)) {
    return Response.json(
      { error: "Cross-origin analysis requests are not allowed." },
      {
        status: 403,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  const parsedId = runIdSchema.safeParse((await params).id);
  if (!parsedId.success) {
    return Response.json(
      { error: "Pipeline run id is invalid." },
      { status: 400 },
    );
  }

  let canonicalRun: Awaited<ReturnType<typeof getPipelineRunById>>;
  try {
    canonicalRun = await getPipelineRunById(parsedId.data);
  } catch (error) {
    console.error("Unable to load the pipeline run for analysis.", error);
    return Response.json(
      { error: "The pipeline run could not be loaded." },
      { status: 500 },
    );
  }

  if (!canonicalRun.run) {
    return Response.json(
      { error: "Pipeline run was not found." },
      { status: 404 },
    );
  }

  if (
    canonicalRun.source === "demo" &&
    canonicalRun.run.diagnosis
  ) {
    return Response.json(
      {
        analysis: canonicalRun.run.diagnosis,
        cached: true,
        run: canonicalRun.run,
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  if (canonicalRun.source === "demo") {
    return Response.json(
      {
        error:
          "This demo run does not have a seeded analysis. Demo records are never sent to OpenAI.",
      },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (isCurrentLiveAnalysis(canonicalRun.run.diagnosis)) {
    return Response.json(
      {
        analysis: canonicalRun.run.diagnosis,
        cached: true,
        run: canonicalRun.run,
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const accessToken = configuredAnalysisAccessToken();
  if (!accessToken) {
    return Response.json(
      {
        error:
          "On-demand analysis access is not configured. Set ANALYSIS_ACCESS_TOKEN before requesting a new model response.",
        accessTokenConfigured: false,
      },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (!hasValidAnalysisAccessToken(request, accessToken)) {
    return Response.json(
      {
        error:
          "A valid analysis access token is required to generate a new analysis.",
        requiresAccessToken: true,
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": 'Bearer realm="pipeline-analysis"',
        },
      },
    );
  }

  if (!isOpenAIAnalysisConfigured()) {
    return Response.json(
      {
        error:
          "OpenAI analysis is not configured. The GitHub-owned workflow state remains unchanged.",
      },
      { status: 503 },
    );
  }

  const existingRequest = inFlightAnalyses.get(canonicalRun.run.id);
  if (!existingRequest && !canonicalRun.updatedAt) {
    return Response.json(
      {
        error:
          "The stored workflow revision could not be established safely. Retry after reloading the ledger.",
      },
      {
        status: 409,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (!existingRequest) {
    const rateLimit = consumeGenerationCapacity(request);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error:
            "AI analysis generation is temporarily rate limited. Existing analyses remain available.",
        },
        {
          status: 429,
          headers: {
            "cache-control": "no-store",
            "retry-after": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
  }

  const analysisPromise =
    existingRequest ??
    generateAnalysis(canonicalRun.run, canonicalRun.updatedAt!);

  if (!existingRequest) {
    inFlightAnalyses.set(canonicalRun.run.id, analysisPromise);
  }

  try {
    const analysis = await analysisPromise;
    return Response.json(
      {
        analysis,
        cached: false,
        run: { ...canonicalRun.run, diagnosis: analysis },
        sharedRequest: Boolean(existingRequest),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AnalysisRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error(
      JSON.stringify({
        message: "pipeline_analysis_failed",
        runId: canonicalRun.run.id,
      }),
      error,
    );
    return Response.json(
      {
        error:
          "OpenAI analysis could not be completed. The GitHub-owned workflow state remains unchanged.",
      },
      { status: 502 },
    );
  } finally {
    if (!existingRequest) {
      inFlightAnalyses.delete(canonicalRun.run.id);
    }
  }
}
