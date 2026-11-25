> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Now lives in project-check-app under docs/governance/. Root-level file names in this text (AGENTS.md, PROJECT-SOURCE-OF-TRUTH.md, etc.) now sit in this folder. Client jobs are anonymised as Job A–O; infrastructure IDs and security details are redacted. Where this file and the root CLAUDE.md disagree, CLAUDE.md wins.

> SUPERSEDED AS CURRENT OPERATING AUTHORITY — historical record, 22 September 2026. Read [PROJECT-SOURCE-OF-TRUTH.md](PROJECT-SOURCE-OF-TRUTH.md) first. The original text below is preserved; it does not authorise old branches, deployment routes, architecture or asset authority. Active runtime files remain preserved.

# Page Review Sandbox Governance

## Authoritative environments

- **Review branch:** `sandbox/page-review`
- **Review deployment:** existing GitHub-to-Vercel Preview route for `project-check-mvp-master-build`
- **Rollback reference:** record the exact branch commit before each bounded implementation
- **Production/master:** must not receive review work or unapproved changes

## Mandatory workflow for every change

1. Confirm and record the current `sandbox/page-review` commit.
2. Make only the explicitly authorised bounded changes on that branch.
3. Run targeted automated checks and desktop/mobile overflow checks.
4. Push one reviewable commit to `sandbox/page-review`.
5. Verify that exact commit through the existing Vercel Preview route.
6. Stop for Stuart's approval. Do not merge or promote automatically.

## Recovery

If a test breaks the build:

1. Stop adding fixes to the broken commit.
2. Restore the recorded rollback commit through a normal revert.
3. Preserve the broken branch/commit for diagnosis.
4. Correct from the last verified review commit.

## Data safety

The Supabase test database is the test platform's only customer-data environment. Test data must remain isolated from any future production database. Schema changes require a committed migration before they are applied.

## Design and review

- Approved Project Check Figma frames remain the visual source of truth.
- Current GitHub masterfile assets remain the byte-level brand source of truth.
- Review uses the existing Vercel Preview, tied to the exact `sandbox/page-review` commit.
