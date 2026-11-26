# regs-checker – Stage 1 "Potential issues"

England only, industrial/storage steel buildings. Stage 1 (free) shows **potential problems only**, using the client's own numbers – never solutions, methods, products or costs. Stage 2 solutions are not built yet.

Files: `rules.json` (the rules – the only file Stuart edits), `checker.js` (pure `runChecks(projectData)`; do not edit for wording or approvals).

## Add / change / approve a rule by editing `rules.json` only

Each rule has: `id`, `part` (A, B, L…), `regsRef`, `trigger` (plain-English description), `stage1Problem`, `stage1WhyItMatters`, `stage2Solution` ("Stuart to write"), `approved`.

- **Approve a rule:** set `"approved": true`. Rules with `false` are never shown to clients.
- **Change wording:** edit `stage1Problem` / `stage1WhyItMatters`. Placeholders `{elevation}`, `{distance}`, `{travel}` are filled with the client's numbers. Keep Stage 1 wording to the problem only.
- **Change a number:** limits live in the rule: `limits` and `factor` (B_TRAVEL), `limits` (B_EXITS). Changing the numbers here changes the check.
- **Write the Stage 2 answer:** replace `"Stuart to write"` in `stage2Solution`. It is not shown in Stage 1.
- **Add a brand-new rule:** the rule text goes in `rules.json`, but its maths needs a matching function in `checker.js` (keyed by `id`). A rule in `rules.json` with no function is ignored. Ask Claude to add the function.

## Results

`runChecks` returns `[{ruleId, result, measured, stage1Problem, stage1WhyItMatters}]`. `result` is `ok`, `potential problem` or `need info`. A missing answer is always `need info` – never shown as a problem and never guessed. The nation is set automatically from the postcodes.io country of the site postcode (Site Layout); England only runs checks. Northern Ireland is not supported and is cleared.

The results are saved to `project.backgroundChecks.regsChecker` when the user presses "Design confirmed", and shown in the Stage 1 report under "Potential issues to review".

## Added rules (all `approved:false`)

New result value `note` = the rule applies but is not a problem (exemption flag, advice, or quote-request-only item). Each result also carries `scope`: `customer` rules show "get professional support" instead of "problem". `buildQuoteRequest(project, rules)` returns the supplier quote-request lines per rule (only approved rules unless `{includeUnapproved:true}`); it never names a panel product. Stage 1 text contains no solutions; Stage 2 text lives in `stage2Solution`.

| Rule | What it does |
| --- | --- |
| `PLAN_PD` | Permitted development, England, GPDO 2015 Sch 2 Part 7 Class H. Reads footprint (width x length), ridge height, per-elevation boundary distance, free-standing or extension, and existing building floor area and height. New building over 200 m2, extension over the lesser of 50% of existing or 1,000 m2, any part within 5 m of the boundary, height over 5 m within 10 m of the boundary (otherwise new building no higher than the tallest building on site and 15 m max; extension no higher than the one it extends) = full planning likely. Scotland or Wales = need info. An unmarked boundary side or any missing answer = need info. Customer scope; runs for every nation (`anyNation`). |
| `BR_SCHED2_EXEMPT` | "May be exempt from building regs": detached, no sleeping, up to 30 m2; or temporary up to 28 days. Customer scope. |
| `A_LOADS_QUOTE` | Quote: postcode, altitude, exposure, roof solar (added load). |
| `B_BOUNDARY_FIRERATED_QUOTE` | Quote: "fire-rated wall needed on elevation X" when under `closeM` from boundary and cladding not stated as rated. Only drawn boundary lines (or the per-elevation answers) count; other buildings on the site are not boundaries. |
| `B_DOORS_QUOTE` | Quote: roller/sectional doors are not fire exits; over 25 m deep = a personnel door on each long side. |
| `B_ROOFLIGHTS` | Problem: rooflights near a boundary or with a fire wall. |
| `L_ROOFLIGHT_U_QUOTE` | Quote: heated + rooflights = U 2.2 max. |
| `M_ACCESS` | Problem: services = Yes. Stage 2: level threshold and accessible door. |
| `F_CONDENSATION` | Advice only (never a fail): unheated + vehicles/wet goods. Stage 2 text only. |
| `H_DRAINAGE_QUOTE` | Quote: gutters/downpipes by building supplier; surface water connection is customer scope. Built inside an existing building (base answer "Existing building / structure") = `stage1NoteInternal` (services line only) and no gutter / surface water quote lines. |
| `B_FIRE_ACCESS_11M` | Customer-scope note: "Fire engine access \u2013 get professional support". No inputs. |
| `L_ENERGY` | Fixed heating or cooling test (ADL Vol 2). Heated, other temperature, or services Yes = customer-scope note. Unheated + services No + exempt use (industrial, storage, workshop, agricultural) = ok. Unheated + services No + any other use (e.g. sports, leisure) = `stage1Problem` ("Part L statement may be needed – get professional support"). Heated answer, services or use unknown = need info (`needInfoHeating`, `needInfo`, `needInfoUse`). |
| `L_2027_HEATED` | Heated only; a customer-scope note (L_2027 was removed). Old detail: AD L 2026 edition from 24 Mar 2027: doors U 1.6; U-values unchanged (walls 0.26, roof 0.18, floor 0.18); energy calculation favours low-carbon heating. Old rules if BC application is before 24 Mar 2027 and work starts before `transitionEnd`. Quote: personnel doors U 1.6. |

### Fact keys the rules read (questions NOT yet added to the form - app.js is outside regs-checker, needs Stuart's go)

`regsExistingArea` (m2) and `regsExistingHeight` (m) for `PLAN_PD`; `regsDetached`, `regsSleeping` (Yes/No), `regsTempDays`; `regsAltitude` (m), `regsExposure`, `regsSolar` (Yes/No), project `postcode`; `regsBoundaryDist` {A,B,C,D} (fallback when no boundaries are drawn); `regsRooflights`, `regsFireWall`, `regsServices` (Yes/No - the heating/toilets/offices/services question does NOT exist yet), `regsVehiclesWet` (Yes/No). Missing = `need info`. Use the existing `regsQuestionSelect` / field styles so the form works on phone and laptop.

### Sources and UNKNOWNs

- Verified (legislation.gov.uk, GPDO 2015 SI 2015/596 Sch 2 Part 7 Class H): extensions limited to the lesser of 50% or 1,000 m2 of original floor space (lesser limits on article 2(3) land and SSSIs); no development within 5 m of the curtilage boundary. Class J is hard surfaces only, with no area/boundary/height limits.
- **UNKNOWN / differs from the brief:** a NEW separate building under Class H is limited to 200 m2 (100 m2 on article 2(3) land / SSSI), not 1,000 m2 - not coded. Height limits (5 m within 10 m of a boundary; otherwise the existing building / 15 m) - only "higher than existing" coded. Article 2(3)/SSSI land not asked. Check gov.uk guidance before approving.
- Verified (legislation.gov.uk, Building Regulations 2010 Sch 2): Class 4 temporary building not intended to stay over 28 days; Class 6 para 1 detached single storey up to 30 m2 needing no point under 1 m from the boundary OR substantially non-combustible. **UNKNOWN:** single-storey and 1 m/non-combustible conditions are not asked; sleeping-accommodation wording sits in Class 6 and a separate 15 m2 limb - confirm. Code uses "up to" 30 m2 and 28 days, as in the Schedule (brief said "under").
- **UNKNOWN (not verified, as supplied):** AD L 2026 edition 2027 values (U-values, doors 1.6, rooflights 2.2); transition period end (`transitionEnd` set to 24 Mar 2028 to match `L_2027`); rooflight boundary distance (`boundaryM` 6) and ADB table; "close to boundary" distance (`closeM` 25, same as `B_BOUNDARY`); "over 25 m deep" read as the longer plan dimension.

### Building Design answers (2026-11-25)

The Building Design page now asks (card "Building Regulations and planning"): `regsStored`, `regsServices` (Yes / No / Not sure), and, only for a building that links to or extends an existing one, `regsExistingArea` (m2) and `regsExistingHeight` (m). The cladding fire rating, fire engine access elevations, narrowest road width and Building Control date questions were removed; `B_BOUNDARY` and `B_BOUNDARY_FIRERATED_QUOTE` use boundary distance only ("A fire-rated wall may be needed on elevation X \u2013 the building supplier to confirm.").

### Permitted development (2026-11-25)

`PLAN_PD` was rewritten (still `approved:false`). Its saved result carries `measured.status` (`not-pd`, `unknown`, `likely-pd`) with `reasons` (figures) and `missing`. `describePermittedDevelopment(savedRegsChecker)` turns that into the three allowed sentences for the Stage 1 report and PDF; the saved record also carries `pdApproved` so an unapproved rule reads "We can't yet say ... not approved yet" instead of a conclusion. It never says "no planning needed".
A boundary side with no marked boundary line facing it (Site Layout) has no distance and is need info. `B_BOUNDARY` and `B_BOUNDARY_1M` read `backgroundChecks.buildingRegs.facingBoundaryDistances` (`pcBgFacingBoundaryDistances` in background-checks.js: each wall to the boundary it faces, 80 degree rule, measured at right angles, null when no facing boundary). Other rules still read `boundaryDistances` (nearest line anywhere).
**Not coded / UNKNOWN:** article 2(3) land and SSSI lower limits; the tallest building on site for a free-standing building (needs `regsExistingHeight`, which the Building Design card only asks when the building links to an existing one, so a free-standing building reads need info until that is answered); existing floor area is compared with the footprint (single storey assumed).

### Report honesty (2026-11-25)

Each rule can carry `needInfo` (plain words for what is missing). The Stage 1 report and PDF list `need info` items under "Need info" and never print "No potential issues found" while any is listed. Customer-scope items (`scope:"customer"`) are listed under "Get professional support". `PLAN_PD` has its own Permitted development section and is left out of this list.

### Stage 1 answer checks (2026-11-26)

The old separate Stage 1 check files were moved in here. Rules with `"reportSection": "stage1-answers"` read the customer's Stage 1 answers and map status, run for every nation, and are run by `stage1AnswerChecks(project)` in `checker.js` (not by `runChecks`). Their lines appear in the Stage 1 report and PDF flag sections (`category` / `discipline`) and in the missing-information list, not under "Potential issues to review". They are `approved:true` because they were already showing on the live report; set `approved:false` to hide one. Wording is edited here in `rules.json`.

| Rule | What it does |
| --- | --- |
| `FOUNDATION_BASE` | Existing surface answer in `triggerValues` = `stage1Problem`; "Not sure" = `stage1ProblemNotSure`. Customer scope ("get professional support"). Concrete slab = nothing. |
| `SITE_LEVELS` | Level answer No / Not sure = `stage1Problem`; No = also `needInfo`. |
| `PROGRAMME` | Programme "0–3 months" = `stage1Problem`. `approved:false` (2026-11-26): the programme question is not asked, so it never fires. |
| `MAP_NOT_CONFIRMED` | Building position not confirmed = `needInfoPosition`; site boundary not confirmed = `needInfoBoundary`. Need info only, one line each. |

Dropped as duplicates: the old close-boundary flag (covered by `B_BOUNDARY`, `B_BOUNDARY_1M`, `B_BOUNDARY_FIRERATED_QUOTE`, `A_FRAME_BOUNDARY`), the old heated-building flag (`L_ENERGY`, `L_2027_HEATED`) and the old services/drainage flag (folded into the `H_DRAINAGE_QUOTE` note). The browser loads `rules.json` as soon as `checker.js` loads; the Stage 1 report redraws once if it was opened before the rules arrived. Default roller door sizes now live in `building-layout.js` (`pcDoorSizeDefault`).
