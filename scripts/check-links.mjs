import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt();

async function markdownFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(absolute, root));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push({ absolute, relativePath: path.relative(root, absolute).split(path.sep).join('/') });
  }
  return files;
}

function sourceTarget(destination, relativePath) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination) || destination.startsWith('#')) return null;
  const pageRoute = `/${relativePath.replace(/\.md$/, '')}`;
  const url = new URL(destination, `https://docs.haikeilabs.com${pageRoute}`);
  let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (['agentware', 'agentware/build', 'agentware/build/quickstart'].includes(pathname.replace(/\/$/, ''))) return 'agentware/build/overview.md';
  if (pathname.startsWith('content/')) pathname = pathname.slice('content/'.length);
  pathname = pathname.replace(/\.html$/, '').replace(/\/$/, '');
  if (!pathname) return null;
  if (!pathname.includes('.')) pathname += '.md';
  return path.posix.normalize(pathname);
}

export async function checkLinks(contentDir = new URL('../content/', import.meta.url).pathname) {
  const files = await markdownFiles(contentDir);
  const available = new Set(files.map((file) => file.relativePath));
  const broken = [];
  for (const file of files) {
    const tokens = markdown.parse(await readFile(file.absolute, 'utf8'), {});
    for (const token of tokens) {
      if (token.type !== 'inline') continue;
      for (const child of token.children ?? []) {
        if (child.type !== 'link_open') continue;
        const destination = child.attrGet('href');
        const target = sourceTarget(destination, file.relativePath);
        if (target && !available.has(target)) broken.push(`${file.relativePath}: ${destination} -> ${target}`);
      }
    }
  }
  if (!available.has('agentware/build/overview.md')) broken.push('/agentware/ and /agentware/build/ require content/agentware/build/overview.md');
  if (broken.length) throw new Error(`Broken internal documentation links:\n${broken.join('\n')}`);
  return files.length;
}

export async function checkBuiltRoutes(outputDir) {
  for (const routeFile of ['agentware/index.html', 'agentware/build/index.html']) {
    try {
      if (!(await stat(path.join(outputDir, routeFile))).isFile()) throw new Error(`${routeFile} is not a file`);
    } catch (error) {
      throw new Error(`Broken Agentware section route: ${routeFile} is missing (${error.message})`);
    }
  }
  const redirects = await readFile(path.join(outputDir, '_redirects'), 'utf8');
  for (const route of ['/agentware /agentware/build/overview 301', '/agentware/build /agentware/build/overview 301', '/agentware/build/quickstart /agentware/build/overview 301', '/agentware/build/quickstart/ /agentware/build/overview 301']) {
    if (!redirects.split(/\r?\n/).includes(route)) throw new Error(`Broken Agentware section redirect: ${route}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    console.log(`Checked internal links in ${await checkLinks()} Markdown pages.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
