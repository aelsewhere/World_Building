"""Prepare the world globe from the Nov 4, 2026 globe data pack.

Reads the world data files once and writes everything the globe page shows,
already finished: map pictures for each map style (a whole-world picture plus
sharp close-up tiles), heights for the raised relief, hover data, and the
nation, city and world summaries. The page then only has to display them.

    python bake_globe.py MAPS_FOLDER OUTPUT_FOLDER [CLIMATE_FOLDER]

CLIMATE_FOLDER holds world_t_jan/jul_data and world_p_jan/jul_data (default: MAPS_FOLDER).
With them the natural-colour map is painted realistically (tools/realistic.py).

Needs Python 3 with numpy and Pillow (WebP support).
"""
import csv, json, math, os, re, sys, time
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
R = 6371.0                      # Earth's mean radius, km
TX, TY = 8, 4                   # close-up tiles: 45 x 45 degrees each
LOW_W, LOW_H = 4096, 2048       # whole-world picture
MESH_STEP = 0.5                 # relief mesh spacing, degrees
SHADE_K = 8.0                   # strength of the hill shading

maps, out = sys.argv[1], sys.argv[2]
climate_dir = sys.argv[3] if len(sys.argv) > 3 else maps
os.makedirs(out, exist_ok=True)
t0 = time.time()
def log(*a): print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)

def newest(pattern):
    best = None
    for f in os.listdir(maps):
        m = re.match(pattern, f, re.I)
        if m and (best is None or int(m.group(1)) > best[0]): best = (int(m.group(1)), f)
    if not best: return None
    return os.path.join(maps, best[1])

def load(pattern, dtype=np.uint8):
    p = newest(pattern)
    if not p: log("missing", pattern); return None, None
    a = np.asarray(Image.open(p))
    if a.ndim == 3: a = a[..., 0]
    log("read", os.path.basename(p), a.shape, a.dtype)
    return a.astype(dtype, copy=False), os.path.basename(p)

files = {}
elev, files["elevation"] = load(r"world_elevation_data_v(\d+)\.png$", np.uint16)
H, W = elev.shape
assert W == 2 * H, "expected a 2:1 world grid"
layers = {}
for k in ["landuse", "water", "coast", "snow", "continent", "nations"]:
    layers[k], files[k] = load(rf"world_{k}_data_v(\d+)\.png$")
    if layers[k] is None: layers[k] = np.zeros((H, W), np.uint8)
lu, water, coast, snow, cont, nat = (layers[k] for k in ["landuse", "water", "coast", "snow", "continent", "nations"])

land = elev > 0
h = np.where(land, elev.astype(np.int32) - 1000, 0).astype(np.int32)
gid = np.where(land & (cont > 0) & (nat > 0), cont.astype(np.int32) * 100 + nat, 0).astype(np.int32)

# ------------------------------------------------------------------ names and cities
names = {}
p = newest(r"world_nations_index_v(\d+)\.csv$"); files["index"] = os.path.basename(p) if p else None
if p:
    with open(p, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f)); head = [c.lower() for c in rows[0]]
        gi = next(i for i, c in enumerate(head) if "global" in c); ni = head.index("name")
        for r in rows[1:]:
            if r and r[gi].strip(): names[int(r[gi])] = r[ni].strip()
CONT = ["", "Morasil", "Solua", "Mesomara", "Kamon", "Elmiyaro", "Hoakamotu"]
cities = []
p = newest(r"cities_v(\d+)\.csv$"); files["cities"] = os.path.basename(p) if p else None
if p:
    with open(p, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f)); head = [c.lower() for c in rows[0]]
        ci = next((i for i, c in enumerate(head) if c.startswith("continent")), None)
        ni = next((i for i, c in enumerate(head) if "city" in c), None)
        la = next(i for i, c in enumerate(head) if c.startswith("lat"))
        lo = next(i for i, c in enumerate(head) if c.startswith("lon"))
        si = next((i for i, c in enumerate(head) if "source" in c), None)
        for r in rows[1:]:
            if not r or not r[la].strip(): continue
            lat, lon = float(r[la]), float(r[lo]) % 360
            y = min(H - 1, int((90 - lat) / 180 * H)); x = min(W - 1, int(lon / 360 * W))
            cities.append({"continent": r[ci] if ci is not None else "", "n": int(r[ni]) if ni is not None else len(cities) + 1,
                           "lat": lat, "lon": round(lon, 4), "source": r[si] if si is not None else "",
                           "nation": int(gid[y, x]), "h": int(h[y, x]) if land[y, x] else None})
log(len(names), "nation names,", len(cities), "cities")

# ------------------------------------------------------------------ statistics
lat_c = 90 - (np.arange(H) + 0.5) * 180 / H
row_area = (R * R * (2 * math.pi / W) * (np.sin(np.radians(90 - np.arange(H) * 180 / H)) - np.sin(np.radians(90 - (np.arange(H) + 1) * 180 / H)))).astype(np.float64)
area_map = np.broadcast_to(row_area[:, None], (H, W))
gids = sorted(int(g) for g in np.unique(gid) if g)
flat_g = gid.ravel()
areas = np.bincount(flat_g, weights=area_map.ravel(), minlength=700)
cells = np.bincount(flat_g, minlength=700)
lon_c = (np.arange(W) + 0.5) * 360 / W
cl, sl = np.cos(np.radians(lat_c))[:, None], np.sin(np.radians(lat_c))[:, None]
vx = np.bincount(flat_g, weights=(area_map * cl * np.cos(np.radians(lon_c))[None, :]).ravel(), minlength=700)
vy = np.bincount(flat_g, weights=(area_map * sl * np.ones((1, W))).ravel(), minlength=700)
vz = np.bincount(flat_g, weights=(area_map * cl * np.sin(np.radians(lon_c))[None, :]).ravel(), minlength=700)
hmax_n = np.zeros(700, np.int32); np.maximum.at(hmax_n, flat_g, h.ravel())
nations = []
for k, g in enumerate(gids, 1):
    lat = math.degrees(math.atan2(vy[g], math.hypot(vx[g], vz[g]))); lon = math.degrees(math.atan2(vz[g], vx[g])) % 360
    # label at the nation's own cell nearest its centre (the centre itself can fall outside, e.g. in a bay)
    ys, xs = np.nonzero(gid[::4, ::4] == g)
    if len(ys):
        cy, cx = (90 - lat) / 180 * (H / 4), lon / 360 * (W / 4)
        dx = np.abs(xs - cx); dx = np.minimum(dx, W / 4 - dx) * np.cos(np.radians(lat))
        j = np.argmin((ys - cy) ** 2 + dx ** 2)
        llat, llon = 90 - (ys[j] * 4 + 2) * 180 / H, (xs[j] * 4 + 2) * 360 / W
    else: llat, llon = lat, lon
    nations.append({"i": k, "gid": g, "name": names.get(g, f"{CONT[g // 100]} nation {g % 100}"), "c": g // 100, "n": g % 100,
                    "area": round(float(areas[g])), "cells": int(cells[g]), "hmax": int(hmax_n[g]),
                    "lat": round(llat, 3), "lon": round(llon, 3),
                    "cities": sum(1 for c in cities if c["nation"] == g)})
gid_to_i = np.zeros(700, np.uint8)
for n in nations: gid_to_i[n["gid"]] = n["i"]
imax = int(np.argmax(np.where(land, h, -99999)))
land_area = float(area_map[land].sum()); total = 4 * math.pi * R * R
summary = {
    "grid": [W, H], "radius": R, "files": files, "land_area": round(land_area), "land_share": land_area / total,
    "highest": {"h": int(h.ravel()[imax]), "lat": float(lat_c[imax // W]), "lon": float(lon_c[imax % W])},
    "lowest_land": int(h[land].min()),
    "continents": {CONT[c]: round(float(area_map[cont == c].sum())) for c in range(1, 7)},
    "index_missing": [g for g in names if g not in set(gids)], "unnamed": [g for g in gids if g not in names],
    "land_no_continent": int((land & (cont == 0)).sum()), "continent_no_nation": int((land & (cont > 0) & (nat == 0)).sum()),
    "tiles": [TX, TY], "low": [LOW_W, LOW_H], "mesh_step": MESH_STEP,
}
log("statistics done:", len(nations), "nations")

# ------------------------------------------------------------------ hill shading and borders
dy = math.pi * R / H * 1000
dx = np.maximum(0.05, np.cos(np.radians(lat_c)))[:, None] * 2 * math.pi * R / W * 1000
hf = h.astype(np.float32)
gx = (np.roll(hf, -1, 1) - np.roll(hf, 1, 1)) / (2 * dx) * SHADE_K
north = np.vstack([hf[:1], hf[:-1]]); south = np.vstack([hf[1:], hf[-1:]])
gy = (north - south) / (2 * dy) * SHADE_K
az, alt = math.radians(315), math.radians(45)
Lx, Ly, Lz = math.cos(alt) * math.sin(az), math.cos(alt) * math.cos(az), math.sin(alt)
shade = ((-gx * Lx - gy * Ly + Lz) / np.sqrt(gx * gx + gy * gy + 1) / Lz).astype(np.float32)
del gx, gy, north, south
ge, gs = np.roll(gid, -1, 1), np.vstack([gid[1:], np.zeros((1, W), np.int32)])
b1 = (gid > 0) & (ge > 0) & (ge != gid); b2 = (gid > 0) & (gs > 0) & (gs != gid)
border = b1 | np.roll(b1, 1, 1) | b2 | np.vstack([np.zeros((1, W), bool), b2[:-1]])
del ge, gs, b1, b2
# shallow water near coasts (for the natural and elevation maps)
small = Image.fromarray((land * 255).astype(np.uint8)).resize((W // 8, H // 8), Image.BOX)
near = np.maximum(np.asarray(small.filter(ImageFilter.GaussianBlur(2))).astype(np.float32),
                  np.asarray(small.filter(ImageFilter.GaussianBlur(7))).astype(np.float32) * 1.6)
near = np.asarray(Image.fromarray(np.clip(near, 0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255
log("shading done")

# ------------------------------------------------------------------ colours
def hx(s): return [int(s[i:i + 2], 16) for i in (1, 3, 5)]
LANDUSE = {1: ("Jungle", "#2c6a2a", "#1b7a2e"), 2: ("Seasonal tropical forest", "#557f34", "#5aa83a"), 3: ("Savanna", "#b3a95a", "#d6c95a"),
    4: ("Grassland", "#9cb45e", "#a6d66b"), 5: ("Steppe", "#bfb27a", "#e3d79b"), 6: ("Hot desert", "#dcc08c", "#f5d991"),
    7: ("Salt flats", "#e9e3d4", "#ffffff"), 8: ("Mediterranean scrub", "#a2985c", "#b8a24a"), 9: ("Dry scrub", "#b7a170", "#d2b47c"),
    10: ("Temperate forest", "#4a7a3b", "#3e9a4a"), 11: ("Temperate rainforest (and laurel forest)", "#2d5c3a", "#1f6e55"),
    12: ("Moorland", "#8a875f", "#9a7fa6"), 13: ("Cloud forest (and montane forest)", "#3b6c4c", "#3aa58a"), 14: ("Farmland", "#aeb46a", "#e8b84a"),
    15: ("Mangroves", "#3d684d", "#2f8f7f"), 16: ("Coastal fog desert", "#cbbd9b", "#c7b8d6"), 17: ("(old painted mountains)", "#8a7f72", "#8a7f72"),
    18: ("Marsh / swamp", "#6a875a", "#5f8fa0"), 19: ("Conifer forest", "#33543a", "#245a3a"), 20: ("Peat and tussock grass", "#a1986a", "#b0a070"),
    21: ("Tundra", "#999a82", "#a9b3a0"), 22: ("Ice cap / glacier", "#f1f4f7", "#f4f8ff"), 23: ("Outwash gravel and moss", "#9b9988", "#8f9a7e")}
COAST = {1: ("Cliffs", "#b5523b"), 2: ("Rocky coves", "#d08a4a"), 3: ("Dry beaches and dunes", "#f0d27a"), 4: ("Tropical beaches and lagoons", "#fff2a8"),
    5: ("Temperate beaches, dunes, salt marsh", "#c8d98a"), 6: ("Rias", "#9a6fd0"), 7: ("Delta (mangroves or marsh)", "#3f9a5a"), 8: ("Estuary", "#4aa0d0"),
    9: ("Fjord coast", "#3f5fd0"), 10: ("Fjord (inland)", "#2a3fa0"), 11: ("Glacier front", "#e8f4ff"), 12: ("Black sand and gravel", "#3a3a3a"),
    20: ("Fringing coral reef", "#36d6c8")}
WATER = [(1, "River or stream", "#2f6fd0"), (2, "Seasonal (dry-bed)", "#8fb8e0"), (4, "Waterfall or cataract", "#ff4040"), (8, "Gorge", "#a040c0"),
    (16, "Lake", "#2a5fa8"), (32, "Springs", "#30d070"), (64, "Canal (Crocevia)", "#ff9a20"), (128, "Outwash plain", "#c8b890")]
SNOW = {1: ("Seasonal mountain snow", "#b8d4f0"), 2: ("Permanent snow / ice cap", "#ffffff"), 3: ("Glacier tongue", "#6fb0ff"), 4: ("Winter snow on lowlands", "#d8c8f0")}
ELEV_STOPS = [(-200, "#4f9a7a"), (0, "#5f9e4f"), (200, "#9fc06a"), (500, "#e2db96"), (1000, "#d6ae6c"), (2000, "#ad7748"), (3000, "#8a593c"),
    (4000, "#7d6c66"), (5000, "#b9b1ad"), (6000, "#ffffff")]
CONT_COL = ["#000000", "#d98c5f", "#6fbf73", "#e6c75a", "#c46fbf", "#5fa8d9", "#d9d9d9"]
def lut(d, idx):
    l = np.zeros((256, 3), np.float32)
    for k, v in d.items(): l[k] = hx(v[idx])
    return l
LU_NAT, LU_MAP, COAST_L, SNOW_L = lut(LANDUSE, 1), lut(LANDUSE, 2), lut(COAST, 1), lut(SNOW, 1)
ev = np.arange(-1000, 8001)
ELEV_L = np.stack([np.interp(ev, [s[0] for s in ELEV_STOPS], [hx(s[1])[c] for s in ELEV_STOPS]) for c in range(3)], 1).astype(np.float32)
import colorsys
NAT_L = np.zeros((700, 3), np.float32)
for g in range(100, 700):
    c, n = g // 100, g % 100
    r, gg, b = colorsys.hls_to_rgb(((c * 61 + n * 137.508) % 360) / 360, 0.55 + 0.12 * ((n * 5) % 3) / 2, 0.45 + 0.2 * ((n * 7) % 3) / 2)
    NAT_L[g] = [r * 255, gg * 255, b * 255]
CONT_L = np.array([hx(c) for c in CONT_COL], np.float32)
WATER_L = np.tile(np.array([206, 204, 198], np.float32), (256, 1)); WATER_S = np.full(256, 0.7, np.float32)
for v in range(256):
    for bit, _, col in WATER:
        if v & bit and bit not in (4, 32): WATER_L[v] = hx(col); WATER_S[v] = 0.7 if bit == 128 else 0.0

def blend(img, mask, col, t):
    img[mask] += (np.array(col, np.float32) - img[mask]) * t

LAKE = (44, 95, 147); DEEP = np.array([20, 50, 92], np.float32); SHALLOW = np.array([44, 98, 148], np.float32)
is_lake = (water & 16) > 0

def paint(style, borders=True):
    img = np.empty((H, W, 3), np.float32)
    sh = np.zeros((H, W), np.float32)
    if style in ("natural", "elevation"):
        sea = DEEP + (SHALLOW - DEEP) * np.clip(near, 0, 1)[..., None]
    else:
        sea = np.broadcast_to(np.array([196, 214, 230], np.float32), (H, W, 3))
    img[:] = sea
    L = land
    if style == "natural":
        base = np.where((lu > 0)[..., None], LU_NAT[lu], ELEV_L[np.clip(h, -1000, 8000) + 1000])
        img[L] = base[L]; sh[L] = 1
        rock = L & (h > 2600) & (lu != 22)
        t = (np.clip((h[rock] - 2600) / 1800, 0, 1) * 0.75)[:, None]
        img[rock] += (np.array([138, 127, 114], np.float32) - img[rock]) * t
        img[L & ((snow == 2) | (snow == 3))] = (244, 247, 250)
        blend(img, L & (snow == 1), (244, 247, 250), 0.55)
        riv = L & ~is_lake
        blend(img, riv & ((water & 2) > 0) & ((water & 65) == 0), (120, 150, 180), 0.4)
        blend(img, riv & ((water & 1) > 0) & ((water & 64) == 0), (52, 98, 160), 0.85)
        img[riv & ((water & 64) > 0)] = (60, 110, 170)
    elif style == "elevation":
        img[L] = ELEV_L[np.clip(h[L], -1000, 8000) + 1000]; sh[L] = 1
    elif style == "water":
        img[L] = WATER_L[water[L]]; sh[L] = WATER_S[water[L]]
    else:
        img[L] = (206, 204, 198); k = {"landuse": 0.35, "nations": 0.5, "continents": 0.5, "coast": 0.7, "snow": 0.7}[style]; sh[L] = k
        if style == "landuse":
            m = L & (lu > 0); img[m] = LU_MAP[lu[m]]
        elif style == "nations":
            m = gid > 0; img[m] = NAT_L[gid[m]]; img[L & ~m & (lu == 22)] = (236, 240, 244)
        elif style == "continents":
            m = L & (cont > 0); img[m] = CONT_L[cont[m]]; img[L & ~m & (lu == 22)] = (236, 240, 244)
        elif style == "coast":
            cc = coast.copy()
            for oy in (-1, 0, 1):          # widen coast cells by one cell so the thin lines show
                for ox in (-1, 0, 1):
                    s2 = np.roll(np.roll(coast, oy, 0), ox, 1); fill = (cc == 0) & (s2 > 0) & (s2 != 20) & L; cc[fill] = s2[fill]
            m = L & (cc > 0); img[m] = COAST_L[cc[m]]; sh[m] = 0
        elif style == "snow":
            m = L & (snow > 0); img[m] = SNOW_L[snow[m]]; sh[m] = 0.4
    if style in ("natural", "coast"):
        img[~L & (coast == 20)] = (63, 191, 184)
    lk = is_lake & ((style != "water") | ~L)
    img[lk] = LAKE; sh[lk] = 0
    f = 1 + (shade - 1) * sh
    img *= f[..., None]
    if borders:
        if style in ("natural", "elevation"): blend(img, border, (250, 240, 200), 0.65)
        else: img[border] *= 0.2
    if style == "water":                   # waterfalls and springs drawn as 5 x 5 markers
        for bit, col in ((32, (48, 208, 112)), (4, (255, 64, 64))):
            m = (water & bit) > 0; mm = m.copy()
            for oy in range(-2, 3):
                for ox in range(-2, 3): mm |= np.roll(np.roll(m, oy, 0), ox, 1)
            img[mm] = col
    return np.clip(img, 0, 255).astype(np.uint8)

# ------------------------------------------------------------------ climate (for the realistic natural-colour map)
climate = {}
for k, pat in [("tjan", r"world_t_jan_data_v(\d+)\.png$"), ("tjul", r"world_t_jul_data_v(\d+)\.png$"),
               ("pjan", r"world_p_jan_data_v(\d+)\.png$"), ("pjul", r"world_p_jul_data_v(\d+)\.png$")]:
    best = None
    for f in os.listdir(climate_dir):
        m = re.match(pat, f, re.I)
        if m and (best is None or int(m.group(1)) > best[0]): best = (int(m.group(1)), f)
    if best:
        a = np.asarray(Image.open(os.path.join(climate_dir, best[1]))).astype(np.float32)
        climate[k] = a / 100 - 100 if k[0] == "t" else a / 10          # degrees C; mm in the month
        files["climate_" + k] = best[1]
REALISTIC = len(climate) == 4
if REALISTIC:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import realistic
    rdata = dict(h=h, land=land, lu=lu, water=water, coast=coast, snow=snow, cont=cont, border=border, shade=shade, **climate)
log("climate files:", "found, realistic natural colour" if REALISTIC else "not found, plain natural colour")

def save_style(name, img):
    d = os.path.join(out, "maps", name); os.makedirs(d, exist_ok=True)
    pim = Image.fromarray(img)
    pim.resize((LOW_W, LOW_H), Image.LANCZOS).save(os.path.join(d, "world.webp"), quality=84, method=5)
    for ty in range(TY):
        for tx in range(TX):
            pim.crop((tx * tw, ty * th, (tx + 1) * tw, (ty + 1) * th)).save(os.path.join(d, f"t{tx}_{ty}.webp"), quality=86, method=5)

STYLES = [("natural", True), ("natural-plain", False), ("elevation", False), ("landuse", False), ("nations", True),
          ("continents", True), ("water", False), ("coast", False), ("snow", False)]
tw, th = W // TX, H // TY
for name, b in STYLES:
    if REALISTIC and name.startswith("natural"):
        if name == "natural": real = realistic.paint_realistic(rdata, log=log)
        img = real[1] if b else real[0]; save_style(name, img)
        if name == "natural":     # where the water is, for sun glint on the globe (its own picture: no transparency)
            Image.fromarray(real[2]).resize((LOW_W, LOW_H), Image.BOX).save(os.path.join(out, "water.webp"), quality=80, method=5)
        if name == "natural-plain": del real
    else:
        img = paint(name.replace("-plain", ""), b); save_style(name, img)
    del img
    log("painted", name)
summary["realistic"] = REALISTIC
if REALISTIC:
    Image.fromarray(realistic.clouds(climate)).save(os.path.join(out, "clouds.webp"), quality=80, method=5)
    log("clouds")

# ------------------------------------------------------------------ relief mesh heights (vertex grid, 0.5 degrees)
cpd = W // 360; s = int(MESH_STEP * cpd); half = s // 2
hp = np.pad(h, ((half, half), (0, 0)), mode="edge"); hp = np.roll(hp, half, 1)
nv_y, nv_x = H // s + 1, W // s
blk = hp[: nv_y * s].reshape(nv_y, s, nv_x, s)
vh = (0.5 * blk.max(axis=(1, 3)) + 0.5 * blk.mean(axis=(1, 3))).clip(0)
vh = np.hstack([vh, vh[:, :1]]).astype(np.int16)
hv = vh.astype(np.int32).clip(0, 65535)          # sea and below-sea land as 0; high byte in red, low byte in green
Image.fromarray(np.dstack([(hv >> 8), (hv & 255), np.zeros_like(hv)]).astype(np.uint8)).save(os.path.join(out, "heights.png"), optimize=True)
summary["mesh"] = [vh.shape[1], vh.shape[0]]
log("mesh heights", vh.shape)

# ------------------------------------------------------------------ hover data at half resolution (lossless PNG)
hs = slice(None, None, 2)
eh = elev[hs, hs]
Image.fromarray(np.dstack([gid_to_i[gid[hs, hs]], lu[hs, hs], water[hs, hs]]).astype(np.uint8)).save(os.path.join(out, "info_a.png"), optimize=True)
Image.fromarray(np.dstack([(coast[hs, hs].astype(np.uint16) * 8 + snow[hs, hs]).clip(0, 255).astype(np.uint8),
                           (eh >> 8).astype(np.uint8), (eh & 255).astype(np.uint8)])).save(os.path.join(out, "info_b.png"), optimize=True)
summary["info"] = [W // 2, H // 2]
log("hover data written")

legend = {"landuse": {k: list(v) for k, v in LANDUSE.items()}, "coast": {k: list(v) for k, v in COAST.items()},
          "water": [list(w) for w in WATER], "snow": {k: list(v) for k, v in SNOW.items()}, "elev": ELEV_STOPS,
          "continents": [[CONT[c], CONT_COL[c]] for c in range(1, 7)],
          "nation_colours": {n["i"]: "#%02x%02x%02x" % tuple(int(v) for v in NAT_L[n["gid"]]) for n in nations}}
with open(os.path.join(out, "world.json"), "w") as f:
    json.dump({"summary": summary, "nations": nations, "cities": cities, "legend": legend}, f, separators=(",", ":"))
log("done")
