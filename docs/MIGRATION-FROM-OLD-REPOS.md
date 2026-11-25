# Migration from the old repos (25 Nov 2026)

Everything worth keeping from the private repos **Project-Check-MVP-Master-Build** (branch approved, plus files that only existed on other branches) and **Project-Check-Brain** (branch main) now lives here. The aim is that the old repos can be deleted once Stuart approves.

All text was sanitised before it came in: client names and sites are replaced with the Job A–O labels used in docs/job-library, and client prices, a postcode, a client file name, an email address, Vercel and Supabase IDs and one security finding are redacted.

## What moved where

| Folder in this repo | Files | From |
|---|---|---|
| docs/governance/ | 8 | PROJECT-SOURCE-OF-TRUTH.md, AGENTS.md, PLATFORM-SETUP.md, TEST-MAP.md, TEST-PLATFORM-GOVERNANCE.md, .github/copilot-instructions.md (as copilot-instructions.md), the old CLAUDE.md (as CLAUDE-old-repo.md), workflows/PROJECT-CHECK-PROMOTION-GATES.md |
| docs/continuity/ | 8 | MASTER.md, DECISIONS.md, ENVIRONMENTS.md, LATEST-SIGNOFF.md, RECOVERY.md, README.md; archive/ holds the old repo's CURRENT-CHAT-INDEX.md and the planning connection log. This repo's own CURRENT-CHAT-INDEX.md is unchanged (append-only). |
| docs/product/ | 5 | docs/product/* |
| docs/reporting/ | 7 | docs/reporting/* |
| tools/, .mcp.json, .devcontainer/ | 9 | Architect MCP server (with its HTTP bridge from a side branch), review-hub builder, MCP config (paths made relative), dev container |
| docs/brain-archive/ | 67 | The whole Project-Check-Brain repo. **Archived, not used by the app.** |
| docs/history/ | 29 | Superseded root docs (architecture map, code map, decision log, etc.), old app docs (MASTER-SPEC, CHANGELOG, EVIDENCE-INTELLIGENCE-SPEC, masterfile notes), the old evidence engine (evidence.js) and the old GitHub workflows (as .txt so they never run). Reference only. |

## What stays in the old private repo, and why

| Item | Why it stays private |
|---|---|
| docs/evidence/ (479 files) | Client originals: drawings, quotes, certificates. The anonymised write-ups are in docs/job-library. |
| SECURITY.md, security-readiness.md, pentest-handover.md, AZURE-DEPLOYMENT.md (and their docs/internal copies on side branches) | Security, pentest and hosting notes. |
| .gitleaksignore | Fingerprints for old-repo commits only, plus a security note; meaningless here. |
| tools/planning-preview and api/_planning (side branches) | Planning-portal prototypes; their test data uses a real client site address. Never merged. |
| review-archive/ (291 files) and old trial code on side branches (direction-c-trial, planning-check, openings, menu-preview, figma-homepage-lock) | Old build snapshots and abandoned trials, superseded by the current app. |
| Older versions of the same docs on side branches | Superseded by the approved versions copied here. |

Project-Check-Recovery-Backups holds one encrypted backup (28 Oct 2026). It has not been opened and stays as it is.
