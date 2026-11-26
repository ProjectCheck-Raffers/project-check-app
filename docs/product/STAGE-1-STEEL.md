> **Migrated 25 Nov 2026** from an earlier private repo. Client jobs anonymised as Job A–O. Full anonymised job records are in docs/job-library.

# Stage 1 · Free-standing steel buildings

The first check is for industrial customers establishing a project. Use plain language suitable for business owners and facilities, operations and project teams. A person's role belongs to the individual project. Project Mount is a synthetic browser-review fixture.

## Customer pages and ownership

| Page | Inputs or use |
| --- | --- |
| Project Overview | Shows active project, saved details, document count, preliminary ridge and completion. |
| Project Details | Owns project name, role, building use/type, proposed address, length, width, required clear height, roof pitch, temperature, existing surface, reuse intention and site-information availability. |
| Initial Questions | Collects the two remaining questions below. Map position follows personnel doors, then the boundary step, then the Stage 1 confirmation. Map steps can record a skip. The level, services, close-boundary and programme questions were removed on 2026-11-14; old saved answers still load and are not asked again. |
| Project Documents | Links survey, drawing and other supporting evidence to the same project. An available file is evidence to review. |
| Project Summary | Reviews current project facts, calculated ridge and missing or unconfirmed information. Records that the summary was reviewed. |
| Site Layout | Uses the current footprint dimensions and presents observations triggered by substrate, reuse, visible levels, drains and services. Geometry edits can require reconfirmation. |
| Building Design | Uses confirmed layout, dimensions and roof geometry. Building use and temperature inform preliminary envelope context. |
| Stage 1 Free Report | Uses the latest project facts and preliminary observations. A reviewed summary and complete required inputs allow report generation. Skipped map steps remain evidence gaps. |

Project Details uses `name` and `address` on the project. The `facts` fields are `role`, `buildingUse`, `buildingType`, `length`, `width`, `height` (required clear height), `roofPitch`, `temperatureCondition`, `requiredTemperatureC`, `base`, `intendsToReuseExistingBase` and `siteEvidenceAvailability`. Legacy heating and surface answers remain readable without creating extra questions. Current details control current steel outputs.

- **What temperature conditions will the building need?** Ambient working temperature — heated, Ambient storage — unheated, Other temperature requirement, Not sure yet. Other requires the **Required internal temperature (°C)**. A value below 2°C raises a specialist-review flag.
- **What is currently on the proposed building area?** Concrete slab or concrete hardstanding, Newly designed concrete base suitable for structure, Tarmac or asphalt, Hardcore or stone, Soil or grass, Mixed surfaces, Not sure.
- **Would you like to use the existing surface if it proves suitable?** Yes — assess it for reuse, No — a new base is planned, Not sure.
- **Do you have any drawings, surveys or other information for the proposed building area?** Yes — upload them now, Yes — I will upload them later, No, Not sure. Show after Yes or Not sure on reuse. Upload-now saves the details and opens Project Documents.

| Initial Question | Field | Answer |
| --- | --- | --- |
| How many vehicle doors do you expect to need? | `rollerCount` | Count (0–20) only. The former Stage 1 roller-door sizes/access page was removed on 2026-11-14; door sizes and access are set in Building Design. |
| How many personnel doors do you expect to need? | `personnelDoors` | Count for ordinary access. |

## Completion and free report

### Roller-door requirements and drawing

Initial Questions owns `facts.rollerCount` only. The count is saved directly and the journey continues to the next question; no door size or access details are collected in Stage 1 and completion never waits for them. A submitted zero is an explicit requirement. Saved `facts.rollerDoors` entries from earlier projects (clear width, height, access and dimension source) still load, are shown in the requirement comparison, and are used when Building Design first derives its drawing; they are trimmed only if the count is later reduced below the number saved. When no sizes exist, Building Design seeds one roller door per counted vehicle door at a fallback 4.6 m × 4.0 m, which the customer edits there.

Building Design owns `geometry.doors`, including roller doors, casement windows, personnel doors, wall and placement. Saving or confirming the drawing for a free-standing steel project preserves the customer requirements. Saving the customer requirements preserves the drawing. Building Design, Project Summary and the free report show requirement and drawing values separately and flag missing values or differences for review. Historical requirements previously marked as copied from geometry need customer confirmation.

The menu derives question count and progress from the active record. It shows distinct states for answers, summary review, layout, design and the completed report. Documents are optional evidence. Stage 2 appears as Locked. Review the Project Summary before opening the report. If site mapping or design is outstanding, the free report can still explain the gaps after the initial map steps have been addressed or skipped.

The report identifies customer-entered facts, calculated information, checks still needed and potential issues. It explains the envelope and base evidence gaps, including relevant support reactions, anchoring, levels, drainage and services. All geometry and conclusions are preliminary. Detailed solutions and competent structural, civils, fire, envelope and statutory verification are outside the free report. See [Future work](FUTURE-WORK.md).
