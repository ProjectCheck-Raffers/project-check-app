// Project Check Brain — Stage 1 — door-size defaults by access type
// MIGRATION SLICE 1 (behaviour-preserving).
//
// VENDORED COPY NOTICE: when this exact file appears inside the application
// repository (under brain/stage-1/), it is a byte-identical vendored copy of
// this file and must never be edited there — see the application repository's
// brain/BRAIN-VERSION for the pinned version/commit and update procedure.
// Any change to this rule belongs here, in Project-Check-Brain, followed by
// a fresh vendor + version bump into the application repository.
//
// GOVERNANCE STATUS: CONFIRMED (see door-size-defaults.provenance.json and
// BRAIN-MIGRATION-REGISTER.md row BRAIN-0001). Source: the Project Check
// application repository, app.js doorRuleFor(), as it existed at application
// HEAD commit 12a3dcd54f860e42814d482b4a825ab4a516878c. Migration type:
// BEHAVIOUR-PRESERVING — these values are carried forward exactly as they
// existed; this migration does not reopen, re-derive or improve them
// (see GOVERNANCE.md control 3).
//
// Rule table (case-sensitive exact string match, exactly as the original
// implementation):
//   HGV                -> 4.6 m wide x 5.0 m high
//   Van / Forklift      -> 4.6 m wide x 4.0 m high
//   anything else       -> no default (customer enters the exact size)

const PC_BRAIN_VERSION = '0.1.0';
const PC_BRAIN_CONTRACT_VERSION = '1.0.0';

const PC_BRAIN_DOOR_SIZE_RULE_TABLE = [
  { access: 'HGV', width: 4.6, height: 5.0 },
  { access: 'Van', width: 4.6, height: 4.0 },
  { access: 'Forklift', width: 4.6, height: 4.0 }
];

function pcBrainDoorSizeDefault(access) {
  const match = PC_BRAIN_DOOR_SIZE_RULE_TABLE.find(r => r.access === access);
  return match ? { width: match.width, height: match.height } : null;
}

const PC_BRAIN_DOOR_SIZE_PROVENANCE = {
  rule_id: 'stage1.door-size-defaults',
  domain: 'stage-1',
  status: 'CONFIRMED',
  migration_type: 'BEHAVIOUR-PRESERVING',
  source_file: 'Project-Check-MVP-Master-Build/app.js',
  source_function: 'doorRuleFor()',
  source_app_commit: '12a3dcd54f860e42814d482b4a825ab4a516878c',
  brain_version: PC_BRAIN_VERSION,
  contract_version: PC_BRAIN_CONTRACT_VERSION
};

// Node (Brain repo tests) get a proper module export; a plain <script> load
// in the browser (vendored copy) simply leaves the const/function
// declarations above as ordinary globals — this file is used unmodified in
// both places, per "mechanically identical, never independently edited".
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pcBrainDoorSizeDefault,
    PC_BRAIN_DOOR_SIZE_RULE_TABLE,
    PC_BRAIN_DOOR_SIZE_PROVENANCE,
    PC_BRAIN_VERSION,
    PC_BRAIN_CONTRACT_VERSION
  };
}
