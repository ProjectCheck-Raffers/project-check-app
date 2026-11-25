> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

# Project Check - Active Control

**Effective date:** 22 September 2026  
**Owner and final approval authority:** Stuart Rathbone  
**Purpose:** the active governance and current-work control for Project Check.

## 1. Authority

- Stuart Rathbone is CEO and final approval authority.
- **Architect authority revoked by Stuart Rathbone on 22 September 2026.** ChatGPT/Codex has no standing authority to act as Project Check Architect or make architectural, application, infrastructure, deployment, cleanup or deletion decisions. It may act only on Stuart's explicit instruction within the exact task boundary he gives.
- Historical chats, old ledgers, recovery packs and old Figma material are reference-only unless Stuart specifically asks for a named fact, asset or behaviour to be recovered.
- Production remains locked and out of scope unless Stuart gives an explicit production instruction.

## 2. Startup source for future Project Check work

Repository operating instructions now require the complete canonical current-state file to be read before advising, designing, changing or executing Project Check work.

Canonical source:
`docs/Project_Check_Current_State.md`

The older ChatGPT/File Library copy is historical/reference-only and must not override this GitHub canonical source.

## 3. Current branch architecture — verified 22 September 2026

GitHub repository: `ProjectCheck-Raffers/Project-Check-MVP-Master-Build`

Current controlled workflow:

`test/page-review` → Stuart review/approval → `sandbox`

Current branches:
- Review/development branch: `test/page-review`
- Approved application baseline on `test/page-review` before this canonical-control file was added: `30e7353f657d7e24c596abefb6ab2effe4346cd4`
- The canonical current-state documentation and repository startup instruction are committed above that application baseline; use the live Git ref when an exact current branch HEAD is required.
- Approved clean branch: `sandbox`
- Current `sandbox` HEAD: `9cf08458576aa11377a79cd5a7a585ef1268ff11`
- Archived old working branch: `archive/old-working`
- Current `archive/old-working` HEAD: `ed7e992b78901869c35d9cb6dfeb1313f4129d6b`

The former branch names are no longer current:
- `sandbox/page-review` was renamed to `test/page-review`.
- `sandbox/working` was renamed to `archive/old-working`.

Any dated historical entry below or in archived Project Check material that mentions `sandbox/page-review` or `sandbox/working` describes the branch name that existed at that time. It must not be read as the current route.

Do not use, merge, reconcile or inspect `archive/old-working` for reuse unless Stuart explicitly instructs it.

## 4. Current Sandbox — verified 22 September 2026

The Sandbox was created from approved candidate:

`30e7353f657d7e24c596abefb6ab2effe4346cd4`

The application candidate passed the agreed promotion gates before Sandbox creation.

Two operational commits now sit above that approved application candidate on `sandbox`:
1. `ac2efb96a601998ae2ce94017ce0f68d3e136cc5` — trigger the existing GitHub → Vercel deployment path.
2. `9cf08458576aa11377a79cd5a7a585ef1268ff11` — correct the current promotion-route document.

Comparison against the approved candidate confirmed that only:
- `Project-Check-MVP-Master-Build/.vercel-deployment-trigger`
- `Project-Check-MVP-Master-Build/workflows/PROJECT-CHECK-PROMOTION-GATES.md`

changed above the approved application candidate. The customer application files were not changed by the Sandbox promotion.

Current Vercel Sandbox:
- Team: `[Vercel team ID redacted]`
- Project: `project-check-mvp-master-build`
- Project ID: `[Vercel project ID redacted]`
- Deployment: `dpl_2Pv9oxRd9Hyny3cV4s2etUremRRy`
- State: `READY`
- Git branch: `sandbox`
- Git commit: `9cf08458576aa11377a79cd5a7a585ef1268ff11`
- Stable Sandbox branch alias: `https://project-check-mvp-master-build-git-sandbox-project-check.vercel.app/`

The normal Sandbox Preview is protected by Vercel authentication. Temporary external share links are access mechanisms only and are not the permanent Sandbox route.

## 5. Vercel promotion behaviour now proven

Creating the `sandbox` branch at an already-existing approved SHA did not by itself create a new Vercel Preview deployment.

The repository already contained:
`Project-Check-MVP-Master-Build/.vercel-deployment-trigger`

Updating only that operational file on `sandbox` created the required Git push event and the existing GitHub → Vercel integration then created the Sandbox Preview normally.

This is the proven promotion fallback when a new branch is created at a commit Vercel has already seen. It does not require:
- a new Vercel project;
- a deploy hook;
- a new runner;
- a replacement deployment route;
- a new Supabase project;
- a temporary infrastructure path;
- an application-content commit purely to wake Vercel.

The current promotion document in the repository now records the route:
`test/page-review` → `sandbox`.

## 6. Supabase / security current state

Existing environment: `Project Check Test Platform`  
Project ref: `[Supabase project ref redacted]`

Current verified promotion-security baseline:
- Project/document/customer RLS isolation remains enforced.
- Two-account isolation checks returned zero foreign projects, documents and storage objects.
- `project-documents` remains private.
- Current file size limit: 26,214,400 bytes.
- Current permitted types: PDF, DOCX, PNG, JPEG and DWG.
- Reusable public test-account shortcut was removed before promotion.
- Public execution of the identified SECURITY DEFINER helper functions was removed/restricted.
- Remaining advisor items: [security detail redacted – kept in the private archive].

No new Supabase project or replacement test platform is authorised.

## 7. Current product/design state that remains in force

- Product: **Project Check**
- Tagline: **Know before you build.**
- CEO Master Figma file: `X9PwTBqmNH2y5Ewe0cWLn4`
- Complete editable mobile Homepage: frame `63:40`
- Guided-route Pricing body: frame `40:30`
- Approved Stage 1 workspace desktop/mobile sources remain established.
- Approved shared site navigation is the burger/drawer model.
- Signed-out drawer remains:
  - Home
  - Pricing
  - Sign in
  - Create account
- Existing DWG acceptance remains part of the test platform.
- Device requirement remains: the same journey must work appropriately on phones, tablets and PCs.
- Watch requirement remains deferred: a watch notification should hand off to the exact relevant phone page; a full watch application is not required.

## 8. Current customer-journey defect discovered after Sandbox review

The promoted Sandbox does **not** currently contain the later approved signed-in burger customer-journey states.

The current signed-in drawer still exposes the ordinary account/navigation items but is missing the approved project-journey section where:
- completed steps are visibly completed/ticked and can be reopened;
- the current step is green/active;
- future steps are faded/greyed and unavailable;
- state is driven by the project's real saved progress.

This is an application omission, not a Sandbox/Vercel/Supabase failure.

The correction belongs first on:
`test/page-review`

It must be reviewed before promotion to:
`sandbox`

Do not claim this burger-journey correction is implemented until it has actually been committed, deployed and reviewed.

## 9. Current Stage 1 boundary

By the end of the established Stage 1 intake, Project Check already holds:
- building specification;
- dimensions;
- location;
- mapped proposed building position in situ;
- site/boundary borders.

Do not rewind to re-collect or re-review those established inputs when continuing the journey.

The next future development area after the current journey/navigation correction remains generated building geometry / Doors & Openings, including four elevations and plan, customer-controlled openings and structured geometry. That work is not automatically authorised by this state update.

## 10. Previous stopping point — superseded for current work

This section preserves the immediately previous Scope A stopping point for traceability. It is superseded for current work by Section 13 below.

No application, Sandbox, Supabase, Vercel production or production-branch change was authorised by that earlier handover.

The burger/customer-journey correction remains unimplemented.

Stuart selected **Scope A** for the stale-system problem: remove obsolete/stale Project Check branches, governance, runners and routes while preserving the current application, current Sandbox, current review branch, current Vercel project and current Supabase Test Platform.

The work stopped during a read-only architecture/control-plane audit before any cleanup deletion was executed.

Verified current facts at this stopping point:
- `test/page-review` HEAD is `0f747bdd6d58766fcba6139fdcd4290077e118a4`.
- `sandbox` HEAD remains `9cf08458576aa11377a79cd5a7a585ef1268ff11`.
- GitHub repository default branch is still `master`.
- `master` points to `ed7e992b78901869c35d9cb6dfeb1313f4129d6b`, the same commit as `archive/old-working`.
- The repository currently has 48 branch refs. Only `test/page-review` and `sandbox` are the intended active development/promotion route; no other branch has yet been deleted.
- Four old pull requests remain open: #6, #15, #41 and #45.
- GitHub Pages remains enabled.
- The Pages workflow still references the obsolete trial/review-archive route.
- Active repository control files still contain stale branch/control references, including Promotion Gates, Test Platform Governance, Copilot instructions, CI/CodeQL/device/secrets workflows, platform setup material and Architect MCP configuration.
- `AGENTS.md` still points master brand/homepage asset authority to old `master`.
- The six brand asset blobs referenced there — main logo, banner logo and four journey icons — were byte-verified to match the corresponding application assets already present on `test/page-review`.
- The current application actively loads `direction-c-trial.css` and `direction-c-trial.js`; despite their historical names, they are current runtime dependencies and must not be blindly deleted.
- The repository still contains an Architect MCP route. Its current implementation runs a separate architect prompt and its nested config contains a hard-coded `C:\\Project-Check\\...` path.
- The devcontainer remains labelled `Project Check — Direction C Trial` and automatically starts the port-5099 preview server.
- `PLATFORM-SETUP.md` still describes the old GitHub Pages/trial route as the live platform.
- The Vercel production-style alias `project-check-mvp-master-build.vercel.app` currently resolves to deployment `dpl_GXHdfAnBS8APo4NaEGXSuPXBzqSY`, whose metadata references the former review branch and commit `56f04d68a1d50ba30521e7e87e1af2f1b50e04c8`.
- The old `git-sandbox-cc55d8` Vercel alias is still live and points to an older review deployment.
- No branch deletion, PR closure, workflow deletion, Pages disablement, Vercel deletion, MCP removal, default-branch change, application-file change or Supabase change has been executed during this cleanup audit.

Reviewed Scope A cleanup approaches considered — **none authorised for execution**:

### Option 1 — Preservation-boundary / whitelist cleanup
- Define the small set Project Check is allowed to keep, prove those dependencies, then remove everything outside that boundary.
- Preserve the current `test/page-review` and `sandbox` route, the genuine current application runtime dependencies (including historically named files that are still actively loaded), the canonical current-state governance, the existing Vercel project, the existing Supabase Test Platform and the verified current application/brand assets.
- Treat the remaining stale estate — old branch refs, old PRs, GitHub Pages, obsolete workflow/control references, the Architect MCP/local `C:\\Project-Check\\...` route, obsolete setup material and stale Vercel aliases/routes — as removal candidates by default rather than presumed dependencies.
- Produce one definitive dependency map: **KEEP / REMOVE / CANNOT REMOVE BECAUSE CURRENTLY USED**.
- After Stuart approval, execute the cleanup as one controlled operation and verify the preserved route.
- The old `master` authority/default-branch problem would be resolved only after proving what still depends on it.

### Option 2 — Architecture-first / control-plane transfer
- Define the intended clean operating architecture first: `test/page-review` → Stuart review/approval → `sandbox`, using the existing Vercel project and Supabase Test Platform, with no obsolete Pages/MCP/local-machine authority.
- Before deleting stale systems, identify any control-plane responsibilities they still carry.
- Audit only the dependencies that could block transferring those responsibilities to the intended architecture: workflows, Vercel Git integration, repository instructions, Codespaces/devcontainer, Pages and references to `master`, old branch names or the Architect MCP path.
- Correct those control-plane dependencies as one bounded migration, then remove the now-disconnected stale estate.
- Verify the preserved application/deployment/data route afterwards.
- Core principle: do not delete stale architecture while it still carries a responsibility the clean route needs.

### Option 3 — Decommissioning manifest — **latest reviewed recommendation**
- Do not redesign or migrate Project Check again. The target architecture is already defined.
- Treat Scope A strictly as a decommissioning exercise.
- Before any deletion, complete one read-only dependency audit answering only: **does anything outside the preserved route still have a live dependency that the preserved route needs?**
- Produce one complete cleanup manifest with three classes: **remove**, **correct stale control reference before removal**, and **preserve because it is a genuine current runtime dependency**.
- Cover the whole stale estate together rather than cleaning it patch-by-patch.
- Do not change the default branch as a preliminary step; resolve it inside the single cleanup boundary only after its live dependencies are proven.
- Do not create another branch structure, runner, deployment route, Vercel project, Supabase project or replacement infrastructure.
- If Stuart later approves the cleanup manifest, execute it as one bounded decommissioning operation and then verify `test/page-review`, `sandbox`, Vercel, Supabase/auth/data isolation and the current application runtime.
- No cleanup execution was authorised in the chat that produced these options.

Unresolved issue:
- Stuart explicitly rejected another patch-by-patch cleanup cycle. The unresolved task remains to establish a complete, proven stale-system removal boundary without damaging the preserved current application/Sandbox route.
- The immediate next action is **not authorised yet**: await Stuart's instruction on whether to proceed with the read-only dependency audit / cleanup manifest.
- Do not resume burger implementation until Stuart explicitly instructs it.

## 11. CEO confidence status

**CEO HAS NO FAITH IN HIS ARCHITECT AGAIN.**

This is a direct CEO status statement and must be carried forward into the next Project Check chat without reinterpretation or softening.

## 12. Historical-reference interpretation

Older Project Check records contain many references to:
- the old `git-sandbox-cc55d8` Vercel alias
- older Preview deployment IDs and immutable URLs.

Those records remain useful as dated implementation history only. They do not override the verified branch architecture in Sections 3–5 of this document.

For current work, use:
- review/development: `test/page-review`
- approved Sandbox: `sandbox`
- archived old working branch: `archive/old-working`
- promotion direction: `test/page-review` → Stuart approval → `sandbox`


## 13. Latest CHANGE CHAT handover — full-build deletion

**Recorded 22 September 2026. This is the current stopping point and supersedes the earlier Scope A preservation-cleanup direction for future work.**

### Authority
- Stuart Rathbone remains CEO and sole final approval authority.
- Stuart explicitly revoked ChatGPT/Codex's Project Check Architect permissions.
- ChatGPT/Codex must not act as Project Check Architect or make independent architectural or preservation decisions.
- Any destructive action requires Stuart's explicit instruction for that action or deletion batch.

### Current task direction
- This Project Check workstream is now about **full deletion across the whole Project Check build**, not preservation of the current build.
- Do not restart the former Scope A preservation cleanup, burger/customer-journey work, architecture redesign, migration or build development unless Stuart explicitly changes direction.
- Previous assumptions that the current application, Sandbox, review branch, Vercel project or Supabase Test Platform must be preserved are no longer the governing objective for this deletion work.
- Historical/current-state material remains useful only to identify what exists and therefore what may need to be removed.

### Agreed read/write deletion approach
1. **READ / INVENTORY FIRST:** establish the complete Project Check deletion inventory across GitHub repository contents and branches, workflows/Actions/Pages/PR control state, Vercel project/deployments/aliases/integration, Supabase project/data/storage/auth/functions/configuration, repository-side MCP/devcontainer/runner/setup routes, governance/setup material and temporary/external access routes.
2. Produce one complete deletion manifest before destructive execution so the whole estate is handled deliberately rather than by guesswork.
3. **WRITE / DELETE:** remove the Project Check application files and control-plane remnants in explicit CEO-authorised batches.
4. Remove Vercel Project Check deployments/aliases/integration/project when explicitly authorised.
5. Remove Supabase Project Check data/storage/auth/functions/configuration/project when explicitly authorised.
6. Remove the GitHub repository last in the GitHub sequence when explicitly authorised, so it remains available to identify and control earlier deletion steps.
7. **VERIFY:** perform a fresh read-only search afterwards and classify any remaining item as **DELETED / DOES NOT EXIST / OUTSIDE AVAILABLE CONTROL**.

### Current stopping point
- No full-build deletion has yet been executed.
- No GitHub branch/file/repository deletion, PR closure, workflow removal, Pages disablement, Vercel deletion, Supabase deletion or other destructive action was executed in the chat that recorded this handover.
- The latest instruction was **CHANGE CHAT**.
- The next chat must read this file completely from `test/page-review`, treat it as the single current source of truth, confirm this deletion stopping point, and then wait for Stuart's explicit deletion instruction.
