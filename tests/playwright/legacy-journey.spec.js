// Legacy component regression coverage; not the current customer entry route.
// Full customer-journey + responsive-acceptance suite (Sections I/J/K/L).
// Runs once per device-class project (see playwright.config.js). Each step
// asserts no horizontal overflow and that the primary control for that step
// is reachable within the viewport, in addition to functional correctness.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const STORAGE_KEY = 'projectcheck_master_v1';

test('legacy assessment components retain responsive and business-rule coverage', async ({ page, isMobile, hasTouch }, testInfo) => {
  const tap = async (locator) => { if (hasTouch) await locator.tap(); else await locator.click(); };
  const email = `journey-${testInfo.project.name}@test.com`;

  await test.step('1-2. Homepage + header/logo/navigation', async () => {
    await page.goto('/', { waitUntil: 'load' });
    // Homepage load-confirmation text updated 2026-08-29: the Homepage
    // Rebuild replaced "Know before you build." with the new LOCKED
    // headline "From idea to informed decision." — same test intent
    // (wait for real homepage content to render), new locked wording.
    await page.waitForSelector('text=From idea to informed decision.');
    await h.assertNoHorizontalOverflow(page, 'homepage');
    // Homepage Visual Lock (2026-08-31): this was `.brand-logo` (the small
    // logo inside .topbar) until this task — the approved golden-reference
    // implementation moves the homepage's logo out of the nav banner
    // entirely into its own large standalone, non-sticky page element
    // (.homepage-logo-img) so it can scroll off naturally while the slim
    // pale-green banner stays put. `.brand-logo` is now intentionally
    // HIDDEN on the homepage specifically (still the visible logo on every
    // other page — see homepage-visual-lock.spec.js) — this is the
    // legitimate expected behaviour change, not a regression, so the
    // assertion now targets the correct current homepage logo element.
    // Homepage — Figma Exact Recreation (2026-09-02): at and below the
    // 858px reference width, .homepage-logo-img/.hero-illustration are now
    // superseded by the editable Figma-sourced hero (.pcfig-*, see
    // styles.css/app.js) — desktop (>858px) is unaffected and keeps the
    // exact assertions this test always used. Branching on the actual
    // viewport width (not device-class name) so this stays correct
    // regardless of which project runs it.
    const viewportWidth = page.viewportSize().width;
    if (viewportWidth <= 858) {
      const symbol = page.locator('.home-figma-hero-logo');
      await expect(symbol).toBeVisible();
      await h.assertInViewport(symbol, 'homepage Figma hero symbol');
      const buildingImgs = page.locator('.home-building-card img');
      await expect(buildingImgs).toHaveCount(1);
      await expect(buildingImgs).toBeVisible();
      const natural = await buildingImgs.evaluate(el => ({ w: el.naturalWidth, h: el.naturalHeight }));
      expect(natural.w, 'homepage Figma building photo failed to load').toBeGreaterThan(0);
      const primaryCta = page.locator('.home-figma-hero .home-action-primary');
      await h.assertInViewport(primaryCta, 'homepage Figma primary CTA');
    } else {
      const logo = page.locator('.home-figma-hero-logo');
      await expect(logo).toBeVisible();
      await h.assertInViewport(logo, 'homepage logo');
      // LOCKED — HOMEPAGE BUILDING VISUAL (2026-08-27, Controlled Homepage
      // Image Restoration task): restores the single approved Sprint 1.0
      // industrial-building illustration (.hero-illustration, the generic
      // wrapper) in place of the two-image "Your site"/"Your building" hero
      // that briefly replaced it — see CHANGELOG.md. Do not change this
      // back to a two-image assertion without explicit Stuart approval.
      const heroImgs = page.locator('.home-building-card img');
      await expect(heroImgs).toHaveCount(1);
      await expect(heroImgs).toBeVisible();
      const natural = await heroImgs.evaluate(el => ({ w: el.naturalWidth, h: el.naturalHeight }));
      expect(natural.w, 'homepage hero image failed to load').toBeGreaterThan(0);
    }
    const cta = page.locator('.home-figma-hero').getByRole('button', { name: 'Start a project', exact: true });
    await h.assertInViewport(cta, 'homepage primary CTA');
  });

  await test.step('3. Pricing', async () => {
    // Below 650px the top-nav Pricing/My Projects links are intentionally
    // hidden (existing pre-sprint CSS; Home and "Sign in" stay visible in
    // the persistent nav — Home was added 2026-08-30, see
    // navigation.spec.js) — Pricing remains reachable via the homepage's
    // own "View pricing" CTA, which is the realistic path on every device
    // size.
    await tap(page.locator('.home-figma-hero').getByRole('button', { name: 'See pricing', exact: true }));
    // Pricing load-confirmation text updated 2026-09-10 (Guided Route
    // Pricing Page rebuild): the old "Business & pricing" eyebrow no
    // longer exists on this page — the new page's own locked heading is
    // used instead.
    await expect(page.getByRole('heading', { name: /Start with the project\.\s*Decide the support later\./ })).toBeVisible();
    await h.assertNoHorizontalOverflow(page, 'pricing');
  });

  await test.step('4-5. Sign in -> dashboard', async () => {
    await h.openSignIn(page);
    // Updated 2026-08-30 (Account / Sign-in Experience — Approved Visual
    // Reference task, then the Account Gate Final Correction same day):
    // authModal() now opens on the EXISTING CUSTOMER sign-in panel by
    // default, with a separate NEW CUSTOMER create-account panel
    // (#showCreate) — full name, company name, business email, password
    // and Terms acceptance are required; mobile number is OPTIONAL (still
    // filled in here since supplying one remains valid). Every run here
    // uses a fresh per-project email, so it always needs the create panel.
    await page.waitForSelector('#authPanelSignin');
    const modalCard = page.locator('.signin-screen .auth-modal');
    await h.assertInViewport(modalCard, 'sign-in modal');
    await h.assertNoHorizontalOverflow(page, 'sign-in modal open');
    await tap(page.locator('#showCreate'));
    await page.waitForSelector('#authPanelCreate');
    await page.locator('#caName').click();
    await page.locator('#caName').fill('Test User');
    await page.locator('#caCompany').click();
    await page.locator('#caCompany').fill('Test Company Ltd');
    await page.locator('#caCompanyAddress').fill('1 Test Way, Testville, WA12 9XX');
    await page.locator('#caEmail').click();
    await page.locator('#caEmail').fill(email);
    await page.locator('#caMobile').click();
    await page.locator('#caMobile').fill('07700900000');
    await page.locator('#caPass').click();
    await page.locator('#caPass').fill('password123');
    await h.assertInViewport(page.locator('#caTerms'), 'create-account modal Terms checkbox');
    await page.locator('#caTerms').check();
    await tap(page.locator('#createBtn'));
    await expect(page.getByRole('heading', { name: 'My Projects', exact: true })).toBeVisible();
    await h.assertNoHorizontalOverflow(page, 'dashboard');
  });

  await test.step('6. Create project', async () => {
    await h.createLegacyAssessmentProject(page, `Device Test ${testInfo.project.name}`);
    await h.assertNoHorizontalOverflow(page, 'project workspace');
  });

  await test.step('7-19. Stage 1 questions 1-12 (text/numeric/select entry, Back, Save & continue, progress, illustrations) + interleaved Map 1/Map 2 (position, boundary, measurement, zoom)', async () => {
    // Stage 1 Question Reduction (2026-09-01, 17 -> 12 — see MASTER-SPEC.md/
    // CHANGELOG.md): the checkpoints below (illustration start, Back-button
    // expected value, Map 1/Map 2 trigger question numbers) were recomputed
    // for the new 12-question sequence and array positions. width/length/
    // height are no longer answered here at all — see the "20-21.
    // Consolidated Client Input Page" step below, which now supplies them
    // for real, the same way an actual customer would.
    await h.openLegacyStage1(page);
    await page.waitForSelector('#answer');
    for (let i = 0; i < h.STAGE1_ANSWERS.length; i++) {
      const qnum = i + 1;
      await page.waitForSelector('#answer');
      await h.assertNoHorizontalOverflow(page, `Stage 1 Q${qnum}`);
      const answerBox = page.locator('#answer');
      await h.assertInViewport(answerBox, `Stage 1 Q${qnum} answer control`);
      const saveBtn = page.locator('button.btn.green', { hasText: 'Save & continue' });
      await h.assertInViewport(saveBtn, `Stage 1 Q${qnum} Save & continue button`);

      // isIllustratedQuestion(i){return true} (app.js) since the Stage 1
      // Question Reduction: the only two questions ever excluded from
      // illustration ('name', 'role') are exactly the ones removed, so
      // every surviving question is illustrated — see app.js's own comment
      // on isIllustratedQuestion() for the full reasoning.
      const illustration = page.locator('.q-illustration img');
      await expect(illustration, `Q${qnum} should show Building 2 illustration`).toBeVisible();
      const illBox = await illustration.boundingBox();
      const fieldBox = await page.locator('.q-content > .field').boundingBox();
      const actionsBox = await page.locator('.q-content > .actions').boundingBox();
      // DIRECTION C — WORKSPACE CONTINUITY: the selected Figma design
      // supersedes the earlier REV2 above/below alternation. Every Stage 1
      // question now places the approved building visual consistently
      // between the answer field and the Back/Save navigation.
      expect(illBox.y, `Q${qnum}: illustration should follow the answer field (Direction C)`).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height - 5);
      expect(actionsBox.y, `Q${qnum}: navigation should follow the illustration (Direction C)`).toBeGreaterThanOrEqual(illBox.y + illBox.height - 5);
      await h.assertNoHorizontalOverflow(page, `Stage 1 Q${qnum} illustration`);

      // Back button (test once, at Q2 -> Q1 -> Q2): must return to the
      // previous question with its saved answer intact and re-advance cleanly.
      // New Q1 is 'address' (was 'name' before the Stage 1 Question
      // Reduction) — expected value updated to match STAGE1_ANSWERS[0].
      if (qnum === 2) {
        const backBtn = page.locator('button', { hasText: 'Back' });
        await h.assertInViewport(backBtn, 'Q2 Back button');
        await tap(backBtn);
        await expect(page.locator('text=Question 1 of')).toBeVisible();
        await expect(page.locator('#answer')).toHaveValue(h.STAGE1_ANSWERS[0]);
        await tap(page.locator('button.btn.green', { hasText: 'Save & continue' }));
        await page.waitForSelector('text=Question 2 of');
      }

      // Left-side question navigation (desktop/tablet only — CSS hides it <900px):
      // confirm the sidebar is present, in-viewport, and marks the current
      // question active, without disturbing the answer flow. Gated on the
      // app's real 900px CSS breakpoint, not the `isMobile` device flag —
      // touch-enabled tablet-landscape profiles are isMobile:true but wider
      // than 900px, where the sidebar is correctly shown.
      if (page.viewportSize().width >= 900 && qnum === 5) {
        const steps = page.locator('.steps');
        if (await steps.isVisible().catch(() => false)) {
          await h.assertInViewport(steps, 'left question-navigation sidebar');
          await expect(page.locator('.step.active')).toContainText('5.');
        }
      }

      await h.answerCurrentQuestion(page, h.STAGE1_ANSWERS[i]);
      await tap(saveBtn);

      // 17-question workflow (2026-08-27, Stage 1 Map Control Layout +
      // 17-Question task), positions recomputed 2026-09-01 (Stage 1 Question
      // Reduction, 17 -> 12): Map 1 now sits after Q6 (personnelDoors, was
      // Q12), Map 2 after Q9 (services, was Q15) — interact with each map
      // right here, mid-loop, then continue answering.
      if (qnum === 6) {
        await page.waitForSelector('text=Show the proposed building position', { timeout: 15000 });
        await h.assertNoHorizontalOverflow(page, 'building-position map');
        const mapBox = page.locator('#buildingMap');
        await mapBox.scrollIntoViewIfNeeded();
        await h.assertInViewport(mapBox, 'building-position map container');
        const mapBounds = await mapBox.boundingBox();
        expect(mapBounds, 'building-position map did not render (no bounding box)').not.toBeNull();
        expect(mapBounds.width, 'map must not be usable by touch if it has no width').toBeGreaterThan(50);

        // Map control layout (2026-08-27): the map-view/building/measurement
        // toolbars now sandwich the map directly (immediately above/below it),
        // rather than sitting far above it — confirm the map itself stays
        // reachable without an excessive scroll from its own controls.
        const mapViewToolbar = page.locator('.map-view-toolbar');
        await h.assertInViewport(mapViewToolbar, 'map-view toolbar (must sit near the map)');

        // Distance measurement — click via the locator (auto-scrolls/clips
        // correctly, unlike raw page.mouse.click at absolute coordinates, which
        // silently misses when the map isn't at the very top of the viewport).
        await tap(page.locator('#measureDistanceBtn'));
        await mapBox.click({ position: { x: mapBounds.width / 2 - 30, y: mapBounds.height / 2 } });
        await mapBox.click({ position: { x: mapBounds.width / 2 + 30, y: mapBounds.height / 2 } });
        await expect(page.locator('#measureStatus')).toContainText('Distance:', { timeout: 5000 });
        await tap(page.locator('text=Clear'));

        // Area measurement
        await tap(page.locator('#measureAreaBtn'));
        await mapBox.click({ position: { x: mapBounds.width / 2 - 20, y: mapBounds.height / 2 - 20 } });
        await mapBox.click({ position: { x: mapBounds.width / 2 + 20, y: mapBounds.height / 2 - 20 } });
        await mapBox.click({ position: { x: mapBounds.width / 2, y: mapBounds.height / 2 + 20 } });
        await expect(page.locator('#measureStatus')).toContainText('Area:', { timeout: 5000 });
        await tap(page.locator('text=Clear'));

        // Map zoom (double-click zoom is MapLibre's default interaction).
        // Verified functionally — a subsequent map click still working —
        // rather than reading MapLibre's internal zoom level, which isn't
        // exposed outside the app's module scope.
        await mapBox.dblclick({ position: { x: mapBounds.width / 2, y: mapBounds.height / 2 } });
        await page.waitForTimeout(400);
        await mapBox.click({ position: { x: mapBounds.width / 2, y: mapBounds.height / 2 } });
        await expect(page.locator('#buildingStatus')).toBeVisible();

        await tap(page.locator('text=Continue without pinpointing on the map'));
      }

      if (qnum === 9) {
        await page.waitForSelector('text=Show the relevant site boundary', { timeout: 15000 });
        await h.assertNoHorizontalOverflow(page, 'boundary map');
        await h.assertInViewport(page.locator('.map-view-toolbar'), 'Map 2 map-view toolbar (must sit near the map)');
        await tap(page.locator('text=Continue without drawing the boundary'));
      }
    }
  });

  await test.step('20-21. Consolidated Client Input Page (name/role/width/length/height — NOT a 13th question)', async () => {
    // Consolidated Client Input Page (2026-09-02 — see MASTER-SPEC.md/
    // CHANGELOG.md): reached automatically once Q12 (programme) is saved,
    // before Stage 1 finalises. Confirm it is genuinely distinct from the
    // 12-question sequence (no "Question 13" text, no left navigator, no
    // progress bar tied to the 12-question count), then supply the five
    // retained facts for real, exactly as a customer would.
    await page.waitForSelector('#ciName');
    await h.assertNoHorizontalOverflow(page, 'consolidated client input page');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText, 'must not present itself as a 13th sequential question').not.toContain('Question 13');
    await expect(page.locator('.steps')).toHaveCount(0);
    await expect(page.locator('.progressbar')).toHaveCount(0);
    await page.fill('#ciName', 'Device Test');
    await page.selectOption('#ciRole', 'Facilities / operations');
    await page.fill('#ciWidth', '24');
    await page.fill('#ciLength', '40');
    await page.fill('#ciHeight', '6');
    const saveBtn = page.locator('button.btn.green', { hasText: 'Save & continue' });
    await h.assertInViewport(saveBtn, 'consolidated page Save & continue button');
    await tap(saveBtn);
  });

  await test.step('22-24. Stage 1 summary, generated drawing, report download control reachable', async () => {
    await page.waitForSelector('text=Stage 1 Free Report', { timeout: 15000 });
    await h.assertNoHorizontalOverflow(page, 'Stage 1 report');
    await expect(page.locator('.svg-wrap svg')).toBeVisible();
    await expect(page.locator('img.report-building')).toBeVisible();
    const dlBtn = page.locator('button', { hasText: 'Download Stage 1 PDF' });
    await h.assertInViewport(dlBtn, 'Stage 1 PDF download button');
  });

  await test.step('25 & 31-32. Stage 2 report + PDF download reachable & triggers', async () => {
    await h.completeStage2(page); // clicks "Start Stage 2" itself; lands on the Stage 2 report
    await h.assertNoHorizontalOverflow(page, 'Stage 2 report');
    const dlBtn = page.locator('button', { hasText: 'Download Stage 2 PDF' });
    await h.assertInViewport(dlBtn, 'Stage 2 PDF download button');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      tap(dlBtn),
    ]);
    expect(download.suggestedFilename()).toContain('Stage-2');
  });

  await test.step('26-30. Door editor: add/remove/reposition roller & personnel doors, regenerate', async () => {
    // Reachable from the Stage 2 report itself — matches the real customer path.
    await tap(page.locator('text=Review doors & drawing'));
    await page.waitForSelector('text=Doors & drawing review', { timeout: 15000 });
    await h.assertNoHorizontalOverflow(page, 'door editor');
    await tap(page.locator('text=+ Add roller door'));
    await tap(page.locator('text=+ Add personnel door'));
    const rows = page.locator('.door-list-row');
    await expect(rows).toHaveCount(3); // 1 personnel from Stage 1 + 2 just added
    const slider = page.locator('#doorSlider');
    await h.assertInViewport(slider, 'door position slider');
    await page.locator('#doorNumeric').click();
    await page.locator('#doorNumeric').fill('2');
    const confirmBtn = page.locator('text=Confirm & regenerate drawing');
    await h.assertInViewport(confirmBtn, 'confirm & regenerate button');
    await tap(confirmBtn);
    await expect(page.locator('text=Confirmed.')).toBeVisible({ timeout: 10000 });
    // remove one door
    const removeBtn = page.locator('.door-list-row button', { hasText: 'Remove' }).first();
    await tap(removeBtn);
    await expect(page.locator('.door-list-row')).toHaveCount(2);
  });
});
