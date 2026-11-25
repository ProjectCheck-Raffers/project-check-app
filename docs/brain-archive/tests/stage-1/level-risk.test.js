// Project Check Brain — regression tests for stage-1/level-risk.js.
// Stage 1 Brain Completion Batch. Zero-dependency: Node's built-in test
// runner (node --test) and assert/strict only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainLevelRisk,
  PC_BRAIN_LEVEL_RISK_PROVENANCE,
  PC_BRAIN_LEVEL_RISK_VERSION,
  PC_BRAIN_LEVEL_RISK_CONTRACT_VERSION
} = require('../../stage-1/level-risk.js');

// OLD implementation, captured verbatim from app.js at commit
// 0d511a3e1274c109d1d2e76831e53b3b0c93ac74 — the independent
// behaviour-preservation oracle. Exact match against 'No'/'Not sure' only —
// the legacy 'No / gradient present' string is deliberately NOT matched,
// preserving the disclosed, pre-existing behavioural nuance exactly.
function OLD_levelRisk(level) {
  if (level === 'No' || level === 'Not sure') {
    return {
      text: 'Levels may affect base design, drainage, thresholds and installation.',
      category: 'cost',
      discipline: 'civils'
    };
  }
  return null;
}

const CASES = ['No', 'Not sure', 'Yes', '', null, undefined, 'No / gradient present', 'Unknown'];

test('behaviour-preservation: pcBrainLevelRisk matches OLD_levelRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(pcBrainLevelRisk(input), OLD_levelRisk(input), `mismatch for ${JSON.stringify(input)}`);
  }
});

test("level === 'No' and level === 'Not sure' both produce the exact original risk", () => {
  for (const input of ['No', 'Not sure']) {
    assert.deepStrictEqual(pcBrainLevelRisk(input), {
      text: 'Levels may affect base design, drainage, thresholds and installation.',
      category: 'cost',
      discipline: 'civils'
    });
  }
});

// The specific, deliberately-preserved behavioural nuance from this slice's
// authorisation: the legacy pre-27-Aug option string must NOT be matched,
// even though it means the same thing conceptually. Migrating this rule
// must not silently "fix" that gap.
test("the legacy pre-27-Aug value 'No / gradient present' produces NO risk — deliberately not broadened to match it", () => {
  assert.strictEqual(pcBrainLevelRisk('No / gradient present'), null);
});

test("'Yes', empty string, null, undefined and an unrecognised value all produce no risk", () => {
  for (const input of ['Yes', '', null, undefined, 'Unknown']) {
    assert.strictEqual(pcBrainLevelRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the two-point provenance + known nuance are recorded', () => {
  const p = PC_BRAIN_LEVEL_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.original_baseline_commit, '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029');
  assert.strictEqual(p.value_rename_commit, '998ef610b3bbc91071cbeac2651c919520a08119');
  assert.match(p.known_behavioural_nuance, /No back-compatibility matching/);
  assert.strictEqual(p.brain_version, PC_BRAIN_LEVEL_RISK_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_LEVEL_RISK_CONTRACT_VERSION);
});

test('rule outputs conform to schemas/level-risk.schema.json', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'level-risk.schema.json'), 'utf8'));
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  for (const input of ['No', 'Not sure', 'Yes', '', undefined]) {
    const output = pcBrainLevelRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
