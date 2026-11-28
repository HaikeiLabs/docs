// The agent evals course (content/evals/course): it validates with the course
// validator, and the code its lessons show matches the generated data.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { validateCourse } from '../scripts/course-validate.mjs';

const dir = 'content/evals/course';
const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
const lesson = id => { const [, fm, body] = read(`lessons/${id}.md`).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); return { ...YAML.parse(fm), body }; };
const fences = (body, lang) => [...body.matchAll(/^```(\w+)[^\n]*\n([\s\S]*?)^```\s*$/gm)].filter(m => m[1] === lang).map(m => m[2]);
const suite = () => JSON.parse(read('data/support-agent-suite.json'));
const lessons = ['what-to-evaluate', 'a-case', 'graders', 'skill-evals', 'same-cases-many-models', 'reading-a-report', 'release-gate', 'build-one'];

test('the evals course validates', () => {
  assert.doesNotThrow(() => validateCourse(dir));
});

test('the hub lists the eight lessons in order and finishes in the Playground', () => {
  const [, fm] = read('index.md').match(/^---\n([\s\S]*?)\n---/);
  const hub = YAML.parse(fm);
  assert.equal(hub.course, 'evals');
  assert.deepEqual(hub.lessons, lessons);
  assert.match(hub.finish.primary.href, /^https:\/\/playground\.haikeilabs\.com\/evals$/);
  assert.equal(lesson('build-one').finish, true);
});

test('every lesson has 2 to 4 options and an answer in range', () => {
  for (const id of lessons) {
    const { quiz } = lesson(id);
    assert.ok(quiz.opts.length >= 2 && quiz.opts.length <= 4, id);
    assert.ok(quiz.a < quiz.opts.length, id);
  }
});

test('lesson 2 shows the first two cases of the example suite', () => {
  const [shown] = fences(lesson('a-case').body, 'json');
  assert.deepEqual(JSON.parse(shown), suite().cases.slice(0, 2));
});

test('lesson 8 shows a case from the example suite, unchanged', () => {
  const shown = JSON.parse(fences(lesson('build-one').body, 'json')[0]);
  const ids = suite().cases.map(c => JSON.stringify(c));
  for (const c of shown.cases) assert.ok(ids.includes(JSON.stringify(c)), c.id);
});

test('lessons use only compare widgets and json or python fences', () => {
  for (const id of lessons) {
    const { body } = lesson(id);
    for (const m of body.matchAll(/^\[widget:([a-z-]+)/gm)) assert.equal(m[1], 'compare', id);
    for (const m of body.matchAll(/^```(\S*)/gm)) if (m[1]) assert.ok(['json', 'python'].includes(m[1]), `${id}: ${m[1]}`);
  }
});

const pane = (stem, tab, i) => JSON.parse(JSON.parse(read(`data/${stem}.json`)).tabs.find(t => t.id === tab).panes.at(i).src);

test('lesson 1 shows the recorded decision for ORD-123', () => {
  assert.deepEqual(JSON.parse(fences(lesson('what-to-evaluate').body, 'json')[0]), pane('compare-graders', 'status-with-order-id', 1));
});

test('lesson 4 shows the checks the recorded skill runs were graded with', () => {
  assert.deepEqual(JSON.parse(fences(lesson('skill-evals').body, 'json')[0]).checks, pane('compare-skill-runs', 'case-2', 0).checks);
});
