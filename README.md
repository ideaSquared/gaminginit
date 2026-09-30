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

## Set it up

1. **Deploy the bot** and set `DISCORD_INVITE` there so it can fetch member counts. See the bot's README, section
   *Website stats*. Note the Worker's URL, e.g. `https://wardogs-discord-bot.<you>.workers.dev`.
2. **Edit `public/index.html`:**

   | What            | Where                                                                                                   |
   | --------------- | ------------------------------------------------------------------------------------------------------- |
   | Stats URL       | `<meta name="stats-url" content="…">` → your Worker URL + `/api/stats`                                  |
   | Discord invite  | Replace all 3 `https://discord.gg/YOUR-INVITE` links. Use an invite that never expires.                 |
   | Community name  | `<title>`, the `og:title` meta, the `.brand` link text and the `<h1>`                                    |
   | Intro text      | The `.lede` paragraph under the heading                                                                  |

3. **Deploy the site.** Any static host works; point it at the `public` folder.
   - **Cloudflare** (same account as the bot): `npm run deploy`. Or in the dashboard, Workers & Pages → Create →
     Pages → connect this repo, build command empty, output directory `public`.
   - **GitHub Pages**: publish the `public` folder with a Pages workflow.

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
