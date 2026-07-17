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

## What it does

Stack Overlord receives signed GitHub webhooks and records the factual state of each workflow in a durable Postgres ledger. Its responsive dashboard shows running, successful, failed, and cancelled processes across desktop and mobile. Failed processes open into an evidence-backed GPT-5.6 diagnosis containing the likely cause, confidence, limitations, and prioritized recovery actions with verification steps. Discord alerts pull the developer back before the failure is forgotten.

## How we built it

The application is a Next.js and TypeScript system deployed on Vercel. Route handlers verify GitHub HMAC signatures and normalize workflow runs. Drizzle ORM writes raw deliveries and pipeline state to Postgres. For failed runs, Stack Overlord retrieves GitHub job and failed-step evidence, then calls GPT-5.6 through the OpenAI Responses API with a strict structured-output schema. The diagnosis is stored and rendered in an accessible shadcn/ui dashboard, and the same incident can produce a concise Discord alert.

## How Codex was used

Codex translated the reviewed PRD into the architecture, responsive dashboard, webhook contract, Postgres schema, deterministic fixtures, GPT-5.6 output schema, and automated tests. It ran the lint/typecheck/test/build loop, caught and fixed a long-credential overflow during visual inspection, and browser-verified the desktop and 390-pixel mobile experiences. The final submission will include the `/feedback` Session ID for the core build task.

## How GPT-5.6 was used

GPT-5.6 is part of the finished product, not the source of pipeline truth. GitHub determines whether a workflow passed or failed. GPT-5.6 receives the already-verified failed run and available job/step evidence, then returns a structured diagnosis with explicit uncertainty and verifiable recovery recommendations. The dashboard records the model and response ID for traceability.

## Challenges

- Keeping optional AI and notification work from causing telemetry loss.
- Making diagnosis useful without allowing the model to invent status or certainty.
- Providing a reliable demo while still exercising authentic GitHub and Firebase infrastructure.
- Preserving enough technical detail on mobile without overwhelming the developer.

## Accomplishments

- The deterministic event ledger survives optional downstream failures.
- The same failure experience works coherently on desktop, mobile, and Discord.
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

Open https://stack-overlord.vercel.app. The application runs without credentials and loads deterministic fixtures. Select **Replay failure**, then open the failed process to inspect verified state, diagnosis, evidence, uncertainty, and recommendations. Live judging will additionally show a real isolated Cognitive Bridge sandbox success and controlled failure.

## Demo video outline — under three minutes

1. **0:00–0:20 — Problem:** A merge succeeds, the Firebase deployment fails, and the developer changes context.
2. **0:20–0:50 — Pipeline truth:** Show a successful sandbox run and the Stack Overlord ledger.
3. **0:50–1:25 — Failure:** Trigger the controlled failure and show the dashboard plus Discord alert.
4. **1:25–2:05 — GPT-5.6:** Open the failure and explain evidence, confidence, limitations, and recovery verification.
5. **2:05–2:25 — Mobile:** Open the same incident at a mobile width.
6. **2:25–2:50 — Codex:** Show the core Codex task, tests, browser verification, and `/feedback` ID.
7. **2:50–3:00 — Close:** The merge is not the finish line; Stack Overlord verifies what actually shipped.
