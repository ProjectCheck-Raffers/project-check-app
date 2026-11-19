// Focused Playwright coverage for the Common Evidence Intelligence Layer —
// Batch 1 (2026-08-27): Document Identity & Provenance (see evidence.js,
// "COMMON EVIDENCE INTELLIGENCE LAYER — Batch 1" section, and
// EVIDENCE-INTELLIGENCE-SPEC.md). Calls the real shipped functions directly
// in the browser (evidence.js is a classic <script>, so its top-level
// function declarations are on window) — pure logic, no login/project flow
// needed, same pattern as geometry-functions.spec.js.
//
// Synthetic fixtures only — no real project/customer/supplier/professional
// names, addresses, drawing numbers, commercial figures, or other
// proprietary content anywhere in this file, per instruction.
const { test, expect } = require('@playwright/test');

test.describe('Common Evidence Intelligence Layer — Document Identity & Provenance (Batch 1)', () => {

  test('A: document identity can be created with partial evidence', async ({ page }) => {
    await page.goto('/');
    const identity = await page.evaluate(() => createDocumentIdentity({ project_id: 'proj-a', document_family: 'structural_report_calculation' }));
    expect(identity.project_id).toBe('proj-a');
    expect(identity.document_family).toBe('structural_report_calculation');
    expect(identity.document_identity_id).toBeTruthy();
  });

  test('B: unknown fields remain unknown (null), never fabricated', async ({ page }) => {
    await page.goto('/');
    const identity = await page.evaluate(() => createDocumentIdentity({ project_id: 'proj-b' }));
    expect(identity.document_number).toBeNull();
    expect(identity.revision).toBeNull();
    expect(identity.status).toBeNull();
    expect(identity.document_date).toBeNull();
    expect(identity.originator).toBeNull();
    expect(identity.authority).toBeNull();
    expect(identity.document_title).toBeNull();
    expect(identity.current_applicability).toBe('CURRENT_APPLICABILITY_UNKNOWN');
  });

  test('C: source location (delivery_source) does not become originator', async ({ page }) => {
    await page.goto('/');
    const identity = await page.evaluate(() => {
      const e = { name: 'portal-doc.txt', source_type: 'PLANNING_PORTAL', portal_authority_name: 'A Local Planning Authority', extractedText: 'plain text' };
      return buildDocumentIdentity(e, { id: 'proj-c' });
    });
    expect(identity.delivery_source).toBe('PLANNING_PORTAL');
    expect(identity.originator).toBeNull(); // delivery source is populated; originator must stay unknown regardless
  });

  test('D: originator does not become authority', async ({ page }) => {
    await page.goto('/');
    const identity = await page.evaluate(() => createDocumentIdentity({ project_id: 'proj-d', originator: 'A Design Consultant' }));
    expect(identity.originator).toBe('A Design Consultant');
    expect(identity.authority).toBeNull(); // setting originator must never populate authority
  });

  test('E: uploader/source does not become originator', async ({ page }) => {
    await page.goto('/');
    const identity = await page.evaluate(() => {
      const e = { name: 'uploaded-file.txt', extractedText: 'no revision or status wording here' }; // a plain customer/supplier upload — no source_type set
      return buildDocumentIdentity(e, { id: 'proj-e' });
    });
    expect(identity.delivery_source).toBe('UPLOAD');
    expect(identity.originator).toBeNull(); // the fact that Project Check received an uploaded file never becomes a claim about who wrote it
  });

  test('F: identical-looking documents in different projects are never matched/merged', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: 'proj-f1', document_number: 'DWG-100', revision: 'A', content_fingerprint: '10:12345' });
      const b = createDocumentIdentity({ project_id: 'proj-f2', document_number: 'DWG-100', revision: 'A', content_fingerprint: '10:12345' });
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).toBe('NO_MATCH');
    expect(result.reason.toLowerCase()).toContain('different, identified projects');
  });

  test('G: exact matching requires sufficient evidence (a single weak signal is not exact)', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: 'proj-g', document_family: 'structural_report_calculation' });
      const b = createDocumentIdentity({ project_id: 'proj-g', document_family: 'structural_report_calculation' });
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).not.toBe('EXACT_MATCH');
    expect(result.certainty).toBe('POSSIBLE_MATCH');
  });

  test('H: filename-only similarity can never produce EXACT_MATCH', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: 'proj-h', source_file: 'report.pdf' });
      const b = createDocumentIdentity({ project_id: 'proj-h', source_file: 'report.pdf' });
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).not.toBe('EXACT_MATCH');
    expect(result.certainty).toBe('POSSIBLE_MATCH');
    expect(result.matched_signals).toEqual(['source_file']);
  });

  test('I: probable and possible matching remain distinguishable from exact and from each other', async ({ page }) => {
    await page.goto('/');
    const results = await page.evaluate(() => {
      const exact = assessDocumentIdentityMatch(
        createDocumentIdentity({ project_id: 'proj-i', content_fingerprint: '5:999' }),
        createDocumentIdentity({ project_id: 'proj-i', content_fingerprint: '5:999' })
      );
      const probable = assessDocumentIdentityMatch(
        createDocumentIdentity({ project_id: 'proj-i', document_family: 'drawing', document_date: '2026-01-01' }),
        createDocumentIdentity({ project_id: 'proj-i', document_family: 'drawing', document_date: '2026-01-01' })
      );
      const possible = assessDocumentIdentityMatch(
        createDocumentIdentity({ project_id: 'proj-i', document_family: 'drawing' }),
        createDocumentIdentity({ project_id: 'proj-i', document_family: 'other_project_evidence' })
      );
      return { exact, probable, possible };
    });
    expect(results.exact.certainty).toBe('EXACT_MATCH');
    expect(results.probable.certainty).toBe('PROBABLE_MATCH');
    expect(results.possible.certainty).toBe('IDENTITY_UNKNOWN');
    // all three genuinely distinct from each other
    const set = new Set([results.exact.certainty, results.probable.certainty, results.possible.certainty]);
    expect(set.size).toBe(3);
  });

  test('J: revision and status remain separate concepts', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const text = 'Revision: B\nStatus: FOR APPROVAL\nThis drawing shows the proposed layout.';
      return { revision: detectDocumentRevisionToken(text), status: detectDocumentStatusToken(text) };
    });
    expect(result.revision.value).toBe('B');
    expect(result.status.value).toBe('FOR APPROVAL');
    expect(result.revision.value).not.toBe(result.status.value);
  });

  test('K: "FOR APPROVAL" is never converted to "APPROVED"', async ({ page }) => {
    await page.goto('/');
    const identity = await page.evaluate(() => {
      const e = { name: 'submission.txt', extractedText: 'Issue status: FOR APPROVAL. Rev A.' };
      return buildDocumentIdentity(e, { id: 'proj-k' });
    });
    expect(identity.status).toBe('FOR APPROVAL');
    expect(identity.status).not.toBe('APPROVED');
    // and it must not be treated as confirmed-current on that basis alone
    expect(identity.current_applicability).toBe('CURRENT_APPLICABILITY_UNKNOWN');
  });

  test('L: a newer/higher revision alone never establishes current applicability', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const older = buildDocumentIdentity({ name: 'x.txt', extractedText: 'Revision: A. General arrangement drawing.' }, { id: 'proj-l' });
      const newer = buildDocumentIdentity({ name: 'y.txt', extractedText: 'Revision: C. General arrangement drawing.' }, { id: 'proj-l' });
      return { older: older.current_applicability, newer: newer.current_applicability };
    });
    // Neither the earlier (A) nor the later (C) revision is granted currency
    // merely because one has a "higher" letter — both stay UNKNOWN absent
    // independent evidence, and neither is ever KNOWN_CURRENT from this
    // batch's logic alone.
    expect(result.older).toBe('CURRENT_APPLICABILITY_UNKNOWN');
    expect(result.newer).toBe('CURRENT_APPLICABILITY_UNKNOWN');
    expect(result.newer).not.toBe('KNOWN_CURRENT');
  });

  test('M: legacy evidence lacking the new identity fields remains usable', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      // Simulates a project saved before Batch 1 existed: a plain p.evidence
      // entry with none of documentType/packages/documentIdentity/etc. set.
      const legacyProject = { id: 'proj-m', evidence: [{ name: 'old-upload.txt', extractedText: 'Some historic project evidence text.', at: 1000, size: 42, type: 'text/plain' }] };
      let threw = null;
      let record;
      try {
        buildProjectEvidenceLedger(legacyProject);
        record = legacyProject.evidence[0];
      } catch (err) {
        threw = String(err && err.message || err);
      }
      return { threw, hasIdentity: !!(record && record.documentIdentity), identityProjectId: record && record.documentIdentity && record.documentIdentity.project_id };
    });
    expect(result.threw).toBeNull();
    expect(result.hasIdentity).toBe(true);
    expect(result.identityProjectId).toBe('proj-m');
  });

  // ---------------------------------------------------------------------
  // Precision repair (2026-08-27): unknown/unidentified project association
  // must never be treated the same as a confirmed, known, different project.
  // Unknown evidence must not become negative evidence — and must not be
  // used as a safe basis for a confident match either.
  // ---------------------------------------------------------------------

  test('N: known project A vs known project B still correctly returns NO_MATCH', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: 'proj-n1', document_number: 'DWG-200', revision: 'A' });
      const b = createDocumentIdentity({ project_id: 'proj-n2', document_number: 'DWG-200', revision: 'A' });
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).toBe('NO_MATCH');
  });

  test('O: one known project + one unknown project is NOT automatically NO_MATCH', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      // No other identity signal agrees either, so this isolates the
      // project-association question specifically (see test R below for
      // the case where other signals DO agree alongside an unknown project).
      const a = createDocumentIdentity({ project_id: 'proj-o' });
      const b = createDocumentIdentity({ project_id: null }); // project genuinely not identified for this document
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).not.toBe('NO_MATCH');
    expect(result.certainty).toBe('IDENTITY_UNKNOWN');
  });

  test('P: both projects unknown produces a conservative result, never an unsafe exact match', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: null });
      const b = createDocumentIdentity({ project_id: null });
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).not.toBe('NO_MATCH');
    expect(result.certainty).not.toBe('EXACT_MATCH');
    expect(result.certainty).toBe('IDENTITY_UNKNOWN');
  });

  test('Q: filename-only agreement with unknown project association can never produce EXACT_MATCH', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: null, source_file: 'shared-name.pdf' });
      const b = createDocumentIdentity({ project_id: null, source_file: 'shared-name.pdf' });
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).not.toBe('EXACT_MATCH');
    expect(result.certainty).not.toBe('NO_MATCH');
    expect(result.certainty).toBe('POSSIBLE_MATCH');
  });

  test('R: strong content/number/revision agreement with unknown project stays conservative and never bypasses project isolation', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: null, document_number: 'DWG-300', revision: 'B', content_fingerprint: '9:5555', document_date: '2026-02-02' });
      const b = createDocumentIdentity({ project_id: null, document_number: 'DWG-300', revision: 'B', content_fingerprint: '9:5555', document_date: '2026-02-02' });
      return assessDocumentIdentityMatch(a, b);
    });
    // Multiple strong signals agree, but neither document's project
    // association is confirmed — this must be capped below EXACT_MATCH and
    // must never be silently treated as a safe cross-project (or
    // project-unknown) merge.
    expect(result.certainty).not.toBe('EXACT_MATCH');
    expect(result.certainty).not.toBe('NO_MATCH');
    expect(result.certainty).toBe('PROBABLE_MATCH');
    expect(result.reason.toLowerCase()).toContain('not confirmed');
  });

  test('S: same KNOWN project still reaches EXACT_MATCH exactly as before this repair', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const a = createDocumentIdentity({ project_id: 'proj-s', content_fingerprint: '3:777' });
      const b = createDocumentIdentity({ project_id: 'proj-s', content_fingerprint: '3:777' });
      return assessDocumentIdentityMatch(a, b);
    });
    expect(result.certainty).toBe('EXACT_MATCH');
  });

});
