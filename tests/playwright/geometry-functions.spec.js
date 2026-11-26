// Targeted unit-style regression coverage for the two Finding A/B Copilot
// corrections in geometry.js. These call the real shipped functions directly
// in the browser (geometry.js is a classic <script>, so its top-level function
// declarations are on window) rather than driving the full UI -- pure logic,
// no login/project flow needed.
const { test, expect } = require('@playwright/test');

test.describe('Finding A: fire-door advisory gated on valid, positive, finite dimensions', () => {
  const ALLOWANCE_TEXT = 'Preliminary personnel/escape-door allowance';

  test('zero width/length: no numerical allowance issue', async ({ page }) => {
    await page.goto('/');
    const issues = await page.evaluate(() => validateGeometry({ width: 0, length: 0, doors: [] }));
    expect(issues.some(i => i.message.includes('Preliminary personnel'))).toBe(false);
  });

  test('non-finite width (NaN via malformed input): no numerical allowance issue', async ({ page }) => {
    await page.goto('/');
    const issues = await page.evaluate(() => validateGeometry({ width: Number('not-a-number'), length: 40, doors: [] }));
    expect(issues.some(i => i.message.includes('Preliminary personnel'))).toBe(false);
  });

  test('non-finite length (Infinity): no numerical allowance issue', async ({ page }) => {
    await page.goto('/');
    const issues = await page.evaluate(() => validateGeometry({ width: 24, length: Infinity, doors: [] }));
    expect(issues.some(i => i.message.includes('Preliminary personnel'))).toBe(false);
  });

  test('missing width/length (undefined): no numerical allowance issue', async ({ page }) => {
    await page.goto('/');
    const issues = await page.evaluate(() => validateGeometry({ doors: [] }));
    expect(issues.some(i => i.message.includes('Preliminary personnel'))).toBe(false);
  });

  // Stale-expectation correction (2026-09-02, PC-CONTROL-004, Workstream C):
  // this test used to assert validateGeometry() still returns the
  // perimeter÷32m "Preliminary personnel/escape-door allowance" issue for
  // valid dimensions with 0 personnel doors. That block was deliberately,
  // permanently removed from geometry.js's validateGeometry() on 2026-08-26
  // ("Personnel-door question corrected; perimeter ÷ 32 m rule retired from
  // live behaviour", following the Job B fire-strategy evidence review —
  // see CHANGELOG.md/MASTER-SPEC.md); suggestedPersonnelDoorAllowance()
  // itself is deliberately preserved, unaltered, but no longer called from
  // anywhere. Not a regression, not incomplete migration — an intentional,
  // governed removal that predates the Stage 1 Question Reduction/
  // consolidated-input work by days. Corrected to guard the current,
  // approved, opposite behaviour instead — completing this describe
  // block's own "gated on valid, positive, finite dimensions" coverage by
  // confirming the one input combination that used to trigger the
  // advisory no longer does, matching every sibling test in this block.
  test('valid positive dimensions never produce the retired 32m allowance issue (2026-08-26 retirement guard)', async ({ page }) => {
    await page.goto('/');
    // width=24, length=40 -> perimeter=128m -> 128/32=4 (exact) under the old, retired rule.
    const issues = await page.evaluate(() => validateGeometry({ width: 24, length: 40, doors: [] }));
    expect(issues.some(i => i.message.includes('Preliminary personnel'))).toBe(false);
  });

  test('valid dimensions with sufficient personnel doors: no allowance issue', async ({ page }) => {
    await page.goto('/');
    const doors = [1, 2, 3, 4].map(i => ({ id: 'pd' + i, type: 'personnel', wall: 'left', offset: i, width: 1, height: 2.1 }));
    const issues = await page.evaluate((d) => validateGeometry({ width: 24, length: 40, doors: d }), doors);
    expect(issues.some(i => i.message.includes('Preliminary personnel'))).toBe(false);
  });
});

test.describe('Finding B: door source healing (generated | customer | legacy)', () => {
  test('valid source values are preserved unchanged', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const geom = { doors: [
        { id: 'rd1', source: 'generated' },
        { id: 'pd1', source: 'customer' },
        { id: 'pd2', source: 'legacy' },
      ] };
      sanitizeDoorSources(geom);
      return geom.doors.map(d => d.source);
    });
    expect(result).toEqual(['generated', 'customer', 'legacy']);
  });

  test('missing source (no key at all) heals to legacy', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const geom = { doors: [{ id: 'pd1' }] };
      sanitizeDoorSources(geom);
      return geom.doors[0].source;
    });
    expect(result).toBe('legacy');
  });

  test('malformed/unrecognised source value heals to legacy, is never inferred as customer or generated', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const geom = { doors: [
        { id: 'pd1', source: 'hacked-tampered-value' },
        { id: 'pd2', source: 123 },
        { id: 'pd3', source: null },
        { id: 'pd4', source: '' },
      ] };
      sanitizeDoorSources(geom);
      return geom.doors.map(d => d.source);
    });
    expect(result).toEqual(['legacy', 'legacy', 'legacy', 'legacy']);
  });

  test('healDoorSource() applies the same healing to a single door object', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const generated = healDoorSource({ id: 'a', source: 'generated' });
      const tampered = healDoorSource({ id: 'b', source: 'not-a-real-value' });
      return { generated: generated.source, tampered: tampered.source };
    });
    expect(result).toEqual({ generated: 'generated', tampered: 'legacy' });
  });
});

test.describe('Finding D: malformed persisted door entries are filtered before healing', () => {
  test('null, undefined, string, array and number entries do not survive into geometry.doors; valid doors are unchanged except approved healing', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const p = {
        geometry: {
          width: 24, length: 40, eaveHeight: 6, ridgeHeight: 6.5, roofForm: 'Duo-pitch (indicative)',
          doors: [
            { id: 'rd1', ref: 'RD1', type: 'roller', wall: 'front', offset: 5, width: 4.6, height: 4, access: 'Van', source: 'generated' },
            { id: 'pd1', ref: 'PD1', type: 'personnel', wall: 'back', offset: 5, width: 1, height: 2.1, source: 'customer' },
            { id: 'pd2', ref: 'PD2', type: 'personnel', wall: 'left', offset: 5, width: 1, height: 2.1 }, // no source -> legacy
            null,
            undefined,
            'corrupted-string-entry',
            ['not', 'a', 'door'],
            123,
          ],
        },
      };
      const geom = buildGeometry(p);
      return { count: geom.doors.length, doors: geom.doors.map(d => ({ id: d.id, source: d.source })) };
    });
    expect(result.count, 'only the 3 well-formed door objects should survive; every malformed entry must be dropped').toBe(3);
    expect(result.doors).toEqual([
      { id: 'rd1', source: 'generated' },
      { id: 'pd1', source: 'customer' },
      { id: 'pd2', source: 'legacy' },
    ]);
  });
});
