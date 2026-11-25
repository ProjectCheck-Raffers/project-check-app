> **ARCHIVED – reference only, not used by the app.** Copied 25 Nov 2026 from the private repo Project-Check-Brain (branch main). The app does not load, import or test anything in this folder. Do not wire it in. The live rules are Project-Check-MVP-Master-Build/regs-checker/.

# Project Check Brain — Governance

Controls for how the Brain repository is changed and how its content relates to the application repository's own governance. This document does not itself approve, migrate or alter any content — it establishes the rules that any future Brain change (including migration) must follow.

## 1. Brain changes and application changes are different classes of change

A change to this repository (Project-Check-Brain) and a change to the application repository (Project-Check-MVP-Master-Build) are never the same action, even when they concern the same underlying rule. Each has its own review, its own commit history, and its own approval — one is never a side effect of the other.

## 2. Governed subject matter requires Project Check Question/Evidence/Rule governance

Brain changes involving questions, rules, technical assumptions, evidence logic, findings, actions, classifications, calculations or customer-facing reasoning require Project Check's existing Question/Evidence/Rule Development governance (see the application repository's `MASTER-SPEC.md` § "Question, Evidence & Rule Development governance" and `EVIDENCE-INTELLIGENCE-SPEC.md`). Being recorded in this repository does not create a separate, lesser approval path.

## 3. Existing rules begin from their existing governed status

Migration does not reopen settled decisions. A rule that is LOCKED/APPROVED, RECORDED FUTURE ARCHITECTURE, RETIRED, or otherwise classified in the application repository's governance arrives in the Brain repository carrying that same status. Moving a rule's location is not itself a re-review of the rule.

## 4. Provenance must be retained

Every migrated rule must record where it came from: source file, source location (line/section), the governance document that authorised it, and the date/commit it was migrated at. Provenance is never dropped for convenience.

## 5. CONFIRMED / PROPOSED / ASSUMED / SUPERSEDED distinctions must be preserved

A rule's certainty/status classification travels with it. Migration must never silently upgrade a PROPOSED or ASSUMED rule to CONFIRMED, and must never silently drop a SUPERSEDED rule's history.

## 6. No migrated Brain rule may be deleted from the application repository until

- its Brain equivalent exists,
- its provenance is recorded,
- appropriate regression tests exist and pass,
- application integration is verified,
- SPA has approved removal.

All five conditions must hold. Any one missing means the application-repository copy stays exactly where it is.

## 7. Migration method

```
COPY → VERIFY → TEST → INTEGRATE → VERIFY AGAIN → ONLY THEN CONSIDER REMOVAL
```

No step may be skipped or reordered. "Consider removal" is not "perform removal" — removal itself is gated by control 6 above and requires its own separate authorisation.

## 8. No real customer evidence or personal/customer project data belongs in this repository

No customer project records, no customer-uploaded evidence, no real customer names, addresses, dimensions, drawing numbers, technical values or commercial figures. Synthetic/anonymised examples only, exactly as the application repository's own `EVIDENCE-INTELLIGENCE-SPEC.md` has always required for its own worked examples.

## 9. Security testing applies progressively as Brain/API attack surfaces develop

As soon as this repository exposes any interface the application repository (or anything else) calls over a network — an API, a service, a webhook — that surface is brought into scope for the same standard of security review the application repository already applies (see its `security-readiness.md` and `.github/copilot-instructions.md`). A purely file-based, no-runtime Brain repository has no such surface yet; this control exists so that changes not deferred.

## 10. The Brain must be independently versioned

This repository has its own commit history, its own branch, and its own releases/tags where relevant — it is never versioned as a hidden component of the application repository's own version history.
