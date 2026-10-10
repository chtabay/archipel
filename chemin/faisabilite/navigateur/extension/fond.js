// Le chemin, le glaneur : le fond. Il garde les glanes dans le stockage de l’extension, sur cet ordinateur, jusqu’à ce que
// la page du chemin, ouverte ici, les prenne. Aucune requête réseau : l’extension n’en fait jamais, et sa CSP l’interdit.
const ext = globalThis.browser ?? globalThis.chrome;
const CHEMIN = 'https://chtabay.github.io/archipel/chemin/';
const MAX = 2000; // au-delà, les plus anciennes s’en vont : le chemin n’a pas été ouvert depuis longtemps

ext.runtime.onInstalled.addListener(({ reason }) => { if (reason === 'install') ext.tabs.create({ url: ext.runtime.getURL('accord.html') }); });

let file = Promise.resolve(); // une écriture à la fois
const tour = f => (file = file.then(f, f));
const lire = () => ext.storage.local.get('glanes').then(r => (Array.isArray(r.glanes) ? r.glanes : []));
const badge = n => ext.action.setBadgeText({ text: n ? String(n) : '' }).catch(() => {}); // on voit qu’il glane

function ajouter({ fil, site, texte }) {
  return tour(async () => {
    const g = await lire(), d = g[g.length - 1], quand = Date.now();
    if (d && d.fil === fil && quand - d.fin < 30 * 60e3) { d.texte += `\n${texte}`; d.fin = quand; } // le même écrit, repris
    else g.push({ id: `${quand.toString(36)}-${g.length}`, fil, site, texte, debut: quand, fin: quand });
    await ext.storage.local.set({ glanes: g.slice(-MAX) }); badge(g.length);
  });
}
const oublier = ids => tour(async () => { const g = (await lire()).filter(x => !ids.includes(x.id)); await ext.storage.local.set({ glanes: g }); badge(g.length); });

ext.runtime.onMessage.addListener((m, de, repondre) => {
  if (de.id !== ext.runtime.id || !m) return;
  if (m.type === 'glane' && typeof m.texte === 'string' && typeof m.fil === 'string') { ajouter(m).then(() => repondre(true)); return true; }
  const duChemin = typeof de.url === 'string' && de.url.startsWith(CHEMIN) && !de.frameId; // seule la page du chemin les reprend
  if (m.type === 'donne' && duChemin) { lire().then(repondre); return true; }
  if (m.type === 'oublie' && duChemin && Array.isArray(m.ids)) { oublier(m.ids.filter(x => typeof x === 'string')).then(() => repondre(true)); return true; }
});
