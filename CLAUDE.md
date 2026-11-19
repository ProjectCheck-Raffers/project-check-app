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
