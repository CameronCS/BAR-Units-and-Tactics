// Compare up to three units side by side. Pick units with the + button on a card (or in a unit panel), then open the tray at the bottom.
const CMP_MAX = 3, CMP_COL = ['#ffc857', '#5cc8ff', '#ff7a6b'];
let cmp = [];
function loadCmp() {   // called once by app.js after the unit data exists
  try { cmp = JSON.parse(localStorage.getItem('barCmp') || '[]').filter(id => byId[id]).slice(0, CMP_MAX); } catch (e) { cmp = []; }
}
const saveCmp = () => { try { localStorage.setItem('barCmp', JSON.stringify(cmp)); } catch (e) {} };

function toggleCmp(id) {
  if (cmp.includes(id)) cmp = cmp.filter(x => x !== id);
  else if (cmp.length < CMP_MAX) cmp.push(id);
  else { cmp.shift(); cmp.push(id); }   // a full tray drops the oldest pick
  saveCmp(); renderTray();
}
function renderTray() {
  const t = $('#tray');
  t.hidden = cmp.length === 0;
  t.innerHTML = cmp.length ? `<div class="tin"><span class="tl">Compare</span>
    ${cmp.map(id => `<span class="tchip" style="--c:${FCOL[byId[id].faction]}"><img src="img/${id}.webp" alt="">${byId[id].name}<button data-cmp="${id}" aria-label="Remove ${byId[id].name}">×</button></span>`).join('')}
    <button class="tgo" id="cmpgo"${cmp.length < 2 ? ' disabled' : ''}>${cmp.length < 2 ? 'Add one more to compare' : 'Compare ' + cmp.length + ' units'}</button>
    <button class="tclr" id="cmpclr">Clear</button></div>` : '';
  document.querySelectorAll('[data-cmp].cmpb, [data-cmp].cmpbig').forEach(b => {
    const on = cmp.includes(b.dataset.cmp);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    if (b.classList.contains('cmpbig')) b.textContent = on ? 'In comparison' : 'Add to compare';
    else b.textContent = on ? '✓' : '+';
  });
}

// ---- the comparison panel --------------------------------------------------
const ROWS = [
  ['Metal cost', u => u.metal, 'low', 'metal'], ['Energy cost', u => u.energy, 'low', 'energy'], ['Build time', u => u.bt, 'low', 'bt'],
  ['Default build time', u => { const d = defaultBuildTime(u); return d ? d.t : null; }, 'low', null, v => clock(v)],
  ['Health', u => u.hp, 'high', 'hp'], ['Speed', u => u.speed, 'high', 'speed'], ['Sight', u => u.los, 'high', 'los'],
  ['Damage per second', u => u._dps, 'high', 'dps'], ['Range', u => u._range, 'high', 'range'],
  ['Health per metal', u => u.metal ? u.hp / u.metal : null, 'high'], ['Damage per metal', u => u.metal && u._dps ? u._dps / u.metal : null, 'high']
];
function radarMulti(us) {
  const axes = [['Health', u => u.hp, CAP.hp], ['DPS', u => u._dps, CAP.dps], ['Range', u => u._range, CAP.range], ['Sight', u => u.los, CAP.los], ['Speed', u => u.speed, CAP.speed]];
  const cx = 160, cy = 150, R = 100;
  const pt = (i, f) => { const a = (-90 + i * 72) * Math.PI / 180; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const ring = f => `<polygon points="${axes.map((_, i) => pt(i, f).join(',')).join(' ')}" fill="none" stroke="var(--line)"/>`;
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`; }).join('');
  const polys = us.map((u, k) => {
    const v = axes.map(([, f, c], i) => pt(i, Math.max(.04, Math.min(1, Math.sqrt((f(u) || 0) / c)))));
    return `<polygon points="${v.map(p => p.join(',')).join(' ')}" fill="${CMP_COL[k]}" fill-opacity=".22" stroke="${CMP_COL[k]}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }).join('');
  const labels = axes.map(([n], i) => { const [x, y] = pt(i, 1.28); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="var(--mute)" font-size="12">${n}</text>`; }).join('');
  return `<svg viewBox="0 0 320 300" role="img" aria-label="Balance chart comparing the selected units">${[.25, .5, .75, 1].map(ring).join('')}${spokes}${polys}${labels}</svg>`;
}
function openCompare() {
  const us = cmp.map(id => byId[id]).filter(Boolean);
  if (us.length < 2) return;
  const cols = `grid-template-columns:150px repeat(${us.length},minmax(150px,1fr))`;
  const head = us.map((u, k) => `<div class="cvh" style="--c:${CMP_COL[k]}"><div class="art" style="--c:${FCOL[u.faction]}"><img src="img/lg/${u.id}.webp" alt="" onerror="this.onerror=null;this.src='img/${u.id}.webp'"></div>
      <h3>${u.name}</h3><div class="cvs">${u.faction}, tech ${u.tier}</div><div class="cvd">${u.desc || ''}</div>
      <a class="cvopen" data-open="${u.id}" tabindex="0">Open details</a></div>`).join('');
  const rows = ROWS.map(([label, f, best, cap, show]) => {
    const vals = us.map(f), nums = vals.filter(v => v != null && v > 0);
    if (!nums.length) return '';
    const max = Math.max(...nums), win = best === 'low' ? Math.min(...nums) : max;
    const dup = nums.filter(v => v === win).length > 1;
    return `<div class="cvr" style="${cols}"><div class="cvl">${label}</div>${vals.map((v, k) => {
      const w = v > 0 ? Math.max(4, Math.round(v / max * 100)) : 0, isBest = v > 0 && v === win && !dup && us.length > 1;
      return `<div class="cvc${isBest ? ' best' : ''}"><span class="cvb"><i style="width:${w}%;background:${CMP_COL[k]}"></i></span><b>${v > 0 ? (show ? show(v) : fmt(v)) : '–'}</b></div>`;
    }).join('')}</div>`;
  }).join('');
  const mus = us.map((u, k) => { const m = matchups(u); return `<div class="cvc mus" style="--c:${CMP_COL[k]}">${m.S.slice(0, 3).map(x => `<span class="pill s">${short(x)}</span>`).join('')}${m.W.slice(0, 3).map(x => `<span class="pill w">${short(x)}</span>`).join('')}</div>`; }).join('');
  $('#dbody').innerHTML = `<div class="cv">
    <div class="uvtop"><span></span><button class="xb" id="xb" aria-label="Close">×</button></div>
    <h2 class="mh">Compare</h2><p class="mby">The highlighted value is the best of the group: lowest for costs, highest for everything else. Bars are scaled to the largest value in each row.</p>
    <div class="cvscroll"><div class="cvgrid">
      <div class="cvr cvhead" style="${cols}"><div></div>${head}</div>
      <div class="cvr" style="${cols}"><div class="cvl">Balance chart</div><div class="cvradar" style="grid-column:2/-1"><div class="radar">${radarMulti(us)}</div>
        <div class="cvleg">${us.map((u, k) => `<span><i style="background:${CMP_COL[k]}"></i>${u.name}</span>`).join('')}</div></div></div>
      ${rows}
      <div class="cvr" style="${cols}"><div class="cvl">Strong and weak against</div>${mus}</div>
    </div></div></div>`;
  lastFocus = document.activeElement; hist = [];
  $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  $('#drawer').scrollTo(0, 0); $('#xb').focus({ preventScroll: true });
  pushHash('#compare/' + us.map(u => u.id).join(','));
}

// ---- events ----------------------------------------------------------------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-cmp]');
  if (t) { e.stopPropagation(); toggleCmp(t.dataset.cmp); return; }
  if (e.target.closest('#cmpgo')) return openCompare();
  if (e.target.closest('#cmpclr')) { cmp = []; saveCmp(); renderTray(); return; }
  const o = e.target.closest('[data-open]');
  if (o && e.target.closest('#dbody')) { hist = [o.dataset.open]; show(o.dataset.open); }
}, true);
