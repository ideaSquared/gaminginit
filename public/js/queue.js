import { dealtHolds, dealtText, queueRows } from './format.js';
import { badge, replaceButtons, setStatus, table } from './staff.js';
import { el } from './views.js';

// The Queue's first view, Flagged players: everyone the bot flagged in the period, one row each with every reason
// together (see queueRows), so a player is never on it twice, to filter by flag and act on. `who(player)` draws a name
// that opens their panel; `quickActs(player)` the Warn, Kick and Ban buttons for a player in game; `actMenu(player)`
// their Act menu; `lastAction(steamId)` what staff last did to them in the period, in words, or null.
// "Dealt with", with a bot that keeps it (the overview's `dealt`): staff mark a row once they have looked, in game or
// not, and it leaves the Queue for all staff until something new comes up (see dealtHolds). `deal(row, on)` marks it,
// or undoes it, and resolves to whether that worked. Those dealt with are hidden unless staff ask to see them, and the
// last one can be undone from the note above the list.

const KINDS = { headshots: 'Headshots', griefing: 'Griefing', steam: 'Risky Steam' };

// What staff found, as the bot keeps it for good (its outcomes): the bot's automatic marks are judged by these.
const OUTCOMES = [
  ['', 'Found…'],
  ['cheating', 'Cheating'],
  ['false-alarm', 'False alarm'],
  ['griefing', 'Griefing'],
  ['other', 'Something else'],
];

export const createQueue = ({ who, quickActs, actMenu, lastAction, deal }) => {
  // '' for every flag, or one kind; whether to leave out those not in game; and whether to show those dealt with.
  let kind = '';
  let inGameOnly = false;
  let showDealt = false;
  let last = null;
  // The row last dealt with, for its Undo.
  let justDealt = null;
  // What staff picked in a row's "Found…" list and have not saved yet, by Steam ID: the Queue redraws on every refresh and
  // filter, which would otherwise empty the list.
  const picked = new Map();

  const drawDone = () => {
    $queue.done.replaceChildren(
      ...(justDealt === null
        ? []
        : [`✓ Dealt with ${justDealt.name}. `, el('button', { type: 'button', className: 'link-button', textContent: 'Undo', onclick: () => dealRow(justDealt, false) })]),
    );
  };
  const dealRow = async (r, on, outcome = '') => {
    if (!(await deal(r, on, outcome))) return;
    picked.delete(r.steamId);
    justDealt = on ? r : null;
    drawDone();
  };

  const draw = () => {
    if (last === null) return;
    const { all, online, dealt, staff, now } = last;
    const holds = (r) => dealtHolds(r, dealt?.[r.steamId]);
    // Those still to look at; the filters count only these.
    const rows = all.filter((r) => !holds(r));
    const done = all.length - rows.length;
    $queue.dealt.hidden = dealt === undefined || done === 0;
    $queue.dealtCount.textContent = String(done);
    const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, rows.filter((r) => r.reasons.some((x) => x.kind === k)).length]));
    const listed = showDealt ? all : rows;
    // A kind with nobody listed for it falls back to every flag.
    if (kind && !listed.some((r) => r.reasons.some((x) => x.kind === kind))) kind = '';
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

    const shown = listed.filter((r) => (!kind || r.reasons.some((x) => x.kind === kind)) && (!inGameOnly || r.inGame));
    setStatus($queue.note, shown.length === listed.length ? '' : `Showing ${shown.length} of ${listed.length}.`);
    // A ghost button by the Act menu: Dealt with, or Undo on a row dealt with.
    const dealButton = (r, on, outcome) => {
      const b = el('button', {
        type: 'button',
        className: `btn btn-ghost btn-small ${on ? 'quick-dealt' : 'quick-undo'}`,
        textContent: on ? '✓ Dealt with' : 'Undo',
        onclick: () => dealRow(r, on, outcome?.value ?? ''),
      });
      b.title = on ? 'Dealt with: off the Queue for all staff until something new comes up' : 'Put them back on the Queue';
      b.setAttribute('aria-label', `${on ? 'Dealt with' : 'Undo dealt with'}: ${r.name}`);
      b.dataset.deal = on ? 'deal' : 'undo';
      return b;
    };
    // Warn, Kick and Ban for a player in game, and Dealt with or Undo, in one row of buttons.
    const acts = (r, player, held) => {
      const buttons = r.inGame && !held ? quickActs(player) : el('span', { className: 'quick-acts' });
      if (dealt !== undefined) {
        // What they found goes with the headshots flag, which the bot's automatic marks are judged by.
        const outcome =
          !held && r.reasons.some((x) => x.kind === 'headshots')
            ? el(
                'select',
                {
                  className: 'quick-outcome',
                  ariaLabel: `What you found: ${r.name}`,
                  onchange: (event) => picked.set(r.steamId, event.target.value),
                },
                ...OUTCOMES.map(([value, text]) => el('option', { value, textContent: text })),
              )
            : null;
        if (outcome) {
          outcome.value = picked.get(r.steamId) ?? '';
          buttons.append(outcome);
        }
        buttons.append(dealButton(r, !held, outcome));
      }
      return buttons.childElementCount > 0 ? buttons : null;
    };
    const row = (r) => {
      const player = online.get(r.steamId) ?? r;
      const mark = dealt?.[r.steamId];
      const held = holds(r);
      const note =
        mark === undefined
          ? null
          : el('p', {
              className: `row-note${held ? ' row-checked' : ''}`,
              textContent: held ? `✓ ${dealtText(mark, now, staff)}` : `${dealtText(mark, now, staff)}, but more came up since`,
            });
      return el(
        'tr',
        { className: held ? 'row-dealt' : r.reasons.some((x) => x.serious) ? 'watch' : '' },
        el('td', { className: 'player' }, who(player), r.banned ? el('span', { className: 'badges' }, badge('Banned', 'accent')) : null, note),
        el(
          'td',
          { className: 'queue-why' },
          ...r.reasons.map((x) => el('p', { className: 'queue-reason' }, badge(KINDS[x.kind], x.serious ? 'bad' : 'hot'), ' ', el('span', { textContent: x.text }))),
        ),
        el('td', { className: 'when' }, r.inGame ? badge(player.faction ? `In game · ${player.faction}` : 'In game', 'accent') : el('span', { className: 'muted', textContent: 'Not in game' })),
        el('td', { className: 'queue-last', textContent: lastAction(r.steamId) ?? '–' }),
        el('td', { className: 'row-actions' }, acts(r, player, held), actMenu(player)),
      );
    };
    const empty =
      rows.length === 0
        ? done > 0
          ? `Nobody left to look at: ${done} dealt with.`
          : 'Nobody flagged in this period.'
        : inGameOnly && !rows.some((r) => r.inGame)
          ? 'Nobody in game is flagged.'
          : 'Nobody flagged for that.';
    table($queue.list, ['Player', 'Why they’re here', 'Where', 'Last staff action', ''], shown.map(row), empty);
  };

  const $queue = {
    filter: document.getElementById('queue-filter'),
    note: document.getElementById('queue-note'),
    list: document.getElementById('queue-list'),
    dealt: document.getElementById('queue-dealt-label'),
    dealtCount: document.getElementById('queue-dealt-count'),
    done: document.getElementById('queue-done'),
  };
  document.getElementById('queue-ingame').addEventListener('change', (event) => {
    inGameOnly = event.target.checked;
    draw();
  });
  document.getElementById('queue-dealt').addEventListener('change', (event) => {
    showDealt = event.target.checked;
    draw();
  });

  return {
    // With each refresh, and when the period's headshots come: `kills` is null until they have, `online` the players in
    // game now by Steam ID. Returns how many are still to look at, for the tab.
    render({ overview, kills, online, now }) {
      const all = queueRows({
        headshots: kills?.players ?? [],
        steam: overview.steam?.accounts ?? [],
        griefers: overview.players ?? [],
        inGame: new Set(online.keys()),
        staff: new Set((overview.staffProfiles ?? []).map((s) => s.player?.steamId)),
        now,
      });
      last = { all, online, dealt: overview.dealt, staff: overview.staff ?? {}, now };
      draw();
      return all.filter((r) => !dealtHolds(r, overview.dealt?.[r.steamId])).length;
    },
    // Leaves the queue whenever an Act menu is open, as the rest of the page does: draw() again once it closes.
    redraw: draw,
  };
};
