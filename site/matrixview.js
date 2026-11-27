// Matchup matrix: a grid of units against each other. Each cell is Combat.E(row, column): how much value the row unit
// gets from its metal when fighting the column unit (2 = twice as much, 0.5 = half). Green favours the row, red the column.
// Same estimates as Versus: cost-matched, no splash, no micro.
let mxIds = ['armpw', 'corak', 'leggob', 'armflash', 'corgator', 'armham'];
const MXMAX = 14;
const mxSave = () => store.set('barMx', mxIds);
function mxLoad() {   // called by app.js once the unit data exists
  const s = store.get('barMx', null); if (Array.isArray(s)) { const l = s.filter(id => byId[id]).slice(0, MXMAX); if (l.length >= 2) mxIds = l; else if (!byId[mxIds[0]]) mxIds = U.filter(u => Combat.armed(u) && builtBy[u.id]).slice(0, 6).map(u => u.id); }
  mxIds = mxIds.filter(id => byId[id]);
}
const mxHash = () => '#matrix/' + mxIds.join(',');
function mxDec(s) { const l = (s || '').split(',').filter(id => byId[id]).slice(0, MXMAX); if (l.length >= 2) mxIds = l; }

const MXPRE = [['T1 bots', u => u.cat === 'Bots' && u.tier === 1], ['T1 vehicles', u => u.cat === 'Vehicles' && u.tier === 1], ['T2 bots', u => u.cat === 'Bots' && u.tier === 2],
  ['T2 vehicles', u => u.cat === 'Vehicles' && u.tier === 2], ['T1 air', u => u.cat === 'Air' && u.tier === 1], ['T1 ships', u => u.cat === 'Naval' && u.tier === 1 && u.ac !== 'subs'], ['Hovercraft', u => u.cat === 'Hover']];
function mxPreset(i) {
  const test = MXPRE[i][1];
  mxIds = U.filter(u => test(u) && Combat.armed(u) && builtBy[u.id] && u.metal > 0).sort((a, b) => a.metal - b.metal).slice(0, MXMAX).map(u => u.id);
  if (mxIds.length < 2) mxIds = U.filter(u => Combat.armed(u) && builtBy[u.id]).slice(0, 6).map(u => u.id);
}
function mxCell(a, b) {
  if (a.id === b.id) return '<td class="mxs" title="Same unit">=</td>';
  const e = Combat.E(a, b);
  const tip = `${a.name} against ${b.name}: ${e ? 'about ' + (Math.round(e * 100) / 100) + 'x value' : 'cannot hurt it'}`;
  if (!e) return `<td class="mxn" data-mxa="${a.id}" data-mxb="${b.id}" title="${tip}">0</td>`;
  const l = Math.max(-2, Math.min(2, Math.log2(e))), al = Math.min(.85, Math.abs(l) / 2 * .8 + .08);
  const bg = l >= 0 ? `rgba(111,224,154,${al})` : `rgba(255,138,120,${al})`;
  return `<td data-mxa="${a.id}" data-mxb="${b.id}" style="background:${bg}" title="${tip}">${e >= Combat.CAPE ? '10+' : e >= 10 ? Math.round(e) : (Math.round(e * 10) / 10).toFixed(1)}</td>`;
}
function renderMatrix() {
  const L = mxIds.map(id => byId[id]);
  // overall score: metal-weighted average value against every other unit in the grid
  const avg = a => { const o = L.filter(b => b.id !== a.id); return o.reduce((s, b) => s + Math.log(Math.max(.05, Combat.E(a, b))), 0) / (o.length || 1); };
  const rank = [...L].map(u => [u, Math.exp(avg(u))]).sort((x, y) => y[1] - x[1]);
  const head = u => `<span class="mxh" style="--c:${FCOL[u.faction]}"><img src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"><b>${u.name}</b></span>`;
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Matchup matrix</h2>
    <p class="gb">Every unit against every other. Read across: green means the unit on the left wins on value, red means the one on top does.</p></div>
    <div class="ctrbar"><span class="ctrh">Units</span>
      ${L.map((u, i) => `<span class="ctre1" style="--c:${FCOL[u.faction]}"><b>${u.name}</b><button data-mxdel="${i}" aria-label="Remove ${u.name}">×</button></span>`).join('')}
      ${L.length < MXMAX ? '<button class="vsswap" id="mxadd">Add unit</button>' : ''}</div>
    <div class="ctrbar"><span class="ctrh">Start from</span>${MXPRE.map(([n], i) => `<button class="vsswap" data-mxpre="${i}">${n}</button>`).join('')}<button class="vsswap" data-share="mx-link">Copy link</button></div>
    <div class="plcw"><table class="mxt"><thead><tr><th></th>${L.map(u => `<th>${head(u)}</th>`).join('')}<th class="mxo">Overall</th></tr></thead>
      <tbody>${L.map(a => `<tr><th>${head(a)}</th>${L.map(b => mxCell(a, b)).join('')}<td class="mxo">${(Math.round(Math.exp(avg(a)) * 100) / 100).toFixed(2)}x</td></tr>`).join('')}</tbody></table></div>
    <p class="note">Each cell is the value the unit on the left gets from its metal against the unit on top, from the same estimates as Versus. 1.0 is even, 2.0 is twice the value, 0 means it cannot hurt it. Overall is the geometric average of a row. Click a cell to see that fight in Versus.</p>
    <p class="note">Best overall in this grid: <b>${rank[0][0].name}</b>. Weakest: <b>${rank[rank.length - 1][0].name}</b>. Splash damage and micro are ignored, and ${Combat.range ? 'range and speed are included' : 'range and speed are left out'} (switch in Versus).</p>`;
}
document.addEventListener('click', e => {
  if (state.view !== 'matrix') return;
  const t = e.target;
  const d = t.closest('[data-mxdel]'); if (d) { if (mxIds.length > 2) mxIds.splice(+d.dataset.mxdel, 1); mxSave(); pushHash(mxHash()); return renderMatrix(); }
  const p = t.closest('[data-mxpre]'); if (p) { mxPreset(+p.dataset.mxpre); mxSave(); pushHash(mxHash()); return renderMatrix(); }
  const c = t.closest('td[data-mxa]'); if (c) { vsA = c.dataset.mxa; vsB = c.dataset.mxb; vsNA = 1; vsNB = 1; saveVs(); return setView('vs'); }
  if (t.closest('#mxadd')) pickUnits({ title: 'Add a unit to the matrix', pool: () => U.filter(u => Combat.armed(u) && u.metal > 0 && !mxIds.includes(u.id)), hint: 'Click a unit to add it.', close: true,
    onPick: id => { if (!mxIds.includes(id) && mxIds.length < MXMAX) mxIds.push(id); mxSave(); pushHash(mxHash()); renderMatrix(); } });
});
