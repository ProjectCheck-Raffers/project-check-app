// Project Check Brain — Stage 1 — missing-information flag: site boundary
// not confirmed on a map
// STAGE 1 BRAIN COMPLETION BATCH, PHASE 2 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see
// missing-info-site-boundary.provenance.json and
// BRAIN-MIGRATION-REGISTER.md row BRAIN-0013). Existing, live Project Check
// rule, carried forward exactly as it was.
//
// SOURCE: app.js, stage1MissingInfo(). Traced via `git log -S` to
// application commit c73512acbbaf9c4c7fb803407b04ec54dc4bcd10 ("Sprint 1
// and Sprint 2 working build") — the same commit as this batch's own
// site-boundary-status-risk.js (BRAIN-0006).
//
// NOT A DUPLICATE OF BRAIN-0006: that rule reads the SAME underlying fact
// (p.facts.siteBoundaryStatus) but produces a DIFFERENT output for a
// DIFFERENT consumer — BRAIN-0006 contributes a risk object to p.risks1
// (Stage 1 report "preliminary flag"); this rule contributes a plain
// missing-information string to stage1MissingInfo()'s own `missing` array
// ("Assumptions / information not yet established"). See
// missing-info-building-position.js's header comment for the same pattern
// applied to its sibling fact.
//
// Rule (inequality against the single literal 'confirmed' — preserve
// exactly, do not narrow):
//   siteBoundaryStatus !== 'confirmed' -> the fixed missing-info text below.
//   siteBoundaryStatus === 'confirmed' (exact) -> no missing-info flag.

const PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_VERSION = '0.6.0';
const PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_TEXT = 'Site boundary not yet confirmed on a site map.';

function pcBrainMissingInfoSiteBoundary(siteBoundaryStatus) {
  if (siteBoundaryStatus === 'confirmed') return null;
  return PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_TEXT;
}

const PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_PROVENANCE = {
  rule_id: 'stage1.missing-info.site-boundary',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'stage1MissingInfo()',
  source_baseline_commit: 'c73512acbbaf9c4c7fb803407b04ec54dc4bcd10',
  source_baseline_note: "'Sprint 1 and Sprint 2 working build'. Same source baseline commit as this batch's site-boundary-status-risk.js (BRAIN-0006) — a distinct, independently-governed consumer of the same underlying fact, not a duplicate.",
  distinct_from_note: 'Not a duplicate of BRAIN-0006 (this same batch) — see this file\'s own header comment for the full distinction.',
  inequality_behaviour_note: "Inequality against the single literal 'confirmed', not narrowed to a 'skipped'-only check — 'skipped', empty string, null, undefined and any unrecognised value all produce the missing-info flag, deliberately preserved.",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  brain_version: PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_VERSION,
  contract_version: PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainMissingInfoSiteBoundary,
    PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_TEXT,
    PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_PROVENANCE,
    PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_VERSION,
    PC_BRAIN_MISSING_INFO_SITE_BOUNDARY_CONTRACT_VERSION
  };
}
