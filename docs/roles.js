// Team role planner: every player on your team gets a name, a faction and a role (frontline, economy, air, naval).
// You get the matching guide and an income plan for each player, and a check of the team as a whole for holes.
// Shareable as a link or as text.
const RKEYS = [['front', 'Frontline', 'team-front'], ['eco', 'Economy', 'team-eco'], ['air', 'Air', 'team-air'], ['sea', 'Naval', 'naval']];
const RCODE = { front: 'f', eco: 'e', air: 'a', sea: 's' }, RFROM = { f: 'front', e: 'eco', a: 'air', s: 'sea' };
const FCODE = { Armada: 'A', Cortex: 'C', Legion: 'L' }, FFROM = { A: 'Armada', C: 'Cortex', L: 'Legion' };
const RDEF = ['front', 'eco', 'front', 'air', 'front', 'eco', 'front', 'air'];     // used when the map has no fixed spawn roles
let rolesMapId = null, rolesLi = -1, rolesTeam = 0, rolesFac = 'Armada', rolesOv = {}, rolesFacs = {}, rolesNames = {}, rolesN = 4;

const cleanName = v => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
function rolesLoad() {
  try {
    const s = JSON.parse(localStorage.getItem('barRoles') || 'null');
    if (s) {
      if (MAPS.some(m => m.id === s.m)) rolesMapId = s.m;
      if (FACS.includes(s.f)) rolesFac = s.f;
      rolesLi = Number.isInteger(s.li) ? s.li : -1; rolesTeam = Number(s.t) || 0; rolesN = clamp(s.n || 4, 2, 8);
      rolesOv = s.ov && typeof s.ov === 'object' ? s.ov : {};
      rolesFacs = {}; Object.entries(s.fs || {}).forEach(([k, v]) => { if (FACS.includes(v)) rolesFacs[k] = v; });
      rolesNames = {}; Object.entries(s.nm || {}).forEach(([k, v]) => { const n = cleanName(v); if (n) rolesNames[k] = n; });
    }
  } catch (e) {}
  if (!rolesMapId) { const m = MAPS.find(x => x.sp && x.sp.tm && x.sp.tm.length && x.p[1] >= 6); rolesMapId = (m || MAPS[0]).id; }
}
const rolesSave = () => { try { localStorage.setItem('barRoles', JSON.stringify({ m: rolesMapId, li: rolesLi, f: rolesFac, t: rolesTeam, n: rolesN, ov: rolesOv, fs: rolesFacs, nm: rolesNames })); } catch (e) {} };

// the spawns of the chosen team: from the map's exact spawns when it has them, otherwise numbered slots
function rolesSpawns(m) {
  const lays = layoutsOf(m), pos = lays.map((l, i) => [l, i]).filter(([l]) => l.kind === 'pos');
  if (!pos.length) return { pos, li: -1, team: 0, list: Array.from({ length: rolesN }, (_, j) => ({ j, name: 'Player ' + (j + 1), map: null, start: '', def: RDEF[j % RDEF.length] })) };
  const li = pos.some(([, i]) => i === rolesLi) ? rolesLi : pos[0][1], lay = lays[li], team = Math.min(rolesTeam, lay.t.s.length - 1);
  const first = tok => ({ front: 'front', tech: 'eco', air: 'air', sea: 'sea' }[String(tok || 'front').split('/')[0]] || 'front');
  return { pos, li, team, lay, list: lay.t.s[team].map(([name, ro], j) => ({ j, name, map: ro, start: `${li}:${team}.${j}`, def: first(ro) })) };
}
const roleOf = sp => rolesOv[sp.j] || sp.def;
const facOf = sp => rolesFacs[sp.j] || rolesFac;
const nameOf = sp => rolesNames[sp.j] || sp.name;
const escR = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function renderRoles() {
  const m = MAPS.find(x => x.id === rolesMapId), maps = [...MAPS].sort((a, b) => a.n.localeCompare(b.n)), S = rolesSpawns(m), G = window.GUIDES;
  const cards = S.list.map(sp => {
    const role = roleOf(sp), fac = facOf(sp), rk = RKEYS.find(r => r[0] === role), r = planStagesFromGuide(rk[2], fac), sg = S.li >= 0 ? planSpotGroups(m.id, sp.start) : null;
    const sim = r && withPlan({ stages: r.stages, fac, map: m.id, start: sp.start }, planSim);
    const st = G.styles.find(s => s.id === rk[2]);
    sp.sim = sim;
    return `<section class="plsec rcard" style="border-top:4px solid ${FCOL[fac]}"><div class="rch">
      <input class="rname" value="${escR(rolesNames[sp.j] || '')}" placeholder="${escR(sp.name)}" maxlength="24" data-rname="${sp.j}" aria-label="Player name for ${escR(sp.name)}">
      <span class="rmap">${S.li >= 0 ? 'spawn ' + escR(sp.name) + ', ' : ''}${sp.map ? 'map suggests ' + (ROLE_NAME[sp.map] || sp.map) : 'no fixed role'}</span>
      <span class="rsel"><label>Faction <select data-rfac="${sp.j}" style="color:${FCOL[fac]}">${FACS.map(f => `<option value="${f}"${f === fac ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      <label>Role <select data-rrole="${sp.j}">${RKEYS.map(([k, l]) => `<option value="${k}"${k === role ? ' selected' : ''}>${l}</option>`).join('')}</select></label></span></div>
      <p class="note" style="margin:0 0 var(--s2)">${st.blurb}</p>
      <div class="rchips">${st.steps.map(s => { const id = G.roles[s.r] && G.roles[s.r][fac]; const u = id && byId[id]; return u ? `<a class="uchip" tabindex="0" data-id="${u.id}" style="--c:${FCOL[u.faction]}"><span class="art"><img src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>${u.name}${s.n ? ' x ' + s.n : ''}</a>` : ''; }).join('')}</div>
      ${sim ? `<p class="note">Opener ready in <b>${clock(sim.time)}</b>, then <b>${rate(sim.end.m)}</b> metal/s, <b>${rate(sim.end.e)}</b> energy/s, <b>${rate(sim.end.bp)}</b> build power.${sg && sg.area ? ` ${sg.area.length} metal spots at home, ${sg.near.length} nearby.` : ''}${sim.over ? ` <b class="plnospot">It wants ${sim.used} extractors but only ${sim.spots} spots are open.</b>` : ''}</p>` : ''}
      <div class="arow"><button class="vsswap" data-rplan="${sp.j}">Open in the planner</button></div></section>`;
  }).join('');
  const cnt = Object.fromEntries(RKEYS.map(([k]) => [k, 0])); S.list.forEach(sp => { cnt[roleOf(sp)]++; });
  const fcnt = Object.fromEntries(FACS.map(f => [f, 0])); S.list.forEach(sp => { fcnt[facOf(sp)]++; });
  const n = S.list.length, warn = [];
  if (n >= 3 && !cnt.front) warn.push('Nobody is on the frontline, so the team has nothing holding the contested metal.');
  if (n >= 3 && !cnt.eco) warn.push('Nobody is on economy, so the team will fund itself slowly and struggle to reach tech 2.');
  if (n >= 4 && !cnt.air) warn.push('Nobody is on air, so enemy aircraft will be hard to answer and your own air power is missing.');
  if (cnt.front > n * .75 && n >= 4) warn.push('Almost everyone is on the frontline. A frontline with no economy behind it runs out of units.');
  if (cnt.sea && !m.tr.some(t => /water|sea|island/.test(t)) && !S.list.some(sp => sp.map === 'sea')) warn.push('This map has no water spawns, so a naval role may have nowhere to build.');
  const sims = S.list.map(sp => sp.sim).filter(Boolean), tm = sims.reduce((s, x) => s + x.end.m, 0), te = sims.reduce((s, x) => s + x.end.e, 0);
  const lays = S.pos.map(([l, i]) => `<option value="${i}"${i === S.li ? ' selected' : ''}>${l.label}</option>`).join('');
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Team roles</h2><p class="gb">Name each player, pick their faction and give them a role. You get the matching guide and an income plan for every player, and a check for holes in the team.</p></div>
    <section class="plsec"><div class="plmap"><label>Map <select id="rlmap">${maps.map(x => `<option value="${x.id.replace(/"/g, '&quot;')}"${x.id === m.id ? ' selected' : ''}>${x.n}</option>`).join('')}</select></label>
      ${S.pos.length ? `<label>Spawn layout <select id="rllay">${lays}</select></label>${S.lay.t.s.length > 1 ? `<span class="rteams">Your team ${S.lay.t.s.map((_, i) => `<button data-rlteam="${i}" aria-pressed="${i === S.team}">${i + 1}</button>`).join('')}</span>` : ''}`
      : `<label>Team size <input type="number" id="rln" min="2" max="8" value="${rolesN}"></label><p class="note" style="flex-basis:100%;margin:0">This map has start areas but no fixed spawns, so the slots below are numbered players with a typical mix of roles.</p>`}</div>
      <div class="rall"><span>Set everyone to</span><div class="plfac" style="margin:0">${FACS.map(f => `<button data-rlfac="${f}" aria-pressed="${S.list.every(sp => facOf(sp) === f)}" style="--c:${FCOL[f]}"><span class="art"><img src="img/${COMMANDER[f]}.webp" alt="" onerror="this.style.visibility='hidden'"></span><span><b>${f}</b></span></button>`).join('')}</div></div>
      <p class="note">You can still change the faction of any single player below. Click a name to rename a player.</p></section>
    <section class="plsum"><div class="plst"><span><b>${n}</b>players</span>${RKEYS.map(([k, l]) => `<span><b>${cnt[k]}</b>${l.toLowerCase()}</span>`).join('')}<span><b>${rate(tm)}</b>team metal/s</span><span><b>${rate(te)}</b>team energy/s</span></div>
      <button class="vsswap" data-share="roles-link">Copy link</button><button class="vsswap" data-share="roles-text">Copy as text</button></section>
    <p class="note" style="margin:0 0 var(--s2)">Factions on the team: ${FACS.filter(f => fcnt[f]).map(f => `<b style="color:${FCOL[f]}">${fcnt[f]} ${f}</b>`).join(', ')}.</p>
    ${warn.length ? `<ul class="rwarn">${warn.map(w => `<li>${w}</li>`).join('')}</ul>` : '<p class="note">The team has a sensible spread of roles.</p>'}
    <div class="rgrid">${cards}</div>
    <p class="note">Income is each player's opener built in order on their own, using real metal spots where they are imported, and ignoring teammates. It is a starting point, not a result.</p>`;
}

// the team as plain text, for pasting into chat
function rolesText() {
  const m = MAPS.find(x => x.id === rolesMapId), S = rolesSpawns(m), rn = Object.fromEntries(RKEYS.map(r => [r[0], r[1]]));
  return [`BAR team on ${m.n}${S.lay ? ` (${S.lay.label}, team ${S.team + 1})` : ''}`, ...S.list.map(sp => `${nameOf(sp)}: ${facOf(sp)}, ${rn[roleOf(sp)].toLowerCase()}${S.li >= 0 ? ` (spawn ${sp.name})` : ''}`), '', pageBase() + rolesHash()].join('\n');
}

// shareable link: #roles/<map>/<layout>/<team>/<default faction>/<roles>/<factions>/<names>
// roles and factions are one letter per player, names are a url-safe base64 list (empty when nobody is renamed)
function rolesCodes() {
  const m = MAPS.find(x => x.id === rolesMapId), S = rolesSpawns(m), names = S.list.map(sp => rolesNames[sp.j] || '');
  return { r: S.list.map(sp => RCODE[roleOf(sp)]).join(''), f: S.list.map(sp => FCODE[facOf(sp)]).join(''), n: names.some(Boolean) ? b64e(JSON.stringify(names)) : '' };
}
const rolesHash = () => { const c = rolesCodes(); return '#roles/' + encodeURIComponent(rolesMapId) + '/' + rolesLi + '/' + rolesTeam + '/' + rolesFac + '/' + c.r + '/' + c.f + '/' + c.n; };
function rolesRoute(b, li, tm, fac, code, fcode, nm) {
  const id = b && decodeURIComponent(b); if (!id || !MAPS.some(m => m.id === id)) return;
  rolesMapId = id; rolesLi = Number.isInteger(+li) ? +li : -1; rolesTeam = Number(tm) || 0; if (FACS.includes(fac)) rolesFac = fac;
  const m = MAPS.find(x => x.id === id), S = rolesSpawns(m); rolesOv = {}; rolesFacs = {}; rolesNames = {};
  if (!S.pos.length && code) rolesN = clamp(code.length, 2, 8);
  (code || '').split('').forEach((c, j) => { if (RFROM[c]) rolesOv[j] = RFROM[c]; });
  (fcode || '').split('').forEach((c, j) => { if (FFROM[c] && FFROM[c] !== rolesFac) rolesFacs[j] = FFROM[c]; });
  if (nm) { try { const a = JSON.parse(b64d(nm)); if (Array.isArray(a)) a.slice(0, 16).forEach((v, j) => { const n = cleanName(v); if (n) rolesNames[j] = n; }); } catch (e) {} }
  rolesSave();
}

document.addEventListener('change', e => {
  if (state.view !== 'roles') return;
  const t = e.target;
  if (t.id === 'rlmap') { rolesMapId = t.value; rolesLi = -1; rolesTeam = 0; rolesOv = {}; rolesFacs = {}; rolesNames = {}; }
  else if (t.id === 'rllay') { rolesLi = Number(t.value); rolesTeam = 0; rolesOv = {}; }
  else if (t.id === 'rln') { rolesN = clamp(t.value, 2, 8); rolesOv = {}; }
  else if (t.dataset.rrole !== undefined) rolesOv[t.dataset.rrole] = t.value;
  else if (t.dataset.rfac !== undefined) { if (t.value === rolesFac) delete rolesFacs[t.dataset.rfac]; else rolesFacs[t.dataset.rfac] = t.value; }
  else if (t.dataset.rname !== undefined) { const n = cleanName(t.value); if (n) rolesNames[t.dataset.rname] = n; else delete rolesNames[t.dataset.rname]; }
  else return;
  rolesSave(); pushHash(viewHash()); renderRoles();
});
document.addEventListener('click', e => {
  if (state.view !== 'roles') return;
  const t = e.target; let el;
  if ((el = t.closest('[data-rlteam]'))) { rolesTeam = Number(el.dataset.rlteam); rolesOv = {}; }
  else if ((el = t.closest('[data-rlfac]'))) { rolesFac = el.dataset.rlfac; rolesFacs = {}; }
  else if ((el = t.closest('[data-rplan]'))) {
    const m = MAPS.find(x => x.id === rolesMapId), sp = rolesSpawns(m).list[Number(el.dataset.rplan)], rk = RKEYS.find(r => r[0] === roleOf(sp));
    planFromGuide(rk[2], facOf(sp)); planMapId = m.id; planStartSel = sp.start; planAs.wm = 'avg'; planApplyMap(); planSave(); setView('plan'); return;
  } else return;
  rolesSave(); pushHash(viewHash()); renderRoles();
}, true);
