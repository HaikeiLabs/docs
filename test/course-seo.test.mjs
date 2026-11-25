import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDocs } from '../scripts/build.mjs';
import { validateCourse } from '../scripts/course-validate.mjs';

const fixture = 'test/fixtures/course/agentware';
const lessonIds = ['basics', 'steps', 'api', 'loop', 'runtime', 'gaps'];
const docs = 'https://docs.haikeilabs.com';

function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-seo-'));
  fs.cpSync(fixture, dir, { recursive: true });
  return dir;
}
function edit(dir, file, fn) { const p = path.join(dir, file); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }

async function withCourseBuild(prepare, fn) {
  const courseDir = copyFixture();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'course-seo-build-'));
  try {
    prepare?.(courseDir);
    await buildDocs({ outputDir, courseDir });
    await fn((file) => readFile(path.join(outputDir, file), 'utf8'));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
    fs.rmSync(courseDir, { recursive: true, force: true });
  }
}
const attr = (html, pattern) => html.match(pattern)?.[1];
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('each lesson gets its own pre-rendered page with one visible lesson and real prev/next links', () => withCourseBuild(null, async (read) => {
  for (const [index, id] of lessonIds.entries()) {
    const html = await read(`agentware/course/${id}/index.html`);
    const sections = [...html.matchAll(/<section class="lesson"[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(sections, [id], `${id}: exactly one lesson section`);
    assert.doesNotMatch(html, /<section class="lesson"[^>]*hidden/, `${id}: lesson is not hidden`);
    if (index > 0) assert.match(html, new RegExp(`<a href="/agentware/course/${lessonIds[index - 1]}/" rel="prev"`));
    if (index < lessonIds.length - 1) assert.match(html, new RegExp(`<a href="/agentware/course/${lessonIds[index + 1]}/" rel="next"`));
    assert.match(html, new RegExp(`<a href="/agentware/course/${id}/"[^>]*aria-current="page"`), `${id}: rail marks the current lesson`);
    assert.doesNotMatch(html, /href="#(basics|steps|api|loop|runtime|gaps)"/, `${id}: no hash-only lesson links`);
    assert.match(html, /<script type="module" src="\/assets\/course\/course.js"><\/script>/);
  }
}));

test('lesson head: title, description, canonical, Open Graph and Twitter tags fall back to title and lede', () => withCourseBuild(null, async (read) => {
  const html = await read('agentware/course/api/index.html');
  assert.equal(attr(html, /<title>([^<]*)<\/title>/), 'API · Agentware course');
  assert.equal(attr(html, /<meta name="description" content="([^"]*)">/), 'Fixture lesson.');
  assert.equal(attr(html, /<link rel="canonical" href="([^"]*)">/), `${docs}/agentware/course/api/`);
  assert.equal(attr(html, /<meta property="og:url" content="([^"]*)">/), `${docs}/agentware/course/api/`);
  assert.equal(attr(html, /<meta property="og:title" content="([^"]*)">/), 'API · Agentware course');
  assert.equal(attr(html, /<meta property="og:type" content="([^"]*)">/), 'article');
  assert.equal(attr(html, /<meta property="og:image" content="([^"]*)">/), `${docs}/assets/images/course-og.png`);
  assert.equal(attr(html, /<meta property="og:image:height" content="([^"]*)">/), '630');
  assert.equal(attr(html, /<meta name="twitter:card" content="([^"]*)">/), 'summary_large_image');
  assert.equal(attr(html, /<meta name="twitter:title" content="([^"]*)">/), 'API · Agentware course');
  assert.equal(attr(html, /<meta name="twitter:description" content="([^"]*)">/), 'Fixture lesson.');
}));

test('lesson head prefers seo_title and description, and a long Markdown lede becomes a plain 160-character description', () => withCourseBuild((dir) => {
  edit(dir, 'lessons/api.md', (s) => s.replace('title: API\n', 'title: API\nseo_title: "How do LLM APIs send tool calls?"\ndescription: "The OpenAI and Anthropic request and response shapes for one tool call."\n'));
  edit(dir, 'lessons/loop.md', (s) => s.replace('lede: Fixture lesson.', `lede: "The **loop** calls \`run_tool\` and [repeats](/agentware/build/python) ${'until the model answers in plain text '.repeat(6).trim()}."`));
}, async (read) => {
  const api = await read('agentware/course/api/index.html');
  assert.equal(attr(api, /<title>([^<]*)<\/title>/), 'How do LLM APIs send tool calls?');
  assert.equal(attr(api, /<meta name="description" content="([^"]*)">/), 'The OpenAI and Anthropic request and response shapes for one tool call.');
  assert.match(api, /<h1>API<\/h1>/, 'the visible H1 stays the lesson title');
  const loop = attr(await read('agentware/course/loop/index.html'), /<meta name="description" content="([^"]*)">/);
  assert.ok(loop.length <= 160, `description is ${loop.length} characters`);
  assert.match(loop, /^The loop calls run_tool and repeats until the model/);
  assert.doesNotMatch(loop, /[*`[\]]/);
  assert.match(loop, /…$/);
}));

test('lesson JSON-LD is a LearningResource that is part of the Course', () => withCourseBuild(null, async (read) => {
  const [data] = jsonLd(await read('agentware/course/steps/index.html'));
  assert.equal(data['@context'], 'https://schema.org');
  assert.equal(data['@type'], 'LearningResource');
  assert.equal(data.name, 'Steps');
  assert.equal(data.description, 'Fixture lesson.');
  assert.equal(data.url, `${docs}/agentware/course/steps/`);
  assert.equal(data.educationalLevel, 'Beginner');
  assert.equal(data.learningResourceType, 'Lesson');
  assert.equal(data.position, 2);
  assert.equal(data.timeRequired, 'PT4M');
  assert.deepEqual(data.provider, { '@type': 'Organization', name: 'Haikei Labs', url: 'https://haikeilabs.com' });
  assert.equal(data.isPartOf['@type'], 'Course');
  assert.equal(data.isPartOf.name, 'Agentware course');
  assert.equal(data.isPartOf.url, `${docs}/agentware/course/`);
}));

test('the hub lists every lesson as a link, starts the course and carries Course JSON-LD', () => withCourseBuild(null, async (read) => {
  const html = await read('agentware/course/index.html');
  assert.doesNotMatch(html, /<section class="lesson"/, 'the hub renders no lesson bodies');
  assert.match(html, /<h1>Agentware course<\/h1>/);
  assert.match(html, /Fixture course\./, 'the hub intro is rendered');
  assert.match(html, /class="button-primary" href="\/agentware\/course\/basics\/"/);
  for (const id of lessonIds) assert.match(html, new RegExp(`<a href="/agentware/course/${id}/" data-lesson-link="${id}"`));
  for (const label of ['Foundations', 'Hands on', 'Agentware']) assert.match(html, new RegExp(`<h2[^>]*>${label}</h2>`));
  assert.equal(attr(html, /<link rel="canonical" href="([^"]*)">/), `${docs}/agentware/course/`);
  assert.equal(attr(html, /<meta property="og:image" content="([^"]*)">/), `${docs}/assets/images/course-og.png`);
  const [data] = jsonLd(html);
  assert.equal(data['@type'], 'Course');
  assert.equal(data.name, 'Agentware course');
  assert.equal(data.description, 'Learn tool calling from scratch.');
  assert.equal(data.educationalLevel, 'Beginner');
  assert.equal(data.provider.name, 'Haikei Labs');
  assert.deepEqual(data.hasPart.map((part) => part.url), lessonIds.map((id) => `${docs}/agentware/course/${id}/`));
}));

test('the hub uses its seo_title when the front matter has one', () => withCourseBuild((dir) => {
  edit(dir, 'index.md', (s) => s.replace('title: Agentware course\n', 'title: Agentware course\nseo_title: "How do LLM tool calls work? A free course"\n'));
}, async (read) => {
  const html = await read('agentware/course/index.html');
  assert.equal(attr(html, /<title>([^<]*)<\/title>/), 'How do LLM tool calls work? A free course');
  assert.equal(jsonLd(html)[0].name, 'Agentware course');
}));

test('JSON-LD escapes < so lesson text cannot close the script element', () => withCourseBuild((dir) => {
  edit(dir, 'lessons/api.md', (s) => s.replace('title: API', 'title: "API </script><b>x"'));
}, async (read) => {
  const html = await read('agentware/course/api/index.html');
  assert.doesNotMatch(html, /<\/script><b>x/);
  assert.equal(jsonLd(html)[0].name, 'API </script><b>x');
}));

test('sitemap lists the hub and every lesson page; index.json and _headers gain nothing per lesson', () => withCourseBuild(null, async (read) => {
  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, new RegExp(`<loc>${docs}/agentware/course/</loc>`));
  for (const id of lessonIds) assert.match(sitemap, new RegExp(`<loc>${docs}/agentware/course/${id}/</loc>`));
  const manifest = JSON.parse(await read('index.json'));
  assert.equal(manifest.filter((entry) => entry.path.startsWith('/agentware/course/')).length, 1);
  const headers = await read('_headers');
  assert.doesNotMatch(headers, /\/agentware\/course\/(basics|steps|api|loop|runtime|gaps)/);
  assert.equal(headers.match(/^\//gm).length, manifest.length, 'one _headers rule per Markdown page, none per lesson');
}));

test('the course OG image ships at 1200x630 with its SVG source', () => withCourseBuild(null, async () => {
  const png = fs.readFileSync('assets/images/course-og.png');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const svg = fs.readFileSync('assets/images/course-og.svg', 'utf8');
  assert.match(svg, /width="1200" height="630"/);
  assert.doesNotMatch(svg, /#(?!(?:07110d|6ee7b7|f6f8f6|ffffff|a3b1aa)\b)[0-9a-f]{6}\b/i, 'only brand palette colors');
}));

test('a #lesson-id or inner-anchor hash on the hub maps to that lesson page', async () => {
  const { lessonUrlForHash } = await import('../assets/course/course.js');
  const ids = ['tool-call', 'tool', 'schema'];
  assert.equal(lessonUrlForHash('#schema', ids), '/agentware/course/schema/');
  assert.equal(lessonUrlForHash('#tool-call', ids), '/agentware/course/tool-call/');
  assert.equal(lessonUrlForHash('#tool-call-step-2', ids), '/agentware/course/tool-call/#tool-call-step-2');
  assert.equal(lessonUrlForHash('#tool-define', ids), '/agentware/course/tool/#tool-define');
  assert.equal(lessonUrlForHash('#sch%65ma', ids), '/agentware/course/schema/');
  for (const hash of ['', '#', '#missing', '#%E0%A4%A', '#schemas']) assert.equal(lessonUrlForHash(hash, ids), null, hash);
});

for (const [name, change] of [
  ['an empty lesson seo_title', (s) => s.replace('title: Basics\n', 'title: Basics\nseo_title: ""\n')],
  ['a lesson description over 160 characters', (s) => s.replace('title: Basics\n', `title: Basics\ndescription: "${'x'.repeat(161)}"\n`)],
  ['a non-string lesson description', (s) => s.replace('title: Basics\n', 'title: Basics\ndescription: 4\n')],
]) test(`schema rejects ${name}`, () => {
  const dir = copyFixture();
  try { edit(dir, 'lessons/basics.md', change); assert.throws(() => validateCourse(dir)); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('schema accepts optional seo_title and description on lessons and the hub', () => {
  const dir = copyFixture();
  try {
    edit(dir, 'lessons/basics.md', (s) => s.replace('title: Basics\n', 'title: Basics\nseo_title: "What is a tool call?"\ndescription: "A tool call is a message in which the model asks your code to run a function."\n'));
    edit(dir, 'index.md', (s) => s.replace('title: Agentware course\n', 'title: Agentware course\nseo_title: "How do LLM tool calls work?"\n'));
    assert.doesNotThrow(() => validateCourse(dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
