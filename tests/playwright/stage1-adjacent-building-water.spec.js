// Stage 1: linked / adjacent existing building and junction water ingress
// (2026-11-18, Stuart). One optional question in project details; a "Yes"
// answer adds a "Junction with existing building" card to the Stage 1 Free
// Report and the Stage 1 PDF. Browser-local data only (no live Supabase), same
// seeding approach as stage1-base-foundations-note.spec.js.
const { test, expect } = require('@playwright/test');

const KEY = 'projectcheck_master_v1';
const ID = '11111111-1111-4111-8111-0000000000c2';
const user = { id: 'adjacent-user', email: 'adjacent@example.invalid', name: 'Test Reviewer', company: 'Example Warehouse' };
const baseFacts = {
  role: 'Facilities Manager', buildingUse: 'Warehousing and general storage', buildingType: 'Free-standing building',
  length: '24', width: '15', height: '5', roofPitch: '10', heated: 'Yes', base: 'Tarmac / asphalt', intendsToReuseExistingBase: 'No',
  rollerCount: '1', buildingPositionStatus: 'confirmed', siteBoundaryStatus: 'skipped', closeBoundary: 'No',
  siteLayoutStatus: 'confirmed', siteLayoutSiteAddress: 'Demonstration site, SW1A 1AA', siteLayoutConfirmedAt: '2026-11-03T10:00:00.000Z',
  buildingFootprint: { center: { lat: 53.1027, lng: -1.3702 }, width: 15, length: 24, angle: 0,
    corners: [{ lat: 53.1028, lng: -1.3704 }, { lat: 53.1029, lng: -1.3700 }, { lat: 53.1026, lng: -1.3699 }, { lat: 53.1025, lng: -1.3703 }] },
  siteLayoutMapView: { center: { lat: 53.1027, lng: -1.3702 }, zoom: 19, bearing: 0, baseLayer: 'satellite' },
};
const makeProject = extra => ({
  id: ID, owner: user.id, name: 'Adjacent Building Test', address: 'Demonstration site, SW1A 1AA', facts: { ...baseFacts, ...extra },
  stage: 'Stage 1', stage2: {}, evidence: [], quotes: [], history: [], downloads: { s1: 0, s2: 0 },
  stage1SummaryConfirmed: true,
});
const QUESTION = 'Will the new building link to, or sit close to, an existing building?';
const OPTIONS = ['No — stands clear of other buildings', 'Yes — links or joins to an existing building', 'Yes — sits close to an existing building (within about 1 m)'];
const HEADING = 'Junction with existing building';
const WATER = 'Where the new building links to or sits close to an existing building, the junction needs designing to keep water out: flashings at roof and wall junctions, any gap or void between the buildings capped or given a route for water to drain away, and sealed service and cable entries.';
const AGREE = 'This should be agreed with the designer and installer before the building is ordered.';

async function seed(page, extra = {}) {
  await page.route('**/platform-config.js?*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(({ key, user, projects }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ user, users: [user], projects }));
  }, { key: KEY, user, projects: [makeProject(extra)] });
}

async function pdfLines(page) {
  return page.evaluate(async id => {
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
}

test.describe('Stage 1 — linked or adjacent existing building', () => {
  test('project details asks the optional question and saves the answer', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await seed(page, { temperatureCondition: 'Ambient working temperature — heated' });
    await page.goto(`/#projectSettings/${ID}`);
    const select = page.getByLabel(QUESTION);
    await expect(select).toBeVisible();
    const values = await select.locator('option').allTextContents();
    expect(values.slice(1)).toEqual(OPTIONS);
    await select.selectOption(OPTIONS[1]);
    await page.locator('#saveProjectSettings').click();
    const saved = await page.evaluate(id => getP(id).facts.adjacentExistingBuilding, ID);
    expect(saved).toBe(OPTIONS[1]);
    await page.goto(`/#stage1Confirm/${ID}`);
    await expect(page.getByText('Link to or near an existing building')).toBeVisible();
    await expect(page.getByText(OPTIONS[1]).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('leaving the question blank does not block saving', async ({ page }) => {
    await seed(page, { temperatureCondition: 'Ambient working temperature — heated' });
    await page.goto(`/#projectSettings/${ID}`);
    await expect(page.getByLabel(QUESTION)).toHaveValue('');
    page.on('dialog', d => { throw new Error(`Unexpected alert: ${d.message()}`); });
    await page.locator('#saveProjectSettings').click();
    await expect(page.locator('#saveProjectSettings')).toHaveCount(0);
    expect(await page.evaluate(id => 'adjacentExistingBuilding' in getP(id).facts, ID)).toBe(false);
  });

  for (const answer of OPTIONS.slice(1)) {
    test(`report shows the junction card for "${answer}"`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await seed(page, { adjacentExistingBuilding: answer });
      await page.goto(`/#stage1Summary/${ID}`);
      await expect(page.getByRole('heading', { name: 'Project Check — Stage 1 Free Report' })).toBeVisible();
      const card = page.getByRole('region', { name: HEADING });
      await expect(card).toBeVisible();
      await expect(card.getByRole('heading', { name: HEADING })).toBeVisible();
      await expect(card).toContainText(WATER);
      await expect(card).toContainText(AGREE);
      const order = await page.evaluate(() => {
        // Order after site observations: Base and foundations, then the junction card.
        const site = document.querySelector('.stage1-site-observations'), base = document.querySelector('.stage1-base-foundations'), j = document.querySelector('.stage1-adjacent-junction');
        return !!(site && base && j && site.nextElementSibling === base && base.nextElementSibling === j);
      });
      expect(order).toBe(true);
      expect(await card.innerText()).not.toMatch(/[£$€]|\d+\s*k\b/i);
      expect(errors).toEqual([]);
    });
  }

  for (const [label, extra] of [['No', { adjacentExistingBuilding: OPTIONS[0] }], ['unanswered', {}]]) {
    test(`report has no junction card when ${label}`, async ({ page }) => {
      await seed(page, extra);
      await page.goto(`/#stage1Summary/${ID}`);
      await expect(page.getByRole('heading', { name: 'Project Check — Stage 1 Free Report' })).toBeVisible();
      await expect(page.locator('.stage1-site-observations')).toBeVisible();
      await expect(page.getByRole('region', { name: HEADING })).toHaveCount(0);
      expect((await pdfLines(page)).includes(HEADING.toUpperCase())).toBe(false);
    });
  }

  test('the Stage 1 PDF carries the same junction note for a "Yes" answer', async ({ page }) => {
    await seed(page, { adjacentExistingBuilding: OPTIONS[2] });
    await page.goto(`/#stage1Summary/${ID}`);
    await expect(page.getByRole('region', { name: HEADING })).toBeVisible();
    const lines = await pdfLines(page);
    expect(lines.indexOf(HEADING.toUpperCase())).toBeGreaterThan(lines.indexOf('BASE AND FOUNDATIONS'));
    expect(lines.indexOf('BASE AND FOUNDATIONS')).toBeGreaterThan(-1);
    expect(lines).toContain(`• ${WATER}`);
    expect(lines).toContain(`• ${AGREE}`);
  });
});
