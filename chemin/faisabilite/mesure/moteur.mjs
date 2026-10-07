// Le moteur du chemin, tel quel, hors du navigateur : chemin/sens.js et chemin/monde.js importés par leur URL de fichier
// (Node 22 reconnaît leur syntaxe de module), avec les vrais fichiers de chemin/sens/ et chemin/catalogue.json.
// Rien n’est modifié dans chemin/ : ce fichier ne fait que charger, et refaire ce que fait calculer() dans chemin/app.js.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const ICI = path.dirname(fileURLToPath(import.meta.url));
export const CHEMIN = path.resolve(ICI, '../..'); // chemin/
const url = f => pathToFileURL(path.join(CHEMIN, f)).href;
export const sens = await import(url('sens.js'));
export const monde = await import(url('monde.js'));
const binaire = f => { const b = readFileSync(path.join(CHEMIN, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

export function chargerMoteur() {
  const t0 = performance.now();
  const S = sens.preparer(readFileSync(path.join(CHEMIN, 'sens/mots.txt'), 'utf8'), binaire('sens/vecteurs.bin'), binaire('sens/objets.bin'),
    JSON.parse(readFileSync(path.join(CHEMIN, 'catalogue.json'), 'utf8')), binaire('sens/images.bin'));
  const F = monde.familles(S.catalogue);
  return { S, F, msPreparer: performance.now() - t0 };
}

// Les mots du texte comme les compte sens.js (même expression, même passage en minuscules). Copie de mots() et jetons(),
// qui ne sont pas exportées : seulement pour mesurer (combien de mots, combien de porteurs, d’où vient un objet).
const MOT = /[a-zàâäçéèêëîïôöùûüÿœæ]+(?:-[a-zàâäçéèêëîïôöùûüÿœæ]+)*/g;
export const motsDe = texte => (texte || '').toLowerCase().replace(/[’'`´]/g, ' ').match(MOT) || [];
export function jetonsDe(S, texte, VIDES) {
  const out = [];
  for (const m of motsDe(texte)) {
    if (m.length < 3 || VIDES.has(m)) continue;
    let i = S.index.get(m);
    if (m.length > 4 && /[sx]$/.test(m)) { const j = S.index.get(m.slice(0, -1)); if (j != null && (i == null || S.I[j] > S.I[i])) i = j; }
    if (i != null) out.push([m, i]);
  }
  return out;
}
// la liste VIDES de sens.js n’est pas exportée : on la retrouve dans le fichier lui-même, sans la recopier à la main
export const VIDES = (() => {
  const src = readFileSync(path.join(CHEMIN, 'sens.js'), 'utf8'), m = src.match(/const VIDES = new Set\(`([^`]*)`/);
  return new Set(m[1].split(/\s+/).filter(Boolean));
})();

// Le corpus : « ### source | heure | outil | sujet » ouvre chaque saisie ; les lignes en # avant la première sont la fiche.
export function lireCorpus(fichier) {
  const brut = readFileSync(fichier, 'utf8'), items = [], fiche = [];
  let cur = null;
  for (const ligne of brut.split('\n')) {
    const h = ligne.match(/^### (\w+) \| (\d\d:\d\d) \| ([^|]*?) \| ?(.*)$/);
    if (h) { cur = { source: h[1], heure: h[2], outil: h[3].trim(), sujet: h[4].trim(), lignes: [] }; items.push(cur); continue; }
    if (!cur) { if (ligne.startsWith('#')) fiche.push(ligne.replace(/^#\s?/, '')); continue; }
    cur.lignes.push(ligne);
  }
  for (const it of items) { it.texte = it.lignes.join('\n').trim(); delete it.lignes; }
  items.sort((a, b) => a.heure.localeCompare(b.heure)); // dans l’ordre du jour
  return { fiche: fiche.join(' ').trim(), items };
}
// la page du jour, comme une capture l’assemblerait : les saisies, dans l’ordre, séparées par une ligne vide
export const pageDuJour = items => items.map(it => it.texte).filter(Boolean).join('\n\n');
export const familleSource = s => (s === 'mail' ? 'mail' : 'web'); // pour la stratégie « une tuile par source »

// Le plan des tuiles, comme calculer() dans app.js : le départ, puis chaque passage, dans l’ordre ; les objets vus
// récemment sont moins probables, le lieu garde un peu d’inertie, et planifier() place les objets sur la tuile.
export function planifierTuiles(S, F, textes, date = '2026-10-05') {
  const out = [{ texte: '', depart: true }, ...textes.map(texte => ({ texte }))];
  const recents = new Map(), decor = new Map(), plans = [];
  let veille = null;
  out.forEach((x, i) => {
    const lecture = sens.lirePage(S, x.texte), liste = sens.candidats(S, lecture);
    const objets = sens.objetsDeLaPage(S, lecture, { recents, jour: i, liste });
    for (const o of objets) recents.set(o.objet.id, i);
    const lieu = x.depart ? 'champs' : sens.lieuDeLaPage(lecture, objets, veille?.lieu);
    const jour = { i, date, lieu, objets, climat: monde.climatDe(lecture) };
    veille = monde.planifier(jour, veille, F, decor); veille.lecture = lecture; veille.objets = objets; veille.texte = x.texte; veille.liste = liste;
    plans.push(veille);
  });
  return plans.slice(1); // sans le départ
}
// les objets du passage qui ont trouvé leur place sur la tuile (poses() dans app.js)
export const poses = p => [...new Set(p.objets.filter(o => p.items.some(it => it.id === o.objet.id)).map(o => o.mot))];
// la lecture gardée d’un passage, au format du magasin « lectures » d’IndexedDB (ecrire() dans app.js)
export const lectureGardee = (lecture, liste) => ({ l: { ...lecture, contexte: [...lecture.contexte] }, o: liste.map(o => [o.objet.id, o.brut, o.mot]) });
