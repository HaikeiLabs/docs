import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadCourse, renderCourse } from '../scripts/course.mjs';

test('renders markers, code gutter, collapsed reference, widgets and quiz', () => {
  const html = renderCourse(loadCourse('test/fixtures/course/agentware')).content;
  assert.match(html, /class="mk"[^>]*>1<\/span>/);
  assert.match(html, /class="course-mark"[^>]*>1<\/span>/);
  assert.match(html, /<details class="course-reference">/);
  assert.match(html, /data-widget="compare" data-src="\/agentware\/course\/data\/compare-fixture.json"/);
  assert.match(html, /data-quiz-answer="0"/);
});

test('progress survives storage errors', async () => {
  const { readProgress, saveProgress } = await import('../assets/course/course.js');
  const storage = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('unavailable'); } };
  assert.equal(readProgress(storage).size, 0);
  assert.doesNotThrow(() => saveProgress(storage, new Set(['basics'])));
});

test('shared highlighter escapes text and highlights special tokens', async () => {
  const { highlight } = await import('../assets/course/highlight.js');
  assert.match(highlight('<|call|> <tag> "hello" &', 'tokens'), /tok-k/);
  assert.match(highlight('<|call|> <tag> "hello" &', 'tokens'), /&amp;/);
});

test('only a correct answer completes a lesson once', async () => {
  const { recordAnswer } = await import('../assets/course/course.js');
  const done = new Set();
  assert.deepEqual(recordAnswer(done, 'basics', '1', '0'), { correct: false, newlyComplete: false });
  assert.equal(done.size, 0);
  assert.deepEqual(recordAnswer(done, 'basics', '0', '0'), { correct: true, newlyComplete: true });
  assert.deepEqual(recordAnswer(done, 'basics', '0', '0'), { correct: true, newlyComplete: false });
});
