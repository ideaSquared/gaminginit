import { emptyNote, phaseRanges } from './format.js';
import { startLive } from './live.js';
import { setText } from './views.js';

// The seeding page: what seeding is, in the bot's own numbers.

const $ = (id) => document.getElementById(id);

// Uses the bot's own thresholds, so the explanation stays right if they change. Until the stats load, the page shows
// the bot's defaults.
startLive((stats) => {
  $('seed-vip').hidden = !stats?.vip;
  if (!stats?.thresholds) return;
  const ranges = phaseRanges(stats.thresholds);
  for (const kind of ['empty', 'seeding', 'live']) setText($(`range-${kind}`), ranges[kind]);
  setText($('note-empty'), emptyNote(stats.thresholds));
  setText($('seed-live'), String(stats.thresholds.live));
});
