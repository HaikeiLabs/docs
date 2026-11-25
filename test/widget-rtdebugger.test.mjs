import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rtStops, rtBreakpointLines } from '../assets/course/widgets/rtdebugger.js';

// Event order and message counts from the runtime lesson mockup.
const trace = [{"kind":"lap","lap":1},{"kind":"complete","messages":[{"role":"system"},{"role":"user"}]},{"kind":"reasoning"},{"kind":"validate","ok":false},{"kind":"complete","messages":[{"role":"system"},{"role":"user"},{"role":"user"},{"role":"assistant"}]},{"kind":"reasoning"},{"kind":"validate","ok":true},{"kind":"inference_done","retries_added":[{"role":"user","content":"Tool 'weather_lookup' does not exist. Available tools: get_weather, post_to_slack, and final_answer. Call one of them."},{"role":"assistant","content":""}]},{"kind":"policy","action":"allow"},{"kind":"execute","status":"ok"},{"kind":"append"},{"kind":"policy","action":"allow"},{"kind":"execute","status":"ok"},{"kind":"append"},{"kind":"lap","lap":2},{"kind":"complete","messages":[{"role":"system"},{"role":"user"},{"role":"user"},{"role":"assistant"},{"role":"assistant"},{"role":"tool"},{"role":"tool"}]},{"kind":"reasoning"},{"kind":"validate","ok":true},{"kind":"inference_done","retries_added":[]},{"kind":"policy","action":"deny"},{"kind":"execute","status":"denied"},{"kind":"append"},{"kind":"lap","lap":3},{"kind":"complete","messages":[{"role":"system"},{"role":"user"},{"role":"user"},{"role":"assistant"},{"role":"assistant"},{"role":"tool"},{"role":"tool"},{"role":"assistant"},{"role":"tool"}]},{"kind":"reasoning"},{"kind":"validate","ok":false},{"kind":"complete","messages":[{"role":"system"},{"role":"user"},{"role":"user"},{"role":"assistant"},{"role":"assistant"},{"role":"tool"},{"role":"tool"},{"role":"assistant"},{"role":"tool"},{"role":"user"},{"role":"assistant"}]},{"kind":"reasoning"},{"kind":"validate","ok":true},{"kind":"inference_done","retries_added":[{"role":"user","content":"Your previous response was not a valid tool call. You must respond with a tool call, not free text. Available tools: get_weather, post_to_slack, and final_answer. Please try again with a valid tool call."},{"role":"assistant","content":"Tokyo is warmer at 22°C, but it's raining. Bring an umbrella."}]},{"kind":"policy","action":"allow"},{"kind":"execute","status":"ok"},{"kind":"append"},{"kind":"done"}];
const code = "while lap < max_laps:\n    resp = backend.complete(messages)\n    clean = reasoning.strip(resp)\n    check = validator.validate(resp.tool_calls or clean)\n    if check.needs_retry:\n        messages += [user(check.nudge), assistant(clean)]\n        continue\n    messages.append(assistant(resp))\n    for call in resp.tool_calls:\n        # inside AuditedToolClient.Execute()\n        decision = policy.evaluate(call.name, call.args, caller)\n        auditor.record(AuditRecord(call, decision, caller))\n        if decision.action == \"deny\":\n            out = {\"error\": f\"denied by policy: {decision.reason}\"}\n        else:\n            out = tool(**call.args)\n        messages.append(tool_message(call.id, out))\n    if final_answer_called:\n        return answer";
const expected = [["complete",1,1,2],["reasoning",1,1,2],["validate",1,1,2],["retry",1,1,4],["complete",1,2,4],["reasoning",1,2,4],["validate",1,2,4],["policy",1,2,5],["audit",1,2,5],["run",1,2,5],["append",1,2,6],["policy",1,2,6],["audit",1,2,6],["run",1,2,6],["append",1,2,7],["complete",2,1,7],["reasoning",2,1,7],["validate",2,1,7],["policy",2,1,8],["audit",2,1,8],["denied",2,1,8],["append",2,1,9],["complete",3,1,9],["reasoning",3,1,9],["validate",3,1,9],["retry",3,1,11],["complete",3,2,11],["reasoning",3,2,11],["validate",3,2,11],["policy",3,2,12],["audit",3,2,12],["run",3,2,12],["append",3,2,13],["done",3,2,13]];

test('runtime stops match the mockup and flag retries and denials', () => {
 const stops = rtStops(trace);
 assert.deepEqual(stops.map(s => [s.kind,s.lap,s.attempt,s.count]), expected);
 for (const s of stops) assert.equal(s.deny, s.kind === 'retry' || s.kind === 'denied' || (s.kind === 'validate' && !s.e.ok) || (s.kind === 'policy' && s.e.action === 'deny'));
});

test('retry messages retain their actual order', () => {
 const reordered = structuredClone(trace);
 for (const event of reordered) if (event.kind === 'inference_done') event.retries_added.reverse();
 const retries = rtStops(reordered).filter(s => s.kind === 'retry');
 assert.deepEqual(retries.map(s => s.added.map(m => m.role)), [['assistant','user'],['assistant','user']]);
});

test('breakpoints follow anchors after lines move', () => {
 const lines = rtBreakpointLines(code);
 assert.equal(lines.complete, 2); assert.equal(lines.retry, 6); assert.equal(lines.done, 19);
 const shifted = rtBreakpointLines('# inserted\n' + code);
 for (const key of Object.keys(lines)) assert.equal(shifted[key], lines[key] + 1);
});

test('widget assets contain no raw colors', async () => {
 for (const name of ['rtdebugger.js','rtdebugger.css']) {
  const text = await readFile(new URL('../assets/course/widgets/' + name, import.meta.url), 'utf8');
  assert.doesNotMatch(text, /#[0-9a-f]{3,8}\b|rgba?\(/i);
 }
});
