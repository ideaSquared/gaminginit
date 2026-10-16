import { el } from './views.js';

// The command search, Ctrl K or Search in the staff bar: one box to go to any section, run any staff command or open
// any player's panel. `items(query)` gives what matches now ({ group, label, note, run }), and `find(query)` resolves to
// more from the bot, such as players, after a short wait. ↑ and ↓ move, Enter or a click runs one and closes the box,
// and Escape closes it.

// Wait this long after typing stops before asking the bot.
const FIND_DELAY_MS = 200;

// Whether every word typed is in the text, in any case: "ban" finds Ban and Unban, "next map" Set the next map.
export const matches = (text, query) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
};

export const createPalette = ({ dialog, input, list, items, find = async () => [] }) => {
  let shown = [];
  let active = 0;
  let generation = 0;
  let timer = 0;

  const mark = () => {
    for (const node of list.querySelectorAll('[role="option"]')) node.setAttribute('aria-selected', String(Number(node.dataset.index) === active));
    const current = list.querySelector(`[data-index="${active}"]`);
    current?.scrollIntoView({ block: 'nearest' });
    if (current) input.setAttribute('aria-activedescendant', current.id);
    else input.removeAttribute('aria-activedescendant');
  };

  const draw = () => {
    const nodes = [];
    let group = null;
    shown.forEach((item, i) => {
      if (item.group !== group) {
        group = item.group;
        nodes.push(el('li', { className: 'palette-group', role: 'presentation', textContent: group }));
      }
      const node = el(
        'li',
        { className: 'palette-item', id: `palette-item-${i}`, role: 'option' },
        el('span', { className: 'palette-label', textContent: item.label }),
        item.note ? el('span', { className: 'palette-note', textContent: item.note }) : null,
      );
      node.dataset.index = String(i);
      node.addEventListener('click', () => run(i));
      node.addEventListener('mousemove', () => {
        if (active === i) return;
        active = i;
        mark();
      });
      nodes.push(node);
    });
    if (nodes.length === 0) nodes.push(el('li', { className: 'palette-empty muted', role: 'presentation', textContent: 'Nothing matches. Try fewer words.' }));
    list.replaceChildren(...nodes);
    mark();
  };

  const update = () => {
    const query = input.value.trim();
    shown = items(query);
    active = 0;
    draw();
    clearTimeout(timer);
    const mine = ++generation;
    if (query.length < 2) return;
    timer = setTimeout(async () => {
      const more = await find(query).catch(() => []);
      if (mine !== generation || !dialog.open) return;
      shown = [...items(query), ...more];
      draw();
    }, FIND_DELAY_MS);
  };

  const run = (i) => {
    const item = shown[i];
    if (!item) return;
    dialog.close();
    item.run();
  };

  input.addEventListener('input', update);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (shown.length === 0) return;
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
      mark();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(active);
    }
  });
  // A click on the backdrop, outside the box, closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });

  return {
    // Opens the box, with `text` typed in it.
    open(text = '') {
      input.value = text;
      if (!dialog.open) dialog.showModal();
      update();
      input.focus();
    },
  };
};
