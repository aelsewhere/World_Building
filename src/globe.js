// Builds Three.js meshes for a generated world.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { latLonToVec } from './geo.js';

// How far land rises above the ocean surface, as a fraction of the radius per
// metre. Exaggerated (~20x) so relief reads at globe scale.
export const HEIGHT_SCALE = 0.035 / 8000;

export function surfaceRadius(heightM) {
  return 1 + Math.max(0, heightM) * HEIGHT_SCALE;
}

// Samples the world at every vertex of an icosphere. Returns the displaced
// geometry plus per-vertex data so the map view can be recoloured without
// regenerating.
export function buildTerrain(world, detail) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);

  const pos = geo.attributes.position;
  const terrainColors = new Float32Array(pos.count * 3);
  const nationIndex = new Int16Array(pos.count);
  const foundingIndex = new Int8Array(pos.count);
  const dirs = new Float32Array(pos.count * 3); // unit direction of each vertex
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    dirs[i * 3] = v.x; dirs[i * 3 + 1] = v.y; dirs[i * 3 + 2] = v.z;
    const s = world.sample(v.x, v.y, v.z);

    // Ocean stays a smooth sphere; land is displaced outward.
    const r = surfaceRadius(s.height);
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    terrainColors.set(s.color, i * 3);
    nationIndex[i] = s.nationIndex;
    foundingIndex[i] = s.foundingIndex;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(terrainColors.slice(), 3));
  geo.computeVertexNormals();
  return { geometry: geo, terrainColors, nationIndex, foundingIndex, dirs };
}

// Re-samples only the vertices within `radiusDeg` of any of `centers`
// (unit vectors), for live painting. Normals are left to the caller
// (recomputing them for the whole mesh is the slow part).
export function updateTerrainRegion(terrain, world, centers, radiusDeg) {
  const { geometry, dirs, terrainColors } = terrain;
  const pos = geometry.attributes.position;
  const col = geometry.attributes.color;
  const cosR = Math.cos(THREE.MathUtils.degToRad(radiusDeg));
  let changed = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = dirs[i * 3], y = dirs[i * 3 + 1], z = dirs[i * 3 + 2];
    let near = false;
    for (const c of centers) {
      if (x * c[0] + y * c[1] + z * c[2] > cosR) { near = true; break; }
    }
    if (!near) continue;
    const s = world.sample(x, y, z);
    const r = surfaceRadius(s.height);
    pos.setXYZ(i, x * r, y * r, z * r);
    terrainColors.set(s.color, i * 3);
    col.setXYZ(i, s.color[0], s.color[1], s.color[2]);
    changed++;
  }
  if (changed) {
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
  return changed;
}

// view: 'terrain' | 'nations' | 'founding'. Political views keep a little of
// the terrain colour so relief and ice still read through.
export function applyView(terrain, world, view) {
  const out = terrain.geometry.attributes.color;
  const { terrainColors, nationIndex, foundingIndex } = terrain;
  for (let i = 0; i < out.count; i++) {
    let r = terrainColors[i * 3], g = terrainColors[i * 3 + 1], b = terrainColors[i * 3 + 2];
    let c = null;
    if (view === 'nations' && nationIndex[i] >= 0) c = world.nations[nationIndex[i]].color;
    if (view === 'founding' && foundingIndex[i] >= 0) c = world.founding[foundingIndex[i]].color;
    if (c) {
      r = c[0] * 0.8 + r * 0.2;
      g = c[1] * 0.8 + g * 0.2;
      b = c[2] * 0.8 + b * 0.2;
    }
    out.setXYZ(i, r, g, b);
  }
  out.needsUpdate = true;
}

export function createTerrainMesh(geometry) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    flatShading: false,
  });
  return new THREE.Mesh(geometry, material);
}

// Soft glow around the limb of the planet.
export function createAtmosphere() {
  const material = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0.35, 0.6, 1.0) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vView));
        float intensity = pow(rim, 3.0);
        gl_FragColor = vec4(glowColor, intensity * 0.9);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.12, 64, 64), material);
}

// Latitude/longitude lines every 30 degrees.
export function createGraticule(radius = 1.04) {
  const points = [];
  const step = Math.PI / 6;
  const seg = 128;
  const toVec = (lat, lon) =>
    new THREE.Vector3(
      radius * Math.cos(lat) * Math.sin(lon),
      radius * Math.sin(lat),
      radius * Math.cos(lat) * Math.cos(lon),
    );
  for (let lat = -Math.PI / 2 + step; lat < Math.PI / 2 - 1e-6; lat += step) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const b = ((i + 1) / seg) * Math.PI * 2;
      points.push(toVec(lat, a), toVec(lat, b));
    }
  }
  for (let lon = 0; lon < Math.PI * 2 - 1e-6; lon += step) {
    for (let i = 0; i < seg; i++) {
      const a = -Math.PI / 2 + (i / seg) * Math.PI;
      const b = -Math.PI / 2 + ((i + 1) / seg) * Math.PI;
      points.push(toVec(a, lon), toVec(b, lon));
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
  return new THREE.LineSegments(geo, mat);
}

export function createStarfield(count = 4000, seedRandom = Math.random) {
  const positions = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(seedRandom() * 2 - 1, seedRandom() * 2 - 1, seedRandom() * 2 - 1).normalize().multiplyScalar(40 + seedRandom() * 20);
    positions.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

// Rivers as fat lines draped over the terrain. Each polyline is densified
// along great circles so it follows the curve of the planet.
export function createRivers(world, resolution) {
  const group = new THREE.Group();
  const materials = {
    major: new LineMaterial({ color: 0x3f8fe0, linewidth: 2.6, resolution }),
    minor: new LineMaterial({ color: 0x3f8fe0, linewidth: 1.6, resolution }),
  };
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (const river of world.rivers) {
    // Densify along great circles, then keep only the stretches over land:
    // with natural coastlines the shore can sit a little off the drawn river.
    const pts = [];
    for (let i = 0; i < river.points.length - 1; i++) {
      a.fromArray(latLonToVec(...river.points[i]));
      b.fromArray(latLonToVec(...river.points[i + 1]));
      const steps = Math.max(1, Math.ceil(a.angleTo(b) / THREE.MathUtils.degToRad(0.2)));
      for (let k = 0; k < steps; k++) pts.push(p.copy(a).lerp(b, k / steps).normalize().clone());
    }
    pts.push(new THREE.Vector3(...latLonToVec(...river.points.at(-1))));

    let run = [];
    const flush = () => {
      if (run.length >= 6) {
        const geo = new LineGeometry();
        geo.setPositions(run);
        const line = new Line2(geo, materials[river.kind] || materials.major);
        line.userData.river = river;
        group.add(line);
      }
      run = [];
    };
    for (const q of pts) {
      const s = world.sample(q.x, q.y, q.z);
      if (s.nationIndex < 0) { flush(); continue; }
      const r = surfaceRadius(s.height) + 0.0015;
      run.push(q.x * r, q.y * r, q.z * r);
    }
    flush();
  }
  group.userData.materials = Object.values(materials);
  return group;
}

// A distinct equator line, since several tracker notes are relative to it.
export function createEquator(radius = 1.002) {
  const points = [];
  for (let i = 0; i <= 256; i++) {
    const lon = (i / 256) * 360;
    points.push(new THREE.Vector3(...latLonToVec(0, lon)).multiplyScalar(radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd35a, transparent: true, opacity: 0.55 }));
}

// HTML labels, at each region's `label` [lat, lon] when it has one, otherwise
// at the centre of its land. `ids` is the per-vertex region index array from
// buildTerrain.
export function createLabels(geometry, ids, regions, className) {
  const pos = geometry.attributes.position;
  const sums = regions.map(() => new THREE.Vector3());
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    if (ids[i] < 0) continue;
    sums[ids[i]].add(v.fromBufferAttribute(pos, i).normalize());
  }
  const group = new THREE.Group();
  regions.forEach((region, idx) => {
    if (region.label) sums[idx].fromArray(latLonToVec(...region.label));
    if (sums[idx].lengthSq() === 0) return;
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = region.code && !region.code.startsWith('F')
      ? `${region.name}<span>${region.code}</span>`
      : region.name;
    const obj = new CSS2DObject(el);
    obj.position.copy(sums[idx].normalize().multiplyScalar(1.05));
    group.add(obj);
  });
  return group;
}
