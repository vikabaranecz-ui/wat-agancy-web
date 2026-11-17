import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// All checks run against the source files only (no network, no live fetch),
// so the suite is deterministic and safe to run in CI before a deploy exists.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

const CANONICAL_HOST = 'https://www.watagencybelgium.be';

const PAGES = [
  { file: 'index.html', canonical: `${CANONICAL_HOST}/` },
  { file: 'en/index.html', canonical: `${CANONICAL_HOST}/en/` },
  { file: 'systems-library/index.html', canonical: `${CANONICAL_HOST}/systems-library/` },
  { file: 'work/isoprotech.html', canonical: `${CANONICAL_HOST}/work/isoprotech.html` },
  { file: 'work/reno-rangers.html', canonical: `${CANONICAL_HOST}/work/reno-rangers.html` },
];

test('every live page declares exactly one self-referencing canonical on the www host', () => {
  for (const { file, canonical } of PAGES) {
    const html = read(file);
    const matches = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/g)];
    assert.equal(matches.length, 1, `${file}: expected exactly 1 canonical tag, found ${matches.length}`);
    assert.equal(matches[0][1], canonical, `${file}: canonical should be ${canonical}`);
    assert.ok(!matches[0][1].startsWith('https://watagencybelgium.be'), `${file}: canonical must not point at the apex host, which redirects`);
  }
});

test('vercel.json redirects are all permanent (301) and cover every known duplicate path', () => {
  const config = JSON.parse(read('vercel.json'));
  const redirects = config.redirects || [];
  const bySource = Object.fromEntries(redirects.map((r) => [r.source, r]));

  const expected = {
    '/nl': '/',
    '/nl/': '/',
    '/index.html': '/',
    '/en/index.html': '/en/',
    '/work': '/systems-library/',
    '/work/': '/systems-library/',
    '/systems-library/index.html': '/systems-library/',
    '/web': '/',
    '/web/': '/',
    '/web/index.html': '/',
  };

  assert.equal(bySource['/'], undefined, 'Dutch canonical root must not redirect');
  for (const [source, destination] of Object.entries(expected)) {
    const rule = bySource[source];
    assert.ok(rule, `vercel.json: missing redirect rule for ${source}`);
    assert.equal(rule.destination, destination, `vercel.json: ${source} should redirect to ${destination}`);
    assert.equal(rule.permanent, true, `vercel.json: redirect for ${source} should be permanent (301), not temporary`);
  }
});

test('two crawlable language pages have distinct visible content, correct HTML lang and reciprocal hreflang', () => {
  const dutch=read('index.html');
  const english=read('en/index.html');
  assert.match(dutch, /<html lang="nl-BE" data-lang="nl">/);
  assert.match(english, /<html lang="en" data-lang="en">/);
  const languages=[['nl-BE',CANONICAL_HOST+'/'],['en',CANONICAL_HOST+'/en/'],['x-default',CANONICAL_HOST+'/']];
  for(const [lang, url] of languages){
    const fragment=`<link rel="alternate" hreflang="${lang}" href="${url}">`;
    assert.ok(dutch.includes(fragment), 'root missing '+lang);
    assert.ok(english.includes(fragment), '/en/ missing '+lang);
  }
  for(const [p,s] of [['root',dutch],['/en/',english]]){
    assert.doesNotMatch(s, /<span class="en">|<span class="nl">/, p+' contains hidden translated copy');
    assert.ok(s.includes('href="/en/" hreflang="en"'),p+' lacks English link');
    assert.ok(s.includes('href="/" hreflang="nl-BE"'),p+' lacks Dutch link');
  }
  const js=read('js/scroll-system.js');
  assert.match(js, /window\.location\.pathname\.startsWith\('\/en\/'\)/);
  assert.doesNotMatch(js,/localStorage\.getItem\('preferred-lang-v2'\)/);
});

test('sitemap.xml lists exactly the live pages, on the canonical www host, with no redirects', () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const expectedLocs = PAGES.map((p) => p.canonical);
  assert.deepEqual(locs.sort(), expectedLocs.sort(), 'sitemap.xml should list exactly the 4 live canonical URLs, nothing else');

  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  for (const loc of locs) {
    assert.ok(loc.startsWith(CANONICAL_HOST), `sitemap.xml: ${loc} is not on the canonical www host`);
  }
});

test('robots.txt points its Sitemap directive at the canonical www host', () => {
  const robots = read('robots.txt');
  assert.match(robots, new RegExp(`Sitemap: ${CANONICAL_HOST}/sitemap\\.xml`));
});

test('orphaned legacy pages are removed, not just unlinked', () => {
  assert.equal(existsSync(path.join(ROOT, 'index.html')), true, 'Dutch canonical root index.html must exist');
  assert.equal(existsSync(path.join(ROOT, 'web', 'index.html')), false, 'web/index.html (old NL lead-gen page) should be deleted');
});

test('no internal link points at a duplicate directory-index URL', () => {
  const offenders = [];
  for (const { file } of PAGES) {
    const html = read(file);
    if (/href="\/en\/index\.html/.test(html)) offenders.push(`${file} links to /en/index.html instead of /en/`);
    if (/href="\/systems-library\/index\.html/.test(html)) offenders.push(`${file} links to /systems-library/index.html instead of /systems-library/`);
  }
  assert.deepEqual(offenders, []);
});
