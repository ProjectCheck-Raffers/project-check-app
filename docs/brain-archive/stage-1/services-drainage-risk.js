// Project Check Brain — Stage 1 — services/drainage risk rule
// MIGRATION SLICE 4 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
// Any change to this rule belongs here, in Project-Check-Brain, followed by
// a fresh vendor + version bump into the application repository.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see services-drainage-risk.provenance.json
// and BRAIN-MIGRATION-REGISTER.md row BRAIN-0004). This is an existing, live
// Project Check rule, carried forward exactly as it was — migration does NOT
// reopen, reinterpret, improve, broaden, narrow or reword it. Not relabelled
// CONFIRMED merely because this migration is authorised.
//
// SOURCE: Project-Check-MVP-Master-Build's app.js, runStage1Risks(). Traced
// via `git log -S` to application commit
// 5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029 ("Initial Project Check master
// build", 19 August 2026) — original app-native code, the same source
// baseline as Migration Slice 3's compressed-programme rule.
//
// PROVENANCE DISTINCTION (record accurately, per the Slice 4 authorisation):
// the Stage 1 'services' QUESTION WORDING was reworded on 27 August 2026
// (Stage 1 Map Control Layout + 17-Question Workflow task) from "Are known
// services or drains within the proposed footprint?" to "Do you know of any
// drains, pipes, cables or other services within the proposed building
// area?" — but the fact key ('services'), the three answer values
// ('Yes'/'No'/'Not sure'), THIS rule's trigger, its exact customer-facing
// text, its category ('cost') and its discipline ('civils') are all
// unchanged by that reword. This migration carries forward the rule
// unchanged; only the surrounding question a customer sees was reworded, on
// the App side, outside this rule's scope.
//
// Rule (exactly as the original — inequality, not an allowlist):
//   services !== 'No' -> one risk, exact text/category/discipline below.
//   services === 'No' (exact, case-sensitive) -> no risk.
// IMPORTANT: because this is an inequality against the single literal 'No',
// every other value — 'Yes', 'Not sure', an empty string, null, undefined,
// or any unrecognised/legacy value — triggers the risk. This is the
// original application's own behaviour (a customer who has not yet answered
// this question is treated as not-yet-confirmed-clear, the same conservative
// default as an explicit 'Yes'/'Not sure' answer) and must be preserved
// exactly, not reinterpreted as a bug or narrowed to an allowlist.

const PC_BRAIN_SERVICES_DRAINAGE_VERSION = '0.4.0';
const PC_BRAIN_SERVICES_DRAINAGE_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_SERVICES_DRAINAGE_RISK_TEXT = 'Services or drainage within the footprint may affect the building position, foundations or programme.';
const PC_BRAIN_SERVICES_DRAINAGE_RISK_CATEGORY = 'cost';
const PC_BRAIN_SERVICES_DRAINAGE_RISK_DISCIPLINE = 'civils';

function pcBrainServicesDrainageRisk(services) {
  if (services === 'No') return null;
  return {
    text: PC_BRAIN_SERVICES_DRAINAGE_RISK_TEXT,
    category: PC_BRAIN_SERVICES_DRAINAGE_RISK_CATEGORY,
    discipline: PC_BRAIN_SERVICES_DRAINAGE_RISK_DISCIPLINE
  };
}

const PC_BRAIN_SERVICES_DRAINAGE_RISK_PROVENANCE = {
  rule_id: 'stage1.services-drainage-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  source_baseline_commit: '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029',
  source_baseline_note: "Original app-native code — 'Initial Project Check master build' (19 August 2026). Trigger (services !== 'No'), exact text, category and discipline are all present in this commit exactly as migrated — same source baseline commit as Migration Slice 3's compressed-programme rule.",
  question_wording_provenance_note: "The Stage 1 'services' QUESTION WORDING was reworded 27 August 2026 (Stage 1 Map Control Layout + 17-Question Workflow task) — see that task's own CHANGELOG.md entry. This did NOT change: the fact key ('services'), the three answer values ('Yes'/'No'/'Not sure'), this rule's trigger, its exact customer-facing text, its category, or its discipline. Recorded here precisely so the wording change and this rule's unchanged behaviour are never conflated.",
  inequality_behaviour_note: "services !== 'No' is an inequality against a single literal, not an allowlist — 'Yes', 'Not sure', empty string, null, undefined and any unrecognised/legacy value all trigger the risk, exactly as the original application behaves. Deliberately preserved, not reinterpreted or narrowed.",
  live_migration_baseline_commit: '2bc3e23b4e88c3699767b65597725ec617c6654d',
  live_migration_baseline_note: "Application HEAD at the time of this migration (branch combined-rev2-canopy-drawing) — confirmed identical trigger/text/category/discipline to the 5a0e0d5 baseline by direct inspection.",
  brain_version: PC_BRAIN_SERVICES_DRAINAGE_VERSION,
  contract_version: PC_BRAIN_SERVICES_DRAINAGE_CONTRACT_VERSION
};

// Node (Brain repo tests) get a proper module export; a plain <script> load
// in the browser (vendored copy) simply leaves the const/function
// declarations above as ordinary globals — this file is used unmodified in
// both places, per "mechanically identical, never independently edited".
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainServicesDrainageRisk,
    PC_BRAIN_SERVICES_DRAINAGE_RISK_TEXT,
    PC_BRAIN_SERVICES_DRAINAGE_RISK_CATEGORY,
    PC_BRAIN_SERVICES_DRAINAGE_RISK_DISCIPLINE,
    PC_BRAIN_SERVICES_DRAINAGE_RISK_PROVENANCE,
    PC_BRAIN_SERVICES_DRAINAGE_VERSION,
    PC_BRAIN_SERVICES_DRAINAGE_CONTRACT_VERSION
  };
}
