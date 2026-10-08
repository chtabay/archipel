// L’extension du chemin : l’accord, et les réglages. Rien n’est lu tant qu’on n’a pas dit oui ici ; dire non arrête tout.
const ext = globalThis.browser ?? globalThis.chrome;
const $ = s => document.querySelector(s), dit = t => { $('#dit').textContent = t; };
const EXCLUS = ['chtabay.github.io', 'impots.gouv.fr', 'ameli.fr', 'doctolib.fr', 'service-public.fr']; // d’office : l’archipel, les impôts, la santé
const RECHERCHES = ['google.com', 'bing.com', 'duckduckgo.com', 'qwant.com']; // le moteur lui-même (www. compris), pas ses sous-domaines : mail.google.com n’en est pas un
const ENCART = RECHERCHES; // d’office, le chemin au coin de la page sur les moteurs de recherche
const lignes = t => [...new Set(t.split('\n').map(l => l.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/:].*$/, '')).filter(Boolean))];
const acces = () => ext.permissions.contains({ origins: ['<all_urls>'] }).catch(() => true);

// la version, et des comptes sans un mot : pour dire où on en est, à l’essai
async function etat() {
  try {
    const db = await new Promise((ok, ko) => { const q = indexedDB.open('chemin'); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
    const compte = nom => (db.objectStoreNames.contains(nom) ? new Promise(ok => { const q = db.transaction(nom).objectStore(nom).getAll(); q.onsuccess = () => ok(q.result); q.onerror = () => ok([]); }) : Promise.resolve([]));
    const pages = await compte('pages'), tuiles = await compte('tuiles'); db.close();
    const glanes = pages.reduce((n, p) => n + (p.blocs || []).filter(b => b.source === 'glane').length, 0);
    const place = await navigator.storage?.estimate?.().then(e => e.usage ? ` · ${(e.usage / 1048576).toFixed(0)} Mo` : '').catch(() => '') || '';
    $('#etat').textContent = `Version ${ext.runtime.getManifest().version} · ${pages.length} jour${pages.length > 1 ? 's' : ''} · ${glanes} écrit${glanes > 1 ? 's' : ''} glané${glanes > 1 ? 's' : ''} · ${tuiles.length} tuile${tuiles.length > 1 ? 's' : ''} peinte${tuiles.length > 1 ? 's' : ''}${place}`;
  } catch { $('#etat').textContent = `Version ${ext.runtime.getManifest().version}`; }
}
async function montrer({ champs = true } = {}) {
  etat();
  const r = await ext.storage.local.get(['accord', 'pause', 'exclus', 'recherches', 'encart']);
  $('#reglages').hidden = r.accord !== true;
  $('#pause').checked = r.pause === true;
  if (champs) { $('#exclus').value = (Array.isArray(r.exclus) ? r.exclus : EXCLUS).join('\n'); $('#recherches').value = (Array.isArray(r.recherches) ? r.recherches : RECHERCHES).join('\n'); $('#encart').value = (Array.isArray(r.encart) ? r.encart : ENCART).join('\n'); }
  $('#sites').hidden = r.accord !== true || await acces();
  if (r.accord === true) dit(r.pause ? 'En pause : rien n’est lu.' : 'C’est noté : ce que tu écris fait pousser le chemin.');
}
async function demanderAcces() { try { return await ext.permissions.request({ origins: ['<all_urls>'] }); } catch { return true; } } // sans invite si l’accès est déjà là
$('#oui').addEventListener('click', async () => {
  if (!(await demanderAcces())) { dit('Sans l’accès aux sites, rien ne peut être lu.'); return; }
  const r = await ext.storage.local.get(['exclus', 'recherches', 'encart']);
  await ext.storage.local.set({ accord: true, pause: false, exclus: Array.isArray(r.exclus) ? r.exclus : EXCLUS, recherches: Array.isArray(r.recherches) ? r.recherches : RECHERCHES, encart: Array.isArray(r.encart) ? r.encart : ENCART });
  montrer();
});
$('#acces').addEventListener('click', async () => { await demanderAcces(); montrer({ champs: false }); });
$('#non').addEventListener('click', async () => { await ext.storage.local.set({ accord: false }); montrer(); dit('C’est noté : rien n’est lu.'); });
$('#pause').addEventListener('change', async e => { await ext.storage.local.set({ pause: e.target.checked }); montrer({ champs: false }); });
$('#garder').addEventListener('click', async () => { await ext.storage.local.set({ exclus: lignes($('#exclus').value), recherches: lignes($('#recherches').value), encart: lignes($('#encart').value) }); montrer(); dit('Les réglages sont gardés.'); });
$('#effacer').addEventListener('click', async () => {
  if (!confirm('Tout effacer, pour de bon : le chemin de ce navigateur, ses pages, ses tuiles, et les réglages ?')) return;
  await ext.storage.local.clear();
  dit('Le carnet s’efface…');
  await new Promise(ok => { const q = indexedDB.deleteDatabase('chemin'); q.onsuccess = q.onerror = () => ok(); q.onblocked = () => dit('Un onglet du chemin tient le carnet : ferme-le, l’effacement suivra.'); });
  montrer(); dit('Tout est effacé.');
});
montrer();
