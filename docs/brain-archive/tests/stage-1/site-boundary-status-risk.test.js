// Project Check Brain — regression tests for
// stage-1/site-boundary-status-risk.js. Stage 1 Brain Completion Batch.
// Zero-dependency: Node's built-in test runner (node --test) and
// assert/strict only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pcBrainSiteBoundaryStatusRisk,
  PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_PROVENANCE,
  PC_BRAIN_SITE_BOUNDARY_STATUS_VERSION,
  PC_BRAIN_SITE_BOUNDARY_STATUS_CONTRACT_VERSION
} = require('../../stage-1/site-boundary-status-risk.js');

// OLD implementation, captured verbatim from app.js at commit
// 0d511a3e1274c109d1d2e76831e53b3b0c93ac74 — the independent
// behaviour-preservation oracle. Inequality, not narrowed.
function OLD_siteBoundaryStatusRisk(siteBoundaryStatus) {
  if (siteBoundaryStatus !== 'confirmed') {
    return {
      text: 'The relevant site boundary has not yet been confirmed on a site map, so boundary-related constraints are not yet confirmed.',
      category: 'issue',
      discipline: 'site'
    };
  }
  return null;
}

const CASES = ['confirmed', 'skipped', '', null, undefined, 'Confirmed', 'CONFIRMED', ' confirmed', 'confirmed ', 'Unknown'];

test('behaviour-preservation: pcBrainSiteBoundaryStatusRisk matches OLD_siteBoundaryStatusRisk for every case', () => {
  for (const input of CASES) {
    assert.deepStrictEqual(pcBrainSiteBoundaryStatusRisk(input), OLD_siteBoundaryStatusRisk(input), `mismatch for ${JSON.stringify(input)}`);
  }
});

test("siteBoundaryStatus === 'confirmed' produces no risk", () => {
  assert.strictEqual(pcBrainSiteBoundaryStatusRisk('confirmed'), null);
});

test("'skipped', unset/undefined, and an arbitrary unrecognised value all produce the exact original risk (inequality preserved)", () => {
  for (const input of ['skipped', undefined, 'Unknown', '']) {
    assert.deepStrictEqual(pcBrainSiteBoundaryStatusRisk(input), {
      text: 'The relevant site boundary has not yet been confirmed on a site map, so boundary-related constraints are not yet confirmed.',
      category: 'issue',
      discipline: 'site'
    }, `expected the risk for ${JSON.stringify(input)}`);
  }
});

test('case/whitespace variants of "confirmed" all still produce the risk (exact match against the literal, not case/whitespace-insensitive)', () => {
  for (const input of ['Confirmed', 'CONFIRMED', ' confirmed', 'confirmed ']) {
    assert.notStrictEqual(pcBrainSiteBoundaryStatusRisk(input), null, `expected the risk for ${JSON.stringify(input)}`);
  }
});

test('governance/provenance metadata is present, LOCKED-EXISTING, and the provenance gap is recorded', () => {
  const p = PC_BRAIN_SITE_BOUNDARY_STATUS_RISK_PROVENANCE;
  assert.strictEqual(p.status, 'LOCKED-EXISTING');
  assert.strictEqual(p.provenance_status, 'historical individual provenance not yet identified');
  assert.strictEqual(p.migration_type, 'BEHAVIOUR-PRESERVING');
  assert.strictEqual(p.source_baseline_commit, 'c73512acbbaf9c4c7fb803407b04ec54dc4bcd10');
  assert.strictEqual(p.brain_version, PC_BRAIN_SITE_BOUNDARY_STATUS_VERSION);
  assert.strictEqual(p.contract_version, PC_BRAIN_SITE_BOUNDARY_STATUS_CONTRACT_VERSION);
  assert.match(p.producer_note, /saveBoundary\(\)\/skipSiteBoundary\(\)/);
});

test('rule outputs conform to schemas/site-boundary-status-risk.schema.json', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'schemas', 'site-boundary-status-risk.schema.json'), 'utf8'));
  const objectBranch = schema.$defs.RiskOutput.oneOf.find(b => b.type === 'object');
  for (const input of ['confirmed', 'skipped', '', undefined]) {
    const output = pcBrainSiteBoundaryStatusRisk(input);
    if (output === null) continue;
    assert.deepStrictEqual(Object.keys(output).sort(), ['category', 'discipline', 'text']);
    assert.strictEqual(output.text, objectBranch.properties.text.const);
    assert.strictEqual(output.category, objectBranch.properties.category.const);
    assert.strictEqual(output.discipline, objectBranch.properties.discipline.const);
  }
});
