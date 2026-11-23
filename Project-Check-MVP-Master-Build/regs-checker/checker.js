// Project Check - Stage 1 "Potential issues" checker (England, industrial/storage steel buildings).
// Pure function: runChecks(projectData, rules?) -> [{ruleId, result, measured, stage1Problem, stage1WhyItMatters}]
//   result: "ok" | "potential problem" | "need info"
// projectData is the project record (facts, geometry, backgroundChecks.buildingRegs).
// Rules come from rules.json (edit that file only - see README.md). Only rules with
// approved:true are returned. Missing input = "need info" (never a problem, never guessed).
// Stage 1 text never contains solutions, methods, products or costs.
(function (root) {
  var WALLS = ['A', 'B', 'C', 'D'];
  var NEED = 'need info', PROBLEM = 'potential problem', OK = 'ok';

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
      nation: f.regsNation || '', stored: f.regsStored || '', heating: temperatureCondition(f),
      cladding: f.regsCladding || '', bcDate: f.regsBcDate || '', startDate: f.regsStartDate || '',
      use: String(f.buildingUse || f.use || ''), W: W, L: L, eaves: eaves, ridge: ridge, doors: doors,
      distances: regs && regs.boundaryDistances ? regs.boundaryDistances : null
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
    var problem = result === PROBLEM;
    return {
      ruleId: rule.id, result: result, measured: measured === undefined ? null : measured,
      stage1Problem: problem ? fill(rule.stage1Problem, vars) : '',
      stage1WhyItMatters: problem ? rule.stage1WhyItMatters : ''
    };
  }

  var CHECKS = {
    B_BOUNDARY: function (r, i) {
      var unrated = i.cladding === 'unknown' || i.cladding === 'not rated';
      return WALLS.map(function (w) {
        var d = i.distances ? num(i.distances[w]) : null, m = { elevation: w, distance: d };
        if (d === null) return entry(r, NEED, m);
        if (d >= 25) return entry(r, OK, m);
        if (!i.cladding) return entry(r, NEED, m);
        return entry(r, unrated ? PROBLEM : OK, m, { elevation: w, distance: r1(d) });
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
      if (!i.ridge) return [entry(r, NEED)];
      return [entry(r, i.ridge > 18 ? PROBLEM : OK, { ridgeHeight: r1(i.ridge) })];
    },
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
      if (i.heating === 'Ambient working temperature \u2014 heated') return [entry(r, PROBLEM, { heating: i.heating })];
      if (i.heating === 'Ambient storage \u2014 unheated') return [entry(r, OK, { heating: i.heating })];
      return [entry(r, NEED)];
    },
    L_2027: function (r, i) {
      var app = i.bcDate ? Date.parse(i.bcDate) : NaN;
      if (isNaN(app)) return [entry(r, NEED)];
      if (app >= Date.parse(r.dates.application)) return [entry(r, PROBLEM, { applicationDate: i.bcDate })];
      var st = i.startDate ? Date.parse(i.startDate) : NaN;
      if (isNaN(st)) return [entry(r, NEED, { applicationDate: i.bcDate })];
      return [entry(r, st >= Date.parse(r.dates.start) ? PROBLEM : OK, { applicationDate: i.bcDate, startDate: i.startDate })];
    }
  };

  // options.includeUnapproved is for Stuart's own testing only; never use it for client output.
  function runChecks(projectData, rules, options) {
    var list = (rules && rules.rules) || (Array.isArray(rules) ? rules : null) || (root.PC_REGS_RULES && root.PC_REGS_RULES.rules) || [];
    var i = inputs(projectData);
    if (i.nation !== 'England') return [];
    var all = {}, out = [];
    list.forEach(function (r) {
      var fn = CHECKS[r.id];
      if (!fn) return;
      var res = fn(r, i, all);
      all[r.id] = res;
      if (r.approved === true || (options && options.includeUnapproved)) out = out.concat(res);
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
      var stored = { version: rules.version, ranAt: new Date().toISOString(), nation: f.regsNation || '', results: runChecks(p, rules) };
      p.backgroundChecks = Object.assign({}, p.backgroundChecks || {}, { regsChecker: stored });
      if (typeof root.save === 'function') root.save();
      return stored;
    });
  }

  root.runChecks = runChecks;
  root.runRegsChecker = runRegsChecker;
  if (typeof module !== 'undefined' && module.exports) module.exports = { runChecks: runChecks };
})(typeof window !== 'undefined' ? window : globalThis);
