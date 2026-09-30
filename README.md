# World_Building

An interactive 3D globe of **Naropa & Nalanda**, plus a seeded random-world
generator, built with [Three.js](https://threejs.org/) and [Vite](https://vite.dev/).

## Run it

```sh
npm install
npm run dev      # then open the printed http://localhost:5173 URL
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Static site in `dist/` |
| `npm run import-sketch` | Re-imports `reference/Naropa_and_Nalanda_Map.html` into `src/atlas/sketch-data.json`. Run this after updating the hand-drawn map |
| `npm run map -- nations out.png 1200 -145,95,-78,88 15` | Flat (equirectangular) PNG. View is `terrain`, `nations` or `founding`; then the crop box `west,east,south,north` and how far to move Naropa west (default 0, as drawn) |

## Controls

- **Drag** to orbit and **scroll** to zoom. North is up, so Naropa sits above Nalanda.
- **World**: *Naropa & Nalanda* (the hand-authored atlas) or *Random (seeded)*.
- **Map view**: terrain, the 19 modern nations, or the 5 founding nations. A legend appears for the political views; ★ marks prominent nations.
- **Hover** to see the nation, founding nation, terrain class, coordinates and elevation under the cursor.
- **Move Naropa west** (0–40°, default 15°): slides all of Naropa west in
  longitude to widen the ocean between the continents. Latitudes stay as in
  the tracker. The panel shows the closest coast-to-coast distance: about
  1,335 km as drawn (0°), about 2,770 km at 15° and about 4,275 km at 30°. It
  grows by roughly 1,000 km per 10°.
- **Labels / Rivers / Grid / Rotate** toggles. The equator is always drawn on the atlas.
- The URL keeps the world and view (`#world=naropa-nalanda&view=nations&shift=15`, or `#seed=...` for random worlds).

## The Naropa & Nalanda atlas

The globe is built from the hand-drawn map, `reference/Naropa_and_Nalanda_Map.html`:

- **Straight from the map:** coastlines, the 19 modern-nation borders, the 5
  founding nations, all 44 terrain classes (163 polygons), the rivers (major
  and minor), nation colours and label positions.
- **Straight from the Nations tracker:** prominent nations and continent
  names (`src/atlas/naropa-nalanda.js`), plus Mount Firmamenta as the tallest
  mountain in the world. It is placed on the largest mountain/volcano shape
  inside Firmara.
- **Placeholders:** heights per terrain type (`src/atlas/terrain-types.js`)
  and the "satellite" colours. Volcanoes are added as cones.

How the drawing maps to the globe (read from the map's own script): shapes
are drawn rotated −40.5°, which is why the equator looks diagonal on the
map. Undoing that rotation makes the equator horizontal. Latitude is linear,
with AA's tip at 83°N. The land then spans 72.8°S to 83.4°N.

**Assumption to confirm:** the map only fixes the north–south scale. The
import reads east–west the same way, at the same units per degree of
longitude (a plate carrée map, like the map's evenly spaced latitude lines).
On the globe, meridians converge toward the poles, so land drawn far north
gets narrower east to west. That's why Naropa's northern half (Borea,
Prasinagos, Eschatia) curves into a crescent near the pole.

The import rasterises the map onto a 0.125° grid (about 14 km). Any land not
covered by a nation or terrain shape takes its nearest neighbour's value: 23
cells for nations and 188 for terrain, out of 681,375 land cells. Terrain
edges are softened, land slopes down to the sea and the sea deepens away from
the coast. Coastlines stay exactly as drawn.

### Open questions

1. **Closest crossing:** on the drawn map, Naropa's nearest coast is
   Abocara's (BD's) northern tip at about 1,335 km, with Nalu (BA) close
   behind at about 1,410 km. The tracker names AF–BA as the closest point.
   Moving Naropa west keeps that ordering.
2. **East–west scale:** keep plate carrée (above), or should Naropa keep its
   drawn width even at high latitudes? Keeping the width would stretch it
   around the pole, so the map's longitudes would change.
3. **River names:** the map only marks rivers as major or minor. The tracker
   names the wetland, equatorial, desert and twin rivers, and the BK/BL
   border river. Should these names go on the globe?
4. **Heights:** replace the placeholder heights with real ones wherever you
   have them (for example, Mount Firmamenta is set to 9,500 m).
5. The pasted tracker text stopped mid-sentence at "People spread from".

## How it works

| File | Role |
| --- | --- |
| `reference/Naropa_and_Nalanda_Map.html` | The hand-drawn map (source of the geometry) |
| `scripts/import-sketch.mjs` | Converts the map into lat/lon geometry, `src/atlas/sketch-data.json` |
| `src/atlas/sketch-world.js` | Rasterises that geometry into land, nation, terrain, height and colour grids for sampling |
| `src/atlas/terrain-types.js` | The map's terrain classes: colours and placeholder heights |
| `src/atlas/naropa-nalanda.js` | Tracker facts the map doesn't carry (prominent nations, continent names) |
| `src/world.js` | Seeded random world: elevation, temperature, moisture and biome |
| `src/noise.js` | Seeded 3D simplex noise, fBm and ridged-noise helpers |
| `src/geo.js` | Lat/lon ↔ vector helpers |
| `src/globe.js` | Three.js meshes: terrain, atmosphere, grid, equator, rivers, labels, stars |
| `src/main.js` | Scene setup, UI wiring, hover readout |
| `scripts/render-map.mjs` | Flat-map PNG renderer (plain Node, no browser) |

Both worlds share one interface (`sample(x, y, z)` returns height in metres,
colour, nation and more), so the renderer can draw either. Terrain relief is
exaggerated about 20× so mountains are visible at globe scale.
