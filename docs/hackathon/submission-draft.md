# OpenAI Build Week Devpost draft

## Public project fields

**Title:** Stack Overlord

**Tagline:** Know when the merge shipped—and what to do when it did not.

**Category:** Developer Tools

**Live demo:** https://stack-overlord.vercel.app

**Public repository:** https://github.com/VolantTyler/stack-overlord

## Project story

### Inspiration

A merged pull request feels finished, but the deployment that follows can still fail after the developer has changed context. Agentic development makes that gap easier to miss: work moves faster across repositories and cloud services, while the final delivery state remains scattered across GitHub tabs and notifications.

Stack Overlord gives developers one trustworthy answer to two questions: **Did it ship? If not, what should I do next?**

### What it does

Stack Overlord is a commit-to-deployment command center for GitHub Actions:

- It verifies signed GitHub webhooks, deduplicates deliveries, and records workflow state in a durable Postgres ledger.
- GitHub's workflow conclusion sets the factual status. GPT-5.6 explains verified failures but can never change that status.
- For a failure, Stack Overlord collects available GitHub job and failed-step evidence and requests a structured GPT-5.6 diagnosis with evidence, confidence, limitations, and prioritized recovery actions.
- The responsive dashboard filters runs by repository and status, links every incident back to its GitHub workflow, and keeps the model's explanation visually separate from the verified failure.
- A Slack Block Kit alert can return the developer to the incident after telemetry has already been safely stored.

The hosted demo shows real failures from an isolated public sandbox repository and recorded GPT-5.6 diagnoses. Its **Replay sandbox failure** control also adds a deterministic, browser-only incident so judges have a reliable test path without credentials.

### What makes it different

CI dashboards report that a job failed, while general-purpose AI assistants can suggest fixes after a developer supplies the context. Stack Overlord closes that gap without asking AI to decide what happened: the signed GitHub event is stored first as pipeline truth, and GPT-5.6 only interprets the available evidence. The result is a durable delivery ledger plus a focused recovery move—not a model-generated status summary.

### How we built it

Stack Overlord is a Next.js 16, React 19, and TypeScript application deployed on Vercel. Drizzle ORM stores raw webhook deliveries and normalized runs in Neon Postgres. The webhook route verifies GitHub HMAC signatures before parsing, persists accepted telemetry before optional work, and then enriches verified failures with GitHub Actions evidence. GPT-5.6 is called through the OpenAI Responses API with a strict structured-output schema. Slack notification, database, GitHub, and OpenAI clients are initialized lazily so missing optional credentials do not break the build or the deterministic demo.

Codex accelerated the core build: it translated the product boundary into the architecture, schema, signed-webhook contract, evidence enrichment, GPT-5.6 output schema, Slack integration, responsive repository dashboard, deterministic fixtures, and regression tests. It also drove the lint, type-check, test, production-build, and desktop/mobile browser-verification loop. Key decisions—GitHub owns truth, persistence happens first, and AI remains an optional interpretation layer—are reflected in both the code and the interface.

### Challenges we ran into

- Preserving a verified failure even when GitHub enrichment, OpenAI, or Slack is unavailable.
- Giving GPT-5.6 enough evidence to help without letting a plausible explanation become invented pipeline truth.
- Providing a real end-to-end demo without targeting the original Cognitive Bridge production repository or Firebase project.
- Keeping repository, workflow, commit, timing, and recovery detail readable on desktop and mobile.

### Accomplishments that we are proud of

- A working path from signed GitHub event to Postgres persistence, GPT-5.6 diagnosis, Slack notification, and responsive UI.
- Real sandbox failures and traceable GPT-5.6 response IDs in the hosted deployment.
- Idempotent webhook handling and persistence-first failure behavior.
- A no-login replay path that judges can test without rebuilding or configuring the project.
- Status communicated with text and icons, not color alone.

### What we learned

The most valuable AI boundary was also the simplest: deterministic systems should state what happened; the model should explain what the evidence might mean. GPT-5.6 becomes more useful and more credible when confidence, limitations, and verification steps are part of the contract rather than optional prose.

### What is next

- Correlate pull requests, merge commits, deployments, and live endpoint health in one timeline.
- Add deeper log and artifact retrieval for higher-confidence diagnoses.
- Add repository-specific runbooks, notification policies, and incident history.
- Offer explicitly approved remediation workflows while keeping factual state outside the model's control.

## Devpost additional-info answers

### Code repository

https://github.com/VolantTyler/stack-overlord

### Live demo and judge testing instructions

No account, credentials, or rebuild is required.

1. Open https://stack-overlord.vercel.app.
2. Confirm the page is labeled **Live feed** and review the real failed workflows from `VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo`.
3. In **One event. Four factual handoffs**, note that the GitHub conclusion is accepted and telemetry is stored before diagnosis and notification.
4. In **Recent pipeline runs**, use **Open** to inspect the corresponding public GitHub Actions run.
5. Compare the verified failure with **Latest failure diagnosis**. The GPT-5.6 summary and recovery move are visually separated from the GitHub-owned conclusion.
6. Select **Replay sandbox failure**. The failure count increases and a deterministic replay appears at the top of the ledger; this changes browser state only.
7. Use the repository picker and status filters, then narrow the browser to a mobile width to verify the responsive experience.

### Developer-tool installation, platforms, and local testing

**Fastest path:** use the hosted demo above in any current desktop or mobile Chrome, Safari, Firefox, or Edge browser.

**Local requirements:** Node.js 20.9 or newer and npm on macOS, Linux, or Windows.

```bash
git clone https://github.com/VolantTyler/stack-overlord.git
cd stack-overlord
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables, Stack Overlord loads deterministic sandbox fixtures and the replay control. Optional live integrations use `DATABASE_URL`, `OPENAI_API_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN`, and `SLACK_WEBHOOK_URL`; setup and signed-replay instructions are in the repository README and `docs/demo-walkthrough.md`.

Verification commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Remaining user-only inputs

- [ ] A public YouTube demo URL for a video shorter than three minutes.
- [ ] The Codex `/feedback` Session ID from the session where the majority of the core functionality was built.

Keep the Devpost entry in draft and do not submit until both values are present.

## Demo video outline — target 2:55

1. **0:00–0:18 — The invisible break:** A pull request merges, a later deployment fails, and the developer has already switched tasks.
2. **0:18–0:38 — The answer:** Open the hosted Stack Overlord dashboard and frame the before/after: one place to see whether the change shipped and what to do next.
3. **0:38–1:05 — Pipeline truth:** Show the live route map and real sandbox failure. Explain that GitHub sets the status and Postgres stores it before optional work.
4. **1:05–1:30 — Evidence:** Open the linked public GitHub Actions run, then return to the ledger and repository filters.
5. **1:30–1:58 — GPT-5.6:** Show the latest diagnosis and recovery move. Explain the structured evidence, confidence, limitations, and verification contract, and state that the model never determines pipeline status.
6. **1:58–2:15 — Reliable judge path:** Select **Replay sandbox failure** and show the new browser-only incident.
7. **2:15–2:35 — Codex:** Briefly show the repository history and verification commands; explain that Codex built and iterated on the architecture, integrations, tests, and responsive interface.
8. **2:35–2:48 — Mobile and Slack:** Show the mobile layout and, if a verified alert is available for recording, the matching Slack notification.
9. **2:48–2:55 — Close:** “The merge is not the finish line. Stack Overlord tells you what actually shipped.”
