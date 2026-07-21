#!/usr/bin/env node

const SANDBOX_REPOSITORY = "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo";
const SANDBOX_WORKFLOW = "sandbox-deployment-demo.yml";
const SANDBOX_REF = "main";
const LOCKED_TARGET_OPTIONS = ["--repo", "--workflow", "--ref", "--webhook-url"];

function usage() {
  console.log(`Trigger a sandbox deployment demo workflow.

Usage:
  npm run demo:deployment:trigger -- --result <success|failure> [options]

Options:
  --dry-run                 Print the GitHub API request without sending it
  --help                    Show this help

This command is hard-locked to ${SANDBOX_REPOSITORY},
${SANDBOX_WORKFLOW}, and ${SANDBOX_REF}.

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

const lockedTargetOption = args.find((argument) =>
  LOCKED_TARGET_OPTIONS.some(
    (optionName) =>
      argument === optionName || argument.startsWith(`${optionName}=`),
  ),
);
if (lockedTargetOption) {
  console.error(
    `${lockedTargetOption.split("=")[0]} is not supported. This command is hard-locked to ${SANDBOX_REPOSITORY}, ${SANDBOX_WORKFLOW}, and ${SANDBOX_REF}.`,
  );
  process.exit(1);
}

const result = option(args, "--result");
if (!["success", "failure"].includes(result ?? "")) {
  console.error("Pass --result success or --result failure.");
  process.exit(1);
}

const body = {
  ref: SANDBOX_REF,
  inputs: {
    result,
  },
};
const endpoint = `https://api.github.com/repos/${SANDBOX_REPOSITORY}/actions/workflows/${encodeURIComponent(SANDBOX_WORKFLOW)}/dispatches`;

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
  console.log(`Triggered ${result} deployment demo in ${SANDBOX_REPOSITORY} on ${SANDBOX_REF}.`);
  process.exit(0);
}

console.error(`${response.status} ${response.statusText}`);
console.error(await response.text());
process.exit(1);
