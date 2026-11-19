// Focused coverage for the Stage 1 geometry/data-continuity fix (2026-08-27,
// Customer Journey Completion — Stage 1 completion repair). Proves that a
// customer changing width/length AFTER already confirming the building
// footprint on Map 1 never leaves a silently stale buildingFootprint behind
// (see saveStage1() in app.js).
//
// Uses the same direct-localStorage-seed + hash-navigation pattern already
// established in geometry-audit.spec.js's "malformed width" test, rather
// than driving a real Leaflet map click — the fix under test is pure
// saveStage1() logic, not map interaction, so this is the reliable way to
// isolate it (matches existing repository practice, not a new technique).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const STORAGE_KEY = 'projectcheck_master_v1';

async function readState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

function seedConfirmedFootprintProject(projectId, userId, widthIdx) {
  return {
    user: { id: userId, email: 'geomcont@test.com' },
    users: [{ id: userId, email: 'geomcont@test.com', salt: 'x', passHash: 'y' }],
    projects: [{
      id: projectId, owner: userId, name: 'Geometry Continuity Project', address: 'Test Site', stage: 'Stage 1',
      created: new Date().toISOString(),
      facts: {
        name: 'Tester', role: 'Manager', address: 'Test Site', structure: 'Free-standing building',
        use: 'Storage', heated: 'No', width: '24', length: '40', height: '6', clearSpan: 'Yes',
        base: 'Concrete', level: 'Yes', services: 'No', closeBoundary: 'No',
        rollerCount: '0', personnelDoors: '1', programme: '3–6 months',
        buildingPositionStatus: 'confirmed', addressConfirmedOnly: false,
        buildingPosition: { lat: 51.5, lng: -0.1 },
        buildingFootprint: {
          center: { lat: 51.5, lng: -0.1 }, width: 24, length: 40, angle: 15,
          corners: [{ lat: 51.5001, lng: -0.1001 }, { lat: 51.5001, lng: -0.0999 }, { lat: 51.4999, lng: -0.0999 }, { lat: 51.4999, lng: -0.1001 }]
        },
        siteBoundaryStatus: 'skipped'
      },
      evidence: [], quotes: [], supplierRequest: null, risks1: [], actions1: [], risks2: [], actions2: [],
      history: [{ at: Date.now(), text: 'Project created' }],
      downloads: { s1: 0, s2: 0 }, stage1Complete: false, stage2Complete: false, plan: null
    }]
  };
}

// SKIPPED 2026-09-01 (Stage 1 Question Reduction, 17 -> 12 — see MASTER-
// SPEC.md § "Stage 1" and CHANGELOG.md for the full audit trail). Every
// test below proves the buildingFootprint re-derivation safeguard by
// having a (simulated) customer re-answer the live 'width' or 'length'
// Stage 1 question screen. 'width' and 'length' were removed from the
// sequential customer-facing array (app.js's stage1Questions[]) — there
// is no longer a live question screen for either, via any UI path,
// including "Review Stage 1" (E2E test below). This is NOT a case of the
// underlying feature being broken: the safeguard itself (saveStage1() in
// app.js, gated on q[0]==='width'||q[0]==='length') is completely
// untouched and intact, exactly per the retirement classification —
// RETIRED FROM SEQUENTIAL QUESTIONNAIRE — PLANNED FOR CONSOLIDATED
// CLIENT INPUT PAGE. It is simply unreachable via any live UI interaction
// right now, so these tests cannot currently exercise it end-to-end
// without inventing a UI path that doesn't exist (which this task
// explicitly does not authorise). Skipped rather than deleted, weakened
// or rewritten to test something else: once the future consolidated
// page provides its own way to edit width/length post-confirmation, this
// suite should be reactivated (removing this .skip) and adapted to that
// page's own interaction pattern — the seeded-state assertions
// themselves (footprint re-derivation, corner recomputation, history
// entry, PDF-read field) remain exactly correct and worth re-proving
// then.
test.describe.skip('Stage 1 geometry/data-continuity — buildingFootprint must not silently go stale', () => {
  test('A-F: changing width after footprint confirmation re-derives the footprint, not leaves it stale', async ({ page }) => {
    const userId = 'u-geomcont-w';
    const projectId = 'aaaaaaaa-1111-2222-3333-444444444444';
    const widthIdx = 6; // stage1Questions[6] = 'width'
    const seed = seedConfirmedFootprintProject(projectId, userId, widthIdx);
    await page.addInitScript(({ state, key, sessionKey }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem(sessionKey, String(6));
    }, { state: seed, key: STORAGE_KEY, sessionKey: 's1q_' + projectId });

    await page.goto(`/#stage1/${projectId}`, { waitUntil: 'load' });
    await page.waitForSelector('#answer');

    const before = await readState(page);
    const fpBefore = before.projects[0].facts.buildingFootprint;
    expect(fpBefore.width, 'seed sanity check').toBe(24);
    const staleCorner = fpBefore.corners[0].lat;

    // Change width from 24 to 30 and continue.
    await page.locator('#answer').click();
    await page.locator('#answer').fill('30');
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    await page.waitForSelector('#answer'); // now on 'length'

    const after = await readState(page);
    const proj = after.projects[0];
    const fpAfter = proj.facts.buildingFootprint;

    // G: new confirmed geometry persists, derived from the NEW width.
    expect(String(fpAfter.width)).toBe('30');
    // Centre/rotation retained (the customer's map placement is not lost).
    expect(fpAfter.center).toEqual(fpBefore.center);
    expect(fpAfter.angle).toBe(fpBefore.angle);
    // F: the stale corner geometry (computed from the OLD width) cannot
    // silently survive — it must have been recomputed for the new width.
    expect(fpAfter.corners[0].lat).not.toBe(staleCorner);
    // Position status remains 'confirmed' — the customer does not have to
    // redo their map placement merely because they corrected a dimension.
    expect(proj.facts.buildingPositionStatus).toBe('confirmed');
    // The re-derivation is recorded, never silent.
    expect(proj.history.some(h => h.text.includes('re-derived on Map 1'))).toBe(true);
  });

  test('length change is handled the same way as width', async ({ page }) => {
    const userId = 'u-geomcont-l';
    const projectId = 'bbbbbbbb-1111-2222-3333-444444444444';
    const seed = seedConfirmedFootprintProject(projectId, userId, 7);
    await page.addInitScript(({ state, key, sessionKey }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem(sessionKey, String(7)); // stage1Questions[7] = 'length'
    }, { state: seed, key: STORAGE_KEY, sessionKey: 's1q_' + projectId });

    await page.goto(`/#stage1/${projectId}`, { waitUntil: 'load' });
    await page.waitForSelector('#answer');
    await page.locator('#answer').click();
    await page.locator('#answer').fill('55');
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    await page.waitForSelector('#answer');

    const after = await readState(page);
    const fpAfter = after.projects[0].facts.buildingFootprint;
    expect(String(fpAfter.length)).toBe('55');
  });

  test('answering width with the SAME value does not trigger an unnecessary re-derivation entry', async ({ page }) => {
    const userId = 'u-geomcont-same';
    const projectId = 'cccccccc-1111-2222-3333-444444444444';
    const seed = seedConfirmedFootprintProject(projectId, userId, 6);
    await page.addInitScript(({ state, key, sessionKey }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem(sessionKey, String(6));
    }, { state: seed, key: STORAGE_KEY, sessionKey: 's1q_' + projectId });

    await page.goto(`/#stage1/${projectId}`, { waitUntil: 'load' });
    await page.waitForSelector('#answer');
    await page.locator('#answer').click();
    await page.locator('#answer').fill('24'); // unchanged from seed
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    await page.waitForSelector('#answer');

    const after = await readState(page);
    expect(after.projects[0].history.some(h => h.text.includes('re-derived on Map 1'))).toBe(false);
  });

  test('a SKIPPED (unconfirmed) building position is never affected by this fix', async ({ page }) => {
    const userId = 'u-geomcont-skip';
    const projectId = 'dddddddd-1111-2222-3333-444444444444';
    const seed = seedConfirmedFootprintProject(projectId, userId, 6);
    seed.projects[0].facts.buildingPositionStatus = 'skipped';
    seed.projects[0].facts.buildingFootprint = null;
    await page.addInitScript(({ state, key, sessionKey }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem(sessionKey, String(6));
    }, { state: seed, key: STORAGE_KEY, sessionKey: 's1q_' + projectId });

    await page.goto(`/#stage1/${projectId}`, { waitUntil: 'load' });
    await page.waitForSelector('#answer');
    await page.locator('#answer').click();
    await page.locator('#answer').fill('30');
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    await page.waitForSelector('#answer');

    const after = await readState(page);
    expect(after.projects[0].facts.buildingFootprint).toBeNull();
    expect(after.projects[0].history.some(h => h.text.includes('re-derived on Map 1'))).toBe(false);
  });

  // Real-UI, end-to-end coverage (Stage 1 completion repair §4/§5/§6 item H):
  // every other test above seeds a confirmed footprint directly into
  // localStorage and only re-answers ONE question — a reliable way to isolate
  // saveStage1()'s logic (matches existing repository practice, e.g.
  // geometry-audit.spec.js's "malformed width" test), but it never actually
  // clicks the Leaflet map, never draws a real boundary, and never proves
  // that "Review Stage 1" (the only real path back into Map 1 after Stage 1
  // is already complete) preserves a genuine map-placed footprint and then
  // updates it consistently. This test drives the full real flow instead:
  // place the building on Map 1 with a real map click, confirm; draw a real
  // 3-point boundary on Map 2, confirm; reach the Stage 1 report; go back via
  // "Review Stage 1"; change width; walk through unchanged questions back to
  // Map 1 (item: leave/return/edit without data loss); confirm the
  // already-placed footprint reflects the NEW width while position/rotation
  // survive; re-confirm through to the report; and prove the exact data the
  // Stage 1 PDF reads (app.js's downloadReport(), line ~1493:
  // `p.facts.buildingFootprint.width/length/angle`) has the updated value —
  // closing item H (report reflects updated geometry), not just the
  // in-memory fact.
  test('E2E: real map placement + real boundary draw + Review Stage 1 width change survive through to the report data the PDF reads', async ({ page }) => {
    const email = `geomcont-e2e-${Date.now()}@test.com`;
    await h.signUpAndReachDashboard(page, email);
    await h.createLegacyAssessmentProject(page, 'Geometry Continuity E2E Project');

    // --- Complete Stage 1 questions (width=24, length=40 from STAGE1_ANSWERS).
    // 17-question workflow (2026-08-27): Map 1 sits after Q12, Map 2 after
    // Q15 — drive in three blocks around the two real map interactions below. ---
    await h.openLegacyStage1(page);
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 0, 6);
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });

    // --- Map 1: a REAL map click places the building marker; confirm it. ---
    const buildingMap = page.locator('#buildingMap');
    await buildingMap.scrollIntoViewIfNeeded();
    const b1 = await buildingMap.boundingBox();
    await buildingMap.click({ position: { x: b1.width / 2, y: b1.height / 2 } });
    await expect(page.locator('#buildingStatus')).toContainText('Building centre selected', { timeout: 5000 });
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();

    // --- Q13-Q15 (base/level/services) now sit between Map 1 and Map 2. ---
    await h.answerStage1Questions(page, h.STAGE1_ANSWERS, 6, 7);

    // --- Map 2: draw a REAL 3-point boundary; confirm. ---
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
    const boundaryMap = page.locator('#boundaryMap');
    await boundaryMap.scrollIntoViewIfNeeded();
    const b2 = await boundaryMap.boundingBox();
    await boundaryMap.click({ position: { x: b2.width / 2 - 60, y: b2.height / 2 - 40 } });
    await boundaryMap.click({ position: { x: b2.width / 2 + 60, y: b2.height / 2 - 40 } });
    await boundaryMap.click({ position: { x: b2.width / 2, y: b2.height / 2 + 60 } });
    await expect(page.locator('#boundaryStatus')).toContainText('Boundary points: 3', { timeout: 5000 });
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();

    // --- Q16-Q17 (closeBoundary/programme) complete Stage 1. ---
    await page.waitForSelector('text=Stage 1 Free Report', { timeout: 15000 });

    const afterFirstConfirm = await readState(page);
    const projId = afterFirstConfirm.projects[0].id;
    const fp1 = afterFirstConfirm.projects[0].facts.buildingFootprint;
    expect(fp1.width, 'seed sanity: original width').toBe(24);
    expect(afterFirstConfirm.projects[0].facts.buildingPositionStatus).toBe('confirmed');
    expect(afterFirstConfirm.projects[0].facts.siteBoundaryStatus).toBe('confirmed');
    expect(afterFirstConfirm.projects[0].facts.siteBoundary.length).toBe(3);
    const centerBefore = fp1.center, angleBefore = fp1.angle;

    // --- "Review Stage 1": the only real path back into Map 1 once Stage 1
    // is already complete (dashboard's "Review Stage 1" button routes here;
    // stage1() restarts at question 1 since sessionStorage's question-index
    // was cleared on completion) — walk through every question unchanged
    // EXCEPT width, proving both "edit" and "leave/return without data loss"
    // for the 16 untouched answers. ---
    await page.click('text=Project workspace');
    await page.click('text=Review Stage 1');
    await page.waitForSelector('#answer');
    const revisedAnswers = [...h.STAGE1_ANSWERS];
    revisedAnswers[6] = '30'; // stage1Questions[6] = 'width': 24 -> 30
    await h.answerStage1Questions(page, revisedAnswers, 0, 12);

    // --- Back at Map 1: the already-confirmed footprint must still be
    // there (not wiped by re-answering) and already reflect the new width —
    // continuing without re-clicking the map proves no data was lost. ---
    await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
    await expect(page.locator('#buildingStatus')).toContainText('Building footprint saved.');
    // "Building orientation:" toolbar specifically (not ".first()") — the Stage 1
    // Map Architecture task added a "Map view" toolbar earlier in the DOM for the
    // new map-bearing controls, which is a separate concept from the building's
    // own dimensions/orientation asserted here.
    await expect(page.locator('.map-toolbar strong', { hasText: 'Building orientation' })).toContainText('30 m');
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    await h.answerStage1Questions(page, revisedAnswers, 12, 15);
    await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
    await expect(page.locator('#boundaryStatus')).toContainText('Site boundary saved.');
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    await h.answerStage1Questions(page, revisedAnswers, 15, 17);
    await page.waitForSelector('text=Stage 1 Free Report', { timeout: 15000 });

    // --- Item H: the exact field downloadReport() prints on the Stage 1 PDF
    // (`Building position: confirmed on map (${buildingFootprint.width} m x
    // ...)`) now carries the NEW width, and position/rotation (the
    // customer's actual map placement) were retained, not reset. ---
    const final = await readState(page);
    const proj = final.projects.find(x => x.id === projId);
    const fp2 = proj.facts.buildingFootprint;
    expect(fp2.width, 'the field the Stage 1 PDF reads must show the corrected width').toBe(30);
    expect(fp2.center, 'map placement (centre) must be retained, not reset, by the dimension edit').toEqual(centerBefore);
    expect(fp2.angle).toBe(angleBefore);
    expect(proj.facts.buildingPositionStatus).toBe('confirmed');
    expect(proj.facts.siteBoundaryStatus).toBe('confirmed');
    expect(proj.facts.siteBoundary.length, 'the real drawn boundary must survive the edit too').toBe(3);
    expect(proj.history.some(hh => hh.text.includes('re-derived on Map 1'))).toBe(true);
  });
});
