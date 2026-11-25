# CLAUDE.md – Project Check standing rules

Grok and Claude both follow this file.

- approved is the only source of truth. Stuart is the final approver. Never merge.
- "tweak" = stays in the same open PR; change ONLY exactly what Stuart said; anything else that seems needed goes in the summary and waits for his yes; no tests; reply with the review link and one line on what changed.
- "creative" = may change the surrounding area; list every change made.
- Layout changes: show a Figma image first, wait for approval.
- "summary below", "dont do", "dont comment wait" = answer only, take no action.
- Never use Cursor. No Playwright, screenshots or long tests unless Stuart asks.
- Every UI change must work on phone and laptop.
- When work needs Claude, Grok writes the exact instruction as one copy-paste block for Stuart to give Claude, then checks Claude's PR and Vercel preview against Stuart's instruction before Stuart merges.
- Before any work, read CLAUDE.md and docs/continuity/CURRENT-CHAT-INDEX.md on approved.
- Review link: https://project-check-app-git-review-project-check.vercel.app

## Repository layout (added 25 Nov 2026, migration from the old repos)
- This public repo is now the single home. The old private repos (Project-Check-MVP-Master-Build, Project-Check-Brain) are archives only and will be deleted once Stuart approves.
- Rules and governance: docs/governance/ (PROJECT-SOURCE-OF-TRUTH.md, AGENTS.md, test and platform rules). Continuity: docs/continuity/. Product and report rules: docs/product/, docs/reporting/. Old history: docs/history/ (reference only). Brain repo copy: docs/brain-archive/ (archived, not used by the app). Index of what moved: docs/MIGRATION-FROM-OLD-REPOS.md.
- Public repo: never add client documents, client or people names, addresses, prices, keys or security notes. Use the Job A–O labels for past jobs. Client originals and security notes stay private.
- After a merge into approved, update the current-state sections of docs/governance/PROJECT-SOURCE-OF-TRUTH.md when Stuart asks. Session summaries are appended to docs/continuity/CURRENT-CHAT-INDEX.md (append-only).
