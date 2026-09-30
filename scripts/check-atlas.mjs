// Sanity checks for the hand-authored atlas:
// - every river point lies on land
// - every terrain seed lies inside the nation that lists it
//
//   node scripts/check-atlas.mjs

import * as atlas from '../src/atlas/naropa-nalanda.js';
import { createAtlasWorld } from '../src/atlas/atlas-world.js';
import { latLonToVec } from '../src/geo.js';

const world = createAtlasWorld(atlas);
let problems = 0;

for (const river of atlas.RIVERS) {
  const pts = river.points;
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 10; k++) {
      const t = k / 10;
      const lat = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
      const lon = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
      const s = world.sample(...latLonToVec(lat, lon));
      // The last segment may reach the sea at its mouth.
      if (s.nationIndex < 0 && !(i === pts.length - 2 && k > 5)) {
        console.log(`river "${river.name}": ocean at ${lat.toFixed(1)}, ${lon.toFixed(1)} (segment ${i})`);
        problems++;
        break;
      }
    }
  }
}

for (const n of atlas.NATIONS) {
  for (const [lat, lon, terrain] of n.terrain) {
    const s = world.sample(...latLonToVec(lat, lon));
    const owner = s.nationIndex >= 0 ? world.nations[s.nationIndex].code : 'ocean';
    if (owner !== n.code) {
      console.log(`${n.code} terrain seed ${terrain} at ${lat}, ${lon} lies in ${owner}`);
      problems++;
    }
  }
}

console.log(problems ? `${problems} problem(s)` : 'atlas OK');
process.exitCode = problems ? 1 : 0;
