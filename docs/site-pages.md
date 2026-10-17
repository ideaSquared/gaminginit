# Site pages

What each page of the site shows, and how the site behaves. Back to the [README](../README.md).

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
  The game says where the match is through the kill feed: under the score it says "Starting soon" before a match
  starts and "Match over" after, and once the game sends the result, who won ("Lonestar won"), the final score and
  how long ago it ended. An ended match stays up until the next one starts.
  Without the bot's kill feed it shows the score and the server's top 5, read once a minute. On a wide screen the kill
  feed scrolls inside its card; on a phone (under 900 px wide) it is a short list in the page, the latest 15 kills with
  "Show more" for 15 more at a time, so scrolling the page is never caught in a box of its own.
- A leaderboard page (`/leaderboard`) for the last 30 days: most kills, best K/D (from the bot's number of matches,
  10), most time played and top seeders (players with no seed days are left out).
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
- A vote page (`/vote`): the next map, voted on by whoever visits. The bot opens a vote when a match goes live, with a few
  random maps (never the one playing or one of the last few played); the page shows each map's votes and share, and a countdown, refreshed every 5 seconds. Tap a map to vote,
  and tap another to change it until the vote closes. When it closes, the winner is put on the server as the next map,
  infantry only, and the page says so; with no votes, or if staff picked a map meanwhile, it says why nothing changed.
  There is no sign-in: one vote per browser (a random token kept in local storage) and per network (the bot keeps a salted
  hash of the IP, only for that vote), so people on the same connection share a vote. The bot's `GET` and `POST
  /api/vote` serve it, and it is off unless the bot has `MAP_VOTE` on.
- A season page (`/season`, "Season 1" in the menu, and a box under the home page's intro): the roundup of Season 1,
  from the bot's `GET /api/season`. **Season 1 ended with the wipe on 15 October 2026, 00:00 UTC** (1am in the UK),
  so the page is open to everyone. Before a season ends the bot does not send the roundup to anyone, so the page shows
  a countdown and what the roundup will have. It loads the bot again every minute, so a page left open opens by
  itself, within about a minute of the end. Once open it has:
  - **The Season in Review**, at the top: the season as a slideshow, like a year in review, roasting included. One
    slide at a time over the page (a full screen on a phone, a tall card on a computer): tap or click the right of a
    slide, Next, → or Space for the next one, the left, Back or ← for the one before, swipe on a phone, and Esc or ✕ to
    close. It stays put until you move it (**Autoplay** in the corner steps through it for you, and stops when you tap), but it is
    lively: numbers count up, the backgrounds drift, lists slide in and the last slide throws confetti. All of that is off
    (and there is no Autoplay) when your device asks for less motion. **Music** (♪, off until you turn it on, and then
    on next time) plays a mellow loop made in the browser with Web Audio (`js/music.js`): no audio files, so nothing to
    license or download. It pauses with the tab and stops when the story closes, and a small chime marks each new slide. The server's story has the matches, players, hours and kills, the busiest day, the
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
  - The hall of fame: the top 10 for most kills, best K/D (from 10 matches, as on the leaderboard), most kills in a
    match, most wins, most MVPs, most time played and top seeders.
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
- Seeder VIP: what seeding earns (a whitelist slot), under the intro and as step 4 of "Play with us".
  Shown only when the bot has automatic VIP on, and worded from the bot's rule, so it always matches what the bot does.
- The staff page (`/admin`), for staff only: they sign in with Discord. **Now**: who is on the server, with anyone
  worth a look at the top, to act on there and then, and the kill feed. **Queue**: everyone the bot flagged, one row
  each. **Players**: any player's history. **Server**: the bans and whitelist slots, the map rotations, what the bot
  says in game and the weapon rules. Every staff command is in its command search. `/server-settings` goes to Server.
  See [Staff page](staff-pages.md).

The stats, matches, leaderboard, weapons and seeding used to be in full on the home page. Old links to them, like
`/#leaderboard` or `/#seeding`, go to their pages.

## How it behaves

- Fetches the stats every 60 seconds, and only while the tab is visible. The bot's numbers change once a minute.
- If the bot has not read the server for 3 minutes, the server shows as **Offline** with when it was last seen.
- If a refresh fails, the page keeps the last numbers and says it is retrying.
- Notices ("Live stats are not connected yet", the retrying one and the `?demo` one) show right under the header on
  every page, the home page too. The [notice for everyone](../README.md#notice-for-everyone) shows above them.
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
