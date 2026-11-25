// Draw on a map: custom start boxes (like the BAR lobby), freehand lines and arrows. Kept in this browser per map,
// and shareable as a link. Custom start boxes also show up as a layout in the map page and as start areas in the planner.
const DRAWKEY = 'barMapDraw', DCOL = ['#ffd24a', '#ff5a3c', '#4da3ff', '#3fd8b0', '#ffffff', '#c77dff'];
const draws = {};                                    // map id -> { p: [[x,y,team colour]...] spawns, b: [[x1,y1,x2,y2]...] start boxes, s: [{ c, p: [x,y,...] } | { c, a: [x1,y1,x2,y2] }] }, coordinates 0 to 200
const dm = { on: false, tool: 'move', color: 0, cur: null, drag: null, hist: [], note: '', sn: 2, sug: [] };
const DTOOLS = [['move', 'Move', 'Drag a start box or a spawn to move it.'], ['box', 'Start box', 'Drag out a box. Each box gets the next letter and colour, like the lobby start areas.'],
  ['spawn', 'Spawn', 'Click to drop a spawn marker. The colour you pick is its team.'], ['pen', 'Pen', 'Draw freehand on the map.'], ['arrow', 'Arrow', 'Drag from where to where.'], ['erase', 'Erase', 'Click a box, line or arrow to remove it.']];

function loadDraws() { try { Object.assign(draws, JSON.parse(localStorage.getItem(DRAWKEY) || '{}')); } catch (e) {} }
function saveDraws() {
  try {
    const o = {}; for (const k in draws) if (dcount(k)) o[k] = draws[k];
    localStorage.setItem(DRAWKEY, JSON.stringify(o));
  } catch (e) {}
}
const dget = id => { const d = draws[id] || (draws[id] = { b: [], s: [], p: [] }); d.p ||= []; return d; };
const dcount = id => { const d = draws[id]; return d ? d.b.length + d.s.length + (d.p ? d.p.length : 0) : 0; };
// the boxes as a map layout (same shape as the official start boxes), so other pages can use them
function customLayout(m) {
  const d = draws[m.id], L = []; if (!d) return L;
  if (d.b.length) L.push({ kind: 'box', custom: true, label: `My start areas (${d.b.length})`, b: { m: 1, b: d.b.map(x => [[x[0], x[1]], [x[2], x[3]]]) } });
  if (d.p && d.p.length) L.push({ kind: 'spawn', custom: true, label: `My spawns (${d.p.length})`, pts: d.p.map(x => [x[0], x[1]]) });
  return L;
}

// ---- drawing ------------------------------------------------------------------
const r1 = v => Math.round(v * 10) / 10;
function simplify(pts, eps) {                        // Ramer-Douglas-Peucker on [x,y,x,y,...]
  const P = []; for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
  if (P.length < 3) return pts;
  const keep = new Array(P.length).fill(false); keep[0] = keep[P.length - 1] = true;
  const st = [[0, P.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = P[i], [x1, y1] = P[a], [x2, y2] = P[b], dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
      const t = l ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l)) : 0, d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = true; st.push([a, mi], [mi, b]); }
  }
  return P.filter((_, i) => keep[i]).flatMap(p => p);
}
function arrowSVG(a, W, H, k, col, attrs) {
  const x1 = a[0] / 200 * W, y1 = a[1] / 200 * H, x2 = a[2] / 200 * W, y2 = a[3] / 200 * H;
  const ang = Math.atan2(y2 - y1, x2 - x1), h = k * .03, sw = k * .005;
  const hd = [[x2, y2], [x2 - h * Math.cos(ang - .45), y2 - h * Math.sin(ang - .45)], [x2 - h * Math.cos(ang + .45), y2 - h * Math.sin(ang + .45)]];
  return `<g ${attrs}><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="${h * .7}" pointer-events="stroke"/><line x1="${x1}" y1="${y1}" x2="${x2 - Math.cos(ang) * h * .6}" y2="${y2 - Math.sin(ang) * h * .6}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>
    <polygon points="${hd.map(p => p.join(',')).join(' ')}" fill="${col}" stroke="#000" stroke-width="${sw * .3}" stroke-linejoin="round"/></g>`;
}
function drawInner(m) {
  const d = dget(m.id), W = m.w * 512, H = m.h * 512, k = Math.max(W, H), sw = k * .005;
  const box = (x, y, i, attrs, ghost) => {
    const c = TEAMCOL[i % TEAMCOL.length], x1 = Math.min(x[0], x[2]) / 200 * W, x2 = Math.max(x[0], x[2]) / 200 * W, y1 = Math.min(x[1], x[3]) / 200 * H, y2 = Math.max(x[1], x[3]) / 200 * H;
    return `<g ${attrs}><rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="${c}" fill-opacity="${ghost ? .15 : .28}" stroke="${c}" stroke-width="${k * .004}"${ghost ? ` stroke-dasharray="${k * .01}"` : ''}/>
      <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" text-anchor="middle" dominant-baseline="central" font-size="${k * .038}" font-weight="800" fill="#fff" stroke="#000" stroke-width="${k * .003}" paint-order="stroke">${String.fromCharCode(65 + i)}</text></g>`;
  };
  let g = d.b.map((b, i) => box(b, b, i, `data-dk="b" data-di="${i}"`)).join('');
  const r = k * .016;
  g += (d.p || []).map((p, i) => { const x = p[0] / 200 * W, y = p[1] / 200 * H, c = DCOL[p[2] % DCOL.length];
    return `<g data-dk="p" data-di="${i}"><title>Spawn ${i + 1}${dm.sug[i] ? ': ' + dm.sug[i] : ''}</title><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#000" stroke-width="${r * .15}"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${k * .019}" font-weight="800" fill="#06101a">${i + 1}</text></g>`; }).join('');
  d.s.forEach((s, i) => {
    const col = DCOL[s.c % DCOL.length], at = `data-dk="s" data-di="${i}"`;
    if (s.a) g += arrowSVG(s.a, W, H, k, col, at);
    else { const pts = []; for (let j = 0; j < s.p.length; j += 2) pts.push(`${s.p[j] / 200 * W},${s.p[j + 1] / 200 * H}`); g += `<g ${at}><polyline points="${pts.join(' ')}" fill="none" stroke="transparent" stroke-width="${k * .02}" pointer-events="stroke" stroke-linecap="round"/><polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></g>`; }
  });
  const c = dm.cur;
  if (c) {
    if (c.t === 'box') g += box([c.x1, c.y1, c.x2, c.y2], 0, d.b.length, '', true);
    else if (c.t === 'arrow') g += arrowSVG([c.x1, c.y1, c.x2, c.y2], W, H, k, DCOL[dm.color], '');
    else if (c.t === 'pen') { const pts = []; for (let j = 0; j < c.p.length; j += 2) pts.push(`${c.p[j] / 200 * W},${c.p[j + 1] / 200 * H}`); g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${DCOL[dm.color]}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`; }
  }
  return g;
}
function drawSVG(m) {
  const W = m.w * 512, H = m.h * 512;
  return `<svg class="ovl draw${dm.on ? ' edit' : ''}" id="drawsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Your drawing">${drawInner(m)}</svg>`;
}
function drawBar(m) {
  const d = dget(m.id), n = dcount(m.id);
  const tip = (DTOOLS.find(t => t[0] === dm.tool) || DTOOLS[0])[2];
  return `<div class="dbar" id="dbar"><button class="vsswap dtog" data-dt="toggle" aria-pressed="${dm.on}">${dm.on ? 'Done drawing' : 'Draw on this map'}</button>
    ${n ? `<span class="dcount">${[d.p.length ? d.p.length + (d.p.length === 1 ? ' spawn' : ' spawns') : '', d.b.length ? d.b.length + ' start ' + (d.b.length === 1 ? 'box' : 'boxes') : '', d.s.length ? d.s.length + (d.s.length === 1 ? ' line' : ' lines') : ''].filter(Boolean).join(', ')}</span>` : ''}
    ${dm.on ? `<div class="dtools"><div class="seg2">${DTOOLS.map(([id, t]) => `<button data-dtool="${id}" aria-pressed="${dm.tool === id}">${t}</button>`).join('')}</div>
      <div class="dsw" aria-label="Colour">${DCOL.map((c, i) => `<button data-dcol="${i}" aria-pressed="${dm.color === i}" aria-label="Colour ${i + 1}" style="--c:${c}"></button>`).join('')}</div>
      <button class="vsswap" data-dt="undo"${dm.hist.length ? '' : ' disabled'}>Undo</button>${d.p.length ? '<button class="vsswap" data-dt="clearp">Remove all spawns</button>' : ''}<button class="vsswap" data-dt="clear"${n ? '' : ' disabled'}>Clear all</button></div>
      ${spotsOf(m.id) ? `<div class="dsug"><label>Suggest <select id="dsn">${Array.from({ length: 16 }, (_, i) => `<option${i + 1 === dm.sn ? ' selected' : ''}>${i + 1}</option>`).join('')}</select> spawns</label><button class="vsswap" data-dt="suggest">Suggest good spawns</button></div>` : `<p class="note" style="flex-basis:100%;margin:0">To get spawn suggestions, import this map's metal spots first: <code>python tools/map_spots.py "${m.n}"</code></p>`}
      <p class="note" style="flex-basis:100%;margin:0">${tip}${dm.tool === 'pen' || dm.tool === 'arrow' ? ' Pick a colour with the swatches.' : ''}</p>` : ''}
    ${dm.sug.length && dm.on ? `<ol class="dsl">${dm.sug.map(t => `<li>${t}</li>`).join('')}</ol>` : ''}
    ${n ? `<button class="vsswap" data-dt="copy">Copy link to this drawing</button>` : ''}${dm.prev && dm.prev.id === m.id ? '<button class="vsswap" data-dt="restore">Undo the loaded drawing</button>' : ''}${dm.note ? `<span class="note" style="margin:0">${dm.note}</span>` : ''}</div>`;
}
function drawRefresh(m) {
  const s = document.getElementById('drawsvg'); if (s) s.innerHTML = drawInner(m);
  const b = document.getElementById('dbar'); if (b) b.outerHTML = drawBar(m);
}

// ---- sharing ------------------------------------------------------------------
function drawCode(id) {
  const d = draws[id]; if (!d) return '';
  return b64e(JSON.stringify({ b: d.b, p: d.p, s: d.s.map(s => s.a ? { c: s.c, a: s.a } : { c: s.c, p: s.p }) }));
}
function drawImport(id, code) {
  try {
    const o = JSON.parse(b64d(code)), num = v => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(200, r1(v))) : 0;
    const prev = JSON.stringify(draws[id] || { b: [], s: [], p: [] });
    draws[id] = {
      b: (o.b || []).slice(0, 16).map(x => [0, 1, 2, 3].map(i => num(x[i]))),
      p: (o.p || []).slice(0, 32).map(x => [num(x[0]), num(x[1]), (x[2] | 0) % DCOL.length]),
      s: (o.s || []).slice(0, 300).map(s => s.a ? { c: (s.c | 0) % DCOL.length, a: s.a.slice(0, 4).map(num) } : { c: (s.c | 0) % DCOL.length, p: (s.p || []).slice(0, 800).map(num) }).filter(s => s.a ? s.a.length === 4 : s.p.length >= 4)
    };
    dm.hist = []; dm.note = 'Loaded a shared drawing. It replaced yours for this map.'; dm.prev = { id, prev };
    saveDraws(); return true;
  } catch (e) { return false; }
}

// ---- events -------------------------------------------------------------------
const dpt = (e, svg) => { const r = svg.getBoundingClientRect(); return [Math.max(0, Math.min(200, (e.clientX - r.left) / r.width * 200)), Math.max(0, Math.min(200, (e.clientY - r.top) / r.height * 200))]; };
document.addEventListener('pointerdown', e => {
  const svg = e.target.closest && e.target.closest('#drawsvg'); if (!svg || !dm.on || !curMapId) return;
  const m = mapById[curMapId], d = dget(m.id), [x, y] = dpt(e, svg), t = dm.tool;
  const hit = e.target.closest('[data-dk]');
  if (t === 'erase') {
    if (hit) { const i = Number(hit.dataset.di); (hit.dataset.dk === 'b' ? d.b : hit.dataset.dk === 'p' ? d.p : d.s).splice(i, 1); dm.hist = []; dm.sug = []; saveDraws(); drawRefresh(m); refreshLayoutButtons(m); }
    return;
  }
  if (t === 'spawn') { if (d.p.length >= 32) { dm.note = 'That is the most spawns a map can have here (32).'; } else { d.p.push([r1(x), r1(y), dm.color]); dm.hist.push('p'); dm.sug = []; saveDraws(); } drawRefresh(m); refreshLayoutButtons(m); return; }
  if (t === 'move') { if (hit && hit.dataset.dk === 'p') { dm.drag = { p: Number(hit.dataset.di) }; svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (hit && hit.dataset.dk === 'b') { const i = Number(hit.dataset.di), b = d.b[i]; dm.drag = { i, ox: x, oy: y, b: [...b] }; svg.setPointerCapture(e.pointerId); e.preventDefault(); } return; }
  if (t === 'box' && d.b.length >= 16) { dm.note = 'That is the most start boxes a map can have here (16).'; drawRefresh(m); return; }
  dm.note = '';
  dm.cur = t === 'pen' ? { t, p: [r1(x), r1(y)] } : { t, x1: x, y1: y, x2: x, y2: y };
  svg.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  const svg = document.getElementById('drawsvg'); if (!svg || !dm.on || (!dm.cur && !dm.drag)) return;
  const m = mapById[curMapId], [x, y] = dpt(e, svg);
  if (dm.drag && dm.drag.p !== undefined) { const p = dget(m.id).p[dm.drag.p]; p[0] = r1(x); p[1] = r1(y); }
  else if (dm.drag) {
    const g = dm.drag, b = dget(m.id).b[g.i], w = g.b[2] - g.b[0], h = g.b[3] - g.b[1];
    const nx = Math.max(0, Math.min(200 - Math.abs(w), Math.min(g.b[0], g.b[2]) + x - g.ox)), ny = Math.max(0, Math.min(200 - Math.abs(h), Math.min(g.b[1], g.b[3]) + y - g.oy));
    b[0] = r1(nx); b[1] = r1(ny); b[2] = r1(nx + Math.abs(w)); b[3] = r1(ny + Math.abs(h));
  } else if (dm.cur.t === 'pen') { const p = dm.cur.p; if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) > .5) p.push(r1(x), r1(y)); }
  else { dm.cur.x2 = x; dm.cur.y2 = y; }
  svg.innerHTML = drawInner(m);
});
document.addEventListener('pointerup', () => {
  if (!dm.on || (!dm.cur && !dm.drag)) return;
  const m = mapById[curMapId], d = dget(m.id), c = dm.cur;
  if (dm.drag) { dm.drag = null; dm.hist = []; saveDraws(); }
  else if (c) {
    dm.cur = null;
    if (c.t === 'box') { if (Math.abs(c.x2 - c.x1) > 3 && Math.abs(c.y2 - c.y1) > 3) { d.b.push([r1(Math.min(c.x1, c.x2)), r1(Math.min(c.y1, c.y2)), r1(Math.max(c.x1, c.x2)), r1(Math.max(c.y1, c.y2))]); dm.hist.push('b'); } }
    else if (c.t === 'arrow') { if (Math.hypot(c.x2 - c.x1, c.y2 - c.y1) > 3) { d.s.push({ c: dm.color, a: [c.x1, c.y1, c.x2, c.y2].map(r1) }); dm.hist.push('s'); } }
    else if (c.p.length >= 4) { d.s.push({ c: dm.color, p: simplify(c.p, .35) }); dm.hist.push('s'); }
    saveDraws();
  }
  drawRefresh(m);
  refreshLayoutButtons(m);
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-dt],[data-dtool],[data-dcol]'); if (!t || !curMapId) return;
  const m = mapById[curMapId]; if (!m) return;
  if (t.dataset.dtool) { dm.tool = t.dataset.dtool; dm.note = ''; return drawRefresh(m); }
  if (t.dataset.dcol) { dm.color = Number(t.dataset.dcol); return drawRefresh(m); }
  const a = t.dataset.dt, d = dget(m.id);
  if (a === 'toggle') { dm.on = !dm.on; dm.cur = dm.drag = null; dm.note = ''; const s = document.getElementById('drawsvg'); if (s) s.classList.toggle('edit', dm.on); return drawRefresh(m); }
  if (a === 'undo') { const k = dm.hist.pop(); if (k === 'b') d.b.pop(); else if (k === 's') d.s.pop(); else if (k === 'p') d.p.pop(); else if (k && k.sug) { d.p = k.sug; dm.sug = []; } saveDraws(); drawRefresh(m); return refreshLayoutButtons(m); }
  if (a === 'restore' && dm.prev) { draws[m.id] = JSON.parse(dm.prev.prev); dm.prev = null; dm.note = 'Restored your drawing.'; saveDraws(); showMap(m.id, mapLayout); return; }
  if (a === 'clearp') { dm.hist.push({ sug: d.p }); d.p = []; dm.sug = []; saveDraws(); drawRefresh(m); return refreshLayoutButtons(m); }
  if (a === 'suggest') { suggestSpawns(m); return; }
  if (a === 'clear') { draws[m.id] = { b: [], s: [], p: [] }; dm.hist = []; dm.sug = []; saveDraws(); drawRefresh(m); return refreshLayoutButtons(m); }
  if (a === 'copy') {
    const link = pageBase() + '#map/' + encodeURIComponent(m.id) + '/' + drawCode(m.id);
    copyText(link, t).then(() => { if (link.length > 6000) { dm.note = 'This link is very long. Chat apps may cut it off: use fewer or shorter lines.'; } });
  }
});
// the layout buttons list the custom boxes, so rebuild the map page when they appear or disappear
let dLastBoxes = -1;
function refreshLayoutButtons(m) {
  const dd = dget(m.id), n = dd.b.length + ':' + dd.p.length;
  if (n === dLastBoxes) return; dLastBoxes = n;
  if (typeof mapLayout !== 'undefined') showMap(m.id, mapLayout);
}

// ---- suggest good spawns --------------------------------------------------------
// Only metal is known, so "good" means: plenty of metal spots close by, and (for several players) spread out.
// Terrain, heights and water are not in the data, so check each suggestion by eye.
const SUG_R = 900;                                           // metal within this many map units counts
function suggestSpawns(m) {
  const sp = spotsOf(m.id); if (!sp) return;
  const W = m.w * 512, H = m.h * 512, mult = sp.mx || 1, diag = Math.hypot(W, H);
  const spots = sp.s.map(s => ({ x: s[0] / 200 * W, y: s[1] / 200 * H, v: s[2] * mult }));
  const score = (x, y) => { let a = 0, n = 0; for (const s of spots) { const d = Math.hypot(s.x - x, s.y - y); if (d < SUG_R) { a += s.v * (1 - d / SUG_R); n++; } } return [a, n]; };
  const cands = [];
  for (let gx = 8; gx <= 192; gx += 4) for (let gy = 8; gy <= 192; gy += 4) { const [sc, n] = score(gx / 200 * W, gy / 200 * H); cands.push({ gx, gy, sc, n }); }
  const lay = layoutsOf(m)[mapLayout], boxes = lay && lay.kind === 'box' ? lay.b.b.map(b => boxPts(b)) : null;
  let chosen = [];
  if (boxes) {                                                // one per start area: the best metal inside each
    boxes.forEach(pts => { const inside = cands.filter(c => inPoly(c.gx, c.gy, pts)); if (inside.length) chosen.push(inside.reduce((a, b) => b.sc > a.sc ? b : a)); });
  } else {
    const n = Math.max(1, dm.sn), pool = cands.filter(c => c.sc > 0), D0 = .5 * diag / Math.sqrt(n);
    if (pool.length) chosen.push(pool.reduce((a, b) => b.sc > a.sc ? b : a));
    while (chosen.length < n && pool.length) {
      let best = null, bs = -1;
      for (const c of pool) {
        const dmin = Math.min(...chosen.map(o => Math.hypot((c.gx - o.gx) / 200 * W, (c.gy - o.gy) / 200 * H)));
        const s = c.sc * Math.min(1, dmin / D0); if (s > bs) { bs = s; best = c; }
      }
      if (!best || bs <= 0) break; chosen.push(best);
    }
  }
  if (!chosen.length) { dm.note = 'No good spot found: this map has no metal near the places a spawn could go.'; return drawRefresh(m); }
  const d = dget(m.id);
  dm.hist.push({ sug: d.p });
  d.p = chosen.map((c, i) => [c.gx, c.gy, boxes ? i % DCOL.length : (chosen.length === 2 ? i : i % DCOL.length)]);
  dm.sug = chosen.map(c => `${c.n} metal spots within reach, worth ${r1(c.sc)} metal/s`);
  dm.note = boxes ? 'One spawn in each start area of the layout you have open.' : `${chosen.length} spawns, spread across the map.`;
  saveDraws(); drawRefresh(m); refreshLayoutButtons(m);
}
document.addEventListener('change', e => { if (e.target.id === 'dsn') dm.sn = Number(e.target.value); });
loadDraws();
