// Lat/lon helpers shared by the world generators and the renderer.
// Convention: +y is the north pole, longitude 0 faces +z, east is +x.

const DEG = Math.PI / 180;

export function latLonToVec(lat, lon) {
  const phi = lat * DEG;
  const lam = lon * DEG;
  const c = Math.cos(phi);
  return [c * Math.sin(lam), Math.sin(phi), c * Math.cos(lam)];
}

export function vecToLatLon(x, y, z) {
  const len = Math.hypot(x, y, z);
  return {
    lat: Math.asin(y / len) / DEG,
    lon: Math.atan2(x, z) / DEG,
  };
}

// Great-circle angle between two unit vectors, in degrees.
export function angleDeg(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, d))) / DEG;
}

export function formatLatLon(lat, lon) {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}
