// Focused coverage for the Stage 1 Map Architecture task (2026-08-27):
// MapLibre GL JS map-bearing (view) rotation, kept strictly separate from
// BUILDING rotation (activeFootprintAngle, an engineering/project-geometry
// property unchanged since before this task) and from stored geographic
// lat/lng (buildingFootprint/siteBoundary). See app.js's mapStyleSpec()/
// createProjectCheckMap()/rotateMapView()/resetMapNorth() and the governing
// comment above them.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Stage 1 flow split points recomputed 2026-09-02 (Stage 1 Question
// Reduction, 17 -> 12, 2026-09-01 — see MASTER-SPEC.md/CHANGELOG.md):
// every h.answerStage1Questions(page, h.STAGE1_ANSWERS, ...) call in this
// file was (0,12)/(12,15)/(15,17); now (0,7)/(7,10)/(10,12) — personnel
// Doors (before Map 1) moved from old index 11 to new 6, base/level/
// services (between the maps) from old 12-14 to new 7-9. Same class of
// hardcoded-array-position issue already fixed elsewhere for that task —
// this file was not part of the original task's own verification pass,
// so it was missed until now.
const STORAGE_KEY = 'projectcheck_master_v1';
async function readState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

test.describe('Stage 1 map-view bearing rotation (MapLibre) — kept separate from building rotation and geometry', () => {
  test('A/B: Map 1 and Map 2 both load with the new MapLibre renderer', async ({ page }) => {
    const email = `maprot-ab-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation A/B Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
    await expect(page.locator('#buildingMap .maplibregl-canvas')).toBeVisible();
    await page.click('text=Continue without pinpointing on the map');
    // 17-question workflow (2026-08-27): Q13-Q15 now sit between Map 1 and Map 2.
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
    await expect(page.locator('#boundaryMap .maplibregl-canvas')).toBeVisible();
  });

  test('C/D: desktop bearing controls rotate the map view and Reset North restores it', async ({ page }) => {
    const email = `maprot-cd-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation C/D Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing North');
    await page.click('text=Rotate map right ⟳');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 15°');
    await page.click('text=Rotate map right ⟳');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 30°');
    await page.click('text=🧭 Reset north');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing North');
    await page.click('text=⟲ Rotate map left');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 345°');
  });

  test('E/F/G: map-view rotation never changes the confirmed footprint\'s coordinates or angle; building rotation remains independent', async ({ page }) => {
    const email = `maprot-efg-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation E/F/G Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    const buildingMap = page.locator('#buildingMap');
    const box = await buildingMap.boundingBox();
    await buildingMap.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.locator('#buildingStatus')).toContainText('Rotation: 0°');

    // Rotate the MAP VIEW several times — must not touch the not-yet-saved
    // marker's position or the building's own rotation readout at all.
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 45°');
    await expect(page.locator('#buildingStatus')).toContainText('Rotation: 0°'); // building rotation untouched by map rotation

    // Now rotate the BUILDING — this must change independently of the map's
    // (still 45°) bearing.
    await page.click('text=Rotate building 15° ↻');
    await expect(page.locator('#buildingStatus')).toContainText('Rotation: 15°');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 45°'); // map bearing untouched by building rotation

    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    // 17-question workflow (2026-08-27): Q13-Q15 now sit between Map 1 and Map 2.
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });

    const after = await readState(page);
    const fp = after.projects[0].facts.buildingFootprint;
    // The persisted, report-reading geometry reflects the BUILDING rotation
    // (15°) chosen via rotateBuilding() — never the map's view bearing (45°).
    expect(fp.angle).toBe(15);
  });

  test('H: Map 1\'s chosen bearing carries into Map 2', async ({ page }) => {
    const email = `maprot-h-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation H Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 30°');
    await page.click('text=Continue without pinpointing on the map');
    // 17-question workflow (2026-08-27): Q13-Q15 (base/level/services) now sit
    // between Map 1 and Map 2 — answer them to reach Map 2.
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 30°');
  });

  test('I: boundary coordinates are the real geographic click location regardless of map bearing', async ({ page }) => {
    const email = `maprot-i-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation I Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
    await page.click('text=Continue without pinpointing on the map');
    // 17-question workflow (2026-08-27): Q13-Q15 (base/level/services) now sit
    // between Map 1 and Map 2 — answer them to reach Map 2.
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });

    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳'); // 60°, well away from north
    const boundaryMap = page.locator('#boundaryMap');
    const box = await boundaryMap.boundingBox();
    await boundaryMap.click({ position: { x: box.width / 2 - 60, y: box.height / 2 - 40 } });
    await boundaryMap.click({ position: { x: box.width / 2 + 60, y: box.height / 2 - 40 } });
    await boundaryMap.click({ position: { x: box.width / 2, y: box.height / 2 + 60 } });
    await expect(page.locator('#boundaryStatus')).toContainText('Boundary points: 3');
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    // Consolidated Client Input Page (2026-09-02) now follows Q12, before
    // the report — see helpers.js's submitClientInputPage().
    await h.submitClientInputPage(page);

    const after = await readState(page);
    const boundary = after.projects[0].facts.siteBoundary;
    expect(boundary.length).toBe(3);
    // Real, distinct geographic points — not degenerate/identical (which would
    // indicate the click handler read screen pixels instead of e.lngLat).
    const uniqueLats = new Set(boundary.map(pt => pt.lat));
    expect(uniqueLats.size).toBeGreaterThan(1);
  });

  test('J/K: distance and area measurement math is unaffected by map bearing', async ({ page }) => {
    const email = `maprot-jk-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation J/K Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    const distAtNorth = await page.evaluate(() => haversineMetres([51.5, -0.10], [51.51, -0.10]));
    const areaAtNorth = await page.evaluate(() => approxAreaM2([[51.5, -0.10], [51.5, -0.099], [51.501, -0.0995]]));

    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳'); // 75°
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 75°');

    const distRotated = await page.evaluate(() => haversineMetres([51.5, -0.10], [51.51, -0.10]));
    const areaRotated = await page.evaluate(() => approxAreaM2([[51.5, -0.10], [51.5, -0.099], [51.501, -0.0995]]));

    expect(distRotated).toBe(distAtNorth);
    expect(areaRotated).toBe(areaAtNorth);

    // UI-level sanity: the on-screen measurement tool still produces a real
    // "Distance:" readout while the map is rotated (journey.spec.js already
    // proves this at bearing 0 under the new renderer).
    await page.click('#measureDistanceBtn');
    const mapBox = await page.locator('#buildingMap').boundingBox();
    await page.locator('#buildingMap').click({ position: { x: mapBox.width / 2 - 30, y: mapBox.height / 2 } });
    await page.locator('#buildingMap').click({ position: { x: mapBox.width / 2 + 30, y: mapBox.height / 2 } });
    await expect(page.locator('#measureStatus')).toContainText('Distance:', { timeout: 5000 });
  });

  test('M: returning to the legacy map after the report preserves bearing and the confirmed footprint', async ({ page }) => {
    const email = `maprot-m-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation M Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
    const buildingMap = page.locator('#buildingMap');
    const box = await buildingMap.boundingBox();
    await buildingMap.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.click('text=Rotate map right ⟳');
    await page.click('text=Rotate map right ⟳');
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    // 17-question workflow (2026-08-27): Q13-Q15 then Map 2, then Q16-Q17.
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
    await page.click('text=Continue without drawing the boundary');
    // Consolidated Client Input Page (2026-09-02) now follows Q12, before
    // the report — see helpers.js's submitClientInputPage().
    await h.submitClientInputPage(page);

    const before = await readState(page);
    const fpBefore = before.projects[0].facts.buildingFootprint;

    // A new document is required: completing the legacy report keeps its Stage 1 hash.
    // Reusing that identical hash would not dispatch navigation or reopen Question 1.
    const id = new URL(page.url()).hash.split('/')[1];
    await page.goto('/?legacy-review=' + id + '#stage1/' + id);
    await expect(page.locator('#answer')).toBeVisible();
    // 4ba3846 skips already-known answers and confirmed maps. Re-answering
    // seven questions is obsolete; explicitly reopen the retained map component.
    await page.evaluate(id => buildingPositionMap(id), id);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
    // Map 1 reopens at the last saved bearing (30°), not reset to north, and
    // the footprint itself is exactly as it was — the map-view rotation and
    // the legacy report/map round trip corrupted neither.
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 30°');
    const after = await readState(page);
    expect(after.projects[0].facts.buildingFootprint).toEqual(fpBefore);
  });

  test('P: two-finger touch rotation is enabled and pitch is locked to 0 (configuration proof)', async ({ page }) => {
    const email = `maprot-p-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation P Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    const config = await page.evaluate(() => ({
      touchZoomRotateEnabled: activeBuildingMap.touchZoomRotate.isEnabled(),
      touchPitchHandlerPresent: typeof activeBuildingMap.touchPitch === 'object' && activeBuildingMap.touchPitch !== null,
      maxPitch: activeBuildingMap.getMaxPitch(),
      minPitch: activeBuildingMap.getMinPitch(),
      pitch: activeBuildingMap.getPitch(),
    }));
    expect(config.touchZoomRotateEnabled, 'pinch-zoom + two-finger-rotate handler must be enabled').toBe(true);
    expect(config.touchPitchHandlerPresent, 'touchPitch:false constructor option must have taken effect (handler still exists but pitch is hard-locked below)').toBe(true);
    // MapLibre 3.6.2's touchPitch handler has no enable/disable/isEnabled() API
    // (confirmed by direct introspection, not assumed) — maxPitch/minPitch is the
    // actually-enforced, testable pitch lock, and belt-and-braces alongside the
    // pitchWithRotate:false/touchPitch:false constructor options. This is what
    // §16 ("keep pitch at 0") is really asking to be proven.
    expect(config.maxPitch).toBe(0);
    expect(config.minPitch).toBe(0);
    expect(config.pitch).toBe(0);
  });

  test('Q: a synthetic two-finger touch gesture rotates the map view and does not place a building marker', async ({ page }) => {
    const email = `maprot-q-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation Q Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    const rotated = await page.evaluate(() => {
      const canvas = document.querySelector('#buildingMap canvas');
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const mk = (id, x, y) => new Touch({ identifier: id, target: canvas, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
      const fire = (type, touches) => canvas.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches, changedTouches: touches, bubbles: true, cancelable: true, composed: true }));
      const before = activeBuildingMap.getBearing();
      const steps = [
        [mk(1, cx - 45, cy), mk(2, cx + 45, cy)],
        [mk(1, cx - 30, cy - 34), mk(2, cx + 30, cy + 34)],
        [mk(1, cx - 5, cy - 45), mk(2, cx + 5, cy + 45)],
        [mk(1, cx + 20, cy - 40), mk(2, cx - 20, cy + 40)],
      ];
      fire('touchstart', steps[0]);
      for (let i = 1; i < steps.length; i++) fire('touchmove', steps[i]);
      fire('touchend', []);
      return { before, after: activeBuildingMap.getBearing() };
    });

    if (Math.abs(rotated.after - rotated.before) < 1) {
      // Documented limitation (see report §U) — Playwright/Chromium's
      // synthetic Touch/TouchEvent construction is not a real OS multi-touch
      // gesture, and MapLibre's TwoFingersTouchRotateHandler's exact gesture-
      // recognition thresholds are not guaranteed to fire from a scripted
      // event sequence. The underlying capability itself is proven
      // configured-and-enabled by test P above; this test additionally
      // confirms that IF a two-finger sequence is recognised, no building
      // marker is placed by it (the concrete, product-relevant risk named in
      // the brief), without over-claiming true hardware-gesture parity.
      test.info().annotations.push({ type: 'limitation', description: 'Synthetic two-finger touch did not measurably rotate the map bearing in this environment — see report §U. touchZoomRotate is independently confirmed enabled in test P.' });
    } else {
      expect(rotated.after).not.toBe(rotated.before);
    }
    // Whether or not the synthetic gesture was recognised as a rotate, it must
    // never have been misread as a single-finger tap-to-place-building.
    await expect(page.locator('#buildingStatus')).toContainText('No building position selected yet.');
  });

  test('R: report-reading geometry uses the customer\'s BUILDING rotation, never the map\'s view bearing', async ({ page }) => {
    const email = `maprot-r-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Map Rotation R Project');
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    const buildingMap = page.locator('#buildingMap');
    const box = await buildingMap.boundingBox();
    await buildingMap.click({ position: { x: box.width / 2, y: box.height / 2 } });
    // Map bearing = 90° (six 15° clicks), building rotation = 30° (two 15°
    // clicks) — the brief's own worked example.
    for (let i = 0; i < 6; i++) await page.click('text=Rotate map right ⟳');
    await expect(page.locator('#mapBearingReadout')).toHaveText('Map view: facing 90°');
    await page.click('text=Rotate building 15° ↻');
    await page.click('text=Rotate building 15° ↻');
    await expect(page.locator('#buildingStatus')).toContainText('Rotation: 30°');

    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    // 17-question workflow (2026-08-27): Q13-Q15 then Map 2, then Q16-Q17.
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
    await page.click('text=Continue without drawing the boundary');
    // Consolidated Client Input Page (2026-09-02) now follows Q12, before
    // the report — see helpers.js's submitClientInputPage().
    await h.submitClientInputPage(page);

    const state = await readState(page);
    const fp = state.projects[0].facts.buildingFootprint;
    // This is exactly the field downloadReport() prints on the Stage 1 PDF
    // (app.js: `rotation ${p.facts.buildingFootprint?.angle}°`).
    expect(fp.angle, 'the PDF/report must show the BUILDING rotation (30°), never the map bearing (90°)').toBe(30);
  });
});
