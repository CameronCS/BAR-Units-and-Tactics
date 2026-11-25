// Faction equivalents: the three factions' units side by side, grouped by category, tech level and role.
// Roles are guessed from each unit's description (and, for buildings, its section), so the match is a guide, not an official pairing.
const EQ_ROLES = [
  ['Builders', /constructor|builder|engineer|construction|assist|rez|repair|reclaim|resurrect/i], ['Anti-air', /anti-air|\baa\b|air defen|flak|interceptor|fighter/i],
  ['Scouts and intel', /scout|radar|sonar|jammer|spy/i], ['Transports', /transport/i], ['Bombers', /bomber/i], ['Gunships', /gunship/i],
  ['Submarines', /submarine|torpedo/i], ['Artillery and missiles', /artillery|mortar|rocket|missile|plasma|howitzer|long.?range|launcher/i],
  ['Skirmishers and snipers', /skirmish|sniper|laser|beam/i], ['Raiders', /raider|fast|light|swarm|infantry/i], ['Assault and tanks', /assault|heavy|tank|battle|main|combat|riot|destroyer|cruiser|brawl|armored/i]
];
const eqRole = u => { if (u.cat === 'Buildings') return u._sec || 'Other'; const d = u.desc || ''; const r = EQ_ROLES.find(([, re]) => re.test(d)); return r ? r[0] : 'Other'; };
const eqState = { cat: 'Bots', tier: 'All', q: '' };
function eqLoad() {
  try {
    const s = JSON.parse(localStorage.getItem('barEq') || 'null');
    if (s) { if (['Bots', 'Vehicles', 'Hover', 'Air', 'Naval', 'Buildings'].includes(s.cat)) eqState.cat = s.cat; if (s.tier === 'All' || [1, 1.5, 2, 3].includes(s.tier)) eqState.tier = s.tier; }
  } catch (e) {}
}
const eqSave = () => { try { localStorage.setItem('barEq', JSON.stringify({ cat: eqState.cat, tier: eqState.tier })); } catch (e) {} };

function eqCell(list) {
  if (!list.length) return '<td class="none">No unit</td>';
  return `<td>${list.map(u => `<button class="eqc" data-plopen="${u.id}" style="--c:${FCOL[u.faction]}"><span class="art"><img loading="lazy" src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>
    <span><b>${u.name}</b><small>${fmt(u.metal)} metal, ${fmt(u.hp)} health${u._dps && !/com$/.test(u.id) ? ', ' + fmt(Math.round(u._dps)) + ' dps' : ''}${u._range ? ', range ' + fmt(u._range) : ''}${u.speed ? ', speed ' + fmt(u.speed) : ''}</small></span></button>`).join('')}</td>`;
}
function renderEquiv() {
  const q = eqState.q.trim().toLowerCase();
  const pool = U.filter(u => !u.exp && u.cat === eqState.cat && (eqState.tier === 'All' || u.tier === eqState.tier) && (!q || (u.name + ' ' + u.desc).toLowerCase().includes(q)) && (u.cat === 'Buildings' || builtBy[u.id] || /com$/.test(u.id)));
  const groups = new Map();
  pool.forEach(u => { const k = u.tier + '|' + eqRole(u); if (!groups.has(k)) groups.set(k, { tier: u.tier, role: eqRole(u), by: { Armada: [], Cortex: [], Legion: [] } }); groups.get(k).by[u.faction].push(u); });
  const rows = [...groups.values()].sort((a, b) => a.tier - b.tier || (a.role === 'Other') - (b.role === 'Other') || a.role.localeCompare(b.role));
  let tier = null, html = '';
  rows.forEach(g => {
    if (g.tier !== tier) { tier = g.tier; html += `<tr class="eqt"><th colspan="4">Tech ${g.tier}</th></tr>`; }
    Object.values(g.by).forEach(a => a.sort((x, y) => x.metal - y.metal));
    html += `<tr><th class="eqr">${g.role}</th>${FACS.map(f => eqCell(g.by[f])).join('')}</tr>`;
  });
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Faction equivalents</h2>
    <p class="gb">The three factions side by side. Units are grouped by tech level and role, which is guessed from each unit's description, so use it as a guide to what fills the same job.</p></div>
    <div class="eqbar"><div class="vsf">${['Bots', 'Vehicles', 'Hover', 'Air', 'Naval', 'Buildings'].map(c => `<button data-eqc="${c}" aria-pressed="${c === eqState.cat}">${c}</button>`).join('')}<i></i>${['All', 1, 1.5, 2, 3].map(t => `<button data-eqt="${t}" aria-pressed="${t === eqState.tier}">${t === 'All' ? 'All tiers' : 'T' + t}</button>`).join('')}</div>
      <input id="eqq" type="search" placeholder="Filter by name or description" value="${eqState.q.replace(/"/g, '&quot;')}" aria-label="Filter units"></div>
    ${rows.length ? `<div class="eqw"><table class="eqtab"><thead><tr><th></th>${FACS.map(f => `<th style="color:${FCOL[f]}">${f}</th>`).join('')}</tr></thead><tbody>${html}</tbody></table></div>` : '<p class="empty">Nothing matches. Try another category or clear the filter.</p>'}
    <p class="note">Each cell lists every unit of that faction in the group, cheapest first. Click a unit for its full page. Some roles only exist in one or two factions.</p>`;
}
document.addEventListener('click', e => {
  if (state.view !== 'equiv') return;
  const t = e.target, c = t.closest('[data-eqc]'), tr = t.closest('[data-eqt]'), p = t.closest('[data-plopen]');
  if (c) eqState.cat = c.dataset.eqc;
  else if (tr) eqState.tier = tr.dataset.eqt === 'All' ? 'All' : Number(tr.dataset.eqt);
  else if (p) { e.stopPropagation(); return openUnit(p.dataset.plopen); }
  else return;
  eqSave(); renderEquiv();
}, true);
document.addEventListener('input', e => {
  if (e.target.id !== 'eqq') return;
  eqState.q = e.target.value; const pos = e.target.selectionStart; renderEquiv(); const n = $('#eqq'); n.focus(); n.setSelectionRange(pos, pos);
});
