# gaminginit

The website for the gaminginit gaming community, at [gaminginit.com](https://gaminginit.com). gaminginit closed on
24 November 2026, so the site is now a single thank-you page with the server's final lifetime stats.

Plain HTML, CSS and JavaScript in `public/`. No build step, no framework, no third-party requests, and no bot: the
numbers are a saved copy in `public/data/lifetime.json`, taken from the
[wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot)'s `GET /api/lifetime` before it closed.

## Pages

| Page | What it is |
| ---- | ---------- |
| `/` | A thank you, and the final lifetime stats: players, hours, matches, records, regulars, busiest times and favourite maps |

Every old page (`/stats`, `/live`, `/leaderboard`, `/discord` and so on) redirects to `/` (`public/_redirects`).

## Update the numbers

```bash
curl -fsS https://wardogs-discord-bot.idea-squared.workers.dev/api/lifetime -o public/data/lifetime.json
```

Do this once after the last day (24 November) while the bot still answers, then commit to `main`.

## Try it locally

```bash
pnpm install
pnpm start   # serves public/ on http://localhost:3000
pnpm test    # Node's built-in test runner
```

`public/js/app.js` draws the page. The formatting logic is in `public/js/format.js`, which the tests cover, and the
charts are in `charts.js` and `trends.js`.

## Deploy

Every push to `main` deploys the site once the tests pass, through
[ideaSquared/shipper](https://github.com/ideaSquared/shipper) (`ship.yaml`), as the `wardogs-community-site`
Cloudflare Worker. It then checks the home page answers and rolls back if it doesn't. To deploy `main` again without a
new commit, run `ship deploy gaminginit`, or Actions → CI → Run workflow.
