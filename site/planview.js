// Build planner: a build order in stages. Everything you tick as built adds its metal, energy and build power
// to your income, and every item still to build is timed with the income and build power you will have by then.
//   time at full speed = build time / build power
//   if income is lower than the full-speed need, building slows to what you can afford (stored resources are ignored)
let planFac = 'Armada', planNote = '';
let planS = [{ name: 'Opening', items: [{ id: 'armmex', q: 2 }, { id: 'armsolar', q: 2 }, { id: 'armlab', q: 1 }] }, { name: 'Expand', items: [{ id: 'armmex', q: 4 }, { id: 'armsolar', q: 4 }] }];
let planX = { m: 0, e: 0 };                                   // income you already have that is not in the plan
let planAs = { spot: 2, wind: 12, tidal: 20, conv: 50, wm: 'avg' }, planMapId = null;                // assumptions that depend on the map
let planStartSel = '';                                         // which start position on the map, e.g. "0:1"
let planTarget = null, planQ = '', planCat = 'All', planPrev = null;

function planLoad() {   // called by app.js once the unit data exists
  try {
    const s = JSON.parse(localStorage.getItem('barPlan') || 'null'); if (!s) return;
    const ok = a => (a || []).filter(x => byId[x.id]);
    if (FACS.includes(s.fac)) planFac = s.fac;
    if (Array.isArray(s.st) && s.st.length) planS = s.st.map(x => ({ name: String(x.name || 'Stage').slice(0, 40), items: ok(x.items).map(i => ({ id: i.id, q: i.q, done: !!i.done, g: i.g, note: i.note })) }));
    else if (Array.isArray(s.l)) planS = [{ name: 'Stage 1', items: ok(s.l) }];     // list saved by the first version
    const extra = ok(s.b).filter(x => !/com$/.test(x.id));                          // builders saved by the second version become built units
    if (extra.length && planS.length) planS[0].items.unshift(...extra.map(x => ({ id: x.id, q: x.n, done: true })));
    if (s.x) planX = { m: Number(s.x.m) || 0, e: Number(s.x.e) || 0 };
    if (s.map && MAPS.some(m => m.id === s.map)) planMapId = s.map;
    planStartSel = typeof s.sp === 'string' ? s.sp : '';
    if (s.as) planAs = { wm: ['min', 'max'].includes(s.as.wm) ? s.as.wm : 'avg', spot: Number(s.as.spot) || 2, wind: Number(s.as.wind) || 0, tidal: Number(s.as.tidal) || 0, conv: s.as.conv == null ? 50 : Number(s.as.conv) || 0 };
  } catch (e) {}
}
const planSave = () => { try { localStorage.setItem('barPlan', JSON.stringify({ st: planS, fac: planFac, x: planX, as: planAs, map: planMapId, sp: planStartSel })); } catch (e) {} };
const clock = s => { if (!isFinite(s)) return 'never'; if (s < 60) return (Math.round(s * 10) / 10) + 's'; const t = Math.round(s); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const rate = v => Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
const sgn = v => (v > 0 ? '+' : '') + rate(v);

// what one finished unit adds: metal per second, energy per second, build power
function planProd(u) {
  let m = 0, e = 0;
  if (u.mex) m = u.mex * planAs.spot;                    // extractors: output follows the metal spot value
  else m = u.mmake || 0;
  e = (u.emake || 0) - (u.upkeep || 0);                  // negative upkeep is production (solar), positive is a running cost
  if (/wind/i.test(u.name)) e += planAs.wind;
  if (/tidal/i.test(u.name)) e += planAs.tidal;
  return { m, e, bp: u.worker || 0, cc: u.cc || 0, cm: (u.cc || 0) * (u.ce || 0) };   // cc: energy a converter can swallow, cm: metal it makes at that rate
}
const planStart = () => { const c = byId[COMMANDER[planFac]], p = planProd(c); return { m: p.m + planX.m, e: p.e + planX.e, bp: c.worker || 0, cc: 0, cm: 0 }; };
// converters only soak up spare energy: they may use a share of the energy income, up to their capacity
function planEff(inc) {
  if (!inc.cc) return { m: inc.m, e: inc.e, bp: inc.bp, cc: 0 };
  const used = Math.min(inc.cc, Math.max(0, inc.e) * planAs.conv / 100);
  return { m: inc.m + used * inc.cm / inc.cc, e: inc.e - used, bp: inc.bp, used, cc: inc.cc };
}

function planCalc(u, raw) {
  const inc = planEff(raw), bp = inc.bp, m = Math.max(.1, inc.m), e = Math.max(.1, inc.e);
  const full = bp ? u.bt / bp : Infinity;
  const needM = u.metal / full, needE = u.energy / full;
  const tM = u.metal / m, tE = u.energy / e, tR = Math.max(tM, tE);
  const t = Math.max(full, tR);
  const lim = !bp ? 'No builders' : tR > full * 1.001 ? (tM >= tE ? 'Metal income' : 'Energy income') : 'Build power';
  return { full, needM, needE, t, lim };
}

// walk the plan in order: ticked items count from the start, the rest are built one after another
function planSim() {
  const inc = planStart(), now = { ...inc }, vals = planSpotVals();   // vals: values of the metal spots you can use, best first (null without map data)
  inc.sl = [];                                                      // spots that already have an extractor: { v: value, r: extractor rating }
  let over = 0;                                                     // extractors that found no free spot
  // returns what this batch adds, so rows can show it
  const add = (u, n) => {
    const g = { m: 0, e: 0, bp: 0, noSpot: 0 };
    if (vals && u.mex) {
      for (let i = 0; i < n; i++) {
        const up = u.mex > 1 ? inc.sl.findIndex(s => s.r < u.mex) : -1;      // a better extractor goes on the best spot that has a basic one
        let gain;
        if (up >= 0) { gain = (u.mex - inc.sl[up].r) * inc.sl[up].v; inc.sl[up].r = u.mex; }
        else { const v = vals[inc.sl.length]; if (v == null) { g.noSpot++; over++; } gain = u.mex * (v || 0); inc.sl.push({ v: v || 0, r: u.mex }); }
        const de = (u.emake || 0) - (u.upkeep || 0);
        inc.m += gain; inc.e += de; g.m += gain; g.e += de;
      }
      return g;
    }
    const p = planProd(u);
    inc.m += p.m * n; inc.e += p.e * n; inc.bp += p.bp * n; inc.cc += p.cc * n; inc.cm += p.cm * n;
    g.m = p.m * n; g.e = p.e * n; g.bp = p.bp * n; return g;
  };
  const gains = new Map();
  planS.forEach(st => st.items.forEach(i => { if (i.done) gains.set(i, add(byId[i.id], i.q)); }));
  Object.assign(now, planEff(inc));
  let time = 0; const sum = { m: 0, e: 0, done: 0, all: 0 };
  const start = planEff(inc), pts = [{ t: 0, m: start.m, e: start.e, bp: start.bp }], segs = [];   // timeline for the chart: income after each unit, and the stretches held back by income
  const stages = planS.map((st, si) => {
    const rows = st.items.map((x, ii) => {
      const u = byId[x.id], p = planProd(u); sum.all++;
      if (x.done) { sum.done++; return { ii, u, q: x.q, done: true, p, gain: gains.get(x), g: x.g, note: x.note }; }
      const start = planEff(inc), first = planCalc(u, inc); let t = 0; const gain = { m: 0, e: 0, bp: 0, noSpot: 0 };
      for (let k = 0; k < x.q; k++) {
        const c = planCalc(u, inc), t0 = time + t; t += c.t; const d = add(u, 1), after = planEff(inc);
        segs.push({ t0, t1: time + t, lim: c.lim, name: u.name, si }); pts.push({ t: time + t, m: after.m, e: after.e, bp: after.bp });
        gain.m += d.m; gain.e += d.e; gain.bp += d.bp; gain.noSpot += d.noSpot; }
      time += t; sum.m += u.metal * x.q; sum.e += u.energy * x.q;
      return { ii, u, q: x.q, done: false, p, gain, c: first, t, start, g: x.g, note: x.note };
    });
    return { rows, ready: time, end: planEff(inc), left: rows.filter(r => !r.done) };
  });
  return { stages, pts, segs, now, end: planEff(inc), time, sum, over, spots: vals ? vals.length : null, used: inc.sl.length };
}

// ---- load a build order from the guides
const FACTORY_ROLES = new Set(['botlab', 'vehlab', 'airlab', 'shipyard', 't2bot', 't2veh', 't2air']);
const guideQty = n => typeof n === 'number' ? n : Math.max(1, Number((String(n || '1').match(/\d+/) || [1])[0]));
function planStagesFromGuide(id, f) {
  const G = window.GUIDES, st = G && G.styles.find(s => s.id === id); if (!st) return null;
  const stages = [{ name: 'Opening', items: [] }]; let missing = 0, ranges = 0;
  st.steps.forEach(s => {
    const uid = G.roles[s.r] && G.roles[s.r][f];
    if (!uid || !byId[uid]) { missing++; return; }
    let cur = stages[stages.length - 1];
    if (FACTORY_ROLES.has(s.r) && cur.items.length) { cur = { name: byId[uid].name, items: [] }; stages.push(cur); }
    if (typeof s.n === 'string') ranges++;
    cur.items.push({ id: uid, q: guideQty(s.n), g: typeof s.n === 'string' ? s.n : undefined, note: s.t });
  });
  return { st, stages: stages.filter(x => x.items.length), missing, ranges };
}
function planFromGuide(id, f) {
  const r = planStagesFromGuide(id, f); if (!r) return;
  const { st, missing, ranges } = r;
  planPrev = JSON.stringify({ st: planS, fac: planFac, map: planMapId, as: planAs, x: planX });
  planFac = f; planS = r.stages;
  planNote = `Loaded the ${st.name} build order for ${f}.` + (ranges ? ` Where the guide gives a range, such as 2 to 3, the planner uses the lowest number and shows the guide's range.` : '') + (missing ? ` ${missing} step(s) had no ${f} unit and were skipped.` : '');
}

// ---- faction switch: swap the commander and map every other unit to its counterpart by name and tech level
const planKey = u => u.name.replace(/^legion\s+/i, '').toLowerCase();
function planMap(id, f) {
  const u = byId[id];
  if (u.faction === f) return id;
  if (/com$/.test(id)) return COMMANDER[f];
  const m = U.find(x => x.faction === f && planKey(x) === planKey(u) && x.tier === u.tier) || U.find(x => x.faction === f && planKey(x) === planKey(u));
  return m ? m.id : null;
}
function planSwitch(f) {
  if (f === planFac) return;
  let dropped = 0;
  planS.forEach(st => { st.items = st.items.map(i => { const id = planMap(i.id, f); if (!id) { dropped++; return null; } return { ...i, id }; }).filter(Boolean); });
  planFac = f;
  planNote = dropped ? `${dropped} ${dropped === 1 ? 'unit' : 'units'} had no ${f} equivalent and ${dropped === 1 ? 'was' : 'were'} removed.` : '';
}


// ---- income timeline: what you earn over the course of the plan, with the stretches where income holds you back
function planChart(sim) {
  const { pts, segs, time } = sim; if (!segs.length || !isFinite(time) || time <= 0) return '';
  const W = 860, L = 52, R = 14, T = 22, strips = [['m', 'Metal/s', '#7fb8ff'], ['e', 'Energy/s', '#ffe27a'], ['bp', 'Build power', '#6fe09a']], SH = 74, GAP = 22;
  const H = T + strips.length * (SH + GAP) + 14, X = t => L + t / time * (W - L - R);
  const stall = segs.filter(s => /income/.test(s.lim) && s.t1 - s.t0 > time * .004);
  const bands = stall.map(s => `<rect x="${X(s.t0).toFixed(1)}" y="${T}" width="${Math.max(2, X(s.t1) - X(s.t0)).toFixed(1)}" height="${H - T - 14}" style="fill:var(--bad);opacity:.16"><title>${s.name}: held back by ${s.lim.toLowerCase()} for ${clock(s.t1 - s.t0)}</title></rect>`).join('');
  const ticks = []; const step = [10, 15, 30, 60, 120, 180, 300, 600, 900, 1800].find(v => time / v <= 8) || 3600;
  for (let t = 0; t <= time; t += step) ticks.push(t);
  let svg = bands;
  ticks.forEach(t => { svg += `<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${T}" y2="${H - 14}" style="stroke:var(--line)" stroke-width="1"/><text x="${X(t).toFixed(1)}" y="${H - 2}" text-anchor="middle" style="fill:var(--mute)" font-size="11">${clock(t)}</text>`; });
  let cum = 0;
  planS.forEach((st, si) => { const r = sim.stages[si].ready; if (si && sim.stages[si].left.length && r > cum) svg += `<line x1="${X(cum).toFixed(1)}" x2="${X(cum).toFixed(1)}" y1="${T - 6}" y2="${H - 14}" style="stroke:var(--line2)" stroke-dasharray="3 3"/><text x="${X(cum) + 4}" y="${T - 9}" style="fill:var(--ink)" font-size="11">${st.name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`; if (sim.stages[si].left.length) cum = r; });
  if (planS.length && sim.stages[0].left.length) svg += `<text x="${L + 4}" y="${T - 9}" style="fill:var(--ink)" font-size="11">${planS[0].name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
  strips.forEach(([k, label, col], i) => {
    const y0 = T + i * (SH + GAP) + 4, hi = Math.max(1, ...pts.map(p => p[k])) * 1.1, Y = v => y0 + SH - Math.max(0, v) / hi * SH;
    let d = `M${X(0).toFixed(1)} ${Y(pts[0][k]).toFixed(1)}`;
    for (let j = 1; j < pts.length; j++) d += ` H${X(pts[j].t).toFixed(1)} V${Y(pts[j][k]).toFixed(1)}`;
    d += ` H${X(time).toFixed(1)}`;
    svg += `<line x1="${L}" x2="${W - R}" y1="${y0 + SH}" y2="${y0 + SH}" style="stroke:var(--line2)"/><text x="${L - 6}" y="${y0 + 9}" text-anchor="end" style="fill:var(--mute)" font-size="11">${rate(hi / 1.1)}</text><text x="${L - 6}" y="${y0 + SH}" text-anchor="end" style="fill:var(--mute)" font-size="11">0</text>`
      + `<text x="${L + 4}" y="${y0 + 11}" style="fill:${col}" font-size="12" font-weight="600">${label}</text>`
      + `<path d="${d} V${y0 + SH} H${X(0).toFixed(1)} Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2"/>`;
  });
  const worst = stall.slice().sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0))[0];
  const note = stall.length
    ? `Shaded stretches are where your income, not your build power, sets the pace: ${stall.length} ${stall.length === 1 ? 'unit' : 'units'}, ${clock(stall.reduce((s, x) => s + x.t1 - x.t0, 0))} in all. The longest is ${worst.name} (${clock(worst.t1 - worst.t0)}, held back by ${worst.lim.toLowerCase()}).`
    : 'Nothing in this plan is held back by income: build power is the limit all the way through.';
  return `<section class="plsec"><h3 class="cap">Income timeline</h3><svg class="plchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Metal, energy and build power over the course of the plan">${svg}</svg><p class="note">${note} Time counts from now, with ticked items already built.</p></section>`;
}

function renderPlan() {
  const sim = planSim(), { sum } = sim;
  planTarget = planTarget === null ? null : Math.min(planTarget, planS.length - 1);
  const pct = sum.all ? Math.round(sum.done / sum.all * 100) : 0;
  const stages = planS.map((st, si) => {
    const S = sim.stages[si], all = S.rows.length > 0 && !S.left.length;
    const tot = S.left.reduce((s, r) => ({ m: s.m + r.u.metal * r.q, e: s.e + r.u.energy * r.q, t: s.t + r.t }), { m: 0, e: 0, t: 0 });
    const body = S.rows.map(r => {
      const gn = r.gain || { m: r.p.m * r.q, e: r.p.e * r.q, bp: r.p.bp * r.q, noSpot: 0 };
      const add = (r.p.cc ? [`converts up to ${rate(r.p.cc * r.q)} energy/s into ${rate(r.p.cm * r.q)} metal/s`] : [gn.m ? `${sgn(gn.m)} metal/s` : '', gn.e ? `${sgn(gn.e)} energy/s` : '', gn.bp ? `${sgn(gn.bp)} build power` : ''].filter(Boolean)).join(', ')
        + (gn.noSpot ? `<br><b class="plnospot">${gn.noSpot === r.q ? 'No free metal spot' : gn.noSpot + ' with no free metal spot'}</b>` : '');
      return `<tr class="${r.done ? 'done' : ''}"><td class="ck"><input type="checkbox" ${r.done ? 'checked' : ''} data-pck="${si},${r.ii}" aria-label="Built: ${r.u.name}"></td>
        <td class="un"><button class="plu" data-plopen="${r.u.id}" style="--c:${FCOL[r.u.faction]}" title="${(r.note || '').replace(/"/g, '&quot;')}"><span class="art"><img src="img/${r.u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>${r.u.name}</button>${r.note ? `<small class="plnote">${r.note}</small>` : ''}</td>
        <td><input type="number" min="1" max="999" value="${r.q}" data-plq="${si},${r.ii}" aria-label="Quantity of ${r.u.name}">${r.g ? `<small class="plg">guide: ${r.g}</small>` : ''}</td>
        <td>${fmt(r.u.metal * r.q)}</td><td>${fmt(r.u.energy * r.q)}</td>
        <td class="tt">${r.done ? '<small>built</small>' : `<b>${clock(r.t)}</b><small>${r.q > 1 ? clock(r.t / r.q) + ' each, ' : ''}at ${rate(r.start.m)} metal, ${rate(r.start.e)} energy, ${rate(r.start.bp)} BP</small>`}</td>
        <td class="add">${add || '<small>nothing</small>'}</td><td class="lim ${r.done || r.c.lim === 'Build power' ? '' : 'warn'}">${r.done ? '' : r.c.lim}</td>
        <td><button class="plx" data-plx="${si},${r.ii}" aria-label="Remove ${r.u.name}">×</button></td></tr>`;
    }).join('');
    return `<section class="plstage${all ? ' complete' : ''}">
      <div class="plsh"><label class="plck"><input type="checkbox" ${all ? 'checked' : ''} ${S.rows.length ? '' : 'disabled'} data-plsd="${si}" aria-label="Stage built"></label>
        <input class="plsn" value="${st.name.replace(/"/g, '&quot;')}" data-plsn="${si}" aria-label="Stage name" maxlength="40">
        <span class="plsm">${S.rows.length - S.left.length} of ${S.rows.length} built${S.left.length ? `, ready at <b>${clock(S.ready)}</b>` : ''}</span>
        <span class="plsb"><button data-plsu="${si}" aria-label="Move stage up"${si ? '' : ' disabled'}>Up</button><button data-plsw="${si}" aria-label="Move stage down"${si < planS.length - 1 ? '' : ' disabled'}>Down</button><button data-plsx="${si}" aria-label="Delete stage">Delete</button></span></div>
      ${S.rows.length ? `<div class="pltw"><table class="pltab"><thead><tr><th></th><th>Unit</th><th>Qty</th><th>Metal</th><th>Energy</th><th>Your time</th><th>Adds when built</th><th>Held back by</th><th></th></tr></thead><tbody>${body}</tbody>
        <tfoot><tr><td></td><td>Left in this stage</td><td></td><td>${fmt(tot.m)}</td><td>${fmt(tot.e)}</td><td class="tt"><b>${clock(tot.t)}</b></td><td class="add">Then: ${rate(S.end.m)} metal/s, ${rate(S.end.e)} energy/s, ${rate(S.end.bp)} BP</td><td></td><td></td></tr></tfoot></table></div>`
        : '<p class="empty" style="padding:var(--s3)">Empty stage. Use Add units to put something in it.</p>'}
      <div class="plsa"><button class="vsswap" data-pladd="${si}">Add units and builders</button></div></section>`;
  }).join('');

  const nm = sim.now, en = sim.end;
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Build planner</h2>
    <p class="gb">Plan your build order in stages. Tick what you have built and the planner adds its income and build power, then works out how long everything else takes.</p></div>
    <section class="plsec"><h3 class="cap">Start with</h3>
      <div class="plfac">${FACS.map(f => `<button data-plfac="${f}" aria-pressed="${f === planFac}" style="--c:${FCOL[f]}"><span class="art"><img src="img/${COMMANDER[f]}.webp" alt="" onerror="this.style.visibility='hidden'"></span><span><b>${f}</b><small>${byId[COMMANDER[f]].name}, ${fmt(byId[COMMANDER[f]].worker)} build power</small></span></button>`).join('')}</div>
      <p class="note">${planNote || `Units you add are limited to ${planFac}.`}${planPrev ? ' <button class="plundo" id="plundo">Undo</button>' : ''}</p>
      <div class="plguide"><label>Start from a guide <select id="plgs">${(window.GUIDES ? window.GUIDES.styles : []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></label>
        <button class="vsswap" id="plgl">Load it for ${planFac}</button><span class="note" style="margin:0">This replaces the stages below. You can undo it.</span></div></section>
    ${sim.spots != null && sim.over ? `<p class="plwarn">Your plan has ${sim.used} extractors but only ${sim.spots} metal spots are open to you, so ${sim.over} will find none and add no metal. Choose a wider start position or take fewer extractors.</p>` : ''}
    <section class="plsum"><div class="plprog"><div class="plpb"><i style="width:${pct}%"></i></div><span><b>${sum.done}</b> of ${sum.all} built</span></div>
      <div class="plst"><span><b>${clock(sim.time)}</b>left to build</span><span><b>${fmt(sum.m)}</b>metal left</span><span><b>${fmt(sum.e)}</b>energy left</span></div>
      <button class="vsswap" id="plreset"${sum.done ? '' : ' disabled'}>Untick everything</button></section>
    <section class="plsec"><h3 class="cap">Income</h3>
      <div class="plinc4"><div><small>Now, from the commander and what is ticked</small><b><i style="color:#7fb8ff">${rate(nm.m)}</i> metal/s <i style="color:#ffe27a">${rate(nm.e)}</i> energy/s <i>${rate(nm.bp)}</i> build power</b></div>
        <div><small>When the whole plan is built</small><b><i style="color:#7fb8ff">${rate(en.m)}</i> metal/s <i style="color:#ffe27a">${rate(en.e)}</i> energy/s <i>${rate(en.bp)}</i> build power</b></div></div>
      ${planMapHtml()}
      <details class="plas"><summary>Assumptions</summary>
        <div class="plinc"><label>Extra metal/s <input type="number" step="0.5" value="${planX.m}" data-plx2="m"></label><label>Extra energy/s <input type="number" step="5" value="${planX.e}" data-plx2="e"></label>
          <label>Metal spot value <input type="number" step="0.1" min="0.1" value="${planAs.spot}" data-plas="spot"></label><label>Wind per turbine <input type="number" step="1" min="0" value="${planAs.wind}" data-plas="wind"></label><label>Tidal per generator <input type="number" step="1" min="0" value="${planAs.tidal}" data-plas="tidal"></label>
          <label>Converters may use <input type="number" step="5" min="0" max="100" value="${planAs.conv}" data-plas="conv"> % of energy income</label></div>
        <p class="note">Extra income is anything you have outside this plan. An extractor gives its rating times the spot value, so a standard spot of 2 gives a basic extractor 2 metal/s. Wind and tidal vary by map. Energy converters turn spare energy into metal: the planner lets them use the share of your energy income set above (up to their capacity), so building still has energy left, and counts the metal they make. Every builder in the plan is assumed to work together on each unit.</p></details></section>
    ${planChart(sim)}
    ${stages}
    <div class="plact"><button class="vsswap" id="pladds">Add stage</button></div>
    ${planShareHtml()}
    <p class="note">Your time is the slower of two limits: build power, and how fast your income can pay for the unit. Items build one after another, and stored resources are ignored.</p>`;
}

// ---- pick a map: its wind and tidal strength replace the guessed defaults
const planMapObj = () => planMapId ? MAPS.find(m => m.id === planMapId) : null;
function planApplyMap() {
  const m = planMapObj(); if (!m) return;
  const [lo, avg, hi] = m.wd || [];
  planAs.wind = Math.round(({ min: lo, max: hi }[planAs.wm] ?? avg ?? planAs.wind) * 10) / 10;
  planAs.tidal = m.td ?? planAs.tidal;
}
// ---- real metal spots (from tools/map_spots.py) and the start position
const spotMult = sp => sp.mx || 1;
const spotValue = (sp, s) => Math.round(s[2] * spotMult(sp) * 100) / 100;
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > y) !== (pts[j][1] > y) && x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c; return c; };
const boxPts = poly => poly.length === 2 ? [[poly[0][0], poly[0][1]], [poly[1][0], poly[0][1]], [poly[1][0], poly[1][1]], [poly[0][0], poly[1][1]]] : poly;
function planStartOptions(m) {
  const out = [];
  layoutsOf(m).forEach((lay, li) => {
    if (lay.kind === 'box') lay.b.b.forEach((_, bi) => out.push([`${li}:${bi}`, `${lay.label}: area ${String.fromCharCode(65 + bi)}`]));
    else if (lay.kind === 'spawn') lay.pts.forEach((_, i) => out.push([`${li}:${i}`, `${lay.label}: spawn ${i + 1}`]));
    else lay.t.s.forEach((side, ti) => side.forEach(([sp], j) => { if (out.length < 400) out.push([`${li}:${ti}.${j}`, `${lay.label}: team ${ti + 1}, spawn ${j + 1}`]); }));
  });
  return out;
}
// split the map's spots into "your start area" and "nearby"
function planSpotGroups(mid = planMapId, startSel = planStartSel) {
  const m = mid ? MAPS.find(x => x.id === mid) : null, sp = planSp(mid); if (!m || !sp) return null;
  const all = sp.s.map(s => ({ x: s[0], y: s[1], v: spotValue(sp, s) }));
  const sel = startSel.split(':'), lay = layoutsOf(m)[Number(sel[0])];
  if (!lay || sel.length < 2) return { all, area: null, near: null };
  const W = m.w * 512, H = m.h * 512;
  let inside, nearby;
  if (lay.kind === 'box') {
    const pts = boxPts(lay.b.b[Number(sel[1])]); if (!pts) return { all, area: null, near: null };
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const big = pts.map(p => [cx + (p[0] - cx) * 1.6, cy + (p[1] - cy) * 1.6]);
    inside = s => inPoly(s.x, s.y, pts); nearby = s => inPoly(s.x, s.y, big);
  } else if (lay.kind === 'spawn') {
    const p = lay.pts[Number(sel[1])]; if (!p) return { all, area: null, near: null };
    const d = s => Math.hypot((s.x - p[0]) / 200 * W, (s.y - p[1]) / 200 * H);
    inside = s => d(s) <= 700; nearby = s => d(s) <= 1500;
  } else {
    const [ti, j] = sel[1].split('.').map(Number), spn = lay.t.s[ti] && lay.t.s[ti][j], pos = spn && m.sp.pos[spn[0]];
    if (!pos) return { all, area: null, near: null };
    const d = s => Math.hypot(s.x / 200 * W - pos[0], s.y / 200 * H - pos[1]);
    inside = s => d(s) <= 700; nearby = s => d(s) <= 1500;
  }
  const area = all.filter(inside), near = all.filter(s => !inside(s) && nearby(s));
  return { all, area, near };
}
const planSp = (mid = planMapId) => mid && window.MAPSPOTS && window.MAPSPOTS[mid];
// the values extractors will get, best first: your start area, then nearby, then (with no position chosen) the whole map
function planSpotVals() {
  const g = planSpotGroups(); if (!g) return null;
  const by = a => a.map(s => s.v).sort((x, y) => y - x);
  return g.area ? [...by(g.area), ...by(g.near)] : by(g.all);
}
function planSpotHtml(m) {
  const sp = planSp();
  if (!sp) return `<p class="note plimp">This map's metal spots have not been imported yet, so extractors use the metal spot value in Assumptions. To import them, run <code>python tools/map_spots.py "${m.n}"</code>, then reload this page. The tool downloads the map once (${'30 to 180'} MB), reads its metal map and deletes the download.</p>`;
  const g = planSpotGroups(), opts = planStartOptions(m), sum = a => Math.round(a.reduce((s, x) => s + x.v, 0) * 10) / 10;
  const avg = g.all.length ? Math.round(sum(g.all) / g.all.length * 100) / 100 : 0;
  let txt = `The map has <b>${g.all.length}</b> metal spots, worth ${avg} metal/s on average with a basic extractor.`;
  if (g.area) txt += ` In your start area: <b>${g.area.length}</b> (${sum(g.area)} metal/s in total). Nearby: <b>${g.near.length}</b> more (${sum(g.near)}). Extractors in the plan take the best spots first.`;
  else txt += ' Pick your start position to limit the plan to the spots around you. Until then it can use any spot on the map.';
  return `${opts.length ? `<label class="plstart">Start position <select id="plstart"><option value="">Anywhere on the map</option>${opts.map(([v, l]) => `<option value="${v}"${v === planStartSel ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
    <p class="note plimp">${txt}</p>`;
}
function planMapHtml() {
  const m = planMapObj(), maps = [...MAPS].sort((a, b) => a.n.localeCompare(b.n));
  let info = 'Pick a map to use its real wind and tidal strength. Without one, the numbers in Assumptions are rough guesses.';
  if (m) {
    const [lo, avg, hi] = m.wd || [];
    info = `Wind averages ${avg ?? '?'} energy per turbine (low ${lo ?? '?'}, high ${hi ?? '?'}). Tidal generators give ${m.td ?? '?'}.`
      + (m.td === 0 ? ' Tidal generators produce nothing here.' : '') + (avg != null && avg < 7 ? ' This is a low-wind map: Solar Collectors are the safer energy.' : '')
      ;
  }
  return `<div class="plmap"><label>Map <select id="plmap"><option value="">No map, my own numbers</option>${maps.map(x => `<option value="${x.id.replace(/"/g, '&quot;')}"${m && x.id === m.id ? ' selected' : ''}>${x.n}</option>`).join('')}</select></label>
    ${m ? `<label>Wind <select id="plwm"><option value="avg"${planAs.wm === 'avg' ? ' selected' : ''}>Average</option><option value="min"${planAs.wm === 'min' ? ' selected' : ''}>Low</option><option value="max"${planAs.wm === 'max' ? ' selected' : ''}>High</option></select></label>` : ''}
    <p class="note" style="margin:0;flex-basis:100%">${info}</p>${m ? planSpotHtml(m) : ''}</div>`;
}

// ---- add units and builders ---------------------------------------------------
const PCATS = [['All', () => true], ['Energy', u => u._sec === 'Economy: Energy'], ['Metal', u => u._sec === 'Economy: Metal'],
  ['Builders', u => u.worker > 0 && u._sec !== 'Factories'], ['Factories', u => u._sec === 'Factories'],
  ['Defenses', u => /^Combat/.test(u._sec || '')], ['Units', u => u.cat !== 'Buildings' && !(u.worker > 0)], ['Utility', u => u._sec === 'Utility & Intel' && !(u.worker > 0)]];
function planPool() {
  return U.filter(u => u.faction === planFac && builtBy[u.id] && !u.exp && !/com$/.test(u.id));
}
function planPickList() {
  const q = planQ.trim().toLowerCase(), cat = PCATS.find(c => c[0] === planCat)[1], st = planS[planTarget];
  const l = planPool().filter(u => cat(u) && (!q || (u.name + ' ' + u.desc + ' ' + u.id).toLowerCase().includes(q)))
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  return `<div class="vsgrid">${l.map(u => {
    const n = st ? st.items.filter(i => i.id === u.id).reduce((s, i) => s + i.q, 0) : 0, p = planProd(u);
    const adds = (p.cc ? [`turns up to ${rate(p.cc)} energy/s into ${rate(p.cm)} metal/s`] : [p.m ? sgn(p.m) + ' metal/s' : '', p.e ? sgn(p.e) + ' energy/s' : '', p.bp ? sgn(p.bp) + ' build power' : ''].filter(Boolean)).join(', ');
    return `<button class="vsu" data-plpick="${u.id}" style="--c:${FCOL[u.faction]}"><span class="art"><img loading="lazy" src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>
      <span><b>${u.name}</b><small>${fmt(u.metal)} metal, ${fmt(u.energy)} energy${adds ? '. ' + adds : ''}</small></span>${n ? `<em class="plin">${n} in stage</em>` : ''}</button>`;
  }).join('') || '<p class="empty">Nothing matches. Try a different word or category.</p>'}</div>`;
}
const planCatsHtml = () => PCATS.map(([c]) => `<button data-plcat="${c}" aria-pressed="${c === planCat}">${c}</button>`).join('');
function planOpenPick(si) {
  planTarget = si; planQ = ''; let m = $('#plmodal');
  if (!m) { m = document.createElement('div'); m.id = 'plmodal'; m.className = 'vsmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Add units to a stage'); document.body.appendChild(m); }
  m.innerHTML = `<div class="vsbox"><div class="vsbh"><h3 id="plmt"></h3><button class="xb" id="plclose" aria-label="Close">×</button></div>
    <input id="plq" type="search" placeholder="Search ${planFac} units and buildings" autocomplete="off" aria-label="Search units">
    <div class="vsf" id="plcats">${planCatsHtml()}</div><div id="pllist"></div>
    <div class="plmf"><span class="note" style="margin:0">Click a unit to add it. Click again to add another.</span><button class="vsswap" id="pldone">Done</button></div></div>`;
  planRefreshPick(); m.hidden = false; $('#plq').focus();
}
function planRefreshPick() { $('#plmt').textContent = 'Add to ' + planS[planTarget].name; $('#pllist').innerHTML = planPickList(); }
function planClosePick() { const m = $('#plmodal'); if (m) m.hidden = true; planTarget = null; }

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));
const pair = s => s.split(',').map(Number);
document.addEventListener('input', e => { if (e.target.id === 'plq') { planQ = e.target.value; $('#pllist').innerHTML = planPickList(); } });
document.addEventListener('change', e => {
  if (state.view !== 'plan') return;
  const t = e.target; let p;
  if (t.dataset.plq !== undefined) { p = pair(t.dataset.plq); planS[p[0]].items[p[1]].q = clamp(t.value, 1, 999); }
  else if (t.dataset.pck !== undefined) { p = pair(t.dataset.pck); planS[p[0]].items[p[1]].done = t.checked; }
  else if (t.dataset.plsd !== undefined) planS[t.dataset.plsd].items.forEach(i => { i.done = t.checked; });
  else if (t.dataset.plsn !== undefined) planS[t.dataset.plsn].name = t.value.trim() || 'Stage';
  else if (t.dataset.plx2) planX[t.dataset.plx2] = Number(t.value) || 0;
  else if (t.dataset.plas) { planAs[t.dataset.plas] = Math.max(t.dataset.plas === 'spot' ? .1 : 0, Number(t.value) || 0); if (t.dataset.plas === 'wind' || t.dataset.plas === 'tidal') planMapId = null; }
  else if (t.id === 'plmap') { planMapId = t.value || null; planStartSel = ''; planApplyMap(); }
  else if (t.id === 'plstart') planStartSel = t.value;
  else if (t.id === 'plwm') { planAs.wm = t.value; planApplyMap(); }
  else return;
  planSave(); const d = document.querySelector('.plas'), open = d && d.open; renderPlan(); if (open) document.querySelector('.plas').open = true;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && planTarget !== null) { e.stopPropagation(); planClosePick(); } }, true);
document.addEventListener('click', e => {
  const t = e.target;
  if (planTarget !== null) {
    if (t.closest('#plclose') || t.closest('#pldone') || t.id === 'plmodal') { planClosePick(); return; }
    const b = t.closest('[data-plpick]');
    if (b) {
      const items = planS[planTarget].items, ex = items.find(x => x.id === b.dataset.plpick && !x.done);
      if (ex) ex.q = Math.min(999, ex.q + 1); else items.push({ id: b.dataset.plpick, q: 1 });
      planSave(); renderPlan(); planRefreshPick(); return;
    }
    const c = t.closest('[data-plcat]'); if (c) { planCat = c.dataset.plcat; $('#plcats').innerHTML = planCatsHtml(); $('#pllist').innerHTML = planPickList(); }
    return;
  }
  if (state.view !== 'plan') return;
  const g = a => t.closest(`[${a}]`);
  let el;
  if ((el = g('data-plfac'))) { planNote = ''; planPrev = null; planSwitch(el.dataset.plfac); }
  else if (t.closest('#plgl')) planFromGuide($('#plgs').value, planFac);
  else if (t.closest('#plundo')) { if (planPrev) { const p = JSON.parse(planPrev); planS = p.st; planFac = p.fac; if (p.as) { planAs = p.as; planMapId = p.map || null; planX = p.x || planX; } planPrev = null; planNote = 'Restored your previous plan.'; } }
  else if ((el = g('data-plx'))) { const p = pair(el.dataset.plx); planS[p[0]].items.splice(p[1], 1); }
  else if (t.closest('#pladds')) planS.push({ name: 'Stage ' + (planS.length + 1), items: [] });
  else if (t.closest('#plreset')) planS.forEach(s => s.items.forEach(i => { i.done = false; }));
  else if ((el = g('data-plsx'))) { if (planS.length === 1) planS[0].items = []; else planS.splice(Number(el.dataset.plsx), 1); }
  else if ((el = g('data-plsu'))) { const i = Number(el.dataset.plsu); if (i > 0) [planS[i - 1], planS[i]] = [planS[i], planS[i - 1]]; }
  else if ((el = g('data-plsw'))) { const i = Number(el.dataset.plsw); if (i < planS.length - 1) [planS[i + 1], planS[i]] = [planS[i], planS[i + 1]]; }
  else if ((el = g('data-pladd'))) return planOpenPick(Number(el.dataset.pladd));
  else if ((el = g('data-plopen'))) return openUnit(el.dataset.plopen);
  else return;
  planSave(); renderPlan();
}, true);

// "Open this in the planner" on a guide page
document.addEventListener('click', e => {
  const b = e.target.closest('[data-toplan]'); if (!b) return;
  planFromGuide(b.dataset.toplan, state.gfac); planSave(); setView('plan');
}, true);

// "Plan a build order on this map" from a map page
document.addEventListener('click', e => {
  const b = e.target.closest('[data-planmap]'); if (!b) return;
  planMapId = b.dataset.planmap; planStartSel = ''; planAs.wm = 'avg'; planApplyMap(); planSave(); closeUnit(true); setView('plan');
}, true);
