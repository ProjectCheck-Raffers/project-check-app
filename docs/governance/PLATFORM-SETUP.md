> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Now lives in project-check-app under docs/governance/. Root-level file names in this text (AGENTS.md, PROJECT-SOURCE-OF-TRUTH.md, etc.) now sit in this folder. Client jobs are anonymised as Job A–O; infrastructure IDs and security details are redacted. Where this file and the root CLAUDE.md disagree, CLAUDE.md wins.

> SUPERSEDED AS CURRENT OPERATING AUTHORITY — historical record, 22 September 2026. Read [PROJECT-SOURCE-OF-TRUTH.md](PROJECT-SOURCE-OF-TRUTH.md) first. The original text below is preserved; it does not authorise old branches, deployment routes, architecture or asset authority. Active runtime files remain preserved.

# Project Check secure test platform

Status: **ACTIVE TEST ENVIRONMENT**

Live platform: https://projectcheck-raffers.github.io/Project-Check-MVP-Master-Build/

Source branch: `trial/direction-c-complete-working-model`

Backend: Supabase project `Project Check Test Platform` in West EU (Ireland).

## Access

Access is invite-only. Open sign-up is disabled.

To add a tester:

1. Open Supabase → Project Check Test Platform → Authentication → Users.
2. Select **Add user → Send invitation**.
3. Enter the tester's business email.
4. The tester follows the invitation email to set their password, then signs in at the live platform.

The owner invitation was sent to `[owner email redacted]` during activation.

## Data and chronology

- `profiles`: customer name, company, business email and mobile.
- `projects`: current Project Check project state, location, dimensions and stage.
- `project_events`: append-only chronological project changes.
- `documents`: private upload metadata.
- `project-documents`: private 25 MB-per-file bucket for PDF, DOCX, PNG and JPG.

Row-level security restricts each signed-in customer to their own profile, projects, event history and documents.

## Deployment

GitHub Actions deploys `Project-Check-MVP-Master-Build/` after every push to the trial branch. The permanent GitHub Pages URL does not depend on a running Codespace.

## Test-environment boundary

This is ready for invited test users. Before production launch, complete legal review of the draft Terms and Privacy Policy, define document retention/deletion rules, configure production email delivery, and complete independent security testing.
