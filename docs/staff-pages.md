# Staff pages

Back to the [README](../README.md).

The staff pages are for staff: Discord Administrators and members with a staff role in our Discord server (the bot's
`DISCORD_ADMIN_ROLE_IDS`), the same people who can use the bot's staff commands. `/admin` is linked from every page's
footer ("Staff sign-in") and both are kept out of search results.

There are two, one for each kind of work, with a switch between them by the title:

- **Moderation** (`/admin`), the page to keep open while the server is busy: **Live** (who is on, with those worth a
  look always at the top, and every kill now), **Review** (what the bot flagged, and what staff did), **History** (any
  player's record) and **Commands** (every staff command).
- **Server settings** (`/server-settings`), for setting the server up: **Bans and VIP** (the bans, whitelist slots and
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
kept in this browser for 36 hours, for both pages; "Sign out" forgets it. Anyone else is told the pages are for staff
only.

**Your Steam account.** Seeder VIP and the top seeders are for the players who seed, not for staff. The first time you
sign in without a Steam account linked, the page asks for your Steam64 ID (17 digits, starting 7656119), with how to find
it: Steam's **Account details**, your profile's link when it has `/profiles/` and the number in it, or steamid.io for a
custom link. Once linked, the bot counts your time on the server as playing, not seeding: you don't earn seeder VIP or
show as a top seeder, and your player page shows no seed days. Your kills, matches and time played show as before. You
get a staff spot instead: the bot keeps you on the server's whitelist for as long as you're linked, in place of a
slot added by hand.
"Later" asks again at your next sign-in. Change it any time from "Steam: …" next to your name, or on Server settings'
Bans and VIP tab.

## Moderation: Live, the server, who is on and every kill now

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

## Moderation: Review, what the bot flagged, and what staff did

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

## Moderation: History, any player's record

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

## Moderation: Commands, every staff command

- Every staff command from Discord: look up a player, warn, kick, move to another team, ban, unban,
  make a profile private or public again and see the private profiles, give or remove VIP, top seeders, message everyone in game, set the next map, change map now, call for seeders, the
  map rotations (see them and the week, swap now, pick a day's rotation, add or take out a map, save the server's
  rotation, delete one), and remove a wrongly recorded match. The forms come from the bot's own command list, and the
  pick-lists (players in game and seen lately, teams, maps, modes, lighting, zones, saved rotations, bans, the whitelist, recent matches) from the same suggestions Discord shows. Anything that changes the game or the records asks
  first. Each runs on the bot as you, exactly as the slash command: the same checks and replies, and it goes in the
  player's staff history and the moderation log. To warn, kick or move someone in game, Act on Live is quicker.

## Server settings: Bans and VIP

- **Bans.** Everyone banned on the server now, the reason, who banned them, and when a timed ban ends. "Unban" opens the
  tool over the page with them picked, as Act does on Moderation.
- **Whitelist slots.** Everyone on the whitelist in the server's settings, with VIP from the bot and when it ends,
  or permanent (added by hand, or with `/vip add` `permanent`), and how many slots are held back for them. "Remove VIP" opens the tool with them picked, the same way.
  Staff who linked their Steam account show as **Staff spot**, since they linked, ending "While staff", with no Remove VIP:
  unlinking them takes it away.
- **Staff Steam accounts.** Every staff member who linked their Steam account, with their name in game and when they
  linked it, marked when the bot has not seen the account in the last 90 days. "Unlink" (after asking) is for someone
  who linked the wrong account or is no longer staff: their staff spot comes off the whitelist, and their time
  counts as seeding again. Needs the bot's staff Steam
  accounts (its README, "Staff Steam accounts").

## Server settings: Rotations, the maps for each day

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

## Server settings: Lines, what the bot says in game

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

## Server settings: Weapon rules, weapons the bot warns or kicks for

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

## Everywhere

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
