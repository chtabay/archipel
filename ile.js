// L’archipel : l’île. La carte, le placement des choses, l’île recalculée depuis ses dépôts, les îles inventées de l’archipel.
// Aucun dessin ici : le relief, la mer et la lumière sont dans monde.js, les choses dans modeles.js, les paysages dans biomes.js.

import { pousser, especeDe } from './grammaire.js?v=4';
import { KEYS, MOCK } from './contenu.js?v=2';
import { rng, hash, melange } from './outils.js?v=1';
import { BIOMES, BIOME_IDS, biomeDe } from './biomes.js?v=3';

export { BIOMES, BIOME_IDS, biomeDe };
export const N = 10; // tuiles par côté
const unpack = obj => Object.fromEntries(KEYS.map(k => [k, new Set(obj?.[k] || [])]));

// Le climat suit la dernière confession : le ciel, l’eau, et s’il y a des oiseaux.
export const CLIMATS = {
  N: { ciel: ['#8dcff0', '#e4f4fb'], eau: '#46bcd9', oiseaux: true },
  AS: { ciel: ['#9edbf6', '#effafd'], eau: '#4fc7e3', oiseaux: true },
  ES: { ciel: ['#f8d0a4', '#fdeedd'], eau: '#83c3d4', oiseaux: true },
  AD: { ciel: ['#f4a98a', '#7b6cae'], eau: '#4a8bb0', oiseaux: false },
  ED: { ciel: ['#b8c4dc', '#f1ede9'], eau: '#7eadc2', oiseaux: false },
};
export const eauDe = (climat, B) => { const c = (CLIMATS[climat] || CLIMATS.N).eau; return B.eau ? melange(c, B.eau, .55) : c; };

/* ───────── La carte ───────── */

const cartes = new Map();
const voisins = (i, j) => [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N);
export function carte(seed) {
  if (cartes.has(seed)) return cartes.get(seed);
  const r = rng(seed), c = (N - 1) / 2;
  const h = new Float32Array(N * N), land = new Uint8Array(N * N), noise = Array.from({ length: N * N }, () => r());
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j, d = Math.hypot((i - c) / c, (j - c) / c), n = noise[k], edge = .93 + (n - .5) * .32;
    if (d > edge) { h[k] = -1; continue; }
    land[k] = 1;
    let z = .18 + (edge - d) * 1.05 + (n - .5) * .22;
    z += Math.max(0, 1 - Math.hypot((i - N * .27) / (N * .32), (j - N * .27) / (N * .32))) * 1.35; // la colline, au nord
    h[k] = Math.max(.15, z);
  }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { // pas de tuile seule, pas de trou
    const k = i * N + j, v = voisins(i, j).filter(([a, b]) => land[a * N + b]).length;
    if (land[k] && v < 2) { land[k] = 0; h[k] = -1; } else if (!land[k] && v >= 3 && i > 0 && j > 0 && i < N - 1 && j < N - 1) { land[k] = 1; h[k] = .22; }
  }
  const vh = new Float32Array((N + 1) * (N + 1));
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    let s = 0, k = 0;
    for (const [di, dj] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N || !land[ii * N + jj]) continue; s += h[ii * N + jj]; k++; }
    vh[i * (N + 1) + j] = k ? (s / k) * (.88 + r() * .24) : 0;
  }
  const m = { N, h, vh, land, seed, rive: [], decor: [] };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!land[i * N + j] && voisins(i, j).some(([a, b]) => land[a * N + b])) m.rive.push([i, j]);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (land[i * N + j]) for (let k = 0; k < 3; k++) m.decor.push([i, j, .18 + r() * .64, .18 + r() * .64, r(), r()]); // des places pour le décor
  cartes.set(seed, m);
  return m;
}
export const sol = (m, i, j) => { const z = m.h[i * N + j]; return z < 0 ? 'eau' : z < .34 ? 'sable' : z < 1.3 ? 'herbe' : z < 2.05 ? 'roche' : 'neige'; };
export const solVu = (m, i, j, y) => { const t = sol(m, i, j); return t === 'sable' && y > .28 ? 'herbe' : t; }; // le sol tel qu’on le voit : le haut d’une falaise est de l’herbe, même sur une tuile de sable (y : la hauteur du relief)

/* ───────── L’île grandit : la terre s’étend à chaque dépôt ───────── */
// La carte ci-dessus est l’île pleine, celle d’après beaucoup de dépôts. Une île commence petite, au centre, et s’étend
// tuile après tuile, toujours d’un seul tenant. La terre ne fait que s’ajouter : ce qui a poussé reste où il est.

export const tuilesPour = (depots, choses) => 12 + 5 * depots + choses; // la taille d’une île dit ce qu’on y a déposé
const ordres = new Map();
function ordre(seed) { // l’ordre où les tuiles apparaissent : du centre vers le bord, un peu au hasard
  if (ordres.has(seed)) return ordres.get(seed);
  const m = carte(seed), c = (N - 1) / 2, R = Float32Array.from({ length: N * N }, (_, k) => Math.hypot(Math.floor(k / N) - c, (k % N) - c) + (hash(`${seed}:rang:${k}`) - .5) * 1.4);
  let depart = -1;
  for (let k = 0; k < N * N; k++) if (m.land[k] && (depart < 0 || R[k] < R[depart])) depart = k;
  const pris = new Uint8Array(N * N), out = [], bord = new Set(depart < 0 ? [] : [depart]);
  while (bord.size) {
    let k = -1; for (const x of bord) if (k < 0 || R[x] < R[k]) k = x;
    bord.delete(k); pris[k] = 1; out.push(k);
    for (const [a, b] of voisins(Math.floor(k / N), k % N)) { const kk = a * N + b; if (m.land[kk] && !pris[kk]) bord.add(kk); }
  }
  ordres.set(seed, out);
  return out;
}
export const tuilesPleines = seed => ordre(seed).length;
const etapes = new Map();
export function etape(seed, L) { // l’île avec ses L premières tuiles : son relief, sa rive, ses places pour le décor
  const o = ordre(seed), n = Math.max(1, Math.min(o.length, Math.round(L))), cle = `${seed}:${n}`;
  if (etapes.has(cle)) return etapes.get(cle);
  const land = new Uint8Array(N * N); for (let t = 0; t < n; t++) land[o[t]] = 1;
  const dist = new Int16Array(N * N).fill(99), file = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { // la distance à l’eau ; le bord de la grille compte comme de l’eau
    const k = i * N + j;
    if (!land[k]) { dist[k] = 0; file.push(k); } else if (i === 0 || j === 0 || i === N - 1 || j === N - 1) { dist[k] = 1; file.push(k); }
  }
  for (let q = 0; q < file.length; q++) { const k = file[q]; for (const [a, b] of voisins(Math.floor(k / N), k % N)) { const kk = a * N + b; if (dist[kk] > dist[k] + 1) { dist[kk] = dist[k] + 1; file.push(kk); } } }
  const h = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j;
    if (!land[k]) { h[k] = -1; continue; }
    const dc = Math.max(1, dist[k]), colline = Math.max(0, 1 - Math.hypot((i - N * .27) / (N * .32), (j - N * .27) / (N * .32))); // la colline, au nord, loin du rivage
    h[k] = Math.max(.15, .18 + (dc - 1) * .24 + (hash(`${seed}:h:${k}`) - .5) * .22 + colline * 1.35 * Math.min(1, (dc - 1) / 2));
  }
  const vh = new Float32Array((N + 1) * (N + 1));
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    let t = 0, c = 0;
    for (const [di, dj] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N || !land[ii * N + jj]) continue; t += h[ii * N + jj]; c++; }
    vh[i * (N + 1) + j] = c ? (t / c) * (.88 + hash(`${seed}:v:${i}:${j}`) * .24) : 0;
  }
  const m = { N, h, vh, land, seed, rive: [], decor: [], taille: n, rayon: 0, dist }; // dist : la distance au rivage, en tuiles, pour le relief
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j;
    if (!land[k]) { if (voisins(i, j).some(([a, b]) => land[a * N + b])) m.rive.push([i, j]); continue; }
    m.rayon = Math.max(m.rayon, Math.hypot(i + .5 - N / 2, j + .5 - N / 2) + .5);
    for (let e = 0; e < 3; e++) { const x = f => hash(`${seed}:d:${k}:${e}:${f}`); m.decor.push([i, j, .18 + x(1) * .64, .18 + x(2) * .64, x(3), x(4)]); } // des places pour le décor, stables
  }
  etapes.set(cle, m);
  return m;
}

/* ───────── Le placement : les quartiers ───────── */

const QUARTIERS = { foret: [N * .28, N * .72], colline: [N * .26, N * .26], village: [N * .7, N * .7], champs: [N * .72, N * .3], centre: [N * .5, N * .5], lisiere: [N * .3, N * .5] };
function zoneDe(a) {
  const e = a.espece;
  if (a.famille === 'meteo') return e === 'etang' ? ['bas', ['herbe', 'sable']] : e === 'fleurs' ? ['pre', ['herbe']] : ['ciel', ['herbe', 'sable', 'roche']];
  if (e === 'caillou') return ['plage', ['sable']];
  if (a.famille === 'arbre') return ['foret', ['herbe', 'roche']];
  if (a.famille === 'pierre') return ['colline', ['roche', 'herbe', 'sable', 'neige']];
  if (a.famille === 'maison') return ['village', ['herbe', 'sable']];
  if (a.famille === 'animal') return ['pre', ['herbe']];
  if (a.famille === 'buisson') return ['lisiere', ['herbe', 'roche', 'sable']];
  if (e === 'barque') return ['rive', ['eau']];
  return ['champs', ['herbe', 'sable']];
}
function placer(m, occ, a, r) {
  const [zone, sols] = zoneDe(a);
  const centre = QUARTIERS[zone] || (zone === 'plage' || zone === 'bas' ? [N * .55, N * .62] : zone === 'pre' ? [N * .5, N * .5] : QUARTIERS.champs);
  const cand = [];
  if (zone === 'rive') for (const [i, j] of m.rive) cand.push([i, j, Math.hypot(i - N * .75, j - N * .5) + r() * 1.5]);
  else for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (!m.land[i * N + j]) continue;
    const s = sol(m, i, j), z = m.h[i * N + j];
    if (!sols.includes(s)) continue;
    if (zone === 'plage' && s !== 'sable') continue;
    if (zone === 'bas' && z > .6) continue;
    if ((zone === 'village' || zone === 'champs') && z > 1.25) continue;
    let d = Math.hypot(i - centre[0], j - centre[1]) + r() * 1.6;
    if (zone === 'colline') d -= z * 1.2; // les pierres montent
    if (zone === 'plage') d += Math.abs(i + j - N) * .2;
    cand.push([i, j, d]);
  }
  cand.sort((p, q) => p[2] - q[2]);
  const libre = cand.find(([i, j]) => !occ.has(i * N + j));
  if (libre) return [libre[0], libre[1]];
  if (cand.length && zone !== 'rive') { // le quartier est plein : la case libre la plus proche, plutôt que deux choses l’une sur l’autre
    let proche = null, dp = Infinity;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const d = Math.hypot(i - centre[0], j - centre[1]); if (m.land[i * N + j] && !occ.has(i * N + j) && d < dp) { dp = d; proche = [i, j]; } }
    if (proche) return proche;
  }
  if (cand.length) return [cand[0][0], cand[0][1]]; // les barques se serrent au rivage ; ou l’île est pleine
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (m.land[i * N + j] && !occ.has(i * N + j)) return [i, j];
  return [Math.floor(N / 2), Math.floor(N / 2)];
}
const bout = (m, occ) => { // la pointe de sable la plus au sud-est, libre : la place du phare
  let best = null, bd = -1;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (m.land[i * N + j] && !occ.has(i * N + j) && sol(m, i, j) === 'sable' && i + j > bd) { bd = i + j; best = [i, j]; }
  if (best) return best;
  for (let i = N - 1; i >= 0; i--) for (let j = N - 1; j >= 0; j--) if (m.land[i * N + j] && !occ.has(i * N + j)) return [i, j];
  return [N - 2, N - 2];
};

/* ───────── L’île : de ses dépôts à ses choses ───────── */

export const nouvelleIle = (biome = 'prairie') => ({ id: Date.now(), seed: Math.floor(Math.random() * 1e9) + 1, nee: new Date().toISOString(), biome, depots: [], envoyee: false, quittee: null });

// Recalcule tout depuis les dépôts, dans l’ordre. Chaque dépôt étend la terre, puis ce qu’il fait pousser se place
// sur l’île telle qu’elle est à ce moment-là : les positions ne bougent pas quand on ajoute.
// pleine : l’île entière, quels que soient ses dépôts (pour les aperçus des paysages et les îles au loin).
export function deriver(ile, { pleine = false } = {}) {
  const etat = { assets: [], phare: null, climat: 'N' }, occ = new Set(), r = rng(ile.seed + 11);
  const carteApres = k => etape(ile.seed, pleine ? tuilesPleines(ile.seed) : tuilesPour(k, etat.assets.length));
  let dernier = null;
  ile.depots.forEach((d, k) => {
    dernier = pousser(etat, d, unpack(d.answers));
    const m = carteApres(k + 1);
    for (const a of etat.assets) if (!a.tile) { a.tile = placer(m, occ, a, r); if (a.famille !== 'meteo' || a.espece === 'etang') occ.add(a.tile[0] * N + a.tile[1]); }
  });
  const m = carteApres(ile.depots.length);
  for (const a of etat.assets) if (a.espece === 'barque' && m.land[a.tile[0] * N + a.tile[1]]) { // la terre a gagné sur l’eau : la barque retourne au rivage
    occ.delete(a.tile[0] * N + a.tile[1]); a.tile = placer(m, occ, a, r); occ.add(a.tile[0] * N + a.tile[1]);
  }
  const phareTile = etat.phare ? bout(m, occ) : null;
  const ecrits = new Set(ile.depots.filter(d => d.texte).map(d => d.id)); // les dépôts qui avaient un texte : une lanterne chacun
  for (const a of etat.assets) a.textes = a.depots.filter(id => ecrits.has(id)).length;
  return { ...etat, ile, m, phareTile, dernier };
}

// Ce qui serait transmis à l’archipel : des comptes, une sensation moyenne, le paysage choisi. Jamais un texte.
export function resume(d) {
  const comptes = {};
  for (const a of d.assets) { const e = especeDe(a); comptes[e] = (comptes[e] || 0) + 1; }
  const qs = d.ile.depots.map(x => x.quad).filter(Boolean);
  const a = qs.length ? qs.reduce((s, q) => s + (q[0] === 'A' ? .85 : q === 'N' ? .45 : .2), 0) / qs.length : .45;
  const v = qs.length ? qs.reduce((s, q) => s + (q[1] === 'S' ? .85 : q === 'N' ? .4 : .2), 0) / qs.length : .4;
  return { comptes, a, v, n: d.assets.length, phare: !!d.phare, climat: d.climat, paysage: d.ile.biome || 'prairie', taille: d.m.taille };
}

/* ───────── La forme : ce que l’archipel partagé reçoit ───────── */
// Seulement ce que la 3D dessine : le paysage, la graine du relief, la taille, le ciel, et chaque chose avec sa case,
// sa taille, ses états visibles et ses lanternes. Jamais un mot, une case cochée, un sujet, une date.
// La variante de chaque chose se tire de ce qui se voit déjà, jamais de sa clé : la clé et la graine ensemble diraient le sujet.
// Les choses partent rangées par case : l’ordre des dépôts, ni celui des sujets, ne se lit pas.

export function forme(d) {
  return {
    paysage: d.ile.biome || 'prairie', graine: d.ile.seed, taille: d.m.taille, climat: d.climat || 'N', phare: d.phareTile || null,
    choses: d.assets.map(a => ({
      famille: a.famille, espece: a.espece, stade: a.stade, case: a.tile, textes: Math.min(3, a.textes || 0),
      v: +hash(`${a.famille}:${a.espece}:${a.tile.join()}:${d.ile.seed}`).toFixed(4),
      etats: [...Object.keys(a.etats || {}).filter(k => a.etats[k]).sort(), ...(a.espece === 'volets' && a.quad?.[1] !== 'S' ? ['clos'] : [])],
    })).sort((p, q) => p.case[0] - q.case[0] || p.case[1] - q.case[1] || (p.famille + p.espece).localeCompare(q.famille + q.espece)),
  };
}
export function depuisForme(f, id) { // une île de l’archipel, redessinée depuis sa forme
  const assets = f.choses.map((c, k) => ({ key: `forme:${k}`, v: c.v, famille: c.famille, espece: c.espece, stade: c.stade, tile: c.case, textes: c.textes, depots: [], quad: c.etats.includes('clos') ? 'ED' : 'ES', etats: Object.fromEntries(c.etats.filter(e => e !== 'clos').map(e => [e, true])) }));
  return { assets, phare: !!f.phare, climat: f.climat, ile: { id, seed: f.graine, biome: f.paysage, depots: [] }, m: etape(f.graine, f.taille), phareTile: f.phare, dernier: null };
}

/* ───────── Les îles inventées ───────── */
// Pour l’intro seulement : des dépôts au hasard, passés par la même grammaire, dans un paysage au hasard.

const SUJETS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14'];
const MOTS = { AD: ['colere', 'peur', 'angoisse', 'rage'], ED: ['honte', 'tristesse', 'vide', 'fatigue', 'culpa', 'solitude'], AS: ['envie', 'espoir'], ES: ['soulagement', 'calme'] };
export function ileInventee(seed, quad) {
  // la graine passe par un hachage : des graines voisines donneraient sinon les mêmes premiers tirages, donc des îles pareilles
  const r = rng(1 + Math.floor(hash(`inventee:${seed}`) * 2147483645)), ile = { id: seed, seed, nee: '', biome: BIOME_IDS[Math.floor(hash(`paysage:${seed}`) * BIOME_IDS.length)], depots: [], envoyee: true, quittee: null, autre: true };
  const n = 1 + Math.floor(r() ** 1.4 * 8);
  for (let k = 0; k < n; k++) {
    const q = r() < .75 ? quad : ['AD', 'ED', 'AS', 'ES'][Math.floor(r() * 4)];
    const answers = { situ: [], mots: [MOTS[q][Math.floor(r() * MOTS[q].length)]], sujets: [], fait: [], subi: [] };
    if (r() < .85) answers.sujets.push(SUJETS[Math.floor(r() * SUJETS.length)]);
    if (r() < .25) answers.sujets.push(SUJETS[Math.floor(r() * SUJETS.length)]);
    for (const [id, p] of [['longtemps', .35], ['jamais', .3], ['boucle', .3], ['regret', .3], ['mal', .2], ['recent', .2]]) if (r() < p) answers.situ.push(id);
    if (answers.situ.includes('mal') && r() < .6) answers.subi.push(['slong', 'scont', 'sparle', 'sresp'][Math.floor(r() * 4)]);
    if (answers.situ.includes('regret') && r() < .6) answers.fait.push(['flong', 'fplus', 'fsouff', 'frep', 'fpense'][Math.floor(r() * 5)]);
    ile.depots.push({ id: k + 1, quad: q, texte: r() < .5, answers });
  }
  return ile;
}

export function archipelInvente(n = 62) {
  const r = rng(31), out = [];
  const parts = Object.entries(MOCK.quad), total = parts.reduce((s, [, v]) => s + v, 0);
  for (let k = 0; k < n; k++) {
    let t = r() * total, q = 'ED';
    for (const [qq, v] of parts) { if (t < v) { q = qq; break; } t -= v; }
    const a = (q[0] === 'A' ? .5 : 0) + r() * .5, v = (q[1] === 'S' ? .5 : 0) + r() * .5;
    out.push({ ile: ileInventee(1000 + k * 37, q), a, v, ph: r() * 6.28, born: -10 });
  }
  return out;
}
