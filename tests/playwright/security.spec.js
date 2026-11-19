// XSS / injection regression tests (Section C). Drives real payloads through
// customer-controlled fields and asserts they never execute and always
// render as inert text — locking in the esc()/pcEscXml() escaping audited in
// security-readiness.md so a future change can't silently reintroduce DOM XSS.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const XSS_MARKER = '__PC_XSS_FIRED__';
const PAYLOADS = [
  `<script>window.${XSS_MARKER}=1</script>`,
  `<img src=x onerror="window.${XSS_MARKER}=1">`,
  `"><svg onload="window.${XSS_MARKER}=1">`,
  `javascript:window.${XSS_MARKER}=1`,
];

function armXssDetector(page) {
  return page.evaluate((marker) => { window[marker] = 0; }, XSS_MARKER);
}
async function assertXssDidNotFire(page, context) {
  const fired = await page.evaluate((marker) => window[marker], XSS_MARKER);
  expect(fired, `${context}: an XSS payload executed`).toBeFalsy();
}

test.describe('XSS regression — project name', () => {
  for (const payload of PAYLOADS) {
    test(`project name payload is inert: ${payload.slice(0, 30)}`, async ({ page }) => {
      const email = `xss-name-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      await h.signUpAndReachDashboard(page, email);
      await armXssDetector(page);
      await h.createLegacyAssessmentProject(page, payload);
      // If esc() escaped the payload correctly, the h1's rendered text equals
      // the raw payload string; if it were instead parsed as live markup, the
      // text content would not match (e.g. a real <script> renders as empty text).
      // This assertion auto-waits for the render, so it doubles as the "let
      // the page settle" step a fixed sleep would otherwise be needed for —
      // by the time it resolves, the marker check below can't be racing render.
      await expect(page.locator('h1')).toContainText(payload);
      await assertXssDidNotFire(page, 'project workspace (h1)');
      // confirm no live <script>/<img onerror> element exists in the DOM
      const liveScript = await page.locator('h1 script').count();
      expect(liveScript, 'a <script> element was actually inserted into the DOM').toBe(0);
    });
  }
});

test('XSS regression — address field (Stage 1 Q3) reaches the report unexecuted', async ({ page }) => {
  const payload = `"><img src=x onerror="window.${XSS_MARKER}=1">`;
  const email = `xss-address-${Date.now()}@test.com`;
  await h.signUpAndReachDashboard(page, email);
  await armXssDetector(page);
  await h.createLegacyAssessmentProject(page, 'XSS Address Test');
  await h.openLegacyStage1(page);
  const answers = [...h.STAGE1_ANSWERS];
  answers[0] = payload; // Q1 = site address (index recomputed 2026-09-02, Stage 1 Question Reduction — was Q3/index 2)
  // 12-question workflow (2026-09-01): Map 1/Map 2 sit mid-flow (after
  // personnelDoors and closeBoundary) and the Consolidated Client Input
  // Page now follows Q12, before the report — drive via
  // answerStage1Questions() in the same blocks completeStage1() uses,
  // skipping each map and submitting the consolidated page, rather than
  // one unconditional loop.
  await h.answerStage1Questions(page, answers, 0, 6);
  await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
  await page.click('text=Continue without pinpointing on the map');
  await h.answerStage1Questions(page, answers, 6, 9);
  await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
  await page.click('text=Continue without drawing the boundary');
  await h.answerStage1Questions(page, answers, 9, 11);
  await h.submitClientInputPage(page);
  // The report is built as one synchronous innerHTML assignment, so by the
  // time its heading is visible the address field is already in the DOM —
  // no separate settle delay needed before checking the marker.
  await page.waitForSelector('text=Stage 1 Free Report', { timeout: 15000 });
  await assertXssDidNotFire(page, 'Stage 1 report');
  const liveImg = await page.locator('.pagehead img[src="x"]').count();
  expect(liveImg, 'a live onerror-bearing <img> was inserted from the address field').toBe(0);
});

test('XSS regression — supplier quotation fields (table rendering) are inert', async ({ page }) => {
  const email = `xss-quote-${Date.now()}@test.com`;
  await h.signUpAndReachDashboard(page, email);
  await h.createLegacyAssessmentProject(page, 'XSS Quote Test');
  await h.completeStage1(page);
  await h.skipMapsToStage1Summary(page);
  await h.completeStage2(page); // clicks "Start Stage 2" itself
  const quotesBtn = page.getByRole('button', { name: 'Supplier quotations', exact: true });
  await quotesBtn.scrollIntoViewIfNeeded();
  await quotesBtn.click();
  await page.waitForSelector('text=Add a quotation you already have', { timeout: 15000 });
  await armXssDetector(page);
  await page.fill('#qsupplier', `<img src=x onerror="window.${XSS_MARKER}=1">`);
  await page.fill('#qprice', '1000');
  await page.fill('#qlead', `"><script>window.${XSS_MARKER}=1</script>`);
  await page.fill('#qscope', `<script>window.${XSS_MARKER}=1</script>`);
  await page.click('text=Add quotation');
  // Auto-waits for the new row to actually render (the price field, shown
  // formatted as £1,000, is an uncontroversial signal the row is in the
  // DOM), so the marker check below can't race the render the way a fixed
  // sleep could.
  await expect(page.locator('table')).toContainText('£1,000');
  await assertXssDidNotFire(page, 'quotation comparison table');
  const liveScripts = await page.locator('table script').count();
  expect(liveScripts, 'a <script> element was inserted into the quotation table').toBe(0);
});
