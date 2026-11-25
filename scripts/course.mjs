import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { createMarkdown, escapeHtml } from './render.mjs';
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
export function renderCourse(course) {
  const md = createMarkdown();
  const rail = `<aside class="sidebar course-rail" id="site-nav"><div class="menu-hint">Press <kbd>Esc</kbd> to close</div><nav aria-label="Course lessons"><p>Course progress: <span data-progress>0 of ${course.lessons.length}</span></p>${course.lessons.map(lesson => `${course.hub.groups.filter(g => g.from === lesson.id).map(g => `<h2>${escapeHtml(g.label)}</h2>`).join('')}<a href="#${escapeHtml(lesson.id)}" data-lesson-link="${escapeHtml(lesson.id)}">${lesson.num}. ${escapeHtml(lesson.title)}</a>`).join('')}</nav></aside>`;
  const content = course.lessons.map(lesson => {
    let body = md.render(lesson.body);
    body = body.replace(/id="([^"]+)"/g, (_, id) => `id="${lesson.id}-${id}"`).replace(/href="#([^"]+)"/g, (_, id) => `href="#${lesson.id}-${id}"`);
    body = body.replace(/<p>\[widget:([a-z-]+)(?: data=([a-z0-9-]+))?\]<\/p>/g, (_, name, data) => `<div class="widget" data-widget="${name}" data-src="${data ? `/agentware/course/data/${data}.json` : ''}">Interactive ${name} widget</div>`);
    return `<section class="lesson" id="${escapeHtml(lesson.id)}"><p>Lesson ${lesson.num} of ${course.lessons.length} · ${lesson.mins} min</p><h1>${escapeHtml(lesson.title)}</h1><p>${escapeHtml(lesson.lede)}</p><article class="prose">${body}</article></section>`;
  }).join('');
  return { rail, content };
}
