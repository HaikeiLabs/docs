import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { createMarkdown, escapeHtml, neighbours, renderToc, stripLeadingTitle } from './render.mjs';
import { checkBuiltRoutes, checkLinks } from './check-links.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markdown = createMarkdown();
const siteUrl = 'https://haikeilabs.com';
const consoleUrl = 'https://app.haikeilabs.com';
const discordUrl = 'https://discord.gg/g6QaTYWXDa';
const repoUrl = 'https://github.com/HaikeiLabs/docs';
const allowedTypes = new Set(['read-and-use', 'make-and-maintain', 'reference']);
const allowedProducts = new Set(['kei', 'agentware']);
const navGroups = ['Get started', 'Make and maintain', 'Reference'];

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
  if (data.nav_group !== undefined && !navGroups.includes(data.nav_group)) throw new Error(`${relativePath}: nav_group must be Get started, Make and maintain, or Reference`);
  if (data.nav_order !== undefined && (!Number.isInteger(data.nav_order) || data.nav_order < 0)) throw new Error(`${relativePath}: nav_order must be a non-negative integer`);
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
  if (data.order !== undefined && !(Number.isInteger(data.order) && data.order > 0)) throw new Error(`${relativePath}: order must be a positive integer`);
  return { ...data, nav_group: data.nav_group ?? 'Reference', nav_order: data.nav_order, validated, validated_with: validatedWith, body: parsed.content, relativePath };
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

function pageHref(page) {
  return `/${page.relativePath.replace(/\.md$/, '')}`;
}

// Explicit nav_order is preferred; the legacy `order` field remains supported during migration.
function orderedPages(pages) {
  return navGroups.flatMap((group) => pages
    .filter((page) => page.nav_group === group)
    .sort((a, b) => (a.nav_order ?? a.order ?? Number.MAX_SAFE_INTEGER) - (b.nav_order ?? b.order ?? Number.MAX_SAFE_INTEGER) || a.relativePath.localeCompare(b.relativePath)));
}

function sidebar(pages, currentPath = '') {
  const groups = navGroups.map((group) => {
    const entries = orderedPages(pages).filter((page) => page.nav_group === group);
    return `<div class="nav-section">${group}</div><ul>${entries.map((page) => `<li><a href="${pageHref(page)}"${page.relativePath === currentPath ? ' aria-current="page"' : ''}>${escapeHtml(page.title)}</a></li>`).join('')}</ul>`;
  }).join('');
  return `<aside class="sidebar" id="site-nav"><nav aria-label="Documentation">${groups}</nav></aside>`;
}

const discordMark = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19.54 0c1.2 0 2.18.98 2.18 2.18v19.64c0 1.2-.98 2.18-2.18 2.18H4.46a2.18 2.18 0 0 1-2.18-2.18V2.18C2.28.98 3.26 0 4.46 0h15.08Zm-2.2 5.14a17.4 17.4 0 0 0-4.36-1.35l-.53 1.08a16.2 16.2 0 0 0-4.9 0l-.53-1.08a17.4 17.4 0 0 0-4.36 1.35C-.1 9.25-.87 13.26-.48 17.22a17.5 17.5 0 0 0 5.35 2.7l1.3-1.76c-.72-.26-1.4-.6-2.03-1.02l.5-.38c3.9 1.83 8.6 1.83 12.45 0l.5.38c-.63.42-1.31.76-2.03 1.02l1.3 1.76a17.5 17.5 0 0 0 5.35-2.7c.46-4.6-.79-8.57-2.84-12.08ZM8.1 15.04c-1.15 0-2.1-1.05-2.1-2.34s.92-2.34 2.1-2.34 2.1 1.05 2.1 2.34-.93 2.34-2.1 2.34Zm7.8 0c-1.15 0-2.1-1.05-2.1-2.34s.92-2.34 2.1-2.34 2.1 1.05 2.1 2.34-.92 2.34-2.1 2.34Z"/></svg>';
const logoMark = '<svg class="logo" width="28" height="28" viewBox="0 0 32 32" role="img" aria-label="Haikei Labs"><rect x="9.5" y="9.5" width="13" height="13" rx="1.4" fill="var(--logo-plane)"/><rect x="1" y="1" width="21.5" height="21.5" rx="2.2" fill="none" stroke="var(--logo-plane)" stroke-width="2.1"/><rect x="9.5" y="9.5" width="21.5" height="21.5" rx="2.2" fill="none" stroke="var(--logo-front)" stroke-width="2.1"/><circle cx="13.3" cy="13.3" r="1.65" fill="var(--logo-point)"/><circle cx="18.7" cy="13.3" r="1.65" fill="var(--logo-point)"/><circle cx="13.3" cy="18.7" r="1.65" fill="var(--logo-point)"/><circle cx="18.7" cy="18.7" r="1.65" fill="var(--logo-point)"/></svg>';
const githubMark = '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
// Inline before any stylesheet so a stored dark preference never flashes light.
// Mirrors design-system/scripts/theme-init.js; the last line only marks JS as available.
const themeInit = `(function () {
  try {
    var stored = localStorage.getItem('haikei-theme')
    if (stored !== 'dark' && stored !== 'light') {
      stored = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.dataset.theme = stored
  } catch (e) {
    document.documentElement.dataset.theme = 'light'
  }
  document.documentElement.classList.add('js')
})()`;

function layout(title, nav, content, { toc = '', mermaid = false } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Public documentation for Kei, agentware, and the Haikei skills.">
  <title>${escapeHtml(title)} · Haikei docs</title>
  <script>${themeInit}</script>
  <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap">
  <link rel="stylesheet" href="/assets/tokens.css">
  <link rel="stylesheet" href="/assets/site.css">
  ${mermaid ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js" defer></script>' : ''}
  <script src="/assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Menu"><span></span></button>
    <a class="brand" href="${siteUrl}" aria-label="Haikei Labs home">${logoMark}<span class="wordmark">Haikei Labs</span></a>
    <a class="docs-label" href="/">Docs</a>
    <span class="header-spacer"></span>
    <a class="header-link" href="${consoleUrl}">Console</a>
    <a class="icon-link" href="${discordUrl}" target="_blank" rel="noopener noreferrer" aria-label="Haikei on Discord">${discordMark}</a>
    <a class="icon-link" href="${repoUrl}" aria-label="Haikei docs on GitHub">${githubMark}</a>
    <button class="theme-toggle" type="button" aria-label="Switch color theme"></button>
  </header>
  <div class="layout">${nav}<main id="main" class="content">${content}<footer class="footer"><p>Public guidance for people building and using agents with Kei.</p><p>Questions? Join the developer community on <a href="${discordUrl}" target="_blank" rel="noopener noreferrer">Discord</a>.</p></footer></main>${toc}</div>
</body>
</html>
`;
}

function pager(ordered, page) {
  const { prev, next } = neighbours(ordered, page);
  if (!prev && !next) return '';
  const link = (target, dir, label) => target
    ? `<a class="pager-${dir}" href="${pageHref(target)}" rel="${dir}"><span class="pager-label">${label}</span><span class="pager-title">${escapeHtml(target.title)}</span></a>`
    : '<span></span>';
  return `<nav class="pager" aria-label="Previous and next pages">${link(prev, 'prev', 'Previous')}${link(next, 'next', 'Next')}</nav>`;
}

function renderPage(page, pages) {
  const outputPath = `${page.relativePath.replace(/\.md$/, '')}.html`;
  const validation = page.validated && page.validated_with
    ? `<p class="validated">Last validated ${escapeHtml(page.validated)} with ${escapeHtml(page.validated_with)}</p>`
    : '';
  const env = {};
  const rendered = markdown.render(stripLeadingTitle(page.body), env);
  const links = `<a class="markdown-link" href="/${escapeHtml(page.relativePath)}">View as Markdown</a><a class="markdown-link" href="${repoUrl}/edit/main/content/${escapeHtml(page.relativePath)}">Edit on GitHub</a>`;
  const body = `<div class="title-row"><h1>${escapeHtml(page.title)}</h1><div class="page-links">${links}</div></div>${validation}<article class="prose">${rendered}</article>${pager(orderedPages(pages), page)}`;
  return { outputPath, html: layout(page.title, sidebar(pages, page.relativePath), body, { toc: renderToc(env.toc), mermaid: rendered.includes('class="mermaid"') }) };
}

function renderHome(pages) {
  const sections = navGroups.map((group) => {
    const cards = orderedPages(pages).filter((page) => page.nav_group === group)
      .map((page) => `<a class="home-card" href="${pageHref(page)}"><strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.product)}</span></a>`).join('');
    return `<section><h2>${group}</h2><div class="home-grid">${cards}</div></section>`;
  }).join('');
  const body = `<h1>Haikei documentation</h1><p class="home-intro">Set up Kei, build with agentware, and use Kei skills with your agent.</p>${sections}`;
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
  markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    if (href?.startsWith('/content/')) token.attrSet('href', href.replace(/^\/content\//, '/').replace(/\.html(?=([?#]|$))/, ''));
    return self.renderToken(tokens, index, options);
  };
  const pages = await loadDocs(contentDir);
  await checkLinks(contentDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'assets'), { recursive: true });
  await cp(path.join(assetsDir, 'tokens.css'), path.join(outputDir, 'assets/tokens.css'));
  await cp(path.join(assetsDir, 'site.css'), path.join(outputDir, 'assets/site.css'));
  await cp(path.join(assetsDir, 'site.js'), path.join(outputDir, 'assets/site.js'));
  await cp(path.join(assetsDir, 'images'), path.join(outputDir, 'assets/images'), { recursive: true });
  for (const page of pages) {
    const { outputPath, html } = renderPage(page, pages);
    const htmlFile = path.join(outputDir, outputPath);
    const markdownFile = path.join(outputDir, page.relativePath);
    await mkdir(path.dirname(htmlFile), { recursive: true });
    await writeFile(htmlFile, html);
    await mkdir(path.dirname(markdownFile), { recursive: true });
    await cp(path.join(contentDir, page.relativePath), markdownFile);
  }
  const overview = pages.find((page) => page.relativePath === 'agentware/build/overview.md');
  if (!overview) throw new Error('Missing content/agentware/build/overview.md required by Agentware section routes');
  const overviewHtml = await readFile(path.join(outputDir, 'agentware/build/overview.html'), 'utf8');
  await mkdir(path.join(outputDir, 'agentware/build'), { recursive: true });
  await writeFile(path.join(outputDir, 'agentware/build/index.html'), overviewHtml);
  await mkdir(path.join(outputDir, 'agentware'), { recursive: true });
  await writeFile(path.join(outputDir, 'agentware/index.html'), overviewHtml);
  await writeFile(path.join(outputDir, '_redirects'), [
    '/agentware /agentware/build/overview 301',
    '/agentware/build /agentware/build/overview 301',
    '/agentware/build/quickstart /agentware/build/overview 301',
    '/agentware/build/quickstart/ /agentware/build/overview 301',
    '',
  ].join('\n'));
  await writeFile(path.join(outputDir, 'index.html'), renderHome(pages));
  // Page manifest consumed by `kei docs` (HAI-735). Keep this shape stable.
  const manifest = orderedPages(pages).map((page) => ({ slug: pageHref(page).slice(1), title: page.title, path: pageHref(page), product: page.product }));
  await writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(outputDir, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found · Haikei docs</title><h1>Page not found</h1><p><a href="/">Return to the documentation home.</a></p></html>\n');
  await checkBuiltRoutes(outputDir);
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
