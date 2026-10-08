// L’extension du chemin : l’accord, et les réglages. Rien n’est lu tant qu’on n’a pas dit oui ici ; dire non arrête tout.
const ext = globalThis.browser ?? globalThis.chrome;
const $ = s => document.querySelector(s), dit = t => { $('#dit').textContent = t; };
const EXCLUS = ['chtabay.github.io', 'impots.gouv.fr', 'ameli.fr', 'doctolib.fr', 'service-public.fr']; // d’office : l’archipel, les impôts, la santé
const RECHERCHES = ['google.com', 'google.fr', 'bing.com', 'duckduckgo.com', 'qwant.com'];
const lignes = t => [...new Set(t.split('\n').map(l => l.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean))];

async function montrer() {
  const r = await ext.storage.local.get(['accord', 'pause', 'exclus', 'recherches']);
  $('#reglages').hidden = r.accord !== true;
  $('#pause').checked = r.pause === true;
  $('#exclus').value = (Array.isArray(r.exclus) ? r.exclus : EXCLUS).join('\n');
  $('#recherches').value = (Array.isArray(r.recherches) ? r.recherches : RECHERCHES).join('\n');
  if (r.accord === true) dit(r.pause ? 'En pause : rien n’est lu.' : 'C’est noté : ce que tu écris fait pousser le chemin.');
}
$('#oui').addEventListener('click', async () => {
  const r = await ext.storage.local.get(['exclus', 'recherches']);
  await ext.storage.local.set({ accord: true, pause: false, exclus: Array.isArray(r.exclus) ? r.exclus : EXCLUS, recherches: Array.isArray(r.recherches) ? r.recherches : RECHERCHES });
  montrer();
});
$('#non').addEventListener('click', async () => { await ext.storage.local.set({ accord: false }); montrer(); dit('C’est noté : rien n’est lu.'); });
$('#pause').addEventListener('change', async e => { await ext.storage.local.set({ pause: e.target.checked }); montrer(); });
$('#garder').addEventListener('click', async () => { await ext.storage.local.set({ exclus: lignes($('#exclus').value), recherches: lignes($('#recherches').value) }); montrer(); dit('Les réglages sont gardés.'); });
$('#effacer').addEventListener('click', async () => {
  if (!confirm('Tout effacer, pour de bon : le chemin de ce navigateur, ses pages, ses tuiles, et les réglages ?')) return;
  await ext.storage.local.clear();
  await new Promise(ok => { const q = indexedDB.deleteDatabase('chemin'); q.onsuccess = q.onerror = q.onblocked = () => ok(); });
  montrer(); dit('Tout est effacé.');
});
montrer();
