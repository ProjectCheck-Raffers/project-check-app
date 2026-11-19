const { test, expect } = require('@playwright/test');

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const STORAGE_KEY = 'projectcheck_master_v1';

function projectFixture(id, confirmedSite = true) {
  const address = id === PROJECT_ID
    ? 'Unit 15, Cotes Park Industrial Estate, Alfreton DE55 4RF'
    : '1 Other Site, Derby DE1 1AA';
  const facts = {
    role: 'Managing Director',
    buildingUse: 'Warehousing and general storage',
    buildingType: 'Free-standing building',
    constructionMaterial: 'Steel',
    windLoad: '0.70',
    length: '40',
    width: '24',
    height: '6',
    roofPitch: '10',
    rollerDoors: [{ width: '4.6', height: '4', access: 'HGV loading' }],
    personnelDoors: '1',
  };
  if (confirmedSite) {
    Object.assign(facts, {
      buildingPositionStatus: 'confirmed',
      siteLayoutStatus: 'confirmed',
      siteBoundaryStatus: 'confirmed',
      siteLayoutSiteAddress: address,
      siteLayoutConfirmedAt: '2026-11-03T10:00:00.000Z',
      buildingFootprint: {
        center: { lat: 53.1027, lng: -1.3702 },
        width: 24,
        length: 40,
        angle: 30,
        corners: [
          { lat: 53.1028, lng: -1.3704 },
          { lat: 53.1029, lng: -1.3700 },
          { lat: 53.1026, lng: -1.3699 },
          { lat: 53.1025, lng: -1.3703 },
        ],
      },
      relevantBoundaries: [[
        { lat: 53.1024, lng: -1.3705 },
        { lat: 53.1030, lng: -1.3698 },
      ]],
      siteLayoutMapView: {
        center: { lat: 53.1027, lng: -1.3702 },
        zoom: 19,
        bearing: 15,
        baseLayer: 'satellite',
      },
    });
  }
  return {
    id,
    owner: 'user-page-15b',
    name: id === PROJECT_ID ? 'Alfreton Distribution Building' : 'Isolated second project',
    address,
    postcode: id === PROJECT_ID ? 'DE55 4RF' : 'DE1 1AA',
    status: 'Active',
    stage: 'Stage 1',
    created: '2026-11-03T09:00:00.000Z',
    facts,
    stage2: {},
    evidence: [],
    quotes: [],
    supplierRequest: null,
    risks1: [],
    actions1: [],
    risks2: [],
    actions2: [],
    history: [{ at: '2026-11-03T09:00:00.000Z', text: 'Project created' }],
    downloads: { s1: 0, s2: 0 },
    stage1Complete: false,
    stage2Complete: false,
    plan: null,
  };
}

function stateFixture() {
  const user = {
    id: 'user-page-15b',
    email: 'page15b@example.test',
    name: 'Page 15B reviewer',
  };
  return {
    user,
    users: [user],
    projects: [projectFixture(PROJECT_ID, true), projectFixture(OTHER_PROJECT_ID, false)],
    stage3ImpactRegister: [],
  };
}

async function seedState(page) {
  const state = stateFixture();
  await page.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem('page15b-fixture-seeded') === '1') return;
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('page15b-fixture-seeded', '1');
  }, { key: STORAGE_KEY, value: state });
}

async function openBuildingDesign(page, id = PROJECT_ID) {
  await page.goto(`/#buildingLayout/${id}`);
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await seedState(page);
});

test('carries confirmed project facts into an editable, persistent and lockable design', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await openBuildingDesign(page);
  await expect(page.locator('.bd-project-facts')).toContainText('Alfreton Distribution Building');
  await expect(page.locator('.bd-project-facts')).toContainText('Alfreton');
  await expect(page.locator('.bd-project-facts')).toContainText('40.0 m × 24.0 m');
  await expect(page.locator('.bd-project-facts')).toContainText('Clear height 6.0 m');
  await expect(page.locator('.bd-project-facts')).toContainText('Roof pitch 10°');
  await expect(page.locator('.bd-project-facts')).toContainText('Indicative ridge 8.12 m');
  await expect(page.getByRole('heading', { name: 'Match openings to the site', exact: true })).toBeVisible();
  await expect(page.locator('#buildingDesignSiteMap')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Site elevation orientation' })).toContainText('A');
  await expect(page.getByRole('group', { name: 'Site elevation orientation' })).toContainText('B');
  await expect(page.getByRole('group', { name: 'Site elevation orientation' })).toContainText('C');
  await expect(page.getByRole('group', { name: 'Site elevation orientation' })).toContainText('D');

  for (const view of ['Plan', 'Elevation A', 'Elevation B', 'Elevation C', 'Elevation D']) {
    await expect(page.getByRole('button', { name: view, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Elevation A', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#buildingDesignSvg')).toHaveAttribute('aria-label', /Elevation A/);
  await expect(page.locator('#buildingDesignSvg')).toHaveAttribute('data-elevation-kind', 'gable');

  for (const [view, kind] of [['Elevation B', 'sidewall'], ['Elevation C', 'gable'], ['Elevation D', 'sidewall']]) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(page.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#buildingDesignSvg')).toHaveAttribute('data-elevation-kind', kind);
  }
  await page.getByRole('button', { name: 'Elevation A', exact: true }).click();

  await page.locator('.bd-add-buttons button').filter({ hasText: 'Personnel door' }).click();
  await expect(page.locator('.bd-selected-card h3')).toContainText('Personnel door');
  await expect(page.getByRole('button', { name: 'Left side of bay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Right side of bay', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Right side of bay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#buildingDesignDoorWidth').fill('1.20');
  await page.locator('#buildingDesignDoorWidth').press('Tab');
  await page.locator('#buildingDesignDoorHeight').fill('2.20');
  await page.locator('#buildingDesignDoorHeight').press('Tab');
  await page.getByRole('button', { name: /0\.1 m →/ }).click();
  await expect(page.locator('.bd-validation')).toHaveClass(/is-valid/);

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('.bd-current-view')).toContainText('Draft saved');

  let stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const savedProject = stored.projects.find(project => project.id === PROJECT_ID);
  const isolatedProject = stored.projects.find(project => project.id === OTHER_PROJECT_ID);
  expect(savedProject.buildingDesign.status).toBe('draft');
  expect(savedProject.geometry.width).toBe(24);
  expect(savedProject.geometry.length).toBe(40);
  expect(savedProject.geometry.ridgeHeight).toBe(8.12);
  const personnelDoor = savedProject.geometry.doors.find(door => door.type === 'personnel' && door.width === 1.2 && door.height === 2.2);
  expect(personnelDoor).toBeTruthy();
  const baySpacing = 24 / Math.round(24 / 5.2);
  const bayIndex = Math.floor((personnelDoor.offset + personnelDoor.width / 2) / baySpacing);
  expect(personnelDoor.offset + personnelDoor.width / 2).toBeGreaterThan((bayIndex + .5) * baySpacing);
  expect(isolatedProject.buildingDesign).toBeUndefined();
  expect(isolatedProject.geometry).toBeUndefined();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Design your building', exact: true })).toBeVisible();
  await expect(page.locator('.bd-current-view')).toContainText('Draft saved');
  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  await expect(page.locator('.bd-locked-badge')).toHaveText('Confirmed');
  await expect(page.getByRole('button', { name: 'Design confirmed', exact: true })).toBeDisabled();
  await expect(page.locator('.bd-add-buttons button').filter({ hasText: 'Roller door' })).toBeDisabled();

  stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.projects.find(project => project.id === PROJECT_ID).buildingDesign.status).toBe('confirmed');
  expect(stored.projects.find(project => project.id === PROJECT_ID).facts.buildingDesignStatus).toBe('confirmed');
  expect(stored.projects.find(project => project.id === OTHER_PROJECT_ID).buildingDesign).toBeUndefined();

  await page.reload();
  await expect(page.locator('.bd-locked-badge')).toHaveText('Confirmed');
  const selectedOpening = await page.evaluate(() => ({ id: buildingDesignSelectedDoor().id, offset: buildingDesignSelectedDoor().offset }));
  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  await expect(page.locator('#buildingDesignDoorWidth')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Cancel editing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /← 0\.1 m/ }).click();
  expect(await page.evaluate(() => buildingDesignSelectedDoor().offset)).not.toBe(selectedOpening.offset);

  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
  await expect(page.locator('.bd-locked-badge')).toHaveText('Confirmed');
  expect(await page.evaluate(() => buildingDesignSelectedDoor().offset)).toBe(selectedOpening.offset);

  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  await page.getByRole('button', { name: /← 0\.1 m/ }).click();
  const updatedOffset = await page.evaluate(() => buildingDesignSelectedDoor().offset);
  await page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true }).click();
  await expect(page.locator('.bd-locked-badge')).toHaveText('Confirmed');
  await page.reload();
  stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const updatedProject = stored.projects.find(project => project.id === PROJECT_ID);
  expect(updatedProject.buildingDesign.status).toBe('confirmed');
  expect(updatedProject.geometry.doors.find(door => door.id === selectedOpening.id).offset).toBe(updatedOffset);
  expect(pageErrors).toEqual([]);
});

test('supports left or right personnel doors, double doors and free 7 m gable rollers', async ({ page }) => {
  await openBuildingDesign(page);

  await page.locator('.bd-add-buttons button').filter({ hasText: 'Personnel door' }).click();
  const leftPersonnel = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  await expect(page.getByRole('button', { name: 'Left side of bay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Right side of bay', exact: true }).click();
  const rightPersonnel = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  expect(rightPersonnel.offset).toBeGreaterThan(leftPersonnel.offset);
  expect(rightPersonnel.baySide).toBe('right');

  await page.locator('.bd-add-buttons button').filter({ hasText: 'Double door' }).click();
  await expect(page.locator('.bd-selected-card h3')).toContainText('Double door');
  await expect(page.locator('#buildingDesignDoorWidth')).toHaveValue('2.00');
  await expect(page.locator('#buildingDesignDoorHeight')).toHaveValue('2.10');
  await page.getByRole('button', { name: 'Right side of bay', exact: true }).click();
  const doubleDoor = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  expect(doubleDoor.subtype).toBe('double');
  expect(doubleDoor.baySide).toBe('right');

  await page.locator('.bd-add-buttons button').filter({ hasText: 'Roller door' }).click();
  await page.locator('#buildingDesignDoorWidth').fill('7.00');
  await page.locator('#buildingDesignDoorWidth').press('Tab');
  await page.getByRole('button', { name: 'Centre', exact: true }).click();
  await expect(page.locator('#buildingDesignDoorWidth')).toHaveAttribute('max', '7');
  await expect(page.locator('.bd-opening-guidance')).toContainText('positioned freely');
  await expect(page.locator('.bd-free-position')).toHaveText('Free position on gable');
  expect(await page.locator('.bd-gable-column.is-adjusted').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.bd-gable-door-frame line')).toHaveCount(6);
  const columnsInsideDoor = await page.evaluate(() => {
    const door = buildingDesignSelectedDoor();
    const positions = buildingDesignGableColumnPositions(activeBuildingDesign.geometry, door.wall, buildingDesignBayInfo(activeBuildingDesign.geometry, door.wall));
    return positions.filter(position => position.metres > door.offset && position.metres < door.offset + door.width).length;
  });
  expect(columnsInsideDoor).toBe(0);
  const frontRoller = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  expect(frontRoller.wall).toBe('front');
  expect(frontRoller.width).toBe(7);
  expect(frontRoller.offset).toBe(8.5);

  await page.getByRole('button', { name: 'Elevation C', exact: true }).click();
  await page.locator('.bd-add-buttons button').filter({ hasText: 'Roller door' }).click();
  await page.locator('#buildingDesignDoorWidth').fill('7.00');
  await page.locator('#buildingDesignDoorWidth').press('Tab');
  await page.getByRole('button', { name: 'Centre', exact: true }).click();
  const rearRoller = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  expect(rearRoller.wall).toBe('back');
  expect(rearRoller.width).toBe(7);
  expect(rearRoller.offset).toBe(8.5);

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const savedProject = stored.projects.find(project => project.id === PROJECT_ID);
  expect(savedProject.geometry.width).toBe(24);
  expect(savedProject.geometry.length).toBe(40);
  expect(savedProject.geometry.eaveHeight).toBe(6);
  expect(savedProject.geometry.doors.some(door => door.subtype === 'double' && door.width === 2 && door.height === 2.1 && door.baySide === 'right')).toBe(true);
  expect(savedProject.geometry.doors.some(door => door.type === 'roller' && door.wall === 'front' && door.width === 7 && door.offset === 8.5)).toBe(true);
  expect(savedProject.geometry.doors.some(door => door.type === 'roller' && door.wall === 'back' && door.width === 7 && door.offset === 8.5)).toBe(true);
});

test('places personnel and double doors on either side of every sidewall bay and adds sidewall casement windows', async ({ page }) => {
  await openBuildingDesign(page);
  await page.getByRole('button', { name: 'Elevation B', exact: true }).click();

  const addButtons = page.locator('.bd-add-buttons button');
  await expect(addButtons).toHaveCount(5);
  for (const button of await page.locator('.bd-add-buttons button.btn').all()) {
    const box = await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(52);
  }

  await addButtons.filter({ hasText: 'Personnel door' }).click();
  const bayCount = await page.evaluate(() => buildingDesignBayInfo(activeBuildingDesign.geometry, 'right').count);
  for (let bayIndex = 0; bayIndex < bayCount; bayIndex += 1) {
    await page.evaluate(index => {
      const opening = buildingDesignSelectedDoor();
      buildingDesignMoveOpeningToBay(index - opening.bayIndex);
    }, bayIndex);
    await page.getByRole('button', { name: 'Left side of bay', exact: true }).click();
    let placement = await page.evaluate(() => {
      const opening = buildingDesignSelectedDoor();
      const bay = buildingDesignDoorBay(opening, activeBuildingDesign.geometry);
      return { offset: opening.offset, expected: Number((bay.start + .1).toFixed(2)), bayIndex: opening.bayIndex };
    });
    expect(placement.bayIndex).toBe(bayIndex);
    expect(placement.offset).toBe(placement.expected);

    await page.getByRole('button', { name: 'Right side of bay', exact: true }).click();
    placement = await page.evaluate(() => {
      const opening = buildingDesignSelectedDoor();
      const bay = buildingDesignDoorBay(opening, activeBuildingDesign.geometry);
      return { offset: opening.offset, expected: Number((bay.end - opening.width - .1).toFixed(2)), bayIndex: opening.bayIndex };
    });
    expect(placement.bayIndex).toBe(bayIndex);
    expect(placement.offset).toBe(placement.expected);
  }

  await addButtons.filter({ hasText: 'Double door' }).click();
  await page.getByRole('button', { name: 'Next bay →', exact: true }).click();
  await page.getByRole('button', { name: 'Right side of bay', exact: true }).click();
  const doublePlacement = await page.evaluate(() => {
    const opening = buildingDesignSelectedDoor();
    const bay = buildingDesignDoorBay(opening, activeBuildingDesign.geometry);
    return { ...opening, expected: Number((bay.end - opening.width - .1).toFixed(2)) };
  });
  expect(doublePlacement.width).toBe(2);
  expect(doublePlacement.height).toBe(2.1);
  expect(doublePlacement.baySide).toBe('right');
  expect(doublePlacement.offset).toBe(doublePlacement.expected);

  await page.getByRole('button', { name: 'Elevation A', exact: true }).click();
  await expect(page.getByRole('button', { name: /Casement window/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Elevation C', exact: true }).click();
  await expect(page.getByRole('button', { name: /Casement window/ })).toBeDisabled();

  await page.getByRole('button', { name: 'Elevation B', exact: true }).click();
  await page.getByRole('button', { name: /Casement window/ }).click();
  await expect(page.locator('.bd-selected-card h3')).toContainText('Casement window');
  await expect(page.locator('#buildingDesignDoorWidth')).toHaveValue('1.80');
  await expect(page.locator('#buildingDesignDoorHeight')).toHaveValue('0.80');
  await expect(page.locator('#buildingDesignWindowSill')).toHaveValue('4.70');
  await expect(page.getByRole('button', { name: '↓ Lower 0.1 m', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '↑ Raise 0.1 m', exact: true })).toBeVisible();

  await page.locator('#buildingDesignWindowSill').fill('0.20');
  await page.locator('#buildingDesignWindowSill').press('Tab');
  await expect(page.locator('#buildingDesignWindowSill')).toHaveValue('0.20');
  await page.locator('#buildingDesignWindowSill').fill('2.60');
  await page.locator('#buildingDesignWindowSill').press('Tab');
  await expect(page.locator('#buildingDesignWindowSill')).toHaveValue('2.60');
  await page.locator('#buildingDesignWindowSill').fill('5.20');
  await page.locator('#buildingDesignWindowSill').press('Tab');
  await expect(page.locator('#buildingDesignWindowSill')).toHaveValue('5.20');

  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#buildingDesignWindowSill').fill('5.30');
  await page.locator('#buildingDesignWindowSill').press('Tab');
  await expect(page.locator('#buildingDesignWindowSill')).toHaveValue('5.20');
  const beforeNudge = await page.evaluate(() => buildingDesignSelectedDoor().offset);
  await page.getByRole('button', { name: /0\.1 m →/ }).click();
  const afterNudge = await page.evaluate(() => buildingDesignSelectedDoor().offset);
  expect(afterNudge).toBeCloseTo(beforeNudge + .1, 5);

  const windowGraphic = page.locator('.bd-opening').filter({ has: page.locator('.bd-window-fill') });
  await expect(windowGraphic.locator('.bd-window-fill')).toHaveCSS('filter', /drop-shadow/);
  await windowGraphic.scrollIntoViewIfNeeded();
  const graphicBox = await windowGraphic.boundingBox();
  const sillBeforeDrag = await page.evaluate(() => buildingDesignSelectedDoor().sillHeight);
  await page.mouse.move(graphicBox.x + graphicBox.width / 2, graphicBox.y + graphicBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(graphicBox.x + graphicBox.width / 2 + 24, graphicBox.y + graphicBox.height / 2 + 70, { steps: 3 });
  await page.mouse.up();
  const windowOpening = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  const windowBounds = await page.evaluate(() => buildingDesignWindowBayBounds(buildingDesignSelectedDoor(), activeBuildingDesign.geometry));
  expect(windowOpening.type).toBe('window');
  expect(windowOpening.wall).toBe('right');
  expect(windowOpening.offset).toBeGreaterThanOrEqual(windowBounds.min);
  expect(windowOpening.offset).toBeLessThanOrEqual(windowBounds.max);
  expect(windowOpening.sillHeight).toBeLessThan(sillBeforeDrag);
  expect(windowOpening.sillHeight).toBeGreaterThanOrEqual(0);
  expect(windowOpening.sillHeight + windowOpening.height).toBeLessThanOrEqual(6);

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(page.locator('.bd-current-view')).toContainText('Draft saved');
  const storedWindow = await page.evaluate(({ key, projectId }) => {
    const stored = JSON.parse(localStorage.getItem(key));
    return stored.projects.find(project => project.id === projectId).geometry.doors.find(opening => opening.type === 'window');
  }, { key: STORAGE_KEY, projectId: PROJECT_ID });
  expect(storedWindow.width).toBe(1.8);
  expect(storedWindow.height).toBe(.8);
  expect(storedWindow.wall).toBe('right');
  expect(storedWindow.sillHeight).toBe(windowOpening.sillHeight);
  expect(Number.isInteger(storedWindow.bayIndex)).toBe(true);
});

test('uses the steel wind grid and keeps plan-only skylights between roof frames', async ({ page }) => {
  await openBuildingDesign(page);

  const grids = await page.evaluate(() => {
    const result = (length, windLoad, constructionMaterial = 'Steel') => {
      const grid = buildingDesignGridForLength(length, { facts: { windLoad, constructionMaterial } });
      return { count: grid.count, spacing: Number(grid.spacing.toFixed(3)), steel: grid.steel, highWind: grid.highWind };
    };
    return {
      gableLow: result(22, .7),
      gableHigh: result(22, .85),
      length53Low: result(53, .7),
      length53High: result(53, .85),
      length58Low: result(58, .7),
      length58High: result(58, .85),
      aluminium: result(22, 1.1, 'Aluminium'),
    };
  });
  expect(grids.gableLow).toMatchObject({ count: 4, spacing: 5.5, steel: true, highWind: false });
  expect(grids.gableHigh).toMatchObject({ count: 5, spacing: 4.4, steel: true, highWind: true });
  expect(grids.length53Low).toMatchObject({ count: 10, spacing: 5.3 });
  expect(grids.length53High).toMatchObject({ count: 11, spacing: 4.818 });
  expect(grids.length58Low).toMatchObject({ count: 11, spacing: 5.273 });
  expect(grids.length58High).toMatchObject({ count: 12, spacing: 4.833 });
  expect(grids.aluminium.steel).toBe(false);
  expect(grids.aluminium.highWind).toBe(false);

  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.locator('.bd-add-buttons button')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Skylight/ })).toBeVisible();
  const deleteSkylight = page.getByRole('button', { name: 'Delete skylight', exact: true });
  await expect(deleteSkylight).toBeDisabled();
  await expect(deleteSkylight).toHaveCount(1);
  await expect(deleteSkylight.locator('xpath=ancestor::div[contains(@class,"bd-add-buttons")]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Casement window/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Skylight/ }).click();
  await expect(deleteSkylight).toBeEnabled();
  await expect(page.locator('.bd-selected-card h3')).toContainText('Skylight');
  await expect(page.locator('.bd-plan-skylight')).toHaveCount(1);

  const initial = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  expect(initial.type).toBe('skylight');
  expect(initial.width).toBe(1);
  expect(initial.length).toBe(2);
  expect(await page.evaluate(() => buildingDesignIssues(activeBuildingDesign.geometry))).toEqual([]);

  await page.evaluate(() => buildingDesignNudgeSkylight(.1, .1));
  const moved = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  expect(moved.offsetX).toBeCloseTo(initial.offsetX + .1, 5);
  expect(moved.offsetY).toBeCloseTo(initial.offsetY + .1, 5);
  expect(await page.evaluate(() => buildingDesignIssues(activeBuildingDesign.geometry))).toEqual([]);

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  let stored = await page.evaluate(({ key, projectId }) => JSON.parse(localStorage.getItem(key)).projects.find(project => project.id === projectId), { key: STORAGE_KEY, projectId: PROJECT_ID });
  expect(stored.geometry.skylights).toHaveLength(1);
  expect(stored.geometry.skylights[0].offsetX).toBe(moved.offsetX);
  expect(stored.geometry.skylights[0].offsetY).toBe(moved.offsetY);
  expect(stored.buildingDesign.structuralGrid.material).toBe('steel');
  expect(stored.buildingDesign.structuralGrid.indicative).toBe(true);

  await page.getByRole('button', { name: 'Confirm Building Design', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  await page.evaluate(() => buildingDesignNudgeSkylight(.1, 0));
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
  expect((await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }))).offsetX).toBe(moved.offsetX);

  await page.getByRole('button', { name: 'Edit Building Design', exact: true }).click();
  await page.evaluate(() => buildingDesignNudgeSkylight(.1, 0));
  const reconfirmed = await page.evaluate(() => ({ ...buildingDesignSelectedDoor() }));
  await page.getByRole('button', { name: 'Confirm Updated Building Design', exact: true }).click();
  await page.reload();
  stored = await page.evaluate(({ key, projectId }) => JSON.parse(localStorage.getItem(key)).projects.find(project => project.id === projectId), { key: STORAGE_KEY, projectId: PROJECT_ID });
  expect(stored.geometry.skylights[0].offsetX).toBe(reconfirmed.offsetX);
});

test('draws length horizontally, matches sidewall frames and continues skylight rows from the last moved opening', async ({ page }) => {
  await openBuildingDesign(page);
  await page.getByRole('button', { name: 'Plan', exact: true }).click();

  const projection = await page.evaluate(() => {
    activeBuildingDesign.geometry.width = 30;
    activeBuildingDesign.geometry.length = 50;
    activeBuildingDesign.geometry.doors = [
      { id: 'rd101', ref: 'R1', type: 'roller', wall: 'right', offset: 10, width: 4.6, height: 5, source: 'customer' },
      { id: 'pd102', ref: 'P1', type: 'personnel', wall: 'left', offset: 15, width: 1, height: 2.1, source: 'customer' },
      { id: 'pd103', ref: 'P2', type: 'personnel', wall: 'front', offset: 5, width: 1, height: 2.1, source: 'customer' },
      { id: 'pd104', ref: 'P3', type: 'personnel', wall: 'back', offset: 7, width: 1, height: 2.1, source: 'customer' },
    ];
    activeBuildingDesign.geometry.skylights = [];
    activeBuildingDesign.selectedDoorId = null;
    activeBuildingDesign.skylightAnchorId = null;
    buildingDesignRenderInteractive();
    const positions = Object.fromEntries(activeBuildingDesign.geometry.doors.map(opening => [
      opening.wall,
      buildingDesignPlanOpeningGeometry(opening, activeBuildingDesign.geometry, 145, 60, 610, 366),
    ]));
    return {
      positions,
      frameCount: document.querySelectorAll('.bd-roof-frame-line').length,
      frames: [...document.querySelectorAll('.bd-roof-frame-line')].map(line => ({
        x1: Number(line.getAttribute('x1')),
        x2: Number(line.getAttribute('x2')),
        y1: Number(line.getAttribute('y1')),
        y2: Number(line.getAttribute('y2')),
      })),
      labels: [...document.querySelectorAll('.bd-dimension-label')].map(node => node.textContent),
      openings: [...document.querySelectorAll('.bd-plan-opening')].map(node => ({
        wall: node.dataset.wall,
        offset: Number(node.dataset.offset),
        width: Number(node.dataset.openingWidth),
      })),
    };
  });

  expect(projection.labels).toContain('50.0 m length');
  expect(projection.labels).toContain('30.0 m width');
  expect(projection.frameCount).toBe(9);
  for (const frame of projection.frames) {
    expect(frame.x1).toBe(frame.x2);
    expect(frame.y1).toBe(64);
    expect(frame.y2).toBe(394);
  }
  expect(projection.openings).toHaveLength(4);
  expect(projection.openings).toEqual(expect.arrayContaining([
    { wall: 'right', offset: 10, width: 4.6 },
    { wall: 'left', offset: 15, width: 1 },
    { wall: 'front', offset: 5, width: 1 },
    { wall: 'back', offset: 7, width: 1 },
  ]));
  expect(projection.positions.right.y1).toBe(426);
  expect(projection.positions.right.x1).toBeCloseTo(267, 5);
  expect(projection.positions.left.y1).toBe(60);
  expect(projection.positions.left.x1).toBeCloseTo(572, 5);
  expect(projection.positions.front.x1).toBe(755);
  expect(projection.positions.front.y1).toBeCloseTo(121, 5);
  expect(projection.positions.back.x1).toBe(145);
  expect(projection.positions.back.y1).toBeCloseTo(340.6, 5);

  const sequence = await page.evaluate(() => {
    activeBuildingDesign.geometry.doors = [];
    activeBuildingDesign.geometry.skylights = [];
    activeBuildingDesign.selectedDoorId = null;
    activeBuildingDesign.skylightAnchorId = null;
    buildingDesignAddSkylight();
    buildingDesignNudgeSkylight(5, 0);
    const establishedRow = buildingDesignSelectedDoor().offsetX;
    for (let index = 1; index < 10; index += 1) buildingDesignAddSkylight();
    const firstRow = activeBuildingDesign.geometry.skylights.map(skylight => ({
      bayIndex: skylight.bayIndex,
      offsetX: skylight.offsetX,
      offsetY: skylight.offsetY,
    }));
    buildingDesignAddSkylight();
    const newRowSeed = { ...buildingDesignSelectedDoor() };
    buildingDesignAddSkylight();
    const newRowNext = { ...buildingDesignSelectedDoor() };
    return { establishedRow, firstRow, newRowSeed, newRowNext, issues: buildingDesignIssues(activeBuildingDesign.geometry) };
  });

  expect(sequence.firstRow.map(skylight => skylight.bayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(sequence.firstRow.every(skylight => skylight.offsetX === sequence.establishedRow)).toBe(true);
  for (let index = 1; index < sequence.firstRow.length; index += 1) {
    expect(sequence.firstRow[index].offsetY - sequence.firstRow[index - 1].offsetY).toBeCloseTo(5, 5);
  }
  expect(sequence.newRowSeed.bayIndex).toBe(0);
  expect(sequence.newRowSeed.offsetX).not.toBe(sequence.establishedRow);
  expect(sequence.newRowNext.bayIndex).toBe(1);
  expect(sequence.newRowNext.offsetX).toBe(sequence.newRowSeed.offsetX);
  expect(sequence.issues).toEqual([]);
});

test('keeps Page 15B usable at a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBuildingDesign(page);

  await expect(page.locator('.building-design-grid')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Elevation D', exact: true })).toBeVisible();
  await expect(page.locator('.bd-persistent-actions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Building Design', exact: true })).toBeVisible();

  const bounds = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    actions: document.querySelector('.bd-persistent-actions').getBoundingClientRect().toJSON(),
  }));
  expect(bounds.page).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.actions.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.actions.right).toBeLessThanOrEqual(bounds.viewport + 1);
});

test('preserves saved openings across dimension changes and sanitizes persisted ids before rendering', async ({ page }) => {
  await page.goto('/#dashboard');
  await page.evaluate(({ key, projectId }) => {
    const stored = JSON.parse(localStorage.getItem(key));
    const project = stored.projects.find(item => item.id === projectId);
    project.geometry = {
      width: 24, length: 40, eaveHeight: 6, ridgeHeight: 8.12,
      roofForm: 'Duo-pitch (indicative)', structureType: 'standard',
      doors: [{ id: "rd1');window.__unsafeIdRan=true;//", ref: 'R1', type: 'roller', wall: 'front', offset: 3, width: 4.6, height: 4, source: 'generated' }],
      skylights: [],
    };
    project.facts.length = '45';
    project.facts.buildingFootprint.length = 45;
    localStorage.setItem(key, JSON.stringify(stored));
  }, { key: STORAGE_KEY, projectId: PROJECT_ID });

  await page.reload();

  await openBuildingDesign(page);
  const loaded = await page.evaluate(() => ({
    length: activeBuildingDesign.geometry.length,
    doors: activeBuildingDesign.geometry.doors.map(door => ({ id: door.id, offset: door.offset, width: door.width })),
    unsafeRan: Boolean(window.__unsafeIdRan),
  }));
  expect(loaded.length).toBe(45);
  expect(loaded.doors).toHaveLength(1);
  expect(loaded.doors[0]).toMatchObject({ offset: 3, width: 4.6 });
  expect(loaded.doors[0].id).toMatch(/^(rd|pd)\d{1,15}$/);
  expect(loaded.unsafeRan).toBe(false);
  await expect(page.locator('.bd-source-warning')).toBeVisible();
});

test('keeps keyboard focus for repeated nudges, records customer edits and applies real zoom sizing', async ({ page }) => {
  await openBuildingDesign(page);
  const opening = page.locator('.bd-opening').first();
  await opening.focus();
  const before = await page.evaluate(() => ({ offset: buildingDesignSelectedDoor().offset, source: buildingDesignSelectedDoor().source }));
  expect(before.source).toBe('generated');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.bd-opening:focus')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.bd-opening:focus')).toHaveCount(1);
  const after = await page.evaluate(() => ({ offset: buildingDesignSelectedDoor().offset, source: buildingDesignSelectedDoor().source }));
  expect(after.offset).toBeCloseTo(before.offset + .2, 5);
  expect(after.source).toBe('customer');

  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  const fitted = await page.locator('#buildingDesignSvg').evaluate(node => node.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const enlarged = await page.locator('#buildingDesignSvg').evaluate(node => node.getBoundingClientRect().width);
  expect(enlarged).toBeGreaterThan(fitted);
  for (let index = 0; index < 4; index += 1) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  const reduced = await page.locator('#buildingDesignSvg').evaluate(node => node.getBoundingClientRect().width);
  expect(reduced).toBeLessThan(fitted);
});

test('requires Site Layout reconfirmation when saved footprint dimensions are stale', async ({ page }) => {
  await page.goto('/#dashboard');
  await page.evaluate(({ key, projectId }) => {
    const stored = JSON.parse(localStorage.getItem(key));
    stored.projects.find(item => item.id === projectId).facts.width = '25';
    localStorage.setItem(key, JSON.stringify(stored));
  }, { key: STORAGE_KEY, projectId: PROJECT_ID });
  await page.reload();
  await page.goto(`/#buildingLayout/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Confirm Site Layout first', exact: true })).toBeVisible();
  await expect(page.locator('#buildingDesignSvg')).toHaveCount(0);
});

test('boundary editing invalidates a confirmed Site Layout handoff', async ({ page }) => {
  await page.goto('/#dashboard');
  const result = await page.evaluate(projectId => {
    activeSiteLayoutProjectId = projectId;
    activeSiteLayoutBuildingConfirmed = true;
    activeSiteLayoutDrawing = false;
    activeSiteLayoutBoundaryDraft = [];
    activeSiteLayoutBoundaries = [[{ lat: 53.1, lng: -1.3 }, { lat: 53.2, lng: -1.2 }]];
    const controls = document.createElement('div');
    controls.innerHTML = '<button id="confirmSiteLayoutBtn" hidden></button><button id="continueBuildingDesignBtn"></button><div id="siteLayoutBoundaryStep"></div><button id="startSiteLayoutBoundaryBtn"></button><button id="finishSiteLayoutBoundaryBtn"></button><button id="undoSiteLayoutBoundaryBtn"></button><button id="removeSiteLayoutBoundaryBtn"></button><span id="siteLayoutBoundaryCount"></span><span id="siteLayoutBoundaryStatus"></span>';
    document.body.appendChild(controls);
    startSiteLayoutBoundary();
    const project = getP(projectId);
    return {
      status: project.facts.siteLayoutStatus,
      boundaryStatus: project.facts.siteBoundaryStatus,
      confirmHidden: document.querySelector('#confirmSiteLayoutBtn').hidden,
      continueHidden: document.querySelector('#continueBuildingDesignBtn').hidden,
    };
  }, PROJECT_ID);
  expect(result).toEqual({ status: 'in_progress', boundaryStatus: 'in_progress', confirmHidden: false, continueHidden: true });
});

test('blocks Building Design until Site Layout is confirmed', async ({ page }) => {
  await page.goto(`/#buildingLayout/${OTHER_PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Confirm Site Layout first', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Site Layout', exact: true })).toBeVisible();
  await expect(page.locator('#buildingDesignSvg')).toHaveCount(0);
});

