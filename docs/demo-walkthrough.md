# Stack Overlord demo walkthrough

This walkthrough demonstrates the complete product story without changing the production Cognitive Bridge repository or Firebase project. All supplied payloads name only the isolated `VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo` repository.

## Choose a demo mode

### Zero-configuration UI tour (recommended for a short presentation)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. With no `DATABASE_URL`, the application intentionally shows the deterministic demo feed.

### End-to-end webhook tour

Set up a disposable Postgres database and use a local-only demo secret:

```bash
cp .env.example .env.local
# Add DATABASE_URL for the disposable demo database and this local value:
# GITHUB_WEBHOOK_SECRET=stack-overlord-local-demo
npm run db:push
npm run dev
```

Use a separate terminal for the replay commands. The helper signs the exact fixture bytes with HMAC-SHA256, assigns a unique delivery id, and refuses unknown remote hosts unless `--allow-remote` is explicit.


### End-to-end real sandbox deployment tour

Use this mode when the audience needs to see Stack Overlord backed by real GitHub Actions deployment conclusions instead of only static fixtures. The force scripts target the isolated `VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo` repository by default. Keep that default unless you are intentionally using another disposable sandbox.

1. Ensure `.github/workflows/sandbox-deployment-demo.yml` exists on the sandbox repository's `main` branch.
2. Trigger a real successful sandbox deployment demonstration:

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-success
```

3. Trigger a real controlled sandbox deployment failure demonstration:

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-failure
```

4. Wait for both GitHub Actions runs to complete. The success run should conclude `success`; the controlled failure run should conclude `failure` in the `Sandbox Deployment Demo` workflow, not in `Psychometric Agent Evaluation`.
5. Save sanitized webhook fixtures from the real run ids:

```bash
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <success-run-id> --result success
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <failure-run-id> --result failure
```

6. Replay those exact real-run fixtures into Stack Overlord:

```bash
export GITHUB_WEBHOOK_SECRET=stack-overlord-local-demo
npm run demo:webhook -- success --fixture demo/fixtures/real-runs/sandbox-deployment-success.json
npm run demo:webhook -- failure --fixture demo/fixtures/real-runs/sandbox-deployment-failure.json
```

Use `npm run demo:deployment:trigger -- --result success --dry-run` or `npm run demo:deployment:trigger -- --result failure --dry-run` when you want to show the dispatch API payload without starting a run.

## Presenter script (about five minutes)

### 1. Establish the pipeline truth model

On the dashboard, point out the status summary, responsive ledger, source badge, branch, commit, timestamps, and duration. Filter between **All**, **Failed**, **Running**, and **Passed**. Explain that the text labels and icons communicate state independently of color.

In zero-configuration mode, the fixture ledger already contains succeeded, failed, and running workflows. Select **Replay failure** to add and immediately open a fresh deterministic failure.

### 2. Inspect an AI-assisted recovery plan

Choose **Diagnose** on the first failed workflow. Show:

1. **Verified state** is explicitly attributed to the GitHub workflow conclusion.
2. GPT-5.6 provides a summary and likely cause, but does not change that state.
3. Supporting evidence is separated from limitations.
4. Each prioritized action includes a concrete verification step.
5. Model, response id, and generation time provide traceability.

The second fixture failure demonstrates a different, medium-confidence quota diagnosis.

### 3. Replay signed webhook states

For the end-to-end tour, send each factual state and refresh the dashboard after each command:

```bash
export GITHUB_WEBHOOK_SECRET=stack-overlord-local-demo
npm run demo:webhook -- push
npm run demo:webhook -- running
npm run demo:webhook -- success
npm run demo:webhook -- cancelled
npm run demo:webhook -- failure
```

The `push` event demonstrates correlation telemetry: it is accepted and persisted, but does not invent a workflow row. The remaining events demonstrate GitHub-derived running, successful, cancelled, and failed states. Failure telemetry is saved before optional GitHub evidence collection, GPT-5.6 diagnosis, or Slack notification.

Without `OPENAI_API_KEY`, the failed run remains visible with **Diagnosis pending**. Add a valid key and optionally `GITHUB_TOKEN` to demonstrate live structured diagnosis and job-step evidence. Add `SLACK_WEBHOOK_URL` for an incoming webhook configured for `#stack-overlord-alerts` to demonstrate the Block Kit failure alert. Every verified failure is reported without mentions. These integrations are optional and lazily initialized.

### 4. Demonstrate security and idempotency

An invalid signature is rejected before persistence (a non-zero script exit is expected):

```bash
npm run demo:webhook -- success --invalid-signature
```

Send a fixed delivery twice to demonstrate duplicate-delivery protection. Both requests are safely accepted; the database keeps one event because delivery ids are unique.

```bash
npm run demo:webhook -- success --delivery demo-idempotency-001
npm run demo:webhook -- success --delivery demo-idempotency-001
```

Preview any request, including its headers and payload, without sending it:

```bash
npm run demo:webhook -- failure --dry-run
```

## Scenario reference

| Scenario | Expected API result | Dashboard result | Optional side effects |
| --- | --- | --- | --- |
| `push` | `200`, accepted | No new workflow row | Correlation event persisted with Postgres |
| `running` | `200`, status `running` | Running preview row | None |
| `success` | `200`, status `success` | Successful release row | None |
| `cancelled` | `200`, status `cancelled` | Cancelled preview row | None |
| `failure` | `200`, status `failure` | Failed row and diagnosis panel | Evidence, GPT-5.6, and Slack when configured |
| Any scenario with `--invalid-signature` | `401` | No change | None |

## Remote sandbox use

The default endpoint is local. To target the deployed Stack Overlord demo, pass its endpoint and the matching webhook secret:

```bash
npm run demo:webhook -- failure \
  --url https://stack-overlord.vercel.app/api/webhooks/github
```

For any other host, `--allow-remote` is required as a deliberate safety acknowledgement. Never aim these fixtures at the original Cognitive Bridge repository or production Firebase project.

## Reset and verification

- Zero-configuration replays live only in browser state; refresh to reset them.
- End-to-end runs live in the disposable database. Reset that database according to the provider's instructions rather than touching production data.
- Before presenting, run the required project checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
