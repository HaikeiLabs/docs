import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDocs } from '../scripts/build.mjs';

const assetsDir = new URL('../assets/', import.meta.url).pathname;

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(file);
  }
  return files;
}

async function resolvesInternalUrl(url, currentFile, outputDir) {
  const relativeFile = path.relative(outputDir, currentFile).split(path.sep).join('/');
  const pageUrl = new URL(`/${relativeFile}`, 'https://docs.haikeilabs.com');
  const targetUrl = new URL(url, pageUrl);
  if (targetUrl.origin !== pageUrl.origin) return true;
  const pathname = decodeURIComponent(targetUrl.pathname);
  const target = path.resolve(outputDir, `.${pathname}`);
  if (target !== outputDir && !target.startsWith(`${outputDir}${path.sep}`)) return false;
  const candidates = [target, `${target}.html`, path.join(target, 'index.html')];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return false;
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'haikei-docs-test-'));
  const contentDir = path.join(root, 'content');
  const outputDir = path.join(root, 'dist');
  await mkdir(path.join(contentDir, 'kei', 'setup'), { recursive: true });
  return { root, contentDir, outputDir };
}

test('build fails when a make-and-maintain page has no validation metadata', async () => {
  const paths = await fixture();
  try {
    await writeFile(path.join(paths.contentDir, 'kei/setup/example.md'), '---\ntitle: Example\ntype: make-and-maintain\nproduct: kei\n---\n\nDo the task.\n');
    await assert.rejects(buildDocs({ ...paths, assetsDir }), /require validated: YYYY-MM-DD/);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('build accepts validated pages and writes static HTML with a raw Markdown twin', async () => {
  const paths = await fixture();
  try {
    const source = '---\ntitle: Example\ntype: make-and-maintain\nproduct: kei\nvalidated: 2026-10-17\nvalidated_with: kei v0.1.32\n---\n\nRun `kei --version`.\n';
    await writeFile(path.join(paths.contentDir, 'kei/setup/example.md'), source);
    const pages = await buildDocs({ ...paths, assetsDir });
    assert.equal(pages.length, 1);
    const html = await readFile(path.join(paths.outputDir, 'kei/setup/example.html'), 'utf8');
    const twin = await readFile(path.join(paths.outputDir, 'kei/setup/example.md'), 'utf8');
    assert.match(html, /Last validated 2026-10-17 with kei v0\.1\.32/);
    assert.match(html, /Run <code>kei --version<\/code>/);
    assert.equal(twin, source);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('sidebar groups pages as Get started, Make and maintain, and Reference', async () => {
  const paths = await fixture();
  try {
    await mkdir(path.join(paths.contentDir, 'kei', 'get-started'), { recursive: true });
    await mkdir(path.join(paths.contentDir, 'kei', 'make-and-maintain'), { recursive: true });
    await mkdir(path.join(paths.contentDir, 'kei', 'reference'), { recursive: true });
    await writeFile(path.join(paths.contentDir, 'kei/get-started/sign-in.md'), '---\ntitle: Sign in\ntype: read-and-use\nproduct: kei\n---\n\nSign in.\n');
    await writeFile(path.join(paths.contentDir, 'kei/make-and-maintain/runtime.md'), '---\ntitle: Deploy a runtime\ntype: read-and-use\nproduct: kei\n---\n\nDeploy it.\n');
    await writeFile(path.join(paths.contentDir, 'kei/reference/cli.md'), '---\ntitle: "Reference: kei CLI"\ntype: reference\nproduct: kei\n---\n\nUse it.\n');
    const pages = await buildDocs({ ...paths, assetsDir });
    const html = await readFile(path.join(paths.outputDir, 'index.html'), 'utf8');
    assert.equal(pages.length, 3);
    assert.match(html, /<div class="nav-section">Get started<\/div>/);
    assert.match(html, /<div class="nav-section">Make and maintain<\/div>/);
    assert.match(html, /<div class="nav-section">Reference<\/div>/);
    assert.equal((html.match(/class="nav-section"/g) ?? []).length, 3);
    const groups = [
      ['Get started', 'href="/kei/get-started/sign-in"'],
      ['Make and maintain', 'href="/kei/make-and-maintain/runtime"'],
      ['Reference', 'href="/kei/reference/cli"'],
    ];
    for (const [label, link] of groups) {
      const start = html.indexOf(`<div class="nav-section">${label}</div>`);
      const next = html.indexOf('<div class="nav-section">', start + 1);
      const section = html.slice(start, next === -1 ? html.indexOf('</nav>', start) : next);
      assert.ok(section.includes(link), `${label} should contain ${link}`);
    }
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('build writes clean HTML and Markdown paths with extensionless sidebar links', async () => {
  const outputDir = path.resolve('.scratch/clean-urls/dist');
  try {
    await buildDocs({ outputDir, assetsDir });
    const htmlPath = path.join(outputDir, 'kei/get-started/sign-in.html');
    const markdownPath = path.join(outputDir, 'kei/get-started/sign-in.md');
    const html = await readFile(htmlPath, 'utf8');
    const sidebar = await readFile(path.join(outputDir, 'index.html'), 'utf8');
    assert.ok(html);
    assert.ok(markdownPath);
    assert.equal(await readFile(markdownPath, 'utf8'), await readFile(path.resolve('content/kei/get-started/sign-in.md'), 'utf8'));
    await assert.rejects(stat(path.join(outputDir, 'content')), { code: 'ENOENT' });
    await readFile(path.join(outputDir, '404.html'), 'utf8');
    assert.match(sidebar, /href="\/kei\/get-started\/sign-in"/);
    for (const file of await htmlFiles(outputDir)) {
      const html = await readFile(file, 'utf8');
      assert.doesNotMatch(html, /href="\/content\//, `${file} contains a /content/ href`);
      assert.doesNotMatch(html, /href="(?!https?:)[^"]*\.html(?:[?#][^"]*)?"/, `${file} contains an internal .html href`);
      const urls = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((match) => match[1]);
      for (const url of urls) {
        assert.ok(await resolvesInternalUrl(url, file, outputDir), `${file} has a broken internal URL: ${url}`);
      }
    }
  } finally {
    await rm(path.resolve('.scratch'), { recursive: true, force: true });
  }
});

test('built pages ship theme-init before stylesheets, header links, TOC and pager while keeping the URL contract', async () => {
  const paths = await fixture();
  try {
    const page = (title, extra = '') => `---\ntitle: ${title}\ntype: reference\nproduct: kei\n---\n\n## One\n\n## Two\n\n## Three\n\n\`\`\`sh\nkei help\n\`\`\`\n${extra}`;
    await writeFile(path.join(paths.contentDir, 'kei/setup/a.md'), page('Alpha'));
    await writeFile(path.join(paths.contentDir, 'kei/setup/b.md'), page('Beta'));
    await buildDocs({ ...paths, assetsDir });
    const html = await readFile(path.join(paths.outputDir, 'kei/setup/a.html'), 'utf8');
    assert.ok(html.indexOf("haikei-theme") < html.indexOf('rel="stylesheet"'));
    assert.match(html, /href="https:\/\/github\.com\/HaikeiLabs\/docs"/);
    assert.match(html, /href="\/kei\/setup\/a\.md">View as Markdown/);
    const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
    assert.match(header, /href="https:\/\/haikeilabs\.com"/);
    assert.match(header, /href="https:\/\/app\.haikeilabs\.com">Console</);
    assert.match(header, /href="\/">Docs</);
    assert.match(html, /class="toc"/);
    assert.match(html, /class="pager-next" href="\/kei\/setup\/b"/);
    assert.equal((await stat(path.join(paths.outputDir, 'assets/site.js'))).isFile(), true);
    assert.equal((await stat(path.join(paths.outputDir, 'kei/setup/a.md'))).isFile(), true);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('build publishes index.json: one {slug,title,path,product} per page in sidebar order, each with a Markdown twin', async () => {
  const paths = await fixture();
  try {
    await mkdir(path.join(paths.contentDir, 'kei', 'get-started'), { recursive: true });
    const page = (title) => `---\ntitle: ${title}\ntype: reference\nproduct: kei\n---\n\nBody.\n`;
    await writeFile(path.join(paths.contentDir, 'kei/setup/runtime.md'), page('Runtime'));
    await writeFile(path.join(paths.contentDir, 'kei/get-started/sign-in.md'), page('Sign in to Kei'));
    await buildDocs({ ...paths, assetsDir });
    const index = JSON.parse(await readFile(path.join(paths.outputDir, 'index.json'), 'utf8'));
    assert.deepEqual(index, [
      { slug: 'kei/get-started/sign-in', title: 'Sign in to Kei', path: '/kei/get-started/sign-in', product: 'kei' },
      { slug: 'kei/setup/runtime', title: 'Runtime', path: '/kei/setup/runtime', product: 'kei' },
    ]);
    for (const entry of index) {
      assert.deepEqual(Object.keys(entry), ['slug', 'title', 'path', 'product']);
      assert.equal((await stat(path.join(paths.outputDir, `${entry.path}.md`))).isFile(), true);
    }
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('Get started sidebar, prev/next chain and manifest follow the order field, then title', async () => {
  const paths = await fixture();
  try {
    await mkdir(path.join(paths.contentDir, 'kei', 'get-started'), { recursive: true });
    const page = (title, order) => `---\ntitle: ${title}\ntype: read-and-use\nproduct: kei\n${order ? `order: ${order}\n` : ''}---\n\nBody.\n`;
    // Alphabetical by title would be Alpha, Bravo, Charlie, Delta, Echo.
    await writeFile(path.join(paths.contentDir, 'kei/get-started/echo.md'), page('Echo', 1));
    await writeFile(path.join(paths.contentDir, 'kei/get-started/delta.md'), page('Delta', 2));
    await writeFile(path.join(paths.contentDir, 'kei/get-started/charlie.md'), page('Charlie', 3));
    await writeFile(path.join(paths.contentDir, 'kei/get-started/bravo.md'), page('Bravo'));
    await writeFile(path.join(paths.contentDir, 'kei/get-started/alpha.md'), page('Alpha'));
    await buildDocs({ ...paths, assetsDir });
    const html = await readFile(path.join(paths.outputDir, 'kei/get-started/delta.html'), 'utf8');
    const sidebar = [...html.match(/<aside class="sidebar"[\s\S]*?<\/aside>/)[0].matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]);
    const expected = ['echo', 'delta', 'charlie', 'alpha', 'bravo'].map((slug) => `/kei/get-started/${slug}`);
    assert.deepEqual(sidebar, expected);
    assert.match(html, /class="pager-prev" href="\/kei\/get-started\/echo"/);
    assert.match(html, /class="pager-next" href="\/kei\/get-started\/charlie"/);
    const index = JSON.parse(await readFile(path.join(paths.outputDir, 'index.json'), 'utf8'));
    assert.deepEqual(index.map((entry) => entry.path), expected);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('build rejects an order that is not a positive integer', async () => {
  const paths = await fixture();
  try {
    await writeFile(path.join(paths.contentDir, 'kei/setup/a.md'), '---\ntitle: A\ntype: reference\nproduct: kei\norder: first\n---\n\nBody.\n');
    await assert.rejects(buildDocs({ ...paths, assetsDir }), /order must be a positive integer/);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('header and footer link the Discord community, opening safely in a new tab', async () => {
  const paths = await fixture();
  try {
    await writeFile(path.join(paths.contentDir, 'kei/setup/a.md'), '---\ntitle: Alpha\ntype: reference\nproduct: kei\n---\n\nBody.\n');
    await buildDocs({ ...paths, assetsDir });
    for (const file of ['kei/setup/a.html', 'index.html']) {
      const html = await readFile(path.join(paths.outputDir, file), 'utf8');
      const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
      assert.match(header, /<a [^>]*href="https:\/\/discord\.gg\/g6QaTYWXDa"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*aria-label="Haikei on Discord"/);
      const footer = html.match(/<footer class="footer">[\s\S]*?<\/footer>/)[0];
      assert.match(footer.replace(/<[^>]+>/g, ''), /Questions\? Join the developer community on Discord\./);
      assert.match(footer, /href="https:\/\/discord\.gg\/g6QaTYWXDa" target="_blank" rel="noopener noreferrer"/);
    }
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});
