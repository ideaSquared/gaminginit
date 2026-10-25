import { demoShame } from './demo.js';
import { apiUrl, startLive } from './live.js';
import { barWidth, removedGroups, removedNotes, shameTiles, teamKillTitle, whenText } from './shamemodel.js';
import { el, playerName } from './views.js';

// The hall of shame: who has been warned most for team killing, and who was kicked or banned.

const $ = (id) => document.getElementById(id);

const tile = ({ label, value, sub }) =>
  el('div', { className: 'tile' }, el('p', { className: 'tile-label', textContent: label }), el('p', { className: 'tile-value', textContent: value }), el('p', { className: 'tile-sub', textContent: sub }));

const head = (...headings) => el('thead', {}, el('tr', {}, ...headings.map((h) => el('th', { scope: 'col', textContent: h }))));

const renderTeamKillers = (shame, now) => {
  const table = $('tk-list');
  if (shame.teamKillers.length === 0) {
    table.replaceChildren();
    $('tk-note').textContent = 'Nobody has been warned three times yet. Impressive, or the bot is asleep.';
    return;
  }
  $('tk-note').textContent = 'Warned for team killing at least 3 times, most first. The title is earned.';
  const most = shame.teamKillers[0].warnings;
  table.replaceChildren(
    head('#', 'Player', 'Warnings', 'Last warned'),
    el(
      'tbody',
      {},
      ...shame.teamKillers.map((p, i) => {
        const bar = el('span', { className: 'shame-bar' }, el('span', { className: 'shame-bar-fill' }));
        bar.firstChild.style.setProperty('--w', `${barWidth(p.warnings, most)}%`);
        return el(
          'tr',
          {},
          el('td', { className: 'shame-rank', textContent: String(i + 1) }),
          el('td', { className: 'player' }, playerName(p), el('span', { className: 'shame-title', textContent: teamKillTitle(p.warnings) })),
          el('td', { className: 'shame-count' }, el('strong', { textContent: String(p.warnings) }), bar),
          el('td', { textContent: whenText(p.lastAt, now) }),
        );
      }),
    ),
  );
};

const renderRemoved = (shame, now) => {
  const groups = removedGroups(shame.removed);
  $('removed-groups').replaceChildren(
    ...groups.map((group) =>
      el(
        'div',
        { className: 'card panel shame-panel' },
        el('h2', { className: 'panel-title', textContent: `${group.heading} (${group.players.length})` }),
        el('p', { className: 'section-note', textContent: group.note }),
        group.players.length === 0
          ? el('p', { className: 'muted', textContent: 'Nobody. Keep it up.' })
          : el(
              'div',
              { className: 'table-scroll-x' },
              el(
                'table',
                { className: 'players-table directory-table shame-table' },
                head('Player', 'When', ''),
                el(
                  'tbody',
                  {},
                  ...group.players.map((p) =>
                    el(
                      'tr',
                      {},
                      el('td', { className: 'player' }, playerName(p)),
                      el('td', { textContent: whenText(p.lastAt, now) }),
                      el('td', {}, ...removedNotes(p).map((note) => el('span', { className: 'chip shame-chip', textContent: note }))),
                    ),
                  ),
                ),
              ),
            ),
      ),
    ),
  );
};

const render = (shame) => {
  if (!shame) {
    $('shame-tiles').replaceChildren();
    $('tk-list').replaceChildren();
    $('tk-note').textContent = 'Waiting for live stats.';
    $('removed-groups').replaceChildren();
    return;
  }
  $('shame-tiles').replaceChildren(...shameTiles(shame.totals).map(tile));
  renderTeamKillers(shame, shame.generatedAt);
  renderRemoved(shame, shame.generatedAt);
};

startLive(render, { url: apiUrl('shame'), sample: demoShame });
