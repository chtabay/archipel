// Le chemin : le service worker. Il garde les fichiers de l’app, pour qu’elle s’ouvre même sans réseau, et les objets déjà
// vus, qui ne changent pas. Jamais les pages du journal : elles restent dans le stockage du téléphone, avec les tuiles peintes.
// Il ne touche qu’à ses propres caches, ceux qui commencent par « chemin- » : l’archipel, sur le même site, garde les siens.
// Après un changement de ce fichier, on change CACHE ; après un changement des objets, OBJETS.
const CACHE = 'chemin-1', OBJETS = 'chemin-objets-1';
const ICI = new URL('./', self.location).href, SITE = new URL('../', ICI).href; // l’app, et le site qui l’héberge
const EMPRUNTS = ['aquarelle.js', 'outils.js', 'contenu.js', 'fonts/'].map(f => new URL(f, SITE).href); // ce que le chemin prend à l’archipel
const notre = u => u.startsWith(ICI) || EMPRUNTS.some(e => u.startsWith(e));
const objet = u => u.startsWith(new URL('objets/', ICI).href);
const SANS = { ignoreVary: true };

self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('chemin-') && k !== CACHE && k !== OBJETS) await caches.delete(k); // seulement nos anciens caches
  await self.clients.claim();
})()));

// La page dit ce qu’elle a chargé : on le garde, avec la page elle-même, et on oublie les versions d’avant
self.addEventListener('message', e => {
  if (e.data?.type === 'garder' && Array.isArray(e.data.urls)) e.waitUntil(garder(e.data.urls));
});
async function garder(urls) {
  const c = await caches.open(CACHE), voulues = new Set([ICI, ...urls.filter(u => typeof u === 'string' && notre(u) && !objet(u)).map(u => u.split('#')[0])]);
  for (const u of voulues) if (!(await c.match(u, SANS))) { try { const r = await fetch(u); if (r.ok && !r.redirected) await c.put(u, r); } catch { /* sans réseau : ce sera pour la prochaine fois */ } }
  for (const r of await c.keys()) if (!voulues.has(r.url)) await c.delete(r);
}

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || !notre(r.url)) return;
  if (r.mode === 'navigate') { if (u.pathname === new URL(ICI).pathname || u.pathname === new URL('index.html', ICI).pathname) e.respondWith(page(r)); return; }
  e.respondWith(objet(r.url) ? garde(r, OBJETS) : u.searchParams.has('v') ? garde(r, CACHE) : fichier(r));
});

async function page(r) { // la page : le réseau d’abord, pour la dernière version ; lent ou absent, celle qu’on a gardée
  const c = await caches.open(CACHE), gardee = await c.match(ICI, SANS);
  const reseau = fetch(r).then(n => { if (n.ok && !n.redirected) { c.put(ICI, n.clone()); return n; } return gardee || n; });
  if (!gardee) return reseau;
  const tard = reseau.catch(() => gardee);
  return Promise.race([tard, new Promise(ok => setTimeout(() => ok(gardee), 4000))]);
}
async function garde(r, nom) { // un fichier qui ne change pas, numéroté ou objet : gardé, il sert tel quel
  const c = await caches.open(nom), m = await c.match(r, SANS);
  if (m) return m;
  const n = await fetch(r);
  if (n.ok) await c.put(r, n.clone()).catch(() => {}); // plein : il reviendra du réseau
  return n;
}
async function fichier(r) { // les autres : le réseau d’abord, puis ce qu’on a gardé
  try { return await fetch(r); } catch (e) { const m = await caches.match(r, SANS); if (m) return m; throw e; }
}
