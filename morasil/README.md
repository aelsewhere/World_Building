# Morasil realistic map

`render_realistic.py` builds `Morasil_realistic_draft_v2.png` (natural colour, 1560x2760, 2x the data grid) from the Pass 2 layers in `data/`.

Run: `python3 morasil/render_realistic.py` (needs numpy and Pillow).

## Data layers

Copies of the files in the Story maps folder (Oct 23). Grid: 780x1380, 1/12 degree per px, row 0 = 55N (relief_v2 box (0, 280)-(520, 1200) at 1.5x). Codes are in `notes/globe_build_reference.md` section 3 and `notes/morasil_pass2.md`.

| File | Used for |
|---|---|
| `Morasil_elevation_data_v5.png` | hillshade, bare rock above ~2,800 m |
| `Morasil_landuse_data_v1.png` | ground colour per biome |
| `Morasil_water_data_v2.png` | rivers, seasonal rivers, lakes (waterfall and gorge flags not drawn) |
| `Morasil_snow_data_v2.png` | permanent snow, glacier tongues, seasonal mountain snow (lowland winter snow not drawn) |
| `Morasil_coast_data_v2.png` | shore colour by coast type, fjords, fringing reefs |
| `Morasil_snowline_data_v1.png` | not used |
| `ref_*.webp` | reference renders only |

## Choices in the render (not world facts)

- Natural colours per biome are picked to look like satellite imagery; the recorded biome is unchanged.
- Temperate forest north of about 48N is drawn darker (conifers), per the step 7 forest-type note.
- Ocean shading is distance from shore only; shelf depths are not recorded.
