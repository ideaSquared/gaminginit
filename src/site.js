import { isPreviewHost } from '../public/js/format.js';

// One deployment serves the website of every community in communities.json. Each request is for the community whose
// domain it came to; the pages are the same, with the community's name, links and stats put in before they are sent.

// What the HTML files say, so they still work as gaminginit's site when served on their own (npm start).
export const HTML_DEFAULTS = {
  name: 'gaminginit',
  origin: 'https://gaminginit.com',
  invite: 'https://discord.gg/qsJFYGhSJ4',
};

const ID = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
// A domain name: two or more labels of letters, digits and dashes, none starting or ending with a dash.
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOST = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`);
const ORIGIN = new RegExp(`^https://${LABEL}(?:\\.${LABEL})+$`);
const INVITE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/;
const FIELDS = ['name', 'wordmark', 'origin', 'hosts', 'discordInvite', 'ogImage', 'lede', 'statsUrl'];

// The pages hand these to new URL(), so they must parse, not just look right.
const isHttpsUrl = (value) => {
  try {
    return typeof value === 'string' && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

// What is wrong with the communities, as sentences; none when they are fine. Each domain belongs to one community at
// most, so no domain can ever show one community's page with another's stats.
export const communityProblems = (communities) => {
  const problems = [];
  const owners = new Map();
  for (const [id, c] of Object.entries(communities)) {
    const say = (problem) => problems.push(`${id}: ${problem}`);
    // Anything else, an "id" above all, would be a mistake: the key is the community's id.
    for (const field of Object.keys(c)) if (!FIELDS.includes(field)) say(`"${field}" is not a field a community has`);
    if (!ID.test(id)) say('the id must be 3 to 32 lowercase letters, digits and dashes, the same as on the bot');
    if (typeof c.name !== 'string' || c.name.trim() === '' || c.name.length > 60) say('name must be 1 to 60 characters');
    if (!ORIGIN.test(c.origin ?? '')) say('origin must be https://<domain>, with no path');
    if (!INVITE.test(c.discordInvite ?? '')) say('discordInvite must be a link like https://discord.gg/abc123');
    if (c.wordmark !== undefined && !(Array.isArray(c.wordmark) && c.wordmark.length === 2 && c.wordmark.every((p) => typeof p === 'string'))) {
      say('wordmark must be two strings: the plain part and the coloured part');
    }
    if (c.ogImage !== undefined && !isHttpsUrl(c.ogImage)) say('ogImage must be an https:// URL');
    if (c.lede !== undefined && (typeof c.lede !== 'string' || c.lede.length > 400)) say('lede must be up to 400 characters');
    if (c.statsUrl !== undefined && !(isHttpsUrl(c.statsUrl) && new URL(c.statsUrl).pathname.endsWith('/api/stats'))) {
      say('statsUrl must be an https:// URL ending in /api/stats');
    }
    if (!Array.isArray(c.hosts) || c.hosts.length === 0) say('hosts must list its domains');
    for (const host of c.hosts ?? []) {
      if (!HOST.test(host)) say(`"${host}" is not a domain name`);
      if (isPreviewHost(host)) say(`"${host}" is a preview address: those take ?community=${id}`);
      if (owners.has(host)) say(`"${host}" is also ${owners.get(host)}'s`);
      owners.set(host, id);
    }
  }
  return problems;
};

// The community a request is for: the one whose domain it came to. Previews (workers.dev and this computer) take
// ?community=<id>, or else the default. Any other domain is nobody's, and gets a 404. The id is always the key it is
// listed under, whatever its entry says.
export const communityFor = (url, communities, defaultId) => {
  const host = url.hostname.toLowerCase();
  for (const [id, c] of Object.entries(communities)) if (c.hosts.includes(host)) return { ...c, id };
  if (!isPreviewHost(host)) return null;
  const asked = url.searchParams.get('community');
  const id = asked !== null && Object.hasOwn(communities, asked) ? asked : defaultId;
  return id && Object.hasOwn(communities, id) ? { ...communities[id], id } : null;
};

// Where the community's stats are: its own address on the bot, unless it gives one.
export const statsUrlFor = (community, botUrl) =>
  community.statsUrl ?? (botUrl ? `${botUrl.replace(/\/$/, '')}/t/${community.id}/api/stats` : '');

// The HTML's own name and domain, swapped for the community's, in titles, descriptions and links. One pass, so a
// community whose domain or name holds the HTML's name is not changed again.
const DEFAULTS_IN_TEXT = new RegExp(`${HTML_DEFAULTS.origin.replace(/[.]/g, '\\.')}|${HTML_DEFAULTS.name}`, 'g');
export const brand = (text, community) =>
  text.replace(DEFAULTS_IN_TEXT, (found) => (found === HTML_DEFAULTS.origin ? community.origin : community.name));

export const wordmarkOf = (community) => community.wordmark ?? [community.name, ''];

// The invite as the home page shows it in text, for pasting into Discord: "discord.gg/abc123".
export const inviteText = (community) => community.discordInvite.replace(/^https:\/\//, '');

// Search engines and link previews read this.
export const jsonLd = (community) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${community.origin}/#website`,
        url: `${community.origin}/`,
        name: community.name,
        description: `${community.name}: live WARDOGS server status, player stats and our Discord.`,
        inLanguage: 'en-GB',
        publisher: { '@id': `${community.origin}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${community.origin}/#organization`,
        name: community.name,
        url: `${community.origin}/`,
        sameAs: [community.discordInvite],
      },
    ],
  })
    // Inside a <script>, so nothing in it can end the script early.
    .replace(/</g, '\\u003c');

export const robotsTxt = (community, preview) =>
  preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${community.origin}/sitemap.xml\n`;

const xmlEscape = (text) => text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

// The pages search engines should know about: not a player's page (one per player, and noindex) or the staff page.
export const SITEMAP_PATHS = ['/', '/stats', '/live', '/matches', '/teams', '/leaderboard', '/players', '/seeding'];

export const sitemapXml = (community) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_PATHS.map((path) => `  <url>\n    <loc>${xmlEscape(community.origin + path)}</loc>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');
