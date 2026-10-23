# Globe build reference (Oct 21; updated Oct 23)

A single reference for building the new detailed 3D globe later (Pass 3 of claude/map_building_plan.md). It gathers every decision that affects how the world looks, where each data file is and how to read it. Detailed reasons live in the linked Project docs. Nothing new is decided here.

Status (Oct 23): Pass 1 (elevation, winds, currents, climate check) is complete. Pass 2 (rivers in detail, coasts, passes, snowlines, glaciers, land use) is finished for Morasil (Oct 22–23; claude/morasil_pass2.md) and not yet started on the other five continents. Then the nation borders are redrawn to fit the new geography (before the globe; user, Oct 22–23). Pass 3 (seams and the map edge) has not been done yet. Items still to draw are listed in section 10.

---

## 1. The planet

- Earth-sized, with Earth's axial tilt, seasons and wind belts (confirmed Oct 8). The equator runs across the middle of the map.
- Six continents (named Oct 8): Morasil (C1), Solua (C2), Mesomara (C3), Kamon (C4), Elmiyaro (C5), Hoakamotu (C6). 91 modern nations in all (see claude/continents.md and claude/nations_tracker.md).
- Polar ice caps cover both ends of the map, as drawn on world_map_relief_v2.
- Coastlines are fixed (never edited in the map-building plan). Morasil's fjords are drawn as inlets narrower than one map cell, so they don't change the coastline.

## 2. Grid, coordinates and the map seam

- Master map: **world_map_relief_v2** (in maps\archive): the full globe, equirectangular, 2880 x 1440 px, 0.125° per px. Row 0 = 90°N. Column 0 = the map seam (left edge).
  - Latitude of a row: lat = 90 − (row + 0.5) × res. Longitude of a column, counted from the seam: (col + 0.5) × res degrees east of the seam.
  - Not confirmed: which longitude number the seam has in the globe tool. The existing globe file (planet-2026-10-13.json) uses longitudes from −180 to 180, so the seam is probably 180°. **Check this before building.**
- The globe file **planet-2026-10-13.json** (maps\): format "world-building-planet", version 2; base layer 1440 x 720 at 0.25°, run-length encoded, 23 land-cover keys: jungle, forest, savanna, grassland, steppe, desert, saltflats, scrubland, dryscrub, tforest, trainforest, conifer, moor, tussock, cloudforest, farmland, marsh, mangroves, fogdesert, tundra, ice, mountains, lakes. Plus brush strokes [brush, radius×10, lat×10, lon×10, …]. It is from Oct 13, so it does not include anything from the map-building plan.
- Planned master data setup: one data file on the 0.25° grid (the same grid as the globe file), with separate layers for elevation, climate, rivers and biomes. Every map (flat, globe, continent, nation) is made from it. Continent close-ups are reprojected so high latitudes aren't stretched.
- **world_climate_v1** = world_map_relief_v2 rows 180–1224 (about 67.5°N to 63°S), plus a legend panel (map part 2880 px wide). It carries white "C1"–"C6" label boxes at relief px (302, 661), (1981, 661), (1081, 701), (1491, 751), (661, 840), (2471, 891), each about 60 x 42 px; ignore these when reading land cover. It does not include Morasil's Pass 2 land use (use C1_climate_combined_v2 or Morasil_landuse_data_v1 for Morasil).

### Where each continent's maps sit on the master grid

Each continent's climate map (maps\climates\C#_climate_combined.png; Morasil's is now _v2) and elevation files cover this box of relief_v2 pixels, scaled up as shown:

| Continent | relief_v2 box (x0, y0)–(x1, y1) | Scale | Degrees per px | Top edge |
| --- | --- | --- | --- | --- |
| Morasil (C1) | (0, 280)–(520, 1200) | 1.5x | 1/12 | 55°N |
| Solua (C2) | (470, 610)–(930, 1090) | 1.5x | 1/12 | 13.75°N |
| Mesomara (C3) | (716, 344)–(1272, 1052); elevation from v2: (716, 344)–(1332, 1052) | 1.5x | 1/12 | 47°N |
| Kamon (C4) | (1280, 372)–(1924, 1090) | 1.5x | 1/12 | 43.5°N |
| Elmiyaro (C5) | (1770, 380)–(2220, 980) | 1.5x | 1/12 | 42.5°N |
| Hoakamotu (C6) | (2176, 190)–(2880, 1156); right edge = the seam | 1.25x | 0.1 | 66.25°N |

Boxes overlap; neighbouring continents' land appears inside them. When combining, take each continent's own land only.

## 3. Data files (all in Claude\Story\maps)

### Per continent: elevation (current versions; older ones in maps\archive)

| Continent | Files |
| --- | --- |
| Morasil | Morasil_elevation_v5.png, Morasil_relief_v9.png, Morasil_elevation_data_v5.png (plus the Pass 2 layers below) |
| Solua | Solua_elevation_v2.png, Solua_relief_v2.png, Solua_elevation_data_v2.png |
| Mesomara | Mesomara_elevation_v2.png, Mesomara_relief_v2.png, Mesomara_elevation_data_v2.png |
| Kamon | Kamon_elevation_v1.png, Kamon_relief_v1.png, Kamon_elevation_data_v1.png |
| Elmiyaro | Elmiyaro_elevation_v1.png, Elmiyaro_relief_v1.png, Elmiyaro_elevation_data_v1.png |
| Hoakamotu | Hoakamotu_elevation_v1.png, Hoakamotu_relief_v1.png, Hoakamotu_elevation_data_v1.png |

- `*_elevation_v#.png`: colour by height with hillshade. `*_relief_v#.png`: shaded relief on the recorded climate colours (Morasil's also shows the water, snow and coast layers and the passes).
- `*_elevation_data_v#.png`: **16-bit greyscale; value = metres + 1000; 0 = sea.** Same grid and box as that continent's climate map (table above).

### Morasil Pass 2 layers (Oct 22–23; same grid and box as Morasil's climate map)

| File | What it holds | How to read it |
| --- | --- | --- |
| Morasil_water_data_v2.png | Rivers, lakes and their features | 8-bit bit flags: 1 = river or stream, 2 = seasonal (dry-bed) river or stream, 4 = waterfall, 8 = gorge, 16 = lake |
| Morasil_snow_data_v2.png | Snow and ice | 8-bit codes: 0 none, 1 seasonal snow in the mountains, 2 permanent snow, 3 glacier tongue, 4 winter snow on lowlands under 1,000 m |
| Morasil_snowline_data_v1.png | Snowline height | 16-bit, metres, land only |
| Morasil_coast_data_v2.png | Coast types, fjords, reefs | 8-bit codes on coast land cells: 1 cliffs and rocky headlands, 2 rocky shore with coves and pocket beaches, 3 dry-coast beaches and dunes, 4 tropical beaches and lagoons, 5 temperate beaches, dunes and salt marsh, 6 rias, 7 delta and mangroves, 8 river mouth (estuary), 9 fjord coast; inland 10 = fjord; sea cells 20 = fringing coral reef |
| Morasil_landuse_data_v1.png | Land cover per cell after step 7 | 8-bit; 0 sea or lake; 1 jungle, 2 seasonal tropical forest, 3 savanna, 4 grassland, 5 steppe, 6 hot desert, 7 salt flats, 8 Mediterranean scrubland, 9 dry scrub, 10 temperate forest, 11 temperate rainforest, 12 moorland, 13 cloud forest, 14 farmland, 15 mangroves, 16 coastal fog desert, 17 (old painted mountains; not used), 18 marsh / swamp. A cleaned reading of the climate map (colours snapped, blur and old mountain shading replaced by the nearest real biome) plus the step 7 changes; on the tall range's high ground heights, bare rock and snow come from the elevation and snow layers. |

### Whole world (saved Oct 21)

| File | What it holds | How to read it |
| --- | --- | --- |
| maps\world_elevation_data_v1.png | All six continents' heights on the master grid (2880 x 1440, 0.125°) | 16-bit; metres + 1000; 0 = sea. Polar ice sheets are approximated (about 300 m at the edge rising to about 2,500 m inland); thin coastal fringes copy the nearest known height. Made Oct 21, so it has Morasil's Pass 1 heights (v3), not v5. |
| maps\climates\world_t_jan_data_v1.png, world_t_jul_data_v1.png | Average temperature, January and July (1440 x 720, 0.25°) | 16-bit; °C = value / 100 − 100 |
| maps\climates\world_p_jan_data_v1.png, world_p_jul_data_v1.png | Rainfall in January and July (1440 x 720, 0.25°) | 16-bit; mm in the month = value / 10 |
| maps\climates\world_koppen_data_v1.png | Climate zone per cell (1440 x 720, 0.25°) | 8-bit index; table in section 8 |
| maps\climates\world_temperature_v1.png, world_rainfall_v1.png, world_koppen_v1.png | Viewing maps of the above | Pictures only |
| maps\climates\world_winds_jan.png, world_winds_jul.png | Wind and pressure belts | Pictures only |
| maps\climates\world_currents.png | Ocean currents (red warm, blue cold) | Picture; the Hoaka Sea loop and the Gulf of Mor throughflow aren't drawn yet |
| maps\climates\C1_climate_combined_v2.png, C2–C6_climate_combined.png, world_climate_v1.png | Recorded land cover (biomes), water | Snap colours to the legend palette (section 9). C1 v2 (Oct 23) has Morasil's step 7 land use painted onto a copy of v1 |

Note: inside world_elevation_data_v1, the three small islets east of Elmiyaro's nation 3 took their heights from Hoakamotu's data (the two boxes overlap there). They are low hills either way; check them in Pass 3.

## 4. Elevation, continent by continent

Full record with reasons: claude/map_building_plan.md (and claude/morasil_pass2.md for Morasil's Pass 2). Mountain style everywhere (user, Oct 17–18): rough, not straight. The crest wanders, the width changes, side ridges branch off, there are gaps and passes, and the edges fade raggedly into foothills. Rivers that stopped short of the sea were extended to it with gentle bends.

**Morasil**
- Tall range (east side, collision range): Andes-height, peaks about 6,000–6,600 m (highest about 6,650 m at 18.3°N), highest at its north and south ends; permanent snow on the highest peaks. Passes (the map's heights, kept by the user Oct 23): about 1,650 m (north end, about 20°N), 2,400 m (16.1°N), 3,100 m (14.0°N), 2,770 m (11.4°N), a 1,380 m gap at about 10.2°N that splits the range into a northern and a southern block, 2,690 m (6.1°N), 2,970 m (2.3°N), 1,230 m (south end, 1.4°N). All are below the seasonal snow, open all year.
- Northern range (north coast, above the desert): about 3,000 m. Passes about 500 m (west end), 1,250 m and 920 m; east of about 26°E it is low hills under about 1,100 m. Small low range in the south: about 1,400 m.
- Desert interior: a low basin a few hundred metres up, tilting gently south.
- Low ridge (about 500 m) through nation 8 between the big lake and the lake chain; low hills (about 900 m) east of the NE lake; low hills (about 500 m) south and east of the arm lake.
- Salt lake (nation 5): closed basin ringed by low hills; surface about 60 m.
- Lake surfaces (set in the Pass 2 lake work; user, Oct 23): big lake about 84 m, NE lake about 238 m, middle lake about 131 m, lower lake about 80 m, south lake about 36 m. The chain runs downhill: NE → middle → lower → delta.
- Lakes after Pass 2 (Oct 22): big lake about 71,000 km² (drains west); NE lake about 8,900 km² (karst springs plus a snowmelt river); middle lake about 42,000 km²; lower lake about 103,000 km²; south lake about 144,000 km²; a high mountain lake about 4,800 km² at about 3,800 m (outlet a staircase of five waterfalls); a second high valley lake about 5,500 km² at about 3,165 m; glacier tarns; desert oasis lakes (closed basins); 16 floodplain and oxbow lakes beside the delta river.
- Snow and ice (Pass 2): snowline about 4,400–5,100 m on the tall range (median about 4,800 m); permanent snow on 88 cells near the highest peaks (north and south snowfields), with short glacier tongues.
- Islands: low hills under about 1,000 m, except the big southern island (nation 17), raised by one factor (×2.2) to about 1,360 m at its top (Oct 23, for fjords; no permanent ice). Extinct volcano at the north end of the L-shaped island (nation 14), about 1,700 m.

**Solua**
- Northern landmass: NW and SW ranges are jungle hills (about 1,400 m and 1,000 m above their surroundings); a broad upland about 500–800 m across its south; a low ridge between the upper and lower lakes.
- Southern landmass: west and east ranges about 1,900–2,300 m. Extinct volcano at the west range's northwest end, about 2,300 m.
- Nation 16 (Crocevia): a man-made canal crosses the west–east river on a water bridge (not natural drainage).
- Islands: low hills under about 1,000 m.

**Mesomara**
- Old northern range (southwest–northeast, worn down like the Appalachians): about 2,000 m. East coast range: about 2,000 m.
- Desert belt: low plains a few hundred metres up, sloping gently south.
- Extinct volcano near the tail's southern tip (nation 9), about 1,600 m.
- Islands (southern island) low hills under about 1,000 m; islet pair A (off nation 3) about 300 m.

**Kamon**
- North-central landmass: Japan-like volcanic range along the south coast, about 3,000 m, above an offshore trench; three active volcanoes (the highest peaks), about 3,200 m; no permanent snow.
- Diagonal continent: rift valley lake country, two rift branches (east: NE lake in nation 5 down nation 7's river; west: the lakes of nations 6 and 10). Flat rift floors with the lakes; raised shoulders about 1,000–2,000 m. Extinct volcano at the northeast end of nation 5, about 1,700 m.
- Long southern island: thin north-coast range about 2,000 m.
- Islands: low hills under about 1,000 m.

**Elmiyaro**
- Four thin old ranges (northeast, central diagonal, west, tail): about 3,000 m, highest about 3,100 m; no snow; no volcanoes.
- Nile-like plateau: the big north lake sits on a plateau about 1,000–1,200 m (lake about 1,000 m). The great river drops about 900 m through rapids at the plateau's south edge (over about 200 km), then crosses a low plain to the delta.
- Lake surfaces: northwest lake about 130 m, southwest lake about 60 m, big south lake about 25 m. Delta lagoon beside the delta.
- Islands (east island, islet B, nation 3's islets, the islet southeast of islet B, which belongs to nation 13): low hills under about 1,000 m.

**Hoakamotu** (all volcanoes active)
- Grey landmass: Iceland-style rift valley with active volcanoes up to about 2,000 m; separate ice caps on the two northern volcanoes (about 52–59°N); glacial rivers start from them.
- Island 5: two active volcanoes about 1,500 m.
- Round island (nation 8): range down the west side about 2,500 m; three active volcanoes about 3,000–3,400 m; no permanent snow. A fragment that broke off the C's inner coast; the Hoaka Sea opened behind it.
- The C's north lobe (nations 6 and 7): Andes-like range about 5,000 m above a trench on its northeast side; three active volcanoes about 6,000 m with permanent snow.
- The C's south lobe: two ranges about 2,000 m. Salt lake E (nation 17): closed basin, surface about 300 m.
- Island chain (nation 18): active volcanoes about 1,500 m (three on the eastern chain, two on the middle chain); trench on its east side.
- Southern grey island: range about 2,700 m with three active volcanoes, mostly under ice.
- The dark trench lines on the sea are not land.

**Ocean floor** (from world_map_relief_v2; claude/new_map_terrain.md): the main ridge runs north–south through the grey landmass and on past the C and island chains, ending at the southern grey island's trench. Northwest, southern and north-central ridges as drawn. Three ridges join under the north polar ice. Trenches off Kamon's north-central landmass (south side), the C's north lobe (northeast side), the island chain (east side) and the southern grey island (north and east). Ridges are broken into offset segments with fracture zones. Shelf depths and coastal sea depths are not recorded.

## 5. Drainage (all checked)

Every lake drains along its recorded route; the per-continent lists are in claude/map_building_plan.md ("Drainage checked" under each continent). Closed basins with no outlet: Morasil's salt lake (nation 5), Morasil's desert oasis lakes (by design, Oct 22) and Hoakamotu's salt lake E (nation 17). Rivers reach the sea, or end in those lakes.

- Morasil (Pass 2): every stream runs downhill in the data; range streams, seasonal (dry-bed) rivers in dry country, waterfalls and gorges are in the water layer. Four river mouths (three east-coast rivers and the western river) were extended to the sea on Oct 23.

## 6. Winds and pressure (January and July)

Files: world_winds_jan.png, world_winds_jul.png. Earth's standard rules on this world's land.
- Rain belt (ITCZ): July about 12–22°N over land; January down to about 15°S over the southern lands, about 0–3°N over open ocean. Over big land the heaviest rain falls a few degrees equatorward of where the winds meet.
- Dry subtropical highs at about 30° (shifting about 5° with the seasons); polar fronts at about 60°.
- Trades toward the rain belt; monsoon winds where trades cross the equator; westerlies 30–60°; polar easterlies beyond.
- Summer heat lows over big land interiors; winter cold highs over the big northern lands.
- Ranges over about 2,500–3,500 m (Morasil's tall range) block the low-level July monsoon; the trades keep blowing on their far side. Morasil's tall range has a 1,380 m gap at about 10°N that lets some monsoon air through there (user, Oct 23).

## 7. Ocean currents

claude/ocean_currents.md; picture world_currents.png. Standard Earth pattern: a loop in each basin on each side of the equator (clockwise north, counterclockwise south); cold currents toward the equator along west coasts; warm currents away from it along east coasts; westward currents near the equator; one cold current circling the globe near the south ice, west to east. Currents wrap across the map's edge in the Moramotu Sea. The Hoaka Sea is calm, with one weak clockwise loop around the round island.
- Cold coasts: Morasil (main body's west coast, the L-shaped island's west coast), Solua (southern landmass's west coast; no fog desert), Mesomara (northwest coast, the tail's west coast), Kamon (north-central landmass's west coast), Elmiyaro (northwest coast, no fog desert; the tail's west coast in the Sea of Yaro), Hoakamotu (northwest island group's west side, the C's west coast).
- The narrow channel between Kamon's north-central landmass and Elmiyaro carries the cold current down Elmiyaro's west coast (found Oct 21; this keeps Kamon's east-side desert realistic).
- Gulf of Mor (Oct 23): a warm throughflow, like the Indonesian Throughflow. Warm water from the westward equatorial current enters the wide east mouth, runs west along Morasil's south coast and leaves through the strait (about 290 km wide) past the delta; a weak counterclockwise eddy turns in the gulf's southern bay.

## 8. Climate (temperature, rainfall, climate zones)

Full check: claude/climate_check.md. Rule-based estimates, accurate to a few degrees and to "wet" versus "dry", with known weak spots listed there.
- Temperature: Earth's average by latitude; larger seasonal swings inland; currents carried onshore; about 6.5°C cooler per 1,000 m.
- Snowline: about 5,000 m within 20° of the equator, falling about 110 m per degree of latitude beyond that, on the Pass 1 relief maps of the five continents not yet through Pass 2. Morasil's snowline comes from the climate data (Morasil_snowline_data_v1; section 4).
- Land beside the polar ice keeps cold summers (tundra on the grey landmass's north edge).
- The climate data was made from the Pass 1 heights; Morasil's big southern island is now higher (section 4), so its hilltops are a few degrees colder than the data shows.

Köppen index table for world_koppen_data_v1.png:

| Index | Code | Meaning |
| --- | --- | --- |
| 0 | — | Sea |
| 1 | Af | Tropical rainforest |
| 2 | Am | Tropical monsoon |
| 3 | Aw | Tropical savanna (dry winter) |
| 4 | BWh | Hot desert |
| 5 | BWk | Cold desert |
| 6 | BSh | Hot steppe (semi-arid) |
| 7 | BSk | Cold steppe (semi-arid) |
| 8 | Csa | Mediterranean, hot summer |
| 9 | Csb | Mediterranean, warm summer |
| 10 | Csc | Mediterranean, cool summer |
| 11 | Cwa | Subtropical, dry winter, hot summer |
| 12 | Cwb | Subtropical highland, dry winter |
| 13 | Cwc | Cool highland, dry winter |
| 14 | Cfa | Humid subtropical |
| 15 | Cfb | Oceanic |
| 16 | Cfc | Subpolar oceanic |
| 17 | Dsa | Continental, dry hot summer |
| 18 | Dsb | Continental, dry warm summer |
| 19 | Dsc | Subarctic, dry summer |
| 20 | Dwa | Continental, dry winter, hot summer |
| 21 | Dwb | Continental, dry winter, warm summer |
| 22 | Dwc | Subarctic, dry winter |
| 23 | Dfa | Continental, hot summer |
| 24 | Dfb | Continental, warm summer |
| 25 | Dfc | Subarctic |
| 26 | ET | Tundra |
| 27 | EF | Ice cap |

**The recorded land cover (biomes) is what the globe should show, not the Köppen estimate.** The estimate was only used to check the biomes. Where they disagree, the reasons to keep each biome are in claude/climate_check.md.

## 9. Land cover (biomes)

Source: the six climate maps (C1_climate_combined_v2 for Morasil, C2–C6_climate_combined for the others; world_climate_v1 for the whole globe, without Morasil's Pass 2), with the changes in section 10 still to be applied. For Morasil, Morasil_landuse_data_v1 holds the same land cover already snapped to classes. Legend colours (RGB) for reading the climate maps:

| Biome | RGB | Globe file key |
| --- | --- | --- |
| Jungle (tropical rainforest) | 53, 168, 83 | jungle |
| Seasonal tropical forest | 29, 94, 58 | forest |
| Savanna | 134, 227, 186 | savanna |
| Grassland | 156, 214, 106 | grassland |
| Steppe (dry grassland) | 205, 201, 138 | steppe |
| Hot desert | 242, 212, 155 | desert |
| Salt flats | 236, 231, 220 | saltflats |
| Scrubland (Mediterranean) | 164, 22, 60 | scrubland |
| Dry scrub | 201, 176, 122 | dryscrub |
| Temperate forest | 110, 107, 36 | tforest |
| Temperate rainforest | 15, 122, 104 | trainforest |
| Conifer forest | 44, 90, 78 | conifer |
| Moorland | 156, 143, 166 | moor |
| Peat and tussock grass | 168, 159, 106 | tussock |
| Cloud forest | 62, 142, 126 | cloudforest |
| Farmland | 212, 169, 55 | farmland |
| Marsh / swamp (added Oct 23, Morasil) | 110, 150, 150 | marsh |
| Mangroves | 90, 40, 72 | mangroves |
| Coastal fog desert | 232, 215, 176 | fogdesert |
| Tundra | 169, 181, 158 | tundra |
| Ice cap / glacier | 244, 247, 250 | ice |
| Old painted "Mountains / hills" | 169, 128, 82 | mountains (replace with the nearest real biome; heights now come from elevation data) |

The globe file also has a "lakes" key. Marsh is now on Morasil's climate map (v2); elsewhere it isn't on the climate maps yet (Solua's long-river delta marsh is in its notes).

Reading tips (found while checking): the old painted mountain shading blends with the biome colours along ranges and coasts. Snap each pixel to the nearest legend colour, and replace pixels that are far from every legend colour, or that are the old mountain colour, with the nearest real biome. Some classes only exist on certain continents, so a match elsewhere is a blend error: peat and tussock grass (Hoakamotu only), tundra (Hoakamotu), moorland (Morasil, Hoakamotu), conifer (Mesomara, Hoakamotu), cloud forest (Morasil), temperate rainforest (Morasil, Mesomara, Kamon), fog desert (Morasil, Mesomara, Hoakamotu), salt flats (Morasil, Hoakamotu), grassland (Morasil, Solua, Mesomara, Elmiyaro), marsh (Morasil so far). Found on Morasil (Oct 23): coastal blur also reads as false mangroves (red scrub blended with sea blue) and false fog desert (pale moorland); mangroves belong only at the delta, fog desert only on the L-shaped island's west coast, and the northern range band is Mediterranean scrub (north side) and dry scrub (south side), not temperate forest.

How some biomes are meant to look (decided in the climate check, Oct 21, and Morasil's Pass 2, Oct 23):
- Kamon's diagonal continent: jungle on the rift shoulders (1,000–2,000 m) is cool montane rainforest.
- Kamon's long island: the north-centre's temperate forest is dry eucalyptus-type forest, most open in the deep interior.
- Elmiyaro's north plateau: its temperate forest is open, dry oak-type woodland, denser toward the north coast.
- Solua's interior grassland: dry spinifex-type grassland. Solua's east-lobe seasonal forest is essentially subtropical toward its south.
- Elmiyaro's west seasonal-forest band: the dry woodland kind.
- Mediterranean scrub on east sides with warm currents (Morasil's arm base and east islet, Solua's eastern islet): scrub on thin, porous limestone soil.
- Hoakamotu's island 5 and island chain: scrub on the leeward (west) sides only; windward east sides forest (Pass 2).
- Round island: jungle east, savanna west, in the volcanoes' rain shadow.
- Morasil's northern arm tip (48°N and up): cool forest, mostly conifers (like coastal southeast Alaska); mixed forest farther south on the arm (like southern Sweden). Same colour (temperate forest).
- Morasil's east southern island (45–51°S): low, wind-bent southern-beech-type forest thinning into moorland (like Tierra del Fuego). Same colour (temperate forest).
- Morasil's land use (step 7): ragged, interfingered forest and desert edges (sharp only along mountain crests); gallery forests along savanna rivers; irrigated farm strips (about 10–30 km wide) along permanent rivers in dry country; broad farm regions on the northern arm's grassland (about 58% farmed), the Mediterranean coastal plains and savanna valleys; old lake beds as marsh at the water, then fields, then open plain.

### Coasts (Morasil, Pass 2)

From Morasil_coast_data_v2 (section 3). Almost every shore is low; cliffs only below the northern range. Dry beaches and dunes on the cold-current west coasts (like Mauritania and the Namib); tropical beaches and lagoons in the south and east; temperate beaches, dunes and salt marsh on the northern arm; rias on the northwest and southern islands; the delta with mangroves. Fringing coral reefs along the east coast from 0 to 25°N, around the SE islet, and in the Gulf of Mor (the L-shaped island's east coast and the east lobe's north shore). Fjords (12 main ones plus 7 side arms, about 100–170 km long) on the big southern island.

## 10. Still to draw or decide before the globe

Climate-map changes decided Oct 21, not yet drawn:
- Mesomara: islet pair A: temperate forest (it had no recorded climate).

Pass 2 (planned) for Solua, Mesomara, Kamon, Elmiyaro and Hoakamotu (Morasil done):
- Windward (east) sides of Hoakamotu's island 5 and island chain → forest.
- Optional: Kamon's rift shoulders as montane forest; Elmiyaro's north plateau as lighter open woodland.
- Watersheds and river detail (tributaries, waterfalls, gorges, marshes, deltas, seasonal rivers). Elmiyaro's rapids at the plateau edge are already in the heights.
- Coast types, mountain passes, snowlines and glaciers.
- Land use: farmland, forest edges, deserts vs. semi-deserts.

Border redraw (after Pass 2, before the globe):
- Redraw the nation borders to fit the new geography, one continent at a time; update claude/nation_geography.md then (user, Oct 23).

Pass 3 (planned):
- Check where continents meet and across the map edge (Moramotu Sea, about 1,300–1,700 km wide). Check the three islets east of Elmiyaro's nation 3 (see section 3).
- Draw the Hoaka Sea loop and the Gulf of Mor throughflow on the currents map.
- Rebuild world_elevation_data and the world climate map from the Pass 2 versions.
- Then build the fresh detailed globe from the master data file.

## 11. Names for labels

- Continents: Morasil, Solua, Mesomara, Kamon, Elmiyaro, Hoakamotu.
- Oceans: Northern Ocean; Mesoyaro Ocean (between Mesomara and Elmiyaro, around Kamon); Sola Ocean (between Morasil, Mesomara and Solua); Southern Ocean.
- Seas: Hoaka Sea (inside Hoakamotu's C); Moramotu Sea (across the map edge between Hoakamotu and Morasil); Gulf of Mor; Strait of Solua; Sea of Yaro; Motu Sea; Elkamo Channel.
- Open: where the ocean boundaries fall; whether big lakes and rivers get names. Nation names so far: claude/nations_tracker.md.

## 12. Related Project docs

claude/map_building_plan.md (plan, elevation decisions, winds) · claude/morasil_pass2.md (Morasil's Pass 2: rivers, lakes, snow, coasts, passes, reefs, fjords, land use) · claude/climate_check.md (climate check per continent) · claude/ocean_currents.md · claude/new_map_terrain.md (volcanoes, ridges, trenches) · claude/continents.md (continents, water, climate, nations) · claude/nations_tracker.md · claude/nation_geography.md.
