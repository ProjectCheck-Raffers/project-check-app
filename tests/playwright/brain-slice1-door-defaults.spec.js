const h = require('./helpers');
// Project Check Brain — Migration Slice 1 integration smoke test.
//
// Proves, in the real running application (not just the Brain repository's
// own unit tests), that app.js's doorRuleFor() still delegates to the vendored
// Brain rule (pcBrainDoorSizeDefault(), brain/stage-1/door-size-defaults.js)
// with unchanged results. 2026-11-14: the Stage 1 roller-door sizes page that
// used to surface these defaults was removed, so this now checks the rule
// at the application integration point directly instead of via that page.
//
// This is NOT a Brain regression test — those live in Project-Check-Brain's
// own tests/stage-1/door-size-defaults.test.js and already prove the rule
// itself matches the original implementation for every practical input.
// This test only proves the application's integration point still behaves identically.
//
// See BRAIN-MIGRATION-REGISTER.md row BRAIN-0001 in Project-Check-Brain and
// brain/BRAIN-VERSION in this repository.
const { test, expect } = require('@playwright/test');

test('roller-door access-type size defaults are unchanged after the Brain integration (Migration Slice 1)', async ({ page }) => {
  await page.goto('/');
  const rules = await page.evaluate(() => ({
    hgv: doorRuleFor('HGV'), van: doorRuleFor('Van'), forklift: doorRuleFor('Forklift'),
    other: doorRuleFor('Other'), none: doorRuleFor(''),
  }));
  expect(rules.hgv).toEqual({ width: 4.6, height: 5 });
  expect(rules.van).toEqual({ width: 4.6, height: 4 });
  expect(rules.forklift).toEqual({ width: 4.6, height: 4 });
  expect(rules.other).toBeNull();
  expect(rules.none).toBeNull();
});
