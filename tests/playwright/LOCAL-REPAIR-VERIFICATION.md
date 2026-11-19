# Local repair verification — 30 October 2026

## Scope and baseline

Isolated candidate based on approved commit
`226556cdc1d0ba2efc4d118ceacff8aefcc3ba40`.
Application changes are limited to closed-drawer inertness and focus handling.
Scanner exceptions are eleven assessed historical fingerprints. The remaining
changes migrate tests and improve failure-artifact collection. Documentation
PR #58 and its published commits are outside this candidate.

## Browser results

Latest results collected across diagnostic batches, NOT one uninterrupted full
suite run and NOT the pinned CI browser matrix:

| Chromium cases | Result |
| --- | ---: |
| Passed | 149 |
| Failed | 1 |
| Existing explicit skips | 6 |
| Total Chromium cases discovered | 156 |

The seven current customer journeys pass through registration, real project
creation, Project Summary, building confirmation, boundary drawing and saved
Site Layout persistence. The seven legacy journeys retain assessment, map,
report, download and door coverage. All ten mobile map-rotation cases pass.
Desktop/mobile map report-round-trip persistence passes after accounting for
known-answer continuation. Header, question-sequence, consolidated-input,
report, geometry, security and workspace regressions were exercised.

The remaining failure is `malformed localStorage does not crash the app on
load`: the page renders and navigates, but its unchanged strict console-error
assertion sees two `ERR_EMPTY_RESPONSE` external-resource errors on this host.
It remains failed; no error filter, assertion removal or timeout increase was
introduced.

Five geometry-continuity cases were already disabled because width/length
questions had been retired. One live map/provider test was already opt-in.
These six skips are not passes. The retained legacy WebKit test also preserves
its pre-existing conditional viewport-scale limitation guard.

Playwright package: 1.62.1; diagnostic Chromium: 138.0.7204.0.
The required pinned Chromium 151.0.7922.34 download was unavailable. Pinned
Firefox 153.0 installs but its four selected cases failed in page setup with
host sandbox/uid-map restrictions. WebKit could not run because required system
libraries could not be installed with available host permissions. None of the
ten Firefox/WebKit cases is claimed as a pass. Package locks, browser matrix,
retries and CI's 20-minute limit remain unchanged.

Tests ran against a separate served copy with backend configuration disabled.
MapLibre 3.6.2 and jsPDF 2.5.1 assets in that copy were checked against the
application's integrity hashes. Geocoding in the new journey is deterministic
fixture data. These runs do not establish live provider reliability, database
isolation, production behaviour, or compliance with CI's total time budget.

## Other checks

- HTML validation: zero errors, compared with eight original drawer errors.
- JavaScript syntax and diff whitespace checks: passed.
- Gitleaks 8.30.1: zero remaining findings across available 464-commit history
  using the eleven assessed fingerprint exceptions. Original CI covered 517
  commits; complete matching-history CI verification is outstanding.
- Synthetic server secret and new publishable-key occurrence in the same
  configuration path: both still detected by the scanner regression test.

## Publication boundary

No push, repair PR, merge or deployment is authorised by these local results.
Required checks and independent review must be addressed before approval to
merge documentation PR #58. The existing Preview ignore rule covers only two
exact documentation commits, not this repair or a new approved merge result.
Recheck deployment configuration and agree Preview precautions before any
separately approved publication. Test/Production database isolation remains
unresolved. No live database changes or commercial release are authorised.

## Subsequent GitHub CI — PR #59

Exact published head: `7be6ba5720af261106a11793ba47d42ff0082c61`.
Run: https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/actions/runs/41090890615

The pinned browser suite completed in 12.1 minutes: **158 passed, 2 failed,
6 existing skips**. Both failures are current Site Layout journeys on Firefox
(desktop and phone viewport). Chromium and WebKit cases passed. The prior local
strict console-error failure did not recur. Both separate Profile tests passed.
HTML/CSS/JavaScript validation, logo validation and CodeQL passed. Full-history
Gitleaks passed across **520 commits**, with no remaining findings.

Failure traces show Firefox WebGL context creation failing with
`FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS` and `Failed to initialize WebGL`.
The Site Layout canvas stays hidden because map initialization stops. This is
not evidence that a weaker canvas assertion would be justified.

The exact repair Preview was canceled by the Ignored Build Step (exit 0), as
confirmed in Vercel logs. Production still points to its prior deployment.
PR #58 remains draft/unmerged with its eleven continuity files unchanged.
Automated Copilot review reported no open inline issues but excluded `app.js`
as generated; it is not full application-code sign-off. Database isolation
remains unresolved.

### Local Firefox renderer candidate — not yet published or proven

Only CI Firefox is changed to headed mode. The full CI suite runs under Xvfb,
and an explicit pinned-Firefox WebGL capability probe runs first. Playwright's
installed core source recommends `xvfb-run` for a headed Linux display and lists
`xvfb` in native installation tools. No application code, assertion, browser
pin, viewport, retry or time limit is changed by this follow-up.

Configuration checks passed: only the two Firefox projects become headed in
CI; all 14 projects and the exact same 166 tests remain; local launch defaults,
60-second test limit and existing retry settings remain. JavaScript syntax and
whitespace checks passed. Actual headed rendering and the full matrix remain
UNVERIFIED: this host lacks Xvfb and its pinned Firefox page setup is blocked by
host sandbox restrictions. No sandbox restriction was bypassed.

This is a bounded runner hypothesis to test in GitHub, not a claimed repair.
It needs separate approval to publish the new commit and update the exact
Preview guard before pushing. No merge is authorised.
