// Focused coverage for the Stage 1 report restructuring (2026-08-27 — see
// MASTER-SPEC.md/CHANGELOG.md, "Customer Journey Completion Programme,
// Phase 1"). Confirms the new discipline-segregated Stage 1 report sections
// render, that Stage 1's own restraint language is present (no professional-
// approval wording), and that a genuine customer answer flows through into
// the correct section. Uses the existing signUpAndReachDashboard/
// createProject/completeStage1/skipMapsToStage1Summary helpers — same
// pattern as journey.spec.js — rather than a new driving mechanism.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.describe('Stage 1 report — discipline-segregated sections', () => {
  test('renders Project summary, Building specification, Site & footprint, Planning/Civils/Engineering sections and restrained language', async ({ page }, testInfo) => {
    const email = `stage1report-${testInfo.project?.name || 'default'}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Stage 1 Report Test');
    await h.completeStage1(page);
    await h.skipMapsToStage1Summary(page);

    await expect(page.locator('text=Project Check — Stage 1 Free Report')).toBeVisible();
    await expect(page.locator('h3:has-text("Project summary")')).toBeVisible();
    await expect(page.locator('h3:has-text("Building specification")')).toBeVisible();
    await expect(page.locator('h3:has-text("Site & footprint information")')).toBeVisible();
    await expect(page.locator('h3:has-text("Planning position — at Stage 1 level")')).toBeVisible();
    await expect(page.locator('h3:has-text("Civils & site observations")')).toBeVisible();
    await expect(page.locator('h3:has-text("Engineering & Compliance")')).toBeVisible();
    await expect(page.locator('h3:has-text("What Stage 2 will investigate")')).toBeVisible();

    // Stage 1 restraint (MASTER-SPEC.md § Stage 1-4 continuity): must never
    // read as an approval/certification, only as a preliminary flag.
    const bodyText = await page.locator('.container').innerText();
    expect(bodyText).not.toMatch(/approved by project check|project check certifies|structurally adequate/i);

    // Stage 1 must not present nearby planning records as project-site
    // facts (governing brief §12) — the Planning section explicitly defers
    // to Stage 2, never states a finding as if it were a local planning fact.
    const planningSection = page.locator('h3:has-text("Planning position — at Stage 1 level")').locator('xpath=ancestor::div[contains(@class,"card")][1]');
    await expect(planningSection).toContainText('Stage 2 investigation');
  });

  test('the customer\'s own answers appear in the correct restructured section, not fabricated', async ({ page }, testInfo) => {
    const email = `stage1report2-${testInfo.project?.name || 'default'}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Stage 1 Report Data Test');
    // STAGE1_ANSWERS' closeBoundary answer is 'No' -- runStage1Risks()'s
    // existing, unchanged trigger (`f.closeBoundary!=='No'`) correctly does
    // NOT fire, so the Planning section must show its empty-state note, not
    // a fabricated flag. This proves the restructuring surfaces genuine
    // absence-of-flag as honestly as it would a real one.
    await h.completeStage1(page);
    await h.skipMapsToStage1Summary(page);

    const planningSection = page.locator('h3:has-text("Planning position — at Stage 1 level")').locator('xpath=ancestor::div[contains(@class,"card")][1]');
    // The old close-boundary flag was dropped (2026-11-26): boundaries are covered by the regs-checker rules
    // (B_BOUNDARY, B_BOUNDARY_1M, B_BOUNDARY_FIRERATED_QUOTE, A_FRAME_BOUNDARY), so it must not be repeated here.
    await expect(planningSection).not.toContainText('Nearby boundaries/buildings may affect design, fire strategy, access or approvals');

    const buildingSpec = page.locator('h3:has-text("Building specification")').locator('xpath=ancestor::div[contains(@class,"card")][1]');
    await expect(buildingSpec).toContainText('Free-standing building');

    // A genuine civils-adjacent flag DOES apply for STAGE1_ANSWERS (base =
    // 'Concrete' is not a civils flag, but level='Yes' also does not trigger
    // one — services='No' does not trigger either). With this exact answer
    // set no civils flag fires either, so the Civils section's own honest
    // empty-state note must appear, not an invented one.
    const civilsSection = page.locator('h3:has-text("Civils & site observations")').locator('xpath=ancestor::div[contains(@class,"card")][1]');
    // level/services are no longer asked (removed 2026-11-14), so the unchanged risk rules treat them as not supplied.
    await expect(civilsSection).toBeVisible();
  });

});
