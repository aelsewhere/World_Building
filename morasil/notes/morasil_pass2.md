# Pass 2: Morasil (steps 5, 6 and 7; done Oct 23)

Saved Oct 22 after the user's approval; step 6 (coasts, passes, reefs, fjords) and step 7 (land use) added Oct 23. Continues claude/map_building_plan.md (Morasil's Pass 1 elevation is described there as v3; this replaces v3 as the current version).

## Files (maps folder)

Current (Oct 23): Morasil_elevation_v5.png (colour by height), Morasil_elevation_data_v5.png (16-bit, value = metres + 1000, 0 = sea; same grid and extent as the Morasil climate map), Morasil_relief_v9.png (shaded relief on the recorded climate colours, now including the step 7 land use, with the water, snow and coast layers and the passes drawn), Morasil_water_data_v2.png (8-bit water layer, same grid; bit flags: 1 = river or stream, 2 = seasonal (dry-bed) river or stream, 4 = waterfall, 8 = gorge, 16 = lake). Morasil_snow_data_v2.png (8-bit snow layer, same grid; codes: 0 = none, 1 = seasonal snow in the mountains, 2 = permanent snow, 3 = glacier tongue, 4 = winter snow on lowlands under 1,000 m), Morasil_snowline_data_v1.png (16-bit, snowline height in metres, land only), Morasil_coast_data_v2.png (8-bit coast layer, same grid; codes below), Morasil_landuse_data_v1.png (8-bit land cover per cell after step 7, same grid; codes in the step 7 section). In maps\climates: C1_climate_combined_v2.png (the recorded climate map with the step 7 changes painted onto a copy; everything else as in v1; legend adds Marsh / swamp). Older versions (elevation v3 and v4, elevation data v4, relief v3 to v8, water data v1, snow data v1, coast data v1, C1_climate_combined v1) are in maps\archive.

## Why the lakes changed

The user wanted the world "a little more magical and beautiful than ours" and asked whether lakes could be shrunk to make room for more. A water-balance check (does a lake's catchment bring in more water than evaporates from its surface, so it can stay fresh and have an outlet?) showed several lakes were too big for their catchments. Fix rule (user, Oct 17): find a realistic reason to keep it, change only if it can't be made realistic.

## Decisions (user, Oct 22)

- Shrunk: the big lake (nation 8 area) to about 71,000 km² (about the size of Lake Superior). Still drains west to the coast.
- Northern (NE) lake: shrunk to about 8,900 km², outlet to the middle lake. Kept this large by giving it karst springs plus a new snowmelt river from the tall range's northern peaks (user chose "also add karst springs" so it could be bigger).
- Middle lake (about 42,000 km²) and lower lake (about 103,000 km²): original sizes kept. This works because a new river from the high mountain lake flows along the foot of the tall range into the middle lake.
- South lake (about 144,000 km², jungle), salt lake and arm lake: unchanged.
- New lakes the user chose: desert oasis lakes (two clusters; closed basins by design), high mountain lakes, jungle and river (floodplain) lakes.
  - High mountain lake: about 4,800 km² at about 3,800 m on the tall range, cloud forest around it, outlet river runs to the middle lake.
  - Second high valley lake: about 5,500 km² at about 3,165 m in the southern tall range (user: keep).
  - Glacier tarns near the highest peaks (elevation 4,300-5,000 m).
  - 16 floodplain and oxbow lakes (about 3,000-6,000 km² each) beside the delta river and its branches. The user asked for more of these ("more lakes on 9").
- Former bigger lake shores become old lake beds: flat plains rising to the surroundings. Land cover for them (wetland or farmland) is to be decided in step 7.
- Lake surfaces (in the v4 heights and unchanged in v5; confirmed by the user Oct 23): big lake about 84 m, NE lake about 238 m, middle lake about 131 m, lower lake about 80 m, south lake about 36 m, salt lake about 60 m. The chain runs downhill: NE → middle → lower → delta; the big lake drains west; the south lake drains into the delta river.
- Every freshwater lake has a positive outflow in the balance check (northern lake about 81 m³/s including springs; middle about 6,900; big about 1,500; lower about 11,200 m³/s).

## Notes

- The user will probably re-draw the nation borders to match geography after the map is finished, so lakes are not being fitted to current nation borders (the high mountain lake sits in nation 10's part of the range; fine for now).
- Morasil Pass 2 is finished (steps 5–7, Oct 22–23). Next: the other five continents, one at a time (user picks).
- Not yet updated: the Morasil entries in claude/nation_geography.md for the step 6 and 7 changes (reefs touch 9, 10, 13, 12's SE islet and the L-shaped island 14/15; extended river mouths in 7, 10 and 13; fjords and higher hills on 17; land use everywhere). The user will update nation geography during the border redraws (Oct 23).
## Water layer v1 (user approved Oct 22)

Added on top of the v4 heights (heights not changed). Streams follow the terrain data (every stream runs downhill) and are smoothed into gentle bends.

- Range streams: about 7% more than the first draft (user asked for about +5%); only the larger ones, each ending at a river, lake or the sea, or in the high country. The northern range and the islands got none (their ground is mostly under 700 m or their catchments are small).
- Seasonal (dry-bed) rivers: streams through desert, dry scrub, steppe and low-flow savanna (under 40 m3/s). Rivers fed by a lake, the snowmelt river or the mountain-lake river stay permanent.
- Waterfalls (user chose "series of falls" for the mountain lake outlet): the 3,800 m lake's outlet is a staircase of five falls (first drop about 2,100 m, then about 130-470 m steps), plus six falls on bigger rivers.
- Gorges: six stretches where rivers have cut deepest below the ridges around them.
- Southern green lowlands (user, "central Morasil" meant here): a dozen tributary streams; jungle and seasonal forest ones are permanent. The short, almost straight stubs near the southwest coast were removed at the user's request.
- Not included: dry-bed streams across the central desert basin (drafted, then dropped when the user said they meant the green area).
- Marshes: skipped for now (user, Oct 22); decide with land use in step 7.

## Water layer v2 (user approved Oct 23)

- Found in step 6: three east-coast rivers (about 13.5°N and 8.7°N in nation 10, 3.8°N in nation 13) and the western river (nation 7) stopped about 45–140 km short of the sea. Extended to the coast along their own direction (the Oct 17 default), drawn with gentle bends.
- On the 13.5°N river the ground rose about 12 m near the coast, so 8 cells along its new course were lowered by up to 12 m (the river cuts that valley). No other heights changed for this.

## Snowline, glaciers and seasonal snow v1 (user approved Oct 22)

- Snowline from the climate model's temperatures: where the mean annual temperature is about 0 C in the tropics (air cools about 5.5 C per km there, 6.5 toward mid-latitudes), colder (to about -6 C) toward mid-latitudes, and raised up to 700 m in the dry subtropics. Result on the tall range: about 4,400-5,100 m (median about 4,800 m), so the user's earlier "about 5,000 m near the equator" still holds.
- Permanent snow: 88 map cells (only the highest peaks, as decided Oct 17: only 71 cells are above 5,000 m). Northern snowfield near 18N and a southern one; the middle of the range peaks at about 4,100 m and has none.
- Glaciers: short valley-glacier tongues below the snowfields, 18 cells (user: keep them small and realistic).
- Seasonal snow: cells whose coldest month is 0.5 C or colder at their height, with some precipitation that month. Mountains: about 220 cells (tall range above roughly 3,350-4,100 m; a few specks on the northern range above about 1,500 m). Lowlands under 1,000 m: about 19,200 cells in the far north and on the cold southern islands, drawn very faintly and kept as a separate code.
- Checked Oct 23 against the climate data (world_t_jan/jul, world_p_jan/jul, world_koppen): the lowland winter-snow strip fits the recorded biomes everywhere; nothing changed.
  - Northern arm north of about 44°N (about a fifth of the land there): coldest month about 0°C (−2 to +0.6), warmest 13–16°C, about 1,300–1,400 mm a year; temperate forest with snowy winters, like southern Sweden or Nova Scotia. At the tip (48°N and up) summers are about 13°C, like coastal southeast Alaska.
  - Northwest islands: a speck at 50°N (borderline, about 0.5°C): occasional snow in temperate rainforest, like northern Vancouver Island.
  - Island at 37–45°S: snow only on its hills (median about 630 m), in temperate forest, like Tasmania's highlands.
  - East southern island (45–51°S): the forest part's warmest month is about 11.5°C, right at the tree limit (about 10°C), like Tierra del Fuego's southern-beech forest (Ushuaia). The moorland part fits.
  - Big southern island (nation 17): warmest month about 9°C, coldest about −4.6°C: too cool for trees, so moorland fits (like the Falklands' heath, also a tundra-type climate), with snowier winters, like Iceland's northern heaths. The climate data was made from the old heights, so the new hilltops (to about 1,360 m) are a few degrees colder than it shows; the snow layer already marks them as mountain snow.
  - The few southern-island cells that read as "fog desert" are pale moorland colours matched to the wrong legend colour, not real fog desert.
  - Forest types from this check were recorded in step 7 (user, Oct 23; see the land use section below).
- Snow data v2 (Oct 23): the 398 cells on the big southern island that are now above 1,000 m (see fjords below) changed from lowland winter snow (4) to mountain seasonal snow (1). Nothing else changed.

## Coasts, passes, reefs and fjords (step 6; user approved Oct 23)

Coast layer codes (Morasil_coast_data_v1.png). On coast land cells: 1 = cliffs and rocky headlands, 2 = rocky shore with coves and pocket beaches, 3 = dry-coast beaches and dunes, 4 = tropical beaches and lagoons, 5 = temperate beaches, dunes and salt marsh, 6 = rias (drowned river valleys), 7 = delta and mangroves, 8 = river mouth (estuary), 9 = fjord coast. Inland: 10 = fjord (a sea inlet narrower than one map cell). Sea cells: 20 = fringing coral reef.

### Coast types (user accepted the draft)

- Worked out from the heights (highest ground within about 27 km of the shore), the recorded climate and the river mouths. Almost every shore is low (under about 250 m within 27 km of the sea). Only the north coast below the northern range has cliffs and rocky coves.
- Main body: tropical beaches and lagoons about half (southwest, south and east coasts); temperate beaches, dunes and salt marsh about 29% (the northern arm); dry-coast beaches and dunes about 10% (the west coast at 12–25°N with the cold current and desert, like Mauritania; the steppe stretch of the northeast coast at about 30–37°N); rocky about 5%; the delta with mangroves about 3%.
- L-shaped island: dry beaches and dunes on the fog-desert west coast (like the Namib); tropical beaches elsewhere.
- Northwest islands and the southern islands: rias (drowned river valleys, like Galicia or southwest Ireland), with beaches on their flatter stretches.

### Passes (the map's heights, kept by the user Oct 23)

- Tall range: about 1,650 m (north end, about 20°N), 2,400 m (16.1°N), 3,100 m (14.0°N), 2,770 m (11.4°N), the 1,380 m gap (10.2°N), 2,690 m (6.1°N), 2,970 m (2.3°N), 1,230 m (south end, 1.4°N). North of about 20°N the range ends, and routes around its tip stay under about 700 m.
- The 10°N gap splits the range into a northern block (about 10.3–19.4°N, peaks to about 6,650 m at 18.3°N) and a southern block (about 1.4–9.6°N, peaks to about 5,970 m at 6.5°N). Recorded as a low corridor that lets some monsoon air through (user, Oct 23), like the Andes' lowest pass (Abra de Porculla, about 2,145 m).
- Northern range: about 500 m (west end, 27.2°N), 1,250 m (25.9°N), 920 m (27.8°N). East of about 26°E it is low hills under about 1,100 m and can be crossed almost anywhere.
- All passes are below the seasonal-snow line, so they are open all year.

### Coral reefs (user chose the simple option)

- Fringing reefs along the east coast from 0 to 25°N (warm current), with gaps at river mouths, and all around the small SE islet (nation 12). None on the cold-current west coasts.
- Added Oct 23 (user, after the Gulf of Mor current was settled as a warm throughflow; see claude/ocean_currents.md): fringing reefs in the Gulf of Mor along the L-shaped island's east coast (from about 10°S down) and the east lobe's north shore to its tip. None in the strait or near the delta's muddy outflow. Saved as coast data v2 and relief v8.

### Fjords on the big southern island (nation 17; user's choice)

- The island's heights were raised by one factor (×2.2), so every river still runs downhill: top about 1,360 m (was 620 m), median about 380 m. The island's snowline is about 660–2,000 m and no cell rises above it, so there is no permanent ice today and the recorded moorland is unchanged. The fjords were carved by ice-age glaciers (like Scotland's sea lochs at a similar height and latitude).
- 12 main fjords, about 100–170 km long, plus 7 side arms, cut along the island's biggest valleys: mostly on the north, southeast and south coasts, with one beside the river mouth on the west coast.
- Drawn as inlets narrower than a map cell (like the rivers), so the coastline shape and the nation maps are unchanged.

## Land use (step 7; user approved Oct 23)

Land-use data codes (Morasil_landuse_data_v1.png; 0 = sea or lake): 1 jungle, 2 seasonal tropical forest, 3 savanna, 4 grassland, 5 steppe, 6 hot desert, 7 salt flats, 8 Mediterranean scrubland, 9 dry scrub, 10 temperate forest, 11 temperate rainforest, 12 moorland, 13 cloud forest, 14 farmland, 15 mangroves, 16 coastal fog desert, 17 (old painted mountains; not used), 18 marsh / swamp. The layer is a cleaned reading of the climate map (colours snapped to the legend, coastal blur and the old painted mountain shading replaced by the nearest real biome) plus the step 7 changes. On the tall range's high ground it shows the nearest biome; heights, bare rock and snow come from the elevation and snow layers. New colour: marsh / swamp = RGB 110, 150, 150 (globe key "marsh").

Areas are rough (one cell is about 82 km²).

- **Marshes (about 112,000 km²; user chose the simple option):** freshwater swamp behind the delta mangroves; marsh around the oxbow and floodplain lakes and along the delta river's lowland branch; reed fringes on the freshwater lakes (not the salt lake or the oasis lakes); a small estuary marsh at the northern arm's river mouth; a marsh ring at the water's edge on both old lake beds. Recorded farmland was not turned into marsh.
- **Farmland (about 745,000 → 1,465,000 km² on land, lakes excluded; user chose "also broad farm regions"):** all recorded farmland kept. Added: narrow irrigated strips (about 10–30 km wide, like the Nile valley) along the permanent rivers through desert, steppe, dry scrub and Mediterranean scrub, including the mountain-lake and snowmelt rivers; patchy fields on lake shores; fields on the old lake beds near the water; and broad farm regions: about 58% of the northern arm's grassland (prairie farming, flattest ground first; grassland about 691,000 → 299,000 km²), patches on the Mediterranean coastal plains (under about 300 m, within about 55 km of the sea; about 79,000 km²) and the flat savanna river valleys (about 18,000 km²). No forest was cleared for new farmland.
- **Forest edges (user chose the simple option):** the painted boundaries between forest (jungle, seasonal, temperate, temperate rainforest) and open country (savanna, grassland, steppe, dry scrub, Mediterranean scrub, moorland) are now ragged and interfingered within about 28 km of the old line, with forest reaching up valleys; each side keeps the same amount of land. Boundaries above about 1,200 m (mountain crests and rain shadows) stay sharp. Gallery forests (about 11,000 km²) along rivers through savanna, where the rivers aren't farmed.
- **Desert / semi-desert (user chose ragged edges only):** the desert keeps its recorded extent; its southern edge at about 16–17°N matches the Sahara's on Earth, so it is realistic as recorded. The edges with steppe, dry scrub and savanna are now ragged, with desert and steppe swapping about the same amount of land; dry valleys (wadis) carry fingers of steppe into the desert. Not chosen: steppe on desert hills above about 800 m; moving the edge north toward the rainfall estimate (which is known to run wet at desert edges).
- **Old lake beds (user chose the simple option):** big lake bed about 383,000 km² (around 12–20°N) and NE lake bed about 166,000 km² (around 22–26°N). Marsh at the water's edge, fields near the water, and beyond that open plain matching the land around it: desert, steppe and dry scrub to the north, savanna to the south (no forest on the beds). This also removes the radiating "spoke" pattern the earlier fill had left around both lakes on the relief maps.
- **Southernmost northwest island (about 28–36°N, nation 4's island):** temperate rainforest → temperate forest, as decided Oct 21 (claude/climate_check.md).
- **Forest types (user, Oct 23; notes only, the map colour stays temperate forest):**
  - Northern arm's tip (48°N and up): cool forest, mostly conifers (spruce, hemlock and cedar types), like coastal southeast Alaska (summers about 13°C, winters about 0°C, about 1,400 mm a year). Farther south on the arm (45–48°N, summers about 16°C): mixed forest, like southern Sweden.
  - East southern island (45–51°S): low, wind-bent southern-beech-type forest, thinning into the moorland, like Tierra del Fuego around Ushuaia (warmest month about 11.5°C, right at the tree limit).
