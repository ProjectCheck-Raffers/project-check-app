> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

# Project Check — Code Map

Maps the real source files to their responsibilities, based on direct inspection at commit `d7b2dac`. All files below live inside `Project-Check-MVP-Master-Build/` (the nested product folder — see repository layout note at the bottom).

**Load order** (from `index.html`): MapLibre GL JS (map — **migrated from Leaflet 1.9.4 on 2026-08-27**, see below) → jsPDF (report export) → `geometry.js` → `drawing.js` → pdf.js (PDF text extraction, loaded via a plain `<script>` tag, driven by `evidence.js`'s own `GlobalWorkerOptions.workerSrc`) → `evidence.js` → `app.js`. This order matters: `app.js` calls functions defined in all the others as plain globals — there is no module system, so **load order is the dependency graph.**

## `app.js` (~1,527 lines)

**Primary responsibility:** the whole customer-facing application shell — routing, state persistence, auth, Stage 1/2/3 rendering and flow control, the site-boundary/building-position map UI, the door editor, the drawing/report pages, and pricing/quotes.

**Important functions/areas:**
- State: `loadState()`, `save()` (implicit via `KEY`/`defaultState`), `stripProtoKeys()` (prototype-pollution guard on `localStorage` load).
- Routing/auth: `route()`, `render()`, `syncAuth()`, `authModal()`, `requireUser()`, `logout()`.
- Stage 1: `stage1()`, `saveStage1()`, `runStage1Risks()`, `stage1Summary()`, `stage1MissingInfo()`, roller-door/personnel-door helpers (`rollerDoors()`, `doorRuleFor()`).
- Maps (MapLibre GL JS since 2026-08-27 — see caution below): `buildingPositionMap()`, `siteBoundaryMap()`, `updateBuildingLayer()`, `redrawMeasure()`, `approxAreaM2()`, `haversineMetres()`. Map-VIEW bearing (rotation-native, separate from building rotation): `createProjectCheckMap()`, `mapStyleSpec()`, `setBaseLayer()`, `rotateMapView()`, `resetMapNorth()`, `updateBearingReadout()`, `getSavedMapBearing()`/`saveMapBearing()` (sessionStorage-only view state — never written into `p.facts`).
- Stage 2: `stage2()`, `saveStage2()`, `runStage2Risks()`, `stage2Summary()`, `planningProgressionSectionHtml()`, `planningSourceCustomerLine()`, `checkPlanningPortalSource()` (internal-only Planning portal source card).
- Quotes/pricing: `quotes()`, `addQuote()`, `requestThreeSuppliers()`, `selectPlan()`, `pricing()`.
- Stage 3: `stage3Actions()`, `stage3CustomerStatusLabel()`, `stage3StatusIsClosedLike()`.
- Door editor: `doorReview()`, `renderDoorReview()`, `addDoor()`, `removeDoor()`, `confirmDoors()`.
- Legal/account pages: `termsPage()`, `privacyPage()`, `authModal()`.

**Dependencies/interfaces:** calls into `geometry.js` (`buildGeometry`, `ensureGeometry`, `validateGeometry`), `drawing.js` (`buildingDrawingSVG`, `svgToPngDataUrl`), and `evidence.js` (the entire Evidence/Planning Intelligence surface — too many call sites to list individually; search `evidence.js`'s exported function names in `app.js` to trace a specific one). Reads/writes `localStorage` directly via `loadState()`/`save()`.

**Governance/spec that controls it:** `MASTER-SPEC.md` in full (this file *is* the customer journey). Question wording/order changes are governed by `MASTER-SPEC.md` § "Question, Evidence & Rule Development governance" — see `DEVELOPER-RULES.md` rule 6.

**Cautions:** this file has become the single largest concentration of UI logic in the product (routing, three separate map UIs, the door editor, and every stage's rendering all live here). That is architectural reality, not something to refactor as part of an unrelated task — see `DEVELOPER-RULES.md` rule 12. **Map renderer (2026-08-27):** MapLibre GL JS, not Leaflet — `metresToFootprintCorners()`/`buildingDims()` (the actual geometry math) are completely unchanged; only the rendering-API call sites (`updateBuildingLayer()`, `redrawBoundary()`, `redrawMeasure()`, marker/click handling) were rewritten, converting between the app's `{lat,lng}` shape and MapLibre's `[lng,lat]`/`e.lngLat` shape only at the narrowest possible point (see the governing comment above `mapStyleSpec()` in `app.js`). Map-view bearing is explicit, transient, session-scoped view state — never conflated with `activeFootprintAngle` (building rotation) or any stored geographic coordinate. See `MASTER-SPEC.md` § "Map implementation" and `tests/playwright/stage1-map-rotation.spec.js`.

## `evidence.js` (~5,678 lines, 137 top-level functions)

**Primary responsibility:** all Evidence Intelligence and Planning Intelligence logic — document extraction, cross-document discrepancy/responsibility/package reasoning, Stage 2 findings, Stage 3 action generation, the Impact Register, and the entire Planning lifecycle (application identity, portal source, requirement/consultee/variation closure logic).

**Important functions/areas** (line numbers as of `d7b2dac`, for orientation — re-check if the file has moved on):
- Extraction: text/PDF/DOCX extraction dispatcher (Batch 1/1B, top of file).
- Evidence records: `createEvidenceRecord()` (L128), `crossCheckEvidence()` (L537), `guessPackageFromFilename()` (L941), `crossCheckResponsibility()` (L1490).
- Findings/actions: `buildStage2Findings()` (L3246), `buildStage3Actions()` (L3616), `assessConflictResolution()` (L3181).
- Impact Register: `createStage3ImpactRegisterEntry()` (L2088), `addStage3ImpactRegisterEntry()` (L2128), `seedPlanningBatch2ImpactRegisterEntries()` (L2202), `reviewPlanningBatch3ImpactRegisterEntries()` (L2237), `reviewPlanningBatch4ImpactRegisterEntries()` (L5341), `reviewPlanningBatch5ImpactRegisterEntries()` (L5672).
- Planning: `buildProjectPlanningIntelligence()` (L4547), `buildPlanningPortalPlaceholder()` (L4520), `derivePlanningApplicationIdentity()` (L5410), `createPlanningPortalSource()` (L5426), `classifyPlanningPortalDocumentRelevance()` (L5505), `ingestPlanningPortalDocument()` (L5542), `refreshPlanningPortalSource()` (L5592), `assessPlanningRequirementClosure()` (L5167), `buildPlanningRequirementActions()` (L5192), `assessPlanningVariationResolution()` (L3205).
- A minimal, self-contained central-directory-based ZIP reader lives inline (around L2371) — used for portal document handling, not a third-party dependency.
- **Common Evidence Intelligence Layer — Batch 1 (2026-08-27, document identity & provenance):** `createDocumentIdentity()`, `DOCUMENT_IDENTITY_CERTAINTY`, `DOCUMENT_CURRENT_APPLICABILITY`, `DOCUMENT_DELIVERY_SOURCE`, `detectDocumentRevisionToken()`, `detectDocumentStatusToken()`, `buildDocumentIdentity()`, `assessDocumentIdentityMatch()`, `assessDocumentCurrentApplicability()` — inserted directly after `classifyDocumentType()`, wired into `buildProjectEvidenceLedger()` as `e.documentIdentity` (same idempotent per-document pattern as `documentType`/`packages`). See `EVIDENCE-INTELLIGENCE-SPEC.md` § "Common Evidence Intelligence Layer — Batch 1" and `TEST-MAP.md`.

**Dependencies/interfaces:** consumes pdf.js (loaded globally via `index.html`) for PDF text extraction. Everything it produces is read by `app.js` — it renders no HTML itself (search `app.js` for the specific function name to find its call site and customer-facing presentation).

**Governance/spec that controls it:** `EVIDENCE-INTELLIGENCE-SPEC.md` in full — every batch section in that spec corresponds to a real, dated section of this file (search the spec's batch heading text for the matching code comment).

**Cautions:** organised as sequential dated "batches" appended over time (see the `// ===...===` section dividers throughout) rather than reorganised by concern — this is deliberate, documented architectural history, not disorganisation to "clean up." Extending an existing batch's behaviour should reuse its existing functions/patterns, not create a parallel one (see `DEVELOPER-RULES.md` rule 1).

## `geometry.js` (~300 lines)

**Primary responsibility:** Project Check's own single source of truth for **the customer's building geometry** — derives door/canopy/building geometry from the Stage 1/2 facts, independent of any rendering. Its own top comment: *"Project data (Stage 1/2 facts) -> this module -> map footprint / plan / elevations / reports. Deliberately renderer-independent: no SVG/DOM code lives here."*

**Important functions/areas:** `buildGeometry()` (L149) — the main entry point; `deriveGeometryFromFacts()` (L112), `deriveDoorsFromFacts()` (L47), `deriveCanopyGeometryFromFacts()` (L91); `ensureGeometry()` (L232) — idempotent lazy-build/heal; `sanitizeDoorIds()`/`sanitizeDoorSources()`/`healDoorSource()` — legacy-data healing; `validateGeometry()` (L286) — Stage 2 geometry-conflict warnings; `suggestedPersonnelDoorAllowance()` (L32) — **preserved but uncalled**, see `CURRENT-STATE.md`.

**Dependencies/interfaces:** none outward — pure functions over a project object's `facts`. `drawing.js` and `app.js` both consume `buildGeometry()`'s output.

**Governance/spec that controls it:** `MASTER-SPEC.md` § "Project geometry & drawings". The historical retirement of the personnel-door calculation is governed by `EVIDENCE-INTELLIGENCE-SPEC.md`'s Job B fire-strategy record and `MASTER-SPEC.md` § "Personnel doors / means-of-escape responsibility split".

**Cautions:** this is explicitly **not** the same thing as future "Drawing Intelligence" (DI-05) — it builds geometry *for* the customer's own building from their own answers, it does not extract geometry *from* an uploaded third-party drawing. Do not conflate the two when scoping future work.

## `drawing.js` (~260 lines)

**Primary responsibility:** SVG rendering of the geometry `geometry.js` produces — plan/elevation drawings and PNG export. Its own top comment: *"Consumes buildGeometry(p) from geometry.js. No geometry/business logic lives here... this file can be swapped for a better rendering/CAD engine later without touching the geometry model."*

**Important functions/areas:** `buildingDrawingSVG()` (L140) — structure-aware entry point, branches only on `geom.structureType`; `renderStandardDrawingSVG()` (L149), `renderCanopyDrawingSVG()` (L189); `svgToPngDataUrl()` (L250) — export path; small SVG primitive helpers (`pcDimLine`, `pcWitness`, `pcGroundLine`, `pcCladdingHatch`, `pcTitleBlock`, `pcBanner`).

**Dependencies/interfaces:** pure consumer of `geometry.js`'s `buildGeometry()` output; called from `app.js` wherever a drawing/report is shown or exported.

**Governance/spec that controls it:** `MASTER-SPEC.md` § "Project geometry & drawings" (same section as `geometry.js` — the spec does not currently separate the two).

**Cautions:** deliberately isolated from geometry/business logic by design — a future rendering engine swap should not need to touch `geometry.js` or `app.js`'s business logic, only this file's rendering functions.

## `index.html` (~80 lines) and `styles.css` (~220 lines)

**Primary responsibility:** the single-page shell (script/style loading, root DOM node) and all visual styling respectively. Neither contains business logic.

**Governance/spec that controls it:** `MASTER-SPEC.md` § "Branding", "Homepage", "Compliance language and product positioning".

**Cautions:** `index.html`'s `<script>` order (see top of this document) is load-bearing — changing it can silently break every global-function call in `app.js`.

## Other repository areas (not product runtime code)

- `tests/playwright/` — the real, committed automated test suite. See `TEST-MAP.md`.
- `tools/project-check-architect-mcp/` — an MCP tool integration, not part of the shipped product.
- `Project-Check-MVP-Master-Build/assets/`, `design-reference/` — static assets and design references, not code.
- `Project-Check-MVP-Master-Build/staticwebapp.config.json`, `AZURE-DEPLOYMENT.md` — deployment configuration/notes, not runtime logic.

## Repository layout note

The Git repository root (where `.git` lives, and where this file and the rest of the onboarding pack sit) contains a **nested** folder also named `Project-Check-MVP-Master-Build/` — that nested folder is where `app.js`, `evidence.js`, `geometry.js`, `drawing.js`, `index.html`, `styles.css`, and the authoritative specs actually live. All paths in this pack are given relative to the repository root, i.e. `Project-Check-MVP-Master-Build/app.js`.
