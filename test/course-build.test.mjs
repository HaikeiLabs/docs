import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDocs } from '../scripts/build.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('fixture builds the hub and one page per lesson', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'course-build-'));
  try {
    await buildDocs({ outputDir, courseDir: 'test/fixtures/course/agentware' });
    const hub = await readFile(path.join(outputDir, 'agentware/course/index.html'), 'utf8');
    for (const id of ['basics', 'steps', 'api', 'loop', 'runtime', 'gaps']) {
      assert.match(hub, new RegExp(`href="/agentware/course/${id}/"`));
      assert.match(await readFile(path.join(outputDir, `agentware/course/${id}/index.html`), 'utf8'), new RegExp(`<section class="lesson" id="${id}">`));
    }
  } finally { await rm(outputDir, { recursive: true, force: true }); }
});

test('course progress and lesson eyebrow use the mono role at weight 500', async () => {
  const css = await readFile('assets/course/course.css', 'utf8');
  assert.match(css, /\.course-rail nav > p\s*,\s*\.lesson > p:first-child\s*\{[^}]*font(?:-weight)?:\s*500[^}]*var\(--font-mono\)/s);
});

test('both courses build with their own paths, lesson titles and widget data', async () => {
  const { cp, mkdir } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(os.tmpdir(), 'multi-course-'));
  const contentDir = path.join(root, 'content'), outputDir = path.join(root, 'dist');
  try {
    await cp('content', contentDir, { recursive: true });
    for (const id of ['agentware', 'evals']) {
      await mkdir(path.join(contentDir, id), { recursive: true });
      await rm(path.join(contentDir, id, 'course'), { recursive: true, force: true });
      await cp(`test/fixtures/course/${id}`, path.join(contentDir, id, 'course'), { recursive: true });
    }
    await buildDocs({ contentDir, outputDir });
    for (const [id, title] of [['agentware', 'Agentware'], ['evals', 'Evals']]) {
      const html = await readFile(path.join(outputDir, id, 'course/api/index.html'), 'utf8');
      assert.match(html, new RegExp(`<title>API · ${title} course</title>`));
      assert.ok(html.includes(`href="/${id}/course/api/"`));
      assert.ok(html.includes(`data-src="/${id}/course/data/compare-fixture.json"`));
      assert.ok(await readFile(path.join(outputDir, id, 'course/data/compare-fixture.json')));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
