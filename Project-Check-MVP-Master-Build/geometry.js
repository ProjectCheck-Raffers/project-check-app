
// Project Check — common project geometry (single source of truth).
// Project data (Stage 1/2 facts) -> this module -> map footprint / plan / elevations / reports.
// Deliberately renderer-independent: no SVG/DOM code lives here. See drawing.js for rendering.

function wallLengthFor(dims, wall) {
  return (wall === 'front' || wall === 'back') ? dims.width : dims.length;
}

// Indicative low-pitch roof rise only — never presented as an engineering calculation.
function indicativeRoofRise(width) {
  return Math.round(Math.max(0.3, Math.min(2.5, width * 0.06)) * 100) / 100;
}

function doorLabel(d) {
  return (d.type === 'roller' ? 'Roller door' : 'Personnel door') + (d.ref ? ' ' + d.ref : '');
}

// RETIRED FROM LIVE BEHAVIOUR 2026-08-26 (was APPROVED/LOCKED until this date) — the
// perimeter÷32m indicative personnel/escape-door allowance. Originally inline in
// app.js's stage1() Stage 1 hint, then extracted here so Stage 2's door-review
// geometry check (validateGeometry() above) could reuse the exact same rule as a
// live, warn-only advisory. Both live call sites have now been removed (see the
// "RETIRED from live behaviour" comment in validateGeometry() above and the
// personnelDoors question comment in app.js's stage1Questions) following the Job B
// fire-strategy evidence review — see EVIDENCE-INTELLIGENCE-SPEC.md § "Recorded
// project evidence" and MASTER-SPEC.md § "Personnel doors / means-of-escape
// responsibility split". This function is deliberately preserved, unaltered and
// uncalled, purely as historical provenance that the perimeter÷32m rule existed and
// what it computed — do not delete it, and do not wire it back into any live
// customer-facing output without a fresh governance decision.
function suggestedPersonnelDoorAllowance(width, length) {
  const perim = 2 * ((Number(width) || 0) + (Number(length) || 0));
  return Math.max(1, Math.ceil(perim / 32));
}

// Shared door-derivation logic for both structure types — spreads roller doors along
// the front wall and personnel doors across all four walls, from Stage 1 facts common
// to any structure type. Doors produced here are the Project-Check-generated starting
// layout (see ensureGeometry()'s audit snapshot below), tagged source:'generated'.
// Extension point: window/rooflight openings would be a similar doors-like array here
// — out of scope this round (deferred per approved decision).
// Reused unchanged for the canopy branch below; canopy-specific door placement (e.g.
// whether a personnel door can sit on an open front wall) is itself an UNRESOLVED
// canopy rule inherited from this general logic, not a new invented rule — flagged for
// Architect review, not fabricated.
function deriveDoorsFromFacts(f, dims) {
  const doors = [];
  // The Stage 1 roller-door sizes/access page was removed (2026-11-14), so
  // f.rollerDoors may be absent. Previously saved entries are still used where
  // present; otherwise the customer's vehicle-door COUNT (f.rollerCount) seeds
  // that many doors with the fallback size below. Missing data never throws.
  const savedRollers = Array.isArray(f.rollerDoors) ? f.rollerDoors.filter(Boolean) : [];
  const hasCount = f.rollerCount !== undefined && f.rollerCount !== null && String(f.rollerCount).trim() !== '';
  const rollerTotal = hasCount
    ? Math.max(0, Math.min(20, parseInt(f.rollerCount, 10) || 0))
    : savedRollers.length;
  const rollerDoors = Array.from({ length: rollerTotal }, (_, i) => savedRollers[i] || {});
  const frontLen = dims.width;
  const rGap = frontLen / (rollerDoors.length + 1);
  rollerDoors.forEach((d, i) => {
    const w = Math.min(Number(d.width) || 4.6, frontLen);
    const centre = rGap * (i + 1);
    doors.push({
      id: 'rd' + (i + 1), ref: 'RD' + (i + 1), type: 'roller', wall: 'front',
      offset: Math.max(0, Math.round((centre - w / 2) * 100) / 100),
      width: w, height: Number(d.height) || 4.0, access: d.access || '', source: 'generated'
    });
  });

  const personnelCount = Math.max(0, parseInt(f.personnelDoors || '0', 10) || 0);
  const spreadWalls = ['back', 'left', 'right', 'front'];
  const perWallCounts = {};
  for (let i = 0; i < personnelCount; i++) {
    const wall = spreadWalls[i % spreadWalls.length];
    perWallCounts[wall] = (perWallCounts[wall] || 0) + 1;
  }
  const seen = {};
  for (let i = 0; i < personnelCount; i++) {
    const wall = spreadWalls[i % spreadWalls.length];
    seen[wall] = (seen[wall] || 0) + 1;
    const wl = wallLengthFor(dims, wall);
    const slots = perWallCounts[wall] + 1;
    const offset = Math.max(0, Math.min(wl - 1, Math.round(((wl / slots) * seen[wall] - 0.5) * 100) / 100));
    doors.push({
      id: 'pd' + (i + 1), ref: 'PD' + (i + 1), type: 'personnel', wall,
      offset, width: 1.0, height: 2.1, source: 'generated'
    });
  }
  return doors;
}

// PROPOSED (not APPROVED/LOCKED): the canopy geometry branch is a reasonable direction
// — using only the already-approved generic width/length/height facts plus the
// Architect-supplied indicative roof-pitch default (10°, the approved trapezoidal-
// sheet-metal canopy example) — but no canopy-specific question wording, answer option
// or compliance rule has been approved yet. Never copies the reference drawing's
// example dimensions (20m×12m×5m); always uses the customer's own facts, exactly like
// the standard-building path.
function deriveCanopyGeometryFromFacts(f) {
  const width = Number(f.width) || 0;
  const length = Number(f.length) || 0;
  const eaveHeight = Number(f.height) || 0;
  // UNRESOLVED: no canopy roof-material question exists yet, so pitch cannot be
  // customer-selected. 10° is the Architect-supplied indicative default for the
  // approved trapezoidal-sheet-metal example — not derived from a customer answer.
  const pitchDegrees = 10;
  const ridgeRise = Math.round((width / 2) * Math.tan(pitchDegrees * Math.PI / 180) * 100) / 100;
  const ridgeHeight = Math.round((eaveHeight + ridgeRise) * 100) / 100;
  const doors = deriveDoorsFromFacts(f, { width, length });
  return {
    width, length, eaveHeight, ridgeHeight,
    roofForm: 'Saddle canopy (indicative, ' + pitchDegrees + '° pitch)',
    structureType: 'canopy', openWall: 'front', connectionWall: 'back',
    doors
  };
}

// Pure derivation from Stage 1 facts — used whenever no persisted geometry exists yet.
// Never mutates p; callers decide whether/when to persist the result onto p.geometry.
function deriveGeometryFromFacts(p) {
  const f = (p && p.facts) || {};
  // PROPOSED canopy branch — see deriveCanopyGeometryFromFacts() above for what is and
  // isn't approved yet. f.structure itself (including the 'Canopy' option) is an
  // existing APPROVED/LOCKED Stage 1 question.
  if (f.structure === 'Canopy') return deriveCanopyGeometryFromFacts(f);
  // Deliberately NOT floored to a fake minimum: 0 here must mean "no data yet" so
  // buildingDrawingSVG() can correctly decline to draw rather than fabricate a building.
  const width = Number(f.width) || 0;
  const length = Number(f.length) || 0;
  // FACT: eaveHeight is exactly the customer-supplied "clear height" (f.height) — a
  // preliminary drawing reference line, NOT a distinct surveyed/engineered eaves
  // dimension. Always label it "clear height" wherever it is shown, never "eaves"
  // as if it were separately measured.
  const eaveHeight = Number(f.height) || 0;
  // INFERENCE: ridgeHeight is derived from an indicative roof-pitch assumption, not
  // customer-supplied or engineered data. Always label it "indicative" wherever shown.
  const rise = indicativeRoofRise(width);
  const ridgeHeight = Math.round((eaveHeight + rise) * 100) / 100;
  const doors = deriveDoorsFromFacts(f, { width, length });

  return {
    width, length, eaveHeight, ridgeHeight, roofForm: 'Duo-pitch (indicative)',
    structureType: 'standard', openWall: null, connectionWall: null, doors
  };
}

// Door audit-provenance values: 'generated' (Project-Check-derived, untouched),
// 'customer' (added/repositioned by the customer under this feature), 'legacy'
// (persisted before source-tracking existed, or a value that fails to match any
// known state — provenance cannot be established, so it is never presented as
// either of the other two). See healDoorSource()/sanitizeDoorSources() below for
// the actual enforcement, not just documentation.
const DOOR_SOURCE_VALUES = ['generated', 'customer', 'legacy'];

// The canonical read path: prefer persisted geometry (which may include manual Stage 2
// edits), otherwise derive fresh from facts. Always returns a plain, detached object.
function buildGeometry(p) {
  if (p && p.geometry && Array.isArray(p.geometry.doors) && p.geometry.width) {
    return {
      width: p.geometry.width, length: p.geometry.length, eaveHeight: p.geometry.eaveHeight,
      ridgeHeight: p.geometry.ridgeHeight, roofForm: p.geometry.roofForm || 'Duo-pitch (indicative)',
      // Defaulted to standard/null/null for legacy persisted geometry saved before this
      // field existed — correct, since all such geometry predates the canopy branch and
      // is standard-building shaped.
      structureType: p.geometry.structureType || 'standard',
      openWall: p.geometry.openWall || null,
      connectionWall: p.geometry.connectionWall || null,
      // A malformed/tampered persisted doors array can contain non-object entries
      // (null, a string, an array — typeof [] === 'object' too, so it needs its
      // own check) — filter those out first, same as sanitizeDoorIds() already
      // does for exactly this threat model, so a corrupted entry never survives
      // into geometry as a stray id-less/wall-less "ghost" door. Doors persisted
      // before source-tagging existed have no `source` field at all (or, if
      // tampered, an unrecognised value) — healDoorSource() defaults those to
      // 'legacy' (provenance genuinely unknown), never 'generated' or 'customer',
      // which would claim knowledge this codebase doesn't have.
      doors: p.geometry.doors.filter(d => d && typeof d === 'object' && !Array.isArray(d)).map(d => healDoorSource(Object.assign({}, d)))
    };
  }
  return deriveGeometryFromFacts(p);
}

// Door ids are attacker-controlled once they're sitting in localStorage
// (tampering, devtools, a compromised browser extension) and get
// interpolated directly into inline onclick/onchange/oninput handlers when
// doors are rendered (app.js renderDoorReview()) — the same JS-string-
// breakout class of issue fixed for the route id in render(). App-generated
// door ids are always 'rd'/'pd' plus a short digit run (buildGeometry()
// above, addDoor() in app.js); anything else gets replaced with a fresh,
// safely-shaped id here — every other field on the door (wall/offset/
// width/height/access) is left untouched, so a tampered id is healed
// rather than the door (or the whole project) being dropped.
function sanitizeDoorIds(geom) {
  if (!geom || !Array.isArray(geom.doors)) return geom;
  // A malformed/tampered doors array can contain non-object entries (null,
  // a string, an array — typeof [] === 'object' too, so it needs its own
  // check, ...) — drop those outright; there is no door to render or heal
  // there, and reading/assigning a property on one would throw or produce
  // inconsistent geometry.
  geom.doors = geom.doors.filter(d => d && typeof d === 'object' && !Array.isArray(d));
  const seen = new Set();
  geom.doors.forEach((d, i) => {
    // Bound the digit run so an attacker-length id can never reach the
    // onclick attributes this id is interpolated into (real ids are at
    // most 13 digits today, from Date.now()) — and require uniqueness so
    // two doors can never collide on the same #doorMeta-<id> DOM id or the
    // same find(d=>d.id===…) lookup used to select/move/remove a door.
    const shapeOk = typeof d.id === 'string' && /^(rd|pd)[0-9]{1,15}$/.test(d.id);
    if (!shapeOk || seen.has(d.id)) {
      let fresh = (d.type === 'personnel' ? 'pd' : 'rd') + Date.now() + i;
      while (seen.has(fresh)) fresh += '0';
      d.id = fresh;
    }
    seen.add(d.id);
  });
  return geom;
}

// Door `source` is attacker-controlled once persisted too (same threat model as
// door ids above) and, per the approved audit-provenance design, must never be
// silently trusted to mean 'generated' or 'customer' if it wasn't actually set
// that way. Heals anything outside DOOR_SOURCE_VALUES — missing, malformed, or an
// unrecognised tampered value — to 'legacy' (provenance genuinely cannot be
// established); valid existing 'generated'/'customer'/'legacy' values are left
// untouched. Single shared implementation, called from every path that reads
// persisted doors (buildGeometry()'s persisted-read branch above, and
// ensureGeometry() below) rather than each duplicating its own default logic.
function healDoorSource(d) {
  if (!DOOR_SOURCE_VALUES.includes(d.source)) d.source = 'legacy';
  return d;
}
function sanitizeDoorSources(geom) {
  if (!geom || !Array.isArray(geom.doors)) return geom;
  geom.doors.forEach(healDoorSource);
  return geom;
}

// Persists geometry onto the project the first time it's needed for editing (Stage 2
// drawing review). Subsequent calls are a no-op so manual edits are never overwritten.
function ensureGeometry(p) {
  const wasFresh = !p.geometry || !Array.isArray(p.geometry.doors) || !p.geometry.width;
  if (wasFresh) {
    p.geometry = buildGeometry(p);
  }
  sanitizeDoorIds(p.geometry);
  // Legacy healing: a project whose geometry was already persisted before
  // source-tracking/structureType/openWall/connectionWall existed is NOT "fresh"
  // by the check above (it already has doors+width), so buildGeometry()'s own
  // defaulting above is skipped for it — heal the same fields here too, in place,
  // via the same shared sanitizeDoorSources() buildGeometry() itself uses (not a
  // second, separately-maintained default), exactly like buildGeometry()'s
  // persisted-read branch does.
  sanitizeDoorSources(p.geometry);
  if (p.geometry.structureType === undefined) p.geometry.structureType = 'standard';
  if (p.geometry.openWall === undefined) p.geometry.openWall = null;
  if (p.geometry.connectionWall === undefined) p.geometry.connectionWall = null;
  // One-time audit snapshot of the Project-Check-generated (or, for legacy
  // projects, earliest-known) layout — taken the first time geometry is built
  // for this project OR, for a project persisted before this snapshot feature
  // existed, the first time it's revisited afterwards (wasFresh is false for
  // such a project forever, since it already has doors+width — `!p.geometry.original`
  // is what actually catches it). Never retaken/overwritten once present, so
  // "generated"/"customer"/"legacy" stays distinguishable even after manual edits
  // and regeneration. This is the minimal auditability design confirmed sufficient
  // by the Architect (not a full revision-history log). buildGeometry()'s
  // persisted-read branch above never returns `original`, so it can't leak into
  // rendering paths or syncFactsFromGeometry() — it only ever lives on the
  // persisted p.geometry object.
  if (wasFresh || !p.geometry.original) {
    p.geometry.original = JSON.parse(JSON.stringify({
      width: p.geometry.width, length: p.geometry.length, eaveHeight: p.geometry.eaveHeight,
      ridgeHeight: p.geometry.ridgeHeight, roofForm: p.geometry.roofForm,
      structureType: p.geometry.structureType, openWall: p.geometry.openWall,
      connectionWall: p.geometry.connectionWall, doors: p.geometry.doors
    }));
  }
  return p.geometry;
}

// Keeps facts.rollerCount / facts.personnelDoors in sync with geometry door counts so
// existing Stage 1 report/summary code (which reads facts) stays consistent — one
// project geometry, not two disconnected copies.
function syncFactsFromGeometry(p) {
  if (!p.geometry) return;
  const rollers = p.geometry.doors.filter(d => d.type === 'roller');
  const personnel = p.geometry.doors.filter(d => d.type === 'personnel');
  p.facts.rollerCount = String(rollers.length);
  p.facts.rollerDoors = rollers.map(d => ({ width: String(d.width), height: String(d.height), access: d.access || '', widthSource: 'geometry', heightSource: 'geometry' }));
  p.facts.personnelDoors = String(personnel.length);
}

// Basic geometric validation only (overlap / off-wall / corner-crossing / too-wide).
// Explicitly NOT a structural, fire or Building Regulations check.
function validateGeometry(geom) {
  const issues = [];
  ['front', 'back', 'left', 'right'].forEach(wall => {
    const wl = wallLengthFor(geom, wall);
    const onWall = geom.doors.filter(d => d.wall === wall).slice().sort((a, b) => a.offset - b.offset);
    onWall.forEach((d, i) => {
      const w = Number(d.width) || 0;
      if (w > wl + 0.001) {
        issues.push({ doorId: d.id, message: `${doorLabel(d)} (${w} m) is wider than the ${wall} wall (${wl} m) — opening too wide for the available wall geometry.` });
        return;
      }
      if (d.offset < -0.001) {
        issues.push({ doorId: d.id, message: `${doorLabel(d)} starts before the ${wall} wall's left-hand corner.` });
      } else if (d.offset + w > wl + 0.001) {
        issues.push({ doorId: d.id, message: `${doorLabel(d)} extends beyond the ${wall} wall and crosses the corner.` });
      }
      const next = onWall[i + 1];
      if (next && d.offset + w > next.offset + 0.001) {
        issues.push({ doorId: d.id, message: `${doorLabel(d)} overlaps ${doorLabel(next)} on the ${wall} wall.` });
      }
    });
  });
  // RETIRED from live behaviour 2026-08-26 (Job B fire-strategy evidence — see
  // EVIDENCE-INTELLIGENCE-SPEC.md § "Recorded project evidence" and MASTER-SPEC.md §
  // "Personnel doors / means-of-escape responsibility split"). This block used to push
  // a Stage 2 geometry-panel warning here whenever the customer's recorded personnel-door
  // count fell below suggestedPersonnelDoorAllowance(width,length) (perimeter ÷ 32 m,
  // rounded up) — i.e. a Stage 2 "fire/escape" warning generated solely from that
  // formula. The Job B evidence demonstrates a real means-of-escape assessment turns on
  // travel distance, occupancy and exit direction, not a perimeter/32 calculation, so this
  // is no longer an acceptable live compliance signal and has been removed from
  // validateGeometry()'s output entirely (not merely reworded). suggestedPersonnelDoorAllowance()
  // itself is preserved below, unaltered, purely for historical provenance — it is no
  // longer called from anywhere in this file or from app.js. A real means-of-escape
  // assessment (building geometry/use/occupancy/travel-distance/exit-direction, escalating
  // to specialist fire strategy or Building Control input where needed) remains an
  // unresolved, unimplemented reasoning dependency — see the governance sections above,
  // not a replacement calculation invented here.
  return issues;
}
