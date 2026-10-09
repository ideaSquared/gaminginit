import { el, setText, sideName } from './views.js';
import { readableColour, sideKey } from './format.js';

// The Season in Review's slideshow: a story of slides (see wrapped.js) in a dialog over the page, one slide at a time,
// like a year in review. Tap or click the right of a slide (or Next, →, Space) for the next one, the left (or Back, ←)
// for the one before, swipe on a phone, Home and End for the first and last, and Esc or ✕ to close. Nothing moves on its
// own, so everyone reads at their own pace. Each new slide is read out by screen readers.

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
    slide.big ? el('p', { className: 'slide-big', textContent: slide.big }) : null,
    slide.unit ? el('p', { className: 'slide-unit', textContent: slide.unit }) : null,
    slide.list?.length
      ? el(
          'ul',
          { className: 'slide-list' },
          ...slide.list.map((row) =>
            el(
              'li',
              { className: row.who ? '' : 'slide-list-plain' },
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
  const card = el(
    'div',
    { className: 'story-card' },
    progress,
    el('div', { className: 'story-bar' }, el('p', { className: 'story-title', textContent: title }), close),
    stage,
    el('div', { className: 'story-nav' }, back, count, next),
  );
  dialog = el('dialog', { className: 'story', ariaLabel: title }, card);
  document.body.append(dialog);

  const show = (to) => {
    index = Math.max(0, Math.min(slides.length - 1, to));
    const slide = slides[index];
    card.dataset.theme = slide.theme;
    if (slide.theme === 'team') card.style.setProperty('--team', slide.team?.colorHex ?? 'var(--accent)');
    else card.style.removeProperty('--team');
    const node = slideNode(slide, index, slides.length);
    if (slide.end) node.append(el('div', { className: 'slide-actions' }, ...actions(() => dialog.close())));
    stage.replaceChildren(node);
    [...progress.children].forEach((li, i) => {
      li.classList.toggle('seen', i < index);
      li.classList.toggle('now', i === index);
    });
    setText(count, `${index + 1} / ${slides.length}`);
    back.disabled = index === 0;
    next.hidden = index === slides.length - 1;
  };

  back.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
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
    show(index + (dx < 0 ? 1 : -1));
  });
  // A tap on the left third goes back, anywhere else on the slide forward. Not on the last slide's buttons.
  stage.addEventListener('click', (event) => {
    if (swiped) {
      swiped = false;
      return;
    }
    if (event.target.closest('a, button')) return;
    const box = stage.getBoundingClientRect();
    show(event.clientX - box.left < box.width / 3 ? index - 1 : index + 1);
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.target.closest('a, input')) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1, PageDown: 1, PageUp: -1 };
    if (event.key in moves) show(index + moves[event.key]);
    else if (event.key === 'Home') show(0);
    else if (event.key === 'End') show(slides.length - 1);
    else if (event.key === ' ' && !event.target.closest('button')) show(index + 1);
    else return;
    event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    lockPage(false);
    dialog.remove();
    dialog = null;
    onClose();
  });

  show(0);
  lockPage(true);
  dialog.showModal();
  next.focus();
};
