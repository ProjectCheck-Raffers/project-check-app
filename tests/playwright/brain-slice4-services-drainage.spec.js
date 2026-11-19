// Project Check Brain — Migration Slice 4 integration test.
//
// Proves, in the real running application (not just the Brain repository's
// own unit tests), that the Stage 1 services/drainage risk is unchanged now
// that app.js's runStage1Risks() has been replaced with a thin call to the
// vendored Brain rule (pcBrainServicesDrainageRisk(),
// brain/stage-1/services-drainage-risk.js).
//
// Not a Brain regression test (those live in Project-Check-Brain's own
// tests/stage-1/services-drainage-risk.test.js) — this proves the real
// Stage 1 report a customer actually sees still shows the same text, in the
// same place, under the same discipline heading, for the same trigger —
// including the deliberately-preserved inequality behaviour where an unset
// 'services' answer still triggers the risk.
//
// See BRAIN-MIGRATION-REGISTER.md row BRAIN-0004 in Project-Check-Brain and
// brain/BRAIN-VERSION in this repository.
const { test, expect } = require('@playwright/test');
const { STAGE1_ANSWERS, signUpAndReachDashboard, createLegacyAssessmentProject, completeStage1 } = require('./helpers');

const SERVICES_RISK_TEXT = 'Services or drainage within the footprint may affect the building position, foundations or programme.';

// SKIPPED 2026-11-14: the programme/services Stage 1 questions were removed, so these answers can no longer be entered through the UI. The Brain rule itself is unchanged.
test.skip('services="Yes" still shows the exact original risk under Civils & site observations (Migration Slice 4)', async ({ page }) => {
  const email = `brain-slice4-yes-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 4 Services Yes');

  const answers = [...STAGE1_ANSWERS];
  answers[8] = 'Yes'; // 'services' question (index recomputed 2026-09-02, Stage 1 Question Reduction — was 14)

  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const civilsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Civils & site observations' }) });
  await expect(civilsCard.locator('.risk', { hasText: SERVICES_RISK_TEXT })).toBeVisible();
});

test.skip('services="Not sure" still shows the exact original risk (Migration Slice 4)', async ({ page }) => {
  const email = `brain-slice4-notsure-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 4 Services Not Sure');

  const answers = [...STAGE1_ANSWERS];
  answers[8] = 'Not sure'; // 'services' question (index recomputed 2026-09-02, Stage 1 Question Reduction — was 14)

  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const civilsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Civils & site observations' }) });
  await expect(civilsCard.locator('.risk', { hasText: SERVICES_RISK_TEXT })).toBeVisible();
});

test.skip('services="No" (default journey fixture) shows no services/drainage risk (Migration Slice 4)', async ({ page }) => {
  const email = `brain-slice4-no-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 4 Services No');

  // STAGE1_ANSWERS[8] ('services') is already 'No' — the standard fixture.
  await completeStage1(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const civilsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Civils & site observations' }) });
  await expect(civilsCard.locator('.risk', { hasText: SERVICES_RISK_TEXT })).toHaveCount(0);
});
