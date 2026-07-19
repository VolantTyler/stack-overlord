# Stack Overlord

Stack Overlord is a responsive command center for the final, easy-to-miss stages of a CI/CD pipeline. It receives signed GitHub webhooks, records the factual workflow state in Postgres, and uses GPT-5.6 to explain failed runs with evidence, confidence, and verifiable recovery steps.

Built for the **OpenAI Build Week 2026 Developer Tools** track.

Live demo: [stack-overlord.vercel.app](https://stack-overlord.vercel.app)

## Product principles

- GitHub determines whether a workflow succeeded, failed, or is still running.
- GPT-5.6 explains failures; it never invents pipeline state.
- Every recommendation includes a verification step.
- Telemetry is stored before optional diagnosis or notification work begins.
- Missing credentials never block the deterministic demo experience.

## Stack

- Next.js 16, React 19, and TypeScript
- Tailwind CSS and shadcn/ui
- Postgres with Drizzle ORM
- OpenAI Responses API using `gpt-5.6`
- Signed GitHub webhooks
- Slack-native failure notifications
- Vercel deployment

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without environment variables, the dashboard loads deterministic Cognitive Bridge sandbox fixtures and exposes a **Replay failure** control.

For a presenter-ready tour of every dashboard state, signed webhook replays,
security checks, idempotency, optional integrations, and reset instructions, see
the [demo walkthrough](docs/demo-walkthrough.md).


## Sandbox deployment demonstrations

Use the isolated Cognitive Bridge sandbox repository for live deployment demos; never run controlled failures against the production repository or Firebase project. The sandbox workflow and helpers produce one factual deployment success and one controlled deployment failure, then save sanitized `workflow_run` webhook fixtures from those real GitHub Actions runs.

Trigger the success path:

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-success
```

Trigger the controlled failure path:

```bash
GITHUB_TOKEN=... npm run demo:deployment:force-failure
```

After each run completes in GitHub Actions, save sanitized fixtures for replay:

```bash
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <success-run-id> --result success
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <failure-run-id> --result failure
```

See the [sandbox deployment result runbook](docs/demo/deployment-results.md) and the [demo walkthrough](docs/demo-walkthrough.md) for the full human/AI operator flow, including replaying the saved fixtures into Stack Overlord.

## Environment variables

| Variable | Purpose | Required for demo UI |
| --- | --- | --- |
| `DATABASE_URL` | Postgres event and pipeline ledger | No |
| `OPENAI_API_KEY` | GPT-5.6 failure diagnosis | No |
| `OPENAI_MODEL` | Runtime model; defaults to `gpt-5.6` | No |
| `GITHUB_WEBHOOK_SECRET` | HMAC verification for GitHub deliveries | No |
| `GITHUB_TOKEN` | Optional private-repository job and failed-step evidence | No |
| `SLACK_WEBHOOK_URL` | Slack failure alerts | No |

Never commit `.env.local` or real credentials.

Slack notifications use Block Kit and report every verified workflow failure without
mentions. Configure the incoming webhook for `#stack-overlord-alerts`; Slack controls
the destination channel from the webhook itself.

## Database

Generate and apply the Drizzle schema after setting `DATABASE_URL`:

```bash
npm run db:generate
npm run db:push
```

The system stores every accepted GitHub delivery idempotently. `workflow_run` events are normalized into the pipeline ledger; other subscribed events are retained for correlation.

## GitHub webhook

Configure a repository webhook pointing to:

```text
https://YOUR-VERCEL-DOMAIN/api/webhooks/github
```

Use JSON content, set the same random secret in GitHub and `GITHUB_WEBHOOK_SECRET`, and subscribe to:

- Pushes
- Pull requests
- Workflow runs

Invalid signatures receive `401`. Missing webhook configuration receives `503`. Duplicate GitHub delivery IDs are ignored by the database constraint.

## How Codex accelerated the build

Codex translated the PRD into the application architecture, responsive dashboard, webhook contract, Postgres schema, deterministic fixtures, structured GPT-5.6 output, and automated tests. It also runs the build-test-review loop and browser-verifies the desktop and mobile experience. The Build Week submission will include the `/feedback` session ID for the task where the majority of this core functionality was created.

## How GPT-5.6 advances the finished product

Only failed workflow runs are sent to GPT-5.6. The model receives the already-determined run state and available evidence, then returns a strict structure containing:

- Summary and likely cause
- Supporting evidence
- Low, medium, or high confidence
- Explicit limitations
- Prioritized recovery actions
- A verification step for every action

The dashboard records the model and response ID for traceability. If OpenAI is unavailable, the verified failure remains stored and visible with diagnosis marked pending.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For Codex cloud browser provisioning and one-command desktop/mobile screenshots,
see [Remote preview screenshots](docs/remote-preview.md).

## Build Week project files

The Devpost Guided Build Tool is reflected in a small set of canonical project documents:

- [Scope](docs/hackathon/scope.md)
- [Product requirements](docs/hackathon/prd.md)
- [Technical specification](docs/hackathon/technical-spec.md)
- [Build and submission checklist](docs/hackathon/build-checklist.md)
- [Devpost copy and demo outline](docs/hackathon/submission-draft.md)

The checklist is the source of truth for remaining submission work. The Devpost project should stay in draft until its stale description is replaced and the live URL, public video, repository details, and Codex `/feedback` session ID are ready.

## Safe demo target

The planned monitored repository is an isolated duplicate of `VolantTyler/Cognitive-Bridge-Antigravity`, backed by a sandbox Firebase project. It preserves realistic TypeScript, Python, Functions, Hosting, and GitHub Actions complexity without touching the original production repository or credentials.
