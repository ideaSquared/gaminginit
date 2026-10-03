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
const HOST = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const INVITE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/;

// What is wrong with the communities, as sentences; none when they are fine. Each domain belongs to one community at
// most, so no domain can ever show one community's page with another's stats.
export const communityProblems = (communities) => {
  const problems = [];
  const owners = new Map();
  for (const [id, c] of Object.entries(communities)) {
    const say = (problem) => problems.push(`${id}: ${problem}`);
    if (!ID.test(id)) say('the id must be 3 to 32 lowercase letters, digits and dashes, the same as on the bot');
    if (typeof c.name !== 'string' || c.name.trim() === '' || c.name.length > 60) say('name must be 1 to 60 characters');
    if (!/^https:\/\/[a-z0-9.-]+$/.test(c.origin ?? '')) say('origin must be https://<domain>, with no path');
    if (!INVITE.test(c.discordInvite ?? '')) say('discordInvite must be a link like https://discord.gg/abc123');
    if (c.wordmark !== undefined && !(Array.isArray(c.wordmark) && c.wordmark.length === 2 && c.wordmark.every((p) => typeof p === 'string'))) {
      say('wordmark must be two strings: the plain part and the coloured part');
    }
    if (c.ogImage !== undefined && !/^https:\/\//.test(c.ogImage)) say('ogImage must be an https:// URL');
    if (c.lede !== undefined && (typeof c.lede !== 'string' || c.lede.length > 400)) say('lede must be up to 400 characters');
    if (c.statsUrl !== undefined && !/^https:\/\/.+\/api\/stats$/.test(c.statsUrl)) say('statsUrl must be an https:// URL ending in /api/stats');
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
// ?community=<id>, or else the default. Any other domain is nobody's, and gets a 404.
export const communityFor = (url, communities, defaultId) => {
  const host = url.hostname.toLowerCase();
  for (const [id, c] of Object.entries(communities)) if (c.hosts.includes(host)) return { id, ...c };
  if (!isPreviewHost(host)) return null;
  const asked = url.searchParams.get('community');
  const id = asked !== null && Object.hasOwn(communities, asked) ? asked : defaultId;
  return id && Object.hasOwn(communities, id) ? { id, ...communities[id] } : null;
};

// Where the community's stats are: its own address on the bot, unless it gives one.
export const statsUrlFor = (community, botUrl) =>
  community.statsUrl ?? (botUrl ? `${botUrl.replace(/\/$/, '')}/t/${community.id}/api/stats` : '');

// The HTML's own name and domain, swapped for the community's, in titles, descriptions and links.
export const brand = (text, community) => text.replaceAll(HTML_DEFAULTS.origin, community.origin).replaceAll(HTML_DEFAULTS.name, community.name);

export const wordmarkOf = (community) => community.wordmark ?? [community.name, ''];

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

export const sitemapXml = (community) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...['/', '/matches', '/players'].map((path) => `  <url>\n    <loc>${xmlEscape(community.origin + path)}</loc>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');
