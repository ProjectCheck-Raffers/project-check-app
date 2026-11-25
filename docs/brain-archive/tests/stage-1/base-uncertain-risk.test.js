// Project Check Brain — regression tests for
// stage-1/base-uncertain-risk.js. Stage 1 Brain Completion Batch.
// Zero-dependency: Node's built-in test runner (node --test) and
// assert/strict only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainBaseUncertainRisk,
  PC_BRAIN_BASE_UNCERTAIN_RISK_PROVENANCE,
  PC_BRAIN_BASE_UNCERTAIN_VERSION,
  PC_BRAIN_BASE_UNCERTAIN_CONTRACT_VERSION
} = require('../../stage-1/base-uncertain-risk.js');

// OLD implementation, captured verbatim from app.js at commit
// 0d511a3e1274c109d1d2e76831e53b3b0c93ac74 — independent oracle. Exact
// match — the legacy 'Unknown' string is deliberately NOT matched.
function OLD_baseUncertainRisk(base) {
  if (base === 'Not sure') {
    return {
      text: 'Existing surface/base information is incomplete, so foundation and slab suitability cannot yet be relied upon.',
      category: 'cost',
      discipline: 'civils'
    };
  }
  return null;
}

const CASES = ['Not sure', 'Unknown', 'Concrete slab', 'Tarmac / asphalt', '', null, undefined];

test('behaviour-preservation: pcBrainBaseUncertainRisk matches OLD_baseUncertainRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(pcBrainBaseUncertainRisk(input), OLD_baseUncertainRisk(input), `mismatch for ${JSON.stringify(input)}`);
  }
});

test("base === 'Not sure' produces the exact original risk", () => {
  assert.deepStrictEqual(pcBrainBaseUncertainRisk('Not sure'), {
    text: 'Existing surface/base information is incomplete, so foundation and slab suitability cannot yet be relied upon.',
    category: 'cost',
    discipline: 'civils'
  });
});

// Deliberately-preserved nuance: the legacy pre-27-Aug value must NOT match.
test("the legacy pre-27-Aug value 'Unknown' produces NO risk — deliberately not broadened to match it", () => {
  assert.strictEqual(pcBrainBaseUncertainRisk('Unknown'), null);
});

test("'Concrete slab', surface-risk options, empty string, null and undefined all produce no risk", () => {
  for (const input of ['Concrete slab', 'Tarmac / asphalt', '', null, undefined]) {
    assert.strictEqual(pcBrainBaseUncertainRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the two-point provenance is recorded', () => {
  const p = PC_BRAIN_BASE_UNCERTAIN_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.original_baseline_commit, '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029');
  assert.strictEqual(p.value_rename_commit, '998ef610b3bbc91071cbeac2651c919520a08119');
  assert.strictEqual(p.brain_version, PC_BRAIN_BASE_UNCERTAIN_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_BASE_UNCERTAIN_CONTRACT_VERSION);
});

test('rule outputs conform to schemas/base-uncertain-risk.schema.json', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'base-uncertain-risk.schema.json'), 'utf8'));
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  for (const input of ['Not sure', 'Unknown', '', undefined]) {
    const output = pcBrainBaseUncertainRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
