#!/usr/bin/env bash
set -euo pipefail

# Codex cloud runs this setup phase with network access. The later agent phase
# can stay offline because both npm packages and the matching browser revision
# are persisted in the environment container.
npm ci --include=dev
npm run preview:install
npm run preview:check
