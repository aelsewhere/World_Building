# Euelia map tools: guide

Two browser tools in `Story\maps`. Open the .html files directly (double-click). No Python or `make_nation_map.py` needed; that script only makes the single-nation PNG maps.

| Tool | File | Purpose | Saves as |
|---|---|---|---|
| Road tool | `Euelia_road_tool.html` | Draw roads and rail between towns across all of Euelia | `.geojson` (e.g. `Euelia_roads_v3.geojson`) |
| City planner | `Euelia_city_planner.html` | Plan the inside of one town/village: streets, water, districts, buildings | One `.json` file per place (e.g. `Hodos_plan_v1.json`) in `maps\nations\Mesomara\Euelia` |

Both keep a backup in the browser too. Both work with stylus or mouse; fingers move and pinch. Mouse wheel zooms; hold Space or right-drag to move the map. After a new version of either file, press Ctrl+F5 to reload.

---

## 1. Road tool

### Tools
- **Draw (D):** pick a road type, then draw. Start/end near a town or another road and the line snaps (a ring shows where). Zoom in first for finer bends. Lines get very slight smoothing.
- **Select (S):** tap a road, then tap a road type to change it, or Delete.
- **Erase (E):** rub over part of a road to remove it.
- **Move:** pan the map (or hold Space).
- Undo (Ctrl+Z), Redo (Ctrl+Y), Delete, zoom +/−, **Fit** (show all of Euelia).

### Road types (keys 1-5)
| Type | Colour |
|---|---|
| Railway | black |
| Main road | red |
| Big road | orange |
| Small road | green |
| Country path | purple |

Rail snaps to towns and other rail lines, not to roads. Towns are locked and can't be moved here.

### Display toggles
Guide, Towns, Names, My roads, Finger draws.

### Files
- **Save (Ctrl+S)** writes a `.geojson`. Pick your `Story\maps` folder the first time.
- **Open** loads a saved roads file.
- **?** shows the in-tool help.

---

## 2. City planner

Pick a place from the list (villages, small/middle/large towns, cities). The **dashed circle** is a guide for how big the place should be for its population. **Edge markers** show which way roads arrive and roughly where the water is. Info on the place is under **About this place**.

### Tools
| Tool | Key | What it does |
|---|---|---|
| Draw | D | Draw streets by hand. Ends snap to other streets. |
| Pattern | P | Circle an area, choose a pattern, block size and angle, press Fill. |
| Round | O | Tap where streets cross to add a roundabout. |
| Water | W | Circle a lake/bay. For a coast, draw the shoreline as one open line; the sea fills outwards on the side away from the centre. |
| District | A | Choose a district, then circle an area, or tap inside a closed block to fill it. |
| Building | B | Tap inside a drawn district and pick a building. |
| Select | S | Tap a street, water area, district or building to change or delete it. |
| Erase | E | Rub out part of a street. |
| Clear | X | Circle an area to remove every street inside it. |
| Move | M | Pan (or hold Space). |

Right-click or press-and-hold on a street, district, building or empty ground for a short menu (change type, delete, fill the block, add a building).

### Line types (keys 1-6)
Avenue (16 m wide), Street (10 m), Lane (5 m), River (45 m), Wide river (250 m), Railway. Use the Draw tool for rivers and rail too. Shape options for Draw: **Freehand**, **Straight line** (drag end to end), **Circle** (press at centre, drag out).

### Patterns
- **Town patterns:** Regular grid, Grid with diagonal avenues, Broken grid, Rings and spokes, Old-town tangle, Winding parallel streets, Loops and dead ends, Sparse.
- **Village layouts:** one main street, crossroads, around a green, fork in the road, cluster of lanes, along the water.
- **Whole-town layouts:** grown out from its centre, stretched along its main road, grown back from the water. Each has a dense centre, a looser belt of housing, then a few roads carrying on outwards. Roads head for the arriving roads. Use **Fill whole place**, then fix what you don't like. For the water layout, turn **Angle** to point at the water.
- **Fill whole place** uses the size-guide circle, so you don't need to circle anything (handy for villages; turn Angle to aim the main street).
- Options: block size (m), angle, "Line up with nearest avenue, river or shore", "Roundabouts where avenues cross", "Join to nearby streets". Each fill comes out a little different; if you don't like it, Undo and refill.

### Districts
Residential, Government, Financial, Entertainment, Public Works, Industrial, Healing, Traveller's, Religious, Arts, Shopping, Trade, Park, Education, Fishing, Military, Harbour, Farming, Wine, Timber.
- One district can be drawn in several places.
- Tap a drawn district with the District tool to select it: drag a corner square to resize, the round handle to move. Buildings inside move with it.
- New districts of the same kind that touch (or sit one street apart) merge into one area. Residential areas never merge, so each keeps its housing type. Turn this off in View; **Join touching districts** merges ones already drawn.
- The **colour key** on the right lists this place's districts; tap one to choose it.
- **Allotments** shows how much of each district is placed (**Reset allotments to the defaults** is in there too).

### Buildings
- Tap inside a district and choose from its building list. In a residential area you also choose the main housing type.
- Drag a selected building to move it, a corner square to resize, the round handle to turn it.
- Towns can have single pieces placed inside or outside a district. Villages have no districts: tap anywhere and choose from every building.

### Menus along the top
- **View:** district colours, district names, colour key, buildings, walk rings, size guide, edge markers, grid, finger draws, auto-join of districts.
  - **Walk rings:** dotted rings show minutes on foot from the centre (about 80 m a minute). The bar at the bottom shows walk time for what you're drawing.
- **Clean up:** Join loose ends, Join touching districts, Clear streets in water (avenues stay as bridges), Clear all buildings, Clear everything (Undo brings it back; allotment numbers are kept).
- **More:** Open a saved plan, About this place, How to use the planner.
- **To do:** lists what's still missing for this place; tap an item to jump to it.
- Undo (Ctrl+Z), Redo (Ctrl+Y), Save (Ctrl+S), Delete, Delete pattern (removes the whole pattern a selected street came from).

### Keys
1-6 line type; D P W A B S E tools; Ctrl+Z / Ctrl+Y / Ctrl+S.

### Saving
Save writes one file per place. Version 3 plan format.

### Typical workflow
1. Pick the place and check the size guide and edge markers.
2. Water first (coast, lake, rivers).
3. Fill streets: Fill whole place for a start, or circle areas with different patterns. Add avenues/roundabouts.
4. Clean up: Join loose ends, Clear streets in water.
5. Fill districts (tap blocks), watching Allotments.
6. Add buildings; check **To do**.
7. Save.

---

## Notes
- Written from the tools' own built-in help and menus (as of 2026-11-16). I couldn't tell which recent edits are new, so anything added in Claude Code that isn't in the tools' help text isn't covered here.
