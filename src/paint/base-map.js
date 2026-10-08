// A base map for a drawn planet: a terrain type for every 0.25° cell, used
// when a whole map is imported rather than painted stroke by stroke. Saved
// compactly as run-length text: each run is one class letter (A, B, …, or
// ~ for sea) followed by its length in base 36.

export const BASE_RES = 0.25;
const SEA = 255;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function encodeBase(cells, keys) {
  if (keys.length > LETTERS.length) throw new Error('Too many terrain types for a base map.');
  let rle = '';
  let run = cells[0], len = 0;
  const flush = () => { rle += (run === SEA ? '~' : LETTERS[run]) + len.toString(36); };
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === run) { len++; continue; }
    flush();
    run = cells[i];
    len = 1;
  }
  flush();
  return { res: BASE_RES, cols: Math.round(360 / BASE_RES), rows: Math.round(180 / BASE_RES), keys, rle };
}

// Returns { cells: Uint8Array (255 = sea), keys } or throws on a bad map.
export function decodeBase(base) {
  if (!base || base.res !== BASE_RES || typeof base.rle !== 'string' || !Array.isArray(base.keys)) {
    throw new Error('Unrecognised base map.');
  }
  const n = base.cols * base.rows;
  const cells = new Uint8Array(n).fill(SEA);
  let pos = 0;
  const re = /([A-Z~])([0-9a-z]+)/g;
  let m;
  while ((m = re.exec(base.rle)) && pos < n) {
    const cls = m[1] === '~' ? SEA : LETTERS.indexOf(m[1]);
    const len = parseInt(m[2], 36);
    cells.fill(cls, pos, Math.min(n, pos + len));
    pos += len;
  }
  if (pos !== n) throw new Error('Base map is incomplete.');
  return { cells, keys: base.keys };
}
