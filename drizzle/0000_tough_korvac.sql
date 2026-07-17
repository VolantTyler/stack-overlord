CREATE TABLE "pipeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"event_name" text NOT NULL,
	"action" text,
	"repository" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_events_delivery_id_unique" UNIQUE("delivery_id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"repository" text NOT NULL,
	"branch" text NOT NULL,
	"commit_sha" text NOT NULL,
	"commit_message" text NOT NULL,
	"workflow_name" text NOT NULL,
	"status" text NOT NULL,
	"environment" text NOT NULL,
	"source_event" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_seconds" integer,
	"run_url" text NOT NULL,
	"deployment_url" text,
	"actor" text NOT NULL,
	"diagnosis" jsonb,
	"is_replay" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
