import { afterEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import { diagnoseFailure } from "@/lib/diagnosis";
import type { PipelineRun } from "@/lib/pipeline";
import { notifySlack } from "@/lib/slack";

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

  it("skips Slack without a webhook URL", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(notifySlack(run)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not notify Slack for non-failure states", async () => {
    vi.stubEnv(
      "SLACK_WEBHOOK_URL",
      "https://hooks.slack.test/services/local-test",
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      notifySlack({ ...run, status: "success" }),
    ).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts every failure as a Slack-native Block Kit message", async () => {
    vi.stubEnv(
      "SLACK_WEBHOOK_URL",
      "https://hooks.slack.test/services/local-test",
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));

    await expect(notifySlack(run)).resolves.toBe(true);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, request] = fetchSpy.mock.calls[0];
    const payload = JSON.parse(String(request?.body)) as {
      channel?: string;
      text: string;
      blocks: Array<{ type: string }>;
    };

    expect(url).toBe("https://hooks.slack.test/services/local-test");
    expect(request).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(payload.channel).toBeUndefined();
    expect(payload.text).toContain("Deploy sandbox failed");
    expect(payload.blocks.map((block) => block.type)).toEqual([
      "header",
      "section",
      "section",
      "section",
      "context",
      "actions",
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/<!channel>|<!here>|<@[A-Z0-9]+>/);
  });
});
