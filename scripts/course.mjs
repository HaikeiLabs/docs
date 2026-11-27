import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { createMarkdown, escapeHtml, highlight, slugify } from './render.mjs';
import { checkCourse } from './course-validate.mjs';
import { compareVersions, formatDate, newestUpdated } from './course-version.mjs';

// latest: the vendored current Agentware release, for the behind-latest note and warnings.
export function loadCourse(dir, { latest } = {}) {
  const { hub, warnings } = checkCourse(dir, { latest });
  const lessons = hub.lessons.map(id => {
    const raw = fs.readFileSync(path.join(dir, 'lessons', `${id}.md`), 'utf8');
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    return { ...YAML.parse(match[1]), body: match[2] };
  });
  return { hub, lessons, latest, warnings };
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
export const courseBase = '/agentware/course/';
export const lessonHref = id => `${courseBase}${id}/`;
const docsOrigin = 'https://docs.haikeilabs.com';
const provider = { '@type': 'Organization', name: 'Haikei Labs', url: 'https://haikeilabs.com' };
const maxDescription = 160;

// Inline Markdown (a lede) as plain text: what a search snippet or share card shows.
export function plainText(markdown, max = Infinity) {
  const text = createMarkdown().renderInline(markdown).replace(/<[^>]*>/g, '')
    .replace(/&(lt|gt|quot|#39|amp);/g, (_, entity) => ({ lt: '<', gt: '>', quot: '"', '#39': "'", amp: '&' })[entity])
    .replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:.]+$/, '')}…`;
}

// Head fields for one lesson page: optional seo_title and description, else title and lede.
export function lessonMeta(lesson) {
  return {
    path: lessonHref(lesson.id),
    fullTitle: lesson.seo_title ?? `${lesson.title} · Agentware course`,
    description: lesson.description ?? plainText(lesson.lede, maxDescription),
  };
}

// dateModified only: no datePublished (there is no first-publish date) and no softwareVersion.
const dateModified = date => (date ? { dateModified: date } : {});
const time = date => `<time datetime="${escapeHtml(date)}">${formatDate(date)}</time>`;

// Under the lesson line: "Updated <date> · Agentware <version>", each part only when
// the front matter has it, then the change note and a note when the lesson is behind
// the latest release. Versions come from front matter, never from lesson prose.
export function renderLessonVersion(lesson, latest) {
  const parts = [lesson.updated && `<span>Updated ${time(lesson.updated)}</span>`, lesson.agentware && `<span>Agentware ${escapeHtml(lesson.agentware)}</span>`].filter(Boolean);
  const line = parts.length ? `<p class="course-version">${parts.join(' · ')}</p>` : '';
  const note = lesson.change_note ? `<p class="course-change-note">What changed: ${createMarkdown().renderInline(lesson.change_note)}</p>` : '';
  const behind = lesson.agentware && latest && compareVersions(lesson.agentware, latest) < 0 ? `<p class="course-behind">Written for Agentware ${escapeHtml(lesson.agentware)}. The current release is ${escapeHtml(latest)}.</p>` : '';
  return line + note + behind;
}

function courseRef(course) {
  return { '@type': 'Course', name: course.hub.title, url: `${docsOrigin}${courseBase}` };
}

// schema.org Course for the hub page; each lesson is one LearningResource part.
export function courseJsonLd(course) {
  return {
    '@context': 'https://schema.org',
    ...courseRef(course),
    description: course.hub.description,
    provider,
    educationalLevel: 'Beginner',
    inLanguage: 'en',
    isAccessibleForFree: true,
    ...dateModified(newestUpdated(course.lessons)),
    hasPart: course.lessons.map(lesson => ({ '@type': 'LearningResource', name: lesson.title, url: `${docsOrigin}${lessonHref(lesson.id)}` })),
  };
}

export function lessonJsonLd(course, lesson) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: lesson.title,
    description: lessonMeta(lesson).description,
    url: `${docsOrigin}${lessonHref(lesson.id)}`,
    provider,
    educationalLevel: 'Beginner',
    learningResourceType: 'Lesson',
    inLanguage: 'en',
    isAccessibleForFree: true,
    position: lesson.num,
    timeRequired: `PT${lesson.mins}M`,
    ...dateModified(lesson.updated),
    isPartOf: courseRef(course),
  };
}

// The course rail on the hub and every lesson page. currentId is null on the hub.
// data-course-lessons lists every lesson id, so progress counts lessons that are not on this page.
export function renderCourseRail(course, currentId = null) {
  const current = id => (id === currentId ? ' aria-current="page"' : '');
  const links = course.lessons.map(lesson => `${course.hub.groups.filter(g => g.from === lesson.id).map(g => `<h2>${escapeHtml(g.label)}</h2>`).join('')}<a href="${lessonHref(lesson.id)}" data-lesson-link="${escapeHtml(lesson.id)}"${current(lesson.id)}><span data-check></span>${lesson.num}. ${escapeHtml(lesson.title)}</a>`).join('');
  return `<aside class="sidebar course-rail" id="site-nav"><div class="menu-hint">Press <kbd>Esc</kbd> to close</div><nav aria-label="Course lessons" data-course-lessons="${escapeHtml(course.lessons.map(l => l.id).join(' '))}"><p>Course progress: <span data-progress>0 of ${course.lessons.length}</span></p><p class="course-complete" data-course-complete hidden>Course complete</p><a href="${courseBase}"${currentId ? '' : ' aria-current="page"'}>Course overview</a>${links}</nav></aside>`;
}

// The hub: course intro, a start link and every lesson grouped as in the rail. No lesson bodies.
export function renderCourseHub(course, introHtml) {
  const minutes = course.lessons.reduce((sum, lesson) => sum + lesson.mins, 0);
  const groups = course.hub.groups.map((group, index) => {
    const from = course.lessons.findIndex(l => l.id === group.from);
    const to = course.hub.groups[index + 1] ? course.lessons.findIndex(l => l.id === course.hub.groups[index + 1].from) : course.lessons.length;
    const items = course.lessons.slice(from, to).map(lesson => `<li><a href="${lessonHref(lesson.id)}" data-lesson-link="${escapeHtml(lesson.id)}"><strong><span data-check></span>${lesson.num}. ${escapeHtml(lesson.title)}</strong><span>${escapeHtml(plainText(lesson.lede))} · ${lesson.mins} min</span></a></li>`).join('');
    return `<h2>${escapeHtml(group.label)}</h2><ul class="tutorial-list">${items}</ul>`;
  }).join('');
  return `<div class="course-hub" data-course-hub><p class="eyebrow"><span>Course · ${course.lessons.length} lessons · ${minutes} min${newestUpdated(course.lessons) ? ` · Updated ${time(newestUpdated(course.lessons))}` : ''}</span></p><h1>${escapeHtml(course.hub.title)}</h1><article class="prose">${introHtml}</article><p><a class="button-primary" href="${lessonHref(course.lessons[0].id)}">Start the course</a></p><div class="prose">${groups}</div></div>`;
}

// One lesson page: the lesson server-rendered and visible, prev/next as real links.
export function renderLesson(course, lesson) {
  const index = course.lessons.indexOf(lesson);
  const [steps, reference] = lesson.body.split(/^# Reference\s*$/m);
  const complete = `<p class="course-complete" data-course-complete role="status" hidden>Course complete: you finished all ${course.lessons.length} lessons.</p>`;
  const quiz = `<fieldset class="course-quiz" data-answer="${lesson.quiz.a}"><legend>${escapeHtml(lesson.quiz.q)}</legend>${lesson.quiz.opts.map((option, i) => `<button type="button" data-quiz-answer="${i}">${escapeHtml(option)}</button>`).join('')}<p data-feedback aria-live="polite" data-why="${escapeHtml(lesson.quiz.why)}"></p>${complete}</fieldset>`;
  const previous = course.lessons[index - 1], next = course.lessons[index + 1];
  const nav = `<nav class="course-pager" aria-label="Lesson navigation">${previous ? `<a href="${lessonHref(previous.id)}" rel="prev">Previous: ${escapeHtml(previous.title)}</a>` : '<span></span>'}${next ? `<a href="${lessonHref(next.id)}" rel="next">Next: ${escapeHtml(next.title)}</a>` : ''}</nav>`;
  const finish = lesson.finish ? `<div class="course-finish"><a class="button-primary" href="${escapeHtml(course.hub.finish.primary.href)}">${escapeHtml(course.hub.finish.primary.label)}</a><a href="${escapeHtml(course.hub.finish.secondary.href)}">${escapeHtml(course.hub.finish.secondary.label)}</a></div>` : '';
  return `<section class="lesson" id="${escapeHtml(lesson.id)}"><p>Lesson ${lesson.num} of ${course.lessons.length} · ${lesson.mins} min</p>${renderLessonVersion(lesson, course.latest)}<h1>${escapeHtml(lesson.title)}</h1><p>${createMarkdown().renderInline(lesson.lede)}</p><article class="prose">${renderItems(steps, lesson)}${reference ? `<details class="course-reference"><summary>Reference</summary>${renderItems(reference, lesson)}</details>` : ''}${quiz}${finish}${nav}</article></section>`;
}
