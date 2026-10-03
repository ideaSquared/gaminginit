import { emptyNote, phaseRanges, vipDetail, vipOffer } from './format.js';
import { startLive } from './live.js';
import { setText } from './views.js';

// The join page: how to find us, what seeding earns, and what seeding is, in the bot's own numbers.

const $ = (id) => document.getElementById(id);

// What seeding earns, when the bot gives seeders VIP.
const renderVip = (stats) => {
  const vip = stats?.vip ?? null;
  $('vip').hidden = !vip;
  $('seed-vip').hidden = !vip;
  if (!vip) return;
  setText($('vip-step-offer'), vipOffer(vip));
  setText($('vip-step-detail'), vipDetail(vip));
};

// Uses the bot's own thresholds, so the explanation stays right if they change. Until the stats load, the page shows
// the bot's defaults.
const renderSeeding = (stats) => {
  if (!stats?.thresholds) return;
  const ranges = phaseRanges(stats.thresholds);
  for (const kind of ['empty', 'seeding', 'live']) setText($(`range-${kind}`), ranges[kind]);
  setText($('note-empty'), emptyNote(stats.thresholds));
  setText($('seed-live'), String(stats.thresholds.live));
};

startLive((stats) => {
  setText($('join-server-name'), stats?.server?.name ?? 'our server');
  renderVip(stats);
  renderSeeding(stats);
});
