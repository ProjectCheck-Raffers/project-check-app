const { test, expect } = require('@playwright/test');

const KEY = 'projectcheck_master_v1';
const user = { id: 'docs-user', email: 'docs@example.invalid', name: 'Docs Tester', company: 'Example' };
const id = '125ad986-9089-476d-987e-e8539117c2a2';
const doc = (name, discipline) => ({ name, at: '2026-11-01T10:00:00Z', size: 10, type: 'application/pdf', ...(discipline ? { discipline } : {}) });
const project = {
  id, owner: user.id, name: 'Documents Test Project', address: '1 Test Road, SW1A 1AA',
  facts: { buildingType: 'Free-standing building', length: '24', width: '15', height: '5' },
  stage: 'Stage 1', stage2: {}, quotes: [], history: [], downloads: { s1: 0, s2: 0 },
  evidence: [doc('arch.pdf', 'Architectural'), doc('civ.pdf', 'Civils'), doc('struct.pdf', 'Structural'), doc('fire.pdf', 'Fire'), doc('other.pdf', 'Other'), doc('nodisc.pdf')],
};

async function open(page, width) {
  await page.setViewportSize({ width, height: 800 });
  await page.route('**/platform-config.js?*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(({ key, user, project }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ user, users: [user], projects: [project] }));
  }, { key: KEY, user, project });
  await page.goto('/#projectDocuments/' + id);
  await page.waitForSelector('#documentDiscipline');
}
const visibleNames = page => page.locator('.document-register tbody tr[data-discipline]:not([hidden]) strong').allTextContents();

for (const width of [360, 390, 412, 1440]) {
  test(`Choose files button is fully visible on one line at ${width}px`, async ({ page }) => {
    await open(page, width);
    const button = page.locator('label[for=projectDocumentFiles]');
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    const card = await page.locator('.document-upload-card').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(card.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.width).toBeGreaterThanOrEqual(110);
    expect(box.height).toBeLessThan(60); // single line (two lines would be ~60px+)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('discipline filter filters the list; unclassified documents count as Other', async ({ page }) => {
  await open(page, 390);
  expect(await visibleNames(page)).toHaveLength(6);
  const expected = { Architectural: ['arch.pdf'], Civils: ['civ.pdf'], Structural: ['struct.pdf'], Fire: ['fire.pdf'], Other: ['other.pdf', 'nodisc.pdf'] };
  for (const [discipline, names] of Object.entries(expected)) {
    await page.selectOption('#documentDiscipline', discipline);
    expect(await visibleNames(page)).toEqual(names);
  }
  await page.selectOption('#documentDiscipline', 'All disciplines');
  expect(await visibleNames(page)).toHaveLength(6);
});

test('a document discipline can be set, persists, and the active filter updates', async ({ page }) => {
  await open(page, 390);
  await page.selectOption('#documentDisciplineRow5', 'Fire');
  await page.selectOption('#documentDiscipline', 'Fire');
  expect(await visibleNames(page)).toEqual(['fire.pdf', 'nodisc.pdf']);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).projects[0].evidence[5].discipline, KEY)).toBe('Fire');
  await page.selectOption('#documentDiscipline', 'Civils');
  await page.selectOption('#documentDisciplineRow1', 'Other');
  expect(await visibleNames(page)).toEqual([]);
  await expect(page.locator('#documentFilterEmpty')).toBeVisible();
});
