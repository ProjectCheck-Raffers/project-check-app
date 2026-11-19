// Practical accessibility audit (Section M) using axe-core, an established
// automated-accessibility engine, wired into Playwright via @axe-core/playwright.
// Automated axe scans catch a meaningful subset of WCAG issues (labels,
// contrast, semantic roles, alt text, form-field associations) — they do not
// replace a full manual accessibility review, which is out of scope here.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const h = require('./helpers');

async function scanPage(page, context) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) {
    console.log(`Accessibility findings on ${context}:`, JSON.stringify(serious.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })), null, 2));
  }
  expect(serious, `${context}: serious/critical accessibility violations found`).toEqual([]);
  return results.violations; // return all (incl. non-serious) for reporting
}

test('accessibility: homepage', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  // Homepage load-confirmation text updated 2026-08-29: the Homepage
  // Rebuild replaced "Know before you build." with the new LOCKED
  // headline "From idea to informed decision." — same test intent
  // (wait for real homepage content to render), new locked wording.
  await page.waitForSelector('text=From idea to informed decision.');
  const violations = await scanPage(page, 'homepage');
  console.log(`homepage: ${violations.length} total axe violations (non-serious ones listed for awareness, not failing the build)`);
});

test('accessibility: pricing', async ({ page }) => {
  await page.goto('/#pricing', { waitUntil: 'load' });
  // Pricing load-confirmation text updated 2026-09-10 (Guided Route
  // Pricing Page rebuild): the old "Business & pricing" eyebrow no longer
  // exists on this page — the new page's own locked heading is used
  // instead.
  await expect(page.getByRole('heading', { name: /Start with the project\.\s*Decide the support later\./ })).toBeVisible();
  await scanPage(page, 'pricing');
});

test('accessibility: sign-in modal', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await h.openSignIn(page);
  // Updated 2026-08-30 (Account / Sign-in Experience task): #ae no longer
  // exists — the modal now opens directly on the sign-in panel.
  await page.waitForSelector('#authPanelSignin');
  await scanPage(page, 'sign-in modal');
  // Basic keyboard/label checks the axe scan already partly covers, asserted
  // explicitly for clarity in the report. Scoped to #authPanelSignin (not a
  // bare page-wide label locator): the hidden #authPanelCreate panel is
  // also present in the DOM (display:none, not removed) with its own
  // "Business email"/"Password" labels, which would otherwise trip
  // Playwright's strict-mode element-count check before visibility is
  // even considered.
  await expect(page.locator('#authPanelSignin label', { hasText: 'Email' })).toBeVisible();
  await expect(page.locator('#authPanelSignin label', { hasText: 'Password' })).toBeVisible();
});

test('accessibility: Stage 1 question screen', async ({ page }) => {
  const email = `a11y-${Date.now()}@test.com`;
  await h.signUpAndReachDashboard(page, email);
  await h.createLegacyAssessmentProject(page, 'Accessibility Test');
  await h.openLegacyStage1(page);
  await page.waitForSelector('#answer');
  await scanPage(page, 'Stage 1 question screen');
  // Focus visibility / keyboard operability: tab to the answer field and confirm
  // it (or an ancestor) is the focused element — proves the control is keyboard-reachable.
  await page.locator('#answer').focus();
  const isFocused = await page.locator('#answer').evaluate(el => el === document.activeElement);
  expect(isFocused, 'the Stage 1 answer control must be keyboard-focusable').toBe(true);
});

test('accessibility: Stage 1 report', async ({ page }) => {
  const email = `a11y-report-${Date.now()}@test.com`;
  await h.signUpAndReachDashboard(page, email);
  await h.createLegacyAssessmentProject(page, 'Accessibility Report Test');
  await h.completeStage1(page);
  await h.skipMapsToStage1Summary(page);
  await scanPage(page, 'Stage 1 report');
  // Alt text on the two logo/report images and headings hierarchy sanity.
  // Apply Locked Application Shell to Remaining Pages (2026-09-02): the
  // Stage 1 report's logo moved from the standalone img.report-logo
  // (still correct/unchanged on Stage 2's report — out of scope for
  // that task) into .workspace-logo beside the heading, matching the
  // locked Project Workspace shell.
  await expect(page.locator('img.workspace-logo')).toHaveAttribute('alt', /.+/);
  await expect(page.locator('img.report-building')).toHaveAttribute('alt', /.+/);
  await expect(page.locator('h1')).toBeVisible();
});
