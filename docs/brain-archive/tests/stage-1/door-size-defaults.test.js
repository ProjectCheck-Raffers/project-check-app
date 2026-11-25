// Project Check Brain — regression tests for stage-1/door-size-defaults.js
// Migration Slice 1. Zero-dependency: uses Node's built-in test runner
// (node --test) and assert/strict only — no test framework added.
//
// Run with:  node --test tests/stage-1/door-size-defaults.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainDoorSizeDefault,
  PC_BRAIN_DOOR_SIZE_PROVENANCE,
  PC_BRAIN_VERSION,
  PC_BRAIN_CONTRACT_VERSION
} = require('../../stage-1/door-size-defaults.js');

// OLD implementation, captured verbatim from the application repository's
// app.js doorRuleFor(), as it existed at commit
// 12a3dcd54f860e42814d482b4a825ab4a516878c, BEFORE this migration. This is
// the independent behaviour-preservation oracle for this slice — it must
// never be "improved"; its only job is to prove the new rule produces the
// same output the old one did, for every practical input.
function OLD_doorRuleFor(access) {
  if (access === 'HGV') return { width: 4.6, height: 5.0 };
  if (access === 'Van' || access === 'Forklift') return { width: 4.6, height: 4.0 };
  return null;
}

const CASES = [
  'HGV', 'Van', 'Forklift', 'Other',
  '', null, undefined,
  'hgv', 'van', 'forklift', 'FORKLIFT',
  'HGV ', ' Van', 'Unknown', 'Car'
];

test('behaviour-preservation: pcBrainDoorSizeDefault matches OLD_doorRuleFor for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(
      pcBrainDoorSizeDefault(input),
      OLD_doorRuleFor(input),
      `mismatch for input ${JSON.stringify(input)}`
    );
  }
});

test('HGV returns 4.6m x 5.0m', () => {
  assert.deepStrictEqual(pcBrainDoorSizeDefault('HGV'), { width: 4.6, height: 5.0 });
});

test('Van returns 4.6m x 4.0m', () => {
  assert.deepStrictEqual(pcBrainDoorSizeDefault('Van'), { width: 4.6, height: 4.0 });
});

test('Forklift returns 4.6m x 4.0m', () => {
  assert.deepStrictEqual(pcBrainDoorSizeDefault('Forklift'), { width: 4.6, height: 4.0 });
});

test('Other / unsupported / null / undefined / empty / case-mismatch all return null', () => {
  for (const input of ['Other', '', null, undefined, 'hgv', 'van', 'forklift', 'Unknown', 'Car']) {
    assert.strictEqual(pcBrainDoorSizeDefault(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present and CONFIRMED / BEHAVIOUR-PRESERVING', () => {
  assert.strictEqual(PC_BRAIN_DOOR_SIZE_PROVENANCE.status, 'CONFIRMED');
  assert.strictEqual(PC_BRAIN_DOOR_SIZE_PROVENANCE.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(PC_BRAIN_DOOR_SIZE_PROVENANCE.source_function, 'doorRuleFor()');
  assert.strictEqual(PC_BRAIN_DOOR_SIZE_PROVENANCE.brain_version, PC_BRAIN_VERSION);
  assert.strictEqual(PC_BRAIN_DOOR_SIZE_PROVENANCE.contract_version, PC_BRAIN_CONTRACT_VERSION);
});

// Minimal, dependency-free structural check against the JSON Schema contract
// (no ajv/validator library added — see Brain Architecture v1 §D, "do not
// add unnecessary dependencies"). Confirms the schema file itself is valid
// JSON and that real rule outputs conform to the shape it declares.
test('rule outputs conform to schemas/door-size-default.schema.json', () => {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'door-size-default.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.ok(schema.$defs && schema.$defs.DoorSizeDefaultOutput, 'schema must define DoorSizeDefaultOutput');
  assert.strictEqual(schema.$defs.DoorSizeDefaultOutput.oneOf[0].properties.width.const, 4.6);
  assert.deepStrictEqual(schema.$defs.DoorSizeDefaultOutput.oneOf[0].properties.height.enum, [4.0, 5.0]);

  for (const input of ['HGV', 'Van', 'Forklift', 'Other']) {
    const output = pcBrainDoorSizeDefault(input);
    if (output === null) continue;
    assert.strictEqual(output.width, 4.6);
    assert.ok(output.height === 4.0 || output.height === 5.0);
    assert.deepStrictEqual(Object.keys(output).sort(), ['height', 'width']);
  }
});
