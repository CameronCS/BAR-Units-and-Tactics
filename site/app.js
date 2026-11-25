const U = window.UNITS, byId = Object.fromEntries(U.map(u => [u.id, u]));
const builtBy = {};
U.forEach(u => (u.build || []).forEach(b => (builtBy[b] ||= []).push(u.id)));
const FACS = ['Armada', 'Cortex', 'Legion'];
const CATS = ['Buildings', 'Bots', 'Vehicles', 'Air', 'Hover', 'Naval'];
const FCOL = { Armada: '#4da3ff', Cortex: '#ff5a3c', Legion: '#3fd8b0' };
const COMMANDER = { Armada: 'armcom', Cortex: 'corcom', Legion: 'legcom' };
const state = { favOnly: false, view: 'units', fac: 'All', cat: new Set(), tier: new Set(), q: '', sort: 'name', dens: 'cards', gfac: 'Armada', gstyle: 'opener', tfac: 'Armada' };
const $ = s => document.querySelector(s);
const fmt = n => n == null ? '–' : Math.round(n * 100) / 100;

// ---- saved preferences ----------------------------------------------------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let openSet = new Set(store.get('barOpen', []));
state.fac = FACS.includes(store.get('barFac', '')) ? store.get('barFac', '') : 'All';
state.tfac = FACS.includes(store.get('barTFac', '')) ? store.get('barTFac', '') : 'Armada';
state.view = ['guides', 'maps', 'tree', 'changes', 'vs', 'plan', 'army', 'brief', 'roles', 'equiv'].includes(store.get('barView', 'units')) ? store.get('barView', 'units') : 'units';
state.gfac = FACS.includes(store.get('barGFac', '')) ? store.get('barGFac', '') : 'Armada';
state.gstyle = store.get('barGStyle', 'opener');
state.dens = store.get('barDens', 'cards') === 'list' ? 'list' : 'cards';
const theme = () => { document.body.dataset.fac = state.view === 'guides' ? state.gfac : state.view === 'tree' ? state.tfac : ['maps', 'changes', 'vs', 'plan', 'army', 'brief', 'roles', 'equiv'].includes(state.view) ? 'All' : state.fac; };

// ---- starred units (kept in this browser)
const favs = new Set(); try { JSON.parse(localStorage.getItem('barFav') || '[]').forEach(id => byId[id] && favs.add(id)); } catch (e) {}
function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  try { localStorage.setItem('barFav', JSON.stringify([...favs])); } catch (e) {}
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(b => {
    const on = favs.has(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    b.textContent = b.classList.contains('favbig') ? (on ? 'Starred' : 'Star') : (on ? '\u2605' : '\u2606');
  });
  if (state.view === 'units' && state.favOnly) render(); else updateFavBtn();
}
const updateFavBtn = () => { const b = document.getElementById('favonly'); if (b) { b.setAttribute('aria-pressed', state.favOnly); b.querySelector('span').textContent = favs.size; } };
document.addEventListener('click', e => {
  const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); }
}, true);

// ---- derived numbers ------------------------------------------------------
// DPS = sum(dmg * count / reload) over the unit's weapons (default damage type, single target)
const dps = u => (u.weapons || []).reduce((a, w) => a + (w.dmg && w.reload ? w.dmg * w.count / w.reload : 0), 0);
const maxRange = u => Math.max(0, ...(u.weapons || []).map(w => w.range || 0));

// Building sections (Economy, Combat, ...) from the game's unit group + folder
const SECS = ['Factories', 'Economy: Energy', 'Economy: Metal', 'Combat: Defenses', 'Combat: Anti-Air', 'Combat: Strategic (Nukes & Anti-Nuke)', 'Utility & Intel', 'Mines'];
function bsec(u) {
  const g = u.grp || '', f = u.folder;
  if (g === 'explo' || /mine\d?$/.test(u.id)) return 'Mines';
  if (/^builder/.test(g) && /Factor|Labs|Gantry|Shipyard/i.test(f)) return 'Factories';
  if (/^builder/.test(g)) return 'Utility & Intel';
  if (g === 'aa' || g === 'weaponaa') return 'Combat: Anti-Air';
  if (['nuke', 'antinuke', 'emp'].includes(g)) return 'Combat: Strategic (Nukes & Anti-Nuke)';
  if (/Defen/i.test(f) && g !== 'util') return 'Combat: Defenses';
  if (g === 'weapon' || g === 'sub') return 'Combat: Defenses';
  if (g === 'energy') return 'Economy: Energy';
  if (g === 'metal') return 'Economy: Metal';
  return 'Utility & Intel';
}
U.forEach(u => { u._sec = u.cat === 'Buildings' ? bsec(u) : null; u._dps = dps(u); u._range = maxRange(u); });

// bar scale: sqrt of value against the 95th percentile, so a few giants don't flatten everything
const pct = (arr, p) => { const a = arr.filter(x => x > 0).sort((x, y) => x - y); return a[Math.floor(a.length * p)] || 1; };
const CAP = { metal: pct(U.map(u => u.metal), .95), energy: pct(U.map(u => u.energy), .95), hp: pct(U.map(u => u.hp), .95), dps: pct(U.map(u => u._dps), .95) };
CAP.speed = pct(U.map(u => u.speed), .95); CAP.los = pct(U.map(u => u.los), .95); CAP.range = pct(U.map(u => u._range), .95); CAP.bt = pct(U.map(u => u.bt), .95);
const barPct = (v, cap) => Math.round(Math.min(1, Math.sqrt((v || 0) / cap)) * 100);

// Matchups come from combat.js: real damage-per-armor-class numbers, cost-matched opponents.
const GNAMES = ['Bots', 'Vehicles', 'Hovercraft', 'Aircraft', 'Ships', 'Submarines', 'Defensive structures'];
function matchups(u) {
  const g = Combat.groups(u), S = [], W = [];
  g.S.slice(0, 3).forEach(r => S.push(`${r.g} (${r.e.toFixed(1)}x value)`));
  const none = g.W.filter(r => r.none).map(r => r.g), rest = g.W.filter(r => !r.none && r.g !== 'Any attacker (unarmed)');
  if (none.length >= 3) {
    const can = GNAMES.filter(n => !none.includes(n));
    W.push(can.length ? `Everything except ${can.join(' and ').toLowerCase()} (cannot target it)` : 'Everything (cannot attack)');
  } else none.forEach(n => W.push(`${n} (cannot target them)`));
  rest.slice(0, 3).forEach(r => W.push(`${r.g} (${r.e.toFixed(1)}x value)`));
  g.W.filter(r => r.g === 'Any attacker (unarmed)').forEach(() => W.push('Any attacker (unarmed)'));
  return { S, W };
}

// ---- stat range filters ----------------------------------------------------
// each slider runs 0-100 on a log scale from a low to a high typical value, so common units are easy to pick; the far right end means no limit
const RSTATS = [['metal', 'Metal cost', u => u.metal], ['hp', 'Health', u => u.hp], ['dps', 'Damage per second', u => u._dps], ['range', 'Range', u => u._range], ['speed', 'Speed', u => u.speed]];
const nice = v => { if (v < 20) return Math.round(v); const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; };
const RLO = Object.fromEntries(RSTATS.map(([k, , f]) => [k, Math.max(1, nice(pct(U.map(f), .02)))]));
const RHI = Object.fromEntries(RSTATS.map(([k, , f]) => [k, nice(pct(U.map(f), .9))]));
const rval = (k, p) => p <= 0 ? 0 : p >= 99 ? RHI[k] : nice(RLO[k] * Math.pow(RHI[k] / RLO[k], (p - 1) / 98));
state.rng = Object.fromEntries(RSTATS.map(([k]) => [k, [0, 100]]));
const rActive = k => state.rng[k][0] > 0 || state.rng[k][1] < 100;
const rText = k => { const [a, b] = state.rng[k]; return !rActive(k) ? 'any' : a <= 0 ? `up to ${fmt(rval(k, b))}` : b >= 100 ? `from ${fmt(rval(k, a))}` : `${fmt(rval(k, a))} to ${fmt(rval(k, b))}`; };
const inRange = u => RSTATS.every(([k, , f]) => {
  if (!rActive(k)) return true;
  const v = f(u) || 0, [a, b] = state.rng[k];
  return (a <= 0 || v >= rval(k, a)) && (b >= 100 || v <= rval(k, b));
});
function buildRanges() {
  $('#ranges').innerHTML = RSTATS.map(([k, t]) => `<div class="rg" data-k="${k}"><div class="rl"><label>${t}</label><output></output></div>
    <div class="dr"><span class="fill"></span><input type="range" min="0" max="100" step="1" data-r="${k}" data-e="0" aria-label="${t}, minimum"><input type="range" min="0" max="100" step="1" data-r="${k}" data-e="1" aria-label="${t}, maximum"></div></div>`).join('');
  syncRanges();
}
function syncRanges() {
  RSTATS.forEach(([k]) => {
    const g = $(`.rg[data-k="${k}"]`); if (!g) return;
    const [a, b] = state.rng[k], ins = g.querySelectorAll('input');
    ins[0].value = a; ins[1].value = b;
    const f = g.querySelector('.fill'); f.style.left = a + '%'; f.style.width = (b - a) + '%';
    g.classList.toggle('on', rActive(k)); g.querySelector('output').textContent = rText(k);
  });
  $('#rreset').hidden = !RSTATS.some(([k]) => rActive(k));
}
function resetRanges() { RSTATS.forEach(([k]) => { state.rng[k] = [0, 100]; }); syncRanges(); }
let rq = 0;
$('#ranges').addEventListener('input', e => {
  const i = e.target.closest('input[data-r]'); if (!i) return;
  const k = i.dataset.r, v = Number(i.value), r = state.rng[k];
  if (i.dataset.e === '0') r[0] = Math.min(v, r[1]); else r[1] = Math.max(v, r[0]);
  syncRanges(); clearTimeout(rq); rq = setTimeout(render, 30);
});
$('#rreset').onclick = () => { resetRanges(); render(); };

const short = x => x.replace(/ \(.*\)/, '');

// ---- routing: shareable links ---------------------------------------------
// #units  #units/Cortex  #maps  #guides  #unit/armpw  #map/<file name>
const viewHash = () => state.view === 'tree' ? '#tree/' + state.tfac : state.view === 'maps' ? '#maps' : state.view === 'changes' ? '#changes' : state.view === 'plan' ? '#plan' : state.view === 'army' ? '#army/' + armyEnc() : state.view === 'brief' ? briefHash() : state.view === 'roles' ? rolesHash() : state.view === 'equiv' ? '#equiv' : state.view === 'vs' ? '#vs/' + vsA + ',' + vsB + ',' + vsNA + ',' + vsNB : state.view === 'guides' ? '#guides' : '#units' + (state.fac !== 'All' ? '/' + state.fac : '');
const pushHash = h => { try { history.replaceState(null, '', h); } catch (e) {} };
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')), parts = h.split('/'), [a, b, c] = parts;
  let open = null;
  if (a === 'maps' || a === 'map') { state.view = 'maps'; if (a === 'map' && mapById[b]) open = () => { openMap(b); if (c && drawImport(b, c)) showMap(b, mapLayout); }; }
  else if (a === 'guides') state.view = 'guides';
  else if (a === 'changes') state.view = 'changes';
  else if (a === 'equiv') state.view = 'equiv';
  else if (a === 'army') { state.view = 'army'; if (b) armyDec(parts.slice(1).join('/')); }
  else if (a === 'brief') { state.view = 'brief'; briefRoute(parts[1], parts[2], parts[3]); }
  else if (a === 'roles') { state.view = 'roles'; rolesRoute(parts[1], parts[2], parts[3], parts[4], parts[5]); }
  else if (a === 'plan') { state.view = 'plan'; if (b && planDecode(b)) pushHash('#plan'); }
  else if (a === 'vs') { state.view = 'vs'; const [x, y, na, nb] = (b || '').split(','); if (byId[x] && byId[y]) { vsA = x; vsB = y; if (+na > 0) vsNA = Math.min(999, Math.round(+na)); if (+nb > 0) vsNB = Math.min(999, Math.round(+nb)); } }
  else if (a === 'tree') { state.view = 'tree'; if (FACS.includes(b)) { state.tfac = b; store.set('barTFac', b); } }
  else if (a === 'compare') { state.view = 'units'; open = () => { cmp = (b || '').split(',').filter(id => byId[id]).slice(0, CMP_MAX); saveCmp(); renderTray(); openCompare(); }; }
  else if (a === 'unit' && byId[b]) { state.view = 'units'; open = () => openUnit(b); }
  else if (a === 'units') { state.view = 'units'; if (FACS.includes(b)) state.fac = b; else if (b === undefined) state.fac = 'All'; }
  else return false;
  closeUnit(true); theme(); build(); render(); if (open) open();
  return true;
}

// ---- chrome: top bar, hero, sidebar ----------------------------------------
const TITLES = { units: 'Units', tree: 'Tech tree', maps: 'Maps', guides: 'Build guides', changes: 'Balance changes', vs: 'Versus', plan: 'Build planner', army: 'Army builder', brief: 'Map briefing', roles: 'Team roles', equiv: 'Faction equivalents' };
function buildNav() {
  const items = [['units', 'Units', U.length], ['tree', 'Tech tree', null], ['vs', 'Versus', null], ['plan', 'Planner', null], ['army', 'Army', null], ['equiv', 'Equivalents', null], ['maps', 'Maps', MAPS.length], ['brief', 'Briefing', null], ['roles', 'Team roles', null], ['changes', 'Changes', CHG.length ? CHG[0].changed.length + CHG[0].added.length + CHG[0].removed.length : null], ['guides', 'Guides', null]];
  $('#nav1').innerHTML = items.map(([v, t, n]) => `<button data-view="${v}"${state.view === v ? ' aria-current="page"' : ''}>${t}${n ? `<small>${n}</small>` : ''}</button>`).join('');
  document.title = `${TITLES[state.view]} · BAR Unit Database`;
}
function buildHero() {
  const hero = $('#fhero'), on = state.view === 'units';
  hero.hidden = !on; $('#shell').classList.toggle('page', !on);
  if (!on) return;
  const f = state.fac, fl = U.filter(u => f === 'All' || u.faction === f);
  const n = c => fl.filter(u => u.cat === c).length;
  const art = (f === 'All' ? FACS : [f]).map(x => `<img src="img/lg/${COMMANDER[x]}.webp" alt="" onerror="this.style.display='none'">`).join('');
  hero.innerHTML = `<div class="in"><div>
      <h1 class="fname" style="color:${f === 'All' ? 'var(--ink)' : FCOL[f]}">${f === 'All' ? 'All factions' : f}</h1>
      <div class="fstats"><span><b>${fl.length}</b>units and buildings</span><span><b>${n('Buildings')}</b>buildings</span><span><b>${n('Bots') + n('Vehicles') + n('Hover')}</b>ground units</span><span><b>${n('Air')}</b>air</span><span><b>${n('Naval')}</b>naval</span></div>
      <div class="ftabs" role="tablist" aria-label="Faction">${['All', ...FACS].map(x => `<button class="ftab" role="tab" data-fac="${x}" aria-selected="${x === f}" style="--c:${FCOL[x] || '#f0b43c'}"><i></i>${x}<small>${U.filter(u => x === 'All' || u.faction === x).length}</small></button>`).join('')}</div>
    </div><div class="fart${f === 'All' ? '' : ' one'}">${art}</div></div>`;
}
function buildTiers() {
  $('#tiers').innerHTML = [[1, 'T1'], [1.5, 'T1.5'], [2, 'T2'], [3, 'T3']].map(([v, t]) => `<button data-t="${v}" aria-pressed="${state.tier.has(v)}">${t}</button>`).join('');
}
function buildDens() { document.querySelectorAll('#dens button').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === state.dens)); }
function buildTypes(q) {
  const base = U.filter(u => inFac(u) && matchText(u, q) && inRange(u) && (!state.favOnly || favs.has(u.id)) && (!state.tier.size || state.tier.has(u.tier)));
  $('#types').innerHTML = CATS.map(c => `<button data-c="${c}" aria-pressed="${state.cat.has(c)}">${c}<span>${base.filter(u => u.cat === c).length}</span></button>`).join('');
}
function build() { buildNav(); buildHero(); buildTiers(); buildDens(); theme(); }

const matchText = (u, q) => !q || (u.name + ' ' + u.desc + ' ' + u.id).toLowerCase().includes(q);
const inFac = u => state.fac === 'All' || u.faction === state.fac;

// ---- unit cards and rows ---------------------------------------------------
function bar(label, val, cap, color) {
  return `<div><div class="bar-l">${label}<b>${fmt(val)}</b></div><span class="bar"><i style="width:${barPct(val, cap)}%;--bc:${color}"></i></span></div>`;
}
function card(u) {
  const m = matchups(u);
  const pills = m.S.slice(0, 2).map(x => `<span class="pill s">${short(x)}</span>`).join('') + m.W.slice(0, 2).map(x => `<span class="pill w">${short(x)}</span>`).join('');
  const third = u._dps ? bar('Damage/s', u._dps, CAP.dps, '#ffc857') : bar('Energy', u.energy, CAP.energy, '#ffe27a');
  return `<div class="card" tabindex="0" role="button" style="--c:${FCOL[u.faction]}" data-id="${u.id}"><div class="ci">
    <div class="ctop"><div class="art"><img loading="lazy" src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></div>
      <div class="ttl"><h3><span>${u.name}</span><span class="hr">${u.exp ? '<span class="tier" title="Only exists when the extra units game option is on">Optional</span>' : ''}<span class="tier">T${u.tier}</span><button class="cmpb favb${favs.has(u.id) ? ' on' : ''}" data-fav="${u.id}" aria-pressed="${favs.has(u.id)}" aria-label="Star ${u.name}" title="Star this unit">${favs.has(u.id) ? '\u2605' : '\u2606'}</button>${Combat.armed(u) ? `<button class="cmpb fightb" data-vsfight="${u.id}" aria-label="Fight ${u.name} against another unit" title="Fight another unit">vs</button>` : ''}<button class="cmpb" data-cmp="${u.id}" aria-label="Compare ${u.name}" title="Add to compare">+</button></span></h3><div class="d">${u.desc || ''}</div></div></div>
    <div class="bars">${bar('Metal', u.metal, CAP.metal, '#7fb8ff')}${bar('Health', u.hp, CAP.hp, '#6fe09a')}${third}</div>
    ${pills ? `<div class="mu">${pills}</div>` : ''}</div></div>`;
}
function urow(u) {
  return `<div class="urow" tabindex="0" role="button" style="--c:${FCOL[u.faction]}" data-id="${u.id}">
    <div class="art" style="--c:${FCOL[u.faction]}"><img loading="lazy" src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></div>
    <div class="nm"><b>${u.name}</b><span>${u.desc || ''}</span></div><span class="tier">T${u.tier}</span>
    <span class="n">${fmt(u.metal)}</span><span class="n">${fmt(u.energy)}</span><span class="n">${fmt(u.hp)}</span><span class="n">${u._dps ? fmt(u._dps) : '–'}</span><span class="n">${u.speed ? fmt(u.speed) : '–'}</span><span class="n">${u._range ? fmt(u._range) : '–'}</span></div>`;
}
const LIST_HDR = `<div class="rowhdr"><span></span><span>Unit</span><span>Tier</span><span>Metal</span><span>Energy</span><span>Health</span><span>DPS</span><span>Speed</span><span>Range</span></div>`;
const body = a => state.dens === 'list' ? `<div class="rows">${LIST_HDR}${a.map(urow).join('')}</div>` : `<div class="grid">${a.map(card).join('')}</div>`;

function resultsHeader(n, q) {
  const chips = [...[...state.cat].map(c => [`cat:${c}`, c]), ...[...state.tier].map(t => [`tier:${t}`, 'T' + t]), ...RSTATS.filter(([k]) => rActive(k)).map(([k, t]) => [`rng:${k}`, `${t} ${rText(k)}`]), ...(state.favOnly ? [['fav', 'Starred only']] : []), ...(q ? [['q', `"${state.q.trim()}"`]] : [])];
  return `<div class="rhead"><div class="rcount"><b>${n}</b>${n === 1 ? 'unit' : 'units'}</div>
    <div class="achips">${chips.map(([k, t]) => `<button class="achip" data-rm="${k}">${t}<b aria-label="Remove">×</b></button>`).join('')}</div>
    ${chips.length ? '<button class="clearall" id="clearall">Clear all</button>' : ''}</div>`;
}

$('#favonly').onclick = () => { state.favOnly = !state.favOnly; render(); };
function render() {
  document.querySelector('#shell').classList.toggle('page', state.view !== 'units');
  if (state.view === 'guides') { renderGuide(); return; }
  if (state.view === 'tree') { renderTree(); return; }
  if (state.view === 'maps') { renderMaps(); return; }
  if (state.view === 'changes') { renderChanges(); return; }
  if (state.view === 'vs') { renderVs(); return; }
  if (state.view === 'plan') { renderPlan(); return; }
  if (state.view === 'army') { renderArmy(); return; }
  if (state.view === 'brief') { renderBrief(); return; }
  if (state.view === 'roles') { renderRoles(); return; }
  if (state.view === 'equiv') { renderEquiv(); return; }
  const q = state.q.trim().toLowerCase();
  buildTypes(q); updateFavBtn();
  const l = U.filter(u => inFac(u) && (!state.cat.size || state.cat.has(u.cat)) && (!state.tier.size || state.tier.has(u.tier)) && matchText(u, q) && inRange(u) && (!state.favOnly || favs.has(u.id)));
  const s = state.sort;
  l.sort((a, b) => s === 'name' ? (a.tier - b.tier || a.name.localeCompare(b.name)) :
    (s === 'dps' ? b._dps - a._dps : s === 'range' ? b._range - a._range : (b[s] || 0) - (a[s] || 0)));

  const op = k => (q || openSet.has(k)) ? ' open' : ''; // collapsed by default; everything opens while searching
  const panelCat = (f, c, cl) => {
    let h = `<details class="cat" data-k="${f}|${c}"${op(f + '|' + c)}><summary>${c}<small>${cl.length}</small></summary>`;
    if (c === 'Buildings') {
      for (const sec of SECS) {
        const sl = cl.filter(u => u._sec === sec); if (!sl.length) continue;
        h += `<details class="tierp" data-k="${f}|${c}|${sec}"${op(f + '|' + c + '|' + sec)}><summary>${sec}<small>${sl.length}</small></summary>${body(sl)}</details>`;
      }
    } else {
      for (const t of [1, 1.5, 2, 3]) {
        const tl = cl.filter(u => u.tier === t); if (!tl.length) continue;
        h += `<details class="tierp" data-k="${f}|${c}|${t}"${op(f + '|' + c + '|' + t)}><summary>Tech ${t}<small>${tl.length}</small></summary>${body(tl)}</details>`;
      }
    }
    return h + '</details>';
  };

  let html = '';
  for (const f of FACS) {
    const fl = l.filter(u => u.faction === f); if (!fl.length) continue;
    const cats = CATS.map(c => [c, fl.filter(u => u.cat === c)]).filter(([, a]) => a.length);
    html += state.fac === 'All'
      ? `<details class="fac" data-k="${f}"${op(f)} style="--acc:${FCOL[f]}"><summary>${f}<small>${fl.length}</small></summary>${cats.map(([c, a]) => panelCat(f, c, a)).join('')}</details>`
      : cats.map(([c, a]) => panelCat(f, c, a)).join('');
  }
  $('#grid').innerHTML = resultsHeader(l.length, q) + (html || '<p class="empty">No units match. Remove a filter or clear the search to see more.</p>');
  renderTray();
}

// ---- events ---------------------------------------------------------------
function setView(v) {
  state.view = v; store.set('barView', v);
  closeUnit(true); build(); render(); pushHash(viewHash()); window.scrollTo(0, 0);
}
function setFac(f) {
  state.view = 'units'; store.set('barView', 'units'); state.fac = f; store.set('barFac', f);
  build(); render(); pushHash(viewHash());
}
function setGuides() { setView('guides'); }
function setMaps() { setView('maps'); }
function clearFilters() { state.favOnly = false; state.cat.clear(); state.tier.clear(); resetRanges(); state.q = ''; $('#q').value = ''; buildTiers(); render(); }

$('#nav1').onclick = e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); };
$('#fhero').onclick = e => { const b = e.target.closest('.ftab'); if (b) setFac(b.dataset.fac); };
$('#types').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  state.cat.has(b.dataset.c) ? state.cat.delete(b.dataset.c) : state.cat.add(b.dataset.c); render();
};
$('#tiers').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const v = Number(b.dataset.t); state.tier.has(v) ? state.tier.delete(v) : state.tier.add(v);
  buildTiers(); render();
};
$('#dens').onclick = e => { const b = e.target.closest('button'); if (b) { state.dens = b.dataset.d; store.set('barDens', state.dens); buildDens(); render(); } };
$('#q').oninput = e => { state.q = e.target.value; render(); };
$('#sort').onchange = e => { state.sort = e.target.value; render(); };

$('#grid').addEventListener('toggle', e => {
  const d = e.target, k = d.dataset && d.dataset.k;
  if (!k || state.q || state.view !== 'units') return;
  d.open ? openSet.add(k) : openSet.delete(k);
  store.set('barOpen', [...openSet]);
}, true);
function setAll(open) {
  document.querySelectorAll('#grid details[data-k]').forEach(d => {
    d.open = open; open ? openSet.add(d.dataset.k) : openSet.delete(d.dataset.k);
  });
  store.set('barOpen', [...openSet]);
}
$('#expand').onclick = () => setAll(true);
$('#collapse').onclick = () => setAll(false);

$('#grid').onclick = e => {
  const gf = e.target.closest('[data-gf]'), gs = e.target.closest('[data-gs]'), uc = e.target.closest('.uchip');
  if (gf) { state.gfac = gf.dataset.gf; store.set('barGFac', state.gfac); theme(); return render(); }
  if (gs) { state.gstyle = gs.dataset.gs; store.set('barGStyle', state.gstyle); return render(); }
  if (uc) return openUnit(uc.dataset.id);
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    const [k, v] = rm.dataset.rm.split(':');
    if (k === 'cat') state.cat.delete(v); else if (k === 'tier') state.tier.delete(Number(v)); else if (k === 'rng') { state.rng[v] = [0, 100]; syncRanges(); } else if (k === 'fav') state.favOnly = false; else { state.q = ''; $('#q').value = ''; }
    buildTiers(); return render();
  }
  if (e.target.closest('#clearall')) return clearFilters();
  const c = e.target.closest('.card, .urow'); if (c) openUnit(c.dataset.id);
};
$('#grid').onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') { const c = e.target.closest('.card, .urow, .uchip'); if (c) { e.preventDefault(); openUnit(c.dataset.id); } }
};
$('#dbody').onclick = e => {
  if (e.target.closest('#xb')) return closeUnit();
  if (e.target.closest('#back')) return backUnit();
  const a = e.target.closest('a[data-id]'); if (a) { goUnit(a.dataset.id); }
};
$('#dbody').onkeydown = e => { if (e.key === 'Enter') { const a = e.target.closest('a[data-id]'); if (a) goUnit(a.dataset.id); } };
$('#scrim').onclick = () => closeUnit();

// "/" jumps to search, Escape closes the panel
function focusSearch() { const el = $(state.view === 'maps' ? '#mq' : '#q'); if (el) { el.focus(); el.select && el.select(); } }
$('#tophint').onclick = focusSearch;
$('#filtbtn').onclick = e => { const on = $('#side').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', on); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur(); closeUnit(); return; }
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); focusSearch(); }
});
window.addEventListener('hashchange', route);

loadCmp(); vsLoad(); planLoad(); armyLoad(); briefLoad(); rolesLoad(); eqLoad(); theme(); build(); buildRanges(); render(); renderTray();
if (location.hash) route();
