# Morasil realistic map

`render_realistic.py` builds `Morasil_realistic_draft_v1.png` (natural colour, 2x the data grid) from the layers in `data/`.

Run: `python3 morasil/render_realistic.py` (needs numpy and Pillow).

## Data layers (780x1380, 12 px per degree, 50N at row 60, about 9 km per pixel)

| File | Contents | Status |
|---|---|---|
| `elevation.png` | 16-bit, sea level = 1000, 1 unit = 1 m (max 6,654 m) | confirmed against the v5 elevation map |
| `climate_classes.png` | climate class per pixel (from C1_climate_combined) | class meanings guessed; need the legend |
| `water.png` | 1 river, 2 seasonal river, 16 lake, 4/5/6/9/13 waterfall or gorge marks | 1, 2, 16 clear; small marks not yet identified |
| `snow.png` | 1 seasonal mountain snow, 2 permanent, 3 glacier tongue, 4 winter lowland snow | read from elevation and the relief legend |
| `coast_classes.png` | coast type 1-10 and 20 (10 = fjord) | not used yet; needs legend |
| `unknown_16bit.png` | 16-bit field, high at the equator, low toward the poles | meaning unknown; not used |
| `ref_*.webp` | reference renders (elevation v5, shaded relief, nations) | reference only |
