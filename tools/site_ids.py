"""Check which units have a page on beyondallreason.info and write site/siteids.js."""
import json, re, sys, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor


def run(site):
    ids = re.findall(r'"id":"(\w+)"', open(site + '/units.js', encoding='utf8').read())

    def go(i):
        for _ in range(2):
            try:
                r = urllib.request.Request('https://www.beyondallreason.info/unit/' + i, headers={'User-Agent': 'bar-unit-database-build'})
                return i, urllib.request.urlopen(r, timeout=30).status
            except urllib.error.HTTPError as e:
                return i, e.code
            except Exception:  # noqa: BLE001
                pass
        return i, 0

    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(go, ids))
    ok = [i for i, c in res if c == 200]
    open(site + '/siteids.js', 'w').write('window.SITE_IDS=new Set(' + json.dumps(ok, separators=(',', ':')) + ');')
    print(f'unit pages on the BAR website: {len(ok)} of {len(ids)}')


if __name__ == '__main__':
    run(sys.argv[1])
