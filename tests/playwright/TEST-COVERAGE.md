# Approved-line journey coverage

This repair targets `approved` at
`226556cdc1d0ba2efc4d118ceacff8aefcc3ba40`, not the newer sandbox application.
It changes tests without restoring retired customer navigation.

## Current customer journey

`journey.spec.js` and `cross-browser.spec.js` share
`current-customer-journey.js`. They register a test account, create a project
through the current form, check its saved facts, visit Project Summary, and
position a building and save a boundary through Site Layout controls. They
return to the summary and check persistence. Geocoding is deterministic test
data; this is not proof of a live geocoding provider or database isolation.

The existing seven Chromium viewport projects and five cross-engine projects
remain in the configuration. No engine, viewport, retry or timeout was removed
to manufacture a pass.

## Retained legacy components

The former journey and cross-engine specifications are preserved as
`legacy-journey.spec.js` and `legacy-cross-browser.spec.js`. Their original
assessment, map, report, download and door assertions remain. Existing filename
patterns include both the new and legacy files.

`createLegacyAssessmentProject` explicitly seeds an incomplete historical
project, while `openLegacyStage1` and `openLegacyDoors` enter existing component
routes. These helpers annotate results as legacy component coverage. They do
not advertise those routes as the current customer journey. New project
creation is independently exercised through the real current form.

Other historical assessment/risk tests use the same partial-project fixture so
new required project fields do not silently change their input assumptions.
Use UUID project identifiers accepted by the existing router.

## Baseline provenance

- `455c04b41951cd1f196492dae5bbaf8df55b7d53`: approved Figma homepage replaces
  older DECIDE wording and strip structure.
- `d6821f4`: shared banner/drawer moves header navigation into the menu on shared navigation pages.
  Historical question pages retain their Home brand link and are deliberately
  outside `SITE_SHELL_ROUTES`; their navigation checks return Home to use the drawer.
- `4ba3846`: continuation skips already-known answers and confirmed maps. The
  legacy bearing-persistence test reopens the existing map component explicitly,
  preserving its bearing and unchanged-footprint assertions after a report/reload.
- `819d945b`: approved fuller My Projects uses project overview actions.
- `83adb36a`: pre-checkpoint journey uses Project Overview, Project Summary
  and Site Layout, with current project fields and return controls.

These recorded changes justify updating stale selectors and copy expectations;
they do not authorise new product behaviour or a promotion of sandbox.

## Safe execution and evidence

Do not run account-creating tests against a live Supabase configuration. The CI
workflow disables that configuration. For local runs, serve a separate copy of
the application with `window.PROJECT_CHECK_PLATFORM_CONFIG = {};`; retain the
original configuration unchanged. Never use real customer accounts or data.

Use the committed package lock and Playwright browser revisions for release
verification. Results from a different diagnostic Chromium version are limited
local evidence, not a passing pinned browser matrix. Keep external-resource
failures and host browser-startup failures visible.

Diagnostic batches may stop at a failure limit or select untested files, but
the committed CI configuration still includes the complete suite. A timeout or
interrupted batch is not a pass. The CI upload step includes raw traces as well as the HTML
report when available; hard runner termination can still prevent an upload.
