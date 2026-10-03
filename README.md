# gaminginit

The website for the gaminginit gaming community, at [gaminginit.com](https://gaminginit.com): a Discord invite, and
live status and stats for our WARDOGS server. The live numbers come from
[wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot), which reads the game server's RCON once
a minute and serves them at `GET /api/stats`.

What it shows:

- Server status (live, seeding, empty or offline), players online, map and score. While seeding it says how many
  more players are needed to go live.
- Discord member and online counts.
- Players over the last 24 hours, and the daily peak for the last 14 days. Each chart has a table view.
- The busy times of day: average players in each hour, with the busy hours highlighted. An hour is busy when the
  server had 97+ players (the bot's `thresholds.busy`) at least half the time. Over the last 14 days when the bot
  sends `hourly` with `busy`, otherwise over the last 24 hours.
- The current match's top 5 players, and the 3 latest matches with winner, length, peak players and top player.
- A matches page (`/matches`) with the last 10 matches, each with its top 5.
- A leaderboard for the last 30 days: most kills, best K/D, most time played and top seeders.
- Weapons: the 10 weapons with the most kills over the last 30 days, each with its share of headshots, average distance
  and longest kill, plus the kills recorded, the share of headshots and the longest kill of all. From the game's kill
  feed, which the bot takes when it is set up for it; without it, the section stays hidden. Until the feed has run for
  30 days, it says the day it started.
- A page for every player (`/player?id=…`): player names on the leaderboard and in matches link to it. It has their
  time played, matches, kills, K/D, win rate and seed days over the last 30 or 90 days, with their place on each
  leaderboard board; whether they are in game now; seeder VIP and how close they are to earning it; personal bests
  (most kills and best K/D in a match, most kills in a day, longest kill, MVPs, top-3 finishes); their weapons (kills,
  headshots and longest kill with each, when the bot has the kill feed); their maps and sides; a calendar of
  their days on the server with streaks; kills in each of their last 20 matches; and their recent matches with the
  result, every side's score and their place on the scoreboard. Sides are named in their colour in game, from the
  bot's match records, lightened where needed so they read on the dark cards.
- A players page (`/players`): who is in game now, and everyone seen in the last 90 days, with a search box to find a
  player's page. Players are known by an id the bot makes, never their Steam ID.
- Seeder VIP: what seeding earns (a reserved slot), under the intro and as step 4 of "Play with us". Shown only
  when the bot has automatic VIP on, and worded from the bot's rule, so it always matches what the bot does.
- What seeding is: the empty, seeding and live states with the bot's player thresholds, and how to help.

Plain HTML, CSS and JavaScript. No build step, no framework, no third-party requests.

## Deploy

You need:

- [Node.js](https://nodejs.org) 22 or newer.
- A free Cloudflare account. Use the same one as the bot.
- The bot deployed with the `/api/stats` endpoint (from wardogs-discord-bot `main`). The leaderboard and VIP
  sections need a bot that sends `leaderboard` and `vip`; with an older bot the page still works without them.
  The player pages need a bot that serves `/api/players` and `/api/player`, next to `/api/stats`; with an older bot,
  names are not links and the players page cannot load.
  The weapons need a bot with the kill feed set up (its README, "Weapon stats"), which sends `weapons` in
  `/api/stats` and on player pages; without it, they are not shown.
  The 14-day busy times need `hourly`: `{ "days": 14, "players": [24 numbers], "busy": [24 numbers] }`, for each UTC
  hour (0 to 23) over those days the average players and the share of readings (0 to 1) with `thresholds.busy`
  players or more, `null` for an hour with no readings.

### 1. Get the bot's stats URL

1. In the `wardogs-discord-bot` folder, deploy the bot if you have not already:
   ```bash
   npm run deploy
   ```
2. Wrangler prints the bot's URL, like `https://wardogs-discord-bot.<your-subdomain>.workers.dev`.
3. Open that URL with `/api/stats` on the end in a browser. You should see JSON. `"server": null` is fine until the
   bot has run its first check (within a minute).

### 2. Point the site at the bot

Edit `public/index.html`, and `public/matches.html`, `public/players.html` and `public/player.html` where it says so:

| What            | Where                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Stats URL       | `<meta name="stats-url" content="…">`: set it to the URL from step 1, ending in `/api/stats`. Same in all four pages. The player pages read `/api/players` and `/api/player` from the same place. |
| Discord invite  | Already `https://discord.gg/qsJFYGhSJ4`: 4 places in `index.html`, 1 each in `matches.html`, `players.html` and `player.html`. If the invite changes, change all 7. Set it to never expire with no use limit: Discord invites expire after 7 days by default. |
| Name and logo   | Already gaminginit: `<title>`, the `og:`/`twitter:` metas, the JSON-LD block, `og-image.png`, `apple-touch-icon.png`, the `.wordmark` spans and `favicon.svg`. `matches.html`, `players.html` and `player.html` have their own `<title>`, metas and wordmarks. |
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

- `http://localhost:3000/?demo` shows made-up numbers, so you can see the page before the bot is set up. Links between
  the pages keep `?demo` (and `?stats=`). `http://localhost:3000/player?demo&id=d00000000000` is a sample player.
- `http://localhost:3000/?stats=http://localhost:8787/api/stats` reads a bot running locally with `wrangler dev`.

Until the stats URL is set, the page says live stats are not connected and links to the demo.

## How it behaves

- Fetches the stats every 60 seconds, and only while the tab is visible. The bot's numbers change once a minute.
- If the bot has not read the server for 3 minutes, the server shows as **Offline** with when it was last seen.
- If a refresh fails, the page keeps the last numbers and says it is retrying.
- Player and server names are inserted as text, never as HTML.
- Charts work with a keyboard: tab to the 24-hour chart and use ← →, Home and End; tab through the daily bars. On a
  player page, tab to the calendar and use ← → for weeks and ↑ ↓ for days, or to the kills chart and use ← →.
- Player pages are marked `noindex`, so search engines leave individual players out. The players page is indexed.
- A player page shows days as UTC dates, like the bot's records, and match times in the reader's own time. A match
  counts on the day it ended. Win rates and sides only cover matches the bot recorded since it started keeping each
  player's side.

## Development

```bash
npm test    # Node's built-in test runner; no dependencies to install
```

The formatting and state logic is in `public/js/format.js` and is what the tests cover. `live.js` fetches the bot's
numbers for every page, `views.js` has the DOM pieces they share, `app.js` renders the home page, `matches.js` the
matches page, `players.js` the players page and `player.js` a player's page. `charts.js` draws the SVG charts and
`demo.js` makes the sample data.
