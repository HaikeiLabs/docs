import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { strict as assert } from 'node:assert';

test('fixture course validates', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ['scripts/course-validate.mjs', 'test/fixtures/course/agentware']));
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateCourse } from '../scripts/course-validate.mjs';
const fixture = 'test/fixtures/course/agentware';
function mutated(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-test-'));
  try { fs.cpSync(fixture, dir, { recursive: true }); fn(dir); assert.throws(() => validateCourse(dir)); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function edit(dir, file, fn) { const p = path.join(dir, file); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }
for (const [name, change] of [
  ['four steps', d => edit(d, 'lessons/steps.md', s => s + '\n## Fourth\n\n```python\npass\n```\n')],
  ['two step widgets', d => edit(d, 'lessons/basics.md', s => s + '\n## Extra\n\n[widget:cycle]\n')],
  ['two reference widgets', d => edit(d, 'lessons/api.md', s => s + '\n## Extra\n\n[widget:cycle]\n')],
  ['marker without mark', d => edit(d, 'lessons/basics.md', s => s.replace('[[1]]', '[[9]]'))],
  ['missing anchor', d => edit(d, 'data/debugger.json', s => s.replace('build_request(', 'removed_anchor('))],
  ['unknown widget', d => edit(d, 'lessons/loop.md', s => s.replace('debugger', 'unknown'))],
  ['missing data', d => fs.rmSync(path.join(d, 'data/compare-fixture.json'))],
  ['id differs from filename', d => edit(d, 'lessons/basics.md', s => s.replace('id: basics', 'id: other'))],
  ['quiz answer out of range', d => edit(d, 'lessons/basics.md', s => s.replace('  a: 0', '  a: 5'))],
]) test(`rejects ${name}`, () => mutated(change));
