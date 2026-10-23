"""Render a natural-colour ("satellite-style") map of Morasil from the data layers.

Inputs (morasil/data/, all 780x1380, 12 px per degree, 50N at row 60):
  elevation.png        16-bit, sea level = 1000, 1 unit = 1 m
  climate_classes.png  climate class per pixel (0 = lake / no class)
  snow.png             1 seasonal mountain, 2 permanent, 3 glacier tongue, 4 winter lowland
  water.png            1 river, 2 seasonal river, 16 lake, other = waterfall/gorge marks

Climate-class colours below are a first guess from the shaded-relief map;
they need checking against the C1_climate_combined legend.
"""
import numpy as np
from PIL import Image
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
SCALE = 2  # output pixels per data pixel

# Natural ground colour per climate class (guessed meaning in comments).
CLASS_RGB = {
    1: (40, 84, 42),     # tropical monsoon / rainforest edge
    2: (24, 64, 32),     # tropical rainforest
    3: (128, 128, 72),   # savanna
    4: (72, 102, 52),    # humid subtropical
    5: (168, 146, 108),  # rocky desert
    6: (206, 178, 130),  # sandy desert
    7: (226, 221, 206),  # salt flats
    8: (122, 116, 72),   # Mediterranean scrub
    9: (158, 136, 98),   # highland semi-desert
    10: (62, 82, 46),    # temperate / boreal forest
    11: (46, 76, 48),    # oceanic forest
    12: (122, 118, 98),  # tundra / subpolar
    13: (56, 86, 56),    # montane forest
    14: (164, 144, 88),  # steppe
    15: (40, 64, 46),    # mangrove
    16: (196, 172, 132), # coastal desert
    18: (76, 92, 66),    # marsh / swamp
}
LAKE = np.array([38, 78, 120], float)
RIVER = np.array([44, 86, 130], float)
SEASONAL = np.array([150, 150, 130], float)
DEEP = np.array([12, 32, 66], float)
SHALLOW = np.array([34, 92, 128], float)


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


def main():
    elev = load("elevation.png") - 1000
    cls = load("climate_classes.png", int)
    snow = load("snow.png", int)
    water = load("water.png", int)

    land = elev > 0
    lake = (water == 16) | (land & (cls == 0))

    # Ground colour, softened so climate borders blend instead of stepping.
    rgb = np.zeros(elev.shape + (3,))
    for k, c in CLASS_RGB.items():
        rgb[cls == k] = c
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
    RV = up((water == 1).astype(float), Image.BILINEAR) > 0.35
    SR = up((water == 2).astype(float), Image.BILINEAR) > 0.35

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

    out = RGB * (shade * tex)[..., None]

    # Ocean: darker with distance from shore.
    d = coast_distance(L, 60)
    t = np.clip(d / 60, 0, 1)[..., None] ** 0.6
    sea = SHALLOW * (1 - t) + DEEP * t
    out = np.where(L[..., None], out, sea)

    out[LK] = LAKE
    out[SR & ~LK] = out[SR & ~LK] * 0.5 + SEASONAL * 0.5
    out[RV & ~LK] = RIVER

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(HERE / "Morasil_realistic_draft_v1.png")


if __name__ == "__main__":
    main()
