import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isPreviewHost, keptParams } from '../public/js/format.js';
import communities from '../src/communities.json' with { type: 'json' };
import { brand, communityFor, communityProblems, HTML_DEFAULTS, jsonLd, robotsTxt, sitemapXml, statsUrlFor, wordmarkOf } from '../src/site.js';

const alpha = {
  name: 'Alpha Squad',
  origin: 'https://alpha.example',
  hosts: ['alpha.example', 'www.alpha.example'],
  discordInvite: 'https://discord.gg/alpha',
};
const all = { ...communities, alpha };

describe('communities.json', () => {
  it('is valid, with every domain belonging to one community', () => {
    assert.deepEqual(communityProblems(communities), []);
  });
});

describe('communityProblems', () => {
  it('refuses a domain two communities claim, so one can never show the other', () => {
    const beta = { ...alpha, name: 'Beta', origin: 'https://beta.example', hosts: ['beta.example', 'alpha.example'] };
    assert.deepEqual(communityProblems({ alpha, beta }), ['beta: "alpha.example" is also alpha\'s']);
  });

  it('refuses a stats URL or image that would not parse, and fields a community does not have, such as an id', () => {
    const problems = communityProblems({ alpha: { ...alpha, id: 'gaminginit', statsUrl: 'https:// /api/stats', ogImage: 'https://' } });
    assert.deepEqual(problems, [
      'alpha: "id" is not a field a community has',
      'alpha: ogImage must be an https:// URL',
      'alpha: statsUrl must be an https:// URL ending in /api/stats',
    ]);
    assert.deepEqual(communityProblems({ alpha: { ...alpha, statsUrl: 'https://bot.example/t/alpha/api/stats' } }), []);
  });

  it('refuses bad ids, origins, invites and preview addresses as domains', () => {
    const problems = communityProblems({
      Bad_Id: { ...alpha, origin: 'http://alpha.example/path', discordInvite: 'https://evil.example', hosts: ['x.workers.dev'] },
    });
    assert.equal(problems.length, 4);
    assert.match(problems.join('\n'), /id must be/);
    assert.match(problems.join('\n'), /origin must be/);
    assert.match(problems.join('\n'), /discordInvite/);
    assert.match(problems.join('\n'), /preview address/);
  });
});

describe('communityFor', () => {
  it("picks the community by the domain the request came to, ignoring ?community there", () => {
    assert.equal(communityFor(new URL('https://www.alpha.example/players'), all, 'gaminginit')?.id, 'alpha');
    assert.equal(communityFor(new URL('https://gaminginit.com/?community=alpha'), all, 'gaminginit')?.id, 'gaminginit');
  });

  it('always uses the id it is listed under, so an entry cannot claim another community', () => {
    const sneaky = { alpha: { ...alpha, id: 'gaminginit' } };
    assert.equal(communityFor(new URL('https://alpha.example/'), sneaky, undefined)?.id, 'alpha');
    assert.equal(communityFor(new URL('http://localhost/?community=alpha'), sneaky, undefined)?.id, 'alpha');
  });

  it('gives any other domain nothing, rather than a default', () => {
    assert.equal(communityFor(new URL('https://unknown.example/'), all, 'gaminginit'), null);
  });

  it('lets previews pick a community, or show the default', () => {
    const preview = 'https://wardogs-community-site.me.workers.dev/';
    assert.equal(communityFor(new URL(`${preview}?community=alpha`), all, 'gaminginit')?.id, 'alpha');
    assert.equal(communityFor(new URL(preview), all, 'gaminginit')?.id, 'gaminginit');
    assert.equal(communityFor(new URL('http://localhost:8787/?community=nobody'), all, 'gaminginit')?.id, 'gaminginit');
    assert.equal(communityFor(new URL(`${preview}?community=__proto__`), all, undefined), null);
    assert.equal(communityFor(new URL(preview), all, undefined), null);
  });
});

describe('statsUrlFor', () => {
  it("is the community's own address on the bot, unless it gives one", () => {
    assert.equal(statsUrlFor({ id: 'alpha', ...alpha }, 'https://bot.example/'), 'https://bot.example/t/alpha/api/stats');
    assert.equal(statsUrlFor({ id: 'alpha', ...alpha, statsUrl: 'https://other.example/api/stats' }, 'https://bot.example'), 'https://other.example/api/stats');
  });
});

describe('brand', () => {
  it("swaps the HTML's name and domain for the community's", () => {
    assert.equal(
      brand('Players | gaminginit WARDOGS server at https://gaminginit.com/players', alpha),
      'Players | Alpha Squad WARDOGS server at https://alpha.example/players',
    );
    // The community's own domain and name are left as they are, even when they hold the HTML's name.
    const lookalike = { ...alpha, name: 'gaminginit EU', origin: 'https://gaminginit-eu.example' };
    assert.equal(
      brand('gaminginit | https://gaminginit.com/players', lookalike),
      'gaminginit EU | https://gaminginit-eu.example/players',
    );
    assert.deepEqual(wordmarkOf(alpha), ['Alpha Squad', '']);
    assert.deepEqual(wordmarkOf(communities.gaminginit), ['gaming', 'init']);
  });

  it('matches what the HTML files say, so every page gets rebranded', () => {
    for (const page of ['index', 'matches', 'players', 'player']) {
      const html = readFileSync(new URL(`../public/${page}.html`, import.meta.url), 'utf8');
      assert.ok(html.includes(HTML_DEFAULTS.name), page);
      assert.ok(html.includes(`${HTML_DEFAULTS.origin}/`), page);
      assert.ok(html.includes(HTML_DEFAULTS.invite), page);
      assert.ok(html.includes('<meta name="stats-url"'), page);
    }
  });
});

describe('jsonLd', () => {
  it("names the community, and can't end its script early", () => {
    const ld = jsonLd({ ...alpha, name: '</script><script>alert(1)</script>' });
    assert.ok(!ld.includes('</script>'));
    assert.equal(JSON.parse(ld)['@graph'][0].name, '</script><script>alert(1)</script>');
    assert.equal(JSON.parse(jsonLd(alpha))['@graph'][1].sameAs[0], 'https://discord.gg/alpha');
  });
});

describe('robotsTxt and sitemapXml', () => {
  it("point at the community's own domain, and keep previews out of search", () => {
    assert.equal(robotsTxt(alpha, false), 'User-agent: *\nAllow: /\n\nSitemap: https://alpha.example/sitemap.xml\n');
    assert.equal(robotsTxt(alpha, true), 'User-agent: *\nDisallow: /\n');
    assert.match(sitemapXml(alpha), /<loc>https:\/\/alpha\.example\/players<\/loc>/);
  });
});

describe('isPreviewHost', () => {
  it('only counts workers.dev and this computer', () => {
    assert.equal(isPreviewHost('wardogs-community-site.me.workers.dev'), true);
    assert.equal(isPreviewHost('localhost'), true);
    assert.equal(isPreviewHost('gaminginit.com'), false);
    assert.equal(isPreviewHost('workers.dev.evil.example'), false);
  });

  it('keeps ?stats and ?community in links only on previews', () => {
    assert.deepEqual(keptParams('localhost'), ['demo', 'stats', 'community']);
    assert.deepEqual(keptParams('gaminginit.com'), ['demo']);
  });
});
