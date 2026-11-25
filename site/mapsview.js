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

// ---- list ---------------------------------------------------------------------
let mapPage = null, mapTab = 'overview', mapScroll = 0, mapShowSpots = true, mapShowLay = true;
try { mstate.view = localStorage.getItem('barMapView') === 'list' ? 'list' : 'grid'; } catch (e) { mstate.view = 'grid'; }
const escA = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function mapCard(m) {
  const pool = m.ls.filter(l => POOLN[l]).sort((a, b) => POOL_ORDER.indexOf(a) - POOL_ORDER.indexOf(b))[0], sp = spotsOf(m.id);
  return `<div class="mcard" tabindex="0" role="button" data-mid="${escA(m.id)}" aria-label="${escA(m.n)}">
    <div class="mthumb"><img loading="lazy" src="${escA(m.img || '')}" alt="" onerror="this.style.visibility='hidden'"><span class="mpl">${players(m)} players</span></div>
    <div class="mbody"><h3 title="${escA(m.n)}">${m.n}</h3>
      <div class="mmeta"><span class="pc">${players(m)} players</span><span>${m.w} x ${m.h}</span>${sp ? `<span>${sp.s.length} metal spots</span>` : ''}</div>
      <div class="mtags">${pool ? `<span class="pool">${POOLN[pool]}</span>` : ''}${m.tr.slice(0, 2).map(t => `<span>${t}</span>`).join('')}</div></div></div>`;
}
function updateMapList() {
  const l = mapList();
  $('#mcount').textContent = `${l.length} ${l.length === 1 ? 'map' : 'maps'}`;
  $('#mlist').innerHTML = l.length ? l.map(mapCard).join('') : '<p class="empty">No maps match. Clear the search or a filter.</p>';
}
function renderMapList() {
  const poolsPresent = POOL_ORDER.filter(p => MAPS.some(m => m.ls.includes(p)));
  $('#grid').innerHTML = `
    <div class="mhead"><h2 class="gh">Maps</h2>
      <p class="gb">Official, certified BAR maps. Open one to see its spawns and metal spots on the map, and a quick read on energy and metal.</p></div>
    <div class="mctl">
      <div class="sw2"><input id="mq" type="search" placeholder="Search maps" aria-label="Search maps" value="${escA(mstate.q)}"></div>
      <div class="seg2" id="mmodes">${MODES.map(([v, t]) => `<button data-mm="${v}" aria-pressed="${mstate.mode === v}">${t}</button>`).join('')}<button data-mw="1" aria-pressed="${mstate.water}">Water</button></div>
      <select id="mpool" aria-label="Map pool"><option value="">All maps</option>${poolsPresent.map(p => `<option value="${p}"${mstate.pool === p ? ' selected' : ''}>${POOLN[p]}</option>`).join('')}</select>
      <select id="msort" aria-label="Sort maps">${[['curated', 'Most curated first'], ['name', 'Name'], ['players', 'Most players'], ['size', 'Largest']].map(([v, t]) => `<option value="${v}"${mstate.sort === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <div class="seg2" id="mview" aria-label="Layout"><button data-mv="grid" aria-pressed="${mstate.view === 'grid'}">Grid</button><button data-mv="list" aria-pressed="${mstate.view === 'list'}">List</button></div>
      <span id="mcount" class="mcount"></span>
    </div>
    <div id="mlist" class="mgrid${mstate.view === 'list' ? ' list' : ''}"></div>
    <p class="gsrc">Map data from the <a target="_blank" rel="noopener" href="https://maps-metadata.beyondallreason.dev/latest/lobby_maps.validated.json">BAR maps metadata</a>, certified maps only. Preview images load from the BAR maps server, so they need a connection.</p>`;
  updateMapList();
  if (mapScroll) { window.scrollTo(0, mapScroll); mapScroll = 0; }
}
function renderMaps() { if (mapPage && mapById[mapPage]) showMap(mapPage, mapLayout); else { mapPage = null; renderMapList(); } }

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
  return `<svg class="ovl lay" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Spawn layout">${g}</svg>`;
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
// ---- one map: a page with the map on the left and tabs on the right -----------------
const mapMetal = m => {
  const sp = spotsOf(m.id); if (!sp) return null;
  const mult = sp.mx || 1, v = sp.s.map(s => s[2] * mult), sum = v.reduce((a, b) => a + b, 0);
  return { n: v.length, avg: v.length ? Math.round(sum / v.length * 100) / 100 : 0, max: v.length ? Math.round(Math.max(...v) * 100) / 100 : 0, total: Math.round(sum * 10) / 10 };
};
function mapLegend(m, lay) {
  const dot = c => `<i class="ldot" style="background:${c}"></i>`;
  let h = '';
  if (lay && lay.kind === 'pos') h += `<span>${lay.t.s.map((_, i) => dot(TEAMCOL[i % TEAMCOL.length]) + 'Team ' + (i + 1)).join(' ')}</span><span>● frontline &nbsp;■ tech &nbsp;◆ air &nbsp;○ sea</span>`;
  else if (lay && lay.kind === 'box') h += '<span>Lettered boxes are the start areas a team may pick from.</span>';
  if (spotsOf(m.id)) h += `<span>${dot('#ffd24a')}Metal spot (bigger is richer)</span>`;
  return h ? `<div class="mlegend">${h}</div>` : '';
}
function mapOverview(m) {
  const mt = mapMetal(m), [lo, avg, hi] = m.wd || [];
  const wind = avg == null ? null : `${lo} to ${hi} (average ${avg})`;
  const fact = (k, v) => v == null || v === '' ? '' : `<div><i>${k}</i><b>${v}</b></div>`;
  const energy = typeof briefEnergy === 'function' ? briefEnergy(m) : '';
  const metal = mt ? `${mt.n} metal spots, <b>${mt.avg}</b> metal/s on average with a basic extractor (richest ${mt.max}), ${mt.total} metal/s in total.` : 'Metal spots are not imported for this map.';
  const modes = m.tg.filter(t => t !== 'pve');
  return `<div class="mq"><div><b class="k">Energy</b>${energy}</div><div><b class="k">Metal</b>${metal}</div>${modes.length ? `<div><b class="k">Good for</b>${modes.join(', ')}</div>` : ''}</div>
    <div class="facts">${fact('Players', players(m))}${fact('Map size', m.w + ' x ' + m.h)}${fact('Wind', wind)}${fact('Tidal strength', m.td)}${fact('Metal spots', mt ? mt.n : null)}${fact('Terrain', m.tr.join(', '))}</div>
    ${m.d ? `<h3 class="cap">About this map</h3><p class="blurb">${m.d.replace(/\n+/g, '</p><p class="blurb">')}</p>` : ''}
    <div class="arow"><button class="vsswap" data-mbrief="1">Open the briefing</button><button class="vsswap" data-mroles="1">Plan the team</button>${m.dl ? `<a class="vsswap dl" href="${escA(m.dl)}">Download the map file</a>` : ''}</div>`;
}
function mapSpawns(m, lays, lay) {
  const mt = mapMetal(m);
  const layPick = lays.length > 1 ? `<select id="mlayout" aria-label="Spawn layout">${lays.map((l, i) => `<option value="${i}"${i === mapLayout ? ' selected' : ''}>${l.label}</option>`).join('')}</select>` : `<p>${lay ? lay.label : 'No spawn data for this map.'}</p>`;
  return `<h3 class="cap">Layout</h3>${layPick}
    <div class="mtogs"><label><input type="checkbox" id="mlay"${mapShowLay ? ' checked' : ''}> Show spawns and start areas</label>${mt ? `<label><input type="checkbox" id="mspots"${mapShowSpots ? ' checked' : ''}> Show metal spots (${mt.n})</label>` : ''}</div>
    ${lay && !lay.custom ? `<h3 class="cap">Who spawns where</h3><div class="spawns">${roleSummary(lay)}</div>` : lay && lay.custom ? '<p class="note">This layout is your own drawing. Edit it on the Draw tab.</p>' : ''}
    <h3 class="cap">Metal</h3>${mt ? `<p>${mt.n} spots, worth ${mt.total} metal/s in total with basic extractors. Pick a start position in the <a href="#brief/${encodeURIComponent(m.id)}">briefing</a> to see the spots around it.</p>` : `<p class="note">Metal spots are not imported for this map. Run <code>python tools/map_spots.py "${escA(m.n)}"</code> to add them.</p>`}`;
}
function mapDraw(m) {
  return `<p class="note" style="margin-top:0">Draw start boxes, spawn markers, lines and arrows straight on the map. They are saved in this browser and can be shared as a link, and your start boxes and spawns show up as layouts here and in the planner.</p>${drawBar(m)}`;
}
function showMap(id, li) {
  const m = mapById[id]; if (!m || state.view !== 'maps') return;
  const y = window.scrollY, same = mapPage === id;
  mapPage = id; curMapId = id; mapLayout = li || 0; { const dd = dget(id); dLastBoxes = dd.b.length + ':' + dd.p.length; }
  const lays = layoutsOf(m); if (mapLayout >= lays.length) mapLayout = 0;
  const lay = lays[mapLayout] || lays[0];
  const pools = POOL_ORDER.filter(p => m.ls.includes(p)).map(p => `<span class="pool">${POOLN[p]}</span>`).join('');
  const tabs = [['overview', 'Overview'], ['spawns', 'Spawns and metal'], ['draw', 'Draw']];
  const panel = mapTab === 'spawns' ? mapSpawns(m, lays, lay) : mapTab === 'draw' ? mapDraw(m) : mapOverview(m);
  $('#grid').innerHTML = `<div class="mv mpage">
    <div class="mtop"><button class="vsswap" data-mback="1">← All maps</button><div class="mtopr"><button class="vsswap" data-mcopy="1">Copy link</button><button class="vsswap" data-planmap="${escA(id)}">Plan a build order</button></div></div>
    <h2 class="mh">${m.n}</h2>
    <p class="mby">by ${m.a || 'unknown'} · ${players(m)} players · ${m.w} x ${m.h}</p>
    <div class="mtags big">${pools}${m.tg.filter(t => t !== 'pve').map(t => `<span>${t}</span>`).join('')}</div>
    <div class="mcols"><div class="mleft">
        <div class="mapbox${mapShowLay ? '' : ' nolay'}${mapShowSpots ? '' : ' nospots'}" style="aspect-ratio:${m.w}/${m.h};width:min(100%,calc(80vh * ${m.w / m.h}))"><img src="${escA(m.img || '')}" alt="Preview of ${escA(m.n)}" onerror="this.style.visibility='hidden'">${lay && !lay.custom ? overlaySVG(m, lay) : ''}${spotsSVG(m)}${drawSVG(m)}</div>
        ${mapLegend(m, lay)}</div>
      <div class="mright"><div class="seg2 mtabs" role="tablist" aria-label="Map sections">${tabs.map(([k, t]) => `<button role="tab" data-mtab="${k}" aria-selected="${k === mapTab}" aria-pressed="${k === mapTab}">${t}</button>`).join('')}</div>
        <div class="mpanel">${panel}</div></div></div></div>`;
  if (same) window.scrollTo(0, y);
}
function openMap(id) { if (!mapPage) mapScroll = window.scrollY; mapTab = 'overview'; dm.on = false; showMap(id, 0); window.scrollTo(0, 0); pushHash('#map/' + encodeURIComponent(id)); }
function closeMapPage() { mapPage = null; curMapId = null; dm.on = false; dm.cur = dm.drag = null; pushHash('#maps'); renderMapList(); }

// ---- events (delegated; only act while the Maps view is showing) ----------
document.addEventListener('click', e => {
  if (state.view !== 'maps') return;
  const t = e.target; let el;
  if (t.closest('[data-mback]')) return closeMapPage();
  if ((el = t.closest('[data-mtab]'))) { mapTab = el.dataset.mtab; return showMap(mapPage, mapLayout); }
  if ((el = t.closest('[data-mcopy]'))) return copyText(pageBase() + '#map/' + encodeURIComponent(mapPage), el);
  if (t.closest('[data-mbrief]')) { briefMap = mapPage; briefStart = ''; briefSave(); return setView('brief'); }
  if (t.closest('[data-mroles]')) { rolesMapId = mapPage; rolesLi = -1; rolesTeam = 0; rolesOv = {}; rolesSave(); return setView('roles'); }
  if (mapPage) return;
  const mm = t.closest('[data-mm]'), mw = t.closest('[data-mw]'), mv = t.closest('[data-mv]'), card = t.closest('.mcard');
  if (mm) { mstate.mode = mstate.mode === mm.dataset.mm ? '' : mm.dataset.mm; renderMapList(); return; }
  if (mw) { mstate.water = !mstate.water; renderMapList(); return; }
  if (mv) { mstate.view = mv.dataset.mv; try { localStorage.setItem('barMapView', mstate.view); } catch (err) {} renderMapList(); return; }
  if (card) openMap(card.dataset.mid);
});
let curMapId = null;
document.addEventListener('input', e => { if (e.target.id === 'mq') { mstate.q = e.target.value; updateMapList(); } });
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'mpool') { mstate.pool = e.target.value; updateMapList(); }
  else if (id === 'msort') { mstate.sort = e.target.value; updateMapList(); }
  else if (id === 'mlayout') showMap(mapPage, Number(e.target.value));
  else if (id === 'mlay' || id === 'mspots') {
    if (id === 'mlay') mapShowLay = e.target.checked; else mapShowSpots = e.target.checked;
    const b = document.querySelector('.mapbox'); if (b) { b.classList.toggle('nolay', !mapShowLay); b.classList.toggle('nospots', !mapShowSpots); }
  }
});
document.addEventListener('keydown', e => {
  if (state.view !== 'maps') return;
  if ((e.key === 'Enter' || e.key === ' ') && !mapPage) { const c = e.target.closest && e.target.closest('.mcard'); if (c) { e.preventDefault(); openMap(c.dataset.mid); } }
  else if (e.key === 'Escape' && mapPage && !dm.on && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) closeMapPage();
});
