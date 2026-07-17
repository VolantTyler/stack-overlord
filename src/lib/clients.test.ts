import { afterEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import { diagnoseFailure } from "@/lib/diagnosis";
import { notifyDiscord } from "@/lib/discord";
import type { PipelineRun } from "@/lib/pipeline";

const run: PipelineRun = {
  id: "12345",
  repository: "VolantTyler/cognitive-bridge-demo",
  branch: "main",
  commitSha: "abcdef0123456789",
  commitMessage: "test: exercise optional integrations",
  workflowName: "Deploy sandbox",
  status: "failure",
  environment: "firebase-sandbox",
  sourceEvent: "push",
  startedAt: "2026-07-16T16:00:00.000Z",
  completedAt: "2026-07-16T16:02:05.000Z",
  durationSeconds: 125,
  runUrl:
    "https://github.com/VolantTyler/cognitive-bridge-demo/actions/runs/12345",
  deploymentUrl: null,
  actor: "VolantTyler",
  diagnosis: null,
  isReplay: false,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("optional clients", () => {
  it("does not initialize a database without DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(getDb()).toBeNull();
  });

  it("skips diagnosis without OPENAI_API_KEY", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await expect(
      diagnoseFailure(run, ["A deploy step failed."]),
    ).resolves.toBeNull();
  });

  it("skips Discord without a webhook URL", async () => {
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(notifyDiscord(run)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
