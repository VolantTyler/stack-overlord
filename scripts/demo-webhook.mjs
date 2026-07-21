#!/usr/bin/env node

import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SCENARIOS = {
  running: { event: "workflow_run", fixture: "workflow-running.json" },
  success: { event: "workflow_run", fixture: "workflow-success.json" },
  cancelled: { event: "workflow_run", fixture: "workflow-cancelled.json" },
  failure: { event: "workflow_run", fixture: "workflow-failure.json" },
};

function usage() {
  console.log(`Stack Overlord webhook demo

Usage:
  npm run demo:webhook -- <scenario> [options]

Scenarios: ${Object.keys(SCENARIOS).join(", ")}

Options:
  --url <url>          Webhook endpoint (default: http://localhost:3000/api/webhooks/github)
  --secret <secret>    Signing secret (default: GITHUB_WEBHOOK_SECRET)
  --delivery <GUID>    Fixed GitHub delivery GUID, useful for idempotency demos
  --invalid-signature  Deliberately sign with the wrong secret
  --dry-run            Print the request without sending it
  --fixture <path>      Send a specific sanitized fixture instead of the scenario fixture
  --allow-remote       Permit a host other than localhost or stack-overlord.vercel.app
  --list               List scenarios
  --help               Show this help
`);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}
if (args.includes("--list")) {
  console.log(Object.keys(SCENARIOS).join("\n"));
  process.exit(0);
}

const scenarioName = args.find((arg) => !arg.startsWith("--") && !args[args.indexOf(arg) - 1]?.startsWith("--"));
const scenario = SCENARIOS[scenarioName];
if (!scenario) {
  console.error(`Unknown scenario: ${scenarioName ?? "(missing)"}`);
  usage();
  process.exit(1);
}

const url = new URL(option(args, "--url") ?? "http://localhost:3000/api/webhooks/github");
const allowedHosts = new Set(["localhost", "127.0.0.1", "stack-overlord.vercel.app"]);
if (!allowedHosts.has(url.hostname) && !args.includes("--allow-remote")) {
  console.error(`Refusing to send demo data to ${url.hostname}. Pass --allow-remote if this is an intentional sandbox target.`);
  process.exit(1);
}

const secret = option(args, "--secret") ?? process.env.GITHUB_WEBHOOK_SECRET;
if (!secret) {
  console.error("Set GITHUB_WEBHOOK_SECRET or pass --secret.");
  process.exit(1);
}

const fixturePath = option(args, "--fixture");
const rawBody = fixturePath
  ? await readFile(fixturePath, "utf8")
  : await readFile(
      fileURLToPath(new URL(`../demo/fixtures/${scenario.fixture}`, import.meta.url)),
      "utf8",
    );
const signingSecret = args.includes("--invalid-signature") ? `${secret}-wrong` : secret;
const signature = `sha256=${createHmac("sha256", signingSecret).update(rawBody).digest("hex")}`;
const delivery = option(args, "--delivery") ?? randomUUID();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(delivery)) {
  console.error("--delivery must be a GitHub delivery GUID.");
  process.exit(1);
}
const headers = {
  "content-type": "application/json",
  "x-github-event": scenario.event,
  "x-github-delivery": delivery,
  "x-hub-signature-256": signature,
};

if (args.includes("--dry-run")) {
  console.log(JSON.stringify({ scenario: scenarioName, url: url.href, headers, body: JSON.parse(rawBody) }, null, 2));
  process.exit(0);
}

const response = await fetch(url, { method: "POST", headers, body: rawBody });
const responseBody = await response.text();
console.log(`${response.status} ${response.statusText}`);
console.log(responseBody);
if (!response.ok) process.exitCode = 1;
