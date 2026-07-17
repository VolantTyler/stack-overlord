# Guided Build Tool: Scope

## Outcome

Deliver a working Developer Tools submission that gives a single developer a trustworthy view from GitHub workflow execution to deployment outcome, then explains failures with evidence-backed GPT-5.6 analysis.

## Primary audience

Developers using AI agents and automated delivery pipelines who are vulnerable to assuming that a successful merge means production is healthy.

## MVP

- Receive signed `push`, `pull_request`, and `workflow_run` GitHub webhooks.
- Store all accepted deliveries in Postgres and normalize workflow runs into a pipeline ledger.
- Display success, failure, running, and cancelled states in a responsive dashboard.
- Make failed processes clickable on desktop and mobile.
- Enrich failures with GitHub job and failed-step evidence.
- Use GPT-5.6 to return a structured diagnosis, confidence, limitations, and prioritized recommendations with verification steps.
- Send a Discord alert after a verified failure.
- Provide deterministic replay fixtures when live integrations are unavailable.
- Deploy Stack Overlord to Vercel.

## Explicitly out of scope

- Multi-user authentication and organization access control.
- Automatic remediation or changes to monitored repositories.
- GPT-5.6 determining factual pipeline status.
- Monitoring the production Cognitive Bridge repository during the demo.
- Google Sheets storage or export.
- Deep historical log ingestion beyond the demo and webhook window.

## Success criteria

1. A real sandbox workflow success appears as successful without model involvement.
2. A controlled sandbox failure appears as failed, remains stored if AI or Discord fails, and opens an evidence-backed diagnosis.
3. The dashboard is coherent at desktop and 390-pixel mobile widths.
4. Lint, type check, tests, and production build pass.
5. Judges can run the project locally or use a live demo without rebuilding it.
