# regs-checker – Stage 1 "Potential issues"

England only, industrial/storage steel buildings. Stage 1 (free) shows **potential problems only**, using the client's own numbers – never solutions, methods, products or costs. Stage 2 solutions are not built yet.

Files: `rules.json` (the rules – the only file Stuart edits), `checker.js` (pure `runChecks(projectData)`; do not edit for wording or approvals).

## Add / change / approve a rule by editing `rules.json` only

Each rule has: `id`, `part` (A, B, L…), `regsRef`, `trigger` (plain-English description), `stage1Problem`, `stage1WhyItMatters`, `stage2Solution` ("Stuart to write"), `approved`.

- **Approve a rule:** set `"approved": true`. Rules with `false` are never shown to clients.
- **Change wording:** edit `stage1Problem` / `stage1WhyItMatters`. Placeholders `{elevation}`, `{distance}`, `{travel}` are filled with the client's numbers. Keep Stage 1 wording to the problem only.
- **Change a number:** limits live in the rule: `limits` and `factor` (B_TRAVEL), `limits` (B_EXITS), `dates` (L_2027). Changing the numbers here changes the check.
- **Write the Stage 2 answer:** replace `"Stuart to write"` in `stage2Solution`. It is not shown in Stage 1.
- **Add a brand-new rule:** the rule text goes in `rules.json`, but its maths needs a matching function in `checker.js` (keyed by `id`). A rule in `rules.json` with no function is ignored. Ask Claude to add the function.

## Results

`runChecks` returns `[{ruleId, result, measured, stage1Problem, stage1WhyItMatters}]`. `result` is `ok`, `potential problem` or `need info`. A missing answer is always `need info` – never shown as a problem and never guessed. If the nation is not England, no checks run.

The results are saved to `project.backgroundChecks.regsChecker` when the user presses "Design confirmed", and shown in the Stage 1 report under "Potential issues to review".

## Added rules (all `approved:false`)

New result value `note` = the rule applies but is not a problem (exemption flag, advice, or quote-request-only item). Each result also carries `scope`: `customer` rules show "get professional support" instead of "problem". `buildQuoteRequest(project, rules)` returns the supplier quote-request lines per rule (only approved rules unless `{includeUnapproved:true}`); it never names a panel product. Stage 1 text contains no solutions; Stage 2 text lives in `stage2Solution`.

| Rule | What it does |
| --- | --- |
| `PLAN_PD` | Full planning likely: new area over 1,000 m2, over 50% of existing area, under 5 m from boundary, or higher than existing. Customer scope. |
| `BR_SCHED2_EXEMPT` | "May be exempt from building regs": detached, no sleeping, up to 30 m2; or temporary up to 28 days. Customer scope. |
| `A_LOADS_QUOTE` | Quote: postcode, altitude, exposure, roof solar (added load). |
| `B_BOUNDARY_FIRERATED_QUOTE` | Quote: "fire-rated wall needed on elevation X" when under `closeM` from boundary and cladding not stated as rated. Only drawn boundary lines (or the per-elevation answers) count; other buildings on the site are not boundaries. |
| `B_DOORS_QUOTE` | Quote: roller/sectional doors are not fire exits; over 25 m deep = a personnel door on each long side. |
| `B_ROOFLIGHTS` | Problem: rooflights near a boundary or with a fire wall. |
| `L_ROOFLIGHT_U_QUOTE` | Quote: heated + rooflights = U 2.2 max. |
| `M_ACCESS` | Problem: services = Yes. Stage 2: level threshold and accessible door. |
| `F_CONDENSATION` | Advice only (never a fail): unheated + vehicles/wet goods. Stage 2 text only. |
| `H_DRAINAGE_QUOTE` | Quote: gutters/downpipes by building supplier; surface water connection is customer scope. |
| `L_2027_HEATED` | Heated only. AD L 2026 edition from 24 Mar 2027: doors U 1.6; U-values unchanged (walls 0.26, roof 0.18, floor 0.18); energy calculation favours low-carbon heating. Old rules if BC application is before 24 Mar 2027 and work starts before `transitionEnd`. Quote: personnel doors U 1.6. |

### Fact keys the rules read (questions NOT yet added to the form - app.js is outside regs-checker, needs Stuart's go)

`planNewArea`, `planExistingArea` (m2), `planBoundaryDist` (m), `planHeight` (`higher` / `same or lower`); `regsDetached`, `regsSleeping` (Yes/No), `regsTempDays`; `regsAltitude` (m), `regsExposure`, `regsSolar` (Yes/No), project `postcode`; `regsBoundaryDist` {A,B,C,D} (fallback when no boundaries are drawn); `regsRooflights`, `regsFireWall`, `regsServices` (Yes/No - the heating/toilets/offices/services question does NOT exist yet), `regsVehiclesWet` (Yes/No). Missing = `need info`. Use the existing `regsQuestionSelect` / field styles so the form works on phone and laptop.

### Sources and UNKNOWNs

- Verified (legislation.gov.uk, GPDO 2015 SI 2015/596 Sch 2 Part 7 Class H): extensions limited to the lesser of 50% or 1,000 m2 of original floor space (lesser limits on article 2(3) land and SSSIs); no development within 5 m of the curtilage boundary. Class J is hard surfaces only, with no area/boundary/height limits.
- **UNKNOWN / differs from the brief:** a NEW separate building under Class H is limited to 200 m2 (100 m2 on article 2(3) land / SSSI), not 1,000 m2 - not coded. Height limits (5 m within 10 m of a boundary; otherwise the existing building / 15 m) - only "higher than existing" coded. Article 2(3)/SSSI land not asked. Check gov.uk guidance before approving.
- Verified (legislation.gov.uk, Building Regulations 2010 Sch 2): Class 4 temporary building not intended to stay over 28 days; Class 6 para 1 detached single storey up to 30 m2 needing no point under 1 m from the boundary OR substantially non-combustible. **UNKNOWN:** single-storey and 1 m/non-combustible conditions are not asked; sleeping-accommodation wording sits in Class 6 and a separate 15 m2 limb - confirm. Code uses "up to" 30 m2 and 28 days, as in the Schedule (brief said "under").
- **UNKNOWN (not verified, as supplied):** AD L 2026 edition 2027 values (U-values, doors 1.6, rooflights 2.2); transition period end (`transitionEnd` set to 24 Mar 2028 to match `L_2027`); rooflight boundary distance (`boundaryM` 6) and ADB table; "close to boundary" distance (`closeM` 25, same as `B_BOUNDARY`); "over 25 m deep" read as the longer plan dimension.
