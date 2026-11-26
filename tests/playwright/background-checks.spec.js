const { test, expect } = require('@playwright/test');

// Stage 2 background checks on a confirmed Building Design (background-checks.js):
// 1) distance to boundary per elevation, 2) indicative fire exits for industrial
// buildings (32 m rule round the perimeter, exits beside steel columns), 3)
// other flags. Stored at project.backgroundChecks, cleared on edit, and
// shown only on the Stage 2 design summary — never in Building Design.

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const LEISURE_ID = '44444444-4444-4444-8444-444444444444';
const STORAGE_KEY = 'projectcheck_master_v1';
const NOTE = 'Indicative fire exits for quotation only. Final positions depend on internal layout and full fire strategy.';
const CENTER = { lat: 53.1027, lng: -1.3702 };

// Local metres (x east, y north) -> lat/lng around CENTER.
function ll(x, y) {
  const mLat = 111320, mLng = 111320 * Math.cos(CENTER.lat * Math.PI / 180);
  return { lat: CENTER.lat + y / mLat, lng: CENTER.lng + x / mLng };
}

function projectFixture(id, use, withBoundaries) {
  const address = 'Unit 15, Example Industrial Estate, Exampleton AB1 2CD';
  return {
    id,
    owner: 'user-bg-checks',
    name: id === PROJECT_ID ? 'Exampleton Distribution Building' : 'Leisure hall',
    address,
    postcode: 'AB1 2CD',
    status: 'Active',
    stage: 'Stage 1',
    created: '2026-11-14T09:00:00.000Z',
    facts: {
      role: 'Managing Director',
      buildingUse: use,
      buildingType: 'Free-standing building',
      constructionMaterial: 'Steel',
      windLoad: '0.70',
      length: '50',
      width: '30',
      height: '6',
      roofPitch: '10',
      rollerDoors: [{ width: '4.6', height: '4', access: 'HGV loading' }],
      personnelDoors: '1',
      buildingPositionStatus: 'confirmed',
      siteLayoutStatus: 'confirmed',
      siteBoundaryStatus: withBoundaries ? 'confirmed' : 'skipped',
      siteLayoutSiteAddress: address,
      siteLayoutConfirmedAt: '2026-11-14T10:00:00.000Z',
      // 30 m wide x 50 m long, angle 0: Elevation A is the south edge (y=-25),
      // B the east edge (x=+15).
      buildingFootprint: { center: CENTER, width: 30, length: 50, angle: 0 },
      relevantBoundaries: withBoundaries ? [
        [ll(-10, -27), ll(10, -27)],   // 2.0 m south of Elevation A (amber)
        [ll(15.6, -20), ll(15.6, 20)], // 0.6 m east of Elevation B (high)
      ] : [],
      siteLayoutMapView: { center: CENTER, zoom: 19, bearing: 0, baseLayer: 'satellite' },
    },
    stage2: {}, evidence: [], quotes: [], supplierRequest: null,
    risks1: [], actions1: [], risks2: [], actions2: [],
    history: [{ at: '2026-11-14T09:00:00.000Z', text: 'Project created' }],
    downloads: { s1: 0, s2: 0 },
    stage1Complete: false,
    stage2Complete: false,
    plan: null,
  };
}

async function seed(page) {
  const user = { id: 'user-bg-checks', email: 'bg@example.test', name: 'Background checks reviewer' };
  const state = {
    user, users: [user],
    projects: [projectFixture(PROJECT_ID, 'Warehousing and general storage', true), projectFixture(LEISURE_ID, 'Indoor sports or leisure use', false)],
    stage3ImpactRegister: [],
  };
  await page.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem('bg-checks-seeded') === '1') return;
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('bg-checks-seeded', '1');
  }, { key: STORAGE_KEY, value: state });
}

const stored = (page, id) => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id), { key: STORAGE_KEY, id });

async function confirmDesign(page, id) {
  await page.goto(`/#buildingLayout/${id}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Building Design', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await seed(page); });

// Each exit leaf sits just inside a bay beside a column: its near edge 0.4 m from
// the column centreline (0.3 m + half a 0.2 m column), never across a column line.
function columnIssues(doors, columns) {
  const issues = [];
  for (const fe of doors) {
    const cols = columns[fe.wall] || [];
    const a = fe.offset, b = fe.offset + fe.width;
    if (cols.some(c => c > a - 1e-6 && c < b + 1e-6)) issues.push(`${fe.ref} on a column line`);
    const adjacent = cols.some(c => Math.abs(a - (c + 0.4)) < 0.011 || Math.abs((c - 0.4) - b) < 0.011);
    if (!adjacent) issues.push(`${fe.ref} not beside a column (${fe.wall} ${a})`);
  }
  return issues;
}

test('32 m rule: one fire exit every 32 m around the perimeter, beside columns, in clear gaps, customer doors not counted', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => {
    const check = (w, l, openings) => {
      const columns = pcFireExitDefaultColumns(w, l);
      const res = pcFireExitPlace(w, l, openings || [], { columns });
      const P = 2 * (w + l);
      const ts = res.doors.map(d => pcFireExitLoopT(d, w, l)).sort((a, b) => a - b);
      const gaps = ts.map((t, k) => (k === ts.length - 1 ? ts[0] + P : ts[k + 1]) - t);
      return { n: res.doors.length, min: res.minimumCount, maxGap: Math.max(...gaps), doors: res.doors, P, columns, feasible: res.feasible };
    };
    const openings = [
      { type: 'roller', wall: 'right', offset: 28, width: 6, height: 5 },
      { type: 'window', wall: 'left', offset: 13, width: 1.8, height: 1.2, sillHeight: 1 },
      { type: 'personnel', wall: 'front', offset: 16.5, width: 1, height: 2.1 },
      { type: 'personnel', subtype: 'double', wall: 'back', offset: 0.5, width: 2, height: 2.1 },
    ];
    return { b5030: check(30, 50), b7070: check(70, 70), blocked: check(30, 50, openings), openings };
  });
  // ceil(perimeter / 32): 160 m -> 5, 280 m -> 9. Snapping to columns allows a
  // small tolerance: gaps up to 32 m + 1.5 m (33.5 m) so the count stays minimal.
  for (const res of [r.b5030, r.b7070, r.blocked]) {
    expect(res.feasible).toBe(true);
    expect(res.n).toBe(res.min);
    expect(res.maxGap).toBeLessThanOrEqual(33.51);
    expect(columnIssues(res.doors, res.columns)).toEqual([]);
  }
  expect(r.b5030.n).toBe(5);
  expect(r.b7070.n).toBe(9);
  // Never overlapping a customer opening, 1 m from corners.
  for (const fe of r.blocked.doors) {
    expect(fe.offset).toBeGreaterThanOrEqual(1);
    const len = fe.wall === 'front' || fe.wall === 'back' ? 30 : 50;
    expect(fe.offset + fe.width).toBeLessThanOrEqual(len - 1);
    for (const o of r.openings.filter(x => x.wall === fe.wall)) {
      expect(fe.offset < o.offset + o.width + 0.3 && fe.offset + fe.width > o.offset - 0.3).toBe(false);
    }
  }
});

test('confirmed industrial design: checks stored separately, fire doors on confirmed Building Design, flags on Stage 2 summary, cleared on edit', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
  // Add a customer double door on Elevation B, then confirm.
  await page.evaluate(() => { buildingDesignSetView('b'); buildingDesignAddDoor('double'); });
  // Never shown while unlocked.
  await expect(page.locator('.bd-auto-fire-door')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Building Design', exact: true })).toBeVisible();
  // Confirmed design: auto fire doors appear on the plan and elevations (fire-door style),
  // but the Stage 2 flags card does not.
  await expect(page.locator('#stage2BackgroundChecks')).toHaveCount(0);
  await page.evaluate(() => buildingDesignSetView('plan'));
  await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door').first()).toBeVisible();
  expect(await page.locator('#buildingDesignSvg .bd-plan-fire-pushbar').count()).toBeGreaterThan(0);
  await page.locator('#buildingDesignSvg').screenshot({ path: process.env.FE32_PLAN_SCREENSHOT || process.env.DOORS_PLAN_SCREENSHOT || require('os').tmpdir() + '/doors-plan.png' });
  await page.evaluate(() => buildingDesignSetView('b'));
  await expect(page.locator('#buildingDesignSvg .bd-leaf-door.is-double:not(.is-fire)')).toHaveCount(1);
  expect(await page.locator('#buildingDesignSvg .bd-auto-fire-door .bd-fire-pushbar').count()).toBeGreaterThan(0);
  await page.locator('#buildingDesignSvg').screenshot({ path: process.env.DOORS_ELEV_SCREENSHOT || require('os').tmpdir() + '/doors-elev.png' });

  let p = await stored(page, PROJECT_ID);
  const bg = p.backgroundChecks;
  expect(bg).toBeTruthy();
  expect(bg.fireExits.doors.length).toBeGreaterThanOrEqual(2);
  expect(bg.fireExits.maxPerimeterGap).toBeLessThanOrEqual(33.5);
  expect(bg.fireExits.doors.length).toBe(5); // 50 x 30 m: ceil(160 / 32)
  // Exits beside the project's real steel frame columns (Building Design grid).
  const realColumns = await page.evaluate(id => pcBgColumns(getP(id)), PROJECT_ID);
  expect(columnIssues(bg.fireExits.doors, realColumns)).toEqual([]);
  expect(p.geometry.doors.some(d => d.type === 'fireExit' || /^FE/.test(d.ref || ''))).toBe(false);
  expect(bg.boundaryDistances.A).toBeGreaterThan(1.8);
  expect(bg.boundaryDistances.A).toBeLessThan(2.2);
  expect(bg.boundaryDistances.B).toBeGreaterThan(0.4);
  expect(bg.boundaryDistances.B).toBeLessThan(0.8);
  expect(bg.boundaryDistances.C).toBeGreaterThan(3);
  expect(bg.otherFlags.some(f => f.kind === 'large-building')).toBe(true);
  // Building-regs calculation stored with the checks.
  const regs = bg.buildingRegs;
  expect(regs.version).toBe('bregs-20261114');
  expect(new Date(regs.computedAt).toISOString()).toBe(regs.computedAt);
  expect(regs.inputsFingerprint).toBeTruthy();
  expect(regs.stale).toBe(false);
  expect(regs.designConfirmed).toBe(true);
  expect(regs.boundaryDistances).toEqual(bg.boundaryDistances);
  expect(regs.fireExits.count).toBe(bg.fireExits.doors.length);
  expect(regs.travel.spacing).toBe(32);
  expect(regs.clearSpace.clearance).toBe(1.8);
  expect(regs.clearSpace.note).toBe('Keep 1.8 m clear outside each exit.');
  // Boundary 0.6 m east of the middle 40 m of Elevation B: exits there are inside the 1.8 m clear space.
  const onB = regs.clearSpace.exits.filter(x => x.elevation === 'B');
  expect(onB.some(x => x.ok === false && x.distance < 0.8)).toBe(true);
  for (const x of regs.clearSpace.exits) expect(x.ok).toBe(x.distance >= 1.8);
  expect(regs.clearSpace.flags).toHaveLength(regs.clearSpace.exits.filter(x => x.ok === false).length);

  await page.goto(`/#quotationSummary/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Stage 2 design summary', exact: true })).toBeVisible();
  const card = page.locator('#stage2BackgroundChecks');
  await expect(card).toContainText(NOTE);
  await expect(card).toContainText('Wall close to boundary — check fire protection.');
  await expect(card.locator('.pc-bg-flag.is-high').first()).toContainText('Elevation B');
  await expect(card.locator('.pc-bg-flag.is-amber').first()).toContainText('Elevation A');
  await expect(card).toContainText('May need additional exits.');
  await expect(card).toContainText('racking');
  await expect(card).toContainText('Review once racking/layout documents are uploaded.');
  await expect(card).toContainText('32 m rule');
  await expect(card).toContainText('Keep 1.8 m clear outside each exit.');
  await expect(card.locator('.pc-bg-flag').filter({ hasText: 'under the 1.8 m clear space' }).first()).toBeVisible();
  await expect(card).not.toContainText('Table 2.1');
  await expect(card.locator('svg.pc-fire-exit-plan .pc-fire-exit')).toHaveCount(bg.fireExits.doors.length);
  await page.screenshot({ path: process.env.FIRE_EXIT_SCREENSHOT || require('os').tmpdir() + '/fire-exits.png', fullPage: true });

  // Editing the building deletes the auto-placed exits and checks.
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  p = await stored(page, PROJECT_ID);
  // Fire exits deleted; the rest of the building-regs results kept but stale.
  expect(p.backgroundChecks.fireExits).toBeUndefined();
  expect(p.backgroundChecks.buildingRegs.stale).toBe(true);
  expect(p.backgroundChecks.buildingRegs.fireExits).toBeNull();
  await expect(page.locator('.pc-fire-exit, .bd-auto-fire-door, #stage2BackgroundChecks')).toHaveCount(0);
  // Gone from the plan and every elevation, and still gone after a reload (edit is remembered).
  for (const view of ['plan', 'a', 'b', 'c', 'd']) {
    await page.evaluate(v => buildingDesignSetView(v), view);
    await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door')).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true })).toBeVisible();
  for (const view of ['plan', 'b']) {
    await page.evaluate(v => buildingDesignSetView(v), view);
    await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door')).toHaveCount(0);
  }
  expect((await stored(page, PROJECT_ID)).backgroundChecks.fireExits).toBeUndefined();
  await page.goto(`/#quotationSummary/${PROJECT_ID}`);
  await expect(page.locator('#stage2BackgroundChecks')).toHaveCount(0);
  // Confirm again: fire doors come back.
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Building Design', exact: true })).toBeVisible();
  await page.evaluate(() => buildingDesignSetView('plan'));
  await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door').first()).toBeVisible();
  expect((await stored(page, PROJECT_ID)).buildingDesign.editing).toBeUndefined();
  expect(errors).toEqual([]);
});

test('non-industrial project with skipped boundaries: no exits, no boundary result, racking note only', async ({ page }) => {
  await confirmDesign(page, LEISURE_ID);
  const p = await stored(page, LEISURE_ID);
  expect(p.backgroundChecks.fireExits).toBeNull();
  expect(p.backgroundChecks.boundaryDistances).toBeNull();
  await page.goto(`/#quotationSummary/${LEISURE_ID}`);
  const card = page.locator('#stage2BackgroundChecks');
  await expect(card).toBeVisible();
  await expect(card.locator('#quotationFireExits')).toHaveCount(0);
  await expect(card).not.toContainText('Distance to boundary');
  await expect(card).toContainText('racking');
});

test('Stage 1 Project Summary: one dropdown per door type with elevation labels', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(id => {
    const p = getP(id);
    p.geometry = { width: 30, length: 50, height: 6, doors: [
      { id: 'r1', ref: 'R1', type: 'roller', wall: 'front', offset: 5, width: 4, height: 5, access: 'HGV loading' },
      { id: 'r2', ref: 'R2', type: 'roller', wall: 'right', offset: 20, width: 3.5, height: 4, access: 'Van' },
      { id: 'p1', ref: 'P1', type: 'personnel', wall: 'left', offset: 10, width: 1, height: 2.1 },
      { id: 'd1', ref: 'D1', type: 'personnel', subtype: 'double', wall: 'back', offset: 8, width: 2, height: 2.1 },
    ] };
    save();
  }, PROJECT_ID);
  await page.goto(`/#stage1Confirm/${PROJECT_ID}`);
  const card = page.locator('.stage1-door-summary');
  await expect(card).toHaveCount(1);
  await expect(card).not.toContainText('Needs checking');
  await expect(card).not.toContainText('Customer requirements');
  await expect(card).not.toContainText('Saved drawing');
  await expect(card.getByRole('heading', { name: 'Roller doors', exact: true })).toHaveCount(1);
  const roller = card.locator('#stage1Doors-roller');
  await expect(roller.locator('option')).toHaveText(['R1 · 4.0 m × 5.0 m', 'R2 · 3.5 m × 4.0 m']);
  await roller.selectOption('1');
  const line = card.locator('[data-door-kind="roller"] .stage1-door-line');
  await expect(line).toHaveText('R2 · 3.5 m × 4.0 m (width × height) · Van');
  await expect(card.locator('#stage1Doors-personnel option')).toHaveText(['P1 · 1.0 m × 2.1 m']);
  await expect(card.locator('#stage1Doors-double option')).toHaveText(['D1 · 2.0 m × 2.1 m']);
  await expect(card.locator('[data-door-kind="double"] .stage1-door-line')).toHaveText('D1 · 2.0 m × 2.1 m (width × height) · Double door');
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: process.env.SUMMARY_DOORS_SCREENSHOT || require('os').tmpdir() + '/summary-doors.png' });
  expect(errors).toEqual([]);
});

test('personnel-door fire-exit option: note + toggle, roller-adjacent fire doors first, extra exits by the 32 m rule, cleared on edit', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Pure rule, both modes: 50 x 30 m with one roller door on Elevation A.
  await page.goto('/');
  const pure = await page.evaluate(() => {
    const openings = [{ type: 'roller', ref: 'R1', wall: 'front', offset: 12.7, width: 4.6, height: 4 }];
    const columns = pcFireExitDefaultColumns(30, 50);
    const gaps = res => { const ts = res.doors.map(d => pcFireExitLoopT(d, 30, 50)).sort((a, b) => a - b); return Math.max(...ts.map((t, k) => (k === ts.length - 1 ? ts[0] + 160 : ts[k + 1]) - t)); };
    const off = pcFireExitPlace(30, 50, openings, { columns }), on = pcFireExitPlace(30, 50, openings, { columns, rollerAdjacent: true });
    return { off: { n: off.doors.length, gap: gaps(off), adj: off.doors.filter(d => d.rollerAdjacent).length }, on: { n: on.doors.length, gap: gaps(on), adj: on.doors.filter(d => d.rollerAdjacent), doors: on.doors }, columns, openings };
  });
  expect(pure.off.n).toBe(5);
  expect(pure.off.adj).toBe(0);
  expect(pure.on.adj).toHaveLength(1);
  expect(pure.on.adj[0].wall).toBe('front');
  expect(pure.on.gap).toBeLessThanOrEqual(33.51);
  expect(columnIssues(pure.on.doors, pure.columns)).toEqual([]);
  const r = pure.openings[0], a = pure.on.adj[0];
  expect(a.offset + a.width <= r.offset - 0.3 || a.offset >= r.offset + r.width + 0.3).toBe(true);
  expect(Math.min(Math.abs(a.offset - (r.offset + r.width)), Math.abs(r.offset - (a.offset + a.width)))).toBeLessThan(5.5);

  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
  const option = page.locator('#buildingDesignFireExitOption');
  await expect(option).toContainText('Fire exits can also be used as personnel doors');
  await expect(option).toContainText('Fire exits can double as personnel doors. Indicative fire exits are placed beside roller doors; further exits are added once the design is confirmed.');
  await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door')).toHaveCount(0);
  // Customer personnel + double doors before ticking.
  await page.evaluate(() => { buildingDesignSetView('c'); buildingDesignAddDoor('personnel'); buildingDesignAddDoor('double'); });
  const kinds = () => page.evaluate(() => activeBuildingDesign.geometry.doors.map(d => d.type === 'personnel' ? (d.subtype === 'double' ? 'double' : 'personnel') : d.type));
  const personnelBefore = (await kinds()).filter(k => k === 'personnel').length;
  expect(personnelBefore).toBeGreaterThanOrEqual(1);
  await page.locator('#buildingDesignPdFireExits').check();
  expect((await stored(page, PROJECT_ID)).facts.personnelDoorsAsFireExits).toBe(true);
  // Ticking deletes the single personnel doors (one Undo step); double doors stay.
  expect((await kinds()).filter(k => k === 'personnel')).toHaveLength(0);
  expect((await kinds()).filter(k => k === 'double')).toHaveLength(1);
  await page.locator('#buildingDesignUndo').click();
  expect((await kinds()).filter(k => k === 'personnel')).toHaveLength(personnelBefore);
  await page.locator('#buildingDesignPdFireExits').uncheck();
  await page.locator('#buildingDesignPdFireExits').check();
  expect((await kinds()).filter(k => k === 'personnel')).toHaveLength(0);
  await option.screenshot({ path: process.env.FE_PD_OPTION_SCREENSHOT || require('os').tmpdir() + '/fe-pd-option.png' });
  // Before confirmation: no fire doors drawn at all (they appear only on a confirmed design).
  await page.evaluate(() => buildingDesignSetView('plan'));
  const rollers = (await stored(page, PROJECT_ID)).geometry?.doors?.filter(d => d.type === 'roller').length
    ?? await page.evaluate(() => activeBuildingDesign.geometry.doors.filter(d => d.type === 'roller').length);
  expect(rollers).toBeGreaterThan(0);
  await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door')).toHaveCount(0);
  expect((await stored(page, PROJECT_ID)).backgroundChecks).toBeFalsy();
  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Building Design', exact: true })).toBeVisible();
  await expect(page.locator('#buildingDesignPdFireExits')).toBeDisabled();
  const p = await stored(page, PROJECT_ID);
  const fe = p.backgroundChecks.fireExits;
  expect(fe.personnelDoorsAsFireExits).toBe(true);
  expect(fe.doors.filter(d => d.rollerAdjacent)).toHaveLength(rollers);
  expect(fe.maxPerimeterGap).toBeLessThanOrEqual(33.5);
  expect(p.geometry.doors.some(d => d.type === 'fireExit' || /^FE/.test(d.ref || ''))).toBe(false);
  // Saved geometry: no customer single personnel doors, the double door kept.
  expect(p.geometry.doors.filter(d => d.type === 'personnel' && d.subtype !== 'double')).toHaveLength(0);
  expect(p.geometry.doors.filter(d => d.type === 'personnel' && d.subtype === 'double')).toHaveLength(1);
  await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door')).toHaveCount(fe.doors.length);
  expect(await page.locator('#buildingDesignSvg .bd-plan-fire-pushbar').count()).toBe(fe.doors.length);
  await page.locator('#buildingDesignSvg').screenshot({ path: process.env.FE_PD_PLAN_SCREENSHOT || require('os').tmpdir() + '/fe-pd-plan.png' });
  // Elevation: push bar + FE label above, no FE badge inside the door.
  await page.evaluate(() => buildingDesignSetView('a'));
  expect(await page.locator('#buildingDesignSvg .bd-auto-fire-door .bd-fire-pushbar').count()).toBeGreaterThan(0);
  expect(await page.locator('#buildingDesignSvg .bd-auto-fire-door .bd-fire-label').count()).toBeGreaterThan(0);
  expect(await page.locator('#buildingDesignSvg .bd-auto-fire-door .bd-fire-badge').count()).toBe(0);
  if (process.env.FE_PD_COUNTS) require('fs').writeFileSync(process.env.FE_PD_COUNTS, JSON.stringify({ on: fe.doors.length, rollerAdjacent: rollers, gap: fe.maxPerimeterGap }));
  // Edit clears every auto-placed door from the store.
  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true })).toBeVisible();
  const edited = (await stored(page, PROJECT_ID)).backgroundChecks;
  expect(edited.fireExits).toBeUndefined();
  // Option on: no roller-adjacent preview either — nothing drawn while editing.
  for (const view of ['plan', 'a', 'b', 'c', 'd']) {
    await page.evaluate(v => buildingDesignSetView(v), view);
    await expect(page.locator('#buildingDesignSvg .bd-auto-fire-door')).toHaveCount(0);
  }
  expect(edited.buildingRegs.stale).toBe(true);
  expect(errors).toEqual([]);
});

test('building-regs calculation: runs after saves, travel flag at 32 m, no fire exits until confirmed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  // Pure travel rule: 50 x 30 m with one roller door -> one 160 m run flagged; doors 30 m apart round the loop -> none.
  const travel = await page.evaluate(() => ({
    one: pcBuildingRegsTravel(30, 50, [{ type: 'roller', ref: 'R1', wall: 'front', offset: 12, width: 4 }], null),
    spaced: pcBuildingRegsTravel(30, 50, [0, 1, 2, 3, 4, 5].map(i => ({ type: 'personnel', ref: 'P' + (i + 1), wall: ['left', 'left', 'front', 'right', 'right', 'back'][i], offset: [10, 40, 15, 10, 40, 15][i], width: 1 })), null),
  }));
  expect(travel.one.flags).toHaveLength(1);
  expect(travel.one.flags[0].length).toBe(160);
  expect(travel.spaced.flags).toHaveLength(0);
  expect(travel.spaced.maxRun).toBeLessThanOrEqual(32);
  // A trigger point (Building Design draft save) stores the calculation without fire exits.
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
  await page.evaluate(() => { buildingDesignSetView('b'); buildingDesignAddDoor('personnel'); });
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const p = await stored(page, PROJECT_ID);
  const regs = p.backgroundChecks.buildingRegs;
  expect(regs.designConfirmed).toBe(false);
  expect(regs.fireExits).toBeNull();
  expect(regs.stale).toBe(false);
  expect(regs.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(regs.boundaryDistances.A).toBeGreaterThan(1.8);
  expect(regs.boundaryDistances.B).toBeLessThan(0.8);
  const pd = regs.clearSpace.exits.find(x => x.kind === 'personnel' && x.elevation === 'B');
  expect(typeof pd.distance).toBe('number');
  expect(pd.ok).toBe(pd.distance >= 1.8);
  expect(p.backgroundChecks.fireExits).toBeUndefined();
  // Re-run from the Site Layout / Map save hook updates the fingerprint when the boundary moves.
  const before = regs.inputsFingerprint;
  const after = await page.evaluate(id => { const q = getP(id); q.facts.relevantBoundaries = q.facts.relevantBoundaries.slice(0, 1); return pcBuildingRegsRun(q); }, PROJECT_ID);
  expect(after.inputsFingerprint).not.toBe(before);
  expect(after.boundaryDistances.B).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('Open Stage 1 Free Report: not on the Project Summary; on Building Design, enabled only when Site Layout and Building Design are confirmed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/#stage1Confirm/${PROJECT_ID}`);
  await expect(page.locator('.confirmation-action-buttons')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Stage 1 Free Report' })).toHaveCount(0);
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  const button = page.getByRole('button', { name: 'Open Stage 1 Free Report', exact: true });
  const note = page.locator('#buildingDesignFreeReportNote');
  await expect(button).toBeDisabled();
  await expect(note).toHaveText('Complete Site Layout and Building Design to open the free report.');
  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  await expect(button).toBeEnabled();
  await expect(note).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  await expect(button).toBeDisabled();
  await expect(note).toHaveText('Complete Site Layout and Building Design to open the free report.');
  await page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true }).click();
  await expect(button).toBeEnabled();
  // Site Layout not confirmed -> disabled.
  await page.evaluate(id => { getP(id).facts.siteLayoutStatus = 'needs_reconfirmation'; buildingDesignRenderActions(); }, PROJECT_ID);
  await expect(button).toBeDisabled();
  await page.evaluate(id => { getP(id).facts.siteLayoutStatus = 'confirmed'; buildingDesignRenderActions(); }, PROJECT_ID);
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page).toHaveURL(/#stage1Summary\//);
  expect((await stored(page, PROJECT_ID)).stage1SummaryConfirmed).toBe(true);
  expect(errors).toEqual([]);
});

test('roller-adjacent fire exits: client moves each to the left or right of its roller door; stored and kept after reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
  await page.locator('#buildingDesignPdFireExits').check();
  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Building Design', exact: true })).toBeVisible();
  let p = await stored(page, PROJECT_ID);
  const roller = p.geometry.doors.find(d => d.type === 'roller');
  const adjOf = q => q.backgroundChecks.fireExits.doors.find(d => d.rollerAdjacent && d.forRollerId === roller.id);
  const first = adjOf(p);
  expect(first).toBeTruthy();
  const other = first.rollerSide === 'left' ? 'right' : 'left';
  const sideOk = (d, side) => side === 'left' ? d.offset + d.width <= roller.offset : d.offset >= roller.offset + roller.width;
  expect(sideOk(first, first.rollerSide)).toBe(true);
  const row = page.locator(`#buildingDesignFireExitSides .bd-fire-side-row[data-fire-exit="${first.ref}"]`);
  await expect(row).toBeVisible();
  await row.locator(`button[data-fire-side="${other}"]`).click();
  await expect(row.locator(`button[data-fire-side="${other}"]`)).toHaveAttribute('aria-pressed', 'true');
  p = await stored(page, PROJECT_ID);
  expect(p.buildingDesign.fireExitRollerSides[roller.id]).toBe(other);
  const moved = adjOf(p);
  expect(moved.rollerSide).toBe(other);
  expect(sideOk(moved, other)).toBe(true);
  // Still adjacent: within one bay of the roller door, still an indicative fire exit.
  expect(Math.min(Math.abs(moved.offset - (roller.offset + roller.width)), Math.abs(roller.offset - (moved.offset + moved.width)))).toBeLessThan(6);
  expect(moved.type).toBe('fireExit');
  expect(p.geometry.doors.some(d => d.type === 'fireExit')).toBe(false);
  expect(p.backgroundChecks.fireExits.maxPerimeterGap).toBeLessThanOrEqual(33.5);
  // Plan and the roller's elevation draw the moved FE (push bar + label).
  await page.evaluate(() => buildingDesignSetView('plan'));
  const planFe = page.locator(`#buildingDesignSvg .bd-auto-fire-door[data-fire-exit="${moved.ref}"]`);
  await expect(planFe).toHaveCount(1);
  await expect(planFe.locator('.bd-plan-fire-pushbar')).toHaveCount(1);
  await page.setViewportSize({ width: 1280, height: 1800 });
  await page.locator('#buildingDesignSvg').screenshot({ path: process.env.FE_SWAP_SCREENSHOT || require('os').tmpdir() + '/fe-swap.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  const view = { front: 'a', right: 'b', back: 'c', left: 'd' }[roller.wall];
  await page.evaluate(v => buildingDesignSetView(v), view);
  const elevFe = page.locator(`#buildingDesignSvg .bd-auto-fire-door[data-fire-exit="${moved.ref}"]`);
  await expect(elevFe.locator('.bd-fire-pushbar')).toHaveCount(1);
  await expect(elevFe.locator('.bd-fire-label')).toHaveText(moved.ref);
  // Reload: same side.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit Building Design', exact: true })).toBeVisible();
  p = await stored(page, PROJECT_ID);
  expect(adjOf(p).rollerSide).toBe(other);
  await expect(page.locator(`#buildingDesignFireExitSides button[data-fire-side="${other}"][aria-pressed="true"]`)).toHaveCount(1);
  // Edit deletes the fire doors; the side preference stays for the next confirm.
  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  p = await stored(page, PROJECT_ID);
  expect(p.backgroundChecks.fireExits).toBeUndefined();
  expect(p.buildingDesign.fireExitRollerSides[roller.id]).toBe(other);
  await page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true }).click();
  p = await stored(page, PROJECT_ID);
  expect(adjOf(p).rollerSide).toBe(other);
  expect(errors).toEqual([]);
});

test('Open Stage 1 Free Report button matches Back to Site Layout in the action bar', async ({ page }) => {
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  const back = page.locator('#buildingDesignActions .bd-action-buttons .bd-back');
  const report = page.getByRole('button', { name: 'Open Stage 1 Free Report', exact: true });
  await expect(report).toBeEnabled();
  const styles = loc => loc.evaluate(el => { const c = getComputedStyle(el), r = el.getBoundingClientRect(); return { height: Math.round(r.height), width: Math.round(r.width), padding: c.padding, radius: c.borderRadius, fontSize: c.fontSize, fontWeight: c.fontWeight, lineHeight: c.lineHeight, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, background: c.backgroundColor }; });
  const b = await styles(back), r = await styles(report);
  expect(r).toEqual(b);
  await page.locator('#buildingDesignActions').screenshot({ path: process.env.BD_ACTIONS_SCREENSHOT || require('os').tmpdir() + '/bd-actions.png' });
  // Disabled (after Edit) keeps the same proportions.
  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  await expect(report).toBeDisabled();
  const d = await styles(report);
  expect({ height: d.height, width: d.width, padding: d.padding, radius: d.radius, fontSize: d.fontSize }).toEqual({ height: b.height, width: b.width, padding: b.padding, radius: b.radius, fontSize: b.fontSize });
});
