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

Use this mode when the audience needs to see Stack Overlord backed by real GitHub Actions deployment conclusions instead of only static fixtures. The force scripts are hard-locked to the isolated `VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo` repository, its `sandbox-deployment-demo.yml` workflow, and `main`.

1. Ensure the guarded `sandbox-deployment-demo.yml` workflow exists on the sandbox repository's `main` branch.
2. Trigger a real successful sandbox deployment demonstration:

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-success
```

3. Trigger a real controlled sandbox deployment failure demonstration:

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-failure
```

4. Wait for both GitHub Actions runs to complete. The success run should conclude `success`; the controlled failure run should conclude `failure` in the `Sandbox Deployment Demo` workflow, not in `Psychometric Agent Evaluation`.
5. Save sanitized webhook fixtures from the real run ids. The helper verifies each run came from `Sandbox Deployment Demo` before writing a fixture:

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

In zero-configuration mode, the fixture ledger already contains succeeded, failed, and running workflows. Select **Replay sandbox failure** to add a fresh deterministic failure.

### 2. Inspect the analysis contract

Choose **Analyze** on the first failed workflow. Show:

1. **Seeded state** is explicitly attributed to the deterministic demo fixture.
2. The hand-authored fixture summary and cause hypothesis do not change that state or claim a live model call.
3. Supporting evidence is linked to fixture evidence ids and separated from limitations.
4. Each prioritized action includes a rationale and concrete verification step.
5. The trace says **Model call: None** and **API response: None**, while preserving fixture version and authorship time.
6. The context disclosure names both the seeded metadata used and the logs, YAML, diff, artifacts, and provider records that were not included.

The featured latest-failure analysis remains in place while any row expands inline. The
second fixture failure demonstrates a different, medium-confidence quota diagnosis.
Every deterministic demo row has the same clearly labeled fixture treatment. For a
real stored run, enter the configured analysis access key when prompted; the server
then reloads the canonical run, records the requested and API-reported models, and
never trusts browser-supplied status or evidence.

### 3. Replay signed webhook states

For the end-to-end tour, send each factual state and refresh the dashboard after each command:

```bash
export GITHUB_WEBHOOK_SECRET=stack-overlord-local-demo
npm run demo:webhook -- running
npm run demo:webhook -- success
npm run demo:webhook -- cancelled
npm run demo:webhook -- failure
```

These `workflow_run` deliveries demonstrate GitHub-derived running, successful, cancelled, and failed states. Failure telemetry is saved before optional GitHub evidence collection, OpenAI Responses analysis, or Slack notification.

Without `OPENAI_API_KEY`, every factual run remains visible and each deterministic
demo row expands a hand-authored fixture labeled with **Model call: None** and
**API response: None**. A real stored row without current analysis reports that live
analysis is unavailable. Add a valid key and optionally `GITHUB_TOKEN` to demonstrate
live automatic failure analysis and authenticated job-step evidence. On-demand row
analysis deliberately fetches public GitHub evidence without the configured token.
Add `SLACK_WEBHOOK_URL` for an incoming webhook configured for
`#stack-overlord-alerts` to demonstrate the Block Kit failure alert. Every verified
failure is reported without mentions. These integrations are optional and lazily
initialized.

### 4. Demonstrate security and idempotency

An invalid signature is rejected before persistence (a non-zero script exit is expected):

```bash
npm run demo:webhook -- success --invalid-signature
```

Send a fixed delivery twice to demonstrate duplicate-delivery protection. Both requests are safely accepted; the database keeps one event because delivery ids are unique.

```bash
npm run demo:webhook -- success --delivery 550e8400-e29b-41d4-a716-446655440000
npm run demo:webhook -- success --delivery 550e8400-e29b-41d4-a716-446655440000
```

Preview any request, including its headers and payload, without sending it:

```bash
npm run demo:webhook -- failure --dry-run
```

## Scenario reference

| Scenario | Expected API result | Dashboard result | Optional side effects |
| --- | --- | --- | --- |
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
