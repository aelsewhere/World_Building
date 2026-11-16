"""Put the Euelia map data the city planner needs into Euelia_city_planner.html.

The planner uses it to add water, rivers, through-roads and railways to a place as a first estimate.

Usage (from nations/euelia):
    python3 tools/bake_planner_map.py PATH/TO/maps [roads.geojson] [towns.csv] [planner.html]

PATH/TO/maps holds world_elevation_data_v#.png and world_water_data_v#.png (the highest version is used).
Defaults: the highest Euelia_roads_v#.geojson and Euelia_towns_v#.csv here, and Euelia_city_planner.html.
Needs numpy and Pillow.

What is written (one line, `const MAP=...;`, replacing the old one):
  g   [longitude of the left edge, latitude of the top edge, columns, rows, cells per degree]
  w   the water grid (sea, or a lake cell), one bit per cell, row by row, base64
  t   town number -> [latitude, longitude]
  rv  rivers: [wide?, start touches water?, end touches water?, lon, lat, lon, lat, ...]
  rd  roads and railways near the towns: [class, lon, lat, lon, lat, ...]
  src the files it was made from
Longitude is degrees east of the map seam throughout.
"""
import sys, os, re, csv, glob, json, base64
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
CELLS = 24               # world grid cells per degree
MARGIN = 1.0             # degrees kept round the towns
NEAR_KM = 20             # roads are kept this close to a town
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def latest(pattern):
    f = glob.glob(pattern)
    if not f:
        sys.exit('No file matches ' + pattern)
    return max(f, key=lambda p: int(re.search(r'_v(\d+)\.', p).group(1)))


def thin(m):
    """Zhang-Suen thinning: wide rivers down to a line one cell wide."""
    m = np.pad(m, 1).astype(np.uint8)
    while True:
        changed = False
        for step in (0, 1):
            p2, p3, p4, p5 = m[:-2, 1:-1], m[:-2, 2:], m[1:-1, 2:], m[2:, 2:]
            p6, p7, p8, p9 = m[2:, 1:-1], m[2:, :-2], m[1:-1, :-2], m[:-2, :-2]
            n = [p2, p3, p4, p5, p6, p7, p8, p9]
            b = sum(x.astype(np.int16) for x in n)
            a = sum(((n[i] == 0) & (n[(i + 1) % 8] == 1)).astype(np.int16) for i in range(8))
            if step == 0:
                c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                c = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            kill = (m[1:-1, 1:-1] == 1) & (b >= 2) & (b <= 6) & (a == 1) & c
            if kill.any():
                m[1:-1, 1:-1][kill] = 0
                changed = True
        if not changed:
            return m[1:-1, 1:-1].astype(bool)


def trace(sk):
    """Follow the thinned river cells into lines that run from one end or fork to the next."""
    cells = set(zip(*np.nonzero(sk)))
    def nbrs(c):
        r, q = c
        out = [(r + dr, q + dq) for dr, dq in ((0, 1), (1, 0), (0, -1), (-1, 0)) if (r + dr, q + dq) in cells]
        for dr, dq in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
            d = (r + dr, q + dq)
            if d in cells and (r + dr, q) not in cells and (r, q + dq) not in cells:   # no diagonal where a square step exists
                out.append(d)
        return out
    adj = {c: nbrs(c) for c in cells}
    nodes = {c for c in cells if len(adj[c]) != 2}
    lines, seen = [], set()
    for s in nodes:
        for nx in adj[s]:
            if (s, nx) in seen:
                continue
            line, prev, cur = [s, nx], s, nx
            seen.add((s, nx))
            while cur not in nodes:
                a, b = adj[cur]
                prev, cur = cur, (b if a == prev else a)
                line.append(cur)
            seen.add((cur, prev))
            lines.append(line)
    loose = cells - nodes - {c for l in lines for c in l}                              # closed rings with no fork
    while loose:
        s = loose.pop(); line, prev, cur = [s], s, adj[s][0]
        while cur != s:
            line.append(cur); loose.discard(cur)
            a, b = adj[cur]; prev, cur = cur, (b if a == prev else a)
        line.append(s); lines.append(line)
    return lines


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    maps = a[0]
    roads_f = a[1] if len(a) > 1 else latest(os.path.join(here, 'Euelia_roads_v*.geojson'))
    towns_f = a[2] if len(a) > 2 else latest(os.path.join(here, 'Euelia_towns_v*.csv'))
    html_f = a[3] if len(a) > 3 else os.path.join(here, 'Euelia_city_planner.html')
    elev_f = latest(os.path.join(maps, 'world_elevation_data_v*.png'))
    water_f = latest(os.path.join(maps, 'world_water_data_v*.png'))

    towns = {}
    with open(towns_f, newline='', encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            towns[int(r['Town #'])] = [float(r['Latitude']), float(r['Longitude (deg east of map seam)'])]
    lats = [t[0] for t in towns.values()]; lons = [t[1] for t in towns.values()]
    c0 = int((min(lons) - MARGIN) * CELLS); c1 = int((max(lons) + MARGIN) * CELLS) + 1
    r0 = int((90 - max(lats) - MARGIN) * CELLS); r1 = int((90 - min(lats) + MARGIN) * CELLS) + 1
    elev = np.asarray(Image.open(elev_f))[r0:r1, c0:c1]
    wat = np.asarray(Image.open(water_f))[r0:r1, c0:c1]
    water = (elev == 0) | ((wat & 16) > 0)                 # sea, or a lake cell
    river = ((wat & 1) > 0) & ~water
    rows, cols = water.shape
    lon_of = lambda c: round((c0 + c + .5) / CELLS, 4)
    lat_of = lambda r: round(90 - (r0 + r + .5) / CELLS, 4)

    # rivers: thin, follow, and note which are wide and which ends reach the sea or a lake
    pad = np.pad(river, 1)
    thick = sum(pad[1 + dr:1 + dr + rows, 1 + dq:1 + dq + cols].astype(np.int16) for dr in (-1, 0, 1) for dq in (-1, 0, 1))
    wpad = np.pad(water, 3)                                # thinning shortens a wide river's end, so look 3 cells round it
    by_water = sum(wpad[3 + dr:3 + dr + rows, 3 + dq:3 + dq + cols].astype(np.int16) for dr in range(-3, 4) for dq in range(-3, 4)) > 0
    rv = []
    for line in trace(thin(river)):
        if len(line) < 2:
            continue
        wide = int(np.median([thick[c] for c in line]) >= 6)
        flat = [wide, int(by_water[line[0]]), int(by_water[line[-1]])]
        for r, c in line:
            flat += [lon_of(c), lat_of(r)]
        rv.append(flat)

    # roads and railways: only the parts near a town
    tl = np.array(list(towns.values()))
    def near_town(lon, lat):
        k = np.cos(np.radians(lat))
        return bool((np.hypot((tl[:, 0] - lat) * 111.19, (tl[:, 1] - lon) * 111.19 * k) < NEAR_KM).any())
    rd, classes = [], {}
    for f in json.load(open(roads_f, encoding='utf-8'))['features']:
        g = f.get('geometry') or {}
        if g.get('type') != 'LineString':
            continue
        cls = (f.get('properties') or {}).get('class', 'side')
        pts = g['coordinates']; keep = [near_town(p[0], p[1]) for p in pts]
        i = 0
        while i < len(pts):
            if not keep[i]:
                i += 1; continue
            j = i
            while j + 1 < len(pts) and keep[j + 1]:
                j += 1
            run = pts[max(0, i - 1):min(len(pts), j + 2)]
            if len(run) > 1:
                rd.append([cls] + [round(v, 5) for p in run for v in p[:2]])
                classes[cls] = classes.get(cls, 0) + 1
            i = j + 1

    data = {'g': [round(c0 / CELLS, 6), round(90 - r0 / CELLS, 6), cols, rows, CELLS],
            'w': base64.b64encode(np.packbits(water, axis=None).tobytes()).decode(),
            't': {str(n): t for n, t in sorted(towns.items())},
            'rv': rv, 'rd': rd,
            'src': {'roads': os.path.basename(roads_f), 'towns': os.path.basename(towns_f),
                    'elevation': os.path.basename(elev_f), 'water': os.path.basename(water_f)}}
    line = 'const MAP=' + json.dumps(data, separators=(',', ':')) + ';'
    html = open(html_f, encoding='utf-8').read()
    if re.search(r'^const MAP=.*;$', html, flags=re.M):
        html = re.sub(r'^const MAP=.*;$', lambda m: line, html, count=1, flags=re.M)
    else:
        m = re.search(r'^const PLACES=.*;$', html, flags=re.M)
        if not m:
            sys.exit('Could not find where the place data sits in ' + html_f)
        html = html[:m.end()] + '\n' + line + html[m.end():]
    open(html_f, 'w', encoding='utf-8').write(html)
    print('Grid %d x %d cells, %.0f%% water. Rivers: %d lines (%d wide). Road pieces near towns: %s. Map data: %d KB.'
          % (cols, rows, 100 * water.mean(), len(rv), sum(r[0] for r in rv), classes, len(line) // 1024))


if __name__ == '__main__':
    main()
