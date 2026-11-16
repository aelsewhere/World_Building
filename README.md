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
