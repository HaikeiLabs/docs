import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { createMarkdown, escapeHtml, highlight, slugify } from './render.mjs';
import { validateCourse } from './course-validate.mjs';

export function loadCourse(dir) {
  const hub = validateCourse(dir);
  const lessons = hub.lessons.map(id => {
    const raw = fs.readFileSync(path.join(dir, 'lessons', `${id}.md`), 'utf8');
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    return { ...YAML.parse(match[1]), body: match[2] };
  });
  return { hub, lessons };
}
function renderItems(text, lesson) {
  const md = createMarkdown();
  const chunks = text.split(/^##\s+(.+)\s*$/m);
  const items = [];
  if (chunks[0].trim()) items.push(['', chunks[0]]);
  for (let i = 1; i < chunks.length; i += 2) items.push([chunks[i], chunks[i + 1]]);
  return items.map(([heading, body], index) => {
    const fence = body.match(/^```([^\n]*)\n([\s\S]*?)^```\s*$/m);
    const widget = body.match(/^\[widget:([a-z-]+)(?: data=([a-z0-9-]+))?\]\s*$/m);
    const prose = body.replace(fence?.[0] ?? widget?.[0] ?? '', '').trim();
    const textHtml = md.render(prose).replace(/\[\[([1-9])\]\]/g, '<span class="mk" tabindex="0" data-mark="$1">$1</span>');
    let visual = '';
    if (fence) {
      const lang = fence[1].trim().split(/\s+/)[0];
      const title = fence[1].match(/\btitle="([^"]*)"/)?.[1] ?? lang;
      const marks = Object.fromEntries((fence[1].match(/\bmarks="([^"]*)"/)?.[1] ?? '').split(';').filter(Boolean).map(entry => { const at = entry.indexOf('='); return [entry.slice(0, at), entry.slice(at + 1)]; }));
      const lines = fence[2].replace(/\n$/, '').split('\n').map((line, i) => `<span class="course-code-line">${marks[i + 1] ? `<span class="course-mark" data-mark="${escapeHtml(marks[i + 1])}">${escapeHtml(marks[i + 1])}</span>` : '<span class="course-mark-empty"></span>'}<span>${highlight(line, lang)}</span></span>`).join('');
      visual = `<div class="code-block"><div class="code-head"><span class="code-label is-file">${escapeHtml(title)}</span><button class="copy" type="button" aria-label="Copy ${escapeHtml(title)} code">Copy</button></div><pre tabindex="0"><code class="language-${escapeHtml(lang)}">${lines}</code></pre></div>`;
    } else if (widget) {
      const [, name, data] = widget; visual = `<div class="widget" data-widget="${name}" data-src="${data ? `/agentware/course/data/${data}.json` : ''}">Interactive ${name} widget</div>`;
    }
    const id = `${lesson.id}-${slugify(heading || `step-${index + 1}`)}`;
    return `<section class="course-step${widget ? ' has-widget' : ''}" id="${escapeHtml(id)}"><div class="course-step-text">${heading ? `<h2>${escapeHtml(heading)}</h2>` : ''}${textHtml}</div>${visual}</section>`;
  }).join('');
}
export function renderCourse(course) {
  const rail = `<aside class="sidebar course-rail" id="site-nav"><div class="menu-hint">Press <kbd>Esc</kbd> to close</div><nav aria-label="Course lessons"><p>Course progress: <span data-progress>0 of ${course.lessons.length}</span></p>${course.lessons.map(lesson => `${course.hub.groups.filter(g => g.from === lesson.id).map(g => `<h2>${escapeHtml(g.label)}</h2>`).join('')}<a href="#${escapeHtml(lesson.id)}" data-lesson-link="${escapeHtml(lesson.id)}"><span data-check></span>${lesson.num}. ${escapeHtml(lesson.title)}</a>`).join('')}</nav></aside>`;
  const content = course.lessons.map((lesson, index) => {
    const [steps, reference] = lesson.body.split(/^# Reference\s*$/m);
    const quiz = `<fieldset class="course-quiz" data-answer="${lesson.quiz.a}"><legend>${escapeHtml(lesson.quiz.q)}</legend>${lesson.quiz.opts.map((option, i) => `<button type="button" data-quiz-answer="${i}">${escapeHtml(option)}</button>`).join('')}<p data-feedback aria-live="polite" data-why="${escapeHtml(lesson.quiz.why)}"></p></fieldset>`;
    const previous = course.lessons[index - 1], next = course.lessons[index + 1];
    const nav = `<nav class="course-pager" aria-label="Lesson navigation">${previous ? `<a href="#${previous.id}">Previous: ${escapeHtml(previous.title)}</a>` : '<span></span>'}${next ? `<a href="#${next.id}">Next: ${escapeHtml(next.title)}</a>` : ''}</nav>`;
    const finish = lesson.finish ? `<div class="course-finish"><a class="button-primary" href="${escapeHtml(course.hub.finish.primary.href)}">${escapeHtml(course.hub.finish.primary.label)}</a><a href="${escapeHtml(course.hub.finish.secondary.href)}">${escapeHtml(course.hub.finish.secondary.label)}</a></div>` : '';
    return `<section class="lesson" id="${escapeHtml(lesson.id)}"><p>Lesson ${lesson.num} of ${course.lessons.length} · ${lesson.mins} min</p><h1>${escapeHtml(lesson.title)}</h1><p>${createMarkdown().renderInline(lesson.lede)}</p><article class="prose">${renderItems(steps, lesson)}${reference ? `<details class="course-reference"><summary>Reference</summary>${renderItems(reference, lesson)}</details>` : ''}${quiz}${finish}${nav}</article></section>`;
  }).join('');
  return { rail, content };
}
