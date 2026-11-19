// Project Check Brain — Stage 1 — level/gradient risk rule
// STAGE 1 BRAIN COMPLETION BATCH (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see level-risk.provenance.json and
// BRAIN-MIGRATION-REGISTER.md row BRAIN-0008). Existing, live Project Check
// rule, carried forward EXACTLY as it currently behaves — including a known,
// pre-existing behavioural nuance disclosed below, which this migration does
// NOT fix (that would be reinterpreting/broadening the rule, which this
// migration is not authorised to do).
//
// SOURCE, TWO DISTINCT PROVENANCE POINTS (do not conflate):
//   ORIGINAL BASELINE: application commit
//   5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029 ("Initial Project Check master
//   build") — the risk text and rule intent originate here, matching the
//   question's original option 'No / gradient present'.
//   VALUE-RENAME COMMIT: application commit
//   998ef610b3bbc91071cbeac2651c919520a08119 (Stage 1 Map Control Layout +
//   17-Question Workflow, 2026-08-27) — the 'level' question's option was
//   reworded from 'No / gradient present' to plain 'No', and this rule's
//   trigger literal was updated to match. This is the commit that produced
//   the CURRENT exact trigger line.
//
// KNOWN, PRE-EXISTING BEHAVIOURAL NUANCE (disclosed, not resolved by this
// migration): unlike stage1MissingInfo()'s own uncertain() helper (which
// explicitly still recognises the legacy value 'Unknown' for pre-27-Aug
// projects), this rule has NO equivalent back-compatibility matching for
// the old level option string 'No / gradient present'. A project whose
// p.facts.level was saved before 27 August 2026 as literally
// 'No / gradient present' will NOT trigger this risk today, even though it
// logically means the same thing as the current 'No' option. This is
// already-shipped, already-live application behaviour — this migration
// carries it forward exactly as-is, and does not add legacy-value matching,
// since doing so would change (broaden) the rule's current live behaviour.
//
// Rule (exact match against 'No' and 'Not sure' only — case-sensitive,
// and NOT matching the legacy 'No / gradient present' string):
//   level === 'No' || level === 'Not sure' -> one risk, exact text/
//   category/discipline below.
//   anything else ('Yes', 'No / gradient present', empty, null, undefined,
//   any other unrecognised value) -> no risk.

const PC_BRAIN_LEVEL_RISK_VERSION = '0.6.0';
const PC_BRAIN_LEVEL_RISK_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_LEVEL_RISK_TEXT = 'Levels may affect base design, drainage, thresholds and installation.';
const PC_BRAIN_LEVEL_RISK_CATEGORY = 'cost';
const PC_BRAIN_LEVEL_RISK_DISCIPLINE = 'civils';

function pcBrainLevelRisk(level) {
  if (level !== 'No' && level !== 'Not sure') return null;
  return {
    text: PC_BRAIN_LEVEL_RISK_TEXT,
    category: PC_BRAIN_LEVEL_RISK_CATEGORY,
    discipline: PC_BRAIN_LEVEL_RISK_DISCIPLINE
  };
}

const PC_BRAIN_LEVEL_RISK_PROVENANCE = {
  rule_id: 'stage1.level-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  original_baseline_commit: '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029',
  original_baseline_note: "'Initial Project Check master build' — risk text and rule intent originate here, matching the question's original option 'No / gradient present'.",
  value_rename_commit: '998ef610b3bbc91071cbeac2651c919520a08119',
  value_rename_note: "Stage 1 Map Control Layout + 17-Question Workflow (2026-08-27) — the 'level' question's option was reworded 'No / gradient present' -> 'No'; this rule's trigger literal was updated to match. This is the commit producing the CURRENT exact trigger line — do not conflate with the original_baseline_commit above.",
  known_behavioural_nuance: "No back-compatibility matching exists for the legacy value 'No / gradient present' (unlike stage1MissingInfo()'s uncertain() helper, which does retain legacy 'Unknown'). A pre-27-Aug project with level='No / gradient present' will not trigger this risk today. This is disclosed, pre-existing, already-live behaviour, deliberately NOT fixed/broadened by this migration.",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  live_migration_baseline_note: "Application HEAD at the time of this migration — confirmed identical trigger/text/category/discipline by direct inspection.",
  brain_version: PC_BRAIN_LEVEL_RISK_VERSION,
  contract_version: PC_BRAIN_LEVEL_RISK_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainLevelRisk,
    PC_BRAIN_LEVEL_RISK_TEXT,
    PC_BRAIN_LEVEL_RISK_CATEGORY,
    PC_BRAIN_LEVEL_RISK_DISCIPLINE,
    PC_BRAIN_LEVEL_RISK_PROVENANCE,
    PC_BRAIN_LEVEL_RISK_VERSION,
    PC_BRAIN_LEVEL_RISK_CONTRACT_VERSION
  };
}
