"""Check the generated data in site/ and report anything that looks broken after a BAR update.

    python tools/check.py            print problems; exit code 1 if there are errors
    python tools/check.py --quiet    print only the summary line

Errors mean the site would show wrong or missing information. Warnings are worth a look but may be normal.
build.py runs this at the end of every build.
"""
import json, os, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(os.path.dirname(HERE), 'site')
CATS = {'Bots', 'Vehicles', 'Hover', 'Air', 'Naval', 'Buildings'}
FACTIONS = {'Armada', 'Cortex', 'Legion'}
TIERS = {1, 1.5, 2, 3}
KNOWN_ARMOR = {'vtol', 'subs', 'lboats', 'hvyboats', 'commanders', 'crawlingbombs', 'mines', 'nanos', 'indestructable'}
STATS = ['metal', 'energy', 'bt', 'hp']


def load(name):
    s = open(f'{SITE}/{name}', encoding='utf8').read()
    return json.loads(s[s.index('=') + 1:].rstrip().rstrip(';'))


def run(quiet=False):
    errors, warns = [], []
    err = lambda m: errors.append(m)
    warn = lambda m: warns.append(m)

    try:
        U = load('units.js')
    except Exception as e:  # noqa: BLE001
        print('ERROR site/units.js is missing or unreadable:', e)
        return 1
    ids = {u['id'] for u in U}
    if len(ids) != len(U):
        err('duplicate unit ids')

    # compare with the last build, so a parser that suddenly finds far fewer units is noticed
    state = HERE + '/counts.json'
    prev = json.load(open(state)) if os.path.exists(state) else None
    cur = {'units': len(U), 'maps': len(load('maps.js'))}
    if prev:
        for k, v in cur.items():
            if prev.get(k) and v < prev[k] * .95:
                err(f'{k} dropped from {prev[k]} to {v}: the parser may no longer understand the BAR files')
    json.dump(cur, open(state, 'w'))

    by = Counter()
    for u in U:
        i = u['id']
        if u['cat'] not in CATS: err(f'{i}: unknown category {u["cat"]!r}')
        if u['faction'] not in FACTIONS: err(f'{i}: unknown faction {u["faction"]!r}')
        if u['tier'] not in TIERS: err(f'{i}: unknown tech level {u["tier"]!r}')
        if not u.get('name'): err(f'{i}: no name')
        if not u.get('desc'): warn(f'{i}: no description')
        for k in STATS:
            if not u.get(k) and not (i.endswith('com') and k in ('metal', 'energy', 'bt')) and k != 'energy':   # some buildings really cost no energy
                warn(f'{i}: {k} is empty or zero')
        if not os.path.exists(f'{SITE}/img/{i}.webp'): warn(f'{i}: no picture')
        elif not os.path.exists(f'{SITE}/img/lg/{i}.webp'): warn(f'{i}: no large picture')
        for b in u.get('build', []):
            if b not in ids: warn(f'{i}: can build {b}, which is not in the data (likely a scavenger or removed unit)')
        for w in u.get('weapons', []):
            if not w.get('reload'): warn(f'{i}: weapon "{w.get("n")}" has no reload time')
            if not w.get('dmg') and not w.get('dm'): warn(f'{i}: weapon "{w.get("n")}" has no damage')
            if not w.get('range'): warn(f'{i}: weapon "{w.get("n")}" has no range')
            for k in (w.get('dm') or {}):
                if k not in KNOWN_ARMOR | {'shields', 'scavboss', 'raptorqueen', 'raptor'}: warn(f'{i}: weapon uses unknown armor class {k!r}')
        if u['cat'] != 'Buildings' and not u.get('speed') and not u.get('fly'): warn(f'{i}: mobile unit with no speed')
        if u.get('ac') and u['ac'] not in KNOWN_ARMOR: warn(f'{i}: unknown armor class {u["ac"]!r}')
        by[u['cat']] += 1
    built = {b for u in U for b in u.get('build', [])} | {'armcom', 'corcom', 'legcom'}
    for u in U:
        if u['id'] not in built and not u['id'].endswith('com') and not u.get('exp') and 'drone' not in u['id']:
            warn(f'{u["id"]}: nothing can build it')
    for c in CATS:
        if not by[c]: err(f'no units found in category {c}')

    # maps
    try:
        M = load('maps.js')
        for m in M:
            if not m.get('n') or not m.get('img'): warn(f'map {m.get("id")}: missing name or image')
    except Exception as e:  # noqa: BLE001
        err(f'site/maps.js: {e}')

    # the pieces the pages load
    for f in ('siteids.js', 'changes.js', 'guides.js'):
        if not os.path.exists(f'{SITE}/{f}'): err(f'site/{f} is missing')
    # guides must only name units that exist
    gp = f'{SITE}/guides.js'
    if os.path.exists(gp):
        import re
        txt = open(gp, encoding='utf8').read()
        for m in set(re.findall(r"\b((?:arm|cor|leg)[a-z0-9]{2,})\b", txt)):
            if m not in ids and len(m) <= 10 and m not in ('armada', 'cortex', 'legion', 'armor', 'corner', 'legs', 'correct', 'corners'):
                warn(f'guides.js mentions "{m}", which is not a unit id (ignore if it is just a word)')

    if not quiet:
        for m in errors: print('ERROR  ', m)
        shown = warns[:40]
        for m in shown: print('warning', m)
        if len(warns) > len(shown): print(f'... and {len(warns) - len(shown)} more warnings')
    print(f'check: {len(U)} units, {len(errors)} errors, {len(warns)} warnings')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(run('--quiet' in sys.argv))
