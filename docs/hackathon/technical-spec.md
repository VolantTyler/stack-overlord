# Guided Build Tool: Spec

## Architecture

```text
Cognitive Bridge sandbox
  -> signed GitHub webhook
  -> Next.js route handler on Vercel
  -> Postgres event ledger and normalized workflow run
  -> GitHub Actions job/step evidence
  -> OpenAI structured analysis
  -> analysis-only Postgres update
  -> Slack Block Kit alert
  -> responsive dashboard
```

## Runtime interfaces

### `POST /api/webhooks/github`

Required headers:

- `x-hub-signature-256`
- `x-github-event`
- `x-github-delivery`

Behavior:

- Return `503` when webhook verification is not configured.
- Return `401` for an invalid signature.
- Return `400` for invalid JSON or missing/invalid required event and delivery headers.
- Acknowledge a signed GitHub `ping` without persistence.
- Return `422` for a signed event other than `workflow_run` or an invalid workflow-run payload.
- Persist each accepted signed `workflow_run` delivery idempotently.
- Normalize each accepted `workflow_run` payload into a pipeline run.
- Store a failed run before evidence enrichment, GPT-5.6, or Slack.
- Treat diagnosis and notification failures as non-destructive follow-on errors.

### `POST /api/pipeline-runs/[id]/analysis`

Behavior:

- Validate the id and load the canonical stored run server-side.
- Require same-origin browser requests.
- Return the canonical run with every successful analysis response so the client
  replaces stale status and metadata instead of merging analysis into an old row.
- Return a current, schema-v2 live analysis without another model call; regenerate
  legacy Postgres analyses.
- Return only seeded analysis for demo rows and never send demo data to OpenAI.
- Return cached live and seeded demo analyses before checking on-demand access.
- Return `503` when `ANALYSIS_ACCESS_TOKEN` is not configured for a request that
  would generate a new model response.
- Require `Authorization: Bearer <ANALYSIS_ACCESS_TOKEN>` for new generation,
  compare the supplied value in constant time, and return `401` with
  `requiresAccessToken: true` when it is missing or invalid.
- Have the browser user enter the shared access key; never expose the server value
  through server-rendered props or a `NEXT_PUBLIC_` variable.
- Generate at most one in-flight analysis per run within a server instance.
- Apply bounded per-client and per-server-instance limits only to new generations;
  the shared access key remains the primary authorization boundary.
- Fetch bounded, priority-ranked GitHub job and relevant step records anonymously,
  without sending the configured GitHub token; disclose when GitHub reports jobs
  beyond the first 100-record API page.
- Update only the diagnosis JSON when the stored status and update revision still match.
- Return `409` rather than attaching a stale analysis after any concurrent run update.
- Never send another Slack alert from an on-demand request.

### OpenAI analysis

Model: `OPENAI_MODEL`, defaulting to `gpt-5.6`, through the Responses API.

Structured output:

```text
summary
likelyCause
evidence[]: server-issued evidence ids
confidence: low | medium | high
limitations[]
recommendations[]: priority, action, rationale, verification
```

The prompt treats supplied status as factual, treats repository-controlled strings as
untrusted data, distinguishes evidence from hypotheses, lowers confidence when context
is incomplete, and never claims remediation occurred. The server rejects unknown
evidence ids and records requested/resolved model identifiers, response id, prompt and
schema versions, an input digest, and the exact bounded context. The structured fields
have explicit length limits, and the Responses request caps total output at 8,000
tokens while retaining high verbosity.

## Data model

### `pipeline_events`

Stores delivery ID, event name, action, repository, raw JSON payload, and receipt time. Delivery ID is unique.

### `pipeline_runs`

Stores workflow/run ID, repository, branch, commit, workflow, deterministic status, environment, source event, timestamps, duration, links, actor, diagnosis JSON, replay marker, and update time.

## Degraded modes

- No `DATABASE_URL`: render deterministic demo records and accept no durable webhook writes.
- No `OPENAI_API_KEY`: persist and display factual runs; show analysis as unavailable.
- No `ANALYSIS_ACCESS_TOKEN`: keep cached and seeded analyses viewable, but return
  `503` before any new on-demand model call.
- No `GITHUB_TOKEN`: automatic analysis uses unauthenticated evidence for public
  repositories or continues with webhook metadata for private repositories;
  on-demand evidence is always unauthenticated.
- No `SLACK_WEBHOOK_URL`: retain dashboard behavior without notification.
- GitHub evidence unavailable: the model receives verified run metadata plus an explicit context-availability limitation.

## Supported platforms

- Hosted: Vercel Node.js runtime with Postgres.
- Local: Node.js 20.9 or newer with npm.
- Browsers: current desktop and mobile Chrome, Safari, Firefox, and Edge.
