// L’extension du chemin : l’accord, et les réglages. Rien n’est lu tant qu’on n’a pas dit oui ici ; dire non arrête tout.
const ext = globalThis.browser ?? globalThis.chrome;
const $ = s => document.querySelector(s), dit = t => { $('#dit').textContent = t; };
const EXCLUS = ['chtabay.github.io', 'impots.gouv.fr', 'ameli.fr', 'doctolib.fr', 'service-public.fr']; // d’office : l’archipel, les impôts, la santé
const RECHERCHES = ['google.com', 'bing.com', 'duckduckgo.com', 'qwant.com']; // le moteur lui-même (www. compris), pas ses sous-domaines : mail.google.com n’en est pas un
const lignes = t => [...new Set(t.split('\n').map(l => l.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/:].*$/, '')).filter(Boolean))];
const acces = () => ext.permissions.contains({ origins: ['<all_urls>'] }).catch(() => true);

async function montrer({ champs = true } = {}) {
  const r = await ext.storage.local.get(['accord', 'pause', 'exclus', 'recherches']);
  $('#reglages').hidden = r.accord !== true;
  $('#pause').checked = r.pause === true;
  if (champs) { $('#exclus').value = (Array.isArray(r.exclus) ? r.exclus : EXCLUS).join('\n'); $('#recherches').value = (Array.isArray(r.recherches) ? r.recherches : RECHERCHES).join('\n'); }
  $('#sites').hidden = r.accord !== true || await acces();
  if (r.accord === true) dit(r.pause ? 'En pause : rien n’est lu.' : 'C’est noté : ce que tu écris fait pousser le chemin.');
}
async function demanderAcces() { try { return await ext.permissions.request({ origins: ['<all_urls>'] }); } catch { return true; } } // sans invite si l’accès est déjà là
$('#oui').addEventListener('click', async () => {
  if (!(await demanderAcces())) { dit('Sans l’accès aux sites, rien ne peut être lu.'); return; }
  const r = await ext.storage.local.get(['exclus', 'recherches']);
  await ext.storage.local.set({ accord: true, pause: false, exclus: Array.isArray(r.exclus) ? r.exclus : EXCLUS, recherches: Array.isArray(r.recherches) ? r.recherches : RECHERCHES });
  montrer();
});
$('#acces').addEventListener('click', async () => { await demanderAcces(); montrer({ champs: false }); });
$('#non').addEventListener('click', async () => { await ext.storage.local.set({ accord: false }); montrer(); dit('C’est noté : rien n’est lu.'); });
$('#pause').addEventListener('change', async e => { await ext.storage.local.set({ pause: e.target.checked }); montrer({ champs: false }); });
$('#garder').addEventListener('click', async () => { await ext.storage.local.set({ exclus: lignes($('#exclus').value), recherches: lignes($('#recherches').value) }); montrer(); dit('Les réglages sont gardés.'); });
$('#effacer').addEventListener('click', async () => {
  if (!confirm('Tout effacer, pour de bon : le chemin de ce navigateur, ses pages, ses tuiles, et les réglages ?')) return;
  await ext.storage.local.clear();
  dit('Le carnet s’efface…');
  await new Promise(ok => { const q = indexedDB.deleteDatabase('chemin'); q.onsuccess = q.onerror = () => ok(); q.onblocked = () => dit('Un onglet du chemin tient le carnet : ferme-le, l’effacement suivra.'); });
  montrer(); dit('Tout est effacé.');
});
montrer();
