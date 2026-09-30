// Builds Three.js meshes for a generated world.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// How far land rises above the ocean surface, as a fraction of the radius.
// Exaggerated so relief reads at globe scale.
const HEIGHT_SCALE = 0.035;

export function buildTerrainGeometry(world, detail) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const { elevation, biome } = world.sample(v.x, v.y, v.z);

    // Ocean stays a smooth sphere; land is displaced outward.
    const r = 1 + Math.max(0, elevation) * HEIGHT_SCALE;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);

    // Slight brightness variation by elevation so flat biomes aren't uniform.
    const [cr, cg, cb] = biome.color;
    const shade = elevation >= 0 ? 0.9 + elevation * 0.3 : 1 + elevation * 0.25;
    colors[i * 3] = cr * shade;
    colors[i * 3 + 1] = cg * shade;
    colors[i * 3 + 2] = cb * shade;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
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
