# gaminginit

The website for the gaminginit gaming community, at [gaminginit.com](https://gaminginit.com): a Discord invite, and
live status and stats for our WARDOGS server. The live numbers come from
[wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot), which reads the game server's RCON once
a minute and serves them at `GET /api/stats`.

What it shows, one page each:

- The home page (`/`): server status (live, seeding, empty or offline), players online, map and score, Discord
  member and online counts, and a link to each of the other pages. While seeding it says how many more players are
  needed to go live.
- A stats page (`/stats`): players now, the peak and the matches in the last 24 hours and time live today; players
  over the last 24 hours, and the daily peak for the last 14 days. Each chart has a table view.
  It also has the busy times of day: average players in each hour, with the busy hours highlighted. An hour is busy
  when the server had 97+ players (the bot's `thresholds.busy`) at least half the time. Over the last 14 days when the
  bot sends `hourly` with `busy`, otherwise over the last 24 hours.
- A matches page (`/matches`) with the last 10 matches, each with its top 5.
- A live page (`/live`) for the match on now, updated as it happens: the score, the kill feed (who killed whom, with
  what, from how far, headshots, team kills, double and triple kills, kill streaks), each player's kills, deaths and
  streak, the weapons used most, and the highlights (first blood, longest kill, best streak, who is on fire, the best
  multi-kill, most headshots and a rivalry). The bot pushes each change over a WebSocket, a second or two after the
  kill. Without the bot's kill feed it shows the score and the server's top 5, read once a minute.
- A leaderboard page (`/leaderboard`) for the last 30 days: most kills, best K/D, most time played and top seeders.
  Under it, the weapons: the 10 with the most kills over the last 30 days, each with its share of headshots, average
  distance and longest kill, plus the kills recorded, the share of headshots and the longest kill of all. From the
  game's kill feed, which the bot takes when it is set up for it; without it, the weapons stay hidden. Until the feed
  has run for 30 days, it says the day it started.
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
- A join page (`/join`): "Play with us", the steps to find us in game, then what seeding is: the empty, seeding and
  live states with the bot's player thresholds, and how to help.
- Seeder VIP: what seeding earns (a reserved slot), under the intro on the home page and as step 4 on the join page.
  Shown only when the bot has automatic VIP on, and worded from the bot's rule, so it always matches what the bot does.
- A staff page (`/admin`), for staff only: they sign in with Discord. See [Staff page](#staff-page).

These used to be sections of the home page. Old links to them, like `/#leaderboard` or `/#seeding`, go to their pages.

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
  `/api/stats` and on player pages; without it, they are not shown. The live page needs a bot that serves
  `/api/live` and its WebSocket `/api/live/socket` (its README, "Live match"), next to `/api/stats`.
  The staff page needs a bot that serves `/auth/login` and `/api/admin/overview`, with staff sign-in set up (its
  README, "Staff page").
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

Edit `public/index.html`, and the other pages in `public/` (`stats.html`, `matches.html`, `live.html`, `leaderboard.html`, `players.html`, `player.html`, `join.html` and `admin.html`) where it says so:

| What            | Where                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Stats URL       | `<meta name="stats-url" content="…">`: set it to the URL from step 1, ending in `/api/stats`. Same in all nine pages. The player pages read `/api/players` and `/api/player` from the same place, and the live page `/api/live` and its WebSocket. |
| Discord invite  | Already `https://discord.gg/qsJFYGhSJ4`: 3 places in `index.html`, 2 in `join.html` and 1 in each other page. If the invite changes, change all 12. Set it to never expire with no use limit: Discord invites expire after 7 days by default. |
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

- `http://localhost:3000/?demo` shows made-up numbers, so you can see the page before the bot is set up. On
  `http://localhost:3000/live?demo` a sample match plays itself out. Links between
  the pages keep `?demo` (and `?stats=`). `http://localhost:3000/player?demo&id=d00000000000` is a sample player.
- `http://localhost:3000/?stats=http://localhost:8787/api/stats` reads a bot running locally with `wrangler dev`.

Until the stats URL is set, the page says live stats are not connected and links to the demo.

## Staff page

`/admin` is for staff: Discord Administrators and members with a staff role in our Discord server (the bot's
`DISCORD_ADMIN_ROLE_IDS`), the same people who can use the bot's staff commands. It is linked from every page's footer
("Staff sign-in") and kept out of search results.

- **Signing in.** "Sign in with Discord" goes to the bot, which sends you to Discord, checks your roles in our server and
  sends you back here. Discord only tells the bot who you are and your roles there. The page keeps the sign-in in this
  browser for 8 hours; "Sign out" forgets it. Anyone else is told the page is for staff only.
- **Possible griefers.** From the bot's kill feed: everyone who team killed, was team killed or killed themselves, with
  flags for a day with 3 or more team kills, killing the same teammate twice or more, 2 or more suicides in a vehicle
  (crashing it, or blowing it up), or 10 or more suicides. Most flagged days first, with their matches, kills and time
  played for scale, and whether they are banned. "Incidents" shows a player's team kills and vehicle suicides.
- **Team kills and vehicle suicides.** Each one: when, who, which teammate, with what, how far and on which map.
- **Moderation log.** Every warning, kick, ban, unban and team move through the bot, with the reason and who did it,
  and bans made or lifted outside the bot (in game, or in the server's settings).
- **Admin tools.** Every staff command from Discord, from the page: look up a player, warn, kick, move to another
  team, ban, unban, give or remove VIP, top seeders, message everyone in game, set the next map, change map now, call
  for seeders, and remove a wrongly recorded match. The forms come from the bot's own command list, and the pick-lists
  (players in game and seen lately, teams, maps, modes, lighting, zones, bans, the reserved list, recent matches) from
  the same suggestions Discord shows. Anything that changes the game or the records asks first. Each runs on the bot
  as you, exactly as the slash command: the same checks and replies, and it goes in the player's staff history and the
  moderation log. "Act" on a possible griefer, "Unban" on a ban and "Remove VIP" on a reserved slot open the tool
  with that player picked.
- **Bans.** Everyone banned on the server now, the reason, who banned them, and when a timed ban ends.
- **Reserved slots.** Everyone on the reserved list in the server's settings, with VIP from the bot and when it ends,
  or added by hand, and how many slots are held back for them.
- Staff are named as they go by in our Discord, with their username: "Sarge (@paragon)". The bot learns names as staff
  sign in and use its commands, and asks Discord for the rest when it has its bot token. When the bot has no name for
  someone, the page uses the name kept with their moderation log entries, if any. Anyone still without a name shows as
  "Discord user" and their ID, linked to their Discord profile.
- Pick today, 7 days or 30 days (UTC days). It refreshes every minute while the tab is visible.
- It shows Steam IDs, linked to Steam profiles. Player names link to their public player page.
- `http://localhost:3000/admin?demo` shows sample data without signing in. Its admin tools only say what they would
  do.
- It only talks to the bot in its own `stats-url` meta tag and ignores `?stats=`, so a link can never send a staff
  member's sign-in to another site. To try it against a local bot, change the meta tag in a local copy.
- The site must be at the bot's `SITE_URL` (`https://gaminginit.com`): the bot only sends sign-ins back there, and only
  lets that site read the staff data.

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
numbers for every page, `views.js` has the DOM pieces they share, `app.js` renders the home page, `stats.js` the
stats page, `matches.js` the matches page, `leaderboard.js` the leaderboard page, `join.js` the join page,
`players.js` the players page and `player.js` a player's page. `charts.js` draws the SVG charts and
`demo.js` makes the sample data. `admin.js` renders the staff page and `tools.js` its admin tools. `livematch.js` renders the live page, which `live.js` keeps up to date over the
bot's WebSocket, loading `/api/live` every 15 seconds while it cannot connect.
