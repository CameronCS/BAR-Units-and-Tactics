// Versus: pick any two units and see how a fight between them plays out, using combat.js numbers.
let vsA = 'armpw', vsB = 'corak', vsNA = 10, vsNB = 10, vsPick = null, vsQ = '', vsPF = 'All', vsPC = 'All', vsPT = 'All';
function vsLoad() {   // called by app.js once the unit data exists
  try { const s = JSON.parse(localStorage.getItem('barVs') || 'null'); if (s && byId[s[0]] && byId[s[1]]) { vsA = s[0]; vsB = s[1]; } } catch (e) {}
}
const saveVs = () => { try { localStorage.setItem('barVs', JSON.stringify([vsA, vsB])); } catch (e) {} };
const VSC = ['#ffc857', '#5cc8ff'];
const vsFighters = () => U.filter(u => Combat.armed(u));
const vsKind = b => b.fly ? 'air' : b.ac === 'subs' ? 'sub' : b.cat === 'Naval' ? 'ship' : 'land';

function vsWeapons(a, b) {
  const k = vsKind(b);
  if (!(a.weapons || []).length) return '<p class="note">No weapons.</p>';
  return `<ul class="vsw">${a.weapons.map(w => {
    const ok = Combat.canHit(w, k), m = Combat.mult(w, b.ac), d = w.reload ? m * w.count / w.reload : 0;
    return `<li class="${ok && m ? '' : 'no'}"><span>${w.n}${w.count > 1 ? ' x' + w.count : ''}</span><b>${!ok ? 'cannot target' : !m ? 'no damage' : fmt(Math.round(d * 10) / 10) + ' dps'}</b></li>`;
  }).join('')}</ul>`;
}

// a tug-of-war row: each side's bar grows out from the middle, the better side is lit
function vsRow(label, x, y, o = {}) {
  const f = o.f || (v => fmt(Math.round(v * 10) / 10)), low = o.low;
  const ok = v => isFinite(v) && v > 0;
  const m = Math.max(ok(x) ? x : 0, ok(y) ? y : 0) || 1;
  const w = v => ok(v) ? Math.max(3, Math.round(v / m * 100)) : 0;
  let win = 0;
  if (x !== y) win = low ? (ok(x) && (!ok(y) || x < y) ? 1 : 2) : (x > y ? 1 : 2);
  if (o.nowin) win = 0;
  return `<div class="vsr"><span class="a${win === 1 ? ' w' : ''}">${isFinite(x) ? f(x) : 'never'}</span>
    <span class="bar l"><i style="width:${w(x)}%;background:${VSC[0]}"></i></span><span class="lb">${label}</span><span class="bar r"><i style="width:${w(y)}%;background:${VSC[1]}"></i></span>
    <span class="b${win === 2 ? ' w' : ''}">${isFinite(y) ? f(y) : 'never'}</span></div>`;
}

function fightHtml(a, b) {
  const en = Combat.engage(a, b), raw = Combat.engage(a, b, false), dab = en.dab, dba = en.dba;
  const ttkA = dab ? en.hpB / dab : Infinity, ttkB = dba ? en.hpA / dba : Infinity;   // seconds for A to kill B and the reverse (after any free shots)
  let verdict, sub = '', share = 50, win = 0;
  if (!dab && !dba) verdict = 'Neither unit can hurt the other';
  else if (!dba) verdict = `${a.name} wins`, sub = `${b.name} cannot shoot back`, share = 100, win = 1;
  else if (!dab) verdict = `${b.name} wins`, sub = `${a.name} cannot shoot back`, share = 0, win = 2;
  else {
    const sa = dab * en.hpA, sb = dba * en.hpB; share = Math.round(sa / (sa + sb) * 100);
    if (Math.abs(ttkA - ttkB) / Math.max(ttkA, ttkB) < .03) verdict = 'Dead even one on one';
    else {
      win = ttkA < ttkB ? 1 : 2;
      const w = win === 1 ? a : b, left = Math.round((1 - Math.min(ttkA, ttkB) / Math.max(ttkA, ttkB)) * 100);
      verdict = `${w.name} wins one on one`; sub = `with about ${left}% of its health left`;
    }
  }
  // armies of the chosen sizes (Lanchester square law)
  let army = '';
  const na = vsNA, nb = vsNB, ma = na * (a.metal || 0), mb = nb * (b.metal || 0);
  const head = `<p><b style="color:${VSC[0]}">${na} ${a.name}</b> (${fmt(ma)} metal) fight <b style="color:${VSC[1]}">${nb} ${b.name}</b> (${fmt(mb)} metal).</p>`;
  if (dab && dba) {
    const ka = dab / en.hpB, kb = dba / en.hpA, sa = ka * na * na, sb = kb * nb * nb;
    const w = sa >= sb ? a : b, nw = sa >= sb ? na : nb, left = nw * Math.sqrt(1 - Math.min(sa, sb) / Math.max(sa, sb)), kept = Math.round(left);
    const need = Math.sqrt(kb / ka);
    army = `<div class="vsarmy"><div class="ah">Army fight</div>${head}
      ${Math.abs(sa - sb) / Math.max(sa, sb) < .01 ? '<p>An even fight: both armies are wiped out.</p>'
        : `<p><b style="color:${VSC[w === a ? 0 : 1]}">${w.name}</b> wins with ${kept ? `about <b>${kept}</b> of ${nw} left` : 'less than one unit left'} (${Math.round(left / nw * 100)}% of its army).</p>`}
      <p class="mute">In a big fight one ${b.name} is worth about ${fmt(Math.round(need * 100) / 100)} ${a.name}.</p></div>`;
  } else if (dab || dba) army = `<div class="vsarmy"><div class="ah">Army fight</div>${head}<p>${dab ? a.name : b.name} wins and loses nothing because the other cannot shoot back.</p></div>`;
  // range and speed: who gets free shots, and does it change the result?
  let rangeNote = '';
  const free = (w, l, t) => t >= 1e8 ? `${w.name} outranges ${l.name}, which cannot move to close the gap, so it fires without being hit back until it dies` : `${w.name} outranges ${l.name} and gets about ${fmt(Math.round(t * 10) / 10)}s of free shooting while it closes in`;
  if (Combat.range) {
    if (en.tfA > 0) rangeNote = free(a, b, en.tfA); else if (en.tfB > 0) rangeNote = free(b, a, en.tfB);
    const rw = raw.dab && raw.dba ? (b.hp / raw.dab < a.hp / raw.dba ? a : b) : null, nw = win === 1 ? a : win === 2 ? b : null;
    if (rangeNote && rw && nw && rw !== nw) rangeNote += `. Range flips this fight: on stats alone ${rw.name} wins`;
    if (rangeNote) rangeNote += '.';
  }
  return `<div class="vsverd" data-w="${win}"><div class="vsmeter"><i style="width:${share}%;background:${VSC[0]}"></i><i style="width:${100 - share}%;background:${VSC[1]}"></i></div>
      <h3>${verdict}</h3>${sub ? `<p>${sub}</p>` : ''}</div>
    <div class="vstab">
      ${vsRow('Damage per second against the other', dab, dba)}
      ${vsRow('Seconds to kill the other', ttkA, ttkB, { low: true })}
      ${vsRow('Health', a.hp, b.hp)}${vsRow('Metal cost', a.metal, b.metal, { low: true })}
      ${vsRow('Range', a._range, b._range)}${vsRow('Speed', a.speed, b.speed)}
    </div>
    ${army}
    <div class="vscols"><div><h4 style="color:${VSC[0]}">${a.name} against ${b.name}</h4>${vsWeapons(a, b)}</div><div><h4 style="color:${VSC[1]}">${b.name} against ${a.name}</h4>${vsWeapons(b, a)}</div></div>
    ${rangeNote ? `<p class="vsrng">${rangeNote}</p>` : ''}
    <p class="note">${Combat.range ? 'Range and speed are included: the side with longer range gets free shots while the other closes in.' : 'Range and speed are left out.'} Both sides fire the whole time. Splash damage and micro are ignored.</p>`;
}

function vsSlot(u, k) {
  return `<button class="vsc" data-pick="${k}" style="--c:${FCOL[u.faction]};--s:${VSC[k]}" aria-label="Change unit ${k ? 'B' : 'A'}">
    <span class="art"><img src="img/lg/${u.id}.webp" alt="" onerror="this.onerror=null;this.src='img/${u.id}.webp'"></span>
    <span class="vt"><small>Unit ${k ? 'B' : 'A'}</small><b>${u.name}</b><em>${u.faction}, tech ${u.tier}</em><span class="vd">${u.desc || ''}</span></span>
    <span class="vchg">Change</span></button>`;
}

function vsSuggest(a) {
  const ct = Combat.counters(a);
  const seen = new Set(), out = [];
  for (const f of ['Armada', 'Cortex', 'Legion']) for (const [c] of [...ct[f].mobile, ...ct[f].fixed]) if (!seen.has(c.id) && out.length < 8) { seen.add(c.id); out.push(c); }
  return out;
}

function renderVs() {
  const a = byId[vsA], b = byId[vsB], sg = vsSuggest(a);
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Versus</h2>
    <p class="gb">Choose two units and see who wins. Click a unit to swap it for another.</p></div>
    <div class="vshead">${vsSlot(a, 0)}<div class="vsmid"><span>VS</span><button class="vsswap" id="vsswap" aria-label="Swap units" title="Swap sides">Swap</button><button class="vsswap" id="vsrand">Random</button></div>${vsSlot(b, 1)}</div>
    ${sg.length ? `<div class="vssug"><span>Try ${a.name} against</span>${sg.map(c => `<button data-vsb="${c.id}" aria-pressed="${c.id === vsB}" style="--c:${FCOL[c.faction]}">${c.name}</button>`).join('')}</div>` : ''}
    <div class="vsbud"><label><span style="color:${VSC[0]}">${a.name}</span> <input type="number" id="vsna" min="1" max="999" value="${vsNA}"></label>
      <span>against</span><label><span style="color:${VSC[1]}">${b.name}</span> <input type="number" id="vsnb" min="1" max="999" value="${vsNB}"></label>
      <button class="vsswap" id="vseq">Match metal</button>
      <label class="vsrg"><input type="checkbox" id="vsrange" ${Combat.range ? 'checked' : ''}> Include range and speed</label></div>
    <div class="vsshare"><button class="vsswap" data-share="vs-link">Copy link</button><button class="vsswap" data-share="vs-text">Copy as text</button><button class="vsswap" data-vstoarmy="1">Build armies from this</button></div>
    <div id="vsout">${fightHtml(a, b)}</div>`;
}

// ---- unit picker --------------------------------------------------------------
const VSCATS = [['All', () => true], ['Bots', u => u.cat === 'Bots'], ['Vehicles', u => u.cat === 'Vehicles'], ['Hover', u => u.cat === 'Hover'], ['Air', u => u.cat === 'Air'], ['Naval', u => u.cat === 'Naval'], ['Defenses', u => u.cat === 'Buildings']];
function vsPickList() {
  const q = vsQ.trim().toLowerCase(), cat = VSCATS.find(c => c[0] === vsPC)[1];
  const l = vsFighters().filter(u => (vsPF === 'All' || u.faction === vsPF) && (vsPT === 'All' || u.tier === vsPT) && cat(u) && (!q || (u.name + ' ' + u.desc + ' ' + u.id).toLowerCase().includes(q)))
    .sort((x, y) => x.tier - y.tier || x.name.localeCompare(y.name));
  return `<div class="vsgrid">${l.slice(0, 150).map(u => `<button class="vsu" data-vspick="${u.id}" style="--c:${FCOL[u.faction]}"><span class="art"><img loading="lazy" src="img/${u.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>
      <span><b>${u.name}</b><small>${u.faction}, tech ${u.tier}, ${fmt(u.metal)} metal</small></span></button>`).join('') || '<p class="empty">No unit matches. Try a different name or filter.</p>'}</div>${l.length > 150 ? `<p class="note">Showing 150 of ${l.length}. Type to narrow it down.</p>` : ''}`;
}
function openPicker(k) {
  vsPick = k; vsQ = ''; let m = $('#vsmodal');
  if (!m) { m = document.createElement('div'); m.id = 'vsmodal'; m.className = 'vsmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Choose a unit'); document.body.appendChild(m); }
  m.innerHTML = `<div class="vsbox"><div class="vsbh"><h3>Choose unit ${k ? 'B' : 'A'}</h3><button class="xb" id="vsclose" aria-label="Close">×</button></div>
    <input id="vsq" type="search" placeholder="Search by name" autocomplete="off" aria-label="Search units">
    <div class="vsf" id="vsff">${vsFilters()}</div><div id="vslist">${vsPickList()}</div></div>`;
  m.hidden = false; $('#vsq').focus();
}
function vsFilters() {
  return ['All', ...FACS].map(f => `<button data-vsf="${f}" aria-pressed="${f === vsPF}" style="--c:${FCOL[f] || '#f0b43c'}">${f}</button>`).join('') + '<i></i>' +
    ['All', 1, 1.5, 2, 3].map(t => `<button data-vst="${t}" aria-pressed="${t === vsPT}">${t === 'All' ? 'All tiers' : 'T' + t}</button>`).join('') + '<i></i>' +
    VSCATS.map(([c]) => `<button data-vsc="${c}" aria-pressed="${c === vsPC}">${c}</button>`).join('');
}
function closePicker() { const m = $('#vsmodal'); if (m) m.hidden = true; vsPick = null; }
function setFighter(id) {
  if (vsPick === 0) vsA = id; else vsB = id;
  if (vsA === vsB) { /* same unit on both sides is allowed: a mirror match */ }
  saveVs(); closePicker(); pushHash(viewHash()); renderVs();
}

document.addEventListener('input', e => { if (e.target.id === 'vsq') { vsQ = e.target.value; $('#vslist').innerHTML = vsPickList(); } });
document.addEventListener('change', e => {
  if (state.view !== 'vs' || (e.target.id !== 'vsna' && e.target.id !== 'vsnb')) return;
  const v = Math.min(999, Math.max(1, Math.round(Number(e.target.value)) || 1));
  if (e.target.id === 'vsna') vsNA = v; else vsNB = v;
  renderVs();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && vsPick !== null) { e.stopPropagation(); closePicker(); } }, true);
document.addEventListener('click', e => {
  const t = e.target;
  if (vsPick !== null) {
    if (t.closest('#vsclose') || t.id === 'vsmodal') return closePicker();
    const u = t.closest('[data-vspick]'); if (u) return setFighter(u.dataset.vspick);
    const f = t.closest('[data-vsf]'), c = t.closest('[data-vsc]'), tt = t.closest('[data-vst]');
    if (f || c || tt) { if (f) vsPF = f.dataset.vsf; else if (tt) vsPT = tt.dataset.vst === 'All' ? 'All' : Number(tt.dataset.vst); else vsPC = c.dataset.vsc; $('#vsff').innerHTML = vsFilters(); $('#vslist').innerHTML = vsPickList(); return; }
  }
  if (state.view === 'vs') {
    const p = t.closest('[data-pick]'); if (p) return openPicker(Number(p.dataset.pick));
    const s = t.closest('[data-vsb]'); if (s) { vsB = s.dataset.vsb; saveVs(); pushHash(viewHash()); return renderVs(); }
    if (t.closest('#vseq')) { const A = byId[vsA], B = byId[vsB]; vsNB = Math.min(999, Math.max(1, Math.round(vsNA * (A.metal || 1) / (B.metal || 1)))); return renderVs(); }
    if (t.closest('#vsswap')) { [vsA, vsB] = [vsB, vsA]; [vsNA, vsNB] = [vsNB, vsNA]; saveVs(); pushHash(viewHash()); return renderVs(); }
    if (t.closest('#vsrand')) {
      const pool = vsFighters().filter(u => u.cat !== 'Buildings'), x = pool[Math.floor(Math.random() * pool.length)];
      const mates = pool.filter(u => u.id !== x.id && Math.abs(u.tier - x.tier) <= .5 && Math.abs(Math.log((u.metal || 1) / (x.metal || 1))) < .7);
      vsA = x.id; vsB = (mates[Math.floor(Math.random() * mates.length)] || pool[0]).id; saveVs(); pushHash(viewHash()); return renderVs();
    }
  }
  const f = t.closest('[data-vsfight]');    // "Fight another unit" button in a unit panel
  if (f) { e.stopPropagation(); vsA = f.dataset.vsfight; if (vsB === vsA) vsB = vsA === 'armpw' ? 'corak' : 'armpw'; saveVs(); closeUnit(true); setView('vs'); }
}, true);

// the "include range and speed" switch, here and in the unit panel
document.addEventListener('change', e => {
  if (e.target.id !== 'vsrange' && e.target.id !== 'rangeTog') return;
  Combat.setRange(e.target.checked);
  if (state.view === 'vs') renderVs(); else if (state.view === 'units') render();
  if (e.target.id === 'rangeTog' && hist.length) show(hist[hist.length - 1]);
});
