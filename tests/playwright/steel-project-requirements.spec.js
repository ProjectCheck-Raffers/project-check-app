const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.describe('Steel free-standing project requirements', () => {
  test('saves temperature, existing-surface, reuse and evidence facts', async ({ page }) => {
    await h.signUpAndReachDashboard(page, 'steel-requirements-' + Date.now() + '@test.com');
    await h.createProject(page, 'Steel Requirements Test');
    const projectId = new URL(page.url()).hash.split('/')[1];

    await page.goto('/#projectSettings/' + projectId);
    await expect(page.getByRole('heading', { name: 'Edit project details', exact: true })).toBeVisible();
    await page.getByLabel('What temperature conditions will the building need?', { exact: true }).selectOption('Other temperature requirement');
    await expect(page.getByLabel('Required internal temperature (°C)', { exact: true })).toBeVisible();
    await page.getByLabel('Required internal temperature (°C)', { exact: true }).fill('-1');

    await page.getByLabel('What is currently on the proposed building area?', { exact: true }).selectOption('Concrete slab or concrete hardstanding');
    await page.getByLabel('Would you like to use the existing surface if it proves suitable?', { exact: true }).selectOption('Yes — assess it for reuse');
    await expect(page.getByLabel('Do you have any drawings, surveys or other information for the proposed building area?', { exact: true })).toBeVisible();
    await page.getByLabel('Do you have any drawings, surveys or other information for the proposed building area?', { exact: true }).selectOption('Yes — I will upload them later');
    await page.getByRole('button', { name: 'Save and return to overview', exact: true }).click();

    await expect(page).toHaveURL(new RegExp('#stage1Workspace/' + projectId + '$'));
    await expect(page.getByText('Other temperature requirement — -1°C', { exact: true })).toBeVisible();
    await expect(page.getByText('Concrete slab or concrete hardstanding', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Yes — I will upload them later', { exact: true }).first()).toBeVisible();

    const stored = await page.evaluate(({ key, id }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const project = state.projects.find(item => item.id === id);
      return { facts: project.facts, assessments: project.stage1Assessments };
    }, { key: 'projectcheck_master_v1', id: projectId });

    expect(stored.facts.temperatureCondition).toBe('Other temperature requirement');
    expect(stored.facts.requiredTemperatureC).toBe('-1');
    expect(stored.facts.base).toBe('Concrete slab or concrete hardstanding');
    expect(stored.facts.intendsToReuseExistingBase).toBe('Yes — assess it for reuse');
    expect(stored.facts.siteEvidenceAvailability).toBe('Yes — I will upload them later');
    expect(stored.facts).not.toHaveProperty('ambientProtectionNeeded');
    expect(stored.assessments.specialistLowTemperatureFlag).toBe(true);
    expect(stored.assessments.baseSuitabilityStatus).toBe('UNVERIFIED');
    expect(stored.facts).not.toHaveProperty('intendedDuration');
    expect(stored.facts).not.toHaveProperty('duration');
  });

  test('hides the evidence question when a new base is planned and keeps non-free-standing journeys out of scope', async ({ page }) => {
    await h.signUpAndReachDashboard(page, 'steel-scope-' + Date.now() + '@test.com');
    await h.createProject(page, 'Steel Scope Test');
    const projectId = new URL(page.url()).hash.split('/')[1];

    await page.goto('/#projectSettings/' + projectId);
    await page.getByLabel('What temperature conditions will the building need?', { exact: true }).selectOption('Ambient storage — unheated');
    await expect(page.getByLabel('Required internal temperature (°C)', { exact: true })).toBeHidden();
    await page.getByLabel('What is currently on the proposed building area?', { exact: true }).selectOption('Tarmac or asphalt');
    await page.getByLabel('Would you like to use the existing surface if it proves suitable?', { exact: true }).selectOption('No — a new base is planned');
    await expect(page.getByLabel('Do you have any drawings, surveys or other information for the proposed building area?', { exact: true })).toBeHidden();

    await page.getByLabel('Building type', { exact: true }).selectOption('Extension to an existing building');
    await expect(page.locator('#psSteelRequirements')).toBeHidden();
    await page.getByRole('button', { name: 'Save and return to overview', exact: true }).click();

    const storedType = await page.evaluate(({ key, id }) => {
      const state = JSON.parse(localStorage.getItem(key));
      return state.projects.find(item => item.id === id).facts.buildingType;
    }, { key: 'projectcheck_master_v1', id: projectId });
    expect(storedType).toBe('Extension to an existing building');
  });

  test('routes an immediate evidence upload through Project Documents', async ({ page }) => {
    await h.signUpAndReachDashboard(page, 'steel-evidence-' + Date.now() + '@test.com');
    await h.createProject(page, 'Steel Evidence Test');
    const projectId = new URL(page.url()).hash.split('/')[1];

    await page.goto('/#projectSettings/' + projectId);
    await page.getByLabel('What temperature conditions will the building need?', { exact: true }).selectOption('Ambient working temperature — heated');
    await page.getByLabel('What is currently on the proposed building area?', { exact: true }).selectOption('Mixed surfaces');
    await page.getByLabel('Would you like to use the existing surface if it proves suitable?', { exact: true }).selectOption('Not sure');
    await page.getByLabel('Do you have any drawings, surveys or other information for the proposed building area?', { exact: true }).selectOption('Yes — upload them now');
    await page.getByRole('button', { name: 'Save and upload documents', exact: true }).click();

    await expect(page).toHaveURL(new RegExp('#projectDocuments/' + projectId + '$'));
    await expect(page.getByRole('heading', { name: 'Upload documents', exact: true })).toBeVisible();
    await expect(page.getByText(/topographical or level surveys/)).toBeVisible();
  });
});
