import { queueRows } from './format.js';
import { badge, replaceButtons, setStatus, table } from './staff.js';
import { el } from './views.js';

// The Queue's first view, Flagged players: everyone the bot flagged in the period, one row each with every reason
// together (see queueRows), so a player is never on it twice, to filter by flag and act on. `who(player)` draws a name
// that opens their panel; `quickActs(player)` the Warn, Kick and Ban buttons for a player in game; `actMenu(player)`
// their Act menu; `lastAction(steamId)` what staff last did to them in the period, in words, or null.

const KINDS = { headshots: 'Headshots', griefing: 'Griefing', steam: 'Risky Steam' };

export const createQueue = ({ who, quickActs, actMenu, lastAction }) => {
  // '' for every flag, or one kind; and whether to leave out those not in game.
  let kind = '';
  let inGameOnly = false;
  let last = null;

  const draw = () => {
    if (last === null) return;
    const { rows, online } = last;
    const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, rows.filter((r) => r.reasons.some((x) => x.kind === k)).length]));
    // A kind with nobody flagged for it falls back to every flag.
    if (kind && counts[kind] === 0) kind = '';
    const button = (value, text, count) => {
      const b = el(
        'button',
        {
          type: 'button',
          ariaPressed: String(kind === value),
          onclick: () => {
            kind = value;
            draw();
          },
        },
        text,
        ' ',
        el('span', { className: 'filter-count', textContent: String(count) }),
      );
      b.dataset.key = value;
      return b;
    };
    replaceButtons($queue.filter, [button('', 'All', rows.length), ...Object.entries(KINDS).map(([k, text]) => button(k, text, counts[k]))]);

    const shown = rows.filter((r) => (!kind || r.reasons.some((x) => x.kind === kind)) && (!inGameOnly || r.inGame));
    setStatus($queue.note, shown.length === rows.length ? '' : `Showing ${shown.length} of ${rows.length}.`);
    const row = (r) => {
      const player = online.get(r.steamId) ?? r;
      return el(
        'tr',
        { className: r.reasons.some((x) => x.serious) ? 'watch' : '' },
        el('td', { className: 'player' }, who(player), r.banned ? el('span', { className: 'badges' }, badge('Banned', 'accent')) : null),
        el(
          'td',
          { className: 'queue-why' },
          ...r.reasons.map((x) => el('p', { className: 'queue-reason' }, badge(KINDS[x.kind], x.serious ? 'bad' : 'hot'), ' ', el('span', { textContent: x.text }))),
        ),
        el('td', { className: 'when' }, r.inGame ? badge(player.faction ? `In game · ${player.faction}` : 'In game', 'accent') : el('span', { className: 'muted', textContent: 'Not in game' })),
        el('td', { className: 'queue-last', textContent: lastAction(r.steamId) ?? '–' }),
        el('td', { className: 'row-actions' }, r.inGame ? quickActs(player) : null, actMenu(player)),
      );
    };
    const empty = rows.length === 0 ? 'Nobody flagged in this period.' : inGameOnly && !rows.some((r) => r.inGame) ? 'Nobody in game is flagged.' : 'Nobody flagged for that.';
    table($queue.list, ['Player', 'Why they’re here', 'Where', 'Last staff action', ''], shown.map(row), empty);
  };

  const $queue = { filter: document.getElementById('queue-filter'), note: document.getElementById('queue-note'), list: document.getElementById('queue-list') };
  document.getElementById('queue-ingame').addEventListener('change', (event) => {
    inGameOnly = event.target.checked;
    draw();
  });

  return {
    // With each refresh, and when the period's headshots come: `kills` is null until they have, `online` the players in
    // game now by Steam ID. Returns how many are on it, for the tab.
    render({ overview, kills, online, now }) {
      const rows = queueRows({
        headshots: kills?.players ?? [],
        steam: overview.steam?.accounts ?? [],
        griefers: overview.players ?? [],
        inGame: new Set(online.keys()),
        now,
      });
      last = { rows, online };
      draw();
      return rows.length;
    },
    // Leaves the queue whenever an Act menu is open, as the rest of the page does: draw() again once it closes.
    redraw: draw,
  };
};
