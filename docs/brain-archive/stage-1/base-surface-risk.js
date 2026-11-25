// Project Check Brain — Stage 1 — base/substrate non-concrete surface risk rule
// STAGE 1 BRAIN COMPLETION BATCH (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see base-surface-risk.provenance.json
// and BRAIN-MIGRATION-REGISTER.md row BRAIN-0010). Existing, live Project
// Check rule, carried forward exactly as it currently behaves.
//
// SOURCE, TWO DISTINCT PROVENANCE POINTS (do not conflate):
//   ORIGINAL BASELINE: application commit
//   5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029 ("Initial Project Check master
//   build") — risk text and rule intent originate here, matching the
//   question's original 3-option OR: 'Tarmac / asphalt' / 'Stone / hardcore'
//   / 'Grass / soil'.
//   VALUE-EXTENSION COMMIT: application commit
//   998ef610b3bbc91071cbeac2651c919520a08119 (Stage 1 Map Control Layout +
//   17-Question Workflow, 2026-08-27) — TWO of the original three options
//   were renamed ('Stone / hardcore' -> 'Hardcore / stone', 'Grass / soil'
//   -> 'Soil / grass') and TWO genuinely NEW options were added
//   ('Existing building / structure', 'Mixed'), extending the OR to 5
//   branches. This is a real behavioural EXTENSION, not merely a wording
//   rename (unlike close-boundary-risk.js/services-drainage-risk.js) — the
//   two new option values did not exist, and could not trigger this risk,
//   before this commit. Recorded here explicitly, per the "do not silently
//   normalise wording/value asymmetries" instruction.
//
// This is the sibling rule to stage-1/base-uncertain-risk.js (the other
// 'base' risk, the single-value 'Not sure' condition) — kept as two
// separate Brain rules, matching the two separate `if` conditions and two
// separate customer-facing texts in the original application source.
//
// Rule (5-way OR, exact match, case-sensitive):
//   base === 'Tarmac / asphalt' || base === 'Hardcore / stone' ||
//   base === 'Soil / grass' || base === 'Existing building / structure' ||
//   base === 'Mixed' -> one risk, exact text/category/discipline below.
//   anything else (including 'Concrete slab', 'Not sure', empty, null,
//   undefined, or an unrecognised value) -> no risk.

const PC_BRAIN_BASE_SURFACE_VERSION = '0.6.0';
const PC_BRAIN_BASE_SURFACE_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_BASE_SURFACE_RISK_TEXT = 'The visible surface does not by itself confirm a suitable structural foundation or slab.';
const PC_BRAIN_BASE_SURFACE_RISK_CATEGORY = 'cost';
const PC_BRAIN_BASE_SURFACE_RISK_DISCIPLINE = 'civils';
const PC_BRAIN_BASE_SURFACE_TRIGGER_VALUES = ['Tarmac / asphalt', 'Hardcore / stone', 'Soil / grass', 'Existing building / structure', 'Mixed'];

function pcBrainBaseSurfaceRisk(base) {
  if (!PC_BRAIN_BASE_SURFACE_TRIGGER_VALUES.includes(base)) return null;
  return {
    text: PC_BRAIN_BASE_SURFACE_RISK_TEXT,
    category: PC_BRAIN_BASE_SURFACE_RISK_CATEGORY,
    discipline: PC_BRAIN_BASE_SURFACE_RISK_DISCIPLINE
  };
}

const PC_BRAIN_BASE_SURFACE_RISK_PROVENANCE = {
  rule_id: 'stage1.base-surface-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  original_baseline_commit: '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029',
  original_baseline_note: "'Initial Project Check master build' — risk text and rule intent originate here, matching the question's original 3-option OR ('Tarmac / asphalt'/'Stone / hardcore'/'Grass / soil').",
  value_extension_commit: '998ef610b3bbc91071cbeac2651c919520a08119',
  value_extension_note: "Stage 1 Map Control Layout + 17-Question Workflow (2026-08-27) — TWO options renamed ('Stone / hardcore'->'Hardcore / stone', 'Grass / soil'->'Soil / grass') and TWO genuinely NEW options added ('Existing building / structure', 'Mixed'), extending the OR from 3 to 5 branches. This is a real behavioural extension, not a cosmetic rename — the two new values could not trigger this risk before this commit. This is the commit producing the CURRENT exact 5-way trigger — do not conflate with the original_baseline_commit above.",
  sibling_rule_note: "Companion rule stage-1/base-uncertain-risk.js (BRAIN-0009) covers the separate single-value 'Not sure' risk — two distinct texts, two distinct Brain rules, matching the two distinct `if` conditions in the original source.",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  live_migration_baseline_note: "Application HEAD at the time of this migration — confirmed identical trigger/text/category/discipline by direct inspection.",
  brain_version: PC_BRAIN_BASE_SURFACE_VERSION,
  contract_version: PC_BRAIN_BASE_SURFACE_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainBaseSurfaceRisk,
    PC_BRAIN_BASE_SURFACE_RISK_TEXT,
    PC_BRAIN_BASE_SURFACE_RISK_CATEGORY,
    PC_BRAIN_BASE_SURFACE_RISK_DISCIPLINE,
    PC_BRAIN_BASE_SURFACE_TRIGGER_VALUES,
    PC_BRAIN_BASE_SURFACE_RISK_PROVENANCE,
    PC_BRAIN_BASE_SURFACE_VERSION,
    PC_BRAIN_BASE_SURFACE_CONTRACT_VERSION
  };
}
