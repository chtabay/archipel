// L’extension du chemin : ce qu’elle ajoute à la page du chemin, dans le nouvel onglet. Quand le fond a posé un bloc, le chemin
// se relit et va au bout ; sans accord encore, un mot pour y aller.
const ext = globalThis.browser ?? globalThis.chrome;
ext.runtime.onMessage.addListener(m => { if (m?.type === 'bloc') window.chemin?.rafraichir?.(); });
(async () => {
  const { accord } = await ext.storage.local.get('accord').catch(() => ({}));
  if (accord === true) return;
  const p = document.createElement('p'), a = document.createElement('a');
  p.className = 'tiny accord'; a.href = ext.runtime.getURL('accord.html'); a.textContent = 'dis-le ici';
  p.append('Pour que ce que tu écris dans la journée fasse pousser le chemin, ', a, '.');
  (document.querySelector('.tete') || document.body).append(p);
  ext.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.accord?.newValue === true) p.remove(); });
})();
