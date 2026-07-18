# Remote preview screenshots

Stack Overlord can be served in the remote environment with `npm run dev`, then
captured by browser automation when the environment includes a browser binary.

## Required environment setup

The remote image should preinstall at least one browser automation target:

- Chromium or Google Chrome for Playwright/Puppeteer-style screenshots.
- Firefox if the capture workflow is configured to use it.

Runtime package installation is not a reliable fallback because restricted
environments can block npm registry and apt repository access. Keep the browser
binary in the base image and verify it before asking the agent to capture UI
changes.

## Verification

Run this before attempting a screenshot:

    npm run preview:check

If the command fails, the app can still be started for HTTP preview, but the
agent cannot capture browser screenshots until the environment image provides a
supported browser binary.

## Build reliability

The app uses system font stacks instead of `next/font/google` so production
builds do not depend on Google Fonts network access.
