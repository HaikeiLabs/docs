import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cycleFrames, playbackMode } from '../assets/course/widgets/cycle.js';

// The mockup runs two calls in one lap for Claude and Qwen, and one per lap for GPT-OSS.
const tool = city => ({name: 'get_weather', args: {city}, result: JSON.stringify({temp: 22, sky: 'rain'})});
const lap = (calls, done = false) => ({request: {messages: [{role: 'user'}]}, chat_request: {messages: [{role: 'user'}]}, tools_run: calls, done, final: done ? 'The answer' : null, response: {content: [{type: 'text', text: 'The answer'}]}});
const logs = {anthropic: [lap([tool('Tokyo'), tool('Seoul')]), lap(null, true)], 'gpt-oss': [lap([tool('Tokyo')]), lap([tool('Seoul')]), lap(null, true)], qwen: [lap([tool('Tokyo'), tool('Seoul')]), lap(null, true)]};
test('frames match the mockup runs and preserve their routing', () => {
  for (const [style, count] of Object.entries({anthropic: 10, 'gpt-oss': 12, qwen: 10})) {
    const frames = cycleFrames(logs, style);
    assert.equal(frames.length, count);
    assert.deepEqual([frames[0].a, frames[0].b], ['user', 'code']);
    assert.deepEqual([frames.at(-1).a, frames.at(-1).b], ['code', 'user']);
    assert.equal(frames.at(-1).done, true);
    assert.equal(frames.filter(f => f.b === 'tool').length, 2);
  }
});
test('reduced motion uses manual stepping', () => {
  assert.equal(playbackMode(true), 'step');
  assert.equal(playbackMode(false), 'play');
});
test('widget files use role tokens rather than raw colors', async () => {
  for (const file of ['cycle.js', 'cycle.css']) assert.doesNotMatch(await readFile(new URL(`../assets/course/widgets/${file}`, import.meta.url), 'utf8'), /#[0-9a-f]{3,8}\b|rgba?\s*\(/i);
});
