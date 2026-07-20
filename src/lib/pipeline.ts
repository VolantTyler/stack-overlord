import { z } from "zod";

export const pipelineStatuses = [
  "success",
  "failure",
  "running",
  "cancelled",
] as const;

export type PipelineStatus = (typeof pipelineStatuses)[number];

export const analysisEvidenceSources = [
  "github_workflow_run",
  "github_actions_jobs",
  "demo_fixture",
] as const;

export type AnalysisEvidence = {
  id: string;
  source: (typeof analysisEvidenceSources)[number];
  fact: string;
};

export type WorkflowEvidence = {
  items: AnalysisEvidence[];
  status: "available" | "unavailable";
  note: string | null;
};

export type AnalysisContext = {
  status: PipelineStatus;
  evidence: AnalysisEvidence[];
  githubEvidenceStatus: WorkflowEvidence["status"];
  githubEvidenceNote: string | null;
  notProvided: string[];
};

export const diagnosisSchema = z
  .object({
    summary: z.string().min(20).max(1_200),
    likelyCause: z.string().min(20).max(1_200),
    evidence: z
      .array(
        z
          .string()
          .min(1)
          .max(160)
          .describe("An evidence ID copied exactly from the supplied context."),
      )
      .min(1)
      .max(8),
    confidence: z.enum(["low", "medium", "high"]),
    limitations: z.array(z.string().min(1).max(800)).min(1).max(6),
    recommendations: z
      .array(
        z
          .object({
            priority: z.number().int().min(1).max(5),
            action: z.string().min(1).max(1_000),
            rationale: z.string().min(1).max(1_200),
            verification: z.string().min(1).max(1_000),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();

export type DiagnosisContent = z.infer<typeof diagnosisSchema>;

export type Diagnosis = DiagnosisContent & {
  model: string;
  requestedModel?: string;
  responseId: string | null;
  generatedAt: string;
  provenance?: "openai-api" | "demo-fixture";
  schemaVersion?: number;
  promptVersion?: string;
  fixtureVersion?: string;
  inputDigest?: string;
  context?: AnalysisContext;
};

export type PipelineRun = {
  id: string;
  repository: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  workflowName: string;
  status: PipelineStatus;
  environment: string;
  sourceEvent: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  runUrl: string;
  deploymentUrl: string | null;
  actor: string;
  diagnosis: Diagnosis | null;
  isReplay: boolean;
};

export type DashboardSource = "postgres" | "demo" | "fallback";
