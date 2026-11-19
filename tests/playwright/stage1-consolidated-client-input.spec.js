// Consolidated Client Input Page (2026-09-02 — see MASTER-SPEC.md/
// CHANGELOG.md § "Consolidated Client Input Page" for the full design
// record). After the Stage 1 Question Reduction (17 -> 12, 2026-09-01)
// retired name/role/width/length/height from the sequential customer-
// facing array, this ONE page — reached automatically after Q12, before
// Stage 1 finalises — collects those exact same five facts. It is
// deliberately NOT a 13th sequential question: no "Question X of Y"
// counter, no left question navigator, no progress-bar entry. It writes
// into the exact same p.facts.name/role/width/length/height keys the
// original sequential questions used — no duplicate keys, no second
// storage location, no invented defaults.
//
// What this does NOT re-test: the 12-question sequence itself (covered
// by stage1-question-reduction.spec.js), the locked visual header
// (stage1-question-header.spec.js), or the underlying geometry/drawing
// engine's own correctness (geometry-audit.spec.js). This spec is
// specifically about the consolidated page's own behaviour and its
// proof that width/length/height reach the SAME existing geometry
// pipeline, not a second one.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function reachConsolidatedPage(page) {
  await h.signUpAndReachDashboard(page, `s1consolidated-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`);
  await h.createLegacyAssessmentProject(page, `Consolidated Test ${Date.now()}`);
  await h.openLegacyStage1(page);
  await page.waitForSelector('#answer');
  await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
  await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
  await page.click('text=Continue without pinpointing on the map');
  await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 9);
  await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
  await page.click('text=Continue without drawing the boundary');
  await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 9, 11);
  await page.waitForSelector('#ciName');
  return await page.evaluate(() => location.hash.split('/')[1]);
}

test.describe('Consolidated Client Input Page', () => {
  test('appears only after Q12, is not presented as Question 13', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await reachConsolidatedPage(page);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Question 13');
    expect(bodyText).not.toMatch(/of 13/);
    await expect(page.locator('.steps')).toHaveCount(0);
    await expect(page.locator('.progressbar')).toHaveCount(0);
    await expect(page.locator('#ciName')).toBeVisible();
    await expect(page.locator('#ciRole')).toBeVisible();
    await expect(page.locator('#ciWidth')).toBeVisible();
    await expect(page.locator('#ciLength')).toBeVisible();
    await expect(page.locator('#ciHeight')).toBeVisible();
  });

  test('requires all five fields before continuing (no invented defaults)', async ({ page }) => {
    await reachConsolidatedPage(page);
    // acceptAllDialogs() (attached inside createProject(), called by
    // reachConsolidatedPage() above) already dismisses any unexpected
    // alert() automatically — no separate handler needed here, and
    // registering a second one races with it and errors.
    await page.click('text=Save & continue');
    // Blocked — still on the same page, not advanced to the report.
    await expect(page.locator('#ciName')).toBeVisible();
    await expect(page.locator('text=Stage 1 Free Report')).toHaveCount(0);
  });

  test('Back returns to Q7 (base), not a stray question', async ({ page }) => {
    await reachConsolidatedPage(page);
    await page.click('text=Back');
    await expect(page.locator('.eyebrow')).toContainText('Question 7 of 7');
  });

  test('all five values save under the exact existing fact keys — no duplicate keys/storage', async ({ page }) => {
    const projectId = await reachConsolidatedPage(page);
    await page.fill('#ciName', 'Consolidated Tester');
    await page.selectOption('#ciRole', 'Property / estates');
    await page.fill('#ciWidth', '18');
    await page.fill('#ciLength', '32');
    await page.fill('#ciHeight', '5.5');
    await page.click('text=Save & continue');
    await page.waitForSelector('text=Stage 1 Free Report', { timeout: 15000 });

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('projectcheck_master_v1')));
    const proj = state.projects.find(p => p.id === projectId);
    expect(proj.facts.name).toBe('Consolidated Tester');
    expect(proj.facts.role).toBe('Property / estates');
    expect(proj.facts.width).toBe('18');
    expect(proj.facts.length).toBe('32');
    expect(proj.facts.height).toBe('5.5');
    expect(proj.customerName).toBe('Consolidated Tester');
    expect(proj.stage1Complete).toBe(true);

    // No duplicate/alternate keys for the same data (e.g. clientName,
    // buildingWidth, etc.) — only the original, pre-existing fact keys.
    const factKeys = Object.keys(proj.facts);
    const unexpectedDuplicates = factKeys.filter(k => /^(client|building)?(Name|Role|Width|Length|Height)$/i.test(k) && !['name', 'role', 'width', 'length', 'height'].includes(k));
    expect(unexpectedDuplicates).toEqual([]);
  });

  test('width/length/height reach the existing geometry/drawing engine end-to-end (footprint reconciliation, Stage 1 report SVG, Stage 2 door review)', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await h.signUpAndReachDashboard(page, `s1geomproof-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, `Geometry Proof ${Date.now()}`);
    await h.openLegacyStage1(page);
    await page.waitForSelector('#answer');
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    // A REAL map placement, confirmed BEFORE width/length are known — the
    // footprint is provisionally sized by buildingDims()'s existing safe
    // fallback (10x10) at this point, exactly as it already did before
    // this task for any project reaching Map 1.
    const buildingMap = page.locator('#buildingMap');
    await buildingMap.scrollIntoViewIfNeeded();
    const b1 = await buildingMap.boundingBox();
    await buildingMap.click({ position: { x: b1.width / 2, y: b1.height / 2 } });
    await page.click('button.btn.green:has-text("Save & continue")');

    const projectId = await page.evaluate(() => location.hash.split('/')[1]);
    let state = await page.evaluate(() => JSON.parse(localStorage.getItem('projectcheck_master_v1')));
    let proj = state.projects.find(p => p.id === projectId);
    expect(proj.facts.buildingFootprint.width, 'footprint must use the existing fallback before real dimensions are known').toBe(10);
    expect(proj.facts.buildingFootprint.length).toBe(10);

    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 9);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
    await page.click('text=Continue without drawing the boundary');
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 9, 11);
    await page.waitForSelector('#ciName');

    // Submit REAL width/length/height on the consolidated page.
    await page.fill('#ciName', 'Geometry Prover');
    await page.selectOption('#ciRole', 'Facilities / operations');
    await page.fill('#ciWidth', '24');
    await page.fill('#ciLength', '40');
    await page.fill('#ciHeight', '6');
    await page.click('text=Save & continue');
    await page.waitForSelector('text=Stage 1 Free Report', { timeout: 15000 });

    // Proof 1: the SAME existing buildingFootprint re-derivation
    // safeguard (reconcileFootprintWithCurrentDimensions(), app.js) fired
    // and corrected the provisional footprint to the real dimensions —
    // position/rotation retained, exactly as it already did for a
    // customer editing width via "Review Stage 1" before this task.
    state = await page.evaluate(() => JSON.parse(localStorage.getItem('projectcheck_master_v1')));
    proj = state.projects.find(p => p.id === projectId);
    expect(proj.facts.buildingFootprint.width, 'width -> existing width fact -> geometry').toBe(24);
    expect(proj.facts.buildingFootprint.length, 'length -> existing length fact -> geometry').toBe(40);
    expect(proj.history.some(hh => hh.text.includes('re-derived on Map 1'))).toBe(true);

    // Proof 2: the Stage 1 report's real SVG (buildingDrawingSVG() ->
    // deriveGeometryFromFacts() -> drawing.js, the one existing pipeline)
    // reflects the submitted width/length — not a placeholder/empty
    // drawing, and not a second, separately-generated one.
    const reportSvg = await page.locator('.svg-wrap svg').innerHTML();
    expect(reportSvg).toContain('24');
    expect(reportSvg).toContain('40');

    // Proof 3: Stage 2's door review reads the exact same geometry
    // (buildGeometry() in geometry.js, the single canonical read path).
    await h.openLegacyDoors(page);
    const doorSvg = await page.locator('.svg-wrap svg').innerHTML();
    expect(doorSvg).toContain('24');
    expect(doorSvg).toContain('40');
  });

  // Two separate tests, not a loop over one page/context: after a
  // successful sign-up, state.user is already set in localStorage, so a
  // second reachConsolidatedPage() call on the SAME page would find
  // #authBtn already reading "Sign out" and log out instead of opening
  // the sign-in modal — each test gets its own fresh page/context instead.
  for (const [label, w, hh] of [['desktop', 1536, 900], ['mobile', 390, 844]]) {
    test(`no horizontal overflow — ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: hh });
      await reachConsolidatedPage(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow at ${w}x${hh}`).toBeLessThanOrEqual(1);
    });
  }

  // Superseded 2026-09-04 (Direction C complete working model, ARCHITECT +
  // SPA authorised, Stuart-approved correction): the pale-green shell
  // header this test originally guarded was the pre-Direction-C "locked
  // application shell" treatment. The locked Direction C S1-CLIENT frame
  // (Figma file BYsnm3HI7VBBZQyVnRbiTI, node 114:81) specifies the same
  // plain white "Header / Navigation" bar used on every other locked
  // frame — not pale-green. Updated to match; the underlying guarantee
  // this test exists for (one consistent, correct header on this page)
  // is unchanged.
  test('the locked white Direction C header treatment carries over to this page (not redesigned)', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await reachConsolidatedPage(page);
    expect(await page.locator('.topbar').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  });
});
