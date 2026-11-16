# World_Building

Maps, data and tools for the world.

## Layout

| Folder | What is in it |
| --- | --- |
| `globe/` | The 3D globe: `globe.html` (loads the raw map files), `world/` (the prepared, published version), `tools/` (the scripts that prepare it), plus `data-pack.md` and `build-reference.md`. See `globe/README.md`. |
| `data/` | World-wide source data. `cities_v7.csv` is the city list. |
| `data/climate/` | January and July temperature and rainfall data layers, and the temperature and rainfall maps. |
| `data/source-archives/` | Zipped source maps: continent and world map layers (`maps_for_claude_pt1.zip`, `pt2`), single-nation maps (`nations.zip`) and trade route maps (`trade_routes.zip`). |
| `nations/euelia/` | Work on the nation of Euelia: the road drawing tool and city planner (open the `.html` files in a browser), the towns list and the roads file. |
| `nations/euelia/city-plans/` | Saved city plans from the city planner (Hodos, Stoma). |
| `nations/euelia/tools/` | `bake_planner_map.py` puts the map data (water grid, rivers, roads near towns) into the city planner. Re-run it when the world maps, the towns list or the roads file change; its header says how. |
| `tools/` | Stand-alone scripts. `make_nation_map.py` draws single-nation maps for a continent. |

## Conventions

- Files keep their version suffix (`_v3`, `_v7`); the highest number is the current one.
- Scripts take their input folders as arguments, except `tools/make_nation_map.py`, which reads the maps from a fixed folder set at the top of the file (`M`).


# Globe roadmap: fill-in checklist

Goal: a detailed, explorable world: a Google-Maps-style view of the whole globe, maybe a 3D globe and street view later. No fixed finish line.
Scale: 128 nations, 6 continents, max 200 towns/cities per nation (most under 100).
Tools: `Euelia_road_tool.html`, `Euelia_city_planner.html`, `make_nation_map.py` (see `Euelia_tools_guide.md`). No dedicated software planned; new scripts will combine the globe, map and nation data.

---

## A. Hand-built nations (fill in; 1 to 3 per continent)
Done by hand because city layout differs by region. Every other nation copies from one of these (with Claude's help).

- Mesomara: Euelia, ____, ____
- Solua: ____
- Kamon: ____, ____, ____
- Elmiyaro: ____
- Morasil: ____, ____
- Hoakamotu: ____

- [ ] All six continents have at least one pick
- [ ] Note per continent what makes its city layout different:
  - Mesomara: ____
  - Solua: ____
  - Kamon: ____
  - Elmiyaro: ____
  - Morasil: ____
  - Hoakamotu: ____

## B. Hand-built progress
(Copy a line per nation as you pick them.)
- [ ] Euelia: towns planned ( / ), roads/rail drawn, water drawn
- [ ] ____: towns planned ( / ), roads/rail drawn, water drawn

## C. Copied nations (fill in as you go)
Format: nation, copied from, status.
- Thymia, from ____, ____
- ____

Per copy: [ ] pick source nation, [ ] Claude copies and adapts the plan (terrain, water, town sizes, roads in), [ ] you review and fix in the tools.

## D. Whole-world data (all 128 nations)
- [ ] Land data finished
- [ ] All cities/towns placed in every nation
- [ ] Travel routes mapped for every nation
- [ ] Water drawn everywhere
- [ ] A single per-nation status list exists (by hand / copied, towns, roads, water)

## E. Google-Maps-style view (draft task list; edit freely)
- [ ] Decide one common data format for towns, streets, districts, buildings, roads/rail and water
- [ ] Script: combine the per-place city plans (`.json`) and roads (`.geojson`) into world-level data
- [ ] Script: combine in the globe and nation data (land, water, borders)
- [ ] Choose how it displays (e.g. a browser page) and build a first viewer
- [ ] Zoom levels: globe, continent, nation, town, street, each showing the right detail
- [ ] Labels: nation names, town names, street/road names
- [ ] Search/jump to a nation or town
- [ ] Map styling: colours for districts, water, roads and rail
- [ ] Performance check with all 128 nations loaded

## F. Building designs (optional, if you're feeling it)
- [ ] List the building types to design (bank, town hall, ...)
- [ ] Design one version of each
- [ ] Optional: variants by continent, max ~6 per building type

## G. 3D globe and street view
- [ ] Render a 3D globe
- [ ] Street-view-style exploring
- [ ] Push for as much detail as is fun

