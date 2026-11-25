
// Project Check — Evidence Intelligence: extraction + provenance +
// cross-document checking ONLY (see EVIDENCE-INTELLIGENCE-SPEC.md and
// MASTER-SPEC.md § "Question, Evidence & Rule Development governance").
//
// STAGE-INDEPENDENT: this module knows nothing about Stage 1/2/3 questions,
// risk cards or reports. It reads project evidence-file text and produces one
// project-level, stage-independent evidence ledger (`p.evidenceRecords`),
// reusing the existing `p.evidence` file-metadata array as its input rather
// than creating a second parallel upload store. Nothing in this file is wired
// into Stage 1 answers, Stage 2 findings, Stage 3 actions or PDF reports —
// that wiring is explicitly deferred to a later, separately-governed batch.
//
// Batch 1 (2026-08-26): plain-text files only (.txt/.md/.csv/.log/.json, or a
// text/*/application/json MIME type), via the standard File.text() API — the
// one format a browser can read with zero new dependency.
//
// Batch 1B (2026-08-26): extends the SAME pipeline (one extraction dispatcher,
// one evidence schema, one status/corroboration/conflict engine — no second
// system) to genuinely read real PDF and DOCX files — see
// "Real file text extraction (Batch 1B)" below for isPdfFile()/isDocxFile()/
// extractTextFromPdf()/extractTextFromDocx()/extractEvidenceText(). Image-
// only/scanned PDFs are explicitly NOT OCR'd (out of scope) — see
// EXTRACTION_STATUS.OCR_REQUIRED. Every extraction path is wrapped so a
// malformed/corrupted file can never crash the customer journey — see
// EXTRACTION_STATUS.EXTRACTION_FAILED.

// pdf.js needs its worker script's URL configured before first use. Same-
// origin, vendored copy (see index.html) — pinned to the exact version of
// pdf.min.js loaded there. Guarded so this file still loads harmlessly (PDF
// extraction simply reports EXTRACTION_STATUS.UNSUPPORTED, see
// extractTextFromPdf()) if pdf.min.js ever failed to load for any reason.
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdfjs/pdf.worker.min.js';
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

// At minimum the 5 required by governance, plus one extra (DOCUMENT_INTERNAL_
// INCONSISTENCY) for the "a document contradicts itself" case the brief asks
// to be detectable separately from a *cross*-document conflict.
const EVIDENCE_STATUS = {
  CONFIRMED_BY_DOCUMENT: 'CONFIRMED_BY_DOCUMENT',
  ASSUMED_IN_DOCUMENT: 'ASSUMED_IN_DOCUMENT',
  PROVISIONAL: 'PROVISIONAL',
  CONFLICTING_EVIDENCE: 'CONFLICTING_EVIDENCE',
  NOT_YET_KNOWN: 'NOT_YET_KNOWN',
  DOCUMENT_INTERNAL_INCONSISTENCY: 'DOCUMENT_INTERNAL_INCONSISTENCY'
};

// Broad document-type taxonomy from the brief. 'other_project_evidence' is
// the deliberate low-certainty fallback — classifyDocumentType() must never
// force a confident match where the text doesn't clearly support one.
const DOCUMENT_TYPES = [
  'site_investigation_geotechnical',
  'structural_report_calculation',
  'foundation_base_design',
  'groundworks_quotation',
  'supplier_quotation',
  'planning_document',
  'building_control_document',
  'fire_strategy',
  'drainage_information',
  'utility_service_survey',
  'drawing',
  'specification',
  'other_project_evidence'
];

// ---------------------------------------------------------------------------
// File readability / extraction status (Batch 1B extends Batch 1's status
// vocabulary to cover real PDF/DOCX outcomes — ONE shared vocabulary across
// every format, not a separate status system per file type).
// ---------------------------------------------------------------------------

const EXTRACTION_STATUS = {
  EXTRACTED: 'EXTRACTED',                 // full text successfully extracted
  PARTIAL: 'PARTIAL',                     // some but not all content extracted (e.g. a mixed PDF: some pages have a text layer, some don't)
  OCR_REQUIRED: 'OCR_REQUIRED',           // PDF has no extractable text layer at all (image-only/scanned) — never OCR'd here
  UNSUPPORTED: 'UNSUPPORTED',             // no extractor exists in this prototype for this file type
  EXTRACTION_FAILED: 'EXTRACTION_FAILED'  // recognised type, but parsing threw / file is malformed / over the size limit
};

// Conservative allow-list: only formats a browser can genuinely read as text
// without any parsing library. Extension check is a fallback for files saved
// with a generic/empty MIME type (common on Windows for .txt/.md/.log).
function isTextReadableFile(file) {
  if (!file) return false;
  if (typeof file.type === 'string' && file.type.indexOf('text/') === 0) return true;
  if (file.type === 'application/json') return true;
  return /\.(txt|md|markdown|csv|log|json)$/i.test(file.name || '');
}
function isPdfFile(file) {
  if (!file) return false;
  if (file.type === 'application/pdf') return true;
  return /\.pdf$/i.test(file.name || '');
}
function isDocxFile(file) {
  if (!file) return false;
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  return /\.docx$/i.test(file.name || '');
}

// Hard processing limits, so a very large or pathological upload can't hang
// the browser — reported here, not silently enforced (see extractEvidenceText()
// and extractTextFromPdf()/extractTextFromDocx() below, all of which record a
// truncation note whenever a limit is actually hit, per instruction never to
// truncate silently).
const MAX_FILE_BYTES = 25 * 1024 * 1024;   // 25 MB — generous for a typical report/quotation PDF or DOCX
const MAX_PDF_PAGES = 200;                 // pages beyond this are not processed
const MAX_EXTRACTED_CHARS = 2 * 1024 * 1024; // 2 MB of extracted text per document is ample for any real report

// ---------------------------------------------------------------------------
// Evidence record factory
// ---------------------------------------------------------------------------

let evidenceIdCounter = 0;
function nextEvidenceId() {
  // Short, readable, collision-safe within a single ledger build — same
  // spirit as the app's other generated ids (rd1/pd1 etc.), not a UUID, since
  // these are meant to be human-scannable in the internal review table.
  evidenceIdCounter += 1;
  return 'ev-' + Date.now().toString(36) + '-' + evidenceIdCounter;
}

function createEvidenceRecord(fields) {
  return Object.assign({
    evidence_id: nextEvidenceId(),
    project_id: null,
    source_file: null,
    source_document_type: null,
    source_document_type_confidence: null,
    source_page_or_section: 'not identified',
    // document_date/revision (2026-08-26 Evidence Meaning/Provenance/Maturity
    // enhancement): explicit schema slots for the two provenance fields
    // EVIDENCE-INTELLIGENCE-SPEC.md's "Fact-level provenance" architecture
    // names (document date, revision) that this prototype has never actually
    // extracted from a document's content — always null today. Recorded here
    // rather than silently omitted, so a future batch that adds real date/
    // revision detection has an agreed field to populate, not a schema
    // change of its own. No date/revision extraction logic is added by this
    // change — see the task report.
    document_date: null,
    revision: null,
    subject: null,
    extracted_value: null,
    unit: null,
    evidence_status: EVIDENCE_STATUS.NOT_YET_KNOWN,
    confidence: 'medium',
    // evidence_function / evidence_maturity (2026-08-26 enhancement): copied
    // through from the source document's own classification (see
    // classifyEvidenceFunction()/deriveEvidenceMaturity() below and
    // buildProjectEvidenceLedger()) — a DOCUMENT-level concept attached to
    // each fact extracted from that document for context, never itself
    // driving evidence_status/confidence/corroboration/conflict logic above,
    // which are completely unchanged. Arrays, since a document is not forced
    // into exactly one function/maturity state (see "Do not force one
    // document to have only one evidence function").
    evidence_function: [],
    evidence_maturity: [],
    // packages / scope (Batch 2A, 2026-08-26): `packages` copied through from
    // the source document's own classification (see classifyPackages() below
    // and buildProjectEvidenceLedger()) — document-level, multi-label, same
    // pass-through pattern as evidence_function/evidence_maturity above.
    // `scope` is fact-level and narrower — computed from THIS fact's own
    // sentence context (see classifyFactScope()) — null when no narrower
    // scope is evidenced, never a guessed default. Neither field is a
    // responsibility/ownership concept (see the Batch 2A section below) and
    // neither drives evidence_status/confidence/corroboration/conflict logic.
    packages: [],
    scope: null,
    // approx_wording (Batch 3, 2026-08-26): true when this fact's own source
    // sentence used approximate wording ("approximately"/"about"/"~"/etc.) —
    // see APPROX_WORDING/classifyDiscrepancy() below. A plain contextual
    // signal only; never itself changes evidence_status/confidence.
    approx_wording: false,
    extraction_note: '',
    corroborates: [],
    conflicts_with: [],
    created_at: Date.now(),
    superseded_by: null
  }, fields);
}

// ---------------------------------------------------------------------------
// Document type classification — simple, transparent keyword scoring.
// Deliberately not a black-box ML classifier: every match is inspectable via
// matched_terms, and ties/weak signals fall back to 'other_project_evidence'
// at 'low' confidence rather than guessing.
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_KEYWORDS = [
  { type: 'site_investigation_geotechnical', terms: ['site investigation', 'geotechnical', 'trial pit', 'borehole', 'made ground', 'bearing pressure', 'ground conditions', 'ground investigation'] },
  { type: 'structural_report_calculation', terms: ['structural calculation', 'structural report', 'structural design', 'load calculation', 'wind load', 'dead load', 'imposed load'] },
  { type: 'foundation_base_design', terms: ['foundation design', 'pad foundation', 'foundation schedule', 'base design', 'slab design'] },
  { type: 'groundworks_quotation', terms: ['groundworks', 'ground-bearing slab', 'ground bearing slab', 'excavation', 'imported fill', 'gas membrane', 'quotation', 'provisional sum', 'dpm'] },
  { type: 'supplier_quotation', terms: ['quotation', 'quote', 'price', 'lead time', 'delivery', 'ex works', 'payment terms'] },
  { type: 'planning_document', terms: ['planning permission', 'planning application', 'planning condition', 'local planning authority', 'planning committee'] },
  { type: 'building_control_document', terms: ['building control', 'building regulations', 'approved inspector', 'completion certificate'] },
  { type: 'fire_strategy', terms: ['fire strategy', 'means of escape', 'fire safety strategy', 'fire resistance', 'travel distance', 'compartmentation'] },
  { type: 'drainage_information', terms: ['drainage', 'soakaway', 'attenuation', 'surface water', 'foul water', 'sewer'] },
  { type: 'utility_service_survey', terms: ['utility survey', 'service survey', 'underground services', 'cat scan', 'plant survey'] },
  { type: 'drawing', terms: ['drawing no', 'rev.', 'scale 1:', 'elevation', 'plan view', 'general arrangement'] },
  { type: 'specification', terms: ['specification', 'clause', 'material schedule', 'product data sheet'] }
];

function classifyDocumentType(text, filename) {
  const lower = (text || '').toLowerCase();
  const scores = DOCUMENT_TYPE_KEYWORDS.map(entry => {
    const matched = entry.terms.filter(t => lower.indexOf(t) !== -1);
    return { type: entry.type, score: matched.length, matched };
  }).sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];
  // Require a real signal (>=1 match) and a clear lead over the runner-up —
  // an exact tie, or zero matches, is 'other_project_evidence'/'low', never a
  // confident guess dressed up as certainty.
  if (!top || top.score === 0) {
    return { type: 'other_project_evidence', confidence: 'low', matched_terms: [], note: `No recognised document-type keywords found in "${filename || 'this file'}" — classified as other project evidence pending manual review.` };
  }
  if (second && second.score === top.score) {
    return { type: 'other_project_evidence', confidence: 'low', matched_terms: top.matched, note: `Ambiguous between "${top.type}" and "${second.type}" (equal keyword signal) — not confidently classified.` };
  }
  const confidence = top.score >= 3 ? 'high' : (top.score === 2 ? 'medium' : 'low');
  return { type: top.type, confidence, matched_terms: top.matched, note: `Classified as "${top.type}" on keyword match: ${top.matched.join(', ')}.` };
}

// =============================================================================
// COMMON EVIDENCE INTELLIGENCE LAYER — Batch 1 (2026-08-27): Document Identity
// & Provenance. Internal name only — this is NOT a new customer-facing
// discipline. See EVIDENCE-INTELLIGENCE-SPEC.md § "Real-world Civils,
// Structural & Cross-Discipline Discovery" for the governance this batch
// implements the first primitives of, and § "Data Intelligence findings —
// DI-01 to DI-06" (DI-01 in particular).
//
// Scope, exactly as authorised: a reusable, project-isolated document
// identity/provenance model + conservative identity-certainty matching +
// conservative current-applicability. NOT a fact-extraction engine, NOT a
// relationship/dependency engine, NOT Civils/Structural/Fire/Quote/Drawing
// intelligence, NOT Stage 4. Reuses the EXISTING evidence ledger
// (p.evidence, classifyDocumentType() above, computeTextFingerprint()/
// Planning's source_type/portal_* fields below) — no second evidence
// system, no second upload store.
//
// Hard governance rules this section exists to enforce in code, not just
// prose (EVIDENCE-INTELLIGENCE-SPEC.md "Supplier drawing intelligence",
// "Project-specific knowledge isolation", "Document identity certainty"):
//   SOURCE LOCATION ≠ UPLOADER ≠ ORIGINATOR ≠ AUTHORITY.
//   Project A's documents/facts never match/merge into Project B's.
//   Filename similarity ALONE never establishes an exact identity match.
//   A revision/issue identifier and a status phrase are different concepts —
//   "FOR APPROVAL" is never silently converted to "APPROVED".
//   "Newest/highest revision/latest upload" is never itself evidence of
//   current applicability.
// =============================================================================

// Document identity/matching certainty. Deliberately a SEPARATE vocabulary
// from PLANNING_IDENTITY_CONFIDENCE (below, in the Planning Batch 5
// section) — that one answers "which planning APPLICATION does this
// PROJECT relate to" (project→application identity); this one answers
// "does DOCUMENT X match DOCUMENT Y" (document→document identity). They
// are conceptually related but not the same question, so they are not
// merged into one enum and PLANNING_IDENTITY_CONFIDENCE is left untouched.
const DOCUMENT_IDENTITY_CERTAINTY = {
  EXACT_MATCH: 'EXACT_MATCH',
  PROBABLE_MATCH: 'PROBABLE_MATCH',
  POSSIBLE_MATCH: 'POSSIBLE_MATCH',
  NO_MATCH: 'NO_MATCH',
  IDENTITY_UNKNOWN: 'IDENTITY_UNKNOWN'
};

// Conservative current-applicability states (EVIDENCE-INTELLIGENCE-SPEC.md
// "Real-world Civils, Structural & Cross-Discipline Discovery" §9). This
// batch does not build the full referenced/superseded relationship engine
// (§10 boundary) — KNOWN_CURRENT is intentionally unreachable from this
// batch's own logic alone (see assessDocumentCurrentApplicability() below);
// it exists so a later batch that adds real independent-authority
// confirmation has a state to move into, not a schema change of its own.
const DOCUMENT_CURRENT_APPLICABILITY = {
  KNOWN_CURRENT: 'KNOWN_CURRENT',
  POSSIBLY_CURRENT: 'POSSIBLY_CURRENT',
  SUPERSEDED: 'SUPERSEDED',
  CURRENT_APPLICABILITY_UNKNOWN: 'CURRENT_APPLICABILITY_UNKNOWN'
};

// Delivery source — HOW a document reached Project Check, never WHO wrote
// it. Reuses the existing Planning Batch 5 `source_type` field on a
// p.evidence entry (already 'PLANNING_PORTAL' for portal-ingested
// documents — see ingestPlanningPortalDocument() below) rather than
// inventing a parallel field; a plain upload has no source_type today, so
// it maps to UPLOAD here.
const DOCUMENT_DELIVERY_SOURCE = {
  UPLOAD: 'UPLOAD',
  PLANNING_PORTAL: 'PLANNING_PORTAL'
};

let documentIdentityIdCounter = 0;
function nextDocumentIdentityId() {
  documentIdentityIdCounter += 1;
  return 'docid-' + Date.now().toString(36) + '-' + documentIdentityIdCounter;
}

// The common, reusable, minimum document identity/provenance model
// (EVIDENCE-INTELLIGENCE-SPEC.md "Common document/evidence concepts" §
// N/O). No field is required — every field defaults to null/UNKNOWN and
// must stay that way unless genuinely evidenced. Never invent a value to
// complete this model.
function createDocumentIdentity(fields) {
  return Object.assign({
    document_identity_id: nextDocumentIdentityId(),
    project_id: null,          // hard project-isolation key — see assessDocumentIdentityMatch()
    document_family: null,     // reuses classifyDocumentType() output above — never re-derived
    document_title: null,      // only set where genuinely evidenced — NEVER fabricated from the filename
    document_number: null,     // no generic drawing/document-number extraction exists yet — stays UNKNOWN in this batch
    revision: null,            // see detectDocumentRevisionToken() — a version identifier, never a status
    status: null,              // see detectDocumentStatusToken() — an actor-stated status phrase, verbatim, never reinterpreted
    document_date: null,
    originator: null,          // who produced the information — NEVER inferred from delivery_source/uploader
    delivery_source: null,     // DOCUMENT_DELIVERY_SOURCE — how the file arrived, NEVER treated as who authored it
    source_file: null,         // filename — kept distinct from document_title
    authority: null,           // reviewing/authority body, ONLY where independently evidenced — never inferred from delivery_source or originator
    content_fingerprint: null, // reuses computeTextFingerprint() below — strongest available match signal
    current_applicability: DOCUMENT_CURRENT_APPLICABILITY.CURRENT_APPLICABILITY_UNKNOWN,
    identity_notes: [],
    created_at: Date.now()
  }, fields);
}

// Revision/issue token detector — deliberately narrow: only a token shaped
// like a real revision/issue identifier (e.g. "Rev A", "P1", "FA0",
// "Revision 3"), immediately after an explicit "Revision"/"Rev"/"Issue"
// label. Never a bare guess from an isolated letter/number in the text.
function detectDocumentRevisionToken(text) {
  const s = text || '';
  const m = s.match(/\b(?:revision|rev\.?|issue)\s*[:\-]?\s*([A-Za-z]{0,2}\d{0,3}[A-Za-z]{0,2})\b/i);
  if (m && m[1] && /[A-Za-z0-9]/.test(m[1])) {
    return { value: m[1].toUpperCase(), note: `Matched an explicit revision/issue label in the source text ("${m[0].trim()}").` };
  }
  return { value: null, note: 'No explicit revision/issue label found in the extracted text.' };
}

// Status-phrase detector — recognises common ACTOR-STATED status phrases
// VERBATIM. Never converts one into another (the hard "FOR APPROVAL" ≠
// "APPROVED" rule) and never attempts to determine an independent
// reviewing authority's OWN status vocabulary (e.g. a Building Control
// A/B/C outcome) — that remains a distinct, unbuilt concept.
const DOCUMENT_STATUS_TOKENS = ['FOR APPROVAL', 'FOR CONSTRUCTION', 'ISSUED FOR PLANNING', 'PRELIMINARY', 'APPROVED', 'DRAFT', 'FINAL', 'SUPERSEDED'];
function detectDocumentStatusToken(text) {
  const upper = (text || '').toUpperCase();
  const found = DOCUMENT_STATUS_TOKENS.find(tok => upper.indexOf(tok) !== -1);
  if (found) return { value: found, note: `Matched the literal status phrase "${found}" in the source text — recorded verbatim, never reinterpreted as a different status.` };
  return { value: null, note: 'No recognised status phrase found in the extracted text.' };
}

// Populates a document identity from what is ALREADY known about one
// p.evidence entry — no new fact-extraction engine (§11 boundary). Safe to
// call on a document with no extracted text at all (mirrors the existing
// classifyDocumentType()/classifyEvidenceFunction() idempotent pattern in
// buildProjectEvidenceLedger() below).
function buildDocumentIdentity(e, p) {
  if (!e) return createDocumentIdentity({});
  const text = e.extractedText || '';
  const revisionDetect = detectDocumentRevisionToken(text);
  const statusDetect = detectDocumentStatusToken(text);
  const isPortal = e.source_type === 'PLANNING_PORTAL';
  const identity = createDocumentIdentity({
    project_id: (p && p.id) || null,
    document_family: e.documentType || null,
    // Portal metadata (Planning Batch 5) is itself already evidence-gated —
    // reused here, never re-derived. A plain upload's title/date stay
    // UNKNOWN — this batch adds no generic title/date extraction.
    document_title: isPortal ? (e.portal_document_title || null) : null,
    document_date: isPortal ? (e.portal_document_date || null) : null,
    revision: revisionDetect.value,
    status: statusDetect.value,
    originator: null,
    delivery_source: isPortal ? DOCUMENT_DELIVERY_SOURCE.PLANNING_PORTAL : DOCUMENT_DELIVERY_SOURCE.UPLOAD,
    source_file: e.name || null,
    // portal_authority_name is Planning Batch 5's own already evidence-gated
    // authority field (the Local Planning Authority a portal source
    // belongs to) — a genuinely independent fact, not an inference from
    // delivery_source or uploader identity.
    authority: isPortal ? (e.portal_authority_name || null) : null,
    content_fingerprint: e.content_fingerprint || (text ? computeTextFingerprint(text) : null),
    identity_notes: [revisionDetect.note, statusDetect.note]
  });
  identity.current_applicability = assessDocumentCurrentApplicability(identity);
  return identity;
}

// Conservative, evidence-driven identity matching between two documents —
// this batch's ONLY comparison primitive; no general relationship engine
// (§7/§10 boundary — this does not create/store a relationship, it only
// answers "how certain is an identity match between these two"). Project
// isolation is absolute — but precisely scoped: a KNOWN, DIFFERENT project_id
// is the only route to NO_MATCH; an unknown/unidentified project_id is
// identity uncertainty, never treated as a negative match, and never a safe
// basis for EXACT_MATCH either (see the precision-repair comment below).
function assessDocumentIdentityMatch(a, b) {
  if (!a || !b) return { certainty: DOCUMENT_IDENTITY_CERTAINTY.IDENTITY_UNKNOWN, reason: 'One or both documents are missing.', matched_signals: [] };

  const aProjectKnown = a.project_id != null;
  const bProjectKnown = b.project_id != null;

  // A. Both projects KNOWN and DIFFERENT — the only genuine, supported
  // negative identity conclusion this function ever produces. This is
  // deliberately the sole route to NO_MATCH.
  if (aProjectKnown && bProjectKnown && a.project_id !== b.project_id) {
    return { certainty: DOCUMENT_IDENTITY_CERTAINTY.NO_MATCH, reason: 'Documents belong to two different, identified projects — cross-project matching is never performed.', matched_signals: [] };
  }

  // Precision repair (2026-08-27): missing/unidentified project association
  // on either side is IDENTITY UNCERTAINTY — it must NEVER become NO_MATCH
  // (unknown evidence is not negative evidence) and must NEVER be treated as
  // a safe basis for a confident/exact match either (unknown project
  // association must not bypass project isolation). EXACT_MATCH is reserved
  // for documents CONFIRMED to share a known project — see the `!projectUncertain`
  // gate below. B (both known and the SAME project) is the only case where
  // `projectUncertain` is false and the full certainty range remains
  // available, unchanged from before this repair.
  const projectUncertain = !aProjectKnown || !bProjectKnown;

  const signals = [];
  if (a.content_fingerprint && b.content_fingerprint && a.content_fingerprint === b.content_fingerprint) signals.push('content_fingerprint');
  if (a.document_number && b.document_number && a.document_number === b.document_number) signals.push('document_number');
  if (a.revision && b.revision && a.revision === b.revision) signals.push('revision');
  if (a.document_date && b.document_date && a.document_date === b.document_date) signals.push('document_date');
  if (a.document_title && b.document_title && a.document_title === b.document_title) signals.push('document_title');
  if (a.originator && b.originator && a.originator === b.originator) signals.push('originator');
  if (a.document_family && b.document_family && a.document_family === b.document_family) signals.push('document_family');
  const filenameOnly = signals.length === 0 && a.source_file && b.source_file && a.source_file === b.source_file;

  // EXACT_MATCH is only ever reachable once project association is
  // confirmed known and shared — never while project_uncertain is true,
  // however strong the other signals look (§2D/§3 — unknown project
  // association must not permit unsafe promotion to a confident match).
  if (!projectUncertain) {
    if (signals.indexOf('content_fingerprint') !== -1) {
      return { certainty: DOCUMENT_IDENTITY_CERTAINTY.EXACT_MATCH, reason: 'Identical extracted content within the same confirmed project — the strongest available identity signal.', matched_signals: signals };
    }
    // document_number + revision agreeing together is treated as a strong,
    // independent identity+version pair. Filename is deliberately EXCLUDED
    // from ever counting toward EXACT_MATCH on its own — filename similarity
    // alone must never establish an exact identity match.
    if (signals.indexOf('document_number') !== -1 && signals.indexOf('revision') !== -1) {
      return { certainty: DOCUMENT_IDENTITY_CERTAINTY.EXACT_MATCH, reason: 'Same document number and same revision within the same confirmed project.', matched_signals: signals };
    }
  }
  if (signals.length >= 2) {
    return {
      certainty: DOCUMENT_IDENTITY_CERTAINTY.PROBABLE_MATCH,
      reason: projectUncertain
        ? (signals.length + ' independent identity signals agree, but project association is not confirmed for one or both documents — capped below EXACT_MATCH pending confirmed project association.')
        : (signals.length + ' independent identity signals agree within the same confirmed project.'),
      matched_signals: signals
    };
  }
  if (signals.length === 1) {
    return { certainty: DOCUMENT_IDENTITY_CERTAINTY.POSSIBLE_MATCH, reason: 'Exactly one identity signal (' + signals[0] + ') agrees — not sufficient for a confident match.', matched_signals: signals };
  }
  if (filenameOnly) {
    return { certainty: DOCUMENT_IDENTITY_CERTAINTY.POSSIBLE_MATCH, reason: 'Only the filename matches — filename similarity alone is never sufficient for a confident (let alone exact) match.', matched_signals: ['source_file'] };
  }
  if (projectUncertain) {
    return { certainty: DOCUMENT_IDENTITY_CERTAINTY.IDENTITY_UNKNOWN, reason: 'Project association is not confirmed for one or both documents, and no other identity signals are available — this is unknown evidence, never treated as a positive or a negative match.', matched_signals: [] };
  }
  return { certainty: DOCUMENT_IDENTITY_CERTAINTY.IDENTITY_UNKNOWN, reason: 'No identity signals available to compare.', matched_signals: [] };
}

// Conservative current-applicability assessment. Never treats a newer
// filename, a higher revision letter/number, or a later upload timestamp as
// evidence of currency (§9 hard rule) — only an explicit, actor-stated
// status token is considered, and even then only as a WEAK, self-declared
// signal (never KNOWN_CURRENT, which would require independent authority
// confirmation this batch does not implement).
function assessDocumentCurrentApplicability(identity) {
  if (!identity) return DOCUMENT_CURRENT_APPLICABILITY.CURRENT_APPLICABILITY_UNKNOWN;
  if (identity.status === 'SUPERSEDED') return DOCUMENT_CURRENT_APPLICABILITY.SUPERSEDED;
  if (identity.status === 'APPROVED' || identity.status === 'FOR CONSTRUCTION') return DOCUMENT_CURRENT_APPLICABILITY.POSSIBLY_CURRENT;
  return DOCUMENT_CURRENT_APPLICABILITY.CURRENT_APPLICABILITY_UNKNOWN;
}

// ---------------------------------------------------------------------------
// Line-based section/page tracking, so extracted facts carry real provenance
// rather than a constant "not identified".
// ---------------------------------------------------------------------------

// Sentinel markers a *real-document* extractor can insert to give this
// function ground-truth structure it couldn't otherwise infer from plain
// text: extractTextFromPdf() inserts a real "(page N)" line at each genuine
// PDF page boundary (already matched by the existing pageMatch pattern
// below — no change needed there); extractTextFromDocx() inserts this
// heading sentinel at each paragraph genuinely styled Heading/Title in the
// source WordprocessingML, since real DOCX headings ("Ground Conditions")
// don't reliably match the all-caps "SECTION n" heuristic below. Using a
// U+0001 control character as the sentinel means it can never collide with
// real document text.
const HEADING_SENTINEL = 'HEADING';

function buildLineProvenanceIndex(text) {
  // For each line index, records the most-recently-seen section heading and/or
  // explicit page marker at that point in the document — a fact matched later
  // via a multi-line regex is attributed to wherever its *start* falls.
  const lines = (text || '').split(/\r?\n/);
  const index = [];
  let currentSection = null;
  let currentPage = null;
  lines.forEach(line => {
    const explicitHeading = line.startsWith(HEADING_SENTINEL) ? line.slice(HEADING_SENTINEL.length).trim() : null;
    if (explicitHeading) {
      // Ground-truth heading from the source document's own structure — takes
      // precedence over the heuristic guess below, which never fires here
      // since this branch is exclusive.
      currentSection = explicitHeading;
    } else {
      const sectionMatch = line.match(/^\s*(?:SECTION|SECTION\s*\d+|§)\s*[:\-—]?\s*(\d+[.\s—-]*.+)$/i) || line.match(/^\s*(\d+(?:\.\d+)?)\s+([A-Z][A-Z \-\/]{4,})\s*$/);
      if (sectionMatch) currentSection = line.trim().replace(/\s+/g, ' ');
    }
    const pageMatch = line.match(/\(page\s*(\d+)\)/i) || line.match(/^\s*page\s*(\d+)\s*$/i);
    if (pageMatch) currentPage = pageMatch[1];
    index.push({ section: currentSection, page: currentPage });
  });
  return { lines, index };
}

function provenanceAt(lineProv, charOffset, text) {
  // Map a character offset back to a line number, then look up that line's
  // last-known section/page.
  const upTo = text.slice(0, charOffset);
  const lineNo = upTo.split(/\r?\n/).length - 1;
  const entry = lineProv.index[Math.min(lineNo, lineProv.index.length - 1)] || {};
  if (entry.page) return `page ${entry.page}` + (entry.section ? ` — ${entry.section}` : '');
  if (entry.section) return entry.section;
  return 'not identified';
}

// ---------------------------------------------------------------------------
// Status classification from local sentence context — a fact is only
// CONFIRMED_BY_DOCUMENT when plainly stated; explicit provisional/assumption/
// exclusion language downgrades it, and none of that is ever presented as a
// confirmed site fact.
// ---------------------------------------------------------------------------

function classifyStatusFromContext(sentence) {
  const s = (sentence || '').toLowerCase();
  if (/provisional sum|provisional allowance|\bprovisional\b/.test(s)) return { status: EVIDENCE_STATUS.PROVISIONAL, note: 'Explicitly described as a provisional sum/allowance in the source text.' };
  if (/\bassum(e|ed|es|ption)\b/.test(s)) return { status: EVIDENCE_STATUS.ASSUMED_IN_DOCUMENT, note: 'Explicitly framed as an assumption in the source text, not a confirmed site fact.' };
  if (/\bexclud|\bno allowance\b|\bnot included\b|\bexcl\.?\b/.test(s)) return { status: EVIDENCE_STATUS.ASSUMED_IN_DOCUMENT, note: 'Framed as an exclusion / commercial-exposure item, not a confirmed site fact — customer/commercial risk if this condition is not actually true.' };
  return { status: EVIDENCE_STATUS.CONFIRMED_BY_DOCUMENT, note: 'Plainly stated in the source document text.' };
}

// Batch 2 addition: a real false-positive was found in Batch 1B validation —
// "groundwater" matched inside a legal disclaimer paragraph ("...no warrantee
// is offered..."), a genuine sentence match but not a meaningful site
// finding. Generic (not tied to any one document's wording) boilerplate/
// disclaimer detector, so a match landing in this kind of sentence is scored
// 'low' confidence and — per Stage 1 evidence-assist governance — a 'low'
// confidence record is never offered as a proposed answer, only ever
// visible in the raw ledger. Numeric matches with a real unit are scored
// 'high' (least ambiguous kind of match); everything else stays 'medium'
// unless disclaimer language overrides it down to 'low'.
const DISCLAIMER_LANGUAGE = /\b(no warrant(y|ee)|without (written )?permission|for guidance only|no liability|third part(y|ies)|copying of this report|remain(s)? valid provided|guidance only|no responsibility is accepted)\b/i;

// Used by Batch 3 (Discrepancy/Authority/Missing-Evidence Intelligence,
// 2026-08-26) to detect an "approximate" vs "precise" wording pattern
// between two conflicting numeric facts (see classifyDiscrepancy() below) —
// defined here, alongside the sentence-context detector it's a sibling of,
// so extractFactsFromText() can populate it on every record at the point it
// already has the matched `sentence` in scope (no second text-scanning pass).
const APPROX_WORDING = /\b(approx(?:imately)?|about|around|circa|~)\b/i;
function assessMatchConfidence(sentence, comparisonMode, unit) {
  if (DISCLAIMER_LANGUAGE.test(sentence || '')) return 'low';
  if (comparisonMode === 'numeric' && unit) return 'high';
  return 'medium';
}

function sentenceAround(text, index, length) {
  const start = Math.max(0, text.lastIndexOf('.', index) + 1, text.lastIndexOf('\n', index) + 1);
  const endDot = text.indexOf('.', index + length);
  const endNl = text.indexOf('\n', index + length);
  let end = text.length;
  if (endDot !== -1) end = endDot;
  if (endNl !== -1 && endNl < end) end = endNl;
  return text.slice(start, Math.min(end + 1, text.length)).trim();
}

// ---------------------------------------------------------------------------
// Extraction rule table. Each rule is intentionally generic (real-world
// phrasing patterns), not a lookup keyed to one fixed literal string — it is
// exercised against the Job L validation fixtures (see
// evidence-fixtures.job-l-*.txt, loaded through the same File.text() path
// a real upload uses) but is not written to only match those exact fixtures.
// `flagInternalInconsistency: true` marks subjects checked for a document
// contradicting itself elsewhere in the same text (see extractFactsFromText).
// ---------------------------------------------------------------------------

const FACT_RULES = [
  { subject: 'project_use_description', comparisonMode: 'text', pattern: /(industrial\s+(?:warehouse|storage|manufacturing)[^.\n]{0,60}|warehouse\/?manufacturing[^.\n]{0,40})/gi },
  { subject: 'ground_conditions_made_ground', comparisonMode: 'text', pattern: /(made ground[^.\n]{0,80})/gi },
  { subject: 'made_ground_depth', comparisonMode: 'numeric', unit: 'm', pattern: /made ground[^.\n]{0,40}?(?:to a depth of|extends to|depth of)[^.\n]{0,20}?(\d+(?:\.\d+)?)\s?m\b/gi, valueFrom: m => m[1] + ' m' },
  { subject: 'ground_conditions_natural_stratum', comparisonMode: 'text', pattern: /(firm[,\s]+silty clay[^.\n]{0,40})/gi },
  { subject: 'moisture_ingress', comparisonMode: 'text', pattern: /(shallow moisture ingress[^.\n]{0,80})/gi },
  { subject: 'allowable_bearing_pressure', comparisonMode: 'numeric', unit: 'kN/m²', pattern: /allowable bearing pressure[^.\n]{0,40}?(\d{2,3})\s*kN\/?m(?:2|²)/gi, valueFrom: m => m[1] + ' kN/m²' },
  // Deliberately the SAME subject as 'allowable_bearing_pressure' above (not
  // a separate key) — a contractor's assumed design bearing pressure and a
  // geotechnical report's recommended figure are the same underlying fact
  // (what bearing pressure is this foundation design relying on?), so they
  // must land in the same cross-check group to catch a genuine disagreement
  // between them. Their evidence_status still differs (CONFIRMED_BY_DOCUMENT
  // vs ASSUMED_IN_DOCUMENT) via classifyStatusFromContext()'s "assum*" match.
  { subject: 'allowable_bearing_pressure', comparisonMode: 'numeric', unit: 'kN/m²', pattern: /assum\w+[^.\n]{0,40}?(\d{2,3})\s*kN\/?m(?:2|²)[^.\n]{0,40}?bearing/gi, valueFrom: m => m[1] + ' kN/m²' },
  // Real documents phrase this both ways ("200mm ... slab" and "slab ... of
  // 200mm") — both alternatives are matched so word order doesn't silently
  // lose a genuine fact.
  { subject: 'slab_thickness', comparisonMode: 'numeric', unit: 'mm', pattern: /(?:(\d{2,3})\s?mm\b[^.\n]{0,30}?slab|slab[^.\n]{0,20}?(\d{2,3})\s?mm\b)/gi, valueFrom: m => (m[1] || m[2]) + ' mm' },
  { subject: 'slab_reinforcement', comparisonMode: 'keyword-set', pattern: /(two layers?\s+of\s+A\d{3}|A\d{3}\s+mesh[^.\n]{0,30}two layers?|two\s+layers?\s+A\d{3}\s+mesh)/gi },
  { subject: 'contamination_testing', comparisonMode: 'text', pattern: /(contamination testing[^.\n]{0,80}|soil contamination[^.\n]{0,60})/gi },
  { subject: 'asbestos_testing', comparisonMode: 'text', pattern: /(asbestos testing[^.\n]{0,80}|tested for asbestos[^.\n]{0,60})/gi },
  { subject: 'groundwater_flood_environmental', comparisonMode: 'text', pattern: /(groundwater[^.\n]{0,80}|flood risk[^.\n]{0,80}|environmental (?:database|search|report)[^.\n]{0,60})/gi },
  { subject: 'gas_protection', comparisonMode: 'text', pattern: /(gas protection measures?[^.\n]{0,80}|ground gas[^.\n]{0,80})/gi },
  { subject: 'building_footprint_dimensions', comparisonMode: 'numeric', unit: 'm x m', pattern: /(\d{2,3})\s?m\s?[x×]\s?(\d{2,3})\s?m/gi, valueFrom: m => m[1] + 'm x ' + m[2] + 'm' },
  { subject: 'foundation_pad_count', comparisonMode: 'numeric', unit: 'locations', pattern: /(\d{1,3})\s+(?:foundation|pad)\s+(?:\/?\s*pad\s+)?locations?/gi, valueFrom: m => m[1] + ' locations' },
  { subject: 'excavation_removal_works', comparisonMode: 'text', pattern: /(excavat\w+ and remov\w+[^.\n]{0,80}|remov\w+ of made ground[^.\n]{0,80})/gi },
  { subject: 'imported_fill', comparisonMode: 'text', pattern: /(imported fill[^.\n]{0,80}|import(?:ed|ing) (?:granular )?fill[^.\n]{0,60})/gi },
  { subject: 'gas_membrane_dpm', comparisonMode: 'text', pattern: /(gas membrane[^.\n]{0,60}(?:and|\/)?\s*dpm[^.\n]{0,40}|dpm\s*\/\s*gas membrane[^.\n]{0,40})/gi },
  { subject: 'drainage_provisional_sum', comparisonMode: 'numeric', unit: '£', pattern: /£\s?([\d,]{4,7})[^.\n]{0,40}?surface[- ]water drainage/gi, valueFrom: m => '£' + m[1] },
  { subject: 'service_duct_provisional_sum', comparisonMode: 'numeric', unit: '£', pattern: /£\s?([\d,]{3,7})[^.\n]{0,40}?service duct/gi, valueFrom: m => '£' + m[1] },
  { subject: 'existing_drainage_assumption', comparisonMode: 'text', pattern: /(assum\w+[^.\n]{0,60}existing drainage[^.\n]{0,60})/gi },
  { subject: 'underground_services_assumption', comparisonMode: 'text', pattern: /(assum\w+[^.\n]{0,60}(?:free from|no|clear of) underground services[^.\n]{0,40}|site (?:is )?assumed (?:to be )?free (?:from|of) underground services)/gi },
  { subject: 'existing_concrete_breakout_exclusion', comparisonMode: 'text', pattern: /(no allowance[^.\n]{0,40}existing concrete[^.\n]{0,40}|excludes?[^.\n]{0,40}(?:breaking out|breakout) of existing concrete[^.\n]{0,40})/gi },
  { subject: 'contaminated_ground_disposal_exclusion', comparisonMode: 'text', pattern: /(excludes?[^.\n]{0,40}contaminated[- ]ground disposal[^.\n]{0,40}|no allowance[^.\n]{0,40}contaminated[- ](?:material|ground) disposal[^.\n]{0,40})/gi },
  { subject: 'quotation_basis', comparisonMode: 'text', pattern: /(budget estimate[^.\n]{0,80}subject to[^.\n]{0,60})/gi },
  // Added for Batch 1B real-PDF validation (see a real intrusive/concrete-
  // condition investigation report) — generic geotechnical/structural-testing
  // phrasing, not tuned to any one document's specific figures. \s* between
  // digits/letters tolerates the irregular intra-word spacing real PDF text
  // layers sometimes contain (a PDF-authoring/kerning artefact, not a
  // Project Check defect — pdf.js reproduces the source PDF's own glyph
  // positions exactly).
  { subject: 'concrete_core_count', comparisonMode: 'numeric', unit: 'cores', pattern: /\(\s*(\d{1,2})\s*\)\s*concrete\s*cores?/gi, valueFrom: m => m[1] + ' cores' },
  { subject: 'concrete_core_depth_range', comparisonMode: 'text', pattern: /(\d+\.\d+)\s?m\s+and\s+(\d+\.\d+)\s?m\s+below\s*ground\s*level/gi, valueFrom: m => `${m[1]} m to ${m[2]} m below ground level` },
  { subject: 'concrete_compressive_strength_range', comparisonMode: 'text', pattern: /results?\s+between\s+(\d+\.?\d*)\s?MPa\s+and\s+(\d+\.?\d*)\s?MPa/gi, valueFrom: m => `${m[1]} MPa to ${m[2]} MPa` },
  // Added for Batch 3 (Discrepancy/Authority/Missing-Evidence Intelligence,
  // 2026-08-26) validation — two genuine, previously-unrepresented single-
  // dimension subjects (the existing 'building_footprint_dimensions' rule
  // only matches a "W x L" pair, not a single named dimension). Generic
  // real-world phrasing, not tuned to one fixture.
  { subject: 'overall_building_length', comparisonMode: 'numeric', unit: 'm', pattern: /building length of\s+(?:approximately\s+)?(\d+(?:\.\d+)?)\s?m/gi, valueFrom: m => m[1] + ' m' },
  { subject: 'eaves_height', comparisonMode: 'numeric', unit: 'm', pattern: /(\d+(?:\.\d+)?)\s?m\s+eaves(?:\s+height)?|eaves\s+height\s+of\s+(?:approximately\s+)?(\d+(?:\.\d+)?)\s?m/gi, valueFrom: m => (m[1] || m[2]) + ' m' },
  // Added for Planning Batch 2 (2026-08-26) — a genuine, narrow "Site
  // address:"-style label as commonly stated on a planning application
  // form/site location plan. Deliberately NOT gated to planning documents
  // only (same generic-phrasing-not-document-type-gated design as every
  // other FACT_RULES entry) — any document plainly stating a site address
  // this way is equally valid provenance. comparisonMode 'text' (no unit),
  // so it always lands at 'medium' confidence per assessMatchConfidence()
  // unless disclaimer wording is present.
  { subject: 'planning_site_address', comparisonMode: 'text', pattern: /(?:site address|address of the site|full site address)\s*:?\s*([^\n]{5,120})/gi, valueFrom: m => m[1].trim().replace(/[.,;]+$/, '') }
];

// Subjects checked for the document literally contradicting itself elsewhere
// in the same text (distinct from a *cross-document* conflict) — e.g. one
// paragraph plainly industrial, another leftover-template paragraph
// describing a domestic dwelling/residential use.
const INTERNAL_INCONSISTENCY_RULES = [
  {
    subject: 'project_description_inconsistency',
    // Only fires when BOTH an industrial/warehouse description AND a
    // residential/dwelling description appear in the same document — the
    // presence of one alone is not an inconsistency.
    industrialPattern: /industrial\s+(?:warehouse|storage|manufacturing)/i,
    residentialPattern: /(proposed dwelling|residential (?:development|garden|property)|domestic dwelling)/i
  }
];

// ---------------------------------------------------------------------------
// Per-document extraction
// ---------------------------------------------------------------------------

function extractFactsFromText(text, meta) {
  const records = [];
  if (!text) return records;
  const lineProv = buildLineProvenanceIndex(text);

  FACT_RULES.forEach(rule => {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.indexOf('g') === -1 ? rule.pattern.flags + 'g' : rule.pattern.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const sentence = sentenceAround(text, match.index, match[0].length);
      // Skip a match whose surrounding line is itself a section heading
      // (e.g. "SECTION 6 — GROUND GAS") — a heading restating a subject in
      // capitals is not the document stating a fact, and would otherwise
      // show up as a low-value, misleading duplicate "extracted fact".
      if (/^[A-Z0-9 §.,:—\-\/()]+$/.test(sentence.trim()) && sentence.trim().length > 0) continue;
      const value = rule.valueFrom ? rule.valueFrom(match) : match[1] || match[0];
      const { status, note } = classifyStatusFromContext(sentence);
      const confidence = assessMatchConfidence(sentence, rule.comparisonMode, rule.unit);
      records.push(createEvidenceRecord({
        project_id: meta.project_id,
        source_file: meta.source_file,
        source_document_type: meta.source_document_type,
        source_document_type_confidence: meta.source_document_type_confidence,
        source_page_or_section: provenanceAt(lineProv, match.index, text),
        evidence_function: meta.evidence_function || [],
        evidence_maturity: meta.evidence_maturity || [],
        packages: meta.packages || [],
        scope: classifyFactScope(sentence),
        approx_wording: APPROX_WORDING.test(sentence),
        subject: rule.subject,
        extracted_value: value,
        unit: rule.unit || null,
        evidence_status: status,
        confidence: confidence,
        extraction_note: note + ` (matched: "${match[0].trim().slice(0, 120)}")` + (confidence === 'low' ? ' Low confidence: this match sits inside boilerplate/disclaimer-style wording, not a specific site finding.' : '')
      }));
      if (re.lastIndex === match.index) re.lastIndex++; // guard against zero-length matches
    }
  });

  INTERNAL_INCONSISTENCY_RULES.forEach(rule => {
    const hasIndustrial = rule.industrialPattern.test(text);
    const residentialMatch = text.match(rule.residentialPattern);
    if (hasIndustrial && residentialMatch) {
      const idx = text.search(rule.residentialPattern);
      const sentence = sentenceAround(text, idx, residentialMatch[0].length);
      records.push(createEvidenceRecord({
        project_id: meta.project_id,
        source_file: meta.source_file,
        source_document_type: meta.source_document_type,
        source_document_type_confidence: meta.source_document_type_confidence,
        source_page_or_section: provenanceAt(lineProv, idx, text),
        evidence_function: meta.evidence_function || [],
        evidence_maturity: meta.evidence_maturity || [],
        packages: meta.packages || [],
        scope: classifyFactScope(sentence),
        approx_wording: APPROX_WORDING.test(sentence),
        subject: rule.subject,
        extracted_value: `Document describes the project as industrial elsewhere, but also contains: "${residentialMatch[0]}"`,
        unit: null,
        evidence_status: EVIDENCE_STATUS.DOCUMENT_INTERNAL_INCONSISTENCY,
        confidence: 'medium',
        extraction_note: 'This document contains internally inconsistent project description wording. Project Check does not auto-correct this — it is recorded so a human can check which description is genuinely correct for this project.'
      }));
    }
  });

  return records;
}

// ---------------------------------------------------------------------------
// Cross-document checking — corroboration / conflict, never a silent choice.
// ---------------------------------------------------------------------------

function extractNumberToken(value) {
  const m = String(value || '').match(/-?[\d,]+(?:\.\d+)?/);
  if (!m) return null;
  return parseFloat(m[0].replace(/,/g, ''));
}

function extractKeywordSetToken(value) {
  const s = String(value || '').toLowerCase();
  const grade = (s.match(/a\d{3}/i) || [])[0] || '';
  const layers = /two/.test(s) || /\b2\b/.test(s) ? '2-layer' : (/single|one/.test(s) ? '1-layer' : '');
  return grade + '|' + layers;
}

function valuesEquivalent(a, b, comparisonMode) {
  if (comparisonMode === 'numeric') {
    const na = extractNumberToken(a.extracted_value), nb = extractNumberToken(b.extracted_value);
    if (na === null || nb === null) return null; // can't compare, not a claim either way
    if (a.unit && b.unit && a.unit !== b.unit) return null; // different units — not comparable, don't fabricate a conflict
    return Math.abs(na - nb) < 0.001;
  }
  if (comparisonMode === 'keyword-set') {
    const ka = extractKeywordSetToken(a.extracted_value), kb = extractKeywordSetToken(b.extracted_value);
    if (!ka.trim() || !kb.trim()) return null;
    return ka === kb;
  }
  // text: normalise whitespace/case and compare — only ever called between
  // records sharing a subject that both matched real text, so an exact
  // normalised match is a reasonable corroboration signal; anything else is
  // left unlinked rather than guessed as a conflict (free text varies too
  // much in wording to safely assume disagreement from a string mismatch).
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm(a.extracted_value) === norm(b.extracted_value) ? true : null;
}

const SUBJECT_COMPARISON_MODE = FACT_RULES.reduce((acc, r) => { acc[r.subject] = r.comparisonMode; return acc; }, {});

function crossCheckEvidence(records) {
  const bySubject = {};
  records.forEach(r => {
    if (!r.subject) return;
    (bySubject[r.subject] = bySubject[r.subject] || []).push(r);
  });
  Object.keys(bySubject).forEach(subject => {
    const group = bySubject[subject];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        const mode = SUBJECT_COMPARISON_MODE[subject] || 'text';
        if (a.source_file === b.source_file) {
          // Same document restating the same subject with a genuinely
          // different value is the "internal drafting inconsistency" case —
          // distinct from a *cross*-document conflict, so it gets its own
          // status rather than being silently ignored (previously skipped
          // entirely) or mislabelled as CONFLICTING_EVIDENCE. Only numeric/
          // keyword-set comparisons are reliable enough here; free-text
          // subjects naturally restate with different wording and would
          // produce false positives.
          if (mode === 'numeric' || mode === 'keyword-set') {
            const sameDocEquivalence = valuesEquivalent(a, b, mode);
            if (sameDocEquivalence === false) {
              if (!a.conflicts_with.includes(b.evidence_id)) a.conflicts_with.push(b.evidence_id);
              if (!b.conflicts_with.includes(a.evidence_id)) b.conflicts_with.push(a.evidence_id);
              a.evidence_status = EVIDENCE_STATUS.DOCUMENT_INTERNAL_INCONSISTENCY;
              b.evidence_status = EVIDENCE_STATUS.DOCUMENT_INTERNAL_INCONSISTENCY;
              a.extraction_note += ` This document also states "${b.extracted_value}" for the same subject elsewhere (${b.source_page_or_section}) — internally inconsistent, not reconciled here.`;
              b.extraction_note += ` This document also states "${a.extracted_value}" for the same subject elsewhere (${a.source_page_or_section}) — internally inconsistent, not reconciled here.`;
            }
          }
          continue; // corroboration is a cross-document concept only
        }
        const equivalence = valuesEquivalent(a, b, mode);
        if (equivalence === true) {
          if (!a.corroborates.includes(b.evidence_id)) a.corroborates.push(b.evidence_id);
          if (!b.corroborates.includes(a.evidence_id)) b.corroborates.push(a.evidence_id);
        } else if (equivalence === false) {
          // Never silently pick one — both keep their own extracted_value and
          // provenance, both are linked to each other, both flip to
          // CONFLICTING_EVIDENCE regardless of what status they'd have had
          // individually.
          if (!a.conflicts_with.includes(b.evidence_id)) a.conflicts_with.push(b.evidence_id);
          if (!b.conflicts_with.includes(a.evidence_id)) b.conflicts_with.push(a.evidence_id);
          a.evidence_status = EVIDENCE_STATUS.CONFLICTING_EVIDENCE;
          b.evidence_status = EVIDENCE_STATUS.CONFLICTING_EVIDENCE;
        }
        // equivalence === null: not safely comparable — no link created, no
        // status changed. Silence here is deliberate, not a bug: Project
        // Check must not invent a corroboration or conflict it cannot
        // actually support.
      }
    }
  });
  return records;
}

// =============================================================================
// Evidence Meaning, Provenance & Maturity enhancement — Batch 1 of 4
// (2026-08-26). Strengthens the EXISTING Evidence Intelligence implementation
// above; does not replace it. Three DOCUMENT-level concepts, each computed
// once per document in buildProjectEvidenceLedger() (same pattern as
// classifyDocumentType()) and copied onto every fact extracted from that
// document for context:
//
//   - EVIDENCE FUNCTION — "what kind of evidence is this document capable of
//     providing?" (classifyEvidenceFunction()). Separate from evidence_status
//     (per-fact confirmation state, above — unchanged) and separate from
//     confidence (extraction-match confidence, above — unchanged).
//   - EVIDENCE MATURITY — "how far has this particular aspect progressed
//     through the project evidence chain?" (deriveEvidenceMaturity()).
//     Derived from evidence function via a FIXED, NON-CASCADING lookup table
//     (FUNCTION_MATURITY_MAP) — there is no code path anywhere that upgrades
//     one maturity state into another (e.g. a DESIGN_PROPOSAL document can
//     never yield INSTALLED maturity), which is what makes the "critical
//     maturity safeguards" hold by construction rather than by convention.
//   - DOCUMENT INTEGRITY — placeholder/unsigned/draft-marking detection
//     (assessDocumentIntegrity()), used only to cap the small set of
//     high-stakes maturity claims (authority acceptance, installation,
//     commissioning, closure) back down to DOCUMENTED when a document shows
//     signs of being an incomplete template — never to reject/discard the
//     document itself.
//
// None of this touches EVIDENCE_STATUS, DOCUMENT_TYPES, FACT_RULES,
// crossCheckEvidence(), the Batch 2 Stage 1 assist layer, the Batch 3 Stage 2
// findings layer or the Batch 4 Stage 3 actions layer — all unchanged. The
// only compatibility change to the existing schema is four new, always-safe-
// default fields on createEvidenceRecord() (evidence_function, evidence_
// maturity — both `[]` unless a source document supplies them — plus
// document_date/revision, both `null`, see createEvidenceRecord() above).
// =============================================================================

const EVIDENCE_FUNCTION = {
  CUSTOMER_STATEMENT: 'CUSTOMER_STATEMENT',
  DESIGN_PROPOSAL: 'DESIGN_PROPOSAL',
  CONTRACTUAL_COMMITMENT: 'CONTRACTUAL_COMMITMENT',
  AUTHORITY_DECISION: 'AUTHORITY_DECISION',
  AUTHORITY_REQUIREMENT: 'AUTHORITY_REQUIREMENT',
  INSPECTION_RECORD: 'INSPECTION_RECORD',
  INSTALLATION_RECORD: 'INSTALLATION_RECORD',
  COMMISSIONING_EVIDENCE: 'COMMISSIONING_EVIDENCE',
  HANDOVER_RECORD: 'HANDOVER_RECORD',
  CLOSURE_EVIDENCE: 'CLOSURE_EVIDENCE'
};

const EVIDENCE_MATURITY = {
  UNKNOWN: 'UNKNOWN',
  STATED: 'STATED',
  DOCUMENTED: 'DOCUMENTED',
  DESIGNED: 'DESIGNED',
  CONTRACTED: 'CONTRACTED',
  AUTHORITY_ACCEPTED: 'AUTHORITY_ACCEPTED',
  INSTALLED: 'INSTALLED',
  INSPECTED: 'INSPECTED',
  COMMISSIONED: 'COMMISSIONED',
  CLOSED: 'CLOSED'
};

// Generic, real-world-phrasing keyword sets (not tied to any one document) —
// same transparent-scoring spirit as DOCUMENT_TYPE_KEYWORDS above. A document
// may match more than one function; every match is kept (multi-label), never
// forced down to a single "best" guess, per instruction.
const EVIDENCE_FUNCTION_KEYWORDS = [
  { fn: EVIDENCE_FUNCTION.CUSTOMER_STATEMENT, terms: ['customer confirms', 'customer states', 'client confirms', 'client states', 'customer requirement', 'client requirement', 'as advised by the customer', 'as advised by the client', 'customer instruction', 'client instruction'] },
  { fn: EVIDENCE_FUNCTION.DESIGN_PROPOSAL, terms: ['proposed design', 'design proposal', 'preliminary design', 'draft design', 'general arrangement', 'concept drawing', 'proposed layout', 'drawing no', 'not for construction', 'for information only'] },
  { fn: EVIDENCE_FUNCTION.CONTRACTUAL_COMMITMENT, terms: ['order confirmation', 'order acknowledgement', 'signed contract', 'accepted quotation', 'purchase order', 'contract sum', 'order accepted', 'contract agreement', 'quotation accepted'] },
  { fn: EVIDENCE_FUNCTION.AUTHORITY_DECISION, terms: ['planning permission granted', 'planning permission is granted', 'decision notice', 'approved with conditions', 'full planning permission', 'building regulations approval', 'completion certificate issued', 'permission is hereby granted', 'application approved', 'consent granted', 'building control approval granted'] },
  { fn: EVIDENCE_FUNCTION.AUTHORITY_REQUIREMENT, terms: ['planning condition', 'condition requires', 'the following condition', 'shall be submitted to and approved', 'building control require', 'requires building control approval', 'subject to the following conditions', 'prior to commencement of the development'] },
  { fn: EVIDENCE_FUNCTION.INSPECTION_RECORD, terms: ['site inspection', 'inspection report', 'inspected on', 'inspection record', 'visual inspection', 'observed on site', 'inspector noted', 'inspection carried out'] },
  { fn: EVIDENCE_FUNCTION.INSTALLATION_RECORD, terms: ['installation record', 'installed on', 'installation completed', 'as-installed', 'installation certificate', 'fitted on site', 'erected on', 'erection completed'] },
  { fn: EVIDENCE_FUNCTION.COMMISSIONING_EVIDENCE, terms: ['commissioning certificate', 'commissioning record', 'commissioned on', 'test and commission', 'functional test', 'commissioning report', 'commissioning complete'] },
  { fn: EVIDENCE_FUNCTION.HANDOVER_RECORD, terms: ['handover certificate', 'practical completion', 'handover document', 'snagging list', 'defects list', 'outstanding items', 'handed over on', 'certificate of practical completion'] },
  { fn: EVIDENCE_FUNCTION.CLOSURE_EVIDENCE, terms: ['closure evidence', 'issue closed', 'action closed', 'remedial works completed', 'defect rectified', 'closed out', 'verified closed', 'snagging item closed'] }
];

// Guards against the same negated-language false positive already solved
// elsewhere in this file for fact extraction (see DISCLAIMER_LANGUAGE) — a
// document can genuinely say "no closure evidence is recorded" or "approval
// has not been granted", and a plain substring match would otherwise count
// that negated sentence as if it positively established the function. Only
// checks a short window immediately before the match (a real document's own
// negation almost always sits directly in front of the term it negates).
function isNegatedEvidenceFunctionMatch(lower, matchIndex) {
  const start = Math.max(0, matchIndex - 30);
  const before = lower.slice(start, matchIndex);
  return /\b(no|not|never|without|isn't|is not|are not|were not|absence of|pending|awaiting)\b[^.]{0,15}$/.test(before);
}

// Content-first: a filename hint is only ever consulted when the document's
// own text produced ZERO function matches, is always marked 'low' confidence
// with an explicit note, and can never override or outrank a real content
// match (that branch below returns before this is ever reached). Kept
// deliberately narrow — only the two lowest-risk guesses (a drawing/GA
// filename, an inspection-report filename) — rather than guessing something
// as consequential as CONTRACTUAL_COMMITMENT or CLOSURE_EVIDENCE from a
// filename alone, which risks exactly the false inference this batch guards
// against.
function guessEvidenceFunctionFromFilename(filename) {
  const n = (filename || '').toLowerCase();
  if (/general[\s_-]?arrangement|\bga\b|drawing/.test(n)) return EVIDENCE_FUNCTION.DESIGN_PROPOSAL;
  if (/inspection/.test(n)) return EVIDENCE_FUNCTION.INSPECTION_RECORD;
  return null;
}

function classifyEvidenceFunction(text, filename) {
  const lower = (text || '').toLowerCase();
  const matches = EVIDENCE_FUNCTION_KEYWORDS.map(entry => {
    const matched = entry.terms.filter(t => {
      let idx = lower.indexOf(t);
      while (idx !== -1) {
        if (!isNegatedEvidenceFunctionMatch(lower, idx)) return true; // at least one genuine (non-negated) occurrence
        idx = lower.indexOf(t, idx + 1);
      }
      return false;
    });
    return { fn: entry.fn, score: matched.length, matched_terms: matched };
  }).filter(m => m.score > 0);

  if (matches.length) {
    matches.sort((a, b) => b.score - a.score);
    const functions = matches.map(m => ({
      function: m.fn,
      confidence: m.score >= 2 ? 'high' : 'medium',
      matched_terms: m.matched_terms,
      source: 'content'
    }));
    return { functions, note: `Evidence function(s) classified from document content: ${functions.map(f => f.function).join(', ')}.` };
  }
  const filenameGuess = guessEvidenceFunctionFromFilename(filename);
  if (filenameGuess) {
    return {
      functions: [{ function: filenameGuess, confidence: 'low', matched_terms: [], source: 'filename' }],
      note: `No evidence-function keywords found in the document content — this is a low-confidence guess from the filename only ("${filename || 'unnamed file'}"), not from document content.`
    };
  }
  return { functions: [], note: 'No evidence function could be classified from this document — content and filename gave no usable signal.' };
}

// Each evidence function maps to exactly the ONE maturity state it alone can
// honestly establish — never a higher one, and never a state for a different
// aspect of the project. AUTHORITY_REQUIREMENT and HANDOVER_RECORD
// deliberately map only to DOCUMENTED, not AUTHORITY_ACCEPTED/CLOSED
// respectively: an authority *requiring* something is not the same as an
// authority *accepting* that it has been met (see "AUTHORITY REQUIREMENT" in
// the governing brief), and a handover document may simultaneously contain
// defects/incomplete works/exclusions, so handover alone never implies
// CLOSED (see "HANDOVER ≠ AUTOMATIC DEFECT-FREE COMPLETION").
//
// CLOSURE_EVIDENCE SEMANTIC CORRECTION (2026-08-26, Batch 1 controlled
// closure correction, Architect + SPA review): `CLOSED` here describes the
// MATURITY OF THIS EVIDENCE RECORD ONLY — "this document is evidence
// intended or potentially capable of supporting closure of a specific
// issue/requirement/action." It is NOT, and must never be read as, "the
// underlying project finding/risk/requirement/action IS closed." Whether a
// specific piece of closure evidence actually, sufficiently closes a
// specific finding/requirement/action is a determination that belongs
// entirely to a future, separately-governed Batch 4 ("Findings, Actions &
// Closure") — it is NOT made anywhere in this file. No code in `evidence.js`
// reads `evidence_function`/`evidence_maturity` to close/resolve a Stage 2
// finding or Stage 3 action today (`buildStage2Findings()`/
// `buildStage3Actions()` above use their own, entirely separate resolution
// signals — see the landmine comments on both — and reference neither field
// at all). See `deriveEvidenceMaturity()` below for the bespoke, explicit
// disclaimer attached to every `CLOSURE_EVIDENCE` → `CLOSED` maturity entry,
// specifically so a future implementer reading a ledger row cannot mistake
// it for issue closure.
const FUNCTION_MATURITY_MAP = {
  CUSTOMER_STATEMENT: EVIDENCE_MATURITY.STATED,
  DESIGN_PROPOSAL: EVIDENCE_MATURITY.DESIGNED,
  CONTRACTUAL_COMMITMENT: EVIDENCE_MATURITY.CONTRACTED,
  AUTHORITY_DECISION: EVIDENCE_MATURITY.AUTHORITY_ACCEPTED,
  AUTHORITY_REQUIREMENT: EVIDENCE_MATURITY.DOCUMENTED,
  INSPECTION_RECORD: EVIDENCE_MATURITY.INSPECTED,
  INSTALLATION_RECORD: EVIDENCE_MATURITY.INSTALLED,
  COMMISSIONING_EVIDENCE: EVIDENCE_MATURITY.COMMISSIONED,
  HANDOVER_RECORD: EVIDENCE_MATURITY.DOCUMENTED,
  // Evidence-record maturity only — see the correction note immediately
  // above this map. Never read anywhere in this file as issue/action closure.
  CLOSURE_EVIDENCE: EVIDENCE_MATURITY.CLOSED
};

// These four functions' natural maturity claim is strong/consequential enough
// that a same-document integrity limitation (see assessDocumentIntegrity()
// below) must cap it back down to DOCUMENTED rather than be honoured at face
// value — an obviously incomplete template must not become completion/
// authority/installation/commissioning evidence merely because the right
// keyword appears somewhere in it (see "DOCUMENT INTEGRITY / INCOMPLETE
// RECORDS" in the governing brief).
const HIGH_STAKES_MATURITY_FUNCTIONS = [
  EVIDENCE_FUNCTION.AUTHORITY_DECISION,
  EVIDENCE_FUNCTION.INSTALLATION_RECORD,
  EVIDENCE_FUNCTION.COMMISSIONING_EVIDENCE,
  EVIDENCE_FUNCTION.CLOSURE_EVIDENCE
];

// Pure/deterministic: a flat lookup, not a state machine, so there is no
// possible code path that turns one maturity state into a different one —
// this is what makes the brief's "critical maturity safeguards" hold
// structurally rather than by relying on every future call site remembering
// not to cascade. Multiple functions on one document simply produce multiple
// independent maturity entries (see "these can coexist for different aspects
// of the same subject").
function deriveEvidenceMaturity(functions, integrityFlags) {
  const hasIntegrityLimitation = Array.isArray(integrityFlags) && integrityFlags.length > 0;
  return (functions || []).map(f => {
    const naturalMaturity = FUNCTION_MATURITY_MAP[f.function] || EVIDENCE_MATURITY.UNKNOWN;
    const capped = hasIntegrityLimitation && HIGH_STAKES_MATURITY_FUNCTIONS.includes(f.function);
    let note;
    if (capped) {
      note = `Document found — completion/authority evidence not established from this document (integrity limitation present) — treated as ${EVIDENCE_MATURITY.DOCUMENTED} only, not ${naturalMaturity}.`;
    } else if (f.function === EVIDENCE_FUNCTION.CLOSURE_EVIDENCE) {
      // Bespoke, deliberately explicit wording (2026-08-26 closure-semantic
      // correction) — this is the one maturity state most at risk of being
      // misread as "the underlying issue is resolved". It is not: this
      // describes the evidence record only. Whether it actually satisfies a
      // specific finding/requirement/action is Batch 4's determination, not
      // made here.
      note = `This document is capable of/intended to support closure of a specific issue, requirement or action (CLOSURE_EVIDENCE). Its evidence_maturity is recorded as ${naturalMaturity} for the EVIDENCE RECORD ITSELF ONLY. This does NOT mean any underlying project finding, risk, requirement or action is closed — no code in this file uses this classification to close one. Whether this evidence actually, sufficiently satisfies a specific closure requirement is a separate determination belonging to a future, separately-governed batch, and is not made anywhere in this codebase today.`;
    } else {
      note = `Evidence function ${f.function} supports ${naturalMaturity} maturity for the aspect it evidences only — this does not imply any other maturity state for this or any other aspect of the project.`;
    }
    return {
      function: f.function,
      maturity: capped ? EVIDENCE_MATURITY.DOCUMENTED : naturalMaturity,
      capped,
      note
    };
  });
}

// ---------------------------------------------------------------------------
// Document integrity / incomplete-record detection. Contextual, not a
// rejection rule, per instruction: an incomplete/placeholder/unsigned/draft
// document is still retained and still classified as normal — these flags
// only prevent it from being credited with the high-stakes maturity states
// above (see HIGH_STAKES_MATURITY_FUNCTIONS/deriveEvidenceMaturity()). A
// document with none of these indicators produces an empty flags array and
// is otherwise completely unaffected.
// ---------------------------------------------------------------------------

const INTEGRITY_INDICATORS = [
  { type: 'placeholder_field', pattern: /\[(?:insert|tbc|tbd|x{3,}|client name|project name|site address)\]/i, detail: 'Contains an unfilled template placeholder (e.g. "[insert]"/"[TBC]").' },
  { type: 'placeholder_field', pattern: /\bTBC\b|\bTBD\b|to be confirmed|to be advised|to be agreed/i, detail: 'Contains "to be confirmed / to be advised / to be agreed"-style placeholder wording.' },
  { type: 'unsigned_signature', pattern: /(?:signed|signature)\s*:?\s*_{3,}/i, detail: 'A signature field appears blank/unsigned (underscored line, no name entered).' },
  { type: 'draft_marking', pattern: /\b(?:draft\s*[-–—]\s*not\s*for\s*(?:issue|construction)|preliminary\s*[-–—]\s*not\s*issued|not\s*for\s*construction|draft\s*only)\b/i, detail: 'Explicitly marked draft/not for issue/not for construction.' },
  { type: 'incomplete_form', pattern: /_{5,}/, detail: 'Contains an extended blank/underscored run, consistent with an unfilled form field.' }
];

function assessDocumentIntegrity(text) {
  const t = text || '';
  const flags = [];
  const seenTypes = new Set();
  INTEGRITY_INDICATORS.forEach(ind => {
    if (seenTypes.has(ind.type)) return; // report each limitation TYPE once, not once per matching pattern
    if (ind.pattern.test(t)) { flags.push({ type: ind.type, detail: ind.detail }); seenTypes.add(ind.type); }
  });
  return {
    flags,
    note: flags.length
      ? `Document contains ${flags.length} integrity limitation(s): ${flags.map(f => f.detail).join(' ')} Retained, not rejected — see evidence maturity for how this affects what the document can be credited with establishing.`
      : ''
  };
}

// =============================================================================
// Evidence Intelligence — Batch 2A (2026-08-26): PACKAGE & SCOPE.
// "What part of the project does this evidence concern?" — a separate axis
// from everything above: evidence function (WHAT KIND of evidence),
// evidence maturity, evidence status (fact-truth state), confidence,
// document type, and provenance are all completely unchanged by this batch.
//
// NOT a responsibility system. CLIENT_WORKS/SUPPLIER_WORKS/
// SPECIALIST_CONSULTANT_WORKS below are PACKAGE labels — "this document
// concerns work that sits in the client/supplier/consultant scope
// category" — never an assignment of who is responsible for it.
// RESPONSIBLE_FOR/DESIGNED_BY/SUPPLIED_BY/INSTALLED_BY/interface-ownership
// logic is explicitly Batch 2B and is NOT implemented anywhere in this
// section. Existing author/provider metadata (`e.name`/upload metadata) is
// read only for filename-fallback classification (see
// guessPackageFromFilename() below) — never to infer who is responsible.
// =============================================================================

const PACKAGE = {
  BUILDING_FRAME: 'BUILDING_FRAME',
  ENVELOPE: 'ENVELOPE',
  FOUNDATIONS_CIVILS: 'FOUNDATIONS_CIVILS',
  DRAINAGE: 'DRAINAGE',
  FIRE: 'FIRE',
  M_AND_E: 'M_AND_E',
  PLANNING: 'PLANNING',
  BUILDING_CONTROL: 'BUILDING_CONTROL',
  ACCESS_SITE_LOGISTICS: 'ACCESS_SITE_LOGISTICS',
  DOORS_OPENINGS: 'DOORS_OPENINGS',
  CLIENT_WORKS: 'CLIENT_WORKS',
  SUPPLIER_WORKS: 'SUPPLIER_WORKS',
  SPECIALIST_CONSULTANT_WORKS: 'SPECIALIST_CONSULTANT_WORKS',
  UNCLASSIFIED: 'UNCLASSIFIED'
};

// Generic, real-world keyword sets — multi-label by construction (a document
// is never forced into one package). Deliberate overlap is allowed where a
// real subject genuinely spans two packages: 'fire alarm' appears in both
// FIRE and M_AND_E because a fire alarm system genuinely is an electrical/M&E
// installation as well as a fire-safety one — not a bug, see task report
// test scenario C.
const PACKAGE_KEYWORDS = [
  { pkg: PACKAGE.BUILDING_FRAME, terms: ['steel frame', 'portal frame', 'structural frame', 'frame design', 'frame erection', 'purlins', 'structural steelwork', 'main frame design'] },
  { pkg: PACKAGE.ENVELOPE, terms: ['cladding', 'roof sheeting', 'wall cladding', 'insulated panel', 'built-up roof', 'composite panel', 'envelope design', 'roofing and cladding', 'proposed elevations', 'elevation drawing'] },
  { pkg: PACKAGE.FOUNDATIONS_CIVILS, terms: ['foundation design', 'pad foundation', 'foundation schedule', 'foundation layout', 'base design', 'slab design', 'groundworks', 'civils package', 'substructure'] },
  { pkg: PACKAGE.DRAINAGE, terms: ['drainage layout', 'drainage design', 'drainage', 'soakaway', 'attenuation', 'surface water', 'foul water', 'sewer', 'rainwater goods'] },
  { pkg: PACKAGE.FIRE, terms: ['fire strategy', 'fire alarm', 'means of escape', 'fire detection', 'fire resistance', 'compartmentation', 'smoke detection', 'fire safety'] },
  { pkg: PACKAGE.M_AND_E, terms: ['mechanical and electrical', 'm&e', 'electrical installation', 'lighting design', 'emergency lighting', 'ventilation system', 'electrical layout', 'fire alarm'] },
  { pkg: PACKAGE.PLANNING, terms: ['planning permission', 'planning application', 'planning condition', 'local planning authority', 'planning committee', 'planning consent'] },
  { pkg: PACKAGE.BUILDING_CONTROL, terms: ['building control', 'building regulations', 'approved inspector', 'completion certificate', 'building control submission', 'full plans application'] },
  { pkg: PACKAGE.ACCESS_SITE_LOGISTICS, terms: ['site access', 'access route', 'site logistics', 'delivery access', 'construction traffic', 'site compound', 'crane access'] },
  { pkg: PACKAGE.DOORS_OPENINGS, terms: ['roller shutter door', 'roller door', 'personnel door', 'door schedule', 'door opening', 'door layout'] },
  { pkg: PACKAGE.CLIENT_WORKS, terms: ['client works', 'by others (client)', 'client scope', 'client-supplied', 'provided by the client', 'works by client'] },
  { pkg: PACKAGE.SUPPLIER_WORKS, terms: ['supplier works', 'supply and install', 'manufacturer scope', 'supplier scope', 'ex-works supply', 'standard supplier package'] },
  { pkg: PACKAGE.SPECIALIST_CONSULTANT_WORKS, terms: ['specialist consultant', 'consultant report', 'specialist design', 'specialist survey', 'consultant scope', 'geotechnical consultant', 'fire consultant'] }
];

// Fallback ONLY when content/heading scanning found nothing at all — a
// document-type hint is still a genuine signal (stronger than a filename
// guess), matching the brief's priority order (content/headings > explicit
// scope wording > document type > filename).
const DOCUMENT_TYPE_PACKAGE_HINT = {
  site_investigation_geotechnical: PACKAGE.FOUNDATIONS_CIVILS,
  structural_report_calculation: PACKAGE.BUILDING_FRAME,
  foundation_base_design: PACKAGE.FOUNDATIONS_CIVILS,
  groundworks_quotation: PACKAGE.FOUNDATIONS_CIVILS,
  planning_document: PACKAGE.PLANNING,
  building_control_document: PACKAGE.BUILDING_CONTROL,
  fire_strategy: PACKAGE.FIRE,
  drainage_information: PACKAGE.DRAINAGE
};

// Weakest possible signal — deliberately narrow (same caution as
// guessEvidenceFunctionFromFilename()) and, per classifyPackages() below,
// only ever reached when explicit scope wording, content/heading keywords
// AND the document-type hint all gave zero signal — so it can never
// override real, contradictory document content (see task report scenario G,
// filename says "fire", content is drainage-only -> DRAINAGE wins, filename
// never even consulted).
function guessPackageFromFilename(filename) {
  const n = (filename || '').toLowerCase();
  if (/drainage/.test(n)) return PACKAGE.DRAINAGE;
  if (/fire/.test(n)) return PACKAGE.FIRE;
  if (/foundation/.test(n)) return PACKAGE.FOUNDATIONS_CIVILS;
  return null;
}

// The single strongest possible content signal: the document directly
// telling the reader what it covers (e.g. "Scope: foundations and civils
// package only"). Generic pattern, not tied to one document's wording.
const EXPLICIT_SCOPE_PATTERN = /\b(?:scope|package)\s*(?:of (?:this|the) (?:document|drawing|report))?\s*[:\-—]\s*([^\n.]{3,120})/i;

// Classifies package(s) for one DOCUMENT (mirrors classifyDocumentType()/
// classifyEvidenceFunction()'s "one call per document" pattern — see
// buildProjectEvidenceLedger() below). Heading lines score double weight
// versus body text (a package named in a section heading is a materially
// stronger signal than an incidental mention) — implemented by scanning the
// SAME heading heuristics buildLineProvenanceIndex() already recognises
// (HEADING_SENTINEL / the ALL-CAPS "SECTION n" pattern), not a second
// heading-detection system. Never forces a single package, never guesses:
// falls all the way through to UNCLASSIFIED (an explicit value, not a bare
// empty array) when no tier produces a real signal.
function classifyPackages(text, filename, documentType) {
  const safeText = text || '';
  const lower = safeText.toLowerCase();

  // Tier 1: explicit scope/package statement.
  const explicitMatch = safeText.match(EXPLICIT_SCOPE_PATTERN);
  if (explicitMatch) {
    const statement = explicitMatch[1].toLowerCase();
    const found = PACKAGE_KEYWORDS.filter(entry => entry.terms.some(t => statement.indexOf(t) !== -1)).map(entry => entry.pkg);
    if (found.length) {
      return {
        packages: Array.from(new Set(found)).map(pkg => ({ package: pkg, confidence: 'high', source: 'explicit_scope_statement', matched_terms: [explicitMatch[1].trim()] })),
        note: `Package(s) classified from an explicit scope/package statement in the document: "${explicitMatch[1].trim()}".`
      };
    }
  }

  // Tier 2: content + heading keyword scoring.
  const lines = safeText.split(/\r?\n/);
  const headingLinesLower = [];
  lines.forEach(line => {
    const isHeadingSentinel = line.startsWith(HEADING_SENTINEL);
    const isCapsHeading = /^\s*(?:SECTION|SECTION\s*\d+|§)\s*[:\-—]?\s*(\d+[.\s—-]*.+)$/i.test(line) || /^\s*(\d+(?:\.\d+)?)\s+([A-Z][A-Z \-\/]{4,})\s*$/.test(line);
    if (isHeadingSentinel || isCapsHeading) headingLinesLower.push(line.toLowerCase());
  });
  const scores = PACKAGE_KEYWORDS.map(entry => {
    let score = 0; const matched = [];
    entry.terms.forEach(t => {
      if (lower.indexOf(t) === -1) return;
      matched.push(t);
      score += headingLinesLower.some(h => h.indexOf(t) !== -1) ? 2 : 1;
    });
    return { pkg: entry.pkg, score, matched };
  }).filter(s => s.score > 0);
  if (scores.length) {
    return {
      packages: scores.map(s => ({ package: s.pkg, confidence: s.score >= 2 ? 'high' : 'medium', source: 'content', matched_terms: s.matched })),
      note: `Package(s) classified from document content/headings: ${scores.map(s => s.pkg).join(', ')}.`
    };
  }

  // Tier 3: document-type hint (only reached when Tiers 1-2 gave nothing).
  if (documentType && DOCUMENT_TYPE_PACKAGE_HINT[documentType]) {
    return {
      packages: [{ package: DOCUMENT_TYPE_PACKAGE_HINT[documentType], confidence: 'medium', source: 'document_type', matched_terms: [] }],
      note: `No package keywords found in document content — inferred from document type ("${documentType}") only.`
    };
  }

  // Tier 4: filename (only reached when Tiers 1-3 gave nothing).
  const fnGuess = guessPackageFromFilename(filename);
  if (fnGuess) {
    return {
      packages: [{ package: fnGuess, confidence: 'low', source: 'filename', matched_terms: [] }],
      note: `No package keywords found in document content, headings or document type — this is a low-confidence guess from the filename only ("${filename || 'unnamed file'}").`
    };
  }

  // Tier 5: genuinely unclassified — an explicit value, never a forced guess.
  return {
    packages: [{ package: PACKAGE.UNCLASSIFIED, confidence: 'low', source: 'none', matched_terms: [] }],
    note: 'No reliable package/scope signal found in content, headings, document type or filename — classified as UNCLASSIFIED rather than guessed.'
  };
}

// ---------------------------------------------------------------------------
// Fact-level SCOPE (Batch 2A) — a lightweight, controlled textual scope
// narrower than the parent document's package(s) (e.g. the document's
// package is DRAINAGE generally, but this one fact is specifically about
// "roof_drainage"). Deliberately NOT a geometry engine: a fixed, inspectable
// vocabulary (the exact examples given in the governing brief) matched
// against the fact's own local sentence context — the SAME `sentence` string
// already computed by extractFactsFromText() for
// classifyStatusFromContext()/assessMatchConfidence(), no new text-scanning
// pass. Returns null (never a guessed default) when no narrower scope is
// evidenced — this never invents "whole_building" from silence.
// ---------------------------------------------------------------------------

const FACT_SCOPE_KEYWORDS = [
  { scope: 'elevation', terms: ['north elevation', 'south elevation', 'east elevation', 'west elevation', 'elevation drawing'] },
  { scope: 'canopy', terms: ['canopy'] },
  { scope: 'roof_drainage', terms: ['roof drainage', 'rainwater goods', 'gutter', 'downpipe'] },
  { scope: 'foundation_package', terms: ['foundation', 'pad foundation', 'footing', 'substructure'] },
  { scope: 'fire_alarm', terms: ['fire alarm', 'smoke detector', 'fire detection'] },
  { scope: 'emergency_lighting', terms: ['emergency lighting', 'escape lighting'] },
  { scope: 'roller_door', terms: ['roller door', 'roller shutter'] },
  { scope: 'personnel_door', terms: ['personnel door', 'pedestrian door'] },
  { scope: 'external_works', terms: ['external works', 'car park', 'landscaping', 'boundary treatment'] },
  { scope: 'whole_building', terms: ['whole building', 'entire building', 'overall building'] }
];

function classifyFactScope(sentence) {
  const lower = (sentence || '').toLowerCase();
  for (const entry of FACT_SCOPE_KEYWORDS) {
    if (entry.terms.some(t => lower.indexOf(t) !== -1)) return entry.scope;
  }
  return null;
}

// =============================================================================
// Evidence Intelligence — Batch 2B (2026-08-26): RESPONSIBILITY & INTERFACE
// INTELLIGENCE. "Who appears to own, design, supply, install, assist, provide
// information for, or exclude each relevant part of the project — and where
// do responsibilities/interfaces meet?" Builds ON Batch 2A's package/scope
// classification (reused directly below, not duplicated) and stores its
// output in the SAME project object (`p.parties`, `p.relationships`) — no
// second evidence store, no second package model, no parallel responsibility
// engine.
//
// GOVERNING SAFEGUARD (encoded structurally, not just documented): assistance
// and information-provision are NEVER upgraded into responsibility anywhere
// in this section. ASSISTED_BY/INFORMATION_PROVIDED_BY relationships are
// produced by entirely separate rules from RESPONSIBLE_FOR/DESIGNED_BY/
// SUPPLIED_BY/INSTALLED_BY — there is no code path that reads an assistance/
// information relationship and promotes it to a responsibility one. A party
// merely NAMED in a multi-topic document (the Job D/Job D site pattern
// — document possession/collation is not technical responsibility) with no
// matching explicit-relationship pattern produces NO relationship record at
// all for that party in that document — never a guessed RESPONSIBLE_FOR.
// =============================================================================

const PARTY_TYPE = {
  CUSTOMER: 'CUSTOMER',
  BUILDING_SUPPLIER: 'BUILDING_SUPPLIER',
  GROUNDWORKS_CONTRACTOR: 'GROUNDWORKS_CONTRACTOR',
  STRUCTURAL_ENGINEER: 'STRUCTURAL_ENGINEER',
  GEOTECHNICAL_ENGINEER: 'GEOTECHNICAL_ENGINEER',
  CIVIL_DRAINAGE_ENGINEER: 'CIVIL_DRAINAGE_ENGINEER',
  FIRE_ENGINEER: 'FIRE_ENGINEER',
  PLANNING_CONSULTANT: 'PLANNING_CONSULTANT',
  BUILDING_CONTROL: 'BUILDING_CONTROL',
  PRINCIPAL_DESIGNER: 'PRINCIPAL_DESIGNER',
  PRINCIPAL_CONTRACTOR: 'PRINCIPAL_CONTRACTOR',
  SPECIALIST_CONTRACTOR: 'SPECIALIST_CONTRACTOR',
  OTHER: 'OTHER'
};

const RELATIONSHIP_TYPE = {
  RESPONSIBLE_FOR: 'RESPONSIBLE_FOR',
  DESIGNED_BY: 'DESIGNED_BY',
  SUPPLIED_BY: 'SUPPLIED_BY',
  INSTALLED_BY: 'INSTALLED_BY',
  ASSISTED_BY: 'ASSISTED_BY',
  INFORMATION_PROVIDED_BY: 'INFORMATION_PROVIDED_BY',
  CLIENT_RESPONSIBILITY: 'CLIENT_RESPONSIBILITY',
  EXCLUDED_FROM_SCOPE: 'EXCLUDED_FROM_SCOPE',
  RESPONSIBILITY_UNCLEAR: 'RESPONSIBILITY_UNCLEAR'
};

// Relationship types that represent a genuine OWNERSHIP/responsibility claim
// (as opposed to mere assistance/information-provision, which can never
// conflict with — or be promoted into — an ownership claim). Used only by
// crossCheckResponsibility() below to decide what is even eligible to
// produce a RESPONSIBILITY_UNCLEAR conflict.
const OWNERSHIP_RELATIONSHIP_TYPES = [
  RELATIONSHIP_TYPE.RESPONSIBLE_FOR,
  RELATIONSHIP_TYPE.CLIENT_RESPONSIBILITY,
  RELATIONSHIP_TYPE.SUPPLIED_BY,
  RELATIONSHIP_TYPE.DESIGNED_BY,
  RELATIONSHIP_TYPE.INSTALLED_BY,
  RELATIONSHIP_TYPE.EXCLUDED_FROM_SCOPE
];

// Package pairs where evidence commonly shows two DIFFERENT packages
// genuinely meeting (as opposed to the SAME package/scope being contested —
// see crossCheckResponsibility()'s scope-based interface/conflict path,
// which independently covers the brief's "BUILDING_DRAINAGE <-> SITE_
// DRAINAGE" example — both are the DRAINAGE package, split by SCOPE text,
// not by package). Deliberately NOT exhaustive — only created when evidence
// (two actual relationship records) supports it, never hard-coded onto a
// project that has no such evidence.
const INTERFACE_PACKAGE_PAIRS = [
  [PACKAGE.BUILDING_FRAME, PACKAGE.FOUNDATIONS_CIVILS],
  [PACKAGE.ENVELOPE, PACKAGE.FIRE],
  [PACKAGE.DOORS_OPENINGS, PACKAGE.FIRE],
  [PACKAGE.DOORS_OPENINGS, PACKAGE.ACCESS_SITE_LOGISTICS]
];

// Generic role-phrase keyword sets — same transparent-scoring spirit as
// PACKAGE_KEYWORDS/EVIDENCE_FUNCTION_KEYWORDS. Order matters only in that
// CUSTOMER is checked first (see findPartyMentionsInSentence()) so "the
// client" is never mis-typed as OTHER.
const PARTY_TYPE_KEYWORDS = [
  { type: PARTY_TYPE.CUSTOMER, terms: ['the customer', 'the client'] },
  { type: PARTY_TYPE.BUILDING_SUPPLIER, terms: ['building supplier', 'steel building supplier', 'the supplier'] },
  { type: PARTY_TYPE.GROUNDWORKS_CONTRACTOR, terms: ['groundworks contractor'] },
  { type: PARTY_TYPE.STRUCTURAL_ENGINEER, terms: ['structural engineer'] },
  { type: PARTY_TYPE.GEOTECHNICAL_ENGINEER, terms: ['geotechnical engineer'] },
  { type: PARTY_TYPE.CIVIL_DRAINAGE_ENGINEER, terms: ['civil/drainage engineer', 'civil and drainage engineer', 'civil engineer', 'drainage engineer'] },
  { type: PARTY_TYPE.FIRE_ENGINEER, terms: ['fire engineer', 'fire consultant'] },
  { type: PARTY_TYPE.PLANNING_CONSULTANT, terms: ['planning consultant'] },
  { type: PARTY_TYPE.BUILDING_CONTROL, terms: ['building control'] },
  { type: PARTY_TYPE.PRINCIPAL_DESIGNER, terms: ['principal designer'] },
  { type: PARTY_TYPE.PRINCIPAL_CONTRACTOR, terms: ['principal contractor'] },
  { type: PARTY_TYPE.SPECIALIST_CONTRACTOR, terms: ['specialist contractor', 'erection contractor'] }
];

function titleCasePartyType(type) {
  return String(type || '').toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

// Finds every party-role mention within one sentence, in left-to-right
// order, each with its character offset (used by the relationship rules
// below to find the "nearest preceding/following party" for a matched verb).
// A "Name (Role)" pattern is tried first for a real proper-noun name (e.g.
// "Acme Frames Ltd (Building Supplier)"); when absent, the party's name
// defaults to a generic, human-readable label derived from its type (e.g.
// "Structural Engineer") — never a fabricated company name.
function findPartyMentionsInSentence(sentence) {
  const lower = (sentence || '').toLowerCase();
  const mentions = [];
  PARTY_TYPE_KEYWORDS.concat([{ type: null, terms: [] }]).forEach(entry => {
    if (!entry.type) return;
    entry.terms.forEach(t => {
      let idx = lower.indexOf(t);
      while (idx !== -1) {
        // "Name (Role)" — look immediately before this mention for
        // "<Name> (" ending right at idx.
        const before = sentence.slice(Math.max(0, idx - 60), idx);
        const nameMatch = before.match(/([A-Z][A-Za-z&.,' ]{2,50}?)\s*\($/);
        mentions.push({
          party_type: entry.type,
          party_name: nameMatch ? nameMatch[1].trim() : titleCasePartyType(entry.type),
          named: !!nameMatch,
          index: idx
        });
        idx = lower.indexOf(t, idx + 1);
      }
    });
  });
  mentions.sort((a, b) => a.index - b.index);
  return mentions;
}

function nearestParty(mentions, refIndex, direction) {
  let best = null, bestDist = Infinity;
  mentions.forEach(m => {
    const dist = direction === 'before' ? (refIndex - m.index) : (m.index - refIndex);
    if (dist >= 0 && dist < bestDist) { bestDist = dist; best = m; }
  });
  return best;
}

// Resolves a captured free-text role phrase (e.g. from the EXCLUDED_FROM_SCOPE/
// RESPONSIBLE_FOR patterns below, which capture the party phrase directly
// rather than relying on nearest-mention proximity) against the same
// PARTY_TYPE_KEYWORDS table — returns null (never a guess) if nothing matches.
function resolvePartyFromPhrase(phrase) {
  const lower = (phrase || '').toLowerCase();
  if (/\b(client|customer)\b/.test(lower)) return { party_type: PARTY_TYPE.CUSTOMER, party_name: titleCasePartyType(PARTY_TYPE.CUSTOMER), named: false };
  for (const entry of PARTY_TYPE_KEYWORDS) {
    if (entry.terms.some(t => lower.indexOf(t) !== -1)) return { party_type: entry.type, party_name: titleCasePartyType(entry.type), named: false };
  }
  return null;
}

// Stable party id: same type+name always resolves to the same party across
// documents/rebuilds in one project (a named party takes precedence over a
// generic unnamed bucket of the same type) — mirrors the stable-key pattern
// buildStage2Findings()/buildStage3Actions() already use for history
// preservation, applied here to party identity instead.
function partyId(partyType, partyName) {
  return 'party-' + slugify(partyType) + '-' + slugify(partyName || titleCasePartyType(partyType));
}

function normalizeScopeText(s) {
  return String(s || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Relationship extraction rules. Each rule matches a specific, generic,
// real-world verb phrase (not a fixed string tied to one document) and
// resolves its acting party via the NEAREST preceding party-role mention in
// the same sentence (`partyRole: 'nearest'`) or, for the CUSTOMER/EXCLUDED/
// RESPONSIBLE_FOR patterns which name their own party phrase directly, via
// resolvePartyFromPhrase() on a captured group (`partyRole: 'captured'`).
// `explicit` is true for a direct statement; the one deliberately INFERRED
// rule (weakInformationMention, below) is markedly weaker wording
// ("discusses"), matching the brief's own worked example.
// ---------------------------------------------------------------------------

const RELATIONSHIP_VERB_RULES = [
  { type: RELATIONSHIP_TYPE.DESIGNED_BY, explicit: true, partyRole: 'nearest',
    pattern: /\bdesigns?\s+(?:the\s+)?([a-z][a-z ]{2,60}?)(?=[.,\n]|\s+using|\s+for)/gi },
  { type: RELATIONSHIP_TYPE.SUPPLIED_BY, explicit: true, partyRole: 'nearest',
    pattern: /\bsuppl(?:y|ies|ied)\s+(?:the\s+)?([a-z][a-z ]{2,60}?)(?=[.,\n])/gi },
  { type: RELATIONSHIP_TYPE.INSTALLED_BY, explicit: true, partyRole: 'nearest',
    pattern: /\binstalls?\s+(?:the\s+)?([a-z][a-z ]{2,60}?)(?=[.,\n])/gi },
  { type: RELATIONSHIP_TYPE.INFORMATION_PROVIDED_BY, explicit: true, partyRole: 'nearest', hasRecipient: true,
    pattern: /\bprovides?\s+(?:the\s+)?(final structural reactions|structural reactions|reactions|drawings|calculations|information|data)\b/gi },
  { type: RELATIONSHIP_TYPE.ASSISTED_BY, explicit: true, partyRole: 'nearest', fixedRecipient: PARTY_TYPE.CUSTOMER,
    pattern: /\b(?:assist(?:s|ed)?|help(?:s|ed)?)\s+(?:the\s+)?(?:customer|client)\s+(?:with|to)\s+([a-z][a-z ]{2,60}?)(?=[.,\n])/gi }
];

// The one deliberately INFERRED rule — much weaker wording ("discusses")
// than the explicit rules above, matching the brief's own worked example
// ("Method statement prepared by supplier discusses fire alarm... must NOT
// automatically become RESPONSIBLE_FOR"). Always low confidence, always
// INFORMATION_PROVIDED_BY (the weakest positive relationship type), never
// RESPONSIBLE_FOR/DESIGNED_BY/SUPPLIED_BY/INSTALLED_BY.
const INFERRED_MENTION_PATTERN = /\b([a-z][a-z ]{2,50}?)(?:'s)?\s+method\s+statement\s+discusses\s+(?:the\s+)?([a-z][a-z ]{2,60}?)(?=[.,\n])/gi;

// CLIENT_RESPONSIBILITY: the party is always CUSTOMER, named directly by the
// pattern itself (no proximity search needed).
const CLIENT_RESPONSIBILITY_PATTERN = /\b(?:the\s+)?(?:client|customer)\s+(?:is\s+responsible\s+for|to\s+provide|shall\s+provide|will\s+provide)\s+(?:the\s+)?([a-z][a-z ]{2,60}?)(?=[.,\n])/gi;

// RESPONSIBLE_FOR: only ever created from this exact direct-statement
// pattern — never inferred from a party merely appearing in, authoring, or
// assisting with a document (see the governing safeguard comment above).
const RESPONSIBLE_FOR_PATTERN = /\b(?:the\s+)?([a-z][a-z\/ ]{2,50}?)\s+is\s+responsible\s+for\s+(?:the\s+)?([a-z][a-z ]{2,60}?)(?=[.,\n])/gi;

// EXCLUDED_FROM_SCOPE: canonical "<item> is excluded from the <party>'s
// scope" phrasing — party_to is the EXCLUDING party (whose scope it's
// excluded from), never an automatic customer-responsibility inference (see
// "CONTRACTUAL EXCLUSIONS" in the governing brief — responsibility is only
// assigned elsewhere, from its OWN explicit evidence, never from an
// exclusion alone).
const EXCLUDED_FROM_SCOPE_PATTERN = /([a-z][a-z ]{2,60}?)\s+is\s+excluded\s+from\s+(?:the\s+)?([a-z][a-z ]{2,40}?)'s\s+scope/gi;

function relationshipId(type, partyToId, packages, scope, sourceFile) {
  return 'rel-' + slugify([type, partyToId, (packages || []).slice().sort().join('+'), normalizeScopeText(scope), sourceFile].join('|'));
}

// Resolves package(s)/scope for one relationship's captured object phrase —
// REUSES Batch 2A's own classifyPackages()/classifyFactScope() exactly
// (per instruction: "must build on Batch 2A's existing package/scope
// classification... do not create a second package model"). `objectPhrase`
// is checked first (short, precise); the whole sentence is used only as a
// fallback for scope when the phrase alone is too short/generic for
// classifyFactScope() to match, and is also fed into classifyPackages()
// (concatenated) so context words elsewhere in the sentence can still
// contribute a package match.
function resolveRelationshipPackageScope(objectPhrase, sentence, documentPackages) {
  const combinedText = objectPhrase + ' ' + (sentence || '');
  const cls = classifyPackages(combinedText, null, null);
  let packages = cls.packages.filter(p => p.package !== PACKAGE.UNCLASSIFIED).map(p => p.package);
  // Fall back to the parent document's own package(s) when the short object
  // phrase gives no package signal of its own — still real evidence (the
  // document's own classification), never a fabricated guess.
  if (!packages.length && documentPackages && documentPackages.length) {
    packages = documentPackages.filter(p => p.package !== PACKAGE.UNCLASSIFIED).map(p => p.package);
  }
  const scope = classifyFactScope(objectPhrase) || classifyFactScope(sentence) || objectPhrase.trim();
  return { packages, scope };
}

// Extracts every relationship this ONE document's text supports. Never
// invents a party or a relationship the text doesn't contain (see
// resolvePartyFromPhrase()/nearestParty() returning null when nothing
// matches — such a candidate is simply skipped, not defaulted). `meta`
// carries the same source_file/source_document_type context used elsewhere,
// plus `packages` (this document's own Batch 2A classification, used as the
// fallback above).
function extractRelationshipsFromText(text, meta) {
  const relationships = [];
  if (!text) return relationships;
  const lineProv = buildLineProvenanceIndex(text);
  const sentences = text.split(/(?<=[.\n])/).map(s => s.trim()).filter(Boolean);
  let cursor = 0;

  sentences.forEach(rawSentence => {
    const sentenceStart = text.indexOf(rawSentence, cursor);
    cursor = sentenceStart >= 0 ? sentenceStart + rawSentence.length : cursor;
    const sentence = rawSentence;
    const mentions = findPartyMentionsInSentence(sentence);

    RELATIONSHIP_VERB_RULES.forEach(rule => {
      const re = new RegExp(rule.pattern.source, rule.pattern.flags.indexOf('g') === -1 ? rule.pattern.flags + 'g' : rule.pattern.flags);
      let m;
      while ((m = re.exec(sentence)) !== null) {
        const objectPhrase = (m[1] || '').trim();
        if (!objectPhrase) { if (re.lastIndex === m.index) re.lastIndex++; continue; }
        const actingParty = nearestParty(mentions, m.index, 'before');
        if (!actingParty) { if (re.lastIndex === m.index) re.lastIndex++; continue; } // no party found — skip, never guess
        let recipientParty = null;
        if (rule.fixedRecipient) recipientParty = { party_type: rule.fixedRecipient, party_name: titleCasePartyType(rule.fixedRecipient) };
        else if (rule.hasRecipient) recipientParty = nearestParty(mentions, m.index + m[0].length, 'after');
        const { packages, scope } = resolveRelationshipPackageScope(objectPhrase, sentence, meta.packages);
        const globalIdx = sentenceStart >= 0 ? sentenceStart + m.index : 0;
        relationships.push(buildRelationship({
          type: rule.type, explicit: rule.explicit, actingParty, recipientParty,
          packages, scope, meta, lineProv, text, globalIdx
        }));
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    });

    // Deliberately-INFERRED weak mention rule.
    const infRe = new RegExp(INFERRED_MENTION_PATTERN.source, 'gi');
    let im;
    while ((im = infRe.exec(sentence)) !== null) {
      const partyPhrase = (im[1] || '').trim();
      const objectPhrase = (im[2] || '').trim();
      const acting = resolvePartyFromPhrase(partyPhrase) || nearestParty(mentions, im.index, 'before');
      if (!acting || !objectPhrase) { if (infRe.lastIndex === im.index) infRe.lastIndex++; continue; }
      const { packages, scope } = resolveRelationshipPackageScope(objectPhrase, sentence, meta.packages);
      const globalIdx = sentenceStart >= 0 ? sentenceStart + im.index : 0;
      relationships.push(buildRelationship({
        type: RELATIONSHIP_TYPE.INFORMATION_PROVIDED_BY, explicit: false, actingParty: acting, recipientParty: null,
        packages, scope, meta, lineProv, text, globalIdx,
        notes: 'Topical mention only ("discusses") — not a design/supply/install/responsibility claim; inferred, not explicit.'
      }));
      if (infRe.lastIndex === im.index) infRe.lastIndex++;
    }

    // CLIENT_RESPONSIBILITY — party fixed to CUSTOMER by the pattern itself.
    const crRe = new RegExp(CLIENT_RESPONSIBILITY_PATTERN.source, 'gi');
    let cm;
    while ((cm = crRe.exec(sentence)) !== null) {
      const objectPhrase = (cm[1] || '').trim();
      if (!objectPhrase) { if (crRe.lastIndex === cm.index) crRe.lastIndex++; continue; }
      const { packages, scope } = resolveRelationshipPackageScope(objectPhrase, sentence, meta.packages);
      const globalIdx = sentenceStart >= 0 ? sentenceStart + cm.index : 0;
      relationships.push(buildRelationship({
        type: RELATIONSHIP_TYPE.CLIENT_RESPONSIBILITY, explicit: true,
        actingParty: { party_type: PARTY_TYPE.CUSTOMER, party_name: titleCasePartyType(PARTY_TYPE.CUSTOMER) },
        recipientParty: null, packages, scope, meta, lineProv, text, globalIdx
      }));
      if (crRe.lastIndex === cm.index) crRe.lastIndex++;
    }

    // RESPONSIBLE_FOR — only from this exact direct statement.
    const rfRe = new RegExp(RESPONSIBLE_FOR_PATTERN.source, 'gi');
    let rm;
    while ((rm = rfRe.exec(sentence)) !== null) {
      const partyPhrase = (rm[1] || '').trim();
      const objectPhrase = (rm[2] || '').trim();
      const acting = resolvePartyFromPhrase(partyPhrase);
      // A client/customer "is responsible for" statement is exclusively the
      // dedicated CLIENT_RESPONSIBILITY pattern's territory (see below) —
      // skipped here so the same sentence doesn't produce two overlapping
      // relationship records for the same party/scope.
      if (!acting || !objectPhrase || acting.party_type === PARTY_TYPE.CUSTOMER) { if (rfRe.lastIndex === rm.index) rfRe.lastIndex++; continue; }
      const { packages, scope } = resolveRelationshipPackageScope(objectPhrase, sentence, meta.packages);
      const globalIdx = sentenceStart >= 0 ? sentenceStart + rm.index : 0;
      relationships.push(buildRelationship({
        type: RELATIONSHIP_TYPE.RESPONSIBLE_FOR, explicit: true, actingParty: acting, recipientParty: null,
        packages, scope, meta, lineProv, text, globalIdx
      }));
      if (rfRe.lastIndex === rm.index) rfRe.lastIndex++;
    }

    // EXCLUDED_FROM_SCOPE.
    const exRe = new RegExp(EXCLUDED_FROM_SCOPE_PATTERN.source, 'gi');
    let em;
    while ((em = exRe.exec(sentence)) !== null) {
      const objectPhrase = (em[1] || '').trim();
      const partyPhrase = (em[2] || '').trim();
      const acting = resolvePartyFromPhrase(partyPhrase);
      if (!acting || !objectPhrase) { if (exRe.lastIndex === em.index) exRe.lastIndex++; continue; }
      const { packages, scope } = resolveRelationshipPackageScope(objectPhrase, sentence, meta.packages);
      const globalIdx = sentenceStart >= 0 ? sentenceStart + em.index : 0;
      relationships.push(buildRelationship({
        type: RELATIONSHIP_TYPE.EXCLUDED_FROM_SCOPE, explicit: true, actingParty: acting, recipientParty: null,
        packages, scope, meta, lineProv, text, globalIdx
      }));
      if (exRe.lastIndex === em.index) exRe.lastIndex++;
    }
  });

  return relationships;
}

function buildRelationship(args) {
  const { type, explicit, actingParty, recipientParty, packages, scope, meta, lineProv, text, globalIdx, notes } = args;
  const partyToId_ = partyId(actingParty.party_type, actingParty.party_name);
  const partyFromId_ = recipientParty ? partyId(recipientParty.party_type, recipientParty.party_name) : null;
  return {
    relationship_id: relationshipId(type, partyToId_, packages, scope, meta.source_file),
    project_id: meta.project_id,
    relationship_type: type,
    package: packages,
    scope: scope,
    party_from: partyFromId_,
    party_to: partyToId_,
    supporting_evidence_ids: [],
    source_files: [meta.source_file],
    source_pages_or_sections: [provenanceAt(lineProv, globalIdx, text)],
    confidence: explicit ? 'medium' : 'low',
    explicit_or_inferred: explicit ? 'EXPLICIT' : 'INFERRED',
    contractual_basis: null,
    exclusions_or_limits: type === RELATIONSHIP_TYPE.EXCLUDED_FROM_SCOPE ? scope : null,
    interface_with: [],
    created_at: Date.now(),
    superseded_by: null,
    notes: notes || '',
    _parties: [actingParty].concat(recipientParty ? [recipientParty] : []) // internal only, stripped before storage — see registerParties()
  };
}

// Registers every party mentioned by any relationship into the project's
// party registry (p.parties, keyed by stable party_id — see partyId()).
// Never invents a party independently of a relationship that actually
// mentions one. `source_evidence_ids` here holds the RELATIONSHIP ids that
// mention this party (the brief's own field name), reusing existing project
// storage rather than a parallel party/evidence store.
function registerParties(p, relationships) {
  p.parties = p.parties || {};
  relationships.forEach(r => {
    (r._parties || []).forEach(party => {
      const id = partyId(party.party_type, party.party_name);
      if (!p.parties[id]) {
        p.parties[id] = { party_id: id, party_name: party.party_name, party_type: party.party_type, source_evidence_ids: [], confidence: party.named ? 'medium' : 'low', notes: party.named ? '' : 'No specific company/individual name found in the evidence — generic role label used.' };
      }
      if (!p.parties[id].source_evidence_ids.includes(r.relationship_id)) p.parties[id].source_evidence_ids.push(r.relationship_id);
    });
  });
}

// Cross-checks relationships that share the SAME normalised scope text.
// Two DIFFERENT parties on the same scope via two OWNERSHIP-type
// relationships (RESPONSIBLE_FOR/CLIENT_RESPONSIBILITY/SUPPLIED_BY/
// DESIGNED_BY/INSTALLED_BY/EXCLUDED_FROM_SCOPE) from DIFFERENT source
// documents is a genuine responsibility CONFLICT — never silently resolved;
// both originals are preserved untouched and a separate RESPONSIBILITY_
// UNCLEAR marker relationship is added referencing both (mirrors
// crossCheckEvidence()'s own "flip status, keep both, cross-link" pattern
// for facts, applied here to relationships instead — no new philosophy).
// Two DIFFERENT parties on the same scope via COMPLEMENTARY roles (e.g.
// DESIGNED_BY + INSTALLED_BY on the same "foundation" scope) is not a
// conflict at all — it is a genuine INTERFACE, recorded via `interface_with`
// on both relationships, never collapsed into one.
function crossCheckResponsibility(relationships) {
  const byScope = {};
  relationships.forEach(r => {
    if (!r.scope) return;
    const k = normalizeScopeText(r.scope);
    (byScope[k] = byScope[k] || []).push(r);
  });
  const extraUnclear = [];
  Object.keys(byScope).forEach(k => {
    const group = byScope[k];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.party_to === b.party_to) continue; // same party — nothing to reconcile
        const aOwns = OWNERSHIP_RELATIONSHIP_TYPES.includes(a.relationship_type);
        const bOwns = OWNERSHIP_RELATIONSHIP_TYPES.includes(b.relationship_type);
        if (aOwns && bOwns && a.source_files[0] !== b.source_files[0]) {
          extraUnclear.push({
            relationship_id: 'rel-unclear-' + slugify(k) + '-' + slugify(a.relationship_id + '+' + b.relationship_id),
            project_id: a.project_id,
            relationship_type: RELATIONSHIP_TYPE.RESPONSIBILITY_UNCLEAR,
            package: Array.from(new Set((a.package || []).concat(b.package || []))),
            scope: k,
            party_from: a.party_to,
            party_to: b.party_to,
            supporting_evidence_ids: [],
            source_files: Array.from(new Set(a.source_files.concat(b.source_files))),
            source_pages_or_sections: Array.from(new Set(a.source_pages_or_sections.concat(b.source_pages_or_sections))),
            confidence: 'low',
            explicit_or_inferred: 'UNCLEAR',
            contractual_basis: null,
            exclusions_or_limits: null,
            interface_with: [],
            created_at: Date.now(),
            superseded_by: null,
            notes: `Conflicting responsibility evidence for "${k}": "${a.relationship_type}" (${a.party_to}, ${a.source_files[0]}) vs. "${b.relationship_type}" (${b.party_to}, ${b.source_files[0]}). Both sources preserved — neither is silently chosen as the winner. Full discrepancy reasoning is Batch 3 territory.`,
            conflicts_with: [a.relationship_id, b.relationship_id]
          });
        } else if (!aOwns || !bOwns || a.source_files[0] === b.source_files[0]) {
          // Complementary (design/install, etc.) or same-document mentions —
          // a genuine interface, not a conflict.
          if (!a.interface_with.includes(b.party_to)) a.interface_with.push(b.party_to);
          if (!b.interface_with.includes(a.party_to)) b.interface_with.push(a.party_to);
        }
      }
    }
  });
  // Package-pair interfaces (e.g. BUILDING_FRAME <-> FOUNDATIONS_CIVILS) —
  // only when evidence (two real relationships with different parties)
  // actually supports it, never hard-coded onto a project without it.
  for (let i = 0; i < relationships.length; i++) {
    for (let j = i + 1; j < relationships.length; j++) {
      const a = relationships[i], b = relationships[j];
      if (a.party_to === b.party_to) continue;
      const pairMatch = INTERFACE_PACKAGE_PAIRS.some(([p1, p2]) =>
        ((a.package || []).includes(p1) && (b.package || []).includes(p2)) ||
        ((a.package || []).includes(p2) && (b.package || []).includes(p1))
      );
      if (pairMatch) {
        if (!a.interface_with.includes(b.party_to)) a.interface_with.push(b.party_to);
        if (!b.interface_with.includes(a.party_to)) b.interface_with.push(a.party_to);
      }
    }
  }
  return relationships.concat(extraUnclear);
}

// Orchestration — builds/rebuilds p.parties/p.relationships from every
// currently-readable document, exactly the same "full rebuild each time"
// pattern buildProjectEvidenceLedger() already uses for p.evidenceRecords
// (see that function's own comment on why this is safe: nothing is deleted
// from p.evidence itself, so a full rebuild never loses history — both
// sides of a conflict remain visible on every rebuild for as long as both
// source documents remain uploaded). Called from buildProjectEvidenceLedger()
// below — no separate call site, no second evidence pipeline.
function buildProjectResponsibilityModel(p) {
  if (!p || !Array.isArray(p.evidence)) return { parties: {}, relationships: [] };
  let allRelationships = [];
  p.evidence.forEach(e => {
    if (!e.extractedText) return;
    const meta = { project_id: p.id, source_file: e.name, packages: e.packages || [] };
    allRelationships = allRelationships.concat(extractRelationshipsFromText(e.extractedText, meta));
  });
  p.parties = {};
  registerParties(p, allRelationships);
  allRelationships = crossCheckResponsibility(allRelationships);
  // Strip the internal-only `_parties` helper field before storage — it was
  // only needed by registerParties() above, never part of the stored schema.
  allRelationships.forEach(r => { delete r._parties; });
  p.relationships = allRelationships;
  return { parties: p.parties, relationships: p.relationships };
}

// =============================================================================
// Evidence Intelligence — Batch 3 (2026-08-26): DISCREPANCY, AUTHORITY
// REQUIREMENT & MISSING-EVIDENCE INTELLIGENCE. Builds on Batch 1 (evidence
// function/maturity/provenance), Batch 2A (package/scope) and Batch 2B
// (party/responsibility/interface) — all reused directly, none duplicated.
// Stored on the project object (`p.discrepancies`, `p.authorityRequirements`,
// `p.missingEvidence`) — existing project-storage convention, no parallel
// evidence/discrepancy/authority store.
//
// NAMING NOTE: this is a THIRD, separate "Batch 3" label in this codebase —
// distinct from (1) the original Batch 1/1B/2/3/4 extraction->Stage1->
// Stage2->Stage3 track, whose own "Batch 3" (`STAGE2_FINDING_STATUS` etc.,
// see far below) is unrelated and unchanged, and (2) nothing else uses this
// number. Comments below say "this Batch 3" whenever ambiguity is possible.
// =============================================================================

// -----------------------------------------------------------------------
// PART 1 — Contextual discrepancy model. Interprets pairs of records
// Batch 1's OWN crossCheckEvidence() already linked via conflicts_with (or
// flagged DOCUMENT_INTERNAL_INCONSISTENCY) — this does NOT re-scan text or
// re-detect conflicts; raw evidence conflict preservation (both records,
// unaltered, evidence_status/conflicts_with) is completely untouched. This
// layer only adds an INTERPRETATION on top of an already-detected pair.
// -----------------------------------------------------------------------

const DISCREPANCY_TYPE = {
  REFINEMENT: 'REFINEMENT',
  REQUIRES_CONFIRMATION: 'REQUIRES_CONFIRMATION',
  MATERIAL_CONFLICT: 'MATERIAL_CONFLICT'
};

// Per-subject reasoning profile — deliberately NOT a single universal
// tolerance (per instruction). `toleranceRelative` is the relative
// difference within which an approximate->precise pair is a plausible
// REFINEMENT for THIS subject; `criticality` informs the descriptive
// consequence text (never itself a hard gate for MATERIAL_CONFLICT — see
// classifyDiscrepancy() below, which gates on approved-standing-contradicted,
// not on criticality alone, so a merely "high criticality" large difference
// with no approved standing on either side correctly stays
// REQUIRES_CONFIRMATION, not MATERIAL_CONFLICT — see governing brief scenario
// B vs. scenario C).
const SUBJECT_DISCREPANCY_PROFILE = {
  building_footprint_dimensions: { toleranceRelative: 0.05, criticality: 'medium', label: 'building footprint dimensions' },
  overall_building_length: { toleranceRelative: 0.05, criticality: 'medium', label: 'overall building length' },
  eaves_height: { toleranceRelative: 0.02, criticality: 'high', label: 'eaves height' },
  allowable_bearing_pressure: { toleranceRelative: 0.02, criticality: 'high', label: 'allowable bearing pressure' },
  slab_thickness: { toleranceRelative: 0.05, criticality: 'medium', label: 'slab thickness' },
  made_ground_depth: { toleranceRelative: 0.1, criticality: 'medium', label: 'made ground depth' }
};
const DEFAULT_DISCREPANCY_PROFILE = { toleranceRelative: 0.03, criticality: 'medium', label: 'this subject' };

// "Approved/authoritative standing" — reuses Batch 1's OWN evidence_function/
// evidence_maturity vocabulary directly (never a second status system).
// Deliberately excludes a maturity entry that was CAPPED by an integrity
// limitation (Batch 1's own safeguard) — an incomplete/unsigned document
// claiming AUTHORITY_DECISION must not count as genuine approved standing
// here either (same governing principle carried through).
function hasApprovedStanding(record) {
  return (record.evidence_maturity || []).some(m => m.maturity === EVIDENCE_MATURITY.AUTHORITY_ACCEPTED && !m.capped);
}

function relativeDifference(a, b) {
  const na = extractNumberToken(a), nb = extractNumberToken(b);
  if (na === null || nb === null || na === 0) return null;
  return Math.abs(na - nb) / Math.abs(na);
}

// Core classification. Never picks a winner between the two records — both
// are always referenced, unaltered, by the resulting discrepancy record;
// this function only decides how to LABEL their relationship for a human
// reviewer, per the brief's three-way distinction.
function classifyDiscrepancy(a, b, subject) {
  const profile = SUBJECT_DISCREPANCY_PROFILE[subject] || DEFAULT_DISCREPANCY_PROFILE;
  const relDiff = relativeDifference(a.extracted_value, b.extracted_value);
  const approxPattern = !!a.approx_wording !== !!b.approx_wording; // exactly one side used approximate wording

  // REFINEMENT: an approximate->precise wording pattern, AND the actual
  // numeric difference is within THIS subject's own tolerance — a small
  // dimensional refinement is judged differently from a bearing-pressure or
  // fire-performance figure (see SUBJECT_DISCREPANCY_PROFILE above).
  if (approxPattern && relDiff !== null && relDiff <= profile.toleranceRelative) {
    return {
      type: DISCREPANCY_TYPE.REFINEMENT,
      comparison_basis: `One source uses approximate wording, the other a precise figure; the difference (${(relDiff * 100).toFixed(1)}%) is within normal tolerance for ${profile.label} — a natural refinement, not a conflict.`,
      requires_human_confirmation: false
    };
  }

  // MATERIAL_CONFLICT: one side carries genuine approved/authority-accepted
  // standing (Batch 1) that the other value contradicts, with no
  // superseding approval evidence for the new value — never triggered by
  // criticality/magnitude alone (see brief scenario B vs. C).
  const aApproved = hasApprovedStanding(a), bApproved = hasApprovedStanding(b);
  if (aApproved !== bApproved && (relDiff === null || relDiff > profile.toleranceRelative)) {
    const approvedRec = aApproved ? a : b, laterRec = aApproved ? b : a;
    return {
      type: DISCREPANCY_TYPE.MATERIAL_CONFLICT,
      comparison_basis: `"${approvedRec.extracted_value}" carries approved/authority-accepted standing (${approvedRec.source_file}); "${laterRec.extracted_value}" (${laterRec.source_file}) contradicts it with no approved amendment evidenced — for ${profile.label} (criticality: ${profile.criticality}), this could affect design/safety/compliance and must not be silently resolved.`,
      requires_human_confirmation: true
    };
  }

  // Otherwise: genuine uncertainty — both plausible, neither has
  // sufficiently strong precedence. Never resolved by "latest wins".
  return {
    type: DISCREPANCY_TYPE.REQUIRES_CONFIRMATION,
    comparison_basis: `Two sources give materially different values for ${profile.label} (${a.extracted_value} vs. ${b.extracted_value}) and neither carries approved/authority-accepted standing over the other — requires human confirmation, not an automatic choice.`,
    requires_human_confirmation: true
  };
}

function discrepancyId(subject, sourceFileA, sourceFileB) {
  return 'disc-' + slugify([subject, sourceFileA, sourceFileB].sort().join('|'));
}

// Builds ONE discrepancy record per unique conflicting pair already present
// in p.evidenceRecords (via conflicts_with, from Batch 1's crossCheckEvidence(),
// or DOCUMENT_INTERNAL_INCONSISTENCY) — deduplicated so a symmetric a<->b
// link produces exactly one record, never two. `earlier_value`/`later_value`
// are assigned by upload order (the closest available chronology signal —
// `document_date`/`revision` remain unpopulated placeholders, see Batch 1),
// never by silently assuming the later upload is more correct.
function buildProjectDiscrepancies(p) {
  const records = p.evidenceRecords || [];
  const uploadOrder = (p.evidence || []).map(e => e.name);
  const seen = new Set();
  const discrepancies = [];
  records.forEach(a => {
    (a.conflicts_with || []).forEach(otherId => {
      const b = records.find(r => r.evidence_id === otherId);
      if (!b || a.source_file === b.source_file) return; // same-document inconsistency handled by its own status already; cross-document only here
      const pairKey = [a.evidence_id, b.evidence_id].sort().join('|');
      if (seen.has(pairKey)) return;
      seen.add(pairKey);
      const cls = classifyDiscrepancy(a, b, a.subject);
      const aFirst = uploadOrder.indexOf(a.source_file) <= uploadOrder.indexOf(b.source_file);
      const earlier = aFirst ? a : b, later = aFirst ? b : a;
      const profile = SUBJECT_DISCREPANCY_PROFILE[a.subject] || DEFAULT_DISCREPANCY_PROFILE;
      discrepancies.push({
        discrepancy_id: discrepancyId(a.subject, a.source_file, b.source_file),
        project_id: p.id,
        discrepancy_type: cls.type,
        subject: a.subject,
        package: Array.from(new Set((a.packages || []).concat(b.packages || []))),
        scope: a.scope || b.scope || null,
        evidence_ids: [a.evidence_id, b.evidence_id],
        source_files: Array.from(new Set([a.source_file, b.source_file])),
        source_pages_or_sections: Array.from(new Set([a.source_page_or_section, b.source_page_or_section])),
        earlier_value: earlier.extracted_value,
        later_value: later.extracted_value,
        comparison_basis: cls.comparison_basis,
        consequence_if_unresolved: `Criticality: ${profile.criticality}. ${cls.type === DISCREPANCY_TYPE.MATERIAL_CONFLICT ? 'Could affect design, safety, compliance, price or programme if left unresolved.' : cls.type === DISCREPANCY_TYPE.REQUIRES_CONFIRMATION ? 'The correct value for ' + profile.label + ' remains genuinely unresolved until confirmed.' : 'Low consequence — a normal refinement from an approximate to a precise figure.'}`,
        confidence: a.confidence === 'high' && b.confidence === 'high' ? 'high' : 'medium',
        requires_human_confirmation: cls.requires_human_confirmation,
        created_at: Date.now(),
        resolved_at: null,
        resolution_evidence_ids: [],
        superseded_by: null,
        notes: ''
      });
    });
  });
  p.discrepancies = discrepancies;
  return discrepancies;
}

// -----------------------------------------------------------------------
// PART 2 — Authority requirement model. Building Control / planning / fire
// authority requirements, responses and (only where genuinely evidenced)
// acceptance/closure. Reuses Batch 1's evidence_function/evidence_maturity/
// documentIntegrityFlags directly — a document flagged with an integrity
// limitation (Batch 1) can NEVER be read here as a genuine authority
// acceptance, regardless of what its text appears to say (the "folder/
// filename trap" / incomplete-template safeguard — see governing brief
// scenario H).
// -----------------------------------------------------------------------

const AUTHORITY_TYPE = {
  BUILDING_CONTROL: 'BUILDING_CONTROL',
  PLANNING_AUTHORITY: 'PLANNING_AUTHORITY',
  FIRE_AUTHORITY: 'FIRE_AUTHORITY',
  OTHER_AUTHORITY: 'OTHER_AUTHORITY'
};

const AUTHORITY_REQUIREMENT_STATUS = {
  OPEN: 'OPEN',
  RESPONSE_SUPPLIED: 'RESPONSE_SUPPLIED',
  APPARENTLY_SATISFIED: 'APPARENTLY_SATISFIED',
  CLOSED: 'CLOSED',
  UNCLEAR: 'UNCLEAR'
};

const AUTHORITY_NAME_TERMS = [
  { type: AUTHORITY_TYPE.BUILDING_CONTROL, terms: ['building control'] },
  { type: AUTHORITY_TYPE.PLANNING_AUTHORITY, terms: ['planning authority', 'local planning authority'] },
  { type: AUTHORITY_TYPE.FIRE_AUTHORITY, terms: ['fire authority', 'fire and rescue service'] }
];

function resolveAuthorityType(text) {
  const lower = (text || '').toLowerCase();
  for (const entry of AUTHORITY_NAME_TERMS) { if (entry.terms.some(t => lower.indexOf(t) !== -1)) return entry.type; }
  return null;
}

// A genuine requirement — the authority explicitly requesting/requiring
// something. Deliberately does NOT treat every authority-related document as
// a requirement (see the brief's own instruction) — only this specific
// request/require wording creates one.
const AUTHORITY_REQUIREMENT_PATTERN = /\b(building control|planning authority|fire authority)\b[^.\n]{0,40}?\b(?:has\s+)?(?:requested|requires?|require)\s+(?:the\s+)?([a-z][a-z\- ]{2,60}?)(?=[.,\n])/gi;

// A response — evidence genuinely supplied addressing a request. "in
// response to ... request" is a deliberately explicit phrasing (never
// inferred merely from a document existing after a requirement's date).
const AUTHORITY_RESPONSE_PATTERN = /\bin response to (?:the\s+)?(building control|planning authority|fire authority)(?:'s)? request[^.\n]{0,80}?(?:provides?|encloses?|submits?)\s+(?:the\s+)?([a-z][a-z\- ]{2,60}?)(?=[.,\n])/gi;

// Acceptance — the authority itself (not the applicant/consultant/
// contractor) accepting/confirming satisfaction. "completion certificate
// issued"/"formally closed" wording (also recognised by Batch 1's own
// AUTHORITY_DECISION/CLOSURE_EVIDENCE keywords) escalates to CLOSED; a bare
// "accepts"/"confirms acceptance of" is APPARENTLY_SATISFIED only — a
// deliberately more cautious reading, never automatically CLOSED (per the
// governing brief: "depending on the strength/scope of wording").
const AUTHORITY_ACCEPTANCE_PATTERN = /\b(building control|planning authority|fire authority)\b[^.\n]{0,30}?\b(?:accepts?|confirms?\s+acceptance\s+of|is\s+satisfied\s+with)\s+(?:the\s+)?([a-z][a-z\- ]{2,60}?)(?:\s+submitted)?(?=[.,\n])/gi;
const CLOSURE_STRENGTH_PATTERN = /\b(completion certificate issued|formally closed|closure confirmed|verified closed)\b/i;

function requirementId(authorityType, subjectPhrase) {
  return 'req-' + slugify(authorityType + '|' + normalizeScopeText(subjectPhrase));
}

// Extracts authority requirements/responses/acceptances from ONE document's
// text against the project's ALREADY-BUILT requirement list (so a response/
// acceptance in a later-processed document can attach to a requirement
// raised by an earlier one — matched by authority_type + package overlap,
// reusing Batch 2A's classifyPackages() directly, never a second matching
// system). `e` is the source p.evidence entry (used to read
// documentIntegrityFlags for the acceptance safeguard above).
function extractAuthorityRequirementsFromText(text, e, requirementsById) {
  if (!text) return;
  const lineProv = buildLineProvenanceIndex(text);
  const hasIntegrityLimitation = Array.isArray(e.documentIntegrityFlags) && e.documentIntegrityFlags.length > 0;

  let m;
  const reqRe = new RegExp(AUTHORITY_REQUIREMENT_PATTERN.source, 'gi');
  while ((m = reqRe.exec(text)) !== null) {
    const authorityText = m[1], subjectPhrase = (m[2] || '').trim();
    const authorityType = resolveAuthorityType(authorityText);
    if (!authorityType || !subjectPhrase) { if (reqRe.lastIndex === m.index) reqRe.lastIndex++; continue; }
    const { packages, scope } = resolveRelationshipPackageScope(subjectPhrase, text, e.packages);
    const id = requirementId(authorityType, subjectPhrase);
    if (!requirementsById[id]) {
      requirementsById[id] = {
        requirement_id: id, project_id: e._projectId, authority_type: authorityType, authority_name: titleCasePartyType(authorityType),
        subject: subjectPhrase, package: packages, scope: scope, requirement_text: subjectPhrase,
        raised_date: null, source_evidence_ids: [], responsible_relationship_ids: [],
        status: AUTHORITY_REQUIREMENT_STATUS.OPEN, response_evidence_ids: [], apparent_acceptance_evidence_ids: [], closure_evidence_ids: [],
        created_at: Date.now(), satisfied_at: null, closed_at: null, notes: ''
      };
    }
    requirementsById[id].source_files = Array.from(new Set((requirementsById[id].source_files || []).concat([e.name])));
    if (reqRe.lastIndex === m.index) reqRe.lastIndex++;
  }

  // Responses — only attach to a requirement of the SAME authority type with
  // an overlapping package; never invented against an unrelated requirement.
  const respRe = new RegExp(AUTHORITY_RESPONSE_PATTERN.source, 'gi');
  while ((m = respRe.exec(text)) !== null) {
    const authorityType = resolveAuthorityType(m[1]);
    const subjectPhrase = (m[2] || '').trim();
    if (!authorityType || !subjectPhrase) { if (respRe.lastIndex === m.index) respRe.lastIndex++; continue; }
    const { packages } = resolveRelationshipPackageScope(subjectPhrase, text, e.packages);
    Object.values(requirementsById).forEach(req => {
      if (req.authority_type !== authorityType) return;
      if (!packages.some(pk => (req.package || []).includes(pk))) return;
      if (req.status === AUTHORITY_REQUIREMENT_STATUS.OPEN) req.status = AUTHORITY_REQUIREMENT_STATUS.RESPONSE_SUPPLIED;
      req.response_evidence_ids = Array.from(new Set(req.response_evidence_ids.concat([e.name])));
    });
    if (respRe.lastIndex === m.index) respRe.lastIndex++;
  }

  // Acceptance — gated on the SAME document having no integrity limitation
  // (Batch 1 safeguard reused directly): an incomplete/unsigned/placeholder-
  // ridden document's "accepts"/"approval" wording is never trusted here,
  // regardless of filename (the folder/filename trap, scenario H).
  if (!hasIntegrityLimitation) {
    const accRe = new RegExp(AUTHORITY_ACCEPTANCE_PATTERN.source, 'gi');
    while ((m = accRe.exec(text)) !== null) {
      const authorityType = resolveAuthorityType(m[1]);
      const subjectPhrase = (m[2] || '').trim();
      if (!authorityType || !subjectPhrase) { if (accRe.lastIndex === m.index) accRe.lastIndex++; continue; }
      const { packages } = resolveRelationshipPackageScope(subjectPhrase, text, e.packages);
      const strong = CLOSURE_STRENGTH_PATTERN.test(text);
      Object.values(requirementsById).forEach(req => {
        if (req.authority_type !== authorityType) return;
        if (!packages.some(pk => (req.package || []).includes(pk))) return;
        if (strong) {
          req.status = AUTHORITY_REQUIREMENT_STATUS.CLOSED;
          req.closed_at = Date.now();
          req.closure_evidence_ids = Array.from(new Set(req.closure_evidence_ids.concat([e.name])));
        } else if (req.status !== AUTHORITY_REQUIREMENT_STATUS.CLOSED) {
          req.status = AUTHORITY_REQUIREMENT_STATUS.APPARENTLY_SATISFIED;
          req.satisfied_at = Date.now();
        }
        req.apparent_acceptance_evidence_ids = Array.from(new Set(req.apparent_acceptance_evidence_ids.concat([e.name])));
      });
      if (accRe.lastIndex === m.index) accRe.lastIndex++;
    }
  }
}

// Cross-references each requirement to any Batch 2B relationship sharing an
// overlapping package — WITHOUT reassigning responsibility (per the
// governing brief's "responsibility-aware authority requirement" example):
// this only records which existing relationships are relevant context, it
// never creates, edits or reinterprets a relationship.
function linkRequirementsToRelationships(requirements, relationships) {
  requirements.forEach(req => {
    req.responsible_relationship_ids = (relationships || [])
      .filter(r => (r.package || []).some(pk => (req.package || []).includes(pk)))
      .map(r => r.relationship_id);
  });
}

function buildProjectAuthorityRequirements(p) {
  const requirementsById = {};
  (p.evidence || []).forEach(e => {
    if (!e.extractedText) return;
    e._projectId = p.id; // transient, read only by extractAuthorityRequirementsFromText above
    extractAuthorityRequirementsFromText(e.extractedText, e, requirementsById);
    delete e._projectId;
  });
  const requirements = Object.values(requirementsById);
  linkRequirementsToRelationships(requirements, p.relationships || []);
  p.authorityRequirements = requirements;
  return requirements;
}

// -----------------------------------------------------------------------
// PART 3 — Expected / missing evidence. A SMALL, curated, context-triggered
// rule table (mirrors Batch 1 FINDING_RULES / Batch 2B RELATIONSHIP_VERB_RULES'
// own "explicit rule table, not an uncontrolled checklist" style) — each rule
// fires only when its specific triggering context genuinely exists on THIS
// project, never a blanket "expect every construction document" checklist.
// -----------------------------------------------------------------------

const MISSING_EVIDENCE_STATUS = {
  MISSING: 'MISSING',
  PARTIAL: 'PARTIAL',
  PRESENT: 'PRESENT',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNCLEAR: 'UNCLEAR'
};

function anyDocHasFunction(evidence, fn) {
  return (evidence || []).some(e => (e.evidenceFunctions || []).some(f => f.function === fn));
}
function anyDocHasPackage(evidence, pkg) {
  return (evidence || []).some(e => (e.packages || []).some(p => p.package === pkg));
}
function anyTextMentions(evidence, re) {
  return (evidence || []).some(e => re.test(e.extractedText || ''));
}

const MISSING_EVIDENCE_RULES = [
  {
    key: 'structural_reactions',
    // Triggered by Batch 2B: a DESIGNED_BY relationship exists for the
    // FOUNDATIONS_CIVILS package (foundation design has actually happened),
    // which the governing brief's own "steel frame / foundations" pattern
    // says depends on supplier-provided final structural reactions — but no
    // relationship/fact anywhere mentions reactions being provided.
    applies: (p) => (p.relationships || []).some(r => r.relationship_type === 'DESIGNED_BY' && (r.package || []).includes(PACKAGE.FOUNDATIONS_CIVILS)),
    satisfiedBy: (p) => (p.relationships || []).some(r => r.relationship_type === 'INFORMATION_PROVIDED_BY' && /reaction/i.test(r.scope || '')),
    // Batch 5 (2026-08-26) closure-provenance strengthening: the SAME
    // relationship satisfiedBy() already found genuinely names its own
    // source document(s) (`source_files`, Batch 2B) — reused directly here,
    // never a new attribution guess.
    satisfyingEvidenceIds: (p) => Array.from(new Set((p.relationships || []).filter(r => r.relationship_type === 'INFORMATION_PROVIDED_BY' && /reaction/i.test(r.scope || '')).flatMap(r => r.source_files || []))),
    subject: 'structural_reactions', package: [PACKAGE.FOUNDATIONS_CIVILS], scope: 'foundation_package',
    expected_evidence_type: 'Final structural reactions from the building supplier',
    why_expected: 'A foundation design relationship exists (Batch 2B), which the governing reasoning pattern expects to rely on final structural reactions from the building supplier — no such evidence was found in the project record.'
  },
  {
    key: 'fire_commissioning',
    // Triggered by: a FIRE-package document present AND the project shows a
    // completion/handover context (Batch 1 HANDOVER_RECORD function) — not
    // merely "a fire layout exists" alone.
    applies: (p) => anyDocHasPackage(p.evidence, PACKAGE.FIRE) && anyDocHasFunction(p.evidence, 'HANDOVER_RECORD'),
    satisfiedBy: (p) => anyDocHasFunction(p.evidence, 'COMMISSIONING_EVIDENCE'),
    // Batch 5 closure-provenance strengthening: names the actual document(s)
    // Batch 1 already classified with the COMMISSIONING_EVIDENCE function —
    // reused directly, never a new attribution guess.
    satisfyingEvidenceIds: (p) => (p.evidence || []).filter(e => (e.evidenceFunctions || []).some(f => f.function === 'COMMISSIONING_EVIDENCE')).map(e => e.name),
    subject: 'fire_alarm_commissioning', package: [PACKAGE.FIRE], scope: 'fire_alarm',
    expected_evidence_type: 'Fire alarm/detection commissioning or verification evidence',
    why_expected: 'A fire-related document and a handover/completion-stage document both exist on this project, but no commissioning/verification evidence for the fire system was found — commissioning evidence would normally be expected at this stage.'
  },
  {
    key: 'building_control_completion',
    // Triggered by: a handover/completion-notice-style signal existing, but
    // no requirement on this project has reached CLOSED/APPARENTLY_SATISFIED
    // for Building Control (built by Part 2 above) — deliberately does NOT
    // infer completion merely from a completion NOTICE/handover/inspection
    // existing (the Job D site/Job D pattern: paperwork != completion).
    applies: (p) => anyDocHasFunction(p.evidence, 'HANDOVER_RECORD') || anyTextMentions(p.evidence, /completion notice/i),
    // Deliberately scoped to a requirement whose OWN text is genuinely about
    // completion — an unrelated Building Control requirement being accepted
    // (e.g. a fire-resistance query, scenario D-F) must NOT be read as
    // satisfying a general "is Building Control complete?" question. This is
    // the same "evidence by subject, not by loosely-matching category"
    // principle the brief applies to filenames, applied here to avoid a
    // false-satisfied result from a same-authority-but-different-subject
    // acceptance.
    satisfiedBy: (p) => (p.authorityRequirements || []).some(r => r.authority_type === AUTHORITY_TYPE.BUILDING_CONTROL && /completion/i.test(r.requirement_text || '') && (r.status === AUTHORITY_REQUIREMENT_STATUS.CLOSED || r.status === AUTHORITY_REQUIREMENT_STATUS.APPARENTLY_SATISFIED)),
    // Batch 5 closure-provenance strengthening: reuses the qualifying
    // requirement's OWN closure/acceptance evidence ids (Batch 3) — never a
    // new attribution guess.
    satisfyingEvidenceIds: (p) => {
      const req = (p.authorityRequirements || []).find(r => r.authority_type === AUTHORITY_TYPE.BUILDING_CONTROL && /completion/i.test(r.requirement_text || '') && (r.status === AUTHORITY_REQUIREMENT_STATUS.CLOSED || r.status === AUTHORITY_REQUIREMENT_STATUS.APPARENTLY_SATISFIED));
      if (!req) return [];
      return Array.from(new Set((req.closure_evidence_ids || []).concat(req.apparent_acceptance_evidence_ids || [])));
    },
    subject: 'building_control_completion', package: [PACKAGE.BUILDING_CONTROL], scope: null,
    expected_evidence_type: 'Building Control completion certificate or explicit completion acceptance',
    why_expected: 'A completion notice, handover record and/or inspection evidence exist on this project, but no Building Control completion certificate or explicit authority completion acceptance was found — their presence does not itself prove Building Control completion.'
  }
];

function buildProjectMissingEvidence(p) {
  const items = [];
  MISSING_EVIDENCE_RULES.forEach(rule => {
    if (!rule.applies(p)) return; // context not present on this project — rule does not fire at all
    const satisfied = rule.satisfiedBy(p);
    // Batch 5: only ever populated from a rule's own satisfyingEvidenceIds()
    // — which itself only ever reuses an ALREADY-existing, already-verified
    // Batch 1/2B/3 attribution (a relationship's source_files, a document's
    // own evidence_function, or a requirement's own closure/acceptance
    // ids) — never a fabricated link, and never populated at all when not
    // satisfied.
    const satisfyingIds = satisfied && typeof rule.satisfyingEvidenceIds === 'function' ? rule.satisfyingEvidenceIds(p) : [];
    items.push({
      missing_evidence_id: 'miss-' + slugify(rule.key + '-' + p.id),
      project_id: p.id,
      subject: rule.subject,
      package: rule.package,
      scope: rule.scope,
      expected_evidence_type: rule.expected_evidence_type,
      expectation_basis: rule.why_expected,
      triggering_evidence_ids: [],
      related_requirement_ids: (p.authorityRequirements || []).filter(r => (r.package || []).some(pk => rule.package.includes(pk))).map(r => r.requirement_id),
      related_relationship_ids: (p.relationships || []).filter(r => (r.package || []).some(pk => rule.package.includes(pk))).map(r => r.relationship_id),
      status: satisfied ? MISSING_EVIDENCE_STATUS.PRESENT : MISSING_EVIDENCE_STATUS.MISSING,
      confidence: 'medium',
      why_expected: rule.why_expected,
      created_at: Date.now(),
      satisfied_at: satisfied ? Date.now() : null,
      satisfying_evidence_ids: satisfyingIds,
      notes: ''
    });
  });
  p.missingEvidence = items;
  return items;
}

// =============================================================================
// Evidence Intelligence — Batch 5 (2026-08-26): STAGE 3 IMPACT REGISTER.
// A lightweight, INTERNAL governance/development structure recording how a
// future Stage 1/Stage 2 question change (once the still-outstanding manual
// question review happens) would ripple through the evidence/finding/action
// architecture — so Stage 3 doesn't need to be redesigned again when that
// review occurs. NOT customer-facing. NOT a second evidence/finding/action
// store — it only ever references existing subjects/packages/logic by name,
// never duplicates them. Deliberately EMPTY in this batch — no entry is
// created here; "do not populate it with invented future changes".
//
// Storage: `state.stage3ImpactRegister[]` — the EXISTING top-level app state
// object/`save()` mechanism (app.js), not a parallel store. It is GLOBAL
// (concerns Stage 1/2 questions, which are shared across every project),
// not per-project.
//
// HOW TO USE DURING THE MANUAL STAGE 1/2 QUESTION REVIEW (future work):
// for every question added/removed/reworded/reordered, call
// `addStage3ImpactRegisterEntry(state, {...})` (see the factory below for
// the full field list) recording what evidence subject/package/finding/
// action logic that specific question change could affect and what the
// Stage 3 consequence would be, with `review_status` left at
// `NOT_YET_REVIEWED` until a human has actually assessed it. This gives the
// next Stage 3 alignment pass a concrete, inspectable worklist instead of
// having to re-derive the impact from scratch.
// =============================================================================

const STAGE3_IMPACT_CHANGE_TYPE = {
  QUESTION_ADDED: 'QUESTION_ADDED',
  QUESTION_REMOVED: 'QUESTION_REMOVED',
  QUESTION_REWORDED: 'QUESTION_REWORDED',
  QUESTION_REORDERED: 'QUESTION_REORDERED',
  OTHER: 'OTHER'
};

const STAGE3_IMPACT_REVIEW_STATUS = {
  NOT_YET_REVIEWED: 'NOT_YET_REVIEWED',
  REVIEWED_NO_ACTION_NEEDED: 'REVIEWED_NO_ACTION_NEEDED',
  REVIEWED_ACTION_REQUIRED: 'REVIEWED_ACTION_REQUIRED',
  RESOLVED: 'RESOLVED'
};

function createStage3ImpactRegisterEntry(fields) {
  return Object.assign({
    entry_id: 'impact-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    stage: null,                    // 'Stage 1' | 'Stage 2'
    question_id: null,              // the stage1Questions/stage2Questions key affected
    change_type: null,              // one of STAGE3_IMPACT_CHANGE_TYPE
    affected_evidence_subject: null,// a FACT_RULES subject name, where relevant
    affected_package: [],           // PACKAGE code(s), where relevant
    affected_scope: null,
    affected_finding_logic: null,   // e.g. a FINDING_RULES key, plain-English note
    affected_action_logic: null,    // e.g. an ACTION_RULES key, plain-English note
    stage3_consequence: null,       // plain-English: what would need to change in Stage 3
    review_status: STAGE3_IMPACT_REVIEW_STATUS.NOT_YET_REVIEWED,
    created_at: Date.now(),
    notes: '',
    // Planning Batch 2 — Controlled Stage 3 Impact Register Correction
    // (2026-08-26): OPTIONAL, additive, backward-compatible dedupe key. Every
    // entry created before this correction (and every future entry that
    // doesn't pass one) simply has `dedupe_key: null` — no behaviour change
    // for them; addStage3ImpactRegisterEntry() below only applies the
    // duplicate-prevention check when a caller actually supplies one.
    dedupe_key: null
  }, fields);
}

// Provided for the future manual Stage 1/2 question review to call (see
// above), AND — as of the Planning Batch 2 Impact Register correction
// (2026-08-26) — also used to seed the four authorised Planning Batch 2
// impact entries (see seedPlanningBatch2ImpactRegisterEntries() below).
// Appends to state.stage3ImpactRegister (created on first use if the field
// is somehow missing), never overwrites history.
//
// Duplicate prevention (added by this correction): when `fields.dedupe_key`
// is provided and an entry with that SAME dedupe_key already exists in the
// register, this returns the EXISTING entry unchanged instead of pushing a
// second copy — the smallest safe addition to the existing mechanism, not a
// second deduplication system. A caller that omits `dedupe_key` (every
// pre-existing manual-review use of this function) behaves exactly as
// before: always appended, since a genuine one-off manual review entry has
// no natural repeat-call scenario to guard against.
function addStage3ImpactRegisterEntry(state, fields) {
  if (!state) return null;
  if (!Array.isArray(state.stage3ImpactRegister)) state.stage3ImpactRegister = [];
  if (fields && fields.dedupe_key) {
    const existing = state.stage3ImpactRegister.find(e => e.dedupe_key === fields.dedupe_key);
    if (existing) return existing;
  }
  const entry = createStage3ImpactRegisterEntry(fields);
  state.stage3ImpactRegister.push(entry);
  return entry;
}

// =============================================================================
// Planning Batch 2 — Controlled Stage 3 Impact Register Correction
// (2026-08-26). The Planning Batch 2 completion report identified four
// genuine future Stage 3 consequences but only documented them in the
// specification — state.stage3ImpactRegister[] itself remained empty. This
// records exactly those four, and ONLY those four, using the EXISTING
// register schema/helper above — no new register, no new schema, no new
// planning-impact system, no new evidence store. Each entry records a
// FUTURE consequence only; none of the described logic (progression
// gating, Stage 3 action generation, closure workflow, portal retrieval)
// is implemented anywhere by this correction.
// =============================================================================
const PLANNING_BATCH2_IMPACT_ENTRIES = [
  {
    dedupe_key: 'planning-batch2-status-to-progression-advice',
    stage: 'Stage 2',
    change_type: STAGE3_IMPACT_CHANGE_TYPE.OTHER,
    affected_package: [PACKAGE.PLANNING],
    affected_finding_logic: 'Planning Batch 1/2 planning lifecycle/outlook (p.planningLifecycle.status) established at Stage 2.',
    affected_action_logic: 'A future batch would need a planning-outlook-aware rule deciding which project activities may continue, continue carefully, or remain blocked — not implemented anywhere yet.',
    stage3_consequence: 'The planning lifecycle/outlook established during Stage 2 may affect later Stage 3 guidance about which project activities may continue, continue carefully, or remain blocked. Recorded as a future consequence only — no progression/gating logic exists yet.',
    notes: 'Planning Batch 2 completion report, impact 1 of 4. Source: EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 2 of 5".'
  },
  {
    dedupe_key: 'planning-batch2-drawing-mismatch-to-stage3',
    stage: 'Stage 2',
    change_type: STAGE3_IMPACT_CHANGE_TYPE.OTHER,
    affected_package: [PACKAGE.PLANNING],
    affected_finding_logic: 'Planning Batch 1 approved drawing baseline (p.planningDrawings) versus current project/design information.',
    affected_action_logic: 'A future batch would need a Stage 3 resolution action for a material mismatch against the applicable authority-approved baseline — no such action exists yet.',
    stage3_consequence: 'A material mismatch between current project/design information and the applicable authority-approved planning baseline may require a Stage 3 resolution action. Recorded as a future consequence only — no Stage 3 action is created by this correction.',
    notes: 'Planning Batch 2 completion report, impact 2 of 4. Source: EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 2 of 5".'
  },
  {
    dedupe_key: 'planning-batch2-condition-requirement-to-stage3-action',
    stage: 'Stage 2',
    change_type: STAGE3_IMPACT_CHANGE_TYPE.OTHER,
    affected_package: [PACKAGE.PLANNING],
    affected_finding_logic: 'Planning Batch 1 planning conditions/pre-start requirements/third-party requirements (p.planningRequirements).',
    affected_action_logic: 'A future batch would need action-generation and closure logic (defined evidence required to close) for an unresolved planning condition, pre-start requirement, separate authority requirement, or third-party requirement — not implemented anywhere yet.',
    stage3_consequence: 'An unresolved planning condition, pre-start planning requirement, relevant separate authority requirement, or relevant third-party requirement may need to become a Stage 3 action with defined evidence required to close it. Recorded as a future consequence only — no action-generation or closure logic exists yet.',
    notes: 'Planning Batch 2 completion report, impact 3 of 4. Source: EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 2 of 5".'
  },
  {
    dedupe_key: 'planning-batch2-portal-evidence-to-future-closure',
    stage: 'Stage 2',
    change_type: STAGE3_IMPACT_CHANGE_TYPE.OTHER,
    affected_package: [PACKAGE.PLANNING],
    affected_finding_logic: 'Planning Batch 2 portal-architecture placeholder (p.planningPortalReference — always inert/null in this batch).',
    affected_action_logic: 'Planning Batch 5 owns portal retrieval; a future batch would need to feed a genuine portal result into Stage 3 resolution/closure logic — no searching, scraping, downloading or council-specific integration is implemented yet.',
    stage3_consequence: 'Planning evidence acquired through a future public planning-portal retrieval capability may later support Stage 3 resolution/closure of planning actions, conditions or requirements. Recorded as a future consequence only — portal retrieval itself remains Planning Batch 5 territory and is not implemented here.',
    notes: 'Planning Batch 2 completion report, impact 4 of 4. Source: EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 2 of 5".'
  }
];

// Idempotent seeding entry point — safe to call on every app/state load
// (see app.js, right after `state=loadState()`). Relies entirely on the
// dedupe_key mechanism above: the first call ever appends all four; every
// subsequent call (state reload, project reload, Stage 2 revisit, ledger
// rebuild) finds all four already present and appends nothing. Returns
// whether any entry was actually newly added, so the caller can skip an
// unnecessary save() when nothing changed.
function seedPlanningBatch2ImpactRegisterEntries(state) {
  if (!state) return false;
  const before = Array.isArray(state.stage3ImpactRegister) ? state.stage3ImpactRegister.length : 0;
  PLANNING_BATCH2_IMPACT_ENTRIES.forEach(fields => addStage3ImpactRegisterEntry(state, fields));
  const after = state.stage3ImpactRegister.length;
  return after > before;
}

// Minimal, additive helper — finds an EXISTING register entry by its own
// dedupe_key and applies a small patch (review_status/notes only, by
// convention; never re-writes entry_id/created_at/the substantive
// stage3_consequence text). Reuses the SAME array/schema — not a second
// register, not a second update mechanism. Returns true only if something
// actually changed, so a caller can skip an unnecessary save().
function reviewStage3ImpactRegisterEntry(state, dedupeKey, patch) {
  if (!state || !Array.isArray(state.stage3ImpactRegister)) return false;
  const entry = state.stage3ImpactRegister.find(e => e.dedupe_key === dedupeKey);
  if (!entry) return false;
  let changed = false;
  Object.keys(patch || {}).forEach(k => { if (entry[k] !== patch[k]) { entry[k] = patch[k]; changed = true; } });
  return changed;
}

// Planning Batch 3 (2026-08-26): reviews (does NOT duplicate) the ONE
// existing Planning Batch 2 Impact Register entry this batch's own work
// actually addresses — "planning status → future progression advice"
// (governing brief §17: "Planning Batch 3 may update/review that existing
// Impact Register entry... Do not create a duplicate impact entry"). The
// other three Planning Batch 2 entries (drawing mismatch/condition-
// requirement/portal-evidence → Stage 3 action/closure) are NOT addressed
// by this batch (Stage 3 planning actions remain Planning Batch 4; portal
// retrieval remains Planning Batch 5) and are deliberately left untouched,
// still NOT_YET_REVIEWED. Idempotent: setting the same review_status/notes
// repeatedly is a no-op after the first call (reviewStage3ImpactRegisterEntry
// only reports `changed` on a genuine difference).
function reviewPlanningBatch3ImpactRegisterEntries(state) {
  if (!state) return false;
  return reviewStage3ImpactRegisterEntry(state, 'planning-batch2-status-to-progression-advice', {
    review_status: STAGE3_IMPACT_REVIEW_STATUS.RESOLVED,
    notes: 'Planning Batch 2 completion report, impact 1 of 4. Source: EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 2 of 5". REVIEWED AND ADDRESSED by Planning Batch 3 (2026-08-26): p.planningActivityProgression/p.planningIssueGates/p.planningMostRestrictiveGate now derive exactly this consequence (which project activities may continue/continue-carefully/wait) from the planning lifecycle status — see EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 3 of 5".'
  });
}

// =============================================================================
// Evidence Intelligence — Batch 5 (2026-08-26): STAGE 3 CUSTOMER PRESENTATION
// HELPERS. Pure, read-only functions that turn already-computed Batch 1-4
// data into customer-appropriate text — no new evidence/finding/action
// logic, no re-derivation of anything Batches 1-4 already decided. Consumed
// by app.js's stage3Actions() (and mirrored, internal/dev-only, in
// evidenceLedgerPage()) — never bypasses the existing
// evidence -> finding -> action chain.
// =============================================================================

const PACKAGE_CUSTOMER_LABEL = {
  BUILDING_FRAME: 'Building frame',
  ENVELOPE: 'Envelope (cladding / roofing)',
  FOUNDATIONS_CIVILS: 'Foundations / civils',
  DRAINAGE: 'Drainage',
  FIRE: 'Fire',
  M_AND_E: 'Mechanical & electrical',
  PLANNING: 'Planning',
  BUILDING_CONTROL: 'Building Control',
  ACCESS_SITE_LOGISTICS: 'Site access / logistics',
  DOORS_OPENINGS: 'Doors / openings',
  CLIENT_WORKS: 'Client-side works',
  SUPPLIER_WORKS: 'Supplier works',
  SPECIALIST_CONSULTANT_WORKS: 'Specialist consultant works',
  UNCLASSIFIED: 'General'
};

// A controlled-vocabulary scope value (e.g. 'foundation_package',
// 'roof_drainage' — see FACT_SCOPE_KEYWORDS) is de-slugged into readable
// words; a free-text scope string (e.g. "existing concrete breakout",
// already human-readable — see Batch 2B/3's own raw-phrase scopes) is
// returned capitalised, unchanged otherwise. Never invents a scope where
// none exists.
function humanizeScope(scope) {
  if (!scope) return null;
  const s = String(scope);
  const text = /^[a-z][a-z_]*$/.test(s) ? s.replace(/_/g, ' ') : s;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// One combined "affected package/scope" line, or null if there's genuinely
// nothing to show (never an empty section — see governing brief).
function customerPackageScopeText(packages, scope) {
  const labels = Array.from(new Set((packages || []).map(pk => PACKAGE_CUSTOMER_LABEL[pk] || pk)));
  const scopeText = humanizeScope(scope);
  if (!labels.length && !scopeText) return null;
  if (!labels.length) return scopeText;
  return labels.join(' / ') + (scopeText ? ` — ${scopeText}` : '');
}

// =============================================================================
// Orchestration — builds all three Batch 3 structures. Called from
// buildProjectEvidenceLedger() AFTER buildProjectResponsibilityModel() (so
// Part 3's structural-reactions rule can read p.relationships) and after
// Part 2 (so Part 3's Building-Control-completion rule can read
// p.authorityRequirements).
function buildProjectDiscrepancyModel(p) {
  buildProjectDiscrepancies(p);
  buildProjectAuthorityRequirements(p);
  buildProjectMissingEvidence(p);
}

// ---------------------------------------------------------------------------
// Real file text extraction (Batch 1B). Feeds the SAME extraction/cross-check
// pipeline above — no second evidence system, no duplicated status/
// corroboration/conflict logic. Security: PDF text comes only from pdf.js's
// passive getTextContent() API (no annotations/forms/embedded-JS execution is
// ever invoked); DOCX text comes only from DOMParser reading word/document.xml
// as inert XML (no macros/embedded objects are executed, no external
// reference — image, hyperlink, OLE object — is ever fetched or followed).
// Both paths are wrapped so a malformed/corrupted file produces
// EXTRACTION_FAILED, never a thrown error that reaches the customer journey.
// ---------------------------------------------------------------------------

// Requires window.pdfjsLib — vendored locally at assets/vendor/pdfjs/ (see
// index.html) rather than fetched from a live CDN, so there is no new
// external runtime dependency and no CSP change was needed. Runs against a
// real PDF's actual pages; never OCRs an image-only page (see the
// OCR_REQUIRED branch below) and never fabricates a page number — every
// "(page N)" marker is pdf.js's own real page index.
async function extractTextFromPdf(file) {
  if (typeof window === 'undefined' || !window.pdfjsLib) {
    return { text: null, status: EXTRACTION_STATUS.UNSUPPORTED, note: 'PDF.js is not available in this environment — PDF text could not be extracted.' };
  }
  let arrayBuffer;
  try { arrayBuffer = await file.arrayBuffer(); }
  catch (e) { return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'Could not read the file bytes: ' + (e && e.message || e) }; }
  let doc;
  try {
    doc = await window.pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
  } catch (e) {
    return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'PDF could not be parsed — file may be corrupted, password-protected, or not a genuine PDF: ' + (e && e.message || e) };
  }
  const numPages = doc.numPages;
  const pagesToProcess = Math.min(numPages, MAX_PDF_PAGES);
  const truncatedPages = numPages > pagesToProcess;
  let pagesWithText = 0, pagesWithoutText = 0, truncatedChars = false;
  let combined = '';
  for (let i = 1; i <= pagesToProcess; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(it => it.str).join(' ').trim();
      if (pageText.replace(/\s+/g, '').length > 0) pagesWithText++; else pagesWithoutText++;
      combined += `\n(page ${i})\n${pageText}\n`;
      if (combined.length > MAX_EXTRACTED_CHARS) { combined = combined.slice(0, MAX_EXTRACTED_CHARS); truncatedChars = true; break; }
    } catch (e) {
      pagesWithoutText++; // one bad page must not abort extraction of the rest of a real document
    }
  }
  if (pagesWithText === 0) {
    // Image-only/scanned — zero unsupported evidence records are produced
    // from this document (buildProjectEvidenceLedger() skips a null
    // extractedText entirely); the upload itself is retained by the caller.
    return { text: null, status: EXTRACTION_STATUS.OCR_REQUIRED, note: `No extractable text layer found across ${pagesToProcess} of ${numPages} page(s) — this looks like an image-only/scanned PDF. OCR was not attempted (explicitly out of scope for this batch).`, pageCount: numPages };
  }
  if (pagesWithoutText > 0 || truncatedPages || truncatedChars) {
    let note = `Text extracted from ${pagesWithText} of ${numPages} page(s).`;
    if (pagesWithoutText) note += ` ${pagesWithoutText} page(s) had no extractable text (possibly scanned/image content on those pages only).`;
    if (truncatedPages) note += ` Only the first ${MAX_PDF_PAGES} of ${numPages} pages were processed (processing limit) — this was recorded, not silently truncated.`;
    if (truncatedChars) note += ' Extracted text was truncated at the processing character limit — recorded, not silent.';
    return { text: combined, status: EXTRACTION_STATUS.PARTIAL, note, pageCount: numPages };
  }
  return { text: combined, status: EXTRACTION_STATUS.EXTRACTED, note: `Text extracted from all ${numPages} page(s), with real page-number provenance.`, pageCount: numPages };
}

// --- Minimal ZIP reader (central-directory based — reliable even for the
// "sizes unknown at local-header-write-time, real sizes only in the central
// directory" case some real-world DOCX writers use) + DEFLATE via the
// browser's native DecompressionStream. No new library. ---
async function inflateRawBytes(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(c => { out.set(c, offset); offset += c.length; });
  return out;
}

async function readZipEntryText(arrayBuffer, entryName) {
  const bytes = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  const EOCD_SIG = 0x06054b50, CD_SIG = 0x02014b50;
  // Bounded backward scan for the End Of Central Directory record — bounded
  // so a huge/malformed file can never cause an unbounded scan.
  const maxBack = Math.min(bytes.length, 65557);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= bytes.length - maxBack && i >= 0; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('No end-of-central-directory record found — not a valid ZIP/DOCX archive.');
  const cdOffset = dv.getUint32(eocdOffset + 16, true);
  const cdCount = dv.getUint16(eocdOffset + 10, true);
  const decoder = new TextDecoder('utf-8');
  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (pos + 46 > bytes.length || dv.getUint32(pos, true) !== CD_SIG) throw new Error('Malformed ZIP central-directory entry.');
    const compMethod = dv.getUint16(pos + 10, true);
    const compSize = dv.getUint32(pos + 20, true);
    const nameLen = dv.getUint16(pos + 28, true);
    const extraLen = dv.getUint16(pos + 30, true);
    const commentLen = dv.getUint16(pos + 32, true);
    const localHeaderOffset = dv.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    if (name === entryName) {
      // Local header's own name/extra-field lengths can differ from the
      // central directory's copy — read them from the local header itself.
      const lhNameLen = dv.getUint16(localHeaderOffset + 26, true);
      const lhExtraLen = dv.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
      const compressedBytes = bytes.subarray(dataStart, dataStart + compSize);
      if (compMethod === 0) return decoder.decode(compressedBytes);
      if (compMethod === 8) return decoder.decode(await inflateRawBytes(compressedBytes));
      throw new Error(`Unsupported ZIP compression method (${compMethod}) for ${entryName}.`);
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return null; // entry genuinely absent — not necessarily an error
}

// Reads WordprocessingML (word/document.xml) via the browser's native
// DOMParser (inert XML parsing only — never executes script/macro content).
// Headings (paragraphs styled Heading*/Title) are marked with
// HEADING_SENTINEL so buildLineProvenanceIndex() picks them up as real
// section provenance. Table paragraphs are ordinary <w:p> elements nested
// inside <w:tbl> — getElementsByTagName's descendant search already includes
// them, so table text is covered without a separate code path.
//
// CodeQL js/xss-through-dom assessment (2026-09-02, PC-CONTROL-004,
// Workstream B — see CHANGELOG.md for the full record): CodeQL flags this
// parseFromString call itself as the sink ("DOM text is reinterpreted as
// HTML"), tracing the taint back to a customer-uploaded .docx file. Assessed
// as a FALSE POSITIVE for this exact implementation, on two independent
// grounds CodeQL's generic sink pattern does not distinguish:
//   1. The mimetype argument is 'application/xml', not 'text/html'. XML-mode
//      DOMParser output never executes script/event-handler content — that
//      is only a risk in 'text/html' mode. `doc` itself is also never
//      returned from this function, never serialised back to a markup
//      string, and never attached to the live page document — it exists
//      only as a detached, in-memory tree walked via
//      getElementsByTagName()/.textContent to pull out plain paragraph text.
//   2. The plain-text string this function DOES return
//      (wordXmlToPlainText's `lines.join('\n')`) is stored as
//      evidence.extractedText and consumed by ~50 call sites across this
//      file (classifiers, regex fact/pattern extraction) — every one of
//      which was directly audited for this assessment. The one place any
//      of that derived content reaches HTML (evidenceLedgerPage(), app.js)
//      passes every single field through esc() first, exactly per this
//      repository's documented XSS control (.github/copilot-instructions.md)
//      — there is no path from an uploaded .docx to unescaped HTML.
// No safer restructuring is available that preserves the existing
// document-text-extraction behaviour (parsing the XML at all requires this
// call), so a local suppression is used rather than weakening this function.
// See the assessment above for the full justification.
function wordXmlToPlainText(xml) {
  // codeql[js/xss-through-dom] -- false positive, see the assessment comment above wordXmlToPlainText: application/xml mode never executes content; `doc` never leaves this function or reaches markup; the returned text is always esc()-escaped before any HTML insertion.
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('word/document.xml is not well-formed XML.');
  const paragraphs = doc.getElementsByTagName('w:p');
  const lines = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    let isHeading = false;
    const pStyles = p.getElementsByTagName('w:pStyle');
    if (pStyles.length) {
      const val = pStyles[0].getAttribute('w:val') || '';
      if (/^heading/i.test(val) || /^title$/i.test(val)) isHeading = true;
    }
    const runs = p.getElementsByTagName('w:t');
    let text = '';
    for (let j = 0; j < runs.length; j++) text += runs[j].textContent;
    text = text.trim();
    if (!text) continue;
    lines.push((isHeading ? HEADING_SENTINEL : '') + text);
  }
  return lines.join('\n');
}

async function extractTextFromDocx(file) {
  let arrayBuffer;
  try { arrayBuffer = await file.arrayBuffer(); }
  catch (e) { return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'Could not read the file bytes: ' + (e && e.message || e) }; }
  let xml;
  try { xml = await readZipEntryText(arrayBuffer, 'word/document.xml'); }
  catch (e) { return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'DOCX could not be parsed — file may be corrupted or not a genuine Word (.docx) package: ' + (e && e.message || e) }; }
  if (!xml) return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'This .docx file has no word/document.xml — not a valid Word document package.' };
  let text;
  try { text = wordXmlToPlainText(xml); }
  catch (e) { return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'Could not read the document body XML: ' + (e && e.message || e) }; }
  if (!text.replace(/\s+/g, '').length) return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'No readable paragraph/table text was found in this document (it may contain only images/objects).' };
  let truncated = false;
  if (text.length > MAX_EXTRACTED_CHARS) { text = text.slice(0, MAX_EXTRACTED_CHARS); truncated = true; }
  return { text, status: truncated ? EXTRACTION_STATUS.PARTIAL : EXTRACTION_STATUS.EXTRACTED, note: truncated ? `Extracted text was truncated at the ${(MAX_EXTRACTED_CHARS / 1024 / 1024).toFixed(1)} MB processing limit — recorded, not silent.` : 'Paragraph/table text extracted from the document body, with heading provenance where the source document used real heading styles.' };
}

// Single dispatcher app.js calls for every uploaded file — the ONLY place
// that decides which extractor handles a file, so there is exactly one
// extraction entry point regardless of format (no duplicated per-format
// reasoning path). Never throws: any unexpected failure is caught and turned
// into EXTRACTION_FAILED so a malformed upload cannot crash the customer
// journey — the file itself is still retained by the caller regardless of
// what this returns.
async function extractEvidenceText(file) {
  if (!file) return { text: null, status: EXTRACTION_STATUS.UNSUPPORTED, note: 'No file supplied.' };
  if (/\.dwg$/i.test(file.name || '')) return { text: null, status: EXTRACTION_STATUS.UNSUPPORTED, note: 'DWG drawing retained as an original CAD file. Online preview and automatic text extraction are not available; download to open in CAD software.' };
  if (file.size > MAX_FILE_BYTES) {
    return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB, over this prototype's ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB processing limit — not processed.` };
  }
  try {
    if (isTextReadableFile(file)) return { text: await file.text(), status: EXTRACTION_STATUS.EXTRACTED, note: 'Plain-text file read directly.' };
    if (isPdfFile(file)) return await extractTextFromPdf(file);
    if (isDocxFile(file)) return await extractTextFromDocx(file);
    return { text: null, status: EXTRACTION_STATUS.UNSUPPORTED, note: 'No text extractor exists in this prototype for this file type (only .txt/.md/.csv/.json, .pdf and .docx are supported).' };
  } catch (e) {
    return { text: null, status: EXTRACTION_STATUS.EXTRACTION_FAILED, note: 'Unexpected error while extracting text: ' + (e && e.message || e) };
  }
}

// ---------------------------------------------------------------------------
// Orchestration — builds/rebuilds the one project-level evidence ledger from
// every currently-readable document on the project. Idempotent: safe to call
// again after a new upload: rebuilds the whole ledger from scratch each time
// (Batch 1 has no manual edits to preserve yet — see MASTER-SPEC.md for the
// "later upload" architecture note on corroborate/conflict/supersede).
// ---------------------------------------------------------------------------

function buildProjectEvidenceLedger(p) {
  if (!p || !Array.isArray(p.evidence)) return [];
  let allRecords = [];
  p.evidence.forEach(e => {
    // Classify from whatever text is available even when extraction produced
    // none (OCR_REQUIRED/UNSUPPORTED/EXTRACTION_FAILED) — classifyDocumentType()
    // degrades honestly to 'other_project_evidence'/'low' on empty input
    // rather than guessing from the filename, but this still lets the
    // internal review table show a real (low-confidence) row instead of a
    // permanent blank for every non-text-readable upload.
    if (!e.documentType) {
      const cls = classifyDocumentType(e.extractedText || '', e.name);
      e.documentType = cls.type;
      e.documentTypeConfidence = cls.confidence;
      e.documentTypeNote = cls.note;
    }
    // Evidence Meaning/Provenance/Maturity enhancement (2026-08-26): computed
    // once per document, same idempotent pattern as documentType above —
    // classified even from empty text (degrades honestly to an empty
    // functions array / no integrity flags, never a fabricated guess), so
    // the internal ledger shows a real (possibly empty) result for every
    // document rather than a permanent blank.
    if (!e.evidenceFunctions) {
      const fnCls = classifyEvidenceFunction(e.extractedText || '', e.name);
      e.evidenceFunctions = fnCls.functions;
      e.evidenceFunctionNote = fnCls.note;
      const integrity = assessDocumentIntegrity(e.extractedText || '');
      e.documentIntegrityFlags = integrity.flags;
      e.documentIntegrityNote = integrity.note;
      e.evidenceMaturity = deriveEvidenceMaturity(e.evidenceFunctions, e.documentIntegrityFlags);
    }
    // Batch 2A (2026-08-26): package classification — same idempotent,
    // classify-even-from-empty-text pattern as documentType/evidenceFunctions
    // above, computed once per document.
    if (!e.packages) {
      const pkgCls = classifyPackages(e.extractedText || '', e.name, e.documentType);
      e.packages = pkgCls.packages;
      e.packagesNote = pkgCls.note;
    }
    // Planning Intelligence — Planning Batch 1 (2026-08-26): planning
    // document sub-classification — same idempotent, classify-even-from-
    // empty-text pattern as documentType/evidenceFunctions/packages above.
    // Only meaningfully populated when this document is actually planning-
    // relevant (documentType 'planning_document' or package PLANNING) — see
    // classifyPlanningDocumentType() below; degrades to an empty result
    // (never a guess) otherwise.
    if (!e.planningDocumentType) {
      const planCls = classifyPlanningDocumentType(e.extractedText || '', e.name, e.documentType, e.packages);
      e.planningDocumentType = planCls.type;
      e.planningDocumentTypeConfidence = planCls.confidence;
      e.planningDocumentTypeNote = planCls.note;
      e.planningDrawingStatus = classifyPlanningDrawingStatus(e.extractedText || '', planCls.type);
    }
    // Common Evidence Intelligence Layer — Batch 1 (2026-08-27): document
    // identity/provenance, same idempotent, classify-even-from-empty-text
    // pattern as documentType/evidenceFunctions/packages/planningDocumentType
    // above. Internal only — not read by app.js/Stage 1-3 in this batch.
    if (!e.documentIdentity) {
      e.documentIdentity = buildDocumentIdentity(e, p);
    }
    if (!e.extractedText) return; // nothing to extract facts from — zero fabricated evidence records, per instruction
    const meta = { project_id: p.id, source_file: e.name, source_document_type: e.documentType, source_document_type_confidence: e.documentTypeConfidence, evidence_function: e.evidenceFunctions, evidence_maturity: e.evidenceMaturity, packages: e.packages };
    allRecords = allRecords.concat(extractFactsFromText(e.extractedText, meta));
  });
  crossCheckEvidence(allRecords);
  p.evidenceRecords = allRecords;
  // Batch 2B (2026-08-26): responsibility/interface model — built AFTER the
  // loop above so every document's `packages` (Batch 2A) is already
  // populated for buildProjectResponsibilityModel() to read.
  buildProjectResponsibilityModel(p);
  // Batch 3 (2026-08-26): discrepancy / authority requirement / missing-
  // evidence model — built last, so it can read both p.evidenceRecords
  // (conflicts, above) and p.relationships (Batch 2B, just built).
  buildProjectDiscrepancyModel(p);
  // Planning Intelligence — Planning Batch 1 (2026-08-26): built last, so it
  // can read p.authorityRequirements (Batch 3, just built above) and every
  // document's planningDocumentType (just classified in the loop above).
  buildProjectPlanningIntelligence(p);
  return allRecords;
}

// =============================================================================
// Batch 2 — Stage 1 evidence assistance ONLY. Connects the existing ledger
// above to the EXISTING Stage 1 questions (app.js's stage1Questions). Does
// NOT touch Stage 2/3, reports, drawings, maps, pricing or supplier logic,
// and never silently writes a Stage 1 answer — every proposal requires an
// explicit customer Confirm/Correct (see app.js stage1()/saveStage1()/
// confirmStage1Evidence()/correctStage1Evidence()). All Stage 1 questions
// remain LOCKED-EXISTING: this is a read-and-propose layer sitting alongside
// them, not a rewrite of any of them.
// =============================================================================

const STAGE1_ASSIST_STATUS = {
  ANSWERED_BY_EVIDENCE: 'ANSWERED_BY_EVIDENCE',
  NEEDS_CUSTOMER_CONFIRMATION: 'NEEDS_CUSTOMER_CONFIRMATION',
  UNANSWERED: 'UNANSWERED',
  CONFLICTING_EVIDENCE: 'CONFLICTING_EVIDENCE'
};

// Explicit, inspectable EVIDENCE SUBJECT -> STAGE 1 QUESTION mapping — not
// raw keyword matching (subjects themselves already come from the governed
// FACT_RULES table above; this is a second, separate, deliberate layer
// deciding which of those subjects are trusted to answer which existing
// Stage 1 question, and how).
//
// Every Stage 1 question was individually evaluated against the subjects
// currently produced by FACT_RULES (see the task report for the full
// per-question reasoning). Only questions where a subject's value can
// honestly answer that exact question, in that exact answer format, are
// listed here — evaluated and deliberately EXCLUDED cases (e.g. 'base',
// which asks about the *visible current surface* — an enum: Concrete/
// Tarmac/Stone/Grass/Unknown — while the only related evidence subjects
// describe *sub-surface* trial-pit strata in freeform prose, an incompatible
// answer shape) are reported, not force-mapped.
//
// `pick` transforms one matched record's extracted_value into this specific
// question's proposed answer — needed because 'width' and 'length' both
// read the SAME 'building_footprint_dimensions' record (e.g. "51m x 21m")
// but need different halves of it; axis order is a genuine, disclosed
// assumption the customer's own Confirm/Correct step is what actually
// guards against, not silent certainty on this layer's part.
const STAGE1_EVIDENCE_MAP = [
  { question: 'use', subjects: ['project_use_description'], pick: r => String(r.extracted_value).trim() },
  { question: 'width', subjects: ['building_footprint_dimensions'], pick: r => { const m = String(r.extracted_value).match(/^(\d+(?:\.\d+)?)/); return m ? m[1] : null; } },
  { question: 'length', subjects: ['building_footprint_dimensions'], pick: r => { const m = String(r.extracted_value).match(/[x×]\s*(\d+(?:\.\d+)?)/i); return m ? m[1] : null; } },
  // Added for Planning Batch 2 (2026-08-26) — a planning application form/
  // site location plan commonly states the site address directly, and it
  // answers the EXISTING 'address' question ("Where is the proposed
  // building site?") in exactly the same free-text shape, so this is a
  // genuine, safe mapping (unlike, e.g., height/structure/base/access/
  // drainage/door-count — see the batch's task report § D for the full
  // per-field audit of why those were evaluated and deliberately excluded).
  { question: 'address', subjects: ['planning_site_address'], pick: r => String(r.extracted_value).trim() }
];

// Context-only subjects: real, relevant evidence that must NEVER be offered
// as a proposed/confirmable Stage 1 answer, because its evidence_status is
// below the CONFIRMED_BY_DOCUMENT bar (ASSUMED_IN_DOCUMENT/PROVISIONAL/
// DOCUMENT_INTERNAL_INCONSISTENCY) — shown to the customer as background
// information only; the actual Stage 1 answer still comes from the customer.
const STAGE1_CONTEXT_MAP = [
  { question: 'services', subjects: ['underground_services_assumption', 'existing_drainage_assumption'] }
];

// The minimum bar for a record to ever be OFFERED as a proposed Stage 1
// answer. Per the source-priority hierarchy: only CONFIRMED_BY_DOCUMENT
// clears the bar — ASSUMED_IN_DOCUMENT, PROVISIONAL, DOCUMENT_INTERNAL_
// INCONSISTENCY and CONFLICTING_EVIDENCE are all explicitly excluded, and a
// 'low'-confidence match (see assessMatchConfidence() above — the
// disclaimer-language case) is excluded regardless of status.
function isProposableEvidence(record) {
  if (!record) return false;
  if (record.evidence_status !== EVIDENCE_STATUS.CONFIRMED_BY_DOCUMENT) return false;
  if (record.confidence === 'low') return false;
  if (!record.extracted_value || !String(record.extracted_value).trim()) return false;
  return true;
}

// Generic value comparator (numeric-tolerant, falling back to normalised
// text) — reuses extractNumberToken() rather than a second parsing
// approach, used both to detect a customer/document conflict and (not here,
// but conceptually) to decide whether a re-typed answer matches what was
// proposed.
function valuesRoughlyMatch(a, b) {
  const na = extractNumberToken(a), nb = extractNumberToken(b);
  if (na !== null && nb !== null) return Math.abs(na - nb) < 0.01;
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
}

// Core Batch 2 assessment: for one Stage 1 question on one project, decide
// what (if anything) the evidence ledger can offer. Never mutates anything —
// pure read, safe to call on every render. Backward-compatible by
// construction: p.evidenceRecords/p.stage1EvidenceAssist may not exist on an
// older project at all — both default to [] / {} here rather than requiring
// any migration, and an absent mapping/record simply yields UNANSWERED with
// no context, i.e. exactly today's un-assisted Stage 1 behaviour.
function assessStage1QuestionEvidence(p, questionKey) {
  const facts = (p && p.facts) || {};
  const existingAnswer = facts[questionKey];
  const assistState = (p && p.stage1EvidenceAssist && p.stage1EvidenceAssist[questionKey]) || null;
  const records = (p && p.evidenceRecords) || [];
  const mapping = STAGE1_EVIDENCE_MAP.find(m => m.question === questionKey);
  const contextMapping = STAGE1_CONTEXT_MAP.find(m => m.question === questionKey);

  const relevantRecords = mapping ? records.filter(r => mapping.subjects.includes(r.subject)) : [];
  const contextRecords = contextMapping ? records.filter(r => contextMapping.subjects.includes(r.subject)) : [];

  const result = { status: null, mapping, contextRecords, existingAnswer: existingAnswer || null, assistState };

  // --- Customer has already answered this question (typed normally, or via
  // a prior Confirm) — the answer ALWAYS wins. Never overwritten, never
  // silently replaced. ---
  if (existingAnswer) {
    if (assistState && assistState.status === 'CONFIRMED') {
      result.status = STAGE1_ASSIST_STATUS.ANSWERED_BY_EVIDENCE;
      return result;
    }
    // New/later evidence disagreeing with an answer the customer already
    // gave — flagged for clarification, never auto-resolved, both retained.
    const conflicting = relevantRecords.find(r => isProposableEvidence(r) && mapping.pick(r) != null && !valuesRoughlyMatch(mapping.pick(r), existingAnswer));
    if (conflicting) {
      result.status = STAGE1_ASSIST_STATUS.CONFLICTING_EVIDENCE;
      result.conflictingRecord = conflicting;
      result.conflictProposedValue = mapping.pick(conflicting);
      return result;
    }
    return result; // ordinary answered question — nothing evidence-related to show
  }

  // --- No customer answer yet. ---
  if (mapping) {
    // A genuine cross-document conflict on this exact subject must never
    // pre-fill an answer — show it as needing clarification instead.
    const conflictRecords = relevantRecords.filter(r => r.evidence_status === EVIDENCE_STATUS.CONFLICTING_EVIDENCE);
    if (conflictRecords.length) {
      result.status = STAGE1_ASSIST_STATUS.CONFLICTING_EVIDENCE;
      result.conflictRecords = conflictRecords;
      return result;
    }
    const proposable = relevantRecords.filter(isProposableEvidence).filter(r => mapping.pick(r) != null);
    if (proposable.length) {
      // Corroborated evidence (confirmed independently by more than one
      // document) is preferred where more than one candidate exists.
      proposable.sort((a, b) => b.corroborates.length - a.corroborates.length);
      const best = proposable[0];
      result.status = STAGE1_ASSIST_STATUS.NEEDS_CUSTOMER_CONFIRMATION;
      result.proposedRecord = best;
      result.proposedValue = mapping.pick(best);
      return result;
    }
  }
  result.status = STAGE1_ASSIST_STATUS.UNANSWERED;
  return result;
}

// Called by app.js when the customer clicks "Confirm" on a proposed
// evidence-assist answer. Sets the Stage 1 answer exactly as a normal typed
// answer would be (same field, same shape — the evidence record itself is
// NOT collapsed into it), and separately records the assist/provenance
// trail. Does not itself persist (save()) or navigate — app.js's
// confirmStage1Evidence() does that, exactly like the existing saveStage1().
function applyStage1EvidenceConfirm(p, questionKey, record, proposedValue) {
  if (!p.facts) p.facts = {};
  if (!p.stage1EvidenceAssist) p.stage1EvidenceAssist = {};
  p.facts[questionKey] = proposedValue;
  p.stage1EvidenceAssist[questionKey] = {
    status: 'CONFIRMED',
    evidenceId: record.evidence_id,
    sourceFile: record.source_file,
    sourcePage: record.source_page_or_section,
    proposedValue: proposedValue,
    confirmedAt: Date.now()
  };
}

// Called by app.js's saveStage1() when the customer types/selects their own
// answer for a question that had a live NEEDS_CUSTOMER_CONFIRMATION proposal
// on screen — i.e. they used "Correct" rather than "Confirm". The original
// evidence record is untouched in p.evidenceRecords (never deleted); this
// only records that the customer's own answer diverged from what was
// proposed, for provenance/audit — it does not block or alter the save.
function recordStage1EvidenceCorrection(p, questionKey, record, proposedValue, customerValue) {
  if (!p.stage1EvidenceAssist) p.stage1EvidenceAssist = {};
  p.stage1EvidenceAssist[questionKey] = {
    status: 'CORRECTED',
    evidenceId: record.evidence_id,
    sourceFile: record.source_file,
    sourcePage: record.source_page_or_section,
    proposedValue: proposedValue,
    customerValue: customerValue,
    correctedAt: Date.now()
  };
}

// =============================================================================
// Batch 3 — Stage 2 evidence REASONING only. Turns the existing evidence
// ledger (Batch 1/1B) into structured, INTERNAL Stage 2 findings, with only a
// deliberately restrained customer-facing summary ever surfaced (see
// app.js's stage2Summary() — a new, clearly separate "Evidence-based
// observations" card, never touching the existing risks2/actions2 output).
// Findings REFERENCE existing evidence records by evidence_id — this is not
// a second evidence store. No Stage 2 question is created, reworded,
// reordered or deleted; no Stage 3 action is created (stage3_candidate is an
// inert flag only, read by nothing in this batch).
// =============================================================================

const STAGE2_FINDING_STATUS = {
  CONFIRMED_DOCUMENTARY_FINDING: 'CONFIRMED_DOCUMENTARY_FINDING',
  POSSIBLE_ISSUE: 'POSSIBLE_ISSUE',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  INFORMATION_REQUIRED: 'INFORMATION_REQUIRED',
  ASSUMPTION_REQUIRES_CONFIRMATION: 'ASSUMPTION_REQUIRES_CONFIRMATION',
  PROVISIONAL_SCOPE: 'PROVISIONAL_SCOPE',
  EXCLUSION_RISK: 'EXCLUSION_RISK',
  CONFLICT_REQUIRES_CLARIFICATION: 'CONFLICT_REQUIRES_CLARIFICATION',
  DOCUMENT_INCONSISTENCY: 'DOCUMENT_INCONSISTENCY',
  NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE: 'NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE'
};

// A record whose extracted_value plainly negates a problem (real Job L
// example: "did not identify concentrations exceeding...", "no asbestos was
// identified", "not within a designated flood zone") is a reassuring
// confirmed fact, not a risk — used only for the 3 categories below where a
// document can genuinely report either outcome (contamination/asbestos/
// groundwater-flood testing). Generic wording, not tied to one document.
const NEGATION_PATTERN = /\b(did not identify|no asbestos|not identified|not encountered|not within|absence of|clear of|did not exceed)\b/i;

// Explicit, inspectable EVIDENCE SUBJECT(S) -> STAGE 2 FINDING rule table —
// one rule per finding "key" (a stable identity used to preserve a finding's
// created_at/resolved_at history across ledger rebuilds — see
// buildStage2Findings() below), covering every subject FACT_RULES currently
// produces except 'project_use_description' (already handled by Stage 1
// evidence-assist, Batch 2 — not duplicated into a Stage 2 finding too).
// `category` is one of the initial categories in the governing brief;
// `provisionalOverride`/`assumptionOverride`/`exclusionOverride`/
// `checkNegation` tell deriveFindingStatus() below how to read this
// particular subject's ASSUMED_IN_DOCUMENT/PROVISIONAL status correctly
// (e.g. the SAME underlying status can mean "assumption" or "exclusion"
// depending on what the subject actually is — that distinction lives here,
// not in the shared extraction engine).
const FINDING_RULES = [
  { key: 'ground_conditions', category: 'ground_conditions', subjects: ['ground_conditions_made_ground', 'ground_conditions_natural_stratum', 'moisture_ingress'],
    customerSummary: 'Ground conditions require review when finalising the foundation/base design.',
    whyItMatters: 'Ground conditions materially affect foundation and base design and cannot safely be assumed without review against the proposed design.',
    infoRequired: ['Confirmation that the reported ground conditions have been reviewed against the proposed foundation/base design.'] },
  { key: 'ground_conditions_depth_inconsistency', category: 'document_inconsistency', subjects: ['made_ground_depth'],
    customerSummary: 'Inconsistent ground-condition information has been identified within the uploaded documentation and should be clarified.',
    inconsistencySummary: 'Inconsistent ground-condition information has been identified within the uploaded documentation and should be clarified.',
    whyItMatters: 'The same document states two different figures for the same ground condition — relying on either without clarification risks an incorrect foundation assumption.',
    infoRequired: ['Clarification of which figure is correct, from the original author of the document or a follow-up instruction.'] },
  { key: 'foundation_bearing_pressure', category: 'foundation_base_design', subjects: ['allowable_bearing_pressure'],
    customerSummary: 'Foundation/bearing-pressure information should be confirmed before final foundation design.',
    conflictSummary: 'Conflicting bearing-pressure information has been identified and should be clarified before final foundation design.',
    whyItMatters: 'Foundation design depends on a single, verified allowable bearing pressure — differing figures from different sources must be reconciled, not assumed.',
    infoRequired: ['A single, confirmed allowable bearing pressure figure agreed between all relevant sources.'] },
  { key: 'slab', category: 'slab', subjects: ['slab_thickness', 'slab_reinforcement'],
    customerSummary: 'Slab specification (thickness/reinforcement) should be confirmed before final design.',
    whyItMatters: 'Slab thickness and reinforcement affect structural adequacy and cost, and should be confirmed against the final design rather than assumed from preliminary information.',
    infoRequired: ['Confirmation of the final slab specification against structural design requirements.'] },
  { key: 'contamination', category: 'contamination', subjects: ['contamination_testing'], checkNegation: true,
    customerSummary: 'Contamination testing information should be reviewed as part of the ground/foundation assessment.',
    noIssueSummary: 'No contamination issues have been identified from the testing information reviewed so far.',
    whyItMatters: 'Contaminated ground can affect foundation design, disposal costs and programme if not identified and addressed early.',
    infoRequired: ['Confirmation that contamination testing coverage is adequate for the full building footprint.'] },
  { key: 'asbestos', category: 'asbestos', subjects: ['asbestos_testing'], checkNegation: true,
    customerSummary: 'Asbestos testing information should be reviewed before any relevant existing structure/surface work.',
    noIssueSummary: 'No asbestos has been identified from the testing information reviewed so far.',
    whyItMatters: 'Asbestos affects safe working methods, cost and programme if present and not identified in advance.',
    infoRequired: ['Confirmation that asbestos testing coverage is adequate for all areas affected by the works.'] },
  { key: 'groundwater_flooding', category: 'groundwater_flooding', subjects: ['groundwater_flood_environmental'], checkNegation: true,
    customerSummary: 'Groundwater/flood-risk information should be reviewed as part of the ground/drainage assessment.',
    noIssueSummary: 'No groundwater or flood-risk issues have been identified from the environmental information reviewed so far.',
    whyItMatters: 'Groundwater and flood risk can affect foundation design, drainage strategy and insurability if not identified early.',
    infoRequired: ['Confirmation that groundwater/flood-risk information is current and covers the proposed site.'] },
  { key: 'gas_protection', category: 'gas_protection', subjects: ['gas_protection', 'gas_membrane_dpm'],
    customerSummary: 'Gas-protection requirements should be confirmed as part of the base/floor design.',
    whyItMatters: 'Ground-gas protection measures must be coordinated with the base/floor design and are a Building Regulations matter, not an optional extra.',
    infoRequired: ['Confirmation that the specified gas-protection measures match the actual ground-gas risk assessment for this site.'] },
  { key: 'drainage_provisional', category: 'drainage', subjects: ['drainage_provisional_sum'], provisionalOverride: true,
    customerSummary: 'Surface-water drainage scope remains provisional and requires further definition.',
    whyItMatters: 'A provisional sum is not a final design or a fixed price — the actual drainage scope and cost may change once drainage design is completed.',
    infoRequired: ['A finalised drainage design and a non-provisional cost once available.'] },
  { key: 'service_ducts_provisional', category: 'underground_services', subjects: ['service_duct_provisional_sum'], provisionalOverride: true,
    customerSummary: 'Service-duct requirements remain provisional.',
    whyItMatters: 'A provisional sum is not a final design or a fixed price — actual utility routing may change the scope and cost once confirmed.',
    infoRequired: ['Confirmed utility routes and a non-provisional cost once available.'] },
  { key: 'underground_services_assumption', category: 'underground_services', subjects: ['underground_services_assumption'], assumptionOverride: true,
    customerSummary: 'Underground services have not been verified.',
    whyItMatters: 'An assumption that a site is clear of underground services is not the same as a survey confirming it — unexpected services can cause cost and programme impact if encountered during construction.',
    infoRequired: ['An underground-services survey (or existing service records) confirming or correcting this assumption.'] },
  { key: 'existing_drainage_assumption', category: 'drainage', subjects: ['existing_drainage_assumption'], assumptionOverride: true,
    customerSummary: 'Existing drainage connection/capacity has not been verified.',
    whyItMatters: 'An assumption that existing drainage can be retained and connected into is not the same as a survey/design confirming it.',
    infoRequired: ['Confirmation that existing drainage can genuinely accommodate the proposed connection.'] },
  { key: 'concrete_breakout_exclusion', category: 'exclusions', subjects: ['existing_concrete_breakout_exclusion'], exclusionOverride: true,
    customerSummary: 'Existing concrete breakout may be outside the current quoted scope.',
    whyItMatters: 'Work excluded from a quotation is not free — if breaking out existing concrete/hardstanding proves necessary, it is very likely to be an additional cost not currently priced in.',
    infoRequired: ['Confirmation of whether existing concrete/hardstanding breakout is actually required, and, if so, a priced variation.'] },
  { key: 'contaminated_ground_exclusion', category: 'exclusions', subjects: ['contaminated_ground_disposal_exclusion'], exclusionOverride: true,
    customerSummary: 'Contaminated-ground disposal may be outside the current quoted scope.',
    whyItMatters: 'Work excluded from a quotation is not free — if contaminated ground is encountered, its disposal is very likely to be an additional cost not currently priced in.',
    infoRequired: ['Confirmation of the likelihood of contaminated ground and, if relevant, a priced variation/allowance.'] },
  { key: 'quotation_basis', category: 'quotations', subjects: ['quotation_basis'],
    customerSummary: 'This quotation is a budget estimate, not a fixed final price.',
    whyItMatters: 'A budget estimate is explicitly subject to change once surveys and detailed design are complete — it should not be treated as a firm, final figure.',
    infoRequired: ['A firm quotation once the relevant surveys and detailed design are available.'] },
  { key: 'structural_information', category: 'structural_information', subjects: ['building_footprint_dimensions', 'foundation_pad_count', 'concrete_core_count', 'concrete_core_depth_range', 'concrete_compressive_strength_range'],
    customerSummary: 'Structural/dimensional information from your documents should be confirmed against the final design.',
    whyItMatters: 'Preliminary structural/dimensional information from a quotation or investigation is not the same as a confirmed final design.',
    infoRequired: ['Confirmation of final structural/dimensional information against the design actually being taken forward.'] },
  { key: 'groundworks_scope', category: 'foundation_base_design', subjects: ['excavation_removal_works', 'imported_fill'],
    customerSummary: 'Groundworks scope (excavation/imported fill) should be confirmed against actual site conditions.',
    whyItMatters: 'Excavation and imported-fill quantities priced from preliminary information can change materially once actual ground conditions are confirmed on site.',
    infoRequired: ['Confirmation of groundworks scope/quantities against confirmed ground conditions.'] },
  { key: 'project_description_inconsistency', category: 'document_inconsistency', subjects: ['project_description_inconsistency'],
    customerSummary: 'Inconsistent project description has been identified within the uploaded documentation.',
    inconsistencySummary: 'Inconsistent project description has been identified within the uploaded documentation.',
    whyItMatters: 'A document that describes the project inconsistently (e.g. mixing industrial and residential wording) may be based on an incorrect template or an out-of-date scope, and should be checked rather than relied on as-is.',
    infoRequired: ['Confirmation from the document author of which project description is correct.'] }
];

function severityFor(status) {
  if ([STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION, STAGE2_FINDING_STATUS.EXCLUSION_RISK, STAGE2_FINDING_STATUS.DOCUMENT_INCONSISTENCY].includes(status)) return 'high';
  if ([STAGE2_FINDING_STATUS.CONFIRMED_DOCUMENTARY_FINDING, STAGE2_FINDING_STATUS.NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE, STAGE2_FINDING_STATUS.INFORMATION_REQUIRED].includes(status)) return 'low';
  return 'medium';
}

// A finding is a "candidate" for a future Stage 3 action whenever it isn't
// already either a clean confirmed fact or a non-issue — this flag is
// inert in this batch (read by nothing yet); no live Stage 3 action is
// created from it here.
function stage3CandidateFor(status) {
  return status !== STAGE2_FINDING_STATUS.CONFIRMED_DOCUMENTARY_FINDING && status !== STAGE2_FINDING_STATUS.NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE;
}

function customerSummaryFor(rule, status) {
  if (status === STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION) return rule.conflictSummary || `Conflicting ${rule.category.replace(/_/g, ' ')} information has been identified and should be clarified before proceeding.`;
  if (status === STAGE2_FINDING_STATUS.DOCUMENT_INCONSISTENCY) return rule.inconsistencySummary || 'Inconsistent information has been identified within the uploaded documentation and should be reviewed.';
  if (status === STAGE2_FINDING_STATUS.NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE) return rule.noIssueSummary || 'No issue has been identified from the evidence reviewed so far for this matter.';
  return rule.customerSummary;
}

// Deliberately restrained per governance — never a final engineering
// solution, supplier instruction, commercial remedy, Stage 3 action plan, or
// a pass/fail compliance conclusion. Reads the SAME evidence_status
// vocabulary Batch 1/1B already produce; this function is what correctly
// interprets a subject's true nature (assumption vs. exclusion, both stored
// as ASSUMED_IN_DOCUMENT by the shared extractor) — never upgrades an
// assumption/provisional/exclusion/conflict into a confirmed conclusion.
function deriveFindingStatus(rule, records) {
  if (records.some(r => r.evidence_status === EVIDENCE_STATUS.CONFLICTING_EVIDENCE)) return STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION;
  if (records.some(r => r.evidence_status === EVIDENCE_STATUS.DOCUMENT_INTERNAL_INCONSISTENCY)) return STAGE2_FINDING_STATUS.DOCUMENT_INCONSISTENCY;
  if (rule.provisionalOverride && records.some(r => r.evidence_status === EVIDENCE_STATUS.PROVISIONAL)) return STAGE2_FINDING_STATUS.PROVISIONAL_SCOPE;
  if (rule.exclusionOverride && records.some(r => r.evidence_status === EVIDENCE_STATUS.ASSUMED_IN_DOCUMENT)) return STAGE2_FINDING_STATUS.EXCLUSION_RISK;
  if (rule.assumptionOverride && records.some(r => r.evidence_status === EVIDENCE_STATUS.ASSUMED_IN_DOCUMENT)) return STAGE2_FINDING_STATUS.ASSUMPTION_REQUIRES_CONFIRMATION;
  const confirmed = records.filter(r => r.evidence_status === EVIDENCE_STATUS.CONFIRMED_BY_DOCUMENT);
  if (confirmed.length) {
    if (rule.checkNegation && confirmed.every(r => NEGATION_PATTERN.test(r.extracted_value))) return STAGE2_FINDING_STATUS.NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE;
    return confirmed.some(r => r.corroborates.length > 0) ? STAGE2_FINDING_STATUS.CONFIRMED_DOCUMENTARY_FINDING : STAGE2_FINDING_STATUS.NEEDS_REVIEW;
  }
  // Fallback if a status/override combination wasn't anticipated above —
  // never silently treated as confirmed.
  if (records.some(r => r.evidence_status === EVIDENCE_STATUS.ASSUMED_IN_DOCUMENT)) return STAGE2_FINDING_STATUS.ASSUMPTION_REQUIRES_CONFIRMATION;
  if (records.some(r => r.evidence_status === EVIDENCE_STATUS.PROVISIONAL)) return STAGE2_FINDING_STATUS.PROVISIONAL_SCOPE;
  return STAGE2_FINDING_STATUS.INFORMATION_REQUIRED;
}

// =============================================================================
// Evidence Intelligence — Batch 4 (2026-08-26): FINDINGS, ACTIONS & CLOSURE.
// Extends (does not replace) the EXISTING Stage 2 finding model
// (STAGE2_FINDING_STATUS/FINDING_RULES/buildStage2Findings() above) and the
// EXISTING Stage 3 action model (STAGE3_ACTION_STATUS/ACTION_RULES/
// buildStage3Actions() below) with: (1) cross-references to Batch 2B
// responsibility/interface data and Batch 3 discrepancy/authority-
// requirement/missing-evidence records on every finding/action; (2) new
// findings/actions generated DIRECTLY from unresolved Batch 3 records that
// have no existing FINDING_RULES/ACTION_RULES coverage; (3) real closure-
// assessment logic — the "future, separately-governed batch" the
// CLOSURE_EVIDENCE correction and the two Batch 3 "landmine" comments on
// buildStage2Findings()/buildStage3Actions() (above/below) explicitly
// deferred this to.
//
// NAMING NOTE: a fifth use of "Batch 4" in this codebase — distinct from the
// original track's own Stage 3 action-generation batch (STAGE3_ACTION_STATUS/
// ACTION_RULES/buildStage3Actions()), which this enhances, not duplicates.
// =============================================================================

// Read-only cross-reference lookup shared by findings and actions — never
// edits a Batch 2B/3 record, only reads it. Matched by PACKAGE OVERLAP,
// reusing Batch 2A's own package vocabulary directly (no new matching
// system).
function relatedIntelligence(p, packages) {
  const pkgs = packages || [];
  const overlaps = arr => (arr || []).some(pk => pkgs.includes(pk));
  return {
    discrepancies: (p.discrepancies || []).filter(d => overlaps(d.package)),
    authorityRequirements: (p.authorityRequirements || []).filter(r => overlaps(r.package)),
    missingEvidence: (p.missingEvidence || []).filter(m => overlaps(m.package)),
    relationships: (p.relationships || []).filter(r => overlaps(r.package))
  };
}

// Cautious, non-committal wording only — per the governing brief's critical
// rule that ASSISTED_BY/INFORMATION_PROVIDED_BY must never read as
// RESPONSIBLE_FOR, and that an unclear/absent responsibility signal must
// never be dressed up as a confirmed one.
function describeApparentResponsibility(relationships) {
  if (!relationships.length) return null;
  const unclear = relationships.find(r => r.relationship_type === 'RESPONSIBILITY_UNCLEAR');
  if (unclear) return 'Responsibility requires confirmation — conflicting responsibility evidence exists for this matter.';
  const ownership = relationships.find(r => ['RESPONSIBLE_FOR', 'CLIENT_RESPONSIBILITY', 'SUPPLIED_BY', 'DESIGNED_BY', 'INSTALLED_BY'].includes(r.relationship_type));
  if (ownership) return `Likely responsible party: ${titleCasePartyType((ownership.party_to || '').split('-')[1] || '')}${ownership.explicit_or_inferred === 'INFERRED' ? ' (inferred, not an explicit statement)' : ''}.`;
  const assistOnly = relationships.find(r => ['ASSISTED_BY', 'INFORMATION_PROVIDED_BY'].includes(r.relationship_type));
  if (assistOnly) return `Appears to require input from: ${titleCasePartyType((assistOnly.party_to || '').split('-')[1] || '')} (assistance/information only — not a confirmed responsibility statement).`;
  return null;
}

function describeInterface(relationships) {
  const withInterface = relationships.filter(r => (r.interface_with || []).length);
  if (!withInterface.length) return null;
  const parties = new Set();
  withInterface.forEach(r => { parties.add(r.party_to); r.interface_with.forEach(x => parties.add(x)); });
  const names = Array.from(parties).map(id => titleCasePartyType((id || '').split('-')[1] || ''));
  return `Interface between ${names.join(' and ')} — each retains its own distinct role; this is not resolved by assigning sole responsibility to one party.`;
}

// Batch-4-populated ONLY for a finding built directly from Batch 3 records
// (see buildStage2Findings() below); an old FINDING_RULES-derived finding's
// completeness is inferred from its own existing finding_status instead —
// no new signal invented for those.
function completenessForStatus(status) {
  if (status === STAGE2_FINDING_STATUS.CONFIRMED_DOCUMENTARY_FINDING || status === STAGE2_FINDING_STATUS.NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE) return 'complete';
  if (status === STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION || status === STAGE2_FINDING_STATUS.DOCUMENT_INCONSISTENCY) return 'unknown';
  return 'partial';
}

function unresolvedReasonForStatus(status) {
  const map = {
    CONFLICT_REQUIRES_CLARIFICATION: 'Conflicting evidence requires clarification before this can be relied upon.',
    DOCUMENT_INCONSISTENCY: 'The source document is internally inconsistent and has not been reconciled.',
    INFORMATION_REQUIRED: 'Expected evidence has not yet been found in the project record.',
    ASSUMPTION_REQUIRES_CONFIRMATION: 'Relies on an assumption that has not been independently verified.',
    PROVISIONAL_SCOPE: 'Scope/cost remains provisional, not yet finalised.',
    EXCLUSION_RISK: 'Currently excluded from scope — not yet confirmed who, if anyone, must address it.',
    NEEDS_REVIEW: 'Confirmed by only one source so far — not yet corroborated.'
  };
  return map[status] || null;
}

// Attaches Batch 2B/3 cross-references + completeness/unresolved-reason to
// ANY finding (old FINDING_RULES-derived or new Batch-3-derived) — purely
// additive, never alters finding_status/customer_facing_summary/severity/
// stage3_candidate, which remain exactly as the existing logic already
// decided. `discrepancy_ids`/`authority_requirement_ids`/`missing_evidence_ids`
// are pre-set by the caller for a Batch-3-sourced finding (its own direct
// origin); for an old finding they start empty and are filled in here purely
// from package overlap.
function enrichFindingWithIntelligence(finding, p) {
  const related = relatedIntelligence(p, finding.package || []);
  if (!finding.discrepancy_ids) finding.discrepancy_ids = related.discrepancies.map(d => d.discrepancy_id);
  if (!finding.authority_requirement_ids) finding.authority_requirement_ids = related.authorityRequirements.map(r => r.requirement_id);
  if (!finding.missing_evidence_ids) finding.missing_evidence_ids = related.missingEvidence.map(m => m.missing_evidence_id);
  finding.responsibility_relationship_ids = related.relationships.map(r => r.relationship_id);
  finding.apparent_responsibility = describeApparentResponsibility(related.relationships);
  finding.interface_summary = describeInterface(related.relationships);
  if (!finding.evidence_completeness) finding.evidence_completeness = completenessForStatus(finding.finding_status);
  if (finding.unresolved_reason === undefined) finding.unresolved_reason = unresolvedReasonForStatus(finding.finding_status);
  return finding;
}

// -----------------------------------------------------------------------
// New findings generated DIRECTLY from unresolved Batch 3 records that have
// no existing FINDING_RULES coverage. A discrepancy on a subject an
// EXISTING FINDING_RULES-derived finding already covers (e.g.
// 'allowable_bearing_pressure', already 'f-foundation_bearing_pressure') is
// NEVER duplicated — its discrepancy_id is attached to that existing finding
// instead (see the dedup check in buildStage2Findings() below). REFINEMENT
// discrepancies never create a finding at all — a harmless refinement is not
// an issue requiring a customer-facing observation (governing brief scenario
// C, extended from "no pointless Stage 3 action" to "no pointless finding
// either").
// -----------------------------------------------------------------------

function buildBatch3DerivedFindings(p, existingFindingsById) {
  const covered = new Set();
  Object.values(existingFindingsById).forEach(f => (f.subject || '').split(', ').forEach(s => covered.add(s)));
  const newFindings = {};

  (p.discrepancies || []).forEach(d => {
    if (d.discrepancy_type === DISCREPANCY_TYPE.REFINEMENT) return; // never a finding — harmless
    if (covered.has(d.subject)) {
      // Attach to the existing finding rather than duplicating.
      const existing = Object.values(existingFindingsById).find(f => (f.subject || '').split(', ').includes(d.subject));
      if (existing) { existing.discrepancy_ids = Array.from(new Set((existing.discrepancy_ids || []).concat([d.discrepancy_id]))); }
      return;
    }
    const id = 'f-disc-' + d.discrepancy_id;
    const prior = (p.stage2Findings || {})[id];
    newFindings[id] = {
      finding_id: id, project_id: p.id, category: 'discrepancy', subject: d.subject,
      finding_status: STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION,
      severity_or_priority: d.discrepancy_type === DISCREPANCY_TYPE.MATERIAL_CONFLICT ? 'high' : 'medium',
      customer_facing_summary: 'Conflicting information requires clarification before this can be relied upon.',
      internal_detail: d.comparison_basis,
      supporting_evidence_ids: d.evidence_ids.slice(), conflicting_evidence_ids: d.evidence_ids.slice(),
      source_files: d.source_files.slice(), source_pages_or_sections: d.source_pages_or_sections.slice(),
      confidence: d.confidence, why_it_matters: d.consequence_if_unresolved,
      information_still_required: ['Clarification of which value is correct, from the responsible party.'],
      stage3_candidate: true,
      created_at: prior ? prior.created_at : Date.now(), resolved_at: prior ? prior.resolved_at : null, resolution_evidence_ids: prior ? prior.resolution_evidence_ids : [],
      package: d.package.slice(), scope: d.scope, discrepancy_ids: [d.discrepancy_id], authority_requirement_ids: [], missing_evidence_ids: []
    };
  });

  (p.authorityRequirements || []).forEach(r => {
    if (r.status === AUTHORITY_REQUIREMENT_STATUS.CLOSED) return; // resolved — nothing outstanding to show
    const id = 'f-req-' + r.requirement_id;
    const prior = (p.stage2Findings || {})[id];
    newFindings[id] = {
      finding_id: id, project_id: p.id, category: 'authority_requirement', subject: r.subject,
      finding_status: STAGE2_FINDING_STATUS.INFORMATION_REQUIRED,
      severity_or_priority: 'medium',
      customer_facing_summary: r.authority_type === AUTHORITY_TYPE.BUILDING_CONTROL ? 'Building Control information remains outstanding.' : 'Authority information remains outstanding.',
      internal_detail: `${r.authority_name}: "${r.requirement_text}" — status ${r.status}.`,
      supporting_evidence_ids: [], conflicting_evidence_ids: [],
      source_files: (r.source_files || []).slice(), source_pages_or_sections: [],
      confidence: 'medium', why_it_matters: 'An authority requirement remains open or only apparently (not confirmed) satisfied.',
      information_still_required: ['Explicit authority acceptance/closure correspondence for this specific requirement.'],
      stage3_candidate: true,
      created_at: prior ? prior.created_at : Date.now(), resolved_at: null, resolution_evidence_ids: [],
      package: r.package.slice(), scope: r.scope, discrepancy_ids: [], authority_requirement_ids: [r.requirement_id], missing_evidence_ids: []
    };
  });

  (p.missingEvidence || []).forEach(m => {
    if (m.status !== MISSING_EVIDENCE_STATUS.MISSING) return; // PRESENT/NOT_APPLICABLE — nothing outstanding to show
    const id = 'f-miss-' + m.missing_evidence_id;
    const prior = (p.stage2Findings || {})[id];
    const summaryByKey = { structural_reactions: 'Ground/foundation information requires review.', fire_alarm_commissioning: 'Further evidence is required.', building_control_completion: 'Building Control information remains outstanding.' };
    newFindings[id] = {
      finding_id: id, project_id: p.id, category: 'missing_evidence', subject: m.subject,
      finding_status: STAGE2_FINDING_STATUS.INFORMATION_REQUIRED,
      severity_or_priority: 'medium',
      customer_facing_summary: summaryByKey[m.subject] || 'Further evidence is required.',
      internal_detail: m.expectation_basis,
      supporting_evidence_ids: [], conflicting_evidence_ids: [],
      source_files: [], source_pages_or_sections: [],
      confidence: m.confidence, why_it_matters: m.expectation_basis,
      information_still_required: [m.expected_evidence_type],
      stage3_candidate: true,
      created_at: prior ? prior.created_at : Date.now(), resolved_at: null, resolution_evidence_ids: [],
      package: (m.package || []).slice(), scope: m.scope, discrepancy_ids: [], authority_requirement_ids: [], missing_evidence_ids: [m.missing_evidence_id]
    };
  });

  return newFindings;
}

// -----------------------------------------------------------------------
// Genuine closure-sufficiency assessment for a CONFLICT_REQUIRES_
// CLARIFICATION finding (old FINDING_RULES-derived OR new Batch-3-derived —
// applies to both identically) — the "future, separately-governed batch"
// the CLOSURE_EVIDENCE correction and Batch 3 landmine comments deferred
// to. Never re-extracts/duplicates the existing extraction engine: it scans
// already-uploaded documents (`p.evidence`) for one that (a) is package/
// subject-relevant, (b) uses genuine explicit clarification/supersession
// wording (never a bare re-statement of a value, and never merely because
// evidence_function === CLOSURE_EVIDENCE or evidence_maturity === CLOSED —
// this function does not even read those fields), and (c) carries NO Batch
// 1 integrity limitation (an incomplete/unsigned document's wording is
// never trusted, regardless of filename — same safeguard as Batch 3's
// authority-acceptance gate). Never flips the underlying raw evidence_status/
// conflicts_with (Batch 1, untouched) — only sets THIS finding's own
// resolved_at/resolution_evidence_ids, which buildStage3Actions() already
// reads (unchanged mechanism) to resolve the corresponding action. Never
// re-opens a finding that already has resolved_at — a status only ever
// moves toward resolution here, never backward.
// -----------------------------------------------------------------------

const EXPLICIT_CLARIFICATION_PATTERN = /\b(supersed\w*|is\s+confirmed\s+as|the\s+correct\s+[a-z ]{0,30}?\s+is|confirmed\s+value\s+is)\b/i;

function findClarificationEvidence(finding, p) {
  const subjectTerms = (finding.subject || '').split(', ').filter(Boolean).map(s => s.replace(/_/g, ' '));
  return (p.evidence || []).find(e => {
    if (!e.extractedText) return false;
    if (Array.isArray(e.documentIntegrityFlags) && e.documentIntegrityFlags.length) return false; // never trust an incomplete/unsigned document
    if (!EXPLICIT_CLARIFICATION_PATTERN.test(e.extractedText)) return false;
    const lower = e.extractedText.toLowerCase();
    const pkgOverlap = (e.packages || []).some(pk => (finding.package || []).includes(pk.package));
    const subjectMentioned = subjectTerms.some(s => lower.includes(s));
    return pkgOverlap || subjectMentioned;
  });
}

function assessConflictResolution(finding, p) {
  if (finding.finding_status !== STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION) return;
  if (finding.resolved_at) return; // already resolved once — never re-resolved, never reverted
  const evidence = findClarificationEvidence(finding, p);
  if (evidence) {
    finding.resolved_at = Date.now();
    finding.resolution_evidence_ids = [evidence.name];
  }
}

// Planning Batch 4 (2026-08-26): a SECOND, narrowly-scoped resolution path —
// only ever considered once findClarificationEvidence() above has NOT
// already resolved it, and only for a discrepancy on an approved-drawing-
// BASELINE dimension subject (governing brief §9: "later variation
// approval... may close where the later approval genuinely addresses it").
// Reuses Planning Batch 1's own planning-document-type/evidence-function/
// integrity architecture directly — a genuine VARIATION_DECISION document
// (AUTHORITY_DECISION function, zero integrity flags) whose OWN extracted
// value for this exact subject matches the discrepancy's later value is
// authority confirmation that the new figure is now the approved one.
// Never a second conflict-detection mechanism — reads p.discrepancies
// (Evidence Intelligence Batch 3) and p.evidenceRecords (Batch 1) exactly
// as already computed. Original planning history (every earlier drawing
// revision, every earlier evidence record) is never altered or deleted.
function assessPlanningVariationResolution(finding, p) {
  if (finding.category !== 'discrepancy') return;
  if (finding.resolved_at) return; // already resolved (generic clarification path) — never re-resolved
  if (!APPROVED_DRAWING_DIMENSION_SUBJECTS.includes(finding.subject)) return;
  const disc = (p.discrepancies || []).find(d => (finding.discrepancy_ids || []).includes(d.discrepancy_id));
  if (!disc) return;
  const laterNum = extractNumberToken(disc.later_value);
  if (laterNum === null) return;
  const variationDocs = (p.evidence || []).filter(e =>
    e.planningDocumentType === PLANNING_DOCUMENT_TYPE.VARIATION_DECISION &&
    (e.evidenceFunctions || []).some(f => f.function === 'AUTHORITY_DECISION') &&
    !(Array.isArray(e.documentIntegrityFlags) && e.documentIntegrityFlags.length)
  );
  const matchingVariation = variationDocs.find(e => (p.evidenceRecords || []).some(r =>
    r.source_file === e.name && r.subject === disc.subject && (() => { const n = extractNumberToken(r.extracted_value); return n !== null && Math.abs(n - laterNum) < 0.01; })()
  ));
  if (matchingVariation) {
    finding.resolved_at = Date.now();
    finding.resolution_evidence_ids = [matchingVariation.name];
  }
}

// Builds/rebuilds p.stage2Findings (an object keyed by the stable finding_id
// from FINDING_RULES.key — NOT regenerated as a fresh random id each time,
// specifically so created_at/resolved_at/resolution_evidence_ids survive a
// rebuild after a new upload, per governance: "retain the old conflict
// history; mark the finding resolved; link the resolving evidence" rather
// than discarding history). One finding per rule, referencing every
// matching (non-'low'-confidence) evidence record by id — de-duplicated by
// construction: the same fact appearing in two documents becomes two
// supporting_evidence_ids on ONE finding, never two findings. Never invents
// a finding for a category with zero matching evidence.
//
// CLOSURE_EVIDENCE SEMANTIC CORRECTION landmine (2026-08-26): this function
// deliberately does NOT read evidence_function/evidence_maturity (see
// createEvidenceRecord()/deriveEvidenceMaturity() above) — a record's
// CLOSURE_EVIDENCE/CLOSED classification must never be used, here or in any
// future change to this function, to resolve/close a finding on its own.
// Resolution below is driven entirely by deriveFindingStatus()'s own
// evidence_status-based signal. Keep it that way until a future,
// separately-governed batch designs actual closure-sufficiency logic.
function buildStage2Findings(p) {
  if (!p) return [];
  const records = p.evidenceRecords || [];
  const previous = p.stage2Findings || {};
  const byId = {};
  FINDING_RULES.forEach(rule => {
    const matched = records.filter(r => rule.subjects.includes(r.subject) && r.confidence !== 'low');
    if (!matched.length) return; // no evidence for this category yet — no finding invented
    const status = deriveFindingStatus(rule, matched);
    const id = 'f-' + rule.key;
    const prior = previous[id];
    const supportingIds = matched.map(r => r.evidence_id);
    const conflictingIds = matched.filter(r => r.evidence_status === EVIDENCE_STATUS.CONFLICTING_EVIDENCE || r.evidence_status === EVIDENCE_STATUS.DOCUMENT_INTERNAL_INCONSISTENCY).map(r => r.evidence_id);
    let resolvedAt = prior ? prior.resolved_at : null;
    let resolutionIds = prior ? (prior.resolution_evidence_ids || []) : [];
    const priorWasUnresolvedConflict = prior && (prior.finding_status === STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION || prior.finding_status === STAGE2_FINDING_STATUS.DOCUMENT_INCONSISTENCY);
    const nowResolved = status !== STAGE2_FINDING_STATUS.CONFLICT_REQUIRES_CLARIFICATION && status !== STAGE2_FINDING_STATUS.DOCUMENT_INCONSISTENCY;
    if (priorWasUnresolvedConflict && nowResolved) { resolvedAt = Date.now(); resolutionIds = supportingIds; }
    byId[id] = {
      finding_id: id,
      project_id: p.id,
      category: rule.category,
      subject: rule.subjects.join(', '),
      finding_status: status,
      severity_or_priority: severityFor(status),
      customer_facing_summary: customerSummaryFor(rule, status),
      internal_detail: matched.map(r => `${r.source_file} (${r.source_page_or_section}): "${r.extracted_value}" [${r.evidence_status}]`).join(' | '),
      supporting_evidence_ids: supportingIds,
      conflicting_evidence_ids: conflictingIds,
      source_files: Array.from(new Set(matched.map(r => r.source_file))),
      source_pages_or_sections: Array.from(new Set(matched.map(r => r.source_page_or_section))),
      confidence: matched.some(r => r.confidence === 'high') ? 'high' : (matched.some(r => r.confidence === 'medium') ? 'medium' : 'low'),
      why_it_matters: rule.whyItMatters,
      information_still_required: status === STAGE2_FINDING_STATUS.CONFIRMED_DOCUMENTARY_FINDING || status === STAGE2_FINDING_STATUS.NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE ? [] : rule.infoRequired,
      stage3_candidate: stage3CandidateFor(status),
      created_at: prior ? prior.created_at : Date.now(),
      resolved_at: resolvedAt,
      resolution_evidence_ids: resolutionIds,
      // Batch 4 (2026-08-26) additive fields — derived entirely from the
      // SAME `matched` evidence records already used above; never a new
      // classification pass. discrepancy_ids/authority_requirement_ids/
      // missing_evidence_ids start empty here and are filled in by
      // enrichFindingWithIntelligence() below purely from package overlap
      // (never invented from this rule's own subject list).
      package: Array.from(new Set(matched.flatMap(r => r.packages || []))),
      scope: matched.map(r => r.scope).find(Boolean) || null,
      evidence_function: Array.from(new Set(matched.flatMap(r => (r.evidence_function || []).map(f => f.function)))),
      evidence_maturity: Array.from(new Set(matched.flatMap(r => (r.evidence_maturity || []).map(m => m.maturity)))),
      discrepancy_ids: null, authority_requirement_ids: null, missing_evidence_ids: null // null = "not yet computed", see enrichFindingWithIntelligence()
    };
  });
  // Batch 4 (2026-08-26): new findings generated directly from unresolved
  // Batch 3 records with no existing FINDING_RULES coverage — merged into
  // the SAME byId map (one finding store, never a parallel one). Discrepancy
  // findings whose subject an EXISTING finding above already covers are
  // attached to that finding instead (see buildBatch3DerivedFindings()).
  Object.assign(byId, buildBatch3DerivedFindings(p, byId));
  // Enrich EVERY finding (old and new) with Batch 2B/3 cross-references,
  // apparent responsibility/interface wording and completeness/unresolved-
  // reason — purely additive, never touches finding_status/
  // customer_facing_summary/severity/stage3_candidate.
  Object.values(byId).forEach(f => enrichFindingWithIntelligence(f, p));
  // Batch 4 (2026-08-26): genuine closure-sufficiency check for any
  // CONFLICT_REQUIRES_CLARIFICATION finding (old or new) — see
  // assessConflictResolution() above.
  Object.values(byId).forEach(f => assessConflictResolution(f, p));
  // Planning Batch 4 (2026-08-26): the second, narrowly-scoped resolution
  // path for a design-relevant planning discrepancy — see
  // assessPlanningVariationResolution() above. Run after the generic path
  // so it only ever fires when that one hasn't already resolved it.
  Object.values(byId).forEach(f => assessPlanningVariationResolution(f, p));
  p.stage2Findings = byId;
  return Object.values(byId);
}

// =============================================================================
// Batch 4 — Stage 3 ACTION GENERATION only. Turns eligible Stage 2 findings
// (stage3_candidate: true) into controlled, evidence-linked Stage 3 actions.
// Actions reference an existing finding_id and existing evidence_ids — this
// is not a second evidence or finding system. Project Check identifies and
// coordinates required resolution here; it never poses as the structural/
// fire/geotechnical engineer, Building Control, planning authority, supplier
// or civil/drainage engineer, and never chooses between conflicting
// technical values. Detailed actions are for the existing paid Stage 3
// Solutions product — see app.js's stage3Actions(), gated on the existing
// p.plan entitlement, which this batch does not alter.
// =============================================================================

const STAGE3_ACTION_STATUS = {
  OPEN: 'OPEN',
  INFORMATION_REQUIRED: 'INFORMATION_REQUIRED',
  AWAITING_SPECIALIST: 'AWAITING_SPECIALIST',
  AWAITING_SUPPLIER: 'AWAITING_SUPPLIER',
  AWAITING_CUSTOMER: 'AWAITING_CUSTOMER',
  AWAITING_DESIGN: 'AWAITING_DESIGN',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  RESOLVED: 'RESOLVED',
  SUPERSEDED: 'SUPERSEDED',
  // Batch 4 (2026-08-26) additions — a fuller, evidence-gated closure
  // lifecycle used by NEW actions sourced directly from Batch 3 records
  // (discrepancy/authority-requirement/missing-evidence — see
  // buildBatch3DerivedActions() below). Purely additive: every EXISTING
  // ACTION_RULES-derived action keeps using OPEN/…/RESOLVED/SUPERSEDED
  // exactly as before — "reuse existing statuses", not a parallel
  // vocabulary replacing them.
  EVIDENCE_REQUESTED: 'EVIDENCE_REQUESTED',
  EVIDENCE_RECEIVED: 'EVIDENCE_RECEIVED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPARENTLY_RESOLVED: 'APPARENTLY_RESOLVED',
  CLOSED: 'CLOSED'
};

// Explicit, curated finding-key -> action rule table. NOT every stage3_candidate
// finding automatically gets an action — "do not create an action merely
// because evidence exists" (governance). Four Batch 3 finding keys are
// deliberately excluded here on a per-key basis, reported rather than
// mechanically auto-generated:
//   - 'slab' — when CONFIRMED_DOCUMENTARY_FINDING (corroborated across
//     documents), nothing further needs coordinating; see statusFor() below,
//     which still allows an action if it's ever only NEEDS_REVIEW instead.
//   - 'quotation_basis' — "this is a budget estimate" is commercial framing
//     already inherent to the existing supplier-quotation-comparison flow
//     (quotes()), not a distinct resolution task for Project Check to track.
//   - 'structural_information' — preliminary dimensions/core-test figures
//     are reference data (footprint dimensions already flow into the
//     drawing via Stage 1), not themselves an unresolved gap.
//   - 'groundworks_scope' — descriptive of what a quotation already covers;
//     resolving it is exactly what normal supplier-quotation comparison
//     already does, not a second parallel action-tracking job.
// See the task report for the full per-key reasoning.
const ACTION_RULES = [
  { findingKey: 'ground_conditions', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_SPECIALIST,
    customerAction: 'Ensure the final base/foundation design takes account of the documented ground conditions and the final building reactions.',
    whyRequired: 'Ground conditions materially affect foundation/base design. The building supplier produces the structural reactions for this building; the structural engineer designs the base using those reactions together with the verified ground information — Project Check does not design the foundation itself.',
    requiredInformation: ['Final building reactions from the building supplier.', 'Structural engineer confirmation that the base design accounts for the documented ground conditions.'],
    likelyResponsibleParty: 'Structural engineer (base design) / Building supplier (reactions)',
    completionCriteria: 'The base/foundation design has been confirmed by the responsible structural engineer using the final supplier reactions and the documented ground conditions.',
    dependency: 'Final building reactions from the supplier; confirmed ground parameters; confirmed building geometry.' },
  { findingKey: 'ground_conditions_depth_inconsistency', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_CUSTOMER,
    customerAction: 'Clarify the inconsistent ground-condition (made ground depth) information with the report author before it is relied on for foundation design.',
    whyRequired: 'The same document states two different made-ground depth figures — a material discrepancy for foundation depth/type, not a harmless typo, so it should not be relied on without clarification.',
    requiredInformation: ['Written clarification from the report author confirming which made-ground depth figure is correct.'],
    likelyResponsibleParty: 'Customer / original report author',
    completionCriteria: 'The report author (or a suitably qualified reviewer) has confirmed a single, consistent made-ground depth figure.' },
  { findingKey: 'foundation_bearing_pressure', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_SPECIALIST,
    customerAction: 'Clarify the governing allowable bearing pressure with the responsible geotechnical/structural engineer before final foundation design.',
    whyRequired: 'Foundation design depends on a single, governing bearing-pressure figure. Project Check cannot and does not choose between the differing figures found — that determination belongs to the responsible engineer.',
    requiredInformation: ['Confirmed geotechnical design value for allowable bearing pressure.', 'Revised/clarified engineer documentation, if the original figures need correcting.'],
    likelyResponsibleParty: 'Geotechnical engineer / Structural engineer',
    completionCriteria: 'A single, confirmed allowable bearing pressure value has been provided by the responsible engineer and no longer conflicts across project documents.',
    dependency: 'Final foundation design depends on this figure being resolved first.' },
  { findingKey: 'drainage_provisional', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_DESIGN,
    customerAction: 'Define the surface-water drainage design and discharge route so the provisional allowance can be replaced with a confirmed scope.',
    whyRequired: 'A provisional sum is not a final design or a fixed price — the actual drainage scope and cost may change once drainage design is completed.',
    requiredInformation: ['Finalised surface-water drainage design.', 'Confirmed discharge point/route.'],
    likelyResponsibleParty: 'Civil/drainage engineer',
    completionCriteria: 'A non-provisional surface-water drainage design and cost have been confirmed.',
    dependency: 'May depend on site levels, discharge point, drainage authority requirements and the final external works layout.' },
  { findingKey: 'service_ducts_provisional', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_DESIGN,
    customerAction: 'Confirm service-duct quantity, routes, sizes and destinations before finalising the groundworks scope.',
    whyRequired: 'A provisional sum is not a final design or a fixed price — actual utility routing may change the scope and cost once confirmed.',
    requiredInformation: ['Confirmed utility routes, duct sizes and destinations.'],
    likelyResponsibleParty: 'Civil engineer / Utility survey provider',
    completionCriteria: 'Service-duct quantity, routes, sizes and destinations have been confirmed and a non-provisional cost is available.' },
  { findingKey: 'underground_services_assumption', defaultStatus: STAGE3_ACTION_STATUS.INFORMATION_REQUIRED,
    customerAction: 'Obtain or confirm an underground utility/services survey before excavation and final foundation design.',
    whyRequired: 'An assumption that a site is clear of underground services is not the same as a survey confirming it — unexpected services can cause cost and programme impact if encountered during construction.',
    requiredInformation: ['Utility survey.', 'Existing-services drawing, if available.', 'Confirmation of any services crossing the proposed footprint.'],
    likelyResponsibleParty: 'Customer / specialist utility survey provider',
    completionCriteria: 'Suitable utility information has been provided and reviewed against the proposed footprint.' },
  { findingKey: 'existing_drainage_assumption', defaultStatus: STAGE3_ACTION_STATUS.INFORMATION_REQUIRED,
    customerAction: 'Obtain or confirm that existing drainage can genuinely accommodate the proposed connection before relying on it.',
    whyRequired: 'An assumption that existing drainage can be retained and connected into is not the same as a survey/design confirming it.',
    requiredInformation: ['Existing drainage survey/record information, or a drainage engineer’s confirmation of capacity.'],
    likelyResponsibleParty: 'Customer / Civil-drainage engineer',
    completionCriteria: 'Existing drainage capacity/connection has been confirmed as suitable for the proposed development.' },
  { findingKey: 'concrete_breakout_exclusion', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_CUSTOMER,
    customerAction: 'Confirm whether existing concrete must be broken out within the proposed works area and establish whether that work is included in the final groundworks scope.',
    whyRequired: 'Work excluded from a quotation is not free — if breaking out existing concrete/hardstanding proves necessary, it is very likely to be an additional cost not currently priced in.',
    requiredInformation: ['Confirmation of whether existing concrete/hardstanding breakout is actually required.', 'A priced variation from the groundworks contractor if it is required.'],
    likelyResponsibleParty: 'Groundworks contractor / Customer',
    completionCriteria: 'Whether concrete breakout is required has been confirmed, and if so, it is either priced into the scope or a variation has been agreed.' },
  { findingKey: 'contaminated_ground_exclusion', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_CUSTOMER,
    // Conditional suppression: if the same project's contamination-testing
    // finding already shows NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE (a
    // genuine, project-specific site investigation result), the generic
    // quotation exclusion is adequately resolved by that evidence and does
    // NOT need a live coordination action — it remains recorded as
    // commercial evidence only (see buildStage3Actions() below). This is
    // deliberately re-evaluated on every rebuild (not a one-off decision) so
    // a later contamination finding turning up an actual issue would
    // correctly re-enable the action.
    suppressIf: findings => { const c = findings['f-contamination']; return !!(c && c.finding_status === STAGE2_FINDING_STATUS.NO_ISSUE_IDENTIFIED_FROM_CURRENT_EVIDENCE); },
    customerAction: 'Confirm whether contaminated ground disposal is likely to be required and whether this is included in the final groundworks price.',
    whyRequired: 'Work excluded from a quotation is not free — if contaminated ground is encountered, its disposal is very likely to be an additional cost not currently priced in.',
    requiredInformation: ['Confirmation of the likelihood of contaminated ground (e.g. from site investigation findings).', 'A priced allowance/variation from the groundworks contractor if relevant.'],
    likelyResponsibleParty: 'Groundworks contractor / Customer',
    completionCriteria: 'The likelihood of contaminated ground has been assessed and, if relevant, disposal is either priced into the scope or a variation has been agreed.' },
  { findingKey: 'gas_protection', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_SPECIALIST,
    customerAction: 'Confirm the required gas-protection specification and who is responsible for installation and validation as part of the base/floor design.',
    whyRequired: 'Ground-gas protection measures must be coordinated with the base/floor design and are a Building Regulations matter, not an optional extra.',
    requiredInformation: ['Confirmed gas-protection specification matching the actual ground-gas risk assessment.', 'Confirmation of who installs and who validates the installed measures.'],
    likelyResponsibleParty: 'Building supplier / Building Control / Specialist gas-protection installer',
    completionCriteria: 'The gas-protection specification and installation/validation responsibility have been confirmed as part of the base/floor design.' },
  { findingKey: 'project_description_inconsistency', defaultStatus: STAGE3_ACTION_STATUS.AWAITING_CUSTOMER,
    customerAction: 'Clarify the inconsistent project description with the document author where it could affect reliance on the report.',
    whyRequired: 'A document that describes the project inconsistently (e.g. mixing industrial and residential wording) may be based on an incorrect template or an out-of-date scope, and should be checked rather than relied on as-is.',
    requiredInformation: ['Confirmation from the document author of which project description is correct, and whether the rest of the report content applies to this project unchanged.'],
    likelyResponsibleParty: 'Customer / original document author',
    completionCriteria: 'The document author has confirmed the correct project description and whether any other content in the report needs to be revisited as a result.' }
];

function severityToPriority(severity) {
  return severity === 'high' ? 'high' : (severity === 'low' ? 'low' : 'medium');
}

// Builds/rebuilds p.stage3Actions (keyed by the SAME stable 'a-'+findingKey
// scheme as findings use 'f-'+findingKey — so created_at/history/
// completed_at survive a rebuild exactly like Batch 3's findings do).
// Never invents an action without a live, qualifying finding; never
// silently drops a previously-created action's history even if its finding
// no longer qualifies on a later rebuild (evidence in this app is
// append-only — never deleted — so this is a defensive safeguard, not an
// expected path). Resolution reuses the finding's OWN resolution signal
// (Batch 3) rather than a second, independent "does this new document
// resolve this action" detector — see the task report for the honest
// limitation this implies for assumption/provisional-type actions.
//
// CLOSURE_EVIDENCE SEMANTIC CORRECTION landmine (2026-08-26): this function
// deliberately does NOT read evidence_function/evidence_maturity either —
// an action's RESOLVED status comes only from its source finding's own
// resolved_at signal above, never from a supporting evidence record being
// classified CLOSURE_EVIDENCE/CLOSED. A future Batch 4 ("Findings, Actions &
// Closure") may legitimately design real closure-sufficiency logic that
// *reads* evidence_function/evidence_maturity as one input among others —
// but it must not treat CLOSURE_EVIDENCE classification alone as
// sufficient; that determination does not exist in this codebase yet.
// -----------------------------------------------------------------------
// Content templates for a Batch-3-derived action, dispatched by finding
// category/discrepancy type/missing-evidence subject — a small, curated,
// TYPE-level dispatch table (mirrors the existing ACTION_RULES' own "one
// curated entry, never an uncontrolled auto-generation" spirit), not a
// bespoke rule per every possible future subject. Wording follows the
// governing brief's own worked examples closely (Part 3/Part 4) —
// deliberately never claims non-compliance, never asserts authority
// approval, never chooses a winner between conflicting values.
// -----------------------------------------------------------------------

function deriveBatch3ActionContent(finding, p) {
  if (finding.category === 'discrepancy') {
    const disc = (p.discrepancies || []).find(d => finding.discrepancy_ids.includes(d.discrepancy_id));
    const isMaterial = disc && disc.discrepancy_type === DISCREPANCY_TYPE.MATERIAL_CONFLICT;
    // Planning Batch 4 (2026-08-26): a material conflict on an approved-
    // drawing-BASELINE dimension subject (governing brief §8/§9) gets
    // planning-specific wording — reuses Planning Batch 1's own
    // p.planningDrawings directly; never silently chooses one drawing/value
    // as correct (both are always retained as project history elsewhere,
    // untouched by this). Every other discrepancy subject (e.g. bearing
    // pressure, made-ground depth) keeps its existing, unchanged wording.
    if (isMaterial && APPROVED_DRAWING_DIMENSION_SUBJECTS.includes(finding.subject)) {
      return {
        customerAction: `Confirm whether a planning variation/amendment is required for the ${finding.subject.replace(/_/g, ' ')} shown in current project information, and obtain the appropriate authority decision before the affected work proceeds. Both the originally approved value and the later value remain part of the project's history — neither has been assumed correct.`,
        whyRequired: disc.consequence_if_unresolved,
        evidenceRequiredToClose: ['A revised, authority-approved planning drawing/decision confirming the new value (e.g. a variation/amendment decision), OR evidence confirming the earlier approved value still stands.']
      };
    }
    return {
      customerAction: isMaterial
        ? `Confirm whether the later ${finding.subject.replace(/_/g, ' ')} value is a genuine, approved change, and obtain the appropriate approved amendment if so.`
        : `Obtain engineer/consultant clarification to resolve the conflicting ${finding.subject.replace(/_/g, ' ')} values and confirm which figure should be relied upon.`,
      whyRequired: disc ? disc.consequence_if_unresolved : 'Conflicting values for this subject must be resolved before being relied upon.',
      evidenceRequiredToClose: isMaterial
        ? ['An approved amendment/revision confirming the new value, OR confirmation that the earlier approved value still stands.']
        : ['Written clarification from the relevant engineer/consultant confirming the correct value.', 'A revised design/report document that explicitly supersedes the conflicting figure, where applicable.']
    };
  }
  if (finding.category === 'authority_requirement') {
    const req = (p.authorityRequirements || []).find(r => finding.authority_requirement_ids.includes(r.requirement_id));
    return {
      customerAction: `Provide/coordinate the required ${(req && req.requirement_text) || 'authority'} evidence and obtain confirmation of the authority's position before treating this requirement as closed.`,
      whyRequired: 'An authority requirement remains open or only apparently (not confirmed) satisfied — a response alone does not equal acceptance, and Project Check does not itself act as the authority.',
      evidenceRequiredToClose: ['Explicit authority acceptance or closure correspondence relevant specifically to this requirement (a bare response, inspection, or handover is not sufficient).']
    };
  }
  // missing_evidence
  const templates = {
    structural_reactions: { customerAction: 'Obtain the final supplier structural reactions required for the foundation design.', evidenceRequiredToClose: ['Final structural reactions confirmed by the building supplier.'] },
    fire_alarm_commissioning: { customerAction: 'Obtain appropriate commissioning/verification evidence for the fire system before treating that installation requirement as complete.', evidenceRequiredToClose: ['Commissioning or verification evidence for the fire alarm/detection system.'] },
    building_control_completion: { customerAction: 'Confirm whether the appropriate Building Control completion evidence has been issued and add it to the project record.', evidenceRequiredToClose: ['A Building Control completion certificate or explicit written completion acceptance.'] }
  };
  const t = templates[finding.subject] || { customerAction: 'Confirm whether the expected evidence for this matter exists and add it to the project record.', evidenceRequiredToClose: [finding.information_still_required ? finding.information_still_required[0] : 'Suitable supporting evidence for this matter.'] };
  return { customerAction: t.customerAction, whyRequired: finding.why_it_matters, evidenceRequiredToClose: t.evidenceRequiredToClose };
}

// Derives ONLY the action_status/completion fields for a Batch-3-derived
// action, by reusing whichever Batch 3 record's OWN status the finding
// references — never a second, independent decision about whether
// something is satisfied. This is precisely what stops "response supplied"
// or "missing evidence now present" from meaning more than Batch 3 itself
// already decided it means.
function deriveBatch3ActionStatus(finding, p) {
  if (finding.category === 'discrepancy') {
    if (finding.resolved_at) return { status: STAGE3_ACTION_STATUS.CLOSED, completedAt: finding.resolved_at, completionIds: (finding.resolution_evidence_ids || []).slice() };
    return { status: STAGE3_ACTION_STATUS.OPEN, completedAt: null, completionIds: [] };
  }
  if (finding.category === 'authority_requirement') {
    const req = (p.authorityRequirements || []).find(r => finding.authority_requirement_ids.includes(r.requirement_id));
    if (req && req.status === AUTHORITY_REQUIREMENT_STATUS.CLOSED) return { status: STAGE3_ACTION_STATUS.CLOSED, completedAt: req.closed_at, completionIds: (req.closure_evidence_ids || []).slice() };
    if (req && req.status === AUTHORITY_REQUIREMENT_STATUS.APPARENTLY_SATISFIED) return { status: STAGE3_ACTION_STATUS.APPARENTLY_RESOLVED, completedAt: null, completionIds: (req.apparent_acceptance_evidence_ids || []).slice() };
    return { status: STAGE3_ACTION_STATUS.OPEN, completedAt: null, completionIds: [] };
  }
  // missing_evidence
  const miss = (p.missingEvidence || []).find(m => finding.missing_evidence_ids.includes(m.missing_evidence_id));
  if (miss && miss.status === MISSING_EVIDENCE_STATUS.PRESENT) return { status: STAGE3_ACTION_STATUS.CLOSED, completedAt: miss.satisfied_at, completionIds: (miss.satisfying_evidence_ids || []).slice() };
  return { status: STAGE3_ACTION_STATUS.OPEN, completedAt: null, completionIds: [] };
}

function buildBatch3DerivedActions(p, findings, previous) {
  const byId = {};
  Object.values(findings).forEach(finding => {
    if (!['discrepancy', 'authority_requirement', 'missing_evidence'].includes(finding.category)) return;
    if (!finding.stage3_candidate) return;
    const id = 'a-' + finding.finding_id;
    const prior = previous[id];
    const history = prior ? (prior.history || []).slice() : [{ at: Date.now(), text: 'Action created from Stage 2 finding.' }];
    const { status, completedAt, completionIds } = deriveBatch3ActionStatus(finding, p);
    const priorStatus = prior ? prior.action_status : null;
    if (priorStatus && priorStatus !== status && (status === STAGE3_ACTION_STATUS.CLOSED || status === STAGE3_ACTION_STATUS.APPARENTLY_RESOLVED)) {
      history.push({ at: Date.now(), text: `Action moved from ${priorStatus} to ${status}: ${completionIds.length ? 'closure/acceptance evidence — ' + completionIds.join(', ') : 'underlying Batch 3 record status changed.'}` });
    } else if (!prior) {
      history.push({ at: Date.now(), text: `Action created from a Batch 3 ${finding.category.replace(/_/g, ' ')} record.` });
    }
    // A status can only ever move FORWARD once CLOSED — never reopened by a
    // later rebuild (append-only evidence philosophy, same as every other
    // structure in this file).
    const finalStatus = (prior && prior.action_status === STAGE3_ACTION_STATUS.CLOSED) ? STAGE3_ACTION_STATUS.CLOSED : status;
    const content = deriveBatch3ActionContent(finding, p);
    byId[id] = {
      action_id: id, project_id: p.id, source_finding_id: finding.finding_id,
      category: finding.category, subject: finding.subject,
      action_status: finalStatus, action_priority: severityToPriority(finding.severity_or_priority),
      customer_facing_action: content.customerAction, internal_detail: finding.internal_detail,
      why_required: content.whyRequired, required_information: finding.information_still_required || [],
      likely_responsible_party: finding.apparent_responsibility || null,
      supporting_evidence_ids: (finding.supporting_evidence_ids || []).slice(),
      source_files: (finding.source_files || []).slice(), source_pages_or_sections: (finding.source_pages_or_sections || []).slice(),
      blocking_dependency: null, completion_criteria: content.evidenceRequiredToClose.join(' '),
      created_at: prior ? prior.created_at : Date.now(),
      completed_at: prior && prior.completed_at ? prior.completed_at : completedAt,
      completion_evidence_ids: finalStatus === STAGE3_ACTION_STATUS.CLOSED && prior && prior.completion_evidence_ids && prior.completion_evidence_ids.length ? prior.completion_evidence_ids.slice() : completionIds,
      superseded_by: prior ? (prior.superseded_by || null) : null,
      history,
      package: finding.package || [], scope: finding.scope || null,
      discrepancy_ids: finding.discrepancy_ids || [], authority_requirement_ids: finding.authority_requirement_ids || [], missing_evidence_ids: finding.missing_evidence_ids || [],
      responsibility_relationship_ids: finding.responsibility_relationship_ids || [],
      apparent_responsibility: finding.apparent_responsibility || null, interface_summary: finding.interface_summary || null,
      evidence_required_to_close: content.evidenceRequiredToClose,
      // Planning Batch 4 (2026-08-26) additive context, populated ONLY for a
      // discrepancy on an approved-drawing-baseline dimension subject — null
      // for every other Batch-3-derived action (unchanged). `planning_gate`
      // is consumed, never re-derived, from Planning Batch 3's own
      // p.planningIssueGates; `approved_baseline_context` is read straight
      // from Planning Batch 1's own p.planningDrawings.
      planning_gate: APPROVED_DRAWING_DIMENSION_SUBJECTS.includes(finding.subject) ? ((p.planningIssueGates || []).find(g => g.source_type === 'DISCREPANCY' && (finding.discrepancy_ids || []).includes(g.source_id)) || {}).gate || null : null,
      approved_baseline_context: APPROVED_DRAWING_DIMENSION_SUBJECTS.includes(finding.subject) ? (p.planningDrawings || []).filter(d => d.is_current_baseline).map(d => ({ drawing_number: d.drawing_number, revision: d.revision, status: d.status })) : null
    };
  });
  return byId;
}

function buildStage3Actions(p) {
  if (!p) return [];
  const findings = p.stage2Findings || {};
  const previous = p.stage3Actions || {};
  const byId = {};
  ACTION_RULES.forEach(rule => {
    const finding = findings['f-' + rule.findingKey];
    const id = 'a-' + rule.findingKey;
    if (!finding || !finding.stage3_candidate) return; // no qualifying finding -> no action invented
    if (rule.suppressIf && rule.suppressIf(findings)) return; // e.g. contaminated-ground resolved by adequate site investigation
    const prior = previous[id];
    const history = prior ? (prior.history || []).slice() : [{ at: Date.now(), text: 'Action created from Stage 2 finding.' }];
    let status = prior ? prior.action_status : rule.defaultStatus;
    let completedAt = prior ? prior.completed_at : null;
    let completionIds = prior ? (prior.completion_evidence_ids || []).slice() : [];
    // Closure signal: the underlying finding itself became resolved (Batch 3
    // logic — a genuine status transition away from CONFLICT/INCONSISTENCY,
    // never assumed just because a new file exists). Resolution must be
    // supported by evidence that actually addresses the action, so this only
    // fires when the finding's own resolution evidence is present.
    if (finding.resolved_at && status !== STAGE3_ACTION_STATUS.RESOLVED) {
      history.push({ at: Date.now(), text: `Action resolved: underlying Stage 2 finding was resolved by evidence (${(finding.resolution_evidence_ids || []).join(', ') || 'see finding'}).` });
      status = STAGE3_ACTION_STATUS.RESOLVED;
      completedAt = Date.now();
      completionIds = finding.resolution_evidence_ids && finding.resolution_evidence_ids.length ? finding.resolution_evidence_ids.slice() : completionIds;
    }
    byId[id] = {
      action_id: id,
      project_id: p.id,
      source_finding_id: finding.finding_id,
      category: finding.category,
      subject: finding.subject,
      action_status: status,
      action_priority: severityToPriority(finding.severity_or_priority),
      customer_facing_action: rule.customerAction,
      internal_detail: finding.internal_detail,
      why_required: rule.whyRequired,
      required_information: rule.requiredInformation,
      likely_responsible_party: rule.likelyResponsibleParty,
      supporting_evidence_ids: finding.supporting_evidence_ids.slice(),
      source_files: finding.source_files.slice(),
      source_pages_or_sections: finding.source_pages_or_sections.slice(),
      blocking_dependency: rule.dependency || null,
      completion_criteria: rule.completionCriteria,
      created_at: prior ? prior.created_at : Date.now(),
      completed_at: completedAt,
      completion_evidence_ids: completionIds,
      superseded_by: prior ? (prior.superseded_by || null) : null,
      history,
      // Batch 4 (2026-08-26) additive fields — copied straight from the
      // already-enriched source finding (enrichFindingWithIntelligence()),
      // never a second classification pass. `evidence_required_to_close`
      // reuses the rule's existing `requiredInformation` — the brief's own
      // "reuse existing fields where equivalent" applied literally, since
      // that field already IS this concept for these curated actions.
      package: finding.package || [], scope: finding.scope || null,
      discrepancy_ids: finding.discrepancy_ids || [], authority_requirement_ids: finding.authority_requirement_ids || [], missing_evidence_ids: finding.missing_evidence_ids || [],
      responsibility_relationship_ids: finding.responsibility_relationship_ids || [],
      apparent_responsibility: finding.apparent_responsibility || null, interface_summary: finding.interface_summary || null,
      evidence_required_to_close: rule.requiredInformation ? rule.requiredInformation.slice() : []
    };
  });
  // Batch 4 (2026-08-26): new actions generated directly from Batch-3-
  // derived findings (discrepancy/authority_requirement/missing_evidence
  // categories) that have no existing ACTION_RULES coverage — merged into
  // the SAME byId map (one action store, never a parallel one).
  Object.assign(byId, buildBatch3DerivedActions(p, findings, previous));
  // Planning Batch 4 (2026-08-26): planning-requirement-derived and
  // planning-consultee-response-derived actions — merged into the SAME
  // byId map, same schema, same append-only history convention. See the
  // Planning Batch 4 section below for both builders. Neither reads
  // p.stage2Findings at all (planning requirements/consultee responses are
  // not Stage 2 findings) — a genuinely separate, but NOT duplicate, source
  // feeding the one existing action store.
  Object.assign(byId, buildPlanningRequirementActions(p, previous));
  Object.assign(byId, buildPlanningConsulteeResponseActions(p, previous));
  // Defensive history preservation: never silently drop a previously-created
  // action just because its finding no longer qualifies on this rebuild
  // (not expected in normal use, since evidence is append-only in this app).
  Object.keys(previous).forEach(id => { if (!byId[id]) byId[id] = previous[id]; });
  p.stage3Actions = byId;
  return Object.values(byId);
}

// =============================================================================
// PLANNING INTELLIGENCE — Planning Batch 1 of 5 (2026-08-26): PLANNING
// LIFECYCLE, EVIDENCE MEANING & APPROVED BASELINE.
//
// Extends the EXISTING Evidence Intelligence architecture (document type,
// evidence function/maturity, integrity, package/scope, discrepancy,
// authority requirement) — reused directly throughout this section, never
// duplicated. This batch establishes PLANNING MEANING AND STRUCTURE ONLY:
// no customer-facing advice, no "progress carefully" logic, no Stage 3
// actions, no council portal scraping. Everything below is internal/dev
// signal only, consumed by nothing customer-facing in this batch.
//
// Governing safeguard, encoded structurally throughout: authority-decision-
// standing (APPROVED/decision evidence) is NEVER inferred from an
// application form, acknowledgement, consultee support, officer
// correspondence, planning statement, drawing title, filename, or customer
// statement — only from a genuine decision-notice-style document, itself
// gated on Batch 1's own integrity check (never trusted if incomplete/
// unsigned/template, regardless of filename).
// =============================================================================

// -----------------------------------------------------------------------
// Vocabularies
// -----------------------------------------------------------------------

const PLANNING_LIFECYCLE_STATUS = {
  NOT_ASSESSED: 'NOT_ASSESSED',
  PREPARATION: 'PREPARATION',
  SUBMITTED: 'SUBMITTED',
  VALIDATED: 'VALIDATED',
  CONSULTATION_IN_PROGRESS: 'CONSULTATION_IN_PROGRESS',
  CONSULTATION_REVIEW: 'CONSULTATION_REVIEW',
  FAVOURABLE_FORMAL_DECISION_PENDING: 'FAVOURABLE_FORMAL_DECISION_PENDING',
  UNCERTAIN_MATERIAL_ISSUE_OUTSTANDING: 'UNCERTAIN_MATERIAL_ISSUE_OUTSTANDING',
  APPROVED_WITH_CONDITIONS: 'APPROVED_WITH_CONDITIONS',
  APPROVED_PRE_START_ACTIONS_OUTSTANDING: 'APPROVED_PRE_START_ACTIONS_OUTSTANDING',
  APPROVED_BASELINE_VARIED_OR_AMENDED: 'APPROVED_BASELINE_VARIED_OR_AMENDED',
  PLANNING_ACTIONS_CLOSED: 'PLANNING_ACTIONS_CLOSED'
};

// A SECOND, more specific document-type axis — reused ALONGSIDE (never
// replacing) Batch 1's existing broad `DOCUMENT_TYPES`/`documentType`
// ('planning_document' stays exactly as-is). Only ever populated
// meaningfully for a document Batch 1/2A already considers planning-
// relevant; a document with no planning signal at all correctly resolves to
// null (see classifyPlanningDocumentType() below), never a forced guess.
const PLANNING_DOCUMENT_TYPE = {
  PLANNING_APPLICATION_FORM: 'PLANNING_APPLICATION_FORM',
  PLANNING_STATEMENT: 'PLANNING_STATEMENT',
  DESIGN_AND_ACCESS_STATEMENT: 'DESIGN_AND_ACCESS_STATEMENT',
  SITE_LOCATION_PLAN: 'SITE_LOCATION_PLAN',
  BLOCK_PLAN: 'BLOCK_PLAN',
  EXISTING_DRAWING: 'EXISTING_DRAWING',
  PROPOSED_PLANNING_DRAWING: 'PROPOSED_PLANNING_DRAWING',
  CONSULTEE_RESPONSE: 'CONSULTEE_RESPONSE',
  PUBLIC_OBJECTION: 'PUBLIC_OBJECTION',
  COMMUNITY_COUNCIL_RESPONSE: 'COMMUNITY_COUNCIL_RESPONSE',
  PLANNING_OFFICER_CORRESPONDENCE: 'PLANNING_OFFICER_CORRESPONDENCE',
  PLANNING_ACKNOWLEDGEMENT: 'PLANNING_ACKNOWLEDGEMENT',
  PLANNING_DECISION_NOTICE: 'PLANNING_DECISION_NOTICE',
  APPROVED_DRAWING_SCHEDULE: 'APPROVED_DRAWING_SCHEDULE',
  PLANNING_CONDITION_INFORMATION: 'PLANNING_CONDITION_INFORMATION',
  VARIATION_APPLICATION: 'VARIATION_APPLICATION',
  VARIATION_DECISION: 'VARIATION_DECISION',
  NON_MATERIAL_AMENDMENT: 'NON_MATERIAL_AMENDMENT',
  OTHER_PLANNING_EVIDENCE: 'OTHER_PLANNING_EVIDENCE'
};

const CONSULTEE_RESPONSE_MEANING = {
  SUPPORT: 'SUPPORT',
  NO_OBJECTION: 'NO_OBJECTION',
  NO_OBSERVATIONS: 'NO_OBSERVATIONS',
  INFORMATIVE_ONLY: 'INFORMATIVE_ONLY',
  MANAGEABLE_REQUIREMENT: 'MANAGEABLE_REQUIREMENT',
  CONDITION_RECOMMENDED: 'CONDITION_RECOMMENDED',
  FURTHER_INFORMATION_REQUIRED: 'FURTHER_INFORMATION_REQUIRED',
  MATERIAL_OBJECTION: 'MATERIAL_OBJECTION',
  UNKNOWN: 'UNKNOWN'
};

const OBJECTION_SOURCE_TYPE = { PUBLIC: 'PUBLIC', COMMUNITY_COUNCIL: 'COMMUNITY_COUNCIL' };

const OBJECTION_SUBJECT = {
  ACCESS: 'ACCESS', TRAFFIC: 'TRAFFIC', NOISE: 'NOISE', LIGHTING: 'LIGHTING',
  RESIDENTIAL_AMENITY: 'RESIDENTIAL_AMENITY', PRIVACY: 'PRIVACY', VISUAL_IMPACT: 'VISUAL_IMPACT',
  DRAINAGE: 'DRAINAGE', ECOLOGY: 'ECOLOGY', GROUND_CONTAMINATION: 'GROUND_CONTAMINATION', OTHER: 'OTHER'
};

// Deliberately "not mutually exclusive" (per the governing brief) — one
// requirement item can carry several of these tags at once (e.g. a
// condition that is BOTH a PRE_COMMENCEMENT_REQUIREMENT and a
// DESIGN_CONTROLLING_REQUIREMENT). `AUTHORITY_REQUIREMENT` here
// deliberately reuses the SAME meaning as Batch 3's own
// `AUTHORITY_REQUIREMENT_PATTERN`/lifecycle — a planning-context requirement
// item is cross-tagged with it, never re-derived by a second engine.
const PLANNING_REQUIREMENT_TYPE = {
  PLANNING_CONDITION: 'PLANNING_CONDITION',
  PLANNING_INFORMATIVE: 'PLANNING_INFORMATIVE',
  AUTHORITY_REQUIREMENT: 'AUTHORITY_REQUIREMENT',
  THIRD_PARTY_STATUTORY_OR_ASSET_OWNER_REQUIREMENT: 'THIRD_PARTY_STATUTORY_OR_ASSET_OWNER_REQUIREMENT',
  PRE_COMMENCEMENT_REQUIREMENT: 'PRE_COMMENCEMENT_REQUIREMENT',
  PRE_OCCUPATION_REQUIREMENT: 'PRE_OCCUPATION_REQUIREMENT',
  DESIGN_CONTROLLING_REQUIREMENT: 'DESIGN_CONTROLLING_REQUIREMENT',
  ROUTINE_MANAGEABLE_REQUIREMENT: 'ROUTINE_MANAGEABLE_REQUIREMENT'
};

const PLANNING_DRAWING_STATUS = {
  ISSUED_FOR_PLANNING: 'ISSUED_FOR_PLANNING',
  APPROVED_FOR_PLANNING: 'APPROVED_FOR_PLANNING',
  SUPERSEDED_PLANNING_REVISION: 'SUPERSEDED_PLANNING_REVISION',
  PROPOSED_NOT_APPROVED: 'PROPOSED_NOT_APPROVED',
  UNKNOWN_DRAWING_STATUS: 'UNKNOWN_DRAWING_STATUS'
};

// -----------------------------------------------------------------------
// Planning document sub-classification. Same transparent keyword-scoring
// style as classifyDocumentType()/classifyPackages() — every match
// inspectable, a weak/tied signal never dressed up as certainty. Only
// consulted (and only ever returns a non-null type) when the document is
// already planning-relevant per Batch 1/2A (documentType ===
// 'planning_document' OR package includes PLANNING) OR the content itself
// clearly matches a planning-specific pattern below — a document with
// neither signal correctly gets `type: null` (genuinely not planning
// evidence), never forced into OTHER_PLANNING_EVIDENCE.
// -----------------------------------------------------------------------

const PLANNING_DOCUMENT_TYPE_KEYWORDS = [
  { type: PLANNING_DOCUMENT_TYPE.PLANNING_APPLICATION_FORM, terms: ['application for planning permission', 'planning application form', 'householder application', 'full planning application'] },
  { type: PLANNING_DOCUMENT_TYPE.DESIGN_AND_ACCESS_STATEMENT, terms: ['design and access statement'] },
  { type: PLANNING_DOCUMENT_TYPE.PLANNING_STATEMENT, terms: ['planning statement', 'supporting planning statement'] },
  { type: PLANNING_DOCUMENT_TYPE.SITE_LOCATION_PLAN, terms: ['site location plan', 'location plan'] },
  { type: PLANNING_DOCUMENT_TYPE.BLOCK_PLAN, terms: ['block plan'] },
  { type: PLANNING_DOCUMENT_TYPE.PROPOSED_PLANNING_DRAWING, terms: ['proposed site plan', 'proposed elevations', 'proposed floor plan', 'proposed plan and elevations', 'issued for planning'] },
  { type: PLANNING_DOCUMENT_TYPE.EXISTING_DRAWING, terms: ['existing site plan', 'existing elevations', 'existing floor plan'] },
  { type: PLANNING_DOCUMENT_TYPE.PLANNING_ACKNOWLEDGEMENT, terms: ['application has been validated', 'acknowledgement of your planning application', 'your application has been registered'] },
  { type: PLANNING_DOCUMENT_TYPE.CONSULTEE_RESPONSE, terms: ['consultee comments', 'consultation response', 'we have no observations', 'no objection to the proposal', 'in response to the consultation'] },
  { type: PLANNING_DOCUMENT_TYPE.PUBLIC_OBJECTION, terms: ['letter of objection', 'i object to this application', 'as a local resident', 'object to the proposed development'] },
  { type: PLANNING_DOCUMENT_TYPE.COMMUNITY_COUNCIL_RESPONSE, terms: ['parish council', 'community council', 'town council comments'] },
  { type: PLANNING_DOCUMENT_TYPE.PLANNING_OFFICER_CORRESPONDENCE, terms: ['case officer', 'planning officer', 'further to our telephone conversation'] },
  { type: PLANNING_DOCUMENT_TYPE.APPROVED_DRAWING_SCHEDULE, terms: ['approved plans schedule', 'schedule of approved drawings', 'approved drawing schedule', 'plans approved'] },
  { type: PLANNING_DOCUMENT_TYPE.PLANNING_CONDITION_INFORMATION, terms: ['condition discharge', 'discharge of condition', 'details submitted pursuant to condition'] },
  { type: PLANNING_DOCUMENT_TYPE.VARIATION_APPLICATION, terms: ['application to vary condition', 'section 73 application', 'variation of condition'] },
  { type: PLANNING_DOCUMENT_TYPE.VARIATION_DECISION, terms: ['decision to vary condition', 'variation approved', 'grants permission to vary'] },
  { type: PLANNING_DOCUMENT_TYPE.NON_MATERIAL_AMENDMENT, terms: ['non-material amendment', 'application for non material amendment'] },
  // Decision notice checked last among the "document identity" phrases —
  // deliberately narrow, direct-statement wording only (never inferred from
  // a form/acknowledgement/statement/consultee support — see the governing
  // safeguard above).
  { type: PLANNING_DOCUMENT_TYPE.PLANNING_DECISION_NOTICE, terms: ['decision notice', 'grant of planning permission', 'town and country planning act', 'planning permission is granted', 'refuses planning permission', 'notice of decision'] }
];

function classifyPlanningDocumentType(text, filename, documentType, packages) {
  const lower = (text || '').toLowerCase();
  const isPlanningRelevant = documentType === 'planning_document' || (packages || []).some(p => p.package === PACKAGE.PLANNING);
  const scores = PLANNING_DOCUMENT_TYPE_KEYWORDS.map(entry => {
    const matched = entry.terms.filter(t => lower.indexOf(t) !== -1);
    return { type: entry.type, score: matched.length, matched };
  }).filter(s => s.score > 0);
  if (scores.length) {
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    return { type: top.type, confidence: top.score >= 2 ? 'high' : 'medium', note: `Classified as ${top.type} on keyword match: ${top.matched.join(', ')}.` };
  }
  if (!isPlanningRelevant) return { type: null, confidence: null, note: 'Not planning-relevant — no planning document sub-type classified.' };
  return { type: PLANNING_DOCUMENT_TYPE.OTHER_PLANNING_EVIDENCE, confidence: 'low', note: 'Document is planning-relevant (Batch 1 document type / Batch 2A package) but no specific planning document sub-type keyword matched.' };
}

// A drawing explicitly marked "issued for planning ... not for construction"
// must never be read as construction-authority evidence — recorded here as
// an explicit, inspectable status rather than left to be inferred
// elsewhere. Only ever computed for a drawing-like planning document type.
function classifyPlanningDrawingStatus(text, planningDocumentType) {
  const drawingTypes = [PLANNING_DOCUMENT_TYPE.PROPOSED_PLANNING_DRAWING, PLANNING_DOCUMENT_TYPE.EXISTING_DRAWING, PLANNING_DOCUMENT_TYPE.SITE_LOCATION_PLAN, PLANNING_DOCUMENT_TYPE.BLOCK_PLAN];
  if (!drawingTypes.includes(planningDocumentType)) return null;
  const lower = (text || '').toLowerCase();
  if (/not for construction/.test(lower)) return PLANNING_DRAWING_STATUS.ISSUED_FOR_PLANNING;
  if (/issued for planning/.test(lower)) return PLANNING_DRAWING_STATUS.ISSUED_FOR_PLANNING;
  if (/\bproposed\b/.test(lower)) return PLANNING_DRAWING_STATUS.PROPOSED_NOT_APPROVED;
  return PLANNING_DRAWING_STATUS.UNKNOWN_DRAWING_STATUS;
}

// -----------------------------------------------------------------------
// Consultee response meaning. Multi-label (a response can genuinely be both
// MANAGEABLE_REQUIREMENT and CONDITION_RECOMMENDED), ordered so the
// strongest/most consequential signal (MATERIAL_OBJECTION) is checked
// first and a bare "no observations"/"no objection" is never conflated
// with the weaker-but-distinct SUPPORT, and none of them are ever read as
// planning approval — that distinction is enforced by construction: this
// function has no path that returns anything resembling an authority
// decision. The source consultee/body is preserved separately (Batch 2B's
// own party/role-detection style, reused here for a planning-specific
// vocabulary) — never collapsed into "a comment".
// -----------------------------------------------------------------------

const CONSULTEE_BODY_TERMS = [
  { body: 'Highways', terms: ['highway authority', 'highways development control', 'the highways officer'] },
  { body: 'Ecology', terms: ['ecology officer', 'ecological consultant', 'the ecologist'] },
  { body: 'Environmental Health', terms: ['environmental health officer', 'environmental health team'] },
  { body: 'Drainage / Lead Local Flood Authority', terms: ['lead local flood authority', 'drainage engineer', 'sustainable drainage'] },
  { body: 'Fire Authority', terms: ['fire and rescue service', 'fire authority'] },
  { body: 'Contamination / Environmental Health', terms: ['contaminated land officer'] }
];

function detectConsulteeBody(text) {
  const lower = (text || '').toLowerCase();
  for (const entry of CONSULTEE_BODY_TERMS) { if (entry.terms.some(t => lower.indexOf(t) !== -1)) return entry.body; }
  return null;
}

const CONSULTEE_RESPONSE_RULES = [
  { meaning: CONSULTEE_RESPONSE_MEANING.MATERIAL_OBJECTION, terms: ['object to the proposal', 'recommend refusal', 'recommends refusal', 'unacceptable in its current form'] },
  { meaning: CONSULTEE_RESPONSE_MEANING.FURTHER_INFORMATION_REQUIRED, terms: ['further information is required', 'requires further information', 'request further information'] },
  { meaning: CONSULTEE_RESPONSE_MEANING.CONDITION_RECOMMENDED, terms: ['recommend a condition', 'recommends that a condition', 'subject to a condition', 'condition is recommended'] },
  { meaning: CONSULTEE_RESPONSE_MEANING.NO_OBSERVATIONS, terms: ['no observations', 'nothing to add'] },
  { meaning: CONSULTEE_RESPONSE_MEANING.NO_OBJECTION, terms: ['no objection to the proposal', 'no objections'] },
  { meaning: CONSULTEE_RESPONSE_MEANING.SUPPORT, terms: ['supports the application', 'support the proposal', 'welcomes the application'] },
  { meaning: CONSULTEE_RESPONSE_MEANING.INFORMATIVE_ONLY, terms: ['for information only', 'noted for information'] }
];

// A "manageable requirement" (bird/nest provision, cycle parking, EV
// charging etc.) is a SEPARATE signal from CONDITION_RECOMMENDED — both may
// legitimately apply to the same response (see governing brief scenario C)
// — never a reason to escalate toward MATERIAL_OBJECTION/refusal risk.
const MANAGEABLE_REQUIREMENT_TERMS = ['bird box', 'nest box', 'nesting season', 'cycle parking', 'ecological enhancement', 'landscaping scheme', 'lighting scheme'];

function classifyConsulteeResponse(text) {
  const lower = (text || '').toLowerCase();
  const meanings = [];
  CONSULTEE_RESPONSE_RULES.forEach(rule => { if (rule.terms.some(t => lower.indexOf(t) !== -1)) meanings.push(rule.meaning); });
  if (MANAGEABLE_REQUIREMENT_TERMS.some(t => lower.indexOf(t) !== -1)) meanings.push(CONSULTEE_RESPONSE_MEANING.MANAGEABLE_REQUIREMENT);
  const uniqueMeanings = Array.from(new Set(meanings));
  return {
    meanings: uniqueMeanings.length ? uniqueMeanings : [CONSULTEE_RESPONSE_MEANING.UNKNOWN],
    consultee_body: detectConsulteeBody(text),
    note: uniqueMeanings.length ? `Classified as ${uniqueMeanings.join(', ')} from the response's own wording.` : 'No recognised consultee-response wording found — UNKNOWN, not guessed.'
  };
}

// -----------------------------------------------------------------------
// Public / community objections — recorded SEPARATELY from technical/
// statutory consultee responses (never merged, never weighted, never
// judged valid/invalid here — that is explicitly Planning Batch 2's job).
// -----------------------------------------------------------------------

const OBJECTION_SUBJECT_TERMS = [
  { subject: OBJECTION_SUBJECT.ACCESS, terms: ['access arrangements', 'vehicle access', 'site access'] },
  { subject: OBJECTION_SUBJECT.TRAFFIC, terms: ['increase in traffic', 'traffic congestion', 'highway safety'] },
  { subject: OBJECTION_SUBJECT.NOISE, terms: ['noise nuisance', 'noise from the site', 'noise disturbance'] },
  { subject: OBJECTION_SUBJECT.LIGHTING, terms: ['light pollution', 'external lighting', 'floodlighting'] },
  { subject: OBJECTION_SUBJECT.RESIDENTIAL_AMENITY, terms: ['residential amenity', 'amenity of neighbouring'] },
  { subject: OBJECTION_SUBJECT.PRIVACY, terms: ['loss of privacy', 'overlooking'] },
  { subject: OBJECTION_SUBJECT.VISUAL_IMPACT, terms: ['visual impact', 'visually intrusive', 'out of keeping'] },
  { subject: OBJECTION_SUBJECT.DRAINAGE, terms: ['surface water flooding', 'drainage capacity'] },
  { subject: OBJECTION_SUBJECT.ECOLOGY, terms: ['loss of habitat', 'protected species', 'wildlife'] },
  { subject: OBJECTION_SUBJECT.GROUND_CONTAMINATION, terms: ['land contamination', 'contaminated ground'] }
];

function classifyObjectionSubjects(text) {
  const lower = (text || '').toLowerCase();
  const subjects = [];
  OBJECTION_SUBJECT_TERMS.forEach(entry => { if (entry.terms.some(t => lower.indexOf(t) !== -1)) subjects.push(entry.subject); });
  return subjects.length ? Array.from(new Set(subjects)) : [OBJECTION_SUBJECT.OTHER];
}

// -----------------------------------------------------------------------
// Conditions / informatives / third-party requirements. A genuine decision
// notice structures these as separate numbered sections — this function
// reads that STRUCTURE rather than guessing from isolated keywords, so a
// requirement is only ever tagged PLANNING_CONDITION when it genuinely came
// from a "Condition N" item, and PLANNING_INFORMATIVE only from an
// "Informative N" item (per the governing brief: "a requirement contained
// in a decision notice is not automatically a planning condition — read the
// structure/context"). A third-party/statutory requirement mentioned
// OUTSIDE either section (e.g. general correspondence) is tagged with ONLY
// its substantive type — never silently upgraded to PLANNING_CONDITION
// merely because it appears in a planning-related document (governing
// brief scenario H).
// -----------------------------------------------------------------------

const CONDITION_ITEM_PATTERN = /condition\s+(\d+)\s*:?\s*([^\n]+(?:\n(?!condition\s+\d+\b|informatives?\b)[^\n]+)*)/gi;
const INFORMATIVE_ITEM_PATTERN = /informative\s+(\d+)\s*:?\s*([^\n]+(?:\n(?!condition\s+\d+\b|informatives?\b)[^\n]+)*)/gi;

// Sub-tags — deliberately NOT mutually exclusive (see PLANNING_REQUIREMENT_TYPE
// above). `authority` reuses Batch 3's OWN AUTHORITY_REQUIREMENT_PATTERN
// directly (tested against the item's own text) rather than a second
// pattern with the same meaning.
function classifyRequirementSubTags(itemText) {
  const lower = itemText.toLowerCase();
  const tags = [];
  if (/prior to (?:the )?commencement|no development shall commence|before .*development .*commences/.test(lower)) tags.push(PLANNING_REQUIREMENT_TYPE.PRE_COMMENCEMENT_REQUIREMENT);
  if (/prior to (?:the )?occupation|before .*(?:building|unit|premises) .*occupied/.test(lower)) tags.push(PLANNING_REQUIREMENT_TYPE.PRE_OCCUPATION_REQUIREMENT);
  if (/external materials|samples of materials|details of .*(?:submitted|approved)|hard and soft landscaping/.test(lower)) tags.push(PLANNING_REQUIREMENT_TYPE.DESIGN_CONTROLLING_REQUIREMENT);
  if (/network rail|statutory undertaker|asset protection|national grid|highways england|(?:^|[^a-z])ofgem/.test(lower)) tags.push(PLANNING_REQUIREMENT_TYPE.THIRD_PARTY_STATUTORY_OR_ASSET_OWNER_REQUIREMENT);
  if (/cycle parking|electric vehicle|ev charging|bird box|nest box|noise mitigation scheme/.test(lower)) tags.push(PLANNING_REQUIREMENT_TYPE.ROUTINE_MANAGEABLE_REQUIREMENT);
  const reReq = new RegExp(AUTHORITY_REQUIREMENT_PATTERN.source, 'gi');
  if (reReq.test(itemText)) tags.push(PLANNING_REQUIREMENT_TYPE.AUTHORITY_REQUIREMENT);
  return tags;
}

// Planning ≠ Building Control (governing brief §6): a requirement item that
// mentions Building Regulations/Building Control is flagged as a SEPARATE
// regulatory note — never itself creating a Building Control action in
// this batch (none of this is wired into buildProjectAuthorityRequirements()),
// and never counted as evidence the planning permission is somehow
// conditional on it.
const BUILDING_CONTROL_SEPARATE_NOTE_PATTERN = /building regulations approval is required separately|separate building regulations|building control approval is required separately/i;

function extractPlanningRequirements(text, sourceFile) {
  const items = [];
  let m;
  const condRe = new RegExp(CONDITION_ITEM_PATTERN.source, 'gi');
  while ((m = condRe.exec(text)) !== null) {
    const itemText = m[2].trim();
    items.push({
      requirement_id: 'planreq-' + slugify(sourceFile + '-condition-' + m[1]),
      source_file: sourceFile, item_number: m[1], requirement_text: itemText.slice(0, 300),
      types: Array.from(new Set([PLANNING_REQUIREMENT_TYPE.PLANNING_CONDITION].concat(classifyRequirementSubTags(itemText)))),
      building_control_separate_note: BUILDING_CONTROL_SEPARATE_NOTE_PATTERN.test(itemText)
    });
    if (condRe.lastIndex === m.index) condRe.lastIndex++;
  }
  const infRe = new RegExp(INFORMATIVE_ITEM_PATTERN.source, 'gi');
  while ((m = infRe.exec(text)) !== null) {
    const itemText = m[2].trim();
    items.push({
      requirement_id: 'planreq-' + slugify(sourceFile + '-informative-' + m[1]),
      source_file: sourceFile, item_number: m[1], requirement_text: itemText.slice(0, 300),
      types: Array.from(new Set([PLANNING_REQUIREMENT_TYPE.PLANNING_INFORMATIVE].concat(classifyRequirementSubTags(itemText)))),
      building_control_separate_note: BUILDING_CONTROL_SEPARATE_NOTE_PATTERN.test(itemText)
    });
    if (infRe.lastIndex === m.index) infRe.lastIndex++;
  }
  // Third-party/statutory requirements mentioned OUTSIDE any numbered
  // Condition/Informative item (e.g. plain correspondence) — substantive
  // tag(s) only, deliberately NEVER PLANNING_CONDITION/PLANNING_INFORMATIVE
  // (governing brief scenario H: "must not be silently converted to a
  // planning condition unless actually conditioned").
  const alreadyCovered = items.some(it => /network rail|statutory undertaker|asset protection/i.test(it.requirement_text));
  if (!alreadyCovered && /network rail|statutory undertaker|asset protection/i.test(text)) {
    const idx = text.search(/network rail|statutory undertaker|asset protection/i);
    const sentence = sentenceAround(text, idx, 20);
    items.push({
      requirement_id: 'planreq-' + slugify(sourceFile + '-thirdparty-standalone'),
      source_file: sourceFile, item_number: null, requirement_text: sentence.slice(0, 300),
      types: [PLANNING_REQUIREMENT_TYPE.THIRD_PARTY_STATUTORY_OR_ASSET_OWNER_REQUIREMENT],
      building_control_separate_note: false
    });
  }
  return items;
}

// -----------------------------------------------------------------------
// Approved drawing baseline. "The LATEST APPLICABLE AUTHORITY-APPROVED
// revision controls the relevant planning baseline — not the newest file
// uploaded" (governing brief §7). Older revisions are always preserved as
// historical evidence, never deleted/overwritten (see
// buildPlanningDrawingBaseline() below).
// -----------------------------------------------------------------------

const DRAWING_REF_PATTERN = /drawing\s+(?:no\.?\s*)?([A-Z0-9][A-Z0-9\-\/]{2,20})\s*rev(?:ision)?\.?\s*([A-Z0-9]{1,3})\s*[-–—]\s*([A-Za-z][A-Za-z0-9 \/]{3,60})/gi;
const DECISION_DATE_PATTERN = /date of decision\s*:?\s*(\d{1,2}\s+[a-z]+\s+\d{4})/i;

function extractDrawingReferences(text) {
  const refs = [];
  const re = new RegExp(DRAWING_REF_PATTERN.source, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.push({ drawing_number: m[1], revision: m[2], drawing_title: m[3].trim() });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return refs;
}

// Document types capable of genuinely APPROVING a drawing — deliberately
// narrow (a bare drawing file, application form, statement or consultee
// response can never do this, regardless of what it claims — governing
// brief §11/§12).
const DRAWING_APPROVING_DOCUMENT_TYPES = [PLANNING_DOCUMENT_TYPE.PLANNING_DECISION_NOTICE, PLANNING_DOCUMENT_TYPE.VARIATION_DECISION, PLANNING_DOCUMENT_TYPE.APPROVED_DRAWING_SCHEDULE];

// Builds/rebuilds p.planningDrawings — one record per drawing_number+revision
// EVER seen approved by a genuine decision, across every decision document
// on the project (original permission AND any later variation). Never
// deletes an earlier revision's record; recomputes which one
// `is_current_baseline` per drawing FAMILY (same drawing_number) using the
// decision's own extractable date where available, else upload order (the
// same chronology-proxy precedent Batch 3 already established for
// discrepancies) — never simply "the newest file uploaded" on its own.
function buildPlanningDrawingBaseline(p) {
  const uploadOrder = (p.evidence || []).map(e => e.name);
  const approvals = []; // { drawing_number, revision, drawing_title, decision_source_file, decision_date, decision_reference }
  (p.evidence || []).forEach(e => {
    if (!e.extractedText) return;
    if (!DRAWING_APPROVING_DOCUMENT_TYPES.includes(e.planningDocumentType)) return;
    // Governing safeguard: an incomplete/unsigned/template decision
    // document (Batch 1 integrity) can never approve a drawing baseline,
    // regardless of filename or wording — reused directly, no second check.
    if (Array.isArray(e.documentIntegrityFlags) && e.documentIntegrityFlags.length) return;
    const isGenuineDecision = (e.evidenceFunctions || []).some(f => f.function === 'AUTHORITY_DECISION');
    if (!isGenuineDecision) return;
    const dateMatch = e.extractedText.match(DECISION_DATE_PATTERN);
    extractDrawingReferences(e.extractedText).forEach(ref => {
      approvals.push({ ...ref, decision_source_file: e.name, decision_date: dateMatch ? dateMatch[1] : null });
    });
  });
  const byFamily = {};
  approvals.forEach(a => { (byFamily[a.drawing_number] = byFamily[a.drawing_number] || []).push(a); });
  const drawings = [];
  Object.keys(byFamily).forEach(family => {
    const revs = byFamily[family];
    // Latest = by extractable decision date if EVERY entry in this family has
    // one (safe, unambiguous comparison); otherwise by upload order of the
    // approving decision document (never by revision-letter alone, which
    // would silently assume a linear A<B<C sequence not actually evidenced).
    const allDated = revs.every(r => r.decision_date);
    let latest;
    if (allDated) {
      latest = revs.reduce((a, b) => (new Date(a.decision_date) >= new Date(b.decision_date) ? a : b));
    } else {
      latest = revs.reduce((a, b) => (uploadOrder.indexOf(a.decision_source_file) >= uploadOrder.indexOf(b.decision_source_file) ? a : b));
    }
    revs.forEach(r => {
      const isCurrent = r === latest;
      drawings.push({
        drawing_id: 'dwg-' + slugify(family + '-' + r.revision),
        project_id: p.id,
        drawing_number: r.drawing_number,
        revision: r.revision,
        drawing_title: r.drawing_title,
        decision_source_file: r.decision_source_file,
        decision_date: r.decision_date,
        status: isCurrent ? PLANNING_DRAWING_STATUS.APPROVED_FOR_PLANNING : PLANNING_DRAWING_STATUS.SUPERSEDED_PLANNING_REVISION,
        is_current_baseline: isCurrent,
        created_at: Date.now(),
        notes: isCurrent ? '' : 'Superseded by a later approved/varied revision of the same drawing — retained as historical evidence, never deleted.'
      });
    });
  });
  p.planningDrawings = drawings;
  return drawings;
}

// -----------------------------------------------------------------------
// Project-level consultee responses, public/community objections, and
// planning requirements — one pass over every planning-classified document.
// -----------------------------------------------------------------------

function buildPlanningConsulteeResponses(p) {
  const responses = [];
  (p.evidence || []).forEach(e => {
    if (!e.extractedText) return;
    if (e.planningDocumentType !== PLANNING_DOCUMENT_TYPE.CONSULTEE_RESPONSE) return;
    const cls = classifyConsulteeResponse(e.extractedText);
    responses.push({
      response_id: 'consultee-' + slugify(e.name),
      project_id: p.id,
      source_file: e.name,
      consultee_body: cls.consultee_body,
      meanings: cls.meanings,
      note: cls.note,
      // Planning Batch 2 (2026-08-26): reuses the SAME generic
      // classifyObjectionSubjects() classifier Batch 1 already built for
      // public/community objections — applied here to a consultee response's
      // own text purely so a technical consultee's response can be
      // correlated, by subject, against a public/community objection's own
      // subjects (see classifyObjectionWeight() below). Not a second
      // classifier, not shown to the customer, and never itself a source of
      // "material objection" standing — that remains driven only by
      // `meanings` above.
      subjects: classifyObjectionSubjects(e.extractedText),
      created_at: Date.now()
    });
  });
  p.planningConsulteeResponses = responses;
  return responses;
}

// -----------------------------------------------------------------------
// Planning Batch 2 (2026-08-26): sensitive-receptor identification.
// "Do not assume residential/community risk for every industrial project" —
// this only ever records a receptor where the evidence itself actually
// mentions one (or explicitly states an established industrial/commercial
// estate with none), never inferred from the mere existence of a planning
// application. Assesses BOTH a receptor near the proposed BUILDING and a
// receptor along an operational ROUTE/ACTIVITY (e.g. an HGV access route
// passing residential properties) — the governing brief's own distinction.
// -----------------------------------------------------------------------

const SENSITIVE_RECEPTOR_TYPE = {
  RESIDENTIAL_PROPERTY: 'RESIDENTIAL_PROPERTY',
  SCHOOL: 'SCHOOL',
  CARE_USE: 'CARE_USE',
  PUBLIC_RIGHT_OF_WAY: 'PUBLIC_RIGHT_OF_WAY',
  SENSITIVE_OPEN_SPACE: 'SENSITIVE_OPEN_SPACE',
  OTHER_SENSITIVE_USE: 'OTHER_SENSITIVE_USE'
};
const RECEPTOR_RELATIONSHIP = { BUILDING_TO_RECEPTOR: 'BUILDING_TO_RECEPTOR', ROUTE_TO_RECEPTOR: 'ROUTE_TO_RECEPTOR' };

// Which OBJECTION_SUBJECT values a given receptor type can plausibly relate
// to — used only to correlate an objection with a receptor for weighting
// (see classifyObjectionWeight() below), never to invent a receptor.
const RECEPTOR_RELEVANT_SUBJECTS = {
  RESIDENTIAL_PROPERTY: [OBJECTION_SUBJECT.NOISE, OBJECTION_SUBJECT.LIGHTING, OBJECTION_SUBJECT.RESIDENTIAL_AMENITY, OBJECTION_SUBJECT.PRIVACY, OBJECTION_SUBJECT.VISUAL_IMPACT, OBJECTION_SUBJECT.TRAFFIC, OBJECTION_SUBJECT.ACCESS],
  SCHOOL: [OBJECTION_SUBJECT.TRAFFIC, OBJECTION_SUBJECT.ACCESS, OBJECTION_SUBJECT.NOISE],
  CARE_USE: [OBJECTION_SUBJECT.TRAFFIC, OBJECTION_SUBJECT.ACCESS, OBJECTION_SUBJECT.NOISE],
  PUBLIC_RIGHT_OF_WAY: [OBJECTION_SUBJECT.ACCESS, OBJECTION_SUBJECT.TRAFFIC],
  SENSITIVE_OPEN_SPACE: [OBJECTION_SUBJECT.ECOLOGY, OBJECTION_SUBJECT.VISUAL_IMPACT, OBJECTION_SUBJECT.NOISE],
  OTHER_SENSITIVE_USE: [OBJECTION_SUBJECT.OTHER]
};

const SENSITIVE_RECEPTOR_TERMS = [
  { type: SENSITIVE_RECEPTOR_TYPE.RESIDENTIAL_PROPERTY, terms: ['residential propert', 'neighbouring house', 'neighbouring dwelling', 'nearby homes', 'residential dwelling'] },
  { type: SENSITIVE_RECEPTOR_TYPE.SCHOOL, terms: ['school', 'nursery'] },
  { type: SENSITIVE_RECEPTOR_TYPE.CARE_USE, terms: ['care home', 'nursing home'] },
  { type: SENSITIVE_RECEPTOR_TYPE.PUBLIC_RIGHT_OF_WAY, terms: ['public right of way', 'public footpath', 'pedestrian right of way'] },
  { type: SENSITIVE_RECEPTOR_TYPE.SENSITIVE_OPEN_SPACE, terms: ['nature reserve', 'sssi', 'conservation area', 'public park'] }
];
// A receptor mentioned alongside route/operational wording in the SAME
// sentence is tagged ROUTE_TO_RECEPTOR (e.g. "the HGV route passes directly
// by residential properties"); otherwise BUILDING_TO_RECEPTOR (simple
// proximity to the proposed building).
const RECEPTOR_ROUTE_CONTEXT_PATTERN = /\b(hgv route|vehicle access route|delivery route|access road|route passes|traffic route)\b/i;
// Explicit "no receptor" signal — an established industrial/commercial
// estate context genuinely evidenced, not assumed by default.
const NO_SENSITIVE_RECEPTOR_PATTERN = /established industrial estate|existing industrial estate|surrounded by industrial units|no residential propert(?:y|ies) (?:nearby|in the vicinity|identified)|no sensitive receptors? identified|industrial(?:\/|\s+and\s+)commercial estate with no residential/i;

function classifyPlanningSensitiveReceptors(text) {
  const receptors = [];
  SENSITIVE_RECEPTOR_TERMS.forEach(entry => {
    entry.terms.forEach(term => {
      const idx = (text || '').toLowerCase().indexOf(term);
      if (idx === -1) return;
      const sentence = sentenceAround(text, idx, term.length);
      // A receptor term appearing inside its OWN explicit negation ("no
      // residential properties nearby") must never register as a genuine
      // receptor — reuses the same NO_SENSITIVE_RECEPTOR_PATTERN checked at
      // document level below, applied here at sentence level so a single
      // negated mention is skipped without suppressing a genuine receptor
      // mentioned elsewhere in the same document.
      if (NO_SENSITIVE_RECEPTOR_PATTERN.test(sentence)) return;
      receptors.push({
        type: entry.type,
        relationship: RECEPTOR_ROUTE_CONTEXT_PATTERN.test(sentence) ? RECEPTOR_RELATIONSHIP.ROUTE_TO_RECEPTOR : RECEPTOR_RELATIONSHIP.BUILDING_TO_RECEPTOR,
        note: sentence.slice(0, 200)
      });
    });
  });
  return receptors;
}

function buildPlanningSensitiveReceptors(p) {
  const receptors = [];
  let noReceptorEvidenceNoted = false;
  (p.evidence || []).forEach(e => {
    if (!e.extractedText) return;
    if (NO_SENSITIVE_RECEPTOR_PATTERN.test(e.extractedText)) noReceptorEvidenceNoted = true;
    classifyPlanningSensitiveReceptors(e.extractedText).forEach(r => receptors.push({
      receptor_id: 'receptor-' + slugify(e.name + '-' + r.type + '-' + receptors.length),
      project_id: p.id,
      source_file: e.name,
      type: r.type,
      relationship: r.relationship,
      note: r.note
    }));
  });
  p.planningSensitiveReceptors = receptors;
  // Only ever true when the evidence itself explicitly says so — never a
  // default assumption for "no receptors found" (silence is not evidence).
  p.planningNoReceptorEvidenceNoted = noReceptorEvidenceNoted;
  return receptors;
}

// -----------------------------------------------------------------------
// Planning Batch 2 (2026-08-26): objection weighting. Purpose is NOT to
// decide whether an objector is "right" — only how planning-relevant and
// how corroborated the objection currently is, using only evidence Project
// Check actually has. Priority-ordered, strongest signal first.
// -----------------------------------------------------------------------

const OBJECTION_WEIGHT = {
  LOW_RELEVANCE: 'LOW_RELEVANCE',
  RELEVANT_UNCORROBORATED: 'RELEVANT_UNCORROBORATED',
  RELEVANT_NEEDS_REVIEW: 'RELEVANT_NEEDS_REVIEW',
  MATERIALLY_CORROBORATED: 'MATERIALLY_CORROBORATED'
};

function subjectsOverlap(a, b) { return (a || []).some(s => (b || []).includes(s)); }

function classifyObjectionWeight(objection, p) {
  const hasRelevantSubject = (objection.subjects || []).some(s => s !== OBJECTION_SUBJECT.OTHER);
  if (!hasRelevantSubject) {
    return { weight: OBJECTION_WEIGHT.LOW_RELEVANCE, reason: 'No specific planning-relevant subject identified in this objection.' };
  }
  // Strongest signal: an independent technical/statutory consultee has
  // ALSO raised a material objection on an overlapping subject — never the
  // reverse (a consultee NO_OBSERVATIONS/NO_OBJECTION never downgrades a
  // public objection below its own evidence; it simply does not corroborate
  // it either — see governing brief §9).
  const consultees = p.planningConsulteeResponses || [];
  const technicallyCorroborated = consultees.some(c => (c.meanings || []).includes(CONSULTEE_RESPONSE_MEANING.MATERIAL_OBJECTION) && subjectsOverlap(c.subjects, objection.subjects));
  if (technicallyCorroborated) {
    return { weight: OBJECTION_WEIGHT.MATERIALLY_CORROBORATED, reason: 'A technical/statutory consultee has independently raised a material objection on an overlapping subject.' };
  }
  // Next: a sensitive receptor genuinely identified in the evidence, on an
  // overlapping subject — an operational ROUTE relationship (e.g. HGV route
  // past a residential property) and a BUILDING proximity relationship are
  // both treated as relevant-needing-review (elevated above an
  // uncorroborated objection with no receptor at all), per governing brief
  // §8/§F.
  const receptors = p.planningSensitiveReceptors || [];
  const receptorMatch = receptors.some(r => subjectsOverlap(RECEPTOR_RELEVANT_SUBJECTS[r.type] || [], objection.subjects));
  if (receptorMatch) {
    return { weight: OBJECTION_WEIGHT.RELEVANT_NEEDS_REVIEW, reason: 'A sensitive receptor identified in the evidence relates to this objection\'s subject matter.' };
  }
  return { weight: OBJECTION_WEIGHT.RELEVANT_UNCORROBORATED, reason: 'Relevant subject matter, but no corroborating technical evidence or identified sensitive receptor found yet.' };
}

function buildPlanningObjections(p) {
  const objections = [];
  (p.evidence || []).forEach(e => {
    if (!e.extractedText) return;
    let sourceType = null;
    if (e.planningDocumentType === PLANNING_DOCUMENT_TYPE.PUBLIC_OBJECTION) sourceType = OBJECTION_SOURCE_TYPE.PUBLIC;
    if (e.planningDocumentType === PLANNING_DOCUMENT_TYPE.COMMUNITY_COUNCIL_RESPONSE) sourceType = OBJECTION_SOURCE_TYPE.COMMUNITY_COUNCIL;
    if (!sourceType) return; // never classified from a technical/statutory consultee response — kept structurally separate
    objections.push({
      objection_id: 'objection-' + slugify(e.name),
      project_id: p.id,
      source_file: e.name,
      source_type: sourceType,
      subjects: classifyObjectionSubjects(e.extractedText),
      created_at: e.at || Date.now(),
      // Still NOT assessed as valid/invalid (that remains out of scope —
      // "the purpose is not to decide whether an objector is right") —
      // but Planning Batch 2 (2026-08-26) now assesses planning RELEVANCE
      // and CORROBORATION (see classifyObjectionWeight() above), called
      // below once p.planningConsulteeResponses/p.planningSensitiveReceptors
      // are already built for this project.
      notes: 'Recorded as raw provenance only — not assessed for planning validity in this batch. See weight/weight_reason for the Planning Batch 2 relevance/corroboration assessment.'
    });
  });
  // Weighting is computed as a second pass over the SAME array (rather than
  // inline above) purely so every objection on the project is available to
  // classifyObjectionWeight() for cross-referencing — it never needs to
  // reference another still-unbuilt objection, but keeping this as an
  // explicit separate step matches the same "build, then classify" shape
  // used throughout this file (e.g. buildProjectDiscrepancies() over
  // p.evidenceRecords) and keeps the object-construction loop above
  // unchanged/easy to diff against Planning Batch 1.
  objections.forEach(o => { const w = classifyObjectionWeight(o, p); o.weight = w.weight; o.weight_reason = w.reason; });
  p.planningObjections = objections;
  return objections;
}

function buildPlanningRequirements(p) {
  let requirements = [];
  (p.evidence || []).forEach(e => {
    if (!e.extractedText) return;
    if (!DRAWING_APPROVING_DOCUMENT_TYPES.includes(e.planningDocumentType) && e.planningDocumentType !== PLANNING_DOCUMENT_TYPE.PLANNING_CONDITION_INFORMATION) return;
    requirements = requirements.concat(extractPlanningRequirements(e.extractedText, e.name));
  });
  p.planningRequirements = requirements;
  return requirements;
}

// -----------------------------------------------------------------------
// Planning lifecycle derivation. Priority-ordered, most-advanced-state-
// first; each gate requires EXPLICIT, narrow evidence — never an
// application form/acknowledgement/consultee-support/officer-correspondence/
// planning-statement/drawing-title/customer-statement/filename (governing
// brief §1). Planning Batch 1 deliberately did not derive CONSULTATION_
// REVIEW/FAVOURABLE_FORMAL_DECISION_PENDING/PLANNING_ACTIONS_CLOSED.
// Planning Batch 2 (2026-08-26) now cautiously derives the first two (see
// isConsultationSufficientlyProgressed()/isFavourableOutcomeSupported()
// below) — PLANNING_ACTIONS_CLOSED still requires a planning-action-closure
// concept this batch does not build, so it remains undelivered.
// -----------------------------------------------------------------------

// "Consultation is sufficiently progressed to meaningfully assess
// responses" — NOT "literally every possible consultee has responded"
// (explicitly ruled out by the governing brief). Cautious, evidence-only
// heuristic: at least two distinct relevant consultee bodies (or, where a
// body could not be identified, at least two responses) have actually
// responded, AND no document explicitly states a further/outstanding
// response is still awaited. A single response, or explicit "still
// awaited"/"outstanding" wording, keeps consultation at
// CONSULTATION_IN_PROGRESS instead.
const CONSULTATION_OUTSTANDING_PATTERN = /awaiting (?:a )?(?:further |additional )?respons\w*|respons(?:e|es)[^.\n]{0,60}\b(?:remain(?:s)?|are|is)\b[^.\n]{0,20}outstanding|yet to respond|respons(?:e|es)[^.\n]{0,40}\bstill\b[^.\n]{0,20}awaited/i;
function isConsultationSufficientlyProgressed(p) {
  const responses = p.planningConsulteeResponses || [];
  if (!responses.length) return false;
  const outstandingNoted = (p.evidence || []).some(e => e.extractedText && CONSULTATION_OUTSTANDING_PATTERN.test(e.extractedText));
  if (outstandingNoted) return false;
  const distinctBodies = new Set(responses.map(r => r.consultee_body).filter(Boolean));
  return distinctBodies.size >= 2 || responses.length >= 2;
}

// The approved Planning Batch 2 rule (governing brief §5) — every one of
// the seven conditions must hold. Deliberately conjunctive: "three weeks
// have passed", "one consultee said no objection" or "no objections found"
// are each, on their own, exactly the kind of thin signal this function
// must NOT treat as sufficient (none of those alone can make every
// condition below true).
const REFUSAL_RISK_PATTERN = /likely refusal|recommend refusal|recommends refusal|minded to refuse/i;
function isFavourableOutcomeSupported(p) {
  const responses = p.planningConsulteeResponses || [];
  // 1: genuinely valid/submitted and in determination — explicit evidence
  // of at least an application form or a genuine validation/acknowledgement
  // document, never inferred merely from the existence of consultee
  // responses.
  const hasSubmissionEvidence = (p.evidence || []).some(e => e.planningDocumentType === PLANNING_DOCUMENT_TYPE.PLANNING_ACKNOWLEDGEMENT || e.planningDocumentType === PLANNING_DOCUMENT_TYPE.PLANNING_APPLICATION_FORM);
  if (!hasSubmissionEvidence) return { ok: false, reason: 'No evidence yet that the application has been submitted/validated.' };
  // 7: formal permission not yet issued — guaranteed by the call site (only
  // ever evaluated once no genuine decision exists at all — see
  // derivePlanningLifecycleStatus()).
  // 2: consultation has substantially progressed.
  if (!isConsultationSufficientlyProgressed(p)) return { ok: false, reason: 'Consultation has not yet progressed enough to assess.' };
  // 3: every available material consultee response meaning must sit inside
  // the safe/favourable set, with no unresolved MATERIAL_OBJECTION and no
  // FURTHER_INFORMATION_REQUIRED/UNKNOWN left hanging.
  const SAFE_MEANINGS = [CONSULTEE_RESPONSE_MEANING.SUPPORT, CONSULTEE_RESPONSE_MEANING.NO_OBJECTION, CONSULTEE_RESPONSE_MEANING.NO_OBSERVATIONS, CONSULTEE_RESPONSE_MEANING.INFORMATIVE_ONLY, CONSULTEE_RESPONSE_MEANING.MANAGEABLE_REQUIREMENT, CONSULTEE_RESPONSE_MEANING.CONDITION_RECOMMENDED];
  const anyUnsafeMeaning = responses.some(r => (r.meanings || []).some(m => !SAFE_MEANINGS.includes(m)));
  if (anyUnsafeMeaning) return { ok: false, reason: 'At least one consultee response carries a meaning outside the safe/favourable set (e.g. further information required, or unclassified).' };
  // 4: no materially relevant public/community objection corroborated
  // strongly enough to undermine the favourable assessment.
  const materiallyCorroboratedObjection = (p.planningObjections || []).some(o => o.weight === OBJECTION_WEIGHT.MATERIALLY_CORROBORATED);
  if (materiallyCorroboratedObjection) return { ok: false, reason: 'A public/community objection is materially corroborated by technical consultee evidence.' };
  // 5: no authority evidence presently indicates likely refusal.
  const refusalRiskNoted = (p.evidence || []).some(e => e.extractedText && REFUSAL_RISK_PATTERN.test(e.extractedText));
  if (refusalRiskNoted) return { ok: false, reason: 'Evidence indicates a likely-refusal signal.' };
  // 6: no unresolved MATERIAL_CONFLICT discrepancy materially undermines
  // the PLANNING PROPOSAL ITSELF (reuses Evidence Intelligence Batch 3's
  // own discrepancy model directly). Planning Batch 3 (2026-08-26)
  // deliberately narrowed this to EXCLUDE a discrepancy on a pure building-
  // dimension subject (APPROVED_DRAWING_DIMENSION_SUBJECTS, defined below)
  // — a design-stability question is a genuine, separately-tracked
  // PROGRESSION-ADVICE concern (see buildProjectPlanningProgression()'s own
  // BLOCKS_FINAL_DESIGN/BLOCKS_PROCUREMENT_OR_ORDER gates below), not
  // necessarily evidence that the authority itself is likely to view the
  // planning application unfavourably — keeping PLANNING STATUS and
  // PROGRESSION ADVICE genuinely separate (governing brief §16), rather
  // than conflating "the design may still need to change" with "planning
  // permission may be refused". Any OTHER unresolved MATERIAL_CONFLICT
  // (e.g. a genuinely planning-relevant fact in dispute) still blocks
  // favourable exactly as before this refinement.
  const unresolvedMaterialConflict = (p.discrepancies || []).some(d => d.discrepancy_type === DISCREPANCY_TYPE.MATERIAL_CONFLICT && !d.resolved_at && !APPROVED_DRAWING_DIMENSION_SUBJECTS.includes(d.subject));
  if (unresolvedMaterialConflict) return { ok: false, reason: 'An unresolved material design/evidence conflict exists.' };
  return { ok: true, reason: 'Consultation has substantially progressed; every available material consultee response sits within the safe/favourable set; no materially-corroborated objection, refusal signal, or unresolved material conflict was found.' };
}

function derivePlanningLifecycleStatus(p) {
  const evidence = p.evidence || [];
  const hasType = (t) => evidence.some(e => e.planningDocumentType === t);
  const genuineDecisionsOfType = (t) => evidence.filter(e => e.planningDocumentType === t && (e.evidenceFunctions || []).some(f => f.function === 'AUTHORITY_DECISION') && !(Array.isArray(e.documentIntegrityFlags) && e.documentIntegrityFlags.length));

  const variationDecisions = genuineDecisionsOfType(PLANNING_DOCUMENT_TYPE.VARIATION_DECISION);
  const originalDecisions = genuineDecisionsOfType(PLANNING_DOCUMENT_TYPE.PLANNING_DECISION_NOTICE);

  if (variationDecisions.length) {
    return { status: PLANNING_LIFECYCLE_STATUS.APPROVED_BASELINE_VARIED_OR_AMENDED, evidence_files: variationDecisions.map(e => e.name), reason: 'A genuine authority variation decision exists — the approved baseline has been varied/amended, with the original permission preserved.' };
  }
  if (originalDecisions.length) {
    const preCommencementOutstanding = (p.planningRequirements || []).some(r => r.types.includes(PLANNING_REQUIREMENT_TYPE.PRE_COMMENCEMENT_REQUIREMENT)) && !hasType(PLANNING_DOCUMENT_TYPE.PLANNING_CONDITION_INFORMATION);
    if (preCommencementOutstanding) {
      return { status: PLANNING_LIFECYCLE_STATUS.APPROVED_PRE_START_ACTIONS_OUTSTANDING, evidence_files: originalDecisions.map(e => e.name), reason: 'Approved with conditions, including at least one pre-commencement requirement, with no condition-discharge evidence yet identified.' };
    }
    return { status: PLANNING_LIFECYCLE_STATUS.APPROVED_WITH_CONDITIONS, evidence_files: originalDecisions.map(e => e.name), reason: 'A genuine authority decision notice grants planning permission (subject to conditions where recorded).' };
  }
  // No genuine decision yet — every state below is provisional/in-progress
  // only, never APPROVED.
  const materialObjectionConsultee = (p.planningConsulteeResponses || []).some(r => (r.meanings || []).includes(CONSULTEE_RESPONSE_MEANING.MATERIAL_OBJECTION));
  const materiallyCorroboratedObjection = (p.planningObjections || []).some(o => o.weight === OBJECTION_WEIGHT.MATERIALLY_CORROBORATED);
  // Planning Batch 2: UNCERTAIN_MATERIAL_ISSUE_OUTSTANDING now also covers a
  // public/community objection that has itself become materially
  // corroborated by independent technical evidence (governing brief §11) —
  // never a bare/uncorroborated public objection on its own (§9).
  if (materialObjectionConsultee || materiallyCorroboratedObjection) {
    return { status: PLANNING_LIFECYCLE_STATUS.UNCERTAIN_MATERIAL_ISSUE_OUTSTANDING, evidence_files: [], reason: materialObjectionConsultee ? 'A technical/statutory consultee has raised a material objection — genuinely uncertain, not a refusal, not resolved.' : 'A public/community objection has become materially corroborated by independent technical evidence — genuinely uncertain, not resolved.' };
  }
  // Planning Batch 2: FAVOURABLE_FORMAL_DECISION_PENDING — only where every
  // one of the governing brief's 7 conditions holds (see
  // isFavourableOutcomeSupported() above); never derived from a thin signal.
  const favourable = isFavourableOutcomeSupported(p);
  if (favourable.ok) {
    return { status: PLANNING_LIFECYCLE_STATUS.FAVOURABLE_FORMAL_DECISION_PENDING, evidence_files: [], reason: favourable.reason };
  }
  // Planning Batch 2: CONSULTATION_REVIEW — consultation has progressed
  // enough to assess, but not (yet) cleanly enough for a favourable signal
  // (e.g. a FURTHER_INFORMATION_REQUIRED/UNKNOWN response, or an unresolved
  // material conflict) and no material objection was found either.
  if (isConsultationSufficientlyProgressed(p)) {
    return { status: PLANNING_LIFECYCLE_STATUS.CONSULTATION_REVIEW, evidence_files: [], reason: 'Consultation responses received so far are being assessed: ' + favourable.reason };
  }
  if ((p.planningConsulteeResponses || []).length) {
    return { status: PLANNING_LIFECYCLE_STATUS.CONSULTATION_IN_PROGRESS, evidence_files: [], reason: 'Consultee response(s) exist, but consultation has not yet progressed enough to meaningfully assess (too few relevant consultees have responded so far, or a document indicates a response remains outstanding).' };
  }
  if (hasType(PLANNING_DOCUMENT_TYPE.PLANNING_ACKNOWLEDGEMENT)) {
    return { status: PLANNING_LIFECYCLE_STATUS.VALIDATED, evidence_files: [], reason: 'A genuine validation/acknowledgement document exists.' };
  }
  if (hasType(PLANNING_DOCUMENT_TYPE.PLANNING_APPLICATION_FORM)) {
    return { status: PLANNING_LIFECYCLE_STATUS.SUBMITTED, evidence_files: [], reason: 'An application form exists, with no validation evidence yet.' };
  }
  if ([PLANNING_DOCUMENT_TYPE.PLANNING_STATEMENT, PLANNING_DOCUMENT_TYPE.DESIGN_AND_ACCESS_STATEMENT, PLANNING_DOCUMENT_TYPE.SITE_LOCATION_PLAN, PLANNING_DOCUMENT_TYPE.BLOCK_PLAN, PLANNING_DOCUMENT_TYPE.PROPOSED_PLANNING_DRAWING].some(hasType)) {
    return { status: PLANNING_LIFECYCLE_STATUS.PREPARATION, evidence_files: [], reason: 'Preparatory planning documents exist, with no submission evidence yet.' };
  }
  return { status: PLANNING_LIFECYCLE_STATUS.NOT_ASSESSED, evidence_files: [], reason: 'No planning evidence identified on this project yet.' };
}

// -----------------------------------------------------------------------
// Planning Batch 2 (2026-08-26): portal architecture PLACEHOLDERS ONLY.
// Planning Batch 5 owns actual council-portal retrieval — nothing here
// scrapes, automates a council website, hard-codes a council, or fetches
// any public document. This only (a) extracts an application
// reference/local planning authority name where a document ALREADY plainly
// states one (reusing the same generic-phrasing FACT_RULES-style approach
// as everywhere else in this file), and (b) reserves a neutral,
// always-null `portal_reference` field so a future Planning Batch 5 result
// has somewhere safe to attach without a schema change.
// -----------------------------------------------------------------------
const PLANNING_APPLICATION_REFERENCE_PATTERN = /application (?:reference|no\.?|number)\s*:?\s*([A-Z0-9][A-Z0-9\/\-]{4,20})/i;
const LOCAL_PLANNING_AUTHORITY_PATTERN = /local planning authority\s*:?\s*([^\n]{3,80})/i;
function buildPlanningPortalPlaceholder(p) {
  let applicationReference = null, authorityName = null;
  (p.evidence || []).forEach(e => {
    if (!e.extractedText) return;
    if (!applicationReference) { const m = e.extractedText.match(PLANNING_APPLICATION_REFERENCE_PATTERN); if (m) applicationReference = m[1].trim(); }
    if (!authorityName) { const m = e.extractedText.match(LOCAL_PLANNING_AUTHORITY_PATTERN); if (m) authorityName = m[1].trim().replace(/[.,;]+$/, ''); }
  });
  p.planningPortalReference = {
    application_reference: applicationReference,
    authority_name: authorityName,
    // Always null in every Planning batch up to and including this one —
    // reserved for Planning Batch 5's future portal-retrieval result only.
    portal_reference: null,
    evidence_source: 'CUSTOMER_UPLOADED_DOCUMENTS'
  };
  return p.planningPortalReference;
}

// Orchestration — builds every Planning Intelligence structure for one
// project. Called from buildProjectEvidenceLedger() (see the call site
// above) AFTER every document's planningDocumentType/planningDrawingStatus
// has already been classified in that function's own per-document loop,
// and after p.authorityRequirements (Batch 3) is available. Purely
// additive: does not read or alter p.evidenceRecords/p.relationships/
// p.discrepancies/p.authorityRequirements/p.missingEvidence/p.stage2Findings/
// p.stage3Actions — no second evidence/finding/action/discrepancy/authority
// engine.
function buildProjectPlanningIntelligence(p) {
  if (!p || !Array.isArray(p.evidence)) return;
  buildPlanningConsulteeResponses(p);
  // Planning Batch 2 (2026-08-26): sensitive receptors built BEFORE
  // objections, so classifyObjectionWeight() (called inside
  // buildPlanningObjections() below) can already read
  // p.planningSensitiveReceptors when weighting each objection.
  buildPlanningSensitiveReceptors(p);
  buildPlanningObjections(p);
  buildPlanningRequirements(p);
  buildPlanningDrawingBaseline(p);
  // Planning Batch 2 (2026-08-26): portal architecture placeholders only —
  // see buildPlanningPortalPlaceholder() above. Built before the lifecycle
  // derivation purely for a consistent build order; the lifecycle itself
  // does not read it.
  buildPlanningPortalPlaceholder(p);
  // Planning Batch 5 (2026-08-26): identity/reference fields ONLY — never
  // an adapter call, never a retrieval attempt, no network activity of any
  // kind. See updatePlanningPortalIdentity() below.
  updatePlanningPortalIdentity(p);
  const lifecycle = derivePlanningLifecycleStatus(p);
  p.planningLifecycle = { status: lifecycle.status, evidence_files: lifecycle.evidence_files, reason: lifecycle.reason, computed_at: Date.now() };
  // Planning Batch 3 (2026-08-26): built last, so it can read the now-
  // complete p.planningLifecycle/p.planningRequirements/p.planningDrawings
  // AND p.discrepancies (Evidence Intelligence Batch 3, already built
  // earlier in buildProjectEvidenceLedger's own call chain, well before
  // buildProjectPlanningIntelligence is reached).
  buildProjectPlanningProgression(p);
}

// =============================================================================
// Planning Batch 2 (2026-08-26): STAGE 1 / STAGE 2 INTEGRATION, OBJECTION
// WEIGHTING & PLANNING OUTLOOK — Stage 2 customer-facing summary DATA ONLY.
//
// Mirrors exactly the same split already used for p.stage2Findings: this
// file computes WHAT to say (short, plain-English, evidence-backed strings,
// nothing else); app.js's stage2Summary() decides HOW to render it,
// exactly like buildStage2Findings()/customer_facing_summary above. Never
// exposes raw enum names, evidence IDs, confidence internals, or a
// consultee-by-consultee table — deliberately summarised, not dumped.
//
// Returns null when there is genuinely no planning evidence at all
// (NOT_ASSESSED) — so a project with none shows no Stage 2 planning card,
// exactly as before this batch (governing brief scenario K).
// =============================================================================

// The one paragraph the governing brief gives verbatim wording for
// (§6) is reproduced closely; every other status gets a short, restrained,
// plain-English sentence. No status here ever says "approved"/"guaranteed"/
// "safe to build"/"construction can start" unless a genuine authority
// decision exists (APPROVED_* below).
const PLANNING_LIFECYCLE_POSITION_TEXT = {
  PREPARATION: 'Planning preparation is under way. No application has been submitted yet.',
  SUBMITTED: 'A planning application has been submitted. It has not yet been validated by the local planning authority.',
  VALIDATED: 'The planning application has been validated by the local planning authority. A decision has not yet been made.',
  CONSULTATION_IN_PROGRESS: 'Planning consultation is under way. Responses from relevant consultees are still awaited.',
  CONSULTATION_REVIEW: 'Planning consultation responses received so far are being assessed. A clear position is not yet available.',
  FAVOURABLE_FORMAL_DECISION_PENDING: 'Planning is progressing positively. The consultation responses available so far do not identify a material objection to the proposal. Formal planning permission has not yet been issued, so some risk remains. Project Check view: appropriate design, quotation and preparation work may be progressed carefully while the formal decision is awaited.',
  UNCERTAIN_MATERIAL_ISSUE_OUTSTANDING: 'A genuinely unresolved planning matter has been identified that could affect the outcome. This should be reviewed carefully before relying on a positive planning outcome.',
  APPROVED_WITH_CONDITIONS: 'Planning permission has been approved, subject to conditions.',
  APPROVED_PRE_START_ACTIONS_OUTSTANDING: 'Planning permission has been approved, but at least one action remains outstanding before work can start on site.',
  APPROVED_BASELINE_VARIED_OR_AMENDED: 'Planning approval has been updated by a later variation. The original permission and earlier drawings remain part of the project\'s history.'
  // NOT_ASSESSED and PLANNING_ACTIONS_CLOSED deliberately absent: the
  // former means "no card at all" (see buildPlanningStage2Summary() below);
  // the latter is not derived by any Planning batch up to and including
  // this one, so it can never actually occur here yet.
};

// Turns one consultee response's OWN meanings into a single short, plain-
// English sentence — never a raw enum, never a legalistic dump. Priority-
// ordered so a MATERIAL_OBJECTION is never buried under something milder
// the same response also happens to carry.
function planningConsulteeCustomerSentence(consulteeBody, meanings) {
  const label = consulteeBody || 'A consultee';
  const m = meanings || [];
  if (m.includes(CONSULTEE_RESPONSE_MEANING.MATERIAL_OBJECTION)) return `${label} has raised an objection that needs to be reviewed.`;
  if (m.includes(CONSULTEE_RESPONSE_MEANING.FURTHER_INFORMATION_REQUIRED)) return `${label} has requested further information.`;
  if (m.includes(CONSULTEE_RESPONSE_MEANING.MANAGEABLE_REQUIREMENT) || m.includes(CONSULTEE_RESPONSE_MEANING.CONDITION_RECOMMENDED)) return `${label} has requested a manageable requirement be met — action needed, not a sign of likely refusal.`;
  if (m.includes(CONSULTEE_RESPONSE_MEANING.NO_OBSERVATIONS)) return `${label} has no observations on the proposal.`;
  if (m.includes(CONSULTEE_RESPONSE_MEANING.NO_OBJECTION) || m.includes(CONSULTEE_RESPONSE_MEANING.SUPPORT)) return `${label} has raised no objection.`;
  if (m.includes(CONSULTEE_RESPONSE_MEANING.INFORMATIVE_ONLY)) return `${label} has provided information only, with no objection.`;
  return `${label} has responded; the response is still being reviewed.`;
}

function buildPlanningStage2Summary(p) {
  if (!p || !p.planningLifecycle) return null;
  const status = p.planningLifecycle.status;
  const positionText = PLANNING_LIFECYCLE_POSITION_TEXT[status];
  if (!positionText) return null; // NOT_ASSESSED (or anything not yet derivable) — no card at all

  const observations = [];
  const attention = [];

  // Consultee responses — one short sentence each, a genuine
  // MATERIAL_OBJECTION raised to "needs attention", everything else kept as
  // a routine observation. A recommended/manageable requirement is
  // deliberately NOT treated as needing urgent attention (governing brief
  // §10) — it is still surfaced, just not alongside genuine risk items.
  (p.planningConsulteeResponses || []).forEach(r => {
    const sentence = planningConsulteeCustomerSentence(r.consultee_body, r.meanings);
    if ((r.meanings || []).includes(CONSULTEE_RESPONSE_MEANING.MATERIAL_OBJECTION)) attention.push(sentence);
    else observations.push(sentence);
  });

  // Public/community objections — only ever given customer-facing
  // prominence once genuinely relevant (RELEVANT_NEEDS_REVIEW or
  // MATERIALLY_CORROBORATED); a LOW_RELEVANCE/uncorroborated objection is
  // never dressed up as a planning risk the customer must act on.
  (p.planningObjections || []).forEach(o => {
    if (o.weight === OBJECTION_WEIGHT.MATERIALLY_CORROBORATED || o.weight === OBJECTION_WEIGHT.RELEVANT_NEEDS_REVIEW) {
      attention.push('A neighbour objection has been received and should be reviewed.');
    }
  });

  // Planning requirements — summarised as a category, never dumped
  // condition-by-condition (governing brief §16 "never a legalistic data
  // dump"). An explicit pre-commencement requirement needs attention before
  // work can start; a routine/design-controlling requirement is a normal
  // observation, not a sign of likely refusal (governing brief §10).
  const requirements = p.planningRequirements || [];
  if (requirements.some(r => r.types.includes(PLANNING_REQUIREMENT_TYPE.PRE_COMMENCEMENT_REQUIREMENT))) {
    attention.push('One or more planning conditions must be met before work starts on site.');
  } else if (requirements.some(r => r.types.includes(PLANNING_REQUIREMENT_TYPE.ROUTINE_MANAGEABLE_REQUIREMENT) || r.types.includes(PLANNING_REQUIREMENT_TYPE.DESIGN_CONTROLLING_REQUIREMENT))) {
    observations.push('One or more routine planning requirements have been identified — action needed, not a sign of likely refusal.');
  }
  // Planning ≠ Building Control (governing brief §12 in Planning Batch 1,
  // reused here for wording only): a Building-Control-separate note is
  // shown as its own, clearly separate observation, never folded into the
  // planning position itself.
  if (requirements.some(r => r.building_control_separate_note)) {
    observations.push('A separate Building Control requirement has also been noted — this is not part of the planning decision itself.');
  }

  // A plain, un-frightening reminder that formal permission is not yet
  // issued, for every pre-decision status — never omitted merely because
  // the position happens to be positive (FAVOURABLE_FORMAL_DECISION_PENDING
  // already restates this itself; kept out of `observations` in that one
  // case only, to avoid a duplicate sentence).
  const PRE_DECISION_STATUSES = [PLANNING_LIFECYCLE_STATUS.SUBMITTED, PLANNING_LIFECYCLE_STATUS.VALIDATED, PLANNING_LIFECYCLE_STATUS.CONSULTATION_IN_PROGRESS, PLANNING_LIFECYCLE_STATUS.CONSULTATION_REVIEW, PLANNING_LIFECYCLE_STATUS.UNCERTAIN_MATERIAL_ISSUE_OUTSTANDING];
  if (PRE_DECISION_STATUSES.includes(status)) observations.push('Formal planning permission has not yet been issued.');

  // Planning Batch 3 (2026-08-26): "WHAT CAN YOU DO NOW?" — kept
  // STRUCTURALLY SEPARATE from the planning status/position text above
  // (governing brief §16: status and progression advice are never encoded
  // into the same field). `p.planningActivityProgression` is already fully
  // computed by buildProjectPlanningProgression() (called from the SAME
  // orchestrator that set p.planningLifecycle, immediately after it) —
  // this only groups the already-derived per-activity statuses into three
  // plain-English buckets, never re-deriving anything. A specific ordering-
  // risk caution sentence is added only when ordering itself is genuinely
  // in the "at commercial risk" bucket — never a blanket warning.
  const progression = p.planningActivityProgression || {};
  const canProgress = [], proceedCarefully = [], wait = [];
  Object.keys(progression).forEach(activityKey => {
    const st = progression[activityKey].status;
    if (st === PROGRESSION_STATUS.CAN_PROGRESS_IN_PARALLEL) canProgress.push(activityKey);
    else if (st === PROGRESSION_STATUS.MAY_PROGRESS_AT_COMMERCIAL_RISK) proceedCarefully.push(activityKey);
    else if (st === PROGRESSION_STATUS.DO_NOT_PROGRESS_YET) wait.push(activityKey);
  });
  if (progression.PROCUREMENT_OR_ORDER && progression.PROCUREMENT_OR_ORDER.status === PROGRESSION_STATUS.MAY_PROGRESS_AT_COMMERCIAL_RISK) {
    attention.push('Ordering may be considered at commercial risk, but formal planning permission has not yet been issued. Any non-refundable commitment should take account of the possibility of conditions, amendments or refusal.');
  }
  const hasAnyProgressionSignal = canProgress.length || proceedCarefully.length || wait.length;

  return { status, position_text: positionText, observations, attention, progression: hasAnyProgressionSignal ? { can: canProgress, careful: proceedCarefully, wait } : null };
}

// =============================================================================
// Planning Batch 3 (2026-08-26): POST-CONSULTATION PROGRESSION, COMMERCIAL-
// RISK GUIDANCE & "WHAT DOES THIS STOP?"
//
// Answers "what can the customer sensibly progress while planning is still
// pending, what should remain gated, and what does each planning issue
// actually stop?" — a COMMERCIAL/PROGRAMME-RISK concept
// (POST_CONSULTATION_AT_RISK_PROGRESSION), never a legal permission state.
// Extends the existing Planning Batch 1/2 architecture only: reads
// p.planningLifecycle/p.planningRequirements/p.planningDrawings (Batch 1)
// and p.discrepancies (Evidence Intelligence Batch 3) directly — no second
// evidence/discrepancy/action engine. Creates NO Stage 3 action of any
// kind (that remains Planning Batch 4) and implements NO portal retrieval
// (Planning Batch 5).
//
// Governing safeguard, encoded structurally throughout: a favourable
// planning outlook alone NEVER authorises physical commencement, and
// detailed at-risk commercial progression is only ever considered once
// Planning Batch 2 has genuinely derived FAVOURABLE_FORMAL_DECISION_PENDING
// (never from CONSULTATION_IN_PROGRESS/CONSULTATION_REVIEW alone) — see
// deriveActivityBaseline() below.
// =============================================================================

// -----------------------------------------------------------------------
// Vocabularies
// -----------------------------------------------------------------------

const PROGRESSION_STATUS = {
  CAN_PROGRESS_IN_PARALLEL: 'CAN_PROGRESS_IN_PARALLEL',
  MAY_PROGRESS_AT_COMMERCIAL_RISK: 'MAY_PROGRESS_AT_COMMERCIAL_RISK',
  DO_NOT_PROGRESS_YET: 'DO_NOT_PROGRESS_YET',
  NOT_ASSESSED: 'NOT_ASSESSED'
};
// Ordinal — used only to compare "which of two statuses is more
// restrictive" (never displayed). Higher = more restrictive.
const PROGRESSION_STATUS_ORDINAL = { CAN_PROGRESS_IN_PARALLEL: 0, MAY_PROGRESS_AT_COMMERCIAL_RISK: 1, DO_NOT_PROGRESS_YET: 2, NOT_ASSESSED: -1 };
function moreRestrictive(a, b) { return PROGRESSION_STATUS_ORDINAL[a] >= PROGRESSION_STATUS_ORDINAL[b] ? a : b; }
// A gate can only ever tighten an activity's status, never loosen it —
// applying a "cap" means "this activity can be no more permissive than X".
function capAt(current, cap) { return moreRestrictive(current, cap); }

const PROJECT_ACTIVITY = {
  DESIGN_DEVELOPMENT: 'DESIGN_DEVELOPMENT',
  QUOTATIONS: 'QUOTATIONS',
  SURVEYS_AND_INVESTIGATIONS: 'SURVEYS_AND_INVESTIGATIONS',
  BUILDING_CONTROL_PREPARATION: 'BUILDING_CONTROL_PREPARATION',
  SUPPLIER_COORDINATION: 'SUPPLIER_COORDINATION',
  PROCUREMENT_OR_ORDER: 'PROCUREMENT_OR_ORDER',
  MANUFACTURE: 'MANUFACTURE',
  SITE_ENABLING_WORKS: 'SITE_ENABLING_WORKS',
  PHYSICAL_CONSTRUCTION_COMMENCEMENT: 'PHYSICAL_CONSTRUCTION_COMMENCEMENT',
  OCCUPATION_OR_USE: 'OCCUPATION_OR_USE'
};
const PROJECT_ACTIVITY_LIST = Object.values(PROJECT_ACTIVITY);

// Reversibility/commercial-exposure classification (governing brief §10) —
// a simple, fixed classification, not a financial model.
const COMMERCIAL_EXPOSURE = { LOW_COMMITMENT: 'LOW_COMMITMENT', HIGH_COMMITMENT: 'HIGH_COMMITMENT' };
const ACTIVITY_COMMERCIAL_EXPOSURE = {
  DESIGN_DEVELOPMENT: COMMERCIAL_EXPOSURE.LOW_COMMITMENT,
  QUOTATIONS: COMMERCIAL_EXPOSURE.LOW_COMMITMENT,
  SURVEYS_AND_INVESTIGATIONS: COMMERCIAL_EXPOSURE.LOW_COMMITMENT,
  BUILDING_CONTROL_PREPARATION: COMMERCIAL_EXPOSURE.LOW_COMMITMENT,
  SUPPLIER_COORDINATION: COMMERCIAL_EXPOSURE.LOW_COMMITMENT,
  PROCUREMENT_OR_ORDER: COMMERCIAL_EXPOSURE.HIGH_COMMITMENT,
  MANUFACTURE: COMMERCIAL_EXPOSURE.HIGH_COMMITMENT,
  SITE_ENABLING_WORKS: COMMERCIAL_EXPOSURE.HIGH_COMMITMENT,
  PHYSICAL_CONSTRUCTION_COMMENCEMENT: COMMERCIAL_EXPOSURE.HIGH_COMMITMENT,
  OCCUPATION_OR_USE: COMMERCIAL_EXPOSURE.HIGH_COMMITMENT
};

// "What does this issue actually stop?" — per governing brief §7/§8.
const PLANNING_GATE_TYPE = {
  DOES_NOT_CURRENTLY_STOP_PROGRESS: 'DOES_NOT_CURRENTLY_STOP_PROGRESS',
  BLOCKS_PLANNING_DETERMINATION: 'BLOCKS_PLANNING_DETERMINATION',
  BLOCKS_FINAL_DESIGN: 'BLOCKS_FINAL_DESIGN',
  BLOCKS_PROCUREMENT_OR_ORDER: 'BLOCKS_PROCUREMENT_OR_ORDER',
  BLOCKS_MANUFACTURE: 'BLOCKS_MANUFACTURE',
  BLOCKS_SITE_START: 'BLOCKS_SITE_START',
  BLOCKS_OCCUPATION_OR_USE: 'BLOCKS_OCCUPATION_OR_USE',
  MONITOR_ONLY: 'MONITOR_ONLY'
};
// "Most restrictive CURRENT applicable gate" (governing brief §9) — a
// simple, documented severity ranking used ONLY to pick a single project-
// summary headline gate; every issue-level gate is always preserved
// separately regardless (see buildProjectPlanningProgression() below).
// BLOCKS_PLANNING_DETERMINATION is not derived by this batch (reserved for
// a future batch) but is ranked highest for when it eventually is.
const PLANNING_GATE_SEVERITY = {
  BLOCKS_PLANNING_DETERMINATION: 90,
  BLOCKS_SITE_START: 80,
  BLOCKS_MANUFACTURE: 70,
  BLOCKS_PROCUREMENT_OR_ORDER: 60,
  BLOCKS_FINAL_DESIGN: 50,
  BLOCKS_OCCUPATION_OR_USE: 40,
  MONITOR_ONLY: 10,
  DOES_NOT_CURRENTLY_STOP_PROGRESS: 0
};
// A gate "caps" (never loosens) the named activities' progression status —
// deliberately NOT a blanket "stop everything downstream": per the
// governing brief's own §9 worked example, a site-start gate leaves design/
// quotation/procurement entirely unaffected. BLOCKS_FINAL_DESIGN also caps
// MANUFACTURE (never manufacture against an unstable/contested design —
// governing brief §12), independently of whether procurement itself is
// capped.
const GATE_ACTIVITY_CAP = {
  BLOCKS_FINAL_DESIGN: { DESIGN_DEVELOPMENT: PROGRESSION_STATUS.MAY_PROGRESS_AT_COMMERCIAL_RISK, MANUFACTURE: PROGRESSION_STATUS.DO_NOT_PROGRESS_YET },
  BLOCKS_PROCUREMENT_OR_ORDER: { PROCUREMENT_OR_ORDER: PROGRESSION_STATUS.DO_NOT_PROGRESS_YET },
  BLOCKS_MANUFACTURE: { MANUFACTURE: PROGRESSION_STATUS.DO_NOT_PROGRESS_YET },
  BLOCKS_SITE_START: { SITE_ENABLING_WORKS: PROGRESSION_STATUS.DO_NOT_PROGRESS_YET, PHYSICAL_CONSTRUCTION_COMMENCEMENT: PROGRESSION_STATUS.DO_NOT_PROGRESS_YET },
  BLOCKS_OCCUPATION_OR_USE: { OCCUPATION_OR_USE: PROGRESSION_STATUS.DO_NOT_PROGRESS_YET }
  // MONITOR_ONLY / DOES_NOT_CURRENTLY_STOP_PROGRESS / BLOCKS_PLANNING_
  // DETERMINATION intentionally have no cap entry — informational only.
};

// -----------------------------------------------------------------------
// Issue-level gate derivation — per planning requirement item (Batch 1's
// own p.planningRequirements, reused directly) and per approved-drawing
// mismatch (Evidence Intelligence Batch 3's own p.discrepancies, reused
// directly — no second conflict/discrepancy detector).
// -----------------------------------------------------------------------

// A third-party/statutory requirement explicitly tied to site-start wording
// (SAB, Network Rail/BAPA, asset protection) even where it was not already
// structurally tagged PRE_COMMENCEMENT — a narrow, defensive fallback; most
// real SAB/Network Rail pre-commencement conditions are ALSO worded as
// "no development shall commence..." and are already caught by the
// PRE_COMMENCEMENT_REQUIREMENT tag below, checked first.
const SITE_START_THIRD_PARTY_KEYWORDS = /sab approval|suds approving body|sustainable drainage approval|network rail|basic asset protection agreement|\bbapa\b|asset protection agreement/i;
const BEFORE_WORKS_BEGIN_PATTERN = /before (?:construction|works?|development) (?:begins?|commences?|starts?)|prior to (?:construction|commencement)|must not commence|required before (?:construction|works?|development)/i;

function classifyPlanningRequirementGate(req) {
  const types = req.types || [];
  const text = (req.requirement_text || '').toLowerCase();
  if (types.includes(PLANNING_REQUIREMENT_TYPE.PRE_COMMENCEMENT_REQUIREMENT)) {
    return { gate: PLANNING_GATE_TYPE.BLOCKS_SITE_START, reason: 'A pre-commencement planning requirement remains unresolved.' };
  }
  if (types.includes(PLANNING_REQUIREMENT_TYPE.THIRD_PARTY_STATUTORY_OR_ASSET_OWNER_REQUIREMENT) && SITE_START_THIRD_PARTY_KEYWORDS.test(text) && BEFORE_WORKS_BEGIN_PATTERN.test(text)) {
    return { gate: PLANNING_GATE_TYPE.BLOCKS_SITE_START, reason: 'A third-party/statutory requirement explicitly requires resolution before construction/works begin.' };
  }
  if (types.includes(PLANNING_REQUIREMENT_TYPE.PRE_OCCUPATION_REQUIREMENT)) {
    return { gate: PLANNING_GATE_TYPE.BLOCKS_OCCUPATION_OR_USE, reason: 'A pre-occupation planning requirement remains unresolved.' };
  }
  if (types.includes(PLANNING_REQUIREMENT_TYPE.DESIGN_CONTROLLING_REQUIREMENT)) {
    return { gate: PLANNING_GATE_TYPE.BLOCKS_FINAL_DESIGN, reason: 'A design-controlling planning requirement should be accounted for before finalising the design.' };
  }
  if (types.includes(PLANNING_REQUIREMENT_TYPE.ROUTINE_MANAGEABLE_REQUIREMENT)) {
    return { gate: PLANNING_GATE_TYPE.MONITOR_ONLY, reason: 'A routine, manageable planning requirement — monitor only, does not currently stop progress.' };
  }
  return { gate: PLANNING_GATE_TYPE.DOES_NOT_CURRENTLY_STOP_PROGRESS, reason: 'No specific progression restriction identified for this requirement.' };
}

// Design-changing/approved-drawing-mismatch discrepancies (governing brief
// §8/§9 "material approved-drawing discrepancy", §4 "likely design-
// changing issue") — reuses Evidence Intelligence Batch 3's OWN
// MATERIAL_CONFLICT discrepancy classification and per-subject criticality
// profile directly; never a second conflict detector. Applies to any
// unresolved MATERIAL_CONFLICT on a genuine building-dimension subject —
// whether or not a decision has been issued yet (pre-decision, this is "a
// likely design-changing issue"; post-decision, against a genuine current-
// baseline approved drawing, it is specifically "a mismatch against the
// approved baseline" — see the differing wording below, same underlying
// mechanism either way).
const APPROVED_DRAWING_DIMENSION_SUBJECTS = ['eaves_height', 'overall_building_length', 'building_footprint_dimensions'];
function identifyDesignRelevantConflicts(p) {
  return (p.discrepancies || []).filter(d => d.discrepancy_type === DISCREPANCY_TYPE.MATERIAL_CONFLICT && !d.resolved_at && APPROVED_DRAWING_DIMENSION_SUBJECTS.includes(d.subject));
}

// Builds every ISSUE-LEVEL gate for a project — never collapsed into one
// generic status (governing brief §9): each gate records exactly which
// activities it affects and why, and the underlying requirement/
// discrepancy record is never altered.
function buildPlanningIssueGates(p) {
  const gates = [];
  (p.planningRequirements || []).forEach(req => {
    const cls = classifyPlanningRequirementGate(req);
    gates.push({ gate_id: 'gate-' + req.requirement_id, source_type: 'REQUIREMENT', source_id: req.requirement_id, source_file: req.source_file, gate: cls.gate, reason: cls.reason });
  });
  const hasApprovedBaseline = (p.planningDrawings || []).some(d => d.is_current_baseline);
  identifyDesignRelevantConflicts(p).forEach(disc => {
    const profile = SUBJECT_DISCREPANCY_PROFILE[disc.subject] || DEFAULT_DISCREPANCY_PROFILE;
    gates.push({ gate_id: 'gate-' + disc.discrepancy_id + '-design', source_type: 'DISCREPANCY', source_id: disc.discrepancy_id, source_file: (disc.source_files || [])[0] || null, gate: PLANNING_GATE_TYPE.BLOCKS_FINAL_DESIGN, reason: hasApprovedBaseline ? ('A material discrepancy exists between current project information and the applicable authority-approved planning baseline (' + profile.label + ').') : ('A material, unresolved discrepancy (' + profile.label + ') could still change the design.') });
    if (profile.criticality === 'high') {
      gates.push({ gate_id: 'gate-' + disc.discrepancy_id + '-procurement', source_type: 'DISCREPANCY', source_id: disc.discrepancy_id, source_file: (disc.source_files || [])[0] || null, gate: PLANNING_GATE_TYPE.BLOCKS_PROCUREMENT_OR_ORDER, reason: 'The same discrepancy (' + profile.label + ') is high-criticality — procurement/ordering should also wait until it is resolved.' });
    }
  });
  return gates;
}

// -----------------------------------------------------------------------
// Per-activity progression baseline, BEFORE any issue-level gate is
// applied — driven ONLY by the planning lifecycle status (governing brief
// §4/§5/§13/§14). Deliberately conservative: detailed at-risk commercial
// progression (anything beyond the always-safe, low-commitment activities)
// requires a genuine FAVOURABLE_FORMAL_DECISION_PENDING or APPROVED-family
// status — CONSULTATION_IN_PROGRESS/CONSULTATION_REVIEW/UNCERTAIN_MATERIAL_
// ISSUE_OUTSTANDING never unlock anything beyond the baseline below.
// -----------------------------------------------------------------------
function deriveActivityBaseline(lifecycleStatus) {
  const S = PLANNING_LIFECYCLE_STATUS, P = PROGRESSION_STATUS;
  const isFavourable = lifecycleStatus === S.FAVOURABLE_FORMAL_DECISION_PENDING;
  // "Approved family" — a genuine authority decision exists (governing
  // brief §14: "once genuine permission exists, recalculate progression
  // according to actual conditions"). APPROVED_PRE_START_ACTIONS_OUTSTANDING
  // is included here for design/procurement/manufacture purposes (its own
  // outstanding pre-start requirement is what gates SITE START specifically
  // — enforced below via the physical-commencement rule, not by excluding
  // it from this bucket entirely).
  const isApprovedFamily = [S.APPROVED_WITH_CONDITIONS, S.APPROVED_PRE_START_ACTIONS_OUTSTANDING, S.APPROVED_BASELINE_VARIED_OR_AMENDED].includes(lifecycleStatus);

  // Always-safe, low-commitment activities — never restricted by the
  // planning lifecycle status alone (only ever by a specific, targeted
  // issue-level gate applied afterwards — see GATE_ACTIVITY_CAP above,
  // which only ever targets DESIGN_DEVELOPMENT among this group).
  const baseline = {
    DESIGN_DEVELOPMENT: P.CAN_PROGRESS_IN_PARALLEL,
    QUOTATIONS: P.CAN_PROGRESS_IN_PARALLEL,
    SURVEYS_AND_INVESTIGATIONS: P.CAN_PROGRESS_IN_PARALLEL,
    BUILDING_CONTROL_PREPARATION: P.CAN_PROGRESS_IN_PARALLEL,
    SUPPLIER_COORDINATION: P.CAN_PROGRESS_IN_PARALLEL,
    // PROCUREMENT_OR_ORDER: cautious by default (governing brief §5/§11) —
    // only a genuine favourable outlook or actual approval unlocks
    // anything beyond DO_NOT_PROGRESS_YET.
    PROCUREMENT_OR_ORDER: isApprovedFamily ? P.CAN_PROGRESS_IN_PARALLEL : (isFavourable ? P.MAY_PROGRESS_AT_COMMERCIAL_RISK : P.DO_NOT_PROGRESS_YET),
    // MANUFACTURE: independently, MORE cautious than procurement (governing
    // brief §12) — requires the design baseline to be genuinely AUTHORITY-
    // STABLE (i.e. actually approved), never merely "favourable outlook",
    // since the proposed geometry itself has not yet been confirmed by a
    // decision pre-approval. A favourable outlook alone therefore never
    // unlocks manufacture (see governing brief scenario K).
    MANUFACTURE: isApprovedFamily ? P.CAN_PROGRESS_IN_PARALLEL : P.DO_NOT_PROGRESS_YET,
    // SITE_ENABLING_WORKS: "do not assume these can progress... some may
    // themselves constitute development" — never unlocked pre-decision,
    // regardless of how favourable the outlook is; only once genuine
    // permission exists (and then still subject to a BLOCKS_SITE_START
    // gate — see below/GATE_ACTIVITY_CAP).
    SITE_ENABLING_WORKS: isApprovedFamily ? P.CAN_PROGRESS_IN_PARALLEL : P.DO_NOT_PROGRESS_YET,
    // PHYSICAL_CONSTRUCTION_COMMENCEMENT: the non-negotiable safeguard
    // (governing brief §13) — DO_NOT_PROGRESS_YET while formal permission
    // is pending, full stop, regardless of outlook; APPROVED_PRE_START_
    // ACTIONS_OUTSTANDING keeps it DO_NOT_PROGRESS_YET even once
    // "approved" (its own outstanding pre-start requirement IS the reason);
    // only APPROVED_WITH_CONDITIONS/APPROVED_BASELINE_VARIED_OR_AMENDED
    // (with no additional BLOCKS_SITE_START gate) reach CAN_PROGRESS_IN_
    // PARALLEL.
    PHYSICAL_CONSTRUCTION_COMMENCEMENT: (lifecycleStatus === S.APPROVED_WITH_CONDITIONS || lifecycleStatus === S.APPROVED_BASELINE_VARIED_OR_AMENDED) ? P.CAN_PROGRESS_IN_PARALLEL : P.DO_NOT_PROGRESS_YET,
    // OCCUPATION_OR_USE: must respect pre-occupation conditions (governing
    // brief §4/§14) — never available before genuine approval exists.
    OCCUPATION_OR_USE: isApprovedFamily ? P.CAN_PROGRESS_IN_PARALLEL : P.DO_NOT_PROGRESS_YET
  };
  return baseline;
}

// -----------------------------------------------------------------------
// Orchestrator — combines the lifecycle-driven baseline with every
// issue-level gate (each gate only ever CAPS/tightens, never loosens), then
// computes the single most-restrictive CURRENT applicable gate at project-
// summary level WITHOUT deleting any issue-level gate (governing brief §9).
// -----------------------------------------------------------------------
function buildProjectPlanningProgression(p) {
  if (!p) return;
  const lifecycle = p.planningLifecycle;
  if (!lifecycle || lifecycle.status === PLANNING_LIFECYCLE_STATUS.NOT_ASSESSED) {
    const notAssessed = {};
    PROJECT_ACTIVITY_LIST.forEach(a => { notAssessed[a] = { status: PROGRESSION_STATUS.NOT_ASSESSED, reason: 'No meaningful planning evidence identified on this project yet.', commercial_exposure: ACTIVITY_COMMERCIAL_EXPOSURE[a] }; });
    p.planningActivityProgression = notAssessed;
    p.planningIssueGates = [];
    p.planningMostRestrictiveGate = null;
    return;
  }
  const baseline = deriveActivityBaseline(lifecycle.status);
  const gates = buildPlanningIssueGates(p);
  const activity = {};
  PROJECT_ACTIVITY_LIST.forEach(a => { activity[a] = { status: baseline[a], reason: null, commercial_exposure: ACTIVITY_COMMERCIAL_EXPOSURE[a] }; });
  gates.forEach(g => {
    const caps = GATE_ACTIVITY_CAP[g.gate];
    if (!caps) return;
    Object.keys(caps).forEach(actKey => {
      const capped = capAt(activity[actKey].status, caps[actKey]);
      if (capped !== activity[actKey].status || !activity[actKey].reason) {
        activity[actKey].status = capped;
        activity[actKey].reason = g.reason; // most recent capping reason kept — every gate remains individually inspectable in p.planningIssueGates regardless
      }
    });
  });
  // MANUFACTURE must never be MORE permissive than PROCUREMENT_OR_ORDER
  // (governing brief §12) — a defensive final clamp; the baseline/gate
  // logic above already keeps this true in every scenario this batch
  // derives, but this is kept as an explicit, inspectable invariant.
  activity.MANUFACTURE.status = moreRestrictive(activity.MANUFACTURE.status, activity.PROCUREMENT_OR_ORDER.status);

  p.planningActivityProgression = activity;
  p.planningIssueGates = gates;
  // Most restrictive CURRENT applicable gate at project-summary level —
  // every issue-level gate above is still fully preserved in
  // p.planningIssueGates regardless of this single headline value.
  const applicableGates = gates.filter(g => g.gate !== PLANNING_GATE_TYPE.DOES_NOT_CURRENTLY_STOP_PROGRESS);
  p.planningMostRestrictiveGate = applicableGates.length
    ? applicableGates.reduce((worst, g) => PLANNING_GATE_SEVERITY[g.gate] > PLANNING_GATE_SEVERITY[worst.gate] ? g : worst)
    : null;
}

// =============================================================================
// Planning Batch 4 (2026-08-26): STAGE 3 PLANNING ACTIONS, RESPONSIBILITY /
// INTERFACE & CLOSURE EVIDENCE.
//
// Answers "what unresolved planning matter becomes a real Stage 3 action,
// who appears responsible or involved, what evidence is required to close
// it, and when is it genuinely closed?" Uses the EXISTING Stage 3 action
// store (p.stage3Actions) and schema exclusively — no second action model,
// closure engine, responsibility system, evidence store, or planning
// subsystem. Two new, narrow action sources feed the SAME store, alongside
// the existing ACTION_RULES/buildBatch3DerivedActions() actions (the
// approved-drawing-mismatch action itself is NOT a new source here — it is
// the EXISTING discrepancy-derived action, already enriched with planning
// context just above):
//   - buildPlanningRequirementActions() — one action per Planning Batch 1
//     planning requirement that genuinely restricts progression (reusing
//     Planning Batch 3's OWN gate classification directly — never
//     re-derived); a routine/no-restriction requirement never becomes an
//     action (governing brief §1/§4).
//   - buildPlanningConsulteeResponseActions() — one action per technical/
//     statutory consultee response carrying MATERIAL_OBJECTION or
//     FURTHER_INFORMATION_REQUIRED; SUPPORT/NO_OBJECTION/NO_OBSERVATIONS/
//     INFORMATIVE_ONLY/MANAGEABLE_REQUIREMENT/CONDITION_RECOMMENDED never
//     create one. A public/community objection NEVER independently creates
//     an action in this batch — where it is materially corroborated, the
//     corroborating technical consultee's OWN response already creates the
//     action that covers the substance (one issue, one action; governing
//     brief §13/scenario G).
// =============================================================================

// -----------------------------------------------------------------------
// Planning requirement -> Stage 3 action. Eligibility, subject vocabulary,
// evidence-to-close and closure assessment.
// -----------------------------------------------------------------------

// A controlled action-subject vocabulary (governing brief §3) — used only
// where the EXISTING category/subject fields are insufficient to describe
// what kind of planning matter this is; never a second classification of
// anything Planning Batch 1 already classified.
const PLANNING_ACTION_SUBJECT = {
  PLANNING_CONDITION_DISCHARGE: 'PLANNING_CONDITION_DISCHARGE',
  PRE_COMMENCEMENT_REQUIREMENT: 'PRE_COMMENCEMENT_REQUIREMENT',
  PRE_OCCUPATION_REQUIREMENT: 'PRE_OCCUPATION_REQUIREMENT',
  PLANNING_INFORMATION_RESPONSE: 'PLANNING_INFORMATION_RESPONSE',
  APPROVED_DRAWING_ALIGNMENT: 'APPROVED_DRAWING_ALIGNMENT',
  VARIATION_OR_AMENDMENT_REQUIRED: 'VARIATION_OR_AMENDMENT_REQUIRED',
  THIRD_PARTY_APPROVAL_OR_AGREEMENT: 'THIRD_PARTY_APPROVAL_OR_AGREEMENT',
  PLANNING_DESIGN_CLARIFICATION: 'PLANNING_DESIGN_CLARIFICATION',
  CONSULTEE_RESPONSE_REQUIRED: 'CONSULTEE_RESPONSE_REQUIRED',
  OTHER_PLANNING_ACTION: 'OTHER_PLANNING_ACTION'
};

// Topic-keyword groups reused for BOTH the evidence-to-close wording AND
// closure-evidence matching below — one keyword table, two consumers,
// never two separate keyword sets that could silently drift apart.
const PLANNING_REQUIREMENT_TOPIC_GROUPS = [
  { pattern: /network rail|bapa|asset protection/i, subject: PLANNING_ACTION_SUBJECT.THIRD_PARTY_APPROVAL_OR_AGREEMENT, evidence: 'Executed/written asset-protection agreement with the relevant asset owner (e.g. Network Rail).' },
  { pattern: /\bsab\b|suds approving body|sustainable drainage/i, subject: PLANNING_ACTION_SUBJECT.THIRD_PARTY_APPROVAL_OR_AGREEMENT, evidence: 'Written SAB/SuDS Approving Body approval for the drainage scheme.' },
  { pattern: /contamin/i, subject: PLANNING_ACTION_SUBJECT.PRE_COMMENCEMENT_REQUIREMENT, evidence: 'Approved contamination remediation strategy/verification report as applicable, and written Local Planning Authority condition-discharge approval.' },
  { pattern: /electric vehicle|ev charging|cycle/i, subject: PLANNING_ACTION_SUBJECT.PRE_OCCUPATION_REQUIREMENT, evidence: 'Evidence of installation/compliance for the approved EV charging/cycle parking details, where required by the authority.' },
  { pattern: /landscap/i, subject: PLANNING_ACTION_SUBJECT.PLANNING_DESIGN_CLARIFICATION, evidence: 'Approved landscaping details and (where required) written Local Planning Authority approval.' },
  { pattern: /external materials|samples of materials/i, subject: PLANNING_ACTION_SUBJECT.PLANNING_DESIGN_CLARIFICATION, evidence: 'Confirmation that the design/materials account for this requirement, and (where required) written Local Planning Authority approval of the relevant details.' }
];
function planningRequirementTopicGroup(req) {
  const text = (req.requirement_text || '');
  return PLANNING_REQUIREMENT_TOPIC_GROUPS.find(g => g.pattern.test(text)) || null;
}

// Action subject (governing brief §3) — priority-ordered so a requirement
// that is BOTH pre-commencement AND a third-party/asset-owner matter (e.g.
// a SAB/Network Rail pre-commencement condition) is described by its more
// specific THIRD_PARTY_APPROVAL_OR_AGREEMENT subject, not the generic one.
function planningRequirementActionSubject(req) {
  const types = req.types || [];
  const topic = planningRequirementTopicGroup(req);
  if (types.includes(PLANNING_REQUIREMENT_TYPE.THIRD_PARTY_STATUTORY_OR_ASSET_OWNER_REQUIREMENT) && topic && topic.subject === PLANNING_ACTION_SUBJECT.THIRD_PARTY_APPROVAL_OR_AGREEMENT) return PLANNING_ACTION_SUBJECT.THIRD_PARTY_APPROVAL_OR_AGREEMENT;
  if (types.includes(PLANNING_REQUIREMENT_TYPE.PRE_COMMENCEMENT_REQUIREMENT)) return PLANNING_ACTION_SUBJECT.PRE_COMMENCEMENT_REQUIREMENT;
  if (types.includes(PLANNING_REQUIREMENT_TYPE.PRE_OCCUPATION_REQUIREMENT)) return PLANNING_ACTION_SUBJECT.PRE_OCCUPATION_REQUIREMENT;
  if (types.includes(PLANNING_REQUIREMENT_TYPE.DESIGN_CONTROLLING_REQUIREMENT)) return PLANNING_ACTION_SUBJECT.PLANNING_DESIGN_CLARIFICATION;
  if (types.includes(PLANNING_REQUIREMENT_TYPE.PLANNING_CONDITION)) return PLANNING_ACTION_SUBJECT.PLANNING_CONDITION_DISCHARGE;
  return PLANNING_ACTION_SUBJECT.OTHER_PLANNING_ACTION;
}

// Evidence required to close (governing brief §10/§15) — CONTEXTUAL to the
// actual requirement, never one universal checklist. Falls back to a
// generic-but-still-gate-specific statement when no specific topic is
// recognised.
function planningRequirementEvidenceToClose(req, gate) {
  const topic = planningRequirementTopicGroup(req);
  if (topic) return [topic.evidence];
  if (gate === PLANNING_GATE_TYPE.BLOCKS_SITE_START) return ['Written Local Planning Authority condition-discharge approval for this condition.'];
  if (gate === PLANNING_GATE_TYPE.BLOCKS_OCCUPATION_OR_USE) return ['Written confirmation/evidence that the pre-occupation requirement has been satisfied, and (where required) Local Planning Authority acceptance.'];
  return ['Confirmation that the design accounts for this requirement, and (where required) written Local Planning Authority approval of the relevant details.'];
}

// Likely responsible/interface party (governing brief §6/§7/§22) — cautious,
// generic wording only; NEVER assigns the building supplier responsibility
// for ecology/contamination/drainage/asset-owner/planning-agent matters
// (the building-supplier scope safeguard), and never states a reviewing
// authority/consultee itself is "responsible" for producing the response.
function planningRequirementLikelyResponsibleParty(req) {
  const subject = planningRequirementActionSubject(req);
  const MAP = {
    THIRD_PARTY_APPROVAL_OR_AGREEMENT: "Likely responsible party: customer's planning agent, in liaison with the relevant third-party asset owner — responsibility should be confirmed.",
    PRE_COMMENCEMENT_REQUIREMENT: "Likely responsible party: specialist consultant relevant to this condition (e.g. contamination/drainage) / customer's planning agent — responsibility should be confirmed.",
    PRE_OCCUPATION_REQUIREMENT: "Likely responsible party: building supplier (for building-related items) / customer — responsibility should be confirmed.",
    PLANNING_DESIGN_CLARIFICATION: "Likely responsible party: architect/designer, usually provided by the building supplier for the building itself — responsibility should be confirmed.",
    PLANNING_CONDITION_DISCHARGE: "Likely responsible party: customer's planning agent — responsibility should be confirmed.",
    OTHER_PLANNING_ACTION: "Likely responsible party: customer's planning agent — responsibility should be confirmed."
  };
  return MAP[subject] || MAP.OTHER_PLANNING_ACTION;
}

const PLANNING_GATE_RESOLVE_BEFORE_LABEL = {
  BLOCKS_SITE_START: 'works start',
  BLOCKS_FINAL_DESIGN: 'final design is fixed',
  BLOCKS_PROCUREMENT_OR_ORDER: 'ordering',
  BLOCKS_MANUFACTURE: 'manufacture',
  BLOCKS_OCCUPATION_OR_USE: 'occupation/use'
};

// Action priority (governing brief §4) — driven by CONSEQUENCE/gate, never
// scary wording, never a flat "every condition is HIGH". MONITOR_ONLY/
// DOES_NOT_CURRENTLY_STOP_PROGRESS never even reach this function (see
// buildPlanningRequirementActions() below — no action is created for them
// at all). BLOCKS_OCCUPATION_OR_USE is real but not urgent during early
// design/procurement, so it is deliberately kept at 'medium' rather than
// 'high' — the customer-facing wording still says exactly when it must be
// resolved ("before occupation/use").
function planningGateActionPriority(gate) {
  return gate === PLANNING_GATE_TYPE.BLOCKS_OCCUPATION_OR_USE ? 'medium' : 'high';
}

// Closure evidence patterns — reused for BOTH planning-requirement and
// planning-consultee-response closure below (one pair of patterns, not a
// separate pair per action type). Deliberately generic phrasing, not tuned
// to one fixture. An "acceptance" match closes; a "submission" match
// (evidence supplied, authority position not yet known) reaches the
// EXISTING EVIDENCE_RECEIVED status only — never closed on its own
// (governing brief §16/§18/§19's non-negotiable safeguard).
const PLANNING_CLOSURE_ACCEPTANCE_PATTERN = /condition\s*(?:\d+\s*)?(?:has been |is |was )?discharged|discharge of condition[^.\n]{0,20}(?:approved|granted)|written approval (?:has been |is |was )?(?:given|granted)|approved by the local planning authority|(?:agreement|consent) (?:has been |is |was )?(?:executed|entered into|granted|given)|authority (?:has |is |was )?(?:confirmed|accepted|approved)|no (?:further )?amendment (?:is|was) required/i;
const PLANNING_CLOSURE_SUBMISSION_PATTERN = /(?:has been |was )?submitted to the local planning authority|application (?:has been |was )?(?:made|submitted) for (?:discharge|approval)|awaiting (?:the )?authority'?s? (?:decision|response|approval)/i;

// Subject-specific matching (governing brief §17/§19: "general planning
// approval must not close a separate condition-discharge/third-party
// action... use subject-specific matching"). A closing document must EITHER
// share the requirement's own recognised topic keyword (SAB/Network Rail/
// contamination/EV-cycle/etc. — the SAME table used for evidence-to-close
// wording above, so the two can never silently drift apart) OR explicitly
// reference the SAME condition number — never a bare, generic "planning
// permission granted" statement, which shares neither.
function assessPlanningRequirementClosure(req, p) {
  const topic = planningRequirementTopicGroup(req);
  const itemRef = req.item_number ? new RegExp('condition\\s*' + req.item_number + '\\b', 'i') : null;
  const candidates = (p.evidence || []).filter(e => {
    if (!e.extractedText) return false;
    if (e.name === req.source_file) return false; // never self-closes from its own source document
    if (Array.isArray(e.documentIntegrityFlags) && e.documentIntegrityFlags.length) return false; // never trust an incomplete/unsigned/template document, regardless of filename
    const topicMatch = (topic && topic.pattern.test(e.extractedText)) || (itemRef && itemRef.test(e.extractedText));
    if (!topicMatch) return false;
    return PLANNING_CLOSURE_ACCEPTANCE_PATTERN.test(e.extractedText) || PLANNING_CLOSURE_SUBMISSION_PATTERN.test(e.extractedText);
  });
  const accepted = candidates.find(e => PLANNING_CLOSURE_ACCEPTANCE_PATTERN.test(e.extractedText));
  if (accepted) return { status: STAGE3_ACTION_STATUS.CLOSED, completedAt: Date.now(), completionIds: [accepted.name] };
  if (candidates.length) return { status: STAGE3_ACTION_STATUS.EVIDENCE_RECEIVED, completedAt: null, completionIds: [candidates[0].name] };
  return { status: null, completedAt: null, completionIds: [] };
}

// Builds one Stage 3 action per planning requirement that GENUINELY
// restricts progression — consumes Planning Batch 3's OWN gate
// classification directly (governing brief §5: "Stage 3 must consume, not
// re-derive, that planning gate intelligence"). A MONITOR_ONLY or
// DOES_NOT_CURRENTLY_STOP_PROGRESS requirement (e.g. a routine biodiversity
// condition with no pre-commencement/pre-occupation wording) never becomes
// an action at all — "do not turn every planning condition into an action"
// (governing brief §1).
function buildPlanningRequirementActions(p, previous) {
  const byId = {};
  (p.planningRequirements || []).forEach(req => {
    const cls = classifyPlanningRequirementGate(req);
    if (cls.gate === PLANNING_GATE_TYPE.MONITOR_ONLY || cls.gate === PLANNING_GATE_TYPE.DOES_NOT_CURRENTLY_STOP_PROGRESS) return;
    const id = 'a-planreq-' + req.requirement_id;
    const prior = previous[id];
    const history = prior ? (prior.history || []).slice() : [{ at: Date.now(), text: 'Action created from a Planning Batch 1 planning requirement.' }];
    let closure = { status: null, completedAt: null, completionIds: [] };
    if (prior && prior.action_status === STAGE3_ACTION_STATUS.CLOSED) {
      closure = { status: STAGE3_ACTION_STATUS.CLOSED, completedAt: prior.completed_at, completionIds: (prior.completion_evidence_ids || []).slice() };
    } else {
      closure = assessPlanningRequirementClosure(req, p);
      if (prior && !closure.status) closure.status = prior.action_status; // no new signal this rebuild — keep prior status (e.g. stay EVIDENCE_RECEIVED)
    }
    const status = closure.status || STAGE3_ACTION_STATUS.OPEN;
    if (prior && prior.action_status !== status) {
      history.push({ at: Date.now(), text: `Action moved from ${prior.action_status} to ${status}${closure.completionIds.length ? ' — evidence: ' + closure.completionIds.join(', ') : ''}.` });
    }
    const evidenceRequiredToClose = planningRequirementEvidenceToClose(req, cls.gate);
    byId[id] = {
      action_id: id, project_id: p.id, source_finding_id: null,
      category: 'planning_requirement', subject: planningRequirementActionSubject(req),
      action_status: status, action_priority: planningGateActionPriority(cls.gate),
      // "Resolve before <resolveBeforeLabel>" is rendered as its OWN,
      // separate line in app.js (consuming `planning_gate` below) — kept
      // out of the action heading itself so the two never duplicate the
      // same information (governing brief §21's own suggested layout).
      customer_facing_action: req.requirement_text,
      internal_detail: req.requirement_text,
      why_required: cls.reason,
      required_information: [],
      likely_responsible_party: planningRequirementLikelyResponsibleParty(req),
      supporting_evidence_ids: [], source_files: [req.source_file], source_pages_or_sections: [],
      blocking_dependency: null,
      completion_criteria: evidenceRequiredToClose.join(' '),
      created_at: prior ? prior.created_at : Date.now(),
      completed_at: status === STAGE3_ACTION_STATUS.CLOSED ? (closure.completedAt || (prior && prior.completed_at) || Date.now()) : null,
      completion_evidence_ids: status === STAGE3_ACTION_STATUS.CLOSED ? (closure.completionIds.length ? closure.completionIds : ((prior && prior.completion_evidence_ids) || [])) : closure.completionIds,
      superseded_by: prior ? (prior.superseded_by || null) : null,
      history,
      package: [PACKAGE.PLANNING], scope: null,
      discrepancy_ids: [], authority_requirement_ids: [], missing_evidence_ids: [],
      responsibility_relationship_ids: [],
      apparent_responsibility: planningRequirementLikelyResponsibleParty(req), interface_summary: null,
      evidence_required_to_close: evidenceRequiredToClose,
      // Planning Batch 4 additive context (governing brief §2/§5): the gate
      // this action's own requirement carries, consumed (never re-derived)
      // from Planning Batch 3 — customer-facing "Resolve before" wording is
      // computed from this in app.js, never a raw enum string.
      planning_gate: cls.gate,
      planning_requirement_id: req.requirement_id,
      approved_baseline_context: null
    };
  });
  return byId;
}

// -----------------------------------------------------------------------
// Technical/statutory consultee response -> Stage 3 action. Only
// MATERIAL_OBJECTION/FURTHER_INFORMATION_REQUIRED ever create one — every
// other meaning (SUPPORT/NO_OBJECTION/NO_OBSERVATIONS/INFORMATIVE_ONLY/
// MANAGEABLE_REQUIREMENT/CONDITION_RECOMMENDED) never does (governing brief
// §1/§13/scenario I). A public/community objection is NEVER read here —
// see the module-header note above for why that would duplicate, not add,
// an action.
// -----------------------------------------------------------------------
function assessPlanningConsulteeResponseClosure(r, p) {
  const bodyTerm = (r.consultee_body || '').toLowerCase();
  if (!bodyTerm) return { status: null };
  // A LATER, genuine response from the SAME consultee body that no longer
  // carries MATERIAL_OBJECTION/FURTHER_INFORMATION_REQUIRED — reuses
  // classifyConsulteeResponse() (Planning Batch 1) directly, never a second
  // classifier or a bare keyword/filename check.
  const candidate = (p.evidence || []).find(e => {
    if (!e.extractedText) return false;
    if (e.name === r.source_file) return false;
    if (Array.isArray(e.documentIntegrityFlags) && e.documentIntegrityFlags.length) return false;
    if (e.planningDocumentType !== PLANNING_DOCUMENT_TYPE.CONSULTEE_RESPONSE) return false;
    if (!e.extractedText.toLowerCase().includes(bodyTerm)) return false;
    const cls = classifyConsulteeResponse(e.extractedText);
    return !cls.meanings.includes(CONSULTEE_RESPONSE_MEANING.MATERIAL_OBJECTION) && !cls.meanings.includes(CONSULTEE_RESPONSE_MEANING.FURTHER_INFORMATION_REQUIRED);
  });
  if (candidate) return { status: STAGE3_ACTION_STATUS.CLOSED, completedAt: Date.now(), completionIds: [candidate.name] };
  return { status: null };
}

function buildPlanningConsulteeResponseActions(p, previous) {
  const byId = {};
  (p.planningConsulteeResponses || []).forEach(r => {
    const meanings = r.meanings || [];
    const isMaterialObjection = meanings.includes(CONSULTEE_RESPONSE_MEANING.MATERIAL_OBJECTION);
    const needsAction = isMaterialObjection || meanings.includes(CONSULTEE_RESPONSE_MEANING.FURTHER_INFORMATION_REQUIRED);
    if (!needsAction) return; // SUPPORT/NO_OBJECTION/NO_OBSERVATIONS/INFORMATIVE_ONLY/MANAGEABLE_REQUIREMENT/CONDITION_RECOMMENDED never create an action
    const id = 'a-consultee-' + r.response_id;
    const prior = previous[id];
    const history = prior ? (prior.history || []).slice() : [{ at: Date.now(), text: 'Action created from a Planning Batch 1 consultee response.' }];
    let closure = (prior && prior.action_status === STAGE3_ACTION_STATUS.CLOSED)
      ? { status: STAGE3_ACTION_STATUS.CLOSED, completedAt: prior.completed_at, completionIds: (prior.completion_evidence_ids || []).slice() }
      : assessPlanningConsulteeResponseClosure(r, p);
    const status = closure.status || (prior ? prior.action_status : STAGE3_ACTION_STATUS.OPEN);
    if (prior && prior.action_status !== status) {
      history.push({ at: Date.now(), text: `Action moved from ${prior.action_status} to ${status}${(closure.completionIds || []).length ? ' — evidence: ' + closure.completionIds.join(', ') : ''}.` });
    }
    const consulteeLabel = r.consultee_body || 'The consultee';
    byId[id] = {
      action_id: id, project_id: p.id, source_finding_id: null,
      category: 'planning_consultee_response', subject: PLANNING_ACTION_SUBJECT.CONSULTEE_RESPONSE_REQUIRED,
      action_status: status, action_priority: isMaterialObjection ? 'high' : 'medium',
      customer_facing_action: `Resolve before final design/planning determination: respond to ${consulteeLabel}'s ${isMaterialObjection ? 'objection' : 'request for further information'}.`,
      internal_detail: r.note,
      why_required: isMaterialObjection
        ? `${consulteeLabel} has raised an objection that has not yet been addressed.`
        : `${consulteeLabel} has requested further information that has not yet been provided.`,
      required_information: [],
      // LPA/consultee REVIEWS the response — it is never itself the party
      // responsible for producing it (governing brief §6's own safeguard).
      likely_responsible_party: "Likely responsible party: customer's planning agent, usually with input from the relevant specialist consultant — responsibility should be confirmed.",
      supporting_evidence_ids: [], source_files: [r.source_file], source_pages_or_sections: [],
      blocking_dependency: null,
      completion_criteria: 'A further, genuine response from the same consultee body confirming the objection/request has been addressed.',
      created_at: prior ? prior.created_at : Date.now(),
      completed_at: status === STAGE3_ACTION_STATUS.CLOSED ? (closure.completedAt || (prior && prior.completed_at) || Date.now()) : null,
      completion_evidence_ids: status === STAGE3_ACTION_STATUS.CLOSED ? ((closure.completionIds && closure.completionIds.length) ? closure.completionIds : ((prior && prior.completion_evidence_ids) || [])) : (closure.completionIds || []),
      superseded_by: prior ? (prior.superseded_by || null) : null,
      history,
      package: [PACKAGE.PLANNING], scope: null,
      discrepancy_ids: [], authority_requirement_ids: [], missing_evidence_ids: [],
      responsibility_relationship_ids: [],
      apparent_responsibility: "Likely responsible party: customer's planning agent, usually with input from the relevant specialist consultant — responsibility should be confirmed.",
      interface_summary: `${consulteeLabel} reviews/comments on the application — the consultee itself is not responsible for producing the applicant's response (governing safeguard: reviewer ≠ responsible party).`,
      evidence_required_to_close: ['A further, genuine response from the same consultee body confirming the objection/request has been addressed.'],
      planning_gate: null,
      planning_requirement_id: null,
      approved_baseline_context: null
    };
  });
  return byId;
}

// -----------------------------------------------------------------------
// Planning Batch 4 — Controlled Stage 3 Impact Register review (governing
// brief §23). Reviews (never duplicates) the TWO further Planning Batch 2
// entries this batch now genuinely implements — approved-drawing-mismatch
// → Stage 3 (enriched onto the existing discrepancy action above), and
// planning condition/requirement → Stage 3 action (buildPlanningRequirement
// Actions() above). The fourth entry (portal evidence → future closure)
// remains untouched/NOT_YET_REVIEWED — Planning Batch 5 is not implemented.
// -----------------------------------------------------------------------
function reviewPlanningBatch4ImpactRegisterEntries(state) {
  if (!state) return false;
  const a = reviewStage3ImpactRegisterEntry(state, 'planning-batch2-drawing-mismatch-to-stage3', {
    review_status: STAGE3_IMPACT_REVIEW_STATUS.RESOLVED,
    notes: 'Planning Batch 2 completion report, impact 2 of 4. REVIEWED AND ADDRESSED by Planning Batch 4 (2026-08-26): the existing discrepancy-derived Stage 3 action is now enriched with planning-specific wording/closure for an approved-drawing-baseline dimension mismatch (planning_gate/approved_baseline_context fields; a genuine authority variation can now close it) — see EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 4 of 5".'
  });
  const b = reviewStage3ImpactRegisterEntry(state, 'planning-batch2-condition-requirement-to-stage3-action', {
    review_status: STAGE3_IMPACT_REVIEW_STATUS.RESOLVED,
    notes: 'Planning Batch 2 completion report, impact 3 of 4. REVIEWED AND ADDRESSED by Planning Batch 4 (2026-08-26): buildPlanningRequirementActions() now creates a genuine Stage 3 action, with contextual evidence-required-to-close, for every unresolved planning condition/pre-start requirement/third-party requirement that genuinely restricts progression — see EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 4 of 5".'
  });
  return a || b;
}

// =============================================================================
// Planning Batch 5 (2026-08-26): PUBLIC PLANNING PORTAL EVIDENCE ACQUISITION,
// INGESTION & CONTROLLED UPDATE.
//
// Builds the PROVIDER-INDEPENDENT architecture for using publicly available
// Local Planning Authority evidence as another controlled evidence source —
// never a giant council-specific scraper, never a second evidence/analysis
// engine. A planning-portal document passes through the EXACT SAME
// provenance/integrity/classification/discrepancy/authority/responsibility/
// lifecycle/approved-drawing/Stage-3-action/closure controls as an uploaded
// document — it enters via p.evidence.push() and buildProjectEvidenceLedger()
// exactly like a customer/supplier upload; nothing here re-derives anything
// Planning Batches 1-4 already decided.
//
// HONEST ARCHITECTURE BOUNDARY (see the task report §H for the full
// reasoning): this codebase is a static front-end application with no
// server component of its own, running entirely in the customer's browser.
// A real UK planning portal generally has no permissive cross-origin
// (CORS) policy, so this application cannot reach one directly from
// browser JavaScript — and building an insecure proxy to work around that
// is explicitly forbidden by the governing brief. The ONLY adapter this
// codebase actually SHIPS is therefore createNullPlanningPortalAdapter()
// below, which honestly reports MANUAL_REVIEW_REQUIRED/RETRIEVAL_BLOCKED
// and never fabricates a successful retrieval. Every function below is
// written against a pluggable ADAPTER INTERFACE so a genuine future
// council/provider adapter can be plugged in later without this planning
// intelligence engine ever needing to change — proved end-to-end in this
// batch's own test suite via a synthetic, in-memory test adapter (never
// shipped in this file).
// =============================================================================

// -----------------------------------------------------------------------
// Vocabularies
// -----------------------------------------------------------------------

const PLANNING_PORTAL_RETRIEVAL_STATUS = {
  NOT_IDENTIFIED: 'NOT_IDENTIFIED',
  REFERENCE_IDENTIFIED: 'REFERENCE_IDENTIFIED',
  PORTAL_IDENTIFIED: 'PORTAL_IDENTIFIED',
  RETRIEVAL_AVAILABLE: 'RETRIEVAL_AVAILABLE',
  RETRIEVAL_PARTIAL: 'RETRIEVAL_PARTIAL',
  RETRIEVAL_BLOCKED: 'RETRIEVAL_BLOCKED',
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
  RETRIEVED: 'RETRIEVED',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED'
};
const PLANNING_IDENTITY_CONFIDENCE = { CONFIRMED: 'CONFIRMED', LIKELY: 'LIKELY', UNCERTAIN: 'UNCERTAIN' };

// -----------------------------------------------------------------------
// Application identity — evidence-gated ONLY (governing brief §6). Never
// infers an application from an address/project-name resemblance; reuses
// Planning Batch 2's own p.planningPortalReference (application_reference/
// authority_name), itself already extracted only from genuine document
// text (Planning Batch 2's own PLANNING_APPLICATION_REFERENCE_PATTERN/
// LOCAL_PLANNING_AUTHORITY_PATTERN) — never re-derived here.
// -----------------------------------------------------------------------
function derivePlanningApplicationIdentity(p) {
  const ref = (p && p.planningPortalReference) || {};
  const hasRef = !!ref.application_reference;
  const hasAuthority = !!ref.authority_name;
  let confidence = PLANNING_IDENTITY_CONFIDENCE.UNCERTAIN;
  let reason = 'No application reference or Local Planning Authority name has been extracted from project evidence yet — never inferred from an address or project similarity alone.';
  if (hasRef && hasAuthority) { confidence = PLANNING_IDENTITY_CONFIDENCE.CONFIRMED; reason = 'Both an application reference and a Local Planning Authority name were extracted from genuine project evidence.'; }
  else if (hasRef || hasAuthority) { confidence = PLANNING_IDENTITY_CONFIDENCE.LIKELY; reason = 'Only one of the application reference / Local Planning Authority name has been extracted so far — identity is not yet fully confirmed.'; }
  return { application_reference: ref.application_reference || null, authority_name: ref.authority_name || null, confidence, reason };
}

// -----------------------------------------------------------------------
// PLANNING_PORTAL_SOURCE — the provider-independent portal-source model
// (governing brief §4). Deliberately NOT named/structured around any one
// council (no "ST_HELENS_SCRAPER"-style object anywhere in this file).
// -----------------------------------------------------------------------
function createPlanningPortalSource(fields) {
  return Object.assign({
    portal_source_id: 'portalsrc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    project_id: null,
    authority_name: null,
    application_reference: null,
    application_url: null,
    provider_type: null,                 // e.g. 'UNSUPPORTED_NO_ADAPTER' — never a council name
    identity_confidence: PLANNING_IDENTITY_CONFIDENCE.UNCERTAIN,
    retrieval_method: null,
    retrieval_status: PLANNING_PORTAL_RETRIEVAL_STATUS.NOT_IDENTIFIED,
    last_checked_at: null,
    // Metadata only, never fabricated — one entry per document the adapter's
    // own listDocuments() reported, whether or not it was selected/ingested.
    documents_discovered: [],
    documents_ingested_evidence_names: [],
    retrieval_limitations: [],
    notes: '',
    created_at: Date.now()
  }, fields);
}

// Called automatically on every planning-intelligence rebuild (from
// buildProjectPlanningIntelligence(), same as every other Planning Batch
// 1-4 structure) — updates ONLY the identity/reference fields on
// p.planningPortalSource. Never calls an adapter, never attempts
// retrieval, makes no network request of any kind — safe to run on every
// keystroke-triggered rebuild, exactly like everything else in this file.
function updatePlanningPortalIdentity(p) {
  if (!p) return;
  const identity = derivePlanningApplicationIdentity(p);
  if (!p.planningPortalSource) p.planningPortalSource = createPlanningPortalSource({ project_id: p.id });
  const src = p.planningPortalSource;
  src.authority_name = identity.authority_name;
  src.application_reference = identity.application_reference;
  src.identity_confidence = identity.confidence;
  src.notes = identity.reason;
  // Only ever moves the status off NOT_IDENTIFIED once identity is at least
  // LIKELY — never overwrites a later, more advanced retrieval_status a
  // real refresh may already have set (see refreshPlanningPortalSource()).
  if (identity.confidence === PLANNING_IDENTITY_CONFIDENCE.UNCERTAIN) {
    if (!src.retrieval_status || src.retrieval_status === PLANNING_PORTAL_RETRIEVAL_STATUS.REFERENCE_IDENTIFIED) src.retrieval_status = PLANNING_PORTAL_RETRIEVAL_STATUS.NOT_IDENTIFIED;
  } else if (!src.retrieval_status || src.retrieval_status === PLANNING_PORTAL_RETRIEVAL_STATUS.NOT_IDENTIFIED) {
    src.retrieval_status = PLANNING_PORTAL_RETRIEVAL_STATUS.REFERENCE_IDENTIFIED;
  }
}

// -----------------------------------------------------------------------
// Adapter interface (governing brief §8) — a plain-object contract, not a
// class/TypeScript interface (consistent with the rest of this file):
//   identifyApplication(identity, source) -> { status, application_url, provider_type, notes }
//   listDocuments(source)                 -> { status, documents: [{source_document_id, title, category, document_date, published_date, url, checksum}], limitations: [] }
//   fetchDocument(source, docMeta)        -> { status, text, retrieved_at }
// Any future real council/provider adapter implements exactly this shape;
// refreshPlanningPortalSource() below never assumes anything more.
// -----------------------------------------------------------------------

// The ONLY adapter actually shipped — see the module header above for why.
// Never fabricates success; every method honestly reports a blocked/manual
// status so retrieval failure can never be mistaken for "no documents"
// (governing brief §5/§30).
function createNullPlanningPortalAdapter() {
  const BLOCKED_NOTE = 'No supported automatic retrieval adapter is available for this authority in this build. Public UK planning portals do not generally permit cross-origin retrieval from a browser-only application, and this system deliberately does not use an insecure proxy to work around that. Public documents can still be added for review by uploading them.';
  return {
    provider_type: 'UNSUPPORTED_NO_ADAPTER',
    identifyApplication() { return { status: PLANNING_PORTAL_RETRIEVAL_STATUS.MANUAL_REVIEW_REQUIRED, application_url: null, provider_type: 'UNSUPPORTED_NO_ADAPTER', notes: BLOCKED_NOTE }; },
    listDocuments() { return { status: PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVAL_BLOCKED, documents: [], limitations: [BLOCKED_NOTE] }; },
    fetchDocument() { return { status: PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVAL_BLOCKED, text: null, retrieved_at: null }; }
  };
}

// -----------------------------------------------------------------------
// Document selection (governing brief §16) — controlled relevance keyword
// match against the discovered metadata only (title/category), reusing the
// SAME "transparent keyword table" style as every other classifier in this
// file. A document that doesn't match is still recorded in
// documents_discovered (metadata preserved) but not fetched/ingested.
// -----------------------------------------------------------------------
const PLANNING_PORTAL_RELEVANT_CATEGORY_PATTERN = /application form|validation|acknowledg|location plan|block plan|proposed|elevation|design and access|planning statement|consultee|representation|objection|officer|further information|revised drawing|committee|delegated|decision|condition|discharge|variation|amendment/i;
function classifyPlanningPortalDocumentRelevance(doc) {
  const text = ((doc.title || '') + ' ' + (doc.category || '')).toLowerCase();
  return PLANNING_PORTAL_RELEVANT_CATEGORY_PATTERN.test(text);
}

// -----------------------------------------------------------------------
// Duplicate control (governing brief §17) — a simple, stable content
// fingerprint (normalised text + a lightweight rolling hash; no crypto
// dependency, deliberately not claimed to be cryptographically strong).
// Used to recognise the SAME underlying document arriving from two
// sources (customer upload and portal retrieval, or two portal checks)
// WITHOUT deleting provenance from either — both source paths are always
// preserved on the surviving evidence entry.
// -----------------------------------------------------------------------
function computeTextFingerprint(text) {
  const norm = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) { hash = (hash * 31 + norm.charCodeAt(i)) | 0; }
  return norm.length + ':' + hash;
}
// Computed live from e.extractedText (never relies on a precomputed field
// being present) so a document already on the project via ANY route —
// customer upload, supplier upload, quotation, or an earlier portal check —
// is correctly recognised as the same underlying document, not just one
// deliberately tagged with a fingerprint at ingestion time.
function findExistingEvidenceByFingerprint(p, fingerprint) {
  return (p.evidence || []).find(e => e.extractedText && computeTextFingerprint(e.extractedText) === fingerprint);
}

// Ingests ONE fetched portal document into the EXISTING p.evidence array —
// never a parallel evidence store. If the SAME underlying text already
// exists on this project (customer upload, supplier upload, or an earlier
// portal check), the existing entry's provenance is extended
// (also_supplied_by_portal/portal_source_ids) rather than pushing a second,
// separately-reasoned duplicate (governing brief §17: "do not create
// duplicate facts/actions merely because the same underlying document
// arrives twice... preserve the fact that both sources supplied it").
function ingestPlanningPortalDocument(p, src, doc, fetched) {
  const fingerprint = computeTextFingerprint(fetched.text);
  const existing = findExistingEvidenceByFingerprint(p, fingerprint);
  if (existing) {
    existing.also_supplied_by_portal = true;
    existing.portal_source_ids = Array.from(new Set((existing.portal_source_ids || []).concat([src.portal_source_id])));
    return { evidenceName: existing.name, wasDuplicate: true };
  }
  const name = '[Planning portal] ' + (doc.title || doc.source_document_id || 'document');
  const entry = {
    name, size: (fetched.text || '').length, type: 'text/plain', at: fetched.retrieved_at || Date.now(),
    stage: 'Planning Portal', extractedText: fetched.text || '', extractionStatus: 'PORTAL_RETRIEVED', extractionNote: '',
    content_fingerprint: fingerprint,
    // Provenance (governing brief §13) — explicit, always distinguishable
    // from a customer upload/supplier upload/Project Check generated
    // output/manually entered fact (none of which ever set these fields).
    source_type: 'PLANNING_PORTAL',
    portal_source_id: src.portal_source_id,
    portal_source_ids: [src.portal_source_id],
    portal_document_id: doc.source_document_id || null,
    portal_authority_name: src.authority_name,
    portal_application_reference: src.application_reference,
    portal_url: doc.url || null,
    portal_document_title: doc.title || null,
    portal_document_date: doc.document_date || null,
    portal_published_date: doc.published_date || null,
    portal_retrieved_at: fetched.retrieved_at || Date.now(),
    portal_retrieval_method: src.retrieval_method,
    // Privacy (governing brief §31): this codebase performs no further
    // processing of retrieved text beyond the SAME generic fact-extraction
    // FACT_RULES already run over every other document — no signature/
    // phone-number/email harvesting logic exists anywhere in this file to
    // "promote" incidental personal data out of a public representation
    // into structured intelligence; only the same generic subjects every
    // other document is already checked against are ever extracted.
    portal_privacy_note: 'Only generic project-evidence facts are extracted from this document, exactly as from any other upload — no personal-data-specific extraction is performed.'
  };
  p.evidence.push(entry);
  return { evidenceName: name, wasDuplicate: false };
}

// -----------------------------------------------------------------------
// Refresh orchestrator (governing brief §29) — the ONE controlled
// boundary: check source -> identify -> list -> select -> fetch -> ingest
// -> rebuild -> reassess. NEVER called automatically by anything in this
// file (no timers, no background monitoring, no server cron — governing
// brief explicitly forbids all three) — only ever invoked deliberately
// (this batch's own test suite, or a future internal/dev "check portal"
// action in app.js).
// -----------------------------------------------------------------------
function refreshPlanningPortalSource(p, adapter) {
  if (!p) return null;
  adapter = adapter || createNullPlanningPortalAdapter();
  updatePlanningPortalIdentity(p);
  const src = p.planningPortalSource;
  const identity = derivePlanningApplicationIdentity(p);
  src.last_checked_at = Date.now();
  // Governing brief §6/§36 scenario C: uncertain identity NEVER triggers
  // automatic ingestion from a guessed application.
  if (identity.confidence === PLANNING_IDENTITY_CONFIDENCE.UNCERTAIN) {
    src.retrieval_status = PLANNING_PORTAL_RETRIEVAL_STATUS.NOT_IDENTIFIED;
    src.notes = identity.reason;
    return src;
  }
  const idResult = adapter.identifyApplication(identity, src) || {};
  src.provider_type = idResult.provider_type || adapter.provider_type || src.provider_type;
  src.application_url = idResult.application_url || src.application_url;
  src.retrieval_method = adapter.provider_type || src.retrieval_method;
  if (idResult.status !== PLANNING_PORTAL_RETRIEVAL_STATUS.PORTAL_IDENTIFIED && idResult.status !== PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVAL_AVAILABLE) {
    // Governing brief §5/§30: a blocked/failed/manual-review retrieval is
    // NEVER interpreted as "no planning documents exist" — nothing
    // previously discovered/ingested is touched.
    src.retrieval_status = idResult.status || PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVAL_BLOCKED;
    if (idResult.notes) src.retrieval_limitations = Array.from(new Set((src.retrieval_limitations || []).concat([idResult.notes])));
    return src;
  }
  src.retrieval_status = PLANNING_PORTAL_RETRIEVAL_STATUS.PORTAL_IDENTIFIED;
  const listResult = adapter.listDocuments(src) || {};
  if (listResult.status !== PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVAL_AVAILABLE && listResult.status !== PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVED) {
    src.retrieval_status = listResult.status || PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVAL_BLOCKED;
    if (listResult.limitations && listResult.limitations.length) src.retrieval_limitations = Array.from(new Set((src.retrieval_limitations || []).concat(listResult.limitations)));
    return src; // list genuinely unavailable — never claim documents don't exist
  }
  // Merge discovered-document metadata (never fabricated) — dedupe by the
  // adapter's own source_document_id; mark genuinely new ones (governing
  // brief §18 change detection: "new/changed" is judged by identity, never
  // by "latest upload wins").
  src.documents_discovered = src.documents_discovered || [];
  const previouslySeenIds = new Set(src.documents_discovered.map(d => d.source_document_id));
  (listResult.documents || []).forEach(doc => {
    const isNew = !previouslySeenIds.has(doc.source_document_id);
    const relevant = classifyPlanningPortalDocumentRelevance(doc);
    const existingMeta = src.documents_discovered.find(d => d.source_document_id === doc.source_document_id);
    if (existingMeta) { Object.assign(existingMeta, doc, { relevant, is_new: isNew }); }
    else { src.documents_discovered.push(Object.assign({}, doc, { relevant, is_new: isNew, ingested: false })); }
  });
  let anyFetchFailed = false;
  src.documents_discovered.filter(d => d.relevant && !d.ingested).forEach(meta => {
    const fetched = adapter.fetchDocument(src, meta) || {};
    if (fetched.status === PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVED && fetched.text) {
      const result = ingestPlanningPortalDocument(p, src, meta, fetched);
      meta.ingested = true;
      meta.duplicate_of_existing = result.wasDuplicate;
      src.documents_ingested_evidence_names = Array.from(new Set((src.documents_ingested_evidence_names || []).concat([result.evidenceName])));
    } else {
      anyFetchFailed = true;
      if (fetched.notes) src.retrieval_limitations = Array.from(new Set((src.retrieval_limitations || []).concat([fetched.notes])));
    }
  });
  src.retrieval_status = anyFetchFailed ? PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVAL_PARTIAL : PLANNING_PORTAL_RETRIEVAL_STATUS.RETRIEVED;
  // Rebuild through the EXISTING ledger/finding/action pipeline — the SAME
  // functions an uploaded document already flows through; no parallel
  // "portalDocumentFacts()"/"portalPlanningEngine()" of any kind.
  buildProjectEvidenceLedger(p);
  if (typeof buildStage2Findings === 'function') buildStage2Findings(p);
  if (typeof buildStage3Actions === 'function') buildStage3Actions(p);
  return p.planningPortalSource;
}

// -----------------------------------------------------------------------
// Planning Batch 5 — Controlled Stage 3 Impact Register review (governing
// brief §33). The FINAL of the four governed Planning Batch 2 entries —
// "planning portal evidence → future closure" — reviewed to RESOLVED only
// because the controlled evidence→existing-closure path is genuinely
// built and proven end-to-end in this batch's own tests (ingestion via
// refreshPlanningPortalSource() feeding the EXACT SAME Planning Batch 4
// closure assessment, never a shortcut). The shipped default adapter never
// achieves live retrieval on its own (see the module header) — that
// honest limitation is recorded in this same note, not hidden.
// -----------------------------------------------------------------------
function reviewPlanningBatch5ImpactRegisterEntries(state) {
  if (!state) return false;
  return reviewStage3ImpactRegisterEntry(state, 'planning-batch2-portal-evidence-to-future-closure', {
    review_status: STAGE3_IMPACT_REVIEW_STATUS.RESOLVED,
    notes: 'Planning Batch 2 completion report, impact 4 of 4. REVIEWED AND ADDRESSED by Planning Batch 5 (2026-08-26): refreshPlanningPortalSource()/ingestPlanningPortalDocument() feed retrieved planning evidence through the EXISTING evidence ledger, so a genuine condition-discharge/variation decision retrieved from a portal can close the exact matching Planning Batch 4 action through its EXISTING closure assessment — proven end-to-end via a synthetic test adapter. HONEST LIMITATION preserved here, not hidden: the only adapter actually shipped (createNullPlanningPortalAdapter()) never achieves live retrieval itself (no real UK council/provider adapter exists yet) — every live retrieval attempt in production reports MANUAL_REVIEW_REQUIRED/RETRIEVAL_BLOCKED with the existing manual-upload fallback, never a fabricated success. See EVIDENCE-INTELLIGENCE-SPEC.md § "Planning Intelligence — Planning Batch 5 of 5".'
  });
}
