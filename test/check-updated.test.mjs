import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUpdated } from '../scripts/check-updated.mjs';

// check:updated warns when a lesson or the data it shows changed against a base
// ref without its updated date changing. Each test builds a throwaway git repo.
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/check-updated.mjs');
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GITHUB_ACTIONS: '' };
const course = 'content/agentware/course';
const lessonText = (id, extra = '', body = '## Step\n\nText.\n\n```python\npass\n```\n') => `---\nid: ${id}\nnum: 1\ntitle: ${id}\nmins: 3\n${extra}lede: Lede.\nquiz:\n  q: Q?\n  opts: [A, B]\n  a: 0\n  why: Because.\n---\n\n${body}`;

function repo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-updated-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, env, encoding: 'utf8' });
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  try {
    git('init', '-q', '-b', 'main');
    write(`${course}/index.md`, '---\ntitle: Course\n---\n');
    write(`${course}/lessons/plain.md`, lessonText('plain', 'updated: 2026-11-01\n'));
    write(`${course}/lessons/runtime.md`, lessonText('runtime', 'updated: 2026-11-01\n', '## Trace\n\nText.\n\n[widget:rtdebugger data=runtime-trace]\n'));
    write(`${course}/lessons/loop.md`, lessonText('loop', '', '## Loop\n\nText.\n\n[widget:debugger]\n'));
    write(`${course}/data/runtime-trace.json`, '{"v":1}\n');
    write(`${course}/data/logs.json`, '{"v":1}\n');
    write(`${course}/data/debugger.json`, '{"v":1}\n');
    write('README.md', 'readme\n');
    git('add', '-A'); git('commit', '-q', '-m', 'base');
    git('checkout', '-q', '-b', 'feature');
    return fn({ dir, git, write, check: (options = {}) => checkUpdated({ base: 'main', cwd: dir, ...options }) });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const lessons = warnings => warnings.map(w => w.lesson).sort();

test('no changes, no warnings', () => repo(({ check }) => assert.deepEqual(check(), [])));

test('a lesson edited without bumping updated warns', () => repo(({ write, git, check }) => {
  write(`${course}/lessons/plain.md`, lessonText('plain', 'updated: 2026-11-01\n', '## Step\n\nNew text.\n\n```python\npass\n```\n'));
  git('commit', '-qam', 'edit');
  const warnings = check();
  assert.deepEqual(lessons(warnings), ['plain']);
  assert.equal(warnings[0].file, `${course}/lessons/plain.md`);
  assert.match(warnings[0].message, /plain: plain\.md changed but updated is still 2026-11-01/);
}));

test('a lesson edited with a new updated date does not warn', () => repo(({ write, git, check }) => {
  write(`${course}/lessons/plain.md`, lessonText('plain', 'updated: 2026-11-27\n', '## Step\n\nNew text.\n\n```python\npass\n```\n'));
  git('commit', '-qam', 'edit');
  assert.deepEqual(check(), []);
}));

test('a data file change warns for each lesson that shows it, including implicit widget data', () => repo(({ write, git, check }) => {
  write(`${course}/data/runtime-trace.json`, '{"v":2}\n');
  write(`${course}/data/logs.json`, '{"v":2}\n');
  git('commit', '-qam', 'regenerate');
  const warnings = check();
  assert.deepEqual(lessons(warnings), ['loop', 'runtime']);
  assert.match(warnings.find(w => w.lesson === 'runtime').message, /runtime-trace\.json changed/);
  assert.match(warnings.find(w => w.lesson === 'loop').message, /logs\.json changed but the lesson has no updated date/);
}));

test('uncommitted changes count, and files outside the course do not', () => repo(({ write, check }) => {
  write('README.md', 'changed\n');
  write(`${course}/data/debugger.json`, '{"v":3}\n');
  assert.deepEqual(lessons(check()), ['loop']);
}));

test('the manifest and a new lesson do not warn', () => repo(({ write, git, check }) => {
  write(`${course}/data/manifest.json`, '{"files":{}}\n');
  write(`${course}/lessons/fresh.md`, lessonText('fresh'));
  git('add', '-A'); git('commit', '-qm', 'add');
  assert.deepEqual(check(), []);
}));

test('the comparison is against the merge base, so later commits on the base branch do not count', () => repo(({ write, git, check }) => {
  git('checkout', '-q', 'main');
  write(`${course}/lessons/plain.md`, lessonText('plain', 'updated: 2026-11-01\n', '## Step\n\nMain moved.\n\n```python\npass\n```\n'));
  git('commit', '-qam', 'main moves');
  git('checkout', '-q', 'feature');
  assert.deepEqual(check(), []);
}));

test('an unknown base ref is a single warning, not a failure', () => repo(({ check }) => {
  const warnings = check({ base: 'origin/nope' });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /base ref origin\/nope not found/);
}));

test('CLI: prints warnings, exits 0, and annotates on GitHub Actions', () => repo(({ dir, write, git }) => {
  write(`${course}/lessons/plain.md`, lessonText('plain', 'updated: 2026-11-01\n', '## Step\n\nNew.\n\n```python\npass\n```\n'));
  git('commit', '-qam', 'edit');
  const plain = spawnSync(process.execPath, [script, 'main'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stderr, /warning: plain: plain\.md changed/);
  const ci = spawnSync(process.execPath, [script, 'main'], { cwd: dir, env: { ...env, GITHUB_ACTIONS: 'true' }, encoding: 'utf8' });
  assert.equal(ci.status, 0);
  assert.match(ci.stdout, /::warning file=content\/agentware\/course\/lessons\/plain\.md::plain: plain\.md changed/);
  const clean = spawnSync(process.execPath, [script], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(clean.status, 0, 'default base origin/main is missing here: still exit 0');
}));
