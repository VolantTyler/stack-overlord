# Remote preview screenshots

Stack Overlord includes a pinned Playwright runner and a Chromium-based capture
flow for Codex cloud. It creates full-page desktop and mobile screenshots while
also checking the page response, key dashboard headings, and browser errors.

## Why environment setup is required

Codex cloud has two relevant phases:

1. The environment setup script runs with network access.
2. The agent phase runs without internet access by default.

Installing the Playwright npm package does not download its matching browser.
Provision Chromium and its Linux libraries during environment setup so the
offline agent phase can launch it later. Playwright stores its managed browser in
a cache rather than placing `chromium` on `PATH`.

## Codex cloud environment

In the Codex environment used for this repository:

1. Merge this browser setup into the repository's default branch.
2. Select Node.js 22.
3. Set the setup script to:

   ```bash
   bash scripts/setup-codex-cloud.sh
   ```

4. Use the same command as the maintenance script so a changed lockfile installs
   the matching Playwright browser revision in a resumed container.
5. Save the environment, then select **Reset cache** once if it was previously
   created without Playwright.
6. Start a new task with that environment selected.

The repository script runs:

```bash
npm ci --include=dev
npm run preview:install
npm run preview:check
```

`preview:install` resolves to
`playwright install --with-deps chromium`, which installs both Chromium and the
Linux packages it needs.

## Capture and verification

Check that the package, browser binary, and Linux libraries are all usable:

```bash
npm run preview:check
```

Start Next.js automatically, verify the page in desktop and mobile Chromium, and
capture both views:

```bash
npm run preview:capture
```

The screenshots are written to:

```text
artifacts/remote-preview/desktop.png
artifacts/remote-preview/mobile.png
```

To capture an already-running or deployed app instead of starting the local dev
server, set `PREVIEW_BASE_URL` before running `preview:capture`.

## Build reliability

The app uses system font stacks instead of `next/font/google` so builds and
screenshots do not depend on Google Fonts network access.
