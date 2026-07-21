# Sandbox deployment result runbook

Use this runbook to create the two deployment demonstrations Stack Overlord needs:

- one real sandbox deployment success
- one controlled sandbox deployment failure

The failure demo must run only in the isolated Cognitive Bridge sandbox repository. Do not target the production repository or Firebase project.

## 1. Confirm the sandbox workflow

Confirm the guarded `sandbox-deployment-demo.yml` workflow is present in `VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo` on `main`. It is manually dispatched with a `result` input for `success` or `failure`. Do not copy or dispatch a demo workflow from the Stack Overlord application repository.

## 2. Trigger the success run

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-success
```

Wait for the GitHub Actions run named `Sandbox Deployment Demo` to complete with a `success` conclusion.

## 3. Trigger the controlled failure run

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-failure
```

The workflow intentionally fails in the `Produce controlled sandbox deployment failure` step. This gives Stack Overlord a deployment demonstration failure rather than another `Psychometric Agent Evaluation` result.

Preview the immutable sandbox dispatch without starting a run:

```bash
npm run demo:deployment:trigger -- --result success --dry-run
```

## 4. Save sanitized webhook fixtures from the real runs

Use each completed run id from GitHub Actions:

```bash
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <success-run-id> --result success
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <failure-run-id> --result failure
```

The sanitizer writes:

- `demo/fixtures/real-runs/sandbox-deployment-success.json`
- `demo/fixtures/real-runs/sandbox-deployment-failure.json`

The saved fixtures include the factual `workflow_run.conclusion` from GitHub, remove unnecessary account and repository payload fields, and are written only after the helper verifies the run came from the `Sandbox Deployment Demo` workflow path.

## 5. Replay the fixtures into Stack Overlord

After the fixtures are saved, replay them through the existing webhook demo sender:

```bash
npm run demo:webhook -- success --url http://localhost:3000/api/webhooks/github --secret <webhook-secret>
npm run demo:webhook -- failure --url http://localhost:3000/api/webhooks/github --secret <webhook-secret>
```

Replay the real-run fixtures directly with `--fixture`:

```bash
npm run demo:webhook -- success --fixture demo/fixtures/real-runs/sandbox-deployment-success.json --url http://localhost:3000/api/webhooks/github --secret <webhook-secret>
npm run demo:webhook -- failure --fixture demo/fixtures/real-runs/sandbox-deployment-failure.json --url http://localhost:3000/api/webhooks/github --secret <webhook-secret>
```
