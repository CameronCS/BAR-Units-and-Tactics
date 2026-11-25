// Unit detail panel: art + balance chart on the left, cost / stats / ordnance bars on the right.
const ACN = { vtol: 'Aircraft', subs: 'Submarines', lboats: 'Light ships', hvyboats: 'Heavy ships', commanders: 'Commanders', crawlingbombs: 'Crawling bombs', mines: 'Mines', nanos: 'Nano turrets' };
const link = id => byId[id] ? `<a tabindex="0" data-id="${id}">${byId[id].name}</a>` : '';
let lastFocus = null, hist = [];

const VERB = /^(Produces|Builds|Constructs|Extracts|Generates|Converts|Stores|Detects|Jams|Provides|Intercepts|Launches|Increases|Repairs|Reclaims|Resurrects|Transports|Protects|Shields|Cloaks|Teleports|Fires|Creates|Supplies|Sends|Spots)\b/;
function blurb(u) {
  const ws = u.weapons || [], d = (u.desc || '').trim();
  const eq = ws.length ? ` equipped with ${ws.map(w => `${(w.n || 'a weapon').toLowerCase()}${w.range ? ' (range ' + fmt(w.range) + ')' : ''}`).join(' and ')}` : '';
  if (!d) return `The <b>${u.name}</b>${eq ? ' is a unit' + eq : ''}.`;
  if (VERB.test(d)) return `The <b>${u.name}</b> ${d.charAt(0).toLowerCase() + d.slice(1)}${eq ? ', ' + eq.trim() : ''}.`;
  const art = /^[aeiou]/i.test(d) ? 'an' : 'a';
  return `The <b>${u.name}</b> is ${art} ${d.charAt(0).toLowerCase() + d.slice(1)}${eq}.`;
}

// Radar of five normalised stats (square root of value against the 95th percentile of all units)
function radar(u, color) {
  const axes = [['Health', u.hp, CAP.hp], ['DPS', u._dps, CAP.dps], ['Range', u._range, CAP.range], ['Sight', u.los, CAP.los], ['Speed', u.speed, CAP.speed]];
  const cx = 160, cy = 150, R = 100;
  const pt = (i, f) => { const a = (-90 + i * 72) * Math.PI / 180; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const ring = f => `<polygon points="${axes.map((_, i) => pt(i, f).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`; }).join('');
  const vals = axes.map(([, v, c], i) => pt(i, Math.max(.04, Math.min(1, Math.sqrt((v || 0) / c)))));
  const labels = axes.map(([n], i) => { const [x, y] = pt(i, 1.28); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="var(--mute)" font-size="12">${n}</text>`; }).join('');
  return `<svg viewBox="0 0 320 300" role="img" aria-label="Balance chart: health, damage, range, sight, speed">
    ${[.25, .5, .75, 1].map(ring).join('')}${spokes}
    <polygon points="${vals.map(p => p.join(',')).join(' ')}" fill="${color}" fill-opacity=".5" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`).join('')}${labels}</svg>`;
}

const srow = (label, val, cap, cls, text) => val == null || val === 0 ? '' :
  `<div class="sr"><span class="sl">${label}</span><span class="stk ${cls}"><i style="width:${Math.max(3, barPct(val, cap))}%"></i><b>${text == null ? fmt(val) : text}</b></span></div>`;

// seconds to build at full speed with each builder that can make this unit, working alone
function buildTimeBlock(u) {
  if (!u.bt) return '';
  const ids = [...(builtBy[u.id] || []), ...(u.expby || [])], seen = new Set(), rows = [];
  for (const id of ids) { const b = byId[id]; if (!b || !(b.worker > 0) || /decom$/.test(id) || seen.has(b.name)) continue; seen.add(b.name); rows.push([b, u.bt / b.worker]); }
  rows.sort((a, b) => a[1] - b[1]);
  if (!rows.length) return '';
  return `<h3 class="cap">Build time</h3><div class="btl">${rows.slice(0, 5).map(([b, t]) => `<div><span>${b.name} <small style="color:var(--mute)">(${fmt(b.worker)} build power)</small></span><b>${clock(t)}</b></div>`).join('')}</div>
    <p class="note">At full speed with one builder and enough metal and energy. <a tabindex="0" href="#plan" style="color:var(--acc)">Plan a whole build order</a>.</p>`;
}
const evalue = e => e >= Combat.CAPE ? '10x or more' : e.toFixed(1) + 'x';
function counterBlock(u) {
  if (!Combat.armed(u)) return '';
  const chip = ([x, e]) => `<a tabindex="0" data-id="${x.id}">${x.name}<em>${evalue(e)}</em></a>`;
  const ct = Combat.counters(u), tg = Combat.targets(u);
  const cols = ['Armada', 'Cortex', 'Legion'].map(f => {
    const l = [...ct[f].mobile, ...ct[f].fixed]; if (!l.length) return '';
    return `<div class="ctrf" style="--c:${FCOL[f]}"><b>${f}</b><div class="links">${l.map(chip).join('')}</div></div>`;
  }).join('');
  return `${cols ? `<h3 class="cap">What beats it</h3><div class="ctr">${cols}</div>` : ''}
    ${tg.length ? `<h3 class="cap">What it beats</h3><div class="links ctrl">${tg.map(chip).join('')}</div>` : ''}
    <label class="vsrg"><input type="checkbox" id="rangeTog" ${Combat.range ? 'checked' : ''}> Include range and speed</label>
    <p class="note">The multiplier is how much more value one side gets from the same metal in a straight fight: damage against each armor class, health and cost. ${Combat.range ? 'A side that outranges the other also gets free shots while it closes in.' : 'Range and speed are left out.'} Splash damage and micro are ignored, so treat it as a guide. Units that cannot shoot back show as 10x or more.</p>`;
}
function show(id) {
  const u = byId[id]; if (!u) return;
  const c = FCOL[u.faction], m = matchups(u), ws = u.weapons || [];
  const fact = (k, v) => v == null || v === '' ? '' : `<div><i>${k}</i><b>${v}</b></div>`;
  const prod = u.upkeep < 0 ? `+${-u.upkeep} energy/s` : null;
  const upk = u.upkeep > 0 ? `${u.upkeep} energy/s` : null;
  const gh = `https://github.com/beyond-all-reason/Beyond-All-Reason/blob/master/units/${u.folder.split('/').map(encodeURIComponent).join('/')}/${u.id}.lua`;
  const tags = [`T${u.tier}`, /amphibious/i.test(u.desc || '') ? 'Amphibious' : null, u.fly ? 'Flying' : null, u.cat === 'Naval' ? 'Naval' : null, u.cloak ? 'Cloakable' : null, u.exp ? 'Optional unit' : null].filter(Boolean);
  const prev = hist.length > 1 ? byId[hist[hist.length - 2]] : null;
  const strong = m.S.map(short), weak = m.W.map(short);
  const quote = (strong.length || weak.length) ? `<blockquote>${strong.length ? `Strong against ${strong.join(', ').toLowerCase()}.` : ''}${strong.length && weak.length ? ' ' : ''}${weak.length ? `Weak against ${weak.join(', ').toLowerCase()}.` : ''}</blockquote>` : '';
  const ord = ws.map(w => {
    const wd = w.dmg && w.reload ? w.dmg * w.count / w.reload : null;
    return `<details class="ord"><summary><span class="oi" style="--c:${c}"></span><span>${w.n}${w.count > 1 ? ' x' + w.count : ''}</span></summary>
      <div class="of"><div><i>Type</i><b>${w.type || '–'}</b></div><div><i>Range</i><b>${fmt(w.range)}</b></div><div><i>Damage</i><b>${fmt(w.dmg)}</b></div>
      <div><i>Reload</i><b>${fmt(w.reload)}s</b></div><div><i>Damage/s</i><b>${wd ? fmt(wd) : '–'}</b></div><div><i>Area</i><b>${fmt(w.aoe)}</b></div>
      ${Object.entries(w.dm || {}).map(([k, v]) => `<div><i>Vs ${(ACN[k] || k).toLowerCase()}</i><b>${fmt(v)}${w.dd ? ' (' + Math.round(v / w.dd * 100) + '%)' : ''}</b></div>`).join('')}</div></details>`;
  }).join('');

  $('#dbody').innerHTML = `
    <div class="uv" style="--c:${c}">
      <div class="uvtop">${prev ? `<button class="back" id="back">Back to ${prev.name}</button>` : '<span></span>'}<span class="uvact"><button class="back cmpbig favbig${favs.has(u.id) ? ' on' : ''}" data-fav="${u.id}" aria-pressed="${favs.has(u.id)}">${favs.has(u.id) ? 'Starred' : 'Star'}</button><button class="back cmpbig" data-cmp="${u.id}">Add to compare</button>${Combat.armed(u) ? `<button class="back" data-vsfight="${u.id}">Fight another unit</button>` : ''}<button class="xb" id="xb" aria-label="Close">×</button></span></div>
      <div class="uvl">
        <div class="hero"><img src="img/lg/${u.id}.webp" alt="${u.name}" onerror="this.onerror=null;this.src='img/${u.id}.webp'"></div>
        <h3 class="cap">Balance chart</h3>
        <div class="radar">${radar(u, c)}</div>
      </div>
      <div class="uvr">
        <div class="uhead"><span class="emb">${u.faction[0]}</span><h2>${u.name}</h2></div>
        <div class="utags">${tags.map(t => `<span>${t}</span>`).join('')}<em>${u.desc || ''}</em></div>
        <div class="two">
          <div>
            <h3 class="cap">Cost</h3>
            ${srow('Metal', u.metal, CAP.metal, 'k-metal')}${srow('Energy', u.energy, CAP.energy, 'k-energy')}${srow('Build time', u.bt, CAP.bt, 'k-bt')}
            ${buildTimeBlock(u)}
            <h3 class="cap">General stats</h3>
            ${srow('Health', u.hp, CAP.hp, 'k-hp')}${srow('Speed', u.speed, CAP.speed, 'k-speed')}${srow('Sight', u.los, CAP.los, 'k-sight')}
            ${srow('DPS', u._dps, CAP.dps, 'k-dps')}${srow('Range', u._range, CAP.range, 'k-range')}
          </div>
          <div>${ws.length ? `<h3 class="cap">Ordnance</h3>${ord}` : ''}</div>
        </div>
        <p class="blurb">${blurb(u)}</p>
        ${quote}
        ${(m.S.length || m.W.length) ? `<div class="mu big">${m.S.map(x => `<span class="pill s">${x}</span>`).join('')}${m.W.map(x => `<span class="pill w">${x}</span>`).join('')}</div>` : ''}
        ${counterBlock(u)}
        ${typeof unitChanges === 'function' ? unitChanges(u.id) : ''}
        <h3 class="cap">More stats</h3>
        <div class="facts">
          ${fact('Radar range', u.radar)}${fact('Sonar range', u.sonar)}${fact('Jammer range', u.jam)}
          ${fact('Build power', u.worker)}${fact('Produces', prod)}${fact('Upkeep', upk)}
          ${fact('Metal storage', u.mstore)}${fact('Energy storage', u.estore)}
          ${fact('Max water depth', u.water)}${fact('Footprint', u.size?.[0] ? u.size.join(' x ') : null)}
          ${fact('Armor class', ACN[u.ac] || 'Standard')}${fact('Kamikaze', u.kamikaze ? 'Yes' : null)}${fact('Metal extractor', u.mex ? 'Yes' : null)}
        </div>
        ${u.build?.length ? `<h3 class="cap">Can build</h3><div class="links">${u.build.map(link).join('')}</div>` : ''}
        ${u.exp && u.expby ? `<h3 class="cap">Built by</h3><p class="note" style="margin:0 0 6px">Only when the extra units game option is on.</p><div class="links">${u.expby.map(link).join('')}</div>` : ''}
        ${builtBy[u.id]?.length ? `<h3 class="cap">Built by</h3><div class="links">${builtBy[u.id].map(link).join('')}</div>` : ''}
        <div class="ext">
          ${window.SITE_IDS.has(u.id) ? `<a target="_blank" rel="noopener" href="https://www.beyondallreason.info/unit/${u.id}">BAR website unit page</a>` : ''}
          <a target="_blank" rel="noopener" href="${gh}">Unit definition on GitHub</a>
        </div>
      </div>
    </div>`;
  $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
  $('#drawer').scrollTo(0, 0); $('#xb').focus({ preventScroll: true });
  pushHash('#unit/' + id);
  renderTray();
}
function openUnit(id) { lastFocus = document.activeElement; hist = [id]; show(id); }   // from a card
function goUnit(id) { hist.push(id); show(id); }                                       // from a link inside the panel
function backUnit() { if (hist.length > 1) { hist.pop(); show(hist[hist.length - 1]); } }
function closeUnit(silent) {
  $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true');
  hist = [];
  if (silent === true) return;
  pushHash(viewHash());
  lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
}
