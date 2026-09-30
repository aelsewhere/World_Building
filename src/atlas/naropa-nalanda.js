// Naropa & Nalanda: facts from the Nations tracker (Sep 27–30, 2026) that the
// map geometry doesn't carry. Shapes, colours, terrain and rivers come from
// the hand-drawn map via scripts/import-sketch.mjs (src/atlas/sketch-data.json).

export const CONTINENTS = {
  A: { name: 'Naropa' },
  B: { name: 'Nalanda' },
};

// Nation order for legends and lookups.
export const NATION_ORDER = [
  'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG',
  'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL',
];

// Prominent nations per the tracker (BJ: "maybe the least prominent of the four").
export const PROMINENT = new Set(['AF', 'BA', 'BD', 'BJ']);
