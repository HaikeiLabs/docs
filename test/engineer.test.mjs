import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdown, highlight, neighbours, parseInfo, renderToc, slugify, stripLeadingTitle } from '../scripts/render.mjs';

const render = (source) => {
  const env = {};
  const html = createMarkdown().render(source, env);
  return { html, env };
};

test('headings get unique ids, anchor links and TOC entries for h2/h3 only', () => {
  const { html, env } = render('# Title\n\n## Install\n\n### Linux\n\n## Install\n');
  assert.match(html, /<h2 id="install">Install<a class="anchor" href="#install"/);
  assert.match(html, /<h2 id="install-1">/);
  assert.deepEqual(env.toc.map((entry) => [entry.level, entry.id]), [[2, 'install'], [3, 'linux'], [2, 'install-1']]);
  assert.doesNotMatch(html, /<h1[^>]*>Title<a class="anchor"/);
});

test('slugify strips punctuation and keeps words', () => {
  assert.equal(slugify('What is `kei`? (Quick)'), 'what-is-kei-quick');
});

test('TOC renders only for pages with at least three entries', () => {
  assert.equal(renderToc([{ level: 2, id: 'a', text: 'A' }]), '');
  const toc = renderToc(['a', 'b', 'c'].map((id) => ({ level: 2, id, text: id })));
  assert.match(toc, /aria-label="On this page"/);
  assert.match(toc, /href="#c"/);
});

test('callouts use the Note/Warning blockquote convention and leave other quotes alone', () => {
  assert.match(render('> **Note:** careful\n').html, /<blockquote class="callout callout-note"/);
  assert.match(render('> **Warning** this deletes\n').html, /callout callout-warning/);
  assert.doesNotMatch(render('> **Report a bug** — here\n').html, /callout/);
  assert.doesNotMatch(render('> plain quote\n').html, /callout/);
});

test('fenced code carries a language or filename label, a copy button and escaped highlighting', () => {
  const lang = render('```bash\nkei login --workspace "<id>"\n```\n').html;
  assert.match(lang, /<span class="code-label">bash<\/span>/);
  assert.match(lang, /class="copy"/);
  assert.match(lang, /<span class="tok-f">--workspace<\/span>/);
  assert.match(lang, /&lt;id&gt;/);
  const file = render('```json title="policy.json"\n{"a": 1}\n```\n').html;
  assert.match(file, /code-label is-file">policy\.json/);
  assert.match(render('```\nplain\n```\n').html, />text<\/span>/);
  assert.deepEqual(parseInfo('sh title="a b.sh"'), { lang: 'sh', title: 'a b.sh' });
});

test('highlight never lets raw markup through and leaves unknown languages plain', () => {
  assert.equal(highlight('<b>&</b>', 'mermaid'), '&lt;b&gt;&amp;&lt;/b&gt;');
  assert.doesNotMatch(highlight('echo "<script>" # <x>', 'sh'), /<script>|<x>/);
  assert.match(highlight('{"k": "v", "n": 2, "t": true}', 'json'), /tok-p">&quot;k&quot;.*tok-s">&quot;v&quot;.*tok-n">2.*tok-k">true/);
  assert.match(highlight('FROM node:20\n', 'dockerfile'), /tok-k">FROM/);
});

test('prev/next follow the supplied reading order', () => {
  const order = ['a', 'b', 'c'];
  assert.deepEqual(neighbours(order, 'a'), { prev: null, next: 'b' });
  assert.deepEqual(neighbours(order, 'b'), { prev: 'a', next: 'c' });
  assert.deepEqual(neighbours(order, 'c'), { prev: 'b', next: null });
  assert.deepEqual(neighbours(order, 'x'), { prev: null, next: null });
});

test('custom {#id} heading suffixes become the id and are not shown', () => {
  const { html, env } = render('## Add and grant {#add-grant}\n');
  assert.match(html, /<h2 id="add-grant">Add and grant<a/);
  assert.equal(env.toc[0].text, 'Add and grant');
});

test('a leading H1 is stripped because the title row renders it', () => {
  assert.equal(stripLeadingTitle('\n# Sign in\n\nBody\n'), 'Body\n');
  assert.equal(stripLeadingTitle('Body\n\n# Later\n'), 'Body\n\n# Later\n');
});
