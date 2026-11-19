// Copy follows the approved baseline homepage; layout assertions stay strict.
// Homepage Figma implementation regression checks — approved frame 2:2.
const { test, expect } = require('@playwright/test');

test.describe('Homepage Figma structure, assets and responsive behaviour', () => {
  for (const [label, width, height] of [['desktop', 1536, 1000], ['mobile', 390, 844]]) {
    test(`${label}: header, hero, calls to action and page width match the approved structure`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/', { waitUntil: 'load' });
      const topbarBg = await page.locator('.topbar').evaluate(el => getComputedStyle(el).backgroundColor);
      expect(topbarBg).toBe('rgb(255, 255, 255)');
      await expect(page.locator('.topbar .brand-logo')).toHaveAttribute('src', /project-check-banner-logo\.png$/);
      await expect(page.locator('.home-figma-hero-logo')).toHaveAttribute('src', /project-check-logo\.png$/);
      await expect(page.locator('.home-hero-statement')).toHaveText('Understand the risks, requirements and missing information before you commit to your industrial building project.');
      const buttons = page.locator('.home-figma-hero .home-action');
      await expect(buttons).toHaveCount(2);
      await expect(buttons.nth(0)).toHaveText(/Start a project/);
      await expect(buttons.nth(1)).toHaveText(/See pricing/);
      const first = await buttons.nth(0).boundingBox();
      const second = await buttons.nth(1).boundingBox();
      expect(first.width).toBe(second.width);
      expect(first.height).toBe(second.height);
      await expect(page.locator('.home-building-card img')).toHaveAttribute('src', /project-check-building-homepage\.png$/);
      await expect(page.locator('.home-info-card')).toContainText('Need more space for your business?');
      await expect(page.locator('.home-info-card')).toContainText('Project Check helps you understand what your project needs before you commit.');
      await expect(page.locator('.home-journey-overview .journey-step')).toHaveCount(4);
      await expect(page.locator('.home-how .stagecard')).toHaveCount(4);
      await expect(page.locator('.home-closing')).toContainText('Know before you build.');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('hero scrolls away while the compact white header remains sticky', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => window.scrollTo(0, 1800));
    await page.waitForTimeout(100);
    const heroBox = await page.locator('.home-figma-hero').boundingBox();
    expect(heroBox === null || heroBox.y + heroBox.height < 0).toBe(true);
    const topbarBox = await page.locator('.topbar').boundingBox();
    expect(topbarBox.y).toBe(0);
  });

  // SUPERSEDED 2026-09-10 (Guided Route Pricing Page rebuild, Stuart's
  // explicit instruction): Pricing no longer shares the Application
  // Shell/Direction C header — it now shares the Homepage's own header
  // exactly, per the same instruction implemented in app.js's pricing()
  // and styles.css (body[data-page="pricing"] added to every homepage
  // header rule, 2026-09-10). The assertions below are unchanged in
  // substance (white topbar, visible banner-logo image) — only the
  // load-confirmation selector and test name reflect the new page.
  test('Pricing shares the homepage\'s own header', async ({ page }) => {
    await page.goto('/#pricing', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: /Start with the project\.\s*Decide the support later\./ })).toBeVisible();
    const topbarBg = await page.locator('.topbar').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(topbarBg).toBe('rgb(255, 255, 255)');
    await expect(page.locator('.topbar .brand')).toBeVisible();
    await expect(page.locator('.topbar .brand-logo')).toHaveAttribute('src', /project-check-banner-logo\.png$/);
  });
});
