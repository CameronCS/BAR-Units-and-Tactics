// Draw on a map: custom start boxes (like the BAR lobby), freehand lines and arrows. Kept in this browser per map,
// and shareable as a link. Custom start boxes also show up as a layout in the map page and as start areas in the planner.
const DRAWKEY = 'barMapDraw', DCOL = ['#ffd24a', '#ff5a3c', '#4da3ff', '#3fd8b0', '#ffffff', '#c77dff'];
const draws = {};                                    // map id -> { p: [[x,y,team colour]...] spawns, b: [[x1,y1,x2,y2]...] start boxes, s: [{ c, p: [x,y,...] } | { c, a: [x1,y1,x2,y2] }] }, coordinates 0 to 200
const dm = { on: false, tool: 'box', color: 0, cur: null, drag: null, sel: null, undo: [], redo: [], mid: null, note: '', sn: 2, sug: [], prev: null };
const DTOOLS = [
  ['move', 'Select', 'V', 'Click a box, spawn, line or arrow to select it. Drag a box or spawn to move it, drag a box corner to resize it, press Delete to remove it, or pick a colour to recolour it.'],
  ['box', 'Start box', 'B', 'Drag out a box. Each box gets the next letter and colour, like the lobby start areas.'],
  ['spawn', 'Spawn', 'S', 'Click to drop a spawn marker. Keep the button down and drag to place it exactly. The colour you pick is its team.'],
  ['pen', 'Pen', 'P', 'Draw freehand on the map.'],
  ['arrow', 'Arrow', 'A', 'Drag from where to where.'],
  ['erase', 'Erase', 'E', 'Click any box, spawn, line or arrow to remove it.']];

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
function arrowSVG(a, W, H, k, col, attrs, halo) {
  const x1 = a[0] / 200 * W, y1 = a[1] / 200 * H, x2 = a[2] / 200 * W, y2 = a[3] / 200 * H;
  const ang = Math.atan2(y2 - y1, x2 - x1), h = k * .03, sw = k * .005;
  const hd = [[x2, y2], [x2 - h * Math.cos(ang - .45), y2 - h * Math.sin(ang - .45)], [x2 - h * Math.cos(ang + .45), y2 - h * Math.sin(ang + .45)]];
  return `<g ${attrs}>${halo ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-opacity=".5" stroke-width="${sw * 3}" stroke-linecap="round" pointer-events="none"/>` : ''}<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="${h * .7}" pointer-events="stroke"/><line x1="${x1}" y1="${y1}" x2="${x2 - Math.cos(ang) * h * .6}" y2="${y2 - Math.sin(ang) * h * .6}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>
    <polygon points="${hd.map(p => p.join(',')).join(' ')}" fill="${col}" stroke="#000" stroke-width="${sw * .3}" stroke-linejoin="round"/></g>`;
}
// ---- history: every change takes a snapshot of this map's drawing first, so undo and redo cover everything
const dstate = id => JSON.stringify(dget(id));
function dsnap(id) { dm.undo.push(dstate(id)); if (dm.undo.length > 60) dm.undo.shift(); dm.redo = []; }
function dundo(m, redo) {
  const from = redo ? dm.redo : dm.undo, to = redo ? dm.undo : dm.redo; if (!from.length) return;
  to.push(dstate(m.id)); draws[m.id] = JSON.parse(from.pop()); dget(m.id); dm.sel = null; dm.sug = []; saveDraws(); drawRefresh(m); refreshLayoutButtons(m);
}
const ditems = (d, k) => k === 'b' ? d.b : k === 'p' ? d.p : d.s;
function deleteSel(m) {
  const d = dget(m.id), s = dm.sel; if (!s || !ditems(d, s.k)[s.i]) { dm.sel = null; return; }
  dsnap(m.id); ditems(d, s.k).splice(s.i, 1); dm.sel = null; dm.sug = []; saveDraws(); drawRefresh(m); refreshLayoutButtons(m);
}

function drawInner(m) {
  const d = dget(m.id), W = m.w * 512, H = m.h * 512, k = Math.max(W, H), sw = k * .005, sel = dm.on ? dm.sel : null;
  const isSel = (kind, i) => sel && sel.k === kind && sel.i === i;
  const box = (x, y, i, attrs, ghost, selected) => {
    const c = TEAMCOL[i % TEAMCOL.length], x1 = Math.min(x[0], x[2]) / 200 * W, x2 = Math.max(x[0], x[2]) / 200 * W, y1 = Math.min(x[1], x[3]) / 200 * H, y2 = Math.max(x[1], x[3]) / 200 * H;
    let h = '';
    if (selected) {
      const hs = k * .012, cs = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
      h = `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="none" stroke="#fff" stroke-width="${k * .003}" stroke-dasharray="${k * .01}" pointer-events="none"/>`
        + (dm.tool === 'move' ? cs.map(([cx, cy], n) => `<rect data-dh="${n}" x="${cx - hs}" y="${cy - hs}" width="${hs * 2}" height="${hs * 2}" fill="#fff" stroke="#000" stroke-width="${k * .002}" style="cursor:${n % 2 ? 'nesw' : 'nwse'}-resize"/>`).join('') : '');
    }
    return `<g ${attrs}><rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="${c}" fill-opacity="${ghost ? .15 : .28}" stroke="${c}" stroke-width="${k * .004}"${ghost ? ` stroke-dasharray="${k * .01}"` : ''}/>
      <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" text-anchor="middle" dominant-baseline="central" font-size="${k * .038}" font-weight="800" fill="#fff" stroke="#000" stroke-width="${k * .003}" paint-order="stroke" pointer-events="none">${String.fromCharCode(65 + i)}</text>${h}</g>`;
  };
  let g = d.b.map((b, i) => box(b, b, i, `data-dk="b" data-di="${i}"`, false, isSel('b', i))).join('');
  const r = k * .016;
  g += (d.p || []).map((p, i) => {
    const x = p[0] / 200 * W, y = p[1] / 200 * H, c = DCOL[p[2] % DCOL.length];
    return `<g data-dk="p" data-di="${i}"><title>Spawn ${i + 1}${dm.sug[i] ? ': ' + dm.sug[i] : ''}</title><circle cx="${x}" cy="${y}" r="${r * 2}" fill="transparent" pointer-events="all"/>
      ${isSel('p', i) ? `<circle cx="${x}" cy="${y}" r="${r * 1.55}" fill="none" stroke="#fff" stroke-width="${r * .2}" stroke-dasharray="${r * .5}" pointer-events="none"/>` : ''}
      <circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#000" stroke-width="${r * .15}"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${k * .019}" font-weight="800" fill="#06101a" pointer-events="none">${i + 1}</text></g>`;
  }).join('');
  d.s.forEach((s, i) => {
    const col = DCOL[s.c % DCOL.length], at = `data-dk="s" data-di="${i}"`, on = isSel('s', i);
    if (s.a) g += arrowSVG(s.a, W, H, k, col, at, on);
    else {
      const pts = []; for (let j = 0; j < s.p.length; j += 2) pts.push(`${s.p[j] / 200 * W},${s.p[j + 1] / 200 * H}`);
      g += `<g ${at}><polyline points="${pts.join(' ')}" fill="none" stroke="transparent" stroke-width="${k * .02}" pointer-events="stroke" stroke-linecap="round"/>${on ? `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="${sw * 3}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>` : ''}<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
  });
  const c = dm.cur;
  if (c) {
    if (c.t === 'box') g += box([c.x1, c.y1, c.x2, c.y2], 0, d.b.length, '', true);
    else if (c.t === 'arrow') g += arrowSVG([c.x1, c.y1, c.x2, c.y2], W, H, k, DCOL[dm.color], '');
    else if (c.t === 'pen') { const pts = []; for (let j = 0; j < c.p.length; j += 2) pts.push(`${c.p[j] / 200 * W},${c.p[j + 1] / 200 * H}`); g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${DCOL[dm.color]}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`; }
  }
  return g;
}
const drawCls = () => 'ovl draw' + (dm.on ? ' edit t-' + dm.tool : '');
function drawSVG(m) {
  const W = m.w * 512, H = m.h * 512;
  return `<svg class="${drawCls()}" id="drawsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Your drawing">${drawInner(m)}</svg>`;
}
function drawBar(m) {
  const d = dget(m.id), n = dcount(m.id), tool = DTOOLS.find(t => t[0] === dm.tool) || DTOOLS[0];
  const lays = layoutsOf(m), lay = lays[mapLayout] || lays[0], own = lay && !lay.custom;
  const counts = [d.p.length ? d.p.length + (d.p.length === 1 ? ' spawn' : ' spawns') : '', d.b.length ? d.b.length + ' start ' + (d.b.length === 1 ? 'box' : 'boxes') : '', d.s.length ? d.s.length + (d.s.length === 1 ? ' line' : ' lines') : ''].filter(Boolean).join(', ');
  const sel = dm.sel && dm.on ? ditems(d, dm.sel.k)[dm.sel.i] : null, showCol = ['spawn', 'pen', 'arrow'].includes(dm.tool) || (sel && dm.sel.k !== 'b');
  return `<div class="dbar" id="dbar"><div class="drow"><button class="vsswap dtog" data-dt="toggle" aria-pressed="${dm.on}">${dm.on ? 'Done drawing' : 'Draw on this map'}</button>
    ${n ? `<span class="dcount">${counts}</span>` : ''}${dm.on ? `<span class="dundo"><button class="vsswap" data-dt="undo" title="Undo (Ctrl+Z)"${dm.undo.length ? '' : ' disabled'}>Undo</button><button class="vsswap" data-dt="redo" title="Redo (Ctrl+Y)"${dm.redo.length ? '' : ' disabled'}>Redo</button></span>` : ''}</div>
    ${dm.on ? `<div class="drow"><div class="seg2" role="toolbar" aria-label="Drawing tools">${DTOOLS.map(([id, t, key]) => `<button data-dtool="${id}" aria-pressed="${dm.tool === id}" title="${t} (${key})">${t}<kbd>${key}</kbd></button>`).join('')}</div></div>
      <p class="note dtip">${tool[3]}${dm.tool === 'box' || dm.tool === 'spawn' || dm.tool === 'pen' || dm.tool === 'arrow' ? ' Esc cancels.' : ''}</p>
      ${showCol ? `<div class="drow"><span class="note" style="margin:0">${sel ? 'Recolour the selected item' : 'Colour'}</span><div class="dsw" aria-label="Colour">${DCOL.map((c, i) => `<button data-dcol="${i}" aria-pressed="${dm.color === i}" aria-label="Colour ${i + 1}" style="--c:${c}"></button>`).join('')}</div></div>` : ''}
      ${sel ? `<div class="drow"><span class="note" style="margin:0">Selected: ${dm.sel.k === 'b' ? 'start box ' + String.fromCharCode(65 + dm.sel.i) : dm.sel.k === 'p' ? 'spawn ' + (dm.sel.i + 1) : 'line'}</span><button class="vsswap" data-dt="delsel">Delete selected</button></div>` : ''}
      ${own ? `<div class="drow dlay"><label><input type="checkbox" id="dlay"${mapShowLay ? ' checked' : ''}> Show the map's own ${lay.kind === 'pos' ? 'spawns' : 'start areas'}</label><button class="vsswap" data-dt="importlay" title="Turns the map's own ${lay.kind === 'pos' ? 'spawns' : 'start areas'} into things you can move and delete">Copy them into my drawing to edit</button></div>` : ''}
      <div class="drow">${d.p.length ? '<button class="vsswap" data-dt="clearp">Remove all spawns</button>' : ''}<button class="vsswap" data-dt="clear"${n ? '' : ' disabled'}>Clear everything</button></div>
      ${spotsOf(m.id) ? `<div class="drow dsug"><label>Suggest <select id="dsn">${Array.from({ length: 16 }, (_, i) => `<option${i + 1 === dm.sn ? ' selected' : ''}>${i + 1}</option>`).join('')}</select> spawns</label><button class="vsswap" data-dt="suggest">Suggest good spawns</button></div>` : `<p class="note" style="margin:0">To get spawn suggestions, import this map's metal spots first: <code>python tools/map_spots.py "${m.n}"</code></p>`}` : ''}
    ${dm.sug.length && dm.on ? `<ol class="dsl">${dm.sug.map(t => `<li>${t}</li>`).join('')}</ol>` : ''}
    <div class="drow">${n ? `<button class="vsswap" data-dt="copy">Copy link to this drawing</button>` : ''}${dm.prev && dm.prev.id === m.id ? '<button class="vsswap" data-dt="restore">Undo the loaded drawing</button>' : ''}${dm.note ? `<span class="note" style="margin:0">${dm.note}</span>` : ''}</div></div>`;
}
function drawRefresh(m) {
  const s = document.getElementById('drawsvg'); if (s) { s.setAttribute('class', drawCls()); s.innerHTML = drawInner(m); }
  const b = document.getElementById('dbar'); if (b) b.outerHTML = drawBar(m);
}

// copy the map's own start areas or spawns into the drawing, so they can be moved, recoloured and deleted like anything else
function importLayout(m) {
  const lay = layoutsOf(m)[mapLayout]; if (!lay || lay.custom) return;
  const d = dget(m.id), W = m.w * 512, H = m.h * 512; let nb = 0, np = 0;
  dsnap(m.id);
  if (lay.kind === 'box') lay.b.b.forEach(poly => {
    if (d.b.length >= 16) return;
    const pts = boxPts(poly), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    d.b.push([r1(Math.min(...xs)), r1(Math.min(...ys)), r1(Math.max(...xs)), r1(Math.max(...ys))]); nb++;
  });
  else if (lay.kind === 'pos') lay.t.s.forEach((side, ti) => side.forEach(([sp]) => {
    const p = m.sp.pos[sp]; if (!p || d.p.length >= 32) return;
    d.p.push([r1(p[0] / W * 200), r1(p[1] / H * 200), ti % DCOL.length]); np++;
  }));
  dm.sel = null; dm.sug = [];
  dm.note = nb || np ? `Copied ${nb ? nb + ' start ' + (nb === 1 ? 'area' : 'areas') : np + (np === 1 ? ' spawn' : ' spawns')} into your drawing. The map's own are now hidden.` : 'Nothing to copy from this layout.';
  if (nb || np) { mapShowLay = false; const mb = document.querySelector('.mapbox'); if (mb) mb.classList.add('nolay'); } else dm.undo.pop();
  saveDraws(); drawRefresh(m); refreshLayoutButtons(m);
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
    dm.undo = []; dm.redo = []; dm.sel = null; dm.note = 'Loaded a shared drawing. It replaced yours for this map.'; dm.prev = { id, prev };
    saveDraws(); return true;
  } catch (e) { return false; }
}

// ---- events -------------------------------------------------------------------
const dpt = (e, svg) => { const r = svg.getBoundingClientRect(); return [Math.max(0, Math.min(200, (e.clientX - r.left) / r.width * 200)), Math.max(0, Math.min(200, (e.clientY - r.top) / r.height * 200))]; };
const normBox = b => { const x1 = Math.min(b[0], b[2]), x2 = Math.max(b[0], b[2]), y1 = Math.min(b[1], b[3]), y2 = Math.max(b[1], b[3]); b[0] = r1(x1); b[1] = r1(y1); b[2] = r1(x2); b[3] = r1(y2); };
document.addEventListener('pointerdown', e => {
  const svg = e.target.closest && e.target.closest('#drawsvg'); if (!svg || !dm.on || !curMapId) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const m = mapById[curMapId], d = dget(m.id), [x, y] = dpt(e, svg), t = dm.tool;
  const hit = e.target.closest('[data-dk]'), hnd = e.target.closest('[data-dh]');
  dm.note = '';
  if (t === 'erase') {
    if (hit) { dsnap(m.id); ditems(d, hit.dataset.dk).splice(Number(hit.dataset.di), 1); dm.sel = null; dm.sug = []; saveDraws(); drawRefresh(m); refreshLayoutButtons(m); }
    e.preventDefault(); return;
  }
  if (t === 'move') {
    if (hnd && dm.sel && dm.sel.k === 'b' && d.b[dm.sel.i]) { normBox(d.b[dm.sel.i]); dm.drag = { h: Number(hnd.dataset.dh), i: dm.sel.i, snap: dstate(m.id) }; svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (hit) {
      const kind = hit.dataset.dk, i = Number(hit.dataset.di); dm.sel = { k: kind, i };
      if (kind === 'p') dm.drag = { p: i, snap: dstate(m.id) };
      else if (kind === 'b') { normBox(d.b[i]); dm.drag = { i, ox: x, oy: y, b: [...d.b[i]], snap: dstate(m.id) }; }
      if (dm.drag) svg.setPointerCapture(e.pointerId);
      drawRefresh(m); e.preventDefault(); return;
    }
    if (dm.sel) { dm.sel = null; drawRefresh(m); }
    return;
  }
  if (t === 'spawn') {
    if (d.p.length >= 32) { dm.note = 'That is the most spawns a map can have here (32).'; drawRefresh(m); return; }
    dsnap(m.id); d.p.push([r1(x), r1(y), dm.color]); dm.sug = []; dm.sel = { k: 'p', i: d.p.length - 1 }; dm.drag = { p: d.p.length - 1 };
    svg.setPointerCapture(e.pointerId); drawRefresh(m); e.preventDefault(); return;
  }
  if (t === 'box' && d.b.length >= 16) { dm.note = 'That is the most start boxes a map can have here (16).'; drawRefresh(m); return; }
  dm.sel = null;
  dm.cur = t === 'pen' ? { t, p: [r1(x), r1(y)] } : { t, x1: x, y1: y, x2: x, y2: y };
  svg.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  const svg = document.getElementById('drawsvg'); if (!svg || !dm.on || (!dm.cur && !dm.drag)) return;
  const m = mapById[curMapId], [x, y] = dpt(e, svg), d = dget(m.id), g = dm.drag;
  if (g && g.p !== undefined) { const p = d.p[g.p]; if (p) { p[0] = r1(x); p[1] = r1(y); } }
  else if (g && g.h !== undefined) {
    const b = d.b[g.i]; if (!b) return;
    if (g.h === 0 || g.h === 3) b[0] = r1(x); else b[2] = r1(x);
    if (g.h === 0 || g.h === 1) b[1] = r1(y); else b[3] = r1(y);
  } else if (g) {
    const b = d.b[g.i]; if (!b) return;
    const w = g.b[2] - g.b[0], h = g.b[3] - g.b[1];
    const nx = Math.max(0, Math.min(200 - w, g.b[0] + x - g.ox)), ny = Math.max(0, Math.min(200 - h, g.b[1] + y - g.oy));
    b[0] = r1(nx); b[1] = r1(ny); b[2] = r1(nx + w); b[3] = r1(ny + h);
  } else if (dm.cur.t === 'pen') { const p = dm.cur.p; if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) > .5) p.push(r1(x), r1(y)); }
  else { dm.cur.x2 = x; dm.cur.y2 = y; }
  svg.innerHTML = drawInner(m);
});
document.addEventListener('pointerup', () => {
  if (!dm.on || (!dm.cur && !dm.drag)) return;
  const m = mapById[curMapId], d = dget(m.id), c = dm.cur, g = dm.drag;
  if (g) {
    dm.drag = null; if (g.i !== undefined && d.b[g.i]) normBox(d.b[g.i]);
    if (g.snap && g.snap !== dstate(m.id)) { dm.undo.push(g.snap); dm.redo = []; }    // only a drag that moved something counts as a change
    saveDraws();
  } else if (c) {
    dm.cur = null;
    if (c.t === 'box') { if (Math.abs(c.x2 - c.x1) > 3 && Math.abs(c.y2 - c.y1) > 3) { dsnap(m.id); d.b.push([r1(Math.min(c.x1, c.x2)), r1(Math.min(c.y1, c.y2)), r1(Math.max(c.x1, c.x2)), r1(Math.max(c.y1, c.y2))]); } }
    else if (c.t === 'arrow') { if (Math.hypot(c.x2 - c.x1, c.y2 - c.y1) > 3) { dsnap(m.id); d.s.push({ c: dm.color, a: [c.x1, c.y1, c.x2, c.y2].map(r1) }); } }
    else if (c.p.length >= 4) { dsnap(m.id); d.s.push({ c: dm.color, p: simplify(c.p, .35) }); }
    saveDraws();
  }
  drawRefresh(m);
  refreshLayoutButtons(m);
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-dt],[data-dtool],[data-dcol]'); if (!t || !curMapId) return;
  const m = mapById[curMapId]; if (!m) return;
  const d = dget(m.id);
  if (t.dataset.dtool) { dm.tool = t.dataset.dtool; dm.note = ''; if (dm.tool !== 'move') dm.sel = null; return drawRefresh(m); }
  if (t.dataset.dcol) {
    dm.color = Number(t.dataset.dcol); const s = dm.sel;
    if (s && s.k !== 'b' && ditems(d, s.k)[s.i]) { dsnap(m.id); const it = ditems(d, s.k)[s.i]; if (s.k === 'p') it[2] = dm.color; else it.c = dm.color; saveDraws(); }
    return drawRefresh(m);
  }
  const a = t.dataset.dt;
  if (a === 'toggle') {
    dm.on = !dm.on; dm.cur = dm.drag = null; dm.note = '';
    if (dm.mid !== m.id) { dm.mid = m.id; dm.undo = []; dm.redo = []; dm.sel = null; dm.sug = []; }
    return drawRefresh(m);
  }
  if (a === 'undo') return dundo(m, false);
  if (a === 'redo') return dundo(m, true);
  if (a === 'delsel') return deleteSel(m);
  if (a === 'importlay') return importLayout(m);
  if (a === 'restore' && dm.prev) { draws[m.id] = JSON.parse(dm.prev.prev); dm.prev = null; dm.note = 'Restored your drawing.'; dm.undo = []; dm.redo = []; saveDraws(); drawRefresh(m); return refreshLayoutButtons(m); }
  if (a === 'clearp') { dsnap(m.id); d.p = []; dm.sel = null; dm.sug = []; saveDraws(); drawRefresh(m); return refreshLayoutButtons(m); }
  if (a === 'suggest') { suggestSpawns(m); return; }
  if (a === 'clear') { dsnap(m.id); draws[m.id] = { b: [], s: [], p: [] }; dm.sel = null; dm.sug = []; saveDraws(); drawRefresh(m); return refreshLayoutButtons(m); }
  if (a === 'copy') {
    const link = pageBase() + '#map/' + encodeURIComponent(m.id) + '/' + drawCode(m.id);
    copyText(link, t).then(() => { if (link.length > 6000) { dm.note = 'This link is very long. Chat apps may cut it off: use fewer or shorter lines.'; } });
  }
});
document.addEventListener('change', e => {
  if (e.target.id !== 'dlay') return;
  mapShowLay = e.target.checked; const mb = document.querySelector('.mapbox'); if (mb) mb.classList.toggle('nolay', !mapShowLay);
});
// keyboard while drawing: Delete removes the selected item, Ctrl+Z / Ctrl+Y undo and redo, Esc cancels, one letter picks a tool
document.addEventListener('keydown', e => {
  if (state.view !== 'maps' || !mapPage || !dm.on || !curMapId) return;
  if (/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
  const m = mapById[curMapId]; if (!m) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) { e.preventDefault(); return dundo(m, k === 'y' || e.shiftKey); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ((k === 'delete' || k === 'backspace') && dm.sel) { e.preventDefault(); return deleteSel(m); }
  if (k === 'escape') { if (dm.cur || dm.drag || dm.sel) { dm.cur = null; dm.drag = null; dm.sel = null; e.stopPropagation(); drawRefresh(m); } return; }
  const tool = DTOOLS.find(x => x[2].toLowerCase() === k);
  if (tool) { dm.tool = tool[0]; if (dm.tool !== 'move') dm.sel = null; drawRefresh(m); }
});
// the Spawns tab lists the custom layouts, so rebuild it when drawn boxes or spawns appear or disappear (the Draw tab updates in place)
let dLastBoxes = -1;
function refreshLayoutButtons(m) {
  const dd = dget(m.id), n = dd.b.length + ':' + dd.p.length;
  if (n === dLastBoxes) return; dLastBoxes = n;
  if (mapTab === 'spawns') showMap(m.id, mapLayout);
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
  dsnap(m.id);
  d.p = chosen.map((c, i) => [c.gx, c.gy, boxes ? i % DCOL.length : (chosen.length === 2 ? i : i % DCOL.length)]);
  dm.sug = chosen.map(c => `${c.n} metal spots within reach, worth ${r1(c.sc)} metal/s`);
  dm.note = boxes ? 'One spawn in each start area of the layout you have open.' : `${chosen.length} spawns, spread across the map.`;
  saveDraws(); drawRefresh(m); refreshLayoutButtons(m);
}
document.addEventListener('change', e => { if (e.target.id === 'dsn') dm.sn = Number(e.target.value); });
loadDraws();
