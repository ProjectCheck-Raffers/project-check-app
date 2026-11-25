> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Kept as the continuity record; references to the old repo, its Vercel project and its workflows describe the old setup. The live entry point is CLAUDE.md and docs/continuity/CURRENT-CHAT-INDEX.md in project-check-app. Client jobs are anonymised as Job A–O; IDs are redacted.

# Project Check — Current Engineering Position

Evidence dates: **29 October – 1 November 2026**. This is a dated record, not a claim that service state cannot change. Publication status is defined in [README.md](README.md).

## Source and authority

**VERIFIED:** application repository `ProjectCheck-Raffers/Project-Check-MVP-Master-Build` is private. Executable application lives under `Project-Check-MVP-Master-Build/`.

| Role | Reference at inspection | Meaning |
|---|---|---|
| Canonical clean baseline; continuity publication home | `approved` — `226556cdc1d0ba2efc4d118ceacff8aefcc3ba40` at inspection; live `eee038322c16c3707cbe0bccdb91e65d2049957f` on 1 November 2026 | Starting point for authorised work; not a commercial certification |
| Historical development line (evidence only) | `sandbox` — `728f810f564bcfb49d6dc7e6d1b9dc3a7bdaf38a` (unchanged on 1 November 2026) | Not a working or starting branch |
| Historical sandbox application commit | `9e4febece0d2a479ef68857e23c9c1c5028e68de` | “Show and confirm roller door height on Page 15BB”; evidence only |
| Historical `master` | `ed7e992b78901869c35d9cb6dfeb1313f4129d6b` on 1 November 2026 | Evidence only; never copy from it |
| Frozen Version 3 checkpoint | `recovery/version-3-approved-2026-09-22` — `9cf08458576aa11377a79cd5a7a585ef1268ff11` | Recovery only, never a working branch |
| Commercial release | **UNKNOWN / not approved here** | No production candidate selected by continuity work |

**VERIFIED historical observation (29–30 October):** [approved...sandbox](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/compare/approved...sandbox) is diverged: sandbox 54 commits ahead, 4 behind. No merge or reconciliation is authorised; sandbox is not a promotion route into approved.

**VERIFIED:** recovery ruleset `23834904` blocks updates, deletion and non-fast-forward changes with no bypass actors. approved ruleset `23878053` prevents deletion/non-fast-forward changes; that alone does not enforce independent review or passing tests. sandbox is unprotected. Do not change protections under this programme.

## Retained architecture

**VERIFIED / DOCUMENTED:** vanilla HTML/CSS/JavaScript hash-routed SPA. `index.html` supplies ordered scripts; `app.js` customer flows; `site-layout.js` site layout; `geometry.js`/`drawing.js` geometry and drawings; `platform.js`/`platform-config.js` Supabase integration. Browser local storage remains part of the architecture. Inspect the exact candidate before relying on behaviour.

Retain existing GitHub, Vercel, Supabase integration, Playwright tooling and devcontainer. No Next.js, TypeScript migration, replacement framework or wholesale rebuild is authorised.

**DOCUMENTED historical:** sandbox recorded Pages 1–14 plus Page 15BB/Building Design work. The previous approved source-of-truth described an earlier Pages 1–14 position. Neither description permits restoring old code. The best currently working customer journey remains **UNKNOWN** pending candidate-specific evidence.

## Tests and known failures

**VERIFIED historical runs for sandbox `728f810…` (not results for approved):**

- [CI 36881573757](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/actions/runs/36881573757): success; syntax/validation evidence, not full functionality.
- [CodeQL 36881573821](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/actions/runs/36881573821): success under the committed workflow and its recorded exception policy.
- [Secrets scan 36881573752](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/actions/runs/36881573752): success.
- [Device/browser suite 36881573795](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/actions/runs/36881573795): failure; two shards failed, two cancelled; targeted Profile job passed.
- Inspected failed jobs: `110434369894` and `110434369944`. Three reported tests timed out awaiting “Doors & drawing review” in consolidated-input/geometry-audit scenarios. Obsolete expectations versus application defects are **UNKNOWN**; no repair was performed.

The browser workflow clears live Supabase configuration on the runner. It does not prove live login, persistence, storage permissions or customer isolation. CI on approved or a documentation PR must be reported separately; these sandbox results cannot be reused as a pass for another SHA.

### Continuity draft PR #58 — read-back 1 November 2026

The earlier Continuity V1 snapshot consisted of two documentation commits, `bc1d800b4e97340df66a43479fcda3bfa1399206` and `b88bcb0ae6ec9ecdae54777463e6e7775ce77944`. The four-commit review candidate ended at `9496bc869ef3c129bc3e636c104230e0d787ede9`. Consistency commits `b2dcd6e9d46ca41ee69c57b876fca8e84bbdefd5` and `8a6facd793d218d6e63588f43913abec86566e59` followed, then a documentation-only cleaning commit. The PR targets `approved` from merge base `226556cdc1d0ba2efc4d118ceacff8aefcc3ba40`. All eleven changed files are Markdown; application and executable workflow files remain outside the change. [CURRENT-CHAT-INDEX.md](CURRENT-CHAT-INDEX.md) holds the commit-by-commit record.

- Recorded review state: the original two Copilot threads are resolved/outdated. The two comments raised on `9496bc8`, scoping the two-commit statement and recording the READY Preview identity, are addressed in CURRENT-CHAT-INDEX. Recheck thread state live.
- Checks on `9496bc8` passed: CI, CodeQL, Secrets scan, device compatibility/security suite and Vercel status. Later heads need their own read-back.
- Deployment history: `bc1d800` Preview blocked by account verification; `b88bcb0` cancelled by the ignored-build-step result; `b2dcd6e` READY (`dpl_vhfy9WtzUeFjtvQiEXUCCi4Cmr4d`); `8a6facd` READY Preview `dpl_GYb7sBTJpGwSUQGuLJpJ22nXt2WH`, not Production. The cleaning commit needs fresh verification. See ENVIRONMENTS.
- No application repair is authorised by this documentation PR.

No failed check was suppressed, rerun to manufacture a pass or waived. The PR remains a documentation proposal. Do not request an unconditional merge on this evidence.

## Brain and preservation

**VERIFIED at Step 2 inspection:** Brain main `51fd514bbb9bbf937bae75bca7ea162a77116ea1`; 13 Stage 1 JS rule modules matched their vendored copies on historical sandbox. Brain also owns schemas, provenance and tests outside those vendored copies. Its main is unprotected and its ruleset listing was empty at inspection.

**VERIFIED:** Brain README says no migrations yet, while its migration register records 13 migrated rules. Consult the register/governance and direct files; do not silently upgrade a rule's approval status. Brain changes require separate authority.

**DOCUMENTED:** [Step 1C sign-off](LATEST-SIGNOFF.md) is completed for the captured source package. Windows and Codespaces inventory and complete independent Brain preservation remain **UNKNOWN**; see [RECOVERY.md](RECOVERY.md). An independent backup outside GitHub remains outstanding.

## Immediate position and task boundary

**VERIFIED programme progress:** PR #58 contains the eleven-file Continuity V1 documentation programme and its published correction record. The consistency and cleaning updates are documentation-only and do not change application code, workflows, Brain, database, permissions, hosting or production.

The branch is still a draft proposal. The approved branch does not yet contain these continuity documents. Merge requires Stuart's explicit final approval followed by approved-branch read-back. A documentation merge does not approve an application release.

No feature task, sandbox/master reconciliation, database activation or environment configuration is authorised. [CURRENT-CHAT-INDEX.md](CURRENT-CHAT-INDEX.md) owns session status and next-action gates. [ENVIRONMENTS.md](ENVIRONMENTS.md) owns deployment/database mappings.

## Ownership and updates

Chief Architect maintains this summary from live GitHub/service evidence, linked sign-offs and explicit founder decisions. Update after a verified material change using the founder-approved recording process. Record full references, evidence dates and unknowns; do not copy Brain rule definitions here.