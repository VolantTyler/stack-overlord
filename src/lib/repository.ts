import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { pipelineEvents, pipelineRuns } from "@/db/schema";
import { demoPipelineRuns } from "@/lib/demo-data";
import type {
  DashboardSource,
  Diagnosis,
  PipelineRun,
  PipelineStatus,
} from "@/lib/pipeline";

function serializeRun(row: typeof pipelineRuns.$inferSelect): PipelineRun {
  return {
    id: row.id,
    repository: row.repository,
    branch: row.branch,
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    workflowName: row.workflowName,
    status: row.status as PipelineStatus,
    environment: row.environment,
    sourceEvent: row.sourceEvent,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    durationSeconds: row.durationSeconds,
    runUrl: row.runUrl,
    deploymentUrl: row.deploymentUrl,
    actor: row.actor,
    diagnosis: row.diagnosis as Diagnosis | null,
    isReplay: row.isReplay,
  };
}

export async function listPipelineRuns(): Promise<{
  runs: PipelineRun[];
  source: DashboardSource;
}>;
export async function listPipelineRuns(input: {
  repository?: string;
}): Promise<{
  runs: PipelineRun[];
  source: DashboardSource;
}>;
export async function listPipelineRuns(input: { repository?: string } = {}): Promise<{
  runs: PipelineRun[];
  source: DashboardSource;
}> {
  const repository = input.repository?.trim();
  const db = getDb();
  if (!db) {
    return {
      runs: repository
        ? demoPipelineRuns.filter((run) => run.repository === repository)
        : demoPipelineRuns,
      source: "demo",
    };
  }

  try {
    let query = db
      .select()
      .from(pipelineRuns)
      .$dynamic();

    if (repository) {
      query = query.where(eq(pipelineRuns.repository, repository));
    }

    const rows = await query.orderBy(desc(pipelineRuns.startedAt)).limit(50);

    return {
      runs: rows.length
        ? rows.map(serializeRun)
        : repository
          ? []
          : demoPipelineRuns,
      source: rows.length || repository ? "postgres" : "demo",
    };
  } catch (error) {
    console.error("Unable to load pipeline runs; using demo data.", error);
    return { runs: demoPipelineRuns, source: "fallback" };
  }
}

export async function savePipelineEvent(input: {
  deliveryId: string;
  eventName: string;
  action: string | null;
  repository: string;
  payload: Record<string, unknown>;
}) {
  const db = getDb();
  if (!db) return "unavailable" as const;

  const inserted = await db
    .insert(pipelineEvents)
    .values(input)
    .onConflictDoNothing({
      target: pipelineEvents.deliveryId,
    })
    .returning({ id: pipelineEvents.id });

  return inserted.length > 0 ? ("stored" as const) : ("duplicate" as const);
}

export async function savePipelineRun(run: PipelineRun) {
  const db = getDb();
  if (!db) return false;

  const updatedAt = new Date();
  const values: typeof pipelineRuns.$inferInsert = {
    ...run,
    startedAt: new Date(run.startedAt),
    completedAt: run.completedAt ? new Date(run.completedAt) : null,
    updatedAt,
  };

  await db
    .insert(pipelineRuns)
    .values(values)
    .onConflictDoUpdate({
      target: pipelineRuns.id,
      set: values,
    });
  return updatedAt.toISOString();
}

export type PipelineRunLookup = {
  run: PipelineRun | null;
  source: "postgres" | "demo";
  updatedAt: string | null;
  revision: string | null;
};

function demoRunLookup(id: string): PipelineRunLookup {
  return {
    run: demoPipelineRuns.find((run) => run.id === id) ?? null,
    source: "demo",
    updatedAt: null,
    revision: null,
  };
}

export async function getPipelineRunById(
  id: string,
): Promise<PipelineRunLookup> {
  const db = getDb();
  if (!db) {
    return demoRunLookup(id);
  }

  try {
    const [row] = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, id))
      .limit(1);

    if (!row) {
      const demoLookup = demoRunLookup(id);
      return demoLookup.run
        ? demoLookup
        : {
            run: null,
            source: "postgres",
            updatedAt: null,
            revision: null,
          };
    }

    const updatedAt = row.updatedAt.toISOString();
    return {
      run: serializeRun(row),
      source: "postgres",
      updatedAt,
      revision: updatedAt,
    };
  } catch (error) {
    console.error("Unable to load a pipeline run; checking demo data.", error);
    return demoRunLookup(id);
  }
}

export async function savePipelineRunAnalysis(
  runId: string,
  expectedStatus: PipelineStatus,
  diagnosis: Diagnosis,
  expectedUpdatedAt?: string,
) {
  const db = getDb();
  if (!db) return "unavailable" as const;

  const expectedRevision = expectedUpdatedAt
    ? new Date(expectedUpdatedAt)
    : null;
  if (expectedRevision && Number.isNaN(expectedRevision.getTime())) {
    return "stale" as const;
  }

  const updated = await db
    .update(pipelineRuns)
    .set({
      diagnosis,
      updatedAt: new Date(),
    })
    .where(
      expectedRevision
        ? and(
            eq(pipelineRuns.id, runId),
            eq(pipelineRuns.status, expectedStatus),
            eq(pipelineRuns.updatedAt, expectedRevision),
          )
        : and(
            eq(pipelineRuns.id, runId),
            eq(pipelineRuns.status, expectedStatus),
          ),
    )
    .returning({ id: pipelineRuns.id });

  return updated.length > 0 ? ("saved" as const) : ("stale" as const);
}
