import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDocs } from '../scripts/build.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('fixture builds a single course page with every lesson', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'course-build-'));
  try {
    await buildDocs({ outputDir, courseDir: 'test/fixtures/course/agentware' });
    const html = await readFile(path.join(outputDir, 'agentware/course/index.html'), 'utf8');
    for (const id of ['basics', 'steps', 'api', 'loop', 'runtime', 'gaps']) assert.match(html, new RegExp(`id="${id}"`));
  } finally { await rm(outputDir, { recursive: true, force: true }); }
});

test('hash routes to a lesson or its owning inner anchor', async () => {
  const { lessonForHash } = await import('../assets/course/course.js');
  const lessons = [{ id: 'basics' }, { id: 'api' }];
  const root = { getElementById: id => id === 'api-example' ? { closest: () => lessons[1] } : null };
  assert.equal(lessonForHash('#api', lessons, root), lessons[1]);
  assert.equal(lessonForHash('#missing', lessons, root), lessons[0]);
  assert.equal(lessonForHash('#api-example', lessons, root), lessons[1]);
});
