import { test, expect } from '@playwright/test';

// The lesson 10 "Reproduce it" block is driven by gaps.json: it shows exactly
// the repro entries in the data, and no block at all when the data has none.
// The data is served through a route so each case controls it; the URL works
// with both hash routing (#gaps) and per-lesson URLs.
const gaps = [{ area: 'Tool result text', sev: 'low', wire: 'Raw result, matched by id', aw: 'A prefixed string', effect: 'Adds a prefix.' }];
const entries = [
  { label: 'First reproduction', code: 'first_call()\nsecond_line()', output: "'first output'" },
  { label: 'Second reproduction', code: 'other_call()', output: "'second output'" },
];

const open = async (page, data) => {
  await page.route('**/agentware/course/data/gaps.json', route => route.fulfill({ json: data }));
  await page.goto('/agentware/course/#gaps');
  const widget = page.locator('[data-widget="gaps"]:visible');
  await expect(widget.locator('.gaps-card')).toHaveCount(gaps.length);
  return widget;
};

for (const theme of ['light', 'dark']) {
  test(`repro block shows exactly the data's entries in ${theme} mode`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('haikei-theme', value), theme);
    const widget = await open(page, { gaps, repro: { sdk_version: '9.9.9', entries } });
    const block = widget.locator('.gaps-repro');
    await expect(block).toHaveCount(1);
    await expect(block.locator('summary')).toHaveText('Reproduce it (Python SDK 9.9.9)');
    await block.locator('summary').click();
    await expect(block.locator('.gaps-file')).toHaveText(entries.map(e => e.label));
    const code = block.locator('.gaps-code code');
    await expect(code).toHaveCount(entries.length);
    await expect(code.nth(0)).toHaveText(">>> first_call()\n... second_line()\n'first output'");
    await expect(code.nth(1)).toHaveText(">>> other_call()\n'second output'");
    await expect(widget).not.toContainText(/qwen|think|MiniMax|get_formatter/i);
  });
}

for (const [name, data] of [
  ['no repro', { gaps }],
  ['repro without entries (legacy captured keys)', { gaps, repro: { qwen_parse_official: '[]', reason_thinking_tag: "'Calling tool.'", reason_think_tag: "'Calling tool.'", minimax_family: 'generic', sdk_version: '0.18.0' } }],
]) {
  test(`no repro block with ${name}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const widget = await open(page, data);
    await expect(widget.locator('.gaps-repro')).toHaveCount(0);
    await expect(widget).not.toContainText('Reproduce it');
    expect(errors).toEqual([]);
  });
}

test('repro entries do not scroll the page at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const wide = { label: 'Wide', code: `call(${'"x", '.repeat(40)})`, output: "'y'" };
  const widget = await open(page, { gaps, repro: { sdk_version: '9.9.9', entries: [wide] } });
  await widget.locator('.gaps-repro summary').click();
  await expect(widget.locator('.gaps-code pre')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
