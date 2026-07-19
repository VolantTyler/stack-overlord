#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const DEFAULT_REPOSITORY = "VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo";
const DEFAULT_OUTPUT_DIR = "demo/fixtures/real-runs";
const EXPECTED_WORKFLOW_NAME = "Sandbox Deployment Demo";
const EXPECTED_WORKFLOW_PATH = ".github/workflows/sandbox-deployment-demo.yml";

function usage() {
  console.log(`Save a sanitized workflow_run webhook fixture from a real GitHub Actions run.

Usage:
  npm run demo:deployment:fixture -- --run-id <id> --result <success|failure> [options]

Options:
  --repo <owner/name>       Sandbox repository (default: ${DEFAULT_REPOSITORY})
  --output-dir <path>       Fixture directory (default: ${DEFAULT_OUTPUT_DIR})
  --output <path>           Exact output path; overrides --output-dir
  --workflow-name <name>    Expected workflow name (default: ${EXPECTED_WORKFLOW_NAME})
  --workflow-path <path>    Expected workflow path (default: ${EXPECTED_WORKFLOW_PATH})
  --help                    Show this help

Authentication:
  Set GITHUB_TOKEN if the sandbox repository is private or API rate limits are tight.
`);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function sanitizeRun(run, repository) {
  const [owner, name] = repository.split("/");
  const actorLogin = run.actor?.login ?? "sandbox-actor";
  return {
    action: "completed",
    repository: {
      id: 100000001,
      name,
      full_name: repository,
      owner: { login: owner },
      html_url: `https://github.com/${repository}`,
      private: false,
    },
    workflow_run: {
      id: run.id,
      name: run.name,
      display_title: run.display_title,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
      status: run.status,
      conclusion: run.conclusion,
      event: run.event,
      created_at: run.created_at,
      updated_at: run.updated_at,
      html_url: run.html_url,
      actor: { login: actorLogin },
    },
  };
}

function normalizeWorkflowPath(path) {
  return typeof path === "string" ? path.replace(/^\.\//, "") : "";
}

function validateDeploymentWorkflow(run, expectedName, expectedPath) {
  const actualName = typeof run.name === "string" ? run.name : "";
  const actualPath = normalizeWorkflowPath(run.path);
  const normalizedExpectedPath = normalizeWorkflowPath(expectedPath);

  return (
    actualName === expectedName &&
    actualPath === normalizedExpectedPath
  );
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

const runId = option(args, "--run-id");
if (!runId || !/^\d+$/.test(runId)) {
  console.error("Pass a numeric --run-id from the real sandbox workflow run.");
  process.exit(1);
}

const result = option(args, "--result");
if (!["success", "failure"].includes(result ?? "")) {
  console.error("Pass --result success or --result failure.");
  process.exit(1);
}

const expectedWorkflowName = option(args, "--workflow-name") ?? EXPECTED_WORKFLOW_NAME;
const expectedWorkflowPath = option(args, "--workflow-path") ?? EXPECTED_WORKFLOW_PATH;
const repository = option(args, "--repo") ?? DEFAULT_REPOSITORY;
const endpoint = `https://api.github.com/repos/${repository}/actions/runs/${runId}`;
const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "stack-overlord-fixture-sanitizer",
  "x-github-api-version": "2022-11-28",
};
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const response = await fetch(endpoint, { headers });
if (!response.ok) {
  console.error(`${response.status} ${response.statusText}`);
  console.error(await response.text());
  process.exit(1);
}

const run = await response.json();
if (!validateDeploymentWorkflow(run, expectedWorkflowName, expectedWorkflowPath)) {
  console.error(
    `Run ${runId} is workflow ${run.name ?? "(unknown)"} at ${run.path ?? "(unknown)"}; expected ${expectedWorkflowName} at ${expectedWorkflowPath}.`,
  );
  process.exit(1);
}

if (run.status !== "completed" || run.conclusion !== result) {
  console.error(`Run ${runId} is ${run.status}/${run.conclusion}; expected completed/${result}.`);
  process.exit(1);
}

const fixture = sanitizeRun(run, repository);
const output = option(args, "--output") ?? join(option(args, "--output-dir") ?? DEFAULT_OUTPUT_DIR, `sandbox-deployment-${result}.json`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Saved ${basename(output)} from run ${runId}.`);
