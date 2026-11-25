"""Work out what changed between two versions of the BAR unit data and keep a running list for the site.

    python tools/changelog.py --since 2026-10-01     compare the current data with BAR as it was on that date
    python tools/changelog.py --since <commit sha>   ... or at a specific commit

build.py --refresh also calls record() so every update adds an entry on its own.
The history lives in tools/changes.json and is written out for the site as site/changes.js.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(os.path.dirname(HERE), 'site')
STATE = HERE + '/state.json'       # which BAR commit the current site/units.js was built from
HIST = HERE + '/changes.json'
KEEP = 12                          # how many updates to keep

# (key, label, lower is better?)
FIELDS = [('metal', 'Metal cost', True), ('energy', 'Energy cost', True), ('bt', 'Build time', True), ('hp', 'Health', False),
          ('speed', 'Speed', False), ('los', 'Sight', False), ('worker', 'Build power', False), ('dps', 'Damage per second', False),
          ('range', 'Range', False)]


def load_units(path):
    s = open(path, encoding='utf8').read()
    return json.loads(s[s.index('=') + 1:].rstrip().rstrip(';'))


def dps(u):
    return round(sum(w['dmg'] * w['count'] / w['reload'] for w in u['weapons'] if w.get('dmg') and w.get('reload')), 2)


def vals(u):
    r = {k: u.get(k) or 0 for k in ('metal', 'energy', 'bt', 'hp', 'speed', 'los', 'worker')}
    r['dps'] = dps(u)
    r['range'] = max([w.get('range') or 0 for w in u['weapons']] + [0])
    return r


def diff(old, new):
    o = {u['id']: u for u in old}
    n = {u['id']: u for u in new}
    slim = lambda u: {'id': u['id'], 'name': u['name'], 'faction': u['faction'], 'cat': u['cat']}
    added = [slim(n[i]) for i in n if i not in o]
    removed = [slim(o[i]) for i in o if i not in n]
    changed = []
    for i in n:
        if i not in o:
            continue
        a, b = vals(o[i]), vals(n[i])
        f = [[k, a[k], b[k]] for k, _, _ in FIELDS if abs(a[k] - b[k]) > 1e-6]
        if o[i].get('ac') != n[i].get('ac'):
            f.append(['ac', o[i].get('ac'), n[i].get('ac')])
        ad = [x for x in n[i]['build'] if x not in o[i]['build']]
        de = [x for x in o[i]['build'] if x not in n[i]['build']]
        if ad or de:
            f.append(['build', ad, de])
        if f:
            changed.append({**slim(n[i]), 'f': f})
    return {'added': added, 'removed': removed, 'changed': changed}


def write_site(hist):
    open(SITE + '/changes.js', 'w', encoding='utf8').write('window.CHANGES=' + json.dumps(hist, separators=(',', ':')) + ';')


def record(old, new, frm, to):
    """Add one entry (old data -> new data) to the history."""
    d = diff(old, new)
    if not (d['added'] or d['removed'] or d['changed']):
        print('changelog: no differences')
        return
    hist = json.load(open(HIST, encoding='utf8')) if os.path.exists(HIST) else []
    hist = [h for h in hist if h['to']['sha'] != to['sha']]
    hist.insert(0, {'from': frm, 'to': to, **d})
    hist = hist[:KEEP]
    json.dump(hist, open(HIST, 'w', encoding='utf8'), separators=(',', ':'))
    write_site(hist)
    print(f"changelog: {len(d['changed'])} changed, {len(d['added'])} new, {len(d['removed'])} removed ({frm['date']} -> {to['date']})")


def save_state(head):
    json.dump(head, open(STATE, 'w'))


def since(arg):
    import fetch, parse_units
    cur = load_units(SITE + '/units.js')
    to = json.load(open(STATE))
    base = fetch.resolve(ref=arg) if len(arg) >= 7 and all(c in '0123456789abcdef' for c in arg.lower()) else fetch.resolve(until=arg)
    cache = HERE + '/.cache/base-' + base['sha'][:7]
    print('baseline commit', base['sha'][:7], base['date'])
    fetch.run(cache, head=base, maps=False)
    old = parse_units.parse(cache)
    record(old, cur, base, to)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['--since'] and len(a) > 1:
        since(a[1])
    else:
        print(__doc__)
