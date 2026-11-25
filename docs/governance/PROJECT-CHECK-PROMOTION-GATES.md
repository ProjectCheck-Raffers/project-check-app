> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Now lives in project-check-app under docs/governance/. Root-level file names in this text (AGENTS.md, PROJECT-SOURCE-OF-TRUTH.md, etc.) now sit in this folder. Client jobs are anonymised as Job A–O; infrastructure IDs and security details are redacted. Where this file and the root CLAUDE.md disagree, CLAUDE.md wins.

# Project Check — Promotion Gates and Approval Boundaries

Owner/final approval authority: Stuart Rathbone.

Read the [canonical continuity entry point on approved](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/blob/approved/docs/continuity/README.md), including MASTER, DECISIONS and ENVIRONMENTS. This guide defines gates, not standing permission to move branches or deploy. Its original text remains recoverable in Git history.

## Source roles and unresolved routing

approved is canonical: it owns published continuity and is the current clean application baseline; work branches start from it. Historical sandbox and master are evidence only, not routes. Frozen Version 3 is immutable. Every application task explicitly identifies its starting branch/full SHA, candidate, target and founder authority.

The previous guide prescribed test/page-review → sandbox and fixes only on test/page-review. That branch exists, but its existence does not make it the route for every task. Never create/reuse branches from historical instructions. MASTER records historical approved/sandbox divergence; sandbox is not a promotion route. No application reconciliation is authorised by Continuity V1.

## Gate 1 — Source / HEAD audit

- Resolve source/target heads and record exact candidate commit/application tree.
- Compare the full change; identify unrelated files, local/unpushed work and divergence.
- Prove the candidate SHA matches its intended review deployment.
- Preserve source history/checkpoints. Never force push, reset or rewrite an approved candidate to satisfy promotion.

Missing/unexpected evidence means FAIL/BLOCKED; stop before promotion.

## Gate 2 — Device and customer-journey parity

Define the founder-approved candidate journey: account/sign-in, My Projects, Project Overview/Summary, Site Layout, building positioning, boundary marking, confirmation and any explicitly in-scope Building Design work. Do not revive obsolete Doors/Openings routes because old tests/guides mention them; investigate discrepancies.

Check supported phone portrait/landscape, tablet and desktop sizes; the same questions/sequence, gates, project/account identity, saved data, completion state, back/edit/resume and layout/boundary state. Assess watch handoff only where in scope.

Classify visual, responsive, journey, data or critical defects (authentication, customer isolation, lost data). Record actual tests and gaps. Local/mock-backed passes do not prove cloud persistence. Failed/incomplete required checks block promotion. Repairs need an authorised source/scope; after two unsuccessful repairs stop and investigate root cause.

## Gate 3 — Security and environment boundary

Require evidence for secrets/service-role exclusion, customer isolation/RLS, session/authenticated routes, upload types/paths/access, output escaping/XSS, dependency control and intended test-service mapping. Normal review must not rely on temporary bypass links. Verify cross-customer isolation using authorised isolated tests.

An inaccessible/inactive database or untested policy is UNKNOWN/BLOCKED, not security PASS. Never resume services or alter permissions to complete review without explicit authority.

## Gate 4 — Founder decision and exact release identity

Required gates PASS + independent review + explicit Stuart approval precede promotion/deployment. The future high-level sequence is Development → Sandbox (a future test stage, not the historical sandbox branch) → Automated Testing → Founder Test → Approved Production; it does not authorise environment configuration.

Founder Test must eventually use verified HTTPS cloud access on phone/computer, a named candidate and isolated test data. Record application SHA/deployment ID separately from documentation commits. Verify exact deployed source and behaviour after any authorised operation. No automatic promotion follows CI success or READY status.

The old deployment-trigger-file workaround grants no standing authority. Trigger edits, operational commits, new branches/projects, aliases and deployments require explicit approval. Unknown automatic deployment effects require a stop before push.

## Production — locked behind separate written approval

Continuity V1 is documentation-only. No production configuration, security implementation, deployment preparation, branch movement or release is authorised. Later production work requires Stuart's full written instruction, exact candidate/sign-off, environment/data mapping and rollback evidence. Preserve existing databases, Vercel, DNS, billing and permissions.

Trace failures through source → checks → deployment → access → application. Do not replace repositories, branch model, projects or review routes merely because one connector fails. Historical routes are evidence, never automatically executable instructions.
