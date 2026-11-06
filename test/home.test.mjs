import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDocs, loadDocs } from '../scripts/build.mjs';

const assetsDir = new URL('../assets/', import.meta.url).pathname;
const docs = 'https://docs.haikeilabs.com';

const page = ({ title, product = 'kei', type = 'read-and-use', nav = '', extra = '', body = 'Body.' }) =>
  `---\ntitle: "${title}"\ndescription: Test page.\ntype: ${type}\nproduct: ${product}\n${nav}${extra}---\n\n${body}\n`;

// A small site shaped like the real one: the Agentware Start here pages, Kei
// Get started pages, the skills page and the tutorials folder.
const site = {
  'agentware/build/overview.md': page({ title: 'Build on Agentware', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 1\n' }),
  'tutorials/index.md': page({ title: 'Build an agent that does a real job', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 2\n', extra: 'seo_title: "Agentware tutorials: build task-specific AI agents"\n' }),
  'tutorials/hacker-news-research-agent.md': page({ title: 'Build a Hacker News research agent', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 3\n' }),
  'skills.md': page({ title: 'Install Haikei Skills in Claude Code, Codex, Cursor, OpenCode or Pi', nav: 'nav_group: Start here\nnav_order: 4\n' }),
  'agentware/build/typescript.md': page({ title: 'Set up a TypeScript harness', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 5\n' }),
  'agentware/build/go.md': page({ title: 'Set up a Go harness', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 6\n' }),
  'agentware/make-and-maintain/intro.md': page({ title: 'Introduction to Agentware', product: 'agentware', nav: 'nav_group: Make and maintain\nnav_order: 1\n' }),
  'kei/get-started/sign-in.md': page({ title: 'Sign in to Kei', nav: 'nav_group: Get started\nnav_order: 1\n' }),
  'kei/get-started/bring-your-agent.md': page({ title: 'Bring the agent you use', nav: 'nav_group: Get started\nnav_order: 2\n' }),
  'kei/reference/cli.md': page({ title: 'Reference: kei CLI', type: 'reference' }),
};

async function withSite(overrides, check) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'haikei-docs-home-'));
  const contentDir = path.join(root, 'content');
  const outputDir = path.join(root, 'dist');
  try {
    for (const [relativePath, source] of Object.entries({ ...site, ...overrides })) {
      if (source === null) continue;
      await mkdir(path.dirname(path.join(contentDir, relativePath)), { recursive: true });
      await writeFile(path.join(contentDir, relativePath), source);
    }
    await check({ contentDir, outputDir, assetsDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const read = (paths, file) => readFile(path.join(paths.outputDir, file), 'utf8');
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
const sidebarOf = (html) => html.match(/<aside class="sidebar"[\s\S]*?<\/aside>/)[0];

test('docs home: PAGES title, H1 and description, two path cards in order', () => withSite({}, async (paths) => {
  await buildDocs(paths);
  const html = await read(paths, 'index.html');
  assert.match(html, /<title>Haikei docs: build, use and protect AI agents<\/title>/);
  assert.match(html, /<meta property="og:title" content="Haikei docs: build, use and protect AI agents">/);
  assert.match(html, /<meta name="description" content="Guides for Agentware, Haikei Skills and Kei: build an AI agent, use it with your coding assistant, and add permissions and audit\.">/);
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
  assert.match(html, /<h1>Haikei documentation<\/h1>/);
  const cards = [...html.matchAll(/<section class="path-card"[\s\S]*?<\/section>/g)].map((match) => match[0]);
  assert.equal(cards.length, 2);
  assert.match(cards[0], /<h2[^>]*>Build your own agent<\/h2>/);
  assert.match(cards[1], /<h2[^>]*>Bring the agent you use<\/h2>/);
  const build = hrefs(cards[0]);
  assert.deepEqual(build, ['/agentware/build/overview', '/tutorials/hacker-news-research-agent', '/skills/']);
  const bring = hrefs(cards[1]);
  assert.deepEqual(bring, ['/kei/get-started/bring-your-agent', '/skills/']);
}));

test('docs home: until peer pages land, cards fall back to pages that exist', () => withSite({
  'tutorials/hacker-news-research-agent.md': null,
  'kei/get-started/bring-your-agent.md': null,
}, async (paths) => {
  await buildDocs(paths);
  const html = await read(paths, 'index.html');
  const cards = [...html.matchAll(/<section class="path-card"[\s\S]*?<\/section>/g)].map((match) => match[0]);
  assert.deepEqual(hrefs(cards[0]), ['/agentware/build/overview', '/tutorials/', '/skills/']);
  assert.deepEqual(hrefs(cards[1]), ['/kei/get-started/sign-in', '/skills/']);
}));

test('sidebar: the Agentware Start here group comes first, then Kei', () => withSite({}, async (paths) => {
  await buildDocs(paths);
  const sidebar = sidebarOf(await read(paths, 'kei/reference/cli.html'));
  const products = [...sidebar.matchAll(/<div class="nav-product">([^<]+)<\/div>/g)].map((match) => match[1]);
  assert.deepEqual(products, ['Agentware', 'Kei']);
  const sections = [...sidebar.matchAll(/<div class="nav-section">([^<]+)<\/div>/g)].map((match) => match[1]);
  assert.deepEqual(sections, ['Start here', 'Make and maintain', 'Get started', 'Reference']);
  const startHere = sidebar.slice(sidebar.indexOf('>Start here<'), sidebar.indexOf('>Make and maintain<'));
  assert.deepEqual([...startHere.matchAll(/<li><a href="([^"]+)"/g)].map((match) => match[1]), [
    '/agentware/build/overview',
    '/tutorials/',
    '/tutorials/hacker-news-research-agent',
    '/skills/',
    '/agentware/build/typescript',
    '/agentware/build/go',
  ]);
  assert.ok(sidebar.indexOf('>Start here<') < sidebar.indexOf('<div class="nav-product">Kei</div>'));
  // index.json and prev/next follow the same order.
  const manifest = JSON.parse(await read(paths, 'index.json'));
  assert.deepEqual(manifest.slice(0, 3).map((entry) => entry.path), ['/agentware/build/overview', '/tutorials/', '/tutorials/hacker-news-research-agent']);
}));

test('nav_order must be unique within a sidebar group', () => withSite({
  'kei/get-started/connect.md': page({ title: 'Connect', nav: 'nav_group: Get started\nnav_order: 2\n' }),
}, async (paths) => {
  await assert.rejects(buildDocs(paths), /Kei · Get started: nav_order 2 is used by .*bring-your-agent\.md and .*connect\.md/);
}));

test('global nav on every page: Docs home, Agentware, Kei, Skills, Tutorials, GitHub, Discord', () => withSite({}, async (paths) => {
  await buildDocs(paths);
  for (const file of ['index.html', 'kei/reference/cli.html', 'tutorials/index.html', 'skills/index.html']) {
    const html = await read(paths, file);
    const nav = html.match(/<nav class="global-nav" aria-label="Site">[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, `${file} has a global nav`);
    const links = [...nav.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => [match[1], match[2].replace(/<[^>]+>/g, '').trim()]);
    assert.deepEqual(links, [
      ['/', 'Docs home'],
      ['/agentware/build/overview', 'Agentware'],
      ['/kei/get-started/bring-your-agent', 'Kei'],
      ['/skills/', 'Skills'],
      ['/tutorials/', 'Tutorials'],
      ['https://github.com/HaikeiLabs', 'GitHub'],
      ['https://discord.gg/g6QaTYWXDa', 'Discord'],
    ]);
  }
  const cli = await read(paths, 'kei/reference/cli.html');
  assert.match(cli.match(/<nav class="global-nav"[\s\S]*?<\/nav>/)[0], /href="\/kei\/get-started\/bring-your-agent" aria-current="true">Kei/);
}));

test('tutorials: content/tutorials/<slug>.md builds /tutorials/<slug>, index.md builds /tutorials/', () => withSite({
  'kei/reference/cli.md': page({ title: 'Reference: kei CLI', type: 'reference', body: '[Tutorials](/tutorials/) and [the HN agent](/tutorials/hacker-news-research-agent).' }),
}, async (paths) => {
  await buildDocs(paths);
  const tutorial = await read(paths, 'tutorials/hacker-news-research-agent.html');
  assert.match(tutorial, new RegExp(`<link rel="canonical" href="${docs}/tutorials/hacker-news-research-agent">`));
  const index = await read(paths, 'tutorials/index.html');
  assert.match(index, new RegExp(`<link rel="canonical" href="${docs}/tutorials/">`));
  assert.match(index, /<title>Agentware tutorials: build task-specific AI agents<\/title>/);
  assert.match(index, /<h1>Build an agent that does a real job<\/h1>/);
  assert.match(index, /<ul class="tutorial-list">[\s\S]*href="\/tutorials\/hacker-news-research-agent"[\s\S]*<\/ul>/);
  assert.equal((await stat(path.join(paths.outputDir, 'tutorials/index.md'))).isFile(), true);
  assert.match(index, /href="\/tutorials\/index\.md">View as Markdown/);
  const manifest = JSON.parse(await read(paths, 'index.json'));
  assert.ok(manifest.some((entry) => entry.slug === 'tutorials' && entry.path === '/tutorials/'));
  assert.ok(manifest.some((entry) => entry.slug === 'tutorials/hacker-news-research-agent' && entry.path === '/tutorials/hacker-news-research-agent'));
  const headers = await read(paths, '_headers');
  assert.match(headers, new RegExp(`^/tutorials/index\\.md\\n  Link: <${docs}/tutorials/>; rel="canonical"$`, 'm'));
  assert.match(await read(paths, 'sitemap.xml'), new RegExp(`<loc>${docs}/tutorials/</loc>`));
}));

test('tutorials must sit directly under content/tutorials/', () => withSite({
  'tutorials/nested/deep.md': page({ title: 'Deep', product: 'agentware' }),
}, async (paths) => {
  await assert.rejects(buildDocs(paths), /tutorials\/nested\/deep\.md: tutorials must use content\/tutorials\/<slug>\.md/);
}));

test('a link to a missing tutorial fails the link check', () => withSite({
  'kei/reference/cli.md': page({ title: 'Reference: kei CLI', type: 'reference', body: '[Missing](/tutorials/missing-agent)' }),
}, async (paths) => {
  await assert.rejects(buildDocs(paths), /\/tutorials\/missing-agent/);
}));

test('/agentware/ and /agentware/build/ redirect to one canonical URL', () => withSite({}, async (paths) => {
  await buildDocs(paths);
  const redirects = (await read(paths, '_redirects')).split('\n');
  for (const from of ['/agentware', '/agentware/', '/agentware/build', '/agentware/build/']) {
    assert.ok(redirects.includes(`${from} /agentware/build/overview 301`), `${from} redirects`);
  }
  for (const alias of ['agentware/index.html', 'agentware/build/index.html']) {
    assert.match(await read(paths, alias), new RegExp(`<link rel="canonical" href="${docs}/agentware/build/overview">`));
  }
}));

test('real content: Install Haikei Skills continues to the next step, not the previous one', async () => {
  const pages = await loadDocs();
  const install = pages.find((entry) => entry.relativePath === 'kei/get-started/install-skills.md');
  const continueLine = install.body.split('\n').find((line) => line.includes('Continue with'));
  assert.match(continueLine, /\[Prove access with an allow and a deny\]\(\/kei\/get-started\/prove-it\)/);
  const startHere = pages.filter((entry) => entry.nav_group === 'Start here').map((entry) => entry.relativePath);
  for (const required of ['agentware/build/overview.md', 'tutorials/index.md', 'skills.md', 'agentware/build/typescript.md', 'agentware/build/go.md', 'agentware/build/python.md']) {
    assert.ok(startHere.includes(required), `${required} is in Start here`);
  }
});
