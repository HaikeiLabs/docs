import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDocs } from '../scripts/build.mjs';
import { courseJsonLd, lessonJsonLd, loadCourse, renderCourseHub, renderLesson } from '../scripts/course.mjs';

// Rendering of the versioning fields. The latest version always comes from the
// fixture compat file (0.3.0), never from scripts/data/agentware-compat.json.
const fixture = 'test/fixtures/course/agentware';
const compatFile = 'test/fixtures/course/agentware-compat.json';
const latest = JSON.parse(fs.readFileSync(compatFile, 'utf8')).version;
const course = loadCourse(fixture, { latest });
const lesson = id => course.lessons.find(l => l.id === id);
const docs = 'https://docs.haikeilabs.com';

test('the meta line shows the date and the Agentware version under the lesson line', () => {
  const html = renderLesson(course, lesson('gaps'));
  assert.match(html, /<p>Lesson 6 of 6 · 4 min<\/p><p class="course-version"><span>Updated <time datetime="2026-11-27">27 Nov 2026<\/time><\/span> · <span>Agentware 0\.3\.0<\/span><\/p><h1>/);
  assert.doesNotMatch(html, /course-behind|course-change-note/, 'current lesson, no note');
});

test('each part of the meta line renders only when present', () => {
  const basics = renderLesson(course, lesson('basics'));
  assert.match(basics, /<p class="course-version"><span>Updated <time datetime="2026-11-01">1 Nov 2026<\/time><\/span><\/p>/);
  assert.doesNotMatch(basics, /Agentware \d/);
  const versionOnly = renderLesson(course, { ...lesson('gaps'), updated: undefined });
  assert.match(versionOnly, /<p class="course-version"><span>Agentware 0\.3\.0<\/span><\/p>/);
  const steps = renderLesson(course, lesson('steps'));
  assert.doesNotMatch(steps, /course-version|course-change-note|course-behind/, 'no fields, no line');
});

test('the change note renders as inline Markdown, and a lesson behind the latest says so', () => {
  const html = renderLesson(course, lesson('runtime'));
  assert.match(html, /<p class="course-change-note">What changed: Shows the <strong>policy<\/strong> step before the tool runs\.<\/p>/);
  assert.match(html, /<p class="course-behind">Written for Agentware 0\.2\.0\. The current release is 0\.3\.0\.<\/p>/);
  const unknownLatest = renderLesson(loadCourse(fixture), lesson('runtime'));
  assert.doesNotMatch(unknownLatest, /course-behind/, 'no latest version, no note');
  const ahead = renderLesson(loadCourse(fixture, { latest: '0.1.0' }), lesson('runtime'));
  assert.doesNotMatch(ahead, /course-behind/, 'a lesson newer than the vendored latest gets no note');
});

test('the hub shows the newest lesson date, and nothing when no lesson has one', () => {
  assert.match(renderCourseHub(course, ''), /<p class="eyebrow"><span>Course · 6 lessons · 24 min · Updated <time datetime="2026-11-27">27 Nov 2026<\/time><\/span><\/p>/);
  const undated = { ...course, lessons: course.lessons.map(l => ({ ...l, updated: undefined })) };
  assert.match(renderCourseHub(undated, ''), /<p class="eyebrow"><span>Course · 6 lessons · 24 min<\/span><\/p>/);
});

test('JSON-LD: dateModified from updated, never softwareVersion or datePublished', () => {
  assert.equal(lessonJsonLd(course, lesson('runtime')).dateModified, '2026-11-20');
  assert.equal('dateModified' in lessonJsonLd(course, lesson('steps')), false);
  assert.equal(courseJsonLd(course).dateModified, '2026-11-27');
  const all = JSON.stringify([courseJsonLd(course), ...course.lessons.map(l => lessonJsonLd(course, l))]);
  assert.doesNotMatch(all, /softwareVersion|datePublished/);
});

async function withBuild(fn) {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'course-version-build-'));
  try { await buildDocs({ outputDir, courseDir: fixture, compatFile }); await fn(file => readFile(path.join(outputDir, file), 'utf8'), outputDir); }
  finally { await rm(outputDir, { recursive: true, force: true }); }
}

test('build: sitemap lastmod for course URLs only, the manifest is not served, the behind note uses the compat file', () => withBuild(async (read, outputDir) => {
  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, new RegExp(`<url><loc>${docs}/agentware/course/</loc><lastmod>2026-11-27</lastmod></url>`));
  assert.match(sitemap, new RegExp(`<url><loc>${docs}/agentware/course/runtime/</loc><lastmod>2026-11-20</lastmod></url>`));
  assert.match(sitemap, new RegExp(`<url><loc>${docs}/agentware/course/steps/</loc></url>`), 'a lesson without updated has no lastmod');
  const withLastmod = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>/g)].map(m => m[1]);
  assert.ok(withLastmod.length > 0 && withLastmod.every(url => url.startsWith(`${docs}/agentware/course/`)), 'lastmod only on course URLs');
  assert.equal(fs.existsSync(path.join(outputDir, 'agentware/course/data/manifest.json')), false);
  assert.equal(fs.existsSync(path.join(outputDir, 'agentware/course/data/gaps.json')), true);
  assert.match(await read('agentware/course/runtime/index.html'), /The current release is 0\.3\.0\./);
  const ld = JSON.parse((await read('agentware/course/runtime/index.html')).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld.dateModified, '2026-11-20');
}));

test('the version line styles use role tokens only', () => {
  const css = fs.readFileSync('assets/course/course.css', 'utf8');
  for (const selector of ['.course-version', '.course-change-note', '.course-behind']) assert.ok(css.includes(selector), `${selector} is styled`);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});
