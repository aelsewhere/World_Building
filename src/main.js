import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createWorld, DEFAULT_SETTINGS } from './world.js';
import { createSketchWorld } from './atlas/sketch-world.js';
import sketchData from './atlas/sketch-data.json';
import draftLands from './atlas/draft-lands.json';
import {
  buildTerrain,
  applyView,
  createTerrainMesh,
  createAtmosphere,
  createGraticule,
  createStarfield,
  createRivers,
  createEquator,
  createLabels,
} from './globe.js';
import { mulberry32 } from './noise.js';
import { latLonToVec, formatLatLon } from './geo.js';

// ---------- Scene ----------
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.className = 'labels';
container.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 200);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.2;
controls.maxDistance = 8;
controls.enablePan = false;
controls.rotateSpeed = 0.5;

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
scene.add(sun);
// The sun follows the camera (from its upper left) so the side you're looking
// at is always lit.
camera.add(sun);
sun.position.set(-3, 2, 1);
scene.add(camera);

// North stays up: continent A (Naropa) sits above continent B (Nalanda).
const planet = new THREE.Group();
scene.add(planet);

scene.add(createAtmosphere());
const graticule = createGraticule();
planet.add(graticule);
const equator = createEquator();
planet.add(equator);
scene.add(createStarfield(4000, mulberry32(7)));

// Far enough back that the whole globe fits, including on portrait phones.
function fitDistance() {
  const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  return Math.max(3.3, 1.12 / Math.sin(Math.min(vHalf, hHalf)));
}

function lookAtLatLon(lat, lon, distance) {
  const [x, y, z] = latLonToVec(lat, lon);
  camera.position.set(x, y, z).multiplyScalar(distance);
  controls.update();
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = {
  worldSelect: $('world'),
  view: $('view'),
  gap: $('gap'),
  south: $('south'),
  turn: $('turn'),
  turnValue: $('turn-value'),
  southValue: $('south-value'),
  natural: $('natural'),
  draft: $('draft'),
  naturalValue: $('natural-value'),
  gapValue: $('gap-value'),
  gapKm: $('gap-km'),
  randomControls: $('random-controls'),
  atlasControls: $('atlas-controls'),
  seed: $('seed'),
  randomSeed: $('random-seed'),
  seaLevel: $('sea-level'),
  continentScale: $('continent-scale'),
  mountains: $('mountains'),
  detail: $('detail'),
  generate: $('generate'),
  rotate: $('rotate'),
  grid: $('grid'),
  labels: $('labels'),
  rivers: $('rivers'),
  status: $('status'),
  info: $('info'),
  legend: $('legend'),
  legendTitle: $('legend-title'),
  legendItems: $('legend-items'),
  panel: $('panel'),
  togglePanel: $('toggle-panel'),
};

let world = null;
let terrain = null;
let terrainMesh = null;
let rivers = null;
let nationLabels = null;
let foundingLabels = null;

function readHash() {
  return new URLSearchParams(location.hash.slice(1));
}

function writeHash() {
  const params = new URLSearchParams();
  if (ui.worldSelect.value === 'random') params.set('seed', ui.seed.value.trim() || DEFAULT_SETTINGS.seed);
  else params.set('world', ui.worldSelect.value);
  if (ui.view.value !== 'terrain') params.set('view', ui.view.value);
  if (ui.worldSelect.value !== 'random') {
    params.set('shift', ui.gap.value);
    if (ui.south.value !== '0') params.set('south', ui.south.value);
    if (ui.turn.value !== '0') params.set('turn', ui.turn.value);
    params.set('natural', ui.natural.value);
    if (!ui.draft.checked) params.set('draft', '0');
  }
  // Some embedded viewers refuse URL changes; the page works without them.
  try {
    history.replaceState(null, '', `#${params}`);
  } catch {
    /* ignore */
  }
}

function naropaShift() {
  return parseFloat(ui.gap.value);
}

function naropaSouth() {
  return parseFloat(ui.south.value);
}

// With the draft lands west of Naropa, moving Naropa more than 30° west would
// wrap them around into Nalanda's east coast.
function updateGapLimit() {
  ui.gap.max = ui.draft.checked ? '30' : '40';
  if (parseFloat(ui.gap.value) > parseFloat(ui.gap.max)) ui.gap.value = ui.gap.max;
  updateGapLabel();
}

function updateGapLabel() {
  ui.gapValue.textContent = `${ui.gap.value}° west`;
  ui.southValue.textContent = ui.south.value === '0' ? 'as drawn' : `${ui.south.value}° south`;
  const t = parseFloat(ui.turn.value);
  ui.turnValue.textContent = t === 0 ? 'as drawn' : `${Math.abs(t)}° ${t > 0 ? 'counterclockwise' : 'clockwise'}`;
  const n = parseFloat(ui.natural.value);
  ui.naturalValue.textContent = n === 0 ? 'as drawn' : `${n.toFixed(1)}×`;
}

// Keeps the view centred between the continents as Naropa moves.
function lookAtContinents() {
  lookAtLatLon(8 - naropaSouth() / 2, -8 - naropaShift() / 2, fitDistance());
}

function makeWorld() {
  if (ui.worldSelect.value === 'naropa-nalanda') return createSketchWorld(sketchData, {
      naropaShift: naropaShift(),
      naropaSouth: naropaSouth(),
      nalandaTurn: parseFloat(ui.turn.value),
      natural: parseFloat(ui.natural.value),
      extraLands: ui.draft.checked ? draftLands.lands : [],
    });
  return createWorld({
    seed: ui.seed.value.trim() || DEFAULT_SETTINGS.seed,
    seaLevel: parseFloat(ui.seaLevel.value),
    continentScale: parseFloat(ui.continentScale.value),
    mountainStrength: parseFloat(ui.mountains.value),
  });
}

function disposeGroup(group) {
  if (!group) return;
  group.removeFromParent();
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.element) o.element.remove();
  });
}

function updateModeControls() {
  const atlas = ui.worldSelect.value !== 'random';
  ui.randomControls.hidden = atlas;
  ui.atlasControls.hidden = !atlas;
}

function generate() {
  updateModeControls();
  writeHash();
  ui.status.textContent = 'Generating…';

  // Let the status text paint before the (synchronous) generation work.
  requestAnimationFrame(() =>
    setTimeout(() => {
      const t0 = performance.now();
      world = makeWorld();
      const next = buildTerrain(world, parseInt(ui.detail.value, 10));

      if (terrainMesh) {
        planet.remove(terrainMesh);
        terrainMesh.geometry.dispose();
        terrainMesh.material.dispose();
      }
      disposeGroup(rivers);
      disposeGroup(nationLabels);
      disposeGroup(foundingLabels);
      rivers = nationLabels = foundingLabels = null;

      terrain = next;
      terrainMesh = createTerrainMesh(terrain.geometry);
      planet.add(terrainMesh);

      if (world.rivers.length) {
        rivers = createRivers(world, new THREE.Vector2(window.innerWidth, window.innerHeight));
        planet.add(rivers);
      }
      if (world.nations.length) {
        nationLabels = createLabels(terrain.geometry, terrain.nationIndex, world.nations, 'label');
        foundingLabels = createLabels(terrain.geometry, terrain.foundingIndex, world.founding, 'label founding');
        planet.add(nationLabels, foundingLabels);
      }

      applyCurrentView();
      const ms = Math.round(performance.now() - t0);
      ui.status.textContent = `${terrain.geometry.attributes.position.count.toLocaleString()} vertices · ${ms} ms`;
      const st = world.stats;
      const latText = (v) => `${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}`;
      ui.gapKm.textContent = st?.gapKm
        ? `Closest coasts ≈ ${st.gapKm.toLocaleString()} km (Earth-sized planet). Naropa spans ${latText(st.naropaSouthLat)} to ${latText(st.naropaTipLat)}. Nalu's centre: ${latText(st.naluLat)}.` +
          (st.overlapCells ? ' Warning: Naropa now overlaps Nalanda.' : '')
        : '';
    }, 0),
  );
}

function applyCurrentView() {
  if (!terrain) return;
  const view = world.nations.length ? ui.view.value : 'terrain';
  applyView(terrain, world, view);
  if (rivers) rivers.visible = ui.rivers.checked;
  graticule.visible = ui.grid.checked;
  equator.visible = ui.grid.checked || world.kind === 'atlas';
  renderLegend(view);
  writeHash();
}

function renderLegend(view) {
  const items = view === 'nations' ? world.nations : view === 'founding' ? world.founding : [];
  ui.legend.hidden = items.length === 0;
  ui.legendTitle.textContent = view === 'founding' ? 'Founding nations' : 'Nations';
  ui.legendItems.innerHTML = items
    .map((n) => {
      const [r, g, b] = n.color.map((c) => Math.round(c * 255));
      return `<div><i style="background:rgb(${r},${g},${b})"></i>${n.code} ${n.name}${n.prominent ? ' ★' : ''}</div>`;
    })
    .join('');
}

// ---------- Phone-friendly defaults ----------
const isSmallScreen = window.matchMedia('(max-width: 600px)').matches;
const isTouch = window.matchMedia('(pointer: coarse)').matches;
if (isTouch) ui.detail.value = '96'; // lighter mesh for phones and tablets

function setPanelCollapsed(collapsed) {
  ui.panel.dataset.collapsed = String(collapsed);
  ui.togglePanel.textContent = collapsed ? 'Controls' : 'Hide';
  ui.togglePanel.setAttribute('aria-expanded', String(!collapsed));
  if (!collapsed && isSmallScreen) ui.info.hidden = true; // don't stack on a phone
}
ui.togglePanel.addEventListener('click', () => setPanelCollapsed(ui.panel.dataset.collapsed !== 'true'));
setPanelCollapsed(isSmallScreen);
ui.legend.open = !isSmallScreen;

// Initial state from the URL.
const hash = readHash();
if (hash.get('seed')) {
  ui.worldSelect.value = 'random';
  ui.seed.value = hash.get('seed');
} else {
  ui.seed.value = DEFAULT_SETTINGS.seed;
}
if (hash.get('view')) ui.view.value = hash.get('view');
if (hash.get('shift') !== null) ui.gap.value = hash.get('shift');
if (hash.get('south') !== null) ui.south.value = hash.get('south');
if (hash.get('turn') !== null) ui.turn.value = hash.get('turn');
if (hash.get('natural') !== null) ui.natural.value = hash.get('natural');
if (hash.get('draft') === '0') ui.draft.checked = false;
updateGapLimit();
updateGapLabel();

ui.worldSelect.addEventListener('change', () => {
  generate();
  if (ui.worldSelect.value !== 'random') lookAtContinents();
});
ui.generate.addEventListener('click', generate);
ui.seed.addEventListener('keydown', (e) => e.key === 'Enter' && generate());
ui.randomSeed.addEventListener('click', () => {
  ui.seed.value = Math.random().toString(36).slice(2, 8);
  generate();
});
ui.gap.addEventListener('input', updateGapLabel);
ui.south.addEventListener('input', updateGapLabel);
ui.turn.addEventListener('input', updateGapLabel);
ui.turn.addEventListener('change', generate);
ui.south.addEventListener('change', () => {
  generate();
  lookAtContinents();
});
ui.natural.addEventListener('input', updateGapLabel);
ui.natural.addEventListener('change', generate);
ui.draft.addEventListener('change', () => {
  updateGapLimit();
  generate();
});
ui.gap.addEventListener('change', () => {
  generate();
  lookAtContinents();
});
for (const input of [ui.seaLevel, ui.continentScale, ui.mountains, ui.detail]) {
  input.addEventListener('change', generate);
}
for (const input of [ui.view, ui.grid, ui.rivers, ui.labels]) {
  input.addEventListener('change', applyCurrentView);
}

// ---------- Hover readout ----------
// Raycast against an analytic sphere instead of the dense terrain mesh: cheap,
// and precise enough to look up the world data under the cursor.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const sphere = new THREE.Sphere(new THREE.Vector3(), 1.0);
const hit = new THREE.Vector3();
const local = new THREE.Vector3();

function showInfoAt(clientX, clientY) {
  if (!world) return;
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectSphere(sphere, hit)) {
    ui.info.hidden = true;
    return;
  }
  local.copy(hit);
  planet.worldToLocal(local).normalize();
  const s = world.sample(local.x, local.y, local.z);
  const lines = [];
  if (s.nationIndex >= 0) {
    const n = world.nations[s.nationIndex];
    const f = world.founding[s.foundingIndex];
    if (n.draft) {
      lines.push(`<strong>${n.name}</strong> <span class="muted">(draft, unnamed)</span>`);
    } else {
      lines.push(`<strong>${n.name}</strong> (${n.code})${n.prominent ? ' ★' : ''}`);
      lines.push(`<span class="muted">${world.continents[n.continent].name} · founding: ${f.name} (${f.code})</span>`);
    }
  }
  lines.push(s.nationIndex >= 0 ? s.terrain : `<strong>${s.terrain}</strong>`);
  if (s.coast) lines.push(`Coast: ${s.coast}`);
  lines.push(formatLatLon(s.lat, s.lon));
  lines.push(s.height >= 0 ? `Elevation ${Math.round(s.height).toLocaleString()} m` : `Depth ${Math.round(-s.height).toLocaleString()} m`);
  if (s.temperature !== undefined) {
    lines.push(`Temp ${(s.temperature * 100).toFixed(0)} · Moisture ${(s.moisture * 100).toFixed(0)}`);
  }
  ui.info.hidden = false;
  ui.info.innerHTML = lines.join('<br>');
}

// Mouse: hover. Touch: tap (a touch that doesn't move) shows the readout.
let downAt = null;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') showInfoAt(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse' || !downAt) return;
  if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8) {
    if (isSmallScreen) setPanelCollapsed(true);
    showInfoAt(e.clientX, e.clientY);
  }
  downAt = null;
});
renderer.domElement.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') ui.info.hidden = true;
});

// ---------- Loop ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  rivers?.userData.materials.forEach((m) => m.resolution.set(window.innerWidth, window.innerHeight));
});

const camDir = new THREE.Vector3();
const labelPos = new THREE.Vector3();

// Show only the label set for the current view, and only labels on the side
// of the planet facing the camera.
function updateLabels() {
  const view = ui.view.value;
  const sets = [
    [nationLabels, ui.labels.checked && view !== 'founding'],
    [foundingLabels, ui.labels.checked && view === 'founding'],
  ];
  camDir.copy(camera.position).normalize();
  for (const [group, on] of sets) {
    if (!group) continue;
    for (const label of group.children) {
      label.getWorldPosition(labelPos);
      label.visible = on && labelPos.normalize().dot(camDir) > 0.3;
    }
  }
}

const timer = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = timer.getDelta();
  if (ui.rotate.checked) planet.rotation.y += dt * 0.05;
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

updateModeControls();
lookAtContinents();
generate();
