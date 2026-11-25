// Project Check Brain — Stage 1 — close-boundary risk rule
// STAGE 1 BRAIN COMPLETION BATCH (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see close-boundary-risk.provenance.json
// and BRAIN-MIGRATION-REGISTER.md row BRAIN-0007). Existing, live Project
// Check rule, carried forward exactly as it was. Not relabelled CONFIRMED
// merely because this migration is authorised.
//
// SOURCE: app.js, runStage1Risks(). Traced via `git log -S` to application
// commit 5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029 ("Initial Project Check
// master build") — the same primordial baseline as Slices 3/4. Answer
// values ('Yes'/'No'/'Not sure') have never changed; only the Stage 1
// question's WORDING and position were reworded 27 August 2026 (Stage 1
// Map Control Layout + 17-Question Workflow task) — see
// close-boundary-risk.provenance.json for the distinction.
//
// DISCIPLINE-LABEL NOTE (record accurately, do not misread as a
// dependency): discipline is 'planning', a PRESENTATION-ONLY grouping tag
// (see the governing comment atop runStage1Risks() in app.js: "'planning' =
// boundary/neighbour/approvals-adjacent"). This rule reads only
// p.facts.closeBoundary, a plain Stage 1 select-question answer. It has NO
// code-level or data-level connection to the separate, heavily-governed
// Planning Intelligence subsystem (evidence.js Planning Batches 1-5,
// LOCKED/PROTECTED). The shared word "planning" is a naming coincidence.
//
// Rule (exactly as the original — inequality, not an allowlist):
//   closeBoundary !== 'No' -> one risk, exact text/category/discipline below.
//   closeBoundary === 'No' (exact) -> no risk.
// 'Yes', 'Not sure', empty string, null, undefined, and any unrecognised
// value all trigger the risk — preserved exactly, not narrowed.

const PC_BRAIN_CLOSE_BOUNDARY_VERSION = '0.6.0';
const PC_BRAIN_CLOSE_BOUNDARY_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_CLOSE_BOUNDARY_RISK_TEXT = 'Nearby boundaries/buildings may affect design, fire strategy, access or approvals.';
const PC_BRAIN_CLOSE_BOUNDARY_RISK_CATEGORY = 'programme';
const PC_BRAIN_CLOSE_BOUNDARY_RISK_DISCIPLINE = 'planning';

function pcBrainCloseBoundaryRisk(closeBoundary) {
  if (closeBoundary === 'No') return null;
  return {
    text: PC_BRAIN_CLOSE_BOUNDARY_RISK_TEXT,
    category: PC_BRAIN_CLOSE_BOUNDARY_RISK_CATEGORY,
    discipline: PC_BRAIN_CLOSE_BOUNDARY_RISK_DISCIPLINE
  };
}

const PC_BRAIN_CLOSE_BOUNDARY_RISK_PROVENANCE = {
  rule_id: 'stage1.close-boundary-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  source_baseline_commit: '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029',
  source_baseline_note: "'Initial Project Check master build'. Same source baseline commit as Migration Slices 3/4. Trigger, text, category and discipline all present exactly as migrated.",
  question_wording_provenance_note: "The Stage 1 'closeBoundary' question wording and position were reworded 27 August 2026 (Stage 1 Map Control Layout + 17-Question Workflow task, application commit 998ef610b3bbc91071cbeac2651c919520a08119) — this did NOT change the fact key, the three answer values, this rule's trigger, its text, its category or its discipline.",
  discipline_label_note: "discipline='planning' is a presentation-only grouping tag, not a dependency on the separate Planning Intelligence subsystem (evidence.js Planning Batches 1-5). This rule reads only p.facts.closeBoundary.",
  inequality_behaviour_note: "closeBoundary !== 'No' is an inequality against a single literal, not an allowlist. 'Yes', 'Not sure', empty string, null, undefined and any unrecognised value all trigger the risk — deliberately preserved, not narrowed.",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  live_migration_baseline_note: "Application HEAD at the time of this migration — confirmed identical trigger/text/category/discipline to the 5a0e0d5 baseline by direct inspection.",
  brain_version: PC_BRAIN_CLOSE_BOUNDARY_VERSION,
  contract_version: PC_BRAIN_CLOSE_BOUNDARY_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainCloseBoundaryRisk,
    PC_BRAIN_CLOSE_BOUNDARY_RISK_TEXT,
    PC_BRAIN_CLOSE_BOUNDARY_RISK_CATEGORY,
    PC_BRAIN_CLOSE_BOUNDARY_RISK_DISCIPLINE,
    PC_BRAIN_CLOSE_BOUNDARY_RISK_PROVENANCE,
    PC_BRAIN_CLOSE_BOUNDARY_VERSION,
    PC_BRAIN_CLOSE_BOUNDARY_CONTRACT_VERSION
  };
}
