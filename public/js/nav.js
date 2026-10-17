import { demoStats } from './demo.js';
import { apiUrl, demo } from './live.js';
import { serverChip, voteOpen } from './navmodel.js';

// The site header on every page: the menu (a button on phones, groups that open on a click from 920px), and a server
// chip and a "vote open" flag that say what is happening now, so there is a reason to come back from any page.

const header = document.querySelector('.nav');
if (header) {
  // Without this the CSS shows every link, so the header still works with no script.
  header.classList.add('nav-js');

  const toggle = header.querySelector('.nav-toggle');
  const menu = header.querySelector('.nav-sections');
  const groups = [...header.querySelectorAll('.nav-group')];
  const wide = matchMedia('(min-width: 920px)');

  const setOpen = (group, open) => {
    group.querySelector('.nav-group-btn').setAttribute('aria-expanded', String(open));
    group.toggleAttribute('data-open', open);
  };
  const closeGroups = (except = null) => {
    for (const group of groups) if (group !== except) setOpen(group, false);
  };
  const setMenu = (open) => {
    header.toggleAttribute('data-menu-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
  };

  // The group holding this page's link reads as current when it is closed.
  for (const group of groups) group.toggleAttribute('data-current', group.querySelector('[aria-current]') !== null);

  toggle?.addEventListener('click', () => setMenu(!header.hasAttribute('data-menu-open')));

  for (const group of groups) {
    const button = group.querySelector('.nav-group-btn');
    button.addEventListener('click', () => {
      const open = !group.hasAttribute('data-open');
      closeGroups(group);
      setOpen(group, open);
    });
    // Down opens the group and moves into it, like a native menu button.
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      closeGroups(group);
      setOpen(group, true);
      group.querySelector('.nav-sub a')?.focus();
    });
    // Tabbing out of the last link closes the group instead of leaving it hanging open over the page.
    group.addEventListener('focusout', (event) => {
      if (!group.contains(event.relatedTarget)) setOpen(group, false);
    });
  }

  document.addEventListener('pointerdown', (event) => {
    if (!header.contains(event.target)) {
      closeGroups();
      setMenu(false);
    } else if (!event.target.closest('.nav-group')) {
      closeGroups();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = groups.find((group) => group.hasAttribute('data-open'));
    if (open) {
      // Back to the button, so keyboard focus is not lost when the links it was on disappear.
      if (open.contains(document.activeElement)) open.querySelector('.nav-group-btn').focus();
      closeGroups();
    } else if (header.hasAttribute('data-menu-open')) {
      setMenu(false);
      if (menu?.contains(document.activeElement) || header.contains(document.activeElement)) toggle?.focus();
    }
  });

  // Tabbing out of the open panel would leave it covering the page, so it closes. Focus moving between the header's
  // own controls, or the window losing focus, does not.
  header.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
  });

  wide.addEventListener('change', () => {
    closeGroups();
    setMenu(false);
  });

  // The server chip and the vote flag.
  const chip = document.getElementById('nav-status');
  const flagged = [toggle, ...groups.map((group) => group.querySelector('.nav-group-btn'))].filter(Boolean);
  const voteLink = menu?.querySelector('[data-vote-link]');
  const voteGroup = voteLink?.closest('.nav-group');
  const plainLabel = new Map(flagged.map((button) => [button, button.getAttribute('aria-label') ?? button.textContent.trim()]));

  const showChip = (stats) => {
    if (!chip) return;
    const state = serverChip(stats, Date.now());
    chip.hidden = state === null;
    if (state === null) return;
    chip.dataset.kind = state.kind;
    chip.title = state.title;
    chip.querySelector('.nav-status-label').textContent = state.label;
    const count = chip.querySelector('.nav-status-count');
    count.textContent = state.count;
    count.hidden = state.count === '';
  };

  // The vote as last read. Its deadline is known, so the flag clears on time even when a refresh fails.
  let lastVote = null;
  const showVote = (vote) => {
    lastVote = vote;
    const open = voteOpen(vote, Date.now());
    voteLink?.toggleAttribute('data-open', open);
    voteGroup?.toggleAttribute('data-alert', open);
    toggle?.toggleAttribute('data-alert', open);
    // The dot is only colour, so say it too. The name still starts with the visible text.
    for (const button of [toggle, voteGroup?.querySelector('.nav-group-btn')]) {
      if (button) button.setAttribute('aria-label', open ? `${plainLabel.get(button)}, map vote open` : plainLabel.get(button));
    }
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  };

  const REFRESH_MS = 60_000;
  const EXPIRY_MS = 10_000;
  const statsUrl = apiUrl('stats');
  const voteUrl = apiUrl('/api/vote');

  const load = async () => {
    if (demo) {
      showChip(demoStats(Date.now()));
      showVote({ open: true, closesAt: Date.now() + 30 * 60_000, winner: null, closedAt: null });
      return;
    }
    // Each is on its own: a bot without the vote still gets the chip, and the other way round. A failure keeps what
    // is showing, and the chip stays hidden until there has been a reading.
    const [stats, vote] = await Promise.allSettled([fetchJson(statsUrl), fetchJson(voteUrl)]);
    if (stats.status === 'fulfilled') showChip(stats.value);
    if (vote.status === 'fulfilled') showVote(vote.value.vote ?? null);
    else if (vote.reason?.message === '404') showVote(null);
  };

  if (demo || statsUrl !== '') {
    let timer = 0;
    let loading = false;
    // Coming back to the tab while a load is still out asks for nothing more, so an older response can never land
    // after a newer one, and there is only ever one timer.
    const tick = async () => {
      clearTimeout(timer);
      if (!document.hidden && !loading) {
        loading = true;
        try {
          await load();
        } finally {
          loading = false;
        }
      }
      clearTimeout(timer);
      timer = setTimeout(tick, REFRESH_MS);
    };
    tick();
    setInterval(() => showVote(lastVote), EXPIRY_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
  }
}
