import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkLanguage, findViolations } from '../scripts/check-language.mjs';

async function withTempFiles(files, run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'check-language-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      await writeFile(path.join(dir, name), content);
    }
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('fails on a bad line outside code', async () => {
  await withTempFiles(
    { 'bad.md': '# Title\n\nThe runtime makes a governed call.\n' },
    async (dir) => {
      const problems = await checkLanguage(dir);
      assert.equal(problems.length, 1);
      assert.match(problems[0], /^bad\.md:3: "governed"$/);
    },
  );
});

test('passes when the word only appears in inline code', async () => {
  await withTempFiles(
    { 'ok.md': 'Call `governed_call` through the proxy.\n' },
    async (dir) => {
      assert.deepEqual(await checkLanguage(dir), []);
    },
  );
});

test('passes when the word only appears in a fenced code block', async () => {
  await withTempFiles(
    {
      'ok.md': 'Example:\n\n```json\n{ "tags": ["governed-connector"] }\n```\n',
    },
    async (dir) => {
      assert.deepEqual(await checkLanguage(dir), []);
    },
  );
});

test('flags every banned variant as a whole word', () => {
  const violations = findViolations('Kei governance, it governs, ungoverned and non-governed calls.');
  assert.deepEqual(
    violations.map((v) => v.word),
    ['governance', 'governs', 'ungoverned', 'governed'],
  );
});
