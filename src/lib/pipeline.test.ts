import { describe, expect, it } from "vitest";

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
