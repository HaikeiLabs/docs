import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import YAML from 'yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
const allowedTypes = new Set(['read-and-use', 'make-and-maintain', 'reference']);
const allowedProducts = new Set(['kei', 'agentware']);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value : '';
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validatePage(relativePath, raw) {
  const frontMatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontMatter) throw new Error(`${relativePath}: page must start with YAML front matter`);
  let parsed;
  try {
    parsed = { data: YAML.parse(frontMatter[1]) ?? {}, content: raw.slice(frontMatter[0].length) };
  } catch (error) {
    throw new Error(`${relativePath}: invalid front matter: ${error.message}`);
  }
  const data = parsed.data;
  for (const key of ['title', 'type', 'product']) {
    if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error(`${relativePath}: front matter requires a non-empty ${key}`);
  }
  if (!allowedTypes.has(data.type)) throw new Error(`${relativePath}: type must be read-and-use, make-and-maintain, or reference`);
  if (!allowedProducts.has(data.product)) throw new Error(`${relativePath}: product must be kei or agentware`);
  const parts = relativePath.split('/');
  if (['kei', 'agentware'].includes(parts[0]) && parts.length !== 3) throw new Error(`${relativePath}: pages must use content/${parts[0]}/<section>/<slug>.md`);
  if (parts[0] === 'kei' && data.product !== 'kei') throw new Error(`${relativePath}: Kei pages require product: kei`);
  if (parts[0] === 'agentware' && data.product !== 'agentware') throw new Error(`${relativePath}: agentware pages require product: agentware`);
  if (!['kei', 'agentware'].includes(parts[0]) && relativePath !== 'skills.md') throw new Error(`${relativePath}: use content/kei, content/agentware, or content/skills.md`);

  const validated = isoDate(data.validated);
  const validatedWith = typeof data.validated_with === 'string' ? data.validated_with.trim() : '';
  if (data.type === 'make-and-maintain' && !validated) throw new Error(`${relativePath}: make-and-maintain pages require validated: YYYY-MM-DD`);
  if (data.type === 'make-and-maintain' && !validatedWith) throw new Error(`${relativePath}: make-and-maintain pages require validated_with: kei vX.Y.Z`);
  if ((validated || validatedWith) && (!validIsoDate(validated) || !/^kei v\d+\.\d+\.\d+$/.test(validatedWith))) {
    throw new Error(`${relativePath}: validated must be a real YYYY-MM-DD date and validated_with must match kei vX.Y.Z`);
  }
  return { ...data, validated, validated_with: validatedWith, body: parsed.content, relativePath };
}

async function markdownFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(absolute, root));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push({ absolute, relativePath: path.relative(root, absolute).split(path.sep).join('/') });
  }
  return files;
}

function sectionFor(page) {
  const parts = page.relativePath.split('/');
  return parts.length > 2 ? parts[1] : 'Overview';
}

function pageHref(page) {
  return `/content/${page.relativePath.replace(/\.md$/, '.html')}`;
}

function sidebar(pages, currentPath = '') {
  const products = ['kei', 'agentware'];
  const groups = products.map((product) => {
    const productPages = pages.filter((page) => page.product === product);
    const sections = new Map();
    for (const page of productPages) {
      const section = page.relativePath === 'skills.md' ? 'Skills' : sectionFor(page);
      if (!sections.has(section)) sections.set(section, []);
      sections.get(section).push(page);
    }
    const content = [...sections.entries()].map(([section, entries]) => `<div class="nav-section">${escapeHtml(section.replaceAll('-', ' '))}</div><ul>${entries.map((page) => `<li><a href="${pageHref(page)}"${page.relativePath === currentPath ? ' aria-current="page"' : ''}>${escapeHtml(page.title)}</a></li>`).join('')}</ul>`).join('');
    return `<div class="nav-product">${product === 'kei' ? 'Kei' : 'agentware'}</div>${content}`;
  }).join('');
  return `<aside class="sidebar"><h2>Documentation</h2><nav aria-label="Documentation">${groups}</nav></aside>`;
}

function layout(title, nav, content) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Public documentation for Kei, agentware, and the Haikei skills.">
  <title>${escapeHtml(title)} · Haikei docs</title>
  <link rel="stylesheet" href="/assets/tokens.css">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><a class="brand" href="/">Haikei docs</a><span class="header-note">Kei · agentware · skills</span></header>
  <div class="layout">${nav}<main id="main" class="content">${content}<footer class="footer">Public guidance for people building and using agents with Kei.</footer></main></div>
</body>
</html>
`;
}

function renderPage(page, pages) {
  const outputPath = pageHref(page).slice(1);
  const validation = page.validated && page.validated_with
    ? `<p class="validated">Last validated ${escapeHtml(page.validated)} with ${escapeHtml(page.validated_with)}</p>`
    : '';
  const body = `<div class="title-row"><h1>${escapeHtml(page.title)}</h1><a class="markdown-link" href="/content/${escapeHtml(page.relativePath)}">View as Markdown</a></div>${validation}<article class="prose">${markdown.render(page.body)}</article>`;
  return { outputPath, html: layout(page.title, sidebar(pages, page.relativePath), body) };
}

function renderHome(pages) {
  const cards = pages.map((page) => `<a class="home-card" href="${pageHref(page)}"><strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.product)} · ${escapeHtml(page.type)}</span></a>`).join('');
  const body = `<h1>Haikei documentation</h1><p class="home-intro">Guidance for setting up Kei, building with agentware, and using Kei skills with your agent.</p><div class="home-grid">${cards}</div>`;
  return layout('Haikei documentation', sidebar(pages), body);
}

export async function loadDocs(contentDir = path.join(repoRoot, 'content')) {
  const files = await markdownFiles(contentDir);
  if (!files.length) throw new Error(`No Markdown pages found in ${contentDir}`);
  const pages = [];
  for (const file of files) pages.push(validatePage(file.relativePath, await readFile(file.absolute, 'utf8')));
  pages.sort((a, b) => a.product.localeCompare(b.product) || a.relativePath.localeCompare(b.relativePath));
  return pages;
}

export async function buildDocs({ contentDir = path.join(repoRoot, 'content'), outputDir = path.join(repoRoot, 'dist'), assetsDir = path.join(repoRoot, 'assets') } = {}) {
  const pages = await loadDocs(contentDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'assets'), { recursive: true });
  await cp(path.join(assetsDir, 'tokens.css'), path.join(outputDir, 'assets/tokens.css'));
  await cp(path.join(assetsDir, 'site.css'), path.join(outputDir, 'assets/site.css'));
  for (const page of pages) {
    const { outputPath, html } = renderPage(page, pages);
    const htmlFile = path.join(outputDir, outputPath);
    const markdownFile = path.join(outputDir, 'content', page.relativePath);
    await mkdir(path.dirname(htmlFile), { recursive: true });
    await writeFile(htmlFile, html);
    await mkdir(path.dirname(markdownFile), { recursive: true });
    await cp(path.join(contentDir, page.relativePath), markdownFile);
  }
  await writeFile(path.join(outputDir, 'index.html'), renderHome(pages));
  return pages;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const pages = await buildDocs();
    console.log(`Built ${pages.length} pages into dist/`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
