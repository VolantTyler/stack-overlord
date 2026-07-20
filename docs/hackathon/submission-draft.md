# Guided Build Tool: Prepare Submission

## Title

Stack Overlord

## Tagline

Know when the merge shipped—and what to do when it did not.

## Category

Developer Tools

## Live demo

https://stack-overlord.vercel.app

## Inspiration

Agentic development makes it possible to move quickly across code, pull requests, and deployments. It also makes it easier to drop a thread. A merge can succeed while the deployment silently fails, and the developer may not notice until production is stale. Stack Overlord was inspired by that cognitive gap: developers need a trustworthy final answer about whether their change actually shipped.

## Before and after

**Before:** A developer merges a change, sees GitHub accept it, switches tasks, and later discovers that a failed deployment left production stale. **After:** Stack Overlord preserves GitHub's verified workflow result, brings the developer back with a focused alert, and turns the available failure evidence into prioritized recovery steps that each include a way to verify the fix.

## What it does

Stack Overlord receives signed GitHub webhooks and records the factual state of each workflow in a durable Postgres ledger. Its responsive dashboard shows running, successful, failed, and cancelled processes across desktop and mobile. Failed processes open into an evidence-backed GPT-5.6 diagnosis containing the likely cause, confidence, limitations, and prioritized recovery actions with verification steps. Slack alerts pull the developer back before the failure is forgotten.

## What makes it different

CI dashboards and chat notifications usually report that a job failed; general-purpose AI assistants can suggest fixes after a developer supplies context. Stack Overlord closes the gap between those experiences without asking AI to decide what happened: signed GitHub events remain the source of truth, accepted telemetry is stored before any optional enrichment, failures are analyzed automatically, and any canonical stored run can be analyzed on demand using bounded run and job/step evidence. The result is a durable post-merge ledger plus confidence-aware guidance, explicit limitations, and testable next steps—not another model-generated status summary.

## How we built it

The application is a Next.js and TypeScript system deployed on Vercel. Route handlers verify GitHub HMAC signatures and normalize workflow runs. Drizzle ORM writes raw deliveries and pipeline state to Postgres. For failed runs, Stack Overlord retrieves GitHub job and failed-step evidence, then calls GPT-5.6 through the OpenAI Responses API with a strict structured-output schema. The diagnosis is stored and rendered in an accessible shadcn/ui dashboard, and the same incident can produce a concise Slack Block Kit alert.

## How Codex was used

Codex translated the reviewed PRD into the architecture, responsive dashboard, webhook contract, Postgres schema, deterministic fixtures, GPT-5.6 output schema, and automated tests. It ran the lint/typecheck/test/build loop, caught and fixed a long-credential overflow during visual inspection, and browser-verified the desktop and 390-pixel mobile experiences. The final submission will include the `/feedback` Session ID for the core build task.

## How GPT-5.6 was used

GPT-5.6 is part of the finished product, not the source of pipeline truth. GitHub determines whether a workflow passed or failed. Failures are analyzed automatically, and every ledger row can request an on-demand analysis of its canonical server-side record. The model receives bounded run and job/step evidence, then returns a structured interpretation with explicit uncertainty and verifiable next steps. The dashboard discloses missing context and records requested/resolved model identifiers, provenance, and response ID for traceability.

## Challenges

- Keeping optional AI and notification work from causing telemetry loss.
- Making diagnosis useful without allowing the model to invent status or certainty.
- Providing a reliable demo while still exercising authentic GitHub and Firebase infrastructure.
- Preserving enough technical detail on mobile without overwhelming the developer.

## Accomplishments

- The deterministic event ledger survives optional downstream failures.
- The same failure experience works coherently on desktop, mobile, and Slack.
- Replay mode gives judges a predictable test path while remaining clearly labeled.
- Every model recommendation is paired with a verification step.

## What we learned

The most useful boundary was separating machine-verifiable pipeline truth from model-generated interpretation. GPT-5.6 becomes more credible when the interface clearly labels evidence, confidence, and limitations instead of presenting one undifferentiated answer.

## What is next

- Correlate pull request checks, merge commits, deployment runs, and live endpoint health.
- Add repository-specific runbooks and historical incident similarity.
- Support multiple repositories and notification policies.
- Offer optional, explicitly approved remediation workflows.

## Judge testing instructions

No account or credentials are required for the deterministic judging path:

1. Open https://stack-overlord.vercel.app and confirm the dashboard labels its fixture-backed state.
2. Select **Replay failure**.
3. Open the failed process and confirm that its seeded status is distinct from the hand-authored analysis fixture.
4. Confirm the trace says no model call or API response occurred, then review the cited fixture evidence, confidence, and limitations.
5. Expand the prioritized recommendations and check that each includes a concrete verification step.
6. Narrow the browser or open the same incident on a phone to verify the responsive experience.

If live integrations have been configured and verified before judging, the presenter can additionally demonstrate one success and one controlled failure from the isolated Cognitive Bridge sandbox. The deterministic path above remains the reliable fallback and never targets the original production repository or Firebase project.

## Demo video outline — under three minutes

1. **0:00–0:20 — Problem:** A merge succeeds, the Firebase deployment fails, and the developer changes context.
2. **0:20–0:50 — Pipeline truth:** Show a successful sandbox run and the Stack Overlord ledger.
3. **0:50–1:25 — Failure:** Trigger the controlled failure and show the dashboard plus Slack alert.
4. **1:25–2:05 — GPT-5.6:** Open the failure and explain evidence, confidence, limitations, and recovery verification.
5. **2:05–2:25 — Mobile:** Open the same incident at a mobile width.
6. **2:25–2:50 — Codex:** Show the core Codex task, tests, browser verification, and `/feedback` ID.
7. **2:50–3:00 — Close:** The merge is not the finish line; Stack Overlord verifies what actually shipped.
