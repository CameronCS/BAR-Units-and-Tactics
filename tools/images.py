"""Convert the game's .dds unit pictures to small (96px) and large (256px) webp files. Needs Pillow."""
import io, json, os, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor

from fetch import RAW, get

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is required for images:  pip install pillow')


def run(cache, site, force=False):
    tree = {x['path'].lower(): x['path'] for x in json.load(open(cache + '/tree.json'))['tree'] if x['path'].startswith('unitpics/')}
    ids = re.findall(r'"id":"(\w+)"', open(site + '/units.js', encoding='utf8').read())
    buildpic = {}
    for f in os.listdir(cache + '/raw'):
        t = open(cache + '/raw/' + f, encoding='utf8', errors='ignore').read()
        b = re.search(r'buildpic = "([^"]+)"', t)
        if b:
            for m in re.finditer(r'^\t(\w+) = \{', t, re.M):
                buildpic[m.group(1)] = b.group(1)
    os.makedirs(site + '/img/lg', exist_ok=True)

    def one(i):
        small, large = f'{site}/img/{i}.webp', f'{site}/img/lg/{i}.webp'
        if not force and os.path.exists(small) and os.path.exists(large):
            return 1
        p = tree.get('unitpics/' + buildpic.get(i, i + '.dds').lower())
        if not p:
            return 0
        try:
            im = Image.open(io.BytesIO(get(RAW + urllib.parse.quote(p)))).convert('RGBA')
            big = im.copy(); big.thumbnail((256, 256)); big.save(large, quality=80)
            im.thumbnail((96, 96)); im.save(small, quality=80)
            return 1
        except Exception as e:  # noqa: BLE001
            print('image failed', i, e)
            return 0

    with ThreadPoolExecutor(12) as ex:
        done = sum(ex.map(one, ids))
    print(f'images: {done} of {len(ids)}')


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2], '--force' in sys.argv)
