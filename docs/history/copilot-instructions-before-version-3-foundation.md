> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

> SUPERSEDED — historical evidence only, 22 September 2026. Read ../../PROJECT-SOURCE-OF-TRUTH.md first. The original text below is preserved verbatim and must not be followed as current instructions.

# Repository custom instructions for GitHub Copilot

When reviewing changes in this repository, check them against the existing
project rules defined in
[`Project-Check-MVP-Master-Build/MASTER-SPEC.md`](../Project-Check-MVP-Master-Build/MASTER-SPEC.md).
Flag anything that conflicts with the customer journey, stage flow, or
requirements described there — including the locked Sprint 2 decisions on
brand, homepage, compliance wording, the two-free-download rule, map
measurement, project geometry/drawings and Stage 2 door editing.

In particular, always flag: "Thesius" (or any name other than "Project
Check") appearing as a public/customer-facing identity; a recreated or
substitute logo instead of the real
`Project-Check-MVP-Master-Build/assets/project-check-logo.png` asset;
and wording that implies Stage 1/2 formally approves, certifies or
guarantees engineering/compliance.

## Security review (challenge, don't just summarise)

For every change, actively look for and call out — don't merely describe the
diff — regressions against `security-readiness.md` and the OWASP Top 10:2025:

- customer-controlled text reaching `innerHTML`/`insertAdjacentHTML`/SVG
  string-building without going through `esc()` (`app.js`) or `pcEscXml()`
  (`drawing.js`) first — this is the app's one XSS control; any new render
  path that skips it is a genuine defect, not a style nit
- `eval`, `new Function`, `document.write`, or `javascript:` URL construction
- new `localStorage`/`sessionStorage` reads that assume well-formed data
  (must fail safe, matching `loadState()`'s pattern) rather than trusting it
- any change that treats a client-side check (login, download-entitlement,
  project ownership) as a real security boundary — these are documented
  PRODUCTION SECURITY BLOCKERs in `security-readiness.md`, not something a
  PR can "fix" client-side; flag any comment/claim that implies otherwise
- secrets, tokens, or credentials hardcoded anywhere (the repo has none —
  keep it that way)
- new external scripts/styles/fonts added without a pinned version and,
  where the resource is static-versioned, an SRI `integrity` attribute
- CSP regressions: new inline `<script>` blocks, new external origins not
  reflected in `staticwebapp.config.json`, or loosening towards
  `unsafe-eval` (never acceptable) or removing the documented justification
  for `unsafe-inline`
- unsafe error handling that could crash the whole app (uncaught throw on
  page load) or silently swallow a failure the customer needs to see
- responsive/mobile regressions and touch-usability regressions on the
  device classes covered in the Playwright suite under `tests/playwright/`
- regressions to Stage 1, Stage 2, maps, measurement, drawings, the door
  editor, reports, or PDF/download behaviour
