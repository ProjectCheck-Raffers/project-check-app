> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Now lives in project-check-app under docs/governance/. Root-level file names in this text (AGENTS.md, PROJECT-SOURCE-OF-TRUTH.md, etc.) now sit in this folder. Client jobs are anonymised as Job A–O; infrastructure IDs and security details are redacted. Where this file and the root CLAUDE.md disagree, CLAUDE.md wins.

# Project Check — Claude continuity rule

Applies automatically to every Project Check session. Also follow [AGENTS.md](AGENTS.md).

- Single source of truth: approved only. Never treat unmerged branches or open PRs as current.
- Session start: Read docs/continuity/CURRENT-CHAT-INDEX.md on approved before answering.
- After any merge into approved: update the "Clean baseline and current working point" and "Approved changes since the clean baseline" sections of PROJECT-SOURCE-OF-TRUTH.md on approved in the same session. This is pre-authorised.
- Session end: If architectural, workflow, or continuity decisions were made, append a concise dated summary to docs/continuity/CURRENT-CHAT-INDEX.md on approved (append-only, matching the existing nightly heading format). This is pre-authorised.

## Working rules

- Read only files in ProjectCheck-Raffers/Project-Check-MVP-Master-Build on the approved branch.
- Do not change application code without explicit approval. Continuity-file session-end summaries are pre-authorised as above.
- Report results with commit and PR links.
- Simple tweaks (text, button, small CSS): make the edit, open one PR off approved, send the Vercel preview link. Do not run Playwright, take screenshots or run full test suites unless Stuart asks (Stuart's standing instruction, 18 November 2026, to keep usage costs down).
- Two repos (Stuart's decision, 19 November 2026):
  - App code now lives in the PUBLIC repo ProjectCheck-Raffers/project-check-app (branch `approved`, review branch `review`). All app changes, PRs and Vercel previews happen there. Do not make app code changes in this private repo any more.
  - This PRIVATE repo stays as the archive and the home of PROJECT-SOURCE-OF-TRUTH.md, CLAUDE.md, the continuity index and docs/evidence. Never copy docs, evidence, continuity or security notes into the public repo.
  - Vercel: new project `project-check-app` deploys from the public repo. Approved link https://project-check-app-git-approved-project-check.vercel.app, review link https://project-check-app-git-review-project-check.vercel.app. The old `project-check-mvp-master-build` Vercel project is kept only as a fallback.
- GitHub Actions: in the public repo, a 1-minute "Quick check" runs once per PR and Playwright runs only when Stuart presses "Run workflow" (free, as the repo is public). In this private repo every workflow is disabled except the nightly continuity record. Never run Playwright from Grok or Claude unless Stuart asks.
- Stuart merges PRs himself on GitHub. After a merge in the public repo, update the source of truth here when Stuart asks.
- Review link: simple tweaks go on the `review` branch of the public repo (reset from approved when empty), with one open PR from `review` into approved. Stuart reviews at the fixed link https://project-check-app-git-review-project-check.vercel.app and refreshes after each push. Merge only when Stuart says so.

No further rule changes required. Proceed with authorised work from the continuity index. Do not request further confirmation on these rules.
