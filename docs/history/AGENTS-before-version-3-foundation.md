> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

> SUPERSEDED — historical evidence only, 22 September 2026. Read ../../PROJECT-SOURCE-OF-TRUTH.md first. The original text below is preserved verbatim and must not be followed as current instructions.

# Project Check — Codex Execution Rules

These rules apply to all Codex work in this repository.

## 1. Task boundary
- Stuart's latest explicit instruction defines the task boundary.
- Make the smallest change necessary to satisfy that instruction.
- Do not broaden scope without an explicit instruction from Stuart.
- Do not redesign infrastructure, workflows, deployment, architecture, UI, content, assets, or adjacent files unless the task explicitly requires it.

## 2. Sole source of truth
- The sole authority for Project Check master brand/homepage assets is the CURRENT HEAD of `master` under `Project-Check-MVP-Master-Build/masterfile/`.
- `masterfile/review-staging/` is candidate-only and is NEVER authoritative.
- Application `assets/` files, trial branches, live runtime files, historical commits, screenshots, chats, external design tools, generated images, and cached copies are implementation/reference material only. They MUST NOT override the current GitHub MASTERFILE.
- Never select an asset because an old commit message says "approved" if current MASTERFILE says otherwise.
- Use exact master bytes. Never regenerate, reinterpret, redraw, recolour, crop, approximate, or substitute an approved master asset.

## 3. Asset identity — never cross-copy
- `masterfile/project-check-logo.png` is the logo authority.
- `masterfile/front-page/project-check-banner-logo.png` is the banner-logo authority.
- `masterfile/journey-logos/project-check-icon-*.png` are the journey-icon authorities.
- Logo, banner and journey icons are separate asset identities. NEVER copy logo bytes into the banner path, banner bytes into the logo path, or one journey icon over another unless Stuart explicitly approves that exact master change.
- Before applying a master asset, identify its exact master path and compare the source blob/hash to the intended destination after copying.

## 4. Application mappings
- Complete Project Check logo -> `assets/project-check-logo.png`.
- Shared header on every website page -> `assets/project-check-banner-logo.png`, copied byte-for-byte from `masterfile/front-page/project-check-banner-logo.png`.
- Journey icons -> only their matching `assets/project-check-icon-*.png` destination.
- `assets/figma-hero-symbol.png` and any other unlisted logo-like application asset are legacy/unmapped implementation files, NEVER authority. Do not select, copy, promote, or use them for a logo/banner task unless Stuart explicitly names that exact file.
- Do not create new variant files to solve a simple replacement task.

## 5. Execution behaviour
- Inspect only what is necessary to execute the requested task.
- Execute the requested change, then verify it, then return the requested result.
- Do not stop after a commit if the requested deliverable is a live page, review URL, rendered output, or other end result.
- Do not return progress updates unless Stuart asks for them.
- Do not create unrelated fixes for issues discovered during execution.

## 6. Anti-loop rule
- If a requested item has already passed verification against the CURRENT MASTERFILE, do not re-investigate or re-engineer it. Continue toward the requested deliverable.
- After one failed execution attempt, diagnose the exact failure and correct only that failure.
- After two failed attempts at the same stage, stop changing architecture or orchestration. Return to the last verified working method or report the exact blocker.
- Do not repeatedly rewrite the same workflow, launcher, deployment mechanism, tunnel logic, server logic, or infrastructure while the requested deliverable remains unfinished.
- If you are about to make a third infrastructure/workflow change for the same task, STOP. Use the last verified working state and take the shortest remaining path to completion.

## 7. Change discipline
- Do not modify unrelated files.
- Do not change wording, layout, CSS, navigation, banners, journey icons, deployment, or infrastructure during an isolated asset replacement unless explicitly requested.
- Do not create extra operational commits merely to try another implementation of the same solution.
- Verification against an arbitrary historical source is NOT completion.

## 8. Live review completion rule
When Stuart requests a live review URL, the task is not complete until all of the following are true:
1. The requested change is present in the actual served working copy.
2. The served logo/banner/icon bytes match the corresponding CURRENT MASTERFILE asset.
3. The local page returns HTTP 200.
4. The public review page returns HTTP 200.
5. The requested change is verified on the public page.
6. The working public URL is returned to Stuart.

If an existing working review tunnel can be reused, reuse it. Do not create or redesign a tunnel unless the existing one is genuinely unavailable.

## 9. Failure response
If blocked, do not invent another architecture. Return only the exact blocker needed to proceed, including the exact failed command/action, exact error, and smallest corrective action.

## 10. Default operating sequence
EXECUTE -> VERIFY AGAINST CURRENT MASTERFILE -> RETURN RESULT.

Never use this pattern:
INVESTIGATE -> REDESIGN -> COMMIT -> REDESIGN -> COMMIT -> REPEAT.


## Page Review isolation and approval

- Implement approved review work only on `sandbox/page-review`.
- GitHub is the code source of truth and approved Figma frames are the visual source of truth.
- Use the existing GitHub-to-Vercel Preview route; do not create another repository, branch, Codespace, Vercel project, runner or review platform.
- Record the exact rollback commit before substantial changes.
- A successful preview is not production approval. Stop for Stuart's Page Review decision before any merge or promotion.
