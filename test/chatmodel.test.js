import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAdd, countText, listedWords, switchNote, tidyWord, wordButton, wordGroups, wordProblem } from '../public/js/chatmodel.js';
import { demoChatWords, demoChatWordsChange } from '../public/js/demo.js';

const page = { enabled: true, actions: true, maxWord: 60, maxPhraseWords: 4, maxAdded: 3 };
const toxicity = {
  id: 'toxicity',
  name: 'Toxicity',
  defaults: ['kys', 'kill yourself', 'retard'],
  added: ['noob scum'],
  removed: ['retard'],
};
const allow = { id: 'allow', name: 'Allowed words', defaults: ['snigger'], added: [], removed: [] };

describe('tidyWord', () => {
  it('lower-cases, takes the punctuation off each word and puts one space between words', () => {
    assert.equal(tidyWord('  "Noob   Scum!" '), 'noob scum');
    assert.equal(tidyWord('(KYS)'), 'kys');
    assert.equal(tidyWord('Don’t Quit'), "don't quit");
    assert.equal(tidyWord('...'), '');
    assert.equal(tidyWord(undefined), '');
  });
});

describe('the words on a list', () => {
  it('are the starter words less those taken out, then those added', () => {
    assert.deepEqual(listedWords(toxicity), ['kys', 'kill yourself', 'noob scum']);
    assert.deepEqual(listedWords({ ...toxicity, added: ['kys', 'new'] }), ['kys', 'kill yourself', 'new']);
  });

  it('are shown in two groups, the added ones first, with the starter words taken out marked', () => {
    assert.deepEqual(wordGroups(toxicity), [
      { title: 'Added by staff', words: [{ word: 'noob scum', kind: 'added' }] },
      {
        title: 'Starter words',
        words: [
          { word: 'kys', kind: 'default' },
          { word: 'kill yourself', kind: 'default' },
          { word: 'retard', kind: 'removed' },
        ],
      },
    ]);
  });

  it('are narrowed by what is searched for, in any case', () => {
    const [added, starter] = wordGroups(toxicity, ' YOUR');
    assert.deepEqual(added.words, []);
    assert.deepEqual(starter.words, [{ word: 'kill yourself', kind: 'default' }]);
    assert.deepEqual(wordGroups(toxicity, 'zzz').map((g) => g.words), [[], []]);
  });

  it('are counted, with what staff changed', () => {
    assert.equal(countText(toxicity), '3 words: 1 added, 1 starter word taken out');
    assert.equal(countText(allow), '1 word');
    assert.equal(countText({ ...toxicity, removed: ['kys', 'retard'] }), '2 words: 1 added, 2 starter words taken out');
  });

  it('have a button that takes a word out, or puts a starter word back', () => {
    assert.deepEqual(wordButton({ word: 'kys', kind: 'default' }), { action: 'remove', text: '×', label: 'Take kys out' });
    assert.deepEqual(wordButton({ word: 'noob scum', kind: 'added' }), { action: 'remove', text: '×', label: 'Take noob scum out' });
    assert.deepEqual(wordButton({ word: 'retard', kind: 'removed' }), { action: 'restore', text: 'Put back', label: 'Put retard back' });
  });
});

describe('wordProblem', () => {
  it('has nothing to say about a good word or phrase', () => {
    assert.equal(wordProblem('Noob Camper', toxicity, page), null);
    assert.equal(wordProblem('scunthorpe', allow, page), null);
    // A starter word taken out can be added again: it is put back.
    assert.equal(wordProblem('retard', toxicity, page), null);
  });

  it('refuses a word that is too short, too long, or odd', () => {
    assert.equal(wordProblem('ab', toxicity, page), 'A word needs at least 3 letters or numbers.');
    assert.equal(wordProblem('  !! ', toxicity, page), 'A word needs at least 3 letters or numbers.');
    assert.equal(wordProblem('x'.repeat(61), toxicity, page), 'A word can be at most 60 characters.');
    assert.equal(wordProblem('bad_word', toxicity, page), 'Use letters, numbers, spaces, apostrophes and hyphens only.');
  });

  it('refuses a phrase that is too long, or an allowed word with a space', () => {
    assert.equal(wordProblem('a b c d e', toxicity, page), 'A phrase can be at most 4 words.');
    assert.equal(wordProblem('two words', allow, page), 'An allowed word is one word, with no spaces.');
  });

  it('refuses a word that is on the list already', () => {
    assert.equal(wordProblem(' KYS! ', toxicity, page), '"kys" is on the list already.');
    assert.equal(wordProblem('noob scum', toxicity, page), '"noob scum" is on the list already.');
  });

  it('refuses another added word when the list is full, but not a starter word put back', () => {
    const full = { ...toxicity, added: ['one1', 'two2', 'three3'] };
    assert.equal(wordProblem('four4', full, page), 'A list can have at most 3 added words.');
    assert.equal(wordProblem('retard', full, page), null);
  });
});

describe('the Add button and the switches', () => {
  it('is for a box with a word in it', () => {
    assert.equal(canAdd(''), false);
    assert.equal(canAdd(' ... '), false);
    assert.equal(canAdd('kys'), true);
  });

  it('says what the bot is set to, and nothing when it does everything', () => {
    assert.equal(switchNote(page), null);
    assert.match(switchNote({ ...page, enabled: false }), /CHAT_MOD is off/);
    assert.match(switchNote({ ...page, actions: false }), /CHAT_MOD_ACTIONS.*does not ban or warn/);
  });
});

describe('the ?demo chat filter', () => {
  it('works as the bot does: adds, takes out and puts back, refusing what the bot refuses', async () => {
    const first = (await demoChatWords()).json;
    assert.deepEqual(first.lists.map((l) => l.id), ['racism', 'toxicity', 'allow']);
    assert.equal(first.changed, null);

    const added = await demoChatWordsChange({ action: 'add', list: 'toxicity', word: ' Noob Camper ' });
    assert.equal(added.ok, true);
    assert.deepEqual(added.json.lists[1].added, ['noob scum', 'noob camper']);
    assert.equal(added.json.changed.byName, 'Sarge');

    const out = await demoChatWordsChange({ action: 'remove', list: 'toxicity', word: 'kys' });
    assert.deepEqual(out.json.lists[1].removed, ['kys']);
    assert.deepEqual((await demoChatWordsChange({ action: 'add', list: 'toxicity', word: 'kys' })).json.lists[1].removed, []);
    await demoChatWordsChange({ action: 'remove', list: 'toxicity', word: 'retard' });
    assert.deepEqual((await demoChatWordsChange({ action: 'restore', list: 'toxicity', word: 'retard' })).json.lists[1].removed, []);
    assert.deepEqual((await demoChatWordsChange({ action: 'remove', list: 'toxicity', word: 'noob camper' })).json.lists[1].added, ['noob scum']);

    assert.deepEqual(await demoChatWordsChange({ action: 'add', list: 'toxicity', word: 'retard' }), { ok: false, json: { error: '"retard" is on the list already.' } });
    assert.deepEqual(await demoChatWordsChange({ action: 'remove', list: 'toxicity', word: 'nothing here' }), { ok: false, json: { error: '"nothing here" is not on the list.' } });
    assert.deepEqual(await demoChatWordsChange({ action: 'restore', list: 'toxicity', word: 'kys' }), { ok: false, json: { error: '"kys" is not taken out of the list.' } });
    assert.equal((await demoChatWordsChange({ action: 'add', list: 'other', word: 'abc' })).ok, false);
    assert.equal((await demoChatWordsChange({ action: 'add', list: 'allow', word: 'two words' })).ok, false);
  });
});
