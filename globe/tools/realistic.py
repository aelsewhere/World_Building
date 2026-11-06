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

    # ---- coast types: which recorded coast type is nearest each spot
    T, dT = nearest_coast_type(coast, land)
    f_edge = np.clip(1 - dT / 5, 0, 1)            # coast-type shapes reach about 5 cells (23 km) from the coast
    f_depth = np.clip(1 - dT / 35, 0, 1)          # coast-type sea depths reach further out
    P = {k: COASTP[k][T] for k in COASTP}
    del dT
    log("  coast types mapped")

    # ---- rias (drowned valleys) and fjords are cut into the land as narrow inlets
    inlet = ria_inlets(coast, land, h, rng)
    fj = connect_fjords(coast == 10, land)
    chan_w = np.maximum(inlet, fj)
    channel = np.clip(ndi.gaussian_filter(inlet, 1.0, mode=WRAP) * 3.0 + ndi.gaussian_filter(fj, 0.7, mode=WRAP) * 2.4, 0, 1)
    channel = np.maximum(channel, (inlet > 0) * 0.9)                      # the whole length of each ria is water
    lm_eff = lm * (1 - channel)
    log("  rias and fjords cut: %d ria inlet cells" % int((inlet > 0).sum()))

    # ---- the seabed (made up: no depth data exists) from distance to the coast
    f = 4
    small = land.reshape(H // f, f, W // f, f).any(axis=(1, 3))
    pad = 200
    big = np.hstack([small[:, -pad:], small, small[:, :pad]])
    dist = ndi.distance_transform_edt(~big)[:, pad:-pad] * (math.pi * 6371 / (H // f))    # km
    dist = resize_f(dist, W, H)
    dist *= 0.75 + 0.5 * fbm(rng, H, W, 90, 3)                         # shelf width varies along the coast
    dist *= 0.6 + 0.8 * fbm(rng, H, W, 25, 3)                          # and is ragged at smaller scales
    dist *= 1 + (P["depth"] - 1) * f_depth                             # deep water close to cliffs and fjords, shallow off deltas and beaches
    shelf = np.array(hx("#1e4d72"), np.float32); slope = np.array(hx("#123459"), np.float32); deep = np.array(hx("#0b2143"), np.float32)
    t1 = np.clip(dist / 90, 0, 1)[..., None] ** 0.7; t2 = np.clip((dist - 90) / 300, 0, 1)[..., None]
    sea = shelf * (1 - t1) + slope * t1
    sea = sea * (1 - t2) + deep * t2
    del t1, t2
    sea *= (1 + 0.05 * (fbm(rng, H, W, 30, 3) - 0.5))[..., None]
    # warm shallow tropical water is lighter and greener
    tropic = np.clip((25 - np.abs(lat)) / 10, 0, 1)[:, None] * np.clip(1 - dist / 60, 0, 1)
    sea += (np.array(hx("#2b8aa0"), np.float32) - sea) * (tropic * 0.35)[..., None]
    del tropic
    # lagoons behind tropical beaches
    lag = (T == 4) * f_edge * np.clip(1 - dist / 12, 0, 1) * 0.55
    sea += (np.array(hx("#3fb3ad"), np.float32) - sea) * lag[..., None]; del lag
    # muddy river water off deltas and estuaries
    plume = plume_field(coast, H, W, f) * (0.55 + 0.45 * fbm(rng, H, W, 12, 3))
    sea += (np.array(hx("#5f6a52"), np.float32) - sea) * (plume * 0.5)[..., None]; del plume
    # fringing coral reefs: a soft turquoise band with a faint line of surf
    reefm = ((~land) & (coast == 20)).astype(np.float32)
    rb = np.clip(ndi.gaussian_filter(reefm, 1.6, mode=WRAP) * 2.2, 0, 1)
    sea += (np.array(hx("#47b4ad"), np.float32) - sea) * (rb * 0.6)[..., None]
    surf = np.clip(1 - np.abs(rb - 0.3) / 0.08, 0, 1) * (noise(rng, H, W, 2) > 0.45) * (dist > 3)
    sea += (np.array([230, 240, 240], np.float32) - sea) * (surf * 0.3)[..., None]
    del reefm, rb, surf, dist
    # fjords and ria inlets: fjords dark and deep, rias like shallow coastal water
    sea_ch = channel > 0.05
    fjord_sea = ndi.gaussian_filter(fj, 1.2, mode=WRAP) > 0.08
    sea[sea_ch & fjord_sea] = np.array(hx("#102f4d"), np.float32)
    ria_sea = sea_ch & ~fjord_sea & land                                   # ria inlets (cut into land): shallow coastal water
    sea[ria_sea] = np.array(hx("#2a5c7c"), np.float32)
    lakec = np.array(hx("#1d4060"), np.float32)
    log("  sea painted")

    # ---- the coastline itself, shaped by coast type
    narrow = ndi.gaussian_filter(lm_eff, 0.8, mode=WRAP); wide = ndi.gaussian_filter(lm_eff, 2.4, mode=WRAP)
    islet = ndi.gaussian_filter(lm, 8, mode=WRAP) < 0.12                 # small land keeps its shape so it does not vanish
    sw = (0.8 + (P["sw"] - 0.8) * f_edge) * ~islet
    n_fine = noise(rng, H, W, 1.6) - 0.5; n_med = fbm(rng, H, W, 4, 2) - 0.5
    nf = 0.04 + (P["nf"] - 0.04) * f_edge; nm = 0.05 + (P["nm"] - 0.05) * f_edge
    edge = narrow * (1 - sw) + wide * sw + n_fine * nf * 2 + n_med * nm * 2 + P["bias"] * f_edge
    del narrow, wide, islet, sw, nf, nm
    sharp = 0.2 + (P["sharp"] - 0.2) * f_edge
    a = np.clip((edge - (0.5 - sharp / 2)) / sharp, 0, 1)
    a = np.minimum(a, 1 - channel)
    a = np.where(is_lake, 0, a)
    a = a * a * (3 - 2 * a)
    # the shore strip on the land side: sand, rock, marsh, mangrove, ice or black sand by coast type
    shore = np.clip(1 - (edge - 0.5) / 0.13, 0, 1) * (a > 0.02) * P["sa"] * f_edge
    shore *= np.where(T == 2, n_med > 0.05, 1)                            # coves: only small pocket beaches
    shore_c = COAST_SHORE[T]
    marsh = (T == 5) & (n_med > 0.12)                                      # sheltered temperate shores: salt marsh
    shore_c[marsh] = np.array(hx("#69755a"), np.float32)
    col += (shore_c - col) * shore[..., None]
    del shore, shore_c, marsh, n_fine, n_med, edge
    # steep dark walls along fjords
    wall = np.clip(ndi.gaussian_filter(fj, 1.5, mode=WRAP) * 3, 0, 1) * (a > 0.5)
    col *= (1 - 0.3 * wall)[..., None]; del wall

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


# coast type -> how its coastline is drawn
#  sw: smoothing (0 sharp, 1 long smooth arcs); nf / nm: fine / medium raggedness; bias: + more land, - more sea
#  sharp: how soft the land-sea edge is; depth: how quickly the sea deepens; sa: strength of the shore strip
_CP = {  #      sw    nf    nm    bias   sharp depth  sa    shore colour
    0:  (0.80, 0.04, 0.05,  0.00, 0.20, 1.0, 0.00, "#000000"),
    1:  (0.80, 0.20, 0.14,  0.00, 0.10, 2.2, 0.30, "#5b534a"),   # cliffs and rocky headlands
    2:  (0.80, 0.08, 0.28, -0.06, 0.10, 1.4, 0.45, "#d6c69e"),   # rocky coves and pocket beaches
    3:  (1.00, 0.02, 0.03,  0.00, 0.25, 0.9, 0.60, "#dcc89c"),   # dry beaches and dunes
    4:  (1.00, 0.02, 0.03,  0.00, 0.25, 0.7, 0.65, "#efe5c8"),   # tropical beaches and lagoons
    5:  (0.90, 0.03, 0.05,  0.00, 0.22, 0.85, 0.50, "#d2c39c"),  # temperate beaches, dunes, salt marsh
    6:  (0.80, 0.06, 0.10, -0.03, 0.10, 1.2, 0.30, "#6a6152"),   # rias
    7:  (0.60, 0.06, 0.22,  0.07, 0.18, 0.6, 0.55, "#3f5a3c"),   # delta (mangroves or marsh)
    8:  (0.60, 0.05, 0.12, -0.04, 0.15, 0.8, 0.40, "#6f7a5a"),   # estuary (mud flats)
    9:  (0.75, 0.15, 0.10,  0.00, 0.09, 3.0, 0.45, "#4f4a44"),   # fjord coast
    10: (0.75, 0.15, 0.10,  0.00, 0.06, 3.0, 0.45, "#4f4a44"),   # fjord (inland)
    11: (0.80, 0.10, 0.06,  0.00, 0.06, 1.5, 0.80, "#e8eff6"),   # glacier front
    12: (0.70, 0.04, 0.05,  0.00, 0.18, 1.3, 0.70, "#3a3734"),   # black sand and gravel
}
COASTP = {k: np.zeros(256, np.float32) for k in ("sw", "nf", "nm", "bias", "sharp", "depth", "sa")}
COAST_SHORE = np.zeros((256, 3), np.float32)
for _k in range(256):
    _v = _CP.get(_k, _CP[0])
    for _i, _n in enumerate(("sw", "nf", "nm", "bias", "sharp", "depth", "sa")): COASTP[_n][_k] = _v[_i]
    COAST_SHORE[_k] = hx(_v[7])


def nearest_coast_type(coast, land, pad=48):
    """For every cell: the type of the nearest recorded coast cell (codes 1-12) and the distance to it, in cells."""
    H, W = coast.shape
    coded = (coast >= 1) & (coast <= 12)
    big = np.hstack([coded[:, -pad:], coded, coded[:, :pad]])
    dist, (iy, ix) = ndi.distance_transform_edt(~big, return_indices=True)
    dist = dist[:, pad:-pad].astype(np.float32); iy = iy[:, pad:-pad]; ix = (ix[:, pad:-pad] - pad) % W
    T = coast[iy, ix]
    T[dist > 40] = 0
    return T, dist


def ria_inlets(coast, land, h, rng, spacing=8.0):
    """Drowned river valleys behind ria coasts: from points along each ria coast, follow the lowest ground inland
    for 3-12 cells (about 14-55 km), sometimes branching.
    Returns inlet strength per cell (1 at the mouth, narrowing inland)."""
    H, W = coast.shape
    ria = coast == 6
    out = np.zeros((H, W), np.float32)
    if not ria.any(): return out
    seadist = ndi.distance_transform_edt(np.hstack([land[:, -48:], land, land[:, :48]]))[:, 48:-48]   # cells from the sea
    ys, xs = np.nonzero(ria & (seadist <= 1.5))
    order = rng.permutation(len(ys)); taken = {}; keep = np.zeros(len(ys), bool)
    g = int(spacing)                                                     # starting points at least `spacing` cells apart
    for i in order:
        y, x = int(ys[i]), int(xs[i]); gy, gx = y // g, x // g
        if any(abs(y - py) < spacing and abs(x - px) < spacing for a in (-1, 0, 1) for b in (-1, 0, 1) for (py, px) in taken.get((gy + a, gx + b), ())):
            continue
        if rng.random() < 0.35: continue                                   # irregular spacing
        taken.setdefault((gy, gx), []).append((y, x)); keep[i] = True
    def walk(y, x, steps, w0, d0=None):
        d = d0
        for s in range(steps):
            out[y, x] = max(out[y, x], w0 * (1 - 0.45 * s / max(1, steps - 1)))   # widest at the mouth, narrowing inland
            best = None
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if not dy and not dx: continue
                    ny, nx = y + dy, (x + dx) % W
                    if not (0 <= ny < H) or not land[ny, nx] or out[ny, nx] > 0: continue
                    if seadist[ny, nx] < seadist[y, x]: continue           # never back toward the sea
                    turn = 0 if d is None else (1 - (dy * d[0] + dx * d[1]) / math.hypot(dy, dx) / math.hypot(*d)) * 60
                    inland = seadist[ny, nx] - seadist[y, x]
                    # head inland every step; among the inland moves follow the lower ground and keep a smooth course
                    score = 0.3 * h[ny, nx] + turn * 0.3 + rng.normal(0, 18) - 40 * inland + (1000 if inland <= 0.01 else 0)
                    if best is None or score < best[0]: best = (score, ny, nx, (dy, dx))
            if best is None: return
            _, y, x, d = best
            if s == 3 and steps > 6 and rng.random() < 0.5:                 # a side branch
                walk(y, x, steps - 5, w0 * 0.7, (d[1], -d[0]) if rng.random() < 0.5 else (-d[1], d[0]))
    for y, x in zip(ys[keep], xs[keep]):
        walk(int(y), int(x), int(rng.integers(3, 13)), float(rng.uniform(1.0, 2.0)))   # varied lengths and mouth widths
    return out


def connect_fjords(fjord, land):
    """Fjord cells as a 0/1 field, with each fjord joined to the open sea by the shortest straight channel
    (the recorded fjord cells sometimes stop just short of the coast)."""
    H, W = fjord.shape
    out = fjord.astype(np.float32)
    if not fjord.any(): return out
    pad = 32
    big = np.hstack([land[:, -pad:], land, land[:, :pad]])
    sd, (iy, ix) = ndi.distance_transform_edt(big, return_indices=True)
    sd = sd[:, pad:-pad]; iy = iy[:, pad:-pad]; ix = (ix[:, pad:-pad] - pad) % W
    lab, n = ndi.label(fjord, structure=np.ones((3, 3)))
    for k, sl in enumerate(ndi.find_objects(lab), 1):
        ys, xs = np.nonzero(lab[sl] == k); ys = ys + sl[0].start; xs = xs + sl[1].start
        j = int(np.argmin(sd[ys, xs]))
        y0, x0 = int(ys[j]), int(xs[j])
        if sd[y0, x0] <= 1.0: continue                                  # already touches the sea
        y1, x1 = int(iy[y0, x0]), int(ix[y0, x0])
        dx = (x1 - x0 + W // 2) % W - W // 2
        steps = int(max(abs(y1 - y0), abs(dx))) + 1
        for t in np.linspace(0, 1, steps):
            out[int(round(y0 + (y1 - y0) * t)), int(round(x0 + dx * t)) % W] = 1
    return out


def plume_field(coast, H, W, f=4):
    """0..1: muddy water off deltas and estuaries, fading over about 25 km."""
    m = np.isin(coast, (7, 8)).reshape(H // f, f, W // f, f).any(axis=(1, 3))
    if not m.any(): return np.zeros((H, W), np.float32)
    pad = 60
    big = np.hstack([m[:, -pad:], m, m[:, :pad]])
    d = ndi.distance_transform_edt(~big)[:, pad:-pad] * (math.pi * 6371 / (H // f))
    return np.exp(-resize_f(d, W, H) / 25).astype(np.float32)


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
