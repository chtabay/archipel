// L’archipel : la vie qui ne dit rien. Des bêtes qui se promènent sur l’île, choisies par le paysage, jamais par une
// confession : des moutons en prairie, des poules près des maisons, des crabes sur le sable, un renard en automne,
// des lièvres dans la lande, des rouges-gorges dans la neige, des papillons. Chacune va d’une place libre à une autre,
// s’arrête, broute, picore, flaire, saute. Elles évitent les cases où quelque chose a poussé. Le mouvement réduit les
// laisse en place.

import * as THREE from './vendor/three.min.js?v=1';
import { N, sol } from './ile.js?v=7';
import { Bati, F, G, cone, baton } from './modeles.js?v=9';
import { rng } from './outils.js?v=1';

const immobile = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const bati = g => ({ b: new Bati(g), s: 1 });
function monter(kb, kt, pivot, o) { // le corps, et la tête sur son pivot, pour qu’elle bouge seule
  const grp = new THREE.Group(); grp.add(kb.b.maillage());
  let tete = null; if (kt) { tete = kt.b.maillage(); tete.position.set(...pivot); grp.add(tete); }
  return { grp, tete, ...o };
}

/* ───────── Les bêtes : chacune regarde vers +z, posée en y = 0 ───────── */

function mouton(g) { // laineux, la tête sombre qui broute, quatre pattes
  const kb = bati(g), kt = bati(g + 1), n = '#3a322f';
  F(kb, G.ico1, '#f3efe4', { y: .17, sx: .11, sy: .095, sz: .15, bosse: .16, graine: g, ao: .3 });
  F(kb, G.ico1, '#faf7f0', { y: .2, z: .01, sx: .085, sy: .07, sz: .11, bosse: .18, graine: g + 3, ao: .2 });
  for (const [x, z] of [[-.055, -.07], [.055, -.07], [-.055, .06], [.055, .06]]) F(kb, G.box, n, { x, y: .06, z, sx: .026, sy: .12, sz: .026, ao: .3 });
  F(kt, G.ico0, n, { y: -.01, z: .02, sx: .04, sy: .045, sz: .05, ao: .1 });
  for (const c of [-1, 1]) F(kt, G.box, n, { x: c * .04, y: .01, sx: .035, sy: .012, sz: .02, ry: c * .3, ao: 0 }); // les oreilles
  F(kt, G.ico0, '#f3efe4', { y: .03, z: -.005, s: .028, ao: 0 }); // une touffe sur la tête
  return monter(kb, kt, [0, .19, .13], { vitesse: .12, rayon: 1.1, pause: [2, 5], sols: ['herbe'], act: 'broute' });
}
function poule(g) { // blanche ou rousse, la crête, le bec, la queue ; elle picore
  const kb = bati(g), kt = bati(g + 1), c = g % 2 ? '#f5f0e6' : '#c8703c', q = g % 2 ? '#3a322f' : '#7a4630';
  F(kb, G.ico0, c, { y: .075, sx: .045, sy: .042, sz: .06, ao: .3 });
  F(kb, G.tetra, q, { y: .1, z: -.06, sx: .03, sy: .04, sz: .03, rx: -.6, ao: 0 });
  for (const x of [-.015, .015]) baton(kb, [x, 0, 0], [x, .05, 0], .005, .005, '#e0a848', 4);
  F(kt, G.sph, c, { s: .024, ao: 0 }); F(kt, G.box, '#e8452e', { y: .026, sx: .008, sy: .018, sz: .02, ao: 0 }); F(kt, cone(4), '#f2a63c', { z: .03, sx: .008, sy: .02, sz: .008, rx: Math.PI / 2, ao: 0 }); F(kt, G.box, '#e8452e', { y: -.014, z: .018, sx: .006, sy: .012, sz: .006, ao: 0 });
  return monter(kb, kt, [0, .11, .045], { vitesse: .08, rayon: .7, pause: [1, 3], sols: ['herbe', 'sable'], act: 'picore' });
}
function crabe(g) { // plat, deux pinces, six pattes, deux yeux ; il va de côté
  const kb = bati(g), c = '#e8552e', s = '#c9431f';
  F(kb, G.ico0, c, { y: .028, sx: .05, sy: .02, sz: .036, ao: .2 });
  for (const d of [-1, 1]) {
    F(kb, G.ico0, c, { x: d * .055, y: .028, z: .025, sx: .022, sy: .014, sz: .02, ao: 0 });
    for (let i = 0; i < 3; i++) F(kb, G.box, s, { x: d * (.05 + i * .004), y: .014, z: -.02 + i * .016, sx: .03, sy: .006, sz: .006, rz: d * .5, ao: 0 });
    F(kb, G.sph, '#2a1f1c', { x: d * .012, y: .045, z: .028, s: .006, ao: 0 });
  }
  return monter(kb, null, null, { vitesse: .15, rayon: .8, pause: [1, 3], sols: ['sable'], act: 'cote' });
}
function renard(g) { // roux, le poitrail et le bout de la queue blancs, les oreilles pointues ; il trotte et flaire
  const kb = bati(g), kt = bati(g + 1), o = '#e07a30', w = '#f6e9d8', n = '#3a2a22';
  F(kb, G.ico1, o, { y: .13, sx: .06, sy: .065, sz: .13, bosse: .1, graine: g, ao: .3 }); F(kb, G.ico1, w, { y: .1, z: .06, sx: .04, sy: .04, sz: .05, ao: .2 });
  F(kb, G.ico1, o, { y: .12, z: -.16, sx: .035, sy: .035, sz: .09, bosse: .12, graine: g + 2, rx: -.35, ao: .2 }); F(kb, G.ico0, w, { y: .14, z: -.23, s: .025, ao: 0 });
  for (const [x, z] of [[-.03, -.06], [.03, -.06], [-.03, .07], [.03, .07]]) F(kb, G.box, n, { x, y: .05, z, sx: .02, sy: .1, sz: .02, ao: .3 });
  F(kt, G.ico0, o, { sx: .04, sy: .035, sz: .045, ao: .1 }); F(kt, cone(5), w, { y: -.008, z: .045, sx: .015, sy: .035, sz: .012, rx: Math.PI / 2, ao: 0 }); F(kt, G.sph, n, { y: -.006, z: .064, s: .007, ao: 0 });
  for (const c of [-1, 1]) F(kt, G.tetra, o, { x: c * .022, y: .035, z: -.005, sx: .014, sy: .028, sz: .012, ao: 0 });
  return monter(kb, kt, [0, .17, .12], { vitesse: .25, rayon: 1.6, pause: [1.5, 4], sols: ['herbe'], act: 'flaire' });
}
function lievre(g, B) { // brun, ou blanc dans la neige ; les longues oreilles ; il se tient, puis saute
  const kb = bati(g), kt = bati(g + 1), blanc = B.enneige, c = blanc ? '#f2eee8' : '#a88a6c', s = blanc ? '#d9d4cc' : '#8a6e52';
  F(kb, G.ico1, c, { y: .07, sx: .05, sy: .06, sz: .085, bosse: .12, graine: g, ao: .3 }); F(kb, G.sph, '#ffffff', { y: .08, z: -.085, s: .018, ao: 0 });
  for (const [x, z] of [[-.028, -.04], [.028, -.04]]) F(kb, G.ico0, s, { x, y: .03, z, sx: .02, sy: .025, sz: .04, ao: .2 });
  for (const [x, z] of [[-.02, .05], [.02, .05]]) F(kb, G.box, s, { x, y: .02, z, sx: .012, sy: .04, sz: .012, ao: .2 });
  F(kt, G.ico0, c, { sx: .032, sy: .03, sz: .04, ao: .1 }); for (const d of [-1, 1]) F(kt, G.sph, '#2a1f1c', { x: d * .014, y: .008, z: .025, s: .005, ao: 0 });
  for (const d of [-1, 1]) F(kt, G.box, c, { x: d * .012, y: .05, z: -.01, sx: .012, sy: .07, sz: .006, rz: d * -.15, rx: -.2, ao: 0 });
  return monter(kb, kt, [0, .11, .06], { vitesse: .5, rayon: 1.3, pause: [2, 5], sols: ['herbe'], act: 'saute', saut: true });
}
function rougegorge(g) { // tout petit, la gorge rouge ; il sautille
  const kb = bati(g), kt = bati(g + 1), b = '#8a6a4a', r = '#e8552e', q = '#5e4632';
  F(kb, G.sph, b, { y: .03, sx: .018, sy: .018, sz: .026, ao: .2 }); F(kb, G.sph, r, { y: .024, z: .012, sx: .015, sy: .014, sz: .016, ao: 0 }); F(kb, G.box, q, { y: .036, z: -.03, sx: .012, sy: .004, sz: .022, rx: .3, ao: 0 });
  for (const x of [-.006, .006]) baton(kb, [x, 0, 0], [x, .02, 0], .002, .002, q, 3);
  F(kt, G.sph, b, { s: .014, ao: 0 }); F(kt, G.sph, r, { y: -.005, z: .008, s: .01, ao: 0 }); F(kt, cone(4), '#3a2a22', { z: .018, sx: .004, sy: .012, sz: .004, rx: Math.PI / 2, ao: 0 });
  return monter(kb, kt, [0, .045, .02], { vitesse: .3, rayon: .8, pause: [1, 3], sols: ['herbe', 'roche', 'neige'], act: 'saute', saut: true });
}
function papillon(g, B, couleurs = ['#ffd166', '#ffffff']) { // deux ailes qui battent, d’une couleur du paysage ; il vole autour d’une place
  const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: couleurs[g % couleurs.length], side: THREE.DoubleSide });
  const aile = () => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.012, 0, 0, .014, .03, 0, .006, 0, 0, -.012, .03, 0, .006, .022, 0, -.02], 3)); return new THREE.Mesh(geo, mat); };
  const ag = aile(), ad = aile(); ad.scale.x = -1; grp.add(ag, ad);
  return { grp, ailes: [ag, ad], vole: true, rayon: .5, sols: ['herbe', 'sable'] };
}
export const BETES = { mouton, poule, crabe, renard, lievre, rougegorge, papillon };
const SOLS = { mouton: ['herbe'], poule: ['herbe', 'sable'], crabe: ['sable'], renard: ['herbe'], lievre: ['herbe'], rougegorge: ['herbe', 'roche', 'neige'], papillon: ['herbe', 'sable'] }; // où chaque bête se tient
const TAILLES = { mouton: 1.3, poule: 1.45, crabe: 1.5, renard: 1.15, lievre: 1.35, rougegorge: 1.7, papillon: 1.3 }; // un peu plus grandes que nature, pour se voir

/* ───────── Aller et venir ───────── */

function activite(b, T, arret) { // ce que fait une bête à l’arrêt, et en chemin
  const t = b.tete; if (!t) return;
  let rx = 0, ry = 0;
  if (b.act === 'broute') rx = arret ? .85 + Math.sin(T * 5) * .08 : .1;
  else if (b.act === 'picore') rx = arret ? (Math.sin(T * 7) > .2 ? .7 : 0) : Math.sin(T * 12) * .15;
  else if (b.act === 'flaire') rx = arret ? .45 + Math.sin(T * 3) * .1 : .05;
  else if (b.act === 'saute') ry = arret ? Math.sin(T * .8) * .6 : 0;
  t.rotation.x += (rx - t.rotation.x) * .12; t.rotation.y += (ry - t.rotation.y) * .12;
}
function promener(b, x0, z0, hy, va, r) { // d’une place à l’autre, dans un rayon autour de la sienne ; entre deux, un arrêt
  const o = b.grp;
  let x = x0, z = z0, cx = x0, cz = z0, dernier = null, attente = 1 + r() * 3, ang = r() * 6.28, phase = 0;
  o.position.set(x, hy(x, z), z); o.rotation.y = ang;
  const viser = () => { for (let e = 0; e < 8; e++) { const a = r() * 6.28, d = .3 + r() * b.rayon, nx = x0 + Math.cos(a) * d, nz = z0 + Math.sin(a) * d; if (va(nx, nz, b.sols)) { cx = nx; cz = nz; return true; } } return false; };
  return T => {
    const dt = dernier === null ? 0 : Math.min(.05, Math.max(0, T - dernier)); dernier = T;
    if (immobile) { activite(b, T, true); return; }
    if (attente > 0) { attente -= dt; activite(b, T, true); if (attente <= 0 && !viser()) attente = 2; return; }
    const dx = cx - x, dz = cz - z, dist = Math.hypot(dx, dz);
    if (dist < .015) { attente = b.pause[0] + r() * (b.pause[1] - b.pause[0]); return; }
    const pas = Math.min(dist, b.vitesse * dt); x += dx / dist * pas; z += dz / dist * pas;
    const vers = Math.atan2(dx, dz), da = Math.atan2(Math.sin(vers - ang), Math.cos(vers - ang)); ang += da * Math.min(1, dt * 6);
    let y = hy(x, z);
    if (b.saut) { phase += dt * 9; y += Math.abs(Math.sin(phase)) * .05; }
    o.position.set(x, y, z); o.rotation.y = b.act === 'cote' ? ang + Math.PI / 2 : ang;
    activite(b, T, false);
  };
}
function voler(b, x0, z0, hy, r) { // un papillon : des boucles autour de sa place, les ailes qui battent
  const ph = r() * 6.28, R = .15 + r() * .25, v = .5 + r() * .4, alt = .12 + r() * .1;
  return T => {
    if (immobile) { b.grp.position.set(x0, hy(x0, z0) + alt, z0); b.ailes[0].rotation.z = .4; b.ailes[1].rotation.z = -.4; return; }
    const a = T * v + ph, x = x0 + Math.cos(a) * R + Math.sin(T * 1.7 + ph) * .1, z = z0 + Math.sin(a * .8) * R;
    b.grp.position.set(x, hy(x, z) + alt + Math.sin(T * 3 + ph) * .04, z); b.grp.rotation.y = -a;
    const f = Math.sin(T * 14 + ph) * .9; b.ailes[0].rotation.z = f; b.ailes[1].rotation.z = -f;
  };
}

/* ───────── L’île qui vit ───────── */

// d : l’île dérivée ; B : son paysage ; h : le relief (x, z) en tuiles. Renvoie un groupe à poser comme les choses, et ses animations.
export function vie(d, B, h) {
  const grp = new THREE.Group(), anims = [], m = d.m, r = rng(d.ile.seed * 3 + 5);
  const occ = new Set(d.assets.map(a => a.tile[0] * N + a.tile[1])); if (d.phareTile) occ.add(d.phareTile[0] * N + d.phareTile[1]);
  const maisons = d.assets.filter(a => a.famille === 'maison' && (a.espece === 'maison' || a.espece === 'volets'));
  const hy = (x, z) => h(x + N / 2, z + N / 2);
  const va = (x, z, sols) => { const i = Math.floor(x + N / 2), j = Math.floor(z + N / 2); return i >= 0 && j >= 0 && i < N && j < N && !!m.land[i * N + j] && !occ.has(i * N + j) && sols.includes(sol(m, i, j)) && hy(x, z) > .1; }; // une place où aller : de la terre, du bon sol, rien dessus, pas la rive
  const prises = new Set();
  const place = (sols, pres) => { // une case libre, de préférence à côté de pres
    const l = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (m.land[i * N + j] && !occ.has(i * N + j) && !prises.has(i * N + j) && sols.includes(sol(m, i, j)) && (!pres || (Math.abs(i - pres[0]) <= 1 && Math.abs(j - pres[1]) <= 1))) l.push([i, j]);
    if (!l.length) return null;
    const t = l[Math.floor(r() * l.length)]; prises.add(t[0] * N + t[1]); return t;
  };
  for (const [kind, n, couleurs] of B.vie || []) for (let k = 0; k < n; k++) {
    const g = Math.floor(r() * 1e6) + 1, pres = kind === 'poule' ? maisons[k % maisons.length]?.tile : null;
    if (kind === 'poule' && !maisons.length) break; // des poules, seulement près d’une maison
    const t = place(SOLS[kind], pres);
    if (!t) continue;
    const b = BETES[kind](g, B, couleurs), x0 = t[0] + .3 + r() * .4 - N / 2, z0 = t[1] + .3 + r() * .4 - N / 2;
    b.grp.scale.setScalar(TAILLES[kind] || 1); b.grp.traverse(o => { o.raycast = () => {}; }); // on ne touche pas les bêtes
    grp.add(b.grp); anims.push(b.vole ? voler(b, x0, z0, hy, r) : promener(b, x0, z0, hy, va, r));
  }
  return { grp, anims };
}
