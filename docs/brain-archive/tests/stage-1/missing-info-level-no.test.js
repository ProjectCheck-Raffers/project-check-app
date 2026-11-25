// Project Check Brain — regression tests for
// stage-1/missing-info-level-no.js. Stage 1 Brain Completion Batch,
// Phase 2. Zero-dependency: Node's built-in test runner and assert/strict.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainMissingInfoLevelNo,
  PC_BRAIN_MISSING_INFO_LEVEL_NO_PROVENANCE,
  PC_BRAIN_MISSING_INFO_LEVEL_NO_VERSION,
  PC_BRAIN_MISSING_INFO_LEVEL_NO_CONTRACT_VERSION
} = require('../../stage-1/missing-info-level-no.js');

// OLD implementation, captured verbatim from app.js's stage1MissingInfo()
// at commit 0d511a3e1274c109d1d2e76831e53b3b0c93ac74 — independent oracle.
function OLD_missingInfoLevelNo(level) {
  if (level === 'No') return 'Site level/gradient: recorded as "No" (not level) — treat as unconfirmed.';
  return null;
}

const CASES = ['No', 'Not sure', 'Yes', 'No / gradient present', '', null, undefined];

test('behaviour-preservation: pcBrainMissingInfoLevelNo matches OLD_missingInfoLevelNo for every case', () => {
  for (const input of CASES) {
    assert.strictEqual(pcBrainMissingInfoLevelNo(input), OLD_missingInfoLevelNo(input), `mismatch for ${JSON.stringify(input)}`);
  }
});

test("level === 'No' produces the exact original missing-info text", () => {
  assert.strictEqual(pcBrainMissingInfoLevelNo('No'), 'Site level/gradient: recorded as "No" (not level) — treat as unconfirmed.');
});

test("'Not sure', 'Yes', the legacy 'No / gradient present' string, empty/null/undefined all produce null", () => {
  for (const input of ['Not sure', 'Yes', 'No / gradient present', '', null, undefined]) {
    assert.strictEqual(pcBrainMissingInfoLevelNo(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the output-shape distinction from risk rules is recorded', () => {
  const p = PC_BRAIN_MISSING_INFO_LEVEL_NO_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.source_function, 'stage1MissingInfo()');
  assert.strictEqual(p.source_baseline_commit, '998ef610b3bbc91071cbeac2651c919520a08119');
  assert.strictEqual(p.brain_version, PC_BRAIN_MISSING_INFO_LEVEL_NO_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_MISSING_INFO_LEVEL_NO_CONTRACT_VERSION);
});

test('rule outputs conform to schemas/missing-info-level-no.schema.json (plain string|null, not the risk-rule object shape)', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'missing-info-level-no.schema.json'), 'utf8'));
  const output = pcBrainMissingInfoLevelNo('No');
  assert.strictEqual(typeof output, 'string');
  const stringBranch = schema.properties.output.oneOf.find(b => b.type === 'string');
  assert.strictEqual(output, stringBranch.const);
  assert.strictEqual(pcBrainMissingInfoLevelNo('Yes'), null);
});
