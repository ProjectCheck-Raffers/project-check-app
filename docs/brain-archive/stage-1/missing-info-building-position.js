// Project Check Brain — Stage 1 — missing-information flag: building
// position not confirmed on a map
// STAGE 1 BRAIN COMPLETION BATCH, PHASE 2 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see
// missing-info-building-position.provenance.json and
// BRAIN-MIGRATION-REGISTER.md row BRAIN-0012). Existing, live Project Check
// rule, carried forward exactly as it was.
//
// SOURCE: app.js, stage1MissingInfo() (the SEPARATE missing-information
// function from runStage1Risks()). Traced via `git log -S` to application
// commit c73512acbbaf9c4c7fb803407b04ec54dc4bcd10 ("Sprint 1 and Sprint 2
// working build") — the same commit as Migration Slice 5's
// buildingPositionStatus RISK rule.
//
// NOT A DUPLICATE OF BRAIN-0005 (Migration Slice 5): that rule reads the
// SAME underlying fact (p.facts.buildingPositionStatus) but produces a
// DIFFERENT output for a DIFFERENT consumer — Slice 5's rule contributes a
// risk object to p.risks1 (rendered as a Stage 1 report "preliminary
// flag"); this rule contributes a plain missing-information string to
// stage1MissingInfo()'s own `missing` array (rendered as "Assumptions /
// information not yet established"). Two distinct, independently governed
// consumers of one fact — the same pattern already established for
// `services` (read by three separate places since Migration Slice 4) and
// `closeBoundary`/`level` in this same completion batch.
//
// Rule (inequality against the single literal 'confirmed' — preserve
// exactly, do not narrow):
//   buildingPositionStatus !== 'confirmed' -> the fixed missing-info text
//   below.
//   buildingPositionStatus === 'confirmed' (exact) -> no missing-info flag.

const PC_BRAIN_MISSING_INFO_BUILDING_POSITION_VERSION = '0.6.0';
const PC_BRAIN_MISSING_INFO_BUILDING_POSITION_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_MISSING_INFO_BUILDING_POSITION_TEXT = 'Building position not yet confirmed on a site map.';

function pcBrainMissingInfoBuildingPosition(buildingPositionStatus) {
  if (buildingPositionStatus === 'confirmed') return null;
  return PC_BRAIN_MISSING_INFO_BUILDING_POSITION_TEXT;
}

const PC_BRAIN_MISSING_INFO_BUILDING_POSITION_PROVENANCE = {
  rule_id: 'stage1.missing-info.building-position',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'stage1MissingInfo()',
  source_baseline_commit: 'c73512acbbaf9c4c7fb803407b04ec54dc4bcd10',
  source_baseline_note: "'Sprint 1 and Sprint 2 working build'. Same source baseline commit as Migration Slice 5's buildingPositionStatus risk rule (BRAIN-0005) — a distinct, independently-governed consumer of the same underlying fact, not a duplicate.",
  distinct_from_note: 'Not a duplicate of BRAIN-0005 (Migration Slice 5) — see this file\'s own header comment for the full distinction.',
  inequality_behaviour_note: "Inequality against the single literal 'confirmed', not narrowed to a 'skipped'-only check — 'skipped', empty string, null, undefined and any unrecognised value all produce the missing-info flag, deliberately preserved.",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  brain_version: PC_BRAIN_MISSING_INFO_BUILDING_POSITION_VERSION,
  contract_version: PC_BRAIN_MISSING_INFO_BUILDING_POSITION_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainMissingInfoBuildingPosition,
    PC_BRAIN_MISSING_INFO_BUILDING_POSITION_TEXT,
    PC_BRAIN_MISSING_INFO_BUILDING_POSITION_PROVENANCE,
    PC_BRAIN_MISSING_INFO_BUILDING_POSITION_VERSION,
    PC_BRAIN_MISSING_INFO_BUILDING_POSITION_CONTRACT_VERSION
  };
}
