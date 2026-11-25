// Matchups worked out from the game's own numbers: each weapon's damage against each armor class,
// what it is allowed to shoot at, and every unit's health and metal cost.
//
// For two units A and B we compare armies of equal metal (Lanchester's square law):
//   E(A vs B) = (metalB / metalA) * sqrt( (dpsAB * hpA) / (dpsBA * hpB) )
// E = 2 means A gets twice the value from its metal. It ignores splash and micro.
// With "range and speed" on, a side that outranges the other also gets free shots while the other closes the gap
// (gap / speed of the closing unit, at most 12 seconds, or until dead if the closer cannot move), which lowers the health
// the closing unit has left when the fight starts. Flying units are left alone: their fights are too dynamic to model this way.
const Combat = (() => {
  const ALL = window.UNITS;
  const CAPE = 10;                                         // cap for "cannot be hurt back"
  const GROUPS = [
    ['Bots', u => u.cat === 'Bots'], ['Vehicles', u => u.cat === 'Vehicles'], ['Hovercraft', u => u.cat === 'Hover'],
    ['Aircraft', u => u.fly], ['Ships', u => u.cat === 'Naval' && u.ac !== 'subs'], ['Submarines', u => u.ac === 'subs'],
    ['Defensive structures', u => u.cat === 'Buildings' && u.weapons.length > 0]
  ];
  const buildable = new Set(['armcom', 'corcom', 'legcom']);   // drones and other spawned units cannot be built, so they are left out
  ALL.forEach(u => (u.build || []).forEach(b => buildable.add(b)));
  const armed = u => (u.weapons || []).some(w => w.reload && (w.dd || (w.dm && Object.keys(w.dm).length)));
  const kind = u => u.fly ? 'air' : u.ac === 'subs' ? 'sub' : u.cat === 'Naval' ? 'ship' : 'land';

  // can this weapon shoot at that kind of target?
  function canHit(w, k) {
    const only = w.only || '', t = w.type;
    if (k === 'air') {
      if (/VTOL/.test(only)) return true;
      if (/SURFACE|NOTAIR|UNDERWATER|CANBEUW/.test(only) || t === 'AircraftBomb' || t === 'TorpedoLauncher' || t === 'Melee') return false;
      const v = w.dm && w.dm.vtol;
      return !!v && v >= 0.3 * (w.dd || v);                // ground guns with a token vtol number do not count
    }
    if (k === 'sub') return t === 'TorpedoLauncher' || /UNDERWATER|CANBEUW/.test(only);
    if (t === 'TorpedoLauncher' && k !== 'ship') return false;
    if (/UNDERWATER|CANBEUW/.test(only) && t !== 'TorpedoLauncher') return false;
    if (/VTOL/.test(only) && !/SURFACE|NOTAIR/.test(only)) return false;
    return true;
  }
  const dmgVs = (w, b) => ((w.dm && b.ac in w.dm) ? w.dm[b.ac] : w.dd) || 0;
  const dpsVs = (a, b) => {
    const k = kind(b); let s = 0;
    for (const w of a.weapons || []) if (w.reload && canHit(w, k)) s += dmgVs(w, b) * w.count / w.reload;
    return s;
  };

  // the longest range at which a unit can actually hurt the other one
  const reach = (a, b) => { const k = kind(b); let r = 0; for (const w of a.weapons || []) if (w.reload && w.range && canHit(w, k) && dmgVs(w, b) > 0) r = Math.max(r, w.range); return r; };
  const closeTime = (gap, speed) => speed > 0 ? Math.min(12, gap / speed) : 1e9;
  let useRange = true; try { useRange = localStorage.getItem('barRange') !== '0'; } catch (e) {}
  function engage(a, b, withRange = useRange) {
    const dab = dpsVs(a, b), dba = dpsVs(b, a); let hpA = a.hp, hpB = b.hp, tfA = 0, tfB = 0;
    const ra = reach(a, b), rb = reach(b, a);
    if (withRange && dab && dba && !a.fly && !b.fly) {
      if (ra > rb * 1.15) { tfA = closeTime(ra - rb, b.speed); hpB = Math.max(.1 * b.hp, b.hp - dab * tfA); }
      else if (rb > ra * 1.15) { tfB = closeTime(rb - ra, a.speed); hpA = Math.max(.1 * a.hp, a.hp - dba * tfB); }
    }
    return { dab, dba, hpA, hpB, tfA, tfB, ra, rb };
  }
  const memo = new Map();
  function E(a, b, withRange = useRange) {
    const key = a.id + '>' + b.id + (withRange ? 'r' : ''); let v = memo.get(key);
    if (v !== undefined) return v;
    const { dab: da, dba: db, hpA, hpB } = engage(a, b, withRange);
    if (!da || !a.hp || !b.hp) v = 0;
    else if (!db) v = CAPE;
    else v = Math.min(CAPE, Math.max(.02, (b.metal || 1) / (a.metal || 1) * Math.sqrt(da * hpA / (db * hpB))));
    memo.set(key, v); return v;
  }
  function setRange(on) {
    useRange = !!on; try { localStorage.setItem('barRange', on ? '1' : '0'); } catch (e) {}
    memo.clear(); ALL.forEach(u => { delete u._mu; delete u._ctr; });
  }
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const band = (u, lo, hi) => ALL.filter(x => buildable.has(x.id) && x.id !== u.id && x.metal >= lo * u.metal && x.metal <= hi * u.metal);

  // which kinds of units is this one good or bad against (cost-matched fighting units only)
  function groups(u) {
    if (u._mu) return u._mu;
    const S = [], W = [];
    if (!armed(u)) { if (u.speed || u.fly) W.push({ g: 'Any attacker (unarmed)', e: 0 }); return u._mu = { S: [], W, rows: [] }; }
    let pool = band(u, .5, 2).filter(armed);
    if (pool.length < 30) pool = band(u, .25, 4).filter(armed);
    const rows = [];
    for (const [name, test] of GROUPS) {
      const ts = pool.filter(test); if (ts.length < 3) continue;
      const blind = ts.filter(t => !dpsVs(u, t)).length / ts.length;
      // only fights that go both ways say anything: a target that cannot shoot back is no contest
      const es = ts.filter(t => dpsVs(u, t) && dpsVs(t, u)).map(t => E(u, t));
      if (blind < .9 && es.length < 3) continue;
      rows.push({ g: name, e: es.length ? median(es) : 0, blind, n: ts.length });
    }
    rows.forEach(r => {
      if (r.blind >= .9) W.push({ g: r.g, e: 0, none: true });
      else if (r.e >= 1.35 && r.blind < .5) S.push(r);
      else if (r.e <= .74) W.push(r);
    });
    S.sort((x, y) => y.e - x.e); W.sort((x, y) => x.e - y.e);
    return u._mu = { S, W, rows };
  }

  // the individual units that beat this one best / that this one beats best, per metal spent
  function counters(u) {
    if (u._ctr) return u._ctr;
    const out = {};
    const cands = band(u, .3, 3).filter(c => armed(c) && c.tier <= Math.max(u.tier, 1.5) && c.id !== u.id);
    for (const f of ['Armada', 'Cortex', 'Legion']) {
      const rank = cands.filter(c => c.faction === f).map(c => [c, E(c, u)]).filter(x => x[1] > 1.15).sort((x, y) => y[1] - x[1] || dpsVs(y[0], u) / y[0].metal - dpsVs(x[0], u) / x[0].metal);
      out[f] = { mobile: rank.filter(x => x[0].cat !== 'Buildings').slice(0, 4), fixed: rank.filter(x => x[0].cat === 'Buildings').slice(0, 2) };
    }
    return u._ctr = out;
  }
  function targets(u) {
    if (!armed(u)) return [];
    return band(u, .4, 2.5).filter(t => armed(t) && t.cat !== 'Buildings').map(t => [t, E(u, t)]).filter(x => x[1] > 1.15 && x[1] < CAPE).sort((x, y) => y[1] - x[1]).slice(0, 6);
  }
  const mult = (w, cls) => ((w.dm && cls in w.dm) ? w.dm[cls] : w.dd) || 0;
  return { CAPE, E, engage, groups, counters, targets, canHit, dpsVs, armed, mult, setRange, get range() { return useRange; } };
})();
