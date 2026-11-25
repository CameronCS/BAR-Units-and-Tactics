// Balance changes: what moved in BAR's unit data between two commits. The data comes from tools/changelog.py.
const CHG = window.CHANGES || [];
let chgI = 0, chgF = 'All', chgK = 'all';
const CLAB = { metal: 'Metal cost', energy: 'Energy cost', bt: 'Build time', hp: 'Health', speed: 'Speed', los: 'Sight', worker: 'Build power', dps: 'Damage per second', range: 'Range', ac: 'Armor class', build: 'Build options' };
const LOWER = new Set(['metal', 'energy', 'bt']);   // for these a smaller number is the better one
const dirOf = f => {
  if (f[0] === 'build' || f[0] === 'ac') return 0;
  const d = f[2] - f[1]; if (!d) return 0;
  return (LOWER.has(f[0]) ? -d : d) > 0 ? 1 : -1;
};
function verdict(c) {
  const d = c.f.map(dirOf), up = d.filter(x => x > 0).length, dn = d.filter(x => x < 0).length;
  return up && dn ? 'mixed' : up ? 'buff' : dn ? 'nerf' : 'change';
}
const VERD = { buff: 'Buff', nerf: 'Nerf', mixed: 'Mixed', change: 'Changed', new: 'New', gone: 'Removed' };
const nm = id => byId[id] ? byId[id].name : id;
function changeItem(f) {
  const [k, a, b] = f, d = dirOf(f), cls = d > 0 ? 'up' : d < 0 ? 'dn' : 'ne';
  if (k === 'build') return `<li class="ne"><span class="k">Build options</span><span class="v">${a.length ? 'Added ' + a.map(nm).join(', ') : ''}${a.length && b.length ? '. ' : ''}${b.length ? 'Removed ' + b.map(nm).join(', ') : ''}</span></li>`;
  if (k === 'ac') return `<li class="ne"><span class="k">Armor class</span><span class="v">${ACN[a] || 'Standard'} to ${ACN[b] || 'Standard'}</span></li>`;
  const pc = a > 0 ? Math.round((b - a) / a * 1000) / 10 : null;
  return `<li class="${cls}"><span class="k">${CLAB[k]}</span><span class="v">${fmt(a)} to ${fmt(b)}</span>${pc == null ? '' : `<em>${pc > 0 ? '+' : ''}${pc}%</em>`}</li>`;
}
const chgUnit = c => {
  const u = byId[c.id], v = c.kind;
  return `<div class="chg" data-v="${v}" style="--c:${FCOL[c.faction]}">
    <button class="cu" data-cu="${c.id}"${u ? '' : ' disabled'}><span class="art"><img loading="lazy" src="img/${c.id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>
      <span class="cn"><b>${c.name}</b><small>${c.faction}${u ? ', tech ' + u.tier : ''}</small></span></button>
    <span class="vd">${VERD[v]}</span>
    ${c.f ? `<ul class="chgl">${c.f.map(changeItem).join('')}</ul>` : '<span></span>'}</div>`;
};

function renderChanges() {
  const head = `<div class="mhead"><h2 class="gh">Balance changes</h2>`;
  if (!CHG.length) {
    $('#grid').innerHTML = head + `<p class="gb">No updates have been recorded yet.</p></div>
      <p class="note">After a BAR patch, run <b>python tools/build.py --refresh</b>. The differences from your previous build show up here.</p>`;
    return;
  }
  const h = CHG[Math.min(chgI, CHG.length - 1)];
  const url = `https://github.com/beyond-all-reason/Beyond-All-Reason/compare/${h.from.sha}...${h.to.sha}`;
  const all = [...h.changed.map(c => ({ ...c, kind: verdict(c) })), ...h.added.map(c => ({ ...c, kind: 'new' })), ...h.removed.map(c => ({ ...c, kind: 'gone' }))];
  const inF = c => chgF === 'All' || c.faction === chgF;
  const cnt = k => all.filter(c => inF(c) && (k === 'all' || c.kind === k)).length;
  const list = all.filter(c => inF(c) && (chgK === 'all' || c.kind === chgK)).sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));
  const kinds = [['all', 'Everything'], ['buff', 'Buffs'], ['nerf', 'Nerfs'], ['mixed', 'Mixed'], ['new', 'New'], ['gone', 'Removed']];
  $('#grid').innerHTML = `${head}<p class="gb">Unit changes between BAR on <b>${h.from.date}</b> and <b>${h.to.date}</b>: costs, health, speed, sight, damage, range and build options. <a target="_blank" rel="noopener" href="${url}">See every change on GitHub</a>.</p></div>
    <div class="gnav" style="margin-top:var(--s4)">
      <div class="seg2">${['All', ...FACS].map(x => `<button data-chf="${x}" aria-pressed="${x === chgF}" style="--c:${FCOL[x] || '#f0b43c'}">${x}</button>`).join('')}</div>
      <div class="seg2">${kinds.map(([k, t]) => `<button data-chk="${k}" aria-pressed="${k === chgK}">${t}<small class="n">${cnt(k)}</small></button>`).join('')}</div>
      ${CHG.length > 1 ? `<label class="chsel">Update <select id="chsel">${CHG.map((x, i) => `<option value="${i}"${i === chgI ? ' selected' : ''}>${x.from.date} to ${x.to.date}</option>`).join('')}</select></label>` : ''}
    </div>
    <div class="chlist">${list.length ? list.map(chgUnit).join('') : '<p class="empty">Nothing matches. Pick another faction or type.</p>'}</div>
    <p class="note">Green is a buff and red a nerf: lower is better for costs and build time, higher for everything else. Damage per second is worked out from the unit files, so a change to a weapon's damage or reload shows up there.</p>`;
}

// short list for a unit's own panel
function unitChanges(id) {
  const rows = CHG.map(h => ({ h, c: h.changed.find(x => x.id === id), n: h.added.some(x => x.id === id) })).filter(x => x.c || x.n);
  if (!rows.length) return '';
  return `<h3 class="cap">Recent changes</h3>${rows.slice(0, 2).map(({ h, c, n }) => `<p class="note" style="margin-bottom:4px">${h.from.date} to ${h.to.date}${n ? ': new unit' : ''}</p>${c ? `<ul class="chgl">${c.f.map(changeItem).join('')}</ul>` : ''}`).join('')}`;
}

document.addEventListener('click', e => {
  if (state.view !== 'changes') return;
  const f = e.target.closest('[data-chf]'), k = e.target.closest('[data-chk]'), u = e.target.closest('[data-cu]');
  if (f) { chgF = f.dataset.chf; return renderChanges(); }
  if (k) { chgK = k.dataset.chk; return renderChanges(); }
  if (u && !u.disabled) openUnit(u.dataset.cu);
});
document.addEventListener('change', e => { if (e.target.id === 'chsel') { chgI = Number(e.target.value); renderChanges(); } });
