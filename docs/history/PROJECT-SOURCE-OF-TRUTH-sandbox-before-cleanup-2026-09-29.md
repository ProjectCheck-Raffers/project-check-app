> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

HISTORICAL ARCHIVE — NOT AN ACTIVE INSTRUCTION OR EXECUTION AUTHORITY

# PROJECT CHECK — SOURCE OF TRUTH

Status: ACTIVE technical entry point on approved
Effective date: 22 September 2026
Latest inspection / continuity update: 23 September 2026, Chat 005 — scoped drawer/scanner candidate (section 12)
Permanent ChatGPT Project: PROJECT CHECK — CORE DEVELOPMENT
Owner and final approval authority: Stuart Rathbone

## 1. Authority and scope
Read this file first for future Project Check technical work. Stuart's latest explicit instruction defines the authorised task and overrides conflicting historical material.
This continues Project Check Version 3; it is not a new product, architecture rewrite or fresh build.
The canonical approved branch is approved, created directly from the exact Version 3 starting commit below.
GitHub's default branch, a newer commit, a successful test or a READY deployment does not independently establish Stuart approval.
Historical master, Version 1/2 specifications, old Projects and handovers cannot override the confirmed Version 3 or later explicit Stuart approvals.

## 2. Permanent recovery checkpoint
Repository: ProjectCheck-Raffers/Project-Check-MVP-Master-Build
Recovery branch: recovery/version-3-approved-2026-09-22
Commit: 9cf08458576aa11377a79cd5a7a585ef1268ff11
Full repository tree: cffedf2051e3650af6129ce29e2c119088a177d2
Application directory: Project-Check-MVP-Master-Build/
Application subtree: 834b8a203de1b921a131b513e882205262ede13e

Stuart personally confirmed this working Version 3 on 22 September 2026 and subsequently approved its recovery protection.
Active GitHub ruleset 23834904 targets only the recovery branch and restricts updates, deletion and force pushes; bypass list is empty.
Leave this reference untouched. A GitHub administrator could change the ruleset; this is enforced branch protection, not an independent offline backup.
Independent full-history Git bundle, isolated restore and off-repository saving: COMPLETE in Chat 005. Bundle SHA-256: 1bf4be1c9030aa3db44cdf298f064896f69e7498f0e13603cabc4cf8b1953877; 78 captured refs, 517 reachable commits. ZIP: Project_Check_Verified_Git_Backup_2026-09-23.zip; SHA-256: 9383e34b33d211ae03dc01d491b14a2b3a4c8deae6f8001532e97a278b6f560a. All restored refs and baseline/application trees matched; Git integrity passed. Scope excludes live Supabase, settings, issues, release attachments and local uncommitted work.

## 3. Approved application versus administrative HEAD
Latest Stuart-approved APPLICATION checkpoint: 9cf08458576aa11377a79cd5a7a585ef1268ff11.
approved was created at exactly that commit.
Stuart authorised documentation-only foundation commits on approved. Such commits may advance its administrative HEAD without changing the approved application.
Resolve approved's live HEAD from GitHub and report its exact SHA; do not assume this file can contain the hash of the commit that creates itself.
Future explicit Stuart-approved application work may advance the latest approved application state. The permanent recovery checkpoint stays fixed.

## 4. Verified Version 3 architecture
Static HTML/CSS/JavaScript single-page application with hash routing and ordered global scripts.
- index.html: shared shell and dependency load order.
- app.js: customer pages, account/project flows, stages and state.
- styles.css plus direction-c-trial.css / direction-c-trial.js: active presentation dependencies.
- site-layout.js: building placement, map rotation and site boundaries.
- geometry.js / drawing.js: structured geometry and preliminary SVG drawings.
- evidence.js and brain/stage-1/: evidence processing and Stage 1 rules.
- platform.js / platform-config.js: configured Supabase authentication, profiles, projects, events and document storage.
- Browser localStorage remains in use alongside Supabase.
- tests/playwright/: committed browser tests.

Configured Supabase test project reference: [Supabase project ref redacted].
Live Supabase schema/policy/data recovery completeness: UNKNOWN in this foundation stage.
External dependencies include MapLibre, jsPDF, Supabase JS and Google Fonts; PDF.js is committed locally.
Historical filenames, including direction-c-trial files and projectcheck_master_v1 storage keys, are not deletion instructions.
Preserve current assets from the approved application. Do not re-source them from a moving master branch.

## 5. Branch and deployment roles during transition
- approved: canonical approved source, with this authorised administrative foundation.
- recovery/version-3-approved-2026-09-22: frozen recovery only; never develop here.
- sandbox: one active testing candidate at a time; testing is not application approval.
- test/page-review: existing candidate line, not automatically approved.
- master / archive/old-working / trial and other historical branches: historical, not current authority.
Stuart approved the GitHub default/workflow/testing-role transition in Chat 005. The intended default is approved; verify the live setting and final handover. Production remains separately controlled.
Work starts on work/<task> from live approved. Publish the exact candidate SHA to sandbox through an authorised fast-forward. Record tests, application tree and preview. Stuart must explicitly approve that exact application candidate before approved advances to the same SHA. Do not squash, rebase, force-push or create a different merge commit after approval. If approved moved or ancestry prevents fast-forward, integrate forward into a new candidate, retest and obtain its approval. Never rewrite sandbox to remove a rejected candidate: correct forward. Administrative work explicitly approved in this conversation is not permission for future application changes.
Protection for approved established 23 September 2026: active ruleset 23878053 blocks deletion and force pushes, with no bypass actors. Normal authorised forward updates remain possible. Sandbox protection remains unestablished.

Verified during the preceding inspection:
Vercel team: [Vercel team ID redacted]
Vercel project: [Vercel project ID redacted] (project-check-mvp-master-build)
Version 3 preview deployment: dpl_2Pv9oxRd9Hyny3cV4s2etUremRRy
Source: sandbox at 9cf08458576aa11377a79cd5a7a585ef1268ff11
Preview: https://project-check-mvp-master-build-git-sandbox-project-check.vercel.app/
The main alias project-check-mvp-master-build.vercel.app was verified serving older commit 56f04d68a1d50ba30521e7e87e1af2f1b50e04c8, deployment dpl_GXHdfAnBS8APo4NaEGXSuPXBzqSY.
These are dated observations, not permission to deploy or guarantees that moving aliases never change.
Updated 23 September 2026: production branch tracking is trial/direction-c-complete-working-model; framework Other; root Project-Check-MVP-Master-Build; build/output/install/development overrides off; ignored build step Automatic; no deploy hooks. See section 10.
No approved-branch deployment is established as an approved customer environment by this foundation.

## 6. Supersession register
The following authority claims and operating directions are SUPERSEDED. Preserve useful technical/history evidence; do not execute old instructions merely because their file says current, master, locked or authoritative.
- Previous AGENTS.md and Copilot instructions: archived under docs/historical/; superseded by current entry points.
- PLATFORM-SETUP.md: historical Pages/trial setup, not the current source/deployment authority.
- TEST-PLATFORM-GOVERNANCE.md: historical review route and master-asset authority.
- TRIAL-DIRECTION-C.md: historical trial instructions; its named runtime files remain active.
- Project-Check-MVP-Master-Build/workflows/PROJECT-CHECK-PROMOTION-GATES.md: previous promotion route, not permission to bypass approved or initiate deployments.
- Application EVIDENCE-INTELLIGENCE-SPEC.md: technical reference; its claim that MASTER-SPEC.md controls current architecture is superseded. It does not authorise implementing future features.
- Application SECURITY.md, security-readiness.md, pentest-handover.md and AZURE-DEPLOYMENT.md: historical architecture/environment claims are not current authority. Retain relevant security findings for evidence-based review; do not discard them wholesale.
- TEST-MAP.md: reference only; stale links and historical test claims are not current verification.
- On historical master: CURRENT-STATE.md, PROJECT-CHECK-CURRENT.md, MASTER-SPEC.md, README-DEVELOPER.md, GOVERNANCE-INDEX.md, DEVELOPER-RULES.md, ARCHITECTURE-MAP.md, CODE-MAP.md, DECISION-LOG.md and START-HERE.txt cannot direct current development.
- test/page-review:docs/Project_Check_Current_State.md: the full-build deletion direction is superseded by Stuart's later explicit Version 3 preservation and Option B instructions.
- Architect MCP prompts, Windows checkout paths, devcontainer labels and old workflow instructions are not independent task authority. Their configuration/runtime is unchanged pending dependency review.

Files inside the application directory and other branches are deliberately unmodified. This register explicitly supersedes their conflicting authority claims without altering the recovery or application tree.

## 7. Current authorisation boundary
Stuart explicitly approved and instructed execution of the Chat 005 GitHub transition: minimum instructions/workflow updates, disabling confirmed obsolete Pages/Runner Bridge workflows, preserving protection while changing the default to approved, and establishing sandbox testing with exact-SHA application approval.
Do not delete historical branches/documents, merge obsolete code, discard uncommitted work, weaken protection, change customer application code or Supabase, or change Vercel production branch/settings/aliases.
Automatic Preview deployments can follow authorised Git updates. No manual deployment or production promotion is authorised.
The process requirement for Stuart approval is not a technical GitHub human-approval gate: ordinary authorised forward writes remain possible. Do not claim otherwise. Existing required-status settings are not expanded until checks are proven and a compatible enforcement design is approved.

## 8. Verification and continuity
Compare complete Git trees and blob hashes against the permanent recovery checkpoint.
The entire application subtree must remain 834b8a203de1b921a131b513e882205262ede13e for this administrative stage.
The customer application remains byte-identical. Root workflows and instruction documents may change under this administrative transition. CI browser jobs replace platform-config.js only in the disposable runner checkout with an empty configuration to isolate local-data tests from live Supabase; the committed application is untouched. Such tests do not verify hosted authentication or database policies. Byte identity is not a fresh end-to-end runtime test claim.
Record the final administrative SHA and verification in the completion report.

Carry forward both technical and decision continuity:
chat/date; latest approved application and administrative commits; verified deployment; starting state; changes/files; tests/evidence; Stuart approvals; built-but-unapproved versus proposed work; failures and unknowns; decisions and reasons; rejected approaches; exact stopping point and next agreed task; superseded information.
Reason for this foundation: repeated obsolete authority and competing routes caused loss of continuity. Do not restart patch-by-patch cleanup, deletion, old governance or application redesign.
Recovered historical confidence statement: "CEO HAS NO FAITH IN HIS ARCHITECT AGAIN." Preserve as dated history, not a new instruction.
Use new chronological chats within the permanent Project, not replacement Projects.

## 9. Previous stopping point — superseded by section 10
The 22 September foundation stopped after the documentation commit with unchanged application and recovery reference. Chat 004 continued with authorised protection/recovery work and dependency inspection. The later default-branch, workflow and production transition remains proposed only.


## 10. Historical Chat 004 — superseded status; retained decision evidence
Date: 23 September 2026. Permanent Project: PROJECT CHECK — CORE DEVELOPMENT.

### Starting state and authority
Stuart explicitly instructed Execute against the protection/recovery instruction prepared in Chat 004.
Starting approved administrative HEAD: 72b7a5e4ba1b8b51c208eb236483e5cdfaf1d786.
Application approval remains 9cf08458576aa11377a79cd5a7a585ef1268ff11.
Before work, approved, sandbox and the frozen recovery branch matched their recorded commits.
The complete source-of-truth document was read; the earlier audit was not restarted.

### Protection — COMPLETED AND VERIFIED
After Stuart approved the GitHub Mobile authentication request, GitHub created ruleset 23878053, "Approved Version 3 - preserve history", at 13:11 BST on 23 September 2026.
Live API verification confirmed:
- Enforcement active; target exactly refs/heads/approved.
- Rules deletion and non_fast_forward; no bypass actors.
- No update freeze: normal forward updates by existing authorised writers remain possible.
- No new PR, status-check or deployment requirements; these await the separate transition.
The earlier re-authentication blocker is resolved. No additional ruleset should be created.
This protects history; it is not a technical CEO-approval gate for ordinary writes.
Frozen recovery ruleset 23834904 remains separate and unchanged.
The interim handover documenting blockers was commit cbbb1e7874a90392b66bd2d1904e2b3edb964497; its automatic preview dpl_2g7U2qbUzJLqFXgGp9sd45Mddb6Q was READY. This follow-up changes only this document to record successful protection.

### Independent backup — BLOCKED, not completed
Command-line Git could not authenticate to the private repository:
GIT_TERMINAL_PROMPT=0 git ls-remote https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build.git refs/heads/approved
returned exit 128: could not read Username for https://github.com: terminal prompts disabled.
No GH_TOKEN/GITHUB_TOKEN/VERCEL_TOKEN was available; gh and vercel CLIs were absent.
The working GitHub connector and authenticated browser do not establish authenticated command-line Git access.
No independent full-history Git bundle was created or durably saved; no isolated restore test was performed.
Required continuation: obtain an authorised authenticated Git transport or use an existing authorised full-history checkout, create an independent bundle, save it durably, restore into an isolated directory, run Git integrity checks and compare the exact baseline commit, repository tree and application subtree. A source ZIP alone does not satisfy this requirement.
Live Supabase data/storage recovery remains separately UNKNOWN.

### Newly verified deployment dependencies — read-only
Vercel project [Vercel project ID redacted], team [Vercel team ID redacted]:
- Production environment tracks trial/direction-c-complete-working-model.
- Preview environment tracks all unassigned Git branches.
- Framework preset Other; root directory Project-Check-MVP-Master-Build.
- Build, output, install and development overrides are off.
- Include files outside root enabled; skip unaffected-root deployments enabled.
- Ignored build step Automatic; Node 24.x.
- No deploy hooks; no deployment checks configured.
- The main production alias was separately verified during this chat at 56f04d68a1d50ba30521e7e87e1af2f1b50e04c8, deployment dpl_GXHdfAnBS8APo4NaEGXSuPXBzqSY. Configured branch and currently served deployment are distinct facts.
- Before this documentation update, approved preview dpl_DF75T42JVvgxbv5Kea5XXguQSW4T was READY at 72b7a5e4ba1b8b51c208eb236483e5cdfaf1d786, alias https://project-check-mvp-master-build-git-approved-project-check.vercel.app/.
- Sandbox preview remains the previously verified Version 3 review URL in section 5.
A documentation push may automatically create a preview. Check the resulting commit/deployment after the write; do not manually trigger or promote one.

GitHub:
- Pages settings explicitly show the site published at https://projectcheck-raffers.github.io/Project-Check-MVP-Master-Build/, source GitHub Actions, last deployment 15 September 2026, run 34974902488.
- Both Deploy GitHub Pages and Project Check — Runner Bridge offer Disable workflow, confirming they are enabled.
- Runner STUPC1, labels self-hosted/Windows/X64, is registered and Offline.
- Runner Bridge relies on the default-branch workflow and a Windows checkout of the old trial branch; its exact owner/comment trigger remains in the existing workflow. No trigger was sent.
- Active ruleset 21145053 targets ~DEFAULT_BRANCH and applies deletion protection, force-push blocking and automatic Copilot review. It will follow a future default-branch change; it is not a required human approval or required CI gate.
- Existing approved-branch CI/CodeQL/secrets/device workflows still filter automatic events to master.
- Pages writes test-platform/review-archive; it is a separate publishing route, not proof of canonical approval.

### Concrete transition proposal — NOT AUTHORISED FOR EXECUTION
1. Finish approved protection and verified independent recovery first.
2. Define candidate work branches from current approved; use sandbox for explicit test candidates only after the role transition is approved. Preserve the frozen recovery reference.
3. Align CI, secrets, CodeQL and relevant Playwright workflows to approved PRs and agreed test branches; correct the stale Profile expectation. Prove selected checks pass before making them required.
4. Inspect open PR bases and account for ruleset 21145053 following ~DEFAULT_BRANCH; then change GitHub default master to approved only on Stuart's explicit instruction. Do not merge historical master.
5. Disable the obsolete Pages and Runner workflows only after dependencies are accepted. Separately decide whether to unpublish the old Pages site and retire runner registration; disabling a workflow alone does not unpublish a site.
6. Leave Vercel production branch and aliases unchanged until a separate explicit production decision identifies the exact approved release and verification/rollback plan. A GitHub default change is not a production release.

### Continuity and exact stopping point
Only PROJECT-SOURCE-OF-TRUTH.md is authorised for repository modification in this execution. No application, assets, tests, workflows, Supabase, default branch or Vercel settings were changed.
Approved protection is complete and API-verified. The independent backup/restore remains blocked by missing authenticated Git transport; browser authentication does not provide a command-line Git credential.
Verification: starting refs and recovery ruleset checked; application subtree checked against 834b8a203de1b921a131b513e882205262ede13e; live settings inspected. No fresh customer-journey tests claimed.
Reason for this work: preserve Version 3 and prevent old entry points from regaining authority. Rejected approaches remain deletion, rebuilding, merging obsolete branches and treating READY/default/master as approval.
Next agreed task: complete the already authorised independent backup and isolated restore once authenticated Git transport is available. The wider transition above still requires Stuart's approval.
Resolve final administrative HEAD from GitHub; report its full SHA, exact one-file diff and automatic deployment outcome in the completion response. Do not infer an additional application approval from this documentation commit.


## 11. Chat 005 — authorised transition
Stuart approved the complete scoped GitHub transition and instructed Execute. This section supersedes Chat 004 restrictions/status for those authorised administrative actions only.

Starting approved HEAD: d69715034bec2fad77ff4a07aeb04e05ce2bd7cc. Starting sandbox and recovery: 9cf08458576aa11377a79cd5a7a585ef1268ff11. Starting default master: ed7e992b78901869c35d9cb6dfeb1313f4129d6b.
Backup/export/restore completed; the earlier browser timeout was a missed completion notification, not failed transfer. Checksums verified on the downloaded bytes and independent saving confirmed.

Changes: CI, CodeQL, secrets and device workflows target approved/sandbox pull requests and approved/sandbox/work/** pushes. Targeted Profile tests exercise current desktop/mobile drawer navigation, account details, edit/cancel and return to My Projects; they no longer expect project identity in Profile. Existing full-suite checks remain enabled, with failures reported rather than silently waived. No new required-status gate is claimed.

Deploy GitHub Pages and Project Check — Runner Bridge were disabled using workflow settings. Historical workflow source is retained. Existing Pages publication, review archive and runner registration remain; disabling future runs does not remove old published content or prove all independent processes stopped. No runner command, issue comment or temporary access link was created.

Default-branch ruleset 21145053 is to retain explicit master coverage alongside ~DEFAULT_BRANCH so protection is not lost when the default moves. Ruleset 23878053 for approved and frozen-recovery ruleset 23834904 remain intact, without bypass changes. Verify persisted settings and final refs in the completion handover.

Open historical PRs #45, #41 and #15 target master; #6 targets security-mobile-hardening. Do not retarget or merge automatically.
Vercel production branch was reverified as trial/direction-c-complete-working-model; Preview tracks all unassigned branches. No repository webhooks were listed. No Vercel/Supabase settings change is authorised.

Rollback: stop promotions if verification fails. Revert faulty administrative files through a new forward commit, never reset approved/sandbox/recovery. Restore the prior default or workflow enablement only under a specific rollback instruction; do not silently revive obsolete publishing. Keep explicit historical-master protection. Production rollback is a separate decision.

Final administrative SHA, CI results, default setting, workflow states and preview outcome must be recorded in the external Chat 005 completion handover after execution; this commit cannot embed its own SHA. Unresolved full-suite failures do not authorise modifying the approved application.


## 12. Chat 005 — authorised drawer/scanner candidate; approval pending
Stuart instructed Execute for the scoped follow-up: investigate the eight hidden-focusable HTML findings, make the minimal drawer correction, verify the eleven scanner findings, apply only exact exceptions for confirmed public configuration, test the candidate and fast-forward sandbox. This supersedes the administrative-only restriction solely for these changes. It does not authorise updating approved, production, Supabase, recovery, historical snapshots or runner registration.

Starting approved and sandbox: cd966a535b26fdbab8169c3936f1d2dfe6fafd08. The approved application remains the Version 3 subtree recorded in section 2. Work branch: work/drawer-accessibility-scan-review, created directly from that approved HEAD.

The eight HTML findings are the eight controls inside the initially aria-hidden site drawer in the current application index.html. Existing CSS already hides the closed drawer; a runtime keyboard leak has not been demonstrated. The correction adds inert to the closed drawer and toggles it with the existing open/close state, preserving design and navigation. Targeted tests cover closed keyboard exclusion, opening, Escape, close button, backdrop, focus return and route selection at desktop/mobile widths. Existing Profile checks remain; no broad legacy tests are removed or waived.

The eleven historical generic-api-key findings resolve to two repeated sb_publishable_ configuration values, not service-role/secret keys. The older shorter value's operational validity is UNKNOWN. .gitleaksignore lists only the exact commit:path:rule:line fingerprints; it does not exclude entire files, paths or public-key patterns. Live Supabase RLS correctness is not established. No credential rotation or history rewrite is authorised.

Prior full-suite runs reached the twenty-minute cancellation limit. Inspection found obsolete homepage, pricing, sign-in and journey selectors/expectations. This is not proof that every failure is stale or that the complete application passes. Broader test reconciliation is separate work.

Read-only Pages inspection still shows the public site published from GitHub Actions, last deployment 15 September 2026 (run 34974902488), without a custom domain. Disabling its workflow did not unpublish it. Recommendation: separately approve unpublishing that obsolete route after confirming no required live references, while retaining the repository archive and independent backup. No unpublish action was taken.

Stop after testing the exact candidate on sandbox. Record final candidate SHA, tree, checks and preview in the external continuity handover; Stuart must approve that exact SHA before approved advances. Keep recovery and Vercel production unchanged. The prior backup/restore is complete and must not be described as outstanding. A failed local browser download is a local verification limitation; report actual GitHub-run evidence separately.

## 13. Chat 005 — consolidated stabilisation candidate
Stuart approved execution of the consolidated stabilisation package after the read-only readiness assessment. Continue forward from Sandbox candidate d1c84c885136fc67ca531abc9c9c0e9a3ba07959 on the existing work branch; test one exact final candidate, fast-forward Sandbox and STOP before approved/production promotion.
Scope: retained customer-route navigation without adding old journey entry links; immediate geometry/layout confirmation invalidation after relevant edits while preserving same-site placement and boundaries; meaningful reactivation of geometry tests through supported forms; current-page accessibility/journey coverage; clearly labelled project-setup progress rather than assessment completion. Keep substantive assertions. No historical deletion, Supabase change, production mapping change or repeat backup work.
The existing hosted-auth/storage/customer-isolation and external-map-service release gates remain separate from local-data CI. A passing local suite is not production readiness. Record final exact SHA, completed tests, unresolved issues and preview in the existing external handover.


## 14. Chat 005 — authorised interactive Doors & Openings candidate
Stuart instructed Execute after approving the proposed linked satellite orientation, four dimensioned elevations, customer opening positioning and roof plan. Continue forward from Sandbox candidate 3d118311317978c2c3080a37cc8fc2f9ffd76d3c on the existing candidate work branch; this is not promotion approval for that candidate. Scope includes current-journey integration, cardinal orientation calculated from saved geometry, outside-view corner mapping, touch/precise opening placement, validation, persistence and tests. Preserve the approved application/recovery references and production settings. Test the exact final candidate, fast-forward Sandbox and record results in the existing external continuity handover. Do not introduce compliance claims or infer clear-height/eaves equivalence as verified engineering.
