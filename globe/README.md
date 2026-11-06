# World globe

An Earth-sized 3D globe (radius 6,371 km) of the world, built from the Nov 4, 2026 globe data pack.

## Using it

1. Open `globe.html` in Chrome, Edge or Firefox. Double-clicking the file works. It needs an internet connection the first time, to load three.js from cdn.jsdelivr.net.
2. Click **Choose maps folder…** and pick the `maps` folder. The page uses the highest version of each file and skips anything in `maps\archive`. You can also drop the files onto the page.
3. Loading the full 8640 x 4320 grid takes about 10–30 seconds and roughly 1 GB of memory.

Nothing is uploaded: the files are read in the browser.

If the globe is still slow on your computer, set **Map detail** to **Half (faster)**. It uses a quarter of the graphics memory and repaints faster; thin rivers can break up when you zoom in close. The page remembers the choice.

## Files it reads

| File | Needed? | Used for |
| --- | --- | --- |
| world_elevation_data_v#.png | yes | Heights (16-bit, metres + 1000, 0 = sea): relief, hill shading, elevation map |
| world_landuse_data_v#.png | no | Natural-colour and land cover maps |
| world_water_data_v#.png | no | Rivers, lakes, waterfalls, gorges, springs, canal, outwash |
| world_coast_data_v#.png | no | Coast types, fjords, coral reefs |
| world_snow_data_v#.png | no | Snow and ice |
| world_continent_data_v#.png + world_nations_data_v#.png | no | Nations, borders, areas, nation list |
| world_nations_index_v#.csv | no | Nation names |
| cities_v#.csv | no | City dots and labels. Latitude and longitude columns are found by header name; longitude is read as degrees east of the seam |

If a layer has a different size from the elevation file it is rescaled to match (nearest cell).

## What it shows

- Map styles: natural colour, elevation, land cover, nations, continents, rivers and lakes, coasts and reefs, snow and ice.
- Relief raised from 0x to 50x (1x is true scale; Earth's mountains are too small to see at 1x).
- Hover readout: position, height, continent, nation and its area, land cover, water features, coast type, snow, nearest city.
- Great-circle distance tool (km and miles, on a 6,371 km sphere).
- Latitude and longitude lines, with the tropics and polar circles at Earth's tilt (23.44°).
- World summary: land area and share, continent areas, highest point; nation list with areas (click to fly there); find box for nations and cities.
- Data checks: which files were loaded, how many nations are on the map against the index, land with no nation.

## Seam longitude

The data pack counts longitude east of the map seam (column 0). The longitude number of the seam is not yet confirmed (reference, section 2; probably 180°). The **Seam longitude** setting only changes the longitudes shown and where the grid lines fall, never the map. It starts at −180.

## Testing without the real files

`tools/make_test_data.py` writes a folder of random files in the same formats (Python 3 with numpy and Pillow):

    python tools/make_test_data.py testmaps

The land it makes is meaningless and does not join up across the seam.

## The prepared globe (globe/world)

`globe/world/index.html` is the fast version, made for this one world. Everything slow is done once in advance by `tools/bake_globe.py`, which reads the world data files and writes finished map pictures (a 4096 x 2048 whole-world picture per map style, plus 32 sharp 45° tiles at full detail that load only when you zoom in), the relief heights, the hover data and the nation, city and world summaries (`world.json`).

It is published as a private claude.ai page. When the maps change, re-run the preparation and republish:

    python tools/bake_globe.py PATH/TO/maps globe/world PATH/TO/climates

With the climate files (world_t_jan/jul_data, world_p_jan/jul_data) the natural-colour map is painted realistically by `tools/realistic.py`: satellite-style colours made greener or drier by rainfall, natural edges between land-cover types, texture, treeline and snow from temperature (recorded snow is used for Morasil and Hoakamotu), coastlines drawn by recorded coast type (cliffs ragged with deep water close in, beaches in smooth arcs with sand, tropical lagoons, salt marsh, mangrove deltas with muddy water offshore, glacier fronts, black sand), rias cut inland as drowned valleys following the lowest ground, recorded fjords as dark channels joined to the sea, soft reef bands, an invented seabed, and a cloud picture. The rias reach up to about 55 km inland, so there the drawn coast departs from the recorded one (decided Nov 4); everywhere else it stays within about one cell. It needs numpy, Pillow and scipy. For a quick test of just the natural-colour map, set BAKE_ONLY=natural,natural-plain. The page adds sunlight (lit from where you look, or day and night by season and time), sun glint on water, and clouds.

The page needs a web server (it loads its files with fetch), so double-clicking `index.html` will not work; use the published link.

## Trade routes, nation maps, capitals and cities (Nov 6)

`tools/bake_extras.py` runs after `bake_globe.py` and adds, without re-making the map pictures:
- trade route layers traced from the route pictures by their legend colours (`routes_world.png`, `routes_continents.png`). Each continent picture covers its relief_v2 box from the build reference at 3x or 4x; the world sea-lane picture is the world map at 1/12 degree from relief row 160 (checked against the land: 99.5-100% of each picture's sea falls on sea);
- the nation maps and route maps as pictures for the Atlas (`nations/`, `routes/`);
- the capitals from the data pack's capital tables, and the cities from `cities_v7.csv`.

    python tools/bake_extras.py PATH/TO/maps globe/world PATH/TO/trade_routes PATH/TO/nations cities_v7.csv globe/data-pack.md
