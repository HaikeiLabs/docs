const rank = {high: 0, medium: 1, low: 2};
export function sortGaps(gaps) {
  return [...gaps].sort((a, b) => (rank[a.sev] ?? 3) - (rank[b.sev] ?? 3));
}
export function reproText(repro) {
  return `>>> fmt = get_formatter("qwen3")
>>> fmt.parse_tool_calls('<tool_call>\\n{"name": "get_weather", "arguments": {"city": "Tokyo"}}\\n</tool_call>')
${repro.qwen_parse_official}

>>> ReasoningAdapter().strip('<thinking>Need weather</thinking>Calling tool.')
${repro.reason_thinking_tag}
>>> ReasoningAdapter().strip('<think>Need weather</think>Calling tool.')
${repro.reason_think_tag}

>>> get_formatter("MiniMax-M2").model_family()
'${repro.minimax_family}'`;
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

export function mount(el, data, ctx) {
  const css = new URL('./gaps.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${css}"]`)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.append(link);
  }
  const source = reproText(data.repro);
  el.innerHTML = `<div class="gaps-widget"><div class="gaps-list">${sortGaps(data.gaps).map(g => `<article class="gaps-card"><div class="gaps-title"><strong>${escape(g.area)}</strong><span class="gaps-severity${g.sev === 'high' ? ' is-high' : ''}">${escape(g.sev)}</span></div><dl><dt>Real format</dt><dd class="gaps-mono">${escape(g.wire)}</dd><dt>Agentware</dt><dd class="gaps-mono">${escape(g.aw)}</dd><dt>Effect</dt><dd>${escape(g.effect)}</dd></dl></article>`).join('')}</div><details class="gaps-repro"><summary>Reproduce it (Python SDK ${escape(data.repro.sdk_version)})</summary><div class="gaps-code"><div class="gaps-file">python3</div><pre tabindex="0" aria-label="Reproduction output"><code>${escape(source)}</code></pre></div></details></div>`;
  let active = true;
  ctx.onCleanup(() => { active = false; });
  import('../highlight.js').then(({highlight}) => {
    if (active) el.querySelector('.gaps-code code').innerHTML = highlight(source, 'python');
  }).catch(() => {});
}
