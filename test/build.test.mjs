import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDocs } from '../scripts/build.mjs';

const assetsDir = new URL('../assets/', import.meta.url).pathname;

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
    const html = await readFile(path.join(paths.outputDir, 'content/kei/setup/example.html'), 'utf8');
    const twin = await readFile(path.join(paths.outputDir, 'content/kei/setup/example.md'), 'utf8');
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
      ['Get started', 'href="/content/kei/get-started/sign-in.html"'],
      ['Make and maintain', 'href="/content/kei/make-and-maintain/runtime.html"'],
      ['Reference', 'href="/content/kei/reference/cli.html"'],
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
