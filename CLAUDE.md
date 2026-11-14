# CLAUDE.md

gaminginit is the website for the gaminginit gaming community (gaminginit.com): a Discord invite plus live WARDOGS
server stats, as plain HTML, CSS and JavaScript in `public/`, served as static assets by a Cloudflare Worker.

## Build and checks

- No build step. `pnpm start` serves `public/` locally; `pnpm test` runs `node --test` over `test/` (Node 22+).
- CI (`.github/workflows/ci.yml`) runs `pnpm install --frozen-lockfile` and `pnpm test`; main then deploys through
  ideaSquared/shipper (`ship.yaml`). See README.md for the pages and deploy steps.

## Logging

The site's JavaScript runs in visitors' browsers, so it has no server logs. If server-side code is ever added (a
Worker entry or a Pages Function), it must log through `@ideasquared/log`, never `console.*`, with no personal data
or secrets. Load the `logging` skill (`.claude/skills/logging/SKILL.md`) first.
