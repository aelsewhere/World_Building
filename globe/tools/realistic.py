"""Realistic natural-colour painting for the world globe (used by bake_globe.py).

Turns the recorded land cover into a satellite-like picture:
- colours sampled to look like real satellite imagery, made greener or drier by the
  recorded rainfall (world_p_jan/jul_data) inside each land-cover type;
- natural, irregular edges between land-cover types instead of the enlarged grid steps;
- texture inside each type (forest mottling, dunes, field patchwork);
- treeline and mountain snow from the recorded temperatures (world_t_jan/jul_data),
  cooled with height; recorded snow is used as is where it exists (Morasil, Hoakamotu);
- a made-up seabed (shelf, slope, deep ocean) worked out from distance to the coast,
  since the data has no sea depths;
- smoothed coastlines.
Only the picture changes. The hover readout and the other map styles keep the exact data.
"""
import math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

WRAP = ["nearest", "wrap"]          # rows clamp at the poles, columns wrap around the seam


def resize_f(a, w, h, method=Image.BILINEAR):
    return np.array(Image.fromarray(a.astype(np.float32), mode="F").resize((w, h), method))


def noise(rng, H, W, cells, aspect=1.0):
    """Smooth random field (0..1) with features about `cells` grid cells across, seamless at the map edge."""
    ny, nx = max(2, int(H / cells)), max(2, int(W / (cells * aspect)))
    small = rng.random((ny, nx)).astype(np.float32)
    m = 2
    padded = np.hstack([small[:, -m:], small, small[:, :m]])
    big = resize_f(padded, int(round(W * (nx + 2 * m) / nx)), H, Image.BICUBIC)
    off = int(round(W * m / nx))
    return big[:, off:off + W]


def fbm(rng, H, W, cells, octaves=4, aspect=1.0):
    acc, amp, tot = np.zeros((H, W), np.float32), 1.0, 0.0
    for o in range(octaves):
        acc += noise(rng, H, W, max(1.5, cells / 2 ** o), aspect) * amp; tot += amp; amp *= 0.5
    return acc / tot


def hx(s):
    return [int(s[i:i + 2], 16) for i in (1, 3, 5)]


# land cover: (dry colour, wet colour, texture strength)
SAT = {
    1: ("#2b4a1d", "#183611", 0.10), 2: ("#4f5b28", "#2f4b1c", 0.10), 3: ("#a48d58", "#727637", 0.09),
    4: ("#a29a63", "#6d7f41", 0.08), 5: ("#b3a273", "#8e8a5a", 0.08), 6: ("#d6b685", "#c39e6d", 0.14),
    7: ("#e6e0d3", "#e6e0d3", 0.05), 8: ("#8f7f56", "#6b6c40", 0.10), 9: ("#a9926b", "#8a7d53", 0.10),
    10: ("#3d5627", "#2a4a1f", 0.10), 11: ("#23411d", "#19381a", 0.09), 12: ("#706b4b", "#5c5f3f", 0.08),
    13: ("#25471f", "#1c3e1c", 0.09), 14: ("#a99d66", "#7c8a47", 0.12), 15: ("#2d4b2b", "#2d4b2b", 0.06),
    16: ("#b9a98b", "#a99979", 0.10), 17: ("#7d7266", "#7d7266", 0.10), 18: ("#4b5b39", "#3d5331", 0.08),
    19: ("#253a20", "#1f341d", 0.09), 20: ("#8b8461", "#777450", 0.08), 21: ("#807b63", "#6e6d57", 0.08),
    22: ("#eef2f6", "#eef2f6", 0.03), 23: ("#8e8b79", "#78816b", 0.08),
}


def paint_realistic(d, rng_seed=11, log=print):
    """Returns (picture without borders, picture with borders, water mask)."""
    h, land, lu, water, coast, snow, cont, border, shade = (d[k] for k in
        ["h", "land", "lu", "water", "coast", "snow", "cont", "border", "shade"])
    H, W = h.shape
    rng = np.random.default_rng(rng_seed)
    lat = 90 - (np.arange(H) + 0.5) * 180 / H

    # ---- climate on the full grid
    tjan, tjul, pjan, pjul = (resize_f(d[k], W, H) for k in ["tjan", "tjul", "pjan", "pjul"])
    warm = np.maximum(tjan, tjul); del tjan, tjul
    annual = (pjan + pjul) * 6.0; del pjan, pjul                    # rough yearly rainfall, mm
    wet = np.clip((np.log(np.maximum(annual, 1)) - math.log(200)) / (math.log(2500) - math.log(200)), 0, 1)
    # mean height of each climate cell, to cool the warm-month temperature with height (6.5 °C per km)
    cs = W // d["tjan"].shape[1]
    hmean = resize_f(np.maximum(h, 0).reshape(H // cs, cs, W // cs, cs).mean(axis=(1, 3)), W, H)
    t_here = warm - 0.0065 * (np.maximum(h, 0) - hmean)
    del warm, hmean
    log("  climate ready")

    # ---- natural edges between land-cover types: sample the land cover through a gently warped grid
    amp = 4.5
    wy = ((fbm(rng, H, W, 40, 3) - 0.5) * 2 * amp).astype(np.int16)
    wx = ((fbm(rng, H, W, 40, 3) - 0.5) * 2 * amp).astype(np.int16)
    yy = np.clip(np.arange(H, dtype=np.int32)[:, None] + wy, 0, H - 1)
    xx = (np.arange(W, dtype=np.int32)[None, :] + wx) % W
    luw = lu[yy, xx]; del yy, xx, wy, wx
    luw = np.where(land & (luw > 0), luw, lu)

    dry_l = np.zeros((256, 3), np.float32); wet_l = np.zeros((256, 3), np.float32); tex_l = np.zeros(256, np.float32)
    for k, (a, b, t) in SAT.items():
        dry_l[k] = hx(a); wet_l[k] = hx(b[:7]); tex_l[k] = t
    w3 = wet[..., None]
    col = dry_l[luw] * (1 - w3) + wet_l[luw] * w3
    del w3
    # land with no recorded cover: colour from rainfall alone
    nocov = land & (luw == 0)
    col[nocov] = (np.array(hx("#a69a6a"), np.float32) * (1 - wet[nocov, None]) + np.array(hx("#4a6a30"), np.float32) * wet[nocov, None])
    del wet

    # ---- texture inside each type
    tex = tex_l[luw]
    n1 = fbm(rng, H, W, 24, 4) - 0.5
    n2 = noise(rng, H, W, 3) - 0.5
    bright = 1 + tex * (1.6 * n1 + 0.9 * n2)
    desert = np.isin(luw, (6, 16, 9, 5, 7))
    dunes = (noise(rng, H, W, 2.5, aspect=4.0) - 0.5)                     # long east-west dune streaks
    bright[desert] += 0.07 * dunes[desert]
    farm = luw == 14                                                      # field patchwork, about 2 cells per field
    if farm.any():
        blocks = rng.random((H // 2 + 1, W // 2 + 1)).astype(np.float32)
        patch = blocks[np.arange(H)[:, None] // 2, np.arange(W)[None, :] // 2] - 0.5
        bright[farm] += 0.10 * patch[farm]; del patch, blocks
    col *= bright[..., None]
    del n2, dunes, bright, tex
    # a little colour drift across large areas, so big regions are not one flat tone
    hue = (fbm(rng, H, W, 120, 3) - 0.5)
    col[..., 0] *= 1 + 0.06 * hue; col[..., 2] *= 1 - 0.06 * hue
    del hue
    log("  land colours and texture")

    # ---- mountains: treeline and bare rock, from temperature cooled with height
    notice = land & (luw != 22)
    alpine = np.clip((10 - t_here) / 6, 0, 1) * notice                   # above the treeline (warm month under 10 °C)
    rock = np.array(hx("#7c7163"), np.float32)
    col += (rock - col) * (alpine * 0.75)[..., None]
    steep = np.clip((1 - shade) * 1.2, 0, 1) * (h > 1500)
    col += (rock - col) * (steep * 0.35)[..., None]
    # snow: recorded where it exists (Morasil, Hoakamotu); elsewhere from temperature
    recorded = np.isin(cont, (1, 6))
    perm = np.where(recorded, (snow == 2) | (snow == 3), land & (t_here < 0.5))
    dust = np.where(recorded, snow == 1, land & (t_here >= 0.5) & (t_here < 3.5))
    snowc = np.array([242, 245, 248], np.float32)
    col[perm] = snowc
    col[dust] += (snowc - col[dust]) * 0.5
    ice = luw == 22
    icen = fbm(rng, H, W, 18, 4) - 0.5
    col[ice] = np.array([236, 241, 246], np.float32) * (1 + 0.05 * icen[ice, None]) * np.array([1, 1, 1.01], np.float32)
    del alpine, steep, perm, dust, icen, notice, t_here, recorded
    log("  mountains and snow")

    # ---- relief shading (softer than the thematic maps)
    col *= (1 + (shade - 1) * 0.9)[..., None]

    # ---- rivers and lakes
    is_lake = (water & 16) > 0
    riv = land & ~is_lake
    m = riv & ((water & 1) > 0); col[m] += (np.array([42, 74, 104], np.float32) - col[m]) * 0.7
    m = riv & ((water & 2) > 0) & ((water & 1) == 0); col[m] += (np.array([150, 140, 110], np.float32) - col[m]) * 0.25
    m = riv & ((water & 64) > 0); col[m] = (48, 82, 112)

    # ---- spread land colour a few cells out to sea, so the smoothed coast has colour to show
    lm = land.astype(np.float32)
    num = np.stack([ndi.gaussian_filter(col[..., c] * lm, 1.8, mode=WRAP) for c in range(3)], -1)
    den = ndi.gaussian_filter(lm, 1.8, mode=WRAP)[..., None]
    soft = np.where(den > 1e-3, num / np.maximum(den, 1e-3), col)
    col = np.where(land[..., None], col * 0.45 + soft * 0.55, soft)
    del num, soft
    log("  edges softened")

    # ---- the seabed (made up: no depth data exists) from distance to the coast
    f = 4
    small = land.reshape(H // f, f, W // f, f).any(axis=(1, 3))
    pad = 200
    big = np.hstack([small[:, -pad:], small, small[:, :pad]])
    dist = ndi.distance_transform_edt(~big)[:, pad:-pad] * (math.pi * 6371 / (H // f))    # km
    dist = resize_f(dist, W, H)
    dist *= 0.75 + 0.5 * fbm(rng, H, W, 90, 3)                         # shelf width varies along the coast
    dist *= 0.6 + 0.8 * fbm(rng, H, W, 25, 3)                          # and is ragged at smaller scales
    shelf = np.array(hx("#1e4d72"), np.float32); slope = np.array(hx("#123459"), np.float32); deep = np.array(hx("#0b2143"), np.float32)
    t1 = np.clip(dist / 90, 0, 1)[..., None] ** 0.7; t2 = np.clip((dist - 90) / 300, 0, 1)[..., None]
    sea = shelf * (1 - t1) + slope * t1
    sea = sea * (1 - t2) + deep * t2
    del t1, t2
    sea *= (1 + 0.05 * (fbm(rng, H, W, 30, 3) - 0.5))[..., None]
    # warm shallow tropical water is lighter and greener
    tropic = np.clip((25 - np.abs(lat)) / 10, 0, 1)[:, None] * np.clip(1 - dist / 60, 0, 1)
    sea += (np.array(hx("#2b8aa0"), np.float32) - sea) * (tropic * 0.35)[..., None]
    reef = (~land) & (coast == 20)
    sea[reef] += (np.array(hx("#46b9b3"), np.float32) - sea[reef]) * 0.7
    del dist, tropic
    lakec = np.array(hx("#1d4060"), np.float32)

    # ---- smoothed coastline: a soft, slightly irregular edge instead of grid steps
    # wide smoothing for big coasts; light smoothing where land is small (islets), so they do not vanish
    wide = ndi.gaussian_filter(lm, 2.4, mode=WRAP); narrow = ndi.gaussian_filter(lm, 1.0, mode=WRAP)
    small = ndi.gaussian_filter(lm, 8, mode=WRAP) < 0.12
    edge = np.where(small, narrow, wide) + (noise(rng, H, W, 4) - 0.5) * 0.16
    del wide, narrow, small
    a = np.clip((edge - 0.4) / 0.2, 0, 1)
    a = np.where(is_lake, 0, a)
    a = a * a * (3 - 2 * a)
    out = sea * (1 - a[..., None]) + col * a[..., None]
    out[is_lake] = lakec
    plain = np.clip(out, 0, 255).astype(np.uint8)
    b = border & (a > 0.5)
    out[b] += (np.array([236, 226, 196], np.float32) - out[b]) * 0.45
    rgb = np.clip(out, 0, 255).astype(np.uint8)
    water_mask = np.clip((1 - a) * 255, 0, 255).astype(np.uint8)       # where water is, for sun glint on the globe
    water_mask[is_lake] = 255
    log("  coast and sea")
    return plain, rgb, water_mask


def clouds(d, W2=4096, H2=2048, rng_seed=5):
    """Cloud cover picture (0 clear .. 255 overcast), placed by rainfall and Earth-like wind belts."""
    rng = np.random.default_rng(rng_seed)
    rain = resize_f((d["pjan"] + d["pjul"]) * 0.5, W2, H2)
    rn = np.clip(np.log(np.maximum(rain, 1)) / math.log(300), 0, 1)
    lat = 90 - (np.arange(H2) + 0.5) * 180 / H2
    belt = (0.55 * np.exp(-(lat / 7) ** 2) + 0.45 * np.exp(-((np.abs(lat) - 55) / 12) ** 2))[:, None]
    n = fbm(rng, H2, W2, 70, 6, aspect=2.2)
    c = 0.45 * rn + 0.25 * belt + 0.75 * (n - 0.5) + 0.05
    c = np.clip((c - 0.32) / 0.38, 0, 1) ** 1.3
    return (c * 255).astype(np.uint8)
