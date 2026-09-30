// Converts the hand-drawn map (reference/Naropa_and_Nalanda_Map.html) into
// lat/lon geometry for the globe: src/atlas/sketch-data.json.
//
//   node scripts/import-sketch.mjs [path/to/map.html]
//
// How the sketch maps to the planet (taken from the map's own script):
// - Shapes are drawn in a frame rotated -40.5° about (560, 1261). After that
//   rotation the equator is the horizontal line y = 1261.
// - Latitude is linear: (1261 - 689.3) / 83 units per degree, from AA's tip at
//   83°N.
// - Longitude uses the same units per degree measured horizontally from
//   x = 560 (plate carrée). The sketch only fixes the north-south scale, so
//   this is an assumption.
//
// The data blocks are parsed as JSON / with regexes; nothing in the file is
// executed.

import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2] || 'reference/Naropa_and_Nalanda_Map.html';
const out = 'src/atlas/sketch-data.json';
const html = readFileSync(src, 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function block(name) {
  const start = js.indexOf(`const ${name}=`);
  if (start < 0) throw new Error(`"${name}" not found in ${src}`);
  const from = start + `const ${name}=`.length;
  return js.slice(from, js.indexOf(';\n', from));
}

// ---------- Projection ----------
const R = Number(/const R=(-?[\d.]+)/.exec(js)[1]);
const CX = Number(/CX=([\d.]+)/.exec(js)[1]);
const CY = Number(/CY=([\d.]+)/.exec(js)[1]);
const PER = (Number(/per=\(([\d.]+)-/.exec(js)[1]) - Number(/per=\([\d.]+-([\d.]+)\)/.exec(js)[1])) /
  Number(/per=\([\d.]+-[\d.]+\)\/(\d+)/.exec(js)[1]);
const EQ_Y = Number(/eqY=([\d.]+)/.exec(js)[1]);
const rad = (R * Math.PI) / 180;

function toLatLon([x, y]) {
  const dx = x - CX, dy = y - CY;
  const X = CX + dx * Math.cos(rad) - dy * Math.sin(rad);
  const Y = CY + dx * Math.sin(rad) + dy * Math.cos(rad);
  return [+((EQ_Y - Y) / PER).toFixed(3), +((X - CX) / PER).toFixed(3)];
}

// ---------- Path helpers ----------
const num = (s) => s.trim().split(/[\s,]+/).map(Number);

// "M x,y L x,y ... Z" (possibly several subpaths) -> list of rings.
function polygonRings(d) {
  return d.split('M').filter((s) => s.trim()).map((sub) => {
    const n = num(sub.replace(/[LZ]/g, ' '));
    const ring = [];
    for (let i = 0; i + 1 < n.length; i += 2) ring.push(toLatLon([n[i], n[i + 1]]));
    return ring;
  });
}

// "M x,y C x1,y1 x2,y2 x,y ..." -> sampled polyline.
function bezierLine(d, steps = 8) {
  const n = num(d.replace(/[MC]/g, ' '));
  let p0 = [n[0], n[1]];
  const pts = [toLatLon(p0)];
  for (let i = 2; i + 5 < n.length; i += 6) {
    const c1 = [n[i], n[i + 1]], c2 = [n[i + 2], n[i + 3]], p1 = [n[i + 4], n[i + 5]];
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0];
      const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1];
      pts.push(toLatLon([x, y]));
    }
    p0 = p1;
  }
  return pts;
}

// Same closed Catmull-Rom smoothing the map uses for coastlines, sampled.
function smoothRing(p, steps = 10) {
  const ring = [];
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, u = 1 - t;
      ring.push(toLatLon([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]));
    }
  }
  return ring;
}

// ---------- Extract ----------
const coasts = {};
for (const [, key, list] of block('coasts').matchAll(/(\w+):"([^"]+)"/g)) {
  const pts = list.trim().split(/\s+/).map((p) => p.split(',').map(Number));
  coasts[key] = smoothRing(pts);
}

const founding = {};
for (const [, code, name, fill] of block('founding').matchAll(/(F\d):\{name:"([^"]*)",fill:"(#[0-9A-Fa-f]{6})"/g)) {
  founding[code] = { name, color: fill };
}

const modernStyle = {};
for (const [, code, fill, fx, fy, mx, my] of block('modern').matchAll(
  /(\w+):\["(#[0-9A-Fa-f]{6})",\[([\d.]+),([\d.]+)\],\[([\d.]+),([\d.]+)\]/g,
)) {
  modernStyle[code] = { color: fill, label: toLatLon([+mx, +my]), foundingLabel: toLatLon([+fx, +fy]) };
}

const foundingLabels = {};
for (const [, code, x, y] of block('founding').matchAll(/(F\d):\{[^}]*label:\[([\d.]+),([\d.]+)\]/g)) {
  foundingLabels[code] = toLatLon([+x, +y]);
}
for (const code of Object.keys(founding)) founding[code].label = foundingLabels[code];

const names = {};
for (const [, code, name] of block('NAMES').matchAll(/(\w+):"([^"]+)"/g)) names[code] = name;

const geo = JSON.parse(block('geo'));
const nations = {};
for (const [rawCode, o] of Object.entries(geo.modern)) {
  // The sketch calls Nalu's island shape "BAi"; the tracker code is BA.
  const code = rawCode === 'BAi' ? 'BA' : rawCode;
  nations[code] = {
    name: names[rawCode],
    founding: o.f,
    color: modernStyle[rawCode].color,
    label: modernStyle[rawCode].label,
    rings: polygonRings(o.d),
  };
}

const terrain = [];
for (const [type, list] of Object.entries(JSON.parse(block('terrain')))) {
  for (const d of list) terrain.push({ type, rings: polygonRings(d) });
}

const rivers = [];
for (const [kind, list] of Object.entries(JSON.parse(block('rivers')))) {
  for (const d of list) rivers.push({ kind, points: bezierLine(d) });
}

// Coast keys A/B/BA are the continents and Nalu; i1-i3 are Moiran's islands.
const data = {
  source: 'reference/Naropa_and_Nalanda_Map.html',
  projection: { rotationDeg: R, center: [CX, CY], equatorY: EQ_Y, unitsPerDegree: +PER.toFixed(4), longitude: 'plate carrée from x = center' },
  coasts: Object.values(coasts),
  founding,
  nations,
  terrain,
  rivers,
};
writeFileSync(out, JSON.stringify(data));

const all = [...data.coasts.flat()];
const lats = all.map((p) => p[0]), lons = all.map((p) => p[1]);
console.log(`wrote ${out}`);
console.log(`  ${data.coasts.length} coasts, ${Object.keys(nations).length} nations, ${terrain.length} terrain polygons (${new Set(terrain.map((t) => t.type)).size} types), ${rivers.length} rivers`);
console.log(`  land spans lat ${Math.min(...lats).toFixed(1)}..${Math.max(...lats).toFixed(1)}, lon ${Math.min(...lons).toFixed(1)}..${Math.max(...lons).toFixed(1)}`);
