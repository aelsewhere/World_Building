# Globe data pack (Nov 4, 2026; capitals and cities updated Nov 6)

All the finished map data put together on one world grid, for building the globe (Pass 3). Companion to `claude/globe_build_reference.md`, which still holds every decision and the per-continent file guide. Where the two differ, this note is newer: the world files below replace `world_elevation_data_v1` (now in `maps\archive`) and cover section 10's "rebuild world_elevation_data … from the Pass 2 versions". It also replaces the reference's section 3 rows for the temperature and rainfall files (now v2; see below). Nothing new is decided here.

Nov 6: the cities row below now points to `cities_v7.csv` (530 cities, replacing cities_v1.csv), and a new section lists every nation's capital with its city number.

## Grid

- **8640 x 4320 px, 1/24° per px** (3x the master relief grid, world_map_relief_v2, at 0.125°). Row 0 = 90°N; column 0 = the map seam (left edge). Latitude of a row = 90 − (row + 0.5) / 24. Longitude = (col + 0.5) / 24 degrees east of the seam (which longitude number the seam has in the globe tool is still to check; see the reference, section 2).
- Each continent's data (1/12°; Hoakamotu 0.1°) was placed at its recorded relief_v2 box (reference, section 2) and scaled to this grid. Nearest-cell scaling for codes, so no blending; heights are smoothly scaled.
- Where continent boxes overlap, each continent's own land was used (decided by its nations). Polar ice and any land outside the six continents come from the old world_elevation_data_v1 (its approximated ice sheets).

## Files (maps folder)

| File | Holds | How to read it |
| --- | --- | --- |
| world_elevation_data_v2.png | Heights, Pass 2 versions on all six continents | 16-bit; metres + 1000; 0 = sea (same rule as before) |
| world_water_data_v1.png | Rivers, lakes and features | 8-bit bit flags: 1 river or stream, 2 seasonal (dry-bed), 4 waterfall or cataract, 8 gorge, 16 lake, 32 springs, 64 canal (Crocevia), 128 outwash plain (Hoakamotu) |
| world_coast_data_v1.png | Coast types, fjords, reefs | 8-bit: on coast land cells 1 cliffs, 2 rocky coves, 3 dry beaches and dunes, 4 tropical beaches and lagoons, 5 temperate beaches, dunes and salt marsh, 6 rias, 7 delta (mangroves or marsh), 8 estuary, 9 fjord coast, 11 glacier front, 12 black sand and gravel; inland 10 fjord; sea cells 20 fringing coral reef |
| world_landuse_data_v1.png | Land cover after Pass 2 step 7 | 8-bit: 0 sea or lake, 1 jungle, 2 seasonal tropical forest, 3 savanna, 4 grassland, 5 steppe, 6 hot desert, 7 salt flats, 8 Mediterranean scrub, 9 dry scrub, 10 temperate forest, 11 temperate rainforest (and Hoakamotu's laurel forest), 12 moorland, 13 cloud forest (and Kamon's montane forest), 14 farmland, 15 mangroves, 16 coastal fog desert, 18 marsh / swamp, 19 conifer forest, 20 peat and tussock grass, 21 tundra, 22 ice cap / glacier (also the polar ice), 23 outwash gravel and moss |
| world_snow_data_v1.png | Snow and ice (Morasil and Hoakamotu only) | 8-bit: 0 none, 1 seasonal mountain snow, 2 permanent snow (and Hoakamotu's ice caps and Karusuyu's ice), 3 glacier tongue, 4 winter snow on lowlands |
| world_continent_data_v1.png | Which continent each land cell belongs to | 8-bit: 0 none (sea, polar ice), 1 Morasil, 2 Solua, 3 Mesomara, 4 Kamon, 5 Elmiyaro, 6 Hoakamotu |
| world_nations_data_v1.png | Which nation each land cell belongs to (after the border redraw, including the Nov 4 Morasil changes) | 8-bit: the nation's number within its continent (1–24); read with world_continent_data for the continent. All 112 nations present |
| world_nations_index_v1.csv | Nation number to name | Continent code, continent, nation #, name, global ID (continent × 100 + #) |
| cities_v7.csv (Nov 5; replaces cities_v1.csv) | The 530 cities (Nov 6: checked against the file) | Columns: Continent, City #, Latitude, Longitude (deg east of map seam), Source. City numbers count **per continent**, from 1 with no gaps and no duplicates: Morasil 1–107, Solua 1–75, Mesomara 1–72, Kamon 1–81, Elmiyaro 1–76, Hoakamotu 1–119. The file has no name or capital column; capital names live in this note and in `claude/nation_tracker_short.md`. See claude/trade_routes.md |

## Climate files (maps\climates)

| File | Holds | How to read it |
| --- | --- | --- |
| world_t_jan_data_v2.png, world_t_jul_data_v2.png (Nov 4) | Average temperature, January and July | 1440 x 720, 0.25°; 16-bit; °C = value / 100 − 100 (same as v1) |
| world_p_jan_data_v2.png, world_p_jul_data_v2.png (Nov 4) | Rainfall in January and July | 1440 x 720, 0.25°; 16-bit; mm in the month = value / 10 (same as v1) |
| world_temperature_v2.png, world_rainfall_v2.png (Nov 4) | Viewing maps of the above (70°N to 70°S) | Pictures only |

v2 (approved by the user Nov 4) is an update of v1 (v1 now in `maps\archive`), not a new estimate:
- Temperature adjusted to world_elevation_data_v2 heights at 6.5°C per 1,000 m. Biggest changes: Morasil (big southern island colder by about 3–5°C on its hilltops; the tall range's north-end pass at about 20°N warmer, up to 13°C, where the data is about 2,000 m lower; the two high lake basins at about 13°N colder) and Hoakamotu. Solua, Mesomara, Kamon and Elmiyaro barely change from heights.
- Land and sea outline matched to the world files (6,333 cells now land, 275 now sea, mostly fringes); new cells copy the nearest value.
- Four straight-line seams of the old estimate removed (not climate): a 7°C step at 57°N in January (polar ice and Hoakamotu's grey landmass; its ice-cap area now a little colder in winter, which fits the recorded ice caps), a step of about 2°C at 22°N in July (Morasil, Mesomara, Kamon, Elmiyaro, Hoakamotu), a step at 57°S in July (south polar ice only), and four box edges in January's rain belt (mostly open ocean).
- Rainfall was not recalculated for the new heights (left as v1 apart from the seams and outline).

Other world files still current: world_koppen_data_v1 / world_koppen_v1 (from the v1 temperature and rainfall), the winds and currents maps in `maps\climates`, and `world_nations_map_v2.png` (picture).

## Capitals and city numbers (Nov 6)

Logged by the user Nov 5 (continent by continent) and recorded in `claude/nation_tracker_short.md`. Each city number is the "City #" in `cities_v7.csv` for that continent (the numbers are per continent, so "city 37" means two different cities on Morasil and Kamon).

Rules (user, Nov 6):
- The numbering of the existing cities does not change.
- Any city added later continues its continent's numbering. The next free numbers are **Morasil 108, Solua 76, Mesomara 73, Kamon 82, Elmiyaro 77, Hoakamotu 120**.
- Checked Nov 6: every capital's city number is inside its continent's range in cities_v7.csv. Not checked: that each city lies inside its nation. The user will double-check this at the next globe build.
- The "City" capital names (Kitashio City, Nyota City, Teina City and so on) are final everywhere.

Update (Nov 6, later): the user named all 34 capitals that had no name and gave city numbers for the seven capitals that had none. **Every nation now has a named capital with a city number.** The seven numbers are cities that already exist in cities_v7.csv (added cities, not new rows), so the file did not change and the next free numbers above are unchanged. The earlier "not on the globe yet" and "unconfirmed location" lists are retired.

| Capital | Nation | City # | Row in cities_v7.csv (Source column) |
| --- | --- | --- | --- |
| Destmiasto | Morasil #4 Kishodara | Morasil 101 | added for nation trait: Mining, no city near the mining area |
| Nyoka City | Solua #2 Nyimbo Nyoka | Solua 67 | added for nation trait: Farming, no city in that land |
| Ventania | Solua #8 Terra Livre | Solua 69 | added for nation trait: Herding, no city in that land |
| Serafina City | Solua #9 Serafina | Solua 72 | added: strait port (Serafina) |
| Barandicha | Elmiyaro #9 Afsunia | Elmiyaro 70 | added for nation trait: Mining, no city near the mining area |
| Aurore | Kamon #21 Aubeterre Island | Kamon 77 | added for nation trait: Forest Goods, no city in that land |
| Idapaiva | Hoakamotu #1 Iltala | Hoakamotu 110 | added for nation trait: Tourism, no city near the attraction |

### Morasil

| # | Nation | Capital | City # |
| --- | --- | --- | --- |
| 1 | Naskinisa | Turas | 86 |
| 2 | Rostrana | Uyutna | 6 |
| 3 | Marzemora | Snomora | 9 |
| 4 | Kishodara | Destmiasto | 101 |
| 5 | Bilamilha | Qafilasima | 20 |
| 6 | Sahradayma | Qati | 19 |
| 7 | Bilaghuru | Asima | 27 |
| 8 | Mamlabisa | Dhahab | 23 |
| 9 | Masdaliqa | Manjamnas | 76 |
| 10 | North Borula | Medina | 37 |
| 11 | Mamlaglasa | Umahl (replaces the earlier Ahl Sruth) | 84 |
| 12 | Rahmira | Ostoya | 41 |
| 13 | South Borula | Markazoloto | 46 |
| 14 | Riotoka | Levinis | 60 |
| 15 | Potoka | Pravinis | 64 |
| 16 | Ankara | Carrowinish | 70 |
| 17 | Inismuira | Aonaran | 75 |
| 18 | Neulisa | Neulisa City | 15 |
| 19 | Vostomora | Maslinora | 16 |
| 20 | Ghabamira | Ghabazira | 61 |
| 21 | Fadinisa | Isnisfade | 4 |

### Solua

| # | Nation | Capital | City # |
| --- | --- | --- | --- |
| 1 | Nyumba Nyota | Nyota City | 1 |
| 2 | Nyimbo Nyoka | Nyoka City | 67 |
| 3 | Chimali | Yamali | 13 |
| 4 | New Pazamani | Riunuru | 28 |
| 5 | Pazamani | Lagoamani | 31 |
| 6 | Kisolado | Kisiwavila | 33 |
| 7 | Docaso | Lavila | 40 |
| 8 | Terra Livre | Ventania | 69 |
| 9 | Serafina | Serafina City | 72 |
| 10 | Pescadoreino | Rosmarina | 45 |
| 11 | Pascolia | Cavalla | 43 |
| 12 | Altiva | Nascentia | 41 |
| 13 | Floriente | Sosseriva | 52 |
| 14 | Emanisola | Termekanisa | 51 |
| 15 | Pariva | Mapprodo | 62 |
| 16 | Crocevia | Agiatezza | 65 |
| 17 | Nusolado | Pontapembe | 20 |

### Mesomara

| # | Nation | Capital | City # |
| --- | --- | --- | --- |
| 1 | Euelia | Zephyria | 11 |
| 2 | Thymia | Arconia | 58 |
| 3 | Jalamarukora | Jalkora | 13 |
| 4 | Marusarasa | Padmajan | 22 |
| 5 | Iforia | Poliviungo | 20 |
| 6 | Purvapascima | Baghraj | 40 |
| 7 | Vanaziwa | Dawakendra | 34 |
| 8 | Zorora | Bagimji | 59 |
| 9 | Tsokasi | Bethemba | 47 |
| 10 | Musanapasi | Gaziropa | 48 |
| 11 | Fudonesia | Chelonizwe | 51 |
| 12 | Gelasya Island | Varkaki | 3 |
| 13 | Thalasya Island | Lilanisi | 12 |

### Kamon

| # | Nation | Capital | City # |
| --- | --- | --- | --- |
| 1 | Kyorim | Sonhim | 2 |
| 2 | West Kyorim | Sudodosi | 7 |
| 3 | Kitashio | Kitashio City | 13 |
| 4 | Yongsol | Sannara | 12 |
| 5 | Aversona | Brumenara | 59 |
| 6 | Samizu | Samizu City | 24 |
| 7 | Kangpaix | Pyeongsole | 18 |
| 8 | Nakashio | Nakashio City | 19 |
| 9 | West Hanara | Kawadosi | 30 |
| 10 | East Hanara | Injungsim | 60 |
| 11 | Minamishio | Machi | 35 |
| 12 | Ansilva | Perdelle | 46 |
| 13 | Inoriva | Hamasacre | 40 |
| 14 | Morouge | Boisinabi | 42 |
| 15 | Maquis | Bellenuit | 48 |
| 16 | Point Dujour | Petit Matin | 58 |
| 17 | Koshio | Shiotoshi | 5 |
| 18 | Goyorive | Goyo | 26 |
| 19 | Sueshio | Sueshio City | 37 |
| 20 | Ecumawa | Umaree | 36 |
| 21 | Aubeterre Island | Aurore | 77 |

### Elmiyaro

| # | Nation | Capital | City # |
| --- | --- | --- | --- |
| 1 | Kynara | Olborg | 2 |
| 2 | New Elvarheim | Kolborg | 10 |
| 3 | Byrland | Vindhjalm | 12 |
| 4 | Delpardis | Darushahr | 19 |
| 5 | Zamindel | Delmehr | 24 |
| 6 | Golsabana | Reyshah | 28 |
| 7 | Darmanheim | Ljonshire | 30 |
| 8 | Lakbaga | Lakbaga City | 26 |
| 9 | Afsunia | Barandicha | 70 |
| 10 | Storrio | Riosa | 47 |
| 11 | Selvana | El Tramo | 50 |
| 12 | Solribera | Cuerovilla | 54 |
| 13 | Pastoluna | Pastoluna City | 56 |
| 14 | Urdey | Soley City | 13 |
| 15 | Verdey | Jardey City | 14 |
| 16 | Skuldey | Maney City | 15 |

### Hoakamotu

| # | Nation | Capital | City # |
| --- | --- | --- | --- |
| 1 | Iltala | Idapaiva | 110 |
| 2 | Aamula | Aamula City | 5 |
| 3 | Tagatamotu | Kapikala | 12 |
| 4 | Alkuwahi | Mahinala | 15 |
| 5 | Hikinamaa | Rikkitaone | 11 |
| 6 | Asumaa | Savupuia | 25 |
| 7 | Koitara | Pilvenui | 23 |
| 8 | Tuakahi | Kuaahi | 30 |
| 9 | Fenuaya | Pakamarka | 43 |
| 10 | Intimaa | Hampikauppa | 48 |
| 11 | Manawapacha | Yunka | 56 |
| 12 | Hitupacha | Mayukula | 52 |
| 13 | Pampala | Kallpamaa | 65 |
| 14 | Karusuyu | Hatun Phuyu | 89 |
| 15 | Sumachala | Collachala | 81 |
| 16 | Malquipata | Sarakancha | 71 |
| 17 | Cachi Cocha | Chawpi | 68 |
| 18 | Matavasa | Tokamoana | 75 |
| 19 | Motu Malu | Akoakoa | 21 |
| 20 | Teina | Teina City | 35 |
| 21 | Kimsapacha | Torumotu | 36 |
| 22 | Sachamaa | Intisaari | 45 |
| 23 | Iskay Islands | Rumi | 74 |
| 24 | Puyupata | Marka | 76 |

## Known limits

- Köppen data is still from the Pass 1 climate (v1). Rainfall does not include rain-shadow changes from the Pass 2 heights. The weak spots listed in claude/climate_check.md still apply.
- Hoakamotu's land use has colour-reading errors (stray salt flats and peat and tussock in the tropics; the northwest island group reads as salt flats but is recorded as Mediterranean scrub).
- Morasil arm-river mouth sliver (user, Nov 4): a thin finger of land beside the arm river's north-coast mouth (Rostrana / Marzemora border) that should not be there. It is in the Pass 2 elevation and coast data, so it is in these world files too. Left as it is for now; fixing it means turning those cells to sea and rebuilding the Morasil maps and the world data files (claude/trade_routes.md, "To fix later").
- Not yet drawn: Mesomara's islet pair A as temperate forest; the Iskay Islands' Mediterranean scrub (decided Nov 4; claude/trade_routes.md); Kamon's springs on Koshio and Sueshio; the Hoaka Sea loop and Gulf of Mor throughflow on the currents map; Hoakamotu's mudflow valley.
- Pass 3 checks still to do: where continents meet and across the map edge (Moramotu Sea); the three islets east of Elmiyaro's Byrland.
