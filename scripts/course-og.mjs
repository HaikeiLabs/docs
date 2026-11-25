// Renders assets/images/course-og.svg to the 1200x630 course share card (course-og.png).
// The build has no SVG-to-PNG step, so the PNG is committed; run this after editing the SVG:
//   npx playwright install chromium   # once per machine
//   node scripts/course-og.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const images = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/images');
const svg = await readFile(path.join(images, 'course-og.svg'), 'utf8');
// The brand fonts (Inter 400/600, JetBrains Mono 500), the same stylesheet the docs load.
const fonts = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=block';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<!doctype html><link rel="stylesheet" href="${fonts}"><style>html,body{margin:0}svg{display:block}</style>${svg}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const missing = await page.evaluate(() => ['600 46px Inter', '400 34px Inter', '500 24px "JetBrains Mono"'].filter(font => !document.fonts.check(font)));
  if (missing.length) throw new Error(`Brand fonts did not load: ${missing.join(', ')}`);
  await page.locator('svg').screenshot({ path: path.join(images, 'course-og.png') });
  console.log('Wrote assets/images/course-og.png');
} finally {
  await browser.close();
}
