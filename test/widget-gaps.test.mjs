import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import {sortGaps, reproEntries} from '../assets/course/widgets/gaps.js';

const gaps = [
  {area:'Prompt generator', sev:'low'}, {area:'Qwen3 tool calls', sev:'high'},
  {area:'GPT-OSS', sev:'medium'}, {area:'Thinking tags', sev:'high'},
];
const entries = [
  {label:'MiniMax text-mode parsing', code:'fmt = get_formatter("MiniMax-M2")\nfmt.model_family()', output:"'generic'"},
  {label:'Tool result text', code:'executor.format_result("get_weather", "sunny")', output:"'Tool get_weather result: sunny'"},
];

test('sorts gaps by severity, preserving source order without mutation', () => {
  assert.deepEqual(sortGaps(gaps).map(g => g.area), ['Qwen3 tool calls', 'Thinking tags', 'GPT-OSS', 'Prompt generator']);
  assert.equal(gaps[0].area, 'Prompt generator');
});

test('repro entries come from the data: one per entry, in order, with its label, code and output', () => {
  const result = reproEntries({sdk_version:'0.18.0', entries});
  assert.deepEqual(result.map(e => e.label), ['MiniMax text-mode parsing', 'Tool result text']);
  assert.equal(result[0].text, `>>> fmt = get_formatter("MiniMax-M2")\n... fmt.model_family()\n'generic'`);
  assert.equal(result[1].text, `>>> executor.format_result("get_weather", "sunny")\n'Tool get_weather result: sunny'`);
});

test('an entry with no output shows only its code', () => {
  assert.equal(reproEntries({sdk_version:'0.18.0', entries:[{label:'x', code:'run()', output:''}]})[0].text, '>>> run()');
});

test('no repro, no entries, or only the legacy captured keys means no entries', () => {
  assert.deepEqual(reproEntries(undefined), []);
  assert.deepEqual(reproEntries({sdk_version:'0.18.0'}), []);
  assert.deepEqual(reproEntries({sdk_version:'0.18.0', entries:[]}), []);
  const legacy = {qwen_parse_official:'[]', reason_thinking_tag:"'Calling tool.'", reason_think_tag:"'Calling tool.'", minimax_family:'generic', sdk_version:'0.18.0'};
  assert.deepEqual(reproEntries(legacy), []);
});

test('the widget hard-codes no model, formatter or tag example', async () => {
  const source = await readFile('assets/course/widgets/gaps.js', 'utf8');
  assert.doesNotMatch(source, /qwen|minimax|think|get_formatter|ReasoningAdapter|parse_tool_calls|model_family/i);
});

test('gaps schema: repro is optional, entries carry label, code and output, legacy keys still validate', async () => {
  const ajv = new Ajv({allErrors: true, allowUnionTypes: true});
  const validate = ajv.compile(JSON.parse(await readFile('schemas/course/gaps.schema.json', 'utf8')));
  const gap = {area:'GPT-OSS', sev:'medium', wire:'Harmony channels', aw:'OpenAI JSON formatter', effect:'Raw mode is not supported.'};
  assert.ok(validate({gaps:[gap]}), 'no repro');
  assert.ok(validate({gaps:[gap], repro:{sdk_version:'0.18.0', entries}}), 'entries');
  assert.ok(validate({gaps:[gap], repro:{qwen_parse_official:'[]', reason_thinking_tag:'a', reason_think_tag:'b', minimax_family:'generic', sdk_version:'0.18.0'}}), 'legacy keys (docs data generated before entries)');
  assert.ok(!validate({gaps:[gap], repro:{entries}}), 'entries need sdk_version');
  assert.ok(!validate({gaps:[gap], repro:{sdk_version:'0.18.0', entries:[{label:'x', code:'y'}]}}), 'entry needs output');
  assert.ok(!validate({gaps:[gap], repro:{sdk_version:'0.18.0', entries:[{...entries[0], extra:1}]}}), 'entry rejects unknown fields');
  assert.ok(!validate({gaps:[gap], repro:{sdk_version:'0.18.0', entries:[]}}), 'empty entries: omit the field instead');
});

test('the real fixture data validates', async () => {
  const ajv = new Ajv({allErrors: true, allowUnionTypes: true});
  const validate = ajv.compile(JSON.parse(await readFile('schemas/course/gaps.schema.json', 'utf8')));
  assert.ok(validate(JSON.parse(await readFile('test/fixtures/course/agentware/data/gaps.json', 'utf8'))), JSON.stringify(validate.errors));
});

test('widget sources use role tokens rather than raw colors', async () => {
  for (const path of ['assets/course/widgets/gaps.js', 'assets/course/widgets/gaps.css']) {
    assert.doesNotMatch(await readFile(path, 'utf8'), /#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});
