import { isPreviewHost } from '../public/js/format.js';
import communities from './communities.json' with { type: 'json' };
import { brand, communityFor, HTML_DEFAULTS, jsonLd, robotsTxt, sitemapXml, statsUrlFor, wordmarkOf } from './site.js';

// Runs for the pages only (see run_worker_first in wrangler.jsonc): scripts, styles and images are served straight
// from the static assets, which costs nothing. Each page gets the community's name, links, stats URL and search
// details put in as it is sent, so link previews and search results show the right community.

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const notFound = () =>
  new Response('<!doctype html><meta charset="utf-8"><title>Not found</title><p>There is no community site at this address.</p>', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS },
  });

const textResponse = (body, type, preview) =>
  new Response(body, {
    headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'public, max-age=3600', ...(preview ? { 'x-robots-tag': 'noindex' } : {}) },
  });

// Link preview images are the community's own, or none: the HTML's is gaminginit's.
const IMAGE_META = /^(og:image|twitter:image)/;

const rewriter = (community, statsUrl) => {
  const [plain, accent] = wordmarkOf(community);
  let title = '';
  return new HTMLRewriter()
    .on('title', {
      text(chunk) {
        title += chunk.text;
        if (chunk.lastInTextNode) chunk.replace(brand(title, community));
        else chunk.remove();
      },
    })
    .on('meta[content]', {
      element(el) {
        const key = el.getAttribute('name') ?? el.getAttribute('property') ?? '';
        if (key === 'stats-url') return el.setAttribute('content', statsUrl);
        if (IMAGE_META.test(key)) {
          if (community.ogImage === undefined) return el.remove();
          if (key === 'og:image' || key === 'twitter:image') return el.setAttribute('content', community.ogImage);
          // Its type and size describe the HTML's own image.
          if (key !== 'og:image:alt' && key !== 'twitter:image:alt' && community.ogImage !== `${HTML_DEFAULTS.origin}/og-image.png`) {
            return el.remove();
          }
        }
        if (key === 'twitter:card' && community.ogImage === undefined) return el.setAttribute('content', 'summary');
        el.setAttribute('content', brand(el.getAttribute('content') ?? '', community));
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', brand(el.getAttribute('href') ?? '', community));
      },
    })
    .on('a[href^="https://discord.gg/"]', {
      element(el) {
        el.setAttribute('href', community.discordInvite);
      },
    })
    .on('a[aria-label]', {
      element(el) {
        el.setAttribute('aria-label', brand(el.getAttribute('aria-label') ?? '', community));
      },
    })
    .on('.wordmark', {
      element(el) {
        el.setInnerContent(`${escapeHtml(plain)}<span class="wordmark-accent">${escapeHtml(accent)}</span>`, { html: true });
      },
    })
    .on('[data-site-name]', {
      element(el) {
        el.setInnerContent(community.name);
      },
    })
    .on('p.lede', {
      element(el) {
        if (community.lede !== undefined) el.setInnerContent(community.lede);
      },
    })
    .on('script[type="application/ld+json"]', {
      element(el) {
        el.setInnerContent(jsonLd(community), { html: true });
      },
    });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const community = communityFor(url, communities, env.DEFAULT_COMMUNITY);
    if (community === null) return notFound();
    const preview = isPreviewHost(url.hostname);
    if (url.pathname === '/robots.txt') return textResponse(robotsTxt(community, preview), 'text/plain', preview);
    if (url.pathname === '/sitemap.xml') return textResponse(sitemapXml(community), 'application/xml', preview);

    // Always the whole page: the browser's copy may be another community's on a preview address.
    const asset = await env.ASSETS.fetch(new Request(url, { method: request.method === 'HEAD' ? 'HEAD' : 'GET', redirect: 'manual' }));
    if (!(asset.headers.get('content-type') ?? '').startsWith('text/html')) return asset;
    const headers = new Headers(asset.headers);
    headers.delete('etag');
    headers.delete('last-modified');
    headers.set('cache-control', 'public, max-age=300');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    if (preview) headers.set('x-robots-tag', 'noindex');
    const page = new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    return rewriter(community, statsUrlFor(community, env.BOT_URL)).transform(page);
  },
};
