// Visual-Asset Integrity Governance Check (2026-08-30 — Approved Four-Icon
// Set Governance Failure Investigation). Added after a completion report
// stated the four approved CHECK/UNDERSTAND/DECIDE/MOVE FORWARD PNG icons
// were live in every governed homepage/pricing location, while a real
// device screenshot appeared to show otherwise. Investigation proved the
// server, app.js and asset files were all already correct on every path
// (disk/localhost/tunnel byte-identical, zero failed requests, a fresh
// cache-disabled load rendered every position correctly) — the mismatch
// was a stale client-side view, not a code defect. That investigation is
// exactly the gap this file closes permanently:
//
// A source-code reference (grepping app.js for the right <img src=...>
// string) is NOT sufficient evidence that a governed visual asset is
// actually live — the only real evidence is the ACTUAL BROWSER-RENDERED
// element, loaded fresh, resolving to the approved file. This spec
// automates exactly that check so a future completion report can never
// again claim "approved visual asset applied" without it being backed by
// a passing, real-render assertion — for all 16 governed positions across
// both pages, at both a desktop and a mobile width.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Approved Four-Icon Set — Pixel-Level Artwork Integrity (2026-08-30,
// second governance escalation): the DOM-level checks below this comment
// prove the browser renders the EXPECTED FILENAME — they do not prove the
// FILE ITSELF contains the approved artwork (a filename/hash/naturalWidth
// check cannot catch the file at that path having been overwritten with
// the wrong picture). This block closes that specific gap with a
// deterministic pixel comparison: it re-crops each icon fresh from a
// committed copy of the approved source composite and compares every
// pixel against the currently-stored asset.
//
// The approved source lives outside this repo (on Stuart's OneDrive, not
// under version control) — fixtures/approved-four-icon-reference.png is a
// byte-identical copy of it (verified by SHA-256 at the time it was added
// — see the governance report), committed here so this check is
// deterministic and portable (works in CI/on any machine), not dependent
// on an external absolute path. If the approved source artwork is ever
// revised, this fixture must be replaced with the new approved file, not
// edited or redrawn.
const REFERENCE_IMAGE = path.join(__dirname, 'fixtures', 'approved-four-icon-reference.png');
const ASSET_DIR = path.join(__dirname, '..', '..', 'Project-Check-MVP-Master-Build', 'assets');
// Crop boxes for each icon within the reference composite — found by
// scanning the source for each icon's own circle vs. the white
// background/gap before its text label (see the original crop script),
// padded 6px each side. These must stay in sync with how the approved
// assets were originally cropped; they are not arbitrary.
const REFERENCE_CROPS = {
  'project-check-icon-check.png': [20, 370, 280, 641],
  'project-check-icon-understand.png': [402, 750, 281, 641],
  'project-check-icon-decide.png': [778, 1127, 280, 641],
  'project-check-icon-moveforward.png': [1155, 1508, 280, 641],
};

test.describe('Visual-asset integrity — pixel-level artwork check (not just filename)', () => {
  for (const [filename, [x0, x1, y0, y1]] of Object.entries(REFERENCE_CROPS)) {
    test(`${filename} pixels match the approved source artwork`, async ({ page }) => {
      const referenceB64 = fs.readFileSync(REFERENCE_IMAGE).toString('base64');
      const assetB64 = fs.readFileSync(path.join(ASSET_DIR, filename)).toString('base64');
      const cw = x1 - x0, ch = y1 - y0;
      await page.setContent(`<img id="ref" src="data:image/png;base64,${referenceB64}">`);
      await page.waitForFunction(() => document.getElementById('ref').complete);
      const result = await page.evaluate(async ({ x0, y0, cw, ch, assetB64 }) => {
        const refImg = document.getElementById('ref');
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cw; cropCanvas.height = ch;
        cropCanvas.getContext('2d').drawImage(refImg, x0, y0, cw, ch, 0, 0, cw, ch);
        const cropData = cropCanvas.getContext('2d').getImageData(0, 0, cw, ch).data;
        const assetImg = new Image();
        await new Promise((resolve, reject) => { assetImg.onload = resolve; assetImg.onerror = reject; assetImg.src = 'data:image/png;base64,' + assetB64; });
        const assetCanvas = document.createElement('canvas');
        assetCanvas.width = cw; assetCanvas.height = ch;
        assetCanvas.getContext('2d').drawImage(assetImg, 0, 0, cw, ch);
        const assetData = assetCanvas.getContext('2d').getImageData(0, 0, cw, ch).data;
        let diffPixels = 0;
        const threshold = 10; // tolerate only trivial re-encoding rounding
        for (let i = 0; i < cropData.length; i += 4) {
          const m = Math.max(
            Math.abs(cropData[i] - assetData[i]),
            Math.abs(cropData[i + 1] - assetData[i + 1]),
            Math.abs(cropData[i + 2] - assetData[i + 2]),
            Math.abs(cropData[i + 3] - assetData[i + 3]),
          );
          if (m > threshold) diffPixels++;
        }
        return { diffPixels, totalPixels: cw * ch, diffPercent: diffPixels / (cw * ch) * 100 };
      }, { x0, y0, cw, ch, assetB64 });
      expect(result.diffPercent, `${filename}: ${result.diffPixels}/${result.totalPixels} pixels (${result.diffPercent.toFixed(3)}%) differ from the approved source artwork — the stored asset does not contain the approved picture`).toBeLessThan(1);
    });
  }
});

// One source of truth for the four approved assets and where they are
// governed to appear — add a new governed location here, not by copying
// the assertion block, if one is ever added.
const APPROVED_ICONS = {
  CHECK: 'project-check-icon-check.png',
  UNDERSTAND: 'project-check-icon-understand.png',
  DECIDE: 'project-check-icon-decide.png',
  'MOVE FORWARD': 'project-check-icon-moveforward.png',
};

// Asserts one .journey-icon slot renders an <img> (never a fallback
// inline <svg>) whose src is exactly the approved filename for that
// label, and that the image actually decoded (naturalWidth > 0) — this
// is what actually catches a wrong/missing path or a reverted-to-SVG
// regression that a plain source-code grep would miss entirely.
async function assertApprovedIcon(container, label) {
  const expectedFile = APPROVED_ICONS[label];
  expect(expectedFile, `no approved asset mapping for label "${label}" — update APPROVED_ICONS`).toBeTruthy();
  const img = container.locator('.journey-icon img');
  await expect(img, `${label}: expected an <img> icon, found none (possibly still an inline <svg> fallback)`).toHaveCount(1);
  const svgFallback = await container.locator('.journey-icon svg').count();
  expect(svgFallback, `${label}: an inline <svg> is present alongside/instead of the approved PNG`).toBe(0);
  const src = await img.getAttribute('src');
  expect(src, `${label}: <img> src does not reference the approved asset`).toContain(expectedFile);
  const naturalWidth = await img.evaluate(el => el.naturalWidth);
  expect(naturalWidth, `${label}: image did not actually load (naturalWidth 0 — broken/missing file at "${src}")`).toBeGreaterThan(0);
}


async function checkHomepageIcons(page) {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForSelector('text=From idea to informed decision.');
  const heroSteps = page.locator('.journey-step');
  await expect(heroSteps).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const step = heroSteps.nth(i);
    const label = await step.locator('.eyebrow').innerText();
    await assertApprovedIcon(step, label.toUpperCase());
  }
  const cards = page.locator('.stagecard');
  await expect(cards).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const card = cards.nth(i);
    const label = await card.locator('.eyebrow').innerText();
    await assertApprovedIcon(card, label.toUpperCase());
  }
}

// checkPricingIcons() REMOVED 2026-09-10 (Guided Route Pricing Page
// rebuild, Stuart's explicit instruction): the CHECK/UNDERSTAND/DECIDE/
// MOVE FORWARD four-icon journey strip and the four .price-card elements
// it checked no longer exist on Pricing — the page is now a step-by-step
// guided journey with no PNG icon set at all (see app.js's pricing()).
// The Homepage's own 8 governed icon positions (unaffected, unchanged)
// are still fully checked below.

test.describe('Visual-asset integrity — approved four-icon set', () => {
  test('homepage: all 8 governed icon positions render the approved PNGs (desktop)', async ({ page }) => {
    await checkHomepageIcons(page);
  });

  test('homepage: all 8 governed icon positions render the approved PNGs (390x844 mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await checkHomepageIcons(page);
  });
});
