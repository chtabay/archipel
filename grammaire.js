// L’archipel : la grammaire. Des cases aux graines.
//
// Un dépôt (une confession) garde toutes ses cases. Rien n’est réduit à l’enregistrement :
// l’île est recalculée à partir des dépôts, et une autre grammaire pourrait relire les mêmes dépôts.
// La grammaire lit quatre axes dans les cases, et jamais le texte, sauf sa présence :
//   1. la place    — d’où ça vient : reçu, commis, voulu, entre vous, toi, tes jours  → la famille
//   2. la sensation — comment c’est ressenti (le quadrant des mots)                  → l’espèce
//   3. le temps    — depuis quand, et si ça revient                                  → la taille
//   4. le silence  — qui le sait, et s’il y a un texte                               → l’état

import { SUBJECTS, QUESTIONS } from './contenu.js?v=2';

/* ───────── 1. Les familles ───────── */

export const FAMILLES = {
  arbre: { nom: 'les arbres', de: 'ce qu’on t’a fait', zone: 'dans la forêt', verbe: 'a poussé' },
  pierre: { nom: 'les pierres', de: 'ce que tu as fait, ou voulu', zone: 'sur la colline', verbe: 's’est posée' },
  maison: { nom: 'les constructions', de: 'ce qui se passe entre vous', zone: 'dans le village', verbe: 's’est construit' },
  culture: { nom: 'les cultures', de: 'ce qui occupe tes jours', zone: 'dans les champs', verbe: 'est apparu' },
  animal: { nom: 'les animaux', de: 'toi, tel que tu es', zone: 'sur le pré', verbe: 'est venu' },
  buisson: { nom: 'les buissons', de: 'ce que tu as voulu', zone: 'au bord du chemin', verbe: 'a poussé' },
  meteo: { nom: 'le temps qu’il fait', de: 'une sensation', zone: 'sur l’île', verbe: 'est arrivé' },
  caillou: { nom: 'les cailloux', de: 'juste posé, sans rien dire de plus', zone: 'sur la plage', verbe: 's’est posé' },
};

// Chaque sujet a une famille de départ.
export const SUJET_FAMILLE = {
  s0: 'pierre', s1: 'pierre', s2: 'buisson', s3: 'buisson', s4: 'maison', s5: 'maison', s6: 'culture', s7: 'culture',
  s8: 'pierre', s9: 'animal', s10: 'animal', s11: 'arbre', s12: 'maison', s13: 'animal', s14: 'buisson',
};

// La place vis-à-vis du fait déplace la famille : reçu → arbre. Ce que tu as fait ne la change pas : chaque sujet garde sa chose,
// et porte une petite pierre à son pied (l’état « commis », plus bas) ; la pierre du regret se pose à côté, une par dépôt.
export function familleDe(id, a) {
  const base = SUJET_FAMILLE[id] || 'culture';
  if (base === 'pierre' || id === 's11') return base;
  if (a.subi.size > 0 || a.situ.has('mal')) return 'arbre';
  return base;
}
// Les familles qui portent la petite pierre de ce que tu as fait : ni les arbres, qui disent ce qu’on t’a fait, ni les pierres elles-mêmes.
export const PORTENT_LA_PIERRE = ['maison', 'culture', 'animal', 'buisson'];

/* ───────── 2. Les espèces : famille × sensation ───────── */
// AD agité-douloureux, ED éteint-douloureux, AS agité-supportable, ES éteint-supportable, N sans mot.

export const ESPECES = {
  arbre: { AD: 'pin', ED: 'nu', AS: 'feuillu', ES: 'fleuri', N: 'feuillu' },
  pierre: { AD: 'sombre', ED: 'moussue', AS: 'cairn', ES: 'galet', N: 'pierre' },
  maison: { AD: 'cloture', ED: 'volets', AS: 'pont', ES: 'banc', N: 'maison' },
  culture: { AD: 'feu', ED: 'puits', AS: 'champ', ES: 'barque', N: 'champ' },
  animal: { AD: 'lievre', ED: 'chat', AS: 'chevreuil', ES: 'mouton', N: 'poule' },
  buisson: { AD: 'ronce', ED: 'buissonsec', AS: 'buissonfleuri', ES: 'baies', N: 'buisson' },
  meteo: { AD: 'orage', ED: 'pluie', AS: 'fleurs', ES: 'etang' },
};

// Les quadrants présents, du plus coché au moins coché (à égalité : ED, AD, ES, AS).
export function quadsDe(a) {
  const n = { ED: 0, AD: 0, ES: 0, AS: 0 };
  for (const it of QUESTIONS.mots.items) if (a.mots.has(it.id)) n[it.q]++;
  return Object.entries(n).filter(([, c]) => c > 0).sort((p, q) => q[1] - p[1]);
}
export const quadDe = a => quadsDe(a)[0]?.[0] || 'N';

/* ───────── 3. La taille : depuis quand ───────── */
// 0 jeune, 1 adulte, 2 vieux. Un sujet redit fait grandir d’un cran, jusqu’à 3.

export function stadeDe(a) {
  const vieux = a.situ.has('longtemps') || a.fait.has('flong') || a.subi.has('slong');
  return vieux ? 2 : a.situ.has('recent') ? 0 : 1;
}

/* ───────── 4. L’état : le silence, le texte, le reste ───────── */

export function etatsDe(a, texte) {
  return {
    ferme: a.situ.has('jamais') || a.situ.has('personne') || a.fait.has('fsait') || a.subi.has('sparle'), // fermé : jamais dit (« personne », une ancienne case, reste lu pour les dépôts d’avant)
    lueur: !!texte, // il y a un texte : une lumière, jamais son contenu
    boucle: a.situ.has('boucle'), // ça tourne : un sentier usé autour
    double: a.fait.has('fplus') || a.subi.has('scont'), // plus d’une fois : en deux exemplaires
    pluie: a.subi.has('scont'), // ça continue : il pleut dessus
    mousse: a.situ.has('regret'), // regret : la mousse et les fleurs reprennent la pierre
    fissure: a.fait.has('frep'), // jamais réparé : la pierre est fendue
    caillou: a.subi.has('sresp'), // je me sens responsable : un caillou au pied de l’arbre
  };
}

/* ───────── Les graines d’un dépôt ───────── */

// lu : ce que le texte dit, lu sur l’appareil ({ quad }), pour la sensation quand aucun mot n’est coché.
export function graines(a, texte, lu = null) {
  const qs = quadsDe(a), stade = stadeDe(a), etats = etatsDe(a, texte);
  let quad = qs[0]?.[0] || 'N', quadDuTexte = false;
  if (quad === 'N' && lu?.quad && lu.quad !== 'N') { quad = lu.quad; quadDuTexte = true; }
  const out = [], graine = (key, famille, espece, st = stade, sujet = null) => out.push({ key, sujet, famille, espece, quad, stade: st, etats: { ...etats } });
  const commis = a.situ.has('regret') || a.fait.size > 0; // ce que tu as fait : chaque chose garde sa famille, une petite pierre à son pied
  for (const it of QUESTIONS.sujets.items) if (a.sujets.has(it.id)) { const f = familleDe(it.id, a); graine(it.id, f, ESPECES[f][quad], stade, it.id); if (commis && PORTENT_LA_PIERRE.includes(f)) out[out.length - 1].etats.commis = true; }
  // la situation laisse toujours sa trace : si aucun sujet ne la porte déjà, elle fait pousser sa propre chose.
  // « On m’a fait du mal » et « je regrette », cochées ensemble, font un arbre et une pierre : l’une n’efface pas l’autre.
  const porte = f => out.some(g => g.famille === f);
  if ((a.situ.has('mal') || a.subi.size) && !porte('arbre')) graine('situ:mal', 'arbre', ESPECES.arbre[quad]);
  if ((a.situ.has('regret') || a.fait.size) && !porte('pierre')) graine('situ:regret', 'pierre', ESPECES.pierre[quad]);
  // la sensation : quand rien d’autre ne la porte, le quadrant principal fait le temps ; les autres quadrants laissent chacun leur trace
  const restants = out.length ? qs.slice(1) : qs;
  for (const [q, n] of restants) { const e = ESPECES.meteo[q]; out.push({ key: `meteo:${e}`, sujet: null, famille: 'meteo', espece: e, quad: q, stade: Math.min(2, n - 1 + (stade === 2 ? 1 : 0)), etats: { ...etats } }); }
  if (!out.length) graine('caillou', 'caillou', 'caillou', stade); // rien du tout : un caillou posé, qui porte quand même les états
  return { graines: out, quad, quadDuTexte, phare: a.situ.has('danger') || a.subi.has('speur'), lourd: a.situ.has('pasbien') };
}

/* ───────── La composition : un dépôt complète l’île ───────── */
// Un sujet déjà présent (même clé : le sujet) ne fait pas une deuxième chose : il fait grandir la première. Pour les arbres
// les pierres et les buissons, l’espèce suit la sensation d’aujourd’hui (un arbre nu peut se couvrir de feuilles) ;
// une construction, une culture ou un animal garde son espèce. Les états qui disent « aujourd’hui » (fermé,
// boucle, pluie) suivent le dernier dépôt ; les autres s’accumulent.

export const SUIVENT = ['ferme', 'boucle', 'pluie'];
export const CHANGENT = ['arbre', 'pierre', 'buisson'];

export function pousser(etat, depot, a) { // etat : { assets, phare, climat } ; renvoie ce qui a changé
  const g = graines(a, depot.texte, depot.quadTexte ? { quad: depot.quadTexte } : null);
  const nouvelles = [], grandies = [];
  for (const s of g.graines) {
    const ex = etat.assets.find(x => x.key === s.key);
    if (ex) {
      ex.stade = Math.min(3, Math.max(ex.stade, s.stade) + 1);
      if (CHANGENT.includes(ex.famille)) ex.espece = ESPECES[ex.famille][s.quad]; // la même famille, la sensation d’aujourd’hui
      ex.quad = s.quad;
      for (const k of Object.keys(s.etats)) ex.etats[k] = SUIVENT.includes(k) ? s.etats[k] : ex.etats[k] || s.etats[k];
      ex.depots.push(depot.id);
      grandies.push(ex);
    } else {
      const n = { ...s, depots: [depot.id], ne: depot.id };
      etat.assets.push(n);
      nouvelles.push(n);
    }
  }
  if (g.phare && !etat.phare) etat.phare = depot.id;
  etat.climat = g.lourd && (g.quad === 'N' || g.quad[1] === 'S') ? 'ED' : g.quad;
  return { nouvelles, grandies };
}

/* ───────── Les mots, pour les légendes ───────── */

// [singulier, genre, pluriel sans article]
export const NOMS = {
  pin: ['un pin', 'm', 'pins'], nu: ['un arbre nu', 'm', 'arbres nus'], feuillu: ['un arbre', 'm', 'arbres'], fleuri: ['un arbre en fleurs', 'm', 'arbres en fleurs'], bosquet: ['un bosquet', 'm', 'bosquets'],
  sombre: ['une pierre sombre', 'f', 'pierres sombres'], moussue: ['une pierre moussue', 'f', 'pierres moussues'], cairn: ['un cairn', 'm', 'cairns'], galet: ['un galet', 'm', 'galets'], pierre: ['une pierre', 'f', 'pierres'], menhir: ['une pierre levée', 'f', 'pierres levées'],
  cloture: ['une clôture', 'f', 'clôtures'], volets: ['une maison aux volets fermés', 'f', 'maisons aux volets fermés'], pont: ['un pont', 'm', 'ponts'], banc: ['un banc', 'm', 'bancs'], maison: ['une maison', 'f', 'maisons'], hameau: ['un hameau', 'm', 'hameaux'],
  feu: ['un feu', 'm', 'feux'], puits: ['un puits', 'm', 'puits'], champ: ['un champ', 'm', 'champs'], moulin: ['un moulin', 'm', 'moulins'], barque: ['une barque', 'f', 'barques'],
  lievre: ['un lièvre', 'm', 'lièvres'], chat: ['un chat', 'm', 'chats'], chevreuil: ['un chevreuil', 'm', 'chevreuils'], mouton: ['un mouton', 'm', 'moutons'], poule: ['une poule', 'f', 'poules'], troupeau: ['un petit troupeau', 'm', 'petits troupeaux'], chats: ['des chats', 'p', 'chats'],
  ronce: ['une ronce', 'f', 'ronces'], buissonsec: ['un buisson sec', 'm', 'buissons secs'], buissonfleuri: ['un buisson fleuri', 'm', 'buissons fleuris'], baies: ['un buisson de baies', 'm', 'buissons de baies'], buisson: ['un buisson', 'm', 'buissons'], haie: ['une haie', 'f', 'haies'], fourre: ['un fourré', 'm', 'fourrés'],
  orage: ['un nuage d’orage', 'm', 'nuages d’orage'], pluie: ['un nuage de pluie', 'm', 'nuages de pluie'], fleurs: ['des fleurs', 'p', 'fleurs'], etang: ['un étang', 'm', 'étangs'], caillou: ['un caillou', 'm', 'cailloux'],
  phare: ['un phare', 'm', 'phares'],
};
const NOMBRES = ['', '', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
// « deux arbres nus, une pierre » : ce que des graines feraient.
export function listeGraines(seeds) {
  const comptes = {};
  for (const x of seeds) { const e = especeDe(x); comptes[e] = (comptes[e] || 0) + 1; }
  return listeDe(comptes);
}
// « deux arbres, une pierre et une maison » : ce que les autres verraient.
export function listeDe(comptes) {
  const parts = Object.entries(comptes).map(([e, n]) => (n === 1 ? NOMS[e][0] : `${NOMBRES[n] || n} ${NOMS[e][2]}`));
  return parts.length ? (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}` : parts[0]) : 'rien encore';
}

// L’espèce affichée, une fois la taille prise en compte.
export function especeDe(x) {
  if (x.famille === 'arbre' && x.stade >= 3) return 'bosquet';
  if (x.famille === 'pierre' && x.stade >= 3 && x.espece !== 'cairn') return 'menhir';
  if (x.espece === 'maison' && x.stade >= 3) return 'hameau';
  if (x.espece === 'champ' && x.stade >= 2) return 'moulin';
  if (x.famille === 'animal' && x.stade >= 3) return x.espece === 'chat' ? 'chats' : 'troupeau';
  if (x.famille === 'buisson' && x.stade >= 2) return x.stade >= 3 ? 'fourre' : 'haie';
  return x.espece;
}
export const nomDe = x => NOMS[especeDe(x)]?.[0] || 'quelque chose';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Les verbes : [singulier, pluriel, s’accorde (être)].
const VERBES = { arbre: ['a poussé', 'ont poussé', false], pierre: ['s’est posé', 'se sont posé', true], maison: ['s’est construit', 'se sont construit', true], culture: ['est apparu', 'sont apparu', true], meteo: ['est arrivé', 'sont arrivé', true], caillou: ['s’est posé', 'se sont posé', true], animal: ['est venu', 'sont venu', true], buisson: ['a poussé', 'ont poussé', false] };
const ZONES = { barque: 'sur la rive', caillou: 'sur la plage', etang: 'en contrebas' };
const defini = nom => nom.replace(/^(un|une|des) (.)/, (m, art, c) => (/[aeiouéèêh]/i.test(c) && art !== 'des' ? `l’${c}` : `${art === 'des' ? 'les' : art === 'une' ? 'la' : 'le'} ${c}`));

// « Un arbre a poussé dans la forêt. » « Deux pierres se sont posées sur la colline. » « L’arbre a grandi. »
export function phraseDe(x, grandie, n = 1) {
  const e = especeDe(x), [nom, g, pl] = NOMS[e] || ['quelque chose', 'm', 'choses'];
  const pluriel = n > 1 || g === 'p';
  const sujet = n > 1 ? `${cap(NOMBRES[n] || String(n))} ${pl}` : cap(grandie ? defini(nom) : nom);
  if (grandie) return `${sujet} ${pluriel ? 'ont' : 'a'} grandi.`;
  const [sg, plv, accord] = VERBES[e === 'caillou' ? 'caillou' : x.famille];
  const verbe = (pluriel ? plv : sg) + (accord ? (g === 'f' || g === 'p' ? 'e' : '') + (pluriel ? 's' : '') : '');
  return `${sujet} ${verbe} ${ZONES[e] || FAMILLES[x.famille].zone}.`;
}

// Plusieurs choses à la fois : les mêmes sont comptées ensemble.
export function phrasesDe(nouvelles, grandies) {
  const out = [];
  for (const [liste, grandie] of [[nouvelles, false], [grandies, true]]) {
    const groupes = new Map();
    for (const x of liste) { const k = `${x.famille}:${especeDe(x)}`; (groupes.get(k) || groupes.set(k, []).get(k)).push(x); }
    for (const g of groupes.values()) out.push(phraseDe(g[0], grandie, g.length));
  }
  return out;
}

// Les cases derrière une chose (pour la légende, sur ce téléphone seulement).
export function casesDe(a) {
  const out = [];
  for (const k of ['situ', 'fait', 'subi']) for (const it of QUESTIONS[k].items) if (a[k].has(it.id)) out.push(it.label.toLowerCase());
  return out;
}

export const sujetLabel = id => (id ? SUBJECTS[+id.slice(1)][0] : '');
