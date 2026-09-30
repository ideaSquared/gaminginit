# WARDOGS community site

A one-page website for a WARDOGS community: a Discord invite, live server status and stats. The live numbers come
from [wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot), which reads the game server's RCON
once a minute and serves them at `GET /api/stats`.

What it shows:

- Server status (live, seeding, empty or offline), players online, map and score. While seeding it says how many
  more players are needed to go live.
- Discord member and online counts.
- Players over the last 24 hours, and the daily peak for the last 14 days. Each chart has a table view.
- The current match's top 5 players, and the last 10 matches with winner, length, peak players and top 5.

Plain HTML, CSS and JavaScript. No build step, no framework, no third-party requests.

## Deploy

You need:

- [Node.js](https://nodejs.org) 22 or newer.
- A free Cloudflare account. Use the same one as the bot.
- The bot deployed with the `/api/stats` endpoint (from wardogs-discord-bot `main`).

### 1. Get the bot's stats URL

1. In the `wardogs-discord-bot` folder, deploy the bot if you have not already:
   ```bash
   npm run deploy
   ```
2. Wrangler prints the bot's URL, like `https://wardogs-discord-bot.<your-subdomain>.workers.dev`.
3. Open that URL with `/api/stats` on the end in a browser. You should see JSON. `"server": null` is fine until the
   bot has run its first check (within a minute).

### 2. Point the site at the bot

Edit `public/index.html`:

| What            | Where                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Stats URL       | `<meta name="stats-url" content="…">`: set it to the URL from step 1, ending in `/api/stats` |
| Discord invite  | Already `https://discord.gg/jnsZkudxpD` in 3 places. If the invite changes, change all 3.     |
| Community name  | `<title>`, the `og:title` meta, the `.brand` link text and the `<h1>`                         |
| Intro text      | The `.lede` paragraph under the heading                                                      |

Commit and push the change if you will use option B or C below.

### 3. Deploy the site

Pick one option.

#### Option A: from your computer (simplest)

```bash
git clone https://github.com/ParagonJenko/gaminginit.git
cd gaminginit
npx --yes wrangler@4 login     # opens a browser to sign in to Cloudflare
npm run deploy
```

Wrangler prints the site's URL: `https://wardogs-community-site.<your-subdomain>.workers.dev`. The first part comes
from `name` in `wrangler.jsonc`; change it there if you want a different name.

To update the site later: edit the files, then run `npm run deploy` again.

#### Option B: deploy automatically on every push (Cloudflare)

This uses Cloudflare's Git integration for Workers. Menu names in the Cloudflare dashboard change from time to time;
the settings below are what matter.

1. The site's code is on the branch `claude/trusting-noether-j1zjlr`. Rename it to `main` first: on GitHub, open
   the repo → **Branches** → pencil icon next to the branch.
2. In the Cloudflare dashboard, go to **Workers & Pages** → **Create**, and choose to import a Git repository.
3. Connect GitHub if asked, then pick `ParagonJenko/gaminginit`.
4. Use these settings:

   | Setting           | Value                                                            |
   | ----------------- | ---------------------------------------------------------------- |
   | Worker name       | `wardogs-community-site` (must match `name` in `wrangler.jsonc`) |
   | Production branch | `main`                                                           |
   | Build command     | leave empty                                                      |
   | Deploy command    | `npx wrangler deploy`                                            |
   | Root directory    | `/`                                                              |

5. Save and deploy. Every push to `main` now redeploys the site.

#### Option C: GitHub Pages

GitHub Pages is free for public repos. For a private repo it needs a paid GitHub plan.

1. Rename the branch to `main`, as in option B step 1.
2. On GitHub: repo → **Settings** → **Pages** → **Source**: **GitHub Actions**.
3. Add this file as `.github/workflows/pages.yml` and push it:
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [main]
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   concurrency:
     group: pages
     cancel-in-progress: true

   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/configure-pages@v5
         - uses: actions/upload-pages-artifact@v3
           with:
             path: public
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
4. The site appears at `https://paragonjenko.github.io/gaminginit/`. The URL is also shown under
   **Settings** → **Pages**.

### 4. Use your own domain (optional, Cloudflare)

The domain must already be added to your Cloudflare account. In the dashboard, open the `wardogs-community-site`
Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain**, and enter e.g. `wardogs.example.com`.
Cloudflare creates the DNS record and certificate.

### 5. Check it works

Open the site and look at the server card and the line under the hero.

| What you see                                              | What it means                                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Status **Live**, **Seeding** or **Empty** with a player count | Working.                                                                                  |
| "Live stats are not connected yet"                        | The `stats-url` meta tag still has the placeholder. Do step 2, then deploy again.             |
| "Could not load the live stats"                           | The stats URL is wrong or the bot is not deployed. Open the URL directly; it must show JSON.  |
| Status **Waiting**                                        | The bot is deployed but has not checked the game server yet. Wait a minute.                   |
| Status **Offline**                                        | The bot cannot reach the game server. Check the bot's logs in Cloudflare.                     |
| No Discord member count under the buttons                 | `DISCORD_INVITE` is not set in the bot's `wrangler.jsonc`, or the bot has not refreshed yet (every 10 min). |

Serving the site's files is free and unlimited on Cloudflare. Only the stats requests count towards the bot's
100,000 requests a day on the free plan.

## Try it locally

```bash
npm start                      # serves public/ on http://localhost:3000
```

- `http://localhost:3000/?demo` shows made-up numbers, so you can see the page before the bot is set up.
- `http://localhost:3000/?stats=http://localhost:8787/api/stats` reads a bot running locally with `wrangler dev`.

Until the stats URL is set, the page says live stats are not connected and links to the demo.

## How it behaves

- Fetches the stats every 60 seconds, and only while the tab is visible. The bot's numbers change once a minute.
- If the bot has not read the server for 3 minutes, the server shows as **Offline** with when it was last seen.
- If a refresh fails, the page keeps the last numbers and says it is retrying.
- Player and server names are inserted as text, never as HTML.
- Charts work with a keyboard: tab to the 24-hour chart and use ← →, Home and End; tab through the daily bars.

## Development

```bash
npm test    # Node's built-in test runner; no dependencies to install
```

The formatting and state logic is in `public/js/format.js` and is what the tests cover. `charts.js` draws the SVG
charts, `app.js` fetches and renders, and `demo.js` makes the sample data.
