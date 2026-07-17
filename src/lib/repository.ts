import { desc } from "drizzle-orm";

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
}> {
  const db = getDb();
  if (!db) {
    return { runs: demoPipelineRuns, source: "demo" };
  }

  try {
    const rows = await db
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(50);

    return {
      runs: rows.length ? rows.map(serializeRun) : demoPipelineRuns,
      source: rows.length ? "postgres" : "demo",
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
  if (!db) return false;

  await db.insert(pipelineEvents).values(input).onConflictDoNothing({
    target: pipelineEvents.deliveryId,
  });
  return true;
}

export async function savePipelineRun(run: PipelineRun) {
  const db = getDb();
  if (!db) return false;

  const values: typeof pipelineRuns.$inferInsert = {
    ...run,
    startedAt: new Date(run.startedAt),
    completedAt: run.completedAt ? new Date(run.completedAt) : null,
    updatedAt: new Date(),
  };

  await db
    .insert(pipelineRuns)
    .values(values)
    .onConflictDoUpdate({
      target: pipelineRuns.id,
      set: values,
    });
  return true;
}
