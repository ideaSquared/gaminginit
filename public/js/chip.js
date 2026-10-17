import { shortName, sessionName } from './accountmodel.js';
import { configured, loadPlayerToken, SESSION_EVENT } from './accountsession.js';
import { el } from './views.js';

// The header's way to the account page, on every page: "Sign in", or the name they signed in as. It goes to the account
// page, which has the buttons and says what signing in gives, so no page but that one has to take a sign-in result.
// Nothing to show before the bot is connected, and nothing on the staff pages, which have their own bar. It follows the
// session: the account and vote pages take a sign-in after this has loaded, and signing out or deleting the account changes it.

const bar = document.querySelector('.nav-inner');
const chip =
  bar && configured && !document.body.classList.contains('staff')
    ? el('a', { className: 'btn btn-ghost btn-small account-chip', href: 'account' })
    : null;

if (chip !== null) {
  // A person icon, which is all there is room for on a phone, and the words (set as text: a name is never trusted as HTML).
  chip.innerHTML =
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.1 0-7.5 2.2-7.5 5v1.5h15V19c0-2.8-3.4-5-7.5-5Z" /></svg><span class="chip-text"></span>';
  // The current page, not where the link goes (which is always the account page).
  if (location.pathname.replace(/\.html$/, '').endsWith('/account')) chip.setAttribute('aria-current', 'page');
  // Before the Discord button, which is the last thing in the bar.
  bar.insertBefore(chip, bar.querySelector(':scope > .btn-discord'));
}

// On a phone the header has no room for it, so it is in the menu panel, above the Discord button (see the CSS).
const panelItem = chip === null ? null : el('li', { className: 'nav-panel-account' }, el('a', { className: 'btn btn-ghost', href: 'account' }));
if (panelItem !== null) {
  const cta = document.querySelector('.nav-panel-cta');
  if (cta) cta.before(panelItem);
  else panelItem.remove();
}

// What is shown for whoever is signed in now: the chip, and the parts of a page for someone who is not (a reason to sign in,
// in the right place), shown only then and only once the bot is connected, so they never point at a sign-in that is not there.
const refresh = () => {
  const token = loadPlayerToken();
  const name = token === null ? null : sessionName(token);
  if (chip !== null) {
    chip.querySelector('.chip-text').textContent = name === null ? 'Sign in' : shortName(name);
    chip.setAttribute('aria-label', name === null ? 'Sign in' : `Signed in as ${name}: your account`);
    if (name === null) chip.removeAttribute('title');
    else chip.title = `Signed in as ${name}`;
    const panelLink = panelItem?.querySelector('a');
    if (panelLink) panelLink.textContent = name === null ? 'Sign in' : `Signed in as ${shortName(name, 24)}`;
  }
  for (const node of document.querySelectorAll('[data-signed-out]')) node.hidden = !configured || token !== null;
};

refresh();
addEventListener(SESSION_EVENT, refresh);
