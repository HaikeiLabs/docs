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

test('fails on "Kei skills" with a Haikei Skills fix', async () => {
  await withTempFiles(
    { 'bad.md': 'Install the Kei skills into your assistant.\n' },
    async (dir) => {
      const problems = await checkLanguage(dir);
      assert.equal(problems.length, 1);
      assert.match(problems[0], /^bad\.md:1: "Kei skills" → Haikei Skills$/);
    },
  );
});

test('fails on "Kei guardrails" with a Kei policies fix', async () => {
  await withTempFiles(
    { 'bad.md': 'Add Kei guardrails to the agent.\n' },
    async (dir) => {
      const problems = await checkLanguage(dir);
      assert.equal(problems.length, 1);
      assert.match(problems[0], /^bad\.md:1: "Kei guardrails" → Kei policies$/);
    },
  );
});

test('fails on lowercase agentware in prose', () => {
  const violations = findViolations('Build it with agentware today.');
  assert.deepEqual(
    violations.map((v) => [v.word, v.fix]),
    [['agentware', 'Agentware']],
  );
});

test('allows agentware in inline code, URLs and paths', () => {
  const text =
    'Install `agentware` from https://github.com/haikeilabs/agentware, ' +
    'then read agentware/README.md, go/agentware and kei-agentware notes.';
  assert.deepEqual(findViolations(text), []);
});

test('allows agentware in anchor fragments but flags headings', () => {
  const anchored = 'See [Agentware: the SDK](#agentware-the-sdk) for details.';
  assert.deepEqual(findViolations(anchored), []);
  const heading = findViolations('# agentware SDK middleware');
  assert.deepEqual(heading.map((v) => v.fix), ['Agentware']);
});

test('exempts the product: enum value but still checks title and description', () => {
  const text =
    '---\ntitle: Build with agentware\nproduct: agentware\n' +
    'description: Use Agentware well.\n---\n\nUse agentware today.\n';
  assert.deepEqual(
    findViolations(text).map((v) => v.line),
    [2, 7],
  );
});
