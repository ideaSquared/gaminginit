import { shortName, sessionName } from './accountmodel.js';
import { configured, loadPlayerToken } from './accountsession.js';
import { el } from './views.js';

// The header's way to the account page, on every page: "Sign in", or the name they signed in as. It goes to the account
// page, which has the buttons and says what signing in gives, so no page but that one has to take a sign-in result.
// Nothing to show before the bot is connected, and nothing on the staff pages, which have their own bar.

const bar = document.querySelector('.nav-inner');
if (bar && configured && !document.body.classList.contains('staff')) {
  const token = loadPlayerToken();
  const name = token === null ? null : sessionName(token);
  const label = name === null ? 'Sign in' : shortName(name);
  const chip = el('a', { className: 'btn btn-ghost btn-small account-chip', href: 'account' });
  // A person icon, which is all there is room for on a phone, and the words (set as text: a name is never trusted as HTML).
  chip.innerHTML =
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.1 0-7.5 2.2-7.5 5v1.5h15V19c0-2.8-3.4-5-7.5-5Z" /></svg><span class="chip-text"></span>';
  chip.querySelector('.chip-text').textContent = label;
  chip.setAttribute('aria-label', name === null ? 'Sign in' : `Signed in as ${name}: your account`);
  if (name !== null) chip.title = `Signed in as ${name}`;
  if (new URL(chip.href).pathname.replace(/\.html$/, '').endsWith('/account')) chip.setAttribute('aria-current', 'page');
  // Before the Discord button, which is the last thing in the bar.
  bar.insertBefore(chip, bar.querySelector(':scope > .btn-discord'));
}

// Parts of a page for someone who is not signed in (a reason to sign in, in the right place): shown only then, and only once
// the bot is connected, so they never point at a sign-in that is not there.
const token = loadPlayerToken();
for (const node of document.querySelectorAll('[data-signed-out]')) node.hidden = !configured || token !== null;
