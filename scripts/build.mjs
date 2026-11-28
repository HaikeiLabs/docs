import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { newestUpdated, readLatestAgentware } from './course-version.mjs';
import { defaultCompatFile, formatWarning } from './course-validate.mjs';
import { courseConfigs, courseJsonLd, lessonHref, lessonJsonLd, lessonMeta, loadCourse, renderCourseHub, renderCourseRail, renderLesson } from './course.mjs';
import { createMarkdown, escapeHtml, neighbours, renderToc, stripHtmlComments, stripLeadingTitle } from './render.mjs';
import { checkBuiltRoutes, checkLinks } from './check-links.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markdown = createMarkdown();
const siteUrl = 'https://haikeilabs.com';
const docsUrl = 'https://docs.haikeilabs.com';
const consoleUrl = 'https://app.haikeilabs.com';
// C4: one GA4 property across haikeilabs.com, docs, app and playground. Plain gtag.js, no GTM.
export const GA4_MEASUREMENT_ID = 'G-EV3X1G9P73';
const discordUrl = 'https://discord.gg/g6QaTYWXDa';
const repoUrl = 'https://github.com/HaikeiLabs/docs';
const githubUrl = 'https://github.com/HaikeiLabs';
const allowedTypes = new Set(['read-and-use', 'make-and-maintain', 'reference']);
const allowedProducts = new Set(['kei', 'agentware']);
const navGroups = ['Start here', 'Get started', 'Make and maintain', 'Reference'];
// The sidebar shows Agentware first (its Start here group leads), then Kei.
// Start here is always an Agentware group, whatever the page's product.
// Research (content/research/) follows Kei.
const navProducts = [['agentware', 'Agentware'], ['kei', 'Kei'], ['research', 'Research']];
const maxDescriptionLength = 160;
// C5 share card. design-system exports it; copy it into assets/social/ (no runtime fetch).
const shareCardPath = '/assets/social/share-docs-1200x627.png';
const shareCard = { path: shareCardPath, width: 1200, height: 627, alt: 'Haikei Labs docs. Build, use and protect AI agents.' };
// The course share card: assets/images/course-og.svg, rendered by scripts/course-og.mjs.
const courseCard = { path: '/assets/images/course-og.png', width: 1200, height: 630, alt: 'Agentware course: how LLM tool calls work, from scratch. Haikei Labs.' };
const siteName = 'Haikei docs';
// Docs home head and H1: the p-docs row of the PAGES table (study.txt 1116).
const homeTitle = 'Haikei docs: build, use and protect AI agents';
const homeDescription = 'Guides for Agentware, Haikei Skills and Kei: build an AI agent, use it with your coding assistant, and add permissions and audit.';
// C3a paths. Peers write these pages; until one lands, links fall back to a page that exists.
const tutorialPath = 'tutorials/hacker-news-research-agent.md';
const bringYourAgentPath = 'kei/get-started/bring-your-agent.md';

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
  for (const key of ['title', 'description', 'type', 'product']) {
    if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error(`${relativePath}: front matter requires a non-empty ${key}`);
  }
  const descriptionLength = data.description.trim().length;
  if (descriptionLength > maxDescriptionLength) throw new Error(`${relativePath}: description is ${descriptionLength} characters; keep it to ${maxDescriptionLength} or fewer`);
  if (!allowedTypes.has(data.type)) throw new Error(`${relativePath}: type must be read-and-use, make-and-maintain, or reference`);
  if (!allowedProducts.has(data.product)) throw new Error(`${relativePath}: product must be kei or agentware`);
  if (data.nav_group !== undefined && !navGroups.includes(data.nav_group)) throw new Error(`${relativePath}: nav_group must be Start here, Get started, Make and maintain, or Reference`);
  if (data.seo_title !== undefined && (typeof data.seo_title !== 'string' || !data.seo_title.trim())) throw new Error(`${relativePath}: seo_title must be a non-empty string`);
  if (data.nav_order !== undefined && (!Number.isInteger(data.nav_order) || data.nav_order < 0)) throw new Error(`${relativePath}: nav_order must be a non-negative integer`);
  const parts = relativePath.split('/');
  // Product-root hub pages (content/<product>/<slug>.md) are allowed alongside section pages.
  if (['kei', 'agentware'].includes(parts[0]) && (parts.length < 2 || parts.length > 3)) throw new Error(`${relativePath}: pages must use content/${parts[0]}/<slug>.md or content/${parts[0]}/<section>/<slug>.md`);
  if (parts[0] === 'kei' && data.product !== 'kei') throw new Error(`${relativePath}: Kei pages require product: kei`);
  if (parts[0] === 'agentware' && data.product !== 'agentware') throw new Error(`${relativePath}: agentware pages require product: agentware`);
  if (parts[0] === 'tutorials' && parts.length !== 2) throw new Error(`${relativePath}: tutorials must use content/tutorials/<slug>.md`);
  if (parts[0] === 'research' && parts.length !== 2) throw new Error(`${relativePath}: research pages must use content/research/<slug>.md`);
  if (!['kei', 'agentware', 'evals', 'tutorials', 'research'].includes(parts[0]) && relativePath !== 'skills.md') throw new Error(`${relativePath}: use content/kei, content/agentware, content/evals, content/tutorials, content/research, or content/skills.md`);

  const validated = isoDate(data.validated);
  const validatedWith = typeof data.validated_with === 'string' ? data.validated_with.trim() : '';
  if (data.type === 'make-and-maintain' && !validated) throw new Error(`${relativePath}: make-and-maintain pages require validated: YYYY-MM-DD`);
  if (data.type === 'make-and-maintain' && !validatedWith) throw new Error(`${relativePath}: make-and-maintain pages require validated_with: kei vX.Y.Z`);
  if ((validated || validatedWith) && (!validIsoDate(validated) || !/^kei v\d+\.\d+\.\d+$/.test(validatedWith))) {
    throw new Error(`${relativePath}: validated must be a real YYYY-MM-DD date and validated_with must match kei vX.Y.Z`);
  }
  if (data.order !== undefined && !(Number.isInteger(data.order) && data.order > 0)) throw new Error(`${relativePath}: order must be a positive integer`);
  return { ...data, seo_title: data.seo_title?.trim(), nav_group: data.nav_group ?? 'Reference', nav_order: data.nav_order, validated, validated_with: validatedWith, body: parsed.content, relativePath };
}

async function markdownFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && !['agentware/course/lessons', 'evals/course/lessons'].includes(path.relative(root, absolute).split(path.sep).join('/'))) files.push(...await markdownFiles(absolute, root));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push({ absolute, relativePath: path.relative(root, absolute).split(path.sep).join('/') });
  }
  return files;
}

// Folder URLs (C3): content/<dir>/index.md is /<dir>/, and skills.md is /skills/.
// Every other page drops .md (/kei/get-started/sign-in).
const folderPages = new Set(['skills.md']);
function pageHref(page) {
  if (page.relativePath.endsWith('/index.md')) return `/${page.relativePath.slice(0, -'index.md'.length)}`;
  if (folderPages.has(page.relativePath)) return `/${page.relativePath.replace(/\.md$/, '')}/`;
  return `/${page.relativePath.replace(/\.md$/, '')}`;
}

// A folder URL is served from <dir>/index.html, every other page from <path>.html.
function pageOutputPath(page) {
  const href = pageHref(page).slice(1);
  return href.endsWith('/') ? `${href}index.html` : `${href}.html`;
}

function pageSlug(page) {
  return pageHref(page).slice(1).replace(/\/$/, '');
}

function navProduct(page) {
  if (page.relativePath.startsWith('research/')) return 'research';
  return page.nav_group === 'Start here' || page.product === 'agentware' ? 'agentware' : 'kei';
}

// Sidebar sections in display order: [{ product, label, group, pages }], empty sections dropped.
// Explicit nav_order is preferred; the legacy `order` field remains supported during migration.
function navSections(pages) {
  return navProducts.flatMap(([product, label]) => navGroups.map((group) => ({
    product,
    label,
    group,
    pages: pages
      .filter((page) => page.course !== 'evals' && navProduct(page) === product && page.nav_group === group)
      .sort((a, b) => (a.nav_order ?? a.order ?? Number.MAX_SAFE_INTEGER) - (b.nav_order ?? b.order ?? Number.MAX_SAFE_INTEGER) || a.relativePath.localeCompare(b.relativePath)),
  }))).filter((section) => section.pages.length);
}

function orderedPages(pages) {
  return navSections(pages).flatMap((section) => section.pages);
}

// Ties would fall back to path order, so each nav_order is used once per sidebar group.
function checkNavOrder(pages) {
  const clashes = [];
  for (const section of navSections(pages)) {
    const seen = new Map();
    for (const page of section.pages) {
      if (page.nav_order === undefined) continue;
      const first = seen.get(page.nav_order);
      if (first) clashes.push(`${section.label} · ${section.group}: nav_order ${page.nav_order} is used by ${first.relativePath} and ${page.relativePath}`);
      else seen.set(page.nav_order, page);
    }
  }
  if (clashes.length) throw new Error(`Duplicate nav_order values:\n${clashes.join('\n')}`);
}

function sidebar(pages, currentPath = '', links = siteLinks(pages)) {
  let product = '';
  const groups = navSections(pages).map((section) => {
    const heading = section.product === product ? '' : `<div class="nav-product">${section.label}</div>`;
    product = section.product;
    const entries = section.pages.map((page) => `<li><a href="${pageHref(page)}"${page.relativePath === currentPath ? ' aria-current="page"' : ''}>${escapeHtml(page.course === 'agentware' ? 'Course: tool calling from scratch' : page.title)}</a></li>`).join('');
    return `${heading}<div class="nav-section">${section.group}</div><ul>${entries}</ul>`;
  }).join('');
  return `<aside class="sidebar" id="site-nav"><div class="menu-hint">Press <kbd>Esc</kbd> to close <span>Focus returns to Menu</span></div>${globalNav(links, currentPath, 'sidebar-global')}<nav aria-label="Documentation">${groups}</nav></aside>`;
}

// Targets shared by the home cards and the global nav. A C3a page that has not landed
// yet falls back to the nearest page that exists, so the build never links nowhere.
function siteLinks(pages) {
  const has = (relativePath) => pages.find((page) => page.relativePath === relativePath);
  const keiStart = navSections(pages).find((section) => section.product === 'kei' && section.group === 'Get started')?.pages[0];
  const bring = has(bringYourAgentPath) ?? has('kei/get-started/sign-in.md') ?? keiStart;
  const tutorial = has(tutorialPath);
  return {
    agentware: '/agentware/build/overview',
    kei: bring ? pageHref(bring) : '/kei/get-started/sign-in',
    bring: bring && { href: pageHref(bring), label: bring.relativePath === bringYourAgentPath ? 'Connect the agent you use' : bring.title },
    tutorial: tutorial
      ? { href: pageHref(tutorial), label: tutorial.title }
      : { href: '/tutorials/', label: 'Browse the tutorials' },
    skills: '/skills/',
    tutorials: '/tutorials/',
    // The Research tab appears once content/research/index.md exists.
    research: has('research/index.md') ? '/research/' : '',
  };
}

function navSection(currentPath) {
  if (currentPath === '') return 'home';
  if (currentPath === 'skills.md') return 'skills';
  return currentPath.split('/')[0];
}

function globalNav(links, currentPath, className = 'global-nav') {
  const current = navSection(currentPath);
  const item = (key, href, label, extra = '') => `<a href="${href}"${extra}${key === current ? ' aria-current="true"' : ''}>${label}</a>`;
  return `<nav class="${className}" aria-label="Site">${[
    item('home', '/', 'Docs home'),
    item('agentware', links.agentware, 'Agentware'),
    item('kei', links.kei, 'Kei'),
    item('skills', links.skills, 'Skills'),
    item('tutorials', links.tutorials, 'Tutorials'),
    links.research ? item('research', links.research, 'Research') : '',
    item('', githubUrl, 'GitHub', ' aria-label="Haikei Labs on GitHub"'),
    item('', discordUrl, 'Discord', ' target="_blank" rel="noopener noreferrer" aria-label="Haikei on Discord"'),
  ].join('')}</nav>`;
}

const logoMark = '<svg class="logo" width="28" height="28" viewBox="0 0 32 32" role="img" aria-label="Haikei Labs"><rect x="9.5" y="9.5" width="13" height="13" rx="1.4" fill="var(--logo-plane)"/><rect x="1" y="1" width="21.5" height="21.5" rx="2.2" fill="none" stroke="var(--logo-plane)" stroke-width="2.1"/><rect x="9.5" y="9.5" width="21.5" height="21.5" rx="2.2" fill="none" stroke="var(--logo-front)" stroke-width="2.1"/><circle cx="13.3" cy="13.3" r="1.65" fill="var(--logo-point)"/><circle cx="18.7" cy="13.3" r="1.65" fill="var(--logo-point)"/><circle cx="13.3" cy="18.7" r="1.65" fill="var(--logo-point)"/><circle cx="18.7" cy="18.7" r="1.65" fill="var(--logo-point)"/></svg>';
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

// C4 Consent Mode v2 defaults are set before config. No Google signals, no ad storage.
// Allowlist, as on the marketing site: only the production host reports, so local
// previews and Cloudflare Pages previews (*.pages.dev) never send hits.
const ga4Snippet = `<script>(function () {
  if (location.hostname !== 'docs.haikeilabs.com') return
  window.dataLayer = window.dataLayer || []
  function gtag() { dataLayer.push(arguments) }
  window.gtag = gtag
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  gtag('js', new Date())
  gtag('config', '${GA4_MEASUREMENT_ID}', { allow_google_signals: false, allow_ad_personalization_signals: false })
  var script = document.createElement('script')
  script.async = true
  script.src = 'https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}'
  document.head.appendChild(script)
})()</script>`;

// C4 link attribution: every link into the app carries source=docs-<page>-<cta> plus UTM.
// A link that already names its source keeps it.
export function appLink(href, source) {
  const url = new URL(href);
  if (url.host !== new URL(consoleUrl).host || url.searchParams.has('source')) return href;
  url.searchParams.set('source', source);
  url.searchParams.set('utm_source', 'docs');
  url.searchParams.set('utm_medium', 'docs');
  url.searchParams.set('utm_campaign', 'evergreen');
  return url.toString();
}

function seoHead({ title, description, canonical, ogType, image = shareCard }) {
  const url = `${docsUrl}${canonical}`;
  return [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:site_name" content="${siteName}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:image" content="${docsUrl}${image.path}">`,
    `<meta property="og:image:alt" content="${escapeHtml(image.alt)}">`,
    `<meta property="og:image:width" content="${image.width}">`,
    `<meta property="og:image:height" content="${image.height}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${docsUrl}${image.path}">`,
  ].join('\n  ');
}

// JSON-LD inside <script>: escape < so no string in it can close the element.
function structuredData(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function layout(title, nav, content, { toc = '', mermaid = false, description = homeDescription, canonical = '/', ogType = 'website', fullTitle = `${title} · ${siteName}`, links, currentPath = '', tutorial = '', notFound = false, variant = '', image, jsonLd } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  ${seoHead({ title: fullTitle, description, canonical, ogType, image })}
  ${jsonLd ? `<script type="application/ld+json">${structuredData(jsonLd)}</script>` : ''}
  <script>${themeInit}</script>
  ${ga4Snippet}
  <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap">
  <link rel="stylesheet" href="/assets/brand.css">
  <link rel="stylesheet" href="/assets/tokens.css">
  <link rel="stylesheet" href="/assets/site.css">
  ${variant === 'course' ? '<link rel="stylesheet" href="/assets/course/course.css">' : ''}
  ${mermaid ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js" defer></script>' : ''}
  <script src="/assets/site.js" defer></script>
  ${variant === 'course' ? '<script type="module" src="/assets/course/course.js"></script>' : ''}
</head>
<body${notFound ? ' class="not-found-page"' : ''}>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" >Menu</button>
    <a class="brand" href="${siteUrl}" aria-label="Haikei Labs home">${logoMark}<span class="wordmark">Haikei Labs</span></a>
    <a class="docs-label" href="/">Docs</a>
    ${globalNav(links, currentPath)}
    <span class="header-spacer"></span>
    <a class="header-link" href="${escapeHtml(appLink(`${consoleUrl}/`, 'docs-header-console'))}">Console</a>
    <button class="theme-toggle" type="button" aria-label="Switch color theme"></button>
  </header>
  <div class="layout${variant === 'course' ? ' course-layout' : ''}">${nav}<main id="main" class="content"${tutorial ? ` data-tutorial="${escapeHtml(tutorial)}"` : ''}>${content}<footer class="footer">${notFound ? '' : '<p>Public guidance for people building and using agents with Kei.</p>'}<p>Questions? Join the developer community on <a href="${discordUrl}" target="_blank" rel="noopener noreferrer">Discord</a>.</p></footer></main>${toc}</div>
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

function tutorialList(pages) {
  const tutorials = orderedPages(pages).filter((entry) => entry.relativePath.startsWith('tutorials/') && entry.relativePath !== 'tutorials/index.md');
  if (!tutorials.length) return '';
  return `<ul class="tutorial-list">${tutorials.map((entry) => `<li><a href="${pageHref(entry)}"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.description.trim())}</span></a></li>`).join('')}</ul>`;
}

// tutorial_start (C4) fires on a tutorial page, not the tutorials index.
function tutorialSlug(page) {
  return page.relativePath.startsWith('tutorials/') && page.relativePath !== 'tutorials/index.md' ? pageSlug(page).split('/').pop() : '';
}

function renderPage(page, pages, links = siteLinks(pages)) {
  const outputPath = pageOutputPath(page);
  const validation = page.validated && page.validated_with
    ? `<p class="validated">Last validated ${escapeHtml(page.validated)} with ${escapeHtml(page.validated_with)}</p>`
    : '';
  const env = { appSource: `docs-${pageSlug(page).split('/').pop()}-console` };
  let rendered = markdown.render(stripHtmlComments(stripLeadingTitle(page.body)), env);
  if (tutorialSlug(page)) {
    const checkpoints = { run: ['tutorial_success', 'It ran'], tool: ['first_custom_tool', 'I added a tool'] };
    rendered = rendered.replace(/<p>\[checkpoint:(run|tool)\]<\/p>/g, (_, kind) => {
      const [event, label] = checkpoints[kind];
      return `<p class="tutorial-checkpoint"><button type="button" data-checkpoint="${event}" data-language="${escapeHtml(page.language ?? '')}">${label}</button><span aria-live="polite"></span></p>`;
    });
  }
  const pageLinks = `<a class="markdown-link" href="/${escapeHtml(page.relativePath)}">View as Markdown</a><a class="markdown-link" href="${repoUrl}/edit/main/content/${escapeHtml(page.relativePath)}">Edit on GitHub</a>`;
  const listing = page.relativePath === 'tutorials/index.md' ? tutorialList(pages) : '';
  const body = `<div class="title-row"><h1>${escapeHtml(page.title.replace(/ \| Agentware$/, ''))}</h1><div class="page-links">${pageLinks}</div></div>${validation}<article class="prose">${rendered}${listing}</article>${pager(orderedPages(pages), page)}`;
  const fullTitle = page.seo_title ?? `${page.title} · ${siteName}`;
  return { outputPath, html: layout(page.title, sidebar(pages, page.relativePath, links), body, { toc: renderToc(env.toc), mermaid: rendered.includes('class="mermaid"'), description: page.description.trim(), canonical: pageHref(page), ogType: 'article', fullTitle, links, currentPath: page.relativePath, tutorial: tutorialSlug(page) }) };
}

// Course (owner, 2026-11-25): the hub at /agentware/course/ plus one indexable page per
// lesson at /agentware/course/<id>/. Lessons stay out of index.json and _headers (no
// Markdown twin), so they cost no _headers rules; sitemap.xml lists them.
function renderCourseHubPage(page, course, links) {
  const intro = markdown.render(stripHtmlComments(stripLeadingTitle(page.body)), { appSource: 'docs-course-console' });
  const fullTitle = page.seo_title ?? `${page.title} · ${siteName}`;
  return { outputPath: pageOutputPath(page), html: layout(page.title, renderCourseRail(course), renderCourseHub(course, intro), { variant: 'course', description: page.description.trim(), canonical: pageHref(page), fullTitle, links, currentPath: page.relativePath, image: courseCard, jsonLd: courseJsonLd(course) }) };
}

function renderLessonPage(page, course, lesson, links) {
  const meta = lessonMeta(lesson, course.config);
  return { outputPath: `${meta.path.slice(1)}index.html`, html: layout(lesson.title, renderCourseRail(course, lesson.id), renderLesson(course, lesson), { variant: 'course', description: meta.description, canonical: meta.path, ogType: 'article', fullTitle: meta.fullTitle, links, currentPath: page.relativePath, image: courseCard, jsonLd: lessonJsonLd(course, lesson) }) };
}

// Two paths (C3a): build your own agent, or bring the agent you use. Both link /skills/.
function renderHome(pages) {
  const links = siteLinks(pages);
  const card = ({ eyebrow, heading, id, path: choice, text, actions }) => `<section class="path-card" data-path="${choice}" aria-labelledby="${id}"><p class="path-eyebrow eyebrow">${eyebrow}</p><h2 id="${id}">${heading}</h2><p>${text}</p><ul class="path-actions">${actions.filter(Boolean).map(([href, label, placement], index) => `<li><a${index === 0 ? ' class="path-primary button-primary"' : ''} href="${href}"${placement ? ` data-placement="${placement}"` : ''}>${escapeHtml(label)}</a></li>`).join('')}</ul></section>`;
  const cards = [
    card({
      eyebrow: 'Agentware',
      heading: 'Build your own agent',
      id: 'build-your-own-agent',
      path: 'build',
      text: 'Write tools and run the agent loop with Agentware in TypeScript, Go or Python, on any OpenAI-compatible model. You need a model API key, not a Kei account.',
      actions: [
        [links.agentware, 'Start the quickstart', 'docs-home-quickstart'],
        [links.tutorial.href, links.tutorial.label],
        [links.skills, 'Install Haikei Skills'],
      ],
    }),
    card({
      eyebrow: 'Your coding agent',
      heading: 'Bring the agent you use',
      id: 'bring-the-agent-you-use',
      path: 'bring',
      text: 'Claude Code, Codex, OpenCode, Pi or Open WebUI. Install the kei CLI, connect your agent’s <a href="/kei/reference/glossary#harness">harness</a> (the program that runs it and makes its tool calls), then add Kei policies: deterministic guardrails for those calls.',
      actions: [
        links.bring && [links.bring.href, links.bring.label],
        [links.skills, 'Install Haikei Skills'],
      ],
    }),
  ].join('');
  const research = links.research ? `<p class="home-research">Background reading: <a href="${links.research}">Research</a> has the Haikei Labs white papers on Kei policy architecture, with every published version.</p>` : '';
  const body = `<h1>Haikei documentation</h1><p class="home-intro">There are two ways to start. Build your own agent with Agentware, or bring the coding agent you already use and add Kei policies to it.</p><div class="path-grid">${cards}</div>${research}`;
  return layout('Haikei documentation', sidebar(pages, '', links), body, { fullTitle: homeTitle, links });
}

// Every canonical page: the home, each page in the index.json manifest, then any
// extra page that is not in the manifest (the course lessons). lastmod maps a path to
// a YYYY-MM-DD date; only course URLs have one (their updated front matter).
function sitemapXml(manifest, extra = [], lastmod = new Map()) {
  const urls = ['/', ...manifest.map((entry) => entry.path), ...extra];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(`${docsUrl}${url}`)}</loc>${lastmod.has(url) ? `<lastmod>${lastmod.get(url)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
}

// Cloudflare Pages _headers: each raw .md copy names its HTML page as canonical
// (Link header, C5), so search engines index the HTML page and not the copy.
// Cloudflare Pages accepts at most 100 _headers rules.
const maxHeaderRules = 100;
function markdownCopyHeaders(pages) {
  if (pages.length > maxHeaderRules) throw new Error(`_headers would need ${pages.length} rules; Cloudflare Pages allows ${maxHeaderRules}. Switch the .md copies to a single X-Robots-Tag: noindex rule.`);
  return pages.map((page) => `/${page.relativePath}\n  Link: <${docsUrl}${pageHref(page)}>; rel="canonical"\n`).join('');
}

export async function loadDocs(contentDir = path.join(repoRoot, 'content')) {
  const files = await markdownFiles(contentDir);
  if (!files.length) throw new Error(`No Markdown pages found in ${contentDir}`);
  const pages = [];
  for (const file of files) pages.push(validatePage(file.relativePath, await readFile(file.absolute, 'utf8')));
  pages.sort((a, b) => a.product.localeCompare(b.product) || a.relativePath.localeCompare(b.relativePath));
  checkNavOrder(pages);
  return pages;
}

export async function buildDocs({ contentDir = path.join(repoRoot, 'content'), outputDir = path.join(repoRoot, 'dist'), assetsDir = path.join(repoRoot, 'assets'), courseDir = process.env.COURSE_DIR ?? path.join(contentDir, 'agentware/course'), compatFile = defaultCompatFile } = {}) {
  markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    if (href?.startsWith('/content/')) token.attrSet('href', href.replace(/^\/content\//, '/').replace(/\.html(?=([?#]|$))/, ''));
    if (href?.startsWith(consoleUrl) && env?.appSource) token.attrSet('href', appLink(href, env.appSource));
    return self.renderToken(tokens, index, options);
  };
  const pages = await loadDocs(contentDir);
  const courses = new Map();
  for (const config of Object.values(courseConfigs)) {
    const dir = config.id === 'agentware' ? courseDir : path.join(contentDir, config.id, 'course');
    if (!existsSync(path.join(dir, 'index.md'))) continue;
    const course = loadCourse(dir, { latest: readLatestAgentware(compatFile) });
    if (course.hub.course !== config.id) throw new Error(`${dir}: expected course: ${config.id}`);
    courses.set(config.id, { course, dir });
    for (const warning of course.warnings) console.warn(formatWarning(warning));
    const relativePath = `${config.id}/course/index.md`;
    if (!pages.some(page => page.relativePath === relativePath)) pages.push(validatePage(relativePath, await readFile(path.join(dir, 'index.md'), 'utf8')));
  }
  checkNavOrder(pages);
  await checkLinks(contentDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'assets'), { recursive: true });
  await cp(path.join(repoRoot, 'node_modules/@haikeilabs/brand/dist/styles.flat.css'), path.join(outputDir, 'assets/brand.css'));
  await cp(path.join(assetsDir, 'tokens.css'), path.join(outputDir, 'assets/tokens.css'));
  await cp(path.join(assetsDir, 'site.css'), path.join(outputDir, 'assets/site.css'));
  await cp(path.join(assetsDir, 'site.js'), path.join(outputDir, 'assets/site.js'));
  await cp(path.join(assetsDir, 'images'), path.join(outputDir, 'assets/images'), { recursive: true });
  // The share card arrives from design-system; until then og:image points at the C5 path.
  if (existsSync(path.join(assetsDir, 'social'))) await cp(path.join(assetsDir, 'social'), path.join(outputDir, 'assets/social'), { recursive: true });
  const links = siteLinks(pages);
  if (courses.size) await cp(path.join(assetsDir, 'course'), path.join(outputDir, 'assets/course'), { recursive: true });
  for (const { course, dir } of courses.values()) await cp(path.join(dir, 'data'), path.join(outputDir, course.config.dataPath.slice(1)), { recursive: true, filter: source => path.basename(source) !== 'manifest.json' });
  const lessonPaths = [];
  const lastmod = new Map();
  for (const page of pages) {
    let result = renderPage(page, pages, links);
    const entry = courses.get(page.course);
    const course = entry && page.relativePath === `${page.course}/course/index.md` ? entry.course : null;
    if (course) {
      result = renderCourseHubPage(page, course, links);
      if (newestUpdated(course.lessons)) lastmod.set(pageHref(page), newestUpdated(course.lessons));
      for (const lesson of course.lessons) {
        const lessonPage = renderLessonPage(page, course, lesson, links);
        await mkdir(path.dirname(path.join(outputDir, lessonPage.outputPath)), { recursive: true });
        await writeFile(path.join(outputDir, lessonPage.outputPath), lessonPage.html);
        lessonPaths.push(lessonHref(lesson.id, course.config));
        if (lesson.updated) lastmod.set(lessonHref(lesson.id, course.config), lesson.updated);
      }
    }
    const { outputPath, html } = result;
    const htmlFile = path.join(outputDir, outputPath);
    const markdownFile = path.join(outputDir, page.relativePath);
    await mkdir(path.dirname(htmlFile), { recursive: true });
    await writeFile(htmlFile, html);
    await mkdir(path.dirname(markdownFile), { recursive: true });
    await cp(course ? path.join(entry.dir, 'index.md') : path.join(contentDir, page.relativePath), markdownFile);
  }
  const overview = pages.find((page) => page.relativePath === 'agentware/build/overview.md');
  if (!overview) throw new Error('Missing content/agentware/build/overview.md required by Agentware section routes');
  const overviewHtml = await readFile(path.join(outputDir, 'agentware/build/overview.html'), 'utf8');
  await mkdir(path.join(outputDir, 'agentware/build'), { recursive: true });
  await writeFile(path.join(outputDir, 'agentware/build/index.html'), overviewHtml);
  await mkdir(path.join(outputDir, 'agentware'), { recursive: true });
  await writeFile(path.join(outputDir, 'agentware/index.html'), overviewHtml);
  // One canonical URL for the Agentware section (C3): every alias 301s to the overview.
  // Cloudflare Pages applies _redirects before static assets; the index.html copies
  // remain as a fallback and carry the overview's canonical link.
  await writeFile(path.join(outputDir, '_redirects'), [
    '/agentware /agentware/build/overview 301',
    '/agentware/ /agentware/build/overview 301',
    '/agentware/build /agentware/build/overview 301',
    '/agentware/build/ /agentware/build/overview 301',
    '/agentware/build/quickstart /agentware/build/overview 301',
    '/agentware/build/quickstart/ /agentware/build/overview 301',
    // Moved pages keep their old addresses working.
    '/agentware/languages/ /agentware/reference/languages 301',
    '/agentware/languages /agentware/reference/languages 301',
    '/agentware/languages/go /agentware/build/go 301',
    '/tutorials/build-a-protected-agent /tutorials/add-permissions-and-audit 301',
    '/tutorials/build-a-protected-agent/ /tutorials/add-permissions-and-audit 301',
    '/kei/reference/whitepaper-policy-decision-and-enforcement /research/policy-decision-and-enforcement 301',
    '/kei/reference/whitepaper-policy-decision-and-enforcement.md /research/policy-decision-and-enforcement.md 301',
    // The Principal Model v1.1 text is published as written; its banner links repository
    // paths, which resolve relative to its page.
    '/research/docs/whitepapers/policy-decision-and-enforcement.md /research/policy-decision-and-enforcement 301',
    '/research/docs/whitepapers/policy-decision-and-enforcement.pdf https://haikeilabs.com/whitepapers/policy-decision-and-enforcement.pdf 301',
    '',
  ].join('\n'));
  await writeFile(path.join(outputDir, 'index.html'), renderHome(pages));
  // Page manifest consumed by `kei docs` (HAI-735). Keep this shape stable.
  const manifest = orderedPages(pages).map((page) => ({ slug: pageSlug(page), title: page.title, path: pageHref(page), product: page.product }));
  await writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'sitemap.xml'), sitemapXml([...manifest, ...pages.filter(page => page.course === 'evals').map(page => ({ path: pageHref(page) }))], lessonPaths, lastmod));
  await writeFile(path.join(outputDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${docsUrl}/sitemap.xml\n`);
  await writeFile(path.join(outputDir, '_headers'), markdownCopyHeaders(orderedPages(pages)));
  const notFoundLinks = siteLinks(pages);
  const notFound = `<div class="not-found"><p class="eyebrow">404 · Page not found</p><h1>We couldn't find that page</h1><p>It may have moved when the docs were reorganized. Start from the docs home, or open one of the two ways to start.</p><a class="button-primary" href="/">Go to docs home</a><div class="not-found-links"><a href="${notFoundLinks.agentware}">Build your own agent <span aria-hidden="true">→</span></a><a href="${notFoundLinks.kei}">Bring the agent you use <span aria-hidden="true">→</span></a></div></div>`;
  await writeFile(path.join(outputDir, '404.html'), layout('Page not found', sidebar(pages, '', notFoundLinks), notFound, { description: 'Find your way back to Haikei documentation.', canonical: '/404', links: notFoundLinks, notFound: true }));
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
