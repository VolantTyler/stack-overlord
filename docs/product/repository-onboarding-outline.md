# Repository Monitoring & Onboarding Outline

A concise product outline for evolving Stack Overlord from a single demo dashboard into a repository-scoped or multi-user monitoring product.

## 1. Current State

### 1.1 What works today

- Stack Overlord receives signed GitHub webhooks at one endpoint: `/api/webhooks/github`.
- It stores accepted webhook deliveries in Postgres.
- It normalizes `workflow_run` events into pipeline runs.
- It displays recent runs on the dashboard.
- Failed runs can be enriched with GitHub job/step evidence and GPT-5.6 diagnosis.
- Discord alerts are optional.

### 1.2 Is it limited to one repository?

Not at the database level.

The current schema stores a `repository` value on both raw events and normalized pipeline runs, so events from multiple repositories can technically be stored.

However, the product UI is currently a shared global dashboard. The home page loads recent runs without filtering by repository, user, organization, or installation.

### 1.3 What will users see today?

If there is no live database data, everyone sees the deterministic Cognitive Bridge Stack Overlord demo data.

If live Postgres data exists, everyone sees the same global feed of recent pipeline runs.

## 2. Key Product Decision

Choose which product mode you want next.

### 2.1 Single-owner demo or self-hosted mode

Best if this remains a hackathon/demo or self-hosted tool.

Characteristics:

- One deployment belongs to one person/team.
- One or a few repositories send webhooks to that deployment.
- Everyone with the URL sees the same dashboard.
- No user accounts required.
- Manual webhook setup is acceptable.

### 2.2 Repository-scoped public dashboards

Best if you want multiple repositories but not full SaaS authentication yet.

Characteristics:

- One deployment can receive events from many repositories.
- Users view repository-specific pages such as `/r/:owner/:repo`.
- Dashboard queries filter by repository.
- Works best for public or non-sensitive repository data.
- Still does not solve private multi-user access control.

### 2.3 Multi-user SaaS

Best if users should connect and privately view their own repositories.

Characteristics:

- Users sign in.
- Users connect GitHub repositories.
- Each repository connection belongs to a user or organization.
- Dashboards are scoped by account and repository connection.
- Private repository data is protected.
- GitHub App installation is preferred over manual webhooks.

## 3. Do We Need Different Routes?

Yes, if the app should display different data for different repositories or users.

### 3.1 Minimal repository route

```text
/r/[owner]/[repo]
```

Example:

```text
/r/VolantTyler/Cognitive-Bridge-Stack-Overlord-Demo
```

This route would fetch only runs for the selected repository.

### 3.2 Authenticated dashboard routes

```text
/dashboard
/dashboard/repositories/[connectionId]
```

These routes should use the signed-in user session to determine which repositories the user can access.

### 3.3 Webhook route can stay shared

You do not need a different webhook URL per repository.

One route can receive all GitHub webhooks:

```text
/api/webhooks/github
```

The webhook payload includes repository identity. The missing piece is mapping that repository to a known connection and then scoping dashboard queries.

## 4. Do We Need User Accounts?

### 4.1 Not required for the current demo

The current MVP explicitly targets a single-developer/demo experience. User accounts are not required for that.

### 4.2 Required for a real multi-user product

Accounts become important when:

- Users connect private repositories.
- Users should only see their own runs.
- Teams need organization-level access.
- GitHub tokens or installation tokens must be managed securely.
- Commit messages, branch names, workflow URLs, and failure details should not be public.

## 5. Recommended Onboarding Flow

### 5.1 Welcome

Explain what Stack Overlord does:

- Listens to GitHub workflow results.
- Stores factual CI/CD state.
- Uses GPT-5.6 only to explain verified failures.
- Keeps GitHub as the source of truth.

### 5.2 Choose connection method

Recommended options:

1. **Install GitHub App** — best long-term product experience.
2. **Manual webhook setup** — fastest path and closest to the current implementation.

### 5.3 Select or enter repository

For GitHub App onboarding:

- User installs the app.
- User selects repositories in GitHub.
- Stack Overlord stores repository connections.

For manual onboarding:

- User enters `owner/repo`.
- App generates or displays webhook setup instructions.

### 5.4 Show webhook instructions

For manual setup, show:

```text
Payload URL: https://YOUR-DOMAIN/api/webhooks/github
Content type: application/json
Secret: generated or configured webhook secret
Events: Pushes, Pull requests, Workflow runs
```

### 5.5 Verify connection

Show connection status:

- Waiting for first webhook delivery.
- Signed delivery received.
- Workflow run received.
- First dashboard run available.

### 5.6 Trigger first run

Ask the user to:

- Push a commit,
- open a pull request,
- or manually dispatch a workflow.

Then wait for the first `workflow_run` event.

### 5.7 Finish

Send the user to the repository dashboard.

Example:

```text
/dashboard/repositories/[connectionId]
```

or:

```text
/r/[owner]/[repo]
```

## 6. Suggested Implementation Phases

### Phase 1: Repository filtering

Goal: Make the current dashboard repository-aware.

Tasks:

- Add a repository-filtered query, such as `listPipelineRuns({ repository })`.
- Add a repository route like `/r/[owner]/[repo]`.
- Update empty states to say whether the app is waiting for webhooks for that repository.

### Phase 2: Connection records

Goal: Track which repositories are intentionally connected.

Add a table such as:

```text
repository_connections
- id
- repository_full_name
- webhook_secret_hash or github_installation_id
- status
- last_delivery_at
- created_at
- updated_at
```

Then associate pipeline events and runs with a repository connection.

### Phase 3: Onboarding page

Goal: Reduce setup headaches.

Tasks:

- Add `/onboarding` or `/setup`.
- Show a guided checklist.
- Generate/display webhook setup instructions.
- Show verification status from received webhook events.

### Phase 4: User accounts

Goal: Support private repository dashboards.

Tasks:

- Add authentication.
- Add users and organizations.
- Associate repository connections with users/orgs.
- Scope dashboard queries by session.

### Phase 5: GitHub App

Goal: Replace manual webhook setup with a smoother product flow.

Tasks:

- Create GitHub App.
- Store installation IDs.
- Handle GitHub App webhooks.
- Use installation tokens for Actions evidence.
- Let users install/uninstall/reconnect from the UI.

## 7. Recommended Next Step

Start with repository-scoped dashboards and onboarding, not full SaaS.

Phase 1 implementation scope:

1. Add a dashboard repository picker as the primary personal multi-repo workflow.
2. Keep `/r/[owner]/[repo]` as a bookmarkable direct route.
3. Add repository filtering to `listPipelineRuns`.
4. Add `/onboarding` with manual webhook instructions.
5. Delay user accounts because the first real-use version is for the project owner connecting their own repositories.

Recommended follow-up:

1. Add a simple `repository_connections` table.
2. Show connection verification status in onboarding.
3. Promote the picker from observed repositories to configured repository connections.

This keeps implementation simple while moving the project toward a product that can support users viewing their own repositories.
