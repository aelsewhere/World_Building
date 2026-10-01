import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createWorld, DEFAULT_SETTINGS } from './world.js';
import { createSketchWorld } from './atlas/sketch-world.js';
import sketchData from './atlas/sketch-data.json';
import draftLands from './atlas/draft-lands.json';
import {
  BRUSHES,
  createPaintState,
  createPaintWorld,
  applyStroke,
  strokeDabs,
  replay,
  encodeStrokes,
  decodeStrokes,
} from './paint/paint-world.js';
import { openStore } from './paint/storage.js';
import { renderMapImage, canvasToPng, planetFileText, parsePlanetFile, offerFile } from './paint/export.js';
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
  updateTerrainRegion,
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
  drawBar: $('draw-bar'),
  drawMode: $('draw-mode'),
  brushSize: $('brush-size'),
  brushes: $('brushes'),
  undo: $('undo'),
  clear: $('clear'),
  saveStatus: $('save-status'),
  exportMap: $('export-map'),
  exportGlobe: $('export-globe'),
  exportPlanet: $('export-planet'),
  importPlanet: $('import-planet'),
  importFile: $('import-file'),
  exportStatus: $('export-status'),
  openExport: $('open-export'),
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

// The drawn planet lives in memory across regenerations (e.g. a new mesh
// detail); its strokes are what gets saved.
const paintState = createPaintState();

function isPaintWorld() {
  return ui.worldSelect.value === 'draw';
}

function makeWorld() {
  if (isPaintWorld()) return createPaintWorld(paintState, { natural: 1 });
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
  const v = ui.worldSelect.value;
  ui.randomControls.hidden = v !== 'random';
  ui.atlasControls.hidden = v !== 'naropa-nalanda';
  ui.drawBar.hidden = v !== 'draw';
  $('panel-title').textContent = { draw: 'Blank planet', 'naropa-nalanda': 'Naropa & Nalanda', random: 'Random world' }[v];
  $('labels-toggle').hidden = v !== 'naropa-nalanda';
  ui.exportPlanet.hidden = v !== 'draw';
  ui.importPlanet.hidden = v !== 'draw';
  $('rivers-toggle').hidden = v !== 'naropa-nalanda';
  document.body.classList.toggle('painting', v === 'draw');
  applyDrawingUI();
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
  equator.visible = ui.grid.checked || world.kind === 'atlas' || world.kind === 'paint';
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
if (['draw', 'naropa-nalanda'].includes(hash.get('world'))) ui.worldSelect.value = hash.get('world');
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
  if (ui.worldSelect.value === 'naropa-nalanda') lookAtContinents();
  if (isPaintWorld()) lookAtLatLon(15, 0, fitDistance());
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
  if (e.pointerType === 'mouse' && !drawingActive()) showInfoAt(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = drawingActive() ? null : [e.clientX, e.clientY];
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

// ---------- Drawing ----------
let drawing = true; // Draw vs Move, within the blank-planet world
let brushId = 'land';
let stroke = null; // the stroke in progress
let pendingCenters = []; // dab centres waiting for a mesh update
let pendingRadius = 0;
let lastNormals = 0;
let store = null;
let loaded = false; // never save before the saved planet has loaded

function drawingActive() {
  return isPaintWorld() && drawing && terrain && world?.kind === 'paint';
}

function setDrawing(on) {
  drawing = on;
  applyDrawingUI();
}

function applyDrawingUI() {
  const active = isPaintWorld() && drawing;
  controls.enabled = !active;
  ui.drawMode.setAttribute('aria-pressed', String(active));
  ui.drawMode.textContent = active ? '✏️ Drawing' : '✋ Moving';
  document.body.classList.toggle('moving', isPaintWorld() && !drawing);
}

function brushRadius() {
  return parseFloat(ui.brushSize.value);
}

function renderBrushes() {
  ui.brushes.innerHTML = '';
  for (const b of BRUSHES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(b.id === brushId));
    btn.innerHTML = `<i style="background:${b.swatch}"></i>${b.name}`;
    btn.addEventListener('click', () => {
      brushId = b.id;
      renderBrushes();
      setDrawing(true);
    });
    ui.brushes.appendChild(btn);
  }
}

function updateBrushLabel() {
  ui.brushSize.title = `Brush radius ${brushRadius()}° (about ${Math.round(brushRadius() * 111).toLocaleString()} km)`;
}

// Where on the planet (lat/lon, in the planet's own frame) a screen point is.
function pickLatLon(clientX, clientY) {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectSphere(sphere, hit)) return null;
  local.copy(hit);
  planet.worldToLocal(local).normalize();
  const lat = THREE.MathUtils.radToDeg(Math.asin(local.y));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(local.x, local.z));
  return [lat, lon];
}

function paintDabs(dabs, radius) {
  for (const d of dabs) applyStroke(paintState, { brush: stroke.brush, radius, points: [d] });
  for (const d of dabs) pendingCenters.push(latLonToVec(d[0], d[1]));
  pendingRadius = Math.max(pendingRadius, radius);
}

function angleBetween(a, b) {
  const va = latLonToVec(...a), vb = latLonToVec(...b);
  return THREE.MathUtils.radToDeg(Math.acos(Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!drawingActive() || !e.isPrimary || e.button > 0) return;
  const p = pickLatLon(e.clientX, e.clientY);
  if (!p) return;
  renderer.domElement.setPointerCapture(e.pointerId);
  stroke = { brush: brushId, radius: brushRadius(), points: [p] };
  paintState.strokes.push(stroke);
  paintDabs([p], stroke.radius);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!stroke || !e.isPrimary) return;
  const p = pickLatLon(e.clientX, e.clientY);
  if (!p) return;
  const last = stroke.points[stroke.points.length - 1];
  if (angleBetween(last, p) < Math.max(0.2, stroke.radius * 0.25)) return;
  stroke.points.push(p);
  paintDabs(strokeDabs({ points: [last, p], radius: stroke.radius }).slice(1), stroke.radius);
});

function endStroke() {
  if (!stroke) return;
  stroke = null;
  flushPaint(true);
  scheduleSave();
}
renderer.domElement.addEventListener('pointerup', endStroke);
renderer.domElement.addEventListener('pointercancel', endStroke);

// Apply queued dabs to the mesh: positions/colours now, normals throttled.
function flushPaint(force = false) {
  if (pendingCenters.length && terrain && world?.kind === 'paint') {
    // Margin covers the soft brush edge plus the noise that warps zone edges.
    updateTerrainRegion(terrain, world, pendingCenters, pendingRadius * 1.1 + 1.2);
    pendingCenters = [];
    pendingRadius = 0;
  }
  const now = performance.now();
  if (terrain && (force || now - lastNormals > 500)) {
    terrain.geometry.computeVertexNormals();
    lastNormals = now;
  }
}

function regionUpdate(strokes) {
  for (const s of strokes) {
    pendingCenters.push(...strokeDabs(s).map((d) => latLonToVec(d[0], d[1])));
    pendingRadius = Math.max(pendingRadius, s.radius);
  }
  flushPaint(true);
}

ui.undo.addEventListener('click', () => {
  const last = paintState.strokes.pop();
  if (!last) return;
  replay(paintState);
  regionUpdate([last]);
  scheduleSave();
});

let clearTimer = null;
ui.clear.addEventListener('click', () => {
  if (!clearTimer) {
    // No confirm() dialogs in the embedded viewer: ask with a second tap.
    ui.clear.textContent = 'Tap again to clear';
    ui.clear.classList.add('confirm');
    clearTimer = setTimeout(resetClear, 3000);
    return;
  }
  resetClear();
  const old = paintState.strokes.splice(0);
  replay(paintState);
  regionUpdate(old);
  scheduleSave();
});
function resetClear() {
  clearTimer && clearTimeout(clearTimer);
  clearTimer = null;
  ui.clear.textContent = 'Clear';
  ui.clear.classList.remove('confirm');
}

ui.drawMode.addEventListener('click', () => setDrawing(!drawing));
ui.brushSize.addEventListener('input', updateBrushLabel);

// ---------- Saving ----------
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
let saveTimer = null;
function scheduleSave() {
  if (!loaded || !store) return;
  ui.saveStatus.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const result = await store.save(encodeStrokes(paintState.strokes));
    const where = store.kind === 'cloud' ? 'to your account' : 'in this browser';
    ui.saveStatus.textContent =
      result === 'saved' ? `Saved ${where} · ${plural(paintState.strokes.length, 'stroke')}`
      : result === 'too-big' ? 'Too much drawing to save. Undo or clear some strokes, or use bigger brushes.'
      : "Couldn't save just now; it will try again after your next stroke.";
  }, 1200);
}

async function loadSavedPlanet() {
  ui.saveStatus.textContent = 'Loading your planet…';
  store = await openStore();
  const doc = await store.load();
  const strokes = decodeStrokes(doc?.strokes);
  loaded = true;
  if (strokes.length) {
    paintState.strokes.push(...strokes);
    replay(paintState);
    if (isPaintWorld()) generate();
  }
  ui.saveStatus.textContent = strokes.length
    ? `Loaded ${plural(strokes.length, 'stroke')} (${store.kind === 'cloud' ? 'saved to your account' : 'saved in this browser'})`
    : 'Pick a brush and draw on the globe. Tap ✏️ to switch between drawing and turning the globe.';
}

renderBrushes();
updateBrushLabel();

// ---------- Export ----------
const today = () => new Date().toISOString().slice(0, 10);
const worldSlug = () => ({ draw: 'planet', 'naropa-nalanda': 'naropa-nalanda', random: `random-${ui.seed.value.trim() || 'world'}` })[ui.worldSelect.value];

function reportOffer(result, what) {
  ui.exportStatus.textContent =
    result === 'saved' ? `${what} ready. Check your downloads (or the share sheet on a phone).`
    : result === 'declined' ? `${what} not saved.`
    : `Couldn't save the ${what.toLowerCase()} here.`;
}

ui.exportMap.addEventListener('click', async () => {
  if (!world) return;
  ui.exportMap.disabled = true;
  try {
    const blob = await renderMapImage(world, isTouch ? 1440 : 2048, (f) => {
      ui.exportStatus.textContent = `Drawing the map… ${Math.round(f * 100)}%`;
    });
    reportOffer(await offerFile(`${worldSlug()}-map-${today()}.png`, blob), 'Map image');
  } finally {
    ui.exportMap.disabled = false;
  }
});

ui.exportGlobe.addEventListener('click', async () => {
  renderer.render(scene, camera);
  const blob = await canvasToPng(renderer.domElement);
  reportOffer(await offerFile(`${worldSlug()}-globe-${today()}.png`, blob), 'Globe picture');
});

ui.exportPlanet.addEventListener('click', async () => {
  if (!paintState.strokes.length) {
    ui.exportStatus.textContent = 'Nothing drawn yet.';
    return;
  }
  reportOffer(await offerFile(`planet-${today()}.json`, planetFileText(encodeStrokes(paintState.strokes))), 'Planet file');
});

// Opening a file replaces the current drawing, so ask with a second tap
// when there is something to lose (no confirm() dialogs in the viewer).
let importArmed = null;
ui.importPlanet.addEventListener('click', () => {
  if (paintState.strokes.length && !importArmed) {
    ui.importPlanet.textContent = 'Tap again: replaces your drawing';
    ui.importPlanet.classList.add('confirm');
    importArmed = setTimeout(disarmImport, 4000);
    return;
  }
  disarmImport();
  ui.importFile.click();
});
function disarmImport() {
  importArmed && clearTimeout(importArmed);
  importArmed = null;
  ui.importPlanet.textContent = 'Open planet file…';
  ui.importPlanet.classList.remove('confirm');
}
ui.importFile.addEventListener('change', async () => {
  const file = ui.importFile.files[0];
  ui.importFile.value = '';
  if (!file) return;
  try {
    const strokes = decodeStrokes(parsePlanetFile(await file.text()));
    paintState.strokes.splice(0, paintState.strokes.length, ...strokes);
    replay(paintState);
    if (isPaintWorld()) generate();
    scheduleSave();
    ui.exportStatus.textContent = `Opened ${file.name}: ${strokes.length} strokes.`;
  } catch (e) {
    ui.exportStatus.textContent = `Couldn't open ${file.name}. ${e.message}`;
  }
});

ui.openExport.addEventListener('click', () => {
  setPanelCollapsed(false);
  $('export').scrollIntoView({ block: 'nearest' });
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
  if (ui.rotate.checked && !stroke) planet.rotation.y += dt * 0.05;
  if (pendingCenters.length) flushPaint();
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

updateModeControls();
if (isPaintWorld()) lookAtLatLon(15, 0, fitDistance());
else lookAtContinents();
generate();
loadSavedPlanet();
