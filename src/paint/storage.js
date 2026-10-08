// Where the drawn planet is kept.
//
// On the published claude.ai page it's saved to the page's database, in the
// viewer's own private document (data/users/<id>/planet), so it survives
// reloads and devices. Anywhere else (local dev, or if the database isn't
// available) it falls back to this browser's localStorage.

const LOCAL_KEY = 'blank-planet-v1';
const MAX_BYTES = 240 * 1024; // database documents are capped at 256 KiB

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocal(doc) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export async function openStore() {
  let ref = null;
  try {
    const use = window.claude?.use;
    if (use) {
      const [db, user] = await Promise.all([use('db'), use('user')]);
      const uid = db && user ? await user.id() : null;
      if (uid) ref = db.doc(`data/users/${uid}/planet`);
    }
  } catch {
    ref = null;
  }

  let writing = Promise.resolve();
  return {
    kind: ref ? 'cloud' : 'browser',

    // The saved document ({strokes, base?, savedAt}) or null.
    async load() {
      if (ref) {
        try {
          const snap = await ref.get();
          if (snap.exists) return snap.data();
          return null;
        } catch {
          /* fall back to the browser copy */
        }
      }
      return loadLocal();
    },

    // Resolves to 'saved', 'too-big' or 'failed'. Writes are queued so only
    // one is in flight at a time. `base` is an imported base map, or null.
    save(strokes, base = null) {
      const doc = { strokes, savedAt: new Date().toISOString() };
      if (base) doc.base = base;
      const size = JSON.stringify(doc).length;
      if (size > MAX_BYTES) return Promise.resolve('too-big');
      saveLocal(doc);
      if (!ref) return Promise.resolve('saved');
      writing = writing.then(
        () => ref.set(doc).then(() => 'saved', () => 'failed'),
        () => ref.set(doc).then(() => 'saved', () => 'failed'),
      );
      return writing;
    },
  };
}
