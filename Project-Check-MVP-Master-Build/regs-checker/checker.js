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
  var OTHER_TEMP = 'Other temperature requirement';
  var NEED = 'need info', PROBLEM = 'potential problem', OK = 'ok', NOTE = 'note';
  // L_ENERGY: building uses inside the ADL low-energy-demand exemption when unheated (industrial sites, workshops,
  // non-residential agricultural). Storage and distribution are not named in ADL, so they get the check line (Stuart, 26 Nov 2026). Options are BUILDING_USE_OPTIONS in app.js; free text (older projects) uses the word test.
  var USE_OPTIONS = ['Warehousing and general storage', 'Distribution and logistics', 'Manufacturing or factory use', 'Workshop or vehicle repair', 'Vehicle or plant wash facility', 'Timber or materials storage', 'Food production or chilled storage', 'Spray room or process enclosure', 'Indoor sports or leisure use', 'Other industrial or commercial use'];
  var USE_EXEMPT = ['Manufacturing or factory use', 'Workshop or vehicle repair'];
  var USE_EXEMPT_TEXT = /industrial|manufactur|factory|workshop|agricultur|\bfarm|\bbarn\b/i;
  var USE_NOT_EXEMPT_TEXT = /storage|warehous|\bstores?\b|distribut|logistic|sport|leisure|padel|cricket|tennis|gym|fitness|office|retail|\bshop\b|showroom|resident|dwelling|school|church|community|chill|cold|freez|food|spray|commercial/i;

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
      // Fire boundary rules (ADB 13.5): each wall measured to the boundary it faces only. Never falls back to the
      // nearest-line-anywhere distances above (they give false flags on side walls and a false ok on unmarked sides).
      facing: regs && regs.facingBoundaryDistances ? regs.facingBoundaryDistances : (f.regsBoundaryDist && typeof f.regsBoundaryDist === 'object' ? f.regsBoundaryDist : null),
      base: f.base === 'Existing building' ? 'Existing building / structure' : String(f.base || ''),
      postcode: String(p.postcode || f.postcode || ''), altitude: num(f.regsAltitude), exposure: String(f.regsExposure || ''), solar: f.regsSolar || '',
      buildingType: String(f.buildingType || f.structure || ''), adjacent: String(f.adjacentExistingBuilding || ''),
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
      stage1Note: note ? fill(rule.stage1Note || '', vars) : '',
      needInfo: result === NEED ? fill(rule.needInfo || '', vars || (measured && typeof measured === 'object' ? measured : null)) : ''
    };
  }

  var CHECKS = {
    B_BOUNDARY: function (r, i) {
      // Distance only. The cladding fire rating is not asked; standard PIR is never treated as unprotected by default.
      // Each wall is measured to the boundary it faces (background-checks.js pcBgFacingBoundaryDistances). No facing boundary marked = need info.
      return WALLS.map(function (w) {
        var d = i.facing ? num(i.facing[w]) : null, m = { elevation: w, distance: d };
        if (d === null) return entry(r, NEED, m, { elevation: w });
        if (d >= 25) return entry(r, OK, m);
        return entry(r, PROBLEM, m, { elevation: w, distance: r1(d) });
      });
    },
    B_BOUNDARY_1M: function (r, i) {
      return WALLS.map(function (w) {
        var d = i.facing ? num(i.facing[w]) : null, m = { elevation: w, distance: d };
        if (d === null) return entry(r, NEED, m, { elevation: w });
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
      // ADL Vol 2: the test is fixed heating or cooling (2021 para 0.11 / 2026 para 0.12, and 2.27-2.29 / 2.26-2.28).
      // Reads the Stage 1 heated / temperature answer, the Building Design services answer and the building use.
      // - heated, other temperature (heating or cooling) or services Yes = note (energy calculation may be needed)
      // - unheated, services No, and a use inside the exemption (industrial, workshop, agricultural) = ok
      // - unheated, services No, any other use (e.g. storage, distribution, sports or leisure) = check line, never an all-clear
      // - anything unknown (heated answer, services answer or use) = need info, never ok
      var m = { heating: i.heating, services: i.services, use: i.use };
      if (i.services === 'Yes' || i.heating === HEATED || i.heating === OTHER_TEMP) return [entry(r, NOTE, m)];
      var missing = [];
      if (i.heating !== UNHEATED) missing.push(r.needInfoHeating);
      if (i.services !== 'No') missing.push(r.needInfo);
      if (!String(i.use).trim()) missing.push(r.needInfoUse);
      if (missing.length) { var e = entry(r, NEED, m); e.needInfo = missing.filter(Boolean).join('; '); return [e]; }
      var use = String(i.use), exempt = USE_EXEMPT.indexOf(use) !== -1 || (USE_OPTIONS.indexOf(use) === -1 && USE_EXEMPT_TEXT.test(use) && !USE_NOT_EXEMPT_TEXT.test(use));
      return [entry(r, exempt ? OK : PROBLEM, m, { use: use })];
    },

    // ---- Added rules (approved:false unless rules.json says otherwise). Fact keys are documented in README.md. ----
    // Permitted development, England, GPDO 2015 Sch 2 Part 7 Class H. Reads Building Design / Site Layout data.
    // measured.status: 'not-pd' (reasons with figures), 'unknown' (missing list) or 'likely-pd'. Never "no planning needed".
    PLAN_PD: function (r, i) {
      var L = r.limits, reasons = [], missing = [];
      function done(status) {
        var result = status === 'not-pd' ? PROBLEM : status === 'likely-pd' ? OK : NEED;
        return [entry(r, result, { status: status, reasons: reasons, missing: missing })];
      }
      if (i.nation === 'Scotland' || i.nation === 'Wales') {
        missing.push(i.nation + ' has different planning rules (Class H is for England) \u2013 get professional support');
        return done('unknown');
      }
      if (i.nation !== 'England') missing.push('the nation (set from the site postcode in Site Layout)');
      var ext = i.buildingType === 'Extension to an existing building' || i.buildingType === 'Building linked to existing premises' || i.adjacent.indexOf('Yes \u2014 links') === 0;
      var fresh = i.buildingType === 'Free-standing building' && !ext;
      if (!ext && !fresh) missing.push('a building type this check covers (free-standing or extension)');
      var area = i.W && i.L ? i.W * i.L : null, H = i.ridge || null;
      if (area === null) missing.push('the building width and length');
      if (H === null) missing.push('the building height');
      // Distance to the boundary on each elevation: an unmarked side is unknown, never far enough.
      var known = [], unmarked = [];
      WALLS.forEach(function (w) { var d = i.distances ? num(i.distances[w]) : null; if (d === null) unmarked.push(w); else known.push({ w: w, d: d }); });
      if (unmarked.length) missing.push('a marked site boundary on elevation ' + unmarked.join(', ') + ' (mark every site boundary in Site Layout)');
      if (ext) {
        if (i.existingArea === null) missing.push('the existing building floor area');
        if (i.existingHeight === null) missing.push('the existing building height');
      }
      // Size
      if (area !== null && fresh && area > L.maxNewM2) reasons.push('the new building is ' + r1(area) + ' m\u00b2, over the ' + L.maxNewM2 + ' m\u00b2 limit for a new building');
      if (area !== null && ext && i.existingArea !== null) {
        var lim = Math.min(i.existingArea * L.maxExtensionFraction, L.maxExtensionM2);
        if (area > lim) reasons.push('the extension is ' + r1(area) + ' m\u00b2, over the limit of ' + r1(lim) + ' m\u00b2 (the lesser of 50% of the existing ' + r1(i.existingArea) + ' m\u00b2 and ' + L.maxExtensionM2.toLocaleString('en-GB') + ' m\u00b2)');
      }
      // Boundary: any part within 5 m
      known.forEach(function (k) { if (k.d < L.minBoundaryM) reasons.push('elevation ' + k.w + ' is ' + r1(k.d) + ' m from the boundary, within the ' + L.minBoundaryM + ' m limit'); });
      // Height
      var near = known.filter(function (k) { return k.d < L.nearBoundaryM; });
      if (H !== null) {
        if (near.length) {
          if (H > L.maxHeightNearM) reasons.push('the building is ' + r1(H) + ' m high and within ' + L.nearBoundaryM + ' m of the boundary (elevation ' + near.map(function (k) { return k.w; }).join(', ') + '), over the ' + L.maxHeightNearM + ' m limit');
        } else if (!unmarked.length) {
          if (ext) {
            if (i.existingHeight !== null && H > i.existingHeight) reasons.push('the extension is ' + r1(H) + ' m high, higher than the existing building (' + r1(i.existingHeight) + ' m)');
          } else if (fresh) {
            if (H > L.maxHeightM) reasons.push('the new building is ' + r1(H) + ' m high, over the ' + L.maxHeightM + ' m limit');
            if (i.existingHeight === null) missing.push('the height of the tallest building on site');
            else if (H > i.existingHeight) reasons.push('the new building is ' + r1(H) + ' m high, higher than the tallest building on site (' + r1(i.existingHeight) + ' m)');
          }
        }
      }
      if (reasons.length) return done('not-pd');
      return done(missing.length ? 'unknown' : 'likely-pd');
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
    H_DRAINAGE_QUOTE: function (r, i) {
      // Built inside an existing building (Stage 1 base answer 'Existing building / structure', or a use that says
      // inside/within an existing building): no gutters or surface water connection, so only the services line is kept.
      var internal = i.base === 'Existing building / structure' || /\b(inside|within)\s+(an?\s+|the\s+)?existing\b/i.test(i.use);
      var e = entry(r, NOTE, { internal: internal });
      if (internal) e.stage1Note = r.stage1NoteInternal || e.stage1Note;
      return [e];
    },
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
    var england = i.nation === 'England';
    var all = {}, items = [];
    list.forEach(function (r) {
      var fn = CHECKS[r.id];
      if (!fn) return;
      if (!england && !r.anyNation) return; // other nations: only rules marked anyNation run (they report need info)
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

  // Stage 1 answer checks (rules with reportSection "stage1-answers"). These read the customer's own
  // Stage 1 answers and map status, run for every nation, and feed the Stage 1 report's flag sections
  // and "missing information" list (not "Potential issues to review"). runChecks ignores them because
  // they have no CHECKS function. Wording lives in rules.json. Only approved rules are returned.
  var ANSWER_CHECKS = {
    FOUNDATION_BASE: function (r, f) {
      var base = f.base === 'Existing building' ? 'Existing building / structure' : f.base;
      if (base === 'Not sure') return { risks: [r.stage1ProblemNotSure] };
      if ((r.triggerValues || []).indexOf(base) !== -1) return { risks: [r.stage1Problem] };
      return {};
    },
    SITE_LEVELS: function (r, f) {
      if (f.level !== 'No' && f.level !== 'Not sure') return {};
      return { risks: [r.stage1Problem], needInfo: f.level === 'No' ? [r.needInfo] : [] };
    },
    PROGRAMME: function (r, f) { return f.programme === '0\u20133 months' ? { risks: [r.stage1Problem] } : {}; },
    MAP_NOT_CONFIRMED: function (r, f) {
      var out = [];
      if (f.buildingPositionStatus !== 'confirmed') out.push(r.needInfoPosition);
      if (f.siteBoundaryStatus !== 'confirmed') out.push(r.needInfoBoundary);
      return { needInfo: out };
    }
  };

  // Synchronous: uses the rules passed in, or the rules.json already loaded by loadRegsRules().
  // Returns { risks: [{ruleId, text, category, discipline}], needInfo: [{ruleId, text}] }.
  function stage1AnswerChecks(projectData, rules) {
    var list = (rules && rules.rules) || (root.PC_REGS_RULES && root.PC_REGS_RULES.rules) || [];
    var f = (projectData && projectData.facts) || {}, risks = [], needInfo = [];
    list.forEach(function (r) {
      var fn = ANSWER_CHECKS[r.id];
      if (!fn || r.reportSection !== 'stage1-answers' || r.approved !== true) return;
      var res = fn(r, f) || {};
      (res.risks || []).filter(Boolean).forEach(function (t) { risks.push({ ruleId: r.id, text: t, category: r.category || 'issue', discipline: r.discipline || 'general' }); });
      (res.needInfo || []).filter(Boolean).forEach(function (t) { needInfo.push({ ruleId: r.id, text: t }); });
    });
    return { risks: risks, needInfo: needInfo };
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
    H_DRAINAGE_QUOTE: function (r, i, res) {
      if (res[0].measured && res[0].measured.internal) return []; // inside an existing building: no gutters or surface water connection
      return ['Gutters and downpipes are by the building supplier.', 'The surface water connection is customer scope (not by the building supplier).'];
    },
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
    if (!rulesPromise) rulesPromise = fetch('regs-checker/rules.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (rules) { if (rules) root.PC_REGS_RULES = rules; return rules; }).catch(function () { rulesPromise = null; return null; });
    return rulesPromise;
  }
  function runRegsChecker(p) {
    if (!p) return Promise.resolve(null);
    return loadRules().then(function (rules) {
      if (!rules) return null;
      var f = p.facts || {};
      var stored = { version: rules.version, ranAt: new Date().toISOString(), nation: inputs(p).nation, results: runChecks(p, rules), pdApproved: (rules.rules || []).some(function (r) { return r.id === 'PLAN_PD' && r.approved === true; }) };
      p.backgroundChecks = Object.assign({}, p.backgroundChecks || {}, { regsChecker: stored });
      if (typeof root.save === 'function') root.save();
      return stored;
    });
  }

  // Words for the Permitted development section (Stage 1 report and PDF). Takes the saved regsChecker record.
  function describePermittedDevelopment(saved) {
    var tail = ' Get professional support.';
    if (!saved) return { status: 'unknown', text: "We can't yet say whether this is permitted development. Missing: the Building Design confirmation." };
    var e = (saved.results || []).filter(function (x) { return x.ruleId === 'PLAN_PD'; })[0];
    if (!e) {
      if (saved.pdApproved === false) return { status: 'unknown', text: "We can't yet say whether this is permitted development. Missing: the permitted development check has not been approved yet." + tail };
      return { status: 'unknown', text: "We can't yet say whether this is permitted development. Missing: the information needed for the check." };
    }
    var m = e.measured || {};
    if (m.status === 'not-pd') return { status: 'not-pd', text: 'Full planning permission is likely to be needed: ' + (m.reasons || []).join('; ') + '. Get professional support.' };
    if (m.status === 'likely-pd') return { status: 'likely-pd', text: "On the information given, this looks likely to fall within permitted development (Class H). This isn't confirmed \u2013 get professional support to confirm." };
    return { status: 'unknown', text: "We can't yet say whether this is permitted development. Missing: " + ((m.missing || []).join('; ') || 'the information needed for the check') + '.' };
  }

  root.describePermittedDevelopment = describePermittedDevelopment;
  root.stage1AnswerChecks = stage1AnswerChecks;
  root.loadRegsRules = loadRules;
  root.runChecks = runChecks;
  root.buildQuoteRequest = buildQuoteRequest;
  root.runRegsChecker = runRegsChecker;
  if (typeof module !== 'undefined' && module.exports) module.exports = { runChecks: runChecks, buildQuoteRequest: buildQuoteRequest, describePermittedDevelopment: describePermittedDevelopment, stage1AnswerChecks: stage1AnswerChecks };
  // Browser: load rules.json straight away so the Stage 1 report can use it synchronously.
  if (typeof window !== 'undefined' && typeof fetch === 'function') loadRules();
})(typeof window !== 'undefined' ? window : globalThis);
