# gaminginit

The website for the gaminginit gaming community, at [gaminginit.com](https://gaminginit.com): a Discord invite, and
live status and stats for our WARDOGS server. The live numbers come from
[wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot), which reads the game server's RCON once
a minute and serves each community's at `GET /t/<community>/api/stats`.

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
- A page for every player (`/player?id=…`): player names on the leaderboard and in matches link to it. It has their
  time played, matches, kills, K/D, win rate and seed days over the last 30 or 90 days, with their place on each
  leaderboard board; whether they are in game now; seeder VIP and how close they are to earning it; personal bests
  (most kills and best K/D in a match, most kills in a day, MVPs, top-3 finishes); their maps and sides; a calendar of
  their days on the server with streaks; kills in each of their last 20 matches; and their recent matches with the
  result, every side's score and their place on the scoreboard. Sides are named in their colour in game, from the
  bot's match records, lightened where needed so they read on the dark cards.
- A players page (`/players`): who is in game now, and everyone seen in the last 90 days, with a search box to find a
  player's page. Players are known by an id the bot makes, never their Steam ID.
- Seeder VIP: what seeding earns (a reserved slot), under the intro and as step 4 of "Play with us". Shown only
  when the bot has automatic VIP on, and worded from the bot's rule, so it always matches what the bot does.
- What seeding is: the empty, seeding and live states with the bot's player thresholds, and how to help.

Plain HTML, CSS and JavaScript. No build step, no framework, no third-party requests.

**One deployment serves the website of any number of communities**, each on its own domain, with its own name, Discord
invite and stats from the bot (see [Communities](#communities)).

## Communities

Every community the site serves is in `src/communities.json`, by the same id it has on the bot:

```json
{
  "gaminginit": {
    "name": "gaminginit",
    "wordmark": ["gaming", "init"],
    "origin": "https://gaminginit.com",
    "hosts": ["gaminginit.com", "www.gaminginit.com"],
    "discordInvite": "https://discord.gg/qsJFYGhSJ4",
    "ogImage": "https://gaminginit.com/og-image.png"
  }
}
```

| Field           | What                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------- |
| `name`          | The community's name: page titles, link previews, the "Join the … Discord" step               |
| `origin`        | Its main address, `https://` and the domain only: canonical links, the sitemap and `robots.txt` |
| `hosts`         | Every domain it is served on. A domain can belong to one community only                       |
| `discordInvite` | Its Discord invite, set to never expire with no use limit                                     |
| `wordmark`      | Optional: the name in two parts, plain and coloured, for the logo. Default: the name in one colour |
| `ogImage`       | Optional: an `https://` image (1200×630) for link previews. Without one, previews have no image |
| `lede`          | Optional: the intro paragraph under the heading, in place of gaminginit's                     |
| `statsUrl`      | Optional: where its stats are, if not `<BOT_URL>/t/<id>/api/stats`                            |

To add a community:

1. Add it on the bot first (`npm run tenant -- add <id> <discord server id>` in wardogs-discord-bot), so its stats
   exist at `<BOT_URL>/t/<id>/api/stats`.
2. Add it to `src/communities.json` and run `npm test`: it checks every entry, and that no domain belongs to two
   communities.
3. Deploy (`npm run deploy`, or push to `main` with option B below).
4. Attach its domain to the Worker: **Workers & Pages** → `wardogs-community-site` → **Settings** → **Domains &
   Routes** → **Add** → **Custom domain**. The domain must be on the Cloudflare account.

Before the domain is set up, preview it on the workers.dev address with `?community=<id>`.

How it works:

- A small Worker (`src/worker.js`) answers each page: it picks the community by the domain the request came to, then
  puts its name, Discord invite, stats URL, canonical links and link-preview details into the page as it is sent. Link
  previews and search engines read those without running any JavaScript, so each community's are its own.
- A domain that is not in `src/communities.json` gets a 404, never another community's page.
- Only pages go through the Worker. Scripts, styles and images are served straight from the static assets, free and
  unlimited (`run_worker_first` in `wrangler.jsonc`).
- `?stats=` and `?community=` only work on the workers.dev address and `localhost`. On a community's own domain the page
  always shows that community's stats, so nobody can send a link to one community's site that shows other numbers.

## Deploy

You need:

- [Node.js](https://nodejs.org) 22 or newer.
- A free Cloudflare account. Use the same one as the bot.
- The bot deployed with per-community stats at `/t/<id>/api/stats` (wardogs-discord-bot with several communities).
  Deploy the bot before the site: an older bot only has `/api/stats`. The leaderboard and VIP
  sections need a bot that sends `leaderboard` and `vip`; with an older bot the page still works without them.
  The player pages need a bot that serves `/api/players` and `/api/player`, next to `/api/stats`; with an older bot,
  names are not links and the players page cannot load.
  The 14-day busy times need `hourly`: `{ "days": 14, "players": [24 numbers], "busy": [24 numbers] }`, for each UTC
  hour (0 to 23) over those days the average players and the share of readings (0 to 1) with `thresholds.busy`
  players or more, `null` for an hour with no readings.

### 1. Get the bot's stats URL

1. In the `wardogs-discord-bot` folder, deploy the bot if you have not already:
   ```bash
   npm run deploy
   ```
2. Wrangler prints the bot's URL, like `https://wardogs-discord-bot.<your-subdomain>.workers.dev`.
3. Open that URL with `/t/<community id>/api/stats` on the end in a browser. You should see JSON. `"server": null` is fine until the
   bot has run its first check (within a minute).

### 2. Point the site at the bot

In `wrangler.jsonc`, set `BOT_URL` to the bot's URL from step 1 (without `/api/stats`). Each community's stats are read
from `<BOT_URL>/t/<id>/api/stats`, and the player pages from `/t/<id>/api/players` and `/t/<id>/api/player` next to it.
`DEFAULT_COMMUNITY` is the community the workers.dev address shows.

Then add each community to `src/communities.json` (see [Communities](#communities)).

The pages themselves (`public/*.html`) are gaminginit's, which is what `npm start` shows. The Worker swaps in each
community's name, invite and stats URL; the `stats-url` meta in each page is only used without the Worker.

Commit and push the change to `main` if you will use option B below.

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

GitHub Pages only serves files, without the Worker, so it shows one community: the one the pages are written for
(gaminginit), with the `stats-url` in each page. For several communities, use option A or B.

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
| "Live stats are not connected yet"                        | `BOT_URL` is not set in `wrangler.jsonc`. Do step 2, then deploy again.                       |
| "There is no community site at this address"              | The domain is not in any community's `hosts` in `src/communities.json`.                       |
| "Could not load the live stats"                           | The stats URL is wrong or the bot is not deployed. Open the URL directly; it must show JSON.  |
| Status **Waiting**                                        | The bot is deployed but has not checked the game server yet. Wait a minute.                   |
| Status **Offline**                                        | The bot cannot reach the game server. Check the bot's logs in Cloudflare.                     |
| No Discord member count under the buttons                 | `DISCORD_INVITE` is not set for the community on the bot (`/settings set`), or the bot has not refreshed yet (every 10 min). |

Serving the site's scripts, styles and images is free and unlimited on Cloudflare. Each page view is one request to
the site's Worker, and the stats it loads count towards the bot's requests. On the free plan both share the account's
100,000 requests a day, so a site serving several busy communities, or a bot hosting other communities, belongs on the
Workers Paid plan (see the bot's README).

## Try it locally

```bash
npm start                      # serves public/ on http://localhost:3000, as gaminginit's site
npm run dev                    # runs the Worker on http://localhost:8787: ?community=<id> shows any community
```

- `http://localhost:3000/?demo` shows made-up numbers, so you can see the page before the bot is set up. Links between
  the pages keep `?demo` (and `?stats=`). `http://localhost:3000/player?demo&id=d00000000000` is a sample player.
- `http://localhost:3000/?stats=http://localhost:8787/t/gaminginit/api/stats` reads a bot running locally with
  `wrangler dev`. `?stats=` only works on `localhost` and workers.dev addresses.

Until the stats URL is set, the page says live stats are not connected and links to the demo.

## How it behaves

- Fetches the stats every 60 seconds, and only while the tab is visible. The bot's numbers change once a minute.
- If the bot has not read the server for 3 minutes, the server shows as **Offline** with when it was last seen.
- If a refresh fails, the page keeps the last numbers and says it is retrying.
- Player and server names are inserted as text, never as HTML. So are community names and intros from
  `src/communities.json`.
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

The formatting and state logic is in `public/js/format.js`, and choosing and branding each community is in
`src/site.js`; those are what the tests cover, with a check of `src/communities.json`. `src/worker.js` serves the pages. `live.js` fetches the bot's
numbers for every page, `views.js` has the DOM pieces they share, `app.js` renders the home page, `matches.js` the
matches page, `players.js` the players page and `player.js` a player's page. `charts.js` draws the SVG charts and
`demo.js` makes the sample data.
