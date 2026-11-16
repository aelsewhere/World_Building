"""Render single-nation maps for one continent from the world data layers.
Usage: python3 -I tools/make_nation_map.py <ContinentName> <outdir> [nation# ...]
Currently only Kamon's grid box is configured."""
import sys, csv, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from skimage.morphology import skeletonize

Image.MAX_IMAGE_PIXELS = None
M = '/mnt/user-data/uploads/Story/maps/'
# code, x0, y0, w, h on the 1/24 deg world grid; legend rect (y0,y1,x0,x1) to ignore; hub label; label side; caravan routes?
BOX = {'Kamon': dict(code=4, x0=3840, y0=1116, w=1932, h=2154, scale=1.0, legend=(740, 960, 245, 700), wmap='Kamon_nations_water_map_v3.png',
                    hubs=[('Kangpaix hub', 'right')], caravan=False),
       'Mesomara': dict(code=3, x0=2148, y0=1032, w=1884, h=2124, scale=1.0, legend=(1185, 1470, 60, 705), wmap='Mesomara_nations_water_map_v3.png',
                        hubs=[('Delta port', 'left')], caravan=True),
       'Elmiyaro': dict(code=5, x0=5310, y0=1140, w=1350, h=1800, scale=4 / 3, legend=(1985, 2245, 40, 490), wmap='Elmiyaro_nations_water_map_v4.png',
                        hubs=[('Upper cataracts town (new)', 'left'), ('Cataracts town (new)', 'right'), ('Delta port', 'left')], caravan=False),
       'Hoakamotu': dict(code=6, x0=6528, y0=570, w=2112, h=2898, scale=1.0, legend=(740, 985, 40, 545), wmap='Hoakamotu_nations_water_map_v3.png',
                         hubs=[('Tuakahi hub', 'right'), ('Matavasa hub', 'right')], caravan=False),
       'Morasil': dict(code=1, x0=0, y0=840, w=1560, h=2760, scale=1.0, legend=(1640, 1935, 5, 600), wmap='Morasil_nations_water_map_v3.png',
                       hubs=[(None, 'right'), ('Great market', 'right'), ('10\u00b0N gap', 'above'), (None, 'right'), ('Secondary market', 'right'), ('Delta port', 'right')],
                       caravan=False, crossing=True),
       'Solua': dict(code=2, x0=1410, y0=1830, w=1380, h=1440, scale=4 / 3, legend=(500, 830, 40, 500), wmap='Solua_nations_water_map_v3.png',
                     hubs=[('Delta port', 'right'), ('Strait hub', 'right'), (None, 'right'), (None, 'right'), ('Delta port', 'right')],
                     caravan=False, luxury=True)}
cont, outdir = sys.argv[1], sys.argv[2]
only = [int(a) for a in sys.argv[3:]]
B = BOX[cont]; CODE, X0, Y0, W, H = B['code'], B['x0'], B['y0'], B['w'], B['h']; SC = B['scale']; LEG = B['legend']; CARAVAN = B['caravan']
os.makedirs(outdir, exist_ok=True)

def crop(name):
    return np.array(Image.open(M + name).crop((X0, Y0, X0 + W, Y0 + H)))

nat = crop('world_nations_data_v1.png').astype(int)
con = crop('world_continent_data_v1.png').astype(int)
water = crop('world_water_data_v1.png').astype(int)
gid = np.where(nat > 0, con * 100 + nat, 0)

names = {}
for r in csv.DictReader(open(M + 'world_nations_index_v1.csv')):
    names[int(r['Global ID (continent*100 + #)'])] = r['Name']

# fill colours: most common colour of each nation in the approved nations map
nm = np.array(Image.open(M + B['wmap']).convert('RGB').resize((W, H), Image.NEAREST)).astype(np.int64)
nmk = (nm[..., 0] << 16) | (nm[..., 1] << 8) | nm[..., 2]
fill = {}
for cid in np.unique(gid):
    if cid // 100 != CODE:
        continue
    k = nmk[gid == cid]
    c = np.bincount(k).argmax()
    fill[int(cid)] = ((c >> 16) & 255, (c >> 8) & 255, c & 255)

# routes from the final trade-route map (colours read from its legend)
import cv2
T = np.array(Image.open(M + 'trade_routes_%s_%s.png' % (cont, {'Hoakamotu': 'v2', 'Morasil': 'v3'}.get(cont, 'v1'))).convert('RGB')).astype(int)
TH, TW = T.shape[:2]
def near(rgb, tol=40):
    return np.abs(T - np.array(rgb)).sum(2) < tol
legend = np.zeros((TH, TW), bool); legend[LEG[0]:LEG[1], LEG[2]:LEG[3]] = True
def to_world(m):
    if SC == 1.0:
        return m
    return cv2.resize(m.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.3
routes = {'river': to_world(near((25, 70, 170)) & ~legend),
          'land': to_world(near((190, 30, 30)) & ~legend),
          'sea': to_world(near((20, 110, 120)) & ~legend)}
if CARAVAN:
    routes['caravan'] = to_world(near((175, 110, 30), 30) & ~legend)
if B.get('luxury'):
    routes['luxury'] = to_world(near((150, 60, 170), 30) & ~legend)
if B.get('crossing'):
    routes['crossing'] = to_world(near((120, 120, 120), 30) & ~legend)
hm = (near((255, 200, 0), 30)).astype(np.uint8)
nh, _, hst, hcen = cv2.connectedComponentsWithStats(hm)
hubs_xy = sorted([(hcen[i][1] / SC, hcen[i][0] / SC) for i in range(1, nh) if hst[i, 4] > 200])   # (y, x) sorted top to bottom
hubs = [(x, y, nm_, side, (255, 200, 0), (60, 40, 0)) for (y, x), (nm_, side) in zip(hubs_xy, B['hubs'])]
if B.get('luxury'):
    pm = near((190, 120, 230), 30).astype(np.uint8)
    pn, _, pst, pcen = cv2.connectedComponentsWithStats(pm)
    for i in range(1, pn):
        if pst[i, 4] > 200:
            hubs.append((pcen[i][0] / SC, pcen[i][1] / SC, 'Crocevia (luxury hub)', 'right', (190, 120, 230), (60, 20, 80)))
skel = {k: skeletonize(v) for k, v in routes.items()}

cities = []
for r in csv.DictReader(open(M + 'cities_v7.csv')):
    if r['Continent'] == cont:
        cities.append((float(r['Longitude (deg east of map seam)']) * 24 - X0 - 0.5,
                       (90 - float(r['Latitude'])) * 24 - Y0 - 0.5))

OCEAN = (208, 230, 244); OTHER = (226, 226, 226); RIVER = (70, 140, 215)
ROUTE = {'river': (25, 70, 170), 'land': (190, 30, 30), 'sea': (20, 110, 120), 'caravan': (175, 110, 30), 'crossing': (120, 120, 120), 'luxury': (150, 60, 170)}
F = lambda s, b=False: ImageFont.truetype(
    '/usr/share/fonts/truetype/google-fonts/Poppins-%s.ttf' % ('Bold' if b else 'Regular'), s)

def up_label_masks(lab, ids, s, blur):
    h, w = lab.shape
    stack = []
    for i in ids:
        m = Image.fromarray(((lab == i) * 255).astype(np.uint8)).resize((int(w * s), int(h * s)), Image.NEAREST)
        stack.append(np.array(m.filter(ImageFilter.GaussianBlur(blur))))
    return np.array(stack).argmax(0)

def render(cid):
    ys, xs = np.where(gid == cid)
    mg = 80
    x0, x1 = max(0, xs.min() - mg), min(W, xs.max() + mg + 1)
    y0, y1 = max(0, ys.min() - mg), min(H, ys.max() + mg + 1)
    w, h = x1 - x0, y1 - y0
    s = float(np.clip(1500 / max(w, h), 1.6, 9))
    ow, oh = int(w * s), int(h * s)
    g = gid[y0:y1, x0:x1]
    ids = [int(i) for i in np.unique(g)]
    lab = ids_arr = up_label_masks(g, ids, s, s * 0.7)
    ids_np = np.array(ids)
    L = ids_np[lab]                                   # label id per output pixel
    img = np.zeros((oh, ow, 3), np.uint8); img[:] = OCEAN
    sel = L == cid
    for i in ids:
        if i == 0:
            continue
        m = L == i
        if i == cid:
            c = fill[i]
        elif i // 100 == CODE:
            c = tuple(int(255 - (255 - v) * 0.45) for v in fill[i])   # faint neighbour
        else:
            c = OTHER
        img[m] = c
    land = L > 0
    # lakes and rivers
    lk = Image.fromarray((((water[y0:y1, x0:x1] & 16) > 0) * 255).astype(np.uint8)).resize((ow, oh), Image.NEAREST)
    lk = np.array(lk.filter(ImageFilter.GaussianBlur(s * 0.5))) > 110
    rv = Image.fromarray((((water[y0:y1, x0:x1] & 1) > 0) * 255).astype(np.uint8)).resize((ow, oh), Image.NEAREST)
    rv = np.array(rv.filter(ImageFilter.GaussianBlur(s * 0.45))) > 60
    wm = (lk | rv) & land
    fade = ~sel & (L // 100 == CODE)
    for m, a in ((wm & sel, 1.0), (wm & ~sel, 0.35)):
        img[m] = (np.array(RIVER) * a + img[m] * (1 - a)).astype(np.uint8)
    # borders and coasts
    def edge(a, b):
        e = np.zeros((oh, ow), bool)
        e[:, :-1] |= a[:, :-1] != a[:, 1:]; e[:-1, :] |= a[:-1, :] != a[1:, :]
        return e
    e_all = edge(L, L)
    near_sel = np.array(Image.fromarray((sel * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    thick = lambda m, k: np.array(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(k))) > 0
    faint = thick(e_all & ~near_sel, 3)
    strong = thick(e_all & near_sel, 5)
    img[faint] = (150, 150, 150)
    img[strong] = (40, 40, 40)
    im = Image.fromarray(img); d = ImageDraw.Draw(im, 'RGBA')
    # routes (skeleton -> clean lines)
    rr = max(3, int(min(s, 9) * 0.7) + 2)
    for kind in [k for k in ('sea', 'caravan', 'crossing', 'luxury', 'river', 'land') if k in skel]:
        sk = skel[kind][y0:y1, x0:x1]
        pys, pxs = np.where(sk)
        pts = set(zip(pys.tolist(), pxs.tolist()))
        for (py, px) in pts:
            for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
                if (py + dy, px + dx) in pts:
                    ax, ay = (px + .5) * s, (py + .5) * s
                    bx, by = (px + dx + .5) * s, (py + dy + .5) * s
                    cy, cx = min(oh - 1, int(ay)), min(ow - 1, int(ax))
                    a = 90 if (L[cy, cx] != cid and L[cy, cx] > 0) else 255
                    d.line([ax, ay, bx, by], fill=ROUTE[kind] + (a,), width=rr * 2 if kind not in ('sea', 'caravan', 'crossing', 'luxury') else rr + 1)
    # cities
    for cx, cy in cities:
        if x0 <= cx < x1 and y0 <= cy < y1:
            ox, oy = (cx - x0 + .5) * s, (cy - y0 + .5) * s
            mine = L[min(oh - 1, int(oy)), min(ow - 1, int(ox))] == cid
            r = 8; a = 255 if mine else 110
            d.ellipse([ox - r, oy - r, ox + r, oy + r], fill=(225, 30, 60, a), outline=(255, 255, 255, a), width=3)
    # hub markers (yellow pentagons on the trade-route map)
    for hx0, hy0, hname, hside, hfill, htxt in hubs:
        if x0 <= hx0 < x1 and y0 <= hy0 < y1:
            hx, hy = (hx0 - x0 + .5) * s, (hy0 - y0 + .5) * s
            R = 20
            pts = [(hx + R * np.sin(2 * np.pi * k / 5), hy - R * np.cos(2 * np.pi * k / 5)) for k in range(5)]
            d.polygon(pts, fill=hfill, outline=htxt)
            if hname is None:
                pass
            elif hside == 'above':
                d.text((hx, hy - R - 6), hname, font=F(28, True), fill=htxt, anchor='mb')
            elif hside == 'right':
                d.text((hx + R + 8, hy), hname, font=F(28, True), fill=htxt, anchor='lm')
            else:
                d.text((hx - R - 8, hy), hname, font=F(28, True), fill=htxt, anchor='rm')
    # neighbour names
    for i in ids:
        if i != cid and i // 100 == CODE and (L == i).sum() > 4000:
            yy, xx = np.where(L == i)
            d.text((xx.mean(), yy.mean()), names[i], font=F(26), fill=(110, 110, 110, 200), anchor='mm')
    # title and legend
    d.rounded_rectangle([14, 14, 14 + 520, 112], 10, fill=(255, 255, 255, 225))
    d.text((30, 22), names[cid], font=F(44, True), fill=(30, 30, 30))
    d.text((32, 76), '%s  -  nation %d' % (cont, cid % 100), font=F(22), fill=(90, 90, 90))
    ni = 5 + (1 if CARAVAN else 0) + (1 if B.get('crossing') else 0) + (1 if B.get('luxury') else 0); lh = 40; ly = oh - 14 - lh * ni - 16
    items_w = 0
    items = [('River route', 'river'), ('Land route', 'land')] + ([('Caravan route', 'caravan')] if CARAVAN else []) + [('Sea lane / strait crossing' if B.get('luxury') else 'Sea lane', 'sea')] + ([('Long crossing (south islands)', 'crossing')] if B.get('crossing') else []) + ([('Luxury sea lane', 'luxury')] if B.get('luxury') else []) + [ ('City', 'city'), ('Neighbouring nations', 'nb')]
    lw = int(max(d.textlength(t, font=F(22)) for t, _ in items)) + 122 + 24
    d.rounded_rectangle([14, ly, 14 + max(330, lw), oh - 14], 10, fill=(255, 255, 255, 225))
    for n, (t, k) in enumerate(items):
        yy = ly + 22 + n * lh
        if k in ROUTE:
            if k in ('sea', 'caravan', 'crossing', 'luxury'):
                for q in range(5):
                    d.line([34 + q * 14, yy, 34 + q * 14 + (8 if k in ('sea', 'crossing', 'luxury') else 11), yy], fill=ROUTE[k], width=5)
            else:
                d.line([34, yy, 104, yy], fill=ROUTE[k], width=9)
        elif k == 'city':
            d.ellipse([60, yy - 8, 76, yy + 8], fill=(225, 30, 60), outline='white', width=3)
        else:
            d.rectangle([34, yy - 8, 104, yy + 8], fill=(235, 235, 235), outline=(150, 150, 150))
        d.text((122, yy), t, font=F(22), fill=(40, 40, 40), anchor='lm')
    return im

for cid in sorted(fill):
    if only and cid % 100 not in only:
        continue
    im = render(cid)
    fn = '%s_%02d_%s.png' % (cont, cid % 100, names[cid].replace(' ', '_'))
    im.save(os.path.join(outdir, fn), optimize=True)
    print(fn, im.size, flush=True)
