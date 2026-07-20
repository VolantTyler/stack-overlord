# Stack Overlord

Stack Overlord is a responsive command center for the final, easy-to-miss stages of a CI/CD pipeline. It receives signed GitHub webhooks, records the factual workflow state in Postgres, and uses the OpenAI Responses API to explain pipeline runs with bounded evidence, confidence, and verifiable next steps.

Built for the **OpenAI Build Week 2026 Developer Tools** track.

Live demo: [stack-overlord.vercel.app](https://stack-overlord.vercel.app)

## Product principles

- GitHub determines whether a workflow succeeded, failed, or is still running.
- Failures are analyzed automatically, and any stored run can be analyzed on demand.
- AI interpretation never determines or overwrites GitHub-owned pipeline state.
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

After each run completes in GitHub Actions, save sanitized fixtures for replay. The fixture helper rejects run ids that do not belong to the `Sandbox Deployment Demo` workflow:

```bash
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <success-run-id> --result success
GITHUB_TOKEN=... npm run demo:deployment:fixture -- --run-id <failure-run-id> --result failure
```

See the [sandbox deployment result runbook](docs/demo/deployment-results.md) and the [demo walkthrough](docs/demo-walkthrough.md) for the full human/AI operator flow, including replaying the saved fixtures into Stack Overlord.

## Environment variables

| Variable | Purpose | Required for demo UI |
| --- | --- | --- |
| `DATABASE_URL` | Postgres event and pipeline ledger | No |
| `OPENAI_API_KEY` | Automatic failure analysis and on-demand row analysis | No |
| `OPENAI_MODEL` | Runtime model; defaults to `gpt-5.6` | No |
| `ANALYSIS_ACCESS_TOKEN` | Shared access key for new paid on-demand analysis generation | No |
| `GITHUB_WEBHOOK_SECRET` | HMAC verification for GitHub deliveries | No |
| `GITHUB_TOKEN` | Optional authenticated evidence for automatic failure analysis; never used on demand | No |
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

## How OpenAI analysis advances the finished product

Verified failures are sent automatically for analysis after telemetry is stored. The
**Analyze** control on every ledger row can request the same server-side analysis on
demand for successful, running, cancelled, or still-pending failure rows. The server
reloads the canonical run by id, returns that current record with the analysis, and
replaces the browser's possibly stale row; the browser never supplies status or
evidence.

The runtime requests `OPENAI_MODEL`, defaulting to the `gpt-5.6` alias through the
Responses API. OpenAI currently documents that alias as routing to GPT-5.6 Sol. This
is an API integration, not a ChatGPT conversation. Each live result records the
requested model, the model reported by the API, and the response id. Deterministic
demo analyses are hand-authored, labeled as seeded fixtures, and explicitly report
that no model call or API response occurred.

The model receives the already-determined run state, bounded run metadata, and
available GitHub Actions job and relevant step records. Every displayed evidence item
must reference an evidence id supplied by the server. Raw logs, workflow YAML, source
code, diffs, artifacts, provider events, and prior-run comparisons are not currently
included; the interface discloses those limits instead of treating missing context as
negative evidence. The context disclosure enumerates every supplied fact, not just the
subset cited by the model. GitHub retrieval uses the first page of up to 100 jobs and
then keeps the 12 highest-priority job/step facts; if GitHub reports additional pages,
that omission is recorded in both the model context and the interface.

The strict response contains:

- A substantive summary and status-aware interpretation
- Server-validated evidence references
- Low, medium, or high confidence
- Explicit limitations
- Prioritized next actions with rationale
- A verification step for every action

On-demand results update only the analysis JSON and only while the stored status still
matches the analyzed status and update revision. To generate a new paid response, the
browser user enters the same shared access key configured on the server as
`ANALYSIS_ACCESS_TOKEN`; the browser sends it as a bearer token. The server secret is
never placed in server-rendered props and must never use a `NEXT_PUBLIC_` variable.
Cached live analyses and seeded demo analyses remain viewable without the key, and
automatic webhook-triggered failure analysis is unaffected.

Same-origin checks and bounded per-client and per-server-instance limits remain
defense-in-depth for new generation requests; the shared access key is the primary
authorization boundary. On-demand evidence requests are anonymous and never send the
configured GitHub token. Deterministic demo rows return only seeded analyses and are
never sent to OpenAI. If OpenAI or on-demand access is not configured, the GitHub-owned
run remains stored and visible with analysis marked unavailable.

See the [GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)
for the current alias and Responses API guidance.

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
