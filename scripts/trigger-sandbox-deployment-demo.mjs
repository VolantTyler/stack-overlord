#!/usr/bin/env node

const DEFAULT_REPOSITORY = "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo";
const DEFAULT_WORKFLOW = "sandbox-deployment-demo.yml";

function usage() {
  console.log(`Trigger a sandbox deployment demo workflow.

Usage:
  npm run demo:deployment:trigger -- --result <success|failure> [options]

Options:
  --repo <owner/name>       Sandbox repository (default: ${DEFAULT_REPOSITORY})
  --workflow <file.yml>     Workflow id or file name (default: ${DEFAULT_WORKFLOW})
  --ref <ref>               Git ref to run (default: main)
  --webhook-url <url>       Optional Stack Overlord webhook URL passed to the workflow
  --dry-run                 Print the GitHub API request without sending it
  --help                    Show this help

Authentication:
  Set GITHUB_TOKEN to a token with Actions workflow dispatch access to the sandbox repository.
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

const result = option(args, "--result");
if (!["success", "failure"].includes(result ?? "")) {
  console.error("Pass --result success or --result failure.");
  process.exit(1);
}

const repository = option(args, "--repo") ?? DEFAULT_REPOSITORY;
if (!/^[^/]+\/[^/]+$/.test(repository)) {
  console.error("--repo must be formatted as owner/name.");
  process.exit(1);
}

const workflow = option(args, "--workflow") ?? DEFAULT_WORKFLOW;
const ref = option(args, "--ref") ?? "main";
const webhookUrl = option(args, "--webhook-url");
const body = {
  ref,
  inputs: {
    result,
    ...(webhookUrl ? { stack_overlord_webhook_url: webhookUrl } : {}),
  },
};
const endpoint = `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

if (args.includes("--dry-run")) {
  console.log(JSON.stringify({ method: "POST", endpoint, body }, null, 2));
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("Set GITHUB_TOKEN before triggering a GitHub workflow.");
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "stack-overlord-demo-trigger",
    "x-github-api-version": "2022-11-28",
  },
  body: JSON.stringify(body),
});

if (response.status === 204) {
  console.log(`Triggered ${result} deployment demo in ${repository} on ${ref}.`);
  process.exit(0);
}

console.error(`${response.status} ${response.statusText}`);
console.error(await response.text());
process.exit(1);
