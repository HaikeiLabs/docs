const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function normalizeCompare(data) {
  return {tabs: (data.tabs || []).map(tab => ({
    id: tab.id, name: tab.name, sub: tab.sub || '', note: tab.note || '', src: tab.src || '',
    panes: (tab.panes || []).map(pane => ({...pane, hl: [...new Set((pane.hl || []).filter(n => Number.isInteger(n) && n > 0 && n <= pane.src.split('\n').length))]})),
  }))};
}

// Escape first; only the three supported inline Markdown constructs become markup.
function inlineMarkdown(text) {
  return escapeHtml(text).replace(/`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g, (_, code, bold, italic) =>
    code !== undefined ? `<code>${code}</code>` : bold !== undefined ? `<strong>${bold}</strong>` : `<em>${italic}</em>`);
}
let nextId = 0;
export function mount(el, data, ctx) {
  const css = new URL('./compare.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${css}"]`)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.append(link);
  }
  const {tabs} = normalizeCompare(data);
  if (!tabs.length) return;
  const instance = `compare-${++nextId}`;
  let current = 0, highlighter = escapeHtml, active = true;
  function draw(focus = false) {
    const tab = tabs[current];
    el.innerHTML = `<div class="compare-widget"><div class="compare-tabs" role="tablist" aria-label="Comparison">${tabs.map((t, i) => `<button type="button" role="tab" id="${instance}-tab-${i}" aria-controls="${instance}-panel" aria-selected="${i === current}" tabindex="${i === current ? 0 : -1}" data-tab="${i}">${escapeHtml(t.name)}${t.sub ? `<small>${escapeHtml(t.sub)}</small>` : ''}</button>`).join('')}</div><div role="tabpanel" id="${instance}-panel" aria-labelledby="${instance}-tab-${current}"><div class="compare-note">${inlineMarkdown(tab.note)}</div><div class="compare-panes" style="--compare-count:${tab.panes.length}">${tab.panes.map(p => `<section class="compare-pane"><div class="compare-label">${escapeHtml(p.label)}</div><div class="compare-block"><div class="compare-file">${escapeHtml(p.file)}</div><pre tabindex="0" aria-label="${escapeHtml(p.label)} code"><code>${p.src.split('\n').map((line, i) => `<span class="compare-line${p.hl.includes(i + 1) ? ' is-highlighted' : ''}">${highlighter(line, p.lang) || ' '}</span>`).join('')}</code></pre></div></section>`).join('')}</div>${tab.src ? `<p class="compare-source">Source: ${escapeHtml(tab.src)}</p>` : ''}</div></div>`;
    if (focus) el.querySelector(`[data-tab="${current}"]`)?.focus();
  }
  const click = event => { const button = event.target.closest('[data-tab]'); if (button && el.contains(button)) { current = Number(button.dataset.tab); draw(true); } };
  const keydown = event => {
    if (!event.target.matches('[role="tab"]')) return;
    const keys = {ArrowRight: (current + 1) % tabs.length, ArrowLeft: (current + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1};
    if (Object.hasOwn(keys, event.key)) { event.preventDefault(); current = keys[event.key]; draw(true); }
  };
  el.addEventListener('click', click); el.addEventListener('keydown', keydown);
  ctx.onCleanup(() => { active = false; el.removeEventListener('click', click); el.removeEventListener('keydown', keydown); });
  draw();
  import('../highlight.js').then(module => { if (active && typeof module.highlight === 'function') { highlighter = module.highlight; draw(document.activeElement?.getAttribute('role') === 'tab' && el.contains(document.activeElement)); } }).catch(() => {});
}
