import { coinArt, coinHeap, icon, ring, tick } from './art-coins.js';
import { demoCoins, demoMyCoins } from './demo.js';
import { apiUrl, demo, keepQuery, startLive } from './live.js';
import { errorText } from './accountmodel.js';
import { askBot, configured, loadPlayerToken, signInHref, takeResult } from './accountsession.js';
import {
  buyLabel,
  canPress,
  coinText,
  countSteps,
  dayText,
  earnRows,
  heroFacts,
  itemBlurb,
  itemName,
  logLine,
  percent,
  podium,
  seedsForWeek,
  shopGroups,
  tierLabel,
  titleTone,
  toGo,
  todayText,
  untilReset,
  weekSaving,
  whitelistText,
} from './coinsmodel.js';
import { el, playerName, setText } from './views.js';

// The INITcoins page: how they work and who has the most, from the bot's /api/coins, and for a signed-in player their own
// coins, missions and the shop, from /api/account/coins (the bot's coins.ts does the sums; this page shows them and asks it to
// buy, swap a mission or pick a title). ?demo shows sample numbers, and its buttons only change the sample.

const $ = (id) => document.getElementById(id);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
// The balance last shown, so a change counts up to the new one.
let shownBalance = null;

// ---- Messages ----

// A message at the foot of the screen: good ones go by themselves, bad ones stay a little longer.
const toast = (kind, text) => {
  const box = $('coins-toasts');
  const note = el('div', { className: `toast toast-${kind}`, role: kind === 'bad' ? 'alert' : 'status' }, el('span', { className: 'toast-dot', ariaHidden: 'true' }), el('span', { textContent: text }));
  note.addEventListener('click', () => note.remove());
  box.append(note);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => note.remove(), kind === 'bad' ? 8000 : 5000);
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
    if (mine !== null) toast('bad', 'We couldn’t refresh your coins just now. This is what we had a minute ago.');
  }
};

// Keeps the keyboard where it was across a render, which replaces the buttons.
const keyed = (node, key) => {
  node.setAttribute('data-focus-key', key);
  return node;
};

const coinChip = (amount, className = '') =>
  el('span', { className: `coin-chip ${className}`.trim() }, coinArt('coin-chip-art'), el('span', { textContent: typeof amount === 'number' ? amount.toLocaleString('en-GB') : amount }));

// ---- The top: facts and the purse ----

const renderFacts = () => {
  $('hero-facts').replaceChildren(
    ...heroFacts(info.info).map((fact) =>
      el('li', { className: 'fact' }, el('strong', { textContent: fact.value }), el('span', { textContent: fact.label })),
    ),
  );
};

// Counts the balance up (or down) to its new value, a little at a time, unless motion is turned down.
const showBalance = (value) => {
  const node = $('me-balance');
  const from = shownBalance;
  shownBalance = value;
  if (from === null || from === value || reducedMotion) {
    setText(node, value.toLocaleString('en-GB'));
    return;
  }
  const steps = countSteps(from, value);
  let i = 0;
  const tickOver = () => {
    if (shownBalance !== value) return;
    setText(node, steps[i].toLocaleString('en-GB'));
    i += 1;
    if (i < steps.length) setTimeout(tickOver, 34);
  };
  tickOver();
  node.classList.remove('bump');
  void node.offsetWidth;
  node.classList.add('bump');
};

const renderPurse = () => {
  const c = mine?.coins ?? null;
  const out = !signedIn();
  $('me-out').hidden = !out;
  $('me-error').hidden = out || mine !== null || !loadFailed;
  $('me-unlinked').hidden = out || mine === null || mine.linked;
  $('me-ready').hidden = c === null;
  $('coins-purse').classList.toggle('is-ready', c !== null);
  $('me-sign-in').href = signInHref();
  $('purse-art').replaceChildren(c === null ? coinHeap() : coinArt('purse-coin'));
  $('coins-history').hidden = c === null;
  if (c === null) {
    shownBalance = null;
    return;
  }
  showBalance(c.balance);
  setText($('me-sub'), `${c.earned.toLocaleString('en-GB')} earned in all · ${c.spent.toLocaleString('en-GB')} spent`);

  const used = percent(c.today.earned, c.today.cap);
  $('me-ring').querySelector('.ring')?.remove();
  $('me-ring').prepend(ring(used));
  setText($('me-ring-value'), String(c.today.earned));
  setText($('me-ring-of'), `of ${c.today.cap}`);
  setText($('me-today'), todayText(c.today));
  $('me-ring').classList.toggle('is-full', used >= 100);

  const now = Date.now();
  const has = c.vipUntil !== null && c.vipUntil > now;
  const pill = $('me-vip');
  pill.className = `purse-pill ${has ? 'is-on' : ''}`;
  pill.replaceChildren(icon('vip', 'pill-icon'), el('span', { textContent: whitelistText(c.vipUntil, now) }));

  const owned = c.shop.filter((item) => item.kind === 'title' && item.owned);
  $('me-title-pick').hidden = owned.length === 0;
  const select = $('me-title-select');
  select.disabled = busy;
  select.replaceChildren(
    el('option', { value: '', textContent: 'No title' }),
    ...owned.map((item) => el('option', { value: item.id, textContent: itemName(item), selected: c.title === itemName(item) })),
  );
  if (c.title === null) select.value = '';

  $('log-list').replaceChildren(
    ...(c.log.length === 0
      ? [el('li', { className: 'timeline-empty muted', textContent: 'Nothing yet. Go and seed.' })]
      : c.log.map((tx) => {
          const line = logLine(tx);
          return el(
            'li',
            { className: `timeline-item ${line.gain ? 'is-gain' : 'is-spend'}` },
            el('span', { className: 'timeline-dot', ariaHidden: 'true' }),
            el('span', { className: 'timeline-what', textContent: line.what }),
            el('span', { className: 'timeline-delta', textContent: line.delta }),
            el('span', { className: 'timeline-when muted', textContent: dayText(tx.at) }),
          );
        })),
  );
};

// ---- How it fits together ----

const renderSteps = () => {
  const { rates, prices } = info.info;
  const seeds = seedsForWeek(rates.seed, prices.vipWeek);
  const steps = [
    ['seed', 'Seed', `${rates.seed} for every seed. The server needs you most when it’s empty.`],
    ['play', 'Play', `Matches, wins and time on the server all pay a little, up to ${rates.activityCap} a day.`],
    ['mission', 'Do missions', 'Three a day and three a week. Finish one and it pays at once.'],
    ['vip', 'Spend', seeds === null ? `A week of whitelist is ${prices.vipWeek}.` : `A week of whitelist is ${prices.vipWeek}: about ${seeds} seeds.`],
  ];
  $('coins-steps').replaceChildren(
    ...steps.map(([name, title, text], i) =>
      el(
        'li',
        { className: 'coins-step' },
        el('span', { className: 'coins-step-n', textContent: String(i + 1) }),
        icon(name, 'coins-step-icon'),
        el('h3', { textContent: title }),
        el('p', { textContent: text }),
      ),
    ),
  );
};

// ---- Missions ----

const missionItem = (m, personal) => {
  const done = personal && m.done;
  return el(
    'li',
    { className: `mission tier-${m.tier}${done ? ' is-done' : ''}` },
    el(
      'div',
      { className: 'mission-top' },
      el('span', { className: 'mission-badge' }, done ? tick() : icon('mission', 'mission-icon')),
      el('div', { className: 'mission-body' }, el('span', { className: 'mission-tier', textContent: tierLabel(m.tier) }), el('span', { className: 'mission-text', textContent: m.text })),
      coinChip(`+${m.reward}`, 'mission-reward'),
    ),
    ...(personal
      ? [
          el('div', { className: 'mission-bar', ariaHidden: 'true' }, el('span', { className: 'mission-fill', style: `width: ${percent(m.progress, m.target)}%` })),
          el(
            'div',
            { className: 'mission-foot' },
            el('span', { className: 'mission-count', textContent: done ? 'Done, paid' : `${m.progress} of ${m.target}` }),
            ...(m.scope === 'day' && !done && mine.coins.rerolls.left > 0
              ? [
                  keyed(
                    el(
                      'button',
                      {
                        type: 'button',
                        className: 'btn btn-ghost btn-small btn-swap',
                        disabled: busy,
                        onclick: () => press(`reroll:${m.slot}`, { action: 'reroll', slot: m.slot }),
                      },
                      icon('swap', 'btn-icon'),
                      el('span', { textContent: armed === `reroll:${m.slot}` ? `Press again · ${mine.coins.rerolls.price}` : `Swap · ${mine.coins.rerolls.price}` }),
                    ),
                    `reroll:${m.slot}`,
                  ),
                ]
              : []),
          ),
        ]
      : []),
  );
};

const renderMissions = () => {
  const personal = mine?.coins ?? null;
  const day = personal ? personal.daily : (info?.info.missions.daily ?? []);
  const week = personal ? personal.weekly : (info?.info.missions.weekly ?? []);
  $('missions-day').replaceChildren(...day.map((m) => missionItem(m, personal !== null)));
  $('missions-week').replaceChildren(...week.map((m) => missionItem(m, personal !== null)));
  const now = Date.now();
  setText($('reset-day'), `Changes in ${untilReset('day', now)}`);
  setText($('reset-week'), `Changes in ${untilReset('week', now)}`);
  setText(
    $('missions-note'),
    personal
      ? `Finish one and it pays at once. You can swap a daily one that isn’t done for another of its kind (${personal.rerolls.left} swaps left today).`
      : 'The same for everyone. Sign in to track yours, and see what you’ve done.',
  );
};

// ---- The shop ----

const SHOP_ICON = { vip: 'vip', title: 'title', role: 'role' };

const shopCard = (item, personal, ctx) => {
  const pressable = personal && canPress(item);
  const key = `buy:${item.id}`;
  const best = item.id === 'vip-7' ? ctx.saving : null;
  const far = personal && !item.owned && !item.afford ? toGo(ctx.balance, item.price) : null;
  return el(
    'li',
    { className: `shop-card kind-${item.kind}${personal && item.owned ? ' is-owned' : ''}${best ? ' is-best' : ''}` },
    ...(best ? [el('span', { className: 'shop-flag', textContent: `Best value · ${best}` })] : []),
    ...(personal && item.owned && item.kind !== 'vip' ? [el('span', { className: 'shop-flag shop-flag-owned' }, tick(), el('span', { textContent: 'Yours' }))] : []),
    el('span', { className: 'shop-art' }, icon(SHOP_ICON[item.kind], 'shop-icon')),
    item.kind === 'title'
      ? el('span', { className: `title-preview tone-${titleTone(item.price)}`, textContent: itemName(item) })
      : el('h4', { className: 'shop-name', textContent: itemName(item) }),
    el('p', { className: 'shop-blurb', textContent: itemBlurb(item) }),
    el('p', { className: 'shop-price' }, coinChip(item.price)),
    ...(far
      ? [
          el('div', { className: 'shop-gap' }, el('span', { className: 'shop-gap-bar', ariaHidden: 'true' }, el('span', { style: `width: ${far.percent}%` })), el('span', { className: 'shop-gap-text', textContent: `${far.left.toLocaleString('en-GB')} to go` })),
        ]
      : []),
    ...(personal
      ? [
          keyed(
            el('button', {
              type: 'button',
              className: `btn btn-small shop-buy ${pressable ? 'btn-coin' : 'btn-ghost'}`,
              textContent: busy && armed === null && pending === key ? 'Working…' : buyLabel(item, armed === key),
              disabled: !pressable || busy,
              title: pressable ? '' : (item.reason ?? ''),
              onclick: () => press(key, { action: 'buy', item: item.id }),
            }),
            key,
          ),
        ]
      : []),
  );
};

const renderShop = () => {
  const personal = mine?.coins ?? null;
  const items = personal ? personal.shop : (info?.info.shop ?? []);
  const ctx = { saving: weekSaving(items), balance: personal?.balance ?? 0 };
  setText(
    $('shop-sub'),
    personal ? 'Press a button twice to buy. What you buy is paid for first, and given back if it can’t be delivered.' : 'Sign in and link your Steam account to buy.',
  );
  $('shop-groups').replaceChildren(
    ...shopGroups(items).map((group) =>
      el(
        'section',
        { className: `shop-group group-${group.kind}` },
        el('header', { className: 'shop-group-head' }, el('h3', { textContent: group.title }), el('p', { className: 'muted', textContent: group.note })),
        el('ul', { className: 'shop-grid' }, ...group.items.map((item) => shopCard(item, personal !== null, ctx))),
      ),
    ),
  );
};

// ---- Earning ----

const renderEarn = () => {
  const { rates, prices } = info.info;
  setText($('earn-sub'), 'Seeding pays the most, because it is what the server needs. Playing and missions pay a little.');
  $('earn-grid').replaceChildren(
    ...earnRows(rates).map((row) =>
      el(
        'li',
        { className: 'earn-card' },
        el('span', { className: 'earn-art' }, icon(row.icon, 'earn-icon')),
        el('p', { className: 'earn-pays', textContent: row.pays }),
        el('h4', { textContent: row.what }),
        el('p', { className: 'muted', textContent: row.note }),
      ),
    ),
  );
  const seeds = seedsForWeek(rates.seed, prices.vipWeek);
  setText(
    $('earn-fine'),
    `Playing, matches and seeding minutes pay up to ${rates.activityCap} a day between them; the seed itself and missions are on top. A week of whitelist is ${prices.vipWeek}${seeds === null ? '' : `, about ${seeds} seeds`}.`,
  );
  setText($('faq-ahead'), String(prices.vipAheadDays));
};

// ---- Top earners ----

const MEDAL = { 1: 'First', 2: 'Second', 3: 'Third' };

const podiumPlace = (row) =>
  row === null
    ? el('li', { className: 'podium-slot is-empty', ariaHidden: 'true' })
    : el(
        'li',
        { className: `podium-slot place-${row.place}` },
        el('span', { className: 'podium-medal', title: MEDAL[row.place], textContent: String(row.place) }),
        el('span', { className: 'podium-name' }, playerName(row)),
        ...(row.title ? [el('span', { className: 'chip chip-title', textContent: row.title })] : []),
        el('span', { className: 'podium-earned' }, coinChip(row.earned)),
      );

const renderLeaders = () => {
  const rows = info.leaders;
  setText($('leaders-note'), info.players > 0 ? `${info.players.toLocaleString('en-GB')} players have coins, holding ${info.held.toLocaleString('en-GB')} between them. Spending doesn’t cost you your place.` : '');
  if (rows.length === 0) {
    $('leaders').replaceChildren(el('p', { className: 'muted board-empty', textContent: 'Nobody has earned any yet. Go and seed.' }));
    return;
  }
  const { top, rest } = podium(rows);
  $('leaders').replaceChildren(
    el('ol', { className: 'podium' }, ...top.map(podiumPlace)),
    ...(rest.length === 0
      ? []
      : [
          el(
            'ol',
            { className: 'leader-list', start: 4 },
            ...rest.map((p) =>
              el(
                'li',
                { className: 'leader-row' },
                el('span', { className: 'leader-name' }, playerName(p), ...(p.title ? [el('span', { className: 'chip chip-title', textContent: p.title })] : [])),
                coinChip(p.earned),
              ),
            ),
          ),
        ]),
  );
};

// ---- Putting it together ----

const render = () => {
  if (info === null) return;
  const focused = document.activeElement?.getAttribute?.('data-focus-key') ?? null;
  $('coins-off').hidden = true;
  $('coins-body').hidden = false;
  renderFacts();
  renderPurse();
  renderSteps();
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
  if (demo) {
    toast('good', demoAct(body));
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
      toast('good', data.message);
    } else if (status === 401) {
      mine = null;
      toast('bad', 'You were signed out. Sign in again.');
    } else {
      toast('bad', data?.error ?? 'Could not do that just now. Try again in a minute.');
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
  const id = event.target.value === '' ? null : event.target.value;
  if (demo) {
    toast('good', 'Sample: title changed.');
    return;
  }
  busy = true;
  render();
  try {
    const { status, data } = await askBot('/api/account/coins', { method: 'POST', body: { action: 'title', id } });
    if (status === 200 && data?.ok) {
      mine = { enabled: true, linked: true, coins: data.coins };
      toast('good', data.message);
    } else toast('bad', data?.error ?? 'Could not do that just now.');
  } finally {
    busy = false;
    render();
  }
});

// Pressing anything else disarms a button.
document.addEventListener('click', (event) => {
  if (armed !== null && !event.target.closest('.shop-card button, .mission button')) {
    armed = null;
    render();
  }
});

const off = () => {
  $('coins-body').hidden = true;
  $('coins-off').hidden = false;
  $('hero-facts').replaceChildren();
  $('purse-art').replaceChildren(coinHeap());
};

if (arrived.error !== undefined) toast('bad', errorText(arrived.error));
// Before the numbers arrive, the purse shows the picture and the way in.
$('purse-art').replaceChildren(coinHeap());
if (!signedIn()) $('me-out').hidden = false;
$('me-sign-in').href = signInHref();

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
for (const a of document.querySelectorAll('#coins-body a[data-keep-query], .coins-purse a[data-keep-query]')) a.href = keepQuery(a.getAttribute('href'));
