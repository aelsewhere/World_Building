# World_Building

An interactive 3D globe of a procedurally generated fictional world, built with
[Three.js](https://threejs.org/) and [Vite](https://vite.dev/).

## Run it

```sh
npm install
npm run dev      # then open the printed http://localhost:5173 URL
```

`npm run build` writes a static site to `dist/`.

## Controls

- **Drag** to orbit and **scroll** to zoom.
- **Hover** the globe to see the biome, coordinates, elevation, temperature and moisture at the cursor.
- **Seed**: the same seed always gives the same world. The seed is kept in the URL (`#seed=...`), so you can share a world by sharing its link.
- **Sea level / Continent size / Mountains** change the generation. **Mesh detail** sets the polygon count.

## How it works

| File | Role |
| --- | --- |
| `src/noise.js` | Seeded 3D simplex noise, fBm and ridged-noise helpers |
| `src/world.js` | Pure world data: elevation, temperature, moisture and biome for any point on the unit sphere |
| `src/globe.js` | Turns world data into Three.js meshes (terrain, atmosphere, lat/long grid, stars) |
| `src/main.js` | Scene setup, UI wiring, hover readout |

Noise is sampled directly on the sphere, so there are no seams or pole pinching.
Elevation is domain-warped continental noise plus detail noise, with ridged
mountains added only inside a separate "range" mask. Temperature comes from
latitude and altitude. Moisture is noise plus rough latitude bands. A simple
Whittaker-style lookup assigns the biome.

## Possible next iterations

- Rivers and lakes that flow downhill from the elevation field
- Named regions and labels (continents, seas, mountain ranges)
- Hand-painted overrides: sculpt or paint terrain and biomes directly
- Tectonic-plate generation in place of pure noise
- Clouds, a day/night terminator, and water shading with specular highlights
- Exporting a flat equirectangular map image
