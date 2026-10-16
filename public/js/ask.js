import { el } from './views.js';

// Asks staff to confirm something, in a small dialog on the page rather than the browser's own pop-up, which looks
// nothing like the site and can't say what each button does. Resolves true for the confirm button (`yes`, such as
// "Delete"), and false for `no`, Escape or a click outside. A `danger` question (deleting, throwing work away) starts
// on `no`, so Enter alone never does it.
export const ask = (question, { yes = 'OK', no = 'Back', danger = false } = {}) =>
  new Promise((resolve) => {
    const from = document.activeElement;
    const yesButton = el('button', { type: 'button', className: `btn btn-small ${danger ? 'btn-danger' : 'tool-run'}`, textContent: yes });
    const noButton = el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: no });
    const text = el('p', { className: 'ask-question', id: `ask-${Date.now()}`, textContent: question });
    const dialog = el('dialog', { className: 'card ask-dialog' }, text, el('div', { className: 'ask-actions' }, yesButton, noButton));
    dialog.setAttribute('aria-labelledby', text.id);
    let answer = false;
    yesButton.addEventListener('click', () => {
      answer = true;
      dialog.close();
    });
    noButton.addEventListener('click', () => dialog.close());
    // A click on the backdrop, outside the box, is a no.
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (from?.isConnected) from.focus({ preventScroll: true });
      resolve(answer);
    });
    // In the staff page's own section, so it takes the page's button styles.
    (document.querySelector('section.admin') ?? document.body).append(dialog);
    dialog.showModal();
    (danger ? noButton : yesButton).focus();
  });
