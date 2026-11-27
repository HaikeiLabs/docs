import { test, expect } from '@playwright/test';

// The content-versioning line under the lesson line. The fixture build reads the
// fixture compat file (latest 0.3.0), so the behind-latest note is deterministic.
for (const theme of ['light', 'dark']) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => { await page.addInitScript(value => { if (!localStorage.getItem('haikei-theme')) localStorage.setItem('haikei-theme', value); }, theme); });

    test('a versioned lesson shows the date, the Agentware version, the change note and the behind note', async ({ page }) => {
      await page.goto('/agentware/course/runtime/');
      const lesson = page.locator('.lesson');
      await expect(lesson.locator('.course-version')).toHaveText('Updated 20 Nov 2026 · Agentware 0.2.0');
      await expect(lesson.locator('.course-version time')).toHaveAttribute('datetime', '2026-11-20');
      await expect(lesson.locator('.course-change-note')).toHaveText('What changed: Shows the policy step before the tool runs.');
      await expect(lesson.locator('.course-change-note strong')).toHaveText('policy');
      await expect(lesson.locator('.course-behind')).toHaveText('Written for Agentware 0.2.0. The current release is 0.3.0.');
    });

    test('a current lesson has no behind note, and a date-only lesson shows only the date', async ({ page }) => {
      await page.goto('/agentware/course/gaps/');
      await expect(page.locator('.lesson .course-version')).toHaveText('Updated 27 Nov 2026 · Agentware 0.3.0');
      await expect(page.locator('.lesson .course-behind')).toHaveCount(0);
      await page.goto('/agentware/course/basics/');
      await expect(page.locator('.lesson .course-version')).toHaveText('Updated 1 Nov 2026');
    });

    test('a lesson without the fields has no version line', async ({ page }) => {
      await page.goto('/agentware/course/steps/');
      await expect(page.locator('.lesson h1')).toHaveText('Steps');
      await expect(page.locator('.lesson :is(.course-version, .course-change-note, .course-behind)')).toHaveCount(0);
    });

    test('the hub shows the newest lesson date', async ({ page }) => {
      await page.goto('/agentware/course/');
      await expect(page.locator('.course-hub .eyebrow')).toContainText('Updated 27 Nov 2026');
      // The brand eyebrow is inline-flex: the date must stay inside one item, in reading order, at 390px too.
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.course-hub .eyebrow > *')).toHaveCount(1);
      await expect(page.locator('.course-hub .eyebrow')).toHaveText('Course · 6 lessons · 24 min · Updated 27 Nov 2026');
    });

    test('the version lines are readable and fit at 390px', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/agentware/course/runtime/');
      await expect(page.locator('.lesson .course-behind')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // Muted text on the page ground must still reach 4.5:1.
      const ratios = await page.evaluate(() => {
        const channel = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        const rgb = value => { const probe = document.createElement('canvas').getContext('2d'); probe.fillStyle = value; probe.fillRect(0, 0, 1, 1); return [...probe.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const background = el => { for (let node = el; node; node = node.parentElement) { const bg = getComputedStyle(node).backgroundColor; if (bg && !/rgba\(.*,\s*0\)$|transparent/.test(bg)) return bg; } return 'white'; };
        return [...document.querySelectorAll('.lesson :is(.course-version, .course-change-note, .course-behind)')].map(el => {
          const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(background(el)))];
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      });
      expect(ratios).toHaveLength(3);
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
}
