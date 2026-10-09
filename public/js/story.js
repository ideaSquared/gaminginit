import { el, setText, sideName } from './views.js';
import { readableColour, sideKey } from './format.js';
import { createMusic, supported as musicSupported } from './music.js';

// The Season in Review's slideshow: a story of slides (see wrapped.js) in a dialog over the page, one slide at a time,
// like a year in review. Tap or click the right of a slide (or Next, →, Space) for the next one, the left (or Back, ←)
// for the one before, swipe on a phone, Home and End for the first and last, and Esc or ✕ to close. Nothing moves on its
// own unless someone presses Autoplay (off by default, and never on for people who ask for less motion), so everyone
// reads at their own pace. Numbers count up, the background drifts and the last slide throws confetti, all switched off
// for people who ask for less motion. Each new slide is read out by screen readers.

const motion = () => window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => motion().matches;
const AUTOPLAY_MS = 6500;
const MUSIC_KEY = 'story-music';

// Whether the listener left the music on last time. Storage can be blocked, so it is only ever a convenience.
const musicWanted = () => {
  try {
    return localStorage.getItem(MUSIC_KEY) === 'on';
  } catch {
    return false;
  }
};
const rememberMusic = (on) => {
  try {
    localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered, which is fine.
  }
};

// A control's icon, with its words hidden on a phone, where the bar is tight.
const chipText = (node, icon, label) => node.replaceChildren(el('span', { ariaHidden: 'true', textContent: icon }), el('span', { className: 'story-label', textContent: ` ${label}` }));

// "1,234" or "2.50" count up from zero; anything else ("Fri 3 Oct", "GG", "#3") is shown as it is.
const COUNTABLE = /^\d[\d,]*(\.\d+)?$/;
const countUp = (node, text) => {
  if (!COUNTABLE.test(text) || reduced()) return;
  const target = Number(text.replaceAll(',', ''));
  if (!Number.isFinite(target) || target < 2) return;
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  const grouped = text.includes(',');
  const format = (n) => n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped });
  const started = performance.now();
  const duration = Math.min(1600, 700 + String(Math.round(target)).length * 160);
  const step = (now) => {
    if (!node.isConnected) return;
    const t = Math.min(1, (now - started) / duration);
    node.textContent = format(target * (1 - (1 - t) ** 4));
    if (t < 1) requestAnimationFrame(step);
  };
  node.textContent = format(0);
  requestAnimationFrame(step);
};

// The big number: its final value for screen readers, and the counting one for everyone else.
const bigNode = (text) => {
  const shown = el('span', { ariaHidden: 'true', textContent: text });
  const node = el('p', { className: 'slide-big' }, shown, el('span', { className: 'visually-hidden', textContent: text }));
  node.countUp = () => countUp(shown, text);
  return node;
};

// Confetti for the last slide: coloured scraps that fall once. Plain elements moved by CSS.
const CONFETTI = ['#4fd6cc', '#fab219', '#f472b6', '#a78bfa', '#60a5fa', '#fff'];
const confetti = () => {
  const root = el('div', { className: 'confetti', ariaHidden: 'true' });
  for (let i = 0; i < 46; i += 1) {
    const bit = el('span');
    bit.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
    bit.style.setProperty('--drift', `${Math.round(Math.random() * 120 - 60)}px`);
    bit.style.setProperty('--delay', `${Math.round(Math.random() * 700)}ms`);
    bit.style.setProperty('--fall', `${2200 + Math.round(Math.random() * 1800)}ms`);
    bit.style.setProperty('--spin', `${Math.round(360 + Math.random() * 720)}deg`);
    bit.style.setProperty('--colour', CONFETTI[i % CONFETTI.length]);
    root.append(bit);
  }
  return root;
};

// The page behind can't scroll while the story is open, so a swipe never moves it.
const lockPage = (locked) => {
  document.documentElement.classList.toggle('story-open', locked);
};

// The slide's player or team, as the story names them. Plain text, never a link: a tap on the slide moves the story on.
const named = (slide) => {
  if (slide.team) {
    const colours = new Map();
    const colour = readableColour(slide.team.colorHex, '#0b0d10');
    if (colour) colours.set(sideKey(slide.team.name), colour);
    return el('p', { className: 'slide-who slide-team' }, sideName(slide.team.name, colours));
  }
  return slide.who ? el('p', { className: 'slide-who', textContent: slide.who.name }) : null;
};

const slideNode = (slide, index, count) => {
  const node = el(
    'article',
    { className: slide.list?.length ? 'slide slide-listed' : 'slide', ariaLabel: `${index + 1} of ${count}` },
    slide.emoji ? el('p', { className: 'slide-emoji', ariaHidden: 'true', textContent: slide.emoji }) : null,
    el('h2', { className: 'slide-kicker', textContent: slide.kicker }),
    named(slide),
    slide.big ? bigNode(slide.big) : null,
    slide.unit ? el('p', { className: 'slide-unit', textContent: slide.unit }) : null,
    slide.list?.length
      ? el(
          'ul',
          { className: 'slide-list' },
          ...slide.list.map((row, i) =>
            el(
              'li',
              { className: row.who ? '' : 'slide-list-plain', style: `--i: ${i}` },
              el('span', { className: 'slide-list-label', textContent: row.label }),
              row.who ? el('span', { className: 'slide-list-who', textContent: row.who.name }) : null,
              el('span', { className: 'slide-list-value', textContent: row.value }),
            ),
          ),
        )
      : null,
    slide.line ? el('p', { className: 'slide-line', textContent: slide.line }) : null,
    slide.small ? el('p', { className: 'slide-small', textContent: slide.small }) : null,
  );
  node.querySelector('.slide-big')?.countUp();
  return node;
};

let dialog = null;

// Opens a story. `title` names it for screen readers and at the top; `actions(close)` gives the buttons for the last
// slide; `onClose` runs when it closes.
export const openStory = (slides, { title, actions = () => [], onClose = () => {} }) => {
  dialog?.remove();
  let index = 0;
  const progress = el('ol', { className: 'story-progress', ariaHidden: 'true' }, ...slides.map(() => el('li', {}, el('span'))));
  const count = el('p', { className: 'story-count' });
  const stage = el('div', { className: 'story-stage', ariaLive: 'polite' });
  const back = el('button', { type: 'button', className: 'story-step story-back', textContent: '‹ Back' });
  const next = el('button', { type: 'button', className: 'story-step story-next', textContent: 'Next ›' });
  const close = el('button', { type: 'button', className: 'story-close', ariaLabel: 'Close', textContent: '✕' });
  const auto = el('button', { type: 'button', className: 'story-auto', ariaPressed: 'false', ariaLabel: 'Autoplay' });
  chipText(auto, '▶', 'Autoplay');
  const musicButton = el('button', { type: 'button', className: 'story-auto story-music', ariaPressed: 'false', ariaLabel: 'Play music' });
  chipText(musicButton, '♪', 'Music');
  const orbs = el('div', { className: 'story-orbs', ariaHidden: 'true' }, el('span'), el('span'), el('span'));
  const card = el(
    'div',
    { className: 'story-card' },
    orbs,
    progress,
    el('div', { className: 'story-bar' }, el('p', { className: 'story-title', textContent: title }), musicSupported() ? musicButton : null, auto, close),
    stage,
    el('div', { className: 'story-nav' }, back, count, next),
  );
  dialog = el('dialog', { className: 'story', ariaLabel: title }, card);
  document.body.append(dialog);

  let previous = 0;
  let shown = false;
  let timer = 0;
  let playing = false;
  // Autoplay moves on after a while, and stops on the last slide or when anyone moves by hand.
  const restartTimer = () => {
    clearTimeout(timer);
    card.classList.toggle('autoplaying', playing && index < slides.length - 1);
    if (playing && index < slides.length - 1) {
      card.style.setProperty('--slide-ms', `${AUTOPLAY_MS}ms`);
      timer = setTimeout(() => (document.hidden ? restartTimer() : show(index + 1)), AUTOPLAY_MS);
    } else if (playing) {
      setAuto(false);
    }
  };
  const setAuto = (on) => {
    playing = on;
    auto.ariaPressed = String(on);
    chipText(auto, on ? '⏸' : '▶', on ? 'Pause' : 'Autoplay');
    auto.ariaLabel = on ? 'Pause autoplay' : 'Autoplay';
    restartTimer();
  };
  auto.addEventListener('click', () => setAuto(!playing));
  // Autoplay is for people who haven't asked for less motion, even if they ask while the story is open.
  const lessMotion = motion();
  const checkMotion = () => {
    auto.hidden = lessMotion.matches;
    if (lessMotion.matches) setAuto(false);
  };
  lessMotion.addEventListener('change', checkMotion);
  auto.hidden = lessMotion.matches;

  // The music is optional: off until someone turns it on (and then on again next time, until they turn it off).
  const music = musicSupported() ? createMusic() : null;
  const setMusic = (on) => {
    if (on) music.start();
    else music.stop();
    musicButton.ariaPressed = String(on);
    musicButton.ariaLabel = on ? 'Turn music off' : 'Play music';
    chipText(musicButton, on ? '♫' : '♪', on ? 'Music on' : 'Music');
    rememberMusic(on);
  };
  musicButton.addEventListener('click', () => setMusic(!music.playing));
  const onVisibility = () => (document.hidden ? music?.pause() : music?.resume());
  document.addEventListener('visibilitychange', onVisibility);

  const show = (to) => {
    index = Math.max(0, Math.min(slides.length - 1, to));
    const slide = slides[index];
    card.dataset.theme = slide.theme;
    if (slide.theme === 'team') card.style.setProperty('--team', slide.team?.colorHex ?? 'var(--accent)');
    else card.style.removeProperty('--team');
    const node = slideNode(slide, index, slides.length);
    if (slide.end) node.append(el('div', { className: 'slide-actions' }, ...actions(() => dialog.close())));
    card.querySelector('.confetti')?.remove();
    if (slide.end && !reduced()) card.append(confetti());
    card.dataset.direction = to < previous ? 'back' : 'forward';
    stage.replaceChildren(node);
    previous = index;
    if (shown) music?.cue();
    shown = true;
    restartTimer();
    [...progress.children].forEach((li, i) => {
      li.classList.toggle('seen', i < index);
      li.classList.toggle('now', i === index);
    });
    setText(count, `${index + 1} / ${slides.length}`);
    back.disabled = index === 0;
    next.hidden = index === slides.length - 1;
  };

  const byHand = (to) => {
    if (playing) setAuto(false);
    show(to);
  };
  back.addEventListener('click', () => byHand(index - 1));
  next.addEventListener('click', () => byHand(index + 1));
  close.addEventListener('click', () => dialog.close());
  // A sideways swipe of 50px or more, more sideways than up or down. The click a swipe can end with doesn't count too.
  let from = null;
  let swiped = false;
  stage.addEventListener('pointerdown', (event) => {
    from = { x: event.clientX, y: event.clientY };
    swiped = false;
  });
  stage.addEventListener('pointercancel', () => {
    from = null;
  });
  stage.addEventListener('pointerup', (event) => {
    if (from === null) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    from = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    swiped = true;
    byHand(index + (dx < 0 ? 1 : -1));
  });
  // A tap on the left third goes back, anywhere else on the slide forward. Not on the last slide's buttons.
  stage.addEventListener('click', (event) => {
    if (swiped) {
      swiped = false;
      return;
    }
    if (event.target.closest('a, button')) return;
    const box = stage.getBoundingClientRect();
    byHand(event.clientX - box.left < box.width / 3 ? index - 1 : index + 1);
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.target.closest('a, input')) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1, PageDown: 1, PageUp: -1 };
    if (event.key in moves) byHand(index + moves[event.key]);
    else if (event.key === 'Home') byHand(0);
    else if (event.key === 'End') byHand(slides.length - 1);
    else if (event.key === ' ' && !event.target.closest('button')) byHand(index + 1);
    else return;
    event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    clearTimeout(timer);
    lessMotion.removeEventListener('change', checkMotion);
    document.removeEventListener('visibilitychange', onVisibility);
    music?.close();
    lockPage(false);
    dialog.remove();
    dialog = null;
    onClose();
  });

  show(0);
  lockPage(true);
  dialog.showModal();
  next.focus();
  // Opening the story was a tap or click, which is what lets the browser play sound.
  if (music && musicWanted()) setMusic(true);
};
