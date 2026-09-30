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
| `npm run check` | Checks that every river point is on land and every terrain seed sits in its own nation |
| `npm run map -- nations out.png 1200 -90,70,-80,90` | Flat (equirectangular) PNG. View is `terrain`, `nations` or `founding`; the last argument crops to `west,east,south,north` |

## Controls

- **Drag** to orbit and **scroll** to zoom. North is up, so Naropa sits above Nalanda.
- **World**: *Naropa & Nalanda* (the hand-authored atlas) or *Random (seeded)*.
- **Map view**: terrain, the 19 modern nations, or the 5 founding nations. A legend appears for the political views; ★ marks prominent nations.
- **Hover** to see the nation, founding nation, terrain, coast type, coordinates and elevation under the cursor.
- **Labels / Rivers / Grid / Rotate** toggles. The equator is always drawn on the atlas.
- The URL keeps the world and view (`#world=naropa-nalanda&view=nations`, or `#seed=...` for random worlds).

## The Naropa & Nalanda atlas

Everything lives in **`src/atlas/naropa-nalanda.js`**, drafted from the Nations
tracker (Sep 27–30, 2026).

**From the tracker:** each nation's latitude range and neighbours, its terrain
zones, the rivers, the peaks (such as Mount Firmamenta, the tallest in the
world), the founding-nation groupings, and the AF–BA crossing as the closest
point between the continents.

**Placeholders:** longitudes, exact outlines and zone positions. The tracker
positions were read from a sketch that isn't in this repo, so these will be
replaced once the sketch, a land mask or a heightmap is available.

How a nation is described:

- `blobs: [[lat, lon, radiusDeg], ...]`: circles that merge smoothly into
  land. Each point on land belongs to the nation with the strongest blob
  influence. 1° is about 111 km on this Earth-sized planet.
- `terrain: [[lat, lon, type, coast?], ...]`: terrain seeds. Each land point
  takes the terrain of the nearest seeds, with softened edges between zones.
  Types and coast types are listed in `src/atlas/terrain-types.js`, with rough
  placeholder heights.
- `PEAKS` adds individual mountains and volcanoes; `RIVERS` are lat/lon
  polylines from source to mouth.

After editing, run `npm run check`, then reload the page.

### Open questions found while drafting

1. **Equatorial river vs. northern twin river.** In the tracker, BG sits
   between BI and BD, and the northern twin river runs the BG/BI border to the
   sea at BG's tip. The equatorial river starts in BI and ends at BD's west
   coast, so it has to cross the twin river. For now the twin river joins the
   equatorial river as a tributary. Which should change?
2. **"Equator: a diagonal line across continent B."** On a globe the equator
   is a line of latitude. The atlas follows each nation's latitude range; the
   diagonal is probably how the sketch is drawn.
3. **Southern extent.** The map rules say Nalanda reaches about 70°S; the F5
   (Nagrandia) row says about 73°S. The atlas uses 70°S.
4. **Missing references:** `topography_notes`, `geography_reference` and the
   sketch itself. The tracker text also stops mid-sentence at "People spread
   from".

## How it works

| File | Role |
| --- | --- |
| `src/atlas/naropa-nalanda.js` | The atlas data (see above) |
| `src/atlas/atlas-world.js` | Turns atlas data into height, colour, nation and terrain for any point on the sphere |
| `src/atlas/terrain-types.js` | Terrain and coast types: colours and placeholder heights |
| `src/world.js` | Seeded random world: elevation, temperature, moisture and biome |
| `src/noise.js` | Seeded 3D simplex noise, fBm and ridged-noise helpers |
| `src/geo.js` | Lat/lon ↔ vector helpers |
| `src/globe.js` | Three.js meshes: terrain, atmosphere, grid, equator, rivers, labels, stars |
| `src/main.js` | Scene setup, UI wiring, hover readout |
| `scripts/` | Flat-map renderer and atlas checks (plain Node, no browser) |

Both worlds share one interface (`sample(x, y, z)` returns height in metres,
colour, nation and more), so the renderer can draw either. Terrain relief is
exaggerated about 20× so mountains are visible at globe scale.
