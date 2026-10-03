# gaminginit

The website for the gaminginit gaming community, at [gaminginit.com](https://gaminginit.com): a Discord invite, and
live status and stats for our WARDOGS server. The live numbers come from
[wardogs-discord-bot](https://github.com/ParagonJenko/wardogs-discord-bot), which reads the game server's RCON once
a minute and serves them at `GET /api/stats`.

What it shows:

- The home page (`/`):
  - Server status (live, seeding, empty or offline), players online, map and score. While seeding it says how many
    more players are needed to go live.
  - Discord member and online counts.
  - A first look at the other pages, each linking to its page: the match on now with its top 3, the 2 latest matches
    with winner, length, peak players and top player, the top 5 by kills over the last 30 days, and players over the
    last 24 hours with the peak, matches and time live.
  - "Play with us": the steps to find us in game.
- A stats page (`/stats`): players now, the peak and the matches in the last 24 hours and time live today; players
  over the last 24 hours, and the daily peak for the last 14 days. Each chart has a table view.
  It also has the busy times of day: average players in each hour, with the busy hours highlighted. An hour is busy
  when the server had 97+ players (the bot's `thresholds.busy`) at least half the time. Over the last 14 days when the
  bot sends `hourly` with `busy`, otherwise over the last 24 hours. The bot takes each hour from its median day of the
  14, so one bad day, like a quiet evening, does not take an hour off the busy times, and it leaves crashes out until
  the players are back.
- A matches page (`/matches`) with the last 10 matches, each with its top 5.
- A teams page (`/teams`): which team wins most over the last 30 days. The matches, the team with the most wins and
  the latest winner's streak; each team's wins, win rate and matches played; each map's matches split by the team
  that won them, with draws and the average length (also as a table); and the closest finish and the biggest win.
  Teams are in their colour in game; teams without one get colours checked to tell apart for colour-blind readers.
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
- A seeding page (`/seeding`): what seeding is: the empty, seeding and live states with the bot's player thresholds,
  and how to help. Then our seeders: the top seeders over the last 30 days, and who has seeder VIP now and until when
  (only VIP from seeding, not from staff).
- Seeder VIP: what seeding earns (a reserved slot), under the intro and as step 4 of "Play with us".
  Shown only when the bot has automatic VIP on, and worded from the bot's rule, so it always matches what the bot does.
- A staff page (`/admin`), for staff only: they sign in with Discord. See [Staff page](#staff-page).

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
  The staff page needs a bot that serves `/auth/login` and `/api/admin/overview`, with staff sign-in set up (its
  README, "Staff page").
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

Edit `public/index.html`, and the other pages in `public/` (`stats.html`, `matches.html`, `teams.html`, `live.html`, `leaderboard.html`, `players.html`, `player.html`, `seeding.html` and `admin.html`) where it says so:

| What            | Where                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Stats URL       | `<meta name="stats-url" content="…">`: set it to the URL from step 1, ending in `/api/stats`. Same in all ten pages. The player pages read `/api/players` and `/api/player` from the same place, and the live page `/api/live` and its WebSocket. |
| Discord invite  | Already `https://discord.gg/qsJFYGhSJ4`: 4 places in `index.html` and 1 in each other page. If the invite changes, change all 13. Set it to never expire with no use limit: Discord invites expire after 7 days by default. |
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

**Signing in.** "Sign in with Discord" goes to the bot, which sends you to Discord, checks your roles in our server and
sends you back here. Discord only tells the bot who you are and your roles there. The page keeps the sign-in in this
browser for 8 hours; "Sign out" forgets it. Anyone else is told the page is for staff only.

**Your Steam account.** Seeder VIP and the top seeders are for the players who seed, not for staff. The first time you
sign in without a Steam account linked, the page asks for your Steam64 ID (17 digits, starting 7656119), with how to find
it: Steam's **Account details**, your profile's link when it has `/profiles/` and the number in it, or steamid.io for a
custom link. Once linked, the bot counts your time on the server as playing, not seeding: you don't earn seeder VIP or
show as a top seeder, and your player page shows no seed days. Your kills, matches and time played show as before. You
get a staff spot instead: the bot keeps you on the server's reserved list for as long as you're linked, in place of a
slot added by hand.
"Later" asks again at your next sign-in. Change it any time from "Steam: …" next to your name, or on the Admin tab.

The page has four tabs. Each says what is in it, with a count: how many are in game, and how many alerts there are.
The address keeps the tab (`/admin#alerts`, `/admin#admin`, `/admin#rotations`), so a link opens the right one. ← → move between tabs from
the keyboard.

### Players: who is on the server now

- **The server at a glance:** live, seeding or empty, the map, the players, each team's score, and when the bot last
  checked. When the bot cannot reach the server, it says so and when it last could.
- **Tiles:** players in game, how many are worth a look now, risky Steam accounts in game, and players new today.
- **The server list:** everyone in game, with their team, kills and deaths this match, time on the server today, and
  what is worth knowing: a high-risk Steam account or one worth a look, team kills and vehicle suicides today (red once
  they pass a griefing mark), new today (first time in 90 days), VIP, or banned. Players worth a look have a yellow mark
  by their name.
- **Search** by name or Steam ID, pick a **team**, **sort** by team, most kills, longest on today or name, and tick
  **Only players worth a look**. When nobody in game matches a search, "Look up" searches everyone the bot knows.
- **Act** on a player opens a menu: look up, warn, kick, move to another team, or ban. Each opens that admin tool on the
  Admin tab with the player picked, and "← Back to Players" goes back.
- On a phone each player is a small card, with Act at the top.

### Alerts: what the bot found by itself

- **How alerts work**, in three steps: the bot checks every player's Steam account as they join, and every death in
  the kill feed for team kills and vehicle suicides; the serious ones (griefing, with the player's Steam risk, and only
  the riskiest Steam accounts) go to the Discord moderation log channel as they happen; everything is listed here,
  riskiest first. An alert is a reason to look, not proof.
- **Tiles:** risky Steam accounts, players flagged for griefing, team kills and vehicle suicides in the period. The first
  two say how many of them are in game now.
- **In game first.** Risky Steam accounts and possible griefers are each in two lists: **In game now** first, as the
  players staff can still warn, kick or move, its count in yellow when there is anyone in it; then **Not in game**, for
  everyone else seen in the period, still shown in full, and left out when there is nobody in it. While the server is
  not answering, nobody is known to be in game, so each is one list. The bot lists those in game first too, so its limit of 100 never leaves one out.
- **Risky Steam accounts.** Everyone seen in the period, or in game now, whose Steam account the bot scores as high risk
  or worth a look, riskiest first: why (VAC and game bans, community and trading bans, a new account, a private profile
  or one never set up), how old the account is and when the bot checked, whether they are banned, and their
  matches, K/D, headshots and time played for scale. "How accounts are scored" lists each flag's points, as the bot
  sends them, and the note says from how many points an account is posted to the moderation log by itself. Needs the bot's `STEAM_API_KEY` (its README, "Risky Steam accounts"); without it the page says the checks
  are off.
- **Possible griefers.** From the bot's kill feed: everyone who team killed, was team killed or killed themselves, with
  flags for a day with 3 or more team kills, killing the same teammate twice or more, 2 or more suicides in a vehicle
  (crashing it, or blowing it up), or 10 or more suicides. Most flagged days first, with their matches, kills and time
  played for scale, and whether they are banned. "Incidents" shows a player's team kills and vehicle suicides.
- **Team kills and vehicle suicides.** Each one: when, who, which teammate, with what, how far and on which map.
- Pick today, 7 days or 30 days (UTC days). Act works here too; for a player not in game it only offers look up and
  ban, as the game can only warn, kick or move players who are on.

### Admin: commands, the log, bans and VIP

- **Admin tools.** Every staff command from Discord: look up a player, warn, kick, move to another team, ban, unban,
  give or remove VIP, top seeders, message everyone in game, set the next map, change map now, call for seeders, the
  map rotations (see them and the week, swap now, pick a day's rotation, add or take out a map, save the server's
  rotation, delete one), and remove a wrongly recorded match. The forms come from the bot's own command list, and the
  pick-lists (players in game and seen lately, teams, maps, modes, lighting, zones, saved rotations, bans, the reserved
  list, recent matches) from the same suggestions Discord shows. Anything that changes the game or the records asks
  first. Each runs on the bot as you, exactly as the slash command: the same checks and replies, and it goes in the
  player's staff history and the moderation log.
- **Moderation log.** Every warning, kick, ban, unban and team move through the bot, with the reason and who did it,
  and bans made or lifted outside the bot (in game, or in the server's settings), over today, 7 days or 30 days. Each
  kind of action can be hidden (team moves, say); the page remembers what you hid in this browser.
- **Bans.** Everyone banned on the server now, the reason, who banned them, and when a timed ban ends. "Unban" opens the
  tool with them picked.
- **Reserved slots.** Everyone on the reserved list in the server's settings, with VIP from the bot and when it ends,
  or permanent (added by hand, or with `/vip add` `permanent`), and how many slots are held back for them. "Remove VIP" opens the tool with them picked.
  Staff who linked their Steam account show as **Staff spot**, since they linked, ending "While staff", with no Remove VIP:
  unlinking them takes it away.
- **Staff Steam accounts.** Every staff member who linked their Steam account, with their name in game and when they
  linked it, marked when the bot has not seen the account in the last 90 days. "Unlink" (after asking) is for someone
  who linked the wrong account or is no longer staff: their staff spot comes off the reserved list, and their time
  counts as seeding again. Needs the bot's staff Steam
  accounts (its README, "Staff Steam accounts").

### Rotations: the maps for each day

- **Today.** The rotation on the server today, and whether it came from the week or a staff member picked it; the map
  being played and the next, with their place in the rotation ("2 of 6"); and a quick swap to another rotation for the
  rest of the day.
- **Where the server is.** When a rotation's maps are the server's, in its order, its colour bar rings the map being
  played with a caret under it (in ordered play, the maps before it are dimmed), and the editor's list marks it
  **Playing now** and the one after it **Next**. The tab opens on the rotation the server is playing. Only the maps and
  their order are compared, so a map's setup (lighting, say) being reported differently doesn't hide the marks; moving
  maps around in the editor does, until it is saved and on the server.
- **The week.** A rotation for each day, Monday to Sunday. Days left on Default play **Default**, which starts as the
  rotation the server had. Changing today's pick puts it on the server straight away (after asking).
- **The editor.** Pick a rotation on the left, or start a new one. Drag Bakurani, Ozeti or Zestafona into the list
  (or tap one to add it at the end), drag maps by their ⠿ handle into order (or focus the handle and use the arrow
  keys), and open ⚙ for a map's game mode, infantry only, hardcore, lighting and control zones. A bar in the maps'
  colours shows the order at a glance. Nothing changes until **Save**; **Put on server** swaps to it for the rest of
  the day; **More** duplicates it, copies in the server's maps, or deletes it. Default can be changed but not renamed
  or deleted. Leaving the page with unsaved changes asks first.
- The bot keeps the rules (see its README, "Map rotations"): the server plays a new rotation from the next map, so a
  match is never cut short, and each day's rotation goes on at the hour shown, in your own time.

### Everywhere

- Staff are named as they go by in our Discord, with their username: "Sarge (@paragon)". The bot learns names as staff
  sign in and use its commands, and asks Discord for the rest when it has its bot token. When the bot has no name for
  someone, the page uses the name kept with their moderation log entries, if any. Anyone still without a name shows as
  "Discord user" and their ID, linked to their Discord profile.
- It refreshes every minute while the browser tab is visible, like the bot's checks. A player's Act menu stays open
  through a refresh.
- It shows Steam IDs, linked to Steam profiles. Player names link to their public player page.
- `http://localhost:3000/admin?demo` shows sample data without signing in. Its admin tools only say what they would
  do, and its rotations change in the page only.
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
stats page, `matches.js` the matches page, `teams.js` the teams page, `leaderboard.js` the leaderboard page, `seeding.js` the seeding page,
`players.js` the players page and `player.js` a player's page. `charts.js` draws the SVG charts and
`demo.js` makes the sample data. `admin.js` renders the staff page, `tools.js` its admin tools, and `rotations.js` its
Rotations tab, with `rotationmodel.js` holding the tab's logic apart from the page, for tests. `livematch.js` renders the live page, which `live.js` keeps up to date over the
bot's WebSocket, loading `/api/live` every 15 seconds while it cannot connect.
