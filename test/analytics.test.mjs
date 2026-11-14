import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildDocs, GA4_MEASUREMENT_ID } from '../scripts/build.mjs';

const assetsDir = new URL('../assets/', import.meta.url).pathname;

const page = ({ title, product = 'kei', nav = '', body = 'Body.' }) =>
  `---\ntitle: "${title}"\ndescription: Test page.\ntype: read-and-use\nproduct: ${product}\n${nav}---\n\n${body}\n`;

const site = {
  'agentware/build/overview.md': page({ title: 'Build on Agentware', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 1\n' }),
  'tutorials/index.md': page({ title: 'Tutorials', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 2\n' }),
  'tutorials/hacker-news-research-agent.md': page({ title: 'Build a Hacker News research agent | Agentware', product: 'agentware', nav: 'nav_group: Start here\nnav_order: 3\nlanguage: typescript\n', body: '## Before you start\n\nNode.\n\n[checkpoint:run]\n\n[checkpoint:tool]'  }),
  'skills.md': page({ title: 'Install Haikei Skills', nav: 'nav_group: Start here\nnav_order: 4\n', body: '```bash\nnpx skills add HaikeiLabs/skills --skill haikei -a claude-code -y\n```\n\n```bash\nkei skills add\n```\n' }),
  'kei/get-started/sign-in.md': page({ title: 'Sign in to Kei', nav: 'nav_group: Get started\nnav_order: 1\n', body: 'Open the [Kei console](https://app.haikeilabs.com) and the [audit logs](https://app.haikeilabs.com/?source=docs-x-y&utm_source=docs&utm_medium=docs&utm_campaign=launch-2027-01).' }),
};

async function withSite(check) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'haikei-docs-ga4-'));
  const contentDir = path.join(root, 'content');
  const outputDir = path.join(root, 'dist');
  try {
    for (const [relativePath, source] of Object.entries(site)) {
      await mkdir(path.dirname(path.join(contentDir, relativePath)), { recursive: true });
      await writeFile(path.join(contentDir, relativePath), source);
    }
    await buildDocs({ contentDir, outputDir, assetsDir });
    const read = (file) => readFile(path.join(outputDir, file), 'utf8');
    await check(read);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const head = (html) => html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

test('ga4: one measurement ID constant matches C4', () => {
  assert.equal(GA4_MEASUREMENT_ID, 'G-EV3X1G9P73');
});

test('ga4: every page head loads gtag.js with Consent Mode v2 defaults before config', () => withSite(async (read) => {
  for (const file of ['index.html', 'skills/index.html', 'kei/get-started/sign-in.html', 'tutorials/hacker-news-research-agent.html']) {
    const h = head(await read(file));
    assert.match(h, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-EV3X1G9P73/, file);
    const consent = h.indexOf("gtag('consent', 'default'");
    const config = h.indexOf("gtag('config', 'G-EV3X1G9P73'");
    assert.ok(consent > -1 && config > consent, `${file}: consent default must precede config`);
    assert.match(h, /analytics_storage: 'granted'/);
    assert.match(h, /ad_storage: 'denied'/);
    assert.match(h, /ad_user_data: 'denied'/);
    assert.match(h, /ad_personalization: 'denied'/);
    assert.match(h, /allow_google_signals: false/);
    assert.match(h, /if \(location\.hostname !== 'docs\.haikeilabs\.com'\) return/, `${file}: loads only on the production host`);
  }
}));

// Run the built head snippet against a host and report what it queued and loaded.
function runSnippet(html, hostname) {
  const source = head(html).match(/<script>(\(function \(\) \{\n  if \(location\.hostname[\s\S]*?)<\/script>/)[1];
  const loaded = [];
  const document = { createElement: () => ({}), head: { appendChild: (s) => loaded.push(s.src) } };
  const window = vm.createContext({ document, location: { hostname }, Date });
  window.window = window; // in a browser, window is the global, so bare dataLayer resolves
  vm.runInContext(source, window);
  return { queued: Array.from(window.dataLayer ?? [], (args) => args[0]), loaded };
}

test('ga4: allowlist loads only on docs.haikeilabs.com', () => withSite(async (read) => {
  const html = await read('index.html');
  for (const host of ['localhost', '127.0.0.1', 'feat-ga4.haikei-docs.pages.dev', 'haikei-docs.pages.dev', 'docs.haikeilabs.com.evil.example', '']) {
    assert.deepEqual(runSnippet(html, host), { queued: [], loaded: [] }, host);
  }
  const prod = runSnippet(html, 'docs.haikeilabs.com');
  assert.deepEqual(prod.queued, ['consent', 'js', 'config']);
  assert.deepEqual(prod.loaded, ['https://www.googletagmanager.com/gtag/js?id=G-EV3X1G9P73']);
}));

test('ga4: build marks skills commands with data-assistant', () => withSite(async (read) => {
  const html = await read('skills/index.html');
  assert.match(html, /<div class="code-block" data-assistant="claude-code">/);
  assert.match(html, /<div class="code-block" data-assistant="auto">/);
}));

test('ga4: home path cards and tutorial pages carry event hooks', () => withSite(async (read) => {
  const home = await read('index.html');
  assert.match(home, /class="path-card" data-path="build"/);
  assert.match(home, /class="path-card" data-path="bring"/);
  assert.match(await read('tutorials/hacker-news-research-agent.html'), /<main id="main" class="content" data-tutorial="hacker-news-research-agent">/);
  assert.doesNotMatch(await read('tutorials/index.html'), /data-tutorial=/);
}));

test('ga4: app links carry C4 source and UTM', () => withSite(async (read) => {
  const html = await read('kei/get-started/sign-in.html');
  assert.match(html, /href="https:\/\/app\.haikeilabs\.com\/\?source=docs-sign-in-console&amp;utm_source=docs&amp;utm_medium=docs&amp;utm_campaign=evergreen"/);
  assert.match(html, /href="https:\/\/app\.haikeilabs\.com\/\?source=docs-x-y&amp;utm_source=docs&amp;utm_medium=docs&amp;utm_campaign=launch-2027-01"/, 'existing attribution is kept');
  assert.match(html, /class="header-link" href="https:\/\/app\.haikeilabs\.com\/\?source=docs-header-console&amp;utm_source=docs&amp;utm_medium=docs&amp;utm_campaign=evergreen"/);
}));

// Load assets/site.js in a sandbox with a minimal DOM and read its exported classifiers.
async function siteAnalytics() {
  const source = await readFile(path.join(assetsDir, 'site.js'), 'utf8');
  const element = () => ({ addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], dataset: {}, textContent: '' });
  const document = {
    documentElement: { dataset: {}, classList: { add() {} } },
    body: { classList: { toggle() { return false; } } },
    querySelector: () => element(),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const window = { document, location: { pathname: '/skills/', hostname: 'docs.haikeilabs.com' } };
  window.window = window;
  vm.runInNewContext(source, { window, document, location: window.location, navigator: {}, setTimeout, URL });
  // Plain copies: objects from the sandbox realm have foreign prototypes.
  const { classifyCopy, outboundDestination } = window.haikeiAnalytics;
  return {
    classifyCopy: (...args) => JSON.parse(JSON.stringify(classifyCopy(...args))),
    outboundDestination,
  };
}

test('site.js: copy classification', async () => {
  const { classifyCopy } = await siteAnalytics();
  assert.deepEqual(classifyCopy('npx skills add HaikeiLabs/skills -a codex -y', 'codex', '/skills/'), { name: 'skills_command_copy', params: { assistant: 'codex', page: '/skills/' } });
  assert.deepEqual(classifyCopy('kei skills add', 'auto', '/kei/x'), { name: 'skills_command_copy', params: { assistant: 'auto', page: '/kei/x' } });
  assert.deepEqual(classifyCopy('npx skills add HaikeiLabs/skills -a pi -y', '', '/p'), { name: 'skills_command_copy', params: { assistant: 'pi', page: '/p' } }, 'falls back to the -a flag');
  assert.deepEqual(classifyCopy('npm install @haikeilabs/agentware', '', '/p'), { name: 'sdk_install_copy', params: { language: 'ts' } });
  assert.deepEqual(classifyCopy('pip install haikeilabs-agentware', '', '/p'), { name: 'sdk_install_copy', params: { language: 'python' } });
  assert.deepEqual(classifyCopy('go get github.com/haikeilabs/agentware/go', '', '/p'), { name: 'sdk_install_copy', params: { language: 'go' } });
  assert.equal(classifyCopy('kei login', '', '/p'), null);
});

test('site.js: outbound destination classification', async () => {
  const { outboundDestination } = await siteAnalytics();
  assert.equal(outboundDestination('https://github.com/HaikeiLabs'), 'github');
  assert.equal(outboundDestination('https://discord.gg/g6QaTYWXDa'), 'discord');
  assert.equal(outboundDestination('https://haikeilabs.substack.com/p/x'), 'substack');
  assert.equal(outboundDestination('https://app.haikeilabs.com/'), null);
  assert.equal(outboundDestination('/kei/get-started/sign-in'), null);
});

test('tutorial checkpoints render at their markers and keep SEO titles intact', () => withSite(async (read) => {
  const html = await read('tutorials/hacker-news-research-agent.html');
  assert.match(html, /<h1>Build a Hacker News research agent<\/h1>/);
  assert.match(html, /<title>Build a Hacker News research agent \| Agentware · Haikei docs<\/title>/);
  assert.match(html, /<button type="button" data-checkpoint="tutorial_success" data-language="typescript">It ran<\/button><span aria-live="polite"><\/span>/);
  assert.match(html, /<button type="button" data-checkpoint="first_custom_tool" data-language="typescript">I added a tool<\/button><span aria-live="polite"><\/span>/);
}));

test('checkpoint clicks send only tutorial and language, then confirm inline', async () => {
  const source = await readFile(path.join(assetsDir, 'site.js'), 'utf8');
  const listeners = [];
  const element = () => ({ addEventListener() {}, setAttribute() {}, querySelector: () => null, dataset: {}, textContent: '' });
  const document = { documentElement: { dataset: {} }, body: { classList: { toggle() {} } }, querySelector: () => element(), querySelectorAll: () => [], addEventListener: (type, fn) => { if (type === 'click') listeners.push(fn); } };
  const events = [];
  const window = { gtag: (...args) => events.push(JSON.parse(JSON.stringify(args))) };
  vm.runInNewContext(source, { window, document, location: {}, navigator: {}, setTimeout, URL });
  for (const name of ['tutorial_success', 'first_custom_tool']) {
    const confirmation = { textContent: '' };
    const main = { getAttribute: () => 'example' };
    const button = { getAttribute: (key) => key === 'data-checkpoint' ? name : 'typescript', closest: () => main, nextElementSibling: confirmation };
    const target = { closest: (selector) => selector === 'button[data-checkpoint]' ? button : null };
    listeners.forEach((fn) => fn({ target }));
    assert.equal(confirmation.textContent, 'Nice.');
  }
  assert.deepEqual(events, [['event', 'tutorial_success', { tutorial: 'example', language: 'typescript' }], ['event', 'first_custom_tool', { tutorial: 'example', language: 'typescript' }]]);
});
