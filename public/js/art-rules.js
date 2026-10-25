// A small icon for each rule on the rules page, chosen from the rule's own title. The title only selects a picture; the
// pictures are constants written here. A rule this table does not know gets the shield-check fallback.

const NS = 'http://www.w3.org/2000/svg';

// Each icon is the inside of a 24x24 stroked icon.
const ICONS = {
  cheat: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  exploit: '<path d="M9 7a3 3 0 0 1 6 0v1H9zM7 11h10v3a5 5 0 0 1-10 0zM3 9l4 2M21 9l-4 2M3 17l4-2M21 17l-4-2M12 11v8"/>',
  teamkill: '<circle cx="9" cy="8" r="2.6"/><circle cx="16.5" cy="9" r="2.2"/><path d="M4 19v-2a5 5 0 0 1 10 0v2M15 14.5a4 4 0 0 1 5 3.5v1"/><path class="art-strike" d="M3.5 3.5l17 17"/>',
  crate: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/><path class="art-strike" d="M5 20L19 4"/>',
  launcher: '<path d="M3 11h11l2-2h5v5h-5l-2-2H8l-1 4H4l1-5"/><path class="art-strike" d="M4 21L20 3"/>',
  grief: '<path d="M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1 2 2 2 0-3-.5-5 1-8z"/>',
  hate: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 9l6 4M15 9l-6 4"/>',
  abuse: '<path d="M4 5h16v11H9l-5 4z"/><path d="M12 8.5v3.5M12 14v.5"/>',
  seeding: '<rect x="4" y="3" width="16" height="12" rx="2"/><path d="M8 7.5h.01M12 7.5h.01M16 7.5h.01M8 11h.01M12 11h.01M10 15v3M14 15v3M7 20h10"/>',
  fallback: '<path d="M12 3l8 3v6c0 4.5-3.4 7.6-8 9-4.6-1.4-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
};

// Words in a rule's title that pick an icon, checked in order, so "No team kills" is not read as "kills" alone.
const LOOKUP = [
  [/team\s*-?kill|\btk\b|friendly/i, 'teamkill'],
  [/crate|\bhq\b/i, 'crate'],
  [/grenade|launcher|\bgls?\b/i, 'launcher'],
  [/cheat|hack|aimbot/i, 'cheat'],
  [/exploit|glitch|bug/i, 'exploit'],
  [/grief|troll/i, 'grief'],
  [/racis|hate|slur/i, 'hate'],
  [/abus|toxic|respect|chat|decen/i, 'abuse'],
  [/seed|fair/i, 'seeding'],
];

export const ruleIconKey = (title) => LOOKUP.find(([pattern]) => pattern.test(String(title ?? '')))?.[1] ?? 'fallback';

export const ruleIcon = (title) => {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'art-rule');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = ICONS[ruleIconKey(title)];
  return svg;
};

// On the rules page: give each rule card the icon its title picks. The titles are read, never written.
if (typeof document !== 'undefined') {
  for (const card of document.querySelectorAll('.rule')) {
    const holder = card.querySelector('.rule-icon');
    const title = card.querySelector('.rule-title')?.textContent;
    if (holder && title) holder.replaceChildren(ruleIcon(title));
  }
}
