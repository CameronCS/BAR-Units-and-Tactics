"""Rebuild every data file in site/ from the official BAR sources.

    python tools/build.py                 build everything (uses cached downloads where it can)
    python tools/build.py --refresh       download the newest BAR data first (do this after a BAR patch); the changes
                                          since your last build are added to the Changes page
    python tools/build.py --no-images     skip the picture conversion (needs Pillow, takes a few minutes)
    python tools/build.py --no-site-ids   skip the beyondallreason.info page check
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import changelog, check, fetch, images, maps_build, parse_units, site_ids  # noqa: E402

CACHE = os.path.join(HERE, '.cache')
SITE = os.path.join(os.path.dirname(HERE), 'site')
args = set(sys.argv[1:])

old = changelog.load_units(SITE + '/units.js') if os.path.exists(SITE + '/units.js') else None
prev = json.load(open(changelog.STATE)) if os.path.exists(changelog.STATE) else None
head = fetch.run(CACHE, '--refresh' in args)
parse_units.run(CACHE, SITE + '/units.js')
if old and prev and prev['sha'] != head['sha']:      # a newer BAR commit: note what changed
    changelog.record(old, changelog.load_units(SITE + '/units.js'), prev, head)
changelog.save_state(head)
if not os.path.exists(SITE + '/changes.js'):
    changelog.write_site(json.load(open(changelog.HIST)) if os.path.exists(changelog.HIST) else [])
maps_build.run(CACHE, SITE + '/maps.js')
if '--no-images' not in args:
    images.run(CACHE, SITE)
if '--no-site-ids' not in args:
    site_ids.run(SITE)
if not os.path.exists(SITE + '/mapspots.js'):
    open(SITE + '/mapspots.js', 'w').write('window.MAPSPOTS={};')   # filled in by tools/map_spots.py
status = check.run(quiet=True)
print('done' if not status else 'done, but the check found errors: run python tools/check.py to see them')
