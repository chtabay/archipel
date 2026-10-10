// Le chemin : le sens d’un texte. Le texte est lu sur le téléphone, jamais ailleurs. On le découpe en passages qui portent
// chacun assez d’images pour une tuile ; de chaque passage, on garde les mots porteurs, pondérés par leur rareté ; puis, dans
// un espace où le français et l’anglais se répondent, on cherche les objets du catalogue les plus proches, les champs du
// passage et sa tonalité. Les vecteurs viennent de fastText, alignés et réduits : voir outils/sens.py.

export const D = 96, PORTEURS = 14; // un passage, une tuile : environ 14 mots porteurs
export const LECTURE = 7; // la version de la lecture d’un passage : on l’augmente quand un même passage se lirait autrement
const IMAGE = Math.round(.55 * 255), OBJET = Math.round(.7 * 255); // un mot fait une image s’il est à plus de 0,55 d’un objet ; à 0,7, il le nomme
const SEUIL = .7; // un objet vient sur la tuile si son score dépasse 0,7 : son nom est tout près d’un mot du passage
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
même mêmes tel telle tels telles leur cette fois chose choses truc trucs gens jour journée temps moment coup peu
chemin`.split(/\s+/)); // le chemin est toujours là : le mot n’y ajoute rien
const QUAND = { matin: 'matin', aube: 'matin', réveil: 'matin', midi: 'midi', soir: 'soir', crépuscule: 'soir', nuit: 'nuit', minuit: 'nuit', étoiles: 'nuit', lune: 'nuit' };
// le temps qu’il fait : des mots, et leurs formes ; deux mentions suffisent pour que le ciel change tout à fait
const METEO = Object.fromEntries(Object.entries({
  pluie: 'pluie pluies pleut pleuvait pleuvoir pleuvra plu averse averses bruine crachin giboulée giboulées trempé trempée trempés mouillé mouillée parapluie flaque flaques',
  orage: 'orage orages orageux tonnerre éclair éclairs foudre tempête tempêtes',
  neige: 'neige neiges neigeait neiger neigé neigeux enneigé enneigée flocon flocons poudreuse verglas givre gel gelé gelée bonhomme-de-neige',
  brume: 'brume brumes brumeux brumeuse brouillard brouillards embrumé embrumée',
  soleil: 'soleil ensoleillé ensoleillée chaleur chaud chaude canicule brûlant brûlante radieux radieuse lumineux',
}).map(([k, v]) => [k, new Set(v.split(/\s+/))]));
// ce qu’on voit au loin, entre le bout du sol et le ciel : des mots, et leurs formes ; deux mentions, et c’est tout l’horizon
const HORIZON = Object.fromEntries(Object.entries({
  mer: 'mer océan horizon voile voiles voilier voiliers phare île îles baie côte falaise falaises marée',
  montagnes: 'montagne montagnes sommet sommets pic pics cime cimes crête crêtes alpes pyrénées glacier glaciers volcan',
  collines: 'colline collines vallon vallons vallée vallées coteau coteaux plateau dune dunes plaine plaines',
  lisiere: 'forêt forêts bois lisière orée sapins pins futaie bosquet bosquets',
  toits: 'ville toits clocher église cathédrale immeubles gratte-ciel usine cheminées faubourg banlieue',
}).map(([k, v]) => [k, new Set(v.split(/\s+/))]));

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
  desert: 'désert sable dune dunes oasis chameau sahara aride cactus',
  savane: 'savane afrique safari lion girafe éléphant zèbre brousse',
  tropiques: 'jungle tropiques tropical palmier cocotier bananier exotique lagon perroquet',
  montagne: 'montagne montagnes sommet neige ski altitude glacier chalet alpes',
};
// les lieux du chemin, et les champs qui y mènent
export const LIEUX = { interieur: ['maison', 'repos', 'creation', 'famille'], village: ['ville', 'travail', 'amis'], foret: ['nature', 'peine'], champs: ['campagne', 'amour', 'corps'], rivage: ['mer', 'voyage'],
  desert: ['desert'], savane: ['savane'], tropiques: ['tropiques'], montagne: ['montagne'] };
const TON = {
  plus: 'heureux heureuse joie content contente bonheur rire sourire beau doux merci plaisir chance réussi',
  moins: 'triste peine pleurer seul seule mal douleur peur colère angoisse perdu fatigue lourd',
  vif: 'agité stress vite courir colère énervé bruit foule excité pressé',
  lent: 'calme lent paisible doux repos silence tranquille sieste lenteur',
};

export const FICHIERS_SENS = ['sens/mots.txt?v=4', 'sens/vecteurs.bin?v=4', 'sens/objets.bin?v=6', 'sens/images.bin?v=5', 'catalogue.json?v=6', 'sens/formes.txt?v=1', 'sens/symboles.txt?v=3'];
export async function chargerSens(base = './') {
  const lire = (f, comment) => fetch(new URL(f, new URL(base, location.href))).then(r => { if (!r.ok) throw new Error(`${f} : ${r.status}`); return r[comment](); });
  const [mots, V, O, I, catalogue, formes, symboles] = await Promise.all(FICHIERS_SENS.map((f, n) => lire(f, ['text', 'arrayBuffer', 'arrayBuffer', 'arrayBuffer', 'json', 'text', 'text'][n])));
  return preparer(mots, V, O, catalogue, I, formes, symboles);
}
export function preparer(mots, V, O, catalogue, I, formes = '', symboles = '') { // aussi pour les essais, hors du navigateur
  const liste = mots.split('\n').filter(Boolean), index = new Map(liste.map((m, i) => [m, i]));
  const S = { liste, index, V: new Int8Array(V), O: new Int8Array(O), I: new Uint8Array(I), catalogue, proche: new Float32Array(liste.length).fill(NaN), formes: new Map(), symboles: new Map() };
  for (const l of formes.split('\n')) { const [f, lemme, ambigu] = l.split(' '), i = index.get(lemme); if (f && i != null) S.formes.set(f, { i, ambigu: !!ambigu }); } // « dormi » : dormir
  for (const l of symboles.split('\n')) { // « temps sablier » : le temps se montre par un sablier ; les symboles sont des mots du vocabulaire
    if (!l || l.startsWith('#')) continue;
    const [mot, ...syms] = l.trim().split(/\s+/), is = syms.map(x => index.get(x) ?? index.get(x.replace(/oe/g, 'œ'))).filter(i => i != null);
    if (mot && is.length) S.symboles.set(mot, is);
  }
  if (S.O.length !== catalogue.length * D) throw new Error('le catalogue et ses vecteurs ne correspondent pas');
  if (S.I.length !== liste.length || S.V.length !== liste.length * D) throw new Error('les mots et leurs vecteurs ne correspondent pas');
  const N = catalogue.length; S.OT = new Float32Array(D * N); // les objets, rangés axe par axe : un mot se compare à tous d’un seul passage
  for (let j = 0; j < N; j++) for (let k = 0; k < D; k++) S.OT[k * N + j] = S.O[j * D + k];
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
const mots = texte => (texte || '').toLowerCase().replace(/[’'`´]/g, ' ').match(MOT) || [];

// Un mot porteur fait une image : il est proche d’un objet du catalogue, ou d’un champ de la vie ordinaire
export function porteur(S, i) {
  if (S.I[i] >= IMAGE) return true; // assez près d’un objet : calculé d’avance, pour chaque mot
  if (Number.isNaN(S.proche[i])) { let m = 0; for (const c of Object.values(S.champs)) m = Math.max(m, scal(S.V, i, c)); S.proche[i] = m; }
  return S.proche[i] >= .5;
}
// les mots du texte qui comptent, par leur numéro dans le vocabulaire. Un pluriel compte par son singulier s’il fait une
// meilleure image : « vaches » trouve la vache. Un mot composé inconnu ne compte pas : ses morceaux trompent plus qu’ils
// n’aident (« nique » dans « pique-nique »)
// Un verbe conjugué compte par son infinitif, s’il fait une image : « j’ai dormi » trouve le dormeur. Une forme qui est
// aussi un nom, comme « marché » ou « lit », n’est un verbe qu’après un auxiliaire ou un pronom : « j’ai marché », « il lit ».
const SUJETS = new Set('je j tu il elle on nous vous ils elles me m te t se s en ai as a avons avez ont avais avait avions aviez avaient eu aurai auras aura aurons aurez auront aurais aurait suis es est sommes êtes sont étais était étions étiez étaient'.split(' '));
// Un mot qui a ses symboles (sens/symboles.txt) compte par le premier qui nomme un objet : « le temps » met un sablier, « la
// peur », un loup. Il compte même s’il est vide ailleurs, ou inconnu du vocabulaire : « grand-père » se montre en papi.
const LOCUTIONS = new Map([['tout le monde', 'gens'], ['sac à dos', 'randonnée']]); // « tout le monde » : des gens, pas la planète ; « sac à dos » : un sac de randonnée, pas une personne de dos
function* jetons(S, texte) {
  let avant = '', avant2 = '';
  for (const lu of mots(texte)) {
    const sujet = SUJETS.has(avant), m = LOCUTIONS.get(`${avant2} ${avant} ${lu}`) ?? lu; avant2 = avant; avant = lu;
    if ((m.length < 3 || VIDES.has(m)) && !S.symboles.has(m)) continue; // un mot court ou vide ne compte pas, sauf s’il a ses symboles : « un an »
    let i = S.index.get(m), via = null;
    if (m.includes('oe')) { const j = S.index.get(m.replace(/oe/g, 'œ')); if (j != null && (i == null || S.I[j] > S.I[i])) i = j; } // « soeur », « coeur » : sœur, cœur
    const f = S.formes?.get(m);
    if (f && (!f.ambigu || sujet) && !VIDES.has(S.liste[f.i]) && (i == null || f.ambigu || S.I[f.i] > S.I[i])) { i = f.i; via = 'forme'; }
    else if (m.length > 4 && /[sx]$/.test(m)) { const j = S.index.get(m.slice(0, -1)); if (j != null && (i == null || S.I[j] > S.I[i])) { i = j; via = 'pluriel'; } }
    const nom = i != null ? S.liste[i] : m, syms = S.symboles.get(nom) || S.symboles.get(m); // nom : le mot tel qu’on le montre, sa forme de base
    if (syms) { i = syms.find(j => S.I[j] >= OBJET) ?? syms.reduce((a, b) => (S.I[b] > S.I[a] ? b : a)); via = 'symbole'; }
    if (i != null) yield [m, i, via, nom];
  }
}
// Un mot seul : ce qu’il devient, et l’objet le plus proche ; pour mesurer ce que le catalogue couvre (outils/couverture.mjs)
export function regarder(S, mot) {
  const t = jetons(S, mot).next().value; if (!t) return { mot, i: null, via: VIDES.has(mot) ? 'vide' : null, image: 0, porteur: false, score: 0, objet: null };
  const [, i, via] = t, N = S.catalogue.length; let best = -1, j0 = -1;
  for (let j = 0; j < N; j++) { let s = 0; for (let k = 0; k < D; k++) s += S.V[i * D + k] * S.O[j * D + k]; if (s > best) { best = s; j0 = j; } }
  return { mot, i, via, lemme: S.liste[i], image: S.I[i] / 255, porteur: porteur(S, i), score: best / ECHELLE, objet: S.catalogue[j0] };
}

// Lire un passage : ses mots porteurs, son contexte, ses champs, sa tonalité, son heure, le temps qu’il fait, ce qu’on voit au loin
export function lirePage(S, texte) {
  const brut = mots(texte), n = new Map();
  let heure = null; const meteo = {}, horizon = {};
  for (const m of brut) {
    if (QUAND[m]) heure = QUAND[m];
    for (const [k, l] of Object.entries(METEO)) if (l.has(m)) meteo[k] = Math.min(1, (meteo[k] || 0) + .5);
    for (const [k, l] of Object.entries(HORIZON)) if (l.has(m)) horizon[k] = Math.min(1, (horizon[k] || 0) + .5);
  }
  const noms = new Map(); // un mot venu par son symbole garde son nom : « temps », pas « sablier »
  for (const [, i, via, nom] of jetons(S, texte)) { n.set(i, (n.get(i) || 0) + 1); if (via === 'symbole' && !noms.has(i)) noms.set(i, nom); }
  const liste = [...n].map(([i, k]) => ({ i, k, poids: (1 + Math.log(k)) * Math.log(1 + i / 60) * (porteur(S, i) ? 1 : .3) })); // les porteurs d’abord ; les autres, s’il en manque
  const choisis = liste.sort((a, b) => b.poids - a.poids).slice(0, PORTEURS);
  const max = choisis[0]?.poids || 1, pris = choisis.map(x => ({ m: noms.get(x.i) ?? S.liste[x.i], i: x.i, poids: x.poids, p: x.poids / max })); // p : de 0 à 1
  const contexte = new Float32Array(D);
  for (const x of pris) for (let k = 0; k < D; k++) contexte[k] += x.p * S.V[x.i * D + k];
  const ctx = unite(contexte), champs = {};
  for (const [k, c] of Object.entries(S.champs)) champs[k] = pris.reduce((s, x) => s + x.p * Math.max(0, scal(S.V, x.i, c) - .3), 0);
  const axe = (a, b) => { // un mot de la liste compte pleinement ; les autres, par leur voisinage
    let s = 0, t = 0;
    for (const m of brut) { if (S.tonMots[a].has(m)) { s++; t++; } else if (S.tonMots[b].has(m)) { s--; t++; } }
    for (const x of pris) { s += 2.5 * x.p * (scal(S.V, x.i, S.ton[a]) - scal(S.V, x.i, S.ton[b])); t += x.p; }
    return Math.max(-1, Math.min(1, s / Math.max(2, t)));
  };
  return { mots: pris, contexte: ctx, champs, valence: axe('plus', 'moins'), energie: axe('vif', 'lent'), heure, meteo, horizon };
}

// Les objets les plus proches des mots du passage, au-dessus d’un seuil ; un objet vu récemment est moins probable.
// candidats : le calcul lourd, qui ne dépend que du passage, et qu’on peut garder d’une fois sur l’autre
export function candidats(S, lecture, seuil = SEUIL) {
  const N = S.catalogue.length, best = new Float32Array(N), mot = new Int16Array(N).fill(-1), acc = new Float32Array(N), OT = S.OT;
  const tous = c => { acc.fill(0); for (let k = 0; k < D; k++) { const v = c(k); if (!v) continue; for (let j = 0, o = k * N; j < N; j++) acc[j] += v * OT[o + j]; } }; // un vecteur, contre tous les objets
  lecture.mots.forEach((x, w) => {
    tous(k => S.V[x.i * D + k]);
    const f = (.8 + .2 * x.p) / ECHELLE;
    for (let j = 0; j < N; j++) { const s = acc[j] * f; if (s > best[j]) { best[j] = s; mot[j] = w; } }
  });
  tous(k => lecture.contexte[k]);
  const out = [];
  for (let j = 0; j < N; j++) {
    const score = .7 * best[j] + .3 * acc[j] / 127 + .07; // le contexte du passage départage les sens d’un mot
    if (score >= seuil && mot[j] >= 0) out.push({ objet: S.catalogue[j], brut: score, mot: lecture.mots[mot[j]].m });
  }
  return out;
}
// Un objet par mot, et la place va aux autres mots. Avec une graine, celle du jour : parmi les modèles presque aussi proches
// du mot et du même rôle, un au hasard, le même pour la même page ; ceux du lieu que disent les mots, et de la saison,
// plus souvent. « maison » n’est pas toujours la même maison, ni « femme » la même femme
const graineDe = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const alea = s => { let t = graineDe(s) + 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export function objetsDeLaPage(S, lecture, { seuil = SEUIL, max = 6, recents = new Map(), jour = 0, liste = null, graine = null, saison = null } = {}) {
  const parMot = new Map();
  for (const c of liste || candidats(S, lecture, seuil)) {
    const vu = recents.get(c.objet.id), oubli = vu == null ? 1 : 1 - .8 * Math.exp(-(jour - vu) / 5), o = { ...c, score: c.brut * oubli };
    if (!parMot.has(o.mot)) parMot.set(o.mot, []); parMot.get(o.mot).push(o);
  }
  const choix = [], lieu = graine != null ? lieuDeLaPage(lecture, []) : null; // le lieu que disent les mots seuls
  for (const [mot, l] of parMot) {
    l.sort((a, b) => b.score - a.score); let o = l[0];
    if (graine != null && l.length > 1) {
      const haut = Math.max(...l.map(x => x.brut)), pool = l.filter(x => x.brut >= haut - .1 && x.objet.role === o.objet.role);
      const poids = pool.map(x => Math.exp((x.score - o.score) / .05) * (x.objet.saison && saison && x.objet.saison !== saison ? .05 : 1) // hors de sa saison, presque jamais
        * (!x.objet.lieux?.length || x.objet.lieux.includes(lieu) ? 1 : .15)); // d’un autre lieu, rarement
      let u = alea(`${graine}|${mot}`) * poids.reduce((a, b) => a + b, 0);
      for (let k = 0; k < pool.length; k++) { u -= poids[k]; if (u <= 0) { o = pool[k]; break; } }
    }
    choix.push([l[0].score, o]);
  }
  return choix.sort((a, b) => b[0] - a[0]).slice(0, max).map(([, o]) => o);
}

// Le lieu du passage : celui de ses champs, et de ses objets ; sinon celui d’avant, pour que le chemin ne saute pas
export function lieuDeLaPage(lecture, objets, veille = null) {
  const s = Object.fromEntries(Object.keys(LIEUX).map(l => { const v = LIEUX[l].map(c => lecture.champs[c] || 0), m = Math.max(...v); return [l, m + .25 * (v.reduce((a, b) => a + b, 0) - m)]; })); // le champ le plus fort, et un peu des autres
  for (const o of objets) for (const l of o.objet.lieux) if (s[l] != null) s[l] += o.objet.role === 'petit' ? .05 : .12;
  if (veille && s[veille] != null) s[veille] += .08; // un peu d’inertie
  const [lieu, v] = Object.entries(s).sort((a, b) => b[1] - a[1])[0];
  return v > .02 ? lieu : veille || 'champs';
}

/* ───────── Le découpage : un texte, quel qu’il soit, en passages d’environ 14 mots porteurs ───────── */

// Une page de journal, un chapitre de roman, un courrier : on coupe d’abord aux titres et aux séparateurs, puis entre les
// paragraphes, puis entre les phrases ; les répliques d’un dialogue restent ensemble tant qu’on peut. Une page courte reste
// d’un seul tenant ; un bout presque vide, comme une page de garde, rejoint le passage suivant, sauf s’il porte une date.
// Rend [{ texte, titre, porteurs }] : le passage, le titre qui l’ouvre s’il y en a un, et son nombre de mots porteurs.
const TITRE = /^(chapitre|chap\.|partie|livre|tome|acte|sc[eè]ne|prologue|[ée]pilogue|pr[ée]face|avant-propos|introduction|conclusion|annexe|appendice|chant)\b/i;
const DATE = /^((lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b|\d{1,2}(er)?\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\b|\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\s*:?$)/i;
const SEPARATEUR = /^(?:[*·•~=_#§.\-–—]\s*){3,}$|^§$/;
const REPLIQUE = /^\s*(—|–|-{1,2}(?!-)|«|"|“)/; // une ligne de dialogue
const LISTE = /^\s*([•*·▪◦]|\d{1,2}[.)])\s/;
const ABREV = new Set('m mm mme mmes mlle mlles mr dr st ste etc cf p pp ex av apr env tél vol chap fig éd art al no n° op'.split(' '));
const FIN = /[.!?…]+[»"”’)\]]*(?=\s)/g, VIRGULE = /[,;:](?=\s)/g;
const COUT = { paragraphe: 0, repliques: 1.6, phrase: 1, replique: 2.5, virgule: 3.5, mot: 6 };

function estTitre(b) {
  const lignes = b.split('\n'); if (lignes.length > 3 || b.length > 170) return false;
  const s = b.replace(/\s+/g, ' ').trim(), n = s.split(' ').length;
  if (/^#{1,6}\s/.test(s) || /^[IVXLCDM]+\.?$/.test(s) || /^\d{1,3}\.?$/.test(s)) return true;
  if ((TITRE.test(s) && n <= 12) || (DATE.test(s) && n <= 7)) return true;
  const lettres = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿŒœ]/g, ''), petites = lettres.replace(/[^a-zß-öø-ÿœ]/g, '').length;
  return lettres.length >= 4 && petites <= lettres.length * .15 && n <= 25 && !/[!?…]$/.test(s) && !REPLIQUE.test(s); // en capitales, à un mot près
}

export function decouper(S, texte, { budget = PORTEURS } = {}) {
  const t = (texte || '').replace(/\r\n?/g, '\n');
  // 1. les blocs : séparés par une ligne vide ; s’il n’y en a aucune, chaque ligne est un paragraphe
  const blocs = [], vide = /\n[ \t]*\n/.test(t), re = vide ? /\n[ \t]*\n\s*/g : /\n\s*/g;
  let a = 0;
  for (const m of [...t.matchAll(re), { index: t.length, 0: '' }]) {
    const brut = t.slice(a, m.index), d = a + brut.length - brut.trimStart().length, f = a + brut.trimEnd().length;
    if (f > d) blocs.push({ debut: d, fin: f, texte: t.slice(d, f) });
    a = m.index + m[0].length;
  }
  for (const b of blocs) b.genre = SEPARATEUR.test(b.texte.trim()) ? 'separateur' : estTitre(b.texte) ? 'titre' : REPLIQUE.test(b.texte) ? 'replique' : 'texte';
  if (!blocs.some(b => b.genre === 'texte' || b.genre === 'replique')) for (const b of blocs) if (b.genre === 'titre') b.genre = 'texte'; // tout en titres : c’est du texte

  // 2. les morceaux : des phrases, ou des bouts de phrase si elles sont trop longues ; et le coût d’une coupe après chacun
  const unites = []; let titres = [], force = true;
  const ajouter = (d, f, cout) => {
    if (f <= d) return;
    const ps = []; for (const [, i] of jetons(S, t.slice(d, f))) if (porteur(S, i)) ps.push(i);
    unites.push({ debut: d, fin: f, ps, cout, force: false, titre: force && titres.length ? titres.slice(-2).join(' · ') : null });
    if (force) { titres = []; force = false; }
  };
  const couper = () => { if (unites.length) unites[unites.length - 1].force = true; force = true; };
  blocs.forEach((b, n) => {
    if (b.genre === 'separateur') { couper(); return; }
    if (b.genre === 'titre') { if (!force) couper(); titres.push(b.texte.replace(/\s+/g, ' ').replace(/^#+\s*/, '').trim()); return; }
    const suivant = blocs[n + 1], fin = b.genre === 'replique' && suivant?.genre === 'replique' ? COUT.repliques : COUT.paragraphe;
    // les phrases du bloc ; une ligne de dialogue ou de liste commence toujours une phrase
    const coupes = new Set();
    for (const m of b.texte.matchAll(FIN)) {
      const p = m.index + m[0].length, apres = b.texte.slice(p).trimStart()[0];
      if (!apres || !/[A-ZÀ-ÖØ-Þ«"“—–\-(0-9]/.test(apres)) continue;
      const avant = b.texte.slice(0, m.index).match(/([A-Za-zÀ-ÿ°]+)$/)?.[1];
      if (m[0] === '.' && avant && (ABREV.has(avant.toLowerCase()) || /^[A-ZÀ-Þ]$/.test(avant))) continue; // « M. Fogg », « J. Verne »
      coupes.add(p);
    }
    for (const m of b.texte.matchAll(/\n/g)) { const reste = b.texte.slice(m.index + 1); if (REPLIQUE.test(reste) || LISTE.test(reste)) coupes.add(m.index + 1); }
    const bornes = [0, ...[...coupes].sort((x, y) => x - y), b.texte.length];
    for (let k = 0; k < bornes.length - 1; k++) {
      const d = b.debut + bornes[k], f = b.debut + bornes[k + 1], derniere = k === bornes.length - 2, cout = derniere ? fin : b.genre === 'replique' ? COUT.replique : COUT.phrase;
      // une phrase trop riche pour une seule tuile : on la coupe aux virgules, et au besoin entre deux mots
      const phrase = t.slice(d, f); let riche = 0; for (const [, i] of jetons(S, phrase)) if (porteur(S, i)) riche++;
      if (riche <= budget * 1.5) { ajouter(d, f, cout); continue; }
      const sous = [0, ...[...phrase.matchAll(VIRGULE)].map(m => m.index + 1), phrase.length];
      for (let s = 0; s < sous.length - 1; s++) {
        const sd = d + sous[s], sf = d + sous[s + 1], dernier = s === sous.length - 2, morceau = t.slice(sd, sf);
        if (mots(morceau).length <= budget * 6) { ajouter(sd, sf, dernier ? cout : COUT.virgule); continue; }
        const espaces = [...morceau.matchAll(/\s+/g)].map(m => m.index), pas = budget * 4; // sans ponctuation : tous les quelques mots
        let x = 0;
        for (let e = pas; e < espaces.length; e += pas) { ajouter(sd + x, sd + espaces[e], COUT.mot); x = espaces[e]; }
        ajouter(sd + x, sf, dernier ? cout : COUT.virgule);
      }
    }
  });
  if (!unites.length) return [];
  unites[unites.length - 1].force = true;
  for (let i = 0, d = 0; i < unites.length; i++) { // les bouts presque vides, entre deux coupes : ils rejoignent la suite
    if (!unites[i].force) continue;
    const morceau = unites.slice(d, i + 1), ps = new Set(morceau.flatMap(u => u.ps)), titre = morceau[0].titre;
    if (i < unites.length - 1 && ps.size < 3 && mots(t.slice(morceau[0].debut, unites[i].fin)).length < 40 && !(titre && DATE.test(titre))) unites[i].force = false;
    d = i + 1;
  }

  // 3. les coupes : le meilleur découpage, entre des passages proches de 14 porteurs et des coupes aux bons endroits
  const n = unites.length, meilleur = new Float64Array(n + 1).fill(Infinity), depuis = new Int32Array(n + 1), nombre = new Int32Array(n + 1);
  meilleur[0] = 0;
  for (let j = 1; j <= n; j++) {
    const vus = new Map(); let distincts = 0;
    for (let i = j - 1; i >= 0; i--) {
      if (i < j - 1 && unites[i].force) break; // jamais par-dessus un titre ou un séparateur
      for (const p of unites[i].ps) { const v = vus.get(p) || 0; if (!v) distincts++; vus.set(p, v + 1); }
      if (distincts > budget * 2 && i < j - 1) break;
      const ecart = (distincts - budget) / budget, cout = meilleur[i] + 4 * ecart * ecart + (unites[j - 1].force ? 0 : unites[j - 1].cout);
      if (cout < meilleur[j]) { meilleur[j] = cout; depuis[j] = i; nombre[j] = distincts; }
    }
  }
  const out = [];
  for (let j = n; j > 0; j = depuis[j]) {
    const i = depuis[j], us = unites.slice(i, j), texte = us.map((u, k) => (k && u.debut > us[k - 1].fin ? '\n\n' : '') + t.slice(u.debut, u.fin)).join(''); // sans les titres qu’on a sautés
    out.push({ texte, titre: us.reduce((x, u) => u.titre || x, null), porteurs: nombre[j] });
  }
  return out.reverse();
}
