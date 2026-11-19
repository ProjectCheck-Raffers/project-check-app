// Stage 1 report illustration must match the confirmed Building Design (Page 15B).
// The report sheet (drawing.js buildingDrawingSVG) reads the same saved geometry
// as the Building Design Plan / A / B / C / D views: doors, windows (at sill
// height), skylights and solar arrays, with the same elevation names
// (A = front, B = right, C = back, D = left).
const { test, expect } = require('@playwright/test');

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const STORAGE_KEY = 'projectcheck_master_v1';

function stateFixture() {
  const user = { id: 'user-report-match', email: 'report-match@example.test', name: 'Report match reviewer' };
  const facts = {
    role: 'Managing Director', buildingUse: 'Warehousing and general storage', buildingType: 'Free-standing building',
    constructionMaterial: 'Steel', windLoad: '0.70', length: '50', width: '30', height: '10', roofPitch: '5',
    rollerDoors: [{ width: '4.6', height: '5', access: 'HGV loading' }], personnelDoors: '1',
    buildingPositionStatus: 'confirmed', siteLayoutStatus: 'confirmed', siteBoundaryStatus: 'confirmed',
    siteLayoutConfirmedAt: '2026-11-03T10:00:00.000Z',
    buildingFootprint: {
      center: { lat: 51.8, lng: -0.7 }, width: 30, length: 50, angle: 107,
      corners: [{ lat: 51.8001, lng: -0.7003 }, { lat: 51.8002, lng: -0.6998 }, { lat: 51.7999, lng: -0.6997 }, { lat: 51.7998, lng: -0.7002 }],
    },
    relevantBoundaries: [],
  };
  const project = {
    id: PROJECT_ID, owner: user.id, name: 'Report match project', address: '5 College Rd N, Aston Clinton, Aylesbury HP22 5EZ',
    postcode: 'HP22 5EZ', status: 'Active', stage: 'Stage 1', created: '2026-11-03T09:00:00.000Z', facts, stage2: {},
    evidence: [], quotes: [], supplierRequest: null, risks1: [], actions1: [], risks2: [], actions2: [],
    history: [], downloads: { s1: 0, s2: 0 }, stage1Complete: true, stage2Complete: false, plan: null,
  };
  return { user, users: [user], projects: [project], stage3ImpactRegister: [] };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem('report-match-seeded') === '1') return;
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('report-match-seeded', '1');
  }, { key: STORAGE_KEY, value: stateFixture() });
});

test('report plan and elevations are drawn from the confirmed Building Design geometry', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();

  const confirmed = await page.evaluate(() => {
    const state = activeBuildingDesign, geometry = state.geometry;
    geometry.doors.push(
      { id: 'pd9001', ref: 'W2', type: 'window', wall: 'left', offset: 1.5, width: 2, height: 1, sillHeight: 8, bayIndex: 0, source: 'customer' },
      { id: 'pd9002', ref: 'W3', type: 'window', wall: 'right', offset: 6.5, width: 2, height: 1, sillHeight: 8, bayIndex: 1, source: 'customer' },
    );
    state.view = 'plan';
    buildingDesignAddSkylight();
    buildingDesignAddSolarArray();
    confirmBuildingDesign();
    const p = getP(state.projectId);
    return {
      status: p.buildingDesign.status,
      doors: p.geometry.doors.map(d => ({ ref: d.ref, wall: d.wall })),
      skylights: p.geometry.skylights.map(s => s.ref),
      solar: p.geometry.solarArrays.map(a => a.ref),
    };
  });
  expect(confirmed.status).toBe('confirmed');
  expect(confirmed.skylights).toHaveLength(1);
  expect(confirmed.solar).toHaveLength(1);

  // Render the report sheet from the saved project exactly as the report page does.
  const report = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = buildingDrawingSVG(getP(activeBuildingDesign.projectId));
    document.body.appendChild(host);
    const svg = host.querySelector('svg');
    const views = [...svg.querySelectorAll('[data-report-view]')].map(node => ({ key: node.dataset.reportView, wall: node.dataset.wall, text: node.textContent }));
    const elevationOpenings = [...svg.querySelectorAll('[data-report-view] [data-report-opening]')].map(node => ({ ref: node.dataset.reportOpening, wall: node.dataset.wall }));
    const result = {
      source: svg.dataset.reportSource,
      text: svg.textContent,
      views,
      elevationOpenings,
      skylights: [...svg.querySelectorAll('[data-report-skylight]')].map(node => node.dataset.reportSkylight),
      solar: [...svg.querySelectorAll('[data-report-solar]')].map(node => node.dataset.reportSolar),
    };
    host.remove();
    return result;
  });

  expect(report.source).toBe('building-design');
  // Same elevation names as the Building Design tabs.
  expect(report.views.map(v => [v.key, v.wall])).toEqual([['a', 'front'], ['b', 'right'], ['c', 'back'], ['d', 'left']]);
  expect(report.text).toContain('ELEVATION A — FRONT ELEVATION');
  expect(report.text).toContain('ELEVATION B — RIGHT SIDEWALL');
  expect(report.text).toContain('ELEVATION C — REAR ELEVATION');
  expect(report.text).toContain('ELEVATION D — LEFT SIDEWALL');
  expect(report.text).not.toContain('SIDE ELEVATION A');
  expect(report.text).not.toContain('GABLE ELEVATION');
  // Orientation bearings follow the confirmed site rotation (107°), as on Page 15B.
  expect(report.views.find(v => v.key === 'a').text).toContain('Facing east 107°');
  expect(report.views.find(v => v.key === 'd').text).toContain('Facing north 17°');
  // Roof openings appear on the plan.
  expect(report.skylights).toEqual(confirmed.skylights);
  expect(report.solar).toEqual(confirmed.solar);
  // Every saved door and window appears on the elevation for its own wall.
  for (const door of confirmed.doors) {
    expect(report.elevationOpenings, `${door.ref} on ${door.wall}`).toContainEqual({ ref: door.ref, wall: door.wall });
  }
  expect(pageErrors).toEqual([]);
});

test('report refreshes from the saved geometry after the design is edited and re-confirmed', async ({ page }) => {
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
  const before = await page.evaluate(() => {
    activeBuildingDesign.view = 'plan';
    buildingDesignAddSolarArray();
    confirmBuildingDesign();
    return buildingDrawingSVG(getP(activeBuildingDesign.projectId)).match(/data-report-solar=/g)?.length || 0;
  });
  expect(before).toBe(1);
  const after = await page.evaluate(() => {
    editConfirmedBuildingDesign();
    activeBuildingDesign.view = 'plan';
    buildingDesignAddSkylight();
    // Unsaved edits do not reach the report; the confirmed design still does.
    const unsaved = buildingDrawingSVG(getP(activeBuildingDesign.projectId)).match(/data-report-skylight=/g)?.length || 0;
    confirmBuildingDesign();
    const saved = buildingDrawingSVG(getP(activeBuildingDesign.projectId)).match(/data-report-skylight=/g)?.length || 0;
    return { unsaved, saved };
  });
  expect(after).toEqual({ unsaved: 0, saved: 1 });
});
