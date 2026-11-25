// Sharing: copy a link or plain text for a planner build order or a Versus matchup.
// A planner link carries the whole plan after "#plan/", so anyone who opens it gets the same stages.
const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
const pageBase = () => location.href.split('#')[0];

function planEncode() {
  const o = { f: planFac, m: planMapId || undefined, p: planStartSel || undefined, x: [planX.m, planX.e], a: [planAs.spot, planAs.wind, planAs.tidal, planAs.conv], w: planAs.wm !== 'avg' ? planAs.wm : undefined,
    s: planS.map(s => ({ n: s.name, i: s.items.map(i => [i.id, i.q, i.done ? 1 : 0]) })) };
  return b64e(JSON.stringify(o));
}
// returns true if the code held a usable plan
function planDecode(code) {
  try {
    const o = JSON.parse(b64d(code));
    if (!FACS.includes(o.f) || !Array.isArray(o.s) || !o.s.length) return false;
    const st = o.s.slice(0, 20).map(s => ({ name: String(s.n || 'Stage').slice(0, 40), items: (s.i || []).filter(i => byId[i[0]]).slice(0, 80).map(i => ({ id: i[0], q: Math.min(999, Math.max(1, Math.round(i[1]) || 1)), done: !!i[2] })) }));
    planPrev = JSON.stringify({ st: planS, fac: planFac, map: planMapId, sp: planStartSel, as: planAs, x: planX });
    planS = st; planFac = o.f;
    planMapId = o.m && MAPS.some(m => m.id === o.m) ? o.m : null;
    planStartSel = planMapId && typeof o.p === 'string' ? o.p.slice(0, 12) : '';
    if (Array.isArray(o.x)) planX = { m: Number(o.x[0]) || 0, e: Number(o.x[1]) || 0 };
    if (Array.isArray(o.a)) planAs = { spot: Number(o.a[0]) || 2, wind: Number(o.a[1]) || 0, tidal: Number(o.a[2]) || 0, conv: Number(o.a[3]) || 0, wm: ['min', 'max'].includes(o.w) ? o.w : 'avg' };
    planNote = 'Loaded a shared plan.';
    planSave();
    return true;
  } catch (e) { return false; }
}

function planText() {
  const sim = planSim(), m = planMapId && MAPS.find(x => x.id === planMapId);
  const lines = [`BAR build plan: ${planFac}, starting with the ${byId[COMMANDER[planFac]].name}${m ? ', on ' + m.n : ''}`,
    `Assumptions: wind ${planAs.wind}, tidal ${planAs.tidal}, metal spot ${planAs.spot}, converters use ${planAs.conv}% of energy income`, ''];
  planS.forEach((s, i) => {
    lines.push(`${s.name}${sim.stages[i].left.length ? ' (ready at ' + clock(sim.stages[i].ready) + ')' : ' (done)'}`);
    s.items.forEach(it => lines.push(`  [${it.done ? 'x' : ' '}] ${it.q}x ${byId[it.id].name}`));
    lines.push('');
  });
  lines.push(`Left to build: ${clock(sim.time)}, ${fmt(sim.sum.m)} metal, ${fmt(sim.sum.e)} energy`);
  lines.push(`Income when finished: ${rate(sim.end.m)} metal/s, ${rate(sim.end.e)} energy/s, ${rate(sim.end.bp)} build power`);
  return lines.join('\n');
}
const planLink = () => pageBase() + '#plan/' + planEncode();

function vsText() {
  const a = byId[vsA], b = byId[vsB];
  return `${vsNA} ${a.name} (${a.faction}) vs ${vsNB} ${b.name} (${b.faction}): ${pageBase()}#vs/${vsA},${vsB},${vsNA},${vsNB}`;
}

// copy to the clipboard, falling back for pages opened straight from a file
async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {}
  if (!ok) {
    const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch (e) {} t.remove();
  }
  if (btn) { const old = btn.dataset.label || btn.textContent; btn.dataset.label = old; btn.textContent = ok ? 'Copied' : 'Could not copy: select the text and press Ctrl+C'; setTimeout(() => { btn.textContent = old; }, 2200); }
  return ok;
}

const planShareHtml = () => `<section class="plsec"><h3 class="cap">Share this plan</h3>
  <div class="plshare"><button class="vsswap" data-share="plan-link">Copy link</button><button class="vsswap" data-share="plan-text">Copy as text</button></div>
  <p class="note">The link holds the whole plan, so anyone who opens it sees the same stages. The text version is for pasting into chat.</p>
  <details class="plpv"><summary>Preview the text</summary><pre>${planText().replace(/</g, '&lt;')}</pre></details></section>`;

document.addEventListener('click', e => {
  const b = e.target.closest('[data-share]'); if (!b) return;
  const k = b.dataset.share;
  if (k === 'plan-link') copyText(planLink(), b);
  else if (k === 'plan-text') copyText(planText(), b);
  else if (k === 'vs-link') copyText(pageBase() + '#vs/' + vsA + ',' + vsB + ',' + vsNA + ',' + vsNB, b);
  else if (k === 'vs-text') copyText(vsText(), b);
});
