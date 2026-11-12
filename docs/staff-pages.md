# Staff page

Back to the [README](../README.md).

The staff page (`/admin`) is for staff: Discord Administrators and members with a staff role in our Discord server
(the bot's `DISCORD_ADMIN_ROLE_IDS`), the same people who can use the bot's staff commands. It is linked from every
page's footer ("Staff sign-in") and kept out of search results.

It has four sections:

- **Now**, the one to keep open while the server is busy: who is on, with those worth a look always at the top, and
  every kill now.
- **Queue**: everyone the bot flagged, one row each, with the lists by flag, the team kills and the moderation log.
- **Players**: any player's record, starting from those staff acted on and who was on lately.
- **Server**: the bans, whitelist slots and staff Steam accounts, the rotations, the lines, the weapon rules, the chat filter and the live chat.

Every staff command is in the **command search** (Ctrl K), and the server's own in the **Server** menu.
The Server menu also links to the external **Wardogs MOTD Builder** (opens in a new tab): write, preview and check the
server welcome message (MOTD) before pasting it into the host's RCON editor.

Now and Queue have a count (how many are in game, and how many are flagged), and each section says what is in it when
you hover it. The address keeps the section and its view (`/admin#queue`, `/admin#queue/teamkills`, `/admin#players`,
`/admin#server/rotations`; Now and the first view of each have none), and on Players the player shown
(`/admin#players/<Steam ID>`), so a link opens the right one, and the browser's Back goes back. Old links go where
those are now (`staffRoute` in `format.js`): `#live` to Now; `#review`, `#alerts` and `#kills` to Queue; `#history`,
`#history/<Steam ID>` and `#kills/<Steam ID>` to Players; `#commands` and `#admin` to Now with the command search open;
`#bans`, `#rotations`, `#lines` and `#rules` to Server. The Server settings page, `/server-settings`, is only a link
on to Server now, keeping its tab: `/server-settings#lines` opens Server's Lines. ← → move between the sections from
the keyboard. **Any player's name, in any section, opens their panel.**

**The staff bar.** In place of the site's menu, the page has its own bar at the top: the gaminginit logo (back to the
site), the server now, and at the end **Server** (the server's commands), **Search** (the command search), **Alerts**
(see Alerts, below) and the menu under your name: who you are signed in as, your Steam account, keyboard shortcuts,
View the site and Sign out. From 1100 to 1279 pixels wide, Search and Alerts show only their icons (their names are in
their hover). The server now is: live, seeding or empty, the map, the players, each team's score and when the bot last
checked (hover it for the server's name; from 1100 to 1279 pixels wide, when the bot checked is only in the hover).
When the bot cannot reach the server, it says so and when it last could. Below 1100 pixels wide the server takes a row
of its own, and on a phone the bar scrolls away with the page.

**What things mean.** Each panel has a **?** by its title that shows what it lists and how the bot decides, such as how
headshots are judged or how accounts are scored. On Queue, **How flags work** by the period shows how the bot flags
players. They are hidden until asked for, so the lists start near the top.

**Signing in.** "Sign in with Discord" goes to the bot, which sends you to Discord, checks your roles in our server and
sends you back to the page you were on. Discord only tells the bot who you are and your roles there. The sign-in is
kept in this browser for 36 hours; "Sign out", in the menu under your name, forgets it. Anyone else is
told the page is for staff only.

**Your Steam account.** Seeder VIP and the top seeders are for the players who seed, not for staff. Until you link a
Steam account, a banner at the top of the page asks you to. **Link your Steam account** asks for your Steam64 ID (17
digits, starting 7656119), with how to find it: Steam's **Account details**, your profile's link when it has
`/profiles/` and the number in it, or steamid.io for a custom link. Once linked, the bot counts your time on the server as playing, not seeding: you don't earn seeder VIP or
show as a top seeder, and your player page shows no seed days. Your kills, matches and time played show as before. You
get a staff spot instead: the bot keeps you on the server's whitelist for as long as you're linked, in place of a
slot added by hand.
**Later** hides the banner until your next sign-in. Change it any time from "Steam: …" in the menu under your name, or on
Server's VIP.

## Now: the server, who is on and every kill now

- **Side by side.** The staff pages use the whole width of the screen from 1100 pixels. From 1440 pixels the kill feed
  sits beside the server list, staying in view as the list scrolls, with Joins and leaves under the list. Narrower, they
  are one above the other.
- **The server at a glance** is in the staff bar (see above).
- **The server list:** everyone in game, with their team under their name, kills and deaths this match (K / D), time on
  the server today, and
  what is worth knowing: banned, team kills and vehicle suicides today (red once they pass a griefing mark), today's
  headshots when they are unlikely by luck (yellow below 1 in 20, red once the day is flagged; hover for their usual
  and the chance), a high-risk Steam account or one worth a look, new today (first time in 90 days), or VIP. Players
  worth a look (banned, flagged for griefing or headshots today, or a risky Steam account) have a yellow mark by their
  name. Being new is shown, but is no reason to look on its own.
- **Worth a look now, always at the top.** The list is in two parts: **Worth a look now** first, with its count in
  yellow when there is anyone in it, and then **Everyone else**. Whatever the order picked, a flagged player is never
  further down; when nobody is worth a look, the first part says so. Someone who became worth a look since the page
  loaded is marked **Just flagged** for 5 minutes.
- **One click for those worth a look:** **Warn**, **Kick** and **Ban**, by Act on their row, open their panel with that
  form ready, and **✓** (Checked, they're fine; hover it to see) is for a player you looked at and found nothing to
  act on. It moves them to Everyone else,
  for all staff, with "✓ Checked by Sarge 4 min ago", until the end of the UTC day, or until more comes up (another
  team kill or vehicle suicide, or a new flag): then they come back to the top, saying they were checked before. Act's
  **Take back the check** puts them back straight away. Needs a bot that keeps checks (its README, "Checked, they're
  fine"); with an older one the button is not there.
- **What staff did.** A player warned, kicked, banned or moved in the last day says so, with the latest: "Warned 4 min
  ago by Sarge", and how many in all when more than one. So two staff don't act on the same thing.
- **Search** by name or Steam ID, pick a **team**, **sort** by worth a look first, team, most kills, longest on today or
  name, and tick **Only worth a look** (at the top of the list) to leave out everyone else. The search, team and order apply to both
  parts. It opens sorted by **Worth a look first**: banned players, then those flagged for griefing today with the
  most team kills first, then flagged headshots, then high-risk and risky Steam accounts, then anyone else with team
  kills or vehicle suicides today, then the rest by team. When nobody in game matches a search, "Find" searches
  everyone the bot knows on Players. The list and the kill feed leave out the Steam ID under each name, to fit
  more players on the screen: hover a name for it, or open their panel. "Showing 5 of 26 in game" says when a search,
  team or tick leaves some out.
- **Alerts.** The browser tab's title says how many in game are worth a look now: "(3) Staff | …". Turn on
  **Alerts**, the bell in the staff bar, for a chime when someone becomes worth a look, and a desktop notification while
  the page's tab is in the background (once the browser is allowed to show them; it asks when you tick it). Clicking
  the notification opens their panel. With alerts on, the page keeps checking every minute while its tab is in
  the background (the kill feed still closes); without, it stops until you come back. Browsers only play sound after a
  click on the page, so after a reload, click anywhere once. The page remembers it in this browser.
- **A player's panel.** Click any player's name, on any tab, for a panel at the side (the whole screen on a phone):
  whether they are in game and on which team, what is worth knowing, and the buttons to act: **Warn**, **Kick**,
  **Ban**, **Move team** (Warn, Kick and Move only for a player in game), **Make profile private**, **Unban** for a
  player who is banned, "Checked, they're fine" or taking it back, **Only them in the kill feed** and **Full history →**
  (on Players). Then their kills and deaths this match, time on today, team kills, vehicle suicides and headshots
  today, the latest staff actions on them in the period, their latest kills and deaths in the kill feed, and **Record**,
  which loads their record (as on Players) when opened. It keeps up with each refresh and each kill of theirs while open;
  Close, Escape or a click outside it closes it.
- **Acting on a player.** Warn, Kick, Ban, Move team and the rest open that form in the panel, under the buttons, made
  for that player: no tool to pick and no Steam ID to fill in. A ban's length is a row of buttons (1 hour to Permanent).
  The button says what it will do, in words: "Warn Vex", "Ban Vex for 3 days", "Move Vex to Manticore". A warning sends
  straight away. A kick, ban, move or the rest asks again in place: the button turns into what will happen (the
  length, the reason) with **Confirm** (red for a kick or ban) and **Back**, so a ban is Ban, a length, Ban Vex for 3
  days and Confirm. Changing anything goes back to the button. The bot's reply shows under the form, and after the
  page loads again, the player's row says what was done ("Banned just now by Sarge").
- **Act** on a player opens a menu: their history, only them in the kill feed, warn, kick, move to another team, move a clan to a team, ban,
  make their profile private, and "Checked, they're fine" or taking it back. History opens them on Players; the rest
  open their panel with that form ready. Every other command is in the command search.
- **Reasons to pick.** Warn, Kick and Ban have buttons for the usual reasons (team killing, team vehicles, toxic chat,
  racism, and for kicks and bans cheating and ignoring warnings), which fill in the message or reason to change before
  sending; the one picked is marked until its words are changed. From a player's panel, the reason starts from what
  they did today: **Team killing** for a player with a team kill today, else **Team vehicles** for one with a vehicle
  suicide. Never from headshots or a Steam account: a flag is a reason to look, not proof. They are `PRESET_REASONS`,
  and the choice `reasonFor`, in `format.js`. In the command search's forms too.
- **Kill feed.** The server's latest 250 kills, newest first, to the second, as they happen: the bot sends each batch
  from the game a second or two after the kills, and new ones glow as they come in. Each has when (just the time for a
  kill from today, with the date too for an older one; hover for both), who, whom, with what (with Headshot and Team
  kill marked under the weapon), wallbangs and the like, how far and on which map, which is only shown when it differs from the kill above, as the
  server stays on one map for a long run of kills. A weapon the bot has no name for is marked
  **Check name** (see Weapons to name, on Queue's By flag). **Only team kills** and **Only headshots** hide the rest (tick both
  for team kills by headshot): Only team kills is for watching a player someone in game says is team killing. **Only
  them in the kill feed**, from Act or a player's panel, shows one player's kills and deaths, as they happen, until **Show
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

## Queue: what the bot flagged, and what staff did

- **How flags work**, by the period, in three steps: the bot checks every player's Steam account as they join, and every
  kill in the kill feed for headshots, team kills and vehicle suicides; the serious ones (griefing, with the player's
  Steam risk, and only the riskiest Steam accounts) go to the Discord moderation log channel as they happen; everything
  is listed here. A flag is a reason to look, not proof.
- **Four views**, under the period: **Flagged players** (first), **By flag**, **Team kills** and the **Moderation
  log**, with their counts. The address keeps the view.
- **Flagged players.** Everyone the bot flagged in the period, one row each with every reason together, so a player is
  never on it twice (`queueRows` in `format.js`): **Headshots** with a flagged day or a chance by luck below ordinary,
  with their headshots, usual and chance; a **Risky Steam** account, with its risk, points and why; and **Griefing**
  once flagged, with the flags, team kills and suicides. Red is serious (a flagged day, a high-risk account, griefing),
  yellow worth a look. Each row says whether they are in game and on which team, and what staff last did to them in the
  period. Those in game first, then the most serious, then the most reasons. **All**, **Headshots**, **Griefing** and
  **Risky Steam** pick which, with their counts (a player with two reasons counts under both), and **Only in game**
  leaves out the rest. Those in game have Warn, Kick and Ban by Act, as on Now.
- **✓ Dealt with**, on each row, in game or not: for a player you have looked at, and acted on or found nothing to act
  on. They leave the Queue for all staff, and its counts, until the bot flags them for something new: a day flagged
  after the latest it showed, another reason, or a riskier Steam account (`dealtHolds` in `format.js`). Then they are
  back, saying who dealt with them before and that more came up since. It lasts 30 days, so it covers the longest
  period. **Undo** by the note above the list takes the last one back; **Show dealt with (N)** lists them again,
  dimmed, each with who dealt with them and Undo. Needs a bot that keeps it (its README, "Dealt with"); with an older
  one, those in game have ✓ (Checked, they're fine, as on Now) instead.
- **By flag:** each list with all its numbers, as below.
- **Tiles** (By flag): players flagged for headshots, risky Steam accounts, players flagged for griefing, and team kills (with a
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
  flagged for sniping. Its "?" explains how headshots are judged. Above the list: how many kills in the period, and how
  many of them headshots. Needs the bot's kill feed (its README, "Weapon stats" and
  "Kills and headshots").
- **Weapons to name.** The game sends the bot a code for each weapon, not its name, and the bot names the ones it
  knows. The rest show as their code, like "WEPN 099": over the last 30 days, most kills first, with their kills, longest
  kill, the last day used and who used them most, those in game first. The game's own kill feed names them, so staff
  can watch one of those players, or match a kill marked Check name in the kill feed with the same kill in game, and
  tell whoever runs the bot. Left out when there are none, or the bot does not send them.
- **Risky Steam accounts.** Everyone seen in the period, or in game now, whose Steam account the bot scores as high risk
  or worth a look, riskiest first: why (VAC and game bans, community and trading bans, a new account, a private profile
  or one never set up), how old the account is and when the bot checked, whether they are banned, and their
  matches, K/D, headshots and time played for scale. Above the list: how many players the bot checked, and how many
  are high risk and worth a look. Its "?" lists each flag's points, as the bot sends them, and from how many points an
  account is posted to the moderation log by itself. Needs the bot's `STEAM_API_KEY` (its README, "Risky Steam accounts"); without it the page says the checks
  are off.
- **Possible griefers.** From the bot's kill feed: everyone who team killed, was team killed or killed themselves, with
  flags for a day with 3 or more team kills, killing the same teammate twice or more, 2 or more suicides in a vehicle
  (crashing it, or blowing it up), or 10 or more suicides. Teammates killed in a helicopter crash show in the team
  kills ("crash") but count towards no flag, as pilots crash by accident; a pilot who crashes twice in a day is still
  flagged for vehicle suicides. Most flagged days first, with their matches, kills and time
  played for scale, and whether they are banned. "Incidents" shows a player's team kills and vehicle suicides. Its "?"
  says what gets a player flagged.
- **Team kills and vehicle suicides.** Each one: when, who, which teammate, with what, how far and on which map.
- **Moderation log** (its own view). Every warning, kick, ban, unban, team move and VIP added or removed through the bot, with the
  reason and who did it (VIP added: Friend, Regular, Seeder, Paid or Other, and any note; VIP removed: any reason given),
  and bans made or lifted outside the bot (in game, or in the server's settings). Each kind of action can be hidden
  (team moves, say); the page remembers what you hid in this browser.
- Pick today, 7 days or 30 days (UTC days). Act works here too; for a player not in game it only offers their history,
  ban and making their profile private, as the game can only warn, kick or move players who are on.

## Players: any player's record

- **Lately**, before a search: those staff acted on in the period and who joined or left the server lately, each once,
  newest first, with what was done or when, and whether they are in game (`recentPlayers` in `format.js`). A name opens
  their history here.
- **Find a player** by name or Steam ID: anyone in game, seen in the last 30 days, banned or with VIP, from the same
  suggestions as the admin tools. A Steam ID can always be opened. Or open a player's panel from their name, anywhere
  on the page, and pick **Full history →**.
- **The player:** a link to their public player page and their Steam profile, whether they are in game or banned, their
  headshot flags and griefing flags, and Act.
- **Record:** time played, matches, kills and seeding over the last 90 days, their Steam account (its risk and what
  Steam says), VIP, ban, their team kills today (UTC) with each one, and the staff history, newest first, from the bot
  as facts (`GET /api/admin/player`, laid out by `record.js`): the same as `/player` in Discord says. With an older bot,
  the `/player` reply as Discord shows it.
- **Time on the server** in the period: each time they were on, newest first, with when they joined, when they left
  (or "In game now") and how long, and how many times and how long in all. From the bot's check each minute, like
  Joins and leaves on Now, so a time "since" another means the bot couldn't read the server in between, and "Already
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

## The command search and the Server menu

- **Search**, in the staff bar, or **Ctrl K** (⌘K on a Mac) anywhere on the page: one box to go to any section or view
  ("rotations", "moderation log"), run any staff command ("ban", "next map"), or open any player's panel by name or
  Steam ID, from the same suggestions as the commands' player lists. Every word typed must match, in any case. ↑ and ↓
  move, Enter or a click opens, Escape closes.
- **Server**, in the staff bar: the commands for the whole server (message everyone in game, set the next map, change
  map now, change the lighting, call for seeders, move a clan to a team) and the map rotations.
- A command opens its form over the page. Every staff command from Discord: look up a player, warn, kick, move to another team, ban, unban,
  make a profile private or public again and see the private profiles, give or remove VIP, top seeders, message everyone in game, set the next map, change map now, change the lighting, call for seeders, the
  map rotations (see them and the week, swap now, pick a day's rotation, add or take out a map, save the server's
  rotation, delete one), and remove a wrongly recorded match. The forms come from the bot's own command list, and the
  pick-lists (players in game and seen lately, teams, maps, modes, lighting, zones, saved rotations, bans, the whitelist, recent matches) from the same suggestions Discord shows. A short list to pick one from, such as a ban's length or
  why VIP is given, is a row of buttons. Once the player is picked, the button says what it will do ("Ban Vex for 3
  days"). Anything that changes the game or the records asks again in place, as in a player's panel, except a warning,
  which is a private message in game and sends straight away. Each runs on the bot as you,
  exactly as the slash command: the same checks and replies, and it goes in the player's staff history and the
  moderation log. To warn, kick, ban or move someone in game, the buttons on Now are quicker.
  Moving a player to another team greys out the team they are on now ("their team now"), so it can't be picked; the bot
  refuses that move too, from Discord as well.

## Server: Bans and VIP

Two views: **Bans** and **VIP**.

- **Bans.** Everyone banned on the server now, the reason, who banned them, and when a timed ban ends. "Unban" opens the
  Unban tool over the page with them picked: "Unban Nightjar", then Confirm.
- **Whitelist slots** (VIP). Everyone on the whitelist in the server's settings, with **Why** they have it (the reason
  staff gave with `/vip add`, earned by seeding, ended a long kill streak, a staff spot, or added by hand in
  `ServerSettings.ini`), VIP from the bot and when it ends,
  or permanent (added by hand, or with `/vip add` `permanent`), and how many slots are held back for them. "Remove VIP" opens the tool with them picked, the same way.
  Staff who linked their Steam account show as **Staff spot**, since they linked, ending "While staff", with no Remove VIP:
  unlinking them takes it away.
- **Staff Steam accounts.** Every staff member who linked their Steam account, with their name in game and when they
  linked it, marked when the bot has not seen the account in the last 90 days. "Unlink" (after asking) is for someone
  who linked the wrong account or is no longer staff: their staff spot comes off the whitelist, and their time
  counts as seeding again. Needs the bot's staff Steam
  accounts (its README, "Staff Steam accounts").

**Discord growth** is a card at the bottom of Bans: how many players have signed in on the website
([player accounts](site-pages.md#player-accounts)), linked a Steam account, are in the Discord and joined with the website's
button, beside the Discord's own member count; and the clicks on the Discord invite over the last 30 days by where they were
made (`home-hero`, `leaderboard-nav`, `vote`, …; "Short link (in game)" is `gaminginit.com/discord`, which the welcome message
gives). A click is not a join, but it shows which buttons bring people in. The website counts them through the bot, with no
analytics service. It loads when Bans is shown and at most every 5 minutes (the bot counts every account for it), and
says so if the bot is too old to have it (`GET /api/admin/growth`). `?demo` shows sample numbers.

## Server: Rotations, the maps for each day

A tab with changes not saved yet (Rotations, Lines or Weapon rules; the Chat filter sends each change as it is made) has a yellow dot by its name, so they are not
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
- **The editor.** Pick a rotation on the left, or start a new one. Drag Bakurani, Ozeti, Zestafona or Sabatulo into the list
  (or tap one to add it at the end), drag maps by their ⠿ handle into order (or focus the handle and use the arrow
  keys), and open ⚙ for a map's game mode, infantry only, hardcore, limited gear, lighting and control zones. A bar in the maps'
  colours shows the order at a glance. Nothing changes until **Save**; **Put on server** swaps to it for the rest of
  the day; **More** duplicates it, copies in the server's maps, or deletes it. Default can be changed but not renamed
  or deleted. Leaving the page with unsaved changes asks first.
- The bot keeps the rules (see its README, "Map rotations"): the server plays a new rotation from the next map, so a
  match is never cut short, and each day's rotation goes on at the hour shown, in your own time.

## Server: Lines, what the bot says in game

- **The lists.** The bot's messages in game each pick a line at random from a list: seeding, welcome (the basic rules,
  sent privately to each player who joins), 10 minutes in, for halfway and nearly won, one list for each faction
  plus level scores and any other team, and end of match (sent privately to the match's best players the moment a team
  wins, with `{earned}` such as "2nd on the scoreboard (23 kills) and best demolitions (8 kills)" and `{site}`). Pick a
  list on the left; each
  says how many lines it has and whether staff changed it or it is the bot's own.
- **The editor.** Change a line, take it out (×), or add one (**+ Add a line**, or Enter in a line to add one after
  it). The buttons under "Filled in by the bot" put a placeholder such as `{score}` where the cursor is, and show what
  the bot fills it in with now.
- **In game.** The message as it goes out, for the line you are on: what the bot adds before and after the line (such
  as "Halfway there!" and the seeding call to action) is dimmed. Each line counts the whole message against the game's
  200 characters, with `{score}`, `{team}` and `{earned}` at the longest they can be when it goes out (the halfway score
  up to the winning score, a team name up to 16 characters, and a scoreboard place with two awards), so the count can be more than the preview shows. A line that is too long, or has a placeholder the bot can't fill in there, is marked and can't be
  saved.
- Nothing changes until **Save**; the next message of that kind uses the new lines. **Use the bot's lines** puts the
  bot's own back. Each list says who changed it last and when. Leaving with unsaved changes asks first.
- A list that is marked "too long or wrong" was fine when it was saved, but the bot's settings changed since (its
  website, seeder VIP or the winning score). The bot cuts such a line short until it is changed.

## Server: Weapon rules, weapons the bot warns or kicks for

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

## Server: Chat filter, the words the bot acts on in chat

The bot reads the game's chat each minute and acts on lines that use a word from a list. Its starter lists are in the bot
(`src/chatwords.ts`); this tab adds to them and takes words out. The bot's README, "Chat moderation", has the details.

- **The lists.** **Racism and hate**: a line with one of these as a whole word, in any case, is an instant permanent
  ban, with the line as the reason in the player's history. **Toxicity**: a whole word or phrase is a warning in game,
  also in their history. A spelling that only resembles a word (`n1gger`, `k y s`, a word inside a longer one) is only
  posted to the moderation log for staff to decide, as is anything a staff member says: the bot never acts on staff.
  **Allowed words** are ordinary words that hold a listed word inside them, such as "Scunthorpe"-type matches: a
  listed word found inside one is ignored. Swearing is allowed and is on no list.
- **The editor.** Pick a list on the left. **Add** takes a word or phrase (up to 4 words; an allowed word is one word):
  it is saved in lower case and matches as a whole word. **×** takes a word out: one you added is gone, and a starter
  word is kept struck through as an exclusion, with **Put back**, so a false positive is fixed without a deploy. The
  list shows what staff added first, then the starter words, and has a search box.
- Each change is sent as it is made: there is nothing to save, and the bot uses it from its next check. Each list says
  who changed the lists last and when.
- A note at the top says when the bot is set not to read the chat (`CHAT_MOD` off), or only to post matches and not
  ban or warn (`CHAT_MOD_ACTIONS` off).
- `/chat` in Discord, and in the command search, shows the latest chat lines the bot read, from everyone or one player.

## Server: Live chat, the chat as it comes

The chat the bot reads from the game, newest at the bottom, with what the bot made of each line. The page asks the bot every
4 seconds while the tab is shown (`GET /api/admin/chat`, staff sign-in only; chat is never on a public page), and
the bot reads the game's chat for it when its last reading is 3 seconds old, so it is as live as that.

- **Each line**: the time, the player's name (opening their panel; staff see their real name, and "(shown as …)" when
  they chatted anonymously and other players saw another), the channel and faction (such as "Team · Lonestar"), a
  **Ping** badge when the line was a ping, and the text. When the text players saw differs from what was typed, the
  typed text is shown under it.
- **The bot's verdict.** A clean line is plain. **Exact** (⛔, solid border) is a listed word as a whole word: the badge
  says which list and word. **Resembles** (⚠, dashed border) is a spelling that only looks like a listed word (`n1gger`,
  `k y s`, inside a longer word) and which word. Both are marked by words and a border as well as colour. After it,
  what the bot did: **Banned**, **Warned in game**, **Alert only** (posted to the moderation log, nothing done),
  **Staff: no action**, alert only because automatic actions are off or no player is behind the line, "Acted on for
  another line in the same minute", "Said before the bot started" (the first lines kept when it started), or "The
  action failed". The same marks are in `/chat` in Discord.
- **Following.** It scrolls to new lines unless you scroll up; then a **Jump to latest** button counts the new lines.
  It keeps the last 500 lines.
- **Filters.** **Flagged only**, and **Player**: a name (real or shown) or a Steam ID.
- A note at the top says when the bot is not reading the chat (`CHAT_MOD` off) or the game does not serve it. The
  bot keeps its last 200 lines, so the tab starts with those. `?demo` shows sample lines, a new one every few seconds,
  with made-up words.

## Everywhere

- Staff are named as they go by in our Discord, with their username: "Sarge (@paragon)". The bot learns names as staff
  sign in and use its commands, and asks Discord for the rest when it has its bot token. When the bot has no name for
  someone, the page uses the name kept with their moderation log entries, if any. Anyone still without a name shows as
  "Discord user" and their ID, linked to their Discord profile.
- The page refreshes every minute while the browser tab is visible, like the bot's checks, and the kill feed as kills
  happen. A player's Act menu stays open through a refresh, and so does their panel, with its form as filled in.
- **Questions are asked on the page**, not in the browser's own pop-up: deleting a rotation, putting one on the
  server, throwing away changes, unlinking a Steam account. The safe answer (Back, Keep editing) is picked to start
  with for anything that throws something away, so Enter alone never does it; Escape or a click outside is Back. Only
  leaving the page with unsaved changes is still the browser's own question, as only the browser can ask it.
- **Keyboard shortcuts**, listed by **?** and in the menu under your name: **Ctrl K** searches everything; **/** searches
  the server list (or every player, on Players); **↓** and **↑** from there move through the list; **Enter** opens a player's panel;
  **W**, **K**, **B** and **M** warn, kick, ban or move the player you are on, or the one in the panel; **C** checks
  them; **1** to **6** pick a ban's length; and **Enter** sends, then confirms. So from a player in the list, a ban is
  **B**, **3**, **Enter**, **Enter**. Keys do nothing while you type in a box, and none sends anything by itself.
- Times are in your own time and clock: "7:00 PM" on a 12-hour clock (no leading zero), "07:00" on a 24-hour one.
- It shows Steam IDs, linked to Steam profiles. Player names open their panel; Players and the panel link to their
  public player page.
- `?demo` adds a sample kill to the kill feed every few seconds, as if the server were busy.
- `http://localhost:3000/admin?demo` shows sample data without signing in. Its admin tools only say what they would do,
  and the rotations, lines, weapon rules and chat filter on Server change in the page only. Those editors load the first
  time they are opened. The chat filter's sample starter words are made up: the bot's own lists are in its source.
- It only talks to the bot in its own `stats-url` meta tag and ignore `?stats=`, so a link can never send a staff
  member's sign-in to another site. To try them against a local bot, change the meta tag in local copies.
- The site must be at the bot's `SITE_URL` (`https://gaminginit.com`): the bot only sends sign-ins back there, and only
  lets that site read the staff data.

## Server: Play time

The view starts with six headline figures (stays, typical stay, how many leave at a match's end and in the night's last match, how
many new players are gone within 10 minutes, and how many seeders are there at go-live), then a card for each question. Each
chart has its numbers under **Show as table**. Bars are as long as their value; where one row is the point (the map or
kind of match that loses most players) it is picked out, and rows with under 20 players behind them are dimmed and never
picked. The period buttons at the top are Today, 7 days and 30 days.

Server's **Play time** view (`/admin#server/playtime`) shows how long players stay and when they leave, for today, 7
or 30 days (the bot keeps 30). It reads the bot's `GET /api/admin/retention` (see the bot's README, "Play time").

- **Each day:** players who left that day, their stays, the average and typical (median) stay, and the average time
  per player.
- **How long each stay was**, in bands from under 15 minutes to 3 hours or more.
- **When players leave:** the first, middle or last third of a match, at the end of a match (the last 3 minutes, and
  the minutes after it until the next starts), or between matches or while seeding. The last column counts those who
  left in the night's last match or after it. A night is a run of matches with less than 2 hours between them.
- **Match by match:** the latest 20 matches, with how many were in game when it went live, how many left before the
  last 3 minutes, and the share who stayed.

Leaves the bot only noticed after a gap in its checks are in the lengths but not in the timing, as it can't say when
they left. Players on when the bot began keeping the log have no length.

More on the same view, for the same period:

- **By map** and **by how one-sided the match was** (the winner's lead as a share of its score: under 20%, up to 50%, over
  50%): how many were in game when matches went live and the share who left before the last 3 minutes. A map or kind of
  match that loses more players than the rest is worth a look when picking rotations.
- **How long people stay, by when they joined:** while the server was seeding, in a third of a match, at its end or
  between matches, with the median stay and the share who stayed 30 minutes or more.
- **Seeding:** matches that started with the server seeding, how long it took, how many were in game while it seeded and
  how many were still there when it went live.
- **New players:** by the week a player was first seen, how many came back within 1, 7 and 30 days, counted once those
  days are over. New means not seen in the days the bot keeps (up to 90), so it counts more as new while that is short.
  The line at the top also says how many of new players' stays were under 10 minutes, against everyone else's.
- **Leaves by hour:** a heatmap of leaves per 100 hours of play by hour of the week in UTC. Hours with under 10 hours of
  play are left blank.
- Stays that ended in a staff kick or ban are left out of all of it, and the line at the top says how many.

Server's **Bans** also has, in the Discord growth card, how many of the players who signed in and linked Steam
have played a match in the last 90 days, and how many 5 or more.

## Server: Lifetime

Server's **Lifetime** view (`/admin#server/lifetime`) shows what the bot has kept for good since it began (the bot's README,
"Lifetime records"). The stays, kill feed and hourly figures only keep a few weeks; this keeps a row for each day and each
match. Each UTC day is added once it is over, so today is not in it.

- **Headline figures:** players ever, players in the last 30 days (and how many are new), regulars (5 or more days in 30),
  regulars who stopped (not seen for 30 days), player hours and matches.
- **Players each day** (the latest 90) and **each week** (all time): columns of different players, with the new ones picked
  out on top. Hover, or Tab to a chart and use the arrow keys, to read a day or week.
- **By month:** players, new players, regulars, hours, matches and stickiness (the average day's players as a share of the
  month's: how often those who play come on).
- **Do new players come back?** By the week a player was first seen: how many came back within 1, 7, 30 and 90 days, out of
  those whose days are over. This is true from the first day the bot kept, not just the last 90 days.
- **Lines** for player hours, peak players, typical stay, new players gone within 10 minutes, minutes to fill the server and
  seeders still there at go-live, each with its 7-day average. The range buttons (All time, 90 days, 30 days) set the days
  they show. The stay figures only go back to when the bot began keeping stays.
- **Where players leave, by map, and by hour** over every day kept.
- **Download the data:** each day, match, week, month and the new-player weeks as CSV, for a spreadsheet or a notebook. There
  are no Steam IDs in them.

Each chart has its numbers under "Show as table".
