export function lessonForHash(hash, lessons, documentRoot) {
  let id;
  try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { id = ''; }
  const direct = lessons.find(lesson => lesson.id === id);
  if (direct) return direct;
  const anchor = id && documentRoot?.getElementById(id);
  return anchor?.closest('.lesson') ?? lessons[0];
}
if (typeof document !== 'undefined') {
  const lessons = [...document.querySelectorAll('.lesson')];
  const mounted = new WeakSet();
  const show = async () => {
    const current = lessonForHash(location.hash, lessons, document);
    if (!current) return;
    for (const lesson of lessons) lesson.hidden = lesson !== current;
    document.querySelectorAll('[data-lesson-link]').forEach(link => {
      if (link.dataset.lessonLink === current.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    for (const el of current.querySelectorAll('[data-widget]')) {
      if (mounted.has(el)) continue;
      mounted.add(el);
      try {
        const module = await import(`/assets/course/widgets/${el.dataset.widget}.js`);
        const data = el.dataset.src ? await (await fetch(el.dataset.src)).json() : null;
        module.mount(el, data, { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, onCleanup: () => {} });
      } catch (error) { console.warn('Course widget unavailable', error); }
    }
  };
  addEventListener('hashchange', show); show();
}
