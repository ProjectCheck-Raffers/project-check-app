// Project Check Brain — Stage 1 — base/substrate uncertain risk rule
// STAGE 1 BRAIN COMPLETION BATCH (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see base-uncertain-risk.provenance.json
// and BRAIN-MIGRATION-REGISTER.md row BRAIN-0009). Existing, live Project
// Check rule, carried forward exactly as it currently behaves.
//
// SOURCE, TWO DISTINCT PROVENANCE POINTS (do not conflate):
//   ORIGINAL BASELINE: application commit
//   5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029 ("Initial Project Check master
//   build") — risk text and rule intent originate here, matching the
//   question's original option 'Unknown'.
//   VALUE-RENAME COMMIT: application commit
//   998ef610b3bbc91071cbeac2651c919520a08119 (Stage 1 Map Control Layout +
//   17-Question Workflow, 2026-08-27) — the 'base' question's option was
//   reworded 'Unknown' -> 'Not sure'; this rule's trigger literal was
//   updated to match. This is the commit producing the CURRENT exact
//   trigger line.
//
// This is the sibling rule to stage-1/base-surface-risk.js (the other 'base'
// risk, a 5-way OR over the non-concrete surface options) — kept as two
// separate Brain rules, matching the two separate `if` conditions and two
// separate customer-facing texts in the original application source.
//
// Rule (exact match, case-sensitive):
//   base === 'Not sure' -> one risk, exact text/category/discipline below.
//   anything else -> no risk.

const PC_BRAIN_BASE_UNCERTAIN_VERSION = '0.6.0';
const PC_BRAIN_BASE_UNCERTAIN_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_BASE_UNCERTAIN_RISK_TEXT = 'Existing surface/base information is incomplete, so foundation and slab suitability cannot yet be relied upon.';
const PC_BRAIN_BASE_UNCERTAIN_RISK_CATEGORY = 'cost';
const PC_BRAIN_BASE_UNCERTAIN_RISK_DISCIPLINE = 'civils';

function pcBrainBaseUncertainRisk(base) {
  if (base !== 'Not sure') return null;
  return {
    text: PC_BRAIN_BASE_UNCERTAIN_RISK_TEXT,
    category: PC_BRAIN_BASE_UNCERTAIN_RISK_CATEGORY,
    discipline: PC_BRAIN_BASE_UNCERTAIN_RISK_DISCIPLINE
  };
}

const PC_BRAIN_BASE_UNCERTAIN_RISK_PROVENANCE = {
  rule_id: 'stage1.base-uncertain-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  original_baseline_commit: '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029',
  original_baseline_note: "'Initial Project Check master build' — risk text and rule intent originate here, matching the question's original option 'Unknown'.",
  value_rename_commit: '998ef610b3bbc91071cbeac2651c919520a08119',
  value_rename_note: "Stage 1 Map Control Layout + 17-Question Workflow (2026-08-27) — the 'base' question's option was reworded 'Unknown' -> 'Not sure'; this rule's trigger literal was updated to match. This is the commit producing the CURRENT exact trigger line — do not conflate with the original_baseline_commit above.",
  sibling_rule_note: "Companion rule stage-1/base-surface-risk.js (BRAIN-0010) covers the separate 5-way-OR non-concrete-surface risk — two distinct texts, two distinct Brain rules, matching the two distinct `if` conditions in the original source.",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  live_migration_baseline_note: "Application HEAD at the time of this migration — confirmed identical trigger/text/category/discipline by direct inspection.",
  brain_version: PC_BRAIN_BASE_UNCERTAIN_VERSION,
  contract_version: PC_BRAIN_BASE_UNCERTAIN_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainBaseUncertainRisk,
    PC_BRAIN_BASE_UNCERTAIN_RISK_TEXT,
    PC_BRAIN_BASE_UNCERTAIN_RISK_CATEGORY,
    PC_BRAIN_BASE_UNCERTAIN_RISK_DISCIPLINE,
    PC_BRAIN_BASE_UNCERTAIN_RISK_PROVENANCE,
    PC_BRAIN_BASE_UNCERTAIN_VERSION,
    PC_BRAIN_BASE_UNCERTAIN_CONTRACT_VERSION
  };
}
