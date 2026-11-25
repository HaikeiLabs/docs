import { test, expect } from '@playwright/test';

// The runtime debugger highlights the current line. Every text on that line
// (code, line number, breakpoint marker) must stay readable (WCAG AA, 4.5:1)
// at every stop, in both themes.
const contrastOf = (page, selectors) => page.evaluate(selectors => {
  const parse = value => value.match(/[\d.]+/g).map(Number);
  const blend = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
  const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  return selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(el => {
    const ink = parse(getComputedStyle(el).color);
    const layers = []; for (let node = el; node; node = node.parentElement) layers.push(parse(getComputedStyle(node).backgroundColor));
    let bg = [255, 255, 255]; for (const layer of layers.reverse()) bg = blend(layer, bg);
    const values = [luminance(ink), luminance(bg)].sort((a, b) => b - a);
    return [selector, (values[0] + .05) / (values[1] + .05)];
  }));
}, selectors);

for (const theme of ['light', 'dark']) {
  test(`runtime debugger current line meets contrast at every stop in ${theme} mode`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('haikei-theme', value), theme);
    await page.goto('/agentware/course/#runtime');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const root = page.locator('#runtime [data-widget="rtdebugger"]');
    await expect(root.locator('.rt-line.rt-current')).toHaveCount(1);
    const stops = await root.locator('[data-go]').count();
    expect(stops).toBeGreaterThan(0);
    for (let i = 0; i < stops; i += 1) {
      await root.locator(`[data-go="${i}"]`).click();
      await expect(root.locator(`[data-go="${i}"]`)).toHaveAttribute('aria-current', 'step');
      const current = ['code', '.rt-number', '.rt-bp'].map(part => `#runtime .rt-line.rt-current ${part}`);
      const ratios = await contrastOf(page, current);
      expect(ratios.length, `stop ${i}`).toBeGreaterThanOrEqual(2);
      for (const [name, ratio] of ratios) expect(ratio, `stop ${i} ${name}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
