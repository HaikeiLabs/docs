export function lessonForHash(hash, lessons, documentRoot) {
  let id;
  try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { id = ''; }
  const direct = lessons.find(lesson => lesson.id === id);
  if (direct) return direct;
  // An empty or unknown hash falls back to the first lesson (the docs nav links to the bare URL).
  const anchor = id ? documentRoot?.getElementById(id) : null;
  return anchor?.closest?.('.lesson') ?? lessons[0];
}
export function readProgress(storage) {
  try { const value = JSON.parse(storage.getItem('aw-course-done') || '[]'); return new Set(Array.isArray(value) ? value : []); } catch { return new Set(); }
}
export function saveProgress(storage, done) { try { storage.setItem('aw-course-done', JSON.stringify([...done])); } catch {} }
export function recordAnswer(done, lessonId, answer, correct) {
  if (answer !== correct) return { correct: false, newlyComplete: false };
  const newlyComplete = !done.has(lessonId); done.add(lessonId);
  return { correct: true, newlyComplete };
}
if (typeof document !== 'undefined') {
  const lessons = [...document.querySelectorAll('.lesson')];
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const done = readProgress(storage);
  let cleanups = [], currentLesson = null, generation = 0;
  const track = (event, id) => window.haikeiAnalytics?.track(event, { lesson_id: id });
  const progress = () => {
    document.querySelectorAll('[data-lesson-link]').forEach(link => {
      link.querySelector('[data-check]').textContent = done.has(link.dataset.lessonLink) ? '✓ ' : '';
    });
    const count = lessons.filter(l => done.has(l.id)).length;
    document.querySelectorAll('[data-progress]').forEach(el => { el.textContent = `${count} of ${lessons.length}`; });
    document.querySelectorAll('[data-course-complete]').forEach(el => { el.hidden = count < lessons.length; });
  };
  const markQuiz = (quiz, button, correct) => {
    quiz.querySelectorAll('[data-quiz-answer]').forEach(option => {
      if (option === button) option.dataset.result = correct ? 'right' : 'wrong';
      else if (correct) delete option.dataset.result;
    });
    const feedback = quiz.querySelector('[data-feedback]');
    feedback.textContent = correct ? feedback.dataset.why : 'Not this one. Try again: reread the steps above for the detail the question asks about.';
  };
  // A completed lesson shows its answered quiz again after a reload.
  for (const lesson of lessons) {
    const quiz = lesson.querySelector('.course-quiz');
    if (quiz && done.has(lesson.id)) markQuiz(quiz, quiz.querySelector(`[data-quiz-answer="${quiz.dataset.answer}"]`), true);
  }
  const show = async () => {
    const current = lessonForHash(location.hash, lessons, document);
    if (!current) return;
    // Give a bare or unknown URL the lesson's hash, so the address matches what is shown and can be shared.
    let target = null;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch {}
    if (!target || !current.contains(target)) history.replaceState(null, '', `${location.pathname}${location.search}#${current.id}`);
    if (current !== currentLesson) {
      cleanups.forEach(fn => fn()); cleanups = []; currentLesson = current; generation++;
      track('course_lesson_view', current.id);
    } else return;
    const thisGeneration = generation;
    for (const lesson of lessons) lesson.hidden = lesson !== current;
    document.querySelectorAll('[data-lesson-link]').forEach(link => {
      if (link.dataset.lessonLink === current.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    for (const el of current.querySelectorAll('[data-widget]')) {
      try {
        const module = await import(`/assets/course/widgets/${el.dataset.widget}.js`);
        const fetchData = async name => { const res = await fetch(`/agentware/course/data/${name}.json`); if (!res.ok) throw new Error(`Cannot load ${name}`); return res.json(); };
        let data;
        if (el.dataset.src) { const res = await fetch(el.dataset.src); if (!res.ok) throw new Error('Cannot load widget data'); data = await res.json(); }
        else if (el.dataset.widget === 'debugger') data = { logs: await fetchData('logs'), debugger: await fetchData('debugger') };
        else data = await fetchData(el.dataset.widget === 'cycle' ? 'logs' : el.dataset.widget);
        if (generation !== thisGeneration) continue;
        module.mount(el, data, { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, onCleanup: fn => cleanups.push(fn) });
      } catch (error) { console.warn('Course widget unavailable', error); }
    }
  };
  const markHover = (event, active) => {
    const mark = event.target.closest('.mk'); if (!mark) return;
    mark.closest('.course-step').querySelectorAll('.course-mark').forEach(gutter => {
      if (gutter.dataset.mark === mark.dataset.mark) gutter.closest('.course-code-line').classList.toggle('is-highlighted', active);
    });
  };
  document.addEventListener('mouseover', event => markHover(event, true));
  document.addEventListener('mouseout', event => markHover(event, false));
  document.addEventListener('focusin', event => markHover(event, true));
  document.addEventListener('focusout', event => markHover(event, false));
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-quiz-answer]'); if (!button) return;
    const quiz = button.closest('.course-quiz'), lesson = button.closest('.lesson');
    const result = recordAnswer(done, lesson.id, button.dataset.quizAnswer, quiz.dataset.answer);
    markQuiz(quiz, button, result.correct);
    if (!result.correct) return;
    if (result.newlyComplete) { saveProgress(storage, done); track('course_lesson_complete', lesson.id); progress(); }
  });
  progress(); addEventListener('hashchange', show); show();
}
