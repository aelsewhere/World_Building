"""Make a fake maps folder in the formats of the globe data pack (Nov 4, 2026).

Only for testing the globe viewer when the real files are not to hand.
The land, nations and cities it makes are random and mean nothing.

    python make_test_data.py OUTPUT_FOLDER [--width 8640]
"""
import argparse, csv, os
import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("out")
p.add_argument("--width", type=int, default=8640)
a = p.parse_args()
W = a.width; H = W // 2
os.makedirs(a.out, exist_ok=True)
rng = np.random.default_rng(7)

def noise(octaves):
    acc = np.zeros((H, W), np.float32)
    for size, amp in octaves:
        small = rng.random((max(2, size // 2), size)).astype(np.float32)
        img = Image.fromarray(small).resize((W, H), Image.BICUBIC)
        acc += np.asarray(img) * amp
    return acc

lat = 90 - (np.arange(H) + 0.5) * 180 / H
lon = (np.arange(W) + 0.5) * 360 / W
LON, LAT = np.meshgrid(lon, lat)

# six continent centres (lat, lon east of seam)
centres = [(20, 25), (-15, 55), (15, 110), (5, 190), (0, 245), (25, 320)]
n = noise([(12, 1.0), (40, 0.5), (160, 0.25)])
cont = np.zeros((H, W), np.uint8); best = np.full((H, W), 1e9, np.float32)
for k, (cl, cn) in enumerate(centres, 1):
    dl = np.abs(((LON - cn + 180) % 360) - 180) * np.cos(np.radians(LAT))
    d = np.hypot(dl, LAT - cl)
    m = d < best
    best[m] = d[m]; cont[m] = k
land = (best + (n - 0.9) * 40) < 22
cont[~land] = 0
polar = np.abs(LAT) > 80
mount = noise([(30, 1.0), (120, 0.6), (480, 0.3)])
h = np.where(land, 50 + (mount - 0.9) ** 2 * 4000, 0)
h = np.clip(h, 1, 6600)
elev = np.where(land, h + 1000, 0)
elev[polar] = 1000 + 300 + (np.abs(LAT[polar]) - 80) * 220
Image.fromarray(elev.astype(np.uint16)).save(os.path.join(a.out, "world_elevation_data_v2.png"))

# land use by latitude and height
lu = np.zeros((H, W), np.uint8)
al = np.abs(LAT)
lu[land & (al < 10)] = 1
lu[land & (al >= 10) & (al < 18)] = 3
lu[land & (al >= 18) & (al < 30)] = 6
lu[land & (al >= 30) & (al < 42)] = 8
lu[land & (al >= 42) & (al < 55)] = 10
lu[land & (al >= 55) & (al < 66)] = 19
lu[land & (al >= 66)] = 21
farm = land & (noise([(80, 1)]) > 0.7) & (al < 55) & (al > 18)
lu[farm] = 14
lu[land & (h > 4500)] = 22
lu[polar] = 22
Image.fromarray(lu).save(os.path.join(a.out, "world_landuse_data_v1.png"))

# nations: voronoi inside each continent
nat = np.zeros((H, W), np.uint8)
rows = []
names = ["Arvel", "Belor", "Cassin", "Dorim", "Esk", "Faro", "Gelt", "Huma", "Irav", "Jost", "Kell", "Lune",
         "Mavri", "Nolt", "Orun", "Pesk", "Quill", "Ravo", "Sule", "Tarn"]
cnames = ["Morasil", "Solua", "Mesomara", "Kamon", "Elmiyaro", "Hoakamotu"]
counts = [24, 19, 18, 18, 18, 15]
for k in range(1, 7):
    ys, xs = np.nonzero(cont == k)
    pick = rng.choice(len(ys), counts[k - 1], replace=False)
    seeds = np.stack([ys[pick], xs[pick]], 1)
    sub = slice(None)
    best = np.full(len(ys), 1e12)
    lab = np.zeros(len(ys), np.uint8)
    for j, (sy, sx) in enumerate(seeds, 1):
        dx = np.abs(xs - sx); dx = np.minimum(dx, W - dx)
        d = (ys - sy) ** 2 + dx.astype(np.float64) ** 2
        m = d < best; best[m] = d[m]; lab[m] = j
    nat[ys, xs] = lab
    for j in range(1, counts[k - 1] + 1):
        rows.append([k, cnames[k - 1], j, f"{names[(j - 1) % 20]} {cnames[k-1][:3]}{j}", k * 100 + j])
Image.fromarray(cont).save(os.path.join(a.out, "world_continent_data_v1.png"))
Image.fromarray(nat).save(os.path.join(a.out, "world_nations_data_v1.png"))
with open(os.path.join(a.out, "world_nations_index_v1.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["Continent code", "Continent", "Nation #", "Name", "Global ID"]); w.writerows(rows)

# water: random meandering rivers, a few lakes
water = np.zeros((H, W), np.uint8)
ys, xs = np.nonzero(land & ~polar)
for _ in range(300):
    i = rng.integers(len(ys)); y, x = float(ys[i]), float(xs[i]); ang = rng.random() * 6.28
    flag = 1 if rng.random() < 0.8 else 2
    for step in range(int(W / 12)):
        yi, xi = int(y) % H, int(x) % W
        if not land[yi, xi]: break
        water[yi, xi] |= flag
        if step == 40 and rng.random() < 0.3: water[yi, xi] |= 4
        ang += rng.normal(0, 0.25); y += np.sin(ang); x += np.cos(ang)
lakes = land & (noise([(200, 1)]) > 0.93) & ~polar
water[lakes] = 16
Image.fromarray(water).save(os.path.join(a.out, "world_water_data_v1.png"))

# coast: land cells next to sea
sea = ~land & ~polar
nb = np.zeros_like(sea)
for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    nb |= np.roll(np.roll(sea, dy, 0), dx, 1)
coast = np.zeros((H, W), np.uint8)
cl = land & nb
coast[cl] = (1 + (noise([(300, 1)]) * 8).astype(np.uint8) % 9)[cl]
landnb = np.zeros_like(land)
for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    landnb |= np.roll(np.roll(land, dy, 0), dx, 1)
coast[sea & landnb & (al < 25) & (noise([(300, 1)]) > 0.6)] = 20
Image.fromarray(coast).save(os.path.join(a.out, "world_coast_data_v1.png"))

snow = np.zeros((H, W), np.uint8)
snow[(cont == 1) & (h > 3500)] = 1
snow[(cont == 1) & (h > 4500)] = 2
snow[(cont == 6) & (h > 3000)] = 2
snow[(cont == 1) & (al > 45) & (h < 1000) & land] = 4
Image.fromarray(snow).save(os.path.join(a.out, "world_snow_data_v1.png"))

# cities
with open(os.path.join(a.out, "cities_v1.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["City", "Nation", "Latitude", "Longitude (east of seam)"])
    ys, xs = np.nonzero(land & ~polar)
    for c in range(469):
        i = rng.integers(len(ys))
        w.writerow([f"City {c+1}", int(cont[ys[i], xs[i]]) * 100 + int(nat[ys[i], xs[i]]),
                    round(float(90 - (ys[i] + 0.5) * 180 / H), 3), round(float((xs[i] + 0.5) * 360 / W), 3)])
print("written to", a.out)
