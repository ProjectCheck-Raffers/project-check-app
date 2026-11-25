// Project Check Brain — regression tests for
// stage-1/missing-info-building-position.js. Stage 1 Brain Completion
// Batch, Phase 2. Zero-dependency: Node's built-in test runner and
// assert/strict.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainMissingInfoBuildingPosition,
  PC_BRAIN_MISSING_INFO_BUILDING_POSITION_PROVENANCE,
  PC_BRAIN_MISSING_INFO_BUILDING_POSITION_VERSION,
  PC_BRAIN_MISSING_INFO_BUILDING_POSITION_CONTRACT_VERSION
} = require('../../stage-1/missing-info-building-position.js');

// OLD implementation, captured verbatim from app.js's stage1MissingInfo()
// at commit 0d511a3e1274c109d1d2e76831e53b3b0c93ac74 — independent oracle.
function OLD_missingInfoBuildingPosition(buildingPositionStatus) {
  if (buildingPositionStatus !== 'confirmed') return 'Building position not yet confirmed on a site map.';
  return null;
}

const CASES = ['confirmed', 'skipped', '', null, undefined, 'Unknown'];

test('behaviour-preservation: pcBrainMissingInfoBuildingPosition matches OLD_missingInfoBuildingPosition for every case', () => {
  for (const input of CASES) {
    assert.strictEqual(pcBrainMissingInfoBuildingPosition(input), OLD_missingInfoBuildingPosition(input), `mismatch for ${JSON.stringify(input)}`);
  }
});

test("buildingPositionStatus === 'confirmed' produces null", () => {
  assert.strictEqual(pcBrainMissingInfoBuildingPosition('confirmed'), null);
});

test("'skipped', unset/undefined, and an unrecognised value all produce the exact original text (inequality preserved)", () => {
  for (const input of ['skipped', undefined, 'Unknown']) {
    assert.strictEqual(pcBrainMissingInfoBuildingPosition(input), 'Building position not yet confirmed on a site map.', `expected the text for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the non-duplication of BRAIN-0005 is documented', () => {
  const p = PC_BRAIN_MISSING_INFO_BUILDING_POSITION_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.source_function, 'stage1MissingInfo()');
  assert.strictEqual(p.source_baseline_commit, 'c73512acbbaf9c4c7fb803407b04ec54dc4bcd10');
  assert.match(p.distinct_from_note, /not a duplicate of BRAIN-0005/i);
  assert.strictEqual(p.brain_version, PC_BRAIN_MISSING_INFO_BUILDING_POSITION_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_MISSING_INFO_BUILDING_POSITION_CONTRACT_VERSION);
});

test('rule outputs conform to schemas/missing-info-building-position.schema.json (plain string|null)', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'missing-info-building-position.schema.json'), 'utf8'));
  const output = pcBrainMissingInfoBuildingPosition('skipped');
  assert.strictEqual(typeof output, 'string');
  const stringBranch = schema.properties.output.oneOf.find(b => b.type === 'string');
  assert.strictEqual(output, stringBranch.const);
  assert.strictEqual(pcBrainMissingInfoBuildingPosition('confirmed'), null);
});
