# Project Check – continuity index (append-only, never delete or rewrite)

## 19 Nov 2026 – app moved to project-check-app

- App code moved here from ProjectCheck-Raffers/Project-Check-MVP-Master-Build; that repo is now the archive.
- PR #1 (fire-exit toggle in Add an opening panel, compact bottom bar) is open and NOT yet correct. It must match Figma exactly: https://www.figma.com/design/3GrNpyBjviaCaSpuqHdr6d?node-id=2-2 (checkbox under Casement window above Delete opening; Delete opening normal size; info text beside Delete opening when ⓘ pressed; nothing else changed).

## Nightly continuity record – 2026-11-20

### Date and stopping point

20 November 2026, recorded by the GitHub Actions workflow `nightly-continuity.yml` (run 44691577429). The current stopping point visible in the repository is as follows.

Live `approved` HEAD when this run read the branch is `cb3ef08291daae64aed3eb720e9736e5d2f34170` ("Merge pull request #2 from ProjectCheck-Raffers/continuity-rules", 19 November 2026 21:38 Europe/London). The last non-continuity commit on `approved` within the fetched history is `cb3ef08291daae64aed3eb720e9736e5d2f34170` ("Merge pull request #2 from ProjectCheck-Raffers/continuity-rules", 19 November 2026 21:38 Europe/London).

Commits on `approved` in the 24 hours before this run:

- `cb3ef08291daae64aed3eb720e9736e5d2f34170` ("Merge pull request #2 from ProjectCheck-Raffers/continuity-rules", ProjectCheck-Raffers)
- `89589a7ddeac5a4365eabdb3f563742b15428fd2` ("CLAUDE.md rules, continuity index, nightly record (00:05 London, no AI)", ProjectCheck-Raffers)
- `e04911013f5d991c5e5083cef8a55a795db79368` ("Add 1-minute quick check on PRs and manual-only Playwright", ProjectCheck-Raffers)
- `433dc8a4ad34b3dff3c066ba8fde0e7b5d1c7783` ("Project Check app, from private approved d173217", ProjectCheck-Raffers)

Pull requests closed or merged in the same 24 hours:

- PR #2, "CLAUDE.md rules, continuity index and nightly record": merged (merge commit `cb3ef08291daae64aed3eb720e9736e5d2f34170`) at 2026-11-19T21:38:10Z.

This run has no access to private chats, so any Project Check work outside GitHub cannot be determined from the repository.

### Live-verified approved HEAD

`cb3ef08291daae64aed3eb720e9736e5d2f34170` on `approved` ("Merge pull request #2 from ProjectCheck-Raffers/continuity-rules", 19 November 2026 21:38 Europe/London), read live from GitHub immediately before this entry was written.

### Open PRs

Read live: 1 open PR(s); none touched by this record. Check-run results were not read by this run.

PR #1, "Compact bottom bar; fire-exit toggle in Add an opening panel", head `review` (`2d7c454f1bdf89f35101b2f6ea1c72f4ffcfa53f`), base `approved` (`e04911013f5d991c5e5083cef8a55a795db79368`); created 19 November 2026 17:32 Europe/London, last updated 20 November 2026 00:45 Europe/London; open, not draft, unmerged; not touched.

### Unresolved blockers

Carried forward unchanged from the previous nightly record and not re-checked by this automated run:

- None recorded in the previous nightly record.

### Note

This is an automated GitHub-state record, not a full transcript. It was generated without an AI model and has no access to private chats. It changes only this file.

## 19 Nov 2026 – handover from Grok to Claude (recorded 20 Nov 2026 by Claude)

- Repo move: app code moved from ProjectCheck-Raffers/Project-Check-MVP-Master-Build (now the private archive) to ProjectCheck-Raffers/project-check-app. Vercel project project-check-app now builds from this repo. Review link: https://project-check-app-git-review-project-check.vercel.app
- PR #2 merged by Grok on Stuart's instruction (cb3ef08): CLAUDE.md standing rules (including the "tweak" and "creative" rules), this append-only index, and the nightly continuity workflow (00:05 London, no AI).
- Old repo: nightly continuity workflow disabled; old PR #95 (deletes that workflow file) and old PR #94 (move internal docs out of the publicly served app folder) still open, not merged.
- PR #1 (review -> approved), fire-exit toggle in the Add an opening panel plus a compact bottom bar, took about 2.5 hours to go wrong. Grok changed things that weren't asked for: in f1729c6 it moved the checkbox below Delete opening, and Delete opening stretched into a large red pill or circle because the ⓘ text shared its grid row.
- PR #1 fix: 2d7c454 on review (from Claude's patch). Checkbox under Casement window and above Delete opening; Delete opening keeps its original size (align-self:start); ⓘ text beside Delete on laptop and phone (below it only at 390px or narrower, where the panel has one column). Not merged; awaiting Stuart's check.
- Target design: Figma https://www.figma.com/design/3GrNpyBjviaCaSpuqHdr6d?node-id=2-2 (node 1:2 = ⓘ closed, node 2:2 = ⓘ open).
- Still open for Stuart's yes: possible iPhone Safari issue (checkbox text disappearing when ticked) now that the panel redraws on tick; gitleaks allowlist for the publishable Supabase key in platform-config.js (Quick check fails without it).
- Access: Claude GitHub App now has access to project-check-app (added 20 Nov 2026).
