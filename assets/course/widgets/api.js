export function flattenFields(fields, depth = 0) {
  return fields.flatMap(field => [
    {...field, depth, required: field.r, tag: field.tag},
    ...flattenFields(field.k || [], depth + 1),
  ]);
}

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let highlighter;
async function highlight(src, lang) {
  try {
    highlighter ||= import('../highlight.js');
    const module = await highlighter;
    return module.highlight(src, lang);
  } catch {
    return esc(src);
  }
}

export function mount(el, data, ctx) {
  const css = new URL('./api.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${css}"]`)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.append(link);
  }
  let current = 0, example = 'req', generation = 0, disposed = false;
  const rows = fields => flattenFields(fields).map(f => `<div class="api-field" style="--api-depth:${f.depth}"><div class="api-field-head"><code>${esc(f.n)}</code><span class="api-type">${esc(f.t)}</span>${f.required ? '<span class="api-required">Required</span>' : ''}${f.tag ? `<span class="api-tag api-tag-${esc(f.tag)}">${esc(f.tag)}</span>` : ''}</div>${f.d ? `<p>${esc(f.d)}</p>` : ''}</div>`).join('');
  function draw(focus) {
    const e = data[current], version = ++generation;
    el.innerHTML = `<div class="api-widget"><div class="api-tabs" role="tablist" aria-label="Endpoints">${data.map((endpoint, i) => `<button type="button" role="tab" aria-selected="${i === current}" tabindex="${i === current ? 0 : -1}" data-endpoint="${i}">${esc(endpoint.vendor)}<small>${esc(endpoint.path)}</small></button>`).join('')}</div><div class="api-card"><div class="api-top"><div class="api-line"><span class="api-method">${esc(e.method)}</span><code>${esc(e.path)}</code></div><p>${esc(e.summary)}</p><p class="api-servers">Served by ${esc(e.servers)}</p></div><div class="api-body"><div class="api-schema">${e.headers.length ? `<h4>Headers</h4>${rows(e.headers)}` : ''}<h4>${e.method === 'RPC' ? 'Request' : 'Request body'} <span>application/json</span></h4>${rows(e.req)}<h4>${e.method === 'RPC' ? 'Result' : 'Response 200'}</h4>${rows(e.res)}</div><div class="api-example"><div class="api-controls"><button type="button" data-example="req" aria-pressed="${example === 'req'}">Example request</button><button type="button" data-example="res" aria-pressed="${example === 'res'}">Example response</button></div><div class="api-code"><div class="api-file">${esc(example === 'req' ? `${e.method} ${e.path}` : e.method === 'RPC' ? 'result' : '200 OK')}</div><pre><code>${esc(example === 'req' ? e.ex_req : e.ex_res)}</code></pre></div></div></div></div></div>`;
    if (focus) el.querySelector(focus)?.focus();
    highlight(example === 'req' ? e.ex_req : e.ex_res, 'json').then(html => {
      if (!disposed && generation === version && typeof html === 'string') el.querySelector('.api-code code').innerHTML = html;
    });
  }
  const click = event => {
    const button = event.target.closest('button'); if (!button || !el.contains(button)) return;
    if (button.dataset.endpoint !== undefined) { current = Number(button.dataset.endpoint); example = 'req'; draw(`[data-endpoint="${current}"]`); }
    else if (button.dataset.example) { example = button.dataset.example; draw(`[data-example="${example}"]`); }
  };
  const keydown = event => {
    if (event.target.getAttribute('role') !== 'tab' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    current = event.key === 'Home' ? 0 : event.key === 'End' ? data.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + data.length) % data.length;
    example = 'req'; draw(`[data-endpoint="${current}"]`);
  };
  el.addEventListener('click', click); el.addEventListener('keydown', keydown);
  ctx.onCleanup(() => { disposed = true; el.removeEventListener('click', click); el.removeEventListener('keydown', keydown); });
  if (data.length) draw();
}
