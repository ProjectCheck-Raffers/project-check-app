// Project Check Brain — regression tests for stage-1/heated-building-risk.js
// Migration Slice 2. Zero-dependency: Node's built-in test runner
// (node --test) and assert/strict only — no test framework added.
//
// Run with:  node --test tests/stage-1/heated-building-risk.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainHeatedBuildingRisk,
  PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE,
  PC_BRAIN_HEATED_RISK_VERSION,
  PC_BRAIN_HEATED_RISK_CONTRACT_VERSION
} = require('../../stage-1/heated-building-risk.js');

// OLD implementation, captured verbatim from the application repository's
// app.js runStage1Risks(), as it existed at commit
// 90c1c94ba63cf18f9d21bbe7ee1a18094cb90432, BEFORE this migration — the
// independent behaviour-preservation oracle for this slice. Never
// "improved"; its only job is to prove the new rule matches the old one.
function OLD_heatedBuildingRisk(heated) {
  if (heated === 'Yes') {
    return {
      text: 'A heated building introduces thermal-performance and energy-compliance requirements that need to be coordinated with the building specification.',
      category: 'cost',
      discipline: 'engineering'
    };
  }
  return null;
}

const CASES = [
  'Yes', 'No', 'Not sure',
  '', null, undefined,
  'yes', 'YES', ' Yes', 'Yes ', 'Unknown', 'true'
];

test('behaviour-preservation: pcBrainHeatedBuildingRisk matches OLD_heatedBuildingRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(
      pcBrainHeatedBuildingRisk(input),
      OLD_heatedBuildingRisk(input),
      `mismatch for input ${JSON.stringify(input)}`
    );
  }
});

test('heated === "Yes" produces the exact original text/category/discipline', () => {
  assert.deepStrictEqual(pcBrainHeatedBuildingRisk('Yes'), {
    text: 'A heated building introduces thermal-performance and energy-compliance requirements that need to be coordinated with the building specification.',
    category: 'cost',
    discipline: 'engineering'
  });
});

test('No / Not sure / empty / null / undefined / case / whitespace variants all produce null', () => {
  for (const input of ['No', 'Not sure', '', null, undefined, 'yes', 'YES', ' Yes', 'Yes ', 'Unknown', 'true']) {
    assert.strictEqual(pcBrainHeatedBuildingRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the provenance gap is recorded', () => {
  assert.strictEqual(PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE.status, 'LOCKED-EXISTING');
  assert.strictEqual(PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE.source_function, 'runStage1Risks()');
  assert.strictEqual(PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE.brain_version, PC_BRAIN_HEATED_RISK_VERSION);
  assert.strictEqual(PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE.contract_version, PC_BRAIN_HEATED_RISK_CONTRACT_VERSION);
});

// SPA correction (2026-08-28): the committed-baseline commit and the
// engineering-discipline working-tree provenance must be recorded as two
// distinct facts, never conflated — see BRAIN-MIGRATION-REGISTER.md row
// BRAIN-0002 and this repository's CHANGELOG.md corrective entry.
test('committed-source-baseline and live-migration-source-state provenance are recorded distinctly, not conflated', () => {
  const p = PC_BRAIN_HEATED_BUILDING_RISK_PROVENANCE;
  assert.strictEqual(p.committed_source_baseline_commit, '90c1c94ba63cf18f9d21bbe7ee1a18094cb90432');
  assert.match(p.committed_source_baseline_note, /does not contain/i);
  assert.match(p.live_migration_source_state, /working-tree baseline/i);
  assert.strictEqual(p.discipline_provenance_status, 'pre-existing working-tree baseline at migration start; individual committed provenance not yet established');
});

// Minimal, dependency-free structural check against the JSON Schema contract
// (no ajv/validator library added — consistent with Slice 1 and Brain
// Architecture v1 §D, "do not add unnecessary dependencies").
test('rule outputs conform to schemas/heated-building-risk.schema.json', () => {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'heated-building-risk.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.ok(schema.$defs && schema.$defs.RiskOutput, 'schema must define RiskOutput');
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  assert.strictEqual(objectBranch.properties.text.const, 'A heated building introduces thermal-performance and energy-compliance requirements that need to be coordinated with the building specification.');
  assert.strictEqual(objectBranch.properties.category.const, 'cost');
  assert.strictEqual(objectBranch.properties.discipline.const, 'engineering');

  for (const input of ['Yes', 'No', 'Not sure', '']) {
    const output = pcBrainHeatedBuildingRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
