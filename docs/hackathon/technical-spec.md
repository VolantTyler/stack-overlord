# Guided Build Tool: Spec

## Architecture

```text
Cognitive Bridge sandbox
  -> signed GitHub webhook
  -> Next.js route handler on Vercel
  -> Postgres event ledger and normalized workflow run
  -> GitHub Actions job/step evidence
  -> GPT-5.6 structured diagnosis
  -> Postgres diagnosis update
  -> Discord alert
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
- Return `400` for invalid JSON.
- Persist every supported signed delivery idempotently.
- Normalize `workflow_run` payloads into a pipeline run.
- Store a failed run before evidence enrichment, GPT-5.6, or Discord.
- Treat diagnosis and notification failures as non-destructive follow-on errors.

### GPT-5.6 diagnosis

Model: `gpt-5.6` through the Responses API.

Structured output:

```text
summary
likelyCause
evidence[]
confidence: low | medium | high
limitations[]
recommendations[]: priority, action, verification
```

The prompt instructs the model to treat supplied status as factual, distinguish evidence from hypotheses, lower confidence when evidence is incomplete, and never claim remediation occurred.

## Data model

### `pipeline_events`

Stores delivery ID, event name, action, repository, raw JSON payload, and receipt time. Delivery ID is unique.

### `pipeline_runs`

Stores workflow/run ID, repository, branch, commit, workflow, deterministic status, environment, source event, timestamps, duration, links, actor, diagnosis JSON, replay marker, and update time.

## Degraded modes

- No `DATABASE_URL`: render deterministic demo records and accept no durable webhook writes.
- No `OPENAI_API_KEY`: persist and display failure with diagnosis pending.
- No `GITHUB_TOKEN`: use unauthenticated evidence for public repositories or continue with webhook metadata for private repositories.
- No `DISCORD_WEBHOOK_URL`: retain dashboard behavior without notification.
- GitHub evidence unavailable: GPT-5.6 receives the verified run metadata and must lower confidence appropriately.

## Supported platforms

- Hosted: Vercel Node.js runtime with Postgres.
- Local: Node.js 20.9 or newer with npm.
- Browsers: current desktop and mobile Chrome, Safari, Firefox, and Edge.
