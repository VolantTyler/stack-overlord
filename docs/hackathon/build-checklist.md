# Guided Build Tool: Checklist

Last refreshed from Devpost and the live deployment: July 19, 2026.

## Build gates

- [x] New project work started during the submission period.
- [x] Developer Tools category selected.
- [x] Codex and GPT-5.6 roles are separate and explicit.
- [x] Next.js, Postgres, Vercel, and Slack architecture locked.
- [x] Google Sheets removed.
- [x] Signed GitHub webhook route implemented.
- [x] Delivery deduplication schema implemented.
- [x] Deterministic pipeline state mapping implemented.
- [x] GPT-5.6 structured diagnosis contract implemented.
- [x] GitHub failed job/step evidence enrichment implemented.
- [x] Slack-native failure notification implemented.
- [x] Responsive desktop and mobile dashboard implemented.
- [x] Clickable failure diagnosis and recommendations implemented.
- [x] Deterministic replay mode implemented.
- [x] README setup and environment instructions written.
- [x] Lint passes.
- [x] Type check passes.
- [x] Automated regression tests pass.
- [x] Production build passes.
- [x] Browser verification passes on desktop and mobile without console errors.

## Live integration gates

- [x] Complete one-time Vercel account authorization.
- [x] Create and deploy the Vercel project at `https://stack-overlord.vercel.app`.
- [x] Connect the public GitHub repository to Vercel for automatic deployments.
- [x] Provision Postgres and set `DATABASE_URL`.
- [x] Apply the Drizzle migration.
- [x] Add `OPENAI_API_KEY` and verify real `gpt-5.6` response IDs.
- [ ] Verify one local alert in `#stack-overlord-alerts`.
- [x] Duplicate Cognitive Bridge into an isolated sandbox repository.
- [ ] Create the sandbox Firebase project and least-privilege service account.
- [x] Add the GitHub webhook secret and optional repository token.
- [ ] Demonstrate one real sandbox success and one controlled failure.
- [ ] Save sanitized webhook fixtures from those real runs.

## Judging gates

### Technological Implementation

- [x] Working non-trivial code path spans webhook verification, persistence, enrichment, model analysis, notification, and UI.
- [x] Codex work is documented in README and repository artifacts.
- [ ] Record the final `/feedback` Codex Session ID.
- [ ] Preserve dated commits showing Build Week implementation.

### Design

- [x] Complete dashboard experience, not only a webhook proof of concept.
- [x] Desktop and mobile layouts verified.
- [x] Empty, loading, failure, degraded, and pending-diagnosis states designed.
- [ ] Verify the hosted deployment in desktop and mobile browsers.

### Potential Impact

- [x] Real audience and silent post-merge failure problem stated.
- [x] Capture one concise before/after story for the video and Devpost description.

### Quality of the Idea

- [x] Differentiation is closed-loop deployment truth plus evidence-backed, confidence-aware diagnosis.
- [x] Add a short competitor/differentiation paragraph to the final submission.

## Devpost submission gates

- [x] Project exists in Devpost as draft ID `1334572`.
- [x] Category decision: Developer Tools.
- [x] Project description draft created.
- [x] Installation instructions and supported platforms documented.
- [x] A judge-friendly deterministic test path exists.
- [x] Replace the outdated Devpost PRD description with judge-ready implementation copy.
- [x] Add the public repository URL.
- [x] Confirm repository visibility is public.
- [x] Add the live demo URL to the submission draft.
- [x] Add credential-free live demo and judge testing instructions.
- [ ] Record a public YouTube demo under three minutes.
- [ ] Voiceover must cover the product, Codex, and GPT-5.6.
- [ ] Add the `/feedback` Codex Session ID.
- [ ] Add all teammates and confirm invitations if applicable.
- [ ] Submit before July 21, 2026 at 5:00 PM PT.
- [ ] Confirm the Devpost state is Submitted, not Draft.
