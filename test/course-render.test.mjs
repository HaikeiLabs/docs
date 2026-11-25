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

test('step code lines do not add extra whitespace and headings have a single divider', async () => {
  const html = renderCourse(loadCourse('test/fixtures/course/agentware')).content;
  assert.doesNotMatch(html, /<\/span>\s*\n<span class="course-code-line">/);
  const css = await (await import('node:fs/promises')).readFile('assets/course/course.css', 'utf8');
  assert.match(css, /\.course-step h2\s*\{[^}]*border(?:-top)?:\s*(?:0|none)/);
  assert.match(css, /\.course-quiz button\s*\{[^}]*font:\s*inherit/);
});

test('marker role colors meet 4.5 contrast in light and dark themes', async () => {
  const fs = await import('node:fs/promises');
  const css = await fs.readFile('assets/course/course.css', 'utf8');
  assert.match(css, /\.course-mark,\s*\.mk\s*\{[^}]*color:\s*var\(--kei-permit-ink\)[^}]*background:\s*var\(--kei-permit-bg\)/);
  const brand = await fs.readFile('node_modules/@haikeilabs/brand/dist/styles.flat.css', 'utf8');
  const light = brand.slice(0, brand.indexOf('[data-theme="dark"]'));
  const dark = brand.slice(brand.indexOf('[data-theme="dark"]'), brand.indexOf('/* Follow the OS'));
  const color = (block, name) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6}|rgba\\([^)]+\\))`, 'i'))[1];
  const rgb = value => value.startsWith('#') ? [1,3,5].map(i => parseInt(value.slice(i,i+2),16)) : value.match(/[\d.]+/g).map(Number);
  const lum = values => values.slice(0,3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i],0);
  for (const block of [light, dark]) {
    const ink = rgb(color(block, 'kei-permit-ink')), bg = rgb(color(block, 'kei-permit-bg')), surface = rgb(color(block, 'color-surface'));
    const blended = bg.length === 4 ? bg.slice(0,3).map((v,i) => v * bg[3] + surface[i] * (1-bg[3])) : bg;
    const values = [lum(ink), lum(blended)].sort((a,b) => b-a);
    assert.ok((values[0]+.05)/(values[1]+.05) >= 4.5);
  }
});
