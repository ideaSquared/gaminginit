import { placeOf } from './accountmodel.js';
import { botUrl, configured } from './session.js';

// The Discord invite on every page, sent through the bot so it can count the click by place (see the bot's discordclicks.ts):
// the website has no analytics of its own, and this is how we learn which buttons bring people in. Without JavaScript, or
// before the bot is connected, the link is the invite itself. ?demo leaves them alone, so a preview counts nothing.

const demo = new URLSearchParams(location.search).has('demo');

const page = (location.pathname.split('/').filter(Boolean).pop() ?? 'home').replace(/\.html$/, '') || 'home';
if (configured && !demo) {
  for (const a of document.querySelectorAll('a[href^="https://discord.gg/"]')) {
    a.href = botUrl(`/go/discord?src=${placeOf(page, a.dataset.src)}`);
  }
}
