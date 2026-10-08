// L’extension du chemin : ce qu’elle ajoute à la page du chemin, dans son onglet. Quand le fond a posé un bloc, le chemin
// se relit et va au bout ; un lien vers l’accord et les réglages ; sans accord encore, un mot pour y aller.
const ext = globalThis.browser ?? globalThis.chrome;
let attente = false; // un bloc arrivé pendant l’intro : le chemin se relira dès qu’il sera prêt
const relire = () => { if (window.chemin?.rafraichir) { attente = false; window.chemin.rafraichir().catch(() => {}); } else attente = true; };
ext.runtime.onMessage.addListener(m => { if (m?.type === 'bloc') relire(); });
addEventListener('chemin:pret', async () => {
  if (attente) relire();
  const { accord } = await ext.storage.local.get('accord').catch(() => ({})); // le premier jour : rien encore, et le chemin attend les écrits de la journée
  if (accord === true && window.chemin?.pages?.length === 0) { const d = document.querySelector('#dit'); if (d) d.textContent = 'Écris comme d’habitude : ton chemin pousse derrière.'; }
});
(async () => {
  const r = document.createElement('p'), lien = document.createElement('a'); // l’accord et les réglages, toujours à portée
  r.className = 'tiny reglages'; lien.href = ext.runtime.getURL('accord.html'); lien.textContent = 'L’accord et les réglages de l’extension'; r.append(lien);
  (document.querySelector('.tete') || document.body).append(r);
  const { accord } = await ext.storage.local.get('accord').catch(() => ({}));
  if (accord === true) return;
  const p = document.createElement('p'), a = document.createElement('a');
  p.className = 'tiny accord'; a.href = ext.runtime.getURL('accord.html'); a.textContent = 'dis-le ici';
  p.append('Pour que ce que tu écris dans la journée fasse pousser le chemin, ', a, '.');
  (document.querySelector('.tete') || document.body).append(p);
  ext.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.accord?.newValue === true) p.remove(); });
})();
