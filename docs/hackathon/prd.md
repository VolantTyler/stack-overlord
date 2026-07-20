# Guided Build Tool: PRD

| Field | Decision |
| --- | --- |
| Product | Stack Overlord |
| Hackathon | OpenAI Build Week 2026 |
| Track | Developer Tools |
| Deadline | July 21, 2026 at 5:00 PM PT / 8:00 PM ET |
| Version | Hackathon MVP |

## Problem

Modern developers delegate implementation, review, and repository work to agents across several systems. A merge may succeed while the post-merge deployment fails because of credentials, quotas, or environment configuration. The failure is easy to miss after the developer changes context, leaving production stale without an obvious signal.

## Product

Stack Overlord is a commit-to-deployment command center. Deterministic application code records GitHub's factual workflow conclusion. Failures are analyzed automatically, and a developer can request a bounded OpenAI analysis for any ledger row without giving the model authority over pipeline state.

Codex and GPT-5.6 have distinct roles:

- **Codex:** architecture, implementation, tests, debugging, review, responsive browser verification, and deployment preparation during Build Week.
- **GPT-5.6 API model:** runtime interpretation of already-verified pipeline records inside the finished product.

## User stories

### Invisible break

As a developer who has moved on after a merge, I want an immediate, trustworthy failure alert so I can respond before the deployment gap becomes stale production.

### Pipeline ledger

As a developer reviewing delivery history, I want a linear record of commit, workflow, and deployment state so I do not have to reconstruct it across GitHub tabs.

### Actionable diagnosis

As a developer opening any pipeline row, I want a clearly sourced interpretation, limitations, and ordered verification steps without confusing AI output with GitHub's conclusion.

## Functional requirements

1. Verify every GitHub webhook with HMAC SHA-256 before parsing.
2. Deduplicate deliveries by GitHub delivery ID.
3. Persist telemetry before optional model or notification work.
4. Map GitHub workflow status and conclusion deterministically.
5. Request analysis automatically only for verified failures and on demand for any canonical stored run.
6. Preserve a failure when diagnosis or notification is unavailable.
7. Show success/failure/running/cancelled summaries and a filterable ledger.
8. Give every row an accessible expandable analysis and keep the latest failure featured.
9. Communicate status with text and icons, not color alone.
10. Provide deterministic replay data for reliable judging and recording.
11. Disclose model provenance, exact evidence scope, missing context, and response trace metadata.

## Demo flow

1. Show a successful Cognitive Bridge sandbox deployment in Stack Overlord.
2. Trigger a controlled sandbox deployment failure.
3. Show the failed process and Slack notification.
4. Open the failure to show verified state, evidence, confidence, limitations, and recovery recommendations.
5. Resize to mobile and show the same incident experience.
6. Briefly show the Codex task, tests, and `/feedback` session evidence.
