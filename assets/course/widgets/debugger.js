const anchors = {send: 'build_request(', recv: 'call_model(', done: 'return final_text(', tool: 'run_tool(', append: 'tool_results('};
const labels = {send: 'Send to model', recv: 'Model returned', done: 'Done', tool: 'Tool call', append: 'Results appended'};
const styles = {anthropic: 'Claude', 'gpt-oss': 'GPT-OSS', qwen: 'Qwen3'};

export function breakpointLines(code) {
  const lines = code.split('\n');
  return Object.fromEntries(Object.entries(anchors).map(([kind, anchor]) => {
    const matches = lines.flatMap((line, i) => line.includes(anchor) ? [i + 1] : []);
    if (matches.length !== 1) throw new Error(`Expected exactly one ${anchor} anchor`);
    return [kind, matches[0]];
  }));
}
export function dbgStops(logs, style, code) {
  const lines = breakpointLines(code);
  return logs[style].flatMap((it, lap) => [
    {line: lines.send, kind: 'send', lap}, {line: lines.recv, kind: 'recv', lap},
    ...(it.done ? [{line: lines.done, kind: 'done', lap}] : [
      ...it.tools_run.map((_, k) => ({line: lines.tool, kind: 'tool', lap, k})),
      {line: lines.append, kind: 'append', lap},
    ]),
  ]);
}
export const supportsRawTokens = style => style === 'gpt-oss' || style === 'qwen';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const pretty = value => JSON.stringify(value, null, 2);

export function mount(el, data, ctx) {
  const css = new URL('./debugger.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${css}"]`)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.append(link);
  }
  const {logs, debugger: config} = data;
  const lines = breakpointLines(config.code);
  const bps = new Set(Object.values(lines));
  let style = 'qwen', view = 'messages', pos = 0, stops = dbgStops(logs, style, config.code);
  // TODO: lazily import ../highlight.js and call highlight(src, lang) when the shared highlighter lands.
  const block = (source, label) => `<div class="debugger-block"><div class="debugger-file">${esc(label)}</div><pre>${esc(source)}</pre></div>`;
  const cards = messages => `<div class="debugger-messages">${messages.map(m => `<div class="debugger-message"><strong>${esc(m.role)}</strong><pre>${esc(pretty(m))}</pre></div>`).join('')}</div>`;
  function draw(focus) {
    const it = logs[style][stops[pos].lap], st = stops[pos], raw = supportsRawTokens(style), help = config.help[style];
    const request = raw ? it.chat_request : it.request;
    let title, explanation, body;
    if (st.kind === 'send') {
      title = `Lap ${st.lap + 1}: about to send to the model`; explanation = help.build_request;
      const {messages, ...rest} = request;
      body = view === 'raw' && raw ? block(it.request.prompt, 'POST /v1/completions · prompt') : `${cards(messages)}<details><summary>Rest of the request body</summary>${block(pretty(rest), 'Request body')}</details>`;
    } else if (st.kind === 'recv') {
      title = `Lap ${st.lap + 1}: the model replied`; explanation = help.parse_tool_calls;
      body = raw && view === 'messages' ? cards([it.appended[0]]) : block(typeof it.response === 'string' ? it.response : pretty(it.response), raw ? 'Raw tokens' : 'Response');
    } else if (st.kind === 'tool') {
      const t = it.tools_run[st.k]; title = `Lap ${st.lap + 1}: running tool call ${st.k + 1} of ${it.tools_run.length}`;
      explanation = 'Your code runs this tool after the model asks for it.';
      body = block(`${t.name}(${pretty(t.args)})\n\nReturns:\n${t.result}`, 'Tool call');
    } else if (st.kind === 'append') {
      title = `Lap ${st.lap + 1}: adding the turn and results to history`; explanation = `${help.assistant_turn} ${help.tool_results}`;
      const tail = style === 'gpt-oss' ? '<|start|>assistant' : '<|im_start|>assistant\n';
      body = raw && view === 'raw' ? block(logs[style][st.lap + 1].request.prompt.slice(it.request.prompt.length - tail.length), 'Appended to the prompt') : cards(it.appended);
    } else {
      title = `Lap ${st.lap + 1}: no tool calls, so the loop returns`;
      explanation = `The run took ${logs[style].length} laps and ${logs[style].reduce((n, x) => n + (x.tools_run?.length || 0), 0)} tool calls.`;
      body = block(raw ? it.final : (it.response.content.find(c => c.type === 'text')?.text || ''), 'Final answer');
    }
    const history = request.messages.length + (st.kind === 'append' ? it.appended.length : 0);
    const tool = st.kind === 'tool' ? it.tools_run[st.k] : null;
    const vars = {lap: st.lap + 1, history: `${history} messages`, response: st.kind === 'send' ? '—' : raw ? `${it.response.length} chars` : `stop_reason="${it.response.stop_reason}"`, calls: st.kind === 'send' ? '—' : (it.tools_run || []).map(t => `${t.name}(${t.args.city})`).join(', ') || '[]', call: tool ? `${tool.name}(${pretty(tool.args)})` : '—', output: tool?.result || '—'};
    const code = config.code.split('\n').map((line, i) => {
      const n = i + 1, kind = Object.keys(lines).find(k => lines[k] === n);
      return `<div class="debugger-line${n === st.line ? ' current' : ''}">${kind ? `<button type="button" data-bp="${n}" aria-label="Breakpoint on line ${n}: ${esc(labels[kind])}" aria-pressed="${bps.has(n)}">${bps.has(n) ? '●' : '○'}</button>` : '<span></span>'}<span class="debugger-number">${n}</span><code>${esc(line)}</code></div>`;
    }).join('');
    el.innerHTML = `<div class="debugger-widget"><div class="debugger-toolbar"><div class="debugger-controls" aria-label="Model">${Object.entries(styles).map(([id, name]) => `<button type="button" data-style="${id}" aria-pressed="${id === style}">${name}</button>`).join('')}</div><div class="debugger-controls">${[['continue','Continue'],['step','Step'],['back','Back'],['restart','Restart']].map(([id, name]) => `<button type="button" data-action="${id}">${name}</button>`).join('')}</div></div>
      <div class="debugger-status" aria-live="polite">Paused at line ${st.line}: ${labels[st.kind]} · stop ${pos + 1} of ${stops.length}</div>
      <div class="debugger-grid"><div class="debugger-left"><div class="debugger-block"><div class="debugger-file">agent_loop.py · toggle breakpoints in the gutter</div><div class="debugger-code">${code}</div></div><div class="debugger-vars"><h4>Variables</h4>${Object.entries(vars).map(([k,v]) => `<div><span>${k}</span><code>${esc(v)}</code></div>`).join('')}</div></div>
      <section class="debugger-inspector"><h4>${esc(title)}</h4><p>${esc(explanation)}</p>${raw && st.kind !== 'tool' && st.kind !== 'done' ? `<div class="debugger-controls"><button type="button" data-view="messages" aria-pressed="${view === 'messages'}">Messages · chat API</button><button type="button" data-view="raw" aria-pressed="${view === 'raw'}">Raw tokens</button></div>` : ''}${body}</section></div>
      <nav class="debugger-timeline" aria-label="Every stop in this run">${stops.map((s,i) => `<button type="button" data-stop="${i}" ${i === pos ? 'aria-current="step"' : ''}>${i === 0 || stops[i-1].lap !== s.lap ? `Lap ${s.lap+1}: ` : ''}${labels[s.kind]}${s.kind === 'tool' ? ` ${s.k+1}` : ''}</button>`).join('')}</nav>
      <details class="debugger-real"><summary>The real render and parse code for ${styles[style]}</summary>${config.fns[style].map(src => block(src, 'agent_loop_mock.py')).join('')}</details></div>`;
    if (focus) el.querySelector(focus)?.focus();
  }
  const click = event => {
    const b = event.target.closest('button'); if (!b || !el.contains(b)) return;
    let focus;
    if (b.dataset.bp) { const n = +b.dataset.bp; bps.has(n) ? bps.delete(n) : bps.add(n); focus = `[data-bp="${n}"]`; }
    else if (b.dataset.style) { style = b.dataset.style; view = 'messages'; stops = dbgStops(logs, style, config.code); pos = 0; focus = `[data-style="${style}"]`; }
    else if (b.dataset.view) { view = b.dataset.view; focus = `[data-view="${view}"]`; }
    else if (b.dataset.stop) { pos = +b.dataset.stop; focus = `[data-stop="${pos}"]`; }
    else if (b.dataset.action) { const a = b.dataset.action; if (a === 'restart') pos = 0; else if (a === 'back') pos = Math.max(0, pos - 1); else if (a === 'step') pos = Math.min(stops.length - 1, pos + 1); else { let i = pos + 1; while (i < stops.length - 1 && !bps.has(stops[i].line)) i++; pos = Math.min(i, stops.length - 1); } focus = `[data-action="${a}"]`; }
    else return;
    draw(focus);
  };
  el.addEventListener('click', click); ctx.onCleanup(() => el.removeEventListener('click', click)); draw();
}
