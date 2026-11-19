// Project Check Brain — Stage 1 Brain Completion Batch, Phase 2 integration
// tests (BRAIN-0011 to BRAIN-0013).
//
// Proves, in the real running application, that the three migrated
// stage1MissingInfo() rules (level='No', buildingPositionStatus,
// siteBoundaryStatus) are unchanged now that they delegate to their
// vendored Brain rules (brain/stage-1/missing-info-level-no.js,
// missing-info-building-position.js, missing-info-site-boundary.js) —
// rendered under "Assumptions / information not yet established", not the
// "preliminary flags" report cards runStage1Risks() feeds.
//
// Not Brain regression tests (those live in Project-Check-Brain's own
// tests/stage-1/missing-info-*.test.js) — this proves the real report a
// customer sees still shows the same missing-information text.
//
// See BRAIN-MIGRATION-REGISTER.md rows BRAIN-0011 through BRAIN-0013 in
// Project-Check-Brain and brain/BRAIN-VERSION in this repository.
const { test, expect } = require('@playwright/test');
const { STAGE1_ANSWERS, signUpAndReachDashboard, createLegacyAssessmentProject, completeStage1 } = require('./helpers');

const MISSING_LEVEL_TEXT = 'Site level/gradient: recorded as "No" (not level) — treat as unconfirmed.';
const MISSING_BUILDING_POSITION_TEXT = 'Building position not yet confirmed on a site map.';
const MISSING_SITE_BOUNDARY_TEXT = 'Site boundary not yet confirmed on a site map.';

test('default fixture (both maps skipped) shows both the building-position and site-boundary missing-info flags (BRAIN-0012, BRAIN-0013)', async ({ page }) => {
  const email = `brain-batch-missing-default-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch Missing Info Default');
  // completeStage1()'s default path skips both maps — real producer code,
  // untouched by this migration.
  await completeStage1(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const assumptionsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Assumptions / information not yet established' }) });
  await expect(assumptionsCard.locator('.risk', { hasText: MISSING_BUILDING_POSITION_TEXT })).toBeVisible();
  await expect(assumptionsCard.locator('.risk', { hasText: MISSING_SITE_BOUNDARY_TEXT })).toBeVisible();
});

// SKIPPED 2026-11-14: this Stage 1 question was removed, so the answer can no longer be entered through the UI. The Brain rule itself is unchanged.
test.skip('level="No" shows the exact original level missing-info text (BRAIN-0011)', async ({ page }) => {
  const email = `brain-batch-missing-level-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Batch Missing Info Level');
  const answers = [...STAGE1_ANSWERS];
  answers[7] = 'No'; // 'level' question (index recomputed 2026-09-02, Stage 1 Question Reduction)
  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const assumptionsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Assumptions / information not yet established' }) });
  await expect(assumptionsCard.locator('.risk', { hasText: MISSING_LEVEL_TEXT })).toBeVisible();
});
