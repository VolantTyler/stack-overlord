import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./trigger-sandbox-deployment-demo.mjs", import.meta.url),
);

function dryRun(...args: string[]) {
  return spawnSync(process.execPath, [scriptPath, "--result", "success", "--dry-run", ...args], {
    encoding: "utf8",
  });
}

describe("sandbox deployment trigger", () => {
  it("uses the immutable sandbox workflow target", () => {
    const result = dryRun();
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain(
      "https://api.github.com/repos/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo/actions/workflows/sandbox-deployment-demo.yml/dispatches",
    );
    expect(output).toContain('"ref": "main"');
  });

  it.each([
    ["--repo", "VolantTyler/stack-overlord"],
    ["--repo=VolantTyler/stack-overlord"],
    ["--workflow", "another-workflow.yml"],
    ["--workflow=another-workflow.yml"],
    ["--ref", "feature/unsafe-demo"],
    ["--ref=feature/unsafe-demo"],
    ["--webhook-url", "https://example.com/webhook"],
    ["--webhook-url=https://example.com/webhook"],
  ])("rejects target override %s", (...override) => {
    const result = dryRun(...override);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("hard-locked");
    expect(output).not.toContain("https://api.github.com");
  });
});
