const anchors = { complete: 'backend.complete(', reasoning: 'reasoning.strip(', validate: 'validator.validate(', retry: 'check.nudge', policy: 'policy.evaluate(', audit: 'auditor.record(', denied: 'denied by policy', run: 'tool(**call.args)', append: 'tool_message(', done: 'return answer' };
const labels = { complete: 'Model call', reasoning: 'Reasoning', validate: 'Validate', retry: 'Retry', policy: 'Policy', audit: 'Audit', denied: 'Denied', run: 'Run tool', append: 'Append', done: 'Done' };

export function rtBreakpointLines(code) {
  const lines = code.split('\n');
  return Object.fromEntries(Object.entries(anchors).map(([key, anchor]) => {
    const matches = lines.flatMap((line, index) => line.includes(anchor) ? [index + 1] : []);
    if (matches.length !== 1) throw new Error(`Expected one ${anchor} anchor`);
    return [key, matches[0]];
  }));
}

export function rtStops(trace) {
  const stops = []; let lap = 0, attempt = 0, count = 0, lastSent = 0, failIdx = 0, firstCall = true, retries = [];
  const add = (kind, e, extra = {}) => stops.push({ kind, lap, attempt, count, e, deny: kind === 'retry' || kind === 'denied' || (kind === 'validate' && !e.ok) || (kind === 'policy' && e.action === 'deny'), ...extra });
  trace.forEach((e, i) => {
    if (e.kind === 'lap') { lap = e.lap; attempt = 0; failIdx = 0; firstCall = true; retries = trace.slice(i).find(x => x.kind === 'inference_done')?.retries_added || []; }
    else if (e.kind === 'complete') { attempt++; const prevCount = lastSent; count = e.messages.length; lastSent = count; add('complete', e, { prevCount }); }
    else if (e.kind === 'reasoning') add('reasoning', e);
    else if (e.kind === 'validate') { add('validate', e); if (!e.ok) { const added = retries.slice(failIdx * 2, ++failIdx * 2); count += added.length; add('retry', e, { added }); } }
    else if (e.kind === 'policy') { if (firstCall) { count++; firstCall = false; } add('policy', e); }
    else if (e.kind === 'execute') { add('audit', e); add(e.status === 'denied' ? 'denied' : 'run', e); }
    else if (e.kind === 'append') { count++; add('append', e); }
    else if (e.kind === 'done') add('done', e);
  });
  return stops;
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? '';
// The shared highlighter may land with the course shell. Text remains escaped if absent.
async function highlight(src, lang) {
  try { const module = await import('../highlight.js'); return module.highlight(src, lang); }
  catch { return escape(src); }
}

export function mount(el, data, ctx) {
  const stops = rtStops(data.trace), lines = rtBreakpointLines(data.code), bps = new Set(Object.values(lines));
  let pos = 0, disposed = false;
  if (!document.querySelector('link[data-rtdebugger-css]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./rtdebugger.css', import.meta.url).href; link.dataset.rtdebuggerCss = ''; document.head.append(link); }
  if (!stops.length) { el.textContent = 'No runtime stops available.'; return; }
  const block = (title, value) => `<section class="rt-block"><div class="rt-label">${escape(title)}</div><pre>${escape(pretty(value))}</pre></section>`;
  const cards = messages => messages.map(m => block(m.role || 'message', Object.keys(m).length === 2 ? m.content : m)).join('');
  function draw(focus) {
    if (disposed) return;
    const st = stops[pos], e = st.e, line = lines[st.kind];
    let title = labels[st.kind], description = '', body = '';
    if (st.kind === 'complete') { title = `Lap ${st.lap}, attempt ${st.attempt}: model call`; description = `The model receives ${st.count} messages and returns a response.`; body = block('Response', e.response) + `<details><summary>Messages sent (${st.count})</summary>${cards(e.messages)}</details>`; }
    else if (st.kind === 'reasoning') { description = 'The reasoning adapter separates reasoning from the content before validation.'; body = block('Reasoning', e.reasoning || '(none)') + block('Clean content', e.clean || '(empty)'); }
    else if (st.kind === 'validate') { title = e.ok ? 'Validator: passed' : 'Validator: rejected'; description = 'The validator checks the response and requests a retry when needed.'; body = block(e.mode === 'text' ? 'Text response' : 'Tool calls', e.input) + (e.nudge ? block('Retry guidance', e.nudge) : ''); }
    else if (st.kind === 'retry') { title = `Retry: attempt ${st.attempt + 1} next`; description = 'These messages are added to history before the next model call.'; body = cards(st.added); }
    else if (st.kind === 'policy') { title = `Policy check: ${e.tool}`; description = 'The policy evaluator checks the call on behalf of the caller.'; body = `<div class="rt-decision ${e.action === 'deny' ? 'rt-deny' : 'rt-permit'}">${e.action === 'deny' ? 'Denied' : 'Allowed'}</div>` + block('Arguments', e.args) + block('On behalf of', e.subject) + block('Reason', e.reason) + block('Rule', e.rule); }
    else if (st.kind === 'audit') { title = 'Audit record written'; description = 'The decision is recorded before the tool runs.'; body = block('Audit record', e.audit); }
    else if (st.kind === 'denied' || st.kind === 'run') { title = st.kind === 'denied' ? `Denied: ${e.tool} did not run` : `Running ${e.tool}`; description = st.kind === 'denied' ? 'The error is returned to the model.' : 'Policy allowed the call.'; body = block('Tool result', e.output); }
    else if (st.kind === 'append') { title = 'Result appended'; description = 'The tool message joins history for the next model call.'; body = cards([e.message]); }
    else { description = `${e.laps} laps, ${e.audit_count} audit records.`; body = block('Final answer', e.text); }
    const code = data.code.split('\n').map((text, i) => { const n = i + 1, key = Object.keys(lines).find(k => lines[k] === n); return `<div class="rt-line${line === n ? ' rt-current' : ''}">${key ? `<button class="rt-bp" type="button" data-bp="${n}" aria-label="Toggle breakpoint: ${labels[key]}" aria-pressed="${bps.has(n)}">${bps.has(n) ? '●' : '○'}</button>` : '<span class="rt-bp-space"></span>'}<span class="rt-number">${n}</span><code>${escape(text) || ' '}</code></div>`; }).join('');
    let lastLap = 0;
    const timeline = stops.map((s, i) => { const lapLabel = s.lap !== lastLap ? `<span class="rt-lap">Lap ${s.lap}</span>` : ''; lastLap = s.lap; return `${lapLabel}<button type="button" data-go="${i}" class="rt-stop${s.deny ? ' rt-bad' : ''}" ${i === pos ? 'aria-current="step"' : ''}>${labels[s.kind]}</button>`; }).join('');
    el.innerHTML = `<div class="rt-debugger"><p class="rt-caption">Follow a real Agentware run through each gate.</p><div class="rt-controls"><button type="button" data-act="continue">Continue</button><button type="button" data-act="step">Step</button><button type="button" data-act="back">Back</button><button type="button" data-act="restart">Restart</button></div><div class="rt-status" aria-live="polite">Paused at line ${line} · ${escape(title)} · stop ${pos + 1} of ${stops.length}</div><div class="rt-grid"><div class="rt-left"><div class="rt-code"><div class="rt-label">Agentware runtime · breakpoints</div>${code}</div><div class="rt-vars"><div class="rt-label">Variables</div><dl><dt>lap</dt><dd>${st.lap}</dd><dt>attempt</dt><dd>${st.attempt}</dd><dt>messages</dt><dd>${st.count}</dd><dt>check</dt><dd>${st.kind === 'validate' ? (e.ok ? 'ok' : 'needs_retry') : st.kind === 'retry' ? 'needs_retry' : '—'}</dd><dt>decision</dt><dd>${escape(st.kind === 'policy' ? e.action : e.audit?.decision || '—')}</dd><dt>out</dt><dd>${escape(['run','denied'].includes(st.kind) ? e.output : st.kind === 'append' ? e.message.content : '—')}</dd></dl></div></div><div class="rt-inspector${st.deny ? ' rt-warning' : ''}"><h4>${escape(title)}</h4><p>${escape(description)}</p>${body}</div></div><div class="rt-timeline" aria-label="Every stop in this run">${timeline}</div></div>`;
    if (focus) el.querySelector(focus)?.focus();
  }
  function click(event) { const button = event.target.closest('button'); if (!button || !el.contains(button)) return; if (button.dataset.bp) { const n = Number(button.dataset.bp); bps.has(n) ? bps.delete(n) : bps.add(n); draw(`[data-bp="${n}"]`); return; } if (button.dataset.go !== undefined) { pos = Number(button.dataset.go); draw(`[data-go="${pos}"]`); return; } const action = button.dataset.act; if (!action) return; if (action === 'step') pos = Math.min(pos + 1, stops.length - 1); else if (action === 'back') pos = Math.max(pos - 1, 0); else if (action === 'restart') pos = 0; else { let next = pos + 1; while (next < stops.length - 1 && !bps.has(lines[stops[next].kind])) next++; pos = Math.min(next, stops.length - 1); } draw(`[data-act="${action}"]`); }
  el.addEventListener('click', click); ctx.onCleanup(() => { disposed = true; el.removeEventListener('click', click); }); draw();
  // Probe lazily so the optional shared module is never required to mount.
  void highlight('', 'python');
}
