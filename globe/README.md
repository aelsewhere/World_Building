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
