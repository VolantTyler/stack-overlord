import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type { Diagnosis } from "@/lib/pipeline";

export const pipelineEvents = pgTable("pipeline_events", {
  id: serial("id").primaryKey(),
  deliveryId: text("delivery_id").notNull().unique(),
  eventName: text("event_name").notNull(),
  action: text("action"),
  repository: text("repository").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pipelineRuns = pgTable("pipeline_runs", {
  id: text("id").primaryKey(),
  repository: text("repository").notNull(),
  branch: text("branch").notNull(),
  commitSha: text("commit_sha").notNull(),
  commitMessage: text("commit_message").notNull(),
  workflowName: text("workflow_name").notNull(),
  status: text("status").notNull(),
  environment: text("environment").notNull(),
  sourceEvent: text("source_event").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  runUrl: text("run_url").notNull(),
  deploymentUrl: text("deployment_url"),
  actor: text("actor").notNull(),
  diagnosis: jsonb("diagnosis").$type<Diagnosis | null>(),
  isReplay: boolean("is_replay").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
