// Le chemin : le sens d’une page. Le texte est lu sur le téléphone, jamais ailleurs. On en garde les mots porteurs, pondérés
// par leur rareté ; puis, dans un espace où le français et l’anglais se répondent, on cherche les objets du catalogue les plus
// proches, les champs de la journée et sa tonalité. Les vecteurs viennent de fastText, alignés et réduits : voir outils/sens.py.

export const D = 96;
const ECHELLE = 127 * 127; // les vecteurs sont quantifiés sur un octet, de longueur 127
const MOT = /[a-zàâäçéèêëîïôöùûüÿœæ]+(?:-[a-zàâäçéèêëîïôöùûüÿœæ]+)*/g;
// les mots qui ne portent rien : articles, pronoms, liaisons, et les verbes de tous les jours sous leurs formes courantes
const VIDES = new Set(`le la les un une des du de au aux et ou mais donc or ni car que qui quoi dont où ce cet cette ces ça cela ceci celui celle ceux
mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je tu il elle on nous vous ils elles me te se moi toi lui eux y en ne pas plus moins très trop
peu bien mal tout tous toute toutes rien chaque avec sans sous sur dans par pour vers chez entre comme si quand alors puis aussi encore déjà toujours jamais
ici là avoir être faire aller venir dire voir pouvoir vouloir devoir falloir savoir prendre mettre donner trouver passer rester
ai as a avons avez ont eu eue suis es est sommes êtes sont été étais était étions étiez étaient serai sera serons seront serais serait fus fut
fais fait faisons faites font faisais faisait vais vas va allons allez vont allais allait suis venu venue viens vient venons venez viennent
dis dit disons disent disais disait vu vue vois voit voyons voient peux peut pouvons pouvez peuvent pu pouvais pouvait veux veut voulons voulez veulent
voulu voulais voulait dois doit devons devez doivent dû devais devait faut fallait sais sait savons savez savent su savais savait pris prends prend
mis mets met donné donne trouve trouvé passé passe reste resté
c d j l m n s t qu jusqu lorsqu puisqu quelqu aujourd hui oui non ah oh eh bon bah ben voilà enfin juste vraiment assez beaucoup quelque quelques autre autres
même mêmes tel telle tels telles leur cette fois chose choses truc trucs gens jour journée temps moment coup peu`.split(/\s+/));
const QUAND = { matin: 'matin', aube: 'matin', réveil: 'matin', midi: 'midi', soir: 'soir', crépuscule: 'soir', nuit: 'nuit', minuit: 'nuit', étoiles: 'nuit', lune: 'nuit' };

// Les champs de la vie ordinaire : quelques mots chacun, le reste vient des voisins dans l’espace des vecteurs
export const CHAMPS = {
  maison: 'maison chambre salon cuisine lit canapé appartement sieste rangement ménage',
  travail: 'travail bureau réunion collègue patron projet ordinateur dossier mail client',
  ville: 'ville rue métro magasin courses boutique trottoir voiture bus marché',
  nature: 'forêt bois arbre marche randonnée sentier champignon mousse montagne feuilles',
  campagne: 'champ prairie campagne ferme jardin potager fleurs vélo vache herbe',
  mer: 'mer plage vague bateau port sable baignade île côte phare',
  famille: 'famille mère père enfant fils fille frère sœur parents grand-mère',
  amis: 'ami amie amis copain copine fête soirée anniversaire apéro rire',
  amour: 'amour aimer amoureux baiser couple tendresse cœur câlin',
  corps: 'corps malade médecin hôpital douleur sport courir nager dos',
  creation: 'écrire dessiner peindre musique chanter guitare piano photo atelier création',
  repos: 'dormir rêve sommeil repos calme silence lenteur paresse',
  peine: 'deuil mort perdre absence manque pleurer tristesse chagrin',
  voyage: 'voyage train gare avion valise départ vacances route hôtel',
};
// les lieux du chemin, et les champs qui y mènent
export const LIEUX = { interieur: ['maison', 'repos', 'creation', 'famille'], village: ['ville', 'travail', 'amis'], foret: ['nature', 'peine'], champs: ['campagne', 'amour', 'corps'], rivage: ['mer', 'voyage'] };
const TON = {
  plus: 'heureux heureuse joie content contente bonheur rire sourire beau doux merci plaisir chance réussi',
  moins: 'triste peine pleurer seul seule mal douleur peur colère angoisse perdu fatigue lourd',
  vif: 'agité stress vite courir colère énervé bruit foule excité pressé',
  lent: 'calme lent paisible doux repos silence tranquille sieste lenteur',
};

export async function chargerSens(base = './') {
  const lire = (f, comment) => fetch(new URL(f, new URL(base, location.href))).then(r => { if (!r.ok) throw new Error(`${f} : ${r.status}`); return r[comment](); });
  const [mots, V, O, catalogue] = await Promise.all([lire('sens/mots.txt?v=1', 'text'), lire('sens/vecteurs.bin?v=1', 'arrayBuffer'), lire('sens/objets.bin?v=1', 'arrayBuffer'), lire('catalogue.json?v=1', 'json')]);
  return preparer(mots, V, O, catalogue);
}
export function preparer(mots, V, O, catalogue) { // aussi pour les essais, hors du navigateur
  const liste = mots.split('\n').filter(Boolean), index = new Map(liste.map((m, i) => [m, i]));
  const S = { index, V: new Int8Array(V), O: new Int8Array(O), catalogue };
  if (S.O.length !== catalogue.length * D) throw new Error('le catalogue et ses vecteurs ne correspondent pas');
  S.champs = Object.fromEntries(Object.entries(CHAMPS).map(([k, l]) => [k, centre(S, l)]));
  S.ton = Object.fromEntries(Object.entries(TON).map(([k, l]) => [k, centre(S, l)]));
  S.tonMots = Object.fromEntries(Object.entries(TON).map(([k, l]) => [k, new Set(l.split(/\s+/))]));
  return S;
}
function centre(S, liste) { // la moyenne de quelques mots, ramenée à une longueur 1
  const c = new Float32Array(D);
  for (const m of liste.split(/\s+/)) { const i = S.index.get(m); if (i == null) continue; for (let k = 0; k < D; k++) c[k] += S.V[i * D + k]; }
  return unite(c);
}
const unite = c => { let n = 0; for (const x of c) n += x * x; n = Math.sqrt(n) || 1; return c.map(x => x / n); };
const scal = (A, a, c) => { let s = 0; for (let k = 0; k < D; k++) s += A[a * D + k] * c[k]; return s / 127; }; // un vecteur quantifié, un vecteur réel
const entre = (A, a, B, b) => { let s = 0; for (let k = 0; k < D; k++) s += A[a * D + k] * B[b * D + k]; return s / ECHELLE; };

// Lire une page : ses mots porteurs, son contexte, ses champs, sa tonalité, son heure
export function lirePage(S, texte) {
  const brut = (texte || '').toLowerCase().replace(/[’'`´]/g, ' ').match(MOT) || [], compte = new Map();
  let heure = null;
  for (const m of brut) {
    if (QUAND[m]) heure = QUAND[m];
    if (m.length < 3 || VIDES.has(m)) continue;
    const i = S.index.get(m); if (i == null) continue;
    compte.set(m, (compte.get(m) || 0) + 1);
  }
  const mots = [...compte].map(([m, n]) => { const i = S.index.get(m); return { m, i, poids: (1 + Math.log(n)) * Math.log(1 + i / 60) }; }).sort((a, b) => b.poids - a.poids).slice(0, 14);
  const max = mots[0]?.poids || 1; for (const x of mots) x.p = x.poids / max; // de 0 à 1
  const contexte = new Float32Array(D);
  for (const x of mots) for (let k = 0; k < D; k++) contexte[k] += x.p * S.V[x.i * D + k];
  const ctx = unite(contexte), champs = {};
  for (const [k, c] of Object.entries(S.champs)) champs[k] = mots.reduce((s, x) => s + x.p * Math.max(0, scal(S.V, x.i, c) - .3), 0);
  const axe = (a, b) => { // un mot de la liste compte pleinement ; les autres, par leur voisinage
    let s = 0, n = 0;
    for (const m of brut) { if (S.tonMots[a].has(m)) { s++; n++; } else if (S.tonMots[b].has(m)) { s--; n++; } }
    for (const x of mots) { s += 2.5 * x.p * (scal(S.V, x.i, S.ton[a]) - scal(S.V, x.i, S.ton[b])); n += x.p; }
    return Math.max(-1, Math.min(1, s / Math.max(2, n)));
  };
  return { mots, contexte: ctx, champs, valence: axe('plus', 'moins'), energie: axe('vif', 'lent'), heure };
}

// Les objets les plus proches des mots de la page, au-dessus d’un seuil ; un objet vu récemment est moins probable
export function objetsDeLaPage(S, lecture, { seuil = .565, max = 6, recents = new Map(), jour = 0 } = {}) {
  const out = [];
  for (let j = 0; j < S.catalogue.length; j++) {
    let best = 0, mot = null;
    for (const x of lecture.mots) { const s = entre(S.V, x.i, S.O, j) * (.8 + .2 * x.p); if (s > best) { best = s; mot = x.m; } }
    const score = .7 * best + .3 * scal(S.O, j, lecture.contexte) + .07; // le contexte de la page départage les sens d’un mot
    if (score < seuil) continue;
    const vu = recents.get(S.catalogue[j].id), oubli = vu == null ? 1 : 1 - .8 * Math.exp(-(jour - vu) / 5);
    out.push({ objet: S.catalogue[j], score: score * oubli, brut: score, mot });
  }
  out.sort((a, b) => b.score - a.score);
  const pris = new Set(), choisis = [];
  for (const o of out) { if (pris.has(o.mot)) continue; pris.add(o.mot); choisis.push(o); if (choisis.length >= max) break; } // un objet par mot : la place va aux autres mots
  return choisis;
}

// Le lieu de la page : celui de ses champs, et de ses objets ; sinon celui de la veille, pour que le chemin ne saute pas
export function lieuDeLaPage(lecture, objets, veille = null) {
  const s = Object.fromEntries(Object.keys(LIEUX).map(l => { const v = LIEUX[l].map(c => lecture.champs[c] || 0), m = Math.max(...v); return [l, m + .25 * (v.reduce((a, b) => a + b, 0) - m)]; })); // le champ le plus fort, et un peu des autres
  for (const o of objets) for (const l of o.objet.lieux) if (s[l] != null) s[l] += o.objet.role === 'petit' ? .05 : .12;
  if (veille && s[veille] != null) s[veille] += .08; // un peu d’inertie
  const [lieu, v] = Object.entries(s).sort((a, b) => b[1] - a[1])[0];
  return v > .02 ? lieu : veille || 'champs';
}
