"""Read the metal spots out of BAR map files, so the site can plan builds on a real map.

    python tools/map_spots.py "Acidic Quarry" "Pinch Point"     specific maps (by name)
    python tools/map_spots.py --list competitive2p              every map in a BAR map list
    python tools/map_spots.py --all                             every certified map (about 19 GB of downloads, slow)
    python tools/map_spots.py ... --max-mb 100                  skip map files bigger than this
    python tools/map_spots.py ... --refresh                     redo maps that were already done
    python tools/map_spots.py --show                            list what is done and the available map lists

Each map is a .sd7 archive (a 7-zip file, often 30 to 180 MB). The tool downloads it, reads the metal map out of its
.smf file and the extraction settings out of mapinfo.lua, and deletes the archive again. Results are kept in
tools/mapspots.json and written to site/mapspots.js. Needs: pip install py7zr

How a spot is found: pixels of the metal map (one per 16 map units) with a value of at least 30 are grouped, and each
group's size is the sum of every metal pixel within the extractor radius of its centre, divided by 1000. The site
multiplies that by the map's maxMetal setting to get a spot value: the metal per second of a basic extractor on it.
A standard spot comes out near 2, which matches how map makers tune their maps, but the engine's exact scaling is not
something this tool can check, so treat the values as estimates.
"""
import json, math, os, re, struct, sys, tempfile, urllib.request
import threading
from concurrent.futures import ThreadPoolExecutor
LOCK = threading.Lock()

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(os.path.dirname(HERE), 'site')
STORE = HERE + '/mapspots.json'
MIN_PIXEL, MIN_SPOT = 30, 250      # a pixel this bright can start a spot; a group needs this much total to count


def load_maps():
    s = open(SITE + '/maps.js', encoding='utf8').read()
    return json.loads(s[s.index('=') + 1:].rstrip().rstrip(';'))


def spots_from(smf_path, radius):
    f = open(smf_path, 'rb')
    head = f.read(80)
    if head[:15] != b'spring map file':
        raise ValueError('not a Spring map file')
    width, length = struct.unpack_from('<2i', head, 24)
    metal_ptr = struct.unpack_from('<i', head, 68)[0]
    mw, mh = width // 2, length // 2                       # metal map: one pixel per 16 map units
    f.seek(metal_ptr)
    data = f.read(mw * mh)
    f.close()
    if len(data) < mw * mh:
        raise ValueError('metal map is cut short')
    seed = {(i % mw, i // mw): v for i, v in enumerate(data) if v >= MIN_PIXEL}
    seen, groups = set(), []
    for p in seed:
        if p in seen:
            continue
        stack, comp = [p], []
        seen.add(p)
        while stack:
            q = stack.pop(); comp.append(q)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (q[0] + dx, q[1] + dy)
                    if n in seed and n not in seen:
                        seen.add(n); stack.append(n)
        if sum(seed[c] for c in comp) >= MIN_SPOT:
            groups.append(comp)
    rpx = radius / 16.0
    out = []
    for comp in groups:
        wsum = sum(seed[c] for c in comp)
        cx = sum(c[0] * seed[c] for c in comp) / wsum
        cy = sum(c[1] * seed[c] for c in comp) / wsum
        total = 0
        for y in range(max(0, int(cy - rpx - 1)), min(mh, int(cy + rpx + 2))):
            for x in range(max(0, int(cx - rpx - 1)), min(mw, int(cx + rpx + 2))):
                if math.hypot(x - cx, y - cy) <= rpx:
                    total += data[y * mw + x]
        out.append([round((cx + .5) / mw * 200, 1), round((cy + .5) / mh * 200, 1), round(total / 1000, 2)])
    out.sort(key=lambda s: (s[1], s[0]))
    return out, width * 8, length * 8


def process(m, tmp_root):
    import py7zr
    dest = os.path.join(tmp_root, m['id'])
    req = urllib.request.Request(m['dl'], headers={'User-Agent': 'bar-unit-database-build'})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, 'wb') as out:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            out.write(b)
    try:
        ex = os.path.join(tmp_root, m['id'] + '_x')
        with py7zr.SevenZipFile(dest) as z:
            names = z.getnames()
            smf = [n for n in names if n.lower().startswith('maps/') and n.lower().endswith('.smf')]
            if not smf:
                raise ValueError('no .smf file in the archive')
            want = [smf[0]] + [n for n in names if n.lower() == 'mapinfo.lua']
            z.extract(path=ex, targets=want)
        radius, maxm = 50.0, None
        mi = os.path.join(ex, 'mapinfo.lua')
        if os.path.exists(mi):
            t = open(mi, encoding='utf8', errors='ignore').read()
            r1, r2 = re.search(r'extractorRadius\s*=\s*([\d.]+)', t), re.search(r'maxMetal\s*=\s*([\d.]+)', t)
            radius = float(r1.group(1)) if r1 else radius
            maxm = float(r2.group(1)) if r2 else None
        spots, wx, wz = spots_from(os.path.join(ex, smf[0]), radius)
        return {'r': radius, 'mx': maxm, 's': spots}
    finally:
        os.remove(dest)
        import shutil
        shutil.rmtree(os.path.join(tmp_root, m['id'] + '_x'), ignore_errors=True)


def write_site(store):
    open(SITE + '/mapspots.js', 'w', encoding='utf8').write('window.MAPSPOTS=' + json.dumps(store, separators=(',', ':')) + ';')


def run(argv):
    maps = load_maps()
    store = json.load(open(STORE, encoding='utf8')) if os.path.exists(STORE) else {}
    if '--show' in argv:
        lists = sorted({l for m in maps for l in m['ls']})
        print(f'{len(store)} of {len(maps)} maps done. Map lists:', ', '.join(lists))
        return
    max_mb = float(argv[argv.index('--max-mb') + 1]) if '--max-mb' in argv else None
    pick = []
    if '--all' in argv:
        pick = maps
    elif '--list' in argv:
        name = argv[argv.index('--list') + 1]
        pick = [m for m in maps if name in m['ls']]
    skip = {argv[argv.index(f) + 1] for f in ('--max-mb', '--list') if f in argv}
    names = [a.lower() for a in argv if not a.startswith('--') and a not in skip]
    for n in names:
        found = [m for m in maps if m['n'].lower() == n or m['id'].lower() == n]
        if not found:
            print('no map called', n)
        pick += found
    pick = [m for i, m in enumerate(pick) if m not in pick[:i]]
    if '--refresh' not in argv:
        pick = [m for m in pick if m['id'] not in store]
    if not pick:
        print('nothing to do. Give map names, --list NAME or --all (see --show).')
        write_site(store)
        return
    try:
        import py7zr  # noqa: F401
    except ImportError:
        sys.exit('This needs py7zr: pip install py7zr')
    tmp_root = tempfile.mkdtemp(prefix='barmaps_')
    print(f'{len(pick)} maps to read')

    def one(m):
        try:
            if max_mb:
                req = urllib.request.Request(m['dl'], headers={'User-Agent': 'bar-unit-database-build', 'Range': 'bytes=0-0'})
                cr = urllib.request.urlopen(req, timeout=60).headers.get('Content-Range', '')
                if '/' in cr and int(cr.split('/')[-1]) > max_mb * 1e6:
                    print('skipped (too big):', m['n']); return
            res = process(m, tmp_root)
            with LOCK:
                store[m['id']] = res
                json.dump(store, open(STORE, 'w', encoding='utf8'), separators=(',', ':'))
                write_site(store)
            print(f"{m['n']}: {len(res['s'])} spots")
        except Exception as e:  # noqa: BLE001
            print('failed:', m['n'], '-', str(e)[:100])
    with ThreadPoolExecutor(3) as ex:
        list(ex.map(one, pick))
    write_site(store)
    print(f'done: {len(store)} maps have metal spots')


if __name__ == '__main__':
    run(sys.argv[1:])
