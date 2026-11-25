> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

# Project Check Front Page — MASTER ASSET CONTROL

Status: ACTIVE MASTER CONTROL
Approved by: Stuart Rathbone
Updated: 9 September 2026

## Sole source of truth
The CURRENT HEAD of GitHub `master` under `Project-Check-MVP-Master-Build/masterfile/` is the sole authority for Project Check homepage/brand assets.

Historical commits, application asset copies, trial branches, live runtime files, screenshots, chats, external design tools, generated images and caches are not authority and cannot override current MASTERFILE content.

## Review before application
Candidate master assets must first be placed in `masterfile/review-staging/` for Stuart to review. Files there are temporary candidates only and do not become authoritative until Stuart explicitly approves promotion.

After approval:
1. Promote the approved candidate into its exact matching `masterfile/` path.
2. Clear the stale staged copy.
3. Copy the current master file into the exact matching application asset path.
4. Verify source and destination bytes/blob hashes are identical.
5. Verify the rendered page.
6. Stop.

## Current protected master set
- `masterfile/project-check-logo.png` — logo only.
- `masterfile/journey-logos/project-check-icon-check.png`
- `masterfile/journey-logos/project-check-icon-understand.png`
- `masterfile/journey-logos/project-check-icon-decide.png`
- `masterfile/journey-logos/project-check-icon-moveforward.png`
- `masterfile/front-page/project-check-banner-logo.png` — approved horizontal website banner logo.

## Integrity rule
Protected assets are distinct identities. Never copy one protected asset over another. The logo and banner must not share the same blob/bytes unless Stuart explicitly approves that exact condition. Application copies are not allowed to redefine master authority.

## Application mappings
- `masterfile/project-check-logo.png` -> `assets/project-check-logo.png`
- same complete logo -> `assets/figma-header-logo.png` only where the existing Direction C header path requires it
- each journey icon -> only its matching `assets/project-check-icon-*.png`
- `masterfile/front-page/project-check-banner-logo.png` -> `assets/project-check-banner-logo.png`.

## Related lock
See `FRONT-PAGE-LOCK.md` in this folder for the approved homepage design specification.

