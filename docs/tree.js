// Tech tree: commander -> factories -> constructors -> advanced factories -> advanced constructors -> gantry.
// Only builders are shown (factories and constructors). Click one to see everything it can build.
const TROOT = { Armada: 'armcom', Cortex: 'corcom', Legion: 'legcom' };
const TCOLS = ['Commander', 'Tech 1 factories', 'Tech 1 constructors', 'Tech 2 factories', 'Tech 2 constructors', 'Tech 3'];
const isBuilder = id => {
  const u = byId[id];
  if (!u || !u.build.length || /decom$/.test(id)) return false;          // skip the decoy commander
  return u.speed > 0 || u.fly || (u._sec === 'Factories');                // mobile constructors and factories, not nano turrets
};
function treeData(f) {
  const root = TROOT[f], depth = { [root]: 0 }, order = [root], edges = [];
  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    for (const b of byId[a].build) {
      if (!isBuilder(b)) continue;
      if (!(b in depth)) { depth[b] = depth[a] + 1; order.push(b); }
      if (depth[b] === depth[a] + 1) edges.push([a, b]);                 // draw only the step to the next column
    }
  }
  const cols = [];
  order.forEach(id => (cols[depth[id]] ||= []).push(id));
  // order each column by where its parents sit, so lines cross less
  cols.forEach((c, d) => {
    if (d === 0) return;
    const pos = Object.fromEntries(cols[d - 1].map((id, i) => [id, i]));
    const score = id => { const ps = edges.filter(e => e[1] === id).map(e => pos[e[0]]); return ps.length ? ps.reduce((x, y) => x + y, 0) / ps.length : 99; };
    c.sort((a, b) => score(a) - score(b));
  });
  return { cols, edges, depth };
}

const TW = 200, TH = 78, GX = 96, GY = 14, TOP = 40;
function renderTree() {
  const f = state.tfac, { cols, edges } = treeData(f);
  const tall = Math.max(...cols.map(c => c.length));
  const H = TOP + tall * (TH + GY), W = cols.length * (TW + GX) - GX;
  const pos = {};
  cols.forEach((c, d) => {
    const off = (tall - c.length) * (TH + GY) / 2;
    c.forEach((id, i) => { pos[id] = [d * (TW + GX), TOP + off + i * (TH + GY)]; });
  });
  const nm = id => byId[id].name + (/uw$/.test(id) ? ' (underwater)' : '');
  const nodes = Object.keys(pos).map(id => {
    const u = byId[id], [x, y] = pos[id];
    return `<button class="tnode" data-id="${id}" style="left:${x}px;top:${y}px;width:${TW}px;height:${TH}px;--c:${FCOL[u.faction]}">
      <span class="art"><img loading="lazy" src="img/${id}.webp" alt="" onerror="this.style.visibility='hidden'"></span>
      <span class="tn"><b>${nm(id)}</b><small>${u.build.length} options${u.tier > 1 ? ', tech ' + u.tier : ''}</small></span></button>`;
  }).join('');
  const paths = edges.map(([a, b]) => {
    const x1 = pos[a][0] + TW, y1 = pos[a][1] + TH / 2, x2 = pos[b][0], y2 = pos[b][1] + TH / 2, dx = GX * .55;
    return `<path data-a="${a}" data-b="${b}" d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}"/>`;
  }).join('');
  const heads = cols.map((_, d) => `<div class="thead" style="left:${d * (TW + GX)}px;width:${TW}px">${TCOLS[d] || 'Step ' + (d + 1)}</div>`).join('');
  const fnav = FACS.map(x => `<button data-tf="${x}" aria-pressed="${x === f}" style="--c:${FCOL[x]}">${x}</button>`).join('');
  $('#grid').innerHTML = `<div class="mhead"><h2 class="gh">Tech tree</h2>
    <p class="gb">How each faction unlocks its tech. Every box is a factory or constructor, and a line means the left unit can build the right one. Click a box to see everything it can build.</p></div>
    <div class="gnav" style="margin-top:var(--s4)"><div class="seg2">${fnav}</div></div>
    <div class="tscroll"><div class="tree" id="tree" style="width:${W}px;height:${H}px">${heads}<svg class="tlines" width="${W}" height="${H}">${paths}</svg>${nodes}</div></div>
    <p class="note">Nano turrets and other static builders are left out to keep the tree readable. Hover a unit to light up its route.</p>`;
}

// highlight the chain through a hovered node
function treeHover(id) {
  const tree = $('#tree'); if (!tree) return;
  tree.classList.toggle('hov', !!id);
  tree.querySelectorAll('.tnode').forEach(n => n.classList.remove('lit'));
  tree.querySelectorAll('path').forEach(p => p.classList.remove('lit'));
  if (!id) return;
  const { edges } = treeData(state.tfac), up = new Set([id]), down = new Set([id]);
  let ch = true;
  while (ch) { ch = false; edges.forEach(([a, b]) => { if (up.has(b) && !up.has(a)) { up.add(a); ch = true; } if (down.has(a) && !down.has(b)) { down.add(b); ch = true; } }); }
  const lit = new Set([...up, ...down]);
  tree.querySelectorAll('.tnode').forEach(n => n.classList.toggle('lit', lit.has(n.dataset.id)));
  tree.querySelectorAll('path').forEach(p => {
    const a = p.dataset.a, b = p.dataset.b;
    p.classList.toggle('lit', (up.has(a) && up.has(b)) || (down.has(a) && down.has(b)));
  });
}

document.addEventListener('click', e => {
  if (state.view !== 'tree') return;
  const tf = e.target.closest('[data-tf]');
  if (tf) { state.tfac = tf.dataset.tf; store.set('barTFac', state.tfac); theme(); pushHash(viewHash()); renderTree(); return; }
  const n = e.target.closest('.tnode'); if (n) openUnit(n.dataset.id);
});
document.addEventListener('mouseover', e => { if (state.view === 'tree') { const n = e.target.closest('.tnode'); treeHover(n ? n.dataset.id : null); } });
document.addEventListener('focusin', e => { if (state.view === 'tree') { const n = e.target.closest && e.target.closest('.tnode'); if (n) treeHover(n.dataset.id); } });
