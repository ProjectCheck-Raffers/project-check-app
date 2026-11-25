> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Now lives in project-check-app under docs/governance/. Root-level file names in this text (AGENTS.md, PROJECT-SOURCE-OF-TRUTH.md, etc.) now sit in this folder. Client jobs are anonymised as Job A–O; infrastructure IDs and security details are redacted. Where this file and the root CLAUDE.md disagree, CLAUDE.md wins.

# Project Check — AI and developer entry point

Stuart Rathbone's latest explicit instruction defines the authorised task. Begin new sessions read-only. Read the [canonical continuity entry point on approved](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/blob/approved/docs/continuity/README.md), [PROJECT-SOURCE-OF-TRUTH.md](PROJECT-SOURCE-OF-TRUTH.md), and follow the mandatory reading order, current handover, decisions and relevant Brain records. A proposal branch is not published authority; report unavailable access instead of filling gaps from memory.

## Source roles and task boundaries

- `approved` is canonical: it owns published project continuity and is the current clean application baseline. Work branches start from approved at the full commit named in Stuart's task. approved is not by itself a commercial release.
- `sandbox` and `master` are historical lines. Their commits, documents and instructions are evidence only; never start work there, route work through them or copy code from them without Stuart's explicit task-specific instruction.
- `recovery/version-3-approved-2026-09-22` at `9cf08458576aa11377a79cd5a7a585ef1268ff11` is frozen recovery. Do not modify it.
- A default branch, old MASTER-SPEC/current-state file, old chat, CI pass or READY deployment never grants write/release authority.
- Preserve current application assets/dependencies and unique local work. Never copy from historical master or resurrect routes because an old file claims authority.
- Branch creation, reconciliation, promotion and deployment need explicit task-specific authority. Continuity V1 authorises only its documentation programme, not workflow/default-branch changes.
- Resolve live refs and compare exact candidates before promotion. Record divergence; never force push, reset or squash/rebase an approved candidate, or merge application branches to make documentation work. A fast-forward route is permitted only if possible and separately authorised; historical sandbox divergence is recorded in MASTER.

## Permanent AI requirements

Chief Architect defines architecture, requirements, continuity and independent review. AI Coder implements bounded approved tasks. Tests provide evidence, not release authority. Stuart approves significant changes and releases. ChatGPT, Claude, Copilot and other assistants follow these same instructions.

One defined task and one founder-approved architectural direction at a time. After two unsuccessful repair attempts on the same issue, stop code changes, investigate root cause and present a bounded revised proposal. No speculative repeated fixes or weakened checks to manufacture success.

No feature is complete without appropriate tests. Report actual tests/results, exact commits, deployment evidence, limitations and stopping point. Local/mock-backed checks do not prove live database/customer isolation. Do not expose credentials/customer records or change database permissions, infrastructure or Production without explicit authority.

Record meaningful work and decisions through the founder-approved process in [CURRENT-CHAT-INDEX.md](../continuity/CURRENT-CHAT-INDEX.md). A session is not saved until the published GitHub commit and contents are read back. PR creation does not authorise merge; a documentation merge does not approve an application release.

Original instructions remain recoverable in Git history and [SUPERSEDED history](../history/AGENTS-before-version-3-foundation.md). Historical records are evidence, not executable tasks. Canonical approved URLs prevail over stale branch copies; report discrepancies rather than propagating them.
