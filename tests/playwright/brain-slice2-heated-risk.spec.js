// Project Check Brain — Migration Slice 2 integration test.
//
// Proves, in the real running application (not just the Brain repository's
// own unit tests), that the Stage 1 heated-building risk is unchanged now
// that app.js's runStage1Risks() has been replaced with a thin call to the
// vendored Brain rule (pcBrainHeatedBuildingRisk(),
// brain/stage-1/heated-building-risk.js).
//
// Not a Brain regression test (those live in Project-Check-Brain's own
// tests/stage-1/heated-building-risk.test.js) — this proves the real Stage 1
// report a customer actually sees still shows the same text, in the same
// place, under the same discipline heading, for the same trigger.
//
// See BRAIN-MIGRATION-REGISTER.md row BRAIN-0002 in Project-Check-Brain and
// brain/BRAIN-VERSION in this repository.
const { test, expect } = require('@playwright/test');
const { STAGE1_ANSWERS, signUpAndReachDashboard, createLegacyAssessmentProject, completeStage1 } = require('./helpers');

const HEATED_RISK_TEXT = 'A heated building introduces thermal-performance and energy-compliance requirements that need to be coordinated with the building specification.';

test('heated="Yes" still shows the exact original risk under Engineering & Compliance (Migration Slice 2)', async ({ page }) => {
  const email = `brain-slice2-yes-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 2 Heated Yes');

  const answers = [...STAGE1_ANSWERS];
  answers[3] = 'Yes'; // 'heated' question (index recomputed 2026-09-02, Stage 1 Question Reduction — was 5)

  await completeStage1(page, answers);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const engineeringCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Engineering & Compliance' }) });
  await expect(engineeringCard.locator('.risk', { hasText: HEATED_RISK_TEXT })).toBeVisible();
});

test('heated="No" (default journey fixture) shows no heated-building risk (Migration Slice 2)', async ({ page }) => {
  const email = `brain-slice2-no-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 2 Heated No');

  // STAGE1_ANSWERS[3] ('heated') is already 'No' — the standard fixture.
  await completeStage1(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const engineeringCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Engineering & Compliance' }) });
  await expect(engineeringCard.locator('.risk', { hasText: HEATED_RISK_TEXT })).toHaveCount(0);
  await expect(engineeringCard).toContainText('No engineering/compliance flag was identified from the answers supplied.');
});
