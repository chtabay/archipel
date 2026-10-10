// Le chemin, le glaneur — le fond (service worker). Il range les glanes dans le stockage de l’extension, par jour et par
// champ : on ne garde que la DERNIÈRE version d’un champ, et jamais deux fois le même texte le même jour. Aucune requête
// réseau : l’extension n’en fait jamais, et sa CSP l’interdit. Le pont (sur la page du chemin) lira ce stockage et posera
// les glanes du jour dans le carnet du chemin.
//
// Firefox : le background tourne depuis "scripts" (pas de service worker avant la 121) ; le reste est identique.
const ext = globalThis.browser ?? globalThis.chrome;
const MAX_JOURS = 7; // on ne garde que la semaine passée : au-delà, le chemin n’a pas été ouvert, on oublie

const jourLocal = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };

let file = Promise.resolve(); // une écriture à la fois : plusieurs cadres/onglets écrivent en même temps
const tour = f => (file = file.then(f, f).catch(() => {}));

const badge = n => ext.action?.setBadgeText?.({ text: n ? String(n) : '' }).catch(() => {});

function compteDuJour(jours) { const j = jours[jourLocal()]; return j ? Object.keys(j).length : 0; }

function ajouter({ cle, jour, site, at, texte }) {
  return tour(async () => {
    const { jours = {} } = await ext.storage.local.get('jours');
    const vieux = jourVieux();
    for (const d of Object.keys(jours)) if (d < vieux) delete jours[d]; // oublier les jours d’avant la semaine
    const j = (jours[jour] ??= {});
    // ne pas garder deux champs avec exactement le même texte le même jour (collage recopié, cadre dupliqué…)
    for (const [k, v] of Object.entries(j)) if (k !== cle && v.texte === texte) delete j[k];
    j[cle] = { date: jour, source: site, at, texte }; // remplace la version précédente de ce champ
    await ext.storage.local.set({ jours });
    badge(compteDuJour(jours));
  });
}
const jourVieux = () => { const d = new Date(); d.setDate(d.getDate() - MAX_JOURS); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };

ext.runtime.onMessage.addListener((m, de, repondre) => {
  if (!m || de.id !== ext.runtime.id) return; // seulement nos propres scripts
  if (m.type === 'glane' && typeof m.texte === 'string' && typeof m.cle === 'string') { ajouter(m).then(() => repondre(true)); return true; }
  if (m.type === 'compte') { ext.storage.local.get('jours').then(({ jours = {} }) => repondre(compteDuJour(jours))); return true; }
  return false;
});

// Au démarrage, remettre le chiffre à jour
ext.storage.local.get('jours').then(({ jours = {} }) => badge(compteDuJour(jours))).catch(() => {});
