// Project Check — Stage 2 background checks (quotation / design summary only).
//
// Founder instruction, 14 Nov 2026. These checks run after Building Design is
// confirmed and are shown ONLY on the Stage 2 design summary (#quotationSummary),
// the Stage 2 summary and the Quotations page. They are never shown in Building
// Design, Stage 1, the free report or Site Layout.
//
// 1) Distance to boundary — per wall (Elevation A–D, as Building Design), minimum
//    segment-to-segment distance from the saved footprint corners to the user-drawn
//    boundary lines, in a local equirectangular projection around the footprint
//    centroid. Skipped / no boundary lines -> null, nothing shown.
//    Flags: < 1 m high, < 3 m amber.
// 2) Indicative fire exits (industrial only) — founder's "32 m rule": one exit
//    every 32 m around the perimeter (closed loop, ceil(perimeter / 32) exits),
//    each snapped into a bay beside a steel column (0.4 m from the column
//    centreline, never on a column line or mid-bay), clear of customer openings,
//    1 m from corners, every perimeter gap 32 m or less. Customer personnel, double and
//    roller doors are not counted. Stored apart from user openings and deleted on
//    any building edit.
// 3) Other flags — length or width over 45 m: "May need additional exits."; any
//    wall over 30 m long with no customer doors (windows ignored): possible
//    travel-distance issue; internal racking is never modelled (always noted).
//
// Everything is stored at project.backgroundChecks (never in p.geometry.doors).
//
// Plan coordinates follow the Building Design plan (building-layout.js
// buildingDesignPlanOpeningGeometry): x runs along the length (0..L), y across the
// width (0..W). Elevation A (front) is the right-hand edge (x=L), C (back) the
// left-hand edge (x=0), D (left) the top edge (y=0) and B (right) the bottom edge
// (y=W). Offsets are the stored opening offsets on each wall.

var PC_FIRE_EXIT_MAX_TRAVEL = 32;
var PC_FIRE_EXIT_CORNER_CLEARANCE = 1.0;
var PC_FIRE_EXIT_SNAP_TOLERANCE = 1.5; // column-snap tolerance: gaps up to 33.5 m on a ~5 m bay grid
var PC_FIRE_EXIT_COLUMN_CLEARANCE = 0.4; // 0.3 m clear of an indicative 0.2 m column (0.1 m half-width)
var PC_FIRE_EXIT_DOOR_WIDTH = 1.0;
var PC_BG_CHECKS_VERSION = 'bg-checks-20261114';
var PC_FIRE_EXIT_NOTE = 'Indicative fire exits for quotation only. Final positions depend on internal layout and full fire strategy.';
var PC_BG_RACKING_NOTE = 'Internal racking, partitions and fit-out are not modelled. Distances are straight-line, so real travel routes around racking may be longer. Review once racking/layout documents are uploaded.';
var PC_BG_BOUNDARY_NOTE = 'Wall close to boundary — check fire protection.';
var PC_BG_ADDITIONAL_EXITS_NOTE = 'May need additional exits.';
var PC_BG_LONG_WALL_M = 30;
var PC_BG_LARGE_BUILDING_M = 45;
var PC_BG_WALL_LETTER = { front: 'A', right: 'B', back: 'C', left: 'D' };
var PC_FIRE_EXIT_WALL_LABEL = { front: 'Elevation A', right: 'Elevation B', back: 'Elevation C', left: 'Elevation D' };

function pcFireExitWallLength(wall, W, L) { return wall === 'front' || wall === 'back' ? W : L; }
function pcBgEsc(s) { return typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }
if (typeof pcEscXml !== 'function') { var pcEscXml = pcBgEsc; }

// Door segment [start, end] on the plan for a wall offset, plus the outward normal.
function pcFireExitSegment(wall, offset, width, W, L) {
  const a = offset, b = offset + width;
  if (wall === 'front') return { x1: L, y1: a, x2: L, y2: b, nx: 1, ny: 0 };
  if (wall === 'back') return { x1: 0, y1: W - a, x2: 0, y2: W - b, nx: -1, ny: 0 };
  if (wall === 'left') return { x1: L - a, y1: 0, x2: L - b, y2: 0, nx: 0, ny: -1 };
  return { x1: a, y1: W, x2: b, y2: W, nx: 0, ny: 1 };
}
function pcFireExitCentre(wall, offset, width, W, L) {
  const sgm = pcFireExitSegment(wall, offset, width, W, L);
  return { x: (sgm.x1 + sgm.x2) / 2, y: (sgm.y1 + sgm.y2) / 2 };
}

// Industrial detection from the existing project facts (building use first,
// then building type). Canopies/open-sided structures and leisure use are skipped.
// Client option (stored at p.facts.personnelDoorsAsFireExits): use personnel
// doors as fire exits — fire doors placed next to roller doors first.
var PC_FIRE_EXIT_PD_NOTE = 'Fire exits can double as personnel doors. Indicative fire exits are placed beside roller doors; further exits are added once the design is confirmed.';
// Client side choice for each roller-adjacent fire exit, stored with the project
// at p.buildingDesign.fireExitRollerSides = { [rollerDoorId]: 'left'|'right' }.
// It survives Edit (the fire exits are deleted, the preference is kept).
function pcFireExitRollerSides(p) { const s = p && p.buildingDesign && p.buildingDesign.fireExitRollerSides; return s && typeof s === 'object' ? s : {}; }
function pcFireExitPersonnelOption(p) { return Boolean(p && p.facts && p.facts.personnelDoorsAsFireExits === true); }
// Unconfirmed preview for the option: only the roller-adjacent fire doors,
// derived live from the current geometry (never stored).
function pcFireExitRollerAdjacentPreview(p, geometry) {
  const g = geometry || (p && p.geometry);
  if (!g || !pcFireExitPersonnelOption(p) || !pcFireExitIsIndustrial(p)) return [];
  return pcFireExitPlace(g.width, g.length, g.doors || [], { columns: pcBgColumns({ ...p, geometry: g }), rollerAdjacent: true, rollerAdjacentOnly: true }).doors;
}
function pcFireExitIsIndustrial(p) {
  const facts = (p && p.facts) || {};
  const use = String(facts.buildingUse || facts.use || '').toLowerCase();
  const type = String(facts.buildingType || facts.structure || '').toLowerCase();
  if (/canopy|covered loading bay/.test(type)) return false;
  if (/sport|leisure/.test(use)) return false;
  const industrialUse = /warehous|storage|distribution|logistic|manufactur|factory|workshop|vehicle|plant|timber|material|food production|chilled|spray|process|industrial/;
  if (industrialUse.test(use)) return true;
  if (!use && /workshop|process building/.test(type)) return true;
  return false;
}

// Existing openings block a stretch of wall (with a small clearance). Windows
// whose sill sits above a door head do not block a door below them.
function pcFireExitBlocked(wall, start, end, openings) {
  const clearance = 0.3;
  return (openings || []).some(o => {
    if (!o || o.wall !== wall) return false;
    if (o.type === 'window' && (Number(o.sillHeight) || 0) >= 2.3) return false;
    const os = Number(o.offset) || 0, oe = os + (Number(o.width) || 0);
    return start < oe + clearance && end > os - clearance;
  });
}

// Existing openings block a stretch of wall (with a small clearance). Windows
// whose sill sits above a door head do not block a door below them.
function pcFireExitBlocked(wall, start, end, openings) {
  const clearance = 0.3;
  return (openings || []).some(o => {
    if (!o || o.wall !== wall) return false;
    if (o.type === 'window' && (Number(o.sillHeight) || 0) >= 2.3) return false;
    const os = Number(o.offset) || 0, oe = os + (Number(o.width) || 0);
    return start < oe + clearance && end > os - clearance;
  });
}

function pcFireExitCandidates(W, L, openings, step, doorWidth, cornerClearance) {
  const out = [], margin = Number(cornerClearance) || 0.5;
  ['front', 'right', 'back', 'left'].forEach(wall => {
    const len = pcFireExitWallLength(wall, W, L);
    const last = len - doorWidth - margin;
    if (last < margin) return;
    const offsets = [];
    for (let o = margin; o <= last + 1e-9; o += step) offsets.push(Math.round(o * 100) / 100);
    const mid = Math.round((len - doorWidth) / 2 * 100) / 100;
    if (!offsets.some(o => Math.abs(o - mid) < 1e-6)) offsets.push(mid);
    offsets.forEach(offset => {
      if (pcFireExitBlocked(wall, offset, offset + doorWidth, openings)) return;
      const c = pcFireExitCentre(wall, offset, doorWidth, W, L);
      out.push({ wall, offset, width: doorWidth, x: c.x, y: c.y });
    });
  });
  return out;
}

// Grid over the floor in plan coordinates (x along the length, y across the width).
function pcFireExitGrid(W, L, step) {
  const pts = [], nx = Math.max(1, Math.ceil(L / step)), ny = Math.max(1, Math.ceil(W / step));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) pts.push({ x: Math.min(L, i * L / nx), y: Math.min(W, j * W / ny) });
  return pts;
}

function pcFireExitMaxDistance(points, exits) {
  let worst = 0;
  points.forEach(pt => {
    let best = Infinity;
    exits.forEach(e => { const d = Math.hypot(pt.x - e.x, pt.y - e.y); if (d < best) best = d; });
    if (best > worst) worst = best;
  });
  return worst;
}

// Grid over the floor in plan coordinates (x along the length, y across the width).
function pcFireExitGrid(W, L, step) {
  const pts = [], nx = Math.max(1, Math.ceil(L / step)), ny = Math.max(1, Math.ceil(W / step));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) pts.push({ x: Math.min(L, i * L / nx), y: Math.min(W, j * W / ny) });
  return pts;
}

function pcFireExitMaxDistance(points, exits) {
  let worst = 0;
  points.forEach(pt => {
    let best = Infinity;
    exits.forEach(e => { const d = Math.hypot(pt.x - e.x, pt.y - e.y); if (d < best) best = d; });
    if (best > worst) worst = best;
  });
  return worst;
}

// Loop position (m) of a plan point, clockwise from the top-left corner:
// D (left, y=0) -> A (front, x=L) -> B (right, y=W) -> C (back, x=0).
function pcFireExitLoopT(pt, W, L) {
  const e = 1e-6;
  if (Math.abs(pt.y) < e) return pt.x;
  if (Math.abs(pt.x - L) < e) return L + pt.y;
  if (Math.abs(pt.y - W) < e) return L + W + (L - pt.x);
  return 2 * L + W + (W - pt.y);
}

// Steel frame column positions (metres along each wall's offset axis), read from
// the Building Design grid code for this project: side walls use the bay grid
// (buildingDesignGridForLength, ~5 m bays); gables use the gable column positions
// (buildingDesignGableColumnPositions, which shifts columns round roller doors).
// Falls back to ~5 m bays when Building Design code is not loaded (node tests).
function pcFireExitDefaultColumns(W, L) {
  const cols = len => { const n = Math.max(1, Math.round(len / 5)); return Array.from({ length: n + 1 }, (_, i) => Math.round(i * len / n * 1000) / 1000); };
  return { front: cols(W), back: cols(W), left: cols(L), right: cols(L) };
}
function pcBgColumns(p) {
  const g = p && p.geometry, W = Number(g && g.width) || 0, L = Number(g && g.length) || 0;
  if (!(W > 0 && L > 0) || typeof buildingDesignGridForLength !== 'function') return pcFireExitDefaultColumns(W, L);
  const out = {};
  // buildingDesignGableColumnPositions reads the active Building Design project;
  // point it at this project for the duration of the call.
  let swapped = false, previous = null;
  try {
    if (typeof activeBuildingDesign !== 'undefined' && (!activeBuildingDesign || activeBuildingDesign.projectId !== p.id)) { previous = activeBuildingDesign; activeBuildingDesign = { projectId: p.id }; swapped = true; }
    ['front', 'right', 'back', 'left'].forEach(wall => {
      const len = pcFireExitWallLength(wall, W, L), bay = buildingDesignGridForLength(len, p);
      const gable = wall === 'front' || wall === 'back';
      const positions = gable && typeof buildingDesignGableColumnPositions === 'function'
        ? buildingDesignGableColumnPositions({ ...g, doors: Array.isArray(g.doors) ? g.doors : [] }, wall, bay).map(c => Number(c.metres))
        : Array.from({ length: bay.count + 1 }, (_, i) => i * bay.spacing);
      out[wall] = positions.map(m => Math.round(m * 1000) / 1000);
    });
  } catch (e) { return pcFireExitDefaultColumns(W, L); }
  finally { if (swapped) activeBuildingDesign = previous; }
  return out;
}

// Pure placement rule — the founder's "32 m rule": one fire exit every 32 m
// around the perimeter, ceil(perimeter / 32) exits on the closed wall loop, each
// SNAPPED into a bay right beside a steel column: the door leaf starts 0.4 m from
// the column centreline (0.3 m clearance + half an indicative 0.2 m column), on
// either side — never on a column line, never mid-bay. Positions must stay 1 m
// from building corners and clear of customer openings (0.3 m clearance).
// Snapping to columns allows a small tolerance: perimeter gaps may reach 32 m
// plus PC_FIRE_EXIT_SNAP_TOLERANCE (33.5 m — half a 5 m bay plus clearance), so
// the count stays at ceil(perimeter / 32); the column-side arrangement with the
// smallest largest gap is chosen. Only if no arrangement fits within the
// tolerance is one more exit added (reported as countIncreased). Customer personnel, double and roller doors are not exits.
function pcFireExitPlace(width, length, openings, options) {
  const opts = options || {};
  const W = Number(width) || 0, L = Number(length) || 0;
  const spacing = Number(opts.spacing) || PC_FIRE_EXIT_MAX_TRAVEL;
  const doorWidth = Number(opts.doorWidth) || PC_FIRE_EXIT_DOOR_WIDTH;
  const tolerance = opts.tolerance != null ? Number(opts.tolerance) : PC_FIRE_EXIT_SNAP_TOLERANCE;
  const allowed = spacing + tolerance;
  const base = { rule: '32m', limit: spacing, tolerance, allowedGap: allowed };
  if (!(W > 0 && L > 0)) return { ...base, doors: [], maxPerimeterGap: null, feasible: false, reason: 'Building dimensions missing.' };
  const columns = opts.columns || pcFireExitDefaultColumns(W, L);
  const P = 2 * (W + L), minCount = Math.max(1, Math.ceil(P / spacing - 1e-9));
  const clearance = PC_FIRE_EXIT_COLUMN_CLEARANCE, corner = PC_FIRE_EXIT_CORNER_CLEARANCE;
  const candidates = [];
  ['front', 'right', 'back', 'left'].forEach(wall => {
    const len = pcFireExitWallLength(wall, W, L), cols = (columns[wall] || []).slice().sort((a, b) => a - b);
    cols.forEach(c => {
      [['after', c + clearance], ['before', c - clearance - doorWidth]].forEach(([side, offset]) => {
        offset = Math.round(offset * 1000) / 1000;
        if (offset < corner - 1e-9 || offset + doorWidth > len - corner + 1e-9) return;
        // Never across a column line.
        if (cols.some(k => k > offset - 1e-9 && k < offset + doorWidth + 1e-9)) return;
        if (pcFireExitBlocked(wall, offset, offset + doorWidth, openings)) return;
        const pt = pcFireExitCentre(wall, offset, doorWidth, W, L);
        candidates.push({ wall, offset, width: doorWidth, x: pt.x, y: pt.y, t: pcFireExitLoopT(pt, W, L), column: c, columnSide: side });
      });
    });
  });
  if (!candidates.length) return { ...base, doors: [], maxPerimeterGap: null, feasible: false, reason: 'No clear column-side wall space for a fire exit door.' };
  candidates.sort((a, b) => a.t - b.t);
  const n = candidates.length;
  // Unwrapped loop positions (two laps) for look-ups.
  const lap = candidates.map((c, i) => ({ i, t: c.t })).concat(candidates.map((c, i) => ({ i, t: c.t + P })));
  const sep = doorWidth + 0.5;
  // Fewest further exits needed to get from position `from` to `end` (the start
  // exit, one lap on) with every gap <= 32 m (greedy farthest jump; optimal).
  const exitsToClose = (from, end) => {
    let cur = from, c = 0;
    while (end - cur > allowed + 1e-9) {
      let next = -Infinity;
      for (const e of lap) if (e.t > cur + sep - 1e-9 && e.t <= cur + allowed + 1e-9 && e.t < end - sep + 1e-9 && e.t > next) next = e.t;
      if (next === -Infinity) return Infinity;
      cur = next; c++;
    }
    return c;
  };
  // For each start spot: every next exit is the column-side spot nearest the
  // even target that is within 32 m of the previous exit and still lets the loop
  // close within the count. Keep the most even result.
  const tryCount = count => {
    let best = null;
    for (let s = 0; s < n; s++) {
      const t0 = candidates[s].t, end = t0 + P, chosen = [s];
      let prevT = t0, ok = true;
      for (let k = 1; k < count; k++) {
        const target = t0 + k * P / count;
        let pick = null, bd = Infinity;
        for (const e of lap) {
          if (e.t <= prevT + sep - 1e-9 || e.t > prevT + allowed + 1e-9 || e.t >= end - sep) continue;
          if (exitsToClose(e.t, end) > count - 1 - k) continue;
          const d = Math.abs(e.t - target);
          if (d < bd) { bd = d; pick = e; }
        }
        if (!pick) { ok = false; break; }
        chosen.push(pick.i); prevT = pick.t;
      }
      if (!ok || end - prevT > allowed + 1e-9) continue;
      const ts = chosen.map(i => candidates[i].t).sort((a, b) => a - b);
      const gs = ts.map((t, k) => (k === ts.length - 1 ? ts[0] + P : ts[k + 1]) - t);
      const gap = Math.max(...gs), spread = gap - Math.min(...gs);
      if (!best || gap < best.gap - 1e-9 || (Math.abs(gap - best.gap) <= 1e-9 && spread < best.spread - 1e-9)) best = { chosen, gap, spread };
    }
    return best;
  };
  const wallOrder = { front: 0, right: 1, back: 2, left: 3 };
  const toDoors = list => list
    .sort((a, b) => wallOrder[a.wall] - wallOrder[b.wall] || a.offset - b.offset)
    .map((c, i) => ({ id: 'fe' + (i + 1), ref: 'FE' + (i + 1), type: 'fireExit', wall: c.wall, elevation: PC_BG_WALL_LETTER[c.wall], offset: c.offset, width: c.width, column: c.column, columnSide: c.columnSide, x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100, auto: true, ...(c.forRoller ? { forRoller: c.forRoller, forRollerId: c.forRollerId, rollerSide: c.rollerSide, rollerAdjacent: true, ...(c.rollerSidePreferred ? { rollerSidePreferred: c.rollerSidePreferred } : {}), ...(c.sideFallback ? { sideFallback: true } : {}) } : {}) }));
  const gapsOf = list => { const ts = list.map(c => c.t).sort((a, b) => a - b); return ts.map((t, k) => (k === ts.length - 1 ? ts[0] + P : ts[k + 1]) - t); };

  // Personnel-door option: one fire door next to each roller door first
  // (nearest clear column-side spot on the same wall), then extra exits only
  // where a perimeter gap would exceed 32 m (+ tolerance).
  if (opts.rollerAdjacent) {
    const fixed = pcFireExitRollerPicks(candidates, openings, doorWidth, opts.rollerSides);
    if (opts.rollerAdjacentOnly) {
      const doors = toDoors(fixed.slice());
      return { ...base, doors, maxPerimeterGap: null, feasible: true, perimeter: P, minimumCount: minCount, rollerAdjacentCount: fixed.length };
    }
    if (fixed.length) {
      const ft = fixed.slice().sort((a, b) => a.t - b.t);
      const extras = [];
      for (let k = 0; k < ft.length; k++) {
        const from = ft[k].t, end = k === ft.length - 1 ? ft[0].t + P : ft[k + 1].t;
        const need = exitsToClose(from, end);
        if (need === Infinity) return { ...base, doors: toDoors(fixed.slice()), maxPerimeterGap: null, feasible: false, reason: 'Column-side wall space does not allow a fire exit at least every 32 m (plus snap tolerance).' };
        let prevT = from;
        for (let j = 1; j <= need; j++) {
          const target = from + j * (end - from) / (need + 1);
          let pick = null, bd = Infinity;
          for (const e of lap) {
            if (e.t <= prevT + sep - 1e-9 || e.t > prevT + allowed + 1e-9 || e.t >= end - sep) continue;
            if (exitsToClose(e.t, end) > need - j) continue;
            const d = Math.abs(e.t - target);
            if (d < bd) { bd = d; pick = e; }
          }
          if (!pick) break;
          extras.push(candidates[pick.i]); prevT = pick.t;
        }
      }
      const all = fixed.concat(extras), gap = Math.max(...gapsOf(all));
      return { ...base, doors: toDoors(all), maxPerimeterGap: Math.round(gap * 10) / 10, feasible: gap <= allowed + 1e-9, perimeter: P, minimumCount: minCount, rollerAdjacentCount: fixed.length, additionalCount: extras.length };
    }
  }

  let count = minCount, best = null;
  for (; count <= minCount + 6 && !best; count++) best = tryCount(count);
  if (!best) return { ...base, doors: [], maxPerimeterGap: null, feasible: false, reason: 'Column-side wall space does not allow a fire exit at least every 32 m (plus snap tolerance).' };
  const used = best.chosen.length;
  const doors = toDoors(best.chosen.map(i => candidates[i]));
  return { ...base, doors, maxPerimeterGap: Math.round(best.gap * 10) / 10, feasible: true, perimeter: P, minimumCount: minCount, countIncreased: used > minCount, ...(opts.rollerAdjacent ? { rollerAdjacentCount: 0, additionalCount: doors.length } : {}) };
}

// For each roller door, the clear column-side spot on the same wall nearest the
// roller (edge to edge), not overlapping another pick.
function pcFireExitRollerPicks(candidates, openings, doorWidth, sides) {
  // sides: optional client preference per roller door, { [rollerId]: 'left'|'right' }
  // ('left' = lower offset, i.e. left of the roller viewed from outside). Without
  // a preference, the nearest side wins. If the preferred side has no clear
  // column-side spot, the other side is used (sideFallback: true).
  const picks = [], prefs = sides || {};
  (Array.isArray(openings) ? openings : []).filter(o => o && o.type === 'roller').forEach((r, index) => {
    const a = Number(r.offset) || 0, b = a + (Number(r.width) || 0);
    const rollerId = String(r.id || r.ref || 'R' + (index + 1));
    const nearest = side => {
      let best = null, bd = Infinity;
      candidates.forEach(c => {
        if (c.wall !== r.wall) return;
        if (picks.some(q => q.wall === c.wall && c.offset < q.offset + q.width + 0.3 && c.offset + c.width > q.offset - 0.3)) return;
        const after = c.offset >= b, before = c.offset + c.width <= a;
        if (!after && !before) return;
        if (side === 'left' && !before) return;
        if (side === 'right' && !after) return;
        const d = after ? c.offset - b : a - (c.offset + c.width);
        if (d < bd - 1e-9) { bd = d; best = c; }
      });
      return best;
    };
    const preferred = prefs[rollerId] === 'left' || prefs[rollerId] === 'right' ? prefs[rollerId] : null;
    let best = preferred ? nearest(preferred) : nearest(null), fallback = false;
    if (!best && preferred) { best = nearest(preferred === 'left' ? 'right' : 'left'); fallback = Boolean(best); }
    if (best) picks.push({ ...best, forRoller: String(r.ref || 'R' + (index + 1)), forRollerId: rollerId, rollerSide: best.offset + best.width <= a ? 'left' : 'right', ...(preferred ? { rollerSidePreferred: preferred } : {}), ...(fallback ? { sideFallback: true } : {}) });
  });
  return picks;
}

// ---- 1) Distance to boundary ----
function pcFireExitLocal(point, origin) {
  const mLat = 111320, mLng = Math.max(1, 111320 * Math.cos(origin.lat * Math.PI / 180));
  return { x: (Number(point.lng) - origin.lng) * mLng, y: (Number(point.lat) - origin.lat) * mLat };
}
function pcFireExitSegDist(p1, p2, q1, q2) {
  const pt = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy; let t = len ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(p1, p2, q1), d2 = cross(p1, p2, q2), d3 = cross(q1, q2, p1), d4 = cross(q1, q2, p2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(pt(p1, q1, q2), pt(p2, q1, q2), pt(q1, p1, p2), pt(q2, p1, p2));
}
function pcFireExitSegDist(p1, p2, q1, q2) {
  const pt = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy; let t = len ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(p1, p2, q1), d2 = cross(p1, p2, q2), d3 = cross(q1, q2, p1), d4 = cross(q1, q2, p2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(pt(p1, q1, q2), pt(p2, q1, q2), pt(q1, p1, p2), pt(q2, p1, p2));
}
function pcFireExitFootprintCorners(fp) {
  if (Array.isArray(fp.corners) && fp.corners.length === 4) return fp.corners.map(c => ({ lat: Number(c.lat), lng: Number(c.lng) }));
  if (!fp.center) return null;
  const lat = Number(fp.center.lat), lng = Number(fp.center.lng), mLat = 111320, mLng = Math.max(1, 111320 * Math.cos(lat * Math.PI / 180));
  const hw = (Number(fp.width) || 0) / 2, hl = (Number(fp.length) || 0) / 2, th = (Number(fp.angle) || 0) * Math.PI / 180;
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([x, y]) => { const xr = x * Math.cos(th) - y * Math.sin(th), yr = x * Math.sin(th) + y * Math.cos(th); return { lat: lat + yr / mLat, lng: lng + xr / mLng }; });
}
// Per-wall minimum distance (m) to the nearest user-drawn boundary line, keyed by
// elevation letter (A front, B right, C back, D left — footprint corner order
// used by Site Layout and the Building Design site reference). Returns null when
// boundaries were skipped, not yet confirmed, or no lines exist.
function pcBgBoundaryDistances(p) {
  const facts = (p && p.facts) || {}, fp = facts.buildingFootprint || {};
  if (facts.siteBoundaryStatus !== 'confirmed') return null;
  const lines = (Array.isArray(facts.relevantBoundaries) ? facts.relevantBoundaries : []).filter(line => Array.isArray(line) && line.length >= 2);
  const corners = pcFireExitFootprintCorners(fp);
  if (!lines.length || !corners) return null;
  const origin = { lat: corners.reduce((t, c) => t + c.lat, 0) / 4, lng: corners.reduce((t, c) => t + c.lng, 0) / 4 };
  const local = corners.map(c => pcFireExitLocal(c, origin));
  const walls = [['A', local[0], local[1]], ['B', local[1], local[2]], ['C', local[2], local[3]], ['D', local[3], local[0]]];
  const out = {};
  walls.forEach(([letter, a, b]) => {
    let min = Infinity;
    lines.forEach(line => { for (let i = 0; i < line.length - 1; i++) { const d = pcFireExitSegDist(a, b, pcFireExitLocal(line[i], origin), pcFireExitLocal(line[i + 1], origin)); if (d < min) min = d; } });
    out[letter] = Number.isFinite(min) ? Math.round(min * 100) / 100 : null;
  });
  return out;
}

// ---- Fingerprint: building, openings and site the checks were run against ----
function pcFireExitHash(text) { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function pcBgSourceFingerprint(p) {
  const g = p.geometry || {}, facts = p.facts || {}, fp = facts.buildingFootprint || {};
  const doors = (Array.isArray(g.doors) ? g.doors : []).map(d => [d.type, d.subtype || '', d.wall, Number(d.offset) || 0, Number(d.width) || 0, Number(d.height) || 0, Number(d.sillHeight) || 0]);
  return pcFireExitHash(JSON.stringify([
    PC_BG_CHECKS_VERSION, Number(g.width) || 0, Number(g.length) || 0, Number(g.eaveHeight) || 0, doors,
    (p.buildingDesign && p.buildingDesign.sourceFingerprint) || '', (p.buildingDesign && p.buildingDesign.confirmedAt) || '',
    fp.center || null, fp.corners || null, Number(fp.angle) || 0, facts.siteBoundaryStatus || '', facts.relevantBoundaries || null,
    facts.buildingUse || facts.use || '', facts.buildingType || '', facts.personnelDoorsAsFireExits === true, pcFireExitRollerSides(p)
  ]));
}

function pcFireExitDesignConfirmed(p) {
  const bd = p && p.buildingDesign;
  if (!bd || bd.status !== 'confirmed' || !p.geometry || !(Number(p.geometry.width) > 0)) return false;
  // Edit Building Design clicked: unlocked for editing, so no fire exits anywhere.
  if (bd.editing) return false;
  if (typeof buildingDesignSourceGeometry === 'function' && typeof buildingDesignFingerprint === 'function') {
    try {
      const source = buildingDesignSourceGeometry(p);
      if (source.dimensionsChanged) return false;
      if (bd.sourceFingerprint && bd.sourceFingerprint !== buildingDesignFingerprint(p, source.geometry)) return false;
    } catch (e) { return false; }
  }
  return true;
}

// ---- 3) Other flags ----
function pcBgOtherFlags(p) {
  const g = p.geometry || {}, W = Number(g.width) || 0, L = Number(g.length) || 0, flags = [];
  if (W > PC_BG_LARGE_BUILDING_M || L > PC_BG_LARGE_BUILDING_M) flags.push({ kind: 'large-building', level: 'amber', text: PC_BG_ADDITIONAL_EXITS_NOTE + ' The building is ' + L + ' m × ' + W + ' m (over ' + PC_BG_LARGE_BUILDING_M + ' m).' });
  const doors = (Array.isArray(g.doors) ? g.doors : []).filter(d => d && d.type !== 'window');
  ['front', 'right', 'back', 'left'].forEach(wall => {
    const len = pcFireExitWallLength(wall, W, L);
    if (len > PC_BG_LONG_WALL_M && !doors.some(d => d.wall === wall)) flags.push({ kind: 'long-wall', level: 'amber', wall, elevation: PC_BG_WALL_LETTER[wall], text: PC_FIRE_EXIT_WALL_LABEL[wall] + ' is a ' + len + ' m wall with no customer doors — possible travel-distance issue.' });
  });
  return flags;
}

// Delete auto-placed fire exits / checks (any building edit, unlock or draft save).
function pcFireExitClear(p) {
  let changed = false;
  const bg = p && p.backgroundChecks;
  if (bg) {
    // Keep only the building-regs results, with fire exits deleted and marked
    // stale until the calculation re-runs (pcBuildingRegsRun).
    const regs = bg.buildingRegs;
    // Nothing to delete when only unconfirmed building-regs results are stored.
    const alreadyStale = regs && !regs.fireExits && Object.keys(bg).length === 1;
    if (!alreadyStale) {
      if (regs) p.backgroundChecks = { buildingRegs: { ...regs, fireExits: null, stale: true, staleSince: new Date().toISOString() } };
      else delete p.backgroundChecks;
      changed = true;
    }
  }
  if (p && p.buildingDesign && p.buildingDesign.autoFireExits) { delete p.buildingDesign.autoFireExits; changed = true; }
  return changed;
}

// Run all background checks after Building Design is confirmed.
function pcFireExitRefresh(p) {
  if (!p) return null;
  if (!pcFireExitDesignConfirmed(p)) { pcFireExitClear(p); return null; }
  const g = p.geometry, industrial = pcFireExitIsIndustrial(p);
  let fireExits = null;
  if (industrial) {
    const rollerAdjacent = pcFireExitPersonnelOption(p);
    const placement = pcFireExitPlace(g.width, g.length, g.doors || [], { columns: pcBgColumns(p), rollerAdjacent, rollerSides: pcFireExitRollerSides(p) });
    fireExits = {
      rule: '32 m rule: one fire exit every 32 m around the perimeter',
      limit: placement.limit || PC_FIRE_EXIT_MAX_TRAVEL, maxPerimeterGap: placement.maxPerimeterGap,
      feasible: placement.feasible, reason: placement.reason || null,
      doors: placement.doors, note: PC_FIRE_EXIT_NOTE,
      personnelDoorsAsFireExits: rollerAdjacent, rollerAdjacentCount: placement.rollerAdjacentCount || 0
    };
  }
  p.backgroundChecks = {
    version: PC_BG_CHECKS_VERSION,
    sourceFingerprint: pcBgSourceFingerprint(p),
    generatedAt: new Date().toISOString(),
    industrial,
    boundaryDistances: pcBgBoundaryDistances(p),
    fireExits,
    otherFlags: pcBgOtherFlags(p),
    rackingNote: PC_BG_RACKING_NOTE
  };
  p.backgroundChecks.buildingRegs = pcBuildingRegsCompute(p, fireExits);
  if (p.buildingDesign) delete p.buildingDesign.autoFireExits;
  return p.backgroundChecks;
}

// Summary entry point: valid stored checks, rerun when stale, none when unconfirmed.
function pcBackgroundChecksFor(p) {
  if (!p) return null;
  if (!pcFireExitDesignConfirmed(p)) { pcFireExitClear(p); return null; }
  const stored = p.backgroundChecks;
  if (stored && stored.sourceFingerprint === pcBgSourceFingerprint(p)) return stored;
  return pcFireExitRefresh(p);
}

// ---- Building-regs calculation (runs after every relevant input) ----
// Re-run from each save/confirm point for building position, building size,
// boundary lines and openings (Site Layout confirm, Map 1/2 saves, project
// size edits, Building Design save/confirm). Stored at
// project.backgroundChecks.buildingRegs = {
//   version, computedAt, inputsFingerprint, stale, designConfirmed,
//   boundaryDistances {A,B,C,D} | null, boundaryContact {A:'corner'|'wall'|null,…},
//   travel { spacing, perimeter, maxRun, flags[] },
//   fireExits (confirmed design only) | null,
//   clearSpace { clearance, note, exits[], flags[] }
// }
var PC_BG_REGS_VERSION = 'bregs-20261114';
var PC_BG_CLEAR_SPACE_M = 1.8;
var PC_BG_CLEAR_SPACE_NOTE = 'Keep 1.8 m clear outside each exit.';
function pcBuildingRegsDims(p) {
  const g = (p && p.geometry) || {}, f = (p && p.facts) || {};
  return { W: Number(g.width) || Number(f.width) || 0, L: Number(g.length) || Number(f.length) || 0, doors: Array.isArray(g.doors) ? g.doors.filter(Boolean) : [] };
}
function pcBuildingRegsFingerprint(p) {
  const f = (p && p.facts) || {}, fp = f.buildingFootprint || {}, d = pcBuildingRegsDims(p);
  return pcFireExitHash(JSON.stringify([PC_BG_REGS_VERSION, d.W, d.L,
    d.doors.map(o => [o.type, o.subtype || '', o.wall, Number(o.offset) || 0, Number(o.width) || 0, Number(o.sillHeight) || 0]),
    fp.center || null, fp.corners || null, Number(fp.angle) || 0, f.buildingPositionStatus || '',
    f.siteBoundaryStatus || '', f.relevantBoundaries || null, f.buildingUse || f.use || '', f.buildingType || '',
    f.personnelDoorsAsFireExits === true, pcFireExitDesignConfirmed(p)]));
}
// Footprint corners in local metres, A = c0→c1, B = c1→c2, C = c2→c3, D = c3→c0
// (the same lettering as the Building Design site reference). Offsets on each
// elevation run from its first corner (left-hand corner viewed from outside).
function pcBuildingRegsSite(p) {
  const f = (p && p.facts) || {};
  if (f.siteBoundaryStatus !== 'confirmed') return null;
  const lines = (Array.isArray(f.relevantBoundaries) ? f.relevantBoundaries : []).filter(l => Array.isArray(l) && l.length >= 2);
  const corners = pcFireExitFootprintCorners(f.buildingFootprint || {});
  if (!lines.length || !corners) return null;
  const origin = { lat: corners.reduce((t, c) => t + c.lat, 0) / 4, lng: corners.reduce((t, c) => t + c.lng, 0) / 4 };
  const local = corners.map(c => pcFireExitLocal(c, origin));
  const segs = [];
  lines.forEach(l => { for (let i = 0; i < l.length - 1; i++) segs.push([pcFireExitLocal(l[i], origin), pcFireExitLocal(l[i + 1], origin)]); });
  const dist = (a, b) => segs.reduce((m, q) => Math.min(m, pcFireExitSegDist(a, b, q[0], q[1])), Infinity);
  const wall = { A: [local[0], local[1]], B: [local[1], local[2]], C: [local[2], local[3]], D: [local[3], local[0]] };
  const along = (letter, m) => { const [a, b] = wall[letter], len = Math.hypot(b.x - a.x, b.y - a.y) || 1, t = Math.max(0, Math.min(1, m / len)); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
  return { wall, dist, along };
}
function pcBuildingRegsBoundary(site) {
  if (!site) return { distances: null, contact: null };
  const distances = {}, contact = {};
  Object.keys(site.wall).forEach(k => {
    const [a, b] = site.wall[k], d = site.dist(a, b), len = Math.hypot(b.x - a.x, b.y - a.y);
    distances[k] = Number.isFinite(d) ? Math.round(d * 100) / 100 : null;
    // Where the nearest point is: a building corner (shared with the next wall) or along the wall.
    let at = null;
    if (Number.isFinite(d) && len > 1.2) {
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const inner = site.dist({ x: a.x + ux * 0.5, y: a.y + uy * 0.5 }, { x: b.x - ux * 0.5, y: b.y - uy * 0.5 });
      at = inner > d + 0.05 ? 'corner' : 'wall';
    }
    contact[k] = at;
  });
  return { distances, contact };
}
// Perimeter runs longer than 32 m with no exit or customer door.
function pcBuildingRegsTravel(W, L, doors, fireExits) {
  const P = 2 * (W + L), spacing = PC_FIRE_EXIT_MAX_TRAVEL;
  const ranges = [['D', 0, L], ['A', L, L + W], ['B', L + W, 2 * L + W], ['C', 2 * L + W, P]];
  const pts = doors.filter(d => d.type !== 'window' && d.wall).map((d, i) => ({ ref: String(d.ref || (d.type === 'roller' ? 'R' : d.subtype === 'double' ? 'D' : 'P') + (i + 1)), elevation: PC_BG_WALL_LETTER[d.wall], t: pcFireExitLoopT(pcFireExitCentre(d.wall, Number(d.offset) || 0, Number(d.width) || 0, W, L), W, L) }));
  (fireExits || []).forEach(d => pts.push({ ref: d.ref, elevation: PC_BG_WALL_LETTER[d.wall], t: pcFireExitLoopT(pcFireExitCentre(d.wall, d.offset, d.width, W, L), W, L), fire: true }));
  pts.sort((a, b) => a.t - b.t);
  const covered = (t1, t2) => ranges.filter(([, a, b]) => { const s = t1 % P, e = s + (t2 - t1); return (b > s && a < e) || (b + P > s && a + P < e); }).map(r => r[0]);
  const flags = [];
  let maxRun = pts.length ? 0 : P;
  if (!pts.length && P > 0) flags.push({ kind: 'travel', level: 'amber', length: Math.round(P * 10) / 10, elevations: ['A', 'B', 'C', 'D'], text: 'No exits or customer doors: the whole ' + Math.round(P) + ' m perimeter is over 32 m from an exit — possible travel-distance issue.' });
  pts.forEach((pt, k) => {
    const next = k === pts.length - 1 ? pts[0] : pts[k + 1], run = (k === pts.length - 1 ? next.t + P : next.t) - pt.t;
    if (pts.length === 1 && k === 0) { maxRun = P; } else maxRun = Math.max(maxRun, run);
    const length = pts.length === 1 ? P : run;
    if (length > spacing + 1e-6) flags.push({ kind: 'travel', level: 'amber', length: Math.round(length * 10) / 10, from: pt.ref, to: next.ref, elevations: covered(pt.t, pt.t + length), text: (pts.length === 1 ? 'Only one exit or customer door (' + pt.ref + ', Elevation ' + pt.elevation + '): the perimeter run back round to it is ' + (Math.round(length * 10) / 10) + ' m' : 'Perimeter run of ' + (Math.round(length * 10) / 10) + ' m with no exit or customer door between ' + pt.ref + ' (Elevation ' + pt.elevation + ') and ' + next.ref + ' (Elevation ' + next.elevation + ')') + ' — over 32 m.' });
  });
  return { spacing, perimeter: P, maxRun: Math.round(maxRun * 10) / 10, countsFireExits: Boolean(fireExits && fireExits.length), flags };
}
// 1.8 m clear space outside each exit (indicative fire exits + customer personnel/double doors),
// measured from the door opening to the nearest marked boundary.
function pcBuildingRegsClearSpace(site, distances, doors, fireExits) {
  const exits = [];
  const add = (d, kind) => {
    const letter = PC_BG_WALL_LETTER[d.wall];
    if (!letter) return;
    let distance = null;
    if (site) { const a = site.along(letter, Number(d.offset) || 0), b = site.along(letter, (Number(d.offset) || 0) + (Number(d.width) || 0)); const v = site.dist(a, b); distance = Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }
    exits.push({ ref: String(d.ref || ''), kind, elevation: letter, wallDistance: distances ? distances[letter] : null, distance, ok: distance == null ? null : distance >= PC_BG_CLEAR_SPACE_M });
  };
  (fireExits || []).forEach(d => add(d, 'fireExit'));
  doors.filter(d => d.type === 'personnel').forEach(d => add(d, d.subtype === 'double' ? 'double' : 'personnel'));
  const flags = exits.filter(x => x.ok === false).map(x => ({ kind: 'clear-space', level: x.distance < 1 ? 'high' : 'amber', ref: x.ref, elevation: x.elevation, distance: x.distance, text: x.ref + ' (Elevation ' + x.elevation + '): boundary approx. ' + x.distance.toFixed(1) + ' m from the exit — under the 1.8 m clear space.' }));
  return { clearance: PC_BG_CLEAR_SPACE_M, note: PC_BG_CLEAR_SPACE_NOTE, measured: Boolean(site), exits, flags };
}
function pcBuildingRegsCompute(p, fireExits) {
  const { W, L, doors } = pcBuildingRegsDims(p), site = pcBuildingRegsSite(p), b = pcBuildingRegsBoundary(site);
  const fe = fireExits && fireExits.doors ? fireExits.doors : null;
  return {
    version: PC_BG_REGS_VERSION,
    computedAt: new Date().toISOString(),
    inputsFingerprint: pcBuildingRegsFingerprint(p),
    stale: false,
    designConfirmed: pcFireExitDesignConfirmed(p),
    boundaryDistances: b.distances,
    boundaryContact: b.contact,
    travel: W > 0 && L > 0 ? pcBuildingRegsTravel(W, L, doors, null) : null,
    fireExits: fe ? { count: fe.length, maxPerimeterGap: fireExits.maxPerimeterGap, doors: fe, personnelDoorsAsFireExits: Boolean(fireExits.personnelDoorsAsFireExits) } : null,
    clearSpace: pcBuildingRegsClearSpace(site, b.distances, doors, fe)
  };
}
// Entry point for the save/confirm hooks. Confirmed design: full refresh (fire
// exits + Stage 2 flags + buildingRegs). Otherwise only buildingRegs, no exits.
function pcBuildingRegsRun(p) {
  if (!p) return null;
  if (pcFireExitDesignConfirmed(p)) return pcFireExitRefresh(p).buildingRegs;
  const regs = pcBuildingRegsCompute(p, null);
  regs.designConfirmed = false;
  p.backgroundChecks = { buildingRegs: regs };
  return regs;
}

// ---- Drawing: simple fire-exit door symbol (door leaf, outward swing arc, FE tag) ----
// ox/oy = plan origin in px, s = px per metre. minWidth keeps tiny doors legible.
function pcFireExitSymbol(door, ox, oy, s, W, L, opts) {
  const o = opts || {}, green = '#0a7a35';
  const g = pcFireExitSegment(door.wall, door.offset, door.width, W, L);
  const realW = door.width * s, dw = Math.max(realW, o.minWidth || 0), grow = (dw - realW) / 2 / s;
  const ux = (g.x2 - g.x1) / door.width, uy = (g.y2 - g.y1) / door.width;
  const ax = ox + (g.x1 - ux * grow) * s, ay = oy + (g.y1 - uy * grow) * s;
  const bx = ox + (g.x2 + ux * grow) * s, by = oy + (g.y2 + uy * grow) * s;
  const ex = ax + g.nx * dw, ey = ay + g.ny * dw;
  // Sweep so the arc bulges outward from the hinge (a) between leaf end (e) and jamb (b).
  const sweep = (ux * g.ny - uy * g.nx) > 0 ? 1 : 0;
  const size = o.tag || 7, font = o.font || 6;
  const tx = (ax + bx) / 2 + g.nx * (dw + size * (g.nx ? 1.8 : 1.2)), ty = (ay + by) / 2 + g.ny * (dw + size * 1.2);
  const f = v => v.toFixed(1);
  return `<g class="pc-fire-exit" data-fire-exit="${pcEscXml(door.ref)}">` +
    `<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}" stroke="#ffffff" stroke-width="3"/>` +
    `<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(ex)}" y2="${f(ey)}" stroke="${green}" stroke-width="1.6"/>` +
    `<path d="M${f(ex)},${f(ey)} A${f(dw)},${f(dw)} 0 0 ${sweep} ${f(bx)},${f(by)}" fill="none" stroke="${green}" stroke-width=".9" stroke-dasharray="2,1.5"/>` +
    `<rect x="${f(tx - size * 1.1)}" y="${f(ty - size * .6)}" width="${f(size * 2.2)}" height="${f(size * 1.2)}" rx="1.5" fill="${green}"/>` +
    `<text x="${f(tx)}" y="${f(ty + font * .36)}" font-size="${font}" font-weight="800" text-anchor="middle" fill="#ffffff">${pcEscXml(door.ref)}</text></g>`;
}

// Dedicated plan for the quotation design summary, in the Building Design plan
// orientation (length left-right, Elevation A on the right) and drawn to scale.
function pcFireExitPlanSVG(p, fire) {
  const g = p.geometry || {}, W = Number(g.width) || 0, L = Number(g.length) || 0;
  if (!(W > 0 && L > 0) || !fire) return '';
  const vw = 760, vh = 440, padX = 90, top = 70, bottom = 60;
  const s = Math.min((vw - 2 * padX) / L, (vh - top - bottom) / W);
  const pw = L * s, ph = W * s, ox = (vw - pw) / 2, oy = top + (vh - top - bottom - ph) / 2;
  const f = v => v.toFixed(1);
  const clipId = 'pcFireClip' + pcFireExitHash(String(p.id || 'x'));
  const coverage = '';
  const user = (Array.isArray(g.doors) ? g.doors : []).filter(d => ['front', 'back', 'left', 'right'].includes(d.wall)).map(d => {
    const sg = pcFireExitSegment(d.wall, Number(d.offset) || 0, Number(d.width) || 0, W, L);
    return `<line x1="${f(ox + sg.x1 * s)}" y1="${f(oy + sg.y1 * s)}" x2="${f(ox + sg.x2 * s)}" y2="${f(oy + sg.y2 * s)}" stroke="#98a2b3" stroke-width="4"/>`;
  }).join('');
  const exits = (fire.doors || []).map(d => pcFireExitSymbol(d, ox, oy, s, W, L, { tag: 8, font: 7, minWidth: 16 })).join('');
  const label = (t, x, y, weight) => `<text x="${f(x)}" y="${f(y)}" font-size="9" ${weight ? 'font-weight="700" ' : ''}fill="#667085" text-anchor="middle">${pcEscXml(t)}</text>`;
  return `<svg class="pc-fire-exit-plan" viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Indicative fire exit plan" style="width:100%;height:auto;background:#fff">` +
    `<text x="${vw / 2}" y="20" font-size="12" font-weight="800" text-anchor="middle" fill="#101828">INDICATIVE FIRE EXITS — PLAN (QUOTATION ONLY)</text>` +
    `<defs><clipPath id="${clipId}"><rect x="${f(ox)}" y="${f(oy)}" width="${f(pw)}" height="${f(ph)}"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})">${coverage}</g>` +
    `<rect x="${f(ox)}" y="${f(oy)}" width="${f(pw)}" height="${f(ph)}" fill="none" stroke="#101828" stroke-width="2"/>${user}${exits}` +
    label(L + ' m length', ox + pw / 2, top - 30) + `<text x="${f(ox - 62)}" y="${f(oy + ph / 2)}" font-size="9" fill="#667085" text-anchor="middle" transform="rotate(-90 ${f(ox - 62)} ${f(oy + ph / 2)})">${W} m width</text>` +
    label('D', ox + pw / 2, oy - 26, true) + label('B', ox + pw / 2, oy + ph + 32, true) + label('C', ox - 38, oy + ph / 2 + 3, true) + label('A', ox + pw + 38, oy + ph / 2 + 3, true) +
    `<text x="14" y="${vh - 12}" font-size="8.5" fill="#667085">Same orientation as the Building Design plan. 32 m rule: one fire exit (FE) every 32 m around the perimeter. Grey: customer doors and windows (not fire exits).</text>` +
    `</svg>`;
}

function pcBgBoundaryFlags(distances) {
  if (!distances) return [];
  return Object.keys(distances).filter(k => distances[k] != null && distances[k] < 3).map(k => ({ kind: 'boundary', level: distances[k] < 1 ? 'high' : 'amber', elevation: k, distance: distances[k] }));
}

// Card for the Stage 2 / quotation / design summary. Returns '' when the design
// is not confirmed. Saving is left to the caller.
function pcBackgroundChecksMarkup(p, options) {
  const opts = options || {};
  const bg = pcBackgroundChecksFor(p);
  if (!bg) return '';
  const e = pcBgEsc;
  const boundaryFlags = pcBgBoundaryFlags(bg.boundaryDistances);
  const flag = (level, html) => '<div class="pc-bg-flag is-' + level + '" style="border-left:4px solid ' + (level === 'high' ? '#b42318' : '#dc6803') + ';background:' + (level === 'high' ? '#fef3f2' : '#fffaeb') + ';padding:8px 12px;margin:6px 0;border-radius:6px">' + html + '</div>';
  let html = '<div class="card pc-bg-card" id="stage2BackgroundChecks" style="margin-top:18px"><span class="pill">Stage 2 · Quotation only</span><h3>Background checks on your confirmed design</h3>';
  // 1) Boundary
  if (bg.boundaryDistances) {
    html += '<h4>Distance to boundary</h4><ul class="pc-bg-boundary">' + Object.keys(bg.boundaryDistances).map(k => '<li>Elevation ' + e(k) + ': ' + (bg.boundaryDistances[k] == null ? 'not measured' : 'approx. ' + e(bg.boundaryDistances[k].toFixed(1)) + ' m to the nearest marked boundary') + '</li>').join('') + '</ul>';
    html += boundaryFlags.map(f => flag(f.level, '<b>' + e(PC_BG_BOUNDARY_NOTE) + '</b> Elevation ' + e(f.elevation) + ' is approx. ' + e(f.distance.toFixed(1)) + ' m from the boundary' + (f.level === 'high' ? ' (under 1 m).' : ' (under 3 m).'))).join('');
  }
  // 2) Fire exits
  const fire = bg.fireExits;
  if (fire) {
    const doors = fire.doors || [];
    html += '<h4 id="quotationFireExits">Indicative fire exits</h4><p class="pc-fire-exit-note"><b>' + e(PC_FIRE_EXIT_NOTE) + '</b></p>';
    if (doors.length) {
      html += '<div class="svg-wrap">' + pcFireExitPlanSVG(p, fire) + '</div>';
      html += '<p>' + doors.length + ' indicative fire exit' + (doors.length === 1 ? '' : 's') + ' — 32 m rule: one fire exit every ' + PC_FIRE_EXIT_MAX_TRAVEL + ' m around the perimeter.</p>';
      html += '<ul class="pc-fire-exit-list">' + doors.map(d => '<li><b>' + e(d.ref) + '</b> — ' + e(PC_FIRE_EXIT_WALL_LABEL[d.wall] || d.wall) + ', approx. ' + e(String(d.offset)) + ' m from the left-hand corner viewed from outside, ' + e(String(d.width)) + ' m single fire-exit door</li>').join('') + '</ul>';
    } else {
      html += flag('amber', e(fire.reason || 'No indicative fire exits could be placed.'));
    }
    html += '<p class="meta">Customer personnel doors, double doors and roller doors are not counted as fire exits.</p>';
  }
  // Clear space outside exits (building-regs calculation)
  const regs = bg.buildingRegs;
  if (regs && regs.clearSpace) {
    html += '<h4 id="quotationClearSpace">Clear space outside exits</h4><p class="pc-bg-clear-note">' + e(PC_BG_CLEAR_SPACE_NOTE) + (regs.clearSpace.measured ? '' : ' No boundary has been marked, so this has not been measured.') + '</p>';
    html += (regs.clearSpace.flags || []).map(f => flag(f.level, e(f.text))).join('');
  }
  // 3) Other flags
  if ((bg.otherFlags || []).length) html += '<h4>Other flags</h4>' + bg.otherFlags.map(f => flag(f.level || 'amber', e(f.text))).join('');
  html += '<p class="meta pc-bg-racking"><b>Note:</b> ' + e(bg.rackingNote || PC_BG_RACKING_NOTE) + ' Full compartmentation and space separation are not calculated.</p>';
  if (typeof buildingDrawingSVG === 'function') html += '<details class="pc-fire-exit-drawing"' + (opts.drawingOpen ? ' open' : '') + '><summary>Preliminary plan &amp; elevations (customer openings)</summary><div class="svg-wrap">' + buildingDrawingSVG(p) + '</div></details>';
  return html + '</div>';
}

// Persist when the checks were created, refreshed or cleared during rendering.
function pcBackgroundChecksRender(p, options) {
  const before = p && p.backgroundChecks ? p.backgroundChecks.sourceFingerprint : null;
  const legacy = Boolean(p && p.buildingDesign && p.buildingDesign.autoFireExits);
  const markup = pcBackgroundChecksMarkup(p, options);
  const after = p && p.backgroundChecks ? p.backgroundChecks.sourceFingerprint : null;
  if ((before !== after || legacy) && typeof save === 'function') save();
  return markup;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pcBuildingRegsCompute, pcBuildingRegsTravel, pcBuildingRegsRun, pcFireExitPlace, pcFireExitRollerPicks, PC_FIRE_EXIT_PD_NOTE, pcFireExitDefaultColumns, pcFireExitLoopT, pcFireExitIsIndustrial, pcBgBoundaryDistances, pcBgOtherFlags, pcFireExitMaxDistance, pcFireExitGrid, PC_FIRE_EXIT_NOTE };
}
