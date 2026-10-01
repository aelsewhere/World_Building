// Draft landmasses west of Naropa, traced from a screenshot of a rough globe
// sketch (reference/draft-lands-sketch.jpg). Writes src/atlas/draft-lands.json.
//
//   node scripts/trace-draft-lands.mjs
//
// The sketch shows one face of the globe as a disc (centre 466,790, radius
// 374 px in the screenshot), with Naropa's northwest tip as a red sliver on
// its upper-right edge. Reading the disc as a north-up orthographic view and
// lining that sliver up with Naropa's real coast (its 83.4°N tip and its
// westmost coast at 57.7°N) puts the disc's centre at about 40.25°N, 168.5°E,
// in Naropa's drawn (unshifted) frame. The fit is rough: each anchor lands
// within about a third of the disc radius of where it was sketched.
//
// Outlines are hand-traced pixel coordinates, so they're approximate too.
// Coordinates are Naropa-relative: the globe moves these lands with Naropa
// when "Move Naropa west" is used.

import { writeFileSync } from 'node:fs';

const CX = 466, CY = 790, R = 374;
const CENTER = [40.25, -191.5]; // lat, lon (Naropa's drawn frame)
const D = Math.PI / 180;

const SHAPES = [
  {
    code: 'D1', name: 'West landmass',
    px: [[297, 667], [338, 681], [385, 718], [410, 770], [422, 805], [408, 868], [355, 875], [347, 921], [299, 935], [278, 962], [260, 955], [265, 858], [306, 830], [300, 778], [268, 745], [268, 700]],
  },
  {
    code: 'D2', name: 'Central landmass',
    px: [[417, 545], [492, 537], [529, 521], [600, 560], [608, 628], [648, 670], [648, 733], [678, 780], [643, 768], [608, 700], [582, 700], [556, 742], [582, 800], [588, 940], [575, 860], [520, 832], [482, 795], [455, 760], [415, 700]],
  },
  {
    code: 'D3', name: 'Small landmass',
    px: [[478, 870], [520, 860], [548, 885], [546, 940], [527, 950], [500, 915]],
  },
  {
    code: 'D4', name: 'Western long island',
    px: [[428, 937], [458, 950], [458, 1000], [465, 1045], [428, 1075], [398, 1080], [402, 1055], [430, 1030], [425, 990]],
  },
  {
    code: 'D5', name: 'Eastern long island',
    px: [[470, 927], [490, 935], [510, 1020], [510, 1110], [497, 1115], [480, 1060], [467, 975]],
  },
  {
    code: 'D6', name: 'Islet',
    px: Array.from({ length: 16 }, (_, i) => [404 + 9 * Math.cos((i / 16) * 2 * Math.PI), 978 + 14 * Math.sin((i / 16) * 2 * Math.PI)]),
  },
];

// Inverse orthographic projection: disc position -> [lat, lon].
function unproject([px, py]) {
  const x = (px - CX) / R, y = (CY - py) / R;
  const rho = Math.min(0.999, Math.hypot(x, y));
  const c = Math.asin(rho);
  const [lat0, lon0] = [CENTER[0] * D, CENTER[1] * D];
  if (rho === 0) return [CENTER[0], CENTER[1]];
  const lat = Math.asin(Math.cos(c) * Math.sin(lat0) + (y * Math.sin(c) * Math.cos(lat0)) / rho);
  const lon = lon0 + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(lat0) - y * Math.sin(c) * Math.sin(lat0));
  return [+(lat / D).toFixed(3), +(lon / D).toFixed(3)];
}

// Densify edges in screen space first, so straight sketch edges follow the
// globe's curvature once unprojected.
function ring(px) {
  const out = [];
  for (let i = 0; i < px.length; i++) {
    const a = px[i], b = px[(i + 1) % px.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
    for (let k = 0; k < steps; k++) out.push(unproject([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]));
  }
  return out;
}

const lands = SHAPES.map(({ code, name, px }) => {
  const r = ring(px);
  const lat = r.reduce((s, p) => s + p[0], 0) / r.length;
  const lon = r.reduce((s, p) => s + p[1], 0) / r.length;
  return { code, name, rings: [r], label: [+lat.toFixed(2), +lon.toFixed(2)] };
});

writeFileSync('src/atlas/draft-lands.json', JSON.stringify({
  source: 'reference/draft-lands-sketch.jpg',
  note: 'Rough draft traced from a globe sketch; Naropa-relative coordinates (moves with Naropa).',
  center: CENTER,
  lands,
}));
for (const l of lands) {
  const lats = l.rings[0].map((p) => p[0]), lons = l.rings[0].map((p) => p[1]);
  console.log(`${l.code} ${l.name}: lat ${Math.min(...lats).toFixed(1)}..${Math.max(...lats).toFixed(1)}, lon ${Math.min(...lons).toFixed(1)}..${Math.max(...lons).toFixed(1)}`);
}
