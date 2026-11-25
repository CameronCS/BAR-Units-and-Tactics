// Map briefing: one summary per map for your start position. Metal spots, wind or solar, spawn roles, and a suggested opener.
let briefMap = null, briefStart = '', briefFac = 'Armada';
function briefLoad() {
  try {
    const s = JSON.parse(localStorage.getItem('barBrief') || 'null');
    if (s) { if (MAPS.some(m => m.id === s.m)) briefMap = s.m; briefStart = typeof s.s === 'string' ? s.s : ''; if (FACS.includes(s.f)) briefFac = s.f; }
  } catch (e) {}
  if (!briefMap) { const withSpots = MAPS.find(m => window.MAPSPOTS && window.MAPSPOTS[m.id]); briefMap = (withSpots || MAPS[0]).id; }
}
const briefSave = () => { try { localStorage.setItem('barBrief', JSON.stringify({ m: briefMap, s: briefStart, f: briefFac })); } catch (e) {} };
const briefHash = () => '#brief/' + encodeURIComponent(briefMap) + '/' + encodeURIComponent(briefStart) + '/' + briefFac;
function briefRoute(b, c, d) {
  const id = b && decodeURIComponent(b);
  if (id && MAPS.some(m => m.id === id)) { briefMap = id; briefStart = c ? decodeURIComponent(c) : ''; if (FACS.includes(d)) briefFac = d; briefSave(); }
}

const ROLE_GUIDE = { front: 'team-front', 'front/tech': 'team-front', 'air/front': 'team-air', air: 'team-air', tech: 'team-eco', 'air/tech': 'team-air', sea: 'naval' };
const ROLE_NAME = { front: 'frontline', 'front/tech': 'frontline (suits a tech player)', 'air/front': 'air or frontline', air: 'air', tech: 'tech', 'air/tech': 'air or tech', sea: 'naval' };
function spawnRole(m, start) {
  const sel = (start || '').split(':'), lay = layoutsOf(m)[Number(sel[0])];
  if (!start || !lay || lay.kind !== 'pos' || !sel[1] || sel[1].indexOf('.') < 0) return null;
  const [ti, j] = sel[1].split('.').map(Number), s = lay.t.s[ti] && lay.t.s[ti][j];
  return s ? (s[1] || 'front') : null;
}
const isTeamMap = m => m.tg.some(x => /^\d+v\d+$/.test(x) && x !== '1v1');
function briefGuide(m, role) {
  if (role === 'sea') return 'naval';
  if (m.p[1] <= 2) return '1v1';
  if (role && ROLE_GUIDE[role]) return ROLE_GUIDE[role];
  if (m.tg.includes('ffa') && !isTeamMap(m)) return 'ffa';
  return m.tr.includes('water') ? 'naval' : 'opener';
}
// wind or solar: compare energy per metal spent, using the unit data
function briefEnergy(m) {
  const w = byId.armwin, s = byId.armsolar, t = byId.armtide, [lo, avg, hi] = m.wd || [];
  const solar = (s.emake || 0) - (s.upkeep || 0), wind = avg == null ? 0 : avg;
  const perM = { wind: wind / w.metal, solar: solar / s.metal, tidal: (m.td || 0) / (t ? t.metal : 1) };
  const best = Object.entries(perM).sort((a, b) => b[1] - a[1])[0][0];
  let txt;
  if (avg != null && avg < 7) txt = `Wind is weak here (${avg} energy per turbine on average, ${lo} to ${hi}). Build <b>Solar Collectors</b> (${solar} energy each) instead.`;
  else if (best === 'wind') txt = `Wind is good here: <b>${avg}</b> energy per turbine on average (low ${lo}, high ${hi}), which beats a Solar Collector's ${solar} for the metal. The low end of ${lo} is the risk, so mix in a few solar.`;
  else if (best === 'solar') txt = `Wind averages ${avg} (low ${lo}, high ${hi}), so a Solar Collector's steady ${solar} energy is the better buy per metal. Wind still works if you want to save build time.`;
  else txt = `Tidal generators give ${m.td} energy here, the best energy per metal on this map. Use them on the water edge.`;
  if (best !== 'tidal' && m.td > 0) txt += ` Tidal generators give ${m.td} each.`;
  if (m.td === 0) txt += ' Tidal generators make nothing here.';
  return txt;
}

// run something with the planner's globals temporarily set to another plan, then put them back
function withPlan(o, fn) {
  const sv = { s: planS, f: planFac, m: planMapId, p: planStartSel, a: planAs, x: planX };
  try {
    planS = o.stages; planFac = o.fac; planMapId = o.map || null; planStartSel = o.start || ''; planAs = { ...planAs, wm: 'avg' }; planX = { m: 0, e: 0 };
    if (planMapId) planApplyMap();
    return fn();
  } finally { planS = sv.s; planFac = sv.f; planMapId = sv.m; planStartSel = sv.p; planAs = sv.a; planX = sv.x; }
}

function renderBrief() {
  const m = MAPS.find(x => x.id === briefMap), maps = [...MAPS].sort((a, b) => a.n.localeCompare(b.n)), opts = planStartOptions(m);
  if (briefStart && !opts.some(o => o[0] === briefStart)) briefStart = '';
  const role = spawnRole(m, briefStart), gid = briefGuide(m, role), G = window.GUIDES, st = G.styles.find(s => s.id === gid);
  const r = planStagesFromGuide(gid, briefFac), g = planSpotGroups(m.id, briefStart), pos = layoutsOf(m).find(l => l.kind === 'pos');
  const chip = id => { const u = byId[id]; return `<a class="uchip" tabindex="0" data-id="${u.id}" style="--c:${FCOL[u.faction]}"><span class="art"><img src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>${u.name}</a>`; };
  const sum = a => Math.round(a.reduce((s, x) => s + x.v, 0) * 10) / 10;
  let metal;
  if (!g) metal = `<p>This map's metal spots have not been imported yet, so there is no count. Import them with <code>python tools/map_spots.py "${m.n}"</code>.</p>`;
  else {
    const avg = g.all.length ? Math.round(sum(g.all) / g.all.length * 100) / 100 : 0;
    metal = `<p>The map has <b>${g.all.length}</b> metal spots, ${avg} metal/s on average with a basic extractor.</p>` + (g.area
      ? `<p>In your start area: <b>${g.area.length}</b> spots worth <b>${sum(g.area)}</b> metal/s. Nearby: <b>${g.near.length}</b> more (${sum(g.near)} metal/s).</p>${g.area.length < 3 ? '<p class="note">Few spots at home: expect to expand early or take metal from the middle.</p>' : ''}`
      : '<p class="note">Pick a start position to see the spots around you.</p>');
  }
  const startOpts = `<option value="">No start position</option>${opts.map(([v, l]) => `<option value="${v}"${v === briefStart ? ' selected' : ''}>${l}</option>`).join('')}`;
  const sim = r && withPlan({ stages: r.stages, fac: briefFac, map: m.id, start: briefStart }, planSim);
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Map briefing</h2><p class="gb">One page per map: what the metal and energy look like for your start position, what role it suits, and an opener to start from.</p></div>
    <section class="plsec"><div class="plmap"><label>Map <select id="brmap">${maps.map(x => `<option value="${x.id.replace(/"/g, '&quot;')}"${x.id === m.id ? ' selected' : ''}>${x.n}</option>`).join('')}</select></label>
      <label class="plstart">Start position <select id="brstart">${startOpts}</select></label></div>
      <div class="plfac" style="margin-top:var(--s3)">${FACS.map(f => `<button data-brfac="${f}" aria-pressed="${f === briefFac}" style="--c:${FCOL[f]}"><span class="art"><img src="img/${COMMANDER[f]}.webp" alt="" onerror="this.style.visibility='hidden'"></span><span><b>${f}</b></span></button>`).join('')}</div></section>
    <div class="brgrid">
      <section class="plsec brov">${m.img ? `<img class="brimg" src="${m.img}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}<div><h3 class="cap">${m.n}</h3>
        <p>${m.d || ''}</p><p class="note">${m.w} by ${m.h} map, ${players(m)} players${m.a ? ', by ' + m.a : ''}. Tags: ${m.tr.join(', ') || 'none'}. Pools: ${m.ls.filter(l => POOLN[l]).map(l => POOLN[l]).join(', ') || 'none'}.</p>
        <button class="vsswap" data-openmap="1">Open the map page</button></div></section>
      <section class="plsec"><h3 class="cap">Energy</h3><p>${briefEnergy(m)}</p></section>
      <section class="plsec"><h3 class="cap">Metal</h3>${metal}</section>
      <section class="plsec"><h3 class="cap">Your spawn</h3>${role ? `<p>This is a <b>${ROLE_NAME[role] || role}</b> spawn, so the suggested opener is <b>${st.name}</b>.</p>` : `<p>${briefStart ? 'This start has no fixed role.' : 'No start position chosen.'} The suggested opener is <b>${st.name}</b>.</p>`}${pos ? roleSummary(pos) : '<p class="note">This map only has start areas, so there are no fixed spawn roles.</p>'}</section>
    </div>
    <section class="plsec"><h3 class="cap">Suggested opener: ${st.name} (${briefFac})</h3><p>${st.blurb}</p>
      ${r ? `<ol class="steps">${st.steps.map(s => { const id = G.roles[s.r] && G.roles[s.r][briefFac]; return id && byId[id] ? `<li><div class="stepmain">${chip(id)}<span class="qty">${s.n ? 'x ' + s.n : ''}</span></div><p>${s.t}</p></li>` : ''; }).join('')}</ol>` : ''}
      ${sim ? `<p class="note">Built in this order on this map: ready in <b>${clock(sim.time)}</b>, then <b>${rate(sim.end.m)}</b> metal/s, <b>${rate(sim.end.e)}</b> energy/s and <b>${rate(sim.end.bp)}</b> build power${sim.over ? `. It wants ${sim.used} extractors but only ${sim.spots} spots are open to you` : ''}.</p>` : ''}
      <ul class="tips">${st.tips.slice(0, 3).map(t => `<li>${t}</li>`).join('')}</ul>
      <div class="arow"><button class="vsswap" data-brplan="1">Open this in the planner</button><button class="vsswap" data-brroles="1">Plan the whole team</button><button class="vsswap" data-share="brief-link">Copy link</button></div></section>`;
}
document.addEventListener('change', e => {
  if (state.view !== 'brief') return;
  if (e.target.id === 'brmap') { briefMap = e.target.value; briefStart = ''; } else if (e.target.id === 'brstart') briefStart = e.target.value; else return;
  briefSave(); pushHash(viewHash()); renderBrief();
});
document.addEventListener('click', e => {
  if (state.view !== 'brief') return;
  const t = e.target, f = t.closest('[data-brfac]');
  if (f) { briefFac = f.dataset.brfac; briefSave(); pushHash(viewHash()); return renderBrief(); }
  if (t.closest('[data-openmap]')) { e.stopPropagation(); location.hash = '#map/' + encodeURIComponent(briefMap); return; }
  if (t.closest('[data-brplan]')) {
    const m = MAPS.find(x => x.id === briefMap);
    planFromGuide(briefGuide(m, spawnRole(m, briefStart)), briefFac); planMapId = m.id; planStartSel = briefStart; planAs.wm = 'avg'; planApplyMap(); planSave(); setView('plan'); return;
  }
  if (t.closest('[data-brroles]')) { rolesMapId = briefMap; rolesFac = briefFac; rolesLi = -1; rolesOv = {}; rolesFacs = {}; rolesNames = {}; rolesSave(); setView('roles'); }
}, true);
