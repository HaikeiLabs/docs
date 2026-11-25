const styles = {anthropic: 'Claude', 'gpt-oss': 'GPT-OSS', qwen: 'Qwen3'};
const points = {user: [70, 150], code: [280, 150], model: [490, 62], tool: [490, 238]};
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export const playbackMode = reducedMotion => reducedMotion ? 'step' : 'play';

export function cycleFrames(logs, style) {
  const log = logs[style];
  const frames = [{a:'user', b:'code', who:'User → your code', what:'“Is it warmer in Tokyo or Seoul? Umbrella?”', lap:0}];
  log.forEach((it, i) => {
    const lap = i + 1, n = (style === 'anthropic' ? it.request : it.chat_request).messages.length;
    frames.push({a:'code', b:'model', who:`Lap ${lap} · your code → model`, what:`request with ${n} message${n === 1 ? '' : 's'} + tools`, lap});
    if (it.tools_run) {
      frames.push({a:'model', b:'code', who:`Lap ${lap} · model → your code`, what:'tool_calls: ' + it.tools_run.map(t => `${t.name}(${t.args.city})`).join(', '), lap});
      it.tools_run.forEach(t => {
        const result = JSON.parse(t.result);
        frames.push({a:'code', b:'tool', who:`Lap ${lap} · your code → tool`, what:`run ${t.name}(city="${t.args.city}")`, lap});
        frames.push({a:'tool', b:'code', who:`Lap ${lap} · tool → your code`, what:`${result.temp}°C, ${result.sky}`, lap});
      });
    } else frames.push({a:'model', b:'code', who:`Lap ${lap} · model → your code`, what:'no tool calls: final answer', lap, end:true});
  });
  const last = log.at(-1);
  frames.push({a:'code', b:'user', who:'Your code → user', what:last.final || last.response.content.find(c => c.type === 'text').text, lap:log.length, done:true});
  return frames;
}

// The course highlighter is optional while the shell and widgets land independently.
async function highlight(src, lang) {
  try { return (await import('../highlight.js')).highlight(src, lang); }
  catch { return escape(src); }
}

export function mount(el, data, ctx) {
  const css = new URL('./cycle.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${css}"]`)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.append(link);
  }
  let style = 'anthropic', frames = cycleFrames(data, style), index = 0, playing = false, timer, raf, disposed = false;
  const reduced = playbackMode(ctx.reducedMotion) === 'step';
  el.innerHTML = `<div class="cycle-widget"><div class="cycle-styles" role="group" aria-label="Model">${Object.entries(styles).map(([id, name]) => `<button type="button" data-style="${id}" aria-pressed="${id === style}">${name}</button>`).join('')}</div><div class="cycle-layout"><svg viewBox="0 0 560 300" role="img" aria-label="Agent loop diagram">
    <line class="cycle-edge" data-edge="user-code" x1="70" y1="150" x2="280" y2="150"/><line class="cycle-edge" data-edge="code-model" x1="280" y1="150" x2="490" y2="62"/><line class="cycle-edge" data-edge="code-tool" x1="280" y1="150" x2="490" y2="238"/>
    <circle class="cycle-ring" cx="280" cy="150" r="58"/><circle class="cycle-ring-on" cx="280" cy="150" r="58" transform="rotate(-90 280 150)" stroke-dasharray="364.4"/>
    ${[['user','You','USER',30],['code','Your code','THE LOOP',46],['model','Model','LLM API',42],['tool','Tool','GET_WEATHER',42]].map(([id, name, sub, radius]) => `<g class="cycle-node" data-node="${id}"><circle cx="${points[id][0]}" cy="${points[id][1]}" r="${radius}"/><text x="${points[id][0]}" y="${points[id][1]-6}">${name}</text><text class="cycle-sub" x="${points[id][0]}" y="${points[id][1]+23}">${sub}</text></g>`).join('')}<circle class="cycle-packet" r="7"/></svg><div class="cycle-side"><div><div class="cycle-label">Laps</div><div class="cycle-laps"></div></div><div class="cycle-message" aria-live="polite"><strong></strong><div></div></div><div class="cycle-controls">${[['play',reduced ? 'Step' : 'Play'],['back','Back'],['next','Next'],['restart','Restart']].map(([action,label]) => `<button type="button" data-action="${action}">${label}</button>`).join('')}</div><p class="cycle-count"></p></div></div></div>`;
  const q = selector => el.querySelector(selector), packet = q('.cycle-packet');
  function stop() { playing = false; clearTimeout(timer); q('[data-action="play"]').textContent = reduced ? 'Step' : index === frames.length - 1 ? 'Replay' : 'Play'; }
  function show(animate = false) {
    const frame = frames[index], laps = data[style].length;
    q('.cycle-message strong').textContent = frame.who;
    const message = q('.cycle-message div'); message.textContent = frame.what;
    // Plain text appears immediately; highlighting is deliberately lazy and optional.
    highlight(frame.what, 'text').then(html => { if (!disposed && frames[index] === frame) message.innerHTML = html; });
    q('.cycle-count').textContent = `Message ${index + 1} of ${frames.length}`;
    el.querySelectorAll('[data-node]').forEach(node => node.classList.toggle('active', node.dataset.node === frame.b));
    el.querySelectorAll('[data-edge]').forEach(edge => edge.classList.toggle('active', edge.dataset.edge === `${frame.a}-${frame.b}` || edge.dataset.edge === `${frame.b}-${frame.a}`));
    const done = frame.done ? laps : Math.max(0, frame.lap - 1) + (frame.end ? 1 : 0);
    q('.cycle-laps').innerHTML = Array.from({length:laps}, (_, i) => `<span class="cycle-lap${i < done ? ' done' : i === frame.lap - 1 ? ' current' : ''}">${i + 1}</span>`).join('');
    q('.cycle-ring-on').setAttribute('stroke-dashoffset', 364.4 * (1 - (frame.done ? 1 : Math.max(0, frame.lap - 1 + (index ? 0.5 : 0)) / laps)));
    const [x1,y1] = points[frame.a], [x2,y2] = points[frame.b]; cancelAnimationFrame(raf);
    if (!animate || reduced) { packet.setAttribute('cx', x2); packet.setAttribute('cy', y2); return; }
    const start = performance.now();
    const tick = time => { const p = Math.min(1, (time - start) / 700), easing = p < .5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2; packet.setAttribute('cx', x1 + (x2-x1)*easing); packet.setAttribute('cy', y1 + (y2-y1)*easing); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }
  function loop() { if (!playing) return; if (index >= frames.length - 1) { stop(); return; } index++; show(true); timer = setTimeout(loop, 1500); }
  function click(event) {
    const button = event.target.closest('button'); if (!button || !el.contains(button)) return;
    if (button.dataset.style) { stop(); style = button.dataset.style; frames = cycleFrames(data, style); index = 0; el.querySelectorAll('[data-style]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); show(); return; }
    const action = button.dataset.action;
    if (action === 'play' && !reduced) { if (playing) { stop(); return; } if (index === frames.length - 1) { index = 0; show(); } playing = true; button.textContent = 'Pause'; timer = setTimeout(loop, 400); return; }
    stop();
    if (action === 'play' || action === 'next') index = Math.min(index + 1, frames.length - 1);
    else if (action === 'back') index = Math.max(index - 1, 0);
    else if (action === 'restart') index = 0;
    show(action === 'next' || action === 'play');
  }
  el.addEventListener('click', click);
  ctx.onCleanup(() => { disposed = true; stop(); cancelAnimationFrame(raf); el.removeEventListener('click', click); });
  show();
}
