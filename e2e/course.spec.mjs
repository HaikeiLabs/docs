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

    test('a correctly answered quiz stays complete and locks its options', async ({ page }) => {
      await page.goto('/agentware/course/#basics');
      const quiz = page.locator('#basics .course-quiz');
      const feedback = quiz.locator('[data-feedback]');
      await quiz.locator('[data-quiz-answer="0"]').click();
      const why = await feedback.textContent();
      // Locked options are aria-disabled, which Playwright treats as not enabled; force sends the click anyway.
      await quiz.locator('[data-quiz-answer="1"]').click({ force: true });
      await expect(quiz.locator('[data-quiz-answer="0"]')).toHaveAttribute('data-result', 'right');
      await expect(quiz.locator('[data-quiz-answer="1"]')).not.toHaveAttribute('data-result');
      await expect(quiz.locator('[data-result]')).toHaveCount(1);
      await expect(feedback).toHaveText(why);
      await expect(quiz.locator('[data-quiz-answer]:not([aria-disabled="true"])')).toHaveCount(0);
      await expect(page.locator('[data-progress]')).toHaveText('1 of 6');
      await page.reload();
      await quiz.locator('[data-quiz-answer="1"]').click({ force: true });
      await expect(quiz.locator('[data-result]')).toHaveCount(1);
      await expect(feedback).toHaveText(why);
      await expect(quiz.locator('[data-quiz-answer]:not([aria-disabled="true"])')).toHaveCount(0);
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

// Learner click-through findings: ligatures, contrast, debugger controls, quiz state.
const contrastOf = (page, selectors) => page.evaluate(selectors => {
  const parse = value => value.match(/[\d.]+/g).map(Number);
  const blend = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
  const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  return selectors.map(selector => {
    const el = document.querySelector(selector), ink = parse(getComputedStyle(el).color);
    const layers = []; for (let node = el; node; node = node.parentElement) layers.push(parse(getComputedStyle(node).backgroundColor));
    let bg = [255, 255, 255]; for (const layer of layers.reverse()) bg = blend(layer, bg);
    const values = [luminance(ink), luminance(bg)].sort((a, b) => b - a);
    return [selector, (values[0] + .05) / (values[1] + .05)];
  });
}, selectors);
const setTheme = (page, theme) => page.addInitScript(value => localStorage.setItem('haikei-theme', value), theme);
const mounted = async (page, lesson, name) => expect(page.locator(`#${lesson} [data-widget="${name}"]`)).not.toHaveText(`Interactive ${name} widget`);

test('code and token text render without font ligatures', async ({ page }) => {
  for (const [lesson, widget, selectors] of [
    ['basics', 'cycle', ['.course-code-line > span:last-child', '.mk', '.course-mark', '.cycle-message div']],
    ['loop', 'debugger', ['.debugger-line code', '.debugger-inspector pre']],
    ['runtime', 'rtdebugger', ['.rt-line code', '.rt-block pre']],
  ]) {
    await page.goto(`/agentware/course/#${lesson}`);
    await mounted(page, lesson, widget);
    for (const selector of selectors) {
      expect(await page.locator(`#${lesson} ${selector}`).first().evaluate(el => getComputedStyle(el).fontVariantLigatures), selector).toBe('none');
    }
  }
});

for (const theme of ['light', 'dark']) {
  test(`debugger status banners meet contrast in ${theme} mode`, async ({ page }) => {
    await setTheme(page, theme);
    for (const [lesson, widget, selector] of [['loop', 'debugger', '.debugger-status'], ['runtime', 'rtdebugger', '.rt-status']]) {
      await page.goto(`/agentware/course/#${lesson}`);
      await mounted(page, lesson, widget);
      for (const [name, ratio] of await contrastOf(page, [`#${lesson} ${selector}`])) expect(ratio, `${name}: ${ratio}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test('debugger Step and Continue are disabled at the last stop', async ({ page }) => {
  for (const [lesson, widget, stop] of [['loop', 'debugger', '[data-stop]'], ['runtime', 'rtdebugger', '[data-go]']]) {
    await page.goto(`/agentware/course/#${lesson}`);
    await mounted(page, lesson, widget);
    const root = page.locator(`#${lesson} [data-widget="${widget}"]`);
    await expect(root.getByRole('button', { name: 'Step', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
    await root.locator(stop).last().click();
    for (const name of ['Step', 'Continue']) await expect(root.getByRole('button', { name, exact: true })).toHaveAttribute('aria-disabled', 'true');
    await root.getByRole('button', { name: 'Step', exact: true }).click({ force: true });
    await expect(root.locator(stop).last()).toHaveAttribute('aria-current', 'step');
  }
});

test('debugger defaults to Claude and pluralizes the history count', async ({ page }) => {
  await page.goto('/agentware/course/#loop');
  await mounted(page, 'loop', 'debugger');
  const root = page.locator('#loop [data-widget="debugger"]');
  await expect(root.locator('[data-style]')).toHaveText(['Claude', 'GPT-OSS', 'Qwen3']);
  await expect(root.locator('[data-style="anthropic"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator('.debugger-vars')).toContainText(/history\s*1 message(?!s)/);
});

test('debugger final answer wraps inside its panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/agentware/course/#loop');
  await mounted(page, 'loop', 'debugger');
  await page.locator('#loop [data-stop]').last().click();
  const pre = page.locator('#loop .debugger-inspector pre').last();
  await expect(pre).toContainText('Tokyo');
  expect(await pre.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('cycle: Next disables at the end, Restart resets Replay, controls stay on one row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/agentware/course/#basics');
  await mounted(page, 'basics', 'cycle');
  const root = page.locator('#basics [data-widget="cycle"]');
  await root.getByRole('button', { name: 'GPT-OSS' }).click();
  const next = root.getByRole('button', { name: 'Next', exact: true });
  for (let i = 0; i < 20 && await next.getAttribute('aria-disabled') !== 'true'; i++) await next.click();
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect(root.locator('[data-action="play"]')).toHaveText('Replay');
  const tops = await root.locator('.cycle-controls button').evaluateAll(buttons => buttons.map(b => Math.round(b.getBoundingClientRect().top)));
  expect(new Set(tops).size, `control rows: ${tops}`).toBe(1);
  expect(await root.locator('.cycle-controls button').evaluateAll(buttons => buttons.filter(b => b.scrollWidth > b.clientWidth).map(b => b.textContent))).toEqual([]);
  await root.getByRole('button', { name: 'Restart' }).click();
  await expect(root.locator('[data-action="play"]')).toHaveText('Play');
  await expect(next).not.toHaveAttribute('aria-disabled', 'true');
  await next.click(); await root.getByRole('button', { name: 'Claude' }).click();
  await expect(root.locator('[data-action="play"]')).toHaveText('Play');
});

test('a wrong quiz pick gets the neutral treatment and a hint, not the correct style', async ({ page }) => {
  await page.goto('/agentware/course/#basics');
  const quiz = page.locator('#basics .course-quiz');
  const wrong = quiz.locator('[data-quiz-answer="1"]'), right = quiz.locator('[data-quiz-answer="0"]');
  await wrong.click();
  await expect(wrong).toHaveAttribute('data-result', 'wrong');
  await expect(quiz.locator('[data-feedback]')).toContainText(/try again/i);
  await expect(quiz.locator('[data-feedback]')).toContainText(/reread|re-read/i);
  await page.mouse.move(0, 0);
  const wrongBorder = await wrong.evaluate(el => getComputedStyle(el).borderTopColor);
  await right.click();
  await expect(right).toHaveAttribute('data-result', 'right');
  await page.mouse.move(0, 0);
  const rightBorder = await right.evaluate(el => getComputedStyle(el).borderTopColor);
  expect(wrongBorder).not.toBe(rightBorder);
  const accent = await page.evaluate(() => { const probe = document.createElement('i'); probe.style.color = 'var(--color-accent-text)'; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; });
  expect(wrongBorder).not.toBe(accent);
});

test('completed quizzes are restored after reload and the course reports completion', async ({ page }) => {
  await page.goto('/agentware/course/');
  await expect(page.locator('[data-course-complete]:visible')).toHaveCount(0);
  for (const [id] of lessons) {
    await page.goto(`/agentware/course/#${id}`);
    const answer = await page.locator(`#${id} .course-quiz`).getAttribute('data-answer');
    await page.locator(`#${id} [data-quiz-answer="${answer}"]`).click();
  }
  await expect(page.locator('[data-progress]')).toHaveText('6 of 6');
  await expect(page.locator('#gaps [data-course-complete]')).toBeVisible();
  await page.goto('/agentware/course/#basics');
  await page.reload();
  await expect(page.locator('#basics [data-quiz-answer="0"]')).toHaveAttribute('data-result', 'right');
  await expect(page.locator('#basics [data-feedback]')).toHaveText('The first answer is correct.');
  await expect(page.locator('#basics [data-course-complete]')).toBeVisible();
});

test('lesson lede stays within the content column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/agentware/course/#basics');
  const [lede, prose] = await Promise.all(['#basics > p:nth-of-type(2)', '#basics .prose'].map(s => page.locator(s).evaluate(el => el.getBoundingClientRect().right)));
  expect(lede).toBeLessThanOrEqual(prose + 1);
});

test('every course button has an accessible name', async ({ page }) => {
  for (const [id] of lessons) {
    await page.goto(`/agentware/course/#${id}`);
    await page.waitForLoadState('networkidle');
    for (const summary of await page.locator(`#${id} details > summary`).all()) await summary.click();
    const unnamed = await page.locator(`#${id} button`).evaluateAll(buttons => buttons.filter(b => !(b.getAttribute('aria-label') || b.textContent).trim()).map(b => b.outerHTML.slice(0, 80)));
    expect(unnamed, id).toEqual([]);
  }
});

test.describe('390px debuggers', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const [lesson, widget, inspector, gutter] of [['loop', 'debugger', '.debugger-inspector', '[data-bp]'], ['runtime', 'rtdebugger', '.rt-inspector', '.rt-bp']]) {
    test(`${widget}: Step sits next to the panel it changes and gutter targets are 44px`, async ({ page }) => {
      await setTheme(page, 'dark');
      await page.goto(`/agentware/course/#${lesson}`);
      await mounted(page, lesson, widget);
      const root = page.locator(`#${lesson} [data-widget="${widget}"]`);
      const step = root.getByRole('button', { name: 'Step', exact: true });
      await step.click();
      const gap = await page.evaluate(([w, sel]) => {
        const root = document.querySelector(`[data-widget="${w}"]`);
        const step = [...root.querySelectorAll('button')].find(b => b.textContent === 'Step');
        return root.querySelector(sel).getBoundingClientRect().top - step.getBoundingClientRect().bottom;
      }, [widget, inspector]);
      expect(gap, `Step to panel: ${gap}px`).toBeLessThan(200);
      await root.locator(inspector).evaluate(el => el.scrollIntoView({ block: 'end' }));
      await expect(step).toBeInViewport();
      for (const box of await root.locator(gutter).evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => [r.width, r.height]))) {
        expect(Math.min(...box), `gutter target ${box}`).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

for (const [name, url] of [['a hashless load', '/agentware/course/'], ['an unknown hash', '/agentware/course/#no-such-lesson']]) {
  test(`${name} shows the first lesson, marks it current and sets its hash`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await expect(page.locator('.lesson:visible')).toHaveCount(1);
    await expect(page.locator('.lesson:visible h1')).toHaveText('Basics');
    await expect(page.locator('[data-lesson-link="basics"]')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#basics');
    expect(errors).toEqual([]);
  });
}

test('wide gaps code shows a scroll affordance at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/agentware/course/#gaps');
  await mounted(page, 'gaps', 'gaps');
  const details = page.locator('#gaps .gaps-repro');
  if (await details.count()) await details.first().locator('summary').click();
  const style = await page.locator('#gaps .gaps-code pre').first().evaluate(el => ({ image: getComputedStyle(el).backgroundImage, attachment: getComputedStyle(el).backgroundAttachment }));
  expect(style.image).toContain('gradient');
  expect(style.attachment).toContain('local');
});
