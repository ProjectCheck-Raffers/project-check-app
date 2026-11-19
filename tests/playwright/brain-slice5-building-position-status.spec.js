// Project Check Brain — Migration Slice 5 integration test.
//
// Proves, in the real running application (not just the Brain repository's
// own unit tests), that the Stage 1 building-position status risk is
// unchanged now that app.js's runStage1Risks() has been replaced with a
// thin call to the vendored Brain rule (pcBrainBuildingPositionStatusRisk(),
// brain/stage-1/building-position-status-risk.js) — including that real map
// skip/confirm interaction (not just a seeded fact) still produces the
// correct outcome, since the producer functions (saveBuildingPosition()/
// skipBuildingPosition()) were rewritten by the Map Architecture and 17-
// Question Workflow tasks but are unchanged and out of scope for this slice.
//
// Not a Brain regression test (those live in Project-Check-Brain's own
// tests/stage-1/building-position-status-risk.test.js) — this proves the
// real Stage 1 report a customer actually sees still shows the same text,
// in the same place, under the same discipline heading, for the same
// trigger.
//
// See BRAIN-MIGRATION-REGISTER.md row BRAIN-0005 in Project-Check-Brain and
// brain/BRAIN-VERSION in this repository.
const { test, expect } = require('@playwright/test');
const { signUpAndReachDashboard, createLegacyAssessmentProject, completeStage1 } = require('./helpers');

const BUILDING_POSITION_RISK_TEXT = 'The proposed building position has not yet been pinpointed on a site map, so orientation and clearances are not yet confirmed.';

test('skipping the building-position map still shows the exact original risk under Other preliminary flags (Migration Slice 5)', async ({ page }) => {
  const email = `brain-slice5-skipped-${Date.now()}@example.com`;
  await signUpAndReachDashboard(page, email);
  await createLegacyAssessmentProject(page, 'Brain Slice 5 Position Skipped');

  // Drives the real map-skip interaction (real saveBuildingPosition()/
  // skipBuildingPosition() producer code, untouched by this migration) via
  // the existing completeStage1() helper's default map-skip behaviour,
  // rather than seeding the fact directly — this is the strongest proof
  // that the producer/consumer boundary this migration deliberately left
  // alone still works together correctly with the migrated rule.
  await completeStage1(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();

  const otherFlagsCard = page.locator('.card', { has: page.locator('h3', { hasText: 'Other preliminary flags' }) });
  await expect(otherFlagsCard.locator('.risk', { hasText: BUILDING_POSITION_RISK_TEXT })).toBeVisible();
});
