> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

> SUPERSEDED AS CURRENT OPERATING AUTHORITY — historical record, 22 September 2026. Read [PROJECT-SOURCE-OF-TRUTH.md](PROJECT-SOURCE-OF-TRUTH.md) first. The original text below is preserved; it does not authorise old branches, deployment routes, architecture or asset authority. Active runtime files remain preserved.

# Direction C — complete Stage 1 / Stage 2 working model (trial)

Status: **TRIAL / NOT APPROVED FOR MASTER**

This branch (`trial/direction-c-complete-working-model`) is isolated from
`master` and exists for Stuart's live, page-by-page visual and journey
review. It supersedes the earlier, narrower `trial/direction-c-stage1-
stage2` branch, which only styled the 34 numbered question screens and only
below 858px.

## Locked Figma sources

File `BYsnm3HI7VBBZQyVnRbiTI` (read-only; nothing was written back to Figma).

| Locked frame | Node | Implemented as |
|---|---|---|
| Homepage | `98:383` | Pre-existing `.pcfig-*` implementation (unchanged — see "Homepage" below) |
| Stage 1 canvas | `111:16` | 12 question screens (`stage1()`) |
| Stage 2 canvas | `115:16` | 22 question screens (`stage2()`) |
| Stage 1 question (representative) | `111:19` | `.dc-page-question` + `.dc-stage1-screen` |
| Stage 2 question (representative) | `115:19` | `.dc-page-question` + `.dc-stage2-screen` |
| Building-position map | `112:112` | `.dc-page-map` (`buildingPositionMap()`) |
| Site-boundary map | `113:168` | `.dc-page-map` (`siteBoundaryMap()`) |
| Conditional roller doors | `113:16` | `.dc-page-doors` (`rollerDoors()`) |
| Consolidated client details | `114:81` | `.dc-page-client` (`stage1ClientInput()`) |
| Stage 1 report | `114:141` | `.dc-page-report` (`stage1Summary()`) |
| Stage 2 report | `116:16` | `.dc-page-report` (`stage2Summary()`) |
| Doors and drawing review | `116:94` | `.dc-page-doorsreview` (`doorReview()`) |

All 34 Stage 1 (12) and Stage 2 (22) question frames were inspected via
`get_metadata` on both canvases and confirmed to share one template each
(same header/badge/field/actions structure, different copy) — matching the
representative-node detail pull exactly, so one CSS treatment per stage
correctly covers all of them.

**Not a locked frame:** `dashboard()`/`project()` (customer + project
workspace). No frame for these exists in the locked list above, so they
received Direction C *tokens* (colour, radius, type) for visual consistency
with the rest of the journey, not an invented pixel-accurate redesign. Same
for the sign-in/create-account modal (`authModal()`) — functionality is
fully preserved and untouched; only the ambient design tokens apply, since
no locked frame governs it either.

## Scope

- Apply the Direction C visual system to the existing, working Stage 1 and
  Stage 2 journeys — questions, maps, conditional roller doors, client
  details, reports, drawing/door review — at every required width (390,
  430, 768, 858 locked, 1280, 1440).
- Preserve all existing question wording, order, fact keys, validation,
  routing, maps, uploads, evidence logic, drawing/door mechanics, reports,
  PDF downloads, storage and risk rules exactly.
- Do not alter Project Check colours, branding, logo or business logic.
- Do not merge to `master` without Stuart's explicit approval.

## Trial architecture

Presentation-only enhancement layer, unchanged in principle from the
original trial, now covering every locked page instead of only the
question screens, and every required width instead of only ≤858px:

- `direction-c-trial.css` — all Direction C styling. Loaded after
  `styles.css`, so equal-specificity rules here win without `!important`
  (used only where a page also carries an inline `style=""` from `app.js`).
  The 858px-capped, centred container is what makes one set of rules
  correctly reproduce the locked frame at exactly 858px and scale fluidly
  down to 390px and up to 1440px, rather than needing separate desktop
  layout rules.
- `direction-c-trial.js` — classifies which locked page is on screen by
  reading the exact `.pagehead .eyebrow` text `app.js` already renders
  (the one reliable per-page signal — see the file's own comment for why
  `document.body.dataset.page` isn't used), then adds/reorders a small
  number of purely visual elements: a stage badge, a progress-% label, and
  a title-keyed white/pale-green tone class on report and doors-review
  cards (title-keyed, not position-keyed, because the Stage 1 report's
  "Preliminary building illustration" card is genuinely conditional and a
  position-based alternation would misfire when it's absent).
- `index.html` — adds a Google Fonts `Inter` link. `styles.css` already
  specified `font-family: Inter, …` sitewide, but no Inter webfont was ever
  actually loaded, so every page was silently rendering in the Segoe
  UI/Arial fallback; Direction C's system requires the real typeface.

Removing all three changes (the two trial files' content, and the font
`<link>` in `index.html`) restores the prior presentation exactly.

### Homepage

The homepage already had its own Figma-matched implementation (the
`.pcfig-*` markup in `home()`, `styles.css`) from earlier, separately
approved work, gated to ≤858px with explicit "desktop is completely
untouched" governance comments. This build does **not** extend it above
858px — inventing a desktop composition beyond the locked frame's own
858px pixel data would conflict with that explicit prior lock, so the
existing >858px classic homepage layout is left exactly as it was
(no regression, nothing new invented). **Flagged for Stuart's review**:
confirm whether the homepage should also adopt the Direction C treatment
above 858px, or stay as-is.

### `.steps` question-navigator sidebar

Previously shown ≥900px width as a desktop-only convenience (non-
interactive — no click handler in `app.js`, informational only). The
locked Figma question frames don't include it at any width, so it is now
hidden consistently everywhere via Direction C, matching the "operate
consistently across all supported widths" requirement. **Material visual
difference from before**: desktop users lose this sidebar; flagged for
Stuart's review, not hidden as a change.

## Authorised implementation files (this build touched only these)

- `Project-Check-MVP-Master-Build/index.html` — Google Fonts `Inter` link only.
- `Project-Check-MVP-Master-Build/direction-c-trial.css` — full rewrite.
- `Project-Check-MVP-Master-Build/direction-c-trial.js` — full rewrite.
- `TRIAL-DIRECTION-C.md` — this file.
- `tests/playwright/journey.spec.js` — not modified; the existing suite
  already covers every required width and passed unchanged (see below).

`app.js`, geometry/drawing/evidence/intelligence/storage logic, governance
documents and Stage 3 were not touched.

## Testing performed

- `tests/playwright/journey.spec.js` — full customer journey (sign-up,
  project creation, all 12 Stage 1 questions with Back/Save/illustration-
  order checks, both maps with search/measure/zoom, Consolidated Client
  Input page, Stage 1 report, Stage 2's 22 questions, Stage 2 report + PDF
  download, doors & drawing review add/remove/reposition/confirm) — **all
  7 required device-width Chromium projects passed** (360, 390, 428, 820,
  1180, 1280, 1440).
- Full existing suite (security, accessibility, cross-browser WebKit/
  Firefox, geometry, brain-rule batches, homepage-visual-lock, navigation,
  content-integrity, stage1-question-header/reduction/consolidated-client-
  input/geometry-continuity/map-rotation/report) run for full regression
  coverage.
- A throwaway visual/overflow verification script (not part of the repo)
  walked the full journey — home → sign-up → new project → Stage 1 Q1 →
  roller doors → Map 1 → Map 2 → client details → Stage 1 report → Stage 2
  Q1 → Stage 2 report → doors & drawing review — at exactly the six
  required widths (390/430/768/858/1280/1440): **0 horizontal-overflow
  failures across all 72 page/width combinations**, screenshots reviewed
  against the locked Figma frames.
