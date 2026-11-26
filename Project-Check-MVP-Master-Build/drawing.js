
// Project Check — preliminary drawing renderer.
// Standard buildings: reads the saved Building Design geometry (building-layout.js
// buildingDesignSourceGeometry) so the report matches the Plan / A / B / C / D views.
// Canopy: consumes buildGeometry(p) from geometry.js. No geometry/business logic lives here —
// this file can be swapped for a better rendering/CAD engine later without touching
// the geometry model or the customer journey (see Sprint 2 note 12).
//
// Structure-aware: buildingDrawingSVG(p) branches purely on geom.structureType (never
// re-reads p.facts.structure itself), so structure-derived decisions live in one place
// (geometry.js) and this file only renders what geometry.js gives it.

function pcEscXml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }

// Set by app.js once the approved logo asset (assets/project-check-logo.png, square,
// 1254x1254) has been loaded and inlined as a data URI — see loadLogoDataUrl() in
// app.js. Embedding the exact unaltered artwork here (never redrawn) so the title
// block carries the real approved identity, on-screen and when rasterised for PDF.
var PC_LOGO_DATA_URL = null;

// Approved-logo mark for the drawing title block, at natural 1:1 aspect ratio.
// Falls back to no mark (never a substitute symbol) if the asset hasn't loaded yet.
function pcMonogramSVG(x, y, size) {
  if (!PC_LOGO_DATA_URL) return '';
  return `<image href="${PC_LOGO_DATA_URL}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
}

// ---- Shared drawing primitives (used by both the standard and canopy renderers) ----
const PC_INK = '#101828', PC_DIM = '#667085', PC_GREEN = '#207a3d', PC_GROUND = '#475467';

function pcDimLine(x1, y1, x2, y2) { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${PC_DIM}" stroke-width="1" marker-start="url(#pcArrow)" marker-end="url(#pcArrow)"/>`; }
function pcWitness(x1, y1, x2, y2) { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${PC_DIM}" stroke-width=".6" stroke-dasharray="2,2"/>`; }
function pcGroundLine(x1, x2, y) { let hatch = ''; for (let x = x1; x < x2; x += 8) hatch += `<line x1="${x}" y1="${y}" x2="${x - 5}" y2="${y + 6}" stroke="${PC_GROUND}" stroke-width="1"/>`; return `<line x1="${x1 - 4}" y1="${y}" x2="${x2 + 4}" y2="${y}" stroke="${PC_GROUND}" stroke-width="1.6"/>${hatch}`; }
// Vertical hatch fill for a wall face (trapezoidal-sheet-cladding representation) —
// structurally distinct from pcGroundLine()'s diagonal earth-hatch, not a duplicate.
function pcCladdingHatch(x1, y1, x2, y2, spacing) { spacing = spacing || 6; let out = ''; for (let x = x1; x <= x2; x += spacing) out += `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${PC_GROUND}" stroke-width=".6"/>`; return out; }

// Doors on a flat/eaves-height elevation (used for every elevation panel — the
// triangular gable outline sits behind these, but doors are always drawn as rects
// sitting on the ground line regardless of the outline above them).
function pcElevationDoors(doors, wall, ox, groundY, scale) {
  let out = '';
  doors.filter(d => d.wall === wall).forEach(d => {
    const dw = (Number(d.width) || 0) * scale, dh = (Number(d.height) || 0) * scale;
    const x = ox + (Number(d.offset) || 0) * scale;
    out += `<rect x="${x.toFixed(1)}" y="${(groundY - dh).toFixed(1)}" width="${dw.toFixed(1)}" height="${dh.toFixed(1)}" fill="none" stroke="${PC_GREEN}" stroke-width="1.3"/><text x="${(x + dw / 2).toFixed(1)}" y="${(groundY - dh - 4).toFixed(1)}" font-size="6" text-anchor="middle" fill="${PC_INK}">${pcEscXml(d.ref)}</text>`;
  });
  return out;
}

// Doors marked on the plan view — reused unchanged for both structure types.
function pcPlanDoors(doors, planOx, planOy, pw, pl, planScale) {
  let out = '';
  doors.forEach(d => {
    const dw = (Number(d.width) || 0) * planScale;
    if (d.wall === 'front' || d.wall === 'back') {
      const x = planOx + (Number(d.offset) || 0) * planScale;
      const y = d.wall === 'front' ? planOy + pl : planOy;
      out += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + dw).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${PC_GREEN}" stroke-width="4"/><text x="${(x + dw / 2).toFixed(1)}" y="${(y + (d.wall === 'front' ? 13 : -5)).toFixed(1)}" font-size="6.5" text-anchor="middle" fill="${PC_INK}">${pcEscXml(d.ref)}</text>`;
    } else if (d.wall === 'left' || d.wall === 'right') {
      const y = planOy + (Number(d.offset) || 0) * planScale;
      const x = d.wall === 'left' ? planOx : planOx + pw;
      out += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + dw).toFixed(1)}" stroke="${PC_GREEN}" stroke-width="4"/><text x="${(x + (d.wall === 'left' ? -9 : 9)).toFixed(1)}" y="${(y + dw / 2 + 2).toFixed(1)}" font-size="6.5" text-anchor="middle" fill="${PC_INK}">${pcEscXml(d.ref)}</text>`;
    }
  });
  return out;
}

// Flat/eaves-height elevation panel (side elevations on the standard building; both
// clad side elevations on the canopy). Returns { svg, ox, groundY, eaveY, scale }.
function pcFlatElevationPanel(x, y, maxW, maxH, l, h, doors, wall, title, opts) {
  opts = opts || {};
  const scale = Math.min(maxW / l, (maxH - 14) / h);
  const sw = l * scale, seave = h * scale;
  const ox = x + (maxW - sw) / 2, groundY = y + maxH - 6, eaveY = groundY - seave;
  const clad = opts.clad ? pcCladdingHatch(ox, eaveY, ox + sw, groundY, 6) : '';
  const doorsSvg = pcElevationDoors(doors, wall, ox, groundY, scale);
  const svg = `${clad}<rect x="${ox}" y="${eaveY}" width="${sw}" height="${seave}" fill="none" stroke="${PC_INK}" stroke-width="1.6"/>${doorsSvg}
    ${pcGroundLine(ox - 10, ox + sw + 10, groundY)}
    ${pcWitness(ox - 14, eaveY, ox - 4, eaveY)}${pcWitness(ox - 14, groundY, ox - 4, groundY)}${pcDimLine(ox - 9, eaveY, ox - 9, groundY)}
    <text x="${ox - 19}" y="${(eaveY + groundY) / 2}" font-size="8" text-anchor="middle" fill="${PC_DIM}" transform="rotate(-90 ${ox - 19} ${(eaveY + groundY) / 2})">${h} m clear</text>
    ${opts.note ? `<text x="${ox}" y="${eaveY - 6}" font-size="6.5" fill="${PC_DIM}">${pcEscXml(opts.note)}</text>` : ''}
    <text x="${x + maxW / 2}" y="${y + maxH + 24}" font-size="9" text-anchor="middle" fill="${PC_INK}" font-weight="700">${pcEscXml(title)}</text>`;
  return { svg, ox, groundY, eaveY, scale };
}

// Triangular gable/ridge elevation panel (gable elevations on the standard building;
// front/rear elevations on the canopy — same duo-pitch ridge construction either way,
// the canopy's "saddle" ridge running the depth of the building means both its front
// and rear ends share one ridge/eaves height, exactly like this shape reused twice).
function pcGableElevationPanel(x, y, maxW, maxH, w, h, rh, doors, wall, title, opts) {
  opts = opts || {};
  const scale = Math.min(maxW / w, (maxH - 22) / rh);
  const gw = w * scale, geave = h * scale, gridge = rh * scale;
  const ox = x + (maxW - gw) / 2, groundY = y + maxH - 6, eaveY = groundY - geave, apexY = groundY - gridge;
  const clad = opts.clad ? pcCladdingHatch(ox, eaveY, ox + gw, groundY, 6) : '';
  const doorsSvg = pcElevationDoors(doors, wall, ox, groundY, scale);
  const svg = `${clad}<polyline points="${ox},${eaveY} ${ox},${groundY} ${ox + gw},${groundY} ${ox + gw},${eaveY} ${ox + gw / 2},${apexY} ${ox},${eaveY}" fill="none" stroke="${PC_INK}" stroke-width="1.6"/>${doorsSvg}
    ${pcGroundLine(ox - 10, ox + gw + 10, groundY)}
    ${pcWitness(ox, eaveY - 12, ox, eaveY - 2)}${pcWitness(ox + gw, eaveY - 12, ox + gw, eaveY - 2)}${pcDimLine(ox, eaveY - 7, ox + gw, eaveY - 7)}
    <text x="${ox + gw / 2}" y="${eaveY - 11}" font-size="8" text-anchor="middle" fill="${PC_DIM}">${w} m</text>
    ${pcWitness(ox - 14, eaveY, ox - 4, eaveY)}${pcWitness(ox - 14, groundY, ox - 4, groundY)}${pcDimLine(ox - 9, eaveY, ox - 9, groundY)}
    <text x="${ox - 19}" y="${(eaveY + groundY) / 2}" font-size="7.5" text-anchor="middle" fill="${PC_DIM}" transform="rotate(-90 ${ox - 19} ${(eaveY + groundY) / 2})">${h} m clear</text>
    ${pcWitness(ox + gw + 14, apexY, ox + gw + 4, apexY)}${pcWitness(ox + gw + 14, groundY, ox + gw + 4, groundY)}${pcDimLine(ox + gw + 9, apexY, ox + gw + 9, groundY)}
    <text x="${ox + gw + 24}" y="${(apexY + groundY) / 2}" font-size="7.5" text-anchor="middle" fill="${PC_DIM}" transform="rotate(-90 ${ox + gw + 24} ${(apexY + groundY) / 2})">ridge ${rh} m (indicative)</text>
    ${opts.note ? `<text x="${ox}" y="${apexY - 8}" font-size="6.5" fill="${PC_DIM}">${pcEscXml(opts.note)}</text>` : ''}
    <text x="${x + maxW / 2}" y="${y + maxH + 24}" font-size="9" text-anchor="middle" fill="${PC_INK}" font-weight="700">${pcEscXml(title)}</text>`;
  return { svg, ox, groundY, eaveY, apexY, scale };
}

function pcBanner(subtitle) {
  return `<rect x="0" y="0" width="900" height="40" fill="${PC_INK}"/>
    <text x="450" y="17" font-size="13" font-weight="800" text-anchor="middle" fill="#ffffff">PRELIMINARY PROJECT CHECK DRAWING</text>
    <text x="450" y="32" font-size="9.5" text-anchor="middle" fill="#b9dfbf">${pcEscXml(subtitle)}</text>`;
}

// Title block — identical content/position contract for both structure types, always
// in the row-2, column-3 grid slot so svgToPngDataUrl() never needs to branch.
function pcTitleBlock(p, tbX, tbY, tbW, tbH) {
  const logoSize = 84;
  const ref = 'PC-' + String(p.id || 'DRAFT').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
  const stageLabel = p.stage2Complete ? 'Stage 2' : (p.stage1Complete ? 'Stage 1' : 'Draft');
  const textX = tbX + logoSize + 22;
  // Keep the address inside the title block (long addresses ran past the border).
  const fullAddress = String(p.address || 'Address not confirmed');
  const address = fullAddress.length > 76 ? fullAddress.slice(0, 75).trimEnd() + '…' : fullAddress;
  const logoBlock = PC_LOGO_DATA_URL
    ? pcMonogramSVG(tbX + 8, tbY + (tbH - logoSize) / 2, logoSize)
    : `<text x="${tbX + 8}" y="${tbY + tbH / 2}" font-size="11" font-weight="800" fill="${PC_INK}">PROJECT CHECK</text>`;
  return `<rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" fill="none" stroke="${PC_INK}" stroke-width="1"/>
    <line x1="${textX - 10}" y1="${tbY + 6}" x2="${textX - 10}" y2="${tbY + tbH - 6}" stroke="${PC_INK}" stroke-width=".6"/>
    ${logoBlock}
    <text x="${textX}" y="${tbY + 18}" font-size="8" font-weight="700" fill="${PC_INK}">${pcEscXml(p.name || 'Project')}</text>
    <text x="${textX}" y="${tbY + 30}" font-size="${address.length > 62 ? 5.4 : 6.5}" fill="${PC_DIM}">${pcEscXml(address)}</text>
    <text x="${textX}" y="${tbY + 44}" font-size="6.5" fill="${PC_DIM}">Drawing: Preliminary plan &amp; elevations</text>
    <text x="${textX}" y="${tbY + 56}" font-size="6.5" fill="${PC_DIM}">Ref: ${ref}</text>
    <text x="${textX}" y="${tbY + 68}" font-size="6.5" fill="${PC_DIM}">Date: ${new Date().toLocaleDateString()}</text>
    <text x="${textX}" y="${tbY + 80}" font-size="6.5" fill="${PC_DIM}">Status: ${stageLabel} — preliminary</text>
    <text x="${textX}" y="${tbY + 94}" font-size="6.5" font-weight="700" fill="#a15c00">Not for construction. Not structurally verified.</text>`;
}

// ---- Shared grid layout (3 columns x 2 rows) used by both renderers ----
const PC_GRID = { row1Y: 64, row2Y: 264, maxH: 148, maxW: 230, cols: [44, 300, 560] };

function buildingDrawingSVG(p) {
  const geom = buildGeometry(p);
  const w = geom.width, l = geom.length, h = geom.eaveHeight;
  if (!w || !l || !h) return '';
  if (geom.structureType === 'canopy') return renderCanopyDrawingSVG(p, geom);
  const design = pcReportDesignGeometry(p, geom);
  return renderStandardDrawingSVG(p, design);
}

// ---- One source with Building Design (building-layout.js) ----
// The report sheet reads the SAME saved Building Design geometry the Plan / A / B
// / C / D views load (buildingDesignSourceGeometry: doors, windows, skylights,
// solar arrays, current dimensions and ridge). The report is rebuilt from
// p.geometry every time it is opened or downloaded, so confirming Building
// Design is all it takes for the sheet to match what the client just saw.
// Falls back to buildGeometry() (plus any persisted roof openings) only when
// building-layout.js has not loaded.
function pcReportDesignGeometry(p, fallback) {
  let geom = null;
  if (typeof buildingDesignSourceGeometry === 'function') {
    try { geom = buildingDesignSourceGeometry(p).geometry; } catch (e) { geom = null; }
  }
  if (!geom || !Number(geom.width) || !Number(geom.length) || !Number(geom.eaveHeight)) {
    geom = JSON.parse(JSON.stringify(fallback || buildGeometry(p)));
    geom.skylights = Array.isArray(p?.geometry?.skylights) ? JSON.parse(JSON.stringify(p.geometry.skylights)) : [];
    geom.solarArrays = Array.isArray(p?.geometry?.solarArrays) ? JSON.parse(JSON.stringify(p.geometry.solarArrays)) : [];
  }
  if (!Array.isArray(geom.doors)) geom.doors = [];
  if (!Array.isArray(geom.skylights)) geom.skylights = [];
  if (!Array.isArray(geom.solarArrays)) geom.solarArrays = [];
  return geom;
}

// Same names as the Building Design tabs: A = front, B = right, C = back, D = left.
const PC_DESIGN_VIEWS = [
  { key: 'a', wall: 'front', title: 'ELEVATION A — FRONT ELEVATION' },
  { key: 'b', wall: 'right', title: 'ELEVATION B — RIGHT SIDEWALL' },
  { key: 'c', wall: 'back', title: 'ELEVATION C — REAR ELEVATION' },
  { key: 'd', wall: 'left', title: 'ELEVATION D — LEFT SIDEWALL' }
];
const PC_WINDOW = '#3a8fb7', PC_SKY = '#7cc4e4', PC_SOLAR = '#1d3f8f';

function pcWallLength(geom, wall) { return wall === 'front' || wall === 'back' ? Number(geom.width) || 0 : Number(geom.length) || 0; }
function pcOpeningKind(d) { return d?.type === 'window' ? 'window' : d?.type === 'roller' ? 'roller' : d?.type === 'fireExit' ? 'fire' : d?.subtype === 'double' ? 'double' : 'personnel'; }
function pcPlanRef(d) {
  const n = String(d?.ref || '').match(/\d+/)?.[0] || '';
  const k = pcOpeningKind(d);
  return k === 'fire' ? String(d.ref || 'FE') : k === 'window' ? 'W' + n : k === 'roller' ? 'RD' + n : k === 'double' ? 'DD' + n : 'PD' + n;
}
function pcFootprintAngle(p) {
  const facts = typeof projectFacts === 'function' ? projectFacts(p) : (p?.facts || {});
  return Number(facts?.buildingFootprint?.angle) || 0;
}
// Same bearing rule as buildingDesignWallBearing(): front 0°, right 90°, back 180°, left 270°.
function pcWallBearing(p, wall) {
  const deg = (((pcFootprintAngle(p) + ({ front: 0, right: 90, back: 180, left: 270 }[wall] || 0)) % 360) + 360) % 360;
  const points = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return `Facing ${points[Math.round(deg / 45) % 8]} ${Math.round(deg)}°`;
}
// Structural bays: the confirmed Building Design grid when saved, otherwise the
// same grid rule the page uses.
function pcBayInfo(p, geom, wall) {
  const len = pcWallLength(geom, wall);
  const grid = p?.buildingDesign?.structuralGrid;
  const gable = wall === 'front' || wall === 'back';
  const savedCount = grid ? Number(gable ? grid.gableBayCount : grid.lengthBayCount) : 0;
  if (savedCount >= 1 && p?.buildingDesign?.sourceFingerprint && typeof buildingDesignFingerprint === 'function') {
    try { if (buildingDesignFingerprint(p, geom) === p.buildingDesign.sourceFingerprint) return { count: savedCount, spacing: len / savedCount }; } catch (e) { /* fall through */ }
  }
  if (typeof buildingDesignGridForLength === 'function') {
    try { const g = buildingDesignGridForLength(len, p); if (g && g.count >= 1) return { count: g.count, spacing: len / g.count }; } catch (e) { /* fall through */ }
  }
  const count = Math.max(1, Math.round(len / 5.2));
  return { count, spacing: len / count };
}
function pcColumnPositions(p, geom, wall) {
  const bay = pcBayInfo(p, geom, wall);
  if ((wall === 'front' || wall === 'back') && typeof buildingDesignGableColumnPositions === 'function') {
    try { const cols = buildingDesignGableColumnPositions(geom, wall, bay); if (Array.isArray(cols) && cols.length >= 2) return cols; } catch (e) { /* fall through */ }
  }
  return Array.from({ length: bay.count + 1 }, (_, i) => ({ metres: i * bay.spacing, adjusted: false }));
}
// ---- Plan (same axes as the Building Design plan: length across, width down;
// front on the right edge, back on the left, left wall along the top, right
// wall along the bottom) ----
function pcPlanOpeningLine(d, geom, x, y, pw, ph) {
  const len = pcWallLength(geom, d.wall) || 1, off = Number(d.offset) || 0, ow = Number(d.width) || 0;
  if (d.wall === 'front') return { x1: x + pw, y1: y + off / len * ph, x2: x + pw, y2: y + (off + ow) / len * ph, nx: -1, ny: 0 };
  if (d.wall === 'back') return { x1: x, y1: y + ph - off / len * ph, x2: x, y2: y + ph - (off + ow) / len * ph, nx: 1, ny: 0 };
  if (d.wall === 'left') return { x1: x + pw - off / len * pw, y1: y, x2: x + pw - (off + ow) / len * pw, y2: y, nx: 0, ny: 1 };
  return { x1: x + off / len * pw, y1: y + ph, x2: x + (off + ow) / len * pw, y2: y + ph, nx: 0, ny: -1 };
}
function pcPlanOpening(d, geom, x, y, pw, ph, lane) {
  const g = pcPlanOpeningLine(d, geom, x, y, pw, ph), k = pcOpeningKind(d);
  const { x1, y1, x2, y2, nx, ny } = g, f = n => n.toFixed(1);
  let sym = '';
  if (k === 'window') {
    sym = `<line x1="${f(x1 + nx * 1.5)}" y1="${f(y1 + ny * 1.5)}" x2="${f(x2 + nx * 1.5)}" y2="${f(y2 + ny * 1.5)}" stroke="${PC_WINDOW}" stroke-width="1"/><line x1="${f(x1 + nx * 3)}" y1="${f(y1 + ny * 3)}" x2="${f(x2 + nx * 3)}" y2="${f(y2 + ny * 3)}" stroke="${PC_WINDOW}" stroke-width="1"/>`;
  } else if (k === 'roller') {
    sym = `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${PC_INK}" stroke-width="3.2"/>`;
  } else {
    const colour = k === 'fire' ? PC_GREEN : PC_INK, leaf = Math.min(7, Math.max(3, Math.hypot(x2 - x1, y2 - y1)));
    const ex = x1 - nx * leaf, ey = y1 - ny * leaf;
    sym = `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#ffffff" stroke-width="2"/><line x1="${f(x1)}" y1="${f(y1)}" x2="${f(ex)}" y2="${f(ey)}" stroke="${colour}" stroke-width="1"/><path d="M ${f(x2)} ${f(y2)} Q ${f(x1)} ${f(y1)} ${f(ex)} ${f(ey)}" fill="none" stroke="${colour}" stroke-width=".6" stroke-dasharray="1.5,1"/>`;
  }
  // Label outside the wall, staggered into lanes so close openings stay legible.
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, step = 6 * (lane || 0);
  let lx = cx, ly = cy, anchor = 'middle';
  if (d.wall === 'left') ly = y1 - 4 - step;
  else if (d.wall === 'right') ly = y1 + 8 + step;
  else if (d.wall === 'back') { lx = x1 - 4 - step * 2; anchor = 'end'; ly = cy + 2; }
  else { lx = x1 + 4 + step * 2; anchor = 'start'; ly = cy + 2; }
  const fill = k === 'fire' ? PC_GREEN : PC_INK;
  return `<g data-report-opening="${pcEscXml(d.ref || '')}" data-wall="${pcEscXml(d.wall)}">${sym}<text x="${f(lx)}" y="${f(ly)}" font-size="4.6" text-anchor="${anchor}" fill="${fill}">${pcEscXml(pcPlanRef(d))}</text></g>`;
}
function pcPlanLanes(openings, geom, x, y, pw, ph) {
  const lanes = {};
  ['front', 'back', 'left', 'right'].forEach(wall => {
    const across = wall === 'left' || wall === 'right';
    const items = openings.filter(d => d.wall === wall).map(d => { const g = pcPlanOpeningLine(d, geom, x, y, pw, ph); return { d, pos: across ? (g.x1 + g.x2) / 2 : (g.y1 + g.y2) / 2 }; }).sort((a, b) => a.pos - b.pos);
    const last = [-Infinity, -Infinity, -Infinity], gap = across ? 14 : 7;
    items.forEach(it => { let lane = last.findIndex(v => it.pos - v >= gap); if (lane < 0) lane = last.indexOf(Math.min(...last)); lanes[it.d.ref + '|' + it.d.wall + '|' + it.d.offset] = lane; last[lane] = it.pos; });
  });
  return lanes;
}
function pcPlanRoofItem(item, geom, x, y, pw, ph, kind) {
  const L = Number(geom.length) || 1, W = Number(geom.width) || 1, f = n => n.toFixed(1);
  const sx = x + (Number(item.offsetY) || 0) / L * pw, sy = y + (Number(item.offsetX) || 0) / W * ph;
  const sw = Math.max(2, (Number(item.length) || 0) / L * pw), sh = Math.max(2, (Number(item.width) || 0) / W * ph);
  if (kind === 'solar') {
    const cols = Math.max(1, Math.floor(Number(item.columns) || 1)), rows = Math.max(1, Math.floor(Number(item.rows) || 1));
    let grid = '';
    for (let i = 1; i < cols; i++) grid += `<line x1="${f(sx + sw * i / cols)}" y1="${f(sy)}" x2="${f(sx + sw * i / cols)}" y2="${f(sy + sh)}" stroke="#9fb4e6" stroke-width=".4"/>`;
    for (let i = 1; i < rows; i++) grid += `<line x1="${f(sx)}" y1="${f(sy + sh * i / rows)}" x2="${f(sx + sw)}" y2="${f(sy + sh * i / rows)}" stroke="#9fb4e6" stroke-width=".4"/>`;
    return `<g data-report-solar="${pcEscXml(item.ref || 'PV')}"><rect x="${f(sx)}" y="${f(sy)}" width="${f(sw)}" height="${f(sh)}" fill="${PC_SOLAR}" stroke="#d99a1e" stroke-width=".8"/>${grid}<text x="${f(sx + sw / 2)}" y="${f(sy + sh / 2 + 1.8)}" font-size="4.6" font-weight="700" text-anchor="middle" fill="#ffffff">${pcEscXml(item.ref || 'PV')}</text></g>`;
  }
  return `<g data-report-skylight="${pcEscXml(item.ref || 'S')}"><rect x="${f(sx)}" y="${f(sy)}" width="${f(sw)}" height="${f(sh)}" fill="#e6f4fb" stroke="${PC_SKY}" stroke-width=".8"/><line x1="${f(sx + sw * .25)}" y1="${f(sy)}" x2="${f(sx + sw * .25)}" y2="${f(sy + sh)}" stroke="${PC_SKY}" stroke-width=".4"/><line x1="${f(sx + sw * .75)}" y1="${f(sy)}" x2="${f(sx + sw * .75)}" y2="${f(sy + sh)}" stroke="${PC_SKY}" stroke-width=".4"/><text x="${f(sx + sw / 2)}" y="${f(Math.max(y + 5, sy - 1.5))}" font-size="4.4" text-anchor="middle" fill="${PC_INK}">${pcEscXml(item.ref || 'S')}</text></g>`;
}
function pcDesignPlanPanel(p, geom, fireExits, slotX, slotY, maxW, maxH) {
  const L = Number(geom.length), W = Number(geom.width);
  const scale = Math.min((maxW - 24) / L, (maxH - 26) / W);
  const pw = L * scale, ph = W * scale;
  const x = slotX + (maxW - pw) / 2 + 6, y = slotY + (maxH - ph) / 2 + 4, f = n => n.toFixed(1);
  let frames = '';
  const lengthBay = pcBayInfo(p, geom, 'right');
  for (let i = 1; i < lengthBay.count; i++) { const xx = x + pw * i / lengthBay.count; frames += `<line x1="${f(xx)}" y1="${f(y)}" x2="${f(xx)}" y2="${f(y + ph)}" stroke="${PC_GREEN}" stroke-width=".6" stroke-dasharray="2,1.5"/>`; }
  const openings = geom.doors.concat(fireExits);
  const lanes = pcPlanLanes(openings, geom, x, y, pw, ph);
  const order = { window: 0, personnel: 1, double: 1, fire: 1, roller: 2 };
  const openingSvg = openings.slice().sort((a, b) => (order[pcOpeningKind(a)] || 0) - (order[pcOpeningKind(b)] || 0)).map(d => pcPlanOpening(d, geom, x, y, pw, ph, lanes[d.ref + '|' + d.wall + '|' + d.offset] || 0)).join('');
  const solar = geom.solarArrays.map(a => pcPlanRoofItem(a, geom, x, y, pw, ph, 'solar')).join('');
  const skylights = geom.skylights.map(s => pcPlanRoofItem(s, geom, x, y, pw, ph, 'skylight')).join('');
  // North arrow and building orientation, as on the Building Design plan.
  const nx = x + pw + 12, ny = y + 6, angle = pcFootprintAngle(p);
  const north = `<g><circle cx="${nx}" cy="${ny}" r="6" fill="#ffffff" stroke="${PC_DIM}" stroke-width=".6"/><text x="${nx}" y="${ny - 1}" font-size="4.6" font-weight="700" text-anchor="middle" fill="${PC_GREEN}">N</text><text x="${nx}" y="${ny + 4}" font-size="4.6" text-anchor="middle" fill="${PC_INK}">↑</text></g>`;
  const cx = x + pw / 2, cy = y + ph / 2;
  const axis = `<g transform="rotate(${Math.round(angle)} ${f(cx)} ${f(cy)})"><line x1="${f(cx)}" y1="${f(cy - 6)}" x2="${f(cx)}" y2="${f(cy + 8)}" stroke="${PC_GREEN}" stroke-width=".9"/><path d="M${f(cx)} ${f(cy - 10)} l-2.5 5 h5 z" fill="${PC_GREEN}"/></g>`;
  const svg = `<rect x="${f(x)}" y="${f(y)}" width="${f(pw)}" height="${f(ph)}" fill="#ffffff" stroke="${PC_INK}" stroke-width="1.4"/>${frames}${solar}${skylights}${openingSvg}${axis}${north}
    ${pcDimLine(x, y - 17, x + pw, y - 17)}<text x="${f(x + pw / 2)}" y="${f(y - 20)}" font-size="6.5" text-anchor="middle" fill="${PC_DIM}">${L} m length</text>
    ${pcDimLine(x - 18, y, x - 18, y + ph)}<text x="${f(x - 21)}" y="${f(y + ph / 2)}" font-size="6.5" text-anchor="middle" fill="${PC_DIM}" transform="rotate(-90 ${f(x - 21)} ${f(y + ph / 2)})">${W} m width</text>
    <text x="${slotX + maxW / 2}" y="${slotY + maxH + 24}" font-size="9" text-anchor="middle" fill="${PC_INK}" font-weight="700">PLAN</text>
    <text x="${slotX + maxW / 2}" y="${slotY + maxH + 33}" font-size="6" text-anchor="middle" fill="${PC_DIM}">Roof frames ${lengthBay.count} × ${lengthBay.spacing.toFixed(2)} m · Rotation ${Math.round(angle)}°</text>`;
  return svg;
}

// ---- Elevations A / B / C / D (same construction as buildingDesignElevationSvg) ----
function pcLeafDoor(x, y, w, h, opts) {
  const leaves = opts.double ? 2 : 1, lw = w / leaves, f = n => n.toFixed(1), stroke = opts.fire ? PC_GREEN : PC_INK;
  let out = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#ffffff" stroke="${stroke}" stroke-width=".8"/>`;
  for (let i = 0; i < leaves; i++) {
    const lx = x + i * lw;
    out += `<rect x="${f(lx + lw * .14)}" y="${f(y + h * .11)}" width="${f(lw * .72)}" height="${f(h * .78)}" fill="#e3f1e6" stroke="${PC_GREEN}" stroke-width=".4"/>`;
  }
  if (opts.double) out += `<line x1="${f(x + w / 2)}" y1="${f(y)}" x2="${f(x + w / 2)}" y2="${f(y + h)}" stroke="${stroke}" stroke-width=".5"/>`;
  if (opts.fire) out += `<line x1="${f(x + w * .08)}" y1="${f(y + h * .47)}" x2="${f(x + w * .92)}" y2="${f(y + h * .47)}" stroke="${PC_GREEN}" stroke-width="1"/>`;
  return out;
}
function pcElevationOpening(d, geom, x0, x1, yFloor, yEave, len) {
  const eave = Number(geom.eaveHeight) || 1, sx = (x1 - x0) / len, sy = (yFloor - yEave) / eave, f = n => n.toFixed(1);
  const k = pcOpeningKind(d);
  const w = Math.max(2, (Number(d.width) || 0) * sx), h = Math.max(3, (Number(d.height) || 0) * sy);
  const bottom = k === 'window' ? Math.max(0, Number(d.sillHeight) || 0) * sy : 0;
  const x = x0 + (Number(d.offset) || 0) * sx, y = yFloor - bottom - h;
  let body;
  if (k === 'window') body = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#eaf5fb" stroke="${PC_WINDOW}" stroke-width=".7"/><line x1="${f(x + w / 2)}" y1="${f(y)}" x2="${f(x + w / 2)}" y2="${f(y + h)}" stroke="${PC_WINDOW}" stroke-width=".4"/><line x1="${f(x)}" y1="${f(y + h / 2)}" x2="${f(x + w)}" y2="${f(y + h / 2)}" stroke="${PC_WINDOW}" stroke-width=".4"/>`;
  else if (k === 'roller') { body = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#e3f1e6" stroke="${PC_GREEN}" stroke-width=".9"/>`; for (let i = 1; i <= 6; i++) body += `<line x1="${f(x + 1)}" y1="${f(y + i * h / 7)}" x2="${f(x + w - 1)}" y2="${f(y + i * h / 7)}" stroke="${PC_GREEN}" stroke-width=".35"/>`; }
  else body = pcLeafDoor(x, y, w, h, { double: k === 'double', fire: k === 'fire' });
  const label = k === 'fire' ? String(d.ref || 'FE') : String(d.ref || pcPlanRef(d));
  return `<g data-report-opening="${pcEscXml(d.ref || '')}" data-wall="${pcEscXml(d.wall)}">${body}<text x="${f(x + w / 2)}" y="${f(Math.max(yEave - 2, y - 2))}" font-size="4.6" text-anchor="middle" fill="${k === 'fire' ? PC_GREEN : PC_INK}">${pcEscXml(label)}</text></g>`;
}
function pcDesignElevationPanel(p, geom, view, fireExits, slotX, slotY, maxW, maxH) {
  const wall = view.wall, len = Math.max(.1, pcWallLength(geom, wall));
  const eave = Math.max(.1, Number(geom.eaveHeight) || 0), ridge = Math.max(eave, Number(geom.ridgeHeight) || eave);
  const gable = wall === 'front' || wall === 'back', f = n => n.toFixed(1);
  const scale = Math.min((maxW - 30) / len, (maxH - 34) / ridge);
  const dw = len * scale;
  const x0 = slotX + (maxW - dw) / 2 + 8, x1 = x0 + dw, yFloor = slotY + maxH - 14, yEave = yFloor - eave * scale, ridgeY = yFloor - ridge * scale;
  const rise = Math.max(0, yEave - ridgeY), inset = Math.min(8, rise);
  const roof = gable
    ? `<path d="M ${f(x0)} ${f(yEave)} L ${f((x0 + x1) / 2)} ${f(ridgeY)} L ${f(x1)} ${f(yEave)} Z" fill="#e3f1e6" stroke="${PC_GREEN}" stroke-width=".9"/>`
    : `<path d="M ${f(x0)} ${f(yEave)} L ${f(x0 + inset)} ${f(ridgeY)} L ${f(x1 - inset)} ${f(ridgeY)} L ${f(x1)} ${f(yEave)} Z" fill="#e3f1e6" stroke="${PC_GREEN}" stroke-width=".9"/>`;
  const cols = pcColumnPositions(p, geom, wall);
  let bays = '';
  cols.forEach((c, i) => {
    const x = x0 + dw * c.metres / len, edge = i === 0 || i === cols.length - 1;
    if (!edge) bays += `<line x1="${f(x)}" y1="${f(yEave)}" x2="${f(x)}" y2="${f(yFloor)}" stroke="${c.adjusted ? PC_GREEN : '#d0d5dd'}" stroke-width="${c.adjusted ? .8 : .5}"/>`;
    if (i < cols.length - 1) { const nx = x0 + dw * cols[i + 1].metres / len; bays += `<text x="${f((x + nx) / 2)}" y="${f(yFloor + 12)}" font-size="3.8" text-anchor="middle" fill="${PC_DIM}">B${i + 1} ${(cols[i + 1].metres - c.metres).toFixed(1)} m</text>`; }
  });
  const openings = geom.doors.filter(d => d.wall === wall).map(d => pcElevationOpening(d, geom, x0, x1, yFloor, yEave, len)).join('')
    + fireExits.filter(d => d.wall === wall).map(d => pcElevationOpening(d, geom, x0, x1, yFloor, yEave, len)).join('');
  const svg = `<g data-report-view="${view.key}" data-wall="${wall}">
    <rect x="${f(x0)}" y="${f(yEave)}" width="${f(dw)}" height="${f(yFloor - yEave)}" fill="#ffffff" stroke="${PC_INK}" stroke-width="1.3"/>${roof}${bays}${openings}
    ${pcGroundLine(x0 - 6, x1 + 6, yFloor)}
    ${pcDimLine(x0, ridgeY - 9, x1, ridgeY - 9)}<text x="${f((x0 + x1) / 2)}" y="${f(ridgeY - 12)}" font-size="6" text-anchor="middle" fill="${PC_DIM}">${len.toFixed(1)} m overall ${gable ? 'width' : 'length'}</text>
    <text x="${f((x0 + x1) / 2)}" y="${f(ridgeY - 2)}" font-size="4.4" font-weight="700" text-anchor="middle" fill="${PC_GREEN}">INDICATIVE RIDGE ${Number(geom.ridgeHeight || ridge).toFixed(2)} m</text>
    ${pcDimLine(x0 - 9, yEave, x0 - 9, yFloor)}<text x="${f(x0 - 13)}" y="${f((yEave + yFloor) / 2)}" font-size="5.5" text-anchor="middle" fill="${PC_DIM}" transform="rotate(-90 ${f(x0 - 13)} ${f((yEave + yFloor) / 2)})">${eave.toFixed(1)} m clear</text>
    <text x="${slotX + maxW / 2}" y="${slotY + maxH + 24}" font-size="8" text-anchor="middle" fill="${PC_INK}" font-weight="700">${pcEscXml(view.title)}</text>
    <text x="${slotX + maxW / 2}" y="${slotY + maxH + 33}" font-size="6" text-anchor="middle" fill="${PC_DIM}">${pcEscXml(pcWallBearing(p, wall))}</text></g>`;
  return svg;
}

// Legend + roof summary under the title block text.
function pcDesignLegend(geom, x, y) {
  const panels = geom.solarArrays.reduce((t, a) => t + Math.max(1, Math.floor(Number(a.columns) || 1)) * Math.max(1, Math.floor(Number(a.rows) || 1)), 0);
  const roofLine = `Roof: ${geom.skylights.length} skylight${geom.skylights.length === 1 ? '' : 's'} · ${geom.solarArrays.length} solar array${geom.solarArrays.length === 1 ? '' : 's'}${panels ? ' (' + panels + ' panels)' : ''}`;
  return `<g data-report-legend="1">
    <path d="M${x} ${y + 4} L${x} ${y - 2} L${x + 6} ${y + 4}" fill="none" stroke="${PC_INK}" stroke-width=".7"/><text x="${x + 9}" y="${y + 4}" font-size="5.5" fill="${PC_INK}">PD Personnel door</text>
    <line x1="${x + 66}" y1="${y}" x2="${x + 76}" y2="${y}" stroke="${PC_WINDOW}" stroke-width="1"/><line x1="${x + 66}" y1="${y + 2.5}" x2="${x + 76}" y2="${y + 2.5}" stroke="${PC_WINDOW}" stroke-width="1"/><text x="${x + 79}" y="${y + 4}" font-size="5.5" fill="${PC_INK}">W Casement window</text>
    <line x1="${x + 140}" y1="${y + 1}" x2="${x + 152}" y2="${y + 1}" stroke="${PC_INK}" stroke-width="3"/><text x="${x + 155}" y="${y + 4}" font-size="5.5" fill="${PC_INK}">RD Roller door</text>
    <rect x="${x}" y="${y + 9}" width="8" height="5" fill="#e6f4fb" stroke="${PC_SKY}" stroke-width=".7"/><text x="${x + 11}" y="${y + 14}" font-size="5.5" fill="${PC_INK}">Skylight</text>
    <rect x="${x + 66}" y="${y + 9}" width="8" height="5" fill="${PC_SOLAR}" stroke="#d99a1e" stroke-width=".6"/><text x="${x + 77}" y="${y + 14}" font-size="5.5" fill="${PC_INK}">PV Solar array</text>
    <path d="M${x + 140} ${y + 13} L${x + 140} ${y + 7} L${x + 146} ${y + 13}" fill="none" stroke="${PC_GREEN}" stroke-width=".7"/><text x="${x + 149}" y="${y + 14}" font-size="5.5" fill="${PC_INK}">FE Fire exit</text>
    <text x="${x}" y="${y + 24}" font-size="5.5" fill="${PC_DIM}">${pcEscXml(roofLine)}</text></g>`;
}

// Indicative fire exits for project p, mapped as buildingDesignAutoFireDoors does.
function pcDrawingFireExits(p) {
  if (!p || typeof pcBackgroundChecksFor !== 'function') return [];
  if (typeof pcFireExitDesignConfirmed === 'function' && !pcFireExitDesignConfirmed(p)) return [];
  let checks = null;
  try { checks = pcBackgroundChecksFor(p); } catch (e) { return []; }
  return ((checks && checks.fireExits && checks.fireExits.doors) || [])
    .map(d => ({ ...d, type: 'fireExit', height: Number(d.height) || 2.1 }));
}
// ---- STANDARD BUILDING: Plan + Elevations A/B/C/D, matching the Building Design
// page views (building-layout.js) and read from the same confirmed geometry ----
function renderStandardDrawingSVG(p, geom) {
  const h = geom.eaveHeight, g = PC_GRID;
  // Customer openings plus the project's own confirmed indicative fire exits
  // (same source as Building Design). Read from the project p, never page state,
  // and never stored in geometry.doors. Empty when unconfirmed or unavailable.
  const fireExits = pcDrawingFireExits(p);
  const defs = `<defs><marker id="pcArrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" fill="${PC_DIM}"/></marker></defs>`;

  // Row 1: Plan, A (front), B (right). Row 2: C (back), D (left), title block.
  const plan = pcDesignPlanPanel(p, geom, fireExits, g.cols[0], g.row1Y, g.maxW, g.maxH);
  const slots = [[g.cols[1], g.row1Y], [g.cols[2], g.row1Y], [g.cols[0], g.row2Y], [g.cols[1], g.row2Y]];
  const elevations = PC_DESIGN_VIEWS.map((v, i) => pcDesignElevationPanel(p, geom, v, fireExits, slots[i][0], slots[i][1], g.maxW, g.maxH)).join('');

  const tbX = g.cols[2], tbY = g.row2Y, tbW = 300, tbH = g.maxH;
  const titleBlock = pcTitleBlock(p, tbX, tbY, tbW, tbH) + pcDesignLegend(geom, tbX + 106, tbY + 108);

  const notes = `<text x="44" y="460" font-size="7" fill="${PC_DIM}">FACT: clear height (${h} m) and openings are from your confirmed Building Design. INFERENCE: roof form and ridge height are a Project Check</text>
    <text x="44" y="471" font-size="7" fill="${PC_DIM}">indicative preliminary assumption only, not a surveyed or engineered eaves/roof design — final roof geometry requires professional design.</text>`;

  return `<svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg" data-report-source="building-design" style="width:100%;height:auto;background:#fff">${defs}${pcBanner('For early project assessment only — not for construction.')}${plan}${elevations}${titleBlock}${notes}</svg>`;
}

// ---- CANOPY: 5-view drawing (roof plan, clad left/right sides, open front, connection
// rear) matching the approved reference (design-reference/canopy-drawing-reference.png).
// PROPOSED architecture per the current Architect governance status — see geometry.js
// deriveCanopyGeometryFromFacts() for what is/isn't approved knowledge here. Uses the
// customer's own captured dimensions throughout, never the reference's 20x12x5 example. ----
function renderCanopyDrawingSVG(p, geom) {
  const w = geom.width, l = geom.length, h = geom.eaveHeight, rh = geom.ridgeHeight, doors = geom.doors || [];
  const openWall = geom.openWall || 'front', connectionWall = geom.connectionWall || 'back';
  const g = PC_GRID;

  const defs = `<defs><marker id="pcArrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" fill="${PC_DIM}"/></marker></defs>`;

  // ---- PLAN VIEW / ROOF PLAN (row 1, col 1) ----
  const planX = g.cols[0], planY = g.row1Y;
  const planScale = Math.min(g.maxW / w, g.maxH / l);
  const pw = w * planScale, pl = l * planScale;
  const planOx = planX + (g.maxW - pw) / 2, planOy = planY + (g.maxH - pl) / 2;
  const planDoors = pcPlanDoors(doors, planOx, planOy, pw, pl, planScale);
  // Ridge runs the depth of the building (front-to-back), centred on the width —
  // matches both gable ends sharing one ridge/eaves height below.
  const ridgeIndicator = `<line x1="${(planOx + pw / 2).toFixed(1)}" y1="${planOy}" x2="${(planOx + pw / 2).toFixed(1)}" y2="${(planOy + pl).toFixed(1)}" stroke="${PC_DIM}" stroke-width="1" stroke-dasharray="5,3"/>`;
  // Perimeter drawn as 4 explicit edges (not a single closed <rect> with a dashed
  // line overlaid on it) so the open wall reads as genuinely dashed rather than a
  // dashed line sitting on top of an unbroken solid stroke underneath it (Copilot
  // review finding — the rect's solid stroke was filling in the dash gaps). The
  // connection wall similarly gets its own solid green edge directly, instead of a
  // green overlay on top of a separate ink-coloured rect edge.
  const edgeY = w2 => w2 === 'front' ? planOy + pl : planOy;
  const planEdgeStyle = wall => wall === openWall ? { stroke: PC_INK, width: 1.6, dash: '6,4' }
    : wall === connectionWall ? { stroke: PC_GREEN, width: 3, dash: null }
    : { stroke: PC_INK, width: 1.6, dash: null };
  const planEdgeLine = (wall, x1, y1, x2, y2) => {
    const s = planEdgeStyle(wall);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s.stroke}" stroke-width="${s.width}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
  };
  const connectionLabel = `<text x="${(planOx + pw / 2).toFixed(1)}" y="${(edgeY(connectionWall) + (connectionWall === 'front' ? -6 : 12)).toFixed(1)}" font-size="6" text-anchor="middle" fill="${PC_GREEN}">CONNECTION TO EXISTING BUILDING</text>`;
  const planPerimeter = planEdgeLine('back', planOx, planOy, planOx + pw, planOy)
    + planEdgeLine('front', planOx, planOy + pl, planOx + pw, planOy + pl)
    + planEdgeLine('left', planOx, planOy, planOx, planOy + pl)
    + planEdgeLine('right', planOx + pw, planOy, planOx + pw, planOy + pl);
  const planSvg = `${planPerimeter}${ridgeIndicator}${connectionLabel}${planDoors}
    ${pcWitness(planOx, planOy - 14, planOx, planOy - 4)}${pcWitness(planOx + pw, planOy - 14, planOx + pw, planOy - 4)}${pcDimLine(planOx, planOy - 9, planOx + pw, planOy - 9)}
    <text x="${planOx + pw / 2}" y="${planOy - 13}" font-size="8" text-anchor="middle" fill="${PC_DIM}">${w} m</text>
    ${pcWitness(planOx - 14, planOy, planOx - 4, planOy)}${pcWitness(planOx - 14, planOy + pl, planOx - 4, planOy + pl)}${pcDimLine(planOx - 9, planOy, planOx - 9, planOy + pl)}
    <text x="${planOx - 19}" y="${planOy + pl / 2}" font-size="8" text-anchor="middle" fill="${PC_DIM}" transform="rotate(-90 ${planOx - 19} ${planOy + pl / 2})">${l} m</text>
    <text x="${planX + g.maxW / 2}" y="${planY + g.maxH + 24}" font-size="9" text-anchor="middle" fill="${PC_INK}" font-weight="700">PLAN VIEW (ROOF PLAN)</text>
    <text x="${planX + g.maxW / 2}" y="${planY + g.maxH + 33}" font-size="6.5" text-anchor="middle" fill="${PC_DIM}">Open front for loading/unloading — connection to existing building along rear edge</text>`;

  // ---- LEFT SIDE ELEVATION (CLAD SIDE) / RIGHT SIDE ELEVATION (CLAD SIDE) — flat eaves-height,
  // trapezoidal-sheet cladding hatch (row 1, cols 2/3) ----
  const sideL = pcFlatElevationPanel(g.cols[1], g.row1Y, g.maxW, g.maxH, l, h, doors, 'left', 'LEFT SIDE ELEVATION (CLAD SIDE)', { clad: true });
  const sideR = pcFlatElevationPanel(g.cols[2], g.row1Y, g.maxW, g.maxH, l, h, doors, 'right', 'RIGHT SIDE ELEVATION (CLAD SIDE)', { clad: true });

  // ---- FRONT ELEVATION (OPEN LOADING BAY) / REAR ELEVATION (CONNECTION TO EXISTING BUILDING) —
  // one shared ridge/eaves roof geometry drawn from each gable end (row 2, cols 1/2) ----
  const frontPanel = pcGableElevationPanel(g.cols[0], g.row2Y, g.maxW, g.maxH, w, h, rh, doors, openWall, 'FRONT ELEVATION (OPEN LOADING BAY)', { clad: false, note: 'Open front — no wall cladding shown' });
  const rearPanel = pcGableElevationPanel(g.cols[1], g.row2Y, g.maxW, g.maxH, w, h, rh, doors, connectionWall, 'REAR ELEVATION (CONNECTION TO EXISTING BUILDING)', { clad: true, note: 'Connects to existing building along this edge' });

  const titleBlock = pcTitleBlock(p, g.cols[2], g.row2Y, 300, g.maxH);

  const notes = `<text x="44" y="452" font-size="7.5" fill="${PC_DIM}">FACT: clear height (${h} m) is the figure you supplied. INFERENCE: saddle-roof pitch (indicative 10°) and ridge height are a Project</text>
    <text x="44" y="464" font-size="7.5" fill="${PC_DIM}">Check indicative preliminary assumption only — canopy roof material/pitch has not yet been confirmed by the customer.</text>`;

  return `<svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fff">${defs}${pcBanner('CANOPY (SADDLE ROOF) — for early project assessment only, not for construction.')}${planSvg}${sideL.svg}${sideR.svg}${frontPanel.svg}${rearPanel.svg}${titleBlock}${notes}</svg>`;
}

function svgToPngDataUrl(svg, w, h) {
  return new Promise((resolve, reject) => {
    let img = new Image();
    let svg64 = btoa(unescape(encodeURIComponent(svg)));
    img.onload = () => { let c = document.createElement('canvas'); c.width = w; c.height = h; let ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h); resolve(c.toDataURL('image/png')); };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;base64,' + svg64;
  });
}
