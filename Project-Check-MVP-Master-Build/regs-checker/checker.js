// Project Check - Stage 1 "Potential issues" checker (England, industrial/storage steel buildings).
// Pure function: runChecks(projectData, rules?) -> [{ruleId, result, measured, stage1Problem, stage1WhyItMatters}]
//   result: "ok" | "potential problem" | "need info"
// projectData is the project record (facts, geometry, backgroundChecks.buildingRegs).
// Rules come from rules.json (edit that file only - see README.md). Only rules with
// approved:true are returned. Missing input = "need info" (never a problem, never guessed).
// Stage 1 text never contains solutions, methods, products or costs.
(function (root) {
  var WALLS = ['A', 'B', 'C', 'D'];
  var HEATED = 'Ambient working temperature \u2014 heated', UNHEATED = 'Ambient storage \u2014 unheated';
  var NEED = 'need info', PROBLEM = 'potential problem', OK = 'ok', NOTE = 'note';

  function num(v) { if (v === '' || v === null || v === undefined) return null; var n = Number(v); return isFinite(n) ? n : null; }
  function fill(t, v) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] !== undefined ? v[k] : m; }); }
  function r1(n) { return Math.round(n * 10) / 10; }

  // Same fallback as projectTemperatureCondition in app.js
  function temperatureCondition(f) {
    if (f.temperatureCondition) return f.temperatureCondition;
    return ({ Yes: 'Ambient working temperature \u2014 heated', No: 'Ambient storage \u2014 unheated', 'Not sure': 'Not sure yet' })[f.heated] || '';
  }

  function inputs(p) {
    p = p || {};
    var f = p.facts || {}, g = p.geometry || {};
    var regs = (p.backgroundChecks && p.backgroundChecks.buildingRegs) || null;
    var W = num(g.width) || num(f.width), L = num(g.length) || num(f.length);
    var eaves = num(g.eaveHeight) || num(f.height);
    var pitch = num(f.roofPitch); if (pitch === null) pitch = 10;
    var ridge = num(g.ridgeHeight);
    if (!ridge && eaves && W) ridge = eaves + (W / 2) * Math.tan(pitch * Math.PI / 180);
    var doors = Array.isArray(g.doors) ? g.doors.filter(Boolean) : [];
    return {
      nation: (f.regsNation === 'England' || f.regsNation === 'Scotland' || f.regsNation === 'Wales') ? f.regsNation : '',
      stored: f.regsStored || '', heating: temperatureCondition(f),
      existingArea: num(f.regsExistingArea), existingHeight: num(f.regsExistingHeight),
      use: String(f.buildingUse || f.use || ''), W: W, L: L, eaves: eaves, ridge: ridge, doors: doors,
      distances: regs && regs.boundaryDistances ? regs.boundaryDistances : (f.regsBoundaryDist && typeof f.regsBoundaryDist === 'object' ? f.regsBoundaryDist : null),
      postcode: String(p.postcode || f.postcode || ''), altitude: num(f.regsAltitude), exposure: String(f.regsExposure || ''), solar: f.regsSolar || '',
      planNew: num(f.planNewArea), planExisting: num(f.planExistingArea), planBoundary: num(f.planBoundaryDist), planHeight: f.planHeight || '',
      detached: f.regsDetached || '', sleeping: f.regsSleeping || '', tempDays: num(f.regsTempDays),
      rooflights: f.regsRooflights || '', fireWall: f.regsFireWall || '', services: f.regsServices || '', vehiclesWet: f.regsVehiclesWet || ''
    };
  }

  // Centre of each personnel (incl. double) door in plan metres. x along length, y across width.
  // Elevation A (front) x=L, C (back) x=0, D (left) y=0, B (right) y=W (same frame as background-checks.js).
  function exitPoints(i) {
    var pts = [];
    i.doors.forEach(function (d) {
      if (d.type !== 'personnel' || d.intoBuilding === true || d.leadsToBuilding === true) return;
      var o = num(d.offset) || 0, c = o + (num(d.width) || 0) / 2, p = null;
      if (d.wall === 'front') p = { x: i.L, y: c, dir: 'A' };
      else if (d.wall === 'back') p = { x: 0, y: i.W - c, dir: 'C' };
      else if (d.wall === 'left') p = { x: i.L - c, y: 0, dir: 'D' };
      else if (d.wall === 'right') p = { x: c, y: i.W, dir: 'B' };
      if (p) pts.push(p);
    });
    return pts;
  }

  // Furthest point of the rectangle from its nearest exit (straight line), sampled on a ~0.25 m grid incl. corners.
  function furthest(i, pts) {
    var best = 0, nx = Math.max(1, Math.ceil(i.L / 0.25)), ny = Math.max(1, Math.ceil(i.W / 0.25));
    for (var a = 0; a <= nx; a++) for (var b = 0; b <= ny; b++) {
      var x = i.L * a / nx, y = i.W * b / ny, m = Infinity;
      for (var k = 0; k < pts.length; k++) { var d = Math.hypot(x - pts[k].x, y - pts[k].y); if (d < m) m = d; }
      if (m > best) best = m;
    }
    return best;
  }

  function entry(rule, result, measured, vars) {
    var problem = result === PROBLEM, note = result === NOTE;
    // result 'note' = the rule applies but it is not a problem (exemption flag, advice, or quote-request-only item).
    // Customer-scope rules carry scope:'customer' and their Stage 1 text starts "Get professional support".
    return {
      ruleId: rule.id, result: result, measured: measured === undefined ? null : measured,
      scope: rule.scope || 'building',
      stage1Problem: problem ? fill(rule.stage1Problem, vars) : '',
      stage1WhyItMatters: problem ? rule.stage1WhyItMatters : '',
      stage1Note: note ? fill(rule.stage1Note || '', vars) : ''
    };
  }

  var CHECKS = {
    B_BOUNDARY: function (r, i) {
      // Distance only. The cladding fire rating is not asked; standard PIR is never treated as unprotected by default.
      return WALLS.map(function (w) {
        var d = i.distances ? num(i.distances[w]) : null, m = { elevation: w, distance: d };
        if (d === null) return entry(r, NEED, m);
        if (d >= 25) return entry(r, OK, m);
        return entry(r, PROBLEM, m, { elevation: w, distance: r1(d) });
      });
    },
    B_BOUNDARY_1M: function (r, i) {
      return WALLS.map(function (w) {
        var d = i.distances ? num(i.distances[w]) : null, m = { elevation: w, distance: d };
        if (d === null) return entry(r, NEED, m);
        return entry(r, d < 1 ? PROBLEM : OK, m, { elevation: w, distance: r1(d) });
      });
    },
    B_HEIGHT_10M: function (r, i) {
      if (!i.eaves || !i.ridge) return [entry(r, NEED)];
      var mean = (i.eaves + i.ridge) / 2;
      return [entry(r, mean > 10 ? PROBLEM : OK, { meanRoofHeight: r1(mean) })];
    },
    B_RIDGE_18M: function (r, i) {
      if (!i.eaves || !i.ridge) return [entry(r, NEED)];
      var mean = (i.eaves + i.ridge) / 2;
      return [entry(r, mean > 18 ? PROBLEM : OK, { meanRoofHeight: r1(mean) })];
    },
    // Customer scope: no inputs needed, always a note.
    B_FIRE_ACCESS_11M: function (r) { return [entry(r, NOTE)]; },
    A_FRAME_BOUNDARY: function (r, i, all) {
      var b = all.B_BOUNDARY || [];
      var hit = b.filter(function (e) { return e.result === PROBLEM; });
      if (!i.eaves || !b.length) return [entry(r, NEED)];
      if (!hit.length && b.some(function (e) { return e.result === NEED; })) return [entry(r, NEED)];
      return [entry(r, hit.length && i.eaves > 7 ? PROBLEM : OK, { eaves: i.eaves, elevations: hit.map(function (e) { return e.measured.elevation; }) })];
    },
    B_TRAVEL: function (r, i) {
      if (!i.W || !i.L || !i.stored) return [entry(r, NEED)];
      var pts = exitPoints(i);
      if (!pts.length) return [entry(r, NEED, { exits: 0 })];
      var dirs = {}; pts.forEach(function (p) { dirs[p.dir] = 1; });
      var n = Object.keys(dirs).length, set = r.limits[i.stored === 'flammable' ? 'flammable' : 'normal'];
      var limit = n >= 2 ? set.multi : set.single;
      var travel = furthest(i, pts) * (r.factor || 1.5);
      return [entry(r, travel > limit ? PROBLEM : OK, { travel: r1(travel), limit: limit, exitDirections: n }, { travel: Math.round(travel) })];
    },
    B_EXITS: function (r, i) {
      if (!i.W || !i.L || !i.use) return [entry(r, NEED)];
      var use = i.use.toLowerCase(), per = /storage|warehouse/.test(use) ? r.limits.storageM2PerPerson : /production|manufactur/.test(use) ? r.limits.productionM2PerPerson : null;
      if (!per) return [entry(r, NEED)];
      var people = Math.floor(i.L * i.W / per), exits = exitPoints(i).length;
      return [entry(r, people > r.limits.maxPeopleOneExit && exits < 2 ? PROBLEM : OK, { people: people, exits: exits })];
    },
    L_ENERGY: function (r, i) {
      // Uses the Building Design services answer (heating, toilets, offices or any services). 'Not sure' or no answer = need info.
      if (i.services === 'Yes') return [entry(r, NOTE, { services: i.services })];
      if (i.services === 'No') return [entry(r, OK, { services: i.services })];
      return [entry(r, NEED)];
    },

    // ---- Added rules (all approved:false). Fact keys are documented in README.md. ----
    PLAN_PD: function (r, i) {
      if (i.planNew === null || i.planExisting === null || i.planBoundary === null || !i.planHeight) return [entry(r, NEED)];
      var L = r.limits, why = [];
      if (i.planNew > L.maxM2) why.push('area');
      if (i.planExisting > 0 && i.planNew > i.planExisting * L.maxFractionOfExisting) why.push('fraction');
      if (i.planBoundary < L.minBoundaryM) why.push('boundary');
      if (i.planHeight === 'higher') why.push('height');
      return [entry(r, why.length ? PROBLEM : OK, { reasons: why, newArea: i.planNew, existingArea: i.planExisting, boundary: i.planBoundary, height: i.planHeight })];
    },
    BR_SCHED2_EXEMPT: function (r, i) {
      var area = i.W && i.L ? i.W * i.L : null, lim = r.limits;
      var small = i.detached === 'Yes' && i.sleeping === 'No' && area !== null && area <= lim.detachedM2;
      var temp = i.tempDays !== null && i.tempDays <= lim.temporaryDays;
      if (small || temp) return [entry(r, NOTE, { smallDetached: small, temporary: temp, floorArea: area === null ? null : r1(area) })];
      var smallKnown = i.detached && i.sleeping && area !== null, tempKnown = i.tempDays !== null;
      if (!smallKnown && !tempKnown) return [entry(r, NEED)];
      return [entry(r, OK, { floorArea: area === null ? null : r1(area) })];
    },
    A_LOADS_QUOTE: function (r, i) {
      if (!i.postcode || i.altitude === null || !i.exposure || !i.solar) return [entry(r, NEED, { postcode: i.postcode, altitude: i.altitude, exposure: i.exposure, solar: i.solar })];
      return [entry(r, NOTE, { postcode: i.postcode, altitude: i.altitude, exposure: i.exposure, solar: i.solar })];
    },
    B_BOUNDARY_FIRERATED_QUOTE: function (r, i) {
      // Boundary = drawn site boundary lines only (or the manual per-elevation answers); other buildings on the site are not boundaries.
      return WALLS.map(function (w) {
        var d = i.distances ? num(i.distances[w]) : null, m = { elevation: w, distance: d };
        if (d === null) return entry(r, NEED, m);
        return entry(r, d < r.limits.closeM ? NOTE : OK, m);
      });
    },
    B_DOORS_QUOTE: function (r, i) {
      if (!i.W || !i.L) return [entry(r, NEED)];
      var deep = Math.max(i.W, i.L), longSides = i.L >= i.W ? ['B', 'D'] : ['A', 'C'];
      return [entry(r, deep > r.limits.deepM ? NOTE : OK, { depth: r1(deep), longSides: longSides })];
    },
    B_ROOFLIGHTS: function (r, i) {
      if (!i.rooflights) return [entry(r, NEED)];
      if (i.rooflights === 'No') return [entry(r, OK)];
      var near = [];
      WALLS.forEach(function (w) { var d = i.distances ? num(i.distances[w]) : null; if (d !== null && d < r.limits.boundaryM) near.push(w); });
      var unknown = !i.distances || WALLS.some(function (w) { return num(i.distances[w]) === null; });
      if (near.length || i.fireWall === 'Yes') return [entry(r, PROBLEM, { nearBoundary: near, fireWall: i.fireWall })];
      return [entry(r, unknown || !i.fireWall ? NEED : OK, { nearBoundary: near, fireWall: i.fireWall })];
    },
    L_ROOFLIGHT_U_QUOTE: function (r, i) {
      if (!i.rooflights || i.heating === 'Not sure yet' || !i.heating) return [entry(r, NEED)];
      return [entry(r, i.rooflights === 'Yes' && i.heating === HEATED ? NOTE : OK)];
    },
    M_ACCESS: function (r, i) {
      if (i.services !== 'Yes' && i.services !== 'No') return [entry(r, NEED)];
      return [entry(r, i.services === 'Yes' ? PROBLEM : OK, { services: i.services })];
    },
    F_CONDENSATION: function (r, i) {
      if (i.heating !== UNHEATED) return [entry(r, i.heating ? OK : NEED)];
      if (!i.vehiclesWet) return [entry(r, NEED)];
      return [entry(r, i.vehiclesWet === 'Yes' ? NOTE : OK)];
    },
    H_DRAINAGE_QUOTE: function (r) { return [entry(r, NOTE)]; },
    L_2027_HEATED: function (r, i) {
      // Heated jobs only: a customer-scope note. No dates are asked.
      if (!i.heating || i.heating === 'Not sure yet') return [entry(r, NEED)];
      return [entry(r, i.heating === HEATED ? NOTE : OK, { heating: i.heating })];
    }
  };

  // options.includeUnapproved is for Stuart's own testing only; never use it for client output.
  function evaluate(projectData, rules, options) {
    var list = (rules && rules.rules) || (Array.isArray(rules) ? rules : null) || (root.PC_REGS_RULES && root.PC_REGS_RULES.rules) || [];
    var i = inputs(projectData);
    if (i.nation !== 'England') return { i: i, items: [] };
    var all = {}, items = [];
    list.forEach(function (r) {
      var fn = CHECKS[r.id];
      if (!fn) return;
      var res = fn(r, i, all);
      all[r.id] = res;
      if (r.approved === true || (options && options.includeUnapproved)) items.push({ rule: r, res: res });
    });
    return { i: i, items: items };
  }

  function runChecks(projectData, rules, options) {
    var out = [];
    evaluate(projectData, rules, options).items.forEach(function (x) { out = out.concat(x.res); });
    return out;
  }

  // Supplier quote request lines. Never names a panel product. Kept apart from runChecks so Stage 1 output stays problems only.
  var QUOTE = {
    A_LOADS_QUOTE: function (r, i, res) {
      if (res[0].result !== NOTE) return [];
      return ['Site loads (Part A): postcode ' + i.postcode + '; altitude ' + i.altitude + ' m; site exposure ' + i.exposure + '; planned roof solar panels: ' + (i.solar === 'Yes' ? 'yes - allow for the added roof load' : 'no') + '.'];
    },
    B_BOUNDARY_FIRERATED_QUOTE: function (r, i, res) {
      return res.filter(function (e) { return e.result === NOTE; }).map(function (e) { return 'Fire-rated wall needed on elevation ' + e.measured.elevation + ' (close to the boundary).'; });
    },
    B_DOORS_QUOTE: function (r, i, res) {
      var m = res[0].measured, out = ['Roller and sectional doors do not count as fire exits.'];
      if (res[0].result === NOTE) out.push('Building is over ' + r.limits.deepM + ' m deep: include at least one personnel door on each long side (elevations ' + m.longSides.join(' and ') + ').');
      return out;
    },
    L_ROOFLIGHT_U_QUOTE: function (r, i, res) { return res[0].result === NOTE ? ['Heated building: rooflights U-value 2.2 W/m2K maximum.'] : []; },
    H_DRAINAGE_QUOTE: function () { return ['Gutters and downpipes are by the building supplier.', 'The surface water connection is customer scope (not by the building supplier).']; },
    L_2027_HEATED: function (r, i, res) { return res[0].result === NOTE ? ['Heated building, 2027 rules (AD L 2026 edition): personnel doors at U-value 1.6 W/m2K maximum.'] : []; }
  };

  function buildQuoteRequest(projectData, rules, options) {
    var ev = evaluate(projectData, rules, options), out = [];
    ev.items.forEach(function (x) {
      var fn = QUOTE[x.rule.id];
      if (!fn) return;
      var lines = fn(x.rule, ev.i, x.res);
      if (lines.length) out.push({ ruleId: x.rule.id, lines: lines });
    });
    return out;
  }

  // Browser runner: loads rules.json once, runs the checks and saves the result at
  // project.backgroundChecks.regsChecker (all other backgroundChecks fields are kept).
  var rulesPromise = null;
  function loadRules() {
    if (!rulesPromise) rulesPromise = fetch('regs-checker/rules.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { rulesPromise = null; return null; });
    return rulesPromise;
  }
  function runRegsChecker(p) {
    if (!p) return Promise.resolve(null);
    return loadRules().then(function (rules) {
      if (!rules) return null;
      var f = p.facts || {};
      var stored = { version: rules.version, ranAt: new Date().toISOString(), nation: inputs(p).nation, results: runChecks(p, rules) };
      p.backgroundChecks = Object.assign({}, p.backgroundChecks || {}, { regsChecker: stored });
      if (typeof root.save === 'function') root.save();
      return stored;
    });
  }

  root.runChecks = runChecks;
  root.buildQuoteRequest = buildQuoteRequest;
  root.runRegsChecker = runRegsChecker;
  if (typeof module !== 'undefined' && module.exports) module.exports = { runChecks: runChecks, buildQuoteRequest: buildQuoteRequest };
})(typeof window !== 'undefined' ? window : globalThis);
