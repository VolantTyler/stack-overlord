import { describe, expect, it } from "vitest";

import { demoPipelineRuns } from "@/lib/demo-data";
import { diagnosisSchema } from "@/lib/pipeline";

describe("diagnosisSchema", () => {
  it("accepts an evidence-backed diagnosis", () => {
    const result = diagnosisSchema.safeParse({
      summary: "Authentication stopped the deployment.",
      likelyCause: "The service-account secret was unavailable.",
      evidence: ["The auth action received an empty credentials_json value."],
      confidence: "high",
      limitations: ["Secret history is not available."],
      recommendations: [
        {
          priority: 1,
          action: "Restore the sandbox secret.",
          rationale: "The authentication action received no credential payload.",
          verification: "Re-run the workflow and inspect the auth step.",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported confidence labels and empty evidence", () => {
    const result = diagnosisSchema.safeParse({
      summary: "Failure",
      likelyCause: "Unknown",
      evidence: [],
      confidence: "certain",
      limitations: [],
      recommendations: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("demo analysis provenance", () => {
  it("gives every row a clearly non-model fixture analysis", () => {
    expect(demoPipelineRuns).not.toHaveLength(0);

    for (const run of demoPipelineRuns) {
      expect(run.diagnosis).toMatchObject({
        model: "not-applicable",
        provenance: "demo-fixture",
        responseId: null,
        schemaVersion: 2,
        fixtureVersion: "demo-fixture-v2",
      });
      expect(run.diagnosis?.requestedModel).toBeUndefined();
      expect(run.diagnosis?.promptVersion).toBeUndefined();
      expect(run.diagnosis?.context?.status).toBe(run.status);
    }
  });
});
