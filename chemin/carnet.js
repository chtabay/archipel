// Le chemin : le carnet. Les pages du journal, les tuiles déjà peintes et la lecture des passages, gardées dans le stockage de
// ce téléphone (IndexedDB), qui accepte de longs textes. Rien ne part. Sans IndexedDB, comme dans certaines fenêtres privées, les pages
// vont dans le petit stockage du navigateur, et les tuiles se repeignent à chaque visite.

const NOM = 'chemin', VERSION = 2, VIEUX = 'chemin:pages';
let base = null;
const attendre = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const fini = t => new Promise((ok, ko) => { t.oncomplete = () => ok(); t.onerror = t.onabort = () => ko(t.error); });
function ouvrir() {
  base ??= new Promise((ok, ko) => {
    if (!globalThis.indexedDB) { ko(new Error('sans IndexedDB')); return; }
    const r = indexedDB.open(NOM, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'date' });
      for (const nom of ['tuiles', 'lectures']) if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, { keyPath: 'cle' }).createIndex('vu', 'vu');
    };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ok(r.result); };
    r.onerror = () => ko(r.error); r.onblocked = () => ko(new Error('carnet bloqué'));
  }).catch(e => { console.info('carnet :', e.message); return null; });
  return base;
}
const magasin = async (nom, mode = 'readonly') => { const db = await ouvrir(); if (!db) return null; const t = db.transaction(nom, mode); return { t, s: t.objectStore(nom) }; };

/* ───────── Les pages ───────── */

// une page : sa date, son texte, et ses blocs s’il y en a, écrits à des heures différentes ; leur texte bout à bout est celui de la page
const valide = p => p && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && typeof p.texte === 'string';
const enBlocs = b => (Array.isArray(b) && b.length && b.every(x => typeof x?.texte === 'string') ? b.map(x => ({ heure: typeof x.heure === 'string' ? x.heure : '', texte: x.texte })) : null);
const propre = p => { const blocs = enBlocs(p.blocs); return blocs ? { date: p.date, texte: p.texte, blocs } : { date: p.date, texte: p.texte }; };
const ancien = () => { try { const p = JSON.parse(localStorage.getItem(VIEUX) || '[]'); return Array.isArray(p) ? p.filter(valide) : []; } catch { return []; } };
export async function lirePages() {
  const m = await magasin('pages');
  const pages = m ? (await attendre(m.s.getAll())).filter(valide) : ancien();
  return pages.map(propre).sort((a, b) => a.date.localeCompare(b.date));
}
// garde une page ; rend vrai si elle est bien gardée
export async function garderPage(page) {
  const p = propre(page), m = await magasin('pages', 'readwrite');
  if (m) { m.s.put(p); await fini(m.t); return true; }
  try { const x = ancien().filter(y => y.date !== p.date); x.push(p); localStorage.setItem(VIEUX, JSON.stringify(x)); return true; } catch { return false; } // plein : la page reste à l’écran
}
// efface la page d’un jour, quand son dernier bloc s’en va
export async function effacerPage(date) {
  const m = await magasin('pages', 'readwrite');
  if (m) { m.s.delete(date); await fini(m.t); return true; }
  try { localStorage.setItem(VIEUX, JSON.stringify(ancien().filter(y => y.date !== date))); return true; } catch { return false; }
}
// une fois, après la première page : demander au navigateur de ne pas effacer le carnet quand la place manque
export function proteger() { try { navigator.storage?.persisted?.().then(oui => oui || navigator.storage.persist()).catch(() => {}); } catch { /* sans effet */ } }

/* ───────── Les tuiles peintes ───────── */

export async function tuile(cle) {
  const m = await magasin('tuiles', 'readwrite'); if (!m) return null;
  const x = await attendre(m.s.get(cle)).catch(() => null);
  if (!x?.image) return null;
  if (Date.now() - x.vu > 864e5) m.s.put({ ...x, vu: Date.now() }); // vue aujourd’hui : on la garde encore
  return x.image;
}
export async function garderTuile(cle, image) {
  const m = await magasin('tuiles', 'readwrite'); if (!m) return;
  m.s.put({ cle, image, vu: Date.now() });
  await fini(m.t).catch(() => {}); // plein : elle sera repeinte
}

/* ───────── La lecture des passages : un long texte se rouvre sans tout relire ───────── */

export async function lectures(cles) {
  const m = await magasin('lectures'), out = new Map(); if (!m) return out;
  await Promise.all(cles.map(cle => attendre(m.s.get(cle)).then(x => { if (x) out.set(cle, x.valeur); }).catch(() => {})));
  return out;
}
export async function garderLectures(liste) { // [[clé, valeur]]
  if (!liste.length) return;
  const m = await magasin('lectures', 'readwrite'); if (!m) return;
  const vu = Date.now(); for (const [cle, valeur] of liste) m.s.put({ cle, valeur, vu });
  await fini(m.t).catch(() => {}); // plein : elles seront refaites
}

// oublier ce qui ne sert plus, tuiles ou lectures : ni vu depuis un mois, ni dans le chemin d’aujourd’hui
export async function elaguer(nom, gardees, { jours = 30, max = 3000 } = {}) {
  const m = await magasin(nom, 'readwrite'); if (!m) return 0;
  const limite = Date.now() - jours * 864e5;
  let n = 0, reste = await attendre(m.s.count());
  await new Promise(ok => {
    const c = m.s.index('vu').openCursor(); // les plus anciennes d’abord
    c.onsuccess = () => {
      const x = c.result; if (!x) { ok(); return; }
      if (!gardees.has(x.primaryKey) && (x.key < limite || reste > max)) { x.delete(); n++; }
      reste--; x.continue();
    };
    c.onerror = () => ok();
  });
  await fini(m.t).catch(() => {});
  return n;
}
