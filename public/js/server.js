import { ask } from './ask.js';
import { demoGrowth, demoLines, demoPlaytime, demoLinesChange, demoRotations, demoRotationsChange, demoRules, demoRulesChange } from './demo.js';
import {
  bounceText,
  clickPlace,
  formatHours,
  growthText,
  heatGrid,
  JOIN_TIMINGS,
  LEAVE_TIMINGS,
  leftShare,
  newPlayersText,
  playtimeText,
  returnShare,
  SERVER_VIEWS,
  seedingText,
  shareOf,
  staffNote,
} from './format.js';
import { demo, showNotice } from './live.js';
import { $, badge, call, cell, get, load, loadToken, myProfile, number, openSteam, setStatus, showTab, staffCell, steamLink, table, tabKeys, when } from './staff.js';
import { el } from './views.js';

// The staff page's Server section, once the Server settings page, in four views. Bans and VIP: the bans on the server,
// the whitelist slots and staff Steam accounts. Rotations: the map rotations, the week and what is on the server (see
// rotations.js). Lines: what the bot says in game (see lines.js). Weapon rules: weapons the bot warns or kicks for (see
// rules.js). The three editors load the first time they are opened, so staff who only moderate never load them.
// `who(player)` draws a player's name, opening their panel, and `act(key, player)` opens their panel with a form, such
// as Unban (see admin.js). `changed()` is called when what is unsaved changes, for the dot on the Server tab.

// The editors' modules, and what each loads and sends, as on the bot or as samples with ?demo.
const EDITORS = {
  rotations: {
    module: () => import('./rotations.js').then((m) => m.createRotations),
    load: () => (demo ? demoRotations() : get('admin/rotations')),
    send: (body) => (demo ? demoRotationsChange(body) : call('admin/rotations', body)),
  },
  lines: {
    module: () => import('./lines.js').then((m) => m.createLines),
    load: () => (demo ? demoLines() : get('admin/lines')),
    send: (body) => (demo ? demoLinesChange(body) : call('admin/lines', body)),
  },
  rules: {
    module: () => import('./rules.js').then((m) => m.createRules),
    load: () => (demo ? demoRules() : get('admin/rules')),
    send: (body) => (demo ? demoRulesChange(body) : call('admin/rules', body)),
  },
};

export const createServer = ({ who, act, changed = () => undefined, selected = () => undefined }) => {
  let view = SERVER_VIEWS[0];
  let data = null;
  // The editors made so far, by name, and those on their way.
  const editors = {};
  const making = {};

  const dirty = () => Object.values(editors).some((e) => e.dirty);

  // A dot on the view of each editor with changes not saved yet, so they are not forgotten elsewhere. Looked at again
  // after anything in an editor changes, at most once a frame.
  const markUnsaved = () => {
    for (const name of Object.keys(EDITORS)) $(`dirty-${name}`).hidden = !editors[name]?.dirty;
    changed(dirty());
  };
  let unsavedFrame = 0;
  const unsavedSoon = () => {
    cancelAnimationFrame(unsavedFrame);
    unsavedFrame = requestAnimationFrame(markUnsaved);
  };
  const editorChanges = new MutationObserver(unsavedSoon);
  for (const name of Object.keys(EDITORS)) editorChanges.observe($(name), { subtree: true, childList: true, attributes: true, characterData: true });
  for (const type of ['input', 'change']) document.addEventListener(type, unsavedSoon, true);

  // An editor, made the first time it is wanted. Null when its module could not be loaded.
  const editor = async (name) => {
    if (editors[name]) return editors[name];
    making[name] ??= EDITORS[name]
      .module()
      .then((create) => {
        editors[name] = create({ root: $(name), load: EDITORS[name].load, send: EDITORS[name].send });
        return editors[name];
      })
      .catch((error) => {
        console.error(`Could not load the ${name} editor`, error);
        $(name).replaceChildren(el('p', { className: 'tool-error', textContent: 'Couldn’t load this just now. Reload the page to try again.' }));
        delete making[name];
        return null;
      });
    return making[name];
  };

  // Shows one view, loading its editor when it has one.
  const show = async (name, { focus = false } = {}) => {
    view = SERVER_VIEWS.includes(name) ? name : SERVER_VIEWS[0];
    showTab(SERVER_VIEWS, view, { focus });
    selected(view);
    if (data && view === 'bans') loadGrowth();
    if (data && view === 'playtime') loadPlaytime();
    if (!data || !EDITORS[view]) return;
    (await editor(view))?.show();
  };

  // A row's button that opens a tool in the player's panel, such as Unban.
  const actButton = (text, key, player) => {
    const button = el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: text, onclick: () => act(key, player) });
    button.dataset.act = key;
    button.dataset.steamId = player.steamId;
    return button;
  };

  const renderBans = (overview) => {
    if (overview.bans === null) {
      $('bans-note').textContent = 'Couldn’t read the server’s ban list just now. Trying again in a minute.';
      $('bans').replaceChildren();
      return;
    }
    $('bans-note').textContent = 'Everyone banned on the server now, with the reason. Bans made outside the bot are permanent.';
    // A ban keeps only who made it by Discord user ID, so a name kept with their log entries stands in when the bot
    // sends none.
    const logged = new Map(overview.moderation.filter((e) => e.byName).map((e) => [e.by, e.byName]));
    const rows = overview.bans.map((b) =>
      el(
        'tr',
        {},
        el(
          'td',
          { className: 'player' },
          who(b.player),
          b.onServer ? null : el('span', { className: 'badges' }, badge('Waiting: banned when they next join', 'hot')),
        ),
        el('td', { className: 'reason', textContent: b.bot?.reason ?? b.reason ?? '–' }),
        b.bot ? staffCell({ by: b.bot.by, byName: logged.get(b.bot.by) }, overview.staff) : cell(b.bannedBy ?? 'Outside the bot'),
        el('td', { className: 'when', textContent: b.bot ? when.format(b.bot.at) : '–' }),
        el('td', { className: 'when', textContent: b.bot?.until ? when.format(b.bot.until) : 'Never' }),
        el('td', { className: 'row-actions' }, actButton('Unban', 'unban', b.player)),
      ),
    );
    table($('bans'), ['Player', 'Reason', 'Banned by', 'Since', 'Ends', ''], rows, 'Nobody is banned.');
  };

  const renderReserved = (overview) => {
    const reserved = overview.reserved;
    if (reserved === undefined) {
      $('reserved-note').textContent = 'The bot does not send the whitelist yet. Deploy the latest bot.';
      $('reserved').replaceChildren();
      return;
    }
    if (reserved === null) {
      $('reserved-note').textContent = 'Couldn’t read ServerSettings.ini just now. Trying again in a minute.';
      $('reserved').replaceChildren();
      return;
    }
    const count = reserved.players.length;
    // Staff spots: the bot keeps one for each staff member who linked their Steam account.
    const staffCount = reserved.players.filter((r) => r.staff).length;
    $('reserved-note').textContent = [
      `${count} ${count === 1 ? 'player is' : 'players are'} on the whitelist in ServerSettings.ini, so they skip the queue when the server is full.`,
      staffNote(staffCount, count),
      reserved.maxSlots === null ? '' : `MaxReservedSlots holds ${reserved.maxSlots} of the server’s slots back for them.`,
      'Changes take effect when the server next restarts.',
    ]
      .filter(Boolean)
      .join(' ');
    const rows = reserved.players.map((r) =>
      el(
        'tr',
        {},
        el('td', { className: 'player' }, who(r.player)),
        cell(r.staff ? badge('Staff spot', 'accent') : r.bot ? badge('From the bot', 'accent') : badge('Permanent')),
        el('td', { className: 'when', textContent: (r.staff ?? r.bot) ? when.format((r.staff ?? r.bot).since) : '–' }),
        el('td', { className: 'when', textContent: r.staff ? 'While staff' : r.bot ? when.format(r.bot.until) : 'Never' }),
        // A staff spot goes when their Steam account is unlinked, below.
        el('td', { className: 'row-actions' }, r.staff ? null : actButton('Remove VIP', 'vip:remove', r.player)),
      ),
    );
    table($('reserved'), ['Player', 'VIP', 'Since', 'Ends', ''], rows, 'Nobody is on the whitelist.');
  };

  const ghostButton = (text, onclick) => el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: text, onclick });

  const unlinkSteam = async (profile, mine) => {
    const question = mine
      ? 'Unlink your Steam account? Your staff spot comes off the whitelist, and your time on the server counts as seeding again.'
      : `Unlink ${profile.name}’s Steam account? Do this when they are no longer staff: their staff spot comes off the whitelist, and their time on the server counts as seeding again.`;
    if (!(await ask(question, { yes: 'Unlink', danger: true }))) return;
    try {
      const { ok, json } = await call('admin/profile', { action: 'unlink', ...(mine ? {} : { userId: profile.userId }) });
      if (!ok) {
        if (loadToken()) showNotice(json?.error ?? 'Couldn’t unlink that just now. Try again in a minute.');
        return;
      }
      load();
    } catch (error) {
      console.error('Could not unlink a Steam account', error);
      showNotice('Couldn’t reach the bot. Try again in a minute.');
    }
  };

  // Staff who linked their Steam account, so the bot never counts them as seeders. Anyone can unlink anyone, for staff
  // who have left. What that means is behind the panel's "?".
  const renderStaffSteam = (overview) => {
    const profiles = overview.staffProfiles;
    const mineButton = $('staff-steam-mine');
    mineButton.hidden = profiles === undefined;
    setStatus($('staff-steam-note'), profiles === undefined ? 'The bot does not keep staff Steam accounts yet. Deploy the latest bot.' : '');
    if (profiles === undefined) {
      $('staff-steam').replaceChildren();
      return;
    }
    mineButton.textContent = myProfile(overview) ? 'Change yours' : 'Link yours';
    const rows = profiles.map((p) => {
      const mine = p.userId === overview.user?.id;
      // The bot names an account it has never seen by its Steam ID.
      const account = p.player.name === p.player.steamId ? steamLink(p.player.steamId) : who(p.player);
      return el(
        'tr',
        {},
        cell(mine ? `${p.name} (you)` : p.name),
        el('td', { className: 'player' }, account, ...(p.seen ? [] : [' ', badge('Not seen in 90 days', 'hot')])),
        el('td', { className: 'when', textContent: when.format(p.linkedAt) }),
        el(
          'td',
          { className: 'row-actions' },
          ...(mine ? [ghostButton('Change', () => openSteam())] : []),
          ghostButton('Unlink', () => unlinkSteam(p, mine)),
        ),
      );
    });
    table($('staff-steam'), ['Staff', 'Steam account', 'Linked', ''], rows, 'Nobody has linked theirs yet.');
  };

  $('staff-steam-mine').addEventListener('click', () => openSteam());

  // Discord growth: clicks on the invite by place, and how many players signed in and linked. Read when Bans and VIP is
  // shown, at most every few minutes: the bot counts every account for it.
  let growthAt = 0;
  const GROWTH_MS = 5 * 60_000;
  const loadGrowth = async () => {
    if (Date.now() - growthAt < GROWTH_MS) return;
    growthAt = Date.now();
    try {
      const { ok, status, json } = demo ? { ok: true, status: 200, json: demoGrowth() } : await get('admin/growth');
      if (!ok) {
        growthAt = 0;
        if (status === 404) setStatus($('growth-note'), 'The bot does not count these yet. Deploy the latest bot.');
        else if (loadToken()) setStatus($('growth-note'), 'Couldn’t load these just now. Try again in a minute.');
        return;
      }
      setStatus($('growth-note'), growthText(json));
      table(
        $('growth-clicks'),
        ['Where', ['Clicks', 'num']],
        json.clicks.places.map((p) => el('tr', {}, cell(clickPlace(p.src)), number(p.clicks))),
        'Nobody has clicked the Discord invite yet.',
      );
    } catch (error) {
      growthAt = 0;
      console.error('Could not load the Discord growth', error);
      setStatus($('growth-note'), 'Couldn’t reach the bot. Try again in a minute.');
    }
  };

  // Play time: how long players stay each day and when in a match they leave. Read when the view is shown or its period
  // changes, at most every few minutes for one period.
  let playtimeKey = '';
  let playtimeAt = 0;
  // Which request is the latest: an answer to an earlier one (another period, or before signing out) is dropped.
  let playtimeRequest = 0;
  const PLAYTIME_MS = 5 * 60_000;
  const minutes = (value) => formatHours(value);
  // The rest of the Play time view, which an older bot's answer has none of.
  const renderPlaytimeMore = (json) => {
    const leftHeads = ['', ['Matches', 'num'], ['In game at start', 'num'], ['Left before the end', 'num'], ['Left', 'num']];
    const leftRow = (label, r) => el('tr', {}, cell(label), number(r.matches), number(r.present), number(r.leftBefore), number(leftShare(r)));
    table($('playtime-maps'), ['Map', ...leftHeads.slice(1)], json.byMap.map((m) => leftRow(m.map, m)), 'No matches finished in this period.');
    table($('playtime-balance'), ['Match', ...leftHeads.slice(1)], json.byBalance.filter((b) => b.matches > 0).map((b) => leftRow(b.label, b)), 'No matches with scores in this period.');
    table(
      $('playtime-joins'),
      ['Joined', ['Stays', 'num'], ['Median stay', 'num'], ['Stayed 30 min or more', 'num']],
      json.joins.filter((j) => j.sessions > 0).map((j) => el('tr', {}, cell(JOIN_TIMINGS[j.timing] ?? j.timing), number(j.sessions), number(minutes(j.medianMinutes)), number(shareOf(j.stayedShare, 1)))),
      'Nothing yet.',
    );
    setStatus($('playtime-seeding-note'), seedingText(json.seeding));
    table(
      $('playtime-seeding'),
      ['Match', ['Went live', 'num'], ['Seeded for', 'num'], ['In game while seeding', 'num'], ['There at go-live', 'num']],
      json.seeding.list.map((m) =>
        el('tr', {}, cell(m.map), el('td', { className: 'num when', textContent: when.format(m.liveAt) }), number(minutes(m.seedingMinutes)), number(m.seeders), number(m.reachedLive)),
      ),
      'Nothing to show.',
    );
    setStatus($('playtime-new-note'), json.newPlayers ? newPlayersText(json.newPlayers) : '');
    table(
      $('playtime-new'),
      ['Week of', ['New players', 'num'], ['Back within a day', 'num'], ['Within 7 days', 'num'], ['Within 30 days', 'num']],
      (json.newPlayers?.cohorts ?? []).map((c) => el('tr', {}, cell(c.week), number(c.newPlayers), ...c.windows.map((w) => number(returnShare(w))))),
      'No new players yet.',
    );
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 24 }, (_, h) => h);
    $('playtime-heat').replaceChildren(
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', textContent: 'UTC' }), ...hours.map((h) => el('th', { scope: 'col', className: 'heat-hour', textContent: String(h) })))),
      el(
        'tbody',
        {},
        ...heatGrid(json.heat).map((row, day) =>
          el(
            'tr',
            {},
            el('th', { scope: 'row', textContent: names[day] }),
            ...row.map((c, h) =>
              el('td', {
                className: `heat-cell heat-${c.level}`,
                title: `${names[day]} ${String(h).padStart(2, '0')}:00 UTC: ${c.leaves} leaves in ${formatHours(c.minutes)} of play${c.rate === null ? '' : ` (${Math.round(c.rate)} per 100 hours)`}`,
              }),
            ),
          ),
        ),
      ),
    );
  };

  const loadPlaytime = async () => {
    const days = $('playtime-days').value;
    if (days === playtimeKey && Date.now() - playtimeAt < PLAYTIME_MS) return;
    playtimeKey = days;
    playtimeAt = Date.now();
    const request = ++playtimeRequest;
    try {
      const { ok, status, json } = demo ? { ok: true, status: 200, json: demoPlaytime(Number(days)) } : await get(`admin/retention?days=${days}`);
      if (request !== playtimeRequest) return;
      if (!ok) {
        playtimeAt = 0;
        if (status === 404) setStatus($('playtime-note'), 'The bot does not count this yet. Deploy the latest bot.');
        else if (loadToken()) setStatus($('playtime-note'), 'Couldn’t load this just now. Try again in a minute.');
        return;
      }
      setStatus($('playtime-note'), `${playtimeText(json)} ${bounceText(json.bounce)}`.trim());
      table(
        $('playtime-daily'),
        ['Day', ['Players', 'num'], ['Stays', 'num'], ['Average stay', 'num'], ['Typical stay', 'num'], ['Per player', 'num']],
        json.daily.map((d) =>
          el('tr', {}, cell(d.day), number(d.players), number(d.sessions), number(minutes(d.averageMinutes)), number(minutes(d.medianMinutes)), number(minutes(d.minutesPerPlayer))),
        ),
        'Nobody has left yet in this period.',
      );
      const stays = json.lengths.reduce((sum, l) => sum + l.sessions, 0);
      table(
        $('playtime-lengths'),
        ['Stay', ['Stays', 'num'], ['Share', 'num']],
        json.lengths.map((l) => el('tr', {}, cell(l.label), number(l.sessions), number(shareOf(l.sessions, stays)))),
        'Nothing yet.',
      );
      const { total, timing, finale } = json.leaves;
      const last = Object.values(finale).reduce((a, b) => a + b, 0);
      table(
        $('playtime-leaves'),
        ['When', ['Leaves', 'num'], ['Share', 'num'], ['In the night’s last match or after', 'num']],
        [
          ...LEAVE_TIMINGS.map(([key, label]) => el('tr', {}, cell(label), number(timing[key]), number(shareOf(timing[key], total)), number(finale[key]))),
          el('tr', {}, cell('All'), number(total), number(shareOf(total, total)), number(last)),
        ],
        'Nobody has left yet in this period.',
      );
      table(
        $('playtime-matches'),
        ['Match', ['Ended', 'num'], ['In game at start', 'num'], ['Left before the end', 'num'], ['Stayed', 'num']],
        json.matches.map((m) =>
          el(
            'tr',
            {},
            cell(m.lastOfNight ? `${m.map} (last of the night)` : m.map),
            el('td', { className: 'num when', textContent: when.format(m.endedAt) }),
            number(m.present),
            number(m.leftBefore),
            number(shareOf(m.present - m.leftBefore, m.present)),
          ),
        ),
        'No matches finished in this period.',
      );
      if (json.byMap) renderPlaytimeMore(json);
    } catch (error) {
      if (request !== playtimeRequest) return;
      playtimeAt = 0;
      console.error('Could not load the play time', error);
      setStatus($('playtime-note'), 'Couldn’t reach the bot. Try again in a minute.');
    }
  };
  $('playtime-days').addEventListener('change', () => loadPlaytime());

  // The views: click, or ← → Home End from their row of buttons.
  for (const name of SERVER_VIEWS) $(`tab-${name}`).addEventListener('click', () => show(name));
  tabKeys(SERVER_VIEWS, () => view, show, $('panel-server').querySelector('.server-tabs'));

  return {
    show,
    get view() {
      return view;
    },
    dirty,
    // With each refresh: the bans, whitelist and staff Steam accounts, and the editor shown, once, the first time.
    async render(overview, { open = false } = {}) {
      data = overview;
      renderBans(overview);
      renderReserved(overview);
      renderStaffSteam(overview);
      if (view === 'bans' && !$('panel-server').hidden) loadGrowth();
      if (view === 'playtime' && !$('panel-server').hidden) loadPlaytime();
      if (open && EDITORS[view]) (await editor(view))?.ensure();
    },
    // Signing out forgets everything the editors had.
    signedOut() {
      data = null;
      growthAt = 0;
      playtimeAt = 0;
      playtimeRequest += 1;
      for (const e of Object.values(editors)) e.reset();
    },
  };
};
