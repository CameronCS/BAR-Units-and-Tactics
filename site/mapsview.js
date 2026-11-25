// Maps: gallery of certified official maps + detail panel with spawn points / start boxes drawn on the preview.
const MAPS = window.MAPS, mapById = Object.fromEntries(MAPS.map(m => [m.id, m]));
const POOLN = {
  popular2p: 'Popular 1v1', competitive2p: 'Competitive 1v1', tourney2p: 'Tournament 1v1', apprentice2p: 'Beginner 1v1', fightnight2p: 'Fight night 1v1',
  tourney6p: 'Tournament 3v3', popular8p: 'Popular 4v4', popular16p: 'Popular 8v8', land16p: 'Land 8v8', lanemaps16p: 'Lane maps 8v8', WaterMapPool: 'Water maps'
};
const POOL_ORDER = ['popular2p', 'competitive2p', 'tourney2p', 'apprentice2p', 'fightnight2p', 'tourney6p', 'popular8p', 'popular16p', 'land16p', 'lanemaps16p', 'WaterMapPool'];
const TEAMCOL = ['#4da3ff', '#ff5a3c', '#3fd8b0', '#f0b43c', '#c77dff', '#ff7eb6', '#a3e635', '#22d3ee'];
const MODES = [['1v1', '1v1'], ['2v2', '2v2'], ['3v3', '3v3'], ['4v4', '4v4'], ['8v8', '8v8'], ['ffa', 'Free for all']];
const mstate = { q: '', mode: '', pool: '', sort: 'curated', water: false };
// "Curated" score: how many of BAR's hand-picked pools the map sits in (the unofficial test lists don't count)
const curated = m => m.ls.filter(l => POOLN[l]).length;

function mapList() {
  const q = mstate.q.trim().toLowerCase();
  const l = MAPS.filter(m => (!mstate.mode || m.tg.includes(mstate.mode)) && (!mstate.pool || m.ls.includes(mstate.pool)) &&
    (!mstate.water || m.tr.includes('water') || m.tr.includes('sea') || m.tr.includes('island')) &&
    (!q || (m.n + ' ' + m.a + ' ' + m.d + ' ' + m.tr.join(' ')).toLowerCase().includes(q)));
  const s = mstate.sort;
  l.sort((a, b) => s === 'name' ? a.n.localeCompare(b.n) : s === 'players' ? b.p[1] - a.p[1] || a.n.localeCompare(b.n) :
    s === 'size' ? b.w * b.h - a.w * a.h : curated(b) - curated(a) || a.n.localeCompare(b.n));
  return l;
}
const players = m => m.p[0] === m.p[1] ? `${m.p[0]}` : `${m.p[0]} to ${m.p[1]}`;

function mapCard(m) {
  const pools = m.ls.filter(l => POOLN[l]).sort((a, b) => POOL_ORDER.indexOf(a) - POOL_ORDER.indexOf(b)).slice(0, 2);
  return `<div class="mcard" tabindex="0" role="button" data-mid="${m.id}">
    <div class="mthumb" style="aspect-ratio:${m.w}/${m.h}"><img loading="lazy" src="${m.img || ''}" alt="" onerror="this.style.visibility='hidden'"></div>
    <div class="mbody"><h3>${m.n}</h3>
      <div class="mmeta"><span>${players(m)} players</span><span>${m.w} x ${m.h}</span></div>
      <div class="mtags">${pools.map(p => `<span class="pool">${POOLN[p]}</span>`).join('')}${m.tr.slice(0, 3).map(t => `<span>${t}</span>`).join('')}</div></div></div>`;
}
function updateMapList() {
  const l = mapList();
  $('#mcount').textContent = `${l.length} ${l.length === 1 ? 'map' : 'maps'}`;
  $('#mlist').innerHTML = l.length ? l.map(mapCard).join('') : '<p class="empty">No maps match. Clear the search or a filter.</p>';
}
function renderMaps() {
  const poolsPresent = POOL_ORDER.filter(p => MAPS.some(m => m.ls.includes(p)));
  $('#grid').innerHTML = `
    <div class="mhead"><h2 class="gh">Maps</h2>
      <p class="gb">Official, certified BAR maps. Pick a map to see where each team spawns and which spawn is meant for frontline, tech, air or sea play.</p></div>
    <div class="mctl">
      <div class="sw2"><input id="mq" type="search" placeholder="Search maps" aria-label="Search maps" value="${mstate.q.replace(/"/g, '&quot;')}"></div>
      <div class="seg2" id="mmodes">${MODES.map(([v, t]) => `<button data-mm="${v}" aria-pressed="${mstate.mode === v}">${t}</button>`).join('')}<button data-mw="1" aria-pressed="${mstate.water}">Water</button></div>
      <select id="mpool" aria-label="Map pool"><option value="">All maps</option>${poolsPresent.map(p => `<option value="${p}"${mstate.pool === p ? ' selected' : ''}>${POOLN[p]}</option>`).join('')}</select>
      <select id="msort" aria-label="Sort maps">${[['curated', 'Most curated first'], ['name', 'Name'], ['players', 'Most players'], ['size', 'Largest']].map(([v, t]) => `<option value="${v}"${mstate.sort === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <span id="mcount" class="mcount"></span>
    </div>
    <div id="mlist" class="mgrid"></div>
    <p class="gsrc">Map data from the <a target="_blank" rel="noopener" href="https://maps-metadata.beyondallreason.dev/latest/lobby_maps.validated.json">BAR maps metadata</a>, certified maps only. Preview images load from the BAR maps server, so you need to be online to see them. "Most curated" counts how many of BAR's hand-picked pools a map is in.</p>`;
  updateMapList();
}

// ---- detail panel ---------------------------------------------------------
let mapLayout = 0;
function layoutsOf(m) {
  const L = [];
  (m.sp && m.sp.tm || []).forEach(t => L.push({ kind: 'pos', label: `${t.n} per team, exact spawns` + (t.s.length > 2 ? ` (${t.s.length} teams)` : ''), t }));
  (m.bx || []).forEach(b => L.push({ kind: 'box', label: `${b.b.length} start areas, up to ${b.m} each`, b }));
  if (typeof customLayout === 'function') customLayout(m).forEach(l => L.push(l));   // start boxes and spawns you drew (mapdraw.js)
  return L;
}
function overlaySVG(m, lay) {
  const W = m.w * 512, H = m.h * 512, k = Math.max(W, H);
  const r = k * 0.016, fs = k * 0.019;
  let g = '';
  if (lay.kind === 'box') {
    lay.b.b.forEach((poly, i) => {
      const c = TEAMCOL[i % TEAMCOL.length];
      const pts = poly.length === 2 ? [[poly[0][0], poly[0][1]], [poly[1][0], poly[0][1]], [poly[1][0], poly[1][1]], [poly[0][0], poly[1][1]]] : poly;
      const sc = pts.map(([x, y]) => [x / 200 * W, y / 200 * H]);
      const cx = sc.reduce((a, p) => a + p[0], 0) / sc.length, cy = sc.reduce((a, p) => a + p[1], 0) / sc.length;
      g += `<polygon points="${sc.map(p => p.join(',')).join(' ')}" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="${k * 0.004}"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${fs * 2}" font-weight="800" fill="#fff" stroke="#000" stroke-width="${k * 0.003}" paint-order="stroke">${String.fromCharCode(65 + i)}</text>`;
    });
  } else {
    lay.t.s.forEach((side, i) => {
      const c = TEAMCOL[i % TEAMCOL.length];
      side.forEach(([sp, role], j) => {
        const p = m.sp.pos[sp]; if (!p) return;
        const [x, y] = p, ro = role || '';
        let shape;
        if (ro.includes('sea')) shape = `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${r * .45}"/>`;
        else if (ro.includes('air')) shape = `<polygon points="${x},${y - r * 1.2} ${x + r * 1.2},${y} ${x},${y + r * 1.2} ${x - r * 1.2},${y}" fill="${c}" stroke="#000" stroke-width="${r * .15}"/>`;
        else if (ro.includes('tech')) shape = `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="${c}" stroke="#000" stroke-width="${r * .15}"/>`;
        else shape = `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#000" stroke-width="${r * .15}"/>`;
        g += `<g><title>Team ${i + 1}, spawn ${j + 1}${ro ? ': ' + ro : ''}</title>${shape}<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="800" fill="#06101a">${j + 1}</text></g>`;
      });
    });
  }
  return `<svg class="ovl" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Spawn layout">${g}</svg>`;
}
function roleSummary(lay) {
  if (lay.kind !== 'pos') return '<p class="note">Start areas show where each team may place its starting units. Players choose a spot inside their area, so there are no fixed spawn roles.</p>';
  const rows = lay.t.s.map((side, i) => {
    const cnt = {}; side.forEach(([, ro]) => { const k = ro || 'front'; cnt[k] = (cnt[k] || 0) + 1; });
    return `<div class="rsum"><span class="sw" style="background:${TEAMCOL[i % TEAMCOL.length]}"></span><b>Team ${i + 1}</b> ${Object.entries(cnt).map(([k, n]) => `${n} ${k}`).join(', ')}</div>`;
  }).join('');
  return rows + `<p class="note">Circle: frontline. Square: tech. Diamond: air. Ring: sea. The map's author chooses these roles. A "front/tech" spawn is a frontline spot that suits a tech player. See the Team guides for what each role does.</p>`;
}
const spotsOf = id => (window.MAPSPOTS || {})[id];
function spotsSVG(m) {
  const sp = spotsOf(m.id); if (!sp) return '';
  const W = m.w * 512, H = m.h * 512, k = Math.max(W, H), mult = sp.mx || 1;
  return `<svg class="ovl spots" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Metal spots">${sp.s.map(([x, y, raw]) => {
    const v = Math.round(raw * mult * 100) / 100, r = k * (.004 + Math.sqrt(Math.max(v, 0)) * .0032);
    return `<g><title>Metal spot worth ${v} metal/s with a basic extractor</title><circle class="mspot" cx="${x / 200 * W}" cy="${y / 200 * H}" r="${r}" stroke-width="${k * .0016}"/></g>`;
  }).join('')}</svg>`;
}
function showMap(id, li) {
  const m = mapById[id]; if (!m) return;
  mapLayout = li || 0; { const dd = dget(id); dLastBoxes = dd.b.length + ':' + dd.p.length; }
  const lays = layoutsOf(m), lay = lays[mapLayout] || lays[0];
  const pools = POOL_ORDER.filter(p => m.ls.includes(p)).map(p => `<span class="pool">${POOLN[p]}</span>`).join('');
  const fact = (k, v) => v == null || v === '' ? '' : `<div><i>${k}</i><b>${v}</b></div>`;
  const wind = m.wd[0] == null ? null : `${m.wd[0]} to ${m.wd[2]} (average ${m.wd[1]})`;
  $('#dbody').innerHTML = `<div class="mv">
    <div class="uvtop"><span></span><button class="xb" id="xb" aria-label="Close">×</button></div>
    <h2 class="mh">${m.n}</h2>
    <p class="mby">by ${m.a || 'unknown'} · ${players(m)} players · ${m.w} x ${m.h}</p>
    <div class="mtags big">${pools}${m.tg.filter(t => t !== 'pve').map(t => `<span>${t}</span>`).join('')}</div>
    ${lays.length > 1 ? `<div class="seg2 lays">${lays.map((l, i) => `<button data-ml="${i}" aria-pressed="${l === lay}">${l.label}</button>`).join('')}</div>` : (lay ? `<p class="note">Layout: ${lay.label}</p>` : '')}
    ${drawBar(m)}
    <div class="mapbox" style="aspect-ratio:${m.w}/${m.h}"><img src="${m.img || ''}" alt="Preview of ${m.n}" onerror="this.style.visibility='hidden'">${lay && !lay.custom ? overlaySVG(m, lay) : ''}${spotsSVG(m)}${drawSVG(m)}</div>
    ${spotsOf(m.id) ? `<label class="vsrg"><input type="checkbox" id="mspots" checked> Show metal spots (${spotsOf(m.id).s.length})</label>` : '<p class="note">Metal spots are not imported for this map. Run <code>python tools/map_spots.py "' + m.n + '"</code> to add them.</p>'}
    ${lay && !lay.custom ? `<div class="spawns">${roleSummary(lay)}</div>` : ''}
    <div class="facts">${fact('Players', players(m))}${fact('Map size', m.w + ' x ' + m.h)}${fact('Wind', wind)}${fact('Tidal strength', m.td)}${fact('Metal spots', spotsOf(m.id) ? spotsOf(m.id).s.length : null)}${fact('Terrain', m.tr.join(', '))}</div>
    ${m.d ? `<h3 class="cap">About this map</h3><p class="blurb">${m.d.replace(/\n+/g, '</p><p class="blurb">')}</p>` : ''}
    <div class="ext">${m.dl ? `<a href="${m.dl}">Download the map file</a>` : ''}<button class="vsswap" data-planmap="${m.id.replace(/"/g, '&quot;')}">Plan a build order on this map</button></div>
  </div>`;
  $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  $('#xb').focus({ preventScroll: true });
}
function openMap(id) { lastFocus = document.activeElement; hist = []; curMapId = id; showMap(id, 0); $('#drawer').scrollTo(0, 0); pushHash('#map/' + encodeURIComponent(id)); }

// ---- events (delegated; only act while the Maps view is showing) ----------
document.addEventListener('click', e => {
  if (e.target.closest('#dbody') && e.target.closest('[data-ml]')) { return showMap(curMapId, Number(e.target.closest('[data-ml]').dataset.ml)); }
  if (state.view !== 'maps') return;
  const mm = e.target.closest('[data-mm]'), mw = e.target.closest('[data-mw]'), card = e.target.closest('.mcard');
  if (mm) { mstate.mode = mstate.mode === mm.dataset.mm ? '' : mm.dataset.mm; renderMaps(); return; }
  if (mw) { mstate.water = !mstate.water; renderMaps(); return; }
  if (card) { curMapId = card.dataset.mid; openMap(curMapId); }
});
let curMapId = null;
document.addEventListener('input', e => { if (e.target.id === 'mq') { mstate.q = e.target.value; updateMapList(); } });
document.addEventListener('change', e => {
  if (e.target.id === 'mpool') { mstate.pool = e.target.value; updateMapList(); }
  if (e.target.id === 'msort') { mstate.sort = e.target.value; updateMapList(); }
});
document.addEventListener('keydown', e => {
  if (state.view === 'maps' && (e.key === 'Enter' || e.key === ' ')) { const c = e.target.closest && e.target.closest('.mcard'); if (c) { e.preventDefault(); curMapId = c.dataset.mid; openMap(curMapId); } }
});

document.addEventListener('change', e => { if (e.target.id === 'mspots') { const o = document.querySelector('.ovl.spots'); if (o) o.style.display = e.target.checked ? '' : 'none'; } });
