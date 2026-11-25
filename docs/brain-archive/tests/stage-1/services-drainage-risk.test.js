// Project Check Brain — regression tests for stage-1/services-drainage-risk.js
// Migration Slice 4. Zero-dependency: Node's built-in test runner
// (node --test) and assert/strict only — no test framework added.
//
// Run with:  node --test tests/stage-1/services-drainage-risk.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainServicesDrainageRisk,
  PC_BRAIN_SERVICES_DRAINAGE_RISK_PROVENANCE,
  PC_BRAIN_SERVICES_DRAINAGE_VERSION,
  PC_BRAIN_SERVICES_DRAINAGE_CONTRACT_VERSION
} = require('../../stage-1/services-drainage-risk.js');

// OLD implementation, captured verbatim from the application repository's
// app.js runStage1Risks(), as it exists at commit
// 2bc3e23b4e88c3699767b65597725ec617c6654d (and, per the traced git -S
// history, unchanged since 5a0e0d5) — the independent behaviour-preservation
// oracle for this slice. Never "improved"; its only job is to prove the new
// rule matches the old one. Note: this is an inequality against a single
// literal, NOT an allowlist — must not be reinterpreted.
function OLD_servicesDrainageRisk(services) {
  if (services !== 'No') {
    return {
      text: 'Services or drainage within the footprint may affect the building position, foundations or programme.',
      category: 'cost',
      discipline: 'civils'
    };
  }
  return null;
}

// The three fixed stage1Questions[] 'services' options, plus the required
// unset/undefined/edge cases from the Slice 4 authorisation. Per the
// authorisation: unset/undefined MUST trigger the risk (inequality
// behaviour) — this is deliberately exercised, not treated as an oversight.
const CASES = [
  'Yes', 'No', 'Not sure',
  '', null, undefined,
  'no', 'NO', ' No', 'No ', // case/whitespace variants — must NOT match 'No', so must trigger the risk
  'Unknown'
];

test('behaviour-preservation: pcBrainServicesDrainageRisk matches OLD_servicesDrainageRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(
      pcBrainServicesDrainageRisk(input),
      OLD_servicesDrainageRisk(input),
      `mismatch for input ${JSON.stringify(input)}`
    );
  }
});

test("services === 'Yes' produces the exact original text/category/discipline", () => {
  assert.deepStrictEqual(pcBrainServicesDrainageRisk('Yes'), {
    text: 'Services or drainage within the footprint may affect the building position, foundations or programme.',
    category: 'cost',
    discipline: 'civils'
  });
});

test("services === 'No' produces no risk", () => {
  assert.strictEqual(pcBrainServicesDrainageRisk('No'), null);
});

test("services === 'Not sure' produces the exact original text/category/discipline", () => {
  assert.deepStrictEqual(pcBrainServicesDrainageRisk('Not sure'), {
    text: 'Services or drainage within the footprint may affect the building position, foundations or programme.',
    category: 'cost',
    discipline: 'civils'
  });
});

// The specific Slice 4 authorisation requirement: unset/undefined MUST
// trigger the risk (preserving the original inequality behaviour, not
// reinterpreted as "no answer given" -> "no risk").
test('services === undefined (unset) produces the exact original risk — inequality behaviour deliberately preserved', () => {
  assert.deepStrictEqual(pcBrainServicesDrainageRisk(undefined), {
    text: 'Services or drainage within the footprint may affect the building position, foundations or programme.',
    category: 'cost',
    discipline: 'civils'
  });
});

test('empty string, null, and case/whitespace variants of "No" all still produce the risk (inequality, not an allowlist)', () => {
  for (const input of ['', null, 'no', 'NO', ' No', 'No ', 'Unknown']) {
    assert.deepStrictEqual(pcBrainServicesDrainageRisk(input), {
      text: 'Services or drainage within the footprint may affect the building position, foundations or programme.',
      category: 'cost',
      discipline: 'civils'
    }, `expected the risk for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the provenance gap is recorded', () => {
  const p = PC_BRAIN_SERVICES_DRAINAGE_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.source_function, 'runStage1Risks()');
  assert.strictEqual(p.source_baseline_commit, '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029');
  assert.strictEqual(p.brain_version, PC_BRAIN_SERVICES_DRAINAGE_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_SERVICES_DRAINAGE_CONTRACT_VERSION);
});

// The Slice 4 authorisation's specific requirement: the 27 August
// question-wording reword must be recorded distinctly from this rule's own
// unchanged behaviour, never conflated.
test('question-wording provenance note is recorded, and does not imply the rule itself changed', () => {
  const p = PC_BRAIN_SERVICES_DRAINAGE_RISK_PROVENANCE;
  assert.match(p.question_wording_provenance_note, /reworded 27 August 2026/);
  assert.match(p.question_wording_provenance_note, /did NOT change/);
  assert.match(p.inequality_behaviour_note, /not an allowlist/);
});

test('rule outputs conform to schemas/services-drainage-risk.schema.json', () => {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'services-drainage-risk.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.ok(schema.$defs && schema.$defs.RiskOutput, 'schema must define RiskOutput');
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  assert.strictEqual(objectBranch.properties.text.const, 'Services or drainage within the footprint may affect the building position, foundations or programme.');
  assert.strictEqual(objectBranch.properties.category.const, 'cost');
  assert.strictEqual(objectBranch.properties.discipline.const, 'civils');

  for (const input of ['Yes', 'No', 'Not sure', '', undefined]) {
    const output = pcBrainServicesDrainageRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
