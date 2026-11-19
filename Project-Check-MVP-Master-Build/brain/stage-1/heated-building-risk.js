// Project Check Brain — Stage 1 — heated-building risk rule
// MIGRATION SLICE 2 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
// Any change to this rule belongs here, in Project-Check-Brain, followed by
// a fresh vendor + version bump into the application repository.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see heated-building-risk.provenance.json
// and BRAIN-MIGRATION-REGISTER.md row BRAIN-0002). This is an existing, live
// Project Check rule, carried forward exactly as it was — migration does NOT
// reopen, reinterpret, improve, broaden, narrow or reword it. No individual
// historical governance record for this specific rule's trigger, text,
// category or discipline mapping was found in MASTER-SPEC.md or
// EVIDENCE-INTELLIGENCE-SPEC.md prior to this migration; that absence is
// recorded as a PROVENANCE GAP by this migration, not resolved or silently
// filled in.
//
// SOURCE — TWO DISTINCT PROVENANCE POINTS, both from
// Project-Check-MVP-Master-Build's app.js runStage1Risks(). Recorded
// separately per SPA correction (do not conflate them):
//   COMMITTED SOURCE BASELINE: application commit
//   90c1c94ba63cf18f9d21bbe7ee1a18094cb90432 — contains the trigger
//   (heated === 'Yes'), the exact customer-facing text, and the category
//   ('cost') exactly as migrated below. Does NOT contain the 'engineering'
//   discipline argument — that commit's call site passes only 2 arguments
//   (text, category), so discipline there defaults to 'general'.
//   LIVE MIGRATION SOURCE STATE: commit 90c1c94 PLUS the authorised,
//   pre-existing application working-tree baseline at migration start (the
//   27 August Stage 1 discipline/report-restructuring work, uncommitted at
//   the time of this migration) — this is where the 'engineering' discipline
//   value actually existed and is what was actually running. See
//   heated-building-risk.provenance.json for the full field-level record.
//
// Rule (case-sensitive exact string match, exactly as the original):
//   heated === 'Yes' -> one risk, exact text/category/discipline below.
//   anything else (No / Not sure / empty / unrecognised) -> no risk.
//
// NAMING NOTE (found and corrected during this slice's own integration
// verification, before commit/push): every vendored Brain module is loaded
// as a plain, non-module <script> tag in the application, so top-level
// const/function declarations across ALL vendored files share one global
// script scope — a generic name (e.g. PC_BRAIN_VERSION) reused verbatim in
// a second file collides with the first file's binding and throws a
// SyntaxError that silently breaks that second script's own functions.
// This module's version constants are therefore named uniquely
// (PC_BRAIN_HEATED_RISK_VERSION / _CONTRACT_VERSION), not the generic
// PC_BRAIN_VERSION / PC_BRAIN_CONTRACT_VERSION names Slice 1's
// door-size-defaults.js already uses — door-size-defaults.js itself is
// unaltered by this note; this is a naming convention for future Brain
// modules, not a change to already-migrated content.

const PC_BRAIN_HEATED_RISK_VERSION = '0.2.0';
const PC_BRAIN_HEATED_RISK_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_HEATED_BUILDING_RISK_TEXT = 'A heated building introduces thermal-performance and energy-compliance requirements that need to be coordinated with the building specification.';
const PC_BRAIN_HEATED_BUILDING_RISK_CATEGORY = 'cost';
const PC_BRAIN_HEATED_BUILDING_RISK_DISCIPLINE = 'engineering';

function pcBrainHeatedBuildingRisk(heated) {
  if (heated !== 'Yes') return null;
  return {
    text: PC_BRAIN_HEATED_BUILDING_RISK_TEXT,
    category: PC_BRAIN_HEATED_BUILDING_RISK_CATEGORY,
    discipline: PC_BRAIN_HEATED_BUILDING_RISK_DISCIPLINE
  };
}

const PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE = {
  rule_id: 'stage1.heated-building-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  // Two distinct provenance points — see the SPA correction recorded in
  // heated-building-risk.provenance.json and BRAIN-MIGRATION-REGISTER.md
  // row BRAIN-0002. Never conflate these two fields.
  committed_source_baseline_commit: '90c1c94ba63cf18f9d21bbe7ee1a18094cb90432',
  committed_source_baseline_note: "Contains the trigger (heated === 'Yes'), the exact customer-facing text, and the category ('cost') exactly as migrated. Does NOT contain the 'engineering' discipline argument.",
  live_migration_source_state: "90c1c94ba63cf18f9d21bbe7ee1a18094cb90432 + authorised pre-existing application working-tree baseline at migration start (27 August Stage 1 discipline/report-restructuring work, uncommitted at time of migration)",
  discipline_provenance_status: 'pre-existing working-tree baseline at migration start; individual committed provenance not yet established',
  brain_version: PC_BRAIN_HEATED_RISK_VERSION,
  contract_version: PC_BRAIN_HEATED_RISK_CONTRACT_VERSION
};

// Node (Brain repo tests) get a proper module export; a plain <script> load
// in the browser (vendored copy) simply leaves the const/function
// declarations above as ordinary globals — this file is used unmodified in
// both places, per "mechanically identical, never independently edited".
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainHeatedBuildingRisk,
    PC_BRAIN_HEATED_BUILDING_RISK_TEXT,
    PC_BRAIN_HEATED_BUILDING_RISK_CATEGORY,
    PC_BRAIN_HEATED_BUILDING_RISK_DISCIPLINE,
    PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE,
    PC_BRAIN_HEATED_RISK_VERSION,
    PC_BRAIN_HEATED_RISK_CONTRACT_VERSION
  };
}
