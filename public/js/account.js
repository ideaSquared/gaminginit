import { demoAccount } from './demo.js';
import { demo, keepQuery } from './live.js';
import { errorText, joinText, perkLines, steamText, vipText } from './accountmodel.js';
import { askBot, configured, forgetPlayerToken, loadPlayerToken, signInHref, steamHref, takeResult } from './accountsession.js';
import { el, setText } from './views.js';

// The account page: sign in with Discord (through the bot, see accountsession.js), see and change what the bot knows of you.
// The bot is the one that links Steam, gives roles and sends the VIP messages (its accounts.ts); this page is the way in.
// ?demo shows a signed-in sample, and its buttons only change the sample.

const $ = (id) => document.getElementById(id);

// What the bot sent the browser back with, taken at once so the session is kept and the address is tidy.
const arrived = takeResult();

let account = null;
// Two-step buttons: the first press arms it, the second does it.
let armed = null;

const flash = (kind, text) => {
  const box = $('account-flash');
  box.className = `account-flash account-flash-${kind}`;
  box.replaceChildren(text);
  box.hidden = false;
};

const status = (text) => setText($('account-status'), text);

const perks = (list) => list.map((text) => el('li', { textContent: text }));

const SIGNED_OUT_PERKS = [
  'Your Steam account linked, so the bot knows who you are in game.',
  'A role in the Discord, and a message there when your seeder VIP is earned, nearly over or ended.',
  'Your player page and your season, one tap away.',
  'Vote for the next map right on the website.',
];

const render = () => {
  const signedIn = account !== null;
  $('signed-out').hidden = signedIn;
  $('signed-in').hidden = !signedIn;
  setText($('account-note'), signedIn ? 'What the bot knows about you, and what you can change.' : 'Sign in with Discord to link your Steam account.');
  if (!signedIn) {
    $('signed-out-perks').replaceChildren(...perks(SIGNED_OUT_PERKS));
    $('sign-in').href = signInHref();
    $('sign-in-join').href = signInHref({ join: true });
    return;
  }
  setText($('account-name'), `Signed in as ${account.user.name}`);

  // The Discord server.
  const member = account.member;
  setText(
    $('discord-text'),
    member === true ? 'You are in the Discord server.' : member === false ? 'You are not in the Discord server yet.' : 'We could not check if you are in the Discord server just now.',
  );
  $('discord-actions').hidden = member !== false;
  $('join-discord').href = account.perks.join ? signInHref({ join: true }) : 'https://discord.gg/qsJFYGhSJ4';
  $('join-discord').dataset.src = 'account';

  // The Steam account.
  const linked = account.steam.linked;
  setText(
    $('steam-text'),
    linked
      ? `Your Steam account is linked${account.steam.via === 'steam' ? ' (you signed in with Steam)' : account.steam.via === 'discord' ? ' (from your Discord profile)' : ''}.`
      : 'No Steam account linked yet.',
  );
  $('link-steam').hidden = false;
  setText($('link-steam'), linked ? 'Link another with Steam' : 'Link with Steam');
  $('link-steam').href = steamHref();
  $('unlink-steam').hidden = !linked;
  setText($('unlink-steam'), armed === 'unlink' ? 'Press again to unlink' : 'Unlink');
  $('steam-help').hidden = linked;

  // VIP, and the pages that need a Steam account.
  $('row-vip').hidden = !linked;
  setText($('vip-text'), vipText(account.vip, Date.now()));
  $('row-pages').hidden = !(linked && account.playerId);
  if (account.playerId) {
    $('my-player').href = keepQuery(`player?id=${account.playerId}`);
    $('my-season').href = keepQuery(`season?player=${account.playerId}`);
  }

  // Settings.
  $('alerts-label').hidden = !account.perks.messages || !linked;
  $('alerts').checked = account.alerts;
  $('private-label').hidden = !linked;
  $('private').checked = account.private.on;
  $('private').disabled = account.private.on && !account.private.byYou;
  const note = $('private-note');
  note.hidden = !(account.private.on && !account.private.byYou);
  setText(note, 'Staff made this profile private. Ask them in the Discord to change it.');

  $('signed-in-perks').replaceChildren(...perks(perkLines(account.perks)));
  setText($('forget'), armed === 'forget' ? 'Press again to delete' : 'Delete my account');
};

const load = async () => {
  if (demo) {
    account = demoAccount(Date.now());
    return;
  }
  if (loadPlayerToken() === null) {
    account = null;
    return;
  }
  status('Loading your account…');
  const { status: code, data } = await askBot('/api/account');
  status('');
  if (code === 200 && data !== null) account = data;
  else {
    account = null;
    if (code !== 401) status('Could not load your account just now. Try again in a minute.');
  }
};

// Asks the bot to do something, or in ?demo pretends to. Resolves to an error message, or null when it worked.
const act = async (body) => {
  if (demo) {
    if (body.action === 'alerts') account.alerts = body.on;
    if (body.action === 'private') account.private = { on: body.on, byYou: true };
    if (body.action === 'unlink') account = { ...account, steam: { linked: false, via: null }, playerId: null, vip: null };
    if (body.action === 'forget') account = null;
    return null;
  }
  const { status: code, data } = await askBot('/api/account', { method: 'POST', body });
  if (code === 200) return null;
  if (code === 401) {
    account = null;
    return 'You were signed out. Sign in again.';
  }
  return data?.error ?? 'Could not do that just now. Try again in a minute.';
};

const reload = async () => {
  await load();
  render();
};

const settings = (text) => setText($('settings-status'), text);

$('alerts').addEventListener('change', async (event) => {
  const on = event.target.checked;
  const problem = await act({ action: 'alerts', on });
  settings(problem ?? (on ? 'You will get the messages.' : 'No more messages.'));
  if (problem !== null) await reload();
  else account.alerts = on;
});

$('private').addEventListener('change', async (event) => {
  const on = event.target.checked;
  const problem = await act({ action: 'private', on });
  settings(problem ?? (on ? 'Your player page is private. It can take a minute to go from the site.' : 'Your player page is public again.'));
  await reload();
});

$('unlink-steam').addEventListener('click', async () => {
  if (armed !== 'unlink') {
    armed = 'unlink';
    render();
    return;
  }
  armed = null;
  const problem = await act({ action: 'unlink' });
  await reload();
  if (problem !== null) flash('bad', problem);
  else flash('good', 'Your Steam account is unlinked. The roles will be taken back within a few minutes.');
});

$('forget').addEventListener('click', async () => {
  if (armed !== 'forget') {
    armed = 'forget';
    render();
    return;
  }
  armed = null;
  const problem = await act({ action: 'forget' });
  if (problem !== null) {
    flash('bad', problem);
    return;
  }
  forgetPlayerToken();
  account = null;
  render();
  flash('good', 'Your account is deleted.');
});

$('sign-out').addEventListener('click', () => {
  forgetPlayerToken();
  account = null;
  armed = null;
  render();
  flash('good', 'You are signed out.');
});

// Pressing anything else disarms the two-step buttons.
document.addEventListener('click', (event) => {
  if (armed !== null && !event.target.closest('#unlink-steam, #forget')) {
    armed = null;
    if (account !== null) render();
  }
});

const start = async () => {
  if (!configured && !demo) {
    $('signed-out').hidden = true;
    status('Sign-in is not connected yet.');
    return;
  }
  if (arrived.error !== undefined) flash('bad', errorText(arrived.error));
  await load();
  // Steam vouched for an account: the session it comes back with is the one that links it.
  if (arrived.steamproof !== undefined) {
    if (account === null) flash('bad', 'Sign in with Discord first, then link your Steam account.');
    else {
      const problem = await act({ action: 'steam', proof: arrived.steamproof });
      if (problem !== null) flash('bad', problem);
      else flash('good', 'Your Steam account is linked.');
      await load();
    }
  }
  render();
  // What the sign-in did, said once: whether they were added to the Discord, and what was found of their Steam account.
  const said = [arrived.join && arrived.join !== 'no' ? joinText(arrived.join) : null, arrived.steam ? steamText(arrived.steam) : null].filter(Boolean);
  if (said.length > 0 && arrived.error === undefined && arrived.steamproof === undefined) {
    flash(said.some((s) => s.kind === 'bad') ? 'bad' : 'good', said.map((s) => s.text).join(' '));
  }
};

start();
