// Essai de faisabilité, pas une pièce de l’app. Question : une tuile du chemin a-t-elle besoin du texte, ou seulement de ce
// que sens.js en tire ? Si une lecture suffit, l’ordinateur (ou l’extension) peut lire ses écrits du jour lui-même et
// n’envoyer au téléphone que cette lecture, plus petite et moins bavarde que le texte.
//
// Ce que calculer() (chemin/app.js) demande vraiment à une lecture, une fois les objets possibles trouvés :
//   - objetsDeLaPage(S, lecture, { liste })   ne lit que la liste des objets possibles [{ objet, brut, mot }] ;
//   - lieuDeLaPage(lecture, …)                ne lit que lecture.champs ;
//   - climatDe(lecture)                       ne lit que lecture.valence, lecture.energie, lecture.heure ;
//   - lecture.mots et lecture.contexte        ne servent qu’à trouver la liste ; ensuite plus rien ne les lit.
// D’où trois formes de lecture, de la plus bavarde à la plus mince :
//   - le texte lui-même (aujourd’hui) ;
//   - le « sac » : les mots du texte comptés, sans leur ordre (ce dont lirePage a besoin, rien de plus). Les sacs
//     s’additionnent : le sac de deux textes est la somme de leurs sacs. Le téléphone peut donc réunir exactement les
//     écrits d’un même jour venus de plusieurs appareils. Tronqué aux K mots les plus lourds, il ne dit plus que K mots ;
//   - la « lecture mince » : 14 champs, la tonalité, l’heure, et les objets possibles, chacun avec le mot qui l’appelle
//     (ou un simple numéro à la place du mot). Elle suffit pour peindre la même tuile, mais deux lectures minces ne se
//     réunissent qu’à peu près.
//
// Ce module ne touche ni à sens.js ni à app.js. Il lui manque deux choses que sens.js n’exporte pas (la liste des mots
// vides et les mots de l’heure) : on les reprend du source de sens.js, une fois, avec tokeniseur(). En vrai, sens.js
// exporterait sacDe() et lireSac(), et lirePage(S, t) deviendrait lireSac(S, sacDe(S, t)) : la même lecture, par construction.

import { D, PORTEURS, CHAMPS, porteur, candidats, lirePage } from '../../sens.js';

/* ───────── Le tokeniseur : les mêmes mots que sens.js ───────── */

const MOT = /[a-zàâäçéèêëîïôöùûüÿœæ]+(?:-[a-zàâäçéèêëîïôöùûüÿœæ]+)*/g;
const mots = texte => (texte || '').toLowerCase().replace(/[’'`´]/g, ' ').match(MOT) || [];
// reprend VIDES et QUAND dans le texte source de sens.js : une seule vérité, même pour un essai
export function tokeniseur(source) {
  const vides = source.match(/const VIDES = new Set\(`([\s\S]*?)`\.split/)?.[1], quand = source.match(/const QUAND = (\{[^\n]*\});/)?.[1];
  if (!vides || !quand) throw new Error('sens.js a changé : VIDES ou QUAND introuvables');
  return { VIDES: new Set(vides.split(/\s+/)), QUAND: Function(`"use strict"; return (${quand});`)() };
}
function* jetons(S, T, texte) { // comme jetons() dans sens.js
  for (const m of mots(texte)) {
    if (m.length < 3 || T.VIDES.has(m)) continue;
    let i = S.index.get(m);
    if (m.length > 4 && /[sx]$/.test(m)) { const j = S.index.get(m.slice(0, -1)); if (j != null && (i == null || S.I[j] > S.I[i])) i = j; }
    if (i != null) yield [m, i];
  }
}

/* ───────── Le sac : les mots comptés, et rien d’autre ───────── */

// { n: [[numéro du mot, nombre]] dans l’ordre d’apparition, ton: [[mot de tonalité, nombre]], heure }
export function sacDe(S, T, texte) {
  const n = new Map(), ton = new Map(), tons = new Set(Object.values(S.tonMots).flatMap(s => [...s]));
  let heure = null;
  for (const m of mots(texte)) { if (T.QUAND[m]) heure = T.QUAND[m]; if (tons.has(m)) ton.set(m, (ton.get(m) || 0) + 1); }
  for (const [, i] of jetons(S, T, texte)) n.set(i, (n.get(i) || 0) + 1);
  return { n: [...n], ton: [...ton], heure };
}
// la somme de plusieurs sacs, dans l’ordre : comme le sac de leurs textes mis bout à bout
export function additionner(sacs) {
  const n = new Map(), ton = new Map(); let heure = null;
  for (const s of sacs) {
    for (const [i, k] of s.n) n.set(i, (n.get(i) || 0) + k);
    for (const [m, k] of s.ton) ton.set(m, (ton.get(m) || 0) + k);
    if (s.heure) heure = s.heure;
  }
  return { n: [...n], ton: [...ton], heure };
}
const poidsDe = (S, i, k) => (1 + Math.log(k)) * Math.log(1 + i / 60) * (porteur(S, i) ? 1 : .3); // celui de lirePage
// ne garder que les K mots les plus lourds : ce qui part ne dit plus que K mots
export const tronquer = (S, sac, K = 40) => ({ ...sac, n: sac.n.map(([i, k], r) => [i, k, r, poidsDe(S, i, k)]).sort((a, b) => b[3] - a[3] || a[2] - b[2]).slice(0, K).sort((a, b) => a[2] - b[2]).map(([i, k]) => [i, k]) });

const unite = c => { let n = 0; for (const x of c) n += x * x; n = Math.sqrt(n) || 1; return c.map(x => x / n); };
const scal = (A, a, c) => { let s = 0; for (let k = 0; k < D; k++) s += A[a * D + k] * c[k]; return s / 127; };
// lirePage, à partir du sac : le même calcul, dans le même ordre
export function lireSac(S, sac) {
  const liste = sac.n.map(([i, k]) => ({ i, k, poids: poidsDe(S, i, k) }));
  const choisis = liste.sort((a, b) => b.poids - a.poids).slice(0, PORTEURS);
  const max = choisis[0]?.poids || 1, pris = choisis.map(x => ({ m: S.liste[x.i], i: x.i, poids: x.poids, p: x.poids / max }));
  const contexte = new Float32Array(D);
  for (const x of pris) for (let k = 0; k < D; k++) contexte[k] += x.p * S.V[x.i * D + k];
  const ctx = unite(contexte), champs = {};
  for (const [k, c] of Object.entries(S.champs)) champs[k] = pris.reduce((s, x) => s + x.p * Math.max(0, scal(S.V, x.i, c) - .3), 0);
  const ton = new Map(sac.ton);
  const axe = (a, b) => {
    let s = 0, t = 0;
    for (const [m, k] of ton) { if (S.tonMots[a].has(m)) { s += k; t += k; } else if (S.tonMots[b].has(m)) { s -= k; t += k; } }
    for (const x of pris) { s += 2.5 * x.p * (scal(S.V, x.i, S.ton[a]) - scal(S.V, x.i, S.ton[b])); t += x.p; }
    return Math.max(-1, Math.min(1, s / Math.max(2, t)));
  };
  return { mots: pris, contexte: ctx, champs, valence: axe('plus', 'moins'), energie: axe('vif', 'lent'), heure: sac.heure };
}

/* ───────── La lecture mince : ce que la peinture lit, rien de plus ───────── */

const NOMS_CHAMPS = Object.keys(CHAMPS), HEURES = [null, 'matin', 'midi', 'soir', 'nuit'];
// { champs: [14 nombres], valence, energie, heure, o: [[id d’objet, brut, mot ou numéro]] }
// opaque : le mot qui appelle l’objet est remplacé par un numéro ; la tuile est la même, mais on ne peut plus dire
// « les mots qui l’ont fait pousser » en touchant la tuile.
export function mince(S, lecture, { liste = candidats(S, lecture), opaque = false, max = Infinity } = {}) {
  const numeros = new Map(), o = [...liste].sort((a, b) => b.brut - a.brut).slice(0, max)
    .map(x => [x.objet.id, x.brut, opaque ? (numeros.has(x.mot) ? numeros.get(x.mot) : (numeros.set(x.mot, numeros.size), numeros.size - 1)) : x.mot]);
  return { champs: NOMS_CHAMPS.map(k => lecture.champs[k]), valence: lecture.valence, energie: lecture.energie, heure: lecture.heure, o };
}
// ce que calculer() garde dans `lus` : { lecture, liste }, refait à partir de la lecture mince
export function relireMince(F, m) {
  return {
    lecture: { champs: Object.fromEntries(NOMS_CHAMPS.map((k, n) => [k, m.champs[n]])), valence: m.valence, energie: m.energie, heure: m.heure, mots: [], contexte: null },
    liste: m.o.map(([id, brut, mot]) => ({ objet: F.parId.get(id), brut, mot: String(mot) })).filter(x => x.objet),
  };
}
// deux lectures minces du même jour, réunies à peu près : les champs et la tonalité en moyenne pondérée par la masse de
// chaque lecture, les objets possibles mis ensemble (le meilleur score de chacun), l’heure de la plus récente
export function reunirMinces(liste) {
  const masse = m => Math.max(1e-6, m.champs.reduce((a, b) => a + b, 0)), tot = liste.reduce((a, m) => a + masse(m), 0);
  const o = new Map();
  liste.forEach((m, n) => { for (const [id, brut, mot] of m.o) if (!o.has(id) || o.get(id)[1] < brut) o.set(id, [id, brut, typeof mot === 'number' ? `${n}:${mot}` : mot]); });
  return {
    champs: NOMS_CHAMPS.map((_, k) => liste.reduce((a, m) => a + m.champs[k] * masse(m), 0) / tot),
    valence: liste.reduce((a, m) => a + m.valence * masse(m), 0) / tot,
    energie: liste.reduce((a, m) => a + m.energie * masse(m), 0) / tot,
    heure: liste.reduce((h, m) => m.heure || h, null),
    o: [...o.values()],
  };
}

/* ───────── En octets : pour un QR code, un fichier, ou une enveloppe scellée ───────── */

// version 1 : [1][heure][valence f64][énergie f64][14 champs f32][nb objets u16][(numéro d’objet u16, brut f32, mot u8)…][nb mots][(longueur, utf-8)…]
// Les champs et les scores passent en float32 sans rien changer aux tuiles. La tonalité, non : la teinte du ciel en est
// tirée telle quelle et entre dans la clé de la tuile ; arrondie en float32, la tuile changerait de clé (essai, partie 1).
// La liste des objets possibles part entière : tronquée, même aux 40 meilleurs, quelques tuiles changent, parce qu’un
// objet déjà vu la veille cède sa place à un autre, plus loin dans la liste.
export function emballer(m, catalogue) {
  const ids = new Map(catalogue.map((o, n) => [o.id, n])), table = [], numero = new Map();
  const refs = m.o.map(([, , mot]) => { if (typeof mot === 'number') return mot; if (!numero.has(mot)) { numero.set(mot, table.length); table.push(mot); } return numero.get(mot); });
  const txt = table.map(t => new TextEncoder().encode(t)), taille = 2 + 16 + 4 * 14 + 2 + 7 * m.o.length + 1 + txt.reduce((a, t) => a + 1 + t.length, 0);
  const b = new ArrayBuffer(taille), v = new DataView(b); let p = 0;
  v.setUint8(p++, 1); v.setUint8(p++, HEURES.indexOf(m.heure)); v.setFloat64(p, m.valence); p += 8; v.setFloat64(p, m.energie); p += 8;
  for (const c of m.champs) { v.setFloat32(p, c); p += 4; }
  v.setUint16(p, m.o.length); p += 2;
  m.o.forEach(([id, brut], n) => { v.setUint16(p, ids.get(id)); p += 2; v.setFloat32(p, brut); p += 4; v.setUint8(p++, refs[n]); });
  v.setUint8(p++, txt.length); for (const t of txt) { v.setUint8(p++, t.length); new Uint8Array(b, p, t.length).set(t); p += t.length; }
  return new Uint8Array(b);
}
export function deballer(octets, catalogue) {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength); let p = 0;
  if (v.getUint8(p++) !== 1) throw new Error('lecture mince : version inconnue');
  const heure = HEURES[v.getUint8(p++)], valence = v.getFloat64(p); p += 8; const energie = v.getFloat64(p); p += 8;
  const champs = []; for (let k = 0; k < 14; k++) { champs.push(v.getFloat32(p)); p += 4; }
  const n = v.getUint16(p), brut = []; p += 2;
  for (let k = 0; k < n; k++) { const id = catalogue[v.getUint16(p)].id; p += 2; const b = v.getFloat32(p); p += 4; brut.push([id, b, v.getUint8(p++)]); }
  const t = v.getUint8(p++), table = [];
  for (let k = 0; k < t; k++) { const l = v.getUint8(p++); table.push(new TextDecoder().decode(octets.subarray(p, p + l))); p += l; }
  return { champs, valence, energie, heure, o: brut.map(([id, b, r]) => [id, b, table.length ? table[r] : r]) };
}

// pour l’essai : lirePage, réexporté, pour comparer
export { lirePage };
