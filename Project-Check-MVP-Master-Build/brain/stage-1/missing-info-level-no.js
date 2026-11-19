// Project Check Brain — Stage 1 — missing-information flag: level answered 'No'
// STAGE 1 BRAIN COMPLETION BATCH, PHASE 2 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see missing-info-level-no.provenance.json
// and BRAIN-MIGRATION-REGISTER.md row BRAIN-0011). Existing, live Project
// Check rule, carried forward exactly as it was.
//
// SOURCE: app.js, stage1MissingInfo() — the SEPARATE missing-information
// function (distinct from runStage1Risks(), which contributes to
// p.risks1/the report's "preliminary flags"; this contributes to
// p.actions1-adjacent `missing`, rendered as "Assumptions / information not
// yet established"). Traced via `git log -S` to application commit
// 998ef610b3bbc91071cbeac2651c919520a08119 (Stage 1 Map Control Layout +
// 17-Question Workflow, 2026-08-27) — this exact line is a clean, single-
// point ADDITION at that commit (no earlier baseline exists), added
// specifically because the 27-Aug level-option rename ('No / gradient
// present' -> 'No') meant a bare 'No' could no longer rely on the shared
// uncertain()/check() helper's ['Not sure','Unknown'] list (a bare 'No' is
// a CONFIDENT answer for other keys like services/closeBoundary, so it
// cannot be added to that shared list — see app.js's own comment at this
// line).
//
// SIBLING NOTE: this rule is a static-text, single-fact check that fits the
// established Brain rule contract cleanly. The FIVE shared check()/
// uncertain() missing-info lines (level/services/closeBoundary/base/
// clearSpan) are explicitly NOT migrated in this batch — their output text
// is dynamically interpolated per-fact (`${label}: recorded as "${f[key]}"...`),
// a materially different contract shape than the fixed text/category/
// discipline triples every Brain rule so far returns. Migrating them would
// require new Brain/App interface design, which this batch does not invent
// — see the Stage 1 Brain Completion Batch report, Phase 2 section.
//
// Rule (exact match, case-sensitive):
//   level === 'No' -> the fixed missing-info text below.
//   anything else -> no missing-info flag from this rule.

const PC_BRAIN_MISSING_INFO_LEVEL_NO_VERSION = '0.6.0';
const PC_BRAIN_MISSING_INFO_LEVEL_NO_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_MISSING_INFO_LEVEL_NO_TEXT = 'Site level/gradient: recorded as "No" (not level) — treat as unconfirmed.';

function pcBrainMissingInfoLevelNo(level) {
  if (level !== 'No') return null;
  return PC_BRAIN_MISSING_INFO_LEVEL_NO_TEXT;
}

const PC_BRAIN_MISSING_INFO_LEVEL_NO_PROVENANCE = {
  rule_id: 'stage1.missing-info.level-no',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'stage1MissingInfo()',
  source_baseline_commit: '998ef610b3bbc91071cbeac2651c919520a08119',
  source_baseline_note: "Stage 1 Map Control Layout + 17-Question Workflow (2026-08-27). Clean, single-point addition — no earlier baseline exists for this exact line. Added because the 27-Aug level-option rename meant a bare 'No' could no longer rely on the shared uncertain() list (a bare 'No' is a confident answer for other keys).",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  brain_version: PC_BRAIN_MISSING_INFO_LEVEL_NO_VERSION,
  contract_version: PC_BRAIN_MISSING_INFO_LEVEL_NO_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainMissingInfoLevelNo,
    PC_BRAIN_MISSING_INFO_LEVEL_NO_TEXT,
    PC_BRAIN_MISSING_INFO_LEVEL_NO_PROVENANCE,
    PC_BRAIN_MISSING_INFO_LEVEL_NO_VERSION,
    PC_BRAIN_MISSING_INFO_LEVEL_NO_CONTRACT_VERSION
  };
}
