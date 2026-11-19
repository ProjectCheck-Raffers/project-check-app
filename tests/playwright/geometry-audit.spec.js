// Regression test for the WS3 geometry-audit design: a one-time
// geometry.original snapshot (taken the first time ensureGeometry() builds
// geometry for a project) plus a per-door source:'generated'|'customer' tag,
// so the Project-Check-generated layout stays distinguishable from customer
// adjustments even after edits, confirm/regenerate, and a page reload.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const STORAGE_KEY = 'projectcheck_master_v1';

async function readState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

// Stage 1 Question Reduction (2026-09-01, 17 -> 12) then the Consolidated
// Client Input Page (2026-09-02 — see MASTER-SPEC.md/CHANGELOG.md for
// both): 'width'/'length'/'height' are no longer answered via the
// sequential Stage 1 flow — h.completeStage1() now drives the new
// consolidated page (reached automatically after Q12, supplying these via
// h.CLIENT_INPUT_DEFAULTS: width=24/length=40/height=6) as part of its own
// existing single call, so this file's geometry-generation tests need no
// separate seeding step of their own any more.

test('geometry.original persists and door source survives customer edits + reload', async ({ page }) => {
  const email = `geomaudit-${Date.now()}@test.com`;
  const projectName = `Geometry Audit ${Date.now()}`;

  await h.signUpAndReachDashboard(page, email);
  await h.createLegacyAssessmentProject(page, projectName);
  await h.completeStage1(page);
  await h.skipMapsToStage1Summary(page);

  // Reach the Stage 2 door review, which is what actually calls
  // ensureGeometry() for the first time (see geometry.js) and takes the
  // one-time "generated" snapshot in memory.
  await h.openLegacyDoors(page);

  // Merely viewing the page builds p.geometry in memory but does not
  // persist it — only confirmDoors() calls save(). Do a legitimate first
  // confirm with no edits (matches the real Generate -> Review -> Confirm
  // flow) so the freshly-generated layout + its one-time original snapshot
  // actually reach localStorage before we capture the "before" state.
  await page.click('text=Confirm & regenerate drawing');
  await expect(page.locator('text=Confirmed.')).toBeVisible({ timeout: 10000 });

  const before = await readState(page);
  const projBefore = before.projects.find(p => p.name === projectName);
  expect(projBefore, 'project not found in localStorage before editing').toBeTruthy();
  expect(projBefore.geometry, 'geometry not built by first doorReview() visit').toBeTruthy();
  expect(projBefore.geometry.original, 'geometry.original snapshot missing on first build').toBeTruthy();

  // STAGE1_ANSWERS (helpers.js) has personnelDoors=1, rollerCount=0, so
  // exactly one Project-Check-generated personnel door should exist,
  // and it must be tagged 'generated' before any customer edit.
  expect(projBefore.geometry.doors.length, 'expected exactly one generated door before editing').toBe(1);
  expect(projBefore.geometry.doors[0].source, 'generated door must be tagged source:\'generated\'').toBe('generated');
  expect(projBefore.geometry.original.doors.length).toBe(1);
  expect(projBefore.geometry.original.doors[0].source).toBe('generated');
  const generatedDoorId = projBefore.geometry.doors[0].id;

  // --- Customer adjustment 1: reposition the existing generated door ---
  await page.fill('#doorNumeric', '5');
  await page.waitForTimeout(150); // moveDoor() re-renders the geometry-check panel inline

  // --- Customer adjustment 2: add a new door (always created source:'customer') ---
  await page.click('button:has-text("+ Add personnel door")');
  await page.waitForTimeout(150);

  await page.click('text=Confirm & regenerate drawing');
  await expect(page.locator('text=Confirmed.')).toBeVisible({ timeout: 10000 });

  // Reload — persistence must survive a fresh page load, not just the
  // in-memory session (verification item: "Refresh/reload does not
  // unexpectedly destroy confirmed customer changes").
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);

  const after = await readState(page);
  const projAfter = after.projects.find(p => p.id === projBefore.id);
  expect(projAfter, 'project missing from localStorage after reload').toBeTruthy();

  // The Project-Check-generated snapshot must be byte-for-byte the same as
  // it was before any customer edit — ensureGeometry() must never re-take
  // or mutate it on a subsequent visit.
  expect(projAfter.geometry.original, 'geometry.original must survive unchanged across edits + reload').toEqual(projBefore.geometry.original);

  // The repositioned door: same id, but now tagged 'customer', with its
  // moved offset persisted.
  const movedDoor = projAfter.geometry.doors.find(d => d.id === generatedDoorId);
  expect(movedDoor, 'originally-generated door should still exist after being moved').toBeTruthy();
  expect(movedDoor.source, 'moved door must be re-tagged source:\'customer\'').toBe('customer');
  expect(Number(movedDoor.offset)).toBeCloseTo(5, 1);

  // The added door: brand new id, tagged 'customer' from creation.
  const addedDoors = projAfter.geometry.doors.filter(d => d.id !== generatedDoorId);
  expect(addedDoors.length, 'expected exactly one customer-added door').toBe(1);
  expect(addedDoors[0].source, 'added door must be tagged source:\'customer\'').toBe('customer');

  // The original snapshot must reflect only the pre-edit layout — it must
  // NOT have grown to include the customer-added door, and must not have
  // picked up the moved offset either.
  expect(projAfter.geometry.original.doors.length, 'original snapshot must not include customer-added doors').toBe(1);
  expect(projAfter.geometry.original.doors[0].id).toBe(generatedDoorId);
  expect(projAfter.geometry.original.doors[0].source).toBe('generated');
});

// --- Copilot-review-driven regression coverage ---
// Covers: legacy door source backfill ('legacy', never 'customer' -- provenance
// genuinely unknown), preservation of existing generated/customer values,
// one-time geometry.original snapshot creation for pre-existing (legacy)
// geometry, and that snapshot never being retaken on a later visit.
test('legacy persisted geometry is healed (source backfill + one-time snapshot), never overwritten again', async ({ page }) => {
  const userId = 'u-legacy-audit';
  const projectId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const seed = {
    user: { id: userId, email: 'legacy-audit@test.com' },
    users: [{ id: userId, email: 'legacy-audit@test.com', salt: 'x', passHash: 'y' }],
    projects: [{
      id: projectId, owner: userId, name: 'Legacy Geometry Project', address: '', stage: 'Stage 2',
      created: new Date().toISOString(),
      facts: { name: 'Legacy Tester', role: 'Manager', address: '1 Test Way', structure: 'Free-standing building', width: '24', length: '40', height: '6' },
      stage2: {}, evidence: [], quotes: [], supplierRequest: null,
      risks1: [], actions1: [], risks2: [], actions2: [], history: [],
      downloads: { s1: 0, s2: 0 }, stage1Complete: true, stage2Complete: false, plan: null,
      // Simulates geometry persisted before source-tagging / structureType /
      // openWall / connectionWall / the original-snapshot feature existed at all:
      // no `original`, no structure fields, and doors in a mix of shapes.
      geometry: {
        width: 24, length: 40, eaveHeight: 6, ridgeHeight: 6.5, roofForm: 'Duo-pitch (indicative)',
        doors: [
          { id: 'rd1', ref: 'RD1', type: 'roller', wall: 'front', offset: 5, width: 4.6, height: 4.0, access: 'Van', source: 'generated' },
          { id: 'pd1', ref: 'PD1', type: 'personnel', wall: 'back', offset: 5, width: 1.0, height: 2.1, source: 'customer' },
          { id: 'pd2', ref: 'PD2', type: 'personnel', wall: 'left', offset: 5, width: 1.0, height: 2.1 }, // no source key at all
        ],
      },
    }],
  };
  // Conditional: addInitScript re-runs on every navigation, including the
  // page.reload() below -- an unconditional setItem would wipe out the
  // confirm-persisted healed state on reload, defeating the very thing this
  // test is checking (the snapshot surviving a subsequent visit).
  await page.addInitScript((state) => {
    if (!localStorage.getItem('projectcheck_master_v1')) localStorage.setItem('projectcheck_master_v1', JSON.stringify(state));
  }, seed);

  await page.goto(`/#doors/${projectId}`, { waitUntil: 'load' });
  await page.waitForSelector('text=Doors & drawing review');

  // As above: viewing the page only heals geometry in memory. A legitimate first
  // confirm (no edits) is what actually persists the healed state.
  await page.click('text=Confirm & regenerate drawing');
  await expect(page.locator('text=Confirmed.')).toBeVisible({ timeout: 10000 });

  const healed = await readState(page);
  const projHealed = healed.projects.find(p => p.id === projectId);
  expect(projHealed.geometry.original, 'legacy geometry must receive a one-time snapshot on first post-heal visit').toBeTruthy();

  const doorById = id => projHealed.geometry.doors.find(d => d.id === id);
  expect(doorById('rd1').source, 'existing generated value must be preserved').toBe('generated');
  expect(doorById('pd1').source, 'existing customer value must be preserved').toBe('customer');
  expect(doorById('pd2').source, 'door with no source at all must backfill to \'legacy\', not \'customer\' or \'generated\'').toBe('legacy');

  expect(projHealed.geometry.structureType, 'missing structureType must backfill to standard').toBe('standard');
  expect(projHealed.geometry.openWall).toBeNull();
  expect(projHealed.geometry.connectionWall).toBeNull();

  // The snapshot itself must also carry the healed (not the raw pre-heal) values.
  expect(projHealed.geometry.original.doors.find(d => d.id === 'pd2').source).toBe('legacy');

  const firstSnapshot = projHealed.geometry.original;

  // A later visit (with a real customer edit in between) must not retake the
  // snapshot -- it should stay exactly what it was the first time the legacy
  // geometry was healed.
  await page.fill('#doorNumeric', '3');
  await page.waitForTimeout(150);
  await page.click('text=Confirm & regenerate drawing');
  await expect(page.locator('text=Confirmed.')).toBeVisible({ timeout: 10000 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);

  const after = await readState(page);
  const projAfter = after.projects.find(p => p.id === projectId);
  expect(projAfter.geometry.original, 'snapshot must not be retaken on a subsequent visit').toEqual(firstSnapshot);
});

// Covers: the canopy plan-view open wall renders as a genuinely dashed edge with
// no solid stroke underneath it (Copilot review finding on drawing.js).
test('canopy plan view: open wall is a genuinely dashed edge, connection wall is solid green, no overlapping solid rect underneath', async ({ page }) => {
  const email = `canopydraw-${Date.now()}@test.com`;
  const canopyAnswers = h.STAGE1_ANSWERS.slice();
  // structure is now index 1 (was 3 before the Stage 1 Question Reduction,
  // 2026-09-01 — see MASTER-SPEC.md/CHANGELOG.md, removed name/role before
  // it in the array).
  canopyAnswers[1] = 'Canopy'; // structure question

  await h.signUpAndReachDashboard(page, email);
  await h.createLegacyAssessmentProject(page, `Canopy Drawing ${Date.now()}`);
  await h.completeStage1(page, canopyAnswers);
  await page.waitForSelector('.svg-wrap svg');

  // The plan perimeter is now 4 explicit <line> edges, not a <rect>. Scope the
  // check to the plan's own region (row 1, col 1: x<300 excludes the col-2/3
  // side-elevation and title-block rects, width<300 excludes the full-width
  // banner rect, y>50 excludes the banner) rather than counting every <rect>
  // in the SVG, which also includes the banner/title-block/elevation-door
  // rects unrelated to this bug.
  const planRegionRectCount = await page.evaluate(() => {
    const svg = document.querySelector('.svg-wrap svg');
    return [...svg.querySelectorAll('rect')].filter(r => {
      const x = Number(r.getAttribute('x')), width = Number(r.getAttribute('width')), y = Number(r.getAttribute('y'));
      return x < 300 && width < 300 && y > 50;
    }).length;
  });
  expect(planRegionRectCount, 'no <rect> should remain in the plan-view region (perimeter must be 4 lines only, no solid stroke can hide behind a dashed overlay)').toBe(0);

  // Exactly one dashed ink-coloured line: the open (front) wall edge.
  const dashedOpenEdges = await page.locator('.svg-wrap svg line[stroke="#101828"][stroke-dasharray="6,4"]').count();
  expect(dashedOpenEdges, 'open wall edge must be drawn as a single genuinely dashed line').toBe(1);

  // Exactly one solid green connection-wall edge, styled independently (not an
  // overlay on a separate solid ink-coloured edge at the same coordinates).
  const connectionEdges = await page.locator('.svg-wrap svg line[stroke="#207a3d"][stroke-width="3"]').count();
  expect(connectionEdges, 'connection wall edge must be a single solid green line').toBe(1);
});

// Covers: the Stage 1 personnel-door hint (Copilot Finding C) is gated on finite,
// positive width/length the same way validateGeometry()'s Stage 2 advisory
// already is (Finding A), rather than the old truthy-string check ("0" is a
// truthy string).
const HINT_TEXT = 'Project Check preliminary opening allowance';

// Reaches the personnelDoors question with width/length pre-seeded directly
// in p.facts, landing on the personnelDoors screen via sessionStorage.
//
// REWRITTEN 2026-09-01 (Stage 1 Question Reduction, 17 -> 12 — see MASTER-
// SPEC.md/CHANGELOG.md): 'width' and 'length' were removed from the
// sequential customer-facing array (app.js's stage1Questions[]), so there
// is no longer a live question screen to walk through and answer them via
// — this function used to do exactly that (answer questions 0 through
// rollerCount inclusive, with width/length overridden mid-loop). Since
// p.facts.width/length are now populated by something other than the
// sequential flow (pending the future consolidated client-input page —
// see the retirement classification in app.js/CHANGELOG.md), this now
// seeds them directly via localStorage, the same established pattern
// already used by the "malformed width" test immediately below this
// function (which never depended on the live question flow in the first
// place). personnelDoors is now stage1Questions index 6 (was 11).
async function reachPersonnelDoorsHint(page, widthAnswer, lengthAnswer) {
  const userId = 'u-' + Date.now();
  const projectId = 'aaaaaaaa-1111-2222-3333-' + String(Date.now()).padStart(12, '0').slice(-12);
  const seed = {
    user: { id: userId, email: `s1hint-${Date.now()}@test.com` },
    users: [{ id: userId, email: `s1hint-${Date.now()}@test.com`, salt: 'x', passHash: 'y' }],
    projects: [{
      id: projectId, owner: userId, name: 'Personnel Doors Hint Test', address: '', stage: 'Stage 1',
      created: new Date().toISOString(),
      facts: {
        address: '1 Test Way', structure: 'Free-standing building', use: 'Storage', heated: 'No',
        clearSpan: 'Yes', rollerCount: '0', width: widthAnswer, length: lengthAnswer,
      },
      stage2: {}, evidence: [], quotes: [], supplierRequest: null,
      risks1: [], actions1: [], risks2: [], actions2: [], history: [],
      downloads: { s1: 0, s2: 0 }, stage1Complete: false, stage2Complete: false, plan: null,
    }],
  };
  await page.addInitScript(({ state, key, sessionKey }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem(sessionKey, '6'); // personnelDoors — see comment above
  }, { state: seed, key: STORAGE_KEY, sessionKey: 's1q_' + projectId });
  await page.goto(`/#stage1/${projectId}`, { waitUntil: 'load' });
  await page.waitForSelector('#answer'); // now on the personnelDoors question
}

test('Stage 1 hint: width "0" suppresses the advisory', async ({ page }) => {
  await reachPersonnelDoorsHint(page, '0', '40');
  await expect(page.locator(`text=${HINT_TEXT}`)).toHaveCount(0);
});

test('Stage 1 hint: malformed/non-finite width suppresses the advisory', async ({ page }) => {
  // <input type="number"> itself refuses typed non-numeric text (Playwright's
  // .fill() cannot put "abc" into it -- the browser blocks it), so a malformed
  // width can't be produced by driving the real form. The realistic path to
  // malformed persisted facts is tampered/pre-existing localStorage (the same
  // threat model this codebase already defends against elsewhere) -- seed a
  // project directly with facts.width already malformed, at the personnelDoors
  // question, and load it via the hash the app itself uses for navigation.
  const userId = 'u-s1hint-malformed';
  const projectId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
  const seed = {
    user: { id: userId, email: 'malformed@test.com' },
    users: [{ id: userId, email: 'malformed@test.com', salt: 'x', passHash: 'y' }],
    projects: [{
      id: projectId, owner: userId, name: 'Malformed Width Project', address: '', stage: 'Stage 1',
      created: new Date().toISOString(),
      facts: { address: '1 Test Way', structure: 'Free-standing building', width: 'not-a-number', length: '40' },
      stage2: {}, evidence: [], quotes: [], supplierRequest: null,
      risks1: [], actions1: [], risks2: [], actions2: [], history: [],
      downloads: { s1: 0, s2: 0 }, stage1Complete: false, stage2Complete: false, plan: null,
    }],
  };
  await page.addInitScript(({ state, key, sessionKey }) => {
    localStorage.setItem(key, JSON.stringify(state));
    // personnelDoors is stage1Questions index 6 (was 11 before the Stage 1
    // Question Reduction, 2026-09-01 — see MASTER-SPEC.md/CHANGELOG.md).
    sessionStorage.setItem(sessionKey, '6');
  }, { state: seed, key: STORAGE_KEY, sessionKey: 's1q_' + projectId });

  await page.goto(`/#stage1/${projectId}`, { waitUntil: 'load' });
  await page.waitForSelector('#answer');
  await expect(page.locator(`text=${HINT_TEXT}`)).toHaveCount(0);
});

// Stale-expectation correction (2026-09-02, PC-CONTROL-004, Workstream C):
// this test used to assert the exact text of the perimeter÷32m hint banner
// for a valid width/length combination (width=24,length=40 -> perimeter=
// 128m -> 128/32=4). That banner — and its "Use suggested value" button —
// was deliberately, permanently removed from app.js on 2026-08-26
// ("Personnel-door question corrected; perimeter ÷ 32 m rule retired from
// live behaviour", following the Coveris fire-strategy evidence review —
// see CHANGELOG.md/MASTER-SPEC.md). It is not a regression and not
// incomplete Stage 1 Question Reduction/consolidated-input migration —
// the removal predates both of those tasks by days and is an intentional,
// governed product decision, confirmed unchanged since. Corrected to guard
// the current, approved, opposite behaviour: the retired advisory must
// never reappear, even for the exact dimensions that used to trigger it.
// This now matches the sibling tests immediately above/below it in this
// file, which already correctly expect absence.
test('Stage 1 hint: retired perimeter÷32m advisory does not reappear for valid positive dimensions (2026-08-26 retirement guard)', async ({ page }) => {
  await reachPersonnelDoorsHint(page, '24', '40');
  await expect(page.locator(`text=${HINT_TEXT}`)).toHaveCount(0);
});
