import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCourse, lessonDataStems } from '../scripts/course-validate.mjs';
import { compareVersions, formatDate } from '../scripts/course-version.mjs';

// Content versioning: lesson updated / agentware / change_note, the data manifest,
// and the freshness warnings. Every test uses the fixture compat file, never the
// repo's scripts/data/agentware-compat.json, so a compat sync cannot change a result.
const fixture = 'test/fixtures/course/agentware';
const compat = 'test/fixtures/course/agentware-compat.json';
const latest = JSON.parse(fs.readFileSync(compat, 'utf8')).version;
const today = '2026-11-27';

function withCopy(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-version-'));
  try { fs.cpSync(fixture, dir, { recursive: true }); return fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function edit(dir, file, fn) { const p = path.join(dir, file); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }
function editManifest(dir, fn) { edit(dir, 'data/manifest.json', s => JSON.stringify(fn(JSON.parse(s)), null, 2)); }
const check = (dir, options = {}) => checkCourse(dir, { latest, today, ...options });

test('the fixture with versioning fields and a manifest validates', () => {
  const { hub, warnings } = check(fixture);
  assert.equal(hub.lessons.length, 6);
  // runtime (0.2.0) is behind the fixture's latest (0.3.0); gaps (0.3.0) is current.
  assert.deepEqual(warnings.map(w => w.lesson), ['runtime']);
});

test('the versioning fields stay optional: a lesson without them validates', () => withCopy(dir => {
  edit(dir, 'lessons/basics.md', s => s.replace('updated: 2026-11-01\n', ''));
  assert.doesNotThrow(() => check(dir));
}));

test('the manifest stays optional: without it a lesson needs no agentware', () => withCopy(dir => {
  fs.rmSync(path.join(dir, 'data/manifest.json'));
  edit(dir, 'lessons/runtime.md', s => s.replace('agentware: 0.2.0\n', ''));
  edit(dir, 'lessons/gaps.md', s => s.replace('agentware: 0.3.0\n', ''));
  assert.doesNotThrow(() => check(dir));
}));

for (const [name, change, pattern] of [
  ['an updated date in the wrong format', d => edit(d, 'lessons/basics.md', s => s.replace('updated: 2026-11-01', 'updated: 27 Nov 2026')), /updated/],
  ['an updated date that does not exist', d => edit(d, 'lessons/basics.md', s => s.replace('updated: 2026-11-01', 'updated: 2026-02-30')), /updated 2026-02-30 is not a real date/],
  ['an updated date after the build date', d => edit(d, 'lessons/basics.md', s => s.replace('updated: 2026-11-01', 'updated: 2026-12-01')), /updated 2026-12-01 is after/],
  ['an agentware version that is not X.Y.Z', d => edit(d, 'lessons/runtime.md', s => s.replace('agentware: 0.2.0', 'agentware: v0.2')), /agentware/],
  ['an empty change_note', d => edit(d, 'lessons/runtime.md', s => s.replace(/change_note: .*\n/, 'change_note: ""\n')), /change_note/],
  ['a change_note over two lines', d => edit(d, 'lessons/runtime.md', s => s.replace(/change_note: .*\n/, 'change_note: "One line.\\nTwo lines."\n')), /change_note/],
  ['HTML in a change_note', d => edit(d, 'lessons/runtime.md', s => s.replace('**policy**', '<b>policy</b>')), /change_note: use inline Markdown/],
  ['a manifest that breaks the schema', d => editManifest(d, m => { m.files['gaps.json'].generated_with.agentware = '0.3'; return m; }), /manifest/],
  ['a manifest entry without a source hash', d => editManifest(d, m => { delete m.files['gaps.json'].source_sha256; return m; }), /manifest/],
  ['a data file with no manifest entry', d => editManifest(d, m => { delete m.files['logs.json']; return m; }), /logs\.json has no entry in data\/manifest\.json/],
  ['a manifest entry for a missing file', d => editManifest(d, m => { m.files['gone.json'] = m.files['logs.json']; return m; }), /gone\.json.*no such data file/],
  ['an SDK lesson without agentware when the manifest exists', d => edit(d, 'lessons/runtime.md', s => s.replace('agentware: 0.2.0\n', '')), /runtime\.md: shows SDK-derived data \(runtime-trace\.json\); add agentware/],
  ['an SDK lesson whose version differs from its data', d => edit(d, 'lessons/gaps.md', s => s.replace('agentware: 0.3.0', 'agentware: 0.2.0')), /gaps\.md: agentware 0\.2\.0 but gaps\.json was generated with 0\.3\.0/],
  ['data marked SDK-derived under a lesson that declares no agentware', d => editManifest(d, m => { m.files['logs.json'].generated_with.agentware = '0.3.0'; return m; }), /basics\.md: shows SDK-derived data \(logs\.json\)/],
]) test(`rejects ${name}`, () => withCopy(dir => { change(dir); assert.throws(() => check(dir), pattern); }));

test('a lesson may declare agentware without SDK-derived data', () => withCopy(dir => {
  edit(dir, 'lessons/basics.md', s => s.replace('updated: 2026-11-01\n', 'updated: 2026-11-01\nagentware: 0.3.0\n'));
  assert.deepEqual(check(dir).warnings.map(w => w.lesson), ['runtime']);
}));

test('a lesson behind the latest release is a warning, not an error', () => {
  const { warnings } = check(fixture);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].file, path.join(fixture, 'lessons/runtime.md'));
  assert.match(warnings[0].message, /runtime: written for Agentware 0\.2\.0; the latest release is 0\.3\.0/);
});

test('a lesson ahead of the vendored latest warns to run sync:compat', () => {
  const { warnings } = check(fixture, { latest: '0.1.0' });
  assert.deepEqual(warnings.map(w => w.lesson), ['runtime', 'gaps']);
  assert.match(warnings[0].message, /newer than the vendored latest 0\.1\.0; run npm run sync:compat/);
});

test('without a latest version there is no freshness warning', () => {
  assert.deepEqual(check(fixture, { latest: undefined }).warnings, []);
});

test('lessonDataStems lists the data a lesson reads, including implicit widget data', () => {
  const body = id => fs.readFileSync(path.join(fixture, 'lessons', `${id}.md`), 'utf8');
  assert.deepEqual(lessonDataStems(body('loop')), ['logs', 'debugger']);
  assert.deepEqual(lessonDataStems(body('runtime')), ['runtime-trace']);
  assert.deepEqual(lessonDataStems(body('basics')), ['logs']);
});

test('CLI: warnings print but exit 0, and --data-for prints a lesson\'s data stems', () => {
  const run = (...args) => spawnSync(process.execPath, ['scripts/course-validate.mjs', fixture, '--compat', compat, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });
  const plain = run();
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stderr, /warning: .*runtime: written for Agentware 0\.2\.0/);
  assert.match(plain.stdout, /Course valid/);
  const stems = execFileSync(process.execPath, ['scripts/course-validate.mjs', fixture, '--data-for', 'loop'], { encoding: 'utf8' });
  assert.equal(stems, 'logs\ndebugger\n');
  const failing = spawnSync(process.execPath, ['scripts/course-validate.mjs', fixture, '--data-for', 'nope'], { encoding: 'utf8' });
  assert.notEqual(failing.status, 0);
});

test('CLI: on GitHub Actions a warning is a ::warning annotation on the lesson file', () => {
  const out = spawnSync(process.execPath, ['scripts/course-validate.mjs', fixture, '--compat', compat], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true' } });
  assert.equal(out.status, 0);
  assert.match(out.stdout + out.stderr, /::warning file=test\/fixtures\/course\/agentware\/lessons\/runtime\.md::runtime: written for Agentware 0\.2\.0/);
});

test('version helpers compare numerically and format dates without a locale', () => {
  assert.equal(compareVersions('0.18.1', '0.9.0'), 1);
  assert.equal(compareVersions('0.18.1', '0.18.1'), 0);
  assert.equal(compareVersions('0.2.0', '0.10.0'), -1);
  assert.equal(formatDate('2026-11-27'), '27 Nov 2026');
  assert.equal(formatDate('2026-01-05'), '5 Jan 2026');
});
