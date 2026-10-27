import { demoCoins, demoMyCoins } from './demo.js';
import { apiUrl, demo, keepQuery, startLive } from './live.js';
import { errorText } from './accountmodel.js';
import { askBot, configured, loadPlayerToken, signInHref, takeResult } from './accountsession.js';
import {
  buyLabel,
  canPress,
  coinText,
  dayText,
  earnRows,
  itemName,
  logLine,
  percent,
  seedsForWeek,
  shopGroups,
  tierLabel,
  todayText,
  whitelistText,
} from './coinsmodel.js';
import { el, playerName, setText } from './views.js';

// The INITcoins page: how they work and who has the most, from the bot's /api/coins, and for a signed-in player their own
// coins, missions and the shop, from /api/account/coins (the bot's coins.ts does the sums; this page shows them and asks it to
// buy, swap a mission or pick a title). ?demo shows sample numbers, and its buttons only change the sample.

const $ = (id) => document.getElementById(id);

// A sign-in that came back to this page: keep its session, and say if it did not work.
const arrived = takeResult();

let info = null;
let mine = null;
// The thing whose button was pressed once: a second press does it.
let armed = null;
let demoView = null;
// A buy, swap or title change is on its way to the bot: no other goes out until it answers, so a press can't be paid twice.
let busy = false;
// Which button's request is on its way.
let pending = null;
// Set when the player's coins couldn't be had and there is nothing older to show.
let loadFailed = false;

const flash = (kind, text) => {
  const box = $('coins-flash');
  box.className = `account-flash account-flash-${kind}`;
  box.replaceChildren(text);
  box.hidden = false;
};

const clearFlash = () => {
  $('coins-flash').hidden = true;
};

const signedIn = () => demo || loadPlayerToken() !== null;

// What this player's coins page has to say: the whole view, or null while signed out.
const loadMine = async () => {
  if (demo) {
    demoView ??= demoMyCoins(Date.now());
    mine = demoView;
    return;
  }
  if (loadPlayerToken() === null || !configured) {
    mine = null;
    return;
  }
  const { status, data } = await askBot('/api/account/coins');
  if (status === 200 && data !== null) {
    mine = data;
    loadFailed = false;
  } else if (status === 401) {
    // Signed out: nothing of theirs is shown.
    mine = null;
    loadFailed = false;
  } else {
    // A network error or the bot having a bad moment: keep what was last shown, and say it may be old.
    loadFailed = mine === null;
    if (mine !== null) flash('bad', 'We couldn’t refresh your coins just now. This is what we had a minute ago.');
  }
};

// Keeps the keyboard where it was across a render, which replaces the buttons.
const keyed = (node, key) => {
  node.setAttribute('data-focus-key', key);
  return node;
};

const meter = (value) => {
  const bar = el('span', { className: 'mission-fill' });
  bar.style.width = `${value}%`;
  return el('span', { className: 'mission-bar', ariaHidden: 'true' }, bar);
};

const missionItem = (m, personal) =>
  el(
    'li',
    { className: `mission${personal && m.done ? ' is-done' : ''}` },
    el(
      'div',
      { className: 'mission-top' },
      el('span', { className: `tier tier-${m.tier}`, textContent: tierLabel(m.tier) }),
      el('span', { className: 'mission-text', textContent: m.text }),
      el('span', { className: 'mission-reward', textContent: `+${m.reward}` }),
    ),
    ...(personal
      ? [
          meter(percent(m.progress, m.target)),
          el(
            'div',
            { className: 'mission-foot' },
            el('span', { className: 'muted', textContent: m.done ? 'Done' : `${m.progress} of ${m.target}` }),
            ...(m.scope === 'day' && !m.done && mine.coins.rerolls.left > 0
              ? [
                  keyed(
                    el('button', {
                      type: 'button',
                      className: 'btn btn-ghost btn-small',
                      textContent: armed === `reroll:${m.slot}` ? `Press again to pay ${mine.coins.rerolls.price}` : `Swap · ${mine.coins.rerolls.price}`,
                      disabled: busy,
                      onclick: () => press(`reroll:${m.slot}`, { action: 'reroll', slot: m.slot }),
                    }),
                    `reroll:${m.slot}`,
                  ),
                ]
              : []),
          ),
        ]
      : []),
  );

const renderMissions = () => {
  const personal = mine?.coins ?? null;
  const day = personal ? personal.daily : (info?.info.missions.daily ?? []);
  const week = personal ? personal.weekly : (info?.info.missions.weekly ?? []);
  $('missions-day').replaceChildren(...day.map((m) => missionItem(m, personal !== null)));
  $('missions-week').replaceChildren(...week.map((m) => missionItem(m, personal !== null)));
  setText(
    $('missions-day-sub'),
    personal
      ? `You can swap one that isn’t done for another of its kind (${personal.rerolls.left} left today). They change at midnight, UTC.`
      : 'The same for everyone. They change at midnight, UTC.',
  );
};

const renderMe = () => {
  const c = mine?.coins ?? null;
  const out = !signedIn();
  $('me-out').hidden = !out;
  $('me-error').hidden = out || mine !== null || !loadFailed;
  $('me-unlinked').hidden = out || mine === null || mine.linked;
  $('me-ready').hidden = c === null;
  $('me-sign-in').href = signInHref();
  $('coins-history').hidden = c === null;
  if (c === null) return;
  setText($('me-balance'), c.balance.toLocaleString('en-GB'));
  setText($('me-sub'), `You’ve earned ${coinText(c.earned)} in all, and spent ${c.spent.toLocaleString('en-GB')}.`);
  setText($('me-today'), todayText(c.today));
  $('me-meter').style.width = `${percent(c.today.earned, c.today.cap)}%`;
  setText($('me-vip'), whitelistText(c.vipUntil, Date.now()));

  // Titles they own.
  const owned = c.shop.filter((item) => item.kind === 'title' && item.owned);
  $('me-title-pick').hidden = owned.length === 0;
  const select = $('me-title-select');
  select.disabled = busy;
  select.replaceChildren(
    el('option', { value: '', textContent: 'No title' }),
    ...owned.map((item) => el('option', { value: item.id, textContent: itemName(item), selected: c.title === itemName(item) })),
  );
  if (c.title === null) select.value = '';

  $('log-rows').replaceChildren(
    ...(c.log.length === 0
      ? [el('tr', {}, el('td', { colSpan: 3, className: 'muted', textContent: 'Nothing yet.' }))]
      : c.log.map((tx) => {
          const line = logLine(tx);
          return el(
            'tr',
            {},
            el('td', { textContent: line.what }),
            el('td', { className: line.gain ? 'coins-gain' : 'coins-loss', textContent: line.delta }),
            el('td', { textContent: dayText(tx.at) }),
          );
        })),
  );
};

const shopItem = (item, personal) => {
  const pressable = personal && canPress(item);
  return el(
    'li',
    { className: `shop-item${personal && item.owned ? ' is-owned' : ''}` },
    el('span', { className: 'shop-name', textContent: itemName(item) }),
    el('span', { className: 'shop-price', textContent: item.price.toLocaleString('en-GB') }),
    ...(personal
      ? [
          keyed(
            el('button', {
              type: 'button',
              className: 'btn btn-small ' + (pressable ? 'btn-coin' : 'btn-ghost'),
              textContent: busy && armed === null && pending === `buy:${item.id}` ? 'Working…' : buyLabel(item, armed === `buy:${item.id}`),
              disabled: !pressable || busy,
              title: pressable ? '' : (item.reason ?? ''),
              onclick: () => press(`buy:${item.id}`, { action: 'buy', item: item.id }),
            }),
            `buy:${item.id}`,
          ),
        ]
      : []),
  );
};

const renderShop = () => {
  const personal = mine?.coins ?? null;
  const items = personal ? personal.shop : (info?.info.shop ?? []);
  setText($('shop-sub'), personal ? 'Press a button twice to buy it. What you buy is paid for first and given back if it can’t be delivered.' : 'Sign in and link your Steam account to buy.');
  $('shop').replaceChildren(
    ...shopGroups(items).map((group) =>
      el(
        'section',
        { className: 'shop-group' },
        el('h3', { textContent: group.title }),
        el('p', { className: 'muted coins-sub', textContent: group.note }),
        el('ul', { className: 'shop-list' }, ...group.items.map((item) => shopItem(item, personal !== null))),
      ),
    ),
  );
};

const renderEarn = () => {
  const { rates, prices } = info.info;
  setText($('earn-sub'), 'Seeding pays the most, because it is what the server needs. Playing and missions pay a little.');
  $('earn-rows').replaceChildren(
    ...earnRows(rates).map((row) =>
      el('tr', {}, el('td', { textContent: row.what }), el('td', { className: 'coins-pays', textContent: row.pays }), el('td', { className: 'muted', textContent: row.note })),
    ),
  );
  setText(
    $('earn-fine'),
    `Playing, matches and seeding minutes pay up to ${rates.activityCap} a day between them; the seed itself and missions are on top. A week of whitelist is ${prices.vipWeek}${seedsForWeek(rates.seed, prices.vipWeek) === null ? '' : `, about ${seedsForWeek(rates.seed, prices.vipWeek)} seeds`}.`,
  );
  setText($('faq-ahead'), String(prices.vipAheadDays));
};

const renderLeaders = () => {
  const rows = info.leaders;
  $('leaders').replaceChildren(
    rows.length === 0
      ? el('p', { className: 'muted board-empty', textContent: 'Nobody has earned any yet. Go and seed.' })
      : el(
          'table',
          { className: 'players-table' },
          el('thead', {}, el('tr', {}, ...['#', 'Player', 'Earned'].map((h) => el('th', { scope: 'col', textContent: h })))),
          el(
            'tbody',
            {},
            ...rows.map((p, i) =>
              el(
                'tr',
                {},
                el('td', { className: 'rank', textContent: String(i + 1) }),
                el('td', { className: 'player' }, playerName(p), ...(p.title ? [el('span', { className: 'chip chip-title', textContent: p.title })] : [])),
                el('td', { textContent: p.earned.toLocaleString('en-GB') }),
              ),
            ),
          ),
        ),
  );
};

const render = () => {
  if (info === null) return;
  const focused = document.activeElement?.getAttribute?.('data-focus-key') ?? null;
  $('coins-off').hidden = true;
  $('coins-body').hidden = false;
  renderMe();
  renderMissions();
  renderShop();
  renderEarn();
  renderLeaders();
  if (focused !== null) document.querySelector(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus();
};

// A button pressed once arms itself; pressed again, it asks the bot.
const press = async (key, body) => {
  if (busy) return;
  if (armed !== key) {
    armed = key;
    render();
    return;
  }
  armed = null;
  clearFlash();
  if (demo) {
    flash('good', demoAct(body));
    render();
    return;
  }
  busy = true;
  pending = key;
  render();
  try {
    const { status, data } = await askBot('/api/account/coins', { method: 'POST', body });
    if (status === 200 && data?.ok) {
      mine = { enabled: true, linked: true, coins: data.coins };
      flash('good', data.message);
    } else if (status === 401) {
      mine = null;
      flash('bad', 'You were signed out. Sign in again.');
    } else {
      flash('bad', data?.error ?? 'Could not do that just now. Try again in a minute.');
      await loadMine();
    }
  } finally {
    busy = false;
    pending = null;
    render();
  }
};

// ?demo: the buttons change the sample only.
const demoAct = (body) => {
  const c = demoView.coins;
  if (body.action === 'buy') {
    const item = c.shop.find((i) => i.id === body.item);
    if (!item) return 'There is no such thing in the shop.';
    if (item.kind !== 'role' || !item.owned) c.balance -= item.price;
    c.spent += item.price;
    if (item.kind === 'vip') c.vipUntil = Math.max(c.vipUntil ?? Date.now(), Date.now()) + (item.id === 'vip-7' ? 7 : 1) * 86_400_000;
    else item.owned = true;
    for (const s of c.shop) s.afford = !s.owned && s.price <= c.balance;
    return `Sample: you bought ${itemName(item)}. Nothing was charged.`;
  }
  if (body.action === 'reroll') {
    c.balance -= c.rerolls.price;
    c.rerolls.left -= 1;
    return 'Sample: that mission is swapped. Nothing was charged.';
  }
  return 'Sample: title changed.';
};

$('me-title-select').setAttribute('data-focus-key', 'title');
$('me-title-select').addEventListener('change', async (event) => {
  if (busy) return;
  clearFlash();
  const id = event.target.value === '' ? null : event.target.value;
  if (demo) {
    flash('good', 'Sample: title changed.');
    return;
  }
  busy = true;
  render();
  try {
    const { status, data } = await askBot('/api/account/coins', { method: 'POST', body: { action: 'title', id } });
    if (status === 200 && data?.ok) {
      mine = { enabled: true, linked: true, coins: data.coins };
      flash('good', data.message);
    } else flash('bad', data?.error ?? 'Could not do that just now.');
  } finally {
    busy = false;
    render();
  }
});

// Pressing anything else disarms a button.
document.addEventListener('click', (event) => {
  if (armed !== null && !event.target.closest('.shop-item button, .mission button')) {
    armed = null;
    render();
  }
});

const off = () => {
  $('coins-body').hidden = true;
  $('coins-off').hidden = false;
};

if (arrived.error !== undefined) flash('bad', errorText(arrived.error));

startLive(
  async (data) => {
    if (data === null) {
      if (info === null) off();
      return;
    }
    info = data;
    await loadMine();
    render();
  },
  { url: apiUrl('/api/coins'), sample: demoCoins, missing: off },
);

// Where the numbers are used elsewhere on the site, keepQuery keeps ?demo on the links in the page body.
for (const a of document.querySelectorAll('#coins-body a[data-keep-query]')) a.href = keepQuery(a.getAttribute('href'));
