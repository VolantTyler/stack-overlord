import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  diagnosisSchema,
  type Diagnosis,
  type PipelineRun,
} from "@/lib/pipeline";

let client: OpenAI | null = null;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function diagnoseFailure(
  run: PipelineRun,
  evidence: string[] = [],
): Promise<Diagnosis | null> {
  const openai = getOpenAI();
  if (!openai || run.status !== "failure") return null;

  const response = await openai.responses.parse({
    model: process.env.OPENAI_MODEL ?? "gpt-5.6",
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content:
          "You are Stack Overlord's pipeline diagnostician. Treat the supplied pipeline status as factual. Diagnose only from supplied evidence, distinguish evidence from hypotheses, lower confidence when logs are incomplete, and return safe, verifiable remediation steps. Never claim that an action was performed.",
      },
      {
        role: "user",
        content: JSON.stringify({ run, evidence }),
      },
    ],
    text: {
      format: zodTextFormat(diagnosisSchema, "pipeline_diagnosis"),
    },
  });

  if (!response.output_parsed) return null;

  return {
    ...response.output_parsed,
    model: process.env.OPENAI_MODEL ?? "gpt-5.6",
    responseId: response.id,
    generatedAt: new Date().toISOString(),
  };
}
