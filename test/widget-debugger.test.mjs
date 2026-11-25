import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dbgStops, breakpointLines, supportsRawTokens, mount } from '../assets/course/widgets/debugger.js';

const code = ['build_request(', 'call_model(', 'return final_text(', 'run_tool(', 'tool_results('].join('\n');
const logs = {
  anthropic: [{tools_run: [{}, {}]}, {done: true}],
  'gpt-oss': [{tools_run: [{}]}, {tools_run: [{}]}, {done: true}],
  qwen: [{tools_run: [{}, {}]}, {done: true}],
};
const lap = (n, tools) => [{line: 1, kind: 'send', lap: n}, {line: 2, kind: 'recv', lap: n}, ...(tools === null ? [{line: 3, kind: 'done', lap: n}] : [...Array.from({length: tools}, (_, k) => ({line: 4, kind: 'tool', lap: n, k})), {line: 5, kind: 'append', lap: n}])];
test('anchors and mockup stop sequences', () => {
  assert.deepEqual(breakpointLines(code), {send: 1, recv: 2, done: 3, tool: 4, append: 5});
  for (const style of ['anthropic', 'qwen']) assert.deepEqual(dbgStops(logs, style, code), [...lap(0, 2), ...lap(1, null)]);
  assert.deepEqual(dbgStops(logs, 'gpt-oss', code), [...lap(0, 1), ...lap(1, 1), ...lap(2, null)]);
  assert.throws(() => breakpointLines(code + '\nrun_tool('));
});
test('raw view is available only for completion formats', () => {
  assert.equal(supportsRawTokens('anthropic'), false);
  assert.equal(supportsRawTokens('gpt-oss'), true);
  assert.equal(supportsRawTokens('qwen'), true);
});
test('widget files use role tokens rather than raw colors', async () => {
  for (const file of ['debugger.js', 'debugger.css']) assert.doesNotMatch(await readFile(new URL(`../assets/course/widgets/${file}`, import.meta.url), 'utf8'), /#[0-9a-f]{3,8}\b|rgba?\s*\(/i);
});
test('code lines reset the site inline-code styling', async () => {
  const css = await readFile(new URL('../assets/course/widgets/debugger.css', import.meta.url), 'utf8');
  const rule = css.match(/\.prose\s+\.debugger-widget\s+code\s*\{([^}]*)\}/)?.[1] || '';
  for (const declaration of [/background\s*:\s*none/, /border\s*:\s*0/, /padding\s*:\s*0/, /font\s*:\s*inherit/]) assert.match(rule, declaration);
});

test('rendered code preserves leading spaces and uses preformatted whitespace', async () => {
  const previous = globalThis.document;
  globalThis.document = {querySelector: () => ({})};
  const el = {innerHTML: '', addEventListener() {}, removeEventListener() {}};
  const source = ['    build_request(', 'call_model(', 'return final_text(', 'run_tool(', 'tool_results('].join('\n');
  try {
    mount(el, {logs: {qwen: [{chat_request: {messages: []}, request: {prompt: ''}, done: true}]}, debugger: {code: source, help: {qwen: {}}, fns: {qwen: []}}}, {onCleanup() {}});
    assert.match(el.innerHTML, /<code>    build_request\(<\/code>/);
    const css = await readFile(new URL('../assets/course/widgets/debugger.css', import.meta.url), 'utf8');
    assert.match(css, /\.debugger-line\s+code\s*\{[^}]*white-space\s*:\s*pre\s*[;}]/);
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});

test('counts use the singular for one item', async () => {
  const { countOf } = await import('../assets/course/widgets/debugger.js');
  assert.equal(countOf(1, 'message'), '1 message');
  assert.equal(countOf(0, 'message'), '0 messages');
  assert.equal(countOf(3, 'message'), '3 messages');
});
