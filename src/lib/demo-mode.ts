import { demoPipelineRuns } from "@/lib/demo-data";
import type { PipelineRun } from "@/lib/pipeline";

export type DashboardMode = "auto" | "demo";

export type DashboardSearchParams = {
  mode?: string | string[];
  replay?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDemoReplayTimestamp(
  value: string | string[] | undefined,
) {
  const candidate = firstValue(value);
  if (!candidate || !/^\d{13}$/.test(candidate)) return null;

  const timestamp = Number(candidate);
  return Number.isSafeInteger(timestamp) &&
    !Number.isNaN(new Date(timestamp).getTime())
    ? timestamp
    : null;
}

export function readDashboardMode(searchParams: DashboardSearchParams) {
  const mode: DashboardMode =
    firstValue(searchParams.mode) === "demo" ? "demo" : "auto";

  return {
    mode,
    replayTimestamp:
      mode === "demo"
        ? parseDemoReplayTimestamp(searchParams.replay)
        : null,
  };
}

export function createDemoFailureReplay(
  replayTimestamp: number,
): PipelineRun | null {
  if (
    !Number.isSafeInteger(replayTimestamp) ||
    Number.isNaN(new Date(replayTimestamp).getTime())
  ) {
    return null;
  }

  const template = demoPipelineRuns.find(
    (run) => run.status === "failure" && run.diagnosis,
  );
  if (!template?.diagnosis) return null;

  const completedAt = new Date(replayTimestamp);
  const commitSeed = `${replayTimestamp.toString(16)}${template.commitSha}`;

  return {
    ...template,
    id: `demo-replay-${replayTimestamp}`,
    commitSha: `${commitSeed}${commitSeed}${commitSeed}`.slice(0, 40),
    commitMessage: "demo: replay missing sandbox credential",
    startedAt: new Date(replayTimestamp - 94_000).toISOString(),
    completedAt: completedAt.toISOString(),
    durationSeconds: 94,
    diagnosis: {
      ...template.diagnosis,
      provenance: "demo-fixture",
      responseId: null,
    },
    isReplay: true,
  };
}

export function getDemoPipelineRuns(replayTimestamp: number | null = null) {
  if (replayTimestamp === null) return [...demoPipelineRuns];

  const replay = createDemoFailureReplay(replayTimestamp);
  return replay ? [replay, ...demoPipelineRuns] : [...demoPipelineRuns];
}
