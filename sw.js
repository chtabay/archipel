// L’archipel : le service worker. Il garde les fichiers du site, pour que l’app s’ouvre même sans réseau.
// Jamais rien de ce qu’on dépose : ça reste dans le stockage du téléphone. L’archipel partagé passe tel quel.
// Après un changement de ce fichier, on change CACHE : l’ancien cache est effacé.
const CACHE = 'archipel-1';
const ICI = new URL('./', self.location).href; // la racine du site, là où vit l’app
const SANS = { ignoreVary: true }; // un fichier gardé sert quelle que soit la façon dont on le demande

self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// La page dit ce qu’elle a chargé : on le garde, avec la page elle-même, et on oublie les versions d’avant.
self.addEventListener('message', e => {
  if (e.data?.type === 'garder' && Array.isArray(e.data.urls)) e.waitUntil(garder(e.data.urls));
});
async function garder(urls) {
  const c = await caches.open(CACHE), voulues = new Set([ICI, ...urls.filter(u => typeof u === 'string' && u.startsWith(ICI)).map(u => u.split('#')[0])]);
  for (const u of voulues) if (!(await c.match(u, SANS))) { try { const r = await fetch(u); if (r.ok && !r.redirected) await c.put(u, r); } catch { /* sans réseau : ce sera pour la prochaine fois */ } }
  for (const r of await c.keys()) if (!voulues.has(r.url)) await c.delete(r);
}

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || !r.url.startsWith(ICI)) return; // l’archipel partagé, et tout ce qui n’est pas le site
  if (r.mode === 'navigate') { if (u.pathname === new URL(ICI).pathname || u.pathname === new URL('index.html', ICI).pathname) e.respondWith(page(r)); return; }
  e.respondWith(u.searchParams.has('v') ? numerote(r) : fichier(r));
});

async function page(r) { // la page : le réseau d’abord, pour la dernière version ; lent ou absent, celle qu’on a gardée
  const c = await caches.open(CACHE), gardee = await c.match(ICI, SANS);
  const reseau = fetch(r).then(n => { if (n.ok && !n.redirected) { c.put(ICI, n.clone()); return n; } return gardee || n; });
  if (!gardee) return reseau;
  const tard = reseau.catch(() => gardee); // sans réseau : celle qu’on a gardée, même si l’échec arrive après le délai
  return Promise.race([tard, new Promise(ok => setTimeout(() => ok(gardee), 4000))]);
}
async function numerote(r) { // un fichier numéroté, comme app.js?v=12, ne change jamais : gardé, il sert tel quel
  const m = await caches.match(r, SANS);
  if (m) return m;
  const n = await fetch(r);
  if (n.ok) (await caches.open(CACHE)).put(r, n.clone());
  return n;
}
async function fichier(r) { // les autres : le réseau d’abord, puis ce qu’on a gardé
  try { return await fetch(r); } catch (e) { const m = await caches.match(r, SANS); if (m) return m; throw e; }
}
