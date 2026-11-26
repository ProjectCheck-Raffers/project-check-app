# Upload review rules (from the job library)

How Project Check reads a client's uploaded documents (PDF, DWG, drawings, Building Control and planning packs) before the Stage 1 report. Learned from real jobs, mainly job B and job C (building 2). Evidence of what happened, not legal advice.

Rules apply to every upload. Each rule should lead to a clear "need info" line, never to silence.

## 1. Core rules

1. **Never guess a figure.** If a size, height, distance or rating is not on a document, it is need info.
2. **Missing data is need info, never an all-clear.** A report must not say "nothing missing" when documents are missing or unread.
3. **Classify each document first.** Record: type (quote, planning drawing, steel drawing, foundation drawing, calcs, fire strategy, decision notice, BC letter, photo, email), author's role, revision and date.
4. **Site must match the address.** Check the address, site plan and red line agree with the job. Flag a document that names a different site or job.
5. **Preliminary or TBC confirms nothing.** "Preliminary", "for comment", "TBC", "?" levels or a blank revision box are not confirmed figures.
6. **"By others" says nothing about the building.** Scope shown as "by others" (slab, drainage, civils, fire alarm) needs its own evidence from whoever owns it.
7. **Every fact needs a source.** Note the document, page or view, revision and date beside each figure.
8. **Conflicts are need info, with both values.** Write "length 24.0 m (contract) vs 24.4 m (steel drawing) – which is final?". Don't pick one silently.
9. **Unreadable files are need info.** Image-only scans, failed DWGs, huge files or broken zips: list them by name and ask for a dimensioned PDF. A DWG can be converted on the box, but still confirm key figures against a PDF.
10. **Use and nation first.** Building use (store, production, people inside) and nation (England, Wales, Scotland) decide which rules apply. If either is unclear, ask first.
11. **Compare dates.** Order every document by date. A later document overrides an earlier one only if it says so (revision, variation, approval).
12. **Read the whole upload.** Open zips file by file. Say exactly which files were read and which were not, with the reason.

## 2. Reading drawings

1. **Title block vs dimension lines.** Titles like "22x25x11 m [BxLxH]" or "11x50x6.5 m" often disagree with the drawn grid. Report the dimension lines and flag the title.
2. **Pitch from levels.** If pitch is not stated, calculate it from eave and ridge levels over the half span, and label it "calculated".
3. **Planning vs steel sizes.** Planning drawings usually give finished or internal sizes; steel drawings give grids and levels (e.g. 21.5 m internal vs 22.0 m grid). Always say which one a figure comes from.
4. **Two heights on one drawing.** Steel drawings can show a grid level and a slightly lower dimensioned height (about 130 mm apart on job C). Ask which datum each uses.
5. **Door width and height swaps.** Statements and descriptions often swap them ("4.6 m high x 5 m wide" vs 4.6 w x 5 h). Check against the elevation.
6. **Count doors and exits on every source.** Job B had three different exit counts across tender, fire strategy and steel drawings. Flag until one drawing confirms.
7. **Fire strategy is often written from planning drawings.** Check its wall types, door count, gable widths and building body against the steel drawings.
8. **Planning drawings may show a different building type.** Job B's planning drawings showed a PVC tent hall; a steel hall with panels was built. Flag material or form changes from what planning approved.
9. **Empty folders and blank templates are gaps.** A named but empty folder, a blank form or an unfilled template is missing, not submitted.
10. **Flag work started before approval or variation.** Inspection reports, photos and permits often prove a start date earlier than people remember.

## 3. Complete Building Control submission checklist

Taken from a real council full-plans request (job C, building 2). Use it on every job; ask for each item not on file.

1. Duty holders named: Principal Designer and Principal Contractor (not the client by default), plus a duty-holder compliance statement.
2. Structural calcs and drawings for the **final** height and size, foundation design with a **site investigation report**, and a method statement for attaching to or reusing any existing slab, base or building.
3. Existing and proposed plans and elevations of the whole building, existing plus new.
4. Fire strategy (travel distances, exits and widths, compartments, detection, emergency lighting) with **means of warning and escape drawings**, a **completed** fire-service form and Reg 38 fire information.
5. Fire-rated door evidence (EI rating) and **in-date** panic hardware certificates (job C's was years out of date).
6. Panel fire test or classification reports from the **actual** panel supplier.
7. Boundary fire spread calculation (BR 187) per elevation: minimum distance and unprotected area %.
8. Drainage layout on the site plan, with calculations.
9. Fire appliance access and hydrants plan.
10. Accessible (Part M) layouts.
11. Landscaping, access and parking; any deviations with justification.
12. **No digging before approval.** Completion notice signed only at completion. Completion certificate on file before the job is called closed.

If any folder for these items is empty, report it as missing.

## 4. Problems between the parties

Most of the trouble on job C (building 2) and job B was not the steel. It was what passed, or didn't pass, between the client, the client's planning designer, the steel supplier, the structural engineer, the civils contractor and Building Control. Each problem below has the warning sign to look for in an upload and what Project Check should ask at Stage 1.

### 4.1 Client and planning designer worked without the supplier (job C)
- **What happened:** the supplier's first design was 9 m eaves. The client then dealt directly with its planning designer, with no supplier contact, and planning went in at 7 m. The job went back to 9 m later. Eaves changed 9 m → 7 m → 9 m across quotes, planning and steel.
- **Warning sign:** planning drawings by a third party with no supplier drawing number; eave or ridge on planning drawings differs from the quote.
- **Ask:** "Who produced the planning drawings? Was the building supplier involved? Which eave height is confirmed, by whom, in writing?"

### 4.2 Height change never checked against the client's use (job C)
- **What happened:** 7 m would not fit the client's production machinery. When the height changed, each side assumed the other had checked clearance.
- **Warning sign:** eave changes between versions; no machine, racking or crane height on file.
- **Ask:** "What is the tallest machine, rack or lift height inside, plus clearance? Confirm in writing that the eave suits it."

### 4.3 Foundations designed on old loads and reused (job C)
- **What happened:** pads were designed from the 7 m reactions and dug before the final design. When the design went to 9 m, the new reactions roughly doubled some column loads and added uplift. Some pads were too small and needed extra concrete.
- **Warning sign:** foundation drawing older than the final steel or reactions revision; "reuse existing base or slab"; reactions labelled with an old height.
- **Ask:** "Which reactions revision were the foundations designed on? Is there a load comparison for the final design?"

### 4.4 Engineer's OK only verbal or by text (job C)
- **What happened:** the structural engineer said the pads were fine for 9 m by text message. No written confirmation followed, and work carried on.
- **Warning sign:** "engineer said OK", emails quoting a phone call, no signed calc or letter.
- **Ask:** "Please upload the engineer's written, dated confirmation for the final design." Until then: need info.

### 4.5 Civils by the client went wrong (job C)
- **What happened:** the civils contractor was appointed by the client. A pad was put in the wrong place, pads then had to go deeper, then be enlarged. The civils team came back four times. Groundwork had started before the supplier's contract was signed.
- **Warning sign:** groundworks by others; no setting-out drawing tied to steel grids; photos of pits before contract.
- **Ask:** "Who appointed the civils contractor? Is there a setting-out drawing checked against the steel grids, and a check before concrete is poured?"

### 4.6 Site not surveyed or squared (job C)
- **What happened:** site sizes were hand-measured and never squared. Opposite sides differed by about 0.5 m, the existing slab measured short of the design span, and clearances to existing buildings and the boundary were very tight.
- **Warning sign:** hand sketches with opposite sides that don't match; no topo or laser survey; clearances under about 0.5 m.
- **Ask:** "Please upload a measured survey (topo or laser) with diagonals, overlaid on the proposed building."

### 4.7 Three lengths across the documents (job C)
- **What happened:** 24.0 m (contract), 24.4 m (steel grids, permit) and 25.0 m (planning, drainage calcs, drawing title) were three different designs. No as-built survey says which was built.
- **Warning sign:** the same dimension with different values across uploads.
- **Ask:** list every value with its source and ask which is final.

### 4.8 Tunnel or extension scope kept changing (job C)
- **What happened:** the link into the existing building went from one opening to two, with widths of 3.0, 3.3 and 3.5 m across emails, sketches, planning and steel. It was never fixed on one signed drawing. Leaks later came in at the junction.
- **Warning sign:** an opening into an existing building with no surveyed opening drawing.
- **Ask:** "Please confirm the link or tunnel size on one signed drawing, and who seals the junction."

### 4.9 Design changed, price did not (job C)
- **What happened:** the quoted price stayed the same through several versions while eave, length and bracing changed.
- **Warning sign:** new quote revision with a new spec and identical total.
- **Ask:** "Is there a variation record for each design change?" (Price is for the supplier to check; Project Check flags the mismatch.)

### 4.10 Work before contract, approval and variation (jobs B and C)
- **What happened (C):** pad holes were dug before the contract and before any Building Control application. The completion notice was signed at the start of works. Steel was erected before the planning variation for extra height was granted.
- **What happened (B):** work started before the structural check was closed.
- **Warning sign:** photo or inspection dates before the approval or decision date.
- **Ask:** "Has work started? Please upload the approval and decision notices with dates."

### 4.11 Client-run Building Control rejected (job C)
- **What happened:** the client made its own Building Control application with no Principal Designer, no foundation calcs and no fire strategy. It was rejected. The supplier had to take over Building Control and a planning variation.
- **Warning sign:** client named as Principal Designer; application with only plans attached.
- **Ask:** the full checklist in section 3.

### 4.12 Water sealing promised, leaks followed (job C)
- **What happened:** the contract promised wall sealing against water. Leaks followed at wall bases, door thresholds, the tunnel junction and corners, mostly where client-scope slab, falls and drainage met the building.
- **Warning sign:** "sealing" or "watertight" in a quote with no detail drawing; slab and drainage by others.
- **Ask:** "Who owns falls, thresholds and drainage at the joins? Is there a detail drawing?"

### 4.13 Documents misfiled or carried over (job C)
- **What happened:** a crane quote was saved under a door supplier's name, method statement photos came from a different job, a handover template still named another client, and the final docs folder held an old superseded planning set.
- **Warning sign:** another job's name or address inside a file; file name not matching content.
- **Ask:** "Please confirm which documents are current and which are superseded."

### 4.14 Job B: checks left open
- Structural check still at "more information required", never closed on file.
- Fire exit count conflicted (3, 6 and 8 across documents).
- The canopy failed load tests and was redesigned.
- The building stayed un-transferred at handover because of defects.
- Duty-holder pack was blank; Building Control folders were empty.
- **Ask:** upload the closed structural check, the approved fire strategy matching the steel drawings, and the completion certificate.

## 5. What Project Check can do

1. **One key-figures sheet per job.** Span, length, eave, ridge, pitch, use clearance, doors and exits, tunnel or link, boundary distances. Each figure shows its source document, revision and date.
2. **Flag any figure that differs across uploads.** Show all values and sources; never choose one.
3. **Ask who owns each scope.** Planning designer, structural engineer, civils, fire strategy, Building Control: who appointed them, and was the supplier involved?
4. **Require written engineer confirmation** for any reuse of existing foundations or slabs, and for any height or size change after foundations are designed.
5. **Check use clearance vs eave.** Ask for the tallest machine or rack height on every job.
6. **Flag work before approval.** Compare photo, inspection and permit dates with contract, Building Control and planning dates.
7. **Run the section 3 checklist** against the uploaded Building Control pack and list every missing item.
8. **Document gaps in "Information still required".** Stage 1 must list missing or unreadable documents, not only empty form fields.

### Known gap (code not changed in this PR)
Stage 1 section 05 "Information still required" only lists missing form fields. When none are missing it shows "No information is missing from the sections above." even if uploaded documents are missing, unread or in conflict. That is a false all-clear and breaks rule 1.2. Code: `Project-Check-MVP-Master-Build/app.js` (around lines 1792–1793). The fix needs a separate PR with Stuart's yes.
