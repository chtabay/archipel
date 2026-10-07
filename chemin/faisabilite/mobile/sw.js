// Essai de faisabilité, pas une pièce de l’app. Le service worker d’un chemin qui reçoit des textes partagés (Android, Chrome ou
// Samsung Internet, app installée : « Partager » → « Le chemin »). Le partage arrive en POST sur « recevoir » ; on le lit ici,
// on le pose dans le stockage du téléphone, et on renvoie vers la page sans le texte : il n’est ni dans l’adresse, ni dans
// l’historique, ni chez l’hébergeur. Limite connue : si ce service worker n’est pas actif (premier lancement, données effacées),
// le navigateur envoie le POST à l’hébergeur. Voir verifier.js.
const CACHE = 'chemin-essai-partage-1', ICI = new URL('./', self.location).href, RECEVOIR = new URL('recevoir', ICI).href;
const BASE = 'chemin-depots', MAGASIN = 'depots';

self.addEventListener('install', e => e.waitUntil((async () => { const c = await caches.open(CACHE); await c.add(ICI); await self.skipWaiting(); })()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (u.href.split(/[?#]/)[0] === RECEVOIR) { e.respondWith(recevoir(r)); return; } // jamais le réseau, quelle que soit la méthode
  if (r.mode === 'navigate' && u.href.startsWith(ICI)) e.respondWith(page(u)); // la page, sans jamais transmettre ce qui suit « ? »
});

async function recevoir(r) {
  if (r.method === 'POST') {
    const f = await r.formData().catch(() => null);
    const texte = [f?.get('titre'), f?.get('texte'), f?.get('lien')].filter(x => typeof x === 'string' && x.trim()).join('\n').slice(0, 100000);
    if (texte) await deposer(texte);
  }
  return Response.redirect(new URL('./?recu', ICI).href, 303); // l’adresse ne porte que « recu »
}
async function page(u) {
  const c = await caches.open(CACHE), gardee = await c.match(ICI);
  try { const n = await fetch(new URL(u.pathname, u.origin).href); if (n.ok) { c.put(ICI, n.clone()); return n; } return gardee || n; } // sans « ? » ni « # »
  catch (err) { if (gardee) return gardee; throw err; }
}

// Le dépôt : en attente, jusqu’à ce que la personne le relise et le garde dans sa page du jour (ou le jette)
const ouvrir = () => new Promise((ok, ko) => { const q = indexedDB.open(BASE, 1); q.onupgradeneeded = () => q.result.createObjectStore(MAGASIN, { keyPath: 'quand' }); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
async function deposer(texte) {
  const db = await ouvrir();
  await new Promise((ok, ko) => { const t = db.transaction(MAGASIN, 'readwrite'); t.objectStore(MAGASIN).put({ quand: Date.now(), texte, source: 'partage' }); t.oncomplete = ok; t.onerror = () => ko(t.error); });
  db.close();
}
