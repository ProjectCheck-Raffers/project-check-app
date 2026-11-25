// Project Check Brain — regression tests for
// stage-1/building-position-status-risk.js
// Migration Slice 5. Zero-dependency: Node's built-in test runner
// (node --test) and assert/strict only — no test framework added.
//
// Run with:  node --test tests/stage-1/building-position-status-risk.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainBuildingPositionStatusRisk,
  PC_BRAIN_BUILDING_POSITION_STATUS_RISK_PROVENANCE,
  PC_BRAIN_BUILDING_POSITION_STATUS_VERSION,
  PC_BRAIN_BUILDING_POSITION_STATUS_CONTRACT_VERSION
} = require('../../stage-1/building-position-status-risk.js');

// OLD implementation, captured verbatim from the application repository's
// app.js runStage1Risks(), as it exists at commit
// c782b366ee18a53fc2ab94fb7c8a0803b73091f8 (and, per the traced git -S
// history, unchanged since c73512a) — the independent behaviour-preservation
// oracle for this slice. Never "improved"; its only job is to prove the new
// rule matches the old one. This is an EXACT-EQUALITY rule, unlike Slice 4's
// inequality rule — must not be broadened.
function OLD_buildingPositionStatusRisk(buildingPositionStatus) {
  if (buildingPositionStatus === 'skipped') {
    return {
      text: 'The proposed building position has not yet been pinpointed on a site map, so orientation and clearances are not yet confirmed.',
      category: 'issue',
      discipline: 'site'
    };
  }
  return null;
}

// The minimum required case set from the Slice 5 authorisation, plus
// additional exact-equality edge cases (case/whitespace variants,
// unrecognised legacy values) — all of which must produce null, since this
// is exact equality, not a negation against 'confirmed'.
const CASES = [
  'skipped', 'confirmed',
  '', null, undefined,
  'Skipped', 'SKIPPED', ' skipped', 'skipped ', // case/whitespace variants — must NOT match
  'Unknown', 'pending' // arbitrary unrecognised values
];

test('behaviour-preservation: pcBrainBuildingPositionStatusRisk matches OLD_buildingPositionStatusRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(
      pcBrainBuildingPositionStatusRisk(input),
      OLD_buildingPositionStatusRisk(input),
      `mismatch for input ${JSON.stringify(input)}`
    );
  }
});

test("buildingPositionStatus === 'skipped' produces the exact original text/category/discipline", () => {
  assert.deepStrictEqual(pcBrainBuildingPositionStatusRisk('skipped'), {
    text: 'The proposed building position has not yet been pinpointed on a site map, so orientation and clearances are not yet confirmed.',
    category: 'issue',
    discipline: 'site'
  });
});

// The exact minimum case set required by the Slice 5 authorisation.
test("'confirmed', unset/undefined, and an arbitrary unrecognised value all produce no risk", () => {
  for (const input of ['confirmed', undefined, 'pending']) {
    assert.strictEqual(pcBrainBuildingPositionStatusRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('empty string, null, and case/whitespace variants of "skipped" all produce no risk — exact equality, not broadened', () => {
  for (const input of ['', null, 'Skipped', 'SKIPPED', ' skipped', 'skipped ', 'Unknown']) {
    assert.strictEqual(pcBrainBuildingPositionStatusRisk(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the provenance gap is recorded', () => {
  const p = PC_BRAIN_BUILDING_POSITION_STATUS_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.source_function, 'runStage1Risks()');
  assert.strictEqual(p.source_baseline_commit, 'c73512acbbaf9c4c7fb803407b04ec54dc4bcd10');
  assert.strictEqual(p.brain_version, PC_BRAIN_BUILDING_POSITION_STATUS_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_BUILDING_POSITION_STATUS_CONTRACT_VERSION);
});

// The Slice 5 authorisation's specific requirement: the later map-flow
// producer rewrites must be recorded as provenance context, distinct from
// this rule's own unchanged behaviour, and explicitly out of scope.
test('producer-rewrite provenance note is recorded, and does not imply this rule itself changed', () => {
  const p = PC_BRAIN_BUILDING_POSITION_STATUS_RISK_PROVENANCE;
  assert.match(p.producer_rewrite_provenance_note, /saveBuildingPosition\(\)\/skipBuildingPosition\(\)/);
  assert.match(p.producer_rewrite_provenance_note, /OUTSIDE the scope/);
  assert.match(p.exact_equality_behaviour_note, /EXACT-EQUALITY/);
});

test('rule outputs conform to schemas/building-position-status-risk.schema.json', () => {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'building-position-status-risk.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.ok(schema.$defs && schema.$defs.RiskOutput, 'schema must define RiskOutput');
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  assert.strictEqual(objectBranch.properties.text.const, 'The proposed building position has not yet been pinpointed on a site map, so orientation and clearances are not yet confirmed.');
  assert.strictEqual(objectBranch.properties.category.const, 'issue');
  assert.strictEqual(objectBranch.properties.discipline.const, 'site');

  for (const input of ['skipped', 'confirmed', '', undefined]) {
    const output = pcBrainBuildingPositionStatusRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
