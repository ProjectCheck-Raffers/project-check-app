// Project Check Brain — Migration Slice 3 integration test.
//
// Proves, in the real running application (not just the Brain repository's
// own unit tests), that the Stage 1 compressed-programme risk is unchanged
// now that app.js's runStage1Risks() has been replaced with a thin call to
// the vendored Brain rule (pcBrainCompressedProgrammeRisk(),
// brain/stage-1/compressed-programme-risk.js).
//
// Not a Brain regression test (those live in Project-Check-Brain's own
// tests/stage-1/compressed-programme-risk.test.js) — this proves the real
// Stage 1 report a customer actually sees still shows the same text, in the
// same place, under the same discipline heading, for the same trigger.
//
// See BRAIN-MIGRATION-REGISTER.md row BRAIN-0003 in Project-Check-Brain and
// brain/BRAIN-VERSION in this repository.
const { test, expect } = require('@playwright/test');
const { STAGE1_ANSWERS, signUpAndReachDashboard, createLegacyAssessmentProject, completeStage1 } = require('./helpers');

const PROGRAMME_RISK_TEXT = 'The requested programme is compressed relative to the approvals, design, civils, manufacture and installation stages that may still be required.';

// SKIPPED 2026-11-14: the programme/services Stage 1 questions were removed, so these answers can no longer be entered through the UI. The Brain rule itself is unchanged.
test.skip('programme="0–3 months" still shows the exact original risk under Other preliminary flags (Migration Slice 3)', async ({ page }) => {
  const email = `brain-slice3-compressed-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 3 Compressed Programme');

  const answers = [...STAGE1_ANSWERS];
  answers[10] = '0–3 months'; // 'programme' question (index recomputed 2026-09-02, Stage 1 Question Reduction — was 16)

  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const otherFlagsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Other preliminary flags' }) });
  await expect(otherFlagsCard.locator('.risk', { hasText: PROGRAMME_RISK_TEXT })).toBeVisible();
});

test.skip('programme="3–6 months" (default journey fixture) shows no compressed-programme risk (Migration Slice 3)', async ({ page }) => {
  const email = `brain-slice3-normal-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 3 Normal Programme');

  // STAGE1_ANSWERS[10] ('programme') is already '3–6 months' — the standard fixture.
  await completeStage1(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const otherFlagsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Other preliminary flags' }) });
  await expect(otherFlagsCard.locator('.risk', { hasText: PROGRAMME_RISK_TEXT })).toHaveCount(0);
});
