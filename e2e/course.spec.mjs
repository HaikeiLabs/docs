import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const lessons = [ ['basics', 'Basics'], ['steps', 'Steps'], ['api', 'API'], ['loop', 'Loop'], ['runtime', 'Runtime'], ['gaps', 'Gaps'] ];
for (const theme of ['light', 'dark']) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => { await page.addInitScript(value => { if (!localStorage.getItem('haikei-theme')) localStorage.setItem('haikei-theme', value); }, theme); });

    test('routes every lesson and keeps the mobile page within its viewport', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [id, title] of lessons) {
        await page.goto(`/agentware/course/#${id}`);
        await expect(page.locator('.lesson:visible')).toHaveCount(1);
        await expect(page.locator('.lesson:visible h1')).toHaveText(title);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole('button', { name: 'Menu' }).click();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole('button', { name: 'Close menu' }).click();
      }
      expect(errors).toEqual([]);
    });

    test('theme toggle persists across reload', async ({ page }) => {
      await page.goto('/agentware/course/#basics');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.locator('.theme-toggle').click();
      const next = theme === 'light' ? 'dark' : 'light';
      await expect(page.locator('html')).toHaveAttribute('data-theme', next);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', next);
    });

    test('quiz marks only a correct answer complete and persists it', async ({ page }) => {
      await page.goto('/agentware/course/#basics');
      await page.locator('#basics [data-quiz-answer="1"]').click();
      await expect(page.locator('[data-progress]')).toHaveText('0 of 6');
      await page.locator('#basics [data-quiz-answer="0"]').click();
      await expect(page.locator('[data-progress]')).toHaveText('1 of 6');
      await expect(page.locator('[data-lesson-link="basics"] [data-check]')).toContainText('✓');
      await page.reload();
      await expect(page.locator('[data-progress]')).toHaveText('1 of 6');
    });

    test('quiz still works when storage throws', async ({ browser }) => {
      const context = await browser.newContext();
      await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
      const page = await context.newPage();
      await page.goto('/agentware/course/#basics');
      await page.locator('#basics [data-quiz-answer="0"]').click();
      await expect(page.locator('[data-progress]')).toHaveText('1 of 6');
      await context.close();
    });

    test('markers, quiz, body and rail text meet contrast requirements', async ({ page }) => {
      await page.goto('/agentware/course/#basics');
      const ratios = await page.evaluate(() => {
        const parse = value => value.match(/[\d.]+/g).map(Number);
        const blend = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
        const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const ratio = selector => {
          const el = document.querySelector(selector), ink = parse(getComputedStyle(el).color);
          const layers = []; for (let node = el; node; node = node.parentElement) layers.push(parse(getComputedStyle(node).backgroundColor));
          let bg = [255, 255, 255]; for (const layer of layers.reverse()) bg = blend(layer, bg);
          const values = [luminance(ink), luminance(bg)].sort((a, b) => b - a);
          return [selector, (values[0] + .05) / (values[1] + .05)];
        };
        return ['.lesson > p:nth-of-type(2)', '.course-rail a', '.mk', '.course-mark', '.course-quiz button', '.course-code-line > span:last-child'].map(ratio);
      });
      for (const [selector, ratio] of ratios) expect(ratio, `${selector}: ${ratio}`).toBeGreaterThanOrEqual(4.5);
    });
  });
}

test('rail links and quiz controls have visible keyboard focus', async ({ page }) => {
  await page.goto('/agentware/course/#basics');
  const link = page.locator('[data-lesson-link="basics"]');
  await link.focus();
  await expect(link).toBeFocused();
  await expect.poll(() => link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  const quiz = page.locator('#basics [data-quiz-answer="0"]');
  await quiz.focus();
  await expect(quiz).toBeFocused();
  await expect.poll(() => quiz.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
});

for (const [name, lesson] of [['cycle', 'basics'], ['compare', 'api'], ['api', 'api'], ['debugger', 'loop'], ['rtdebugger', 'runtime'], ['gaps', 'gaps']]) {
  test(`mounts ${name} when its module is available`, async ({ page }) => {
    test.skip(!existsSync(`assets/course/widgets/${name}.js`), `${name} widget is being developed separately`);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/agentware/course/#${lesson}`);
    if (name === 'api') await page.locator('#api .course-reference summary').click();
    const widget = page.locator(`#${lesson} [data-widget="${name}"]`);
    await expect(widget).not.toHaveText(`Interactive ${name} widget`);
    expect(errors).toEqual([]);
  });
}

test('course assets use role tokens instead of raw colors', () => {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
  for (const file of walk('assets/course').filter(file => /\.(?:css|js)$/.test(file))) {
    expect(readFileSync(file, 'utf8'), file).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  }
});

test('cycle respects reduced motion and advances only on request', async ({ browser }) => {
  test.skip(!existsSync('assets/course/widgets/cycle.js'), 'cycle widget is being developed separately');
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/agentware/course/#basics');
  const widget = page.locator('[data-widget="cycle"]');
  await expect(widget).not.toHaveText('Interactive cycle widget');
  const before = await widget.innerHTML();
  await page.waitForTimeout(750);
  expect(await widget.innerHTML()).toBe(before);
  await widget.getByRole('button', { name: /^(step|next)$/i }).first().click();
  await expect.poll(() => widget.innerHTML()).not.toBe(before);
  await context.close();
});

test('compare tabs support keyboard and do not overflow mobile', async ({ page }) => {
  test.skip(!existsSync('assets/course/widgets/compare.js'), 'compare widget is being developed separately');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/agentware/course/#api');
  const widget = page.locator('[data-widget="compare"]');
  const tabs = widget.getByRole('tab');
  await expect(tabs.first()).toBeVisible();
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  for (const tab of await tabs.all()) {
    await tab.click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('debugger controls have visible keyboard focus', async ({ page }) => {
  test.skip(!existsSync('assets/course/widgets/debugger.js'), 'debugger widget is being developed separately');
  await page.goto('/agentware/course/#loop');
  const button = page.locator('[data-widget="debugger"]').getByRole('button', { name: 'Step', exact: true });
  await expect(button).toBeVisible();
  await button.focus();
  await expect(button).toBeFocused();
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
});
