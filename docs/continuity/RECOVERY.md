> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Kept as the continuity record; references to the old repo, its Vercel project and its workflows describe the old setup. The live entry point is CLAUDE.md and docs/continuity/CURRENT-CHAT-INDEX.md in project-check-app. Client jobs are anonymised as Job A–O; IDs are redacted.

# Project Check — Recovery Coverage and Procedures

Evidence date: **29 October 2026**. Owner: Chief Architect; changes approved by Stuart through the [recording process](CURRENT-CHAT-INDEX.md#permanent-session-recording-procedure).

## Coverage boundaries

| Area | Evidence/status | Recovery limitation |
|---|---|---|
| Captured source package | DOCUMENTED completed Step 1C; LATEST-SIGNOFF records checksums | Not all workspaces or full platform recovery |
| Version 3 source checkpoint | VERIFIED protected branch/full SHA in MASTER | Historical recovery point, not latest application |
| GitHub branch history | VERIFIED accessible application/Brain repos | Git history excludes uncommitted/unpushed work and live data |
| Windows development folders | UNKNOWN current inventory | Local-only changes may remain outside the captured package |
| Codespaces | UNKNOWN listing and worktree state | May contain unpushed commits/uncommitted files |
| Complete Brain preservation | UNKNOWN | Vendored modules do not preserve all schemas/provenance/tests/history |
| Deployment rollback | PLANNED candidate-specific procedure | READY deployment alone is not a tested rollback |
| Supabase database/auth/storage recovery | UNKNOWN live recovery coverage | Source SQL migrations do not preserve live records or document bytes |
| Independent backup outside GitHub | DOCUMENTED outstanding | Same-provider/account failure remains a risk |

## Source recovery — bounded procedure, not permission to execute

Use LATEST-SIGNOFF's existing encrypted Release and checksum only when a new authorised recovery need exists. Preserve the original C: archive. Download to a new private folder, verify SHA-256 before opening, enter the password privately, and restore into an isolated location. Never overwrite live workspaces.

**DOCUMENTED:** the captured package includes local Git/worktree material, uncommitted changes and validation snapshots. The local drawer-review commit `e66f688dac934d0b299b3bbeea664814e9ba5537` was preserved; this does not make it the approved application.

The archive's restore notes record historical absolute worktree links. Inspect/adapt links only in a disposable restored copy before Git operations; never let restored links affect original workspaces. Do not run hooks, application code, credential helpers or deployments merely to inventory an archive. The old internal “temporary/local only” note predates the completed external encrypted preservation; use the signed-off Release record for current storage status.

## Remaining source inventory — read-only until separately authorised

- Windows: identify current development folders, branch/HEAD, worktrees, status including untracked files and local versus known remote refs. Do not publish file contents containing secrets/customer data. Stale tracking refs do not prove remote completeness; record their age. Any fetch or preservation write requires scope confirmation.
- Brain's SOURCE-BASELINE.md records an August Windows path and 16 modified/3 untracked files. This is historical evidence only, not proof of current dirty state or permission to use OneDrive.
- Codespaces: minimum pending human check is `gh codespace list` using Stuart's existing authorised CLI session. Listing does not establish clean worktrees. Do not start/resume a Codespace merely for inventory: startup commands can install/run tooling. Agree a bounded inspection before remote execution.
- Brain: inventory independent commits, schemas, tests, provenance and documentation; preserve governance classifications. Complete independent backup remains unverified.
- Other workspaces: compare preserved snapshots/local commits against a founder-selected candidate before proposing integration. Never merge solely because a file is newer.

## Deployment recovery — PLANNED / not exercised here

Identify the exact known-good source SHA, immutable deployment ID, configuration/database compatibility and founder approval. Define rollback and post-rollback checks before any change. Preserve failed candidate evidence; do not move aliases or redeploy from a historical guide without explicit authority. Actual rollback success remains UNKNOWN.

## Database and customer-document recovery — UNKNOWN

Inventory service backup/export retention and restore capability for database records, authentication dependencies and storage objects separately. Never infer recoverability from migrations or metadata rows. A future authorised restore exercise must use isolated targets, appropriate access restrictions, measured recovery evidence and no production overwrite. No database resume, export, permission change or restore is authorised by this document.

## Independent disaster recovery — PLANNED

Propose a separately approved encrypted copy outside GitHub, covering explicitly inventoried sources and separately designed live-data recovery. Keep encryption credentials outside repositories. Do not select a service, upload, change billing or repeat encryption under Continuity V1.

Update this document when inventory, backup coverage, recovery methods or exercised results change. Distinguish procedure design from successful restoration. Never relabel the existing source-package sign-off as a full-platform recovery sign-off.
