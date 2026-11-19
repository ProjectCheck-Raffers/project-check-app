// Stage 1 Free Report: "Base and foundations" advice (2026-11-18, Stuart).
// The base is designed by a structural engineer or suitable specialist from the
// building's reaction (support load) documents; Project Check advises only and
// gives no costs. Groundworks should not start before the building is ordered.
// Browser-local data only (no live Supabase), same seeding approach as
// stage1-roller-page-removed.spec.js.
const { test, expect } = require('@playwright/test');

const KEY = 'projectcheck_master_v1';
const ID = '11111111-1111-4111-8111-0000000000b1';
const user = { id: 'base-note-user', email: 'base-note@example.invalid', name: 'Test Reviewer', company: 'Example Warehouse' };
const facts = {
  role: 'Facilities Manager', buildingUse: 'Warehousing and general storage', buildingType: 'Free-standing building',
  length: '24', width: '15', height: '5', roofPitch: '10', heated: 'Yes', base: 'Tarmac / asphalt', intendsToReuseExistingBase: 'No',
  rollerCount: '1', buildingPositionStatus: 'confirmed', siteBoundaryStatus: 'skipped', closeBoundary: 'No',
  siteLayoutStatus: 'confirmed', siteLayoutSiteAddress: 'Demonstration site, SW1A 1AA', siteLayoutConfirmedAt: '2026-11-03T10:00:00.000Z',
  buildingFootprint: { center: { lat: 53.1027, lng: -1.3702 }, width: 15, length: 24, angle: 0,
    corners: [{ lat: 53.1028, lng: -1.3704 }, { lat: 53.1029, lng: -1.3700 }, { lat: 53.1026, lng: -1.3699 }, { lat: 53.1025, lng: -1.3703 }] },
  siteLayoutMapView: { center: { lat: 53.1027, lng: -1.3702 }, zoom: 19, bearing: 0, baseLayer: 'satellite' },
};
const project = {
  id: ID, owner: user.id, name: 'Base Note Test', address: 'Demonstration site, SW1A 1AA', facts,
  stage: 'Stage 1', stage2: {}, evidence: [], quotes: [], history: [], downloads: { s1: 0, s2: 0 },
  stage1SummaryConfirmed: true,
};
const ENGINEER = 'The base or foundations should be designed by a structural engineer or a suitable specialist, using the reaction (support load) documents supplied with the building design. Project Check gives advice only and does not design the base. No costs are given.';
const GROUNDWORKS = 'Avoid starting groundworks before the building is ordered and its reaction documents are available. If the base is built first, the column loads may need to be spread differently, and the slab or base may have to be redesigned and altered.';

async function seed(page) {
  await page.route('**/platform-config.js?*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(({ key, user, projects }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ user, users: [user], projects }));
  }, { key: KEY, user, projects: [project] });
}

test.describe('Stage 1 Free Report — base and foundations advice', () => {
  test('the report shows the structural-engineer and groundworks note with no costs', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await seed(page);
    await page.goto(`/#stage1Summary/${ID}`);
    expect(await page.evaluate(id => stage1SteelReportGaps(getP(id)), ID)).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Project Check — Stage 1 Free Report' })).toBeVisible();
    const note = page.getByRole('region', { name: 'Base and foundations' });
    await expect(note).toBeVisible();
    await expect(note.getByRole('heading', { name: 'Base and foundations' })).toBeVisible();
    await expect(note).toContainText(ENGINEER);
    await expect(note).toContainText(GROUNDWORKS);
    // Sits with the site observations.
    const order = await page.evaluate(() => {
      const site = document.querySelector('.stage1-site-observations'), base = document.querySelector('.stage1-base-foundations');
      return site && base && site.nextElementSibling === base;
    });
    expect(order).toBe(true);
    // Advice only: no monetary figures.
    expect(await note.innerText()).not.toMatch(/[£$€]|\d+\s*k\b/i);
    expect(errors).toEqual([]);
  });

  test('the Stage 1 PDF carries the same note', async ({ page }) => {
    await seed(page);
    await page.goto(`/#stage1Summary/${ID}`);
    await expect(page.getByRole('region', { name: 'Base and foundations' })).toBeVisible();
    const lines = await page.evaluate(async id => {
      const printed = [];
      const noop = () => {};
      window.jspdf = { jsPDF: function () {
        return new Proxy({}, { get: (_, prop) => {
          if (prop === 'splitTextToSize') return text => [String(text)];
          if (prop === 'text') return lines => printed.push(...[].concat(lines));
          if (prop === 'internal') return { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
          if (prop === 'then') return undefined;
          return noop;
        } });
      } };
      window.svgToPngDataUrl = async () => { throw new Error('skip image in test'); };
      await downloadReport(id, 's1');
      return printed;
    }, ID);
    const i = lines.indexOf('BASE AND FOUNDATIONS');
    expect(i).toBeGreaterThan(-1);
    expect(lines).toContain(`• ${ENGINEER}`);
    expect(lines).toContain(`• ${GROUNDWORKS}`);
  });
});
