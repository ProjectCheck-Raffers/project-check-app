// Project Check Brain — Stage 1 Brain Completion Batch, Phase 1 integration
// tests (BRAIN-0006 to BRAIN-0010).
//
// Proves, in the real running application, that the five remaining
// runStage1Risks() rules (siteBoundaryStatus, closeBoundary, level, and
// both base rules) are unchanged now that they delegate to their vendored
// Brain rules (brain/stage-1/site-boundary-status-risk.js,
// close-boundary-risk.js, level-risk.js, base-uncertain-risk.js,
// base-surface-risk.js).
//
// Not Brain regression tests (those live in Project-Check-Brain's own
// tests/stage-1/*.test.js) — this proves the real Stage 1 report a
// customer actually sees still shows the same text, under the same
// discipline heading, for the same trigger.
//
// See BRAIN-MIGRATION-REGISTER.md rows BRAIN-0006 through BRAIN-0010 in
// Project-Check-Brain and brain/BRAIN-VERSION in this repository.
const { test, expect } = require('@playwright/test');
const { STAGE1_ANSWERS, signUpAndReachDashboard, createLegacyAssessmentProject, completeStage1 } = require('./helpers');

const SITE_BOUNDARY_RISK_TEXT = 'The relevant site boundary has not yet been confirmed on a site map, so boundary-related constraints are not yet confirmed.';
const CLOSE_BOUNDARY_RISK_TEXT = 'Nearby boundaries/buildings may affect design, fire strategy, access or approvals.';
const LEVEL_RISK_TEXT = 'Levels may affect base design, drainage, thresholds and installation.';
const BASE_UNCERTAIN_RISK_TEXT = 'Existing surface/base information is incomplete, so foundation and slab suitability cannot yet be relied upon.';
const BASE_SURFACE_RISK_TEXT = 'The visible surface does not by itself confirm a suitable structural foundation or slab.';

test('skipping the site boundary map (default fixture) still shows the exact original risk under Other preliminary flags (BRAIN-0006)', async ({ page }) => {
  const email = `brain-batch-siteboundary-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch Site Boundary Skipped');
  // completeStage1()'s default path clicks "Continue without drawing the
  // boundary" — real producer code (saveBoundary()/skipSiteBoundary()),
  // untouched by this migration.
  await completeStage1(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const otherFlagsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Other preliminary flags' }) });
  await expect(otherFlagsCard.locator('.risk', { hasText: SITE_BOUNDARY_RISK_TEXT })).toBeVisible();
});

// SKIPPED 2026-11-14: this Stage 1 question was removed, so the answer can no longer be entered through the UI. The Brain rule itself is unchanged.
test.skip('closeBoundary="Yes" still shows the exact original risk under Planning position (BRAIN-0007)', async ({ page }) => {
  const email = `brain-batch-closeboundary-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch Close Boundary Yes');
  const answers = [...STAGE1_ANSWERS];
  answers[9] = 'Yes'; // 'closeBoundary' question (index recomputed 2026-09-02, Stage 1 Question Reduction)
  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const planningCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Planning position' }) });
  await expect(planningCard.locator('.risk', { hasText: CLOSE_BOUNDARY_RISK_TEXT })).toBeVisible();
});

// SKIPPED 2026-11-14: this Stage 1 question was removed, so the answer can no longer be entered through the UI. The Brain rule itself is unchanged.
test.skip('level="Not sure" still shows the exact original risk under Civils & site observations (BRAIN-0008)', async ({ page }) => {
  const email = `brain-batch-level-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch Level Not Sure');
  const answers = [...STAGE1_ANSWERS];
  answers[7] = 'Not sure'; // 'level' question (index recomputed 2026-09-02, Stage 1 Question Reduction)
  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const civilsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Civils & site observations' }) });
  await expect(civilsCard.locator('.risk', { hasText: LEVEL_RISK_TEXT })).toBeVisible();
});

test('base="Not sure" still shows the exact original uncertain-surface risk (BRAIN-0009)', async ({ page }) => {
  const email = `brain-batch-baseuncertain-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch Base Not Sure');
  const answers = [...STAGE1_ANSWERS];
  answers[6] = 'Not sure'; // 'base' question (index recomputed 2026-09-02, Stage 1 Question Reduction)
  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const civilsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Civils & site observations' }) });
  await expect(civilsCard.locator('.risk', { hasText: BASE_UNCERTAIN_RISK_TEXT })).toBeVisible();
});

test('base="Tarmac / asphalt" still shows the exact original non-concrete-surface risk (BRAIN-0010)', async ({ page }) => {
  const email = `brain-batch-basesurface-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch Base Tarmac');
  const answers = [...STAGE1_ANSWERS];
  answers[6] = 'Tarmac / asphalt'; // 'base' question (index recomputed 2026-09-02, Stage 1 Question Reduction) — one of the 5 current trigger values
  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const civilsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Civils & site observations' }) });
  await expect(civilsCard.locator('.risk', { hasText: BASE_SURFACE_RISK_TEXT })).toBeVisible();
});

// SKIPPED 2026-11-14: this Stage 1 question was removed, so the answer can no longer be entered through the UI. The Brain rule itself is unchanged.
test.skip('default fixture (base="Concrete slab", level="Yes", closeBoundary="No") shows none of these five risks', async ({ page }) => {
  const email = `brain-batch-none-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch No Risks');
  // Standard STAGE1_ANSWERS fixture: base='Concrete slab', level='Yes',
  // closeBoundary='No' — none of BRAIN-0007/0008/0009/0010 should fire.
  await completeStage1(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const civilsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Civils & site observations' }) });
  await expect(civilsCard.locator('.risk', { hasText: LEVEL_RISK_TEXT })).toHaveCount(0);
  await expect(civilsCard.locator('.risk', { hasText: BASE_UNCERTAIN_RISK_TEXT })).toHaveCount(0);
  await expect(civilsCard.locator('.risk', { hasText: BASE_SURFACE_RISK_TEXT })).toHaveCount(0);

  const planningCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Planning position' }) });
  await expect(planningCard.locator('.risk', { hasText: CLOSE_BOUNDARY_RISK_TEXT })).toHaveCount(0);
});
