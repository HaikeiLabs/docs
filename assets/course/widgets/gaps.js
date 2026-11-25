const rank = {high: 0, medium: 1, low: 2};
export function sortGaps(gaps) {
  return [...gaps].sort((a, b) => (rank[a.sev] ?? 3) - (rank[b.sev] ?? 3));
}
// One reproduction per entry in gaps.json `repro.entries`, as a Python REPL
// transcript: the code after `>>> ` (continuation lines after `... `), then the
// captured output. No entries means no reproduction block.
export function reproEntries(repro) {
  return (repro?.entries ?? []).map(({label, code, output}) => ({
    label,
    text: [code.split('\n').map((line, i) => `${i ? '...' : '>>>'} ${line}`).join('\n'), output].filter(Boolean).join('\n'),
  }));
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

export function mount(el, data, ctx) {
  const css = new URL('./gaps.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${css}"]`)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.append(link);
  }
  const entries = reproEntries(data.repro);
  const repro = entries.length ? `<details class="gaps-repro"><summary>Reproduce it (Python SDK ${escape(data.repro.sdk_version)})</summary>${entries.map(e => `<div class="gaps-code"><div class="gaps-file">${escape(e.label)}</div><pre tabindex="0" aria-label="${escape(e.label)}: reproduction"><code>${escape(e.text)}</code></pre></div>`).join('')}</details>` : '';
  el.innerHTML = `<div class="gaps-widget"><div class="gaps-list">${sortGaps(data.gaps).map(g => `<article class="gaps-card"><div class="gaps-title"><strong>${escape(g.area)}</strong><span class="gaps-severity${g.sev === 'high' ? ' is-high' : ''}">${escape(g.sev)}</span></div><dl><dt>Real format</dt><dd class="gaps-mono">${escape(g.wire)}</dd><dt>Agentware</dt><dd class="gaps-mono">${escape(g.aw)}</dd><dt>Effect</dt><dd>${escape(g.effect)}</dd></dl></article>`).join('')}</div>${repro}</div>`;
  if (!entries.length) return;
  let active = true;
  ctx.onCleanup(() => { active = false; });
  import('../highlight.js').then(({highlight}) => {
    if (active) el.querySelectorAll('.gaps-code code').forEach((code, i) => { code.innerHTML = highlight(entries[i].text, 'python'); });
  }).catch(() => {});
}
