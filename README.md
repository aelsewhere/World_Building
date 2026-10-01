# World_Building

An interactive 3D globe for world building. It opens on a **blank planet you
draw yourself**, and also includes **Naropa & Nalanda** and a seeded
random-world generator. Built with [Three.js](https://threejs.org/) and [Vite](https://vite.dev/).

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
| `npm run map -- nations out.png 1200 -180,180,-80,90 15 1 1 0 0` | Flat (equirectangular) PNG. Arguments: view (`terrain`, `nations` or `founding`), output file, width, crop box `west,east,south,north`, degrees to move Naropa west, natural-shapes strength (0 = as drawn), `1` to include the draft lands, degrees to move Naropa south, degrees to rotate Nalanda counterclockwise |

## On your phone

The globe is published as a private page on claude.ai:
https://claude.ai/artifact/L7whJqNWZTLpeYRk4BkMQd. It opens in any phone
browser once you're signed in. Share it from the page's Share menu if others
should see it.

On a phone, the controls start folded behind a **Controls** button. Tap the
globe to see what's there, drag with one finger to turn it, and pinch to
zoom. Phones default to Medium mesh detail.

To update the page after changing the code, run `npm run build:artifact`,
then republish `dist/artifact.html` together with the script it names under
`dist/assets/`.

## Drawing a planet

The **Blank planet** world (the default) starts as open ocean. The toolbar at
the bottom has:

- **✏️ Drawing / ✋ Moving:** while drawing, a one-finger drag (or mouse drag)
  paints. Switch to Moving to turn and zoom the globe; tap the globe there to
  inspect a spot.
- **Brushes:**
  - **Land:** terrain chosen by latitude, from ice and tundra near the poles
    down to jungle at the equator.
  - **Sea:** erases land.
  - **Terrain:** Mountains, Hills, Forest, Jungle, Grassland, Desert, Tundra,
    Ice and Lake. Terrain brushes also raise land, so you can paint mountains
    straight into the sea.
- **Size:** brush radius 1–20°. 1° is about 111 km on an Earth-sized planet.
- **Undo** and **Clear.** Clear asks for a second tap.

Coastlines, zone edges and relief get the same natural detail as the
Naropa & Nalanda atlas, with ridged mountains, snow on high peaks, and soft
blending between brushes.

**Saving:** the drawing is saved automatically, about a second after each
stroke, as its list of strokes. On the published claude.ai page it goes to
your private document in the page's database (`data/users/<you>/planet`), so
it follows you across devices. Anywhere else it's kept in the browser's
localStorage. One document holds up to 256 KB, roughly several hundred
strokes; the toolbar says if a drawing gets too big to save.

**Exporting** (Controls → Save & export, or **Save…** in the drawing
toolbar):

- **Map image (PNG):** the whole planet as a flat world map, 2048×1024
  (1440×720 on phones). Works for every world, including Naropa & Nalanda.
- **Globe picture (PNG):** what's on screen.
- **Planet file (JSON):** the drawing itself. **Open planet file…** loads one
  back; it replaces the current drawing and asks for a second tap first.

On claude.ai each export shows a save prompt (the share sheet on a phone).

Saved planets kept in this repo live in `worlds/`. Render one to a flat map
with `node scripts/render-planet.mjs worlds/<file>.json out.png [width]`.

Code: `src/paint/paint-world.js` (brushes, painted grids, sampling),
`src/paint/storage.js` (saving) and `src/paint/export.js` (exports).

## Controls

- **Drag** to orbit and **scroll** to zoom. North is up, so Naropa sits above Nalanda.
- **World**: *Naropa & Nalanda* (the hand-authored atlas) or *Random (seeded)*.
- **Map view**: terrain, the 19 modern nations, or the 5 founding nations. A legend appears for the political views; ★ marks prominent nations.
- **Hover** (or tap on a touch screen) to see the nation, founding nation, terrain class, coordinates and elevation under the cursor.
- **Move Naropa west** (0–40°, default 15°): slides all of Naropa west in
  longitude to widen the ocean between the continents. Latitudes stay as in
  the tracker. The panel shows the closest coast-to-coast distance: about
  1,335 km as drawn (0°), about 2,770 km at 15° and about 4,275 km at 30°. It
  grows by roughly 1,000 km per 10°.
- **Move Naropa south** (0–40°, default 0): moves Naropa south along its
  centre meridian. Naropa moves as one solid piece around the globe, west and
  south together, so its shape and size in km stay the same; the draft lands
  move with it. The panel shows Naropa's new latitude range and warns if it
  overlaps Nalanda. Moving it south changes two tracker facts: Eschatia's tip
  at about 83°N, and all of Naropa lying north of the equator. At 28° south,
  for example, Naropa spans 18.2°S to 55.9°N.
- **Rotate Nalanda** (−90° to 90°, default 0; positive is counterclockwise
  as seen from above): turns all of Nalanda, Nalu included, as one solid
  piece about the centre of its mainland coastline (about 23°S, 23°E). About
  41° counterclockwise puts Nalu's centre on the equator (0.4°N, about 29°W).
  The panel shows Nalu's latitude. Like moving Naropa south, this changes
  latitudes the tracker lists, such as BA at about 18–34°N and the equator
  crossing BD.
- **Natural shapes** (0–2, default 1): how much natural detail is layered
  on your drawing. 0 shows the map exactly as drawn. See "Natural shapes"
  below.
- **Mesh detail**: *Very high* (about 660k vertices) shows the finer
  coastline when zoomed in, but takes a few seconds longer to generate.
- **Labels / Rivers / Grid / Rotate** toggles. The equator is always drawn on the atlas.
- The URL keeps the world and view (`#world=naropa-nalanda&view=nations&shift=15&natural=1`, or `#seed=...` for random worlds).

## The Naropa & Nalanda atlas

The globe is built from the hand-drawn map, `reference/Naropa_and_Nalanda_Map.html`:

- **Straight from the map:** coastlines, the 19 modern-nation borders, the 5
  founding nations, all 44 terrain classes (163 polygons), the rivers (major
  and minor), nation colours and label positions.
- **Straight from the Nations tracker:** prominent nations and continent
  names (`src/atlas/naropa-nalanda.js`), plus Mount Firmamenta as the tallest
  mountain in the world. It is placed on the largest mountain/volcano shape
  inside Firmara.
- **Placeholders:** heights per terrain type (`src/atlas/terrain-types.js`),
  the "satellite" colours and all the natural-shape detail below. Volcanoes
  are added as cones.

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
cells for nations and 188 for terrain, out of 681,375 land cells.

### Natural shapes

Noise is layered on top of the drawing, and your shapes stay recognisable at
the default strength:

- **Coastlines:** fractal noise on the distance to the drawn coast adds bays,
  headlands and small offshore islands, about ±100 km at strength 1. Areas
  drawn as fjords get deeper, finer cuts.
- **Terrain zones and borders:** each point looks up its terrain and nation a
  little off its true position (up to about 2°, at three scales), so straight
  polygon edges become organic. Nation borders follow the same shapes.
- **Relief:** mountainous terrain (mountains, volcanoes, ice fields, fjords,
  gorges, and more lightly highlands) gets sharp ridged relief with bare rock
  on the crests, and snow only on high peaks. Other terrain gets gentle
  rolling relief.
- **Colour:** subtle brightness and warm/cool variation within each zone.
- **Rivers:** rivers sit in shallow valleys with greener banks, and are
  clipped where the natural coastline has moved.

Naropa's noise is taken at its drawn position, so moving it west doesn't
change its shapes. The noise is fixed (seeded), so the planet looks the same
on every load.

### Draft lands west of Naropa

Six rough landmasses traced from a globe sketch
(`reference/draft-lands-sketch.jpg`), shown when **Draft lands west of
Naropa** is ticked (the default). Run `node scripts/trace-draft-lands.mjs` to
regenerate `src/atlas/draft-lands.json` after editing the traced outlines.

- **Placement:** the sketch is a disc with Naropa's northwest tip as a red
  sliver on its upper-right edge. Reading it as a north-up view of the globe
  and lining that sliver up with Naropa's real coast puts the disc's centre at
  about 40°N, 168.5°E (in Naropa's drawn position). The fit is rough.
- **Result:** the lands fill the ocean between Naropa's west coast and
  Nalanda's east coast. The central landmass reaches about 82°N, ending a few
  hundred km from Naropa's northern tip.
- **They move with Naropa.** With draft lands shown, "Move Naropa west" stops
  at 30° so they don't wrap around into Nalanda.
- **Placeholder terrain** in latitude bands (ice, tundra, taiga, forest,
  grassland, scrub, savanna, jungle). There are no nations, names or rivers
  yet; the hover readout marks them as drafts.

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
