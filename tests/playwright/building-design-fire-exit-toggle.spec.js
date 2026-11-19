// Building Design: compact fire-exit toggle with corrected wording (2026-11-18,
// Stuart). One line: checkbox + "Fire exits can also be used as personnel
// doors" + an ⓘ button that shows/hides the explanation. The stored value
// (p.facts.personnelDoorsAsFireExits) and behaviour are unchanged.
// Browser-local data only (no live Supabase).
const { test, expect } = require('@playwright/test');

const KEY = 'projectcheck_master_v1';
const ID = '33333333-3333-4333-8333-0000000000f1';
const CENTER = { lat: 53.1027, lng: -1.3702 };
const user = { id: 'fire-toggle-user', email: 'fire-toggle@example.invalid', name: 'Test Reviewer' };
const project = {
  id: ID, owner: user.id, name: 'Fire Exit Toggle Test', address: 'Unit 15, Demonstration Estate, DE55 4RF', postcode: 'DE55 4RF',
  status: 'Active', stage: 'Stage 1', created: '2026-11-14T09:00:00.000Z',
  facts: {
    role: 'Managing Director', buildingUse: 'Warehousing and general storage', buildingType: 'Free-standing building',
    length: '50', width: '30', height: '6', roofPitch: '10',
    rollerDoors: [{ width: '4.6', height: '4', access: 'HGV loading' }],
    buildingPositionStatus: 'confirmed', siteLayoutStatus: 'confirmed', siteBoundaryStatus: 'skipped',
    siteLayoutSiteAddress: 'Unit 15, Demonstration Estate, DE55 4RF', siteLayoutConfirmedAt: '2026-11-14T10:00:00.000Z',
    buildingFootprint: { center: CENTER, width: 30, length: 50, angle: 0 }, relevantBoundaries: [],
    siteLayoutMapView: { center: CENTER, zoom: 19, bearing: 0, baseLayer: 'satellite' },
  },
  stage2: {}, evidence: [], quotes: [], supplierRequest: null, risks1: [], actions1: [], risks2: [], actions2: [],
  history: [], downloads: { s1: 0, s2: 0 }, stage1Complete: false, stage2Complete: false, plan: null,
};
const LABEL = 'Fire exits can also be used as personnel doors';
const INFO = 'Fire exits can double as personnel doors. Indicative fire exits are placed beside roller doors; further exits are added once the design is confirmed.';

async function seed(page) {
  await page.route('**/platform-config.js?*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, { key: KEY, value: { user, users: [user], projects: [project] } });
}
const storedOption = page => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).projects.find(p => p.id === id).facts.personnelDoorsAsFireExits, { key: KEY, id: ID });

for (const width of [1280, 375]) {
  test(`compact fire-exit toggle: wording, ⓘ explanation and checkbox (${width}px)`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await seed(page);
    await page.goto(`/#buildingLayout/${ID}`);
    await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
    const option = page.locator('#buildingDesignFireExitOption');
    await expect(option).toBeVisible();
    const checkbox = page.getByRole('checkbox', { name: LABEL });
    await expect(checkbox).toBeVisible();
    await expect(option).not.toContainText('Use personnel doors as fire exits');

    // Explanation hidden by default; ⓘ toggles it with aria-expanded.
    const info = page.getByRole('button', { name: 'About fire exits and personnel doors' });
    const text = page.locator('#buildingDesignFireExitInfo');
    await expect(info).toHaveAttribute('aria-expanded', 'false');
    await expect(text).toBeHidden();
    await info.click();
    await expect(info).toHaveAttribute('aria-expanded', 'true');
    await expect(text).toBeVisible();
    await expect(text).toHaveText(INFO);
    await info.click();
    await expect(info).toHaveAttribute('aria-expanded', 'false');
    await expect(text).toBeHidden();

    // Compact: checkbox, label and ⓘ on one line.
    const boxes = await Promise.all([checkbox, page.locator('#buildingDesignFireExitOption label span'), info].map(l => l.boundingBox()));
    const mids = boxes.map(b => b.y + b.height / 2);
    expect(Math.max(...mids) - Math.min(...mids)).toBeLessThan(8);
    expect((await option.boundingBox()).height).toBeLessThan(50);

    // Checkbox behaviour and stored value unchanged; the label stays visible
    // and on one line when ticked, after the bar redraws, and when unticked.
    const labelText = page.locator('#buildingDesignFireExitOption .bd-fire-option-text');
    const oneLine = async () => {
      await expect(labelText).toBeVisible();
      await expect(labelText).toHaveText(LABEL);
      await expect(info).toBeVisible();
      const [c, l, i] = await Promise.all([page.locator('#buildingDesignPdFireExits'), labelText, info].map(x => x.boundingBox()));
      expect(l.width).toBeGreaterThan(100);
      const mids = [c, l, i].map(b => b.y + b.height / 2);
      expect(Math.max(...mids) - Math.min(...mids)).toBeLessThan(8);
      expect(l.height).toBeLessThan(24);
    };
    await expect(checkbox).not.toBeChecked();
    // A customer personnel door, so ticking also deletes it (the real redraw path).
    await page.evaluate(() => buildingDesignAddDoor('personnel'));
    // The toggle is updated in place, not rebuilt, when the bar redraws.
    await page.evaluate(() => { document.getElementById('buildingDesignFireExitOption').dataset.keep = '1'; });
    await checkbox.click();
    await expect(page.getByRole('checkbox', { name: LABEL })).toBeChecked();
    expect(await storedOption(page)).toBe(true);
    expect(await page.evaluate(() => document.getElementById('buildingDesignFireExitOption').dataset.keep)).toBe('1');
    await oneLine();
    await page.evaluate(() => buildingDesignRenderInteractive());
    await expect(page.getByRole('checkbox', { name: LABEL })).toBeChecked();
    await oneLine();
    await page.getByRole('checkbox', { name: LABEL }).click();
    await expect(page.getByRole('checkbox', { name: LABEL })).not.toBeChecked();
    expect(await storedOption(page)).toBe(false);
    await oneLine();

    // Greyed confirmed state, ticked: still visible on one line.
    await page.getByRole('checkbox', { name: LABEL }).click();
    await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit Building Design', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: LABEL })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: LABEL })).toBeDisabled();
    await oneLine();
    // Editing the confirmed design: tick state kept, enabled again, label visible.
    await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: LABEL })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: LABEL })).toBeChecked();
    await oneLine();
    await page.getByRole('checkbox', { name: LABEL }).click();
    await expect(page.getByRole('checkbox', { name: LABEL })).not.toBeChecked();
    await oneLine();
    expect(errors).toEqual([]);
  });
}
