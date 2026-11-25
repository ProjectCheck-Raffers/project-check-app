> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Kept as the continuity record; references to the old repo, its Vercel project and its workflows describe the old setup. The live entry point is CLAUDE.md and docs/continuity/CURRENT-CHAT-INDEX.md in project-check-app. Client jobs are anonymised as Job A–O; IDs are redacted.

# Project Check — Continuity V1

## Canonical entry point and publication status

The founder has designated `ProjectCheck-Raffers/Project-Check-MVP-Master-Build`, branch **approved**, as the canonical publication home for project continuity and the current clean application baseline. Historical `sandbox` and `master` are evidence only, not working lines. A documentation commit does not approve an application version or commercial release.

Canonical URL after approved publication:
https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/blob/approved/docs/continuity/README.md

**Read the approved branch explicitly.** This document on a proposal branch is a draft. Continuity V1 is not published until the founder-approved merge and approved-branch read-back have been verified. A blind new-chat test is a separate, subsequent milestone.

Recorded source references are dated observations. Publication will advance approved's documentation head beyond its recorded application baseline. Resolve the live head and inspect the intervening diff/PR; do not treat a documentation-only advance as a new approved application. Likewise, an index's authoring-time pending status must be checked against live PR/commit evidence, not assumed current forever.

## Authority and evidence

Stuart Rathbone is founder and final approval authority. His latest explicit instruction defines the task; recorded old tasks do not grant continuing write permission. No assistant, repository default, historical file, successful check or deployment grants permission to implement.

- **VERIFIED:** directly inspected evidence, with its date/reference; recheck changing facts before acting.
- **DOCUMENTED:** an existing record or reported result; distinguish it from current independent verification.
- **PLANNED:** proposed or authorised future work, not completed implementation.
- **UNKNOWN:** unavailable access or insufficient evidence. Do not silently fill gaps.

## Mandatory reading order

1. Canonical [AGENTS.md](../governance/AGENTS.md) and [PROJECT-SOURCE-OF-TRUTH.md](../governance/PROJECT-SOURCE-OF-TRUTH.md).
2. [MASTER.md](MASTER.md): project position, approved baseline and historical branch evidence.
3. [LATEST-SIGNOFF.md](LATEST-SIGNOFF.md): latest verified milestone and limits.
4. [CURRENT-CHAT-INDEX.md](CURRENT-CHAT-INDEX.md): latest task, handover and stopping point.
5. [DECISIONS.md](DECISIONS.md): applicable approvals, rejected approaches and superseded instructions.
6. [ENVIRONMENTS.md](ENVIRONMENTS.md) and [RECOVERY.md](RECOVERY.md).
7. Relevant Brain governance, version, migration and provenance records identified below.

## Ownership and update rules

The Chief Architect prepares continuity and architecture records; the AI Coder implements bounded founder-approved tasks; tests supply evidence; an independent reviewer assesses the proposal; Stuart approves publication and releases. All AI tools follow the same instructions.

README owns navigation and recovery instructions; MASTER owns the current project summary; DECISIONS owns decision status; LATEST-SIGNOFF owns milestone scope; CURRENT-CHAT-INDEX owns task handovers; RECOVERY owns coverage/procedures; ENVIRONMENTS owns service mappings. Other files link rather than duplicate changing status.

Update affected records after meaningful tasks/decisions through a founder-authorised PR or another explicitly approved recording process. Record actual results, failures, commit and deployment identities, outstanding work and next authority. Never claim a session is saved until the published GitHub commit and file contents have been read back. Never claim an unmerged proposal is canonical.

## Repository responsibilities

- [Application](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build): product code and project-wide continuity.
- [Brain](https://github.com/ProjectCheck-Raffers/Project-Check-Brain): independent governed rules, schemas, provenance, tests and history; no customer records. Consult its `GOVERNANCE.md`, `BRAIN-MIGRATION-REGISTER.md`, `BRAIN-VERSION`, `CHANGELOG.md` and relevant provenance/test files. Its README has a documented stale migration statement; do not use it alone.
- [Recovery](https://github.com/Project-Check-Recovery/Project-Check-Recovery-Backups): encrypted preservation Release and associated recovery records. Source preservation is not live database recovery.

## MASTER PROJECT CHECK RECOVERY PROMPT

Copy this entire prompt into a new Architect conversation. Supply no earlier transcript.

> You are the Project Check Chief Architect. Begin read-only; do not rely on ChatGPT memory.
>
> Open https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/blob/approved/docs/continuity/README.md using authenticated repository access. Verify this file exists on approved; a proposal branch is not publication. Read the canonical AGENTS.md and PROJECT-SOURCE-OF-TRUTH.md, then all seven continuity documents in the specified reading order. Follow the latest handover, approved decisions, rejected approaches and unresolved failures.
>
> Verify the live approved head, its latest application-bearing commit and the frozen Version 3 checkpoint. approved is the canonical clean baseline; historical sandbox and master are evidence only and must not be used as starting points or code sources. Distinguish documentation authority, application baseline and future commercial release. Newest code, a default branch and READY deployment are not proof of the best working application.
>
> Read relevant Project-Check-Brain governance, version, migration, provenance and test records directly. Do not infer complete Brain preservation from vendored application files.
>
> Check relevant CI, Vercel deployment SHA/access and Supabase status/mappings where authenticated access permits. Do not start Codespaces, resume databases, run tests or change services merely to recover context. Report evidence dates, access limits and discrepancies. Do not expose secrets or customer data.
>
> Identify completed, failed and unfinished tasks, rejected solutions, Windows/Codespaces/Brain preservation gaps, and the exact next task supported by current founder authority. A recorded recommendation is not permission to implement.
>
> Work on one defined task at a time. Do not resurrect historical code or restart completed preservation/development. After two unsuccessful repair attempts on the same issue, stop code changes and investigate root cause before proposing a bounded correction. Do not weaken tests to manufacture success.
>
> Return one PROJECT CHECK — ARCHITECT HANDOVER stating verified position, discrepancies, latest sign-off, open risks, next authorised task (or none), approval needed and stopping point. Stop before writes, commits, uploads, branch changes, merges, deployments or database/permission/DNS changes. If private GitHub access or required files are unavailable, report the precise limitation and minimum read-only evidence needed; never invent progress. End with END OF ARCHITECT HANDOVER.

## Independent recovery acceptance test

After publication, a genuinely new conversation receives only the recovery prompt above. It must recover repository identity; the live approved reference and the historical status of sandbox/master; Version 3 checkpoint; Brain responsibilities; latest sign-off; failed tests; preservation gaps; service status; current decisions; and next authorised task from GitHub and permitted service evidence. Record its evidence and result through the approved publication process. Access failure is BLOCKED, not a pass. Investigate a failed recovery before bounded corrections; do not repeatedly redesign continuity.
