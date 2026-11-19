// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const os = require('os');
const path = require('path');

// OneDrive bulk-delete warning fix (2026-09-02): this repository lives
// inside a OneDrive-synchronised folder. Playwright's default outputDir
// ('test-results', relative to this config file) is cleared and rebuilt
// on every single test run — every trace.zip/error-context.md/screenshot
// for every test gets deleted then recreated, which OneDrive's own sync
// engine sees as a rapid bulk-delete pattern and warns about. This is
// PURELY a local artefact-location setting — it does not touch any
// Project Check source/application file, any test's logic/assertions, or
// git tracking (test-results/ was already gitignored; it just also
// needs to not physically live inside the synced tree at all). Computed
// via os.tmpdir() rather than a hardcoded path so this works on any
// machine/user, always resolving outside whatever folder this repo
// happens to be checked out into.
const TEST_OUTPUT_DIR = path.join(os.tmpdir(), 'project-check-playwright-test-results');
// Keep the HTML report OUTSIDE TEST_OUTPUT_DIR. Playwright clears the HTML
// reporter's output folder before generation, so nesting it inside outputDir
// causes a reporter/results clash and can erase evidence artifacts. CI uploads
// this exact temp-directory path; local OneDrive checkouts remain unaffected.
const HTML_REPORT_DIR = path.join(os.tmpdir(), 'project-check-playwright-html-report');

// Firefox on the hosted Linux runner failed WebGL context creation in headless
// mode (PR #59 trace: FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS). Run only
// Firefox headed under the CI workflow's Xvfb display; retain the real map
// assertions, pinned engines and all existing viewport projects. This is a
// test-runner candidate, not a verified rendering fix until CI proves it.
const FIREFOX_CI_RENDERING = process.env.CI ? { headless: false } : {};

// Device-class matrix per the mobile/tablet/desktop compatibility sprint.
// PRIMARY coverage (full journey + responsive-acceptance rules) runs on
// Chromium across all 7 required device-width classes. Cross-engine parity
// (WebKit, Firefox) is checked with a shorter smoke journey at representative
// sizes, using real Playwright device profiles where a good match exists —
// see cross-browser.spec.js. This is a deliberate scoping decision (documented
// in the sprint report) rather than a full 7-class x 3-engine matrix, to keep
// CI runtime practical while still proving both full coverage on one engine
// and real engine parity on the others. Security/accessibility/error-handling/
// live-map checks are engine/device-agnostic and run once on desktop Chromium.
//
// Known environment note (see sprint report, and CHANGELOG.md 2026-08-25 for
// the full proven investigation, corrected same day): two separate WebKit-
// on-this-Windows-host behaviours, not one.
//   1. Base behaviour, present on WebKit here regardless of isMobile: this
//      host's own display scaling is already baked into
//      window.innerWidth/documentElement.clientWidth/devicePixelRatio
//      before isMobile is even considered — confirmed with isMobile unset.
//      documentElement.scrollWidth is divided the same way in this mode,
//      so it stays self-consistent with clientWidth; no mismatch results.
//   2. isMobile:true-specific addition (only the standard-phone-webkit /
//      tablet-portrait-webkit projects below — never desktop-webkit, which
//      doesn't emulate isMobile): it does NOT cause the scaling in (1) —
//      what it adds is that scrollWidth stops being divided the same way,
//      which is what actually produces the scrollWidth > clientWidth
//      mismatch, even though content's actual rendered width matches the
//      requested CSS width exactly.
// Proven by running the identical device profile on Chromium, which shows
// zero discrepancy at every measurement. This is a WebKit-on-Windows engine
// artifact of the local sandbox, not a Project Check defect. GitHub
// Actions' Linux runners are not expected to exhibit this.
// Handled in tests/playwright/helpers.js: assertNoHorizontalOverflow and
// hasKnownWebKitScaleQuirk both gate on three ground-truth conditions
// together (browserName === 'webkit', queried from Playwright itself; a
// non-integer devicePixelRatio; and the underlying strict check/divergence
// actually being present right now) — never inferred from devicePixelRatio
// alone, so this can never fire on Chromium, Firefox, desktop-webkit, or a
// genuine non-WebKit/non-Windows non-integer-DPR display, and never loosens
// anything on a project that wasn't already going to fail.
module.exports = defineConfig({
  testDir: '.',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false, // shared dev server + deterministic ordering for CI logs
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Traces/screenshots/error-context.md (outputDir) and the optional CI HTML
  // report both live outside the OneDrive-synced repo folder, but in separate
  // temp directories so the reporter cannot clear the raw test-result folder.
  outputDir: TEST_OUTPUT_DIR,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: HTML_REPORT_DIR }]] : 'list',
  use: {
    baseURL: 'http://localhost:5099',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Pinned devDependency (package.json), not a floating `npx --yes` pull.
    command: 'npx serve ../../Project-Check-MVP-Master-Build -l 5099',
    url: 'http://localhost:5099',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    // --- Primary: Chromium across all 7 required device-width classes ---
    { name: 'mobile-small-chromium', testMatch: /journey\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-standard-chromium', testMatch: /journey\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-large-chromium', testMatch: /journey\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 428, height: 926 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-portrait-chromium', testMatch: /journey\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-landscape-chromium', testMatch: /journey\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1280-chromium', testMatch: /journey\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'desktop-1440-chromium', testMatch: /journey\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },

    // --- Cross-engine parity smoke journey ---
    { name: 'standard-phone-webkit', testMatch: /cross-browser\.spec\.js/, use: { ...devices['iPhone 13'] } },
    { name: 'tablet-portrait-webkit', testMatch: /cross-browser\.spec\.js/, use: { ...devices['iPad (gen 7)'] } },
    { name: 'desktop-webkit', testMatch: /cross-browser\.spec\.js/, use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
    // Firefox: no touch/mobile emulation support in Playwright's Firefox channel — viewport-only responsive check.
    { name: 'standard-phone-firefox', testMatch: /cross-browser\.spec\.js/, use: { ...devices['Desktop Firefox'], ...FIREFOX_CI_RENDERING, viewport: { width: 390, height: 844 } } },
    { name: 'desktop-firefox', testMatch: /cross-browser\.spec\.js/, use: { ...devices['Desktop Firefox'], ...FIREFOX_CI_RENDERING, viewport: { width: 1280, height: 800 } } },

    // --- Page 15B Building Design: full interaction and persistence in every engine ---
    { name: 'building-layout-chromium', testMatch: /building-layout\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'building-layout-webkit', testMatch: /building-layout\.spec\.js/, use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'building-layout-firefox', testMatch: /building-layout\.spec\.js/, use: { ...devices['Desktop Firefox'], ...FIREFOX_CI_RENDERING, viewport: { width: 1280, height: 900 } } },

    // --- Engine/device-agnostic: security, accessibility, error-handling, live-map ---
    { name: 'functional-chromium', testMatch: /(security|accessibility|error-handling|live-map|geometry-audit|geometry-functions|document-identity|stage1-report|stage1-geometry-continuity|stage1-map-rotation|brain-slice1-door-defaults|brain-slice2-heated-risk|brain-slice3-compressed-programme|brain-slice4-services-drainage|brain-slice5-building-position-status|brain-batch-stage1-risks|brain-batch-missing-info|icon-asset-integrity|navigation|content-integrity|homepage-visual-lock|stage1-question-header|project-documents|stage1-question-reduction|stage1-consolidated-client-input|customer-workspace|steel-project-requirements|stage1-roller-page-removed|stage1-base-foundations-note|stage1-adjacent-building-water|background-checks|stage1-report-design-match|building-design-fire-exit-toggle)\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    // Mobile/touch run of the Stage 1 Map Architecture rotation suite specifically
    // (2026-08-27) — narrowly scoped rather than widening the 7-device journey.spec.js
    // matrix, since this file is the only one that needs touch-capable coverage.
    { name: 'map-rotation-mobile-chromium', testMatch: /stage1-map-rotation\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
