// Stage 1 Question Reduction (2026-09-01 — see MASTER-SPEC.md § "Stage 1"
// and CHANGELOG.md for the full audit trail: exact old wording, full
// old->new mapping, downstream-dependency findings, and the retirement
// classification for each removed question). Five questions were removed
// from the sequential customer-facing Stage 1 array (app.js's
// stage1Questions[]) — 'name', 'role', 'width', 'length', 'height' —
// reducing it from 17 to 12. This is the permanent regression guard for
// that specific change: exactly 7 questions, correct surviving order,
// the five removed questions' wording never appears in the sequential
// flow, correct "Question X of 7" labelling throughout, and the visual
// header treatment (locked separately — see stage1-question-header.spec.js)
// is unaffected.
//
// What this does NOT re-test: the underlying fact keys/reasoning/
// downstream logic (geometry.js, drawing.js, evidence.js's
// STAGE1_EVIDENCE_MAP, the buildingFootprint re-derivation safeguard) are
// all deliberately untouched by this change and are covered by their own
// existing specs (geometry-audit.spec.js, journey.spec.js). This spec is
// specifically about the CUSTOMER-FACING SEQUENCE, not the intelligence
// behind it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const REMOVED_QUESTION_WORDING = [
  'What is your name?',
  'What is your role in this project?',
  'Approximately how wide does the building need to be',
  'Approximately how long does the building need to be',
  'What clear internal height do you need',
  // Retired 2026-11-14 (Stage 1 level/services/boundary/programme pages removed):
  'Does the proposed building area look generally level?',
  'Do you know of any drains, pipes, cables or other services within the proposed building area?',
  'Are any boundaries, neighbouring buildings or other obstructions close to the proposed building?',
  'When do you expect to need the building?',
  // Retired 2026-11-14 (Stage 1 clear-span page removed):
  'Do you need the building to be completely clear inside, without internal columns?',
];

test.describe('Stage 1 Question Reduction — 17 -> 12', () => {
  test('exactly 7 questions, correct order, no removed questions, correct labels throughout', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await h.signUpAndReachDashboard(page, `s1reduction-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, 'Stage1 Reduction Test');
    await h.openLegacyStage1(page);
    await page.waitForSelector('#answer');
    const projectId = await page.evaluate(() => location.hash.split('/')[1]);

    const expectedOrder = [
      'Where is the proposed building site?',
      'What type of structure are you considering?',
      'What will the building be used for?',
      'Will the building be heated?',
      'How many vehicle doors do you expect to need?',
      'How many personnel doors do you expect to need?',
      'What is currently on the area where the building will sit?',
    ];
    expect(expectedOrder.length, 'this test itself must enumerate exactly 7 questions').toBe(7);

    for (let i = 0; i < expectedOrder.length; i++) {
      await page.evaluate(({ id, idx }) => { sessionStorage.setItem('s1q_' + id, idx); stage1(id); }, { id: projectId, idx: i });
      await page.waitForSelector('#answer');
      await expect(page.locator('.eyebrow')).toContainText(`Question ${i + 1} of 7`);
      await expect(page.locator('.q-content h2')).toHaveText(expectedOrder[i]);
      for (const removed of REMOVED_QUESTION_WORDING) {
        expect(await page.locator('body').innerText()).not.toContain(removed);
      }
    }
  });

  test('the removed questions do not appear anywhere across the full 7-question journey (Back/forward included)', async ({ page }) => {
    await h.signUpAndReachDashboard(page, `s1reduction-back-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, 'Stage1 Reduction Back Test');
    await h.openLegacyStage1(page);
    await page.waitForSelector('#answer');

    for (let i = 0; i < h.STAGE1_ANSWERS.length; i++) {
      await page.waitForSelector('#answer');
      for (const removed of REMOVED_QUESTION_WORDING) {
        expect(await page.locator('body').innerText()).not.toContain(removed);
      }
      await h.answerCurrentQuestion(page, h.STAGE1_ANSWERS[i]);
      await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
      if (i === 6) { // after personnelDoors -> Map 1
        await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
        await page.click('text=Continue without pinpointing on the map');
      }
      if (i === 9) { // after services -> Map 2
        await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
        await page.click('text=Continue without drawing the boundary');
      }
    }
    // Consolidated Client Input Page (2026-09-02 — see MASTER-SPEC.md/
    // CHANGELOG.md): reached automatically after Q12. Its own fields
    // intentionally reuse the exact original question wording for these
    // five facts (by design — see stage1ClientInput() in app.js) — that
    // is expected and correct here, unlike during Q1-Q12 above, which is
    // why the wording checks above are scoped to inside that loop only,
    // not repeated on this page. Fill it in and continue to the report.
    await page.waitForSelector('#ciName');
    await page.fill('#ciName', h.CLIENT_INPUT_DEFAULTS.name);
    await page.selectOption('#ciRole', h.CLIENT_INPUT_DEFAULTS.role);
    await page.fill('#ciWidth', h.CLIENT_INPUT_DEFAULTS.width);
    await page.fill('#ciLength', h.CLIENT_INPUT_DEFAULTS.length);
    await page.fill('#ciHeight', h.CLIENT_INPUT_DEFAULTS.height);
    await page.locator('button.btn.green', { hasText: 'Save & continue' }).click();
    await page.waitForSelector('text=Stage 1 Free Report', { timeout: 15000 });
    for (const removed of REMOVED_QUESTION_WORDING) {
      expect(await page.locator('body').innerText()).not.toContain(removed);
    }
  });

  test('progress bar reaches 100% only at the 11th question, not before', async ({ page }) => {
    await h.signUpAndReachDashboard(page, `s1reduction-progress-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, 'Stage1 Reduction Progress Test');
    await h.openLegacyStage1(page);
    await page.waitForSelector('#answer');
    const projectId = await page.evaluate(() => location.hash.split('/')[1]);

    await page.evaluate(({ id }) => { sessionStorage.setItem('s1q_' + id, 9); stage1(id); }, { id: projectId }); // Q10 of 7
    await page.waitForSelector('#answer');
    let width = await page.locator('.progressbar span').evaluate(el => el.style.width);
    expect(width, 'progress must not be 100% before the last question').not.toBe('100%');

    await page.evaluate(({ id }) => { sessionStorage.setItem('s1q_' + id, 6); stage1(id); }, { id: projectId }); // Q7 of 7
    await page.waitForSelector('#answer');
    width = await page.locator('.progressbar span').evaluate(el => el.style.width);
    expect(width).toBe('100%');
  });

  // Header colour updated 2026-09-04 (Direction C complete working model,
  // ARCHITECT + SPA authorised, Stuart-approved correction): the locked
  // Direction C Figma frames specify a plain white header, superseding the
  // pale-green banner this assertion originally checked — see the same
  // correction and reasoning in stage1-question-header.spec.js. This
  // test's own point (header treatment is unaffected by the 17->12
  // question-count change) is unchanged; only the expected colour is.
  test('the locked Stage 1 header treatment is unaffected by this content change', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 900 });
    await h.signUpAndReachDashboard(page, `s1reduction-header-${Date.now()}@test.com`);
    await h.createLegacyAssessmentProject(page, 'Stage1 Reduction Header Test');
    await h.openLegacyStage1(page);
    await page.waitForSelector('text=Question 1 of 7');
    expect(await page.locator('.topbar').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  });
});
