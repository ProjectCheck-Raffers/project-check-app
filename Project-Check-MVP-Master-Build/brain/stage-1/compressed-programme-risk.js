// Project Check Brain — Stage 1 — compressed-programme risk rule
// MIGRATION SLICE 3 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
// Any change to this rule belongs here, in Project-Check-Brain, followed by
// a fresh vendor + version bump into the application repository.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see
// compressed-programme-risk.provenance.json and
// BRAIN-MIGRATION-REGISTER.md row BRAIN-0003). This is an existing, live
// Project Check rule, carried forward exactly as it was — migration does NOT
// reopen, reinterpret, improve, broaden, narrow or reword it. Not relabelled
// CONFIRMED merely because this migration is authorised.
//
// SOURCE: Project-Check-MVP-Master-Build's app.js, runStage1Risks(). Traced
// via `git log -S` to application commit
// 5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029 ("Initial Project Check master
// build", 19 August 2026) — original app-native code. The 'programme'
// question, its five fixed answer options, and this risk behaviour are
// unchanged from that commit through the current application baseline
// (combined-rev2-canopy-drawing, commit 6dbd6fdcdb86a389a0af0376a87f81b2dc02d607
// at the time of this migration) — confirmed by inspection, not merely
// asserted.
//
// Rule (case-sensitive exact string match, exactly as the original):
//   programme === '0–3 months' -> one risk, exact text/category/discipline below.
//   anything else ('3–6 months' / '6–12 months' / '12+ months' / 'Not decided' /
//   empty / null / undefined / an unrecognised legacy value) -> no risk.
//
// Note the en dash (–, U+2013) in '0–3 months' — matches the exact character
// used in the application's stage1Questions[] option list, not a hyphen.

const PC_BRAIN_COMPRESSED_PROGRAMME_VERSION = '0.3.0';
const PC_BRAIN_COMPRESSED_PROGRAMME_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_COMPRESSED_PROGRAMME_RISK_TEXT = 'The requested programme is compressed relative to the approvals, design, civils, manufacture and installation stages that may still be required.';
const PC_BRAIN_COMPRESSED_PROGRAMME_RISK_CATEGORY = 'programme';
const PC_BRAIN_COMPRESSED_PROGRAMME_RISK_DISCIPLINE = 'general';

function pcBrainCompressedProgrammeRisk(programme) {
  if (programme !== '0–3 months') return null;
  return {
    text: PC_BRAIN_COMPRESSED_PROGRAMME_RISK_TEXT,
    category: PC_BRAIN_COMPRESSED_PROGRAMME_RISK_CATEGORY,
    discipline: PC_BRAIN_COMPRESSED_PROGRAMME_RISK_DISCIPLINE
  };
}

const PC_BRAIN_COMPRESSED_PROGRAMME_RISK_PROVENANCE = {
  rule_id: 'stage1.compressed-programme-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  source_baseline_commit: '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029',
  source_baseline_note: "Original app-native code — 'Initial Project Check master build' (19 August 2026). Trigger, exact text, category and discipline argument are all present in this commit exactly as migrated; unlike Migration Slice 2, there is no committed-vs-live-working-tree provenance split to record here.",
  live_migration_baseline_commit: '6dbd6fdcdb86a389a0af0376a87f81b2dc02d607',
  live_migration_baseline_note: "Application HEAD at the time of this migration (branch combined-rev2-canopy-drawing) — confirmed identical trigger/text/category/discipline to the 5a0e0d5 baseline; the 'programme' question and its five answer options were explicitly confirmed unchanged through the 27 August Stage 1 question-reorder work (see that work's own CHANGELOG.md entry: 'Q17 (programme) genuinely unchanged, as instructed').",
  brain_version: PC_BRAIN_COMPRESSED_PROGRAMME_VERSION,
  contract_version: PC_BRAIN_COMPRESSED_PROGRAMME_CONTRACT_VERSION
};

// Node (Brain repo tests) get a proper module export; a plain <script> load
// in the browser (vendored copy) simply leaves the const/function
// declarations above as ordinary globals — this file is used unmodified in
// both places, per "mechanically identical, never independently edited".
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainCompressedProgrammeRisk,
    PC_BRAIN_COMPRESSED_PROGRAMME_RISK_TEXT,
    PC_BRAIN_COMPRESSED_PROGRAMME_RISK_CATEGORY,
    PC_BRAIN_COMPRESSED_PROGRAMME_RISK_DISCIPLINE,
    PC_BRAIN_COMPRESSED_PROGRAMME_RISK_PROVENANCE,
    PC_BRAIN_COMPRESSED_PROGRAMME_VERSION,
    PC_BRAIN_COMPRESSED_PROGRAMME_CONTRACT_VERSION
  };
}
