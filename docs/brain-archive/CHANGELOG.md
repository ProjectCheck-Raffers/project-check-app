> **ARCHIVED – reference only, not used by the app.** Copied 25 Nov 2026 from the private repo Project-Check-Brain (branch main). The app does not load, import or test anything in this folder. Do not wire it in. The live rules are Project-Check-MVP-Master-Build/regs-checker/.

# Project Check Brain — Changelog

Dated entries, most recent first. This is the Brain repository's own history — it does not replace or rewrite `Project-Check-MVP-Master-Build/CHANGELOG.md`, which remains the permanent historical record of everything that happened before this repository existed.

## 2026-08-28 — Stage 1 Brain Completion Batch: remaining runStage1Risks() rules + stage1MissingInfo() audit

**Status: LOCKED-EXISTING throughout. Migration type: BEHAVIOUR-PRESERVING.** Architect + SPA authorised consolidated migration completing Stage 1's Brain/App separation in one controlled batch, following the same COPY → VERIFY → TEST → INTEGRATE → VERIFY AGAIN method as Migration Slices 1-5.

**Phase 1 — remaining `runStage1Risks()` rules (5 rules, BRAIN-0006 to BRAIN-0010):**

- `stage-1/site-boundary-status-risk.js` (BRAIN-0006) — `siteBoundaryStatus !== 'confirmed'`. Source commit `c73512a`, same as BRAIN-0005's direct sibling.
- `stage-1/close-boundary-risk.js` (BRAIN-0007) — `closeBoundary !== 'No'`. Source commit `5a0e0d5`. Discipline `'planning'` explicitly documented as a presentation-only label with no Planning Intelligence dependency.
- `stage-1/level-risk.js` (BRAIN-0008) — `level === 'No' || level === 'Not sure'`. Two-point provenance (`5a0e0d5` original + `998ef61` value rename). Known, pre-existing, disclosed nuance: no back-compatibility matching for the legacy `'No / gradient present'` string — carried forward exactly, not fixed.
- `stage-1/base-uncertain-risk.js` (BRAIN-0009) — `base === 'Not sure'`. Two-point provenance (`5a0e0d5` + `998ef61` rename from `'Unknown'`).
- `stage-1/base-surface-risk.js` (BRAIN-0010) — 5-way OR over non-concrete surface options. Two-point provenance, **with a genuine value EXTENSION** at `998ef61` (2 options renamed, 2 genuinely new options added, 3→5 branches) — recorded accurately as an extension, not smoothed over as a cosmetic rename.

Each: new provenance JSON, JSON Schema (contract v1.0.0, no breaking change), table-driven regression tests (29 new tests total), a non-authoritative `*_LEGACY_PRE_BRAIN_MIGRATION()` App-side function with zero live callers.

**No rule required stopping as unresolved** — all five had traceable, if sometimes two-point, provenance and well-defined current behaviour.

**Phase 2 — `stage1MissingInfo()` audit (3 rules migrated, 2 areas deliberately deferred):**

Migrated (BRAIN-0011 to BRAIN-0013), each a single static-text line fitting the established fixed-output contract:
- `stage-1/missing-info-level-no.js` (BRAIN-0011) — `level === 'No'`. Source commit `998ef61`, a clean single-point addition.
- `stage-1/missing-info-building-position.js` (BRAIN-0012) — `buildingPositionStatus !== 'confirmed'`. NOT a duplicate of BRAIN-0005 — same fact, independently-governed different output/consumer (missing-info string vs risk object), matching the precedent already set by `services` (BRAIN-0004) having 3 independent consumers.
- `stage-1/missing-info-site-boundary.js` (BRAIN-0013) — `siteBoundaryStatus !== 'confirmed'`. NOT a duplicate of BRAIN-0006, same pattern.

**Output-shape note:** these three rules return a plain `string | null`, not the `{text,category,discipline}` object shape every `runStage1Risks()` rule returns — `stage1MissingInfo()`'s own output is an array of strings. Recorded explicitly as a genuinely different (not identical) contract, not assumed to match the risk-rule schemas.

**Deliberately deferred, App-side, not migrated in this batch:**
1. The shared `uncertain()`/`check()` helper (level/services/closeBoundary/base/clearSpan) — its output text is dynamically interpolated per-fact (`` `${label}: recorded as "${f[key]}"...` ``), a materially different contract shape than any fixed-text rule migrated so far. Migrating it would require new Brain/App interface design (a template contract, or a predicate-only contract with external formatting) — not invented in this batch, per its own explicit instruction not to invent architecture tonight.
2. `!p.evidence.length` — evidence-array presence logic, named explicitly in the batch's own authorisation as the deferral example; left App-side to avoid setting a precedent for Brain rules reading `p.evidence` ahead of any future, separately-authorised Evidence Intelligence migration.

`BRAIN-VERSION` bumped `0.5.0` → `0.6.0` (one version increment for the whole completion batch, covering all 8 new rules).

Source: `Project-Check-MVP-Master-Build`, `app.js`, application HEAD `0d511a3e1274c109d1d2e76831e53b3b0c93ac74` at the start of this batch (branch `combined-rev2-canopy-drawing`).

**No defects found during this batch's verification.** Full Brain regression suite: 79/79 passing (Slices 1-5: 35, this batch: 44 new). See `BRAIN-MIGRATION-REGISTER.md` rows `BRAIN-0006` through `BRAIN-0013`, and the Stage 1 Brain Completion Batch report (App-side commit) for the full Phase 3 Stage 1 contract inventory.

## 2026-08-28 — Migration Slice 5: Stage 1 building-position status risk rule

**Status: LOCKED-EXISTING. Provenance status: historical individual provenance not yet identified. Migration type: BEHAVIOUR-PRESERVING.**

Added:

- `stage-1/building-position-status-risk.js` — governed rule for the Stage 1 risk triggered when `p.facts.buildingPositionStatus` is exactly `'skipped'` (exact equality — unlike Migration Slice 4's inequality rule, `'confirmed'`, an empty string, `null`, `undefined`, or an unrecognised/legacy value all produce no risk, deliberately not broadened), migrated unchanged from the application repository's `app.js` → `runStage1Risks()`.
- `stage-1/building-position-status-risk.provenance.json` — full provenance record, including the specific note distinguishing the map-flow producer functions' later rewrites from this rule's own unchanged behaviour.
- `schemas/building-position-status-risk.schema.json` — the shared input/output contract (contract version unchanged at `1.0.0` — same JSON Schema convention as Slices 1-4, no breaking change).
- `tests/stage-1/building-position-status-risk.test.js` — 7 tests, including a direct comparison against the original implementation captured verbatim as an independent oracle, explicit coverage of the required `skipped`/`confirmed`/unset/unrecognised-value case set, and an explicit test that the exact-equality behaviour is preserved rather than broadened.
- `BRAIN-VERSION` bumped `0.4.0` → `0.5.0` (additive — a new rule, no change to the Slices 1-4 rules already released).

Source: `Project-Check-MVP-Master-Build`, `app.js`, traced via `git log -S` to application commit `c73512acbbaf9c4c7fb803407b04ec54dc4bcd10` ("Sprint 1 and Sprint 2 working build") — **not** the same source baseline commit as Migration Slices 3/4 (`5a0e0d5`); this rule and the `buildingPositionStatus` fact entered the application at a later commit. Confirmed unchanged through application HEAD `c782b366ee18a53fc2ab94fb7c8a0803b73091f8` (branch `combined-rev2-canopy-drawing`) at the time of this migration.

**Producer-rewrite provenance distinction (recorded per the Slice 5 authorisation's explicit instruction):** `p.facts.buildingPositionStatus` is SET by `saveBuildingPosition()`/`skipBuildingPosition()` in `app.js` — not by this rule. Those two producer functions were subsequently rewritten during the authorised Stage 1 Map Architecture (Leaflet → MapLibre GL JS) and Map Control Layout + 17-Question Workflow tasks (both 2026-08-27). Those rewrites are already committed, tested and normalised in the application repository and are entirely OUTSIDE the scope of this migration — only the resulting status string, unchanged since `c73512a`, is read by this rule.

**No defects found during this slice's verification.**

**Scope, exactly as authorised:** this migration covers ONLY the `runStage1Risks()` risk-rule copy. `siteBoundaryStatus` logic, the shared `actions.push(...)` condition involving `buildingPositionStatus`/`siteBoundaryStatus`, and the two upstream producer functions (`saveBuildingPosition()`/`skipBuildingPosition()`) were explicitly NOT migrated, NOT altered, and remain App-side, unchanged.

**Governance status explicitly recorded as LOCKED-EXISTING, not CONFIRMED and not PROPOSED** — an Architect + SPA authorised decision for this slice: this is existing, live Project Check behaviour whose current form is protected; migration does not reopen, reinterpret, improve, broaden, narrow or reword it; the absence of an individual historical provenance record for this specific rule (trigger/text/category/discipline) in `MASTER-SPEC.md`/`EVIDENCE-INTELLIGENCE-SPEC.md` is recorded as a provenance gap, not resolved by this migration.

No other Project Check knowledge, rule, question, or evidence logic was migrated as part of this entry. See `BRAIN-MIGRATION-REGISTER.md` row `BRAIN-0005`.

## 2026-08-28 — Migration Slice 4: Stage 1 services/drainage risk rule

**Status: LOCKED-EXISTING. Provenance status: historical individual provenance not yet identified. Migration type: BEHAVIOUR-PRESERVING.**

Added:

- `stage-1/services-drainage-risk.js` — governed rule for the Stage 1 risk triggered when the customer's `services` answer is anything other than exactly `'No'` (an inequality against a single literal, not an allowlist — `'Yes'`, `'Not sure'`, an empty string, `null`, `undefined`, or an unrecognised/legacy value all trigger the risk, deliberately preserved from the original application behaviour), migrated unchanged from the application repository's `app.js` → `runStage1Risks()`.
- `stage-1/services-drainage-risk.provenance.json` — full provenance record, including the specific note distinguishing this rule's unchanged behaviour from the 27 August question-wording reword.
- `schemas/services-drainage-risk.schema.json` — the shared input/output contract (contract version unchanged at `1.0.0` — same JSON Schema convention as Slices 1-3, no breaking change).
- `tests/stage-1/services-drainage-risk.test.js` — 9 tests, including a direct comparison against the original implementation captured verbatim as an independent oracle, explicit coverage of the required `Yes`/`No`/`Not sure`/unset case set, and an explicit test that the inequality behaviour (unset/undefined triggers the risk) is preserved rather than reinterpreted.
- `BRAIN-VERSION` bumped `0.3.0` → `0.4.0` (additive — a new rule, no change to the Slices 1-3 rules already released).

Source: `Project-Check-MVP-Master-Build`, `app.js`, traced via `git log -S` to application commit `5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029` ("Initial Project Check master build", 19 August 2026) — the same source baseline commit as Migration Slice 3's compressed-programme rule. Confirmed unchanged through application HEAD `2bc3e23b4e88c3699767b65597725ec617c6654d` (branch `combined-rev2-canopy-drawing`) at the time of this migration.

**Question-wording provenance distinction (recorded per the Slice 4 authorisation's explicit instruction):** the Stage 1 `services` question's wording was reworded 27 August 2026 (Stage 1 Map Control Layout + 17-Question Workflow task) from "Are known services or drains within the proposed footprint?" to "Do you know of any drains, pipes, cables or other services within the proposed building area?" — this changed only the question text a customer reads. It did **not** change the fact key (`services`), the three answer values (`'Yes'`/`'No'`/`'Not sure'`), this rule's trigger, its exact customer-facing text, its category (`'cost'`), or its discipline (`'civils'`). Recorded distinctly so the wording change and this rule's unchanged behaviour are never conflated — no committed-vs-live-working-tree provenance split was needed, unlike Migration Slice 2.

**No defects found during this slice's verification.**

**Scope, exactly as authorised:** this migration covers ONLY the `runStage1Risks()` risk-rule copy. `stage1MissingInfo()`'s independent `services` uncertain-value check and the `actions` array builder's independent `services` read were explicitly NOT migrated, NOT altered, and remain App-side, unchanged — both are separate, non-interacting reads of the same underlying fact.

**Governance status explicitly recorded as LOCKED-EXISTING, not CONFIRMED and not PROPOSED** — an Architect + SPA authorised decision for this slice: this is existing, live Project Check behaviour whose current form is protected; migration does not reopen, reinterpret, improve, broaden, narrow or reword it; the absence of an individual historical provenance record for this specific rule (trigger/text/category/discipline) in `MASTER-SPEC.md`/`EVIDENCE-INTELLIGENCE-SPEC.md` is recorded as a provenance gap, not resolved by this migration.

No other Project Check knowledge, rule, question, or evidence logic was migrated as part of this entry. See `BRAIN-MIGRATION-REGISTER.md` row `BRAIN-0004`.

## 2026-08-28 — Migration Slice 3: Stage 1 compressed-programme risk rule

**Status: LOCKED-EXISTING. Provenance status: historical individual provenance not yet identified. Migration type: BEHAVIOUR-PRESERVING.**

Added:

- `stage-1/compressed-programme-risk.js` — governed rule for the Stage 1 risk triggered when the customer's `programme` answer is exactly `'0–3 months'` (en dash, U+2013), migrated unchanged from the application repository's `app.js` → `runStage1Risks()`.
- `stage-1/compressed-programme-risk.provenance.json` — full provenance record.
- `schemas/compressed-programme-risk.schema.json` — the shared input/output contract (contract version unchanged at `1.0.0` — same JSON Schema convention as Slices 1-2, no breaking change).
- `tests/stage-1/compressed-programme-risk.test.js` — exhaustive regression tests (all five fixed `programme` options, unset/undefined, empty string, hyphen/case/whitespace variants that must NOT match the en dash, and an unrecognised legacy value), including a direct comparison against the original implementation captured verbatim as an independent oracle.
- `BRAIN-VERSION` bumped `0.2.0` → `0.3.0` (additive — a new rule, no change to the Slice 1/2 rules already released; `stage-1/door-size-defaults.js` and `stage-1/heated-building-risk.js` are untouched and still correctly record their own release versions).

Source: `Project-Check-MVP-Master-Build`, `app.js`, traced via `git log -S` to application commit `5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029` ("Initial Project Check master build", 19 August 2026), confirmed unchanged through application HEAD `6dbd6fdcdb86a389a0af0376a87f81b2dc02d607` (branch `combined-rev2-canopy-drawing`) at the time of this migration. Unlike Migration Slice 2, this rule's trigger, exact text, category and discipline are all present in the same single source-baseline commit — no committed-vs-live-working-tree provenance split was needed.

**No defects found during this slice's verification** — the naming convention already established by Slice 2 (unique version constants: `PC_BRAIN_COMPRESSED_PROGRAMME_VERSION`/`_CONTRACT_VERSION`, not the generic `PC_BRAIN_VERSION`/`PC_BRAIN_CONTRACT_VERSION` names) was applied from the start, so the Slice 2 naming-collision defect could not recur.

**Governance status explicitly recorded as LOCKED-EXISTING, not CONFIRMED and not PROPOSED** — an Architect + SPA authorised decision for this slice: this is existing, live Project Check behaviour whose current form is protected; migration does not reopen, reinterpret, improve, broaden, narrow or reword it; the absence of an individual historical provenance record for this specific rule (trigger/text/category/discipline) in `MASTER-SPEC.md`/`EVIDENCE-INTELLIGENCE-SPEC.md` is recorded as a provenance gap, not resolved by this migration.

No other Project Check knowledge, rule, question, or evidence logic was migrated as part of this entry. See `BRAIN-MIGRATION-REGISTER.md` row `BRAIN-0003`.

## 2026-08-28 — Provenance correction to Migration Slice 2 (BRAIN-0002)

**Corrective commit — does not rewrite or amend the original Slice 2 commit (`d8dd7a2`).** SPA review found that this repository's original Slice 2 provenance records (code comments in `stage-1/heated-building-risk.js` and `stage-1/heated-building-risk.provenance.json`) implied the migrated rule's `'engineering'` discipline value existed in application commit `90c1c94ba63cf18f9d21bbe7ee1a18094cb90432`. It does not: that commit's call site passes only `(text, category)` — 2 arguments — so discipline there defaults to `'general'`, not `'engineering'`.

Corrected to record two distinct provenance points, never conflated:
- **Committed source baseline** — commit `90c1c94ba63cf18f9d21bbe7ee1a18094cb90432`: contains the trigger (`heated === 'Yes'`), the exact customer-facing text, and the category (`'cost'`) exactly as migrated. Does **not** contain the `'engineering'` discipline argument.
- **Live migration source state** — commit `90c1c94` **plus** the authorised, pre-existing application working-tree baseline at migration start (the 27 August Stage 1 discipline/report-restructuring work, uncommitted at the time of migration) — this is where `'engineering'` actually existed and is what was actually running and actually migrated.

The rule itself (`pcBrainHeatedBuildingRisk()`), its trigger, text, category and discipline output are **completely unchanged** by this correction — only the provenance *record* of where the discipline value came from was inaccurate and is now fixed. `discipline_provenance_status` is recorded as *"pre-existing working-tree baseline at migration start; individual committed provenance not yet established"* — **not** relabelled CONFIRMED.

Files changed: `stage-1/heated-building-risk.js`, `stage-1/heated-building-risk.provenance.json`, `tests/stage-1/heated-building-risk.test.js` (one new test asserting the two provenance points stay distinct). `BRAIN-VERSION` and `schemas/CONTRACT-VERSION` are unchanged — this is a provenance/documentation correction, not a rule or contract change. Regression suite reconfirmed 6/6 passing (was 5/5; +1 new provenance test).

## 2026-08-28 — Migration Slice 2: Stage 1 heated-building risk rule

**Status: LOCKED-EXISTING. Provenance status: historical individual provenance not yet identified. Migration type: BEHAVIOUR-PRESERVING.**

Added:

- `stage-1/heated-building-risk.js` — governed rule for the Stage 1 risk triggered when the customer's `heated` answer is exactly `'Yes'`, migrated unchanged from the application repository's `app.js` → `runStage1Risks()`.
- `stage-1/heated-building-risk.provenance.json` — full provenance record, including the recorded provenance gap.
- `schemas/heated-building-risk.schema.json` — the shared input/output contract (contract version unchanged at `1.0.0` — same JSON Schema convention as Slice 1's schema, no breaking change).
- `tests/stage-1/heated-building-risk.test.js` — exhaustive regression tests, including a direct comparison against the original implementation captured verbatim as an independent oracle.
- `BRAIN-VERSION` bumped `0.1.0` → `0.2.0` (additive — a new rule, no change to the Slice 1 rule already released at `0.1.0`; `stage-1/door-size-defaults.js` is untouched and still correctly records `brain_version: '0.1.0'`, the version it was actually released as part of).

Source: `Project-Check-MVP-Master-Build`, `app.js`, at application commit `90c1c94ba63cf18f9d21bbe7ee1a18094cb90432`, branch `combined-rev2-canopy-drawing`.

**Defect found and corrected during this slice's own integration verification, before any commit/push:** the module's version constants were initially named `PC_BRAIN_VERSION`/`PC_BRAIN_CONTRACT_VERSION` — the exact same top-level identifiers Slice 1's `stage-1/door-size-defaults.js` already declares. Since every vendored Brain module loads as a plain, non-module `<script>` tag in the application (all sharing one global script scope), this caused a `SyntaxError: Identifier 'PC_BRAIN_VERSION' has already been declared` when both files were loaded together, which broke the entire Stage 1 → report transition for every customer (confirmed via a direct browser console capture, and via `journey.spec.js` failing at the same point). Corrected by renaming this module's constants to `PC_BRAIN_HEATED_RISK_VERSION`/`PC_BRAIN_HEATED_RISK_CONTRACT_VERSION` — unique to this module — before anything was committed or pushed. `stage-1/door-size-defaults.js` was not altered. This is a naming-collision fix in this new module only, not a change to the migrated rule's trigger, text, category or discipline, and not a reopening of its LOCKED-EXISTING status. Recorded here in full rather than silently corrected, per this migration's own transparency requirement.

**Governance status explicitly recorded as LOCKED-EXISTING, not CONFIRMED and not PROPOSED** — an SPA governance decision for this slice: this is existing, live Project Check behaviour whose current form is protected; migration does not reopen, reinterpret, improve, broaden, narrow or reword it; the absence of an individual historical provenance record for this specific rule (trigger/text/category/discipline) in `MASTER-SPEC.md`/`EVIDENCE-INTELLIGENCE-SPEC.md` is recorded as a provenance gap, not resolved by this migration.

No other Project Check knowledge, rule, question, or evidence logic was migrated as part of this entry. See `BRAIN-MIGRATION-REGISTER.md` row `BRAIN-0002`.

## 2026-08-28 — Migration Slice 1: door size defaults by access type

**Status: CONFIRMED. Migration type: BEHAVIOUR-PRESERVING.**

The first content migrated into this repository. Added:

- `stage-1/door-size-defaults.js` — governed rule for the Stage 1 roller-door "suggested preliminary default" size by access type (HGV / Van / Forklift / Other), migrated unchanged from the application repository's `app.js` → `doorRuleFor()`.
- `stage-1/door-size-defaults.provenance.json` — full provenance record.
- `schemas/door-size-default.schema.json` (contract v1.0.0) — the shared input/output contract.
- `tests/stage-1/door-size-defaults.test.js` — exhaustive regression tests, including a direct comparison against the original implementation captured verbatim as an independent oracle.
- `BRAIN-VERSION` (`0.1.0`) and `schemas/CONTRACT-VERSION` (`1.0.0`) — first Brain and contract versions.

Source: `Project-Check-MVP-Master-Build`, `app.js`, at application commit `12a3dcd54f860e42814d482b4a825ab4a516878c`, branch `combined-rev2-canopy-drawing`.

These values were not previously recorded individually in `MASTER-SPEC.md` or `EVIDENCE-INTELLIGENCE-SPEC.md`. The Architect + SPA authorised migration instruction for this slice states they "are CONFIRMED Project Check governance and are not being reopened" — recorded here as that status's governing authority (see `GOVERNANCE.md` control 3).

No other Project Check knowledge, rule, question, or evidence logic was migrated as part of this entry. See `BRAIN-MIGRATION-REGISTER.md` row `BRAIN-0001`.
