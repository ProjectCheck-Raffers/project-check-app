> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Now lives in project-check-app under docs/governance/. Root-level file names in this text (AGENTS.md, PROJECT-SOURCE-OF-TRUTH.md, etc.) now sit in this folder. Client jobs are anonymised as Job A–O; infrastructure IDs and security details are redacted. Where this file and the root CLAUDE.md disagree, CLAUDE.md wins.

# Project Check — Source of Truth and Authority

Project Check is owned by Stuart Rathbone, final approval authority. His latest explicit instruction defines the task. Reading or recovering context never authorises implementation.

## Canonical continuity

Repository: `ProjectCheck-Raffers/Project-Check-MVP-Master-Build`.
Application directory: `Project-Check-MVP-Master-Build/`.

Read the [canonical continuity entry point on approved](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/blob/approved/docs/continuity/README.md). Follow its reading order and classifications. A proposal branch is not publication. Report missing private access rather than inventing state.

approved is canonical: it owns published continuity and is the current clean application baseline. Each coding task starts from approved at the full SHA named in Stuart's instruction. Historical `sandbox` and `master` are evidence only and must not be used as a starting point, route or code source without Stuart's explicit task-specific instruction. None of these roles is a commercial release. New branches and promotion require explicit authority.

## Mandatory reading for paid-report work

When reading the source of truth for any Project Check stage that contributes to the paid customer report, follow the complete [reporting reading order](../reporting/README.md). This applies to customer questions, evidence collection, foundations and anchoring, temperature and insulation, and report preparation, generation and review.

## Single owners for changing information

- [MASTER.md](../continuity/MASTER.md): dated project/architecture summary, current references and failures. Recheck live heads; a documentation-only head is not a different application version.
- [DECISIONS.md](../continuity/DECISIONS.md): approvals, rejections, superseded decisions and instruction reconciliation.
- [LATEST-SIGNOFF.md](../continuity/LATEST-SIGNOFF.md): completed milestone, evidence and limits.
- [CURRENT-CHAT-INDEX.md](../continuity/CURRENT-CHAT-INDEX.md): current handover, recording procedure and next authority.
- [ENVIRONMENTS.md](../continuity/ENVIRONMENTS.md): Vercel/Supabase identity, source/URL mappings, access and unknowns.
- [RECOVERY.md](../continuity/RECOVERY.md): source/deployment/database/document recovery coverage.

Do not duplicate changing status here. On other branches follow the explicit approved entry URL, not stale relative copies. Preserve original documents in Git history; their earlier status descriptions, including any that name sandbox as active development, are historical.

## Frozen recovery and architecture boundary

Never modify `recovery/version-3-approved-2026-09-22` at `9cf08458576aa11377a79cd5a7a585ef1268ff11`. Repository tree: `cffedf2051e3650af6129ce29e2c119088a177d2`; application subtree: `834b8a203de1b921a131b513e882205262ede13e`. This is historical recovery, not current development.

Retain vanilla HTML/CSS/JavaScript and current runtime assets. No Next.js, TypeScript migration or wholesale rebuild is authorised. Brain retains its own rules, schemas, provenance and independent history. Source preservation is distinct from live database/platform recovery.

## Current product knowledge

Stage 1 is the free initial project and evidence-gap check for free-standing steel buildings. Stage 2 is locked pending a later decision. Pricing will be reconsidered after Stage 1.

- [Stage 1 steel journey](../product/STAGE-1-STEEL.md)
- [Technical rules](../product/TECHNICAL-RULES.md)
- [Project lessons](../product/PROJECT-LESSONS.md)
- [Future work](../product/FUTURE-WORK.md)
- [Recovered chat knowledge](../product/RECOVERED-CHAT-KNOWLEDGE.md)

These files hold product knowledge within the canonical repository. The recovered-chat register indexes decisions and historical context. Follow the linked current rule for implementation.

## Customer-project data and test-fixture boundary

Project Check is designed around each customer's own project record. **Project Mount is a test/QA fixture only.** It is not the basis of the product design, a default customer project, an automatic precedent or a template whose facts may be copied into another project.

The active menu, completion states, pages and reports must read the current customer's project name, answers, documents and calculated status dynamically. Preview or automated-test fixtures must be isolated from real authentication, payment and production data, must exercise the real page routes, and must not replace a functional journey with a static visual copy.

Stage 1 records customer facts once and carries the same values through the remaining journey. The core fields for the current steel-building mapping include:

- building use and temperature condition: `buildingUse`, `temperatureCondition` and, when supplied, `requiredTemperatureC`;
- existing building area: `base`;
- intention to retain it if suitable: `intendsToReuseExistingBase`;
- available drawings, surveys and site information: `siteEvidenceAvailability` plus the project's evidence records.

Later pages and reports must reuse these stored values rather than ask for them again or substitute fixture data. The free Stage 1 output establishes the customer's project, records facts, classifies available evidence and identifies gaps without prescribing the completed solution. After payment, the assessment uses the same project record and evidence to develop the detailed envelope, substrate, foundation, anchoring, drainage, sealing and investigation advice.

## Substrate, existing-base and foundation assessment

This section is the approved domain baseline for the initial free problem report and the later paid Project Check report. It applies while the steel-building journey is being mapped. Aluminium buildings, steel canopies and extensions require their own later mappings and must not silently override this baseline.

### Customer-stage questions

The customer is not expected to know the required foundation or anchoring design. At the initial stage ask only:

1. **What is currently on the proposed building area?**
   - Concrete slab or concrete hardstanding
   - Newly designed concrete base suitable for structure
   - Tarmac or asphalt
   - Hardcore or stone
   - Soil or grass
   - Mixed surfaces
   - Not sure
2. **Would you like to use the existing surface if it proves suitable?**
   - Yes — assess it for reuse
   - No — a new base is planned
   - Not sure

Do not offer “Existing foundations” or “Existing building” as surface types. The first question records what is physically there; the second records the customer's cost-saving intention. Neither answer declares the substrate suitable.

### Conditional evidence-upload question

If the customer selects **Yes** or **Not sure** about reusing the existing surface, ask one further question:

**Do you have any drawings, surveys or other information for the proposed building area?**

- Yes — upload them now
- Yes — I will upload them later
- No
- Not sure

Provide one upload area. Invite topographical/level surveys, underground-services or utility surveys, drainage drawings, CCTV drainage surveys, slab or foundation drawings, ground-investigation information and existing site/building surveys. The customer is not expected to identify the document type or interpret the evidence correctly; they upload whatever they possess and Project Check classifies it.

Document presence is not proof of current suitability. Preserve the filename, date, revision, surveyed extent, purpose/status, stated quality level and limitations. Explicitly retain warnings such as client-supplied, outdated, indicative, approximate, inaccessible, incomplete, not for construction, blocked, flooded or unverified. Planning drawings and planning approval are not substitutes for topographical, drainage, utilities or slab evidence.

### Assessment sequence

Building use and required internal temperature establish the likely envelope and structural system first. Substrate assessment then considers the selected system and actual building position against:

- existing surface type, condition and evidence;
- slab thickness, reinforcement, subbase and known construction;
- levels, falls and gradient;
- drains, drainage routes, services and obstructions;
- building footprint and column/baseplate positions;
- clear height and proposed racking loads;
- calculated downward, uplift and horizontal support reactions;
- proposed anchoring;
- water-management details, including internal/external sealing, flashing, local bunds or plinths;
- inspection and continuing maintenance requirements.

A description such as “concrete yard” or “lorry park” is not evidence of structural suitability. Sealing and structural capacity are separate decisions: bunding, flashing and sealants manage water; support reactions, anchorage, slab and subbase evidence determine whether the structure can be supported.

### Report outcomes

The evidence-led report must distinguish between:

1. **Potential reuse** — the existing surface may support the proposed structure, subject to competent verification, with planned anchoring and normal sealing.
2. **Reuse with targeted work** — retain the main hardstanding but add measures such as local pads, perimeter thickening, underpinning, levelling, bunding or enhanced internal/external sealing.
3. **New engineered base required** — the existing substrate is unsuitable or cannot be evidenced for the proposed reactions, height, racking or anchoring.

Do not state that sealing, bunding or local work automatically removes the saving from using existing hardstanding. Retaining suitable hardstanding with proportionate local work can be substantially cheaper than breaking it out and installing a complete structural-engineer-designed base. All industrial perimeter seals require inspection and maintenance over time.

### Verified project lessons

- **Job E:** the steel building reused an existing concrete lorry park. Due diligence established the building position, levels and drainage routes. A known fall on one side was dealt with by additional sealing internally and externally, disclosed to the client in advance. The installation record confirms inspected concrete working ground, setting out and levels, anchoring, and the cladding-to-concrete Rubbercoat sealing process. This is the successful planned-reuse example.
- **Job F:** the installation record states that the working surface was concrete, underground/overhead services had been identified and marked, the site had been inspected, and measurements and levels were taken before baseplate setting-out. This demonstrates the value of receiving site information before installation; it does not make the customer's own technical assessment a Stage 1 requirement.
- **Job A:** the evidence set contains a site survey, proposed-levels drawing, existing-drainage information, a PAS 128 utility survey, a 114-page CCTV drainage report and later groundworks/drainage material. The background topographical information was dated February 2018, client-supplied and marked not for construction. Later evidence recorded approximate routes, blocked/flooded chambers and restricted access. This demonstrates that uploaded evidence can reveal both useful facts and important currency, coverage and reliability gaps.
- **Job I:** the available planning decision lists approved floor, elevation and block-plan drawings, but the decision notice is not a topographical, drainage, utilities or slab survey. Project Check must keep planning evidence separate from evidence needed to assess existing hardstanding.
- **Job C buildings 1 and 2:** the records demonstrate surface-anchored steel construction and the middle route of retaining an existing slab while strengthening the building perimeter. The civils proposal cuts the existing slab at the new perimeter and installs a reinforced 600 mm by 600 mm C35 concrete thickener. The uploaded 25.042 assembly drawings establish the later structure but do not, by themselves, approve the existing slab. This is the targeted-strengthening example.
- **Job D:** the selected support-reaction report for an 18.45 m by 37.86 m by 7.5 m steel structure shows reactions of approximately 92 kN downward, 42 kN uplift and 20 kN horizontal. This demonstrates why the final decision must follow calculated support reactions rather than the customer's surface description.
- **Job B:** the proposed tall racked warehouse sought to use an existing lorry park crossed by drainage. The 12 m eave height, racking, position, drains and foundation demands were not resolved early enough; the existing ground was later found unsuitable. This is the late-discovery example and demonstrates the value of Project Check before commitment.

These examples are evidence for reasoning, not automatic precedents. Each project still requires its own position, use, structure, reactions, ground evidence and competent assessment.

### Free-to-paid report boundary

The **free report** is a plain-language problem and evidence-gap report. It can identify that reuse is desired, record the existing surface, classify uploaded evidence, state document dates/revisions/status, recognise visible levels, gradients, drainage/services conflicts and evidence limitations, and explain what remains unverified. It may state, for example, that a survey is old or not for construction, that a route is approximate, or that slab construction/capacity has not been demonstrated. It must not certify the surface, prescribe the foundation/drainage/envelope solution or give away the completed paid assessment.

The **paid report** develops the evidence-led route forward. It overlays the confirmed building footprint and relevant column/baseplate positions against the available topographical, drainage, utility and slab evidence; connects use and temperature requirements to the likely building system, position, racking, support reactions and anchoring; decides whether more-current or additional investigation is required; and distinguishes reuse, repositioning, drainage/service protection or diversion, targeted strengthening and replacement. It states required competent checks and explains likely cost, programme and maintenance consequences. It remains an advisory Project Check report and does not replace structural engineering design or certification.

## Authority boundary

Historical master, superseded governance, archives, old chats/screenshots, unmerged PRs, successful checks and READY deployments are evidence only. They cannot authorise code resurrection, branch reconciliation, commits or external-service changes. Preserve unique/uncommitted work.

Continuity V1 permits only its explicit eleven-file documentation programme and conditional PR process. Unknown deployment effects require a stop before push. Final merge needs Stuart's explicit approval. Production, databases, permissions, billing, DNS and hosting configuration remain outside that programme. A session is not saved until its published GitHub record is verified.

## Clean baseline and current working point

**Repo move (19 November 2026):** app code moved to the public repo [ProjectCheck-Raffers/project-check-app](https://github.com/ProjectCheck-Raffers/project-check-app), copied from private `approved` at `d173217` with fresh history (app, tests and supabase only; no docs, evidence, continuity or security notes). New app work happens there. This private repo keeps the source of truth, continuity and evidence. Private-repo workflows are disabled except the nightly continuity record. Vercel: new project `project-check-app` deploys from the public repo (approved link https://project-check-app-git-approved-project-check.vercel.app, review link https://project-check-app-git-review-project-check.vercel.app); the old Vercel project is kept as a fallback.

The clean `approved` line began at commit `23ba9e65b38d8ca5a0699746f28e3b4d7d76548e` (the PR #79 merge, 14 November 2026). That is the historical start of the clean line, not today's starting point.

**Current working point (updated 18 November 2026):** the latest `approved` head. The latest application commit is `b690e22a36b42161941f1ca8ca00803916e79702` (PR #93 merge, 18 November 2026 23:57 UTC); later commits on `approved` are documentation only. Every new task branches from the current `approved` head and nothing else.

- Do not merge, cherry-pick, copy or restore code or files from `sandbox`, `master` or any other historical ("dirty") branch into `approved`.
- Historical branches are read-only research material. They may be read to understand past decisions, but any change goes onto `approved` as fresh, reviewed edits to the real files on `approved`.
- Keep this section and "Approved changes" current: whenever a PR is merged into `approved`, update the latest application commit above and add the PR to the list below in the same session.

## Approved changes since the clean baseline

### 14 November 2026

- `a0b06b6` Building Design: solar panel arrays are added on the Plan view with a "+ Solar panels" button, like skylights (PV1, PV2…, panels along roof × up slope, indicative kWp). The old bottom solar calculator was removed. Solar is not yet in the report, PDF or Summary.
- `26f6024` Building Design: the "Find a roller door or casement window" list is permanently visible (no dropdown).
- `320fe48` Menu: the landing page and any non-project view show the full Stage 1 customer journey, greyed with "To do" states and a Start a project prompt. Inside a project, steps show Complete or what is missing, and the next step is highlighted. NaN% progress and "0 of 0" Initial Questions are fixed.
- `7a4e49a` Building Design: add buttons at the top, "Find an opening" dropdown, solar arrays snap to roof bays with "Fill roof with solar".
- `616d5c2` Building Design: roller doors comparison as a collapsible box with a door dropdown.

### 15–16 November 2026

- `262ffa8` Tests: sign-in assertions scoped to the sign-in panel (PR #73).
- `4570b55`, `6172753` CI: lightweight nightly continuity workflow, concurrency and path-filtered heavy suites.
- `CLAUDE.md` added and locked with the continuity rule (16 November).

### 17 November 2026

- `82606e8` **PR #80** Stage 2 background checks on a confirmed Building Design, shown only on the read-only Stage 2 design summary (`#quotationSummary/<project id>`): boundary distances, indicative fire exits by the 32 m rule (`ceil(perimeter / 32)`, snapped into bays beside steel columns), 32 m travel-distance flag and 1.8 m clear space. Includes leaf-style double doors and single/double fire-door styles, the "Use personnel doors as fire exits" option (roller-adjacent fire doors first, left or right chosen per roller door), fire doors removed while Building Design is unlocked for editing, the "Open Stage 1 Free Report" button moved to Building Design (enabled only when Site Layout and Building Design are confirmed), and simpler dashboard project cards.
- `03309c6` **PR #81** Stage 1 Project Summary: doors section removed (Building Design already shows roller doors in full). The free report and PDF are unchanged.
- `ee1c98d` **PR #84** Solar panels: after deleting an array, selection moves to the next array of the same type instead of jumping back to the first skylight.
- `bfb670a` **PR #85** Solar panels: "+ Solar panels" continues from the row of the last placed or moved array (`solarAnchorId`, kept through Undo and Cancel edit). Superseded in behaviour by #88.
- `3530ab0` **PR #86** Skylights: "+ Skylight" continues along the moved skylight's line and skips blocked bays instead of restarting.
- `af33caa` **PR #87** Solar arrays: drag freely across the roof (snap along the roof to the bay under the pointer) and fit beside skylights; shrink to 1 panel deep if needed, otherwise stay put with a "bay is blocked" status.
- `74e3db4` **PR #88** Solar panels: new arrays follow the line of the last placed or moved array, using the same fit-beside-skylights rule as dragging; then free bays further across; then the first free bay anywhere.

### 18 November 2026

- `4333b57` **PR #90** Stage 1 Free Report and PDF: new "Base and foundations" advice card after "Stage 1 site observations" (steel / free-standing). The base is designed by a structural engineer or suitable specialist from the building's reaction (support load) documents; Project Check advises only and gives no costs. Warns against starting groundworks before the building is ordered.
- `17eaf68` **PR #91** Stage 1: one optional question in Edit project details (steel / free-standing, "Existing buildings nearby"): "Will the new building link to, or sit close to, an existing building?" (`facts.adjacentExistingBuilding`), also shown in the Project Summary. A "Yes" answer adds a "Junction with existing building" card to the Stage 1 Free Report and PDF, after "Base and foundations": flashings at roof and wall junctions, any gap or void between the buildings capped or drained, sealed service and cable entries, agreed with the designer and installer before ordering. No costs.
- `a3585c7` **PR #89** Stage 1 report illustration matches Building Design: `drawing.js` draws from the saved Building Design geometry (same doors, windows, skylights, solar arrays, dimensions and ridge), elevations named A = front, B = right, C = back, D = left with facing bearings, title block address kept inside the border, and the sheet rebuilt every time the report opens or the PDF downloads, so re-confirming Building Design updates it. Also keeps the Project workspace button text inside the button on the Stage 1 Free Report.
- `c08bf6c` **PR #92** Building Design: fire-exit option relabelled "Fire exits can also be used as personnel doors", shown on one line with an ⓘ button that shows or hides the explanation ("Fire exits can double as personnel doors. Indicative fire exits are placed beside roller doors; further exits are added once the design is confirmed.").
- `b690e22` **PR #93** Building Design, phones only (≤800px): the fixed bottom bar keeps only the two action buttons on one slim row. The "Fire exits can also be used as personnel doors" tickbox (same ⓘ behaviour) sits in the page below the door settings, and "Open Stage 1 Free Report" with its note sits at the end of the page. The status note is no longer in the bar. Desktop/laptop unchanged.

## Work in progress (not approved)

- None open. PR #89 was approved and merged on 18 November 2026 (see Approved changes).

## Preview link

Always review `approved` at the stable branch link https://project-check-mvp-master-build-git-approved-project-check.vercel.app/ which always serves the latest `approved` commit. Per-commit preview URLs go stale after the next push and should not be shared as the current link.

## Known open issues (not yet fixed)

The preliminary project check drawing on the Project Summary draws all openings at ground level (ignoring window height). Its plan labels overlap, its elevation letters do not match Building Design (A/C gables, B/D sides), skylights and solar are missing, and its side elevations show no roof pitch. Its height labels are cramped and the title block address overflows.

PR #89 is intended to fix these issues; they stay open until it is merged.
