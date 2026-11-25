import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {flattenFields} from '../assets/course/widgets/api.js';

// Representative chat and MCP fields from the course mockup.
const field = (n, r = false, tag = null, k = []) => ({n, t: 'string', d: '', r, tag, k});
test('flattens chat fields in order, preserving depth, required and tags', () => {
  const fields = [field('model', true), field('messages', true, null, [field('role', true), field('tool_calls', false, 'tools')]), field('tools', false, 'tools', [field('function', true, null, [field('name', true)])]), field('reasoning_content', false, 'reasoning')];
  assert.deepEqual(flattenFields(fields).map(({n, depth, required, tag}) => [n, depth, required, tag]), [
    ['model', 0, true, null], ['messages', 0, true, null], ['role', 1, true, null], ['tool_calls', 1, false, 'tools'], ['tools', 0, false, 'tools'], ['function', 1, true, null], ['name', 2, true, null], ['reasoning_content', 0, false, 'reasoning'],
  ]);
});
test('flattens MCP request fields without inventing children', () => {
  const fields = [field('method', true), field('params.name', true), field('params.arguments', false)];
  assert.deepEqual(flattenFields(fields).map(({n, depth, required}) => [n, depth, required]), [['method', 0, true], ['params.name', 0, true], ['params.arguments', 0, false]]);
  assert.deepEqual(flattenFields([]), []);
});
test('widget uses role tokens instead of raw colors', async () => {
  for (const file of ['api.js', 'api.css']) {
    const source = await readFile(new URL(`../assets/course/widgets/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|rgba?\s*\(/i);
  }
  const css = await readFile(new URL('../assets/course/widgets/api.css', import.meta.url), 'utf8');
  assert.match(css, /api-tag-tools[^}]*--kei-permit-/s);
  assert.match(css, /api-tag-reasoning[^}]*--/s);
});
