# gaminginit

The website for the gaminginit gaming community, at [gaminginit.com](https://gaminginit.com): a Discord invite, and
live status and stats for our WARDOGS server. The live numbers come from
[wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot), which reads the game server's RCON once
a minute and serves them at `GET /api/stats`.

What it shows:

- The home page (`/`):
  - Server status (live, seeding, empty or offline), players online, map and score. While seeding it says how many
    more players are needed to go live. The players bar has a mark labelled "Live at 20" (the bot's
    `thresholds.live`) where the server goes live.
  - Discord member and online counts.
  - A first look at the other pages, each linking to its page: the match on now with its top 3, the 2 latest matches
    with every side's score (the winner first and in bold), length, peak players and top player, the top 5 by kills
    over the last 30 days, and players over the last 24 hours with the peak, matches and time live.
  - "Play with us": the steps to find us in game.
- A stats page (`/stats`): players now, the peak and the matches in the last 24 hours and time live today; players
  over the last 24 hours, and the daily peak for the last 14 days. Each chart has a table view.
  The daily chart's day labels give the month on the first label and wherever the month changes ("23 Sep … 1 Oct").
  Today is not over, so its bar is dashed and lighter, and its row in the table says "so far".
  It also has the busy times of day: average players in each hour, with the busy hours highlighted. An hour is busy
  when the server had 97+ players (the bot's `thresholds.busy`) at least half the time. Over the last 14 days when the
  bot sends `hourly` with `busy`, otherwise over the last 24 hours. The bot takes each hour from its median day of the
  14, so one bad day, like a quiet evening, does not take an hour off the busy times, and it leaves crashes out until
  the players are back.
- A matches page (`/matches`) with the last 10 matches, each with every side's score, highest first, with the side
  names in their colour in game (the winner in bold, and "No result:" when the top sides were level, as teams never
  draw; a side the bot sent no colour for gets its faction's usual one), and its top 5. Each match is also a link
  target: its card has the id `match-<endedAt>`, where `<endedAt>` is the match's `endedAt` in ms as the bot sends
  it, so `/matches#match-1759300000000` scrolls to that match and outlines it. The bot's "Match over" posts in Discord
  link to it. When the match is no longer one of the last 10, the page says "That match is older than the last 10."
- A teams page (`/teams`): which team wins most over the last 30 days. The matches, the team with the most wins and
  the latest winner's streak; each team's wins and win rate (and matches played, only when the teams played different
  numbers of them); each map's matches split by the team that won them, with the average length (also as a
  table); and the closest finish and the biggest win. Teams are in their colour in game; teams without one get colours
  checked to tell apart for colour-blind readers. On the map bars each part also has its team's name (or its initial
  when it is narrow) and its count, so the colour is not the only way to tell the teams apart.
- A live page (`/live`) for the match on now, updated as it happens: the score, the kill feed (who killed whom, with
  what, from how far, headshots, team kills, double and triple kills, kill streaks), each player's kills, deaths and
  streak, the weapons used most, and the highlights (first blood, longest kill, best streak, who is on fire, the best
  multi-kill, most headshots and a rivalry). The longest kill counts hand-held weapons only, not lock-on anti-air
  launchers such as the 9K333 Verba. The bot pushes each change over a WebSocket, a second or two after the kill.
  Without the bot's kill feed it shows the score and the server's top 5, read once a minute. On a wide screen the kill
  feed scrolls inside its card; on a phone (under 900 px wide) it is a short list in the page, the latest 15 kills with
  "Show more" for 15 more at a time, so scrolling the page is never caught in a box of its own.
- A leaderboard page (`/leaderboard`) for the last 30 days: most kills, best K/D, most time played and top seeders
  (players with no seed days are left out).
  Under it, the weapons: the 10 with the most kills over the last 30 days, each with its share of headshots, average
  distance and longest kill, plus the kills recorded, the share of headshots and the longest kill of all with a
  hand-held weapon (not mines, emplacements, vehicles, anything built or lock-on launchers such as the 9K333 Verba).
  From the game's kill feed, which the bot takes when it is set up for it; without it, the weapons stay hidden. Until
  the feed has run for 30 days, it says the day it started.
- A page for every player (`/player?id=…`): player names on the leaderboard and in matches link to it. It has their time
  played, matches, kills, K/D, win rate and seed days over the last 30 or 90 days, with their place on each leaderboard
  board; whether they are in game now; seeder VIP and how close they are to earning it; personal bests (most kills and
  best K/D in a match, most kills in a day, longest kill with a hand-held weapon that does not lock on, MVPs, top-3
  finishes); their weapons (kills, headshots and longest kill with each, when the bot has the kill feed); their maps
  and sides; a calendar of their days on the server with streaks; kills in each of their last 20 matches; and their
  recent matches with the result, every side's score and their place on the scoreboard. Sides are named in their
  colour in game, from the bot's match records, lightened where needed so they read on the dark cards. Under their
  name, chips show whether they are in game or have seeder VIP, and the leaderboard places they hold in the top 10,
  under a label saying they are for the last 30 days, whichever period is chosen. Tables too wide for a small screen
  scroll inside their card.
- A players page (`/players`): who is in game now, and everyone seen in the last 90 days, with a search box to find a
  player's page. Players are known by an id the bot makes, never their Steam ID.
- Private profiles: a player staff made private (the bot's `/private add`, or Make a profile private on Moderation)
  shows as "[private profile]" everywhere on the site, with no link to a player page: the leaderboard, matches, the live
  kill feed, the seeding page and the weapons. They are left off the players page, and their player page says no player
  was found. The staff pages still show them as they are.
- A seeding page (`/seeding`): what seeding is: the empty, seeding and live states with the bot's player thresholds,
  and how to help. Then our seeders: the top seeders over the last 30 days (only players with at least one seed day),
  and who has seeder VIP now and until when (only VIP from seeding, not from staff).
- A season page (`/season`, "Season 1" in the menu, and a box under the home page's intro): the roundup of Season 1,
  from the bot's `GET /api/season`. **It stays shut until the season ends with the wipe on 15 October 2026, 00:00 UTC**
  (1am in the UK): the bot does not send the roundup to anyone before then, so the page shows a countdown and what the
  roundup will have. It loads the bot again every minute, so a page left open opens by itself, within about a minute
  of the wipe. Then it has:
  - **The Season in Review**, at the top: the season as a slideshow, like a year in review, roasting included. One
    slide at a time over the page (a full screen on a phone, a tall card on a computer): tap or click the right of a
    slide, Next, → or Space for the next one, the left, Back or ← for the one before, swipe on a phone, and Esc or ✕ to
    close. Nothing moves on its own. The server's story has the matches, players, hours and kills, the busiest day, the
    team of the season and the wooden spoon (the team with the fewest wins), the longest streak, the map played most,
    the top player of each board, the most deaths and the friendly fire award (most team kills), the role awards and
    shout-outs, the weapon of the season, and the closest and biggest wins. **Your season**: find your name and get your
    own story: hours, wins, kills and K/D, your best match, your weapon, map and side, seeding, and your places in the
    top 10s. Each joke depends on the numbers, and each player always gets the same one. The last slide shares the
    story (the phone's share sheet, or the link copied); a shared `/season?player=<id>` opens that player's story. Your
    season comes from your player page, which covers the last 90 days, so from 29 December the days at the start of
    the season drop out, and the story says from which day it counts.
  - By the numbers: matches (and their hours), players, kills and deaths from the scoreboards, time played, the peak
    and the busiest day, and seed days; and players each day as a chart, with a table view.
  - Teams: the team of the season (the best win rate from 3 matches, in its colour in game), each team's wins, losses
    and win rate, each map's wins by team as on the teams page, and the longest winning streak.
  - The hall of fame: the top 10 for most kills, best K/D (from the leaderboard's share of time played for the
    season's days), most kills in a match, most wins, most MVPs, most time played and top seeders.
  - Awards from the game's kill feed: the best at each role (assault, support, machine gun, marksman, demolitions,
    vehicle crew) with the next two, and shout-outs (headhunter, longest shot, jack of all trades, road rage, bonk,
    quickdraw and ever-present). When the feed started during the season, it says the day.
  - The weapons of the season, as on the leaderboard, and the matches to remember: the biggest win, the closest
    finish, the quickest win to the winning score, the longest match, the map played most and the busiest day.
  - **Staff preview:** staff signed in on a staff page see "Staff: see the season so far" under the countdown, which
    opens `/season?preview`: the season up to now, from the bot's `GET /api/admin/season`, so they can check the page
    before it opens. It says it is a preview, and links back to the public page. Without a sign-in, it says to sign
    in on the staff page first. `?demo` shows a sample season, and `?demo=locked` the page before it opens.
  - The season's end is set in the bot (`SEASON` in its `src/season.ts`); the page takes it from the bot.
- Seeder VIP: what seeding earns (a reserved slot), under the intro and as step 4 of "Play with us".
  Shown only when the bot has automatic VIP on, and worded from the bot's rule, so it always matches what the bot does.
- Two staff pages, for staff only: they sign in with Discord. **Moderation** (`/admin`): who is on the server, with
  anyone worth a look at the top, to act on there and then, the kill feed, what the bot flagged, any player's history
  and every staff command. **Server settings** (`/server-settings`): the bans and reserved slots, the map rotations,
  what the bot says in game and the weapon rules. See [Staff pages](#staff-pages).

The stats, matches, leaderboard, weapons and seeding used to be in full on the home page. Old links to them, like
`/#leaderboard` or `/#seeding`, go to their pages.

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
  The staff pages need a bot that serves `/auth/login` and `/api/admin/overview`, with staff sign-in set up (its
  README, "Staff page"), and for their kills and headshots `/api/admin/kills` and the live kill feed `/api/admin/live`.
  "Checked, they're fine" needs `/api/admin/check` (its README, "Checked, they're fine"); without it the button is not
  shown.
  The list of who has seeder VIP needs a bot that sends `seederVip` (its README, "Website stats"); without it, the
  list is not shown. The teams page needs a bot that sends `teams` (same section); without it, the page says so.
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

Edit `public/index.html`, and the other pages in `public/` (`stats.html`, `matches.html`, `teams.html`, `live.html`, `leaderboard.html`, `players.html`, `player.html`, `seeding.html`, `admin.html` and `server-settings.html`) where it says so:

| What            | Where                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Stats URL       | `<meta name="stats-url" content="…">`: set it to the URL from step 1, ending in `/api/stats`. Same in all eleven pages. The player pages read `/api/players` and `/api/player` from the same place, and the live page `/api/live` and its WebSocket. |
| Discord invite  | Already `https://discord.gg/qsJFYGhSJ4`: 5 places in `index.html` (one is the invite as text under the Join button) and 1 in each other page. If the invite changes, change all 15. Set it to never expire with no use limit: Discord invites expire after 7 days by default. |
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

## Staff pages

The staff pages are for staff: Discord Administrators and members with a staff role in our Discord server (the bot's
`DISCORD_ADMIN_ROLE_IDS`), the same people who can use the bot's staff commands. `/admin` is linked from every page's
footer ("Staff sign-in") and both are kept out of search results.

There are two, one for each kind of work, with a switch between them by the title:

- **Moderation** (`/admin`), the page to keep open while the server is busy: **Live** (who is on, with those worth a
  look always at the top, and every kill now), **Review** (what the bot flagged, and what staff did), **History** (any
  player's record) and **Commands** (every staff command).
- **Server settings** (`/server-settings`), for setting the server up: **Bans and VIP** (the bans, reserved slots and
  staff Steam accounts), **Rotations**, **Lines** and **Weapon rules**.

Each tab says what is in it, with a count: how many are in game, and how many flags there are. The address keeps the
tab (`/admin#review`, `/admin#history`, `/admin#commands`, `/server-settings#rotations`, `/server-settings#lines`,
`/server-settings#rules`; Live and Bans and VIP, the first tabs, have none), and on History the player shown
(`/admin#history/<Steam ID>`), so a link opens the right one, and the browser's Back goes back. Old links go where
those tabs are now: `/admin#admin` and `/server-settings#commands` to Commands, `/server-settings#admin` to Bans and
VIP, `/admin#rotations`, `#lines` and `#rules` to Server settings, `#alerts` and `#kills` to Review, and `#kills/<Steam ID>` to that player's history. ← → move between a page's tabs from the keyboard. **A player's name on Live opens a quick look
at them; anywhere else, on either page, it opens their history.**

**Signing in.** "Sign in with Discord" goes to the bot, which sends you to Discord, checks your roles in our server and
sends you back to the page you were on. Discord only tells the bot who you are and your roles there. The sign-in is
kept in this browser for 8 hours, for both pages; "Sign out" forgets it. Anyone else is told the pages are for staff
only.

**Your Steam account.** Seeder VIP and the top seeders are for the players who seed, not for staff. The first time you
sign in without a Steam account linked, the page asks for your Steam64 ID (17 digits, starting 7656119), with how to find
it: Steam's **Account details**, your profile's link when it has `/profiles/` and the number in it, or steamid.io for a
custom link. Once linked, the bot counts your time on the server as playing, not seeding: you don't earn seeder VIP or
show as a top seeder, and your player page shows no seed days. Your kills, matches and time played show as before. You
get a staff spot instead: the bot keeps you on the server's reserved list for as long as you're linked, in place of a
slot added by hand.
"Later" asks again at your next sign-in. Change it any time from "Steam: …" next to your name, or on Server settings'
Bans and VIP tab.

### Moderation: Live, the server, who is on and every kill now

- **Side by side.** On a wide screen (1440 pixels and up) the staff pages use more of it, and the kill feed sits beside
  the server list, staying in view as the list scrolls, with Joins and leaves under the list. Narrower, they are one
  above the other.
- **The server at a glance:** live, seeding or empty, the map, the players, each team's score, and when the bot last
  checked. When the bot cannot reach the server, it says so and when it last could.
- **The server list:** everyone in game, with their team, kills and deaths this match, time on the server today, and
  what is worth knowing: banned, team kills and vehicle suicides today (red once they pass a griefing mark), today's
  headshots when they are unlikely by luck (yellow below 1 in 20, red once the day is flagged; hover for their usual
  and the chance), a high-risk Steam account or one worth a look, new today (first time in 90 days), or VIP. Players
  worth a look (banned, flagged for griefing or headshots today, or a risky Steam account) have a yellow mark by their
  name. Being new is shown, but is no reason to look on its own.
- **Worth a look now, always at the top.** The list is in two parts: **Worth a look now** first, with its count in
  yellow when there is anyone in it, and then **Everyone else**. Whatever the order picked, a flagged player is never
  further down; when nobody is worth a look, the first part says so. Someone who became worth a look since the page
  loaded is marked **Just flagged** for 5 minutes.
- **One click for those worth a look:** **Warn** and **Kick** open that tool over the page with them picked, and
  **Checked, they're fine** is for a player you looked at and found nothing to act on. It moves them to Everyone else,
  for all staff, with "✓ Checked by Sarge 4 min ago", until the end of the UTC day, or until more comes up (another
  team kill or vehicle suicide, or a new flag): then they come back to the top, saying they were checked before. Act's
  **Take back the check** puts them back straight away. Needs a bot that keeps checks (its README, "Checked, they're
  fine"); with an older one the button is not there.
- **What staff did.** A player warned, kicked, banned or moved in the last day says so, with the latest: "Warned 4 min
  ago by Sarge", and how many in all when more than one. So two staff don't act on the same thing.
- **Search** by name or Steam ID, pick a **team**, **sort** by worth a look first, team, most kills, longest on today or
  name, and tick **Only players worth a look** to leave out everyone else. The search, team and order apply to both
  parts. It opens sorted by **Worth a look first**: banned players, then those flagged for griefing today with the
  most team kills first, then flagged headshots, then high-risk and risky Steam accounts, then anyone else with team
  kills or vehicle suicides today, then the rest by team. When nobody in game matches a search, "Find" searches
  everyone the bot knows on the History tab. **Compact rows** leaves out the Steam ID under each name, in the list and
  the kill feed (hover a name for it), and fits more players on the screen; the page remembers it in this browser.
- **Alerts.** The browser tab's title says how many in game are worth a look now: "(3) Moderation | …". Tick **Alert me
  when someone new is worth a look** for a chime when someone becomes worth a look, and a desktop notification while
  the page's tab is in the background (once the browser is allowed to show them; it asks when you tick it). Clicking
  the notification opens a quick look at them. With alerts on, the page keeps checking every minute while its tab is in
  the background (the kill feed still closes); without, it stops until you come back. Browsers only play sound after a
  click on the page, so after a reload, click anywhere once. The page remembers it in this browser.
- **A quick look.** Click a player's name in the list, the kill feed or Joins and leaves for a panel at the side (the
  whole screen on a phone): whether they are in game and on which team, what is worth knowing, their kills and deaths
  this match, time on today, team kills, vehicle suicides and headshots today, the latest staff actions on them in the
  period, and their latest kills and deaths in the kill feed. Its buttons warn, kick, move or ban them, check them,
  show only them in the kill feed, or open their **Full history**. It keeps up with each refresh and each kill of theirs
  while open; Close, Escape or a click outside it closes it.
- **Act** on a player opens a menu: their history, only them in the kill feed, warn, kick, move to another team, ban,
  make their profile private, and "Checked, they're fine" or taking it back. History opens the History tab. Warn, kick,
  move, ban and private open that admin tool over the page, with the player picked, so you never leave the list: fill
  it in, run it, and close it (or Escape) to be back on the same player. It can switch to any other tool for a player,
  such as Look up or Give VIP. Every other command is on the Commands tab.
- **Reasons to pick.** Warn, Kick and Ban have buttons for the usual reasons (team killing, team vehicles, toxic chat,
  racism, and for kicks and bans cheating and ignoring warnings), which fill in the message or reason to change before
  sending. They are `PRESET_REASONS` in `format.js`. On the Commands tab too.
- **Kill feed.** The server's latest 250 kills, newest first, to the second, as they happen: the bot sends each batch
  from the game a second or two after the kills, and new ones glow as they come in. Each has when (just the time for a
  kill from today, with the date too for an older one; hover for both), who, whom, with what, headshot, team kill,
  wallbangs and the like, how far and on which map, which is only shown when it differs from the kill above, as the
  server stays on one map for a long run of kills. A weapon the bot has no name for is marked
  **Check name** (see Weapons to name, on Review). **Only team kills** and **Only headshots** hide the rest (tick both
  for team kills by headshot): Only team kills is for watching a player someone in game says is team killing. **Only
  them in the kill feed**, from Act or a quick look, shows one player's kills and deaths, as they happen, until **Show
  everyone**. By its title:
  **Live**, **Reconnecting…** (it tries again by itself, waiting longer each time), or **Every minute** when the live
  feed can't be reached and the kills come with each refresh instead. It closes while the browser tab is hidden, and
  opens again with the latest kills.
- **Joins and leaves.** Who joined and left the server, newest first: the latest 500, each with when, the player, and
  for someone who left, how long they were on. From the bot's check each minute, so each shows up to a minute late, and
  someone on for less than a minute between two checks is missed. After the bot could not read the server for a while,
  a join or leave also says "since" the check before, as it happened some time between the two. Players already on when
  the bot started keeping the log show "–" for their time on. Hidden while the bot does not send it.
- On a phone each player in the server list is a small card, with Act at the top and the one-click buttons under what
  is worth knowing.

### Moderation: Review, what the bot flagged, and what staff did

- **How flags work**, in three steps: the bot checks every player's Steam account as they join, and every kill in the
  kill feed for headshots, team kills and vehicle suicides; the serious ones (griefing, with the player's Steam risk,
  and only the riskiest Steam accounts) go to the Discord moderation log channel as they happen; everything is listed
  here, those in game first and the rest folded under Not in game. A flag is a reason to look, not proof. Open the
  first time; folded away from the next visit, unless you leave it open (remembered in this browser).
- **Tiles:** players flagged for headshots, risky Steam accounts, players flagged for griefing, and team kills (with a
  vehicle, in a helicopter crash, and vehicle suicides) in the period. The first three say how many of them are in game now.
- **In game first.** Each list is in two parts: **In game now** first, as the players staff can still warn, kick or
  move, its count in yellow when there is anyone in it; then **Not in game**, for everyone else in the period, as a
  dropdown with its count, closed until staff open it (it stays open through refreshes until they close it), and left
  out when there is nobody in it. While the server is not answering, nobody is known to be in game, so each is one list.
  The bot lists those in game first too, so its limit of 100 never leaves one out.
- **Headshots.** Many headshots, day after day, can be a sign of cheating. The players with a headshot in the period,
  most flagged days first, then least likely by luck: their headshots of their kills, **Usual** (how many a player with
  the server's usual aim would get with the same weapons), **Chance by luck** (how often that player would get as many
  or more: "1 in 4,800", or "Ordinary" for 1 in 20 or likelier) and the weapon they killed most with. Most players are
  Ordinary, so those with an Ordinary chance and no flagged day are hidden, in both parts, until staff tick **Show
  ordinary players (N)**, N being how many there are (the box is left out when there are none). The tiles and the
  tab's count still go by everyone. A day is flagged with 10 or more kills and a chance below 1 in 1,000, as the bot
  sends the marks. Usual goes by weapon: a sniper rifle gets more headshots than a machine gun, so a sniper is not
  flagged for sniping. "How headshots are judged" explains it. Needs the bot's kill feed (its README, "Weapon stats" and
  "Kills and headshots").
- **Weapons to name.** The game sends the bot a code for each weapon, not its name, and the bot names the ones it
  knows. The rest show as their code, like "WEPN 099": over the last 30 days, most kills first, with their kills, longest
  kill, the last day used and who used them most, those in game first. The game's own kill feed names them, so staff
  can watch one of those players, or match a kill marked Check name in the kill feed with the same kill in game, and
  tell whoever runs the bot. Left out when there are none, or the bot does not send them.
- **Risky Steam accounts.** Everyone seen in the period, or in game now, whose Steam account the bot scores as high risk
  or worth a look, riskiest first: why (VAC and game bans, community and trading bans, a new account, a private profile
  or one never set up), how old the account is and when the bot checked, whether they are banned, and their
  matches, K/D, headshots and time played for scale. "How accounts are scored" lists each flag's points, as the bot
  sends them, and the note says from how many points an account is posted to the moderation log by itself. Needs the bot's `STEAM_API_KEY` (its README, "Risky Steam accounts"); without it the page says the checks
  are off.
- **Possible griefers.** From the bot's kill feed: everyone who team killed, was team killed or killed themselves, with
  flags for a day with 3 or more team kills, killing the same teammate twice or more, 2 or more suicides in a vehicle
  (crashing it, or blowing it up), or 10 or more suicides. Teammates killed in a helicopter crash show in the team
  kills ("crash") but count towards no flag, as pilots crash by accident; a pilot who crashes twice in a day is still
  flagged for vehicle suicides. Most flagged days first, with their matches, kills and time
  played for scale, and whether they are banned. "Incidents" shows a player's team kills and vehicle suicides.
- **Team kills and vehicle suicides.** Each one: when, who, which teammate, with what, how far and on which map.
- **Moderation log.** Every warning, kick, ban, unban, team move and VIP added or removed through the bot, with the
  reason and who did it (VIP added: Friend, Regular, Seeder, Paid or Other, and any note; VIP removed: any reason given),
  and bans made or lifted outside the bot (in game, or in the server's settings). Each kind of action can be hidden
  (team moves, say); the page remembers what you hid in this browser.
- Pick today, 7 days or 30 days (UTC days). Act works here too; for a player not in game it only offers their history,
  ban and making their profile private, as the game can only warn, kick or move players who are on.

### Moderation: History, any player's record

- **Find a player** by name or Steam ID: anyone in game, seen in the last 30 days, banned or with VIP, from the same
  suggestions as the admin tools. A Steam ID can always be opened. Or click any name on the page.
- **The player:** a link to their public player page and their Steam profile, whether they are in game or banned, their
  headshot flags and griefing flags, and Act.
- **Record:** time played and seeding over the last 90 days, their team kills today (UTC), their Steam account, VIP,
  ban and staff history, exactly as the Look up tool (and `/player` in Discord) shows them.
- **Time on the server** in the period: each time they were on, newest first, with when they joined, when they left
  (or "In game now") and how long, and how many times and how long in all. From the bot's check each minute, like
  Joins and leaves on Live, so a time "since" another means the bot couldn't read the server in between, and "Already
  on" that they were on when the bot started keeping the log. The bot keeps 30 days. Hidden while the bot does not send
  it.
- **Kills and headshots** in the period: their headshots in words, against their usual and the chance by luck; by
  weapon; by day, with each flagged day marked; and every kill, newest first (their latest 1,000 a day), with **Only
  headshots**, and the time, date and map shown as in the kill feed. The names of those they killed open those players'
  history.
- **Team kills and vehicle suicides** in the period: their totals, and each one they made or were killed in, from the
  latest 300 in the period.
- Pick today, 7 days or 30 days (UTC days). Their kills refresh with the page; their record loads each time they are
  opened. The kills start from when the bot first kept them, and it keeps 30 days.

### Moderation: Commands, every staff command

- Every staff command from Discord: look up a player, warn, kick, move to another team, ban, unban,
  make a profile private or public again and see the private profiles, give or remove VIP, top seeders, message everyone in game, set the next map, change map now, call for seeders, the
  map rotations (see them and the week, swap now, pick a day's rotation, add or take out a map, save the server's
  rotation, delete one), and remove a wrongly recorded match. The forms come from the bot's own command list, and the
  pick-lists (players in game and seen lately, teams, maps, modes, lighting, zones, saved rotations, bans, the reserved
  list, recent matches) from the same suggestions Discord shows. Anything that changes the game or the records asks
  first. Each runs on the bot as you, exactly as the slash command: the same checks and replies, and it goes in the
  player's staff history and the moderation log. To warn, kick or move someone in game, Act on Live is quicker.

### Server settings: Bans and VIP

- **Bans.** Everyone banned on the server now, the reason, who banned them, and when a timed ban ends. "Unban" opens the
  tool over the page with them picked, as Act does on Moderation.
- **Reserved slots.** Everyone on the reserved list in the server's settings, with VIP from the bot and when it ends,
  or permanent (added by hand, or with `/vip add` `permanent`), and how many slots are held back for them. "Remove VIP" opens the tool with them picked, the same way.
  Staff who linked their Steam account show as **Staff spot**, since they linked, ending "While staff", with no Remove VIP:
  unlinking them takes it away.
- **Staff Steam accounts.** Every staff member who linked their Steam account, with their name in game and when they
  linked it, marked when the bot has not seen the account in the last 90 days. "Unlink" (after asking) is for someone
  who linked the wrong account or is no longer staff: their staff spot comes off the reserved list, and their time
  counts as seeding again. Needs the bot's staff Steam
  accounts (its README, "Staff Steam accounts").

### Server settings: Rotations, the maps for each day

A tab with changes not saved yet (Rotations, Lines or Weapon rules) has a yellow dot by its name, so they are not
forgotten while on another tab.

- **Today.** The rotation on the server today, and whether it came from the week or a staff member picked it; the map
  being played and the next, with their place in the rotation ("2 of 6"); and a quick swap to another rotation for the
  rest of the day.
- **Where the server is.** When a rotation's maps are the server's, in its order, its colour bar rings the map being
  played with a caret under it (in ordered play, the maps before it are dimmed), and the editor's list marks it
  **Playing now** and the one after it **Next**. The tab opens on the rotation the server is playing. Only the maps and
  their order are compared, so a map's setup (lighting, say) being reported differently doesn't hide the marks; moving
  maps around in the editor does, until it is saved and on the server.
- **The week.** A rotation for each day, Monday to Sunday. Days left on Default play **Default**, which starts as the
  rotation the server had. Changing today's pick puts it on the server straight away (after asking). Each day shows
  its rotation's full name, wrapping onto more lines in a narrow card rather than cut off.
- **The editor.** Pick a rotation on the left, or start a new one. Drag Bakurani, Ozeti or Zestafona into the list
  (or tap one to add it at the end), drag maps by their ⠿ handle into order (or focus the handle and use the arrow
  keys), and open ⚙ for a map's game mode, infantry only, hardcore, lighting and control zones. A bar in the maps'
  colours shows the order at a glance. Nothing changes until **Save**; **Put on server** swaps to it for the rest of
  the day; **More** duplicates it, copies in the server's maps, or deletes it. Default can be changed but not renamed
  or deleted. Leaving the page with unsaved changes asks first.
- The bot keeps the rules (see its README, "Map rotations"): the server plays a new rotation from the next map, so a
  match is never cut short, and each day's rotation goes on at the hour shown, in your own time.

### Server settings: Lines, what the bot says in game

- **The lists.** The bot's messages in game each pick a line at random from a list: seeding, welcome (the basic rules,
  sent privately to each player who joins), 10 minutes in, and for halfway and nearly won, one list for each faction
  plus level scores and any other team. Pick a list on the left; each
  says how many lines it has and whether staff changed it or it is the bot's own.
- **The editor.** Change a line, take it out (×), or add one (**+ Add a line**, or Enter in a line to add one after
  it). The buttons under "Filled in by the bot" put a placeholder such as `{score}` where the cursor is, and show what
  the bot fills it in with now.
- **In game.** The message as it goes out, for the line you are on: what the bot adds before and after the line (such
  as "Halfway there!" and the seeding call to action) is dimmed. Each line counts the whole message against the game's
  200 characters, with `{score}` and `{team}` at the longest they can be when it goes out (the halfway score up to the
  winning score, a team name up to 16 characters), so the count can be more than the preview shows. A line that is too long, or has a placeholder the bot can't fill in there, is marked and can't be
  saved.
- Nothing changes until **Save**; the next message of that kind uses the new lines. **Use the bot's lines** puts the
  bot's own back. Each list says who changed it last and when. Leaving with unsaved changes asks first.
- A list that is marked "too long or wrong" was fine when it was saved, but the bot's settings changed since (its
  website, seeder VIP or the winning score). The bot cuts such a line short until it is changed.

### Server settings: Weapon rules, weapons the bot warns or kicks for

- **The rules.** Each rule is a name, its weapons, and what the bot does when someone kills with one of them: **Off**,
  **Warn** (a private message in game, each time), **Warn, then kick** (warnings for their first 1 to 5 offences of the
  day, then a kick for each one after) or **Kick**. The bot starts with three, all off: **Humvee gunner** (the Humvee's
  M249 and minigun), **Kodiak gunner** (the Kodiak's M249) and **MGL** (the MGL-40). Pick a rule on the left; each
  shows its weapons, its mode and what the bot did for it today.
- **The editor.** Click a mode to switch it. Add weapons from "Add a weapon…" (a weapon in another rule is greyed out
  with that rule's name) and take them out with ×. Write the warning and the kick reason; the one a mode doesn't use is
  dimmed and kept for later.
- **In game.** Each message as it goes out, with what the bot adds dimmed: "Warning:" (with warn, then kick, "Warning 1
  of 2:" and "Last warning:") before the warning, and where the rules are after both. The count is the characters you
  typed against the most there is room for.
- Nothing changes until **Save**; the bot uses the rule from the next kill. **+ New rule** adds one, **Take out**
  removes one. Leaving with unsaved changes asks first.
- Kills within 30 seconds of the bot acting are one offence, and offences start again each day (UTC). Every warning
  and kick goes in the moderation log, done by the bot. The bot's README, "Weapon rules", has the details.

### Everywhere

- Staff are named as they go by in our Discord, with their username: "Sarge (@paragon)". The bot learns names as staff
  sign in and use its commands, and asks Discord for the rest when it has its bot token. When the bot has no name for
  someone, the page uses the name kept with their moderation log entries, if any. Anyone still without a name shows as
  "Discord user" and their ID, linked to their Discord profile.
- Each page refreshes every minute while the browser tab is visible, like the bot's checks, and the kill feed as kills
  happen. A player's Act menu stays open through a refresh, and so does a tool opened from it.
- Times are in your own time and clock: "7:00 PM" on a 12-hour clock (no leading zero), "07:00" on a 24-hour one.
- They show Steam IDs, linked to Steam profiles. Player names open their history, on Moderation; History links to their
  public player page.
- `?demo` adds a sample kill to the kill feed every few seconds, as if the server were busy.
- `http://localhost:3000/admin?demo` and `http://localhost:3000/server-settings?demo` show sample data without signing
  in. Their admin tools only say what they would do, and the rotations, lines and weapon rules on Server settings change
  in the page only.
- They only talk to the bot in their own `stats-url` meta tag and ignore `?stats=`, so a link can never send a staff
  member's sign-in to another site. To try them against a local bot, change the meta tag in local copies.
- The site must be at the bot's `SITE_URL` (`https://gaminginit.com`): the bot only sends sign-ins back there, and only
  lets that site read the staff data.

## How it behaves

- Fetches the stats every 60 seconds, and only while the tab is visible. The bot's numbers change once a minute.
- If the bot has not read the server for 3 minutes, the server shows as **Offline** with when it was last seen.
- If a refresh fails, the page keeps the last numbers and says it is retrying.
- Notices ("Live stats are not connected yet", the retrying one and the `?demo` one) show right under the header on
  every page, the home page too. The [notice for everyone](#notice-for-everyone) shows above them.
- On a phone the home page's hero is shorter (less copy, a smaller Seeder VIP box and no Server status button), so the
  server card is on the first screen.
- Each page other than the home page has a "← Home" link at the top. A player's page has "← All players".
- Player and server names are inserted as text, never as HTML.
- Times of day follow the reader's locale: no leading zero on a 12-hour clock ("7:00 PM"), two digits on a 24-hour one
  ("07:00"). A range says AM or PM once when both ends share it ("7:00 – 10:00 PM").
- Charts work with a keyboard: tab to the 24-hour chart and use ← →, Home and End; tab through the daily bars, and the
  season page's days. On a player page, tab to the calendar and use ← → for weeks and ↑ ↓ for days, or to the kills
  chart and use ← →.
- Player pages are marked `noindex`, so search engines leave individual players out. The players page is indexed.
- A player page shows days as UTC dates, like the bot's records, and match times in the reader's own time. A match
  counts on the day it ended. Win rates and sides only cover matches the bot recorded since it started keeping each
  player's side.

## Development

```bash
npm test    # Node's built-in test runner; no dependencies to install
```

The formatting and state logic is in `public/js/format.js` and is what the tests cover. `live.js` fetches the bot's
numbers for every page and the notice in `announcement.json`, `views.js` has the DOM pieces they share, `app.js` renders the home page, `stats.js` the
stats page, `matches.js` the matches page, `teams.js` the teams page, `leaderboard.js` the leaderboard page, `seeding.js` the seeding page,
`players.js` the players page, `player.js` a player's page and `season.js` the season page, with `wrapped.js` making its
Season in Review's slides (and their jokes) and `story.js` showing them. `charts.js` draws the SVG charts and
`demo.js` makes the sample data. `session.js` keeps the staff sign-in, for the staff pages and the season page's staff
preview. `staff.js` has what the two staff pages share: signing in, the Steam account, Act and loading the bot's staff
overview. `admin.js` renders the Moderation page (its live kill feed and History too),
`settings.js` the Server settings page, `tools.js` the admin tools (on Commands, and over either page from Act), and
`rotations.js` the Rotations tab, with `rotationmodel.js` holding the tab's logic apart from the page, for tests. `lines.js` renders the
Lines tab, with `linesmodel.js` holding its logic, for tests. `rules.js` renders the Weapon rules tab, with
`rulesmodel.js` holding its logic, for tests. `livematch.js` renders the live page, which `live.js` keeps up to date over the
bot's WebSocket, loading `/api/live` every 15 seconds while it cannot connect.
