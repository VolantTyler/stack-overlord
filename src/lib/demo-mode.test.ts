import { describe, expect, it } from "vitest";

import { demoPipelineRuns } from "@/lib/demo-data";
import {
  createDemoFailureReplay,
  getDemoPipelineRuns,
  readDashboardMode,
} from "@/lib/demo-mode";

const replayTimestamp = 1_784_567_890_123;
const sandboxRepository =
  "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo";

describe("readDashboardMode", () => {
  it.each([
    ["absent", {}],
    [
      "invalid",
      { mode: "live", replay: String(replayTimestamp) },
    ],
    [
      "invalid first repeated value",
      { mode: ["live", "demo"], replay: String(replayTimestamp) },
    ],
  ])("uses auto mode without a replay when mode is %s", (_label, params) => {
    expect(readDashboardMode(params)).toEqual({
      mode: "auto",
      replayTimestamp: null,
    });
  });

  it("parses a 13-digit replay timestamp in demo mode", () => {
    expect(
      readDashboardMode({
        mode: "demo",
        replay: String(replayTimestamp),
      }),
    ).toEqual({
      mode: "demo",
      replayTimestamp,
    });
  });

  it.each([
    ["empty", ""],
    ["non-numeric", "not-a-timestamp"],
    ["too short", "178456789012"],
    ["too long", "17845678901234"],
    ["empty repeated values", []],
    ["invalid first repeated value", ["bad", String(replayTimestamp)]],
  ])("safely ignores a %s replay value", (_label, replay) => {
    expect(readDashboardMode({ mode: "demo", replay })).toEqual({
      mode: "demo",
      replayTimestamp: null,
    });
  });

  it("uses the first value from repeated demo query parameters", () => {
    expect(
      readDashboardMode({
        mode: ["demo", "auto"],
        replay: [String(replayTimestamp), "bad"],
      }),
    ).toEqual({
      mode: "demo",
      replayTimestamp,
    });
  });
});

describe("demo failure replay", () => {
  it("reconstructs the same identity, SHA, and times for one timestamp", () => {
    const firstReplay = createDemoFailureReplay(replayTimestamp);
    const secondReplay = createDemoFailureReplay(replayTimestamp);

    expect(firstReplay).not.toBeNull();
    expect(secondReplay).toEqual(firstReplay);
    expect(firstReplay).toMatchObject({
      id: `demo-replay-${replayTimestamp}`,
      startedAt: new Date(replayTimestamp - 94_000).toISOString(),
      completedAt: new Date(replayTimestamp).toISOString(),
      durationSeconds: 94,
      isReplay: true,
    });
    expect(firstReplay?.commitSha).toMatch(/^[a-f0-9]{40}$/);
  });

  it("prepends a trusted sandbox fixture without mutating base demo data", () => {
    const baseSnapshot = structuredClone(demoPipelineRuns);
    const runs = getDemoPipelineRuns(replayTimestamp);
    const replay = runs[0];

    expect(runs).not.toBe(demoPipelineRuns);
    expect(runs).toHaveLength(demoPipelineRuns.length + 1);
    expect(runs.slice(1)).toEqual(baseSnapshot);
    expect(replay).toMatchObject({
      id: `demo-replay-${replayTimestamp}`,
      repository: sandboxRepository,
      runUrl: `https://github.com/${sandboxRepository}/actions`,
      diagnosis: {
        model: "not-applicable",
        provenance: "demo-fixture",
        responseId: null,
        fixtureVersion: "demo-fixture-v2",
      },
    });
    expect(demoPipelineRuns).toEqual(baseSnapshot);
  });
});
