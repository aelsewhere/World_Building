"""Add the trade routes, nation maps, capitals and the Nov 6 city list to the prepared globe.

Runs after bake_globe.py, on its output folder (it updates world.json in place and adds files):

    python bake_extras.py MAPS_FOLDER GLOBE_FOLDER TRADE_FOLDER NATIONS_FOLDER CITIES_CSV DATA_PACK_MD

- Trade routes are traced from the route pictures by their legend colours and placed on the world grid:
  each continent picture covers its recorded relief_v2 box (build reference, section 2) at 3x or 4x;
  the world sea-lane picture is the world map at 1/12 degree from relief row 160 (checked: 99.7% of its
  sea falls on sea in the data; the continent pictures 99.5-100%).
- Nation maps and route maps are copied as WebP pictures for the Atlas panel.
- Capitals come from the data pack's capital tables; cities from cities_v7.csv.
"""
import csv, glob, json, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
maps, out, trade, nat_dir, cities_csv, pack = sys.argv[1:7]
OW, OH = 4096, 2048                                  # route overlay grid
CONT = ["", "Morasil", "Solua", "Mesomara", "Kamon", "Elmiyaro", "Hoakamotu"]
BOX = {"Morasil": (0, 280, 3), "Solua": (470, 610, 4), "Mesomara": (716, 344, 3),
       "Kamon": (1280, 372, 3), "Elmiyaro": (1770, 380, 4), "Hoakamotu": (2176, 190, 3)}
CLASSES = [  # (name, picture colour, tolerance, colour drawn on the globe, smallest piece kept)
    ("land", (180, 24, 24), 45, (205, 40, 40), 30), ("river", (24, 60, 168), 34, (40, 90, 230), 30),
    ("sea", (12, 108, 120), 40, (20, 170, 180), 12), ("luxury", (144, 60, 168), 40, (185, 90, 230), 12),
    ("hub", (252, 192, 0), 60, (255, 205, 40), 20), ("luxhub", (180, 120, 228), 40, (205, 150, 255), 20)]

def splat(overlay, mask, x0, y0, k, colour, grow=0):
    vs, us = np.nonzero(mask)
    lon = (x0 + (us + 0.5) / k) * 0.125; lat = 90 - (y0 + (vs + 0.5) / k) * 0.125
    ox = ((lon / 360 * OW).astype(int)) % OW; oy = np.clip(((90 - lat) / 180 * OH).astype(int), 0, OH - 1)
    for dy in range(-grow, grow + 1):
        for dx in range(-grow, grow + 1):
            yy = np.clip(oy + dy, 0, OH - 1); xx = (ox + dx) % OW
            overlay[yy, xx, :3] = colour; overlay[yy, xx, 3] = 255

def legend_boxes(a):
    """Mask of white boxes (legend, title) in a route picture, so their swatches are not traced."""
    white = (a.min(2) > 245)
    lab, n = ndi.label(white)
    keep = np.zeros(white.shape, bool)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h * w > 15000 and (lab[sl] == i).mean() > 0.5:
            keep[max(0, sl[0].start - 8):sl[0].stop + 8, max(0, sl[1].start - 8):sl[1].stop + 8] = True
    return keep

def colour_mask(a, col, tol, minsize):
    m = np.abs(a - np.array(col)).sum(2) < tol
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    if n == 0: return m
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    return sizes[lab] >= minsize

os.makedirs(os.path.join(out, "routes"), exist_ok=True)
os.makedirs(os.path.join(out, "nations"), exist_ok=True)
summary_routes = {}

# ---- continent routes
ov = np.zeros((OH, OW, 4), np.uint8)
for name, (x0, y0, k) in BOX.items():
    f = sorted(glob.glob(os.path.join(trade, f"trade_routes_{name}_v*.png")))
    if not f: continue
    f = f[-1]; a = np.asarray(Image.open(f).convert("RGB")).astype(np.int16)
    skip = legend_boxes(a)
    for cname, col, tol, draw, minsize in CLASSES:
        m = colour_mask(a, col, tol, minsize) & ~skip
        splat(ov, m, x0, y0, k, draw, grow=0)
    pic = Image.open(f).convert("RGB"); pic.thumbnail((1600, 1600))
    pic.save(os.path.join(out, "routes", name + ".webp"), quality=82)
    summary_routes[name] = {"file": os.path.basename(f), "picture": "routes/" + name + ".webp"}
    print("traced", os.path.basename(f))
Image.fromarray(ov, "RGBA").save(os.path.join(out, "routes_continents.png"), optimize=True)

# ---- world sea lanes (map part only; the legend below it is skipped)
f = sorted(glob.glob(os.path.join(trade, "trade_routes_world_v*.png")))
if f:
    f = f[-1]; a = np.asarray(Image.open(f).convert("RGB")).astype(np.int16)
    mapa = a[:1560]
    ow = np.zeros((OH, OW, 4), np.uint8)
    m = colour_mask(mapa, (168, 12, 84), 50, 20) & ~legend_boxes(mapa)
    splat(ow, m, 0, 160, 1.5, (230, 40, 140), grow=1)
    Image.fromarray(ow, "RGBA").save(os.path.join(out, "routes_world.png"), optimize=True)
    pic = Image.open(f).convert("RGB"); pic.thumbnail((2400, 2400))
    pic.save(os.path.join(out, "routes", "world.webp"), quality=82)
    summary_routes["world"] = {"file": os.path.basename(f), "picture": "routes/world.webp"}
    print("traced", os.path.basename(f))

# ---- world data needed for cities
elev = np.asarray(Image.open(sorted(glob.glob(os.path.join(maps, "world_elevation_data_v*.png")))[-1]))
cont = np.asarray(Image.open(sorted(glob.glob(os.path.join(maps, "world_continent_data_v*.png")))[-1]))
natn = np.asarray(Image.open(sorted(glob.glob(os.path.join(maps, "world_nations_data_v*.png")))[-1]))
H, W = elev.shape

# ---- capitals from the data pack: "### Continent" then a table | # | Nation | Capital | City # |
capitals, cur = {}, None
for line in open(pack, encoding="utf-8"):
    mh = re.match(r"###\s+(\w+)", line)
    if mh and mh.group(1) in CONT: cur = CONT.index(mh.group(1)); continue
    mr = re.match(r"\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|", line)
    if cur and mr:
        num = mr.group(4).strip()
        capitals[cur * 100 + int(mr.group(1))] = {"capital": mr.group(3).strip(), "city": int(num) if num.isdigit() else None}

# ---- cities v7
cities = []
with open(cities_csv, newline="", encoding="utf-8-sig") as fh:
    rows = list(csv.reader(fh)); head = [c.lower() for c in rows[0]]
    ci = next(i for i, c in enumerate(head) if c.startswith("continent")); ni = next(i for i, c in enumerate(head) if "city" in c)
    la = next(i for i, c in enumerate(head) if c.startswith("lat")); lo = next(i for i, c in enumerate(head) if c.startswith("lon"))
    si = next((i for i, c in enumerate(head) if "source" in c), None)
    for r in rows[1:]:
        if not r or not r[la].strip(): continue
        lat, lon = float(r[la]), float(r[lo]) % 360
        y = min(H - 1, int((90 - lat) / 180 * H)); x = min(W - 1, int(lon / 360 * W))
        g = int(cont[y, x]) * 100 + int(natn[y, x]) if elev[y, x] and cont[y, x] and natn[y, x] else 0
        cities.append({"continent": r[ci], "n": int(r[ni]), "lat": lat, "lon": round(lon, 4), "source": r[si] if si is not None else "",
                       "nation": g, "h": int(elev[y, x]) - 1000 if elev[y, x] else None})

# ---- update world.json
wj = os.path.join(out, "world.json")
world = json.load(open(wj))
maps_by = {}
for p in glob.glob(os.path.join(nat_dir, "*.png")):
    m = re.match(r"(\w+?)_(\d+)_", os.path.basename(p))
    if m and m.group(1) in CONT: maps_by[CONT.index(m.group(1)) * 100 + int(m.group(2))] = p
problems = []
for n in world["nations"]:
    g = n["gid"]; c = capitals.get(g)
    if c:
        n["capital"] = c["capital"]; n["capital_city"] = c["city"]
        if c["city"] is not None:
            city = next((x for x in cities if x["continent"] == CONT[n["c"]] and x["n"] == c["city"]), None)
            if city is None: problems.append(f"{n['name']}: capital city {c['city']} not in the city list")
            else:
                city["capital_of"] = g
                if city["nation"] != g: problems.append(f"{n['name']}: capital (city {c['city']}) lies in {city['nation'] or 'the sea'}")
    if g in maps_by:
        pic = Image.open(maps_by[g]).convert("RGB"); pic.thumbnail((1000, 1000))
        pic.save(os.path.join(out, "nations", f"{g}.webp"), quality=82); n["map"] = f"nations/{g}.webp"
for n in world["nations"]: n["cities"] = sum(1 for c in cities if c["nation"] == n["gid"])
world["cities"] = cities
world["summary"]["files"]["cities"] = os.path.basename(cities_csv)
world["summary"]["routes"] = summary_routes
world["summary"]["capital_checks"] = problems
json.dump(world, open(wj, "w"), separators=(",", ":"))
print(len(cities), "cities;", sum(1 for n in world["nations"] if n.get("map")), "nation maps;",
      sum(1 for n in world["nations"] if n.get("capital")), "capitals")
print("capital checks:", *problems, sep="\n  ")
