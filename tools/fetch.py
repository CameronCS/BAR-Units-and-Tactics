"""Download the raw BAR data into tools/.cache (unit definitions, language file, armor classes, map metadata).

Everything is read from one commit of the BAR repository, so the files always belong together.
"""
import json, os, shutil, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

REPO = 'beyond-all-reason/Beyond-All-Reason'
API = 'https://api.github.com/repos/' + REPO + '/'
RAWBASE = 'https://raw.githubusercontent.com/' + REPO + '/'
RAW = RAWBASE + 'master/'     # pictures are always taken from the newest version
MAPS = 'https://maps-metadata.beyondallreason.dev/latest/'


def get(url, retries=3):
    last = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'bar-unit-database-build'})
            return urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(f'could not download {url}: {last}')


def resolve(ref=None, until=None):
    """Return {'sha', 'date'} for a commit: a sha, the newest commit before a date (YYYY-MM-DD), or master."""
    if until:
        d = json.loads(get(API + f'commits?until={until}T23:59:59Z&per_page=1'))[0]
    else:
        d = json.loads(get(API + 'commits/' + (ref or 'master')))
        d = d[0] if isinstance(d, list) else d
    return {'sha': d['sha'], 'date': d['commit']['committer']['date'][:10]}


def run(cache, refresh=False, head=None, maps=True):
    if refresh and os.path.isdir(cache + '/raw'):
        shutil.rmtree(cache + '/raw')       # so units BAR has removed do not linger
    os.makedirs(cache + '/raw', exist_ok=True)
    hp = cache + '/head.json'
    if head is None:
        if refresh or not os.path.exists(hp):
            head = resolve()
            json.dump(head, open(hp, 'w'))
        else:
            head = json.load(open(hp))
    else:
        json.dump(head, open(hp, 'w'))
    raw = RAWBASE + head['sha'] + '/'
    simple = {'tree.json': API + 'git/trees/' + head['sha'] + '?recursive=1', 'units.json': raw + 'language/en/units.json',
              'armordefs.lua': raw + 'gamedata/armordefs.lua', 'experimental_extra_units.lua': raw + 'unitbasedefs/experimental_extra_units.lua'}
    if maps:
        simple.update({'lobby_maps.json': MAPS + 'lobby_maps.validated.json', 'live_maps.json': MAPS + 'live_maps.validated.json'})
    for name, url in simple.items():
        dest = f'{cache}/{name}'
        if refresh or not os.path.exists(dest):
            print('fetching', name)
            open(dest, 'wb').write(get(url))
    tree = json.load(open(cache + '/tree.json'))['tree']
    paths = [x['path'] for x in tree if x['path'].startswith('units/') and x['path'].endswith('.lua')]

    def one(p):
        out = cache + '/raw/' + p.replace('/', '__')
        if not refresh and os.path.exists(out):
            return
        open(out, 'wb').write(get(raw + urllib.parse.quote(p)))

    print(f'unit definitions: {len(paths)} (commit {head["sha"][:7]}, {head["date"]})')
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(one, paths))
    return head


if __name__ == '__main__':
    run(sys.argv[1], '--refresh' in sys.argv)
