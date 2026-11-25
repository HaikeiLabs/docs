import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sortGaps, reproText} from '../assets/course/widgets/gaps.js';

const gaps = [
  {area:'Prompt generator', sev:'low'}, {area:'Qwen3 tool calls', sev:'high'},
  {area:'GPT-OSS', sev:'medium'}, {area:'Thinking tags', sev:'high'},
];
const repro = {sdk_version:'0.17.0', qwen_parse_official:'[]', reason_thinking_tag:"'Calling tool.'", reason_think_tag:"'<think>Need weather</think>Calling tool.'", minimax_family:'generic'};

test('sorts gaps by severity, preserving source order without mutation', () => {
  assert.deepEqual(sortGaps(gaps).map(g => g.area), ['Qwen3 tool calls', 'Thinking tags', 'GPT-OSS', 'Prompt generator']);
  assert.equal(gaps[0].area, 'Prompt generator');
});
test('reproduction output uses all captured results', () => {
  const text = reproText(repro);
  for (const value of [repro.qwen_parse_official, repro.reason_thinking_tag, repro.reason_think_tag, repro.minimax_family]) assert.ok(text.includes(value));
  assert.match(text, /parse_tool_calls/);
  assert.match(text, /model_family/);
  assert.ok(reproText({...repro, minimax_family:'other'}).includes("'other'"));
});
test('widget sources use role tokens rather than raw colors', async () => {
  for (const path of ['assets/course/widgets/gaps.js', 'assets/course/widgets/gaps.css']) {
    assert.doesNotMatch(await readFile(path, 'utf8'), /#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});
