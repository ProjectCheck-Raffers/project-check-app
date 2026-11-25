// Project Check Brain — regression tests for stage-1/compressed-programme-risk.js
// Migration Slice 3. Zero-dependency: Node's built-in test runner
// (node --test) and assert/strict only — no test framework added.
//
// Run with:  node --test tests/stage-1/compressed-programme-risk.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainCompressedProgrammeRisk,
  PC_BRAIN_COMPRESSED_PROGRAMME_RISK_PROVENANCE,
  PC_BRAIN_COMPRESSED_PROGRAMME_VERSION,
  PC_BRAIN_COMPRESSED_PROGRAMME_CONTRACT_VERSION
} = require('../../stage-1/compressed-programme-risk.js');

// OLD implementation, captured verbatim from the application repository's
// app.js runStage1Risks(), as it exists at commit
// 6dbd6fdcdb86a389a0af0376a87f81b2dc02d607 (and, per the traced git -S
// history, unchanged since 5a0e0d5) — the independent behaviour-preservation
// oracle for this slice. Never "improved"; its only job is to prove the new
// rule matches the old one.
function OLD_compressedProgrammeRisk(programme) {
  if (programme === '0–3 months') {
    return {
      text: 'The requested programme is compressed relative to the approvals, design, civils, manufacture and installation stages that may still be required.',
      category: 'programme',
      discipline: 'general'
    };
  }
  return null;
}

// The five fixed stage1Questions[] 'programme' options, plus the required
// unset/undefined/edge cases from the Slice 3 authorisation.
const CASES = [
  '0–3 months', '3–6 months', '6–12 months', '12+ months', 'Not decided',
  '', null, undefined,
  '0-3 months', // plain hyphen, not the en dash — must NOT match
  '0–3 Months', // case variant — must NOT match
  ' 0–3 months', '0–3 months ', // whitespace variants — must NOT match
  'Unknown'
];

test('behaviour-preservation: pcBrainCompressedProgrammeRisk matches OLD_compressedProgrammeRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(
      pcBrainCompressedProgrammeRisk(input),
      OLD_compressedProgrammeRisk(input),
      `mismatch for input ${JSON.stringify(input)}`
    );
  }
});

test("programme === '0–3 months' produces the exact original text/category/discipline", () => {
  assert.deepStrictEqual(pcBrainCompressedProgrammeRisk('0–3 months'), {
    text: 'The requested programme is compressed relative to the approvals, design, civils, manufacture and installation stages that may still be required.',
    category: 'programme',
    discipline: 'general'
  });
});

// The exact minimum case set required by the Slice 3 authorisation.
test('required case set: 3–6 / 6–12 / 12+ months, Not decided, and unset/undefined all produce null', () => {
  for (const input of ['3–6 months', '6–12 months', '12+ months', 'Not decided', undefined]) {
    assert.strictEqual(pcBrainCompressedProgrammeRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('empty string, null, hyphen/case/whitespace variants, and unrecognised legacy values all produce null', () => {
  for (const input of ['', null, '0-3 months', '0–3 Months', ' 0–3 months', '0–3 months ', 'Unknown']) {
    assert.strictEqual(pcBrainCompressedProgrammeRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the provenance gap is recorded', () => {
  const p = PC_BRAIN_COMPRESSED_PROGRAMME_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.source_function, 'runStage1Risks()');
  assert.strictEqual(p.source_baseline_commit, '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029');
  assert.strictEqual(p.brain_version, PC_BRAIN_COMPRESSED_PROGRAMME_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_COMPRESSED_PROGRAMME_CONTRACT_VERSION);
});

test('rule outputs conform to schemas/compressed-programme-risk.schema.json', () => {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'compressed-programme-risk.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.ok(schema.$defs && schema.$defs.RiskOutput, 'schema must define RiskOutput');
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  assert.strictEqual(objectBranch.properties.text.const, 'The requested programme is compressed relative to the approvals, design, civils, manufacture and installation stages that may still be required.');
  assert.strictEqual(objectBranch.properties.category.const, 'programme');
  assert.strictEqual(objectBranch.properties.discipline.const, 'general');

  for (const input of ['0–3 months', '3–6 months', '6–12 months', '12+ months', 'Not decided', '']) {
    const output = pcBrainCompressedProgrammeRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
