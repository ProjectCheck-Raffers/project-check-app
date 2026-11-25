> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Now lives in project-check-app under docs/governance/. Root-level file names in this text (AGENTS.md, PROJECT-SOURCE-OF-TRUTH.md, etc.) now sit in this folder. Client jobs are anonymised as Job A–O; infrastructure IDs and security details are redacted. Where this file and the root CLAUDE.md disagree, CLAUDE.md wins.

# Project Check — Test Map

This describes the **actual, committed** automated test suite in `tests/playwright/`. It does not describe the many one-off "Planning Batch N" / "Evidence Intelligence Batch N" scripts referenced throughout `Project-Check-MVP-Master-Build/CHANGELOG.md` — those were scratch verification scripts run during development against synthetic fixtures and were never committed to this repository. Their pass/fail counts are recorded as historical evidence in the changelog; they are not suites you can run today.

## How to run it

From `tests/playwright/`:
```
npx playwright test
```
(`package.json`'s only script is `"test": "playwright test"`.) Requires the local static server to be reachable — see `Project-Check-MVP-Master-Build/START-HERE.txt` (`npx serve .` from inside `Project-Check-MVP-Master-Build/`).

Device/browser coverage is defined entirely in `playwright.config.js` via named **projects** — most spec files run once per relevant project, not once overall. Real projects, confirmed by inspection: `mobile-small-chromium`, `mobile-standard-chromium`, `mobile-large-chromium`, `tablet-portrait-chromium`, `tablet-landscape-chromium`, `desktop-1280-chromium`, `desktop-1440-chromium` (all → `journey.spec.js` only), `standard-phone-webkit`, `tablet-portrait-webkit`, `desktop-webkit`, `standard-phone-firefox`, `desktop-firefox` (all → `cross-browser.spec.js` only), and `functional-chromium` (→ `security`, `accessibility`, `error-handling`, `live-map`, `geometry-audit`, `geometry-functions`, `document-identity`, `stage1-report`, `stage1-geometry-continuity`, `stage1-map-rotation` specs), and `map-rotation-mobile-chromium` (2026-08-27, Stage 1 Map Architecture task — → `stage1-map-rotation.spec.js` only, at a touch-enabled 390×844 mobile viewport; added narrowly rather than widening the 7-device `journey.spec.js` matrix, since that file is the only one needing touch-capable coverage).

## Suites (real files, confirmed by inspection)

| Suite file | What it protects | Tests in file |
|---|---|---|
| `journey.spec.js` | The complete customer journey (Stage 1 → Stage 2 → Stage 3), across 7 device-width projects | 1 test, run × 7 device projects |
| `cross-browser.spec.js` | The same core journey across non-Chromium engines (WebKit, Firefox) at representative sizes — deliberately narrower than `journey.spec.js`'s full 7-class coverage, documented as an intentional scoping decision | 1 test, run × 5 browser/device projects |
| `security.spec.js` | XSS regression (address field, supplier-quotation table rendering reach the report unexecuted) | 3 tests |
| `accessibility.spec.js` | Automated accessibility checks (axe-core) at key pages, including the Stage 1 report | 5 tests |
| `error-handling.spec.js` | Graceful failure of external calls (report-reference-image fetch, geocoding) — must degrade, not hang/silently break | 5 tests |
| `geometry-audit.spec.js` | `geometry.js`/`drawing.js` output correctness: door-source persistence across edits/reload, canopy plan-view line-style correctness, Stage 1 fire-door-hint suppression at edge values | 6 tests |
| `geometry-functions.spec.js` | Focused unit-style checks of individual geometry-derivation behaviours (e.g. the retired-but-preserved fire-door allowance calculation, gating logic) | 11 tests |
| `live-map.spec.js` | The live map/geocoding integration — a **deliberate opt-in** test, gated behind `RUN_LIVE_MAP_TEST=1`; skipped otherwise, not a failure | 1 test |
| `document-identity.spec.js` | The Common Evidence Intelligence Layer — Batch 1 (Document Identity & Provenance) in `evidence.js`: partial-evidence identity creation, provenance separation (source/uploader/originator/authority), project isolation (known-different vs unidentified project association kept distinct), identity-certainty matching (exact/probable/possible/no-match/unknown), revision-vs-status separation, conservative current-applicability, legacy-evidence compatibility | 19 tests — 13 added 2026-08-27, extended to 19 the same day by the unknown-project-association precision repair |
| `stage1-report.spec.js` | The Stage 1 report restructuring (discipline-segregated sections, restrained/non-approval language, genuine-vs-honest-empty-state flags) | 3 tests |
| `stage1-geometry-continuity.spec.js` | The Stage 1 footprint geometry/data-continuity fix — a customer changing width/length after confirming the building footprint on Map 1 must never leave `p.facts.buildingFootprint` silently stale; includes a real-UI end-to-end test (real map click placement, real 3-point boundary draw, a "Review Stage 1" round trip) proving the report-reading field itself carries the corrected value | 5 tests |
| `stage1-map-rotation.spec.js` | The Stage 1 Map Architecture task (2026-08-27, MapLibre GL JS migration): map-view bearing rotation kept strictly separate from BUILDING rotation and from stored geographic coordinates — desktop rotate/reset-north controls, bearing carrying from Map 1 to Map 2, boundary/measurement math unaffected by bearing, two-finger-touch configuration, and report geometry using the building's own rotation, never the map's view bearing | 10 tests, run on both `functional-chromium` (desktop) and `map-rotation-mobile-chromium` (touch-enabled mobile) — 20 test executions total |

`helpers.js` is shared test scaffolding (`signUpAndCreateProject`, `completeStage1`, `answerCurrentQuestion`, WebKit-quirk detection helpers, etc.) — not a suite itself.

## Current, freshly-verified baseline (2026-08-27, Customer Journey Completion Programme, Phase 1)

Full suite (`npx playwright test`, no filter — every project), run after this normalisation's Commit 4:

```
91 passed, 2 failed, 3 skipped   (5.1 minutes)
```

This resolves the historical 22-failure baseline recorded below — see `DECISION-LOG.md` for the formal supersession record. The root cause (a stale `hgvRoute` element left in `tests/playwright/helpers.js`'s `STAGE1_ANSWERS` fixture array, silently shifting every subsequent answer by one position) is documented in full in `CHANGELOG.md`'s "Customer Journey Completion Programme, Phase 1" entry. The 2 remaining failures are the same, previously-known, previously-accepted `suggestedPersonnelDoorAllowance()` perimeter÷32m retired-rule assertions (`geometry-audit.spec.js`/`geometry-functions.spec.js` — see `DECISION-LOG.md`'s separate "Personnel-door 'perimeter ÷ 32m'..." row); the 3 skips are the documented WebKit-mobile viewport-scaling accepted skips plus the opt-in `live-map.spec.js` test. **Zero new failures anywhere in the suite.**

## Prior baseline history

**Re-run as part of the developer-onboarding audit (2026-08-27, at commit `d7b2dac`, read-only — no code changed):**

```
23 passed, 22 failed, 1 skipped   (12.9 minutes)
```

**Re-run again after Common Evidence Intelligence Layer Batch 1 (2026-08-27, `document-identity.spec.js` added — see below):**

```
36 passed, 22 failed, 1 skipped   (12.7 minutes)
```

**Re-run a third time after the same-day unknown-project-association precision repair (2026-08-27, `document-identity.spec.js` extended from 13 to 19 tests):**

```
42 passed, 22 failed, 1 skipped   (12.7 minutes)
```

The passed count rose by exactly 13 after Batch 1, then by a further 6 after the precision repair (36→42) — precisely matching the new `document-identity.spec.js` suite's growth — and the **same, identical 22 failing tests** (by name and project) recur in all three runs. This is a clean, decisive confirmation: **neither Batch 1 nor its precision repair introduced any new failure.**

Both figures are an **exact match** (aside from the expected +13) to the figure recorded repeatedly throughout `CHANGELOG.md` as "Existing full-suite regression-debt checkpoint (23 passed/22 failed/1 skipped, pre-existing, unrelated)" across every Evidence Intelligence and Planning Intelligence batch on 2026-08-26 and every Discovery/governance task on 2026-08-27 — none of which touched product code. **This confirms the debt is stable and unchanged at the current baseline, not something newly introduced.**

**This figure is recorded as KNOWN, PRE-EXISTING REGRESSION DEBT / OBSERVED BASELINE — it is NOT an accepted definition of correct product behaviour.** The 22 failing scenarios are not deemed acceptable, working-as-intended, or a target to preserve — they are unresolved defects that happen to already exist and have not yet been separately investigated and authorised for repair. "Baseline" in this document means *the state observed*, never *the state approved*.

The 22 failures observed in this re-run:
- All 7 `journey.spec.js` device-project runs (`mobile-small/standard/large-chromium`, `tablet-portrait/landscape-chromium`, `desktop-1280/1440-chromium`)
- All 5 `cross-browser.spec.js` browser/device-project runs (`standard-phone-webkit`, `tablet-portrait-webkit`, `desktop-webkit`, `standard-phone-firefox`, `desktop-firefox`)
- `accessibility.spec.js` — "Stage 1 report"
- `error-handling.spec.js` — the report-reference-image and geocoding graceful-failure tests (2)
- `geometry-audit.spec.js` — door-source persistence, canopy dashed/solid edge rendering, and both Stage 1 fire-door-hint edge-case tests (4)
- `geometry-functions.spec.js` — the fire-door-allowance-gating test (1)
- `security.spec.js` — both XSS regression tests (2)

Every failure captured in this re-run timed out identically at the same point: `helpers.js`'s `answerCurrentQuestion()` waiting for `#answer` to become visible. This is consistent with a single shared root cause across many nominally-different tests, not 22 independently-broken behaviours — but **this onboarding task did not diagnose or fix it**, per the instruction below.

`1 skipped` = `live-map.spec.js`'s deliberate `RUN_LIVE_MAP_TEST` opt-in gate — expected, not debt.

## KNOWN REGRESSION DEBT MUST NOT BE REPAIRED AS PART OF AN UNRELATED TASK WITHOUT AUTHORISATION.

This 22-failure baseline has been present, named, and explicitly carried forward as "pre-existing, unrelated" through every governed task since at least the start of Evidence Intelligence Batch 1 (2026-08-26) — it predates essentially all Evidence Intelligence, Planning Intelligence, and Discovery Programme work. If your task touches an area that happens to also be covered by one of these failing tests, **do not silently "fix" the failure as a side effect** — flag it and get explicit authorisation, exactly as this pack's own repeated regression-checks have always done (see the historical pattern in `CHANGELOG.md`: "Existing full-suite regression-debt checkpoint... preserved, not re-run, not touched").

## What "accepted" looks like for a real focused change

The historical pattern for every implementation batch in `CHANGELOG.md` was: run the specific new/updated focused suite for the area you changed (historically these were scratch scripts, not committed — for `app.js`/`geometry.js`/`drawing.js` changes, the equivalent today is the relevant real suite above, e.g. `geometry-audit.spec.js`/`geometry-functions.spec.js` for geometry changes, `journey.spec.js` for a Stage 1/2/3 flow change) — confirm it still passes at whatever count it passed at before your change, document any assertion you deliberately change and why, then note (but do not attempt to fix) the pre-existing 22-failure baseline above.

## Known relationships / regression expectations

- A change inside `geometry.js` or `drawing.js` should be checked against `geometry-audit.spec.js` and `geometry-functions.spec.js` at minimum.
- A change touching the Stage 1/2/3 flow, routing, or `app.js` rendering should be checked against `journey.spec.js` (and, engine permitting, `cross-browser.spec.js`).
- A change touching evidence upload/rendering or Stage 1/2 output should be checked against `security.spec.js` and `accessibility.spec.js` (both exercise real Stage 1/2 flow content).
- `evidence.js`'s Evidence Intelligence/Planning Intelligence logic has **no dedicated file in this committed suite** — its historical verification was via the scratch batch scripts described above. Any current change to `evidence.js` should, at minimum, be checked against the general suites above (nothing in `evidence.js` should be able to break `journey.spec.js`'s core flow) and reported honestly if no more specific committed suite exists for the exact behaviour changed.
