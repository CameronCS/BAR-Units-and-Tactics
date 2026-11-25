# Rebuilding the data

The site in `site/` is static. Its data files are generated from the official Beyond All Reason sources:

| File | Source |
| --- | --- |
| `site/units.js` | `units/*.lua` and `language/en/units.json` in the [BAR repository](https://github.com/beyond-all-reason/Beyond-All-Reason) |
| `site/img/`, `site/img/lg/` | `unitpics/*.dds` in the same repository (converted to webp) |
| `site/maps.js` | the [BAR maps metadata](https://maps-metadata.beyondallreason.dev/latest/lobby_maps.validated.json) (certified maps only) |
| `site/siteids.js` | a check of which units have a page on beyondallreason.info |
| `site/changes.js` | the difference between builds, kept in `tools/changes.json` (see below) |

Unit damage tables and armor classes come from `units/*.lua` and `gamedata/armordefs.lua`. Everything is read from one commit, so the files always match.

## After a BAR patch

```
pip install pillow
python tools/build.py --refresh
```

That downloads everything again and rewrites the files above. Downloads are cached in `tools/.cache`, so a plain `python tools/build.py` is faster and only fills in what is missing. Use `--no-images` or `--no-site-ids` to skip the slow steps.

Each refresh that finds a newer BAR commit adds an entry to the Changes page, comparing the new data with your previous build (`tools/state.json` remembers which commit that was).

To compare against an older version of BAR, for example to start the history:

```
python tools/changelog.py --since 2026-10-01
```

Requires Python 3.9 or newer. Pillow is only needed for the pictures.

## Metal spots on maps

The map metadata has wind and tidal strength but not metal spots. Those live inside the map files themselves, so a separate tool reads them:

```
pip install py7zr
python tools/map_spots.py "Acidic Quarry" "Pinch Point"     specific maps
python tools/map_spots.py --list competitive2p               a whole BAR map list
python tools/map_spots.py --show                             what is done, and the available lists
```

Each map is a 30 to 180 MB download that the tool deletes after reading it (`--max-mb 100` skips big ones, `--all` is about 19 GB). Results go to `tools/mapspots.json` and `site/mapspots.js`. The map page then draws the spots, and the planner uses them: extractors take the best spots in your start area first.

## Checking the data

`python tools/check.py` looks over the generated files and reports anything that looks broken: missing pictures, units with no cost or health, weapons with no damage, build lists naming units that do not exist, and a sudden drop in the number of units or maps (a sign the parser no longer understands BAR's files). `build.py` runs it at the end. Errors make it exit with code 1. Warnings are worth a look but are often normal, for example units that only exist as drones.

Units that only appear with the "experimental extra units" game option are read from `unitbasedefs/experimental_extra_units.lua` and marked Optional on the site.

## What is estimated, not official

- Damage per second is `damage x count / reload` for each weapon, using the default damage type.
- Strong and weak against (`site/combat.js`) uses each weapon's real damage against each armor class, what it is allowed to target, and every unit's health and metal cost. It compares equal-metal armies against cost-matched opponents. It ignores range, speed, splash damage and micro, so it is a guide and not a result.
- The building sections are worked out from the unit data by rules in `site/app.js`.
- Build guides are written by hand in `site/guides.js`.
