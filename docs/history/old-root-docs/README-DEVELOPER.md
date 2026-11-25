> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

# Project Check — Developer Handover

**START HERE.** This is the entry point for a newly-hired developer joining Project Check. Everything authoritative is linked from this document. Do not work from chat history, old batch reports, or memory of a conversation — those are historical record, not the current governing source (see "Governance hierarchy" below).

This onboarding pack is a **navigation layer**, not a second governance system. It summarises, links, classifies, and orients — it does not redefine anything already decided in `Project-Check-MVP-Master-Build/MASTER-SPEC.md` or `Project-Check-MVP-Master-Build/EVIDENCE-INTELLIGENCE-SPEC.md`. If anything in this pack ever appears to disagree with those files, the specs win — see the hierarchy below, and treat the disagreement as a bug in this pack to fix, not a decision to make.

## A. What Project Check is

Project Check is a **supplier-independent** project risk/intelligence platform for people commissioning early-stage **industrial buildings** (steel-portal-frame sheds/warehouses and similar). Its purpose, in its own words, is **"Know before you build"** — surfacing what could go wrong, what evidence exists, what's missing, and what needs resolving, *before* a customer commits to a supplier or a build.

The product is organised around a four-stage customer journey:

1. **Stage 1 — Anticipate.** A short, guided questionnaire (currently 12 questions) capturing the customer's requirement and early risk signals, in plain customer language.
2. **Stage 2 — Investigate.** "No surprises" pre-order readiness — the customer's answers, uploaded evidence, and (where applicable) Planning Intelligence are checked against each other for gaps, conflicts, and missing information.
3. **Stage 3 — Resolve.** A paid service (currently priced at **£99** or **£249**) that converts Stage 2 findings into organised actions and support toward a purchase decision.
4. **Stage 4 — Control / Project Support.** The *future* continuation of the same Project Record through live project delivery, tracking what changes and what that might affect. **Recorded future architecture — not implemented today.**

The whole system is built on an **evidence/provenance-driven architecture**: every fact Project Check surfaces should be traceable to a source, and Project Check is explicit about the difference between what a document *states*, what is *inferred*, and what is *confirmed*. It never silently substitutes itself for a qualified professional's judgement (structural, fire, planning, or otherwise).

No sales fluff beyond that — the rest of this pack is about where things actually live and what's actually built.

## B. Current protected baseline

**Current protected baseline:**
```
d7b2dac6bea774dd107231962213a42118349f27
"docs: lock discovery intelligence architecture"
```
This is the current HEAD of `combined-rev2-canopy-drawing` (pushed to `origin`) at the time this onboarding pack was written. Treat it as the floor — anything built from here should not silently regress or contradict what's already accepted at this commit.

Other significant protected checkpoints (see `DECISION-LOG.md` for more):
- **`c2ae832`** — Planning Intelligence Batches 1–5 locked and protected.
- **`d7b2dac`** — Discovery Intelligence Architecture governance record locked; current baseline.

Full detail: `PROTECTED-CHECKPOINTS` in `GOVERNANCE-INDEX.md` § 11, and `DECISION-LOG.md`.

## C. First 60 minutes

**First 15 minutes** — read this document in full, so you understand Stage 1–4 and where the "not a file store" evidence architecture fits. Do not skip to code yet.

**Second 15 minutes** — read `ARCHITECTURE-MAP.md`. It gives you the one-page conceptual picture (evidence → discipline intelligence → relationships → Stage 2/3/4) and, critically, which parts of that picture are real code today versus recorded-but-unbuilt architecture.

**Third 15 minutes** — read `CURRENT-STATE.md`. This is the single most important document for not wasting your first week: it tells you, area by area, what's IMPLEMENTED, PARTIALLY IMPLEMENTED, RECORDED FUTURE ARCHITECTURE, or NOT AUTHORISED/DEFERRED.

**Fourth 15 minutes** — open `CODE-MAP.md` and `TEST-MAP.md` side by side. Identify which file you'd actually need to touch for the kind of change you've been asked to make, and which test suite(s) currently protect it. Then run the expected local verification process:
- Start the local static server: `npx serve .` from inside `Project-Check-MVP-Master-Build/` (this is the same command in `Project-Check-MVP-Master-Build/START-HERE.txt`), then open the Local address it prints.
- Run the Playwright suite from `tests/playwright/`: `npx playwright test` (see `tests/playwright/package.json`). Read `TEST-MAP.md` before you interpret the result — there is **known, pre-existing regression debt** in this suite that must not be casually "fixed" as a side effect of an unrelated task.

Do not assume every task requires the same test scope — `TEST-MAP.md` tells you what's actually expected per area.

## D. Navigation

| Document | What it's for |
|---|---|
| [ARCHITECTURE-MAP.md](ARCHITECTURE-MAP.md) | One-page conceptual map of the whole system, implemented vs future |
| [CURRENT-STATE.md](CURRENT-STATE.md) | The implementation-status table — read this before touching anything |
| [GOVERNANCE-INDEX.md](GOVERNANCE-INDEX.md) | Where the authoritative rules for each area actually live |
| [CODE-MAP.md](CODE-MAP.md) | Which source file owns which responsibility |
| [TEST-MAP.md](TEST-MAP.md) | Which test suite protects what, and known regression debt |
| [DECISION-LOG.md](DECISION-LOG.md) | Distilled list of major locked architecture/product decisions |
| [DEVELOPER-RULES.md](DEVELOPER-RULES.md) | The "do not break these" list |
| [Project-Check-MVP-Master-Build/MASTER-SPEC.md](Project-Check-MVP-Master-Build/MASTER-SPEC.md) | **Authoritative** product/stage specification |
| [Project-Check-MVP-Master-Build/EVIDENCE-INTELLIGENCE-SPEC.md](Project-Check-MVP-Master-Build/EVIDENCE-INTELLIGENCE-SPEC.md) | **Authoritative** evidence/data architecture specification |
| [Project-Check-MVP-Master-Build/CHANGELOG.md](Project-Check-MVP-Master-Build/CHANGELOG.md) | Full historical implementation record, most recent first |
| [Project-Check-MVP-Master-Build/START-HERE.txt](Project-Check-MVP-Master-Build/START-HERE.txt) | The original quick-start (run the app, walk the customer journey) |

## E. Development working method

The protected working method used to build everything in this repository so far:

```
INSPECT
  → what already exists; what governs this area (GOVERNANCE-INDEX.md)
CLASSIFY EXISTING vs NEW
  → is this extending something, or genuinely new?
CHANGE THE SMALLEST SAFE SURFACE
  → prefer the narrowest change that satisfies the actual instruction
RUN FOCUSED TESTS
  → the specific suite(s) for the area you touched — see TEST-MAP.md
RUN ACCEPTED REGRESSIONS
  → confirm nothing else moved — see TEST-MAP.md for what "accepted" means today
REPORT EXACT FILES CHANGED
  → never a vague summary
COMMIT ONLY WHEN AUTHORISED
  → committing/pushing is a separate, explicit decision from making a change
```

Not every task has identical test requirements — a documentation-only governance task requires no test run at all; a change inside `evidence.js` or `app.js` requires the relevant focused suite plus the accepted regression baseline. **See `TEST-MAP.md` for what's actually expected**, rather than assuming.

## Governance hierarchy

If two sources appear to disagree, resolve it in this order:

1. **Current locked/authoritative governance in `Project-Check-MVP-Master-Build/MASTER-SPEC.md`.**
2. **Current relevant specialist specification** — `Project-Check-MVP-Master-Build/EVIDENCE-INTELLIGENCE-SPEC.md` and any other protected specialist spec.
3. **Protected checkpoint / accepted implementation record** (a specific, named Git commit known to be reviewed and accepted).
4. **Current code behaviour**, where governance has not explicitly superseded it.
5. **`CHANGELOG.md` / historical implementation record.**
6. **Old exploratory notes, old batch reports, or chat history — last, and only for background colour.**

**Old batch reports and chat history are not the governing source where they conflict with the current protected specification.** This onboarding pack itself has no authority beyond navigation — if it ever turns out to be wrong about something governance already decided, the spec wins and this pack needs fixing, not the other way round.