import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeCompare} from '../assets/course/widgets/compare.js';

// Representative panes and line numbers from the course mockup's API comparison.
const fixture = {tabs: [{id: 'declare', name: '1. Declare the tool', sub: '', note: 'Same JSON Schema.', panes: [
  {label: 'OpenAI-compatible', file: 'tools[0]', lang: 'json', src: '{\n  "type": "function",\n  "function": {\n    "parameters": {}\n  }\n}', hl: [2, 3, 4]},
  {label: 'Anthropic', file: 'tools[0]', lang: 'json', src: '{\n  "name": "get_weather",\n  "description": "Get weather",\n  "input_schema": {}\n}', hl: [4]},
]}, {id: 'ask', name: '2. Model asks for it', sub: '', note: '', src: 'Source', panes: [
  {label: 'OpenAI-compatible', file: 'choices[0]', lang: 'json', src: 'one\ntwo', hl: [2]},
]}]};

test('normalizes tabs, panes, and 1-based highlighted lines without changing input', () => {
  const before = structuredClone(fixture);
  const model = normalizeCompare(fixture);
  assert.deepEqual(model.tabs.map(t => t.id), ['declare', 'ask']);
  assert.deepEqual(model.tabs[0].panes.map(p => p.label), ['OpenAI-compatible', 'Anthropic']);
  assert.deepEqual(model.tabs[0].panes[0].hl, [2, 3, 4]);
  assert.equal(model.tabs[1].src, 'Source');
  assert.deepEqual(fixture, before);
});

test('defaults optional fields and ignores invalid or duplicate highlight lines', () => {
  const model = normalizeCompare({tabs: [{id: 'x', name: 'X', panes: [{label: 'A', file: 'x', lang: 'tokens', src: 'a\nb', hl: [2, 0, 3, 2, 1.5]}, {label: 'B', file: 'y', lang: 'bash', src: ''}]}]});
  assert.equal(model.tabs[0].sub, '');
  assert.equal(model.tabs[0].note, '');
  assert.deepEqual(model.tabs[0].panes[0].hl, [2]);
  assert.deepEqual(model.tabs[0].panes[1].hl, []);
});

test('widget files use role tokens instead of raw colors', async () => {
  for (const path of ['assets/course/widgets/compare.js', 'assets/course/widgets/compare.css']) {
    assert.doesNotMatch(await readFile(path, 'utf8'), /#[0-9a-f]{3,8}\b|rgba?\(/i, path);
  }
});
