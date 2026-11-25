// Project Check Brain — regression tests for stage-1/base-surface-risk.js.
// Stage 1 Brain Completion Batch. Zero-dependency: Node's built-in test
// runner (node --test) and assert/strict only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainBaseSurfaceRisk,
  PC_BRAIN_BASE_SURFACE_RISK_PROVENANCE,
  PC_BRAIN_BASE_SURFACE_TRIGGER_VALUES,
  PC_BRAIN_BASE_SURFACE_VERSION,
  PC_BRAIN_BASE_SURFACE_CONTRACT_VERSION
} = require('../../stage-1/base-surface-risk.js');

// OLD implementation, captured verbatim from app.js at commit
// 0d511a3e1274c109d1d2e76831e53b3b0c93ac74 — independent oracle. 5-way OR,
// exact match — the legacy pre-27-Aug strings are deliberately NOT matched.
function OLD_baseSurfaceRisk(base) {
  if (base === 'Tarmac / asphalt' || base === 'Hardcore / stone' || base === 'Soil / grass' || base === 'Existing building / structure' || base === 'Mixed') {
    return {
      text: 'The visible surface does not by itself confirm a suitable structural foundation or slab.',
      category: 'cost',
      discipline: 'civils'
    };
  }
  return null;
}

const CASES = [
  'Tarmac / asphalt', 'Hardcore / stone', 'Soil / grass', 'Existing building / structure', 'Mixed',
  'Concrete slab', 'Not sure', '', null, undefined,
  'Stone / hardcore', 'Grass / soil' // legacy pre-27-Aug strings — must NOT match
];

test('behaviour-preservation: pcBrainBaseSurfaceRisk matches OLD_baseSurfaceRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(pcBrainBaseSurfaceRisk(input), OLD_baseSurfaceRisk(input), `mismatch for ${JSON.stringify(input)}`);
  }
});

test('all 5 current trigger values produce the exact original risk', () => {
  for (const input of PC_BRAIN_BASE_SURFACE_TRIGGER_VALUES) {
    assert.deepStrictEqual(pcBrainBaseSurfaceRisk(input), {
      text: 'The visible surface does not by itself confirm a suitable structural foundation or slab.',
      category: 'cost',
      discipline: 'civils'
    }, `expected the risk for ${JSON.stringify(input)}`);
  }
  assert.deepStrictEqual(PC_BRAIN_BASE_SURFACE_TRIGGER_VALUES, ['Tarmac / asphalt', 'Hardcore / stone', 'Soil / grass', 'Existing building / structure', 'Mixed']);
});

// Deliberately-preserved nuance: the two renamed legacy strings must NOT match.
test("the two legacy pre-27-Aug strings 'Stone / hardcore'/'Grass / soil' produce NO risk — deliberately not broadened to match them", () => {
  assert.strictEqual(pcBrainBaseSurfaceRisk('Stone / hardcore'), null);
  assert.strictEqual(pcBrainBaseSurfaceRisk('Grass / soil'), null);
});

test("'Concrete slab', 'Not sure', empty string, null and undefined all produce no risk", () => {
  for (const input of ['Concrete slab', 'Not sure', '', null, undefined]) {
    assert.strictEqual(pcBrainBaseSurfaceRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the value-extension (not mere rename) is recorded', () => {
  const p = PC_BRAIN_BASE_SURFACE_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.original_baseline_commit, '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029');
  assert.strictEqual(p.value_extension_commit, '998ef610b3bbc91071cbeac2651c919520a08119');
  assert.match(p.value_extension_note, /real behavioural extension/i);
  assert.strictEqual(p.brain_version, PC_BRAIN_BASE_SURFACE_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_BASE_SURFACE_CONTRACT_VERSION);
});

test('rule outputs conform to schemas/base-surface-risk.schema.json', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'base-surface-risk.schema.json'), 'utf8'));
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  for (const input of [...PC_BRAIN_BASE_SURFACE_TRIGGER_VALUES, 'Concrete slab', undefined]) {
    const output = pcBrainBaseSurfaceRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
