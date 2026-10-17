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
