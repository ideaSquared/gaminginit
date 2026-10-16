import { flagLabel, formatHours, kd, metres, modActionLabel, plural, recordBan, recordCounts, recordSteam, recordVip, staffBy, timeAgo } from './format.js';
import { badge, when } from './staff.js';
import { el } from './views.js';

// A player's record from the bot (GET /api/admin/player), for their panel and their history: their time and matches over
// 90 days, their Steam account, VIP and ban, today's team kills, and what staff did through the bot. `staff` names staff
// by Discord user ID, and `now` is when the page last heard from the bot.

const date = (at) => when.format(at);

const fact = (label, ...value) => el('div', { className: 'record-fact' }, el('dt', { textContent: label }), el('dd', {}, ...value));
const lines = (texts) => texts.map((text, i) => (i === 0 ? el('span', { textContent: text }) : el('span', { className: 'record-more', textContent: text })));

// A team kill or vehicle suicide by them, or a team kill on them, in a line.
const incidentText = (i, steamId) => {
  const how = [i.weapon ? ` with ${i.weapon}` : '', i.distance === null ? '' : ` from ${metres(i.distance)}`, i.map ? ` on ${i.map}` : ''].join('');
  if (i.kind === 'vehicle-suicide') return `Killed themselves in a vehicle${how}`;
  if (i.victim?.steamId === steamId && i.player.steamId !== steamId) return `Killed by teammate ${i.player.name}${how}`;
  return `Killed teammate ${i.victim?.name ?? 'unknown'}${how}`;
};

const griefNodes = (grief, steamId, now) => {
  if (grief.teamKills + grief.teamKilled + grief.suicides === 0) return [el('p', { className: 'record-text muted', textContent: 'No team kills or suicides today.' })];
  const counts = [
    plural(grief.teamKills, 'team kill'),
    ...(grief.vehicleTeamKills > 0 ? [`${grief.vehicleTeamKills} with a vehicle`] : []),
    ...(grief.crashTeamKills > 0 ? [`${grief.crashTeamKills} in a helicopter crash`] : []),
    ...(grief.teamKilled > 0 ? [`killed by a teammate ${plural(grief.teamKilled, 'time')}`] : []),
    ...(grief.suicides > 0 ? [`${plural(grief.suicides, 'suicide')}${grief.vehicleSuicides > 0 ? ` (${grief.vehicleSuicides} in a vehicle)` : ''}`] : []),
  ];
  return [
    grief.flags.length > 0 ? el('span', { className: 'badges' }, ...grief.flags.map((f) => badge(flagLabel(f), 'bad'))) : null,
    el('p', { className: 'record-text', textContent: counts.join(' · ') }),
    grief.victims.length > 0
      ? el('p', {
          className: 'record-text muted',
          textContent: `Teammates killed: ${grief.victims.map((v) => (v.kills > 1 ? `${v.name} ×${v.kills}` : v.name)).join(', ')}`,
        })
      : null,
    grief.incidents.length > 0
      ? el(
          'ul',
          { className: 'player-peek-list' },
          ...grief.incidents.map((i) => el('li', {}, el('span', { className: 'when', textContent: timeAgo(now - i.at) }), ` ${incidentText(i, steamId)}`)),
        )
      : null,
  ].filter(Boolean);
};

const logNodes = (log, staff) => {
  if (log.length === 0) return [el('p', { className: 'record-text muted', textContent: 'Nothing through the bot yet.' })];
  const counts = recordCounts(log);
  return [
    counts ? el('p', { className: 'record-text muted', textContent: counts }) : null,
    el(
      'ul',
      { className: 'player-peek-list' },
      ...log.map((e) =>
        el(
          'li',
          {},
          badge(modActionLabel(e.action), e.action === 'ban' ? 'bad' : e.action === 'kick' ? 'hot' : ''),
          ` ${date(e.at)} · ${staffBy(e, staff)}`,
          e.detail ? ` · ${e.detail}` : null,
          e.reason ? el('span', { className: 'muted', textContent: ` · ${e.reason}` }) : null,
        ),
      ),
    ),
  ].filter(Boolean);
};

export const recordNodes = (record, { staff = {}, now = Date.now() } = {}) => {
  const t = record.totals;
  const steam = record.steam;
  const steamLine = steam.status === 'found' ? `${steam.facts.join(' · ')} · checked ${timeAgo(now - steam.checkedAt)}` : null;
  return [
    el(
      'dl',
      { className: 'record-facts' },
      fact(`Last ${record.days} days`, t === null ? 'Not seen on the server' : `${formatHours(t.minutes)} played · ${t.matches} ${t.matches === 1 ? 'match' : 'matches'}`),
      ...(t === null
        ? []
        : [
            fact('Seeding', `${formatHours(t.seedingMinutes)} · ${plural(t.seedDays, 'seed day')}`),
            fact('Kills / deaths', `${t.kills.toLocaleString('en-GB')} / ${t.deaths.toLocaleString('en-GB')} (${kd(t.kills, t.deaths)})`),
          ]),
      fact('Steam account', ...lines([recordSteam(steam), ...(steamLine ? [steamLine] : [])])),
      fact('VIP', ...lines(recordVip(record.vip, date))),
      fact('Ban', ...lines(recordBan(record.ban, date, staff))),
      ...(record.privateProfile ? [fact('Profile', 'Private: the public sees them as [private profile]')] : []),
    ),
    ...(record.grief === null ? [] : [el('h4', { className: 'record-heading', textContent: 'Team kills today (UTC)' }), ...griefNodes(record.grief, record.steamId, now)]),
    el('h4', { className: 'record-heading', textContent: 'Staff history' }),
    ...logNodes(record.log, staff),
    el('p', { className: 'muted record-note', textContent: 'Staff history only covers what staff did through the bot.' }),
  ];
};
