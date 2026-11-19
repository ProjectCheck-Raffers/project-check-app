// Project Check Brain — Stage 1 — building-position status risk rule
// MIGRATION SLICE 5 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
// Any change to this rule belongs here, in Project-Check-Brain, followed by
// a fresh vendor + version bump into the application repository.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see
// building-position-status-risk.provenance.json and
// BRAIN-MIGRATION-REGISTER.md row BRAIN-0005). This is an existing, live
// Project Check rule, carried forward exactly as it was — migration does NOT
// reopen, reinterpret, improve, broaden, narrow or reword it. Not relabelled
// CONFIRMED merely because this migration is authorised.
//
// SOURCE: Project-Check-MVP-Master-Build's app.js, runStage1Risks(). Traced
// via `git log -S` to application commit
// c73512acbbaf9c4c7fb803407b04ec54dc4bcd10 ("Sprint 1 and Sprint 2 working
// build") — the exact matched literal ('skipped') has not changed since.
//
// PROVENANCE DISTINCTION (record accurately, per the Slice 5 authorisation):
// the two upstream producer functions that SET p.facts.buildingPositionStatus
// — saveBuildingPosition() and skipBuildingPosition() — were subsequently
// rewritten during the authorised Stage 1 Map Architecture (Leaflet ->
// MapLibre) and Map Control Layout + 17-Question Workflow tasks (both
// 2026-08-27). Those producer rewrites are already committed, tested and
// normalised in the application repository, and are entirely OUTSIDE the
// scope of this migration — this migration only reads the resulting status
// string, which has always been exactly 'confirmed' or 'skipped'. The
// producer code that sets that string is not part of this rule and is not
// touched by this migration.
//
// Rule (exact equality — NOT a broadened/negated check):
//   buildingPositionStatus === 'skipped' -> one risk, exact text/category/
//   discipline below.
//   anything else ('confirmed', empty string, null, undefined, or any
//   unrecognised/legacy value) -> no risk.
// IMPORTANT: this is an EXACT-EQUALITY rule, unlike Slice 4's inequality
// rule. Missing/unset/unrecognised values must NOT be treated as 'skipped'
// — they must produce null, exactly as the original application behaves.
// Do not broaden this to an inequality against 'confirmed'.

const PC_BRAIN_BUILDING_POSITION_STATUS_VERSION = '0.5.0';
const PC_BRAIN_BUILDING_POSITION_STATUS_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_BUILDING_POSITION_STATUS_RISK_TEXT = 'The proposed building position has not yet been pinpointed on a site map, so orientation and clearances are not yet confirmed.';
const PC_BRAIN_BUILDING_POSITION_STATUS_RISK_CATEGORY = 'issue';
const PC_BRAIN_BUILDING_POSITION_STATUS_RISK_DISCIPLINE = 'site';

function pcBrainBuildingPositionStatusRisk(buildingPositionStatus) {
  if (buildingPositionStatus !== 'skipped') return null;
  return {
    text: PC_BRAIN_BUILDING_POSITION_STATUS_RISK_TEXT,
    category: PC_BRAIN_BUILDING_POSITION_STATUS_RISK_CATEGORY,
    discipline: PC_BRAIN_BUILDING_POSITION_STATUS_RISK_DISCIPLINE
  };
}

const PC_BRAIN_BUILDING_POSITION_STATUS_RISK_PROVENANCE = {
  rule_id: 'stage1.building-position-status-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  source_baseline_commit: 'c73512acbbaf9c4c7fb803407b04ec54dc4bcd10',
  source_baseline_note: "'Sprint 1 and Sprint 2 working build'. Trigger (buildingPositionStatus === 'skipped', exact equality), exact text, category and discipline are all present in this commit exactly as migrated. Not the same source baseline as Slices 3/4 (5a0e0d5) — this rule and its facts entered the application slightly later.",
  producer_rewrite_provenance_note: "p.facts.buildingPositionStatus is SET by saveBuildingPosition()/skipBuildingPosition() in app.js. Those two producer functions were subsequently rewritten during the authorised Stage 1 Map Architecture (Leaflet -> MapLibre, 2026-08-27) and Map Control Layout + 17-Question Workflow (2026-08-27) tasks. Those rewrites are already committed, tested and normalised in the application repository and are entirely OUTSIDE the scope of this migration — only the resulting status string ('confirmed'/'skipped', unchanged since c73512a) is read by this rule.",
  live_migration_baseline_commit: 'c782b366ee18a53fc2ab94fb7c8a0803b73091f8',
  live_migration_baseline_note: "Application HEAD at the time of this migration (branch combined-rev2-canopy-drawing) — confirmed identical trigger/text/category/discipline to the c73512a baseline by direct inspection.",
  exact_equality_behaviour_note: "buildingPositionStatus === 'skipped' is an EXACT-EQUALITY rule, not a negation/inequality (unlike Migration Slice 4's services rule). 'confirmed', an empty string, null, undefined, and any unrecognised/legacy value all produce no risk (null) — deliberately preserved exactly, not broadened to treat missing/unrecognised values as 'skipped'.",
  brain_version: PC_BRAIN_BUILDING_POSITION_STATUS_VERSION,
  contract_version: PC_BRAIN_BUILDING_POSITION_STATUS_CONTRACT_VERSION
};

// Node (Brain repo tests) get a proper module export; a plain <script> load
// in the browser (vendored copy) simply leaves the const/function
// declarations above as ordinary globals — this file is used unmodified in
// both places, per "mechanically identical, never independently edited".
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainBuildingPositionStatusRisk,
    PC_BRAIN_BUILDING_POSITION_STATUS_RISK_TEXT,
    PC_BRAIN_BUILDING_POSITION_STATUS_RISK_CATEGORY,
    PC_BRAIN_BUILDING_POSITION_STATUS_RISK_DISCIPLINE,
    PC_BRAIN_BUILDING_POSITION_STATUS_RISK_PROVENANCE,
    PC_BRAIN_BUILDING_POSITION_STATUS_VERSION,
    PC_BRAIN_BUILDING_POSITION_STATUS_CONTRACT_VERSION
  };
}
