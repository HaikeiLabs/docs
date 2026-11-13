import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDocs } from '../scripts/build.mjs';

const assetsDir = new URL('../assets/', import.meta.url).pathname;
const docs = 'https://docs.haikeilabs.com';
const shareCard = `${docs}/assets/social/share-docs-1200x627.png`;
const shareCardAlt = 'Haikei Labs docs. Build, use and protect AI agents.';

async function fixture(pages = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'haikei-docs-seo-'));
  const contentDir = path.join(root, 'content');
  const outputDir = path.join(root, 'dist');
  const all = {
    'agentware/build/overview.md': '---\ntitle: Agentware\ndescription: Build an agent with Agentware.\ntype: reference\nproduct: agentware\n---\n\nOverview.\n',
    'kei/setup/example.md': '---\ntitle: Example & more\ndescription: "Set up <Kei> & test it"\ntype: reference\nproduct: kei\n---\n\nBody.\n',
    ...pages,
  };
  for (const [relativePath, source] of Object.entries(all)) {
    await mkdir(path.dirname(path.join(contentDir, relativePath)), { recursive: true });
    await writeFile(path.join(contentDir, relativePath), source);
  }
  return { root, contentDir, outputDir };
}

async function withBuild(pages, check) {
  const paths = await fixture(pages);
  try {
    await check(paths);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
}

function head(html) {
  return html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
}

test('frontmatter: description is required', () => withBuild({
  'kei/setup/example.md': '---\ntitle: Example\ntype: reference\nproduct: kei\n---\n\nBody.\n',
}, async (paths) => {
  await assert.rejects(buildDocs({ ...paths, assetsDir }), /kei\/setup\/example\.md: front matter requires a non-empty description/);
}));

test('frontmatter: description must not be blank', () => withBuild({
  'kei/setup/example.md': '---\ntitle: Example\ndescription: "   "\ntype: reference\nproduct: kei\n---\n\nBody.\n',
}, async (paths) => {
  await assert.rejects(buildDocs({ ...paths, assetsDir }), /front matter requires a non-empty description/);
}));

test('frontmatter: description is at most 160 characters', async () => {
  await withBuild({
    'kei/setup/example.md': `---\ntitle: Example\ndescription: "${'a'.repeat(161)}"\ntype: reference\nproduct: kei\n---\n\nBody.\n`,
  }, async (paths) => {
    await assert.rejects(buildDocs({ ...paths, assetsDir }), /kei\/setup\/example\.md: description is 161 characters; keep it to 160 or fewer/);
  });
  await withBuild({
    'kei/setup/example.md': `---\ntitle: Example\ndescription: "${'a'.repeat(160)}"\ntype: reference\nproduct: kei\n---\n\nBody.\n`,
  }, async (paths) => {
    await buildDocs({ ...paths, assetsDir });
  });
});

test('a rendered page carries canonical, description, Open Graph and Twitter tags', () => withBuild({}, async (paths) => {
  await buildDocs({ ...paths, assetsDir });
  const html = head(await readFile(path.join(paths.outputDir, 'kei/setup/example.html'), 'utf8'));
  const url = `${docs}/kei/setup/example`;
  assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
  assert.match(html, /<meta name="description" content="Set up &lt;Kei&gt; &amp; test it">/);
  assert.match(html, /<meta property="og:title" content="Example &amp; more · Haikei docs">/);
  assert.match(html, /<meta property="og:description" content="Set up &lt;Kei&gt; &amp; test it">/);
  assert.match(html, new RegExp(`<meta property="og:url" content="${url}">`));
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(html, new RegExp(`<meta property="og:image" content="${shareCard}">`));
  assert.match(html, new RegExp(`<meta property="og:image:alt" content="${shareCardAlt}">`));
  assert.match(html, /<meta property="og:site_name" content="Haikei docs">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${shareCard}">`));
}));

test('the docs home is an og:type website pointing at the root URL', () => withBuild({}, async (paths) => {
  await buildDocs({ ...paths, assetsDir });
  const html = head(await readFile(path.join(paths.outputDir, 'index.html'), 'utf8'));
  assert.match(html, new RegExp(`<link rel="canonical" href="${docs}/">`));
  assert.match(html, new RegExp(`<meta property="og:url" content="${docs}/">`));
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.match(html, new RegExp(`<meta property="og:image" content="${shareCard}">`));
}));

test('sitemap lists the home and every page in index.json, and nothing else', () => withBuild({}, async (paths) => {
  await buildDocs({ ...paths, assetsDir });
  const manifest = JSON.parse(await readFile(path.join(paths.outputDir, 'index.json'), 'utf8'));
  const sitemap = await readFile(path.join(paths.outputDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locs, [`${docs}/`, ...manifest.map((entry) => `${docs}${entry.path}`)]);
  assert.ok(locs.includes(`${docs}/kei/setup/example`));
  for (const loc of locs) assert.doesNotMatch(loc, /\.(md|html)$|\/agentware\/?$|\/agentware\/build\/?$/);
}));

test('robots.txt allows everything and names the sitemap', () => withBuild({}, async (paths) => {
  await buildDocs({ ...paths, assetsDir });
  assert.equal(await readFile(path.join(paths.outputDir, 'robots.txt'), 'utf8'), `User-agent: *\nAllow: /\nSitemap: ${docs}/sitemap.xml\n`);
}));

test('each Markdown copy gets a canonical Link header pointing at its HTML page', () => withBuild({}, async (paths) => {
  await buildDocs({ ...paths, assetsDir });
  const headers = await readFile(path.join(paths.outputDir, '_headers'), 'utf8');
  assert.match(headers, new RegExp(`^/kei/setup/example\\.md\\n  Link: <${docs}/kei/setup/example>; rel="canonical"$`, 'm'));
  assert.match(headers, new RegExp(`^/agentware/build/overview\\.md\\n  Link: <${docs}/agentware/build/overview>; rel="canonical"$`, 'm'));
}));
