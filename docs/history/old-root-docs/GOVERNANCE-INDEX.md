> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

# Project Check — Governance Index

Where the authoritative rules for each area actually live. This index does not duplicate specification text — it points to the exact file and section heading, and tells you whether that content is **IMPLEMENTED GOVERNANCE** (describes current running behaviour), **FUTURE ARCHITECTURE** (recorded, not built), or **HISTORICAL / AUDIT** (a record of what happened, not a rule to apply forward).

## 01 Product & Stages
| Section | File | Heading | Type |
|---|---|---|---|
| Customer journey, Stage 1/2/3 core spec | `Project-Check-MVP-Master-Build/MASTER-SPEC.md` | "Customer journey", "Stage 1", "Stage 2", "Stage 3 — commercial conversion objective" | IMPLEMENTED GOVERNANCE |
| Question/rule change control | `MASTER-SPEC.md` | "Question, Evidence & Rule Development governance" | IMPLEMENTED GOVERNANCE |
| Stage 2/3 continuity rule | `MASTER-SPEC.md` | "Combined Stage 2 / Stage 3 continuity rule" | IMPLEMENTED GOVERNANCE |
| Stage 1–4 continuity, cross-discipline intelligence, professional safeguards | `MASTER-SPEC.md` | "Stage 1–4 continuity & real-world engineering dependency" (+ its "Extension" paragraphs) | FUTURE ARCHITECTURE (Stage 1-3 parts already governed above; Stage 4 itself is future) |
| Pricing (£99/£249) | `MASTER-SPEC.md` | "Pricing" | IMPLEMENTED GOVERNANCE (selection only — see `CURRENT-STATE.md` re: payment) |

## 02 Evidence & Data
| Section | File | Heading | Type |
|---|---|---|---|
| Evidence model, status, provenance, integrity | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Document-level evidence model", "Fact-level provenance", "Evidence status", "Document integrity" | IMPLEMENTED GOVERNANCE |
| Cross-document discrepancy engine | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Cross-document discrepancy engine" | IMPLEMENTED GOVERNANCE |
| Evidence Intelligence Batches 1–5, 2A/2B | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Evidence Intelligence Batch 1" through "Batch 5" | IMPLEMENTED GOVERNANCE |
| Real-world engineering dependency principles, DI-01–DI-06, future data model, professional safeguards | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Real-world engineering dependency & revision intelligence", "Data Intelligence findings — DI-01 to DI-06", "Future data model concepts", "Professional safeguards — evidence certainty" | FUTURE ARCHITECTURE |
| Discovery-derived architecture (Civils/Structural/Fire/relationship/etc.) | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Real-world Civils, Structural & Cross-Discipline Discovery (2026-08-27)" and its sub-sections | FUTURE ARCHITECTURE |
| Supplier drawing intelligence | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Supplier drawing intelligence" | FUTURE ARCHITECTURE |
| Recorded real-project fire-strategy evidence | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Recorded project evidence: Job B storage building fire safety strategy" | HISTORICAL / AUDIT |

## 03 Planning
| Section | File | Heading | Type |
|---|---|---|---|
| Planning Intelligence Batches 1–5 | `EVIDENCE-INTELLIGENCE-SPEC.md` | "Planning Intelligence — Planning Batch 1 of 5" through "Planning Batch 5 of 5" | IMPLEMENTED GOVERNANCE |
| Stage 2 evidence-derived candidates / fire-strategy correction / personnel-door split | `MASTER-SPEC.md` | "Stage 2 evidence-derived candidates", "Job B fire-strategy evidence recorded", "Personnel doors / means-of-escape responsibility split" | IMPLEMENTED GOVERNANCE / HISTORICAL |

## 04 Civils
| Section | File | Heading | Type |
|---|---|---|---|
| Civils conceptual architecture | `EVIDENCE-INTELLIGENCE-SPEC.md` § "Real-world Civils, Structural & Cross-Discipline Discovery" → "Civils Intelligence — conceptual architecture" | FUTURE ARCHITECTURE |

No implemented governance exists for Civils — there is nothing to link here that describes live behaviour.

## 05 Structural / Supplier
| Section | File | Heading | Type |
|---|---|---|---|
| Structural/Supplier conceptual architecture | `EVIDENCE-INTELLIGENCE-SPEC.md` § "Real-world Civils, Structural & Cross-Discipline Discovery" → "Structural/Supplier Intelligence — conceptual architecture" | FUTURE ARCHITECTURE |
| Engineering dependency chain (reactions→foundation) | `EVIDENCE-INTELLIGENCE-SPEC.md` "Real-world engineering dependency & revision intelligence" | FUTURE ARCHITECTURE |

## 06 Building / Envelope / Fire
| Section | File | Heading | Type |
|---|---|---|---|
| Building/Envelope/Fire conceptual architecture, zoned specification, product-certification safeguard | `EVIDENCE-INTELLIGENCE-SPEC.md` § "Real-world Civils, Structural & Cross-Discipline Discovery" → "Building/Envelope/Fire Intelligence — conceptual architecture" | FUTURE ARCHITECTURE |
| Historical fire-strategy record + means-of-escape terminology + retired live calculation | `EVIDENCE-INTELLIGENCE-SPEC.md` "Recorded project evidence: Job B..." | HISTORICAL / AUDIT |

## 07 Drawings / Geometry
| Section | File | Heading | Type |
|---|---|---|---|
| Supplier drawing intelligence (extraction from uploaded drawings) | `EVIDENCE-INTELLIGENCE-SPEC.md` "Supplier drawing intelligence" | FUTURE ARCHITECTURE |
| Project geometry & drawings (Project Check's own model) | `MASTER-SPEC.md` "Project geometry & drawings", "Stage 2 door editing" | IMPLEMENTED GOVERNANCE |

## 08 Quote / Commercial Intelligence
| Section | File | Heading | Type |
|---|---|---|---|
| Quotation intelligence (existing narrow concept) | `EVIDENCE-INTELLIGENCE-SPEC.md` "Quotation intelligence" | IMPLEMENTED GOVERNANCE (narrow — manual log only, see `CURRENT-STATE.md`) |
| DI-03 quote normalisation + discovery-derived extension | `EVIDENCE-INTELLIGENCE-SPEC.md` "Data Intelligence findings" (DI-03), "Real-world Civils, Structural & Cross-Discipline Discovery" → "Quote normalisation / supplier due-diligence" | FUTURE ARCHITECTURE |
| Supplier journey / order-readiness dependencies | `MASTER-SPEC.md` "Supplier journey"; `EVIDENCE-INTELLIGENCE-SPEC.md` "Order-readiness dependencies" | IMPLEMENTED GOVERNANCE |

## 09 Stage 4 / Project Support
| Section | File | Heading | Type |
|---|---|---|---|
| Stage 4 framing, control loop, completion states | `MASTER-SPEC.md` "Stage 1–4 continuity..." (Stage 4 paragraph); `EVIDENCE-INTELLIGENCE-SPEC.md` "Real-world Civils, Structural & Cross-Discipline Discovery" → "Stage 1–4 progression", "Building Control / responsibility / handover architecture" | FUTURE ARCHITECTURE |

## 10 Tests & Technical Debt
| Section | File | Heading | Type |
|---|---|---|---|
| What tests exist and what they protect | `TEST-MAP.md` (this pack) | — | Navigation aid, points to real files in `tests/playwright/` |
| Known regression debt | `TEST-MAP.md` (this pack); historical figures also appear throughout `CHANGELOG.md` ("Existing full-suite regression-debt checkpoint...") | — | HISTORICAL / AUDIT (the debt itself is current, its *description* is historical) |

## 11 Governance / Decisions
| Section | File | Heading | Type |
|---|---|---|---|
| Status and authority of the evidence spec itself | `EVIDENCE-INTELLIGENCE-SPEC.md` "Status and authority" | IMPLEMENTED GOVERNANCE (meta) |
| Protected checkpoints | `DECISION-LOG.md` (this pack) | — | Navigation aid |
| Distilled major decisions | `DECISION-LOG.md` (this pack) | — | Navigation aid |
| Full historical change record | `Project-Check-MVP-Master-Build/CHANGELOG.md` | (dated entries, most recent first) | HISTORICAL / AUDIT |

---

**Reminder:** this index is a map, not the map's territory. When in doubt, open the linked file and read the actual heading — do not treat this table's short description as a substitute for the governing text.
