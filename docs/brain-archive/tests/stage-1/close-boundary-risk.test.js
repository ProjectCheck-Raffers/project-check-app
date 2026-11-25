// Project Check Brain — regression tests for
// stage-1/close-boundary-risk.js. Stage 1 Brain Completion Batch.
// Zero-dependency: Node's built-in test runner (node --test) and
// assert/strict only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainCloseBoundaryRisk,
  PC_BRAIN_CLOSE_BOUNDARY_RISK_PROVENANCE,
  PC_BRAIN_CLOSE_BOUNDARY_VERSION,
  PC_BRAIN_CLOSE_BOUNDARY_CONTRACT_VERSION
} = require('../../stage-1/close-boundary-risk.js');

// OLD implementation, captured verbatim from app.js at commit
// 0d511a3e1274c109d1d2e76831e53b3b0c93ac74 — the independent
// behaviour-preservation oracle. Inequality, not narrowed.
function OLD_closeBoundaryRisk(closeBoundary) {
  if (closeBoundary !== 'No') {
    return {
      text: 'Nearby boundaries/buildings may affect design, fire strategy, access or approvals.',
      category: 'programme',
      discipline: 'planning'
    };
  }
  return null;
}

const CASES = ['Yes', 'No', 'Not sure', '', null, undefined, 'no', 'NO', ' No', 'No ', 'Unknown'];

test('behaviour-preservation: pcBrainCloseBoundaryRisk matches OLD_closeBoundaryRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(pcBrainCloseBoundaryRisk(input), OLD_closeBoundaryRisk(input), `mismatch for ${JSON.stringify(input)}`);
  }
});

test("closeBoundary === 'No' produces no risk", () => {
  assert.strictEqual(pcBrainCloseBoundaryRisk('No'), null);
});

test("'Yes', 'Not sure', unset/undefined, and case/whitespace variants of 'No' all produce the exact original risk", () => {
  for (const input of ['Yes', 'Not sure', undefined, 'no', 'NO', ' No', 'No ']) {
    assert.deepStrictEqual(pcBrainCloseBoundaryRisk(input), {
      text: 'Nearby boundaries/buildings may affect design, fire strategy, access or approvals.',
      category: 'programme',
      discipline: 'planning'
    }, `expected the risk for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the discipline-label is documented as non-dependent on Planning Intelligence', () => {
  const p = PC_BRAIN_CLOSE_BOUNDARY_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.source_baseline_commit, '5a0e0d5556d31adf3acc3ea35cfd8aa6581b4029');
  assert.strictEqual(p.brain_version, PC_BRAIN_CLOSE_BOUNDARY_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_CLOSE_BOUNDARY_CONTRACT_VERSION);
  assert.match(p.discipline_label_note, /presentation-only/);
  assert.match(p.discipline_label_note, /not a dependency/);
});

test('rule outputs conform to schemas/close-boundary-risk.schema.json', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'close-boundary-risk.schema.json'), 'utf8'));
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  for (const input of ['Yes', 'No', 'Not sure', '', undefined]) {
    const output = pcBrainCloseBoundaryRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
