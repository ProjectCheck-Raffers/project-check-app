// Project Check Brain — Stage 1 — site-boundary status risk rule
// STAGE 1 BRAIN COMPLETION BATCH (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
//
// GOVERNANCE STATUS: LOCKED-EXISTING (see site-boundary-status-risk.provenance.json
// and BRAIN-MIGRATION-REGISTER.md row BRAIN-0006). Existing, live Project
// Check rule, carried forward exactly as it was. Not relabelled CONFIRMED
// merely because this migration is authorised.
//
// SOURCE: app.js, runStage1Risks(). Traced via `git log -S` to application
// commit c73512acbbaf9c4c7fb803407b04ec54dc4bcd10 ("Sprint 1 and Sprint 2
// working build") — the exact same commit as Migration Slice 5's
// buildingPositionStatus rule; siteBoundaryStatus is that rule's direct
// sibling. siteBoundaryStatus is a status flag set by saveBoundary()/
// skipSiteBoundary(), not a question-answer value — it was never touched by
// any 27 August question-wording rework.
//
// Rule (inequality against the single literal 'confirmed' — NOT narrowed to
// a 'skipped'-only check; preserve exactly):
//   siteBoundaryStatus !== 'confirmed' -> one risk, exact text/category/
//   discipline below.
//   siteBoundaryStatus === 'confirmed' (exact) -> no risk.
// IMPORTANT: 'skipped', an empty string, null, undefined, and any
// unrecognised/legacy value all trigger the risk — this is the original
// application's own behaviour and must be preserved exactly, not narrowed.

const PC_BRAIN_SITE_BOUNDARY_STATUS_VERSION = '0.6.0';
const PC_BRAIN_SITE_BOUNDARY_STATUS_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_TEXT = 'The relevant site boundary has not yet been confirmed on a site map, so boundary-related constraints are not yet confirmed.';
const PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_CATEGORY = 'issue';
const PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_DISCIPLINE = 'site';

function pcBrainSiteBoundaryStatusRisk(siteBoundaryStatus) {
  if (siteBoundaryStatus === 'confirmed') return null;
  return {
    text: PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_TEXT,
    category: PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_CATEGORY,
    discipline: PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_DISCIPLINE
  };
}

const PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_PROVENANCE = {
  rule_id: 'stage1.site-boundary-status-risk',
  domain: 'stage-1',
  status: 'LOCKED-EXISTING',
  provenance_status: 'historical individual provenance not yet identified',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'runStage1Risks()',
  source_baseline_commit: 'c73512acbbaf9c4c7fb803407b04ec54dc4bcd10',
  source_baseline_note: "'Sprint 1 and Sprint 2 working build'. Same source baseline commit as Migration Slice 5's buildingPositionStatus rule — this is that rule's direct sibling. Trigger, text, category and discipline all present exactly as migrated.",
  producer_note: "p.facts.siteBoundaryStatus is SET by saveBoundary()/skipSiteBoundary() in app.js — not by this rule. Those producer functions were rewritten during the authorised Stage 1 Map Architecture and Map Control Layout + 17-Question Workflow tasks (2026-08-27), already committed/tested/normalised, entirely outside the scope of this migration.",
  inequality_behaviour_note: "siteBoundaryStatus !== 'confirmed' is an inequality against a single literal, not narrowed to a 'skipped'-only allowlist. 'skipped', empty string, null, undefined and any unrecognised/legacy value all trigger the risk — deliberately preserved, not narrowed.",
  live_migration_baseline_commit: '0d511a3e1274c109d1d2e76831e53b3b0c93ac74',
  live_migration_baseline_note: "Application HEAD at the time of this migration (branch combined-rev2-canopy-drawing) — confirmed identical trigger/text/category/discipline to the c73512a baseline by direct inspection.",
  brain_version: PC_BRAIN_SITE_BOUNDARY_STATUS_VERSION,
  contract_version: PC_BRAIN_SITE_BOUNDARY_STATUS_CONTRACT_VERSION
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainSiteBoundaryStatusRisk,
    PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_TEXT,
    PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_CATEGORY,
    PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_DISCIPLINE,
    PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_PROVENANCE,
    PC_BRAIN_SITE_BOUNDARY_STATUS_VERSION,
    PC_BRAIN_SITE_BOUNDARY_STATUS_CONTRACT_VERSION
  };
}
