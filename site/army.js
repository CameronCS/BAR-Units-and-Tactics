// Army builder: put together an army from several unit types, see its totals and gaps (what it cannot hit),
// then fight it against another army.
//
// The fight is a small simulation, not a formula: every half second each group of units fires at the enemy groups it
// can actually hurt, spreading its damage in proportion to their health, and casualties are taken off the counts.
// A group that cannot hurt anything wastes its time, which is what makes gaps (no anti-air, for example) show up.
// Splash damage, range, speed and micro are ignored, so treat the result as a guide.

// ---- a small unit picker shared by the new pages: pickUnits({ title, pool, onPick, hint })
let xPick = null, xQ = '', xCat = 'All', xFac = 'All';
const XCATS = [['All', () => true], ['Bots', u => u.cat === 'Bots'], ['Vehicles', u => u.cat === 'Vehicles'], ['Hover', u => u.cat === 'Hover'], ['Air', u => u.cat === 'Air'], ['Naval', u => u.cat === 'Naval'], ['Buildings', u => u.cat === 'Buildings']];
function xList() {
  const q = xQ.trim().toLowerCase(), cat = XCATS.find(c => c[0] === xCat)[1];
  const l = xPick.pool().filter(u => cat(u) && (xFac === 'All' || u.faction === xFac) && (!q || (u.name + ' ' + u.desc + ' ' + u.id).toLowerCase().includes(q))).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  return `<div class="vsgrid">${l.slice(0, 160).map(u => `<button class="vsu" data-xpick="${u.id}" style="--c:${FCOL[u.faction]}"><span class="art"><img loading="lazy" src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>
    <span><b>${u.name}</b><small>${u.faction}, tech ${u.tier}, ${fmt(u.metal)} metal</small></span></button>`).join('') || '<p class="empty">Nothing matches. Try a different word or filter.</p>'}</div>${l.length > 160 ? `<p class="note">Showing 160 of ${l.length}. Type to narrow it down.</p>` : ''}`;
}
const xFilters = () => ['All', ...FACS].map(f => `<button data-xfac="${f}" aria-pressed="${f === xFac}" style="--c:${FCOL[f] || '#f0b43c'}">${f}</button>`).join('') + '<i></i>' + XCATS.map(([c]) => `<button data-xcat="${c}" aria-pressed="${c === xCat}">${c}</button>`).join('');
function pickUnits(o) {
  xPick = o; xQ = ''; let m = $('#xmodal');
  if (!m) { m = document.createElement('div'); m.id = 'xmodal'; m.className = 'vsmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m); }
  m.setAttribute('aria-label', o.title);
  m.innerHTML = `<div class="vsbox"><div class="vsbh"><h3>${o.title}</h3><button class="xb" id="xclose" aria-label="Close">×</button></div>
    <input id="xq" type="search" placeholder="Search by name" autocomplete="off" aria-label="Search units">
    <div class="vsf" id="xff">${xFilters()}</div><div id="xlist" style="overflow:auto;min-height:0;flex:1">${xList()}</div>
    <div class="plmf"><span class="note" style="margin:0">${o.hint || 'Click a unit to choose it.'}</span><button class="vsswap" id="xdone">Done</button></div></div>`;
  m.hidden = false; $('#xq').focus();
}
function closeXPick() { const m = $('#xmodal'); if (m) m.hidden = true; xPick = null; }
document.addEventListener('input', e => { if (e.target.id === 'xq') { xQ = e.target.value; $('#xlist').innerHTML = xList(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && xPick) { e.stopPropagation(); closeXPick(); } }, true);
document.addEventListener('click', e => {
  if (!xPick) return;
  const t = e.target;
  if (t.closest('#xclose') || t.closest('#xdone') || t.id === 'xmodal') { closeXPick(); return; }
  const u = t.closest('[data-xpick]'); if (u) { const o = xPick; o.onPick(u.dataset.xpick); if (o.close) closeXPick(); return; }
  const f = t.closest('[data-xfac]'), c = t.closest('[data-xcat]');
  if (f || c) { if (f) xFac = f.dataset.xfac; else xCat = c.dataset.xcat; $('#xff').innerHTML = xFilters(); $('#xlist').innerHTML = xList(); }
}, true);

// ---- the army model
const ARMYC = ['#ffc857', '#5cc8ff'];
const armyKind = b => b.fly ? 'air' : b.ac === 'subs' ? 'sub' : b.cat === 'Naval' ? 'ship' : 'land';
const KINDS = [['land', 'Ground units and buildings'], ['air', 'Aircraft'], ['ship', 'Ships'], ['sub', 'Submarines']];
const armyHits = (u, k) => (u.weapons || []).some(w => w.reload && Combat.canHit(w, k) && (w.dd || (w.dm && Object.values(w.dm).some(v => v > 0))));
let armySide = [[{ id: 'armpw', n: 20 }, { id: 'armjeth', n: 6 }], [{ id: 'corak', n: 20 }, { id: 'corstorm', n: 6 }]];
function armyLoad() {
  try { const s = JSON.parse(localStorage.getItem('barArmy') || 'null'); if (s && s.length === 2) armySide = s.map(a => a.filter(x => byId[x.id]).map(x => ({ id: x.id, n: clamp(x.n, 1, 999) }))); } catch (e) {}
  armySide = armySide.map(a => a.filter(x => byId[x.id]));
}
const armySave = () => { try { localStorage.setItem('barArmy', JSON.stringify(armySide)); } catch (e) {} };
const armyMetal = a => a.reduce((s, x) => s + byId[x.id].metal * x.n, 0);
const armyEnc = () => armySide.map(a => a.map(x => x.id + '.' + x.n).join('+')).join('/');
function armyDec(code) {
  const sides = code.split('/'); if (sides.length !== 2) return false;
  const out = sides.map(s => s.split('+').map(p => { const [id, n] = p.split('.'); return byId[id] ? { id, n: clamp(n, 1, 999) } : null; }).filter(Boolean).slice(0, 24));
  if (!out[0].length || !out[1].length) return false;
  armySide = out; armySave(); return true;
}

function armySim(L, R) {
  const A = L.map(x => ({ u: byId[x.id], n: x.n })), B = R.map(x => ({ u: byId[x.id], n: x.n }));
  const mat = (P, Q) => P.map(p => Q.map(q => Combat.dpsVs(p.u, q.u)));
  const dAB = mat(A, B), dBA = mat(B, A), a0 = A.map(x => x.n), b0 = B.map(x => x.n);
  const fire = (P, Q, d) => {
    const tot = Q.map(q => q.n * q.u.hp), dm = Q.map(() => 0);
    P.forEach((p, i) => {
      if (p.n <= 0) return; let w = 0;
      Q.forEach((q, j) => { if (d[i][j] > 0 && q.n > 0) w += tot[j]; });
      if (!w) return;
      Q.forEach((q, j) => { if (d[i][j] > 0 && q.n > 0) dm[j] += p.n * d[i][j] * tot[j] / w; });
    });
    return dm;
  };
  const dt = .5; let t = 0, stalled = false;
  for (; t < 900; t += dt) {
    if (!A.some(x => x.n > .02) || !B.some(x => x.n > .02)) break;
    const dB = fire(A, B, dAB), dA = fire(B, A, dBA);
    if (!dB.some(v => v > 0) && !dA.some(v => v > 0)) { stalled = true; break; }
    B.forEach((q, j) => { q.n = Math.max(0, q.n - dB[j] * dt / q.u.hp); });
    A.forEach((p, i) => { p.n = Math.max(0, p.n - dA[i] * dt / p.u.hp); });
  }
  const left = (P, p0) => P.reduce((s, x, i) => s + x.u.metal * x.n, 0) / (P.reduce((s, x, i) => s + x.u.metal * p0[i], 0) || 1);
  const la = left(A, a0), lb = left(B, b0), aliveA = A.some(x => x.n > .02), aliveB = B.some(x => x.n > .02);
  let win = 0;   // 1: left army wins, 2: right army wins
  if (aliveA && !aliveB) win = 1; else if (aliveB && !aliveA) win = 2; else if (aliveA && aliveB) win = 0;
  return { A, B, la, lb, t, win, stalled, a0, b0, timeout: t >= 900 && aliveA && aliveB };
}

// what an army can and cannot hit, as a share of its armed metal
function armyCover(a) {
  const armed = a.filter(x => Combat.armed(byId[x.id])), tot = armed.reduce((s, x) => s + byId[x.id].metal * x.n, 0) || 1;
  return KINDS.map(([k, label]) => ({ k, label, share: armed.filter(x => armyHits(byId[x.id], k)).reduce((s, x) => s + byId[x.id].metal * x.n, 0) / tot }));
}
// units that would fill a gap: armed, buildable, cheap per damage, from the army's main faction, no higher tech than it already has
function armyFill(a, k) {
  if (!a.length) return [];
  const fc = {}; a.forEach(x => { const f = byId[x.id].faction; fc[f] = (fc[f] || 0) + byId[x.id].metal * x.n; });
  const fac = Object.keys(fc).sort((x, y) => fc[y] - fc[x])[0], tier = Math.max(...a.map(x => byId[x.id].tier));
  const probe = { ac: k === 'sub' ? 'subs' : k === 'ship' ? 'hvyboats' : null, fly: k === 'air', cat: k === 'ship' || k === 'sub' ? 'Naval' : 'Bots' };
  return U.filter(u => u.faction === fac && Combat.armed(u) && u.metal > 0 && u.tier <= tier && !u.exp && builtBy[u.id] && u.cat !== 'Buildings' && armyHits(u, k) && (k !== 'land' || !u.fly))
    .map(u => [u, Combat.dpsVs(u, { ...probe, hp: 1000 }) / u.metal]).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]);
}

function armyColHtml(si) {
  const a = armySide[si], m = armyMetal(a), hp = a.reduce((s, x) => s + byId[x.id].hp * x.n, 0), dps = a.reduce((s, x) => s + byId[x.id]._dps * x.n, 0);
  const cov = armyCover(a);
  const rows = a.map((x, i) => { const u = byId[x.id]; return `<li style="--c:${FCOL[u.faction]}"><button class="plu" data-plopen="${u.id}" style="--c:${FCOL[u.faction]}"><span class="art"><img src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>${u.name}</button>
    <input type="number" min="1" max="999" value="${x.n}" data-aq="${si},${i}" aria-label="Quantity of ${u.name}"><span class="am">${fmt(u.metal * x.n)} metal</span><button class="plx" data-arm="${si},${i}" aria-label="Remove ${u.name}">×</button></li>`; }).join('');
  const gaps = cov.map(c => {
    const cls = c.share <= 0 ? 'none' : c.share < .25 ? 'low' : 'ok';
    const fill = cls !== 'ok' && a.length ? armyFill(a, c.k) : [];
    return `<li class="${cls}"><span>${c.label}</span><b>${c.share <= 0 ? 'cannot hit' : Math.round(c.share * 100) + '% of firepower metal'}</b>${fill.length && (cls === 'none' || cls === 'low') ? `<span class="afill">Add: ${fill.map(u => `<button data-afill="${si},${u.id},${c.k}" style="--c:${FCOL[u.faction]}">${u.name}</button>`).join('')}</span>` : ''}</li>`;
  }).join('');
  return `<section class="plsec" style="border-top:4px solid ${ARMYC[si]}"><h3 class="cap" style="color:${ARMYC[si]}">${si ? 'Army B' : 'Army A'}</h3>
    <div class="astat"><span><b>${fmt(m)}</b>metal</span><span><b>${fmt(hp)}</b>health</span><span><b>${fmt(Math.round(dps))}</b>damage/s</span><span><b>${a.reduce((s, x) => s + x.n, 0)}</b>units</span></div>
    <ul class="alist">${rows || '<li class="empty">No units yet.</li>'}</ul>
    <div class="arow"><button class="vsswap" data-aadd="${si}">Add units</button><button class="vsswap" data-aclr="${si}"${a.length ? '' : ' disabled'}>Clear</button><button class="vsswap" data-amatch="${si}"${armySide[1 - si].length && a.length ? '' : ' disabled'}>Match the other army's metal</button></div>
    <h4 class="agh">What it can hit</h4><ul class="agaps">${gaps}</ul></section>`;
}

function armyResultHtml(r) {
  const [a, b] = armySide;
  const names = (P, p0) => P.map((x, i) => `<li><span>${x.u.name}</span><b>${Math.round(x.n)} of ${p0[i]}</b></li>`).join('');
  let head, sub = '';
  if (r.stalled && !r.win) head = 'Neither army can hurt the other', sub = 'Nothing in either army can target the other side.';
  else if (r.timeout) head = 'No winner after 15 minutes', sub = 'Both armies are still standing.';
  else if (!r.win) head = 'Mutual destruction';
  else { const w = r.win === 1 ? 'Army A' : 'Army B', f = r.win === 1 ? r.la : r.lb; head = `${w} wins`; sub = `with ${Math.round(f * 100)}% of its metal still alive after ${clock(r.t)}`; }
  if (r.stalled && r.win) sub += `. The loser has nothing that can hurt what is left.`;
  const share = r.win === 1 ? 50 + r.la * 50 : r.win === 2 ? 50 - r.lb * 50 : 50;
  const m0 = (P, p0) => P.reduce((s, x, i) => s + x.u.metal * p0[i], 0), lostA = m0(r.A, r.a0) * (1 - r.la), lostB = m0(r.B, r.b0) * (1 - r.lb);
  const trade = lostA > 0 && lostB > 0 ? (lostB >= lostA ? `Army A destroys ${fmt(Math.round(lostB / lostA * 10) / 10)} metal for every 1 it loses.` : `Army B destroys ${fmt(Math.round(lostA / lostB * 10) / 10)} metal for every 1 it loses.`) : (lostA > 0 || lostB > 0 ? `${lostA > 0 ? 'Army B' : 'Army A'} loses nothing.` : '');
  const cost = `<div class="vstab">${vsRow('Metal at the start', m0(r.A, r.a0), m0(r.B, r.b0), { nowin: true })}${vsRow('Metal lost', Math.round(lostA), Math.round(lostB), { low: true })}${vsRow('Metal destroyed', Math.round(lostB), Math.round(lostA))}</div>${trade ? `<p class="note" style="margin:0 0 var(--s3)">${trade}</p>` : ''}`;
  return `<div class="vsverd" data-w="${r.win}"><div class="vsmeter"><i style="width:${share}%;background:${ARMYC[0]}"></i><i style="width:${100 - share}%;background:${ARMYC[1]}"></i></div><h3>${head}</h3>${sub ? `<p>${sub}</p>` : ''}</div>
    ${cost}
    <div class="vscols"><div><h4 style="color:${ARMYC[0]}">Army A at the end</h4><ul class="vsw">${names(r.A, r.a0)}</ul></div><div><h4 style="color:${ARMYC[1]}">Army B at the end</h4><ul class="vsw">${names(r.B, r.b0)}</ul></div></div>
    <div class="vsshare" style="margin-top:var(--s3)"><button class="vsswap" data-share="army-link">Copy link</button></div>
    <p class="note">The fight is simulated in half-second steps. Each group spreads its fire over the enemy groups it can hurt, by health. Range, speed, splash damage and micro are ignored, and every unit fires from the start.</p>`;
}

// ---- counter finder: build an army that beats a given one, for the same metal (or a share of it)
// Greedy: shortlist the units that do best against what the enemy has, then add them a slice of the budget at a time,
// each time keeping the unit whose addition leaves the most of our metal alive minus the enemy's in a full simulated fight.
let armyCT = 0, armyCF = 'Any', armyCP = 100, armyPrev = null, armyNote = '';
const armyAdd = (a, id, n) => { const c = a.map(x => ({ ...x })), ex = c.find(x => x.id === id); ex ? ex.n = Math.min(999, ex.n + n) : c.push({ id, n: Math.min(999, n) }); return c; };
function armyCounter(enemy, fac, pct) {
  const emetal = armyMetal(enemy), budget = emetal * pct / 100; if (!budget) return null;
  const maxT = Math.max(...enemy.map(x => byId[x.id].tier));
  const pool = U.filter(u => (fac === 'Any' || u.faction === fac) && Combat.armed(u) && builtBy[u.id] && !u.exp && u.cat !== 'Buildings' && u.metal > 0 && u.tier <= maxT && !/com$/.test(u.id));
  if (!pool.length) return null;
  const rank = u => enemy.reduce((s, x) => s + byId[x.id].metal * x.n / emetal * Math.min(5, Combat.E(u, byId[x.id])), 0);
  const cands = new Set(pool.map(u => [u, rank(u)]).sort((a, b) => b[1] - a[1]).slice(0, 18).map(x => x[0]));
  new Set(enemy.map(x => armyKind(byId[x.id]))).forEach(k => {          // make sure every kind of enemy has an answer on the shortlist
    const rep = enemy.map(x => byId[x.id]).find(u => armyKind(u) === k);
    pool.filter(u => armyHits(u, k)).sort((a, b) => Combat.dpsVs(b, rep) / b.metal - Combat.dpsVs(a, rep) / a.metal).slice(0, 3).forEach(u => cands.add(u));
  });
  const alive = P => P.reduce((s, x) => s + x.u.metal * x.n, 0);
  const score = S => { const r = armySim(S, enemy); return alive(r.A) - alive(r.B); };
  let S = [], spent = 0; const chunk = budget / 8;
  for (let step = 0; step < 8 && spent < budget * .98; step++) {
    let best = null;
    for (const u of cands) {
      const n = Math.max(1, Math.round(Math.min(chunk, budget - spent) / u.metal)), sc = score(armyAdd(S, u.id, n));
      if (!best || sc > best.sc) best = { u, n, sc };
    }
    S = armyAdd(S, best.u.id, best.n); spent += best.n * best.u.metal;
  }
  return S.sort((a, b) => byId[b.id].metal * b.n - byId[a.id].metal * a.n);
}
function armyDoCounter() {
  const target = armyCT, other = 1 - target, enemy = armySide[target]; if (!enemy.length) return;
  const S = armyCounter(enemy, armyCF, armyCP);
  if (!S || !S.length) { armyNote = 'No units to build a counter from with those settings.'; return; }
  armyPrev = JSON.stringify(armySide); armySide[other] = S;
  armyNote = `Built a ${armyCF === 'Any' ? '' : armyCF + ' '}counter to Army ${target ? 'B' : 'A'} from ${S.length} unit ${S.length === 1 ? 'type' : 'types'} (${fmt(armyMetal(S))} metal, ${Math.round(armyMetal(S) / armyMetal(enemy) * 100)}% of its metal). It replaced Army ${other ? 'B' : 'A'}.`;
}
function armyCounterHtml() {
  return `<section class="plsec"><h3 class="cap">Counter finder</h3>
    <div class="arow" style="align-items:center;margin-top:0"><label>Counter <select id="actar"><option value="0"${armyCT === 0 ? ' selected' : ''}>Army A</option><option value="1"${armyCT === 1 ? ' selected' : ''}>Army B</option></select></label>
      <label>using <select id="acfac"><option value="Any">any faction</option>${FACS.map(f => `<option value="${f}"${f === armyCF ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      <label>with <input type="number" id="acpct" min="10" max="300" step="10" value="${armyCP}" style="width:76px"> % of its metal</label>
      <button class="vsswap" data-acgo="1"${armySide[armyCT].length ? '' : ' disabled'}>Build counter</button>${armyPrev ? '<button class="vsswap" data-acundo="1">Undo</button>' : ''}</div>
    <p class="note">${armyNote || 'Fills the other army with units that beat the one you pick, within the metal you give it. Nothing is lost: you can undo it.'} It tries a shortlist of the best units one slice of the budget at a time, using the same fight simulation, so it is a good starting point, not a proven best.</p></section>`;
}

function renderArmy() {
  const ok = armySide[0].length && armySide[1].length;
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Army builder</h2>
    <p class="gb">Build two armies from any mix of units, see what each one cannot hit, then fight them.</p></div>
    <div class="acols">${armyColHtml(0)}${armyColHtml(1)}</div>
    ${armyCounterHtml()}
    <h3 class="cap" style="margin-top:var(--s4)">Fight</h3>${ok ? armyResultHtml(armySim(armySide[0], armySide[1])) : '<p class="empty">Put at least one unit in each army to fight them.</p>'}`;
}

document.addEventListener('change', e => {
  if (state.view !== 'army' || e.target.dataset.aq === undefined) return;
  const [s, i] = e.target.dataset.aq.split(',').map(Number); armySide[s][i].n = clamp(e.target.value, 1, 999); armySave(); pushHash(viewHash()); renderArmy();
});
document.addEventListener('click', e => {
  if (state.view !== 'army' || xPick) return;
  const t = e.target, g = a => t.closest(`[${a}]`); let el;
  if ((el = g('data-aadd'))) { const s = Number(el.dataset.aadd); pickUnits({ title: `Add to army ${s ? 'B' : 'A'}`, pool: () => U.filter(u => builtBy[u.id] && u.metal > 0 && Combat.armed(u)), hint: 'Click a unit to add one. Click again to add more.', onPick: id => { const ex = armySide[s].find(x => x.id === id); ex ? ex.n = Math.min(999, ex.n + 1) : armySide[s].push({ id, n: 1 }); armySave(); pushHash(viewHash()); renderArmy(); } }); return; }
  else if ((el = g('data-arm'))) { const [s, i] = el.dataset.arm.split(',').map(Number); armySide[s].splice(i, 1); }
  else if ((el = g('data-aclr'))) armySide[Number(el.dataset.aclr)] = [];
  else if ((el = g('data-amatch'))) { const s = Number(el.dataset.amatch), want = armyMetal(armySide[1 - s]), have = armyMetal(armySide[s]); if (have) armySide[s].forEach(x => { x.n = clamp(x.n * want / have, 1, 999); }); }
  else if ((el = g('data-afill'))) { const [s, id] = el.dataset.afill.split(','), u = byId[id], a = armySide[Number(s)]; const n = clamp(armyMetal(a) * .15 / u.metal, 1, 999), ex = a.find(x => x.id === id); ex ? ex.n = Math.min(999, ex.n + n) : a.push({ id, n }); }
  else if ((el = g('data-plopen'))) { return openUnit(el.dataset.plopen); }
  else if (g('data-acgo')) armyDoCounter();
  else if (g('data-acundo')) { if (armyPrev) { armySide = JSON.parse(armyPrev); armyPrev = null; armyNote = 'Restored your previous armies.'; } }
  else return;
  armySave(); pushHash(viewHash()); renderArmy();
}, true);

// "Build armies from this" on the Versus page: carry both units and their sizes over
document.addEventListener('click', e => {
  const b = e.target.closest('[data-vstoarmy]'); if (!b) return;
  e.stopPropagation(); armySide = [[{ id: vsA, n: vsNA }], [{ id: vsB, n: vsNB }]]; armySave(); setView('army'); pushHash(viewHash());
}, true);

document.addEventListener('change', e => {
  if (state.view !== 'army') return;
  const t = e.target;
  if (t.id === 'actar') armyCT = Number(t.value) ? 1 : 0;
  else if (t.id === 'acfac') armyCF = FACS.includes(t.value) ? t.value : 'Any';
  else if (t.id === 'acpct') armyCP = clamp(t.value, 10, 300);
  else return;
  renderArmy();
});
