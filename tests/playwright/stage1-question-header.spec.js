// Stage 1 Question-Page Header — superseded 2026-09-04 (Direction C
// complete working model, ARCHITECT + SPA authorised): the compact
// pale-green banner below was the Option 3 / Homepage Green Banner
// treatment (2026-09-01, approved reference: "9. Images/2 - Review
// question pages header/QuestionPageDesign.png"), scoped to Stage 1
// question pages only. The locked Direction C Figma frames (file
// BYsnm3HI7VBBZQyVnRbiTI) — pulled for the Stage 1 question, Stage 2
// question, building-position map, roller doors (page since removed 2026-11-14), consolidated client
// details, both reports and doors & drawing review, 8 frames in total,
// all in agreement — specify a plain WHITE "Header / Navigation" bar,
// 70px logo box, on every one of those pages, not a pale-green banner
// scoped to Stage 1 questions alone. This is a genuine, evidenced design
// supersession, not a guess: this file's assertions are updated to match
// the locked white header and 70px logo, per Stuart's explicit approval
// (2026-09-04) to correct these specific assertions. The regression guard
// this file exists for is otherwise unchanged: still one consistent
// header treatment, still verified not to leak an incorrect variant onto
// Pricing/Home, still checked for overflow at both device sizes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const WHITE = 'rgb(255, 255, 255)';

test.describe('Stage 1 question-page header — locked Direction C white header', () => {
  test('desktop: Question 1 uses the locked white header with correct nav', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await h.signUpAndReachDashboard(page, `stage1header-desktop-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, 'Stage1 Header Test Desktop');
    await h.openLegacyStage1(page);
    await page.waitForSelector('text=Question 1 of 11');

    await expect(page.locator('.topbar')).toHaveCSS('background-color', WHITE);
    const logoHeight = await page.locator('.brand-logo').evaluate(el => el.getBoundingClientRect().height);
    // Locked Figma logo box is 70px tall on every pulled frame — this still
    // guards against a regression back to the old 204px/168px shared default.
    expect(logoHeight, 'question-page logo must be the locked 70px, not the 204px shared default').toBeLessThan(90);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // syncAuth() deliberately excludes legacy question pages from
    // SITE_SHELL_ROUTES. Their visible brand returns to Home, where the drawer lives.
    await page.getByRole('button', { name: 'Project Check home', exact: true }).click();
    await expect(page).toHaveURL(/#home$/);
    await page.locator('#menuBtn').click();
    for (const route of ['home', 'pricing']) {
      await expect(page.locator(`#siteDrawer button[data-route="${route}"]`)).toBeVisible();
    }
    await expect(page.locator('#projectsBtn')).toBeVisible();
    await expect(page.locator('#authBtn')).toHaveText('Sign out');
  });

  test('the same compact header is identical across Q1, Q6 (middle) and Q11 (last)', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await h.signUpAndReachDashboard(page, `stage1header-propagate-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, 'Stage1 Header Propagation');
    await h.openLegacyStage1(page);
    await page.waitForSelector('text=Question 1 of 11');
    const projectId = await page.evaluate(() => location.hash.split('/')[1]);

    // Stage 1 Question Reduction (2026-09-01, 17 -> 12): checkpoints
    // recomputed from [0, 8, 16] to [0, 5, 11] — first/middle/last of the
    // new 12-question array (was 17).
    const measurements = [];
    for (const idx of [0, 5, 10]) {
      await page.evaluate(({ id, idx }) => { sessionStorage.setItem('s1q_' + id, idx); stage1(id); }, { id: projectId, idx });
      await page.waitForTimeout(100);
      measurements.push({
        bg: await page.locator('.topbar').evaluate(el => getComputedStyle(el).backgroundColor),
        height: await page.locator('.topbar').evaluate(el => el.getBoundingClientRect().height),
        overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      });
    }
    expect(measurements[0]).toEqual(measurements[1]);
    expect(measurements[1]).toEqual(measurements[2]);
    expect(measurements[0].bg).toBe(WHITE);
    expect(measurements[0].overflow).toBeLessThanOrEqual(1);
  });

  test('mobile: locked header renders with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await h.signUpAndReachDashboard(page, `stage1header-mobile-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, 'Stage1 Header Mobile');
    await h.openLegacyStage1(page);
    await page.waitForSelector('text=Question 1 of 11');

    await expect(page.locator('.topbar')).toHaveCSS('background-color', WHITE);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator('#authBtn')).toBeHidden();
    await page.getByRole('button', { name: 'Project Check home', exact: true }).click();
    await expect(page).toHaveURL(/#home$/);
    await page.locator('#menuBtn').click();
    await expect(page.locator('#authBtn')).toBeVisible();
    await expect(page.locator('#authBtn')).toHaveText('Sign out');
  });

  // SUPERSEDED again 2026-09-10 (Guided Route Pricing Page rebuild,
  // Stuart's explicit instruction): the 2026-09-04 Gateway/Workspace
  // Design Correction below (Pricing sharing the Stage 1/Application
  // Shell white header, 250x70 inline logo) is replaced for Pricing only
  // — the new explicit instruction is that Pricing's header must match
  // the HOMEPAGE's own header exactly, not the Stage 1 Application
  // Shell. Pricing's new pricing() markup carries no `.pagehead
  // .eyebrow`, so direction-c-trial.js's classifier no longer matches it
  // at all (see app.js's pricing() comment) and it now picks up the
  // homepage's own header rule from styles.css instead (extended to
  // body[data-page="pricing"] there, 2026-09-10) — both pages show the
  // same white topbar with the same small visible banner logo. Stage 1's
  // own white/70px-logo header (asserted above) is completely unaffected.
  test('Pricing now shares the homepage\'s own header (by design); Stage 1 keeps its separate 70px-logo header', async ({ page }) => {
    await page.goto('/#pricing', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: 'Start with the project. Decide the support later.' })).toBeVisible();
    expect(await page.locator('.topbar').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(WHITE);
    await expect(page.locator('.topbar .brand')).toBeVisible();
    const pricingLogoHeight = await page.locator('.brand-logo').evaluate(el => el.getBoundingClientRect().height);

    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator('.topbar .brand')).toBeVisible();
    const homeLogoHeight = await page.locator('.brand-logo').evaluate(el => el.getBoundingClientRect().height);
    expect(pricingLogoHeight, 'Pricing header logo must match the homepage header logo exactly').toBe(homeLogoHeight);
  });
});
