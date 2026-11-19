// Baseline provenance: 455c04b41951cd1f196492dae5bbaf8df55b7d53
// (2026-09-09, Implement approved Figma homepage) replaced the August
// DECIDE wording and removed strip descriptions. Assert that approved
// rendered frame exactly; do not restore superseded copy to satisfy tests.
const { test, expect } = require('@playwright/test');

const APPROVED_DECIDE_DETAIL = 'Bring local planning insight, Building Regulations requirements and drawing evidence together into clear actions.';
const SUPERSEDED_PHRASES = ['Compare options', 'Compare comparable options'];

test.describe('Content integrity — approved Figma DECIDE content', () => {
  test('approved Figma journey strip retains the DECIDE stage label and badge', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const decideStep = page.locator('.home-journey-overview .journey-step', { has: page.locator('.eyebrow', { hasText: 'Decide' }) });
    await expect(decideStep).toHaveCount(1);
    await expect(decideStep.locator('.eyebrow')).toHaveText('Decide');
    await expect(decideStep.locator('.pill')).toHaveText('Stage 3 · Solutions');
    await expect(decideStep.locator('.journey-desc')).toHaveCount(0);
  });

  test('approved Figma DECIDE card retains its exact solutions description', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const decideCard = page.locator('.stagecard', { has: page.locator('.eyebrow', { hasText: 'Decide' }) });
    await expect(decideCard.locator('.stagecard-body p')).toHaveText(APPROVED_DECIDE_DETAIL);
  });

  // Pricing DECIDE (£99) card test REMOVED 2026-09-10 (Guided Route
  // Pricing Page rebuild, Stuart's explicit instruction): Pricing is no
  // longer a set of four price cards (.price-card/DECIDE/£99) — it is a
  // step-by-step guided journey (see app.js's pricing()). The governed
  // "Comparable options" wording this file guards was never part of the
  // new page's copy, so there is nothing on Pricing left to assert here.
  // The homepage's own two DECIDE assertions above are untouched.

  test('neither superseded wording ("Compare options" / "Compare comparable options") appears on homepage or pricing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    let bodyText = await page.locator('body').innerText();
    for (const phrase of SUPERSEDED_PHRASES) expect(bodyText).not.toContain(phrase);
    await page.goto('/#pricing', { waitUntil: 'load' });
    // Pricing load-confirmation text updated 2026-09-10 (Guided Route
    // Pricing Page rebuild) — see the DECIDE-card note above.
    await expect(page.getByRole('heading',{name:/Start with the project\.\s*Decide the support later\./})).toBeVisible();
    bodyText = await page.locator('body').innerText();
    for (const phrase of SUPERSEDED_PHRASES) expect(bodyText).not.toContain(phrase);
  });
});
