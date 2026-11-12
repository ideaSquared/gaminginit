import { clockHour } from './format.js';
import { feedNote, filterLines, isFlagged, mergeLines, actionText, nameText, newestId, newText, nearBottom, placeText, verdictText } from './livechatmodel.js';
import { el } from './views.js';

// The staff page's Live chat tab: the chat as the bot reads it, newest at the bottom, each line with what the bot made of
// it (clean, an exact match, or a spelling that only resembles a listed word) and what it did. It follows the end unless
// scrolled up; "Jump to latest" goes back. Flagged lines carry a word badge and a border style as well as colour.
//
// `load(after)` reaches the bot (GET /api/admin/chat?after=) and resolves to { ok, status, json }. `who(player)` draws a
// player's name, opening their panel (see admin.js).

// How often the bot is asked while the tab is shown.
const POLL_MS = 4_000;

const time = new Intl.DateTimeFormat(undefined, { hour: clockHour(), minute: '2-digit', second: '2-digit' });

export const createLiveChat = ({ root, load, who }) => {
  let lines = [];
  let feed = null;
  let problem = null;
  let flaggedOnly = false;
  let player = '';
  let unseen = 0;
  let timer = null;
  let polling = false;
  let loaded = false;
  // Bumped by reset (signing out), so an answer that arrives after it is dropped.
  let generation = 0;

  const announcer = el('p', { className: 'visually-hidden', role: 'status' });
  const note = el('p', { className: 'rot-note rot-warn', role: 'status' });
  const status = el('span', { className: 'muted livechat-status' });
  const log = el('ol', { className: 'livechat-log', role: 'log', ariaLabel: 'Chat, newest at the bottom', tabIndex: 0 });
  log.setAttribute('aria-live', 'off');
  const jump = el('button', { type: 'button', className: 'btn btn-small livechat-jump', textContent: newText(0), hidden: true });
  const flaggedBox = el('input', { type: 'checkbox', id: 'livechat-flagged' });
  const playerBox = el('input', { className: 'finder-input livechat-player', type: 'search', placeholder: 'Player: name or Steam ID', ariaLabel: 'Only this player', autocomplete: 'off' });
  const controls = el(
    'div',
    { className: 'livechat-controls' },
    el('label', { className: 'livechat-flagged', htmlFor: 'livechat-flagged' }, flaggedBox, ' Flagged only'),
    playerBox,
    status,
  );
  const wrap = el('div', { className: 'card panel livechat' }, el('h2', { className: 'panel-title', textContent: 'Live chat' }), controls, note, el('div', { className: 'livechat-box' }, log, jump));
  root.replaceChildren(wrap, announcer);

  const line = (l) => {
    const { tone, badge, text } = verdictText(l);
    const did = actionText(l);
    const place = placeText(l);
    const item = el('li', { className: `chat-line chat-line-${tone}` });
    item.dataset.id = String(l.id);
    const name = l.steamId ? who({ steamId: l.steamId, name: l.name || l.steamId }) : el('span', { textContent: l.name || 'Unknown' });
    item.append(
      el('time', { className: 'chat-time', dateTime: new Date(l.at).toISOString(), textContent: time.format(new Date(l.at)) }),
      el('span', { className: 'chat-who' }, name, l.shownAs ? el('span', { className: 'muted', textContent: ` (shown as ${l.shownAs})` }) : null),
      place ? el('span', { className: 'chat-place muted', textContent: place }) : null,
      l.ping ? el('span', { className: 'badge badge-hot', textContent: '📣 Ping', title: 'The player pinged' }) : null,
      el('span', { className: 'chat-text', textContent: l.text }),
    );
    if (l.rawText !== undefined && l.rawText !== l.text) {
      item.append(el('span', { className: 'chat-raw muted', textContent: `Typed: ${l.rawText}` }));
    }
    if (tone !== 'clean') {
      item.append(
        el(
          'span',
          { className: 'chat-verdict' },
          el('span', { className: `badge chat-badge chat-badge-${tone}`, textContent: `${tone === 'exact' ? '⛔' : '⚠'} ${badge}` }),
          el('span', { textContent: ` ${text}${l.verdict?.others?.length ? `; also ${l.verdict.others.join(', ')}` : ''}` }),
          did ? el('strong', { className: 'chat-action', textContent: ` · ${did}` }) : null,
        ),
      );
    }
    return item;
  };

  const visible = () => filterLines(lines, { flaggedOnly, player });

  const atEnd = () => nearBottom(log);
  const toEnd = () => {
    log.scrollTop = log.scrollHeight;
    unseen = 0;
    jump.hidden = true;
  };

  // All the lines again, after a filter changes.
  const draw = () => {
    const shown = visible();
    log.replaceChildren(...shown.map(line));
    if (shown.length === 0) log.append(el('li', { className: 'muted chat-empty', textContent: lines.length === 0 ? 'No chat yet.' : 'No lines match the filters.' }));
    toEnd();
  };

  // New lines at the end; the view follows unless scrolled up.
  const append = (fresh) => {
    const follow = atEnd();
    const shown = filterLines(fresh, { flaggedOnly, player });
    log.querySelector('.chat-empty')?.remove();
    for (const l of shown) {
      log.querySelector(`[data-id="${l.id}"]`)?.remove();
      log.append(line(l));
    }
    while (log.children.length > 500) log.firstElementChild.remove();
    if (follow) toEnd();
    else if (shown.length > 0) {
      unseen += shown.length;
      jump.textContent = newText(unseen);
      jump.hidden = false;
    }
    const flagged = shown.filter(isFlagged);
    if (flagged.length > 0) {
      announcer.textContent = '';
      requestAnimationFrame(() => (announcer.textContent = `${flagged.length} flagged ${flagged.length === 1 ? 'line' : 'lines'} in the chat`));
    }
  };

  const showNote = () => {
    const text = problem ?? (feed ? feedNote(feed) : null);
    note.textContent = text ?? '';
    note.hidden = text === null;
  };

  const poll = async () => {
    if (polling) return;
    polling = true;
    const mine = generation;
    try {
      const answer = await load(newestId(lines)).catch(() => ({ ok: false, status: 0, json: null }));
      if (mine !== generation) return;
      if (!answer.ok) {
        problem =
          answer.status === 404
            ? 'The bot does not have the live chat yet. Deploy the latest bot.'
            : (answer.json?.error ?? 'Could not reach the bot. Trying again.');
        status.textContent = 'Not live';
        showNote();
        return;
      }
      problem = null;
      feed = answer.json;
      const first = !loaded;
      loaded = true;
      const before = lines.length;
      lines = mergeLines(lines, feed.lines);
      showNote();
      status.textContent = `Live · ${time.format(new Date())}`;
      if (first) draw();
      else if (feed.lines.length > 0 || lines.length !== before) append(feed.lines);
    } finally {
      polling = false;
    }
  };

  // Asks again every few seconds while the tab can be seen, and stops when it cannot (another tab, or the browser tab in
  // the background).
  const visibleNow = () => !document.hidden && !root.closest('[hidden]');
  const tick = async () => {
    timer = null;
    if (!visibleNow()) return;
    await poll();
    if (timer === null && visibleNow()) timer = setTimeout(tick, POLL_MS);
  };
  const start = () => {
    if (timer === null && !polling) timer = setTimeout(tick, 0);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) start();
  });

  jump.addEventListener('click', () => {
    toEnd();
    log.focus({ preventScroll: true });
  });
  flaggedBox.addEventListener('change', () => {
    flaggedOnly = flaggedBox.checked;
    draw();
  });
  playerBox.addEventListener('input', () => {
    player = playerBox.value;
    draw();
  });
  log.addEventListener('scroll', () => {
    if (atEnd()) {
      unseen = 0;
      jump.hidden = true;
    }
  });
  showNote();

  return {
    // When the tab is opened: starts asking, if it is not.
    show() {
      start();
    },
    ensure() {
      start();
    },
    // Signing out forgets everything, and any answer still on its way.
    reset() {
      generation += 1;
      clearTimeout(timer);
      timer = null;
      polling = false;
      loaded = false;
      lines = [];
      feed = null;
      problem = null;
      unseen = 0;
      draw();
      showNote();
      status.textContent = '';
    },
    // Nothing here is edited.
    get dirty() {
      return false;
    },
  };
};
