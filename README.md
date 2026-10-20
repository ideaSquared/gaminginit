# gaminginit

The website for the gaminginit gaming community, at [gaminginit.com](https://gaminginit.com): a Discord invite, and
live status and stats for our WARDOGS server.

Plain HTML, CSS and JavaScript in `public/`. No build step, no framework, no third-party requests. The live numbers
come from [wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot), which reads the game server
once a minute and serves them at `GET /api/stats`.

## Pages

| Page | What it is |
| ---- | ---------- |
| `/` | Server status, players, Discord, and how to play with us |
| `/stats`, `/matches`, `/teams` | Player numbers, recent matches, which team wins most |
| `/lifetime` | Lifetime stats: players so far, hours played, records, favourite maps and when we are busiest |
| `/live` | The match on now: score, kill feed, highlights |
| `/leaderboard`, `/players`, `/player?id=…` | Leaderboards, weapons, and every player's page |
| `/seeding` | What seeding is, top seeders, who has seeder VIP |
| `/vote` | The next-map vote: live counts, and buttons to vote for signed-in members of the Discord (or vote in Discord itself). The winner plays next, infantry only |
| `/account` | Players sign in with Discord, link their Steam account, join the Discord, and see their VIP. Vote for the next map from `/vote` once signed in |
| `/season` | The Season 1 roundup and the Season in Review, open since the wipe on 15 October 2026 |
| `/admin` | Staff only: moderation and the server's settings (Discord sign-in). `/server-settings` goes there |

Full details are in [docs/site-pages.md](docs/site-pages.md) and [docs/staff-pages.md](docs/staff-pages.md).

## Deploy

You need [Node.js](https://nodejs.org) 22 or newer, a free Cloudflare account (the same one as the bot), and the bot
deployed with `/api/stats`. Some pages need more of the bot (player pages, live, staff pages, weapons, teams, seeder
VIP, 14-day busy times). With an older bot the site still works and hides what it can't show. Each bot feature is
named in the bot's README.

### 1. Get the bot's stats URL

1. In the `wardogs-discord-bot` folder, deploy the bot if you have not already:
   ```bash
   npm run deploy
   ```
2. Wrangler prints the bot's URL, like `https://wardogs-discord-bot.<your-subdomain>.workers.dev`.
3. Open that URL with `/api/stats` on the end in a browser. You should see JSON. `"server": null` is fine until the
   bot has run its first check (within a minute).

### 2. Point the site at the bot

Edit `public/index.html`, and the other pages in `public/` (`stats.html`, `lifetime.html`, `matches.html`, `teams.html`, `live.html`, `leaderboard.html`, `players.html`, `player.html`, `seeding.html`, `vote.html`, `season.html` and `admin.html`) where it says so:

| What            | Where                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Stats URL       | `<meta name="stats-url" content="…">`: set it to the URL from step 1, ending in `/api/stats`. Same in all twelve pages. The player pages read `/api/players` and `/api/player` from the same place, and the live page `/api/live` and its WebSocket. |
| Discord invite  | Already `https://discord.gg/qsJFYGhSJ4`: 5 places in `index.html` (one is the invite as text under the Join button) and 1 in each other page. If the invite changes, change all 16. Set it to never expire with no use limit: Discord invites expire after 7 days by default. |
| Discord links   | Every Discord button goes through the bot (`/go/discord?src=<place>`, set by `js/discord.js` from the page and the link's `data-src`), which counts the click and sends people to the bot's `DISCORD_INVITE`: keep it the same as the invite above. Without JavaScript the button is the invite itself. `public/_redirects` has `/discord`, a short link for the welcome message in game; it points at the bot's `/go/discord`, so change it with the stats URL. **Deploy the bot first**: the links need its `/go/discord`. |
| Name and logo   | Already gaminginit: `<title>`, the `og:`/`twitter:` metas, the JSON-LD block, `og-image.png`, `apple-touch-icon.png`, the `.wordmark` spans and `favicon.svg`. The other pages have their own `<title>`, metas and wordmarks. |
| Intro text      | The `.lede` paragraph under the heading                                                      |

Commit and push the change to `main` if you will use option B or C below.

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
from `name` in `wrangler.jsonc`. Don't rename it once a custom domain is attached: a new name deploys a new Worker,
and the domain stays on the old one.

To update the site later: edit the files, then run `npm run deploy` again.

#### Option B: deploy automatically on every push (Cloudflare)

This uses Cloudflare's Git integration for Workers. Menu names in the Cloudflare dashboard change from time to time;
the settings below are what matter.

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Create**, and choose to import a Git repository.
2. Connect GitHub if asked, then pick `ParagonJenko/gaminginit`.
3. Use these settings:

   | Setting           | Value                                                            |
   | ----------------- | ---------------------------------------------------------------- |
   | Worker name       | `wardogs-community-site` (must match `name` in `wrangler.jsonc`) |
   | Production branch | `main`                                                           |
   | Build command     | leave empty                                                      |
   | Deploy command    | `npx wrangler deploy`                                            |
   | Root directory    | `/`                                                              |

4. Save and deploy. Every push to `main` now redeploys the site.

Pushes to other branches, such as pull requests, run `npx wrangler preview` and get a preview link instead. That
command needs the `previews` block in `wrangler.jsonc`, which is already there.

#### Option C: GitHub Pages

GitHub Pages is free for public repos. For a private repo it needs a paid GitHub plan.

1. On GitHub: repo → **Settings** → **Pages** → **Source**: **GitHub Actions**.
2. Add this file as `.github/workflows/pages.yml` and push it:
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
3. The site appears at `https://paragonjenko.github.io/gaminginit/`. The URL is also shown under
   **Settings** → **Pages**.

### 4. Use your own domain (optional, Cloudflare)

The domain must already be added to your Cloudflare account. In the dashboard, open the `wardogs-community-site`
Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain**, and enter e.g. `wardogs.example.com`.
Cloudflare creates the DNS record and certificate.

### 5. Check it works

Open the site and look at the server card and the line under the header.

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

## Notice for everyone

For news everyone should see, like the server being down, `public/announcement.json` puts a notice at the top of every
page, in a slim yellow strip:

```json
{
  "show": true,
  "title": "Server problems",
  "message": "Problems at our hosting provider and at Bulkhead, who make WARDOGS, are affecting our server.",
  "link": { "text": "Updates on our Discord", "href": "https://discord.gg/qsJFYGhSJ4" }
}
```

- To change it, edit the file and deploy (with [Option B](#option-b-deploy-automatically-on-every-push-cloudflare),
  edit it on GitHub and commit to `main`). Pages pick it up when they load, and pages left open within 5 minutes.
- To take it down, set `"show": false`. The text stays in the file for next time.
- `title` and `link` are optional. A link must go to a web page (`https://…`) or one of our pages (`seeding`).
- If the file has a mistake, such as a missing comma, no notice shows and the rest of the site works as normal. Check
  it with `node -e "JSON.parse(require('fs').readFileSync('public/announcement.json'))"`.

## Try it locally

```bash
npm start                      # serves public/ on http://localhost:3000
```

- `http://localhost:3000/?demo` shows made-up numbers, so you can see the page before the bot is set up. On
  `http://localhost:3000/live?demo` a sample match plays itself out. Links between
  the pages keep `?demo` (and `?stats=`). `http://localhost:3000/player?demo&id=d00000000000` is a sample player.
- `http://localhost:3000/?stats=http://localhost:8787/api/stats` reads a bot running locally with `wrangler dev`.

Until the stats URL is set, the page says live stats are not connected and links to the demo.

## Development

```bash
npm test    # Node's built-in test runner; no dependencies to install
```

The formatting and state logic is in `public/js/format.js` and is what the tests cover. Each page has its own script in
`public/js/`, mostly named after it (`stats.js`, `matches.js`, `player.js`, `admin.js` and so on). The exceptions: the
home page uses `app.js` and `/live` uses `livematch.js`. The staff page, `/admin`, has more: `queue.js` (its Queue),
`server.js` (its Server section, which loads `rotations.js`, `lines.js` and `rules.js` when they are opened),
`palette.js` (the command search), `record.js` (a player's record), `tools.js` (the staff commands' forms) and
`ask.js` (its questions). Shared parts:
`live.js` (fetches the bot's numbers and the notice), `views.js` (DOM pieces), `charts.js` (SVG charts), `demo.js`
(sample data), `session.js` and `staff.js` (staff sign-in and the staff bar). Logic kept apart from its
page, for tests, is in the `*model.js` files.
