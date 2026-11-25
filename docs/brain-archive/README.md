> **ARCHIVED – reference only, not used by the app.** Copied 25 Nov 2026 from the private repo Project-Check-Brain (branch main). The app does not load, import or test anything in this folder. Do not wire it in. The live rules are Project-Check-MVP-Master-Build/regs-checker/.

# Project Check Brain

Project Check Brain is the independently versioned governed knowledge, reasoning and domain-intelligence repository for Project Check.

The application repository (`Project-Check-MVP-Master-Build`) consumes the Brain through a controlled interface.

The Brain repository must not contain customer project records or customer-uploaded evidence.

No Brain rule becomes authoritative merely because it exists in this repository; Project Check governance and approval status still apply — see `GOVERNANCE.md`.

## Status

This repository has just been initialised. **No Project Check knowledge, rules, questions, specifications or reasoning have been migrated yet.** See `BRAIN-MIGRATION-REGISTER.md` for the tracked migration worklist (currently empty) and `SOURCE-BASELINE.md` for the exact state of the application repository this setup was performed against.

## Structure

- `governance/` — governance records for Brain content (mirrors, does not replace, application-repository governance)
- `schemas/` — shared data-schema definitions for Brain ↔ application interface
- `stage-1/` — Stage 1 (Anticipate) governed knowledge and reasoning
- `stage-2/` — Stage 2 (Investigate) governed knowledge and reasoning
- `stage-3/` — Stage 3 (Resolve) governed knowledge and reasoning
- `evidence/` — Evidence Intelligence and Planning Intelligence governed knowledge and reasoning
- `geometry/` — Project Check's own building-geometry model and rules
- `tests/` — regression tests protecting migrated Brain content

## Related repository

Application repository: `Project-Check-MVP-Master-Build` (sibling repository, GitHub: `ProjectCheck-Raffers/Project-Check-MVP-Master-Build`). The application repository remains the live, running product and is not altered by anything in this repository.
