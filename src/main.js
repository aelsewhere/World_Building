import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createWorld, DEFAULT_SETTINGS } from './world.js';
import {
  buildTerrainGeometry,
  createTerrainMesh,
  createAtmosphere,
  createGraticule,
  createStarfield,
} from './globe.js';
import { mulberry32 } from './noise.js';

// ---------- Scene ----------
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 0.8, 3.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.25;
controls.maxDistance = 8;
controls.enablePan = false;

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.position.set(5, 2, 4);
scene.add(sun);

const planet = new THREE.Group();
planet.rotation.z = THREE.MathUtils.degToRad(-12); // slight axial tilt, for looks
scene.add(planet);

const atmosphere = createAtmosphere();
scene.add(atmosphere);
const graticule = createGraticule();
planet.add(graticule);
scene.add(createStarfield(4000, mulberry32(7)));

// ---------- World state ----------
const ui = {
  seed: document.getElementById('seed'),
  randomSeed: document.getElementById('random-seed'),
  seaLevel: document.getElementById('sea-level'),
  continentScale: document.getElementById('continent-scale'),
  mountains: document.getElementById('mountains'),
  detail: document.getElementById('detail'),
  generate: document.getElementById('generate'),
  rotate: document.getElementById('rotate'),
  grid: document.getElementById('grid'),
  status: document.getElementById('status'),
  info: document.getElementById('info'),
};

let world = null;
let terrain = null;

function readSeedFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  return params.get('seed');
}

function generate() {
  const settings = {
    seed: ui.seed.value.trim() || DEFAULT_SETTINGS.seed,
    seaLevel: parseFloat(ui.seaLevel.value),
    continentScale: parseFloat(ui.continentScale.value),
    mountainStrength: parseFloat(ui.mountains.value),
  };
  history.replaceState(null, '', `#seed=${encodeURIComponent(settings.seed)}`);
  ui.status.textContent = 'Generating…';

  // Let the status text paint before the (synchronous) generation work.
  requestAnimationFrame(() =>
    setTimeout(() => {
      const t0 = performance.now();
      world = createWorld(settings);
      const geometry = buildTerrainGeometry(world, parseInt(ui.detail.value, 10));
      if (terrain) {
        planet.remove(terrain);
        terrain.geometry.dispose();
        terrain.material.dispose();
      }
      terrain = createTerrainMesh(geometry);
      planet.add(terrain);
      const ms = Math.round(performance.now() - t0);
      ui.status.textContent = `${geometry.attributes.position.count.toLocaleString()} vertices · ${ms} ms`;
    }, 0),
  );
}

ui.seed.value = readSeedFromHash() || DEFAULT_SETTINGS.seed;
ui.generate.addEventListener('click', generate);
ui.seed.addEventListener('keydown', (e) => e.key === 'Enter' && generate());
ui.randomSeed.addEventListener('click', () => {
  ui.seed.value = Math.random().toString(36).slice(2, 8);
  generate();
});
for (const input of [ui.seaLevel, ui.continentScale, ui.mountains, ui.detail]) {
  input.addEventListener('change', generate);
}
ui.grid.addEventListener('change', () => (graticule.visible = ui.grid.checked));
graticule.visible = ui.grid.checked;

// ---------- Hover readout ----------
// Raycast against an analytic sphere instead of the dense terrain mesh: cheap,
// and precise enough to look up the world data under the cursor.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const sphere = new THREE.Sphere(new THREE.Vector3(), 1.0);
const hit = new THREE.Vector3();
const local = new THREE.Vector3();

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!world) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectSphere(sphere, hit)) {
    ui.info.hidden = true;
    return;
  }
  local.copy(hit);
  planet.worldToLocal(local).normalize();
  const s = world.sample(local.x, local.y, local.z);
  const lat = THREE.MathUtils.radToDeg(Math.asin(local.y));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(local.x, local.z));
  ui.info.hidden = false;
  ui.info.innerHTML = `
    <strong>${s.biome.name}</strong><br>
    ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}<br>
    Elevation ${(s.elevation * 8000).toFixed(0)} m<br>
    Temp ${(s.temperature * 100).toFixed(0)} · Moisture ${(s.moisture * 100).toFixed(0)}`;
});
renderer.domElement.addEventListener('pointerleave', () => (ui.info.hidden = true));

// ---------- Loop ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (ui.rotate.checked) planet.rotation.y += dt * 0.05;
  controls.update();
  renderer.render(scene, camera);
});

generate();
