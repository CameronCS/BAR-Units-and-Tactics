// Command palette (Ctrl+K or Cmd+K): one box that jumps to any page, unit, map or guide.
// Also the phone menu button, which folds the top bar's sections into a dropdown.
const PAGES = [['units', 'Units', 'Browse every unit and building'], ['tree', 'Tech tree', 'How each faction unlocks its tech'], ['vs', 'Versus', 'Pit two units against each other'],
  ['plan', 'Build planner', 'How long a build list takes and what it costs'],
  ['army', 'Army builder', 'Mix units into an army, see its gaps and fight it'], ['counter', 'Counters', 'Name the enemy army and get the best units against it'], ['matrix', 'Matchup matrix', 'A grid of units against each other'], ['equiv', 'Faction equivalents', 'The three factions side by side by role'],
  ['brief', 'Map briefing', 'Metal, energy, spawn role and an opener for a map'], ['roles', 'Team roles', 'Give each spawn a role and plan the team'],
  ['maps', 'Maps', 'Official maps and spawn locations'], ['changes', 'Changes', 'Balance changes between updates'], ['guides', 'Guides', 'Build orders and team roles']];
let palOpen = false, palItems = [], palSel = 0, palBack = null;

function palIndex() {
  const pages = PAGES.map(([v, t, d]) => ({ k: 'Page', n: t, sub: d, x: '', go: () => setView(v) }));
  const guides = FACS.map(f => ({ k: 'Guide', n: `${f} build guides`, sub: 'Openers, 1v1, team and FFA', x: 'guide build order', go: () => { state.gfac = f; store.set('barGFac', f); setView('guides'); } }));
  const units = U.map(u => ({ k: 'Unit', n: u.name, sub: `${u.faction}, tech ${u.tier}${u.metal ? ', ' + fmt(u.metal) + ' metal' : ''}`, x: u.id + ' ' + u.faction + ' ' + (u.desc || ''), img: `img/${u.id}.webp`, c: FCOL[u.faction], id: u.id,
    go: () => { if (location.hash === '#unit/' + u.id) { state.view = 'units'; openUnit(u.id); } else location.hash = '#unit/' + u.id; } }));
  const maps = MAPS.map(m => ({ k: 'Map', n: m.n, sub: `${m.w} by ${m.h}${m.a ? ', by ' + m.a : ''}`, x: m.id, go: () => { location.hash = '#map/' + encodeURIComponent(m.id); } }));
  return [...pages, ...guides, ...units, ...maps];
}
let palAll = null;

function palScore(it, q, toks) {
  const n = it.n.toLowerCase();
  if (n === q) return 100;
  if (n.startsWith(q)) return 85;
  if (n.split(/[\s\/(),-]+/).some(w => w.startsWith(q))) return 65;
  if (n.includes(q)) return 50;
  const hay = n + ' ' + it.x.toLowerCase();
  if (toks.length > 1 && toks.every(t => hay.includes(t))) return 35;
  if (hay.includes(q)) return 25;
  let i = 0; for (const ch of n) if (ch === q[i]) i++;       // letters in order, e.g. "mnt" finds Manticore
  return i === q.length && q.length >= 3 ? 10 : 0;
}
const KORD = { Page: 0, Guide: 1, Unit: 2, Map: 3 };
function palSearch(raw) {
  const q = raw.trim().toLowerCase();
  if (!q) {
    let rec = []; try { rec = JSON.parse(localStorage.getItem('barRecent') || '[]'); } catch (e) {}
    const r = rec.map(id => palAll.find(i => i.id === id)).filter(Boolean);
    const st = [...favs].map(id => palAll.find(i => i.id === id)).filter(i => i && !r.includes(i));
    return [...st.slice(0, 6).map(i => ({ ...i, recent: 'Starred' })), ...r.map(i => ({ ...i, recent: 'Recent' })), ...palAll.filter(i => i.k === 'Page')].slice(0, 14);
  }
  const toks = q.split(/\s+/);
  return palAll.map(it => [it, palScore(it, q, toks)]).filter(x => x[1] > 0)
    .sort((a, b) => b[1] - a[1] || KORD[a[0].k] - KORD[b[0].k] || a[0].n.length - b[0].n.length).slice(0, 12).map(x => x[0]);
}

function palRender() {
  const q = $('#palq').value;
  palItems = palSearch(q); palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  const list = $('#pallist');
  list.innerHTML = palItems.length ? palItems.map((it, i) => `<li role="option" id="pal${i}" data-i="${i}" aria-selected="${i === palSel}" style="--c:${it.c || 'var(--acc)'}">
      ${it.img ? `<span class="art"><img src="${it.img}" alt="" onerror="this.style.visibility='hidden'"></span>` : `<span class="art ic">${it.k === 'Map' ? 'M' : it.k === 'Guide' ? 'G' : '>'}</span>`}
      <span class="pt"><b>${it.n}</b><small>${it.sub}</small></span><em>${it.recent || it.k}</em></li>`).join('')
    : '<li class="pnone">No matches. Try part of a name, like "mant" or "bot lab".</li>';
  $('#palq').setAttribute('aria-activedescendant', palItems.length ? 'pal' + palSel : '');
  const a = $('#pal' + palSel); if (a) a.scrollIntoView({ block: 'nearest' });
}
function palPick(i) {
  const it = palItems[i]; if (!it) return;
  if (it.id) { try { const r = JSON.parse(localStorage.getItem('barRecent') || '[]').filter(x => x !== it.id); r.unshift(it.id); localStorage.setItem('barRecent', JSON.stringify(r.slice(0, 5))); } catch (e) {} }
  palClose(true); it.go();
}
function palShow() {
  if (!palAll) palAll = palIndex();
  let m = $('#palette');
  if (!m) {
    m = document.createElement('div'); m.id = 'palette'; m.className = 'palette'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Search the site');
    m.innerHTML = `<div class="palbox"><input id="palq" type="text" role="combobox" aria-expanded="true" aria-controls="pallist" aria-autocomplete="list" placeholder="Search units, maps, guides and pages" autocomplete="off" spellcheck="false">
      <ul id="pallist" role="listbox" aria-label="Results"></ul><div class="palft"><span><kbd>Up</kbd> <kbd>Down</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></div></div>`;
    document.body.appendChild(m);
  }
  palBack = document.activeElement; palOpen = true; palSel = 0;
  m.hidden = false; $('#palq').value = ''; palRender(); $('#palq').focus();
}
function palClose(keepFocus) { const m = $('#palette'); if (m) m.hidden = true; palOpen = false; if (!keepFocus && palBack && palBack.focus) palBack.focus({ preventScroll: true }); }

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return palOpen ? palClose() : palShow(); }
  if (!palOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return palClose(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); palSel = (palSel + 1) % Math.max(1, palItems.length); palRender(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel - 1 + palItems.length) % Math.max(1, palItems.length); palRender(); }
  else if (e.key === 'Enter') { e.preventDefault(); palPick(palSel); }
}, true);
document.addEventListener('input', e => { if (e.target.id === 'palq') { palSel = 0; palRender(); } });
document.addEventListener('click', e => {
  if (palOpen) {
    const li = e.target.closest('#pallist [data-i]'); if (li) return palPick(Number(li.dataset.i));
    if (e.target.id === 'palette') return palClose();
  }
  if (e.target.closest('#tophint')) { e.stopPropagation(); return palShow(); }
}, true);
document.addEventListener('mousemove', e => {
  const li = e.target.closest && e.target.closest('#pallist [data-i]');
  if (li && Number(li.dataset.i) !== palSel) { palSel = Number(li.dataset.i); document.querySelectorAll('#pallist [aria-selected]').forEach((x, i) => x.setAttribute('aria-selected', i === palSel)); }
});

// ---- phone menu ---------------------------------------------------------------
const topEl = document.querySelector('.top'), menuBtn = document.getElementById('menubtn');
function setMenu(on) { topEl.classList.toggle('menu', on); menuBtn.setAttribute('aria-expanded', on); menuBtn.textContent = on ? 'Close' : 'Menu'; }
menuBtn.onclick = () => setMenu(!topEl.classList.contains('menu'));
document.getElementById('nav1').addEventListener('click', () => setMenu(false));
document.addEventListener('click', e => { if (!e.target.closest('.top')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && topEl.classList.contains('menu')) { setMenu(false); menuBtn.focus(); } });
