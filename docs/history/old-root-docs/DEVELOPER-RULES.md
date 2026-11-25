> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

# Project Check — Developer Rules

The "DO NOT BREAK THESE" list. Each rule links to where it's actually governed — this document doesn't invent authority of its own, it just makes the rules impossible to miss.

**1. DO NOT CREATE PARALLEL EVIDENCE SYSTEMS.**
Reuse/extend the existing architecture in `evidence.js` (Evidence Intelligence, Planning Intelligence). See `CODE-MAP.md` for what already exists before writing something new. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` throughout — every batch explicitly states it extends, not duplicates, what came before.

**2. PRESERVE PROVENANCE.**
Do not collapse **uploader**, **originator**, **authority**, and **source location** into one field or one assumption. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` § "Supplier drawing intelligence" ("uploader ≠ originator ≠ authority") and § "Real-world Civils, Structural & Cross-Discipline Discovery".

**3. PROJECT-SPECIFIC FACTS NEVER LEAK ACROSS PROJECTS.**
Same supplier, same client, same professional, or same document family never means the same value applies to a different project. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` → "Project-specific knowledge isolation".

**4. "FOR APPROVAL" ≠ "APPROVED".**
Status/authority vocabularies are actor-specific — a designer's own submission-status language and an independent reviewing authority's status vocabulary are never the same thing and must never be merged. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` → "Conflict / gap / uncertainty concepts" (STATUS/AUTHORITY DISTINCTION).

**5. DOCUMENT EXISTS ≠ ENGINEERING ADEQUACY.**
Never infer adequacy, approval, currency, adoption, or closure from a document's mere presence. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` § "Professional safeguards — evidence certainty".

**6. DO NOT SILENTLY CHANGE STAGE 1.**
Questions, their order, and their wording are governed and require individual, one-at-a-time review — not a casual edit alongside other work. Governed by `MASTER-SPEC.md` § "Question, Evidence & Rule Development governance".

**7. STAGE 4 IS NOT FREE TO IMPLEMENT.**
It is recorded future architecture. Building any part of it requires its own explicit authorisation — it is not something to start "while you're in there." Governed by `MASTER-SPEC.md` § "Stage 1–4 continuity..." and confirmed unimplemented in `CURRENT-STATE.md`.

**8. DO NOT DELETE SOURCE EVIDENCE BASED ON FUTURE RETENTION IDEAS.**
No deletion or archival policy has been authorised — the retention question is explicitly recorded as an unresolved governance tension, not a decision. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` → "Retention / learning-without-permanent-source-storage" and `DECISION-LOG.md`.

**9. REFERENCED-BUT-ABSENT EVIDENCE IS NOT "NEVER EXISTED".**
A document referencing another document that isn't currently in the record must never be treated as proof that document never existed. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` → "Referenced-but-absent evidence".

**10. REVISION LETTER CHANGE ≠ KNOWN CONTENT CHANGE.**
A drawing/document moving from Rev A to Rev B does not by itself tell you what changed. Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` → "Revision / change intelligence" and the existing DI-02/DI-06 findings.

**11. PROFESSIONAL JUDGEMENT BOUNDARY.**
Automation may identify evidence, facts, and relationships. It must never silently become structural, fire, or regulatory professional judgement (adequacy, compliance, or approval decisions). Governed by `EVIDENCE-INTELLIGENCE-SPEC.md` § "Professional safeguards — evidence certainty" and → "Automatable evidence checks vs professional judgement (consolidated)".

**12. MINIMUM-SURFACE CHANGE RULE.**
Avoid broad refactors unless specifically authorised — even where a file has architecturally grown large or messy (see `CODE-MAP.md`'s cautions on `app.js`/`evidence.js`). Fix the thing you were asked to fix.

**13. TEST BEFORE COMMIT.**
Use `TEST-MAP.md` to work out which suite(s) actually cover what you changed, and what the accepted baseline looks like — including the known 22-failure debt you are not trying to fix.

**14. NO COMMIT/PUSH/DEPLOY WITHOUT TASK AUTHORISATION.**
Making a change and being authorised to commit/push/deploy it are two separate decisions. This has been the working pattern throughout this project's history (see `DECISION-LOG.md` and `CHANGELOG.md`) — do not conflate "the change is done" with "commit it."

**15. USE AUTHORITATIVE GOVERNANCE, NOT CHAT HISTORY.**
If you weren't given `MASTER-SPEC.md`/`EVIDENCE-INTELLIGENCE-SPEC.md`/a specific protected commit as your source, you don't have authority for a decision — go find it there, not in a remembered conversation. See `README-DEVELOPER.md` § "Governance hierarchy".
