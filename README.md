<div align="center">

# ⚔️ BAR Units & Tactics

**The unit database, matchup calculator and build planner for [Beyond All Reason](https://www.beyondallreason.info/).**

669 units · 3 factions · 199 maps · zero dependencies · no server needed

</div>

---

## 🚀 Quick start

```
git clone https://github.com/CameronCS/BAR-Units-and-Tactics.git
```

Then open **`site/index.html`** in your browser. That's it. It's plain HTML, CSS and JavaScript, so there's no build step, no `npm install` and no server.

## ✨ Features

### 📖 Unit database
- **669 units and buildings** across all three factions, grouped by faction, type and tech level in collapsible panels that remember what you had open.
- Cards or list view, search, type and tech filters, five stat sliders (metal, health, damage, range, speed), starred-only filter and sorting.
- Each unit has a detail panel with a balance chart, cost and stat bars, every weapon with its damage against each armor class, build time per builder, what it builds and what builds it, and a "Recent changes" list.
- Units that only exist with BAR's extra-units option are marked **Optional**.

### 🥊 Matchups and combat
- **Strong / weak against**, plus "what beats it" and "what it beats", worked out from real damage per armor class, health and cost, using equal-metal armies.
- Optional range and speed correction that gives free shots to whoever outranges the other side.
- **Versus**: pick any two units and army sizes, see who wins, what's left over and why. Shareable link.
- **Compare**: up to three units side by side.

### 🌳 Tech tree
How each faction unlocks its tech, with hover highlighting.

### 🗺️ Maps
- 199 official maps with spawn layouts and roles, map pools, wind and tidal.
- Metal spots drawn on the map (24 maps imported so far).
- **Draw on any map**: lettered start boxes like the BAR lobby, spawn markers by team, pen, arrows, erase and undo. Saved in your browser and shareable as a link.
- **Suggest good spawns**: picks the spots with the most metal in reach, one per start area or spread across the map.

### 📋 Guides and build planner
- Build orders per faction and playstyle: opening, 1v1, team frontline, economy and air, FFA and naval, with tips and common mistakes.
- **Planner**: stages with check marks. Ticked items add their metal, energy and build power, and everything left is timed against the income you'd have by then.
- Counts energy converters and extractors on real metal spots, and warns when there's no free spot.
- **Income timeline**: metal, energy and build power over the course of the plan, with the stretches where income (not build power) holds you back shaded.
- **Stall fixes**: for the biggest stretch held back by income, it tries adding a few income buildings just before it and suggests the ones that finish the plan soonest, with an Add to plan button.
- Pick a faction, commander, map, start position and wind level. Share a plan as a link or as text.

### 🪖 Army builder and faction equivalents
- **Army builder**: build two armies from any mix of units, see what each can and cannot hit (anti-air, ships, subs) with one-click fixes, then fight them in a simulation that also shows the metal each side lost and destroyed. Shareable link. Versus has a button that carries a matchup over.
- **Equivalents**: the three factions side by side by category, tech level and role.

### 🧭 Map briefing and team roles
- **Briefing**: pick a map and start position for its wind-or-solar advice, metal spots at home, spawn role and a suggested opener with its timing on that map.
- **Team roles**: give each spawn on your team a role (frontline, economy, air, naval), get the matching guide and income plan for each, and a check for holes in the team. Shareable link.

### 📈 Changes
Unit changes between BAR versions, filterable by faction and buff or nerf.

### 🧰 Quality of life
`Ctrl+K` search across units, maps, guides and pages · phone menu · starred units · faction themes.

## 🗂️ Project layout

```
BAR-Units-and-Tactics/
├── site/     The website (open index.html)
│   ├── units.js, maps.js, mapspots.js, changes.js, siteids.js   generated data
│   ├── guides.js                                                written by hand
│   └── img/                                                     unit icons
└── tools/    Python scripts that rebuild the data (see tools/README.md)
```

## 🔧 Updating the data

The data comes straight from BAR's own files. After a BAR patch:

```bash
python tools/build.py --refresh   # download the newest BAR data and log it on the Changes page
python tools/check.py             # report broken or suspicious data
```

| Script | What it does |
| --- | --- |
| `build.py` | Rebuilds everything. `--refresh` pulls the newest BAR data. |
| `check.py` | Reports data problems (currently 0 errors, 42 warnings). |
| `changelog.py --since DATE` | Compares against an older BAR version. |
| `map_spots.py` | Reads metal spots out of map files (needs `pip install py7zr`). |

Downloads are cached in `tools/.cache` (about 50 MB) and can be deleted safely.

## ⚠️ Good to know

These are estimates, not official numbers.

- Matchup numbers are a guide. They ignore splash damage and micro, and the range model is simple.
- Planner numbers assume every builder works together, ignore stored resources and use a guessed 50% converter share.
- Metal spot values are estimated from the metal map and the map's `maxMetal` setting.
- Spawn suggestions only see metal, not terrain, height or water.
- Starred units, drawings, plans and settings live in your browser's storage, so clearing it clears them.
- Shared links only work for someone who has the same site folder.
- Not yet tested on a real phone or touch screen.

## 🛣️ Roadmap

- [ ] Income timeline chart in the planner
- [ ] Mixed-army builder with gap analysis (anti-air, anti-armor, anti-sub)
- [ ] Per-map briefing with a suggested opener
- [ ] Team role planner
- [ ] Faction equivalents side by side
- [ ] Metal spots for the remaining 175 maps
- [ ] Hosting (e.g. GitHub Pages)

## 🙏 Credits

Unit and map data comes from [Beyond All Reason](https://github.com/beyond-all-reason). This is an unofficial fan project and isn't affiliated with the BAR team.
