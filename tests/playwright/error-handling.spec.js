// Graceful-failure behaviour (Section O). The app must degrade safely rather
// than crash the whole customer journey, execute unsafe content, or leave the
// customer silently blocked.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('malformed localStorage does not crash the app on load', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('projectcheck_master_v1', '{not valid json!!');
  });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto('/', { waitUntil: 'load' });
  // The approved Figma homepage renders its headline in this component.
  await expect(page.locator('.home-hero-statement')).toBeVisible({ timeout: 10000 });
  await page.locator('.home-figma-hero').getByRole('button',{name:'See pricing',exact:true}).click();
  // Pricing load-confirmation text updated 2026-09-10 (Guided Route
  // Pricing Page rebuild): the old "Business & pricing" eyebrow no longer
  // exists on this page — the new page's own locked heading is used
  // instead.
  await expect(page.getByRole('heading',{name:/Start with the project\.\s*Decide the support later\./})).toBeVisible();
  expect(consoleErrors, 'recovering from malformed localStorage produced console errors').toEqual([]);
});

test('localStorage holding a JSON array (wrong shape) does not crash the app', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('projectcheck_master_v1', '[1,2,3]');
  });
  await page.goto('/', { waitUntil: 'load' });
  // The approved Figma homepage renders its headline in this component.
  await expect(page.locator('.home-hero-statement')).toBeVisible({ timeout: 10000 });
});

test('a project record with missing/invalid fields does not crash the dashboard', async ({ page }) => {
  const email = `errhandling-${Date.now()}@test.com`;
  await page.addInitScript((email) => {
    localStorage.setItem('projectcheck_master_v1', JSON.stringify({
      user: { id: 'u1', email },
      users: [{ id: 'u1', email, salt: 'x', passHash: 'y' }],
      projects: [{ id: 'p1', owner: 'u1', name: null, address: undefined, stage: 'Stage 1', facts: {}, downloads: { s1: 0, s2: 0 }, history: [], evidence: [], quotes: [], risks1: [], actions1: [] }],
    }));
  }, email);
  await page.goto('/#dashboard', { waitUntil: 'load' });
  await expect(page.locator('h1', { hasText: 'My Projects' })).toBeVisible({ timeout: 10000 });
});

test('a failed report-reference-image fetch does not block PDF download', async ({ page }) => {
  // Simulate the reference image being unreachable (404) — downloadReport()
  // must still generate and offer the rest of the report/PDF.
  await page.route('**/assets/project-check-building-reports.png', route => route.fulfill({ status: 404, body: 'not found' }));
  const email = `imgfail-${Date.now()}@test.com`;
  await h.signUpAndReachDashboard(page, email);
  await h.createLegacyAssessmentProject(page, 'Image Failure Test');
  await h.completeStage1(page);
  await h.skipMapsToStage1Summary(page);
  await expect(page.locator('text=Stage 1 Free Report')).toBeVisible();
  // the on-screen reference card should not show a broken-image element blocking anything;
  // the report body and download control must still be usable regardless.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('text=Download Stage 1 PDF'),
  ]);
  expect(download.suggestedFilename()).toContain('Stage-1');
});

test('an unreachable geocoding request fails gracefully, not silently stuck', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/**', route => route.abort('failed'));
  const email = `geofail-${Date.now()}@test.com`;
  await h.signUpAndReachDashboard(page, email);
  await h.createLegacyAssessmentProject(page, 'Geocode Failure Test');
  // Land ON Map 1 itself (not the report) — 17-question workflow (2026-08-27):
  // completeStage1() now drives the full flow including both maps, so this
  // test drives only the first block directly instead, to interact with
  // Map 1's own address search. Split points recomputed 2026-09-02 (Stage
  // 1 Question Reduction, 17 -> 12, 2026-09-01 — see MASTER-SPEC.md/
  // CHANGELOG.md): were (0,12)/(12,15), now (0,7)/(7,10) — personnelDoors
  // (the question before Map 1) moved from old index 11 to new index 6,
  // and base/level/services (between the two maps) from old 12-14 to new
  // 7-9. This file's own copy of these split points was missed when that
  // reduction first happened (only caught now, verifying an unrelated
  // task, by this test genuinely failing) — same class of hardcoded-
  // array-position issue as the ones already fixed in app.js/other
  // spec files for that task.
  await h.openLegacyStage1(page);
  await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
  await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
  await page.fill('#buildingAddressSearch', '1 Somewhere, Nowhere');
  await page.click('text=Search address');
  await expect(page.locator('#buildingSearchStatus')).toContainText(/could not connect|not found/i, { timeout: 10000 });
  // the customer must still be able to proceed without a working geocoder
  const skipBtn = page.getByRole('button', { name: 'Continue without pinpointing on the map', exact: true });
  await skipBtn.scrollIntoViewIfNeeded();
  await skipBtn.click();
  // base/level/services now sit between Map 1 and Map 2 — answer them to
  // reach Map 2.
  await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);
  await expect(page.locator('h2', { hasText: 'Show the relevant site boundary' })).toBeVisible({ timeout: 10000 });
});
