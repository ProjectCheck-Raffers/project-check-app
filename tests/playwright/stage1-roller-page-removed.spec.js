// The Stage 1 "Roller door sizes and access" page was removed (2026-11-14).
// Only the vehicle-door COUNT question remains; door sizes live in Building Design.
// Browser-local data only (no live Supabase), same seeding approach as stage1-steel-journey.
const { test, expect } = require('@playwright/test');

const KEY = 'projectcheck_master_v1';
const user = { id: 'roller-test-user', email: 'roller@example.invalid', name: 'Test Reviewer', company: 'Example Warehouse' };
const baseFacts = {
  role: 'Facilities Manager', buildingUse: 'Warehousing and general storage', buildingType: 'Free-standing building',
  length: '24', width: '15', height: '5', roofPitch: '10', heated: 'Yes', base: 'Tarmac / asphalt',
};
const answered = {
  ...{}, personnelDoors: '1', buildingPositionStatus: 'confirmed', level: 'No', services: 'No',
  siteBoundaryStatus: 'skipped', closeBoundary: 'No', programme: '3–6 months',
};
const confirmedSite = {
  siteLayoutStatus: 'confirmed', siteLayoutSiteAddress: 'Demonstration site, SW1A 1AA', siteLayoutConfirmedAt: '2026-11-03T10:00:00.000Z',
  buildingFootprint: { center: { lat: 53.1027, lng: -1.3702 }, width: 15, length: 24, angle: 0,
    corners: [{ lat: 53.1028, lng: -1.3704 }, { lat: 53.1029, lng: -1.3700 }, { lat: 53.1026, lng: -1.3699 }, { lat: 53.1025, lng: -1.3703 }] },
  siteLayoutMapView: { center: { lat: 53.1027, lng: -1.3702 }, zoom: 19, bearing: 0, baseLayer: 'satellite' },
};
Object.assign(answered, confirmedSite);
const project = (id, facts) => ({
  id, owner: user.id, name: 'Roller Test', address: 'Demonstration site, SW1A 1AA', facts,
  stage: 'Stage 1', stage2: {}, evidence: [], quotes: [], history: [], downloads: { s1: 0, s2: 0 },
});

async function seed(page, projects) {
  await page.route('**/platform-config.js?*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(({ key, user, projects }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ user, users: [user], projects }));
  }, { key: KEY, user, projects });
}
const stored = (page, id) => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id), { key: KEY, id });

test.describe('Stage 1 roller-door sizes page removed', () => {
  test('a nonzero vehicle-door count goes straight to the next question and saves only the count', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await seed(page, [project('11111111-1111-4111-8111-000000000001', { ...baseFacts })]);
    await page.goto('/#stage1/11111111-1111-4111-8111-000000000001');
    await expect(page.locator('.q-content h2')).toContainText('vehicle doors');
    await page.locator('#answer').fill('3');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect(page.locator('.q-content h2')).toContainText('personnel doors');
    await expect(page.getByText('Roller door sizes and access')).toHaveCount(0);
    await expect(page.getByText('Stage 1 · Roller doors')).toHaveCount(0);
    const p = await stored(page, '11111111-1111-4111-8111-000000000001');
    expect(p.facts.rollerCount).toBe('3');
    expect(p.facts).not.toHaveProperty('rollerDoors');
    expect(errors).toEqual([]);
  });

  test('invalid counts are still rejected', async ({ page }) => {
    await seed(page, [project('11111111-1111-4111-8111-000000000002', { ...baseFacts })]);
    await page.goto('/#stage1/11111111-1111-4111-8111-000000000002');
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await page.locator('#answer').fill('21');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    expect(dialogs.join('|')).toContain('Enter a whole number from 0 to 20.');
    expect((await stored(page, '11111111-1111-4111-8111-000000000002')).facts.rollerCount).toBeUndefined();
  });

  test('completion never needs door sizes; Building Design seeds counted doors with fallback size', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await seed(page, [project('11111111-1111-4111-8111-000000000003', { ...baseFacts, ...answered, rollerCount: '3' })]);
    await page.goto('/#stage1Confirm/11111111-1111-4111-8111-000000000003');
    await expect(page.getByRole('heading', { name: /Check what we already know/ })).toBeVisible();
    const r = await page.evaluate(() => {
      const p = getP('11111111-1111-4111-8111-000000000003');
      return { gaps: stage1SteelReportGaps(p), doors: deriveGeometryFromFacts(p).doors.filter(d => d.type === 'roller') };
    });
    expect(r.gaps).not.toContain('Vehicle door details');
    expect(r.doors).toHaveLength(3);
    expect(r.doors.every(d => d.width === 4.6 && d.height === 4)).toBe(true);
    await page.goto('/#buildingLayout/11111111-1111-4111-8111-000000000003');
    await expect(page.getByRole('heading', { name: 'Design your building' })).toBeVisible();
    await page.getByRole('button', { name: /Roller door 1/ }).first().click();
    await expect(page.locator('#buildingDesignRollerAccess')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('old saved rollerDoors still load and seed the drawing; missing data never throws', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await seed(page, [
      project('11111111-1111-4111-8111-000000000004', { ...baseFacts, ...answered, rollerCount: '2', rollerDoors: [
        { width: '5', height: '5', access: 'HGV', widthSource: 'user', heightSource: 'user' },
        { width: '4.2', height: '4', access: 'Van', widthSource: 'user', heightSource: 'user' }] }),
      project('11111111-1111-4111-8111-000000000005', { ...baseFacts, ...answered }),
    ]);
    await page.goto('/#stage1Confirm/11111111-1111-4111-8111-000000000004');
    // The doors section was removed from the Project Summary (Building Design shows the roller doors).
    await expect(page.locator('.confirmation-outstanding')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Roller doors' })).toHaveCount(0);
    const old = await page.evaluate(() => deriveGeometryFromFacts(getP('11111111-1111-4111-8111-000000000004')).doors.filter(d => d.type === 'roller').map(d => [d.width, d.height, d.access]));
    expect(old).toEqual([[5, 5, 'HGV'], [4.2, 4, 'Van']]);
    const none = await page.evaluate(() => ({
      doors: deriveGeometryFromFacts(getP('11111111-1111-4111-8111-000000000005')).doors.filter(d => d.type === 'roller').length,
      gaps: stage1SteelReportGaps(getP('11111111-1111-4111-8111-000000000005')),
    }));
    expect(none.doors).toBe(0);
    expect(none.gaps).not.toContain('Vehicle door details');
    await page.goto('/#stage1Summary/11111111-1111-4111-8111-000000000005');
    await expect(page.getByRole('heading', { name: /Stage 1 Free Report/ })).toBeVisible();
    await page.goto('/#buildingLayout/11111111-1111-4111-8111-000000000005');
    await expect(page.getByRole('heading', { name: 'Design your building' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('reducing the count trims saved details but keeps the rest', async ({ page }) => {
    await seed(page, [project('11111111-1111-4111-8111-000000000006', { ...baseFacts, rollerCount: '2', rollerDoors: [
      { width: '5', height: '5', access: 'HGV' }, { width: '4.2', height: '4', access: 'Van' }] })]);
    await page.goto('/#stage1/11111111-1111-4111-8111-000000000006');
    await page.evaluate(() => moveStage1('11111111-1111-4111-8111-000000000006', 0));
    await expect(page.locator('#answer')).toHaveValue('2');
    await page.locator('#answer').fill('1');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect(page.locator('.q-content h2')).toContainText('personnel doors');
    const p = await stored(page, '11111111-1111-4111-8111-000000000006');
    expect(p.facts.rollerCount).toBe('1');
    expect(p.facts.rollerDoors).toEqual([{ width: '5', height: '5', access: 'HGV' }]);
  });
});
