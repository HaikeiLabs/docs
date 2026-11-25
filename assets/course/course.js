// Old one-page URLs (/agentware/course/#<id>, or #<id>-<step> for a step) map to the
// lesson's own page. The longest matching id wins, so #tool-call-x is tool-call, not tool.
export function lessonUrlForHash(hash, ids, base = '/agentware/course/') {
  let id;
  try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return null; }
  if (!id) return null;
  if (ids.includes(id)) return `${base}${id}/`;
  const owner = ids.filter(lessonId => id.startsWith(`${lessonId}-`)).sort((a, b) => b.length - a.length)[0];
  return owner ? `${base}${owner}/#${encodeURIComponent(id)}` : null;
}
export function readProgress(storage) {
  try { const value = JSON.parse(storage.getItem('aw-course-done') || '[]'); return new Set(Array.isArray(value) ? value : []); } catch { return new Set(); }
}
export function saveProgress(storage, done) { try { storage.setItem('aw-course-done', JSON.stringify([...done])); } catch {} }
// Once a lesson is complete its quiz is locked: any later answer is a no-op, so the quiz keeps one coherent completed state.
export function recordAnswer(done, lessonId, answer, correct) {
  if (done.has(lessonId)) return { correct: true, newlyComplete: false, locked: true };
  if (answer !== correct) return { correct: false, newlyComplete: false };
  const newlyComplete = !done.has(lessonId); done.add(lessonId);
  return { correct: true, newlyComplete };
}
if (typeof document !== 'undefined') {
  const ids = (document.querySelector('[data-course-lessons]')?.dataset.courseLessons ?? '').split(' ').filter(Boolean);
  const hubTarget = document.querySelector('[data-course-hub]') ? lessonUrlForHash(location.hash, ids) : null;
  if (hubTarget) location.replace(hubTarget);
  else initCourse(ids);
}

function initCourse(ids) {
  // A lesson page holds exactly one lesson; the hub holds none.
  const current = document.querySelector('.lesson');
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const done = readProgress(storage);
  const cleanups = [];
  const track = (event, id) => window.haikeiAnalytics?.track(event, { lesson_id: id });
  const progress = () => {
    document.querySelectorAll('[data-lesson-link]').forEach(link => {
      link.querySelector('[data-check]').textContent = done.has(link.dataset.lessonLink) ? '✓ ' : '';
    });
    const count = ids.filter(id => done.has(id)).length;
    document.querySelectorAll('[data-progress]').forEach(el => { el.textContent = `${count} of ${ids.length}`; });
    document.querySelectorAll('[data-course-complete]').forEach(el => { el.hidden = count < ids.length; });
  };
  const markQuiz = (quiz, button, correct) => {
    quiz.querySelectorAll('[data-quiz-answer]').forEach(option => {
      if (option === button) option.dataset.result = correct ? 'right' : 'wrong';
      else if (correct) delete option.dataset.result;
      if (correct) option.setAttribute('aria-disabled', 'true');
    });
    const feedback = quiz.querySelector('[data-feedback]');
    feedback.textContent = correct ? feedback.dataset.why : 'Not this one. Try again: reread the steps above for the detail the question asks about.';
  };
  // A completed lesson shows its answered quiz again after a reload.
  const quiz = current?.querySelector('.course-quiz');
  if (quiz && done.has(current.id)) markQuiz(quiz, quiz.querySelector(`[data-quiz-answer="${quiz.dataset.answer}"]`), true);
  const mountWidgets = async lesson => {
    for (const el of lesson.querySelectorAll('[data-widget]')) {
      try {
        const module = await import(`/assets/course/widgets/${el.dataset.widget}.js`);
        const fetchData = async name => { const res = await fetch(`/agentware/course/data/${name}.json`); if (!res.ok) throw new Error(`Cannot load ${name}`); return res.json(); };
        let data;
        if (el.dataset.src) { const res = await fetch(el.dataset.src); if (!res.ok) throw new Error('Cannot load widget data'); data = await res.json(); }
        else if (el.dataset.widget === 'debugger') data = { logs: await fetchData('logs'), debugger: await fetchData('debugger') };
        else data = await fetchData(el.dataset.widget === 'cycle' ? 'logs' : el.dataset.widget);
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
    if (result.locked) return;
    markQuiz(quiz, button, result.correct);
    if (!result.correct) return;
    if (result.newlyComplete) { saveProgress(storage, done); track('course_lesson_complete', lesson.id); progress(); }
  });
  progress();
  if (current) { track('course_lesson_view', current.id); mountWidgets(current); }
}
