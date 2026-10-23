"""Render a natural-colour ("satellite-style") map of Morasil from the Pass 2 data layers.

Inputs (morasil/data/, all 780x1380, 1/12 degree per px, row 0 = 55N; codes from
notes/globe_build_reference.md section 3 and notes/morasil_pass2.md):
  Morasil_elevation_data_v5.png  16-bit, metres + 1000, 0 = sea
  Morasil_landuse_data_v1.png    land cover after step 7 (0 = sea or lake)
  Morasil_water_data_v2.png      bit flags: 1 river, 2 seasonal river, 4 waterfall, 8 gorge, 16 lake
  Morasil_snow_data_v2.png       1 seasonal mountain, 2 permanent, 3 glacier tongue, 4 winter lowland
  Morasil_coast_data_v2.png      coast type on shore cells, 10 fjord, 20 fringing reef (sea cells)
"""
import numpy as np
from PIL import Image
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
SCALE = 2  # output pixels per data pixel

# Natural ground colour per class of C1_climate_combined (v2, Oct 23, step 7 land use).
CLASS_RGB = {
    1: (26, 70, 34),     # jungle (tropical rainforest)
    2: (52, 84, 40),     # seasonal tropical forest
    3: (150, 140, 82),   # savanna
    4: (116, 128, 66),   # grassland
    5: (170, 156, 104),  # steppe (dry grassland)
    6: (214, 184, 136),  # hot desert
    7: (228, 224, 212),  # salt flats
    8: (126, 118, 76),   # scrubland (Mediterranean)
    9: (172, 150, 104),  # dry scrub
    10: (54, 78, 42),    # temperate forest
    11: (34, 64, 40),    # temperate rainforest
    12: (100, 98, 76),   # moorland
    13: (40, 76, 50),    # cloud forest
    14: (140, 140, 80),  # farmland
    15: (36, 60, 42),    # mangroves
    16: (196, 180, 148), # coastal fog desert
    18: (70, 88, 62),    # marsh / swamp
}
FARMLAND = 14
LAKE = np.array([38, 78, 120], float)
RIVER = np.array([44, 86, 130], float)
SEASONAL = np.array([150, 150, 130], float)
DEEP = np.array([12, 32, 66], float)
SHALLOW = np.array([34, 92, 128], float)
REEF = np.array([70, 170, 168], float)
LAGOON = np.array([52, 140, 150], float)
FJORD = np.array([22, 52, 88], float)
CONIFER = np.array([34, 58, 42], float)  # temperate forest on the arm tip, 48N and up

# Shore colour by coast code (land side); None leaves the ground as it is.
SHORE_RGB = {
    1: (96, 82, 66),     # cliffs and rocky headlands
    2: (128, 116, 98),   # rocky shore, coves, pocket beaches
    3: (222, 204, 160),  # dry-coast beaches and dunes
    4: (234, 224, 192),  # tropical beaches and lagoons
    5: (196, 186, 152),  # temperate beaches, dunes, salt marsh
    7: (96, 98, 70),     # delta and mangroves (mudflats)
    8: (120, 116, 88),   # estuary
}


def load(name, dtype=float):
    return np.array(Image.open(DATA / name)).astype(dtype)


def up(a, resample):
    img = Image.fromarray(a.astype(np.float32), mode="F")
    w, h = img.size
    return np.array(img.resize((w * SCALE, h * SCALE), resample))


def blur(a, r):
    """Separable Gaussian blur (Pillow can't blur float images)."""
    n = int(3 * r) + 1
    k = np.exp(-0.5 * (np.arange(-n, n + 1) / r) ** 2)
    k /= k.sum()
    p = np.pad(a.astype(float), n, mode="edge")
    p = sum(k[i] * p[i:i + p.shape[0] - 2 * n] for i in range(2 * n + 1))
    return sum(k[i] * p[:, i:i + p.shape[1] - 2 * n] for i in range(2 * n + 1))


def coast_distance(land, steps=40):
    """Pixels from the nearest land, capped at `steps` (simple repeated dilation)."""
    dist = np.full(land.shape, steps, float)
    cur = land.copy()
    for i in range(steps):
        dist[cur & (dist == steps)] = i
        n = cur.copy()
        n[1:] |= cur[:-1]; n[:-1] |= cur[1:]
        n[:, 1:] |= cur[:, :-1]; n[:, :-1] |= cur[:, 1:]
        cur = n
    return dist


def lat_of_row(y):
    return 55 - (y + 0.5) / 12


def grow(mask, n):
    """Dilate a boolean mask by n pixels (4-neighbour)."""
    cur = mask.copy()
    for _ in range(n):
        m = cur.copy()
        m[1:] |= cur[:-1]; m[:-1] |= cur[1:]
        m[:, 1:] |= cur[:, :-1]; m[:, :-1] |= cur[:, 1:]
        cur = m
    return cur


def main():
    elev = load("Morasil_elevation_data_v5.png") - 1000
    cls = load("Morasil_landuse_data_v1.png", int)
    snow = load("Morasil_snow_data_v2.png", int)
    water = load("Morasil_water_data_v2.png", int)
    coast = load("Morasil_coast_data_v2.png", int)

    land = elev > 0
    lake = ((water & 16) > 0) | (land & (cls == 0))
    river = (water & 1) > 0
    seasonal = ((water & 2) > 0) & ~river

    # Ground colour, softened so climate borders blend instead of stepping.
    rgb = np.zeros(elev.shape + (3,))
    for k, c in CLASS_RGB.items():
        rgb[cls == k] = c
    # Arm tip: conifer forest from 48N (same map class as temperate forest).
    lat = lat_of_row(np.arange(elev.shape[0]))[:, None]
    con = (cls == 10) & (lat >= 46.5)
    w = np.clip((lat - 46.5) / 2.5, 0, 1) * con
    rgb = rgb * (1 - w[..., None]) + CONIFER * w[..., None]
    filled = land & ~lake
    for ch in range(3):
        num = blur(rgb[..., ch] * filled, 2.5)
        den = blur(filled.astype(float), 2.5)
        rgb[..., ch] = np.where(den > 0.05, num / np.maximum(den, 1e-6), rgb[..., ch])

    # High ground goes to bare rock, then snow.
    rock = np.clip((elev - 2800) / 1600, 0, 1)[..., None]
    rgb = rgb * (1 - rock) + np.array([118, 106, 92]) * rock
    snow_mix = np.select([snow == 2, snow == 3, snow == 1], [0.95, 0.8, 0.35], 0.0)
    snow_mix = blur(snow_mix, 0.8)[..., None]
    rgb = rgb * (1 - snow_mix) + np.array([236, 240, 244]) * snow_mix

    # Upsample everything to output size.
    E = up(np.where(land, elev, 0), Image.BICUBIC)
    E = blur(E, 1.0)
    RGB = np.stack([up(rgb[..., c], Image.BILINEAR) for c in range(3)], -1)
    L = up(land.astype(float), Image.BILINEAR) > 0.5
    LK = up(lake.astype(float), Image.BILINEAR) > 0.5
    RV = up(river.astype(float), Image.BILINEAR) > 0.35
    SR = up(seasonal.astype(float), Image.BILINEAR) > 0.35
    FJ = up((coast == 10).astype(float), Image.BILINEAR) > 0.4
    CODE = up(coast.astype(float), Image.NEAREST).astype(int)

    # Hillshade, sun from the northwest. Pixel ~4.6 km at SCALE 2.
    px = 9260.0 / SCALE
    gy, gx = np.gradient(E * 14.0 / px)
    az, alt = np.radians(315), np.radians(40)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    shade = np.clip(shade / np.sin(alt), 0.35, 1.35)

    # Low-contrast mottling so flat ground doesn't read as poster paint.
    rng = np.random.default_rng(7)
    tex = sum(blur(rng.standard_normal(E.shape), r) * r for r in (1, 3, 8))
    tex = 1 + 0.06 * tex / tex.std()

    # Farmland gets a stronger, finer patchwork than wild ground.
    farm = up((cls == FARMLAND).astype(float), Image.BILINEAR)
    fields = blur(rng.standard_normal(E.shape), 0.7)
    tex = tex * (1 + 0.10 * farm * fields / fields.std())

    out = RGB * (shade * tex)[..., None]

    # Shore strip: the outer ~2 px of land take the coast type's colour.
    sea_px = ~L
    shore = L & grow(sea_px, 2)
    code_near = CODE.copy()
    # Coast codes sit on data cells that may fall just inside the strip; spread them outward.
    for _ in range(3):
        g = code_near.copy()
        for sh in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r = np.roll(code_near, sh, (0, 1))
            g = np.where((g == 0) | (g >= 10), np.where((r > 0) & (r < 10), r, g), g)
        code_near = g
    for k, c in SHORE_RGB.items():
        m = shore & (code_near == k)
        out[m] = out[m] * 0.35 + np.array(c) * 0.65

    # Ocean: darker with distance from shore.
    d = coast_distance(L, 60)
    t = np.clip(d / 60, 0, 1)[..., None] ** 0.6
    sea = SHALLOW * (1 - t) + DEEP * t
    # Fringing reefs: pale turquoise on reef cells, lagoon water between reef and shore.
    reef = blur(up((coast == 20).astype(float), Image.BILINEAR), 1.2)
    lagoon = blur(grow(up((coast == 20).astype(float), Image.NEAREST) > 0, 3).astype(float), 1.5)
    sea = sea * (1 - 0.6 * lagoon[..., None]) + LAGOON * 0.6 * lagoon[..., None]
    sea = sea * (1 - np.clip(reef * 1.4, 0, 0.8)[..., None]) + REEF * np.clip(reef * 1.4, 0, 0.8)[..., None]
    out = np.where(L[..., None], out, sea)

    out[LK] = LAKE
    out[SR & ~LK] = out[SR & ~LK] * 0.5 + SEASONAL * 0.5
    out[RV & ~LK] = RIVER
    out[FJ & L] = FJORD

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(HERE / "Morasil_realistic_draft_v2.png")


if __name__ == "__main__":
    main()
