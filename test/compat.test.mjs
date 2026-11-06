import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { checkCompat, findVersionDrift, readCompatData, renderCompatBlock } from '../scripts/check-compat.mjs';
import { parseCompatTable } from '../scripts/sync-compat.mjs';
import { stripHtmlComments } from '../scripts/render.mjs';

const data = {
  version: '0.16.0',
  rows: [
    { sdk: '0.16.0', keiProxy: 'v0.6.5', keiCli: '0.3.6' },
    { sdk: '0.11.0', keiProxy: 'v0.3.0', keiCli: '0.2.0' },
  ],
};

test('parseCompatTable reads the rows between the compat markers', () => {
  const readme = [
    '# agentware',
    '<!-- compat:begin -->',
    '| agentware SDK | kei-proxy (minimum) | kei-cli (minimum) |',
    '| --- | --- | --- |',
    '| 0.16.0 | v0.6.5 | 0.3.6 |',
    '| 0.11.0 | v0.3.0 | 0.2.0 |',
    '<!-- compat:end -->',
  ].join('\n');
  assert.deepEqual(parseCompatTable(readme), data.rows);
});

test('parseCompatTable fails without the compat markers', () => {
  assert.throws(() => parseCompatTable('# no table'), /compat:begin/);
});

test('a "Compatible versions" line with an old version is drift', () => {
  const drift = findVersionDrift('Compatible versions: agentware 0.11.0, kei-proxy v0.3.0, kei-cli 0.2.0.\n', '0.16.0');
  assert.equal(drift.length, 1);
  assert.match(drift[0].text, /0\.11\.0/);
});

test('a go.mod require on an old agentware version is drift', () => {
  const drift = findVersionDrift('```\nrequire github.com/haikeilabs/agentware/go v0.11.0\n```\n', '0.16.0');
  assert.equal(drift.length, 1);
});

test('feature floors written "from X" or "X or later" are not drift', () => {
  const text = [
    'From Agentware 0.11.0, you can register tools over the socket.',
    'This needs Agentware 0.11.0 or later.',
    'Requires agentware 0.11.0 and later.',
  ].join('\n');
  assert.deepEqual(findVersionDrift(text, '0.16.0'), []);
});

test('the current version is not drift', () => {
  assert.deepEqual(findVersionDrift('require github.com/haikeilabs/agentware/go v0.16.0\nAgentware 0.16.0 is current.\n', '0.16.0'), []);
});

test('front matter (validated_with history) is ignored', () => {
  assert.deepEqual(findVersionDrift('---\ntitle: x\nvalidated_with: agentware 0.11.0\n---\nBody.\n', '0.16.0'), []);
});

test('the generated block lists the current version and every row', () => {
  const block = renderCompatBlock(data);
  assert.match(block, /^<!-- compat:begin -->/);
  assert.match(block, /<!-- compat:end -->$/);
  assert.match(block, /current Agentware release is 0\.16\.0/);
  assert.match(block, /\| 0\.11\.0 \| v0\.3\.0 \| 0\.2\.0 \|/);
});

test('build strips whole-line HTML comments outside code fences', () => {
  const source = 'a\n<!-- compat:begin -->\nb\n```\n<!-- keep -->\n```\n<!-- compat:end -->\n';
  assert.equal(stripHtmlComments(source), 'a\nb\n```\n<!-- keep -->\n```\n');
});

test('the docs carry the generated block and no stale Agentware versions', async () => {
  const result = await checkCompat();
  assert.deepEqual(result.problems, []);
});

test('the vendored copy matches the generated block in overview.md', async () => {
  const vendored = await readCompatData();
  const overview = await readFile(new URL('../content/agentware/build/overview.md', import.meta.url), 'utf8');
  assert.ok(overview.includes(renderCompatBlock(vendored)));
});
