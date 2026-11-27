// Counter finder: list the units the enemy is making and get the best answers per metal spent.
// Score for a counter C against an enemy army = the metal-weighted average of Combat.E(C, enemy unit) over the army,
// so 2.0 means C gets about twice the value from its metal. Units that cannot hurt a type of enemy score 0 against it.
// Same estimates as Versus: no splash, no micro. "Covers" is the share of the enemy's metal the counter can hurt at all.
let ctrEnemy = [{ id: 'armpw', n: 10 }], ctrFac = 'All', ctrTier = 2, ctrMobile = false;
const ctrSave = () => store.set('barCtr', { e: ctrEnemy, f: ctrFac, t: ctrTier, m: ctrMobile });
function ctrLoad() {   // called by app.js once the unit data exists
  const s = store.get('barCtr', null); if (!s) return;
  if (Array.isArray(s.e)) { const e = s.e.filter(x => byId[x.id] && x.n > 0).map(x => ({ id: x.id, n: Math.min(999, Math.round(x.n)) })); if (e.length) ctrEnemy = e; }
  if (['All', ...FACS].includes(s.f)) ctrFac = s.f;
  if ([1, 1.5, 2, 3].includes(s.t)) ctrTier = s.t;
  ctrMobile = !!s.m;
}
const ctrEnc = () => ctrEnemy.map(x => x.id + ':' + x.n).join(',');
const ctrHash = () => '#counter/' + ctrEnc();
function ctrDec(s) {
  const e = (s || '').split(',').map(p => p.split(':')).filter(([id, n]) => byId[id] && +n > 0).map(([id, n]) => ({ id, n: Math.min(999, Math.round(+n)) }));
  if (e.length) ctrEnemy = e;
}

const ctrPool = () => U.filter(u => Combat.armed(u) && u.metal > 0 && builtBy[u.id] && u.tier <= ctrTier && (ctrFac === 'All' || u.faction === ctrFac) && (!ctrMobile || u.cat !== 'Buildings'));
function ctrScore(c, army) {
  let tot = 0, sum = 0, cov = 0;
  for (const x of army) { const u = byId[x.id], w = x.n * (u.metal || 1), e = Combat.E(c, u); tot += w; sum += w * e; if (Combat.dpsVs(c, u) > 0) cov += w; }
  return { score: tot ? sum / tot : 0, cover: tot ? cov / tot : 0 };
}
function ctrRank(army, limit) {
  return ctrPool().map(c => ({ c, ...ctrScore(c, army) })).filter(r => r.score > 0).sort((a, b) => b.score - a.score || b.cover - a.cover || a.c.metal - b.c.metal).slice(0, limit);
}
const ctrFmt = e => e >= Combat.CAPE ? '10+' : (Math.round(e * 10) / 10).toFixed(1);
const ctrChip = (c, e, sub) => `<button class="ctrc" data-ctrvs="${c.id}" style="--c:${FCOL[c.faction]}" title="Open ${c.name} against ${byId[ctrEnemy[0].id].name} in Versus">
  <span class="art"><img loading="lazy" src="img/${c.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>
  <span class="ctrt"><b>${c.name}</b><small>${c.faction}, tech ${c.tier}, ${fmt(c.metal)} metal${sub ? ', ' + sub : ''}</small></span><span class="ctre">${ctrFmt(e)}x</span></button>`;

function renderCounter() {
  const total = ctrEnemy.reduce((a, x) => a + x.n * (byId[x.id].metal || 0), 0);
  const top = ctrRank(ctrEnemy, 12);
  const per = ctrEnemy.map(x => {
    const u = byId[x.id], r = ctrPool().map(c => [c, Combat.E(c, u)]).filter(p => p[1] > 0).sort((a, b) => b[1] - a[1] || a[0].metal - b[0].metal).slice(0, 4);
    return `<div class="ctrp"><div class="ctrph"><b style="color:${FCOL[u.faction]}">${u.name}</b><small>${fmt(u.metal)} metal, ${fmt(u.hp)} health</small></div>
      <div class="ctrcol">${r.map(([c, e]) => ctrChip(c, e)).join('') || '<p class="note">Nothing in this pool can hurt it.</p>'}</div></div>`;
  }).join('');
  // gaps: enemy units no candidate in the pool can touch
  const gaps = ctrEnemy.filter(x => !ctrPool().some(c => Combat.dpsVs(c, byId[x.id]) > 0)).map(x => byId[x.id].name);
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Counters</h2>
    <p class="gb">Tell it what the enemy is building and it ranks the units that beat it best for the metal spent.</p></div>
    <div class="ctrbar"><span class="ctrh">Enemy army</span>
      ${ctrEnemy.map((x, i) => { const u = byId[x.id]; return `<span class="ctre1" style="--c:${FCOL[u.faction]}"><input type="number" min="1" max="999" value="${x.n}" data-ctrn="${i}" aria-label="Number of ${u.name}"><b>${u.name}</b><button data-ctrdel="${i}" aria-label="Remove ${u.name}">×</button></span>`; }).join('')}
      <button class="vsswap" id="ctradd">Add enemy unit</button>
      <span class="note" style="margin:0">${fmt(total)} metal in total</span></div>
    <div class="ctrbar"><span class="ctrh">Counter with</span>
      ${['All', ...FACS].map(f => `<button class="vsswap" data-ctrf="${f}" aria-pressed="${f === ctrFac}" style="--c:${FCOL[f] || '#f0b43c'}">${f}</button>`).join('')}<i></i>
      ${[[1, 'T1'], [1.5, 'T1.5'], [2, 'T2'], [3, 'Any tech']].map(([t, n]) => `<button class="vsswap" data-ctrt="${t}" aria-pressed="${t === ctrTier}">${n}</button>`).join('')}<i></i>
      <label class="vsrg"><input type="checkbox" id="ctrmob" ${ctrMobile ? 'checked' : ''}> Mobile units only</label>
      <button class="vsswap" data-share="ctr-link">Copy link</button></div>
    ${gaps.length ? `<p class="note ctrgap">Nothing in this pool can hurt ${gaps.join(', ')}. Widen the faction or tech filter.</p>` : ''}
    <h3 class="ctrsec">Best against the whole army</h3>
    <p class="note" style="margin:0 0 var(--s2)">The number is how much value each counter gets from its metal against the enemy's mix (2x means twice as much, 10x+ means the enemy cannot hit it back). Covers is how much of the enemy's metal it can hurt at all. Click one to fight it in Versus.</p>
    <div class="ctrcol wide">${top.map(r => ctrChip(r.c, r.score, `covers ${Math.round(r.cover * 100)}%`)).join('') || '<p class="empty">No counter found. Try a wider filter.</p>'}</div>
    <h3 class="ctrsec">Best against each unit</h3><div class="ctrgrid">${per}</div>
    <p class="note">Estimates from damage per armor class, health and cost. Splash damage, range tricks and micro are ignored, and ${Combat.range ? 'range and speed are included' : 'range and speed are left out'} (switch in Versus).</p>`;
}

document.addEventListener('click', e => {
  const t = e.target;
  if (state.view !== 'counter') return;
  const del = t.closest('[data-ctrdel]'); if (del) { if (ctrEnemy.length > 1) ctrEnemy.splice(+del.dataset.ctrdel, 1); ctrSave(); pushHash(ctrHash()); return renderCounter(); }
  const f = t.closest('[data-ctrf]'); if (f) { ctrFac = f.dataset.ctrf; ctrSave(); return renderCounter(); }
  const tt = t.closest('[data-ctrt]'); if (tt) { ctrTier = Number(tt.dataset.ctrt); ctrSave(); return renderCounter(); }
  const vs = t.closest('[data-ctrvs]'); if (vs) { vsA = vs.dataset.ctrvs; vsB = ctrEnemy[0].id; vsNA = 1; vsNB = 1; saveVs(); return setView('vs'); }
  if (t.closest('#ctradd')) {
    return pickUnits({ title: 'Add an enemy unit', pool: () => U.filter(u => u.hp > 0 && u.metal > 0 && u.cat !== 'Buildings' || (u.cat === 'Buildings' && Combat.armed(u))), hint: 'Click a unit to add one. Click again to add more.',
      onPick: id => { const ex = ctrEnemy.find(x => x.id === id); if (ex) ex.n = Math.min(999, ex.n + 1); else ctrEnemy.push({ id, n: 1 }); ctrSave(); pushHash(ctrHash()); renderCounter(); } });
  }
});
document.addEventListener('change', e => {
  if (state.view !== 'counter') return;
  if (e.target.id === 'ctrmob') { ctrMobile = e.target.checked; ctrSave(); return renderCounter(); }
  const n = e.target.closest && e.target.closest('[data-ctrn]');
  if (n) { ctrEnemy[+n.dataset.ctrn].n = Math.min(999, Math.max(1, Math.round(Number(n.value)) || 1)); ctrSave(); pushHash(ctrHash()); renderCounter(); }
});
