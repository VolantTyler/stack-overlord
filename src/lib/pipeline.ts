import { z } from "zod";

export const pipelineStatuses = [
  "success",
  "failure",
  "running",
  "cancelled",
] as const;

export type PipelineStatus = (typeof pipelineStatuses)[number];

export const diagnosisSchema = z
  .object({
    summary: z.string().min(1),
    likelyCause: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1).max(6),
    confidence: z.enum(["low", "medium", "high"]),
    limitations: z.array(z.string()).max(4),
    recommendations: z
      .array(
        z
          .object({
            priority: z.number().int().min(1).max(5),
            action: z.string().min(1),
            verification: z.string().min(1),
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
  responseId: string | null;
  generatedAt: string;
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
