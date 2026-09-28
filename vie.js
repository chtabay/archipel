// L’archipel : la vie qui ne dit rien. Des bêtes qui se promènent sur l’île, choisies par le paysage, jamais par une
// confession : des moutons en prairie, des poules près des maisons, des crabes sur le sable, un renard en automne,
// des lièvres dans la lande, des rouges-gorges dans la neige, des papillons. Chacune va d’une place libre à une autre,
// s’arrête, broute, picore, flaire, saute. Elles évitent les cases où quelque chose a poussé. Le mouvement réduit les
// laisse en place. Les bêtes elles-mêmes sont dessinées dans modeles.js : la famille des animaux les partage.

import * as THREE from './vendor/three.min.js?v=1';
import { N, solVu } from './ile.js?v=10';
import { BETES, bete, activite } from './modeles.js?v=13';
import { rng } from './outils.js?v=1';

const immobile = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAILLES = { mouton: 1.3, poule: 1.45, crabe: 1.5, renard: 1.15, lievre: 1.35, rougegorge: 1.7, papillon: 1.3 }; // un peu plus grandes que nature, pour se voir

function papillon(g, B, couleurs = ['#ffd166', '#ffffff']) { // deux ailes qui battent, d’une couleur du paysage ; il vole autour d’une place
  const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: couleurs[g % couleurs.length], side: THREE.DoubleSide });
  const aile = () => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.012, 0, 0, .014, .03, 0, .006, 0, 0, -.012, .03, 0, .006, .022, 0, -.02], 3)); return new THREE.Mesh(geo, mat); };
  const ag = aile(), ad = aile(); ad.scale.x = -1; grp.add(ag, ad);
  return { grp, ailes: [ag, ad], vole: true, rayon: .5, sols: ['herbe', 'sable'] };
}

/* ───────── Aller et venir ───────── */

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
  const va = (x, z, sols) => { const i = Math.floor(x + N / 2), j = Math.floor(z + N / 2); return i >= 0 && j >= 0 && i < N && j < N && !!m.land[i * N + j] && !occ.has(i * N + j) && sols.includes(solVu(m, i, j, h(i + .5, j + .5))) && hy(x, z) > .1; }; // une place où aller : de la terre, du bon sol, rien dessus, pas la rive
  const prises = new Set();
  const place = (sols, pres) => { // une case libre, de préférence à côté de pres
    const l = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (m.land[i * N + j] && !occ.has(i * N + j) && !prises.has(i * N + j) && sols.includes(solVu(m, i, j, h(i + .5, j + .5))) && (!pres || (Math.abs(i - pres[0]) <= 1 && Math.abs(j - pres[1]) <= 1))) l.push([i, j]);
    if (!l.length) return null;
    const t = l[Math.floor(r() * l.length)]; prises.add(t[0] * N + t[1]); return t;
  };
  for (const [kind, n, couleurs] of B.vie || []) for (let k = 0; k < n; k++) {
    const g = Math.floor(r() * 1e6) + 1, pres = kind === 'poule' ? maisons[k % maisons.length]?.tile : null;
    if (kind === 'poule' && !maisons.length) break; // des poules, seulement près d’une maison
    const t = place(kind === 'papillon' ? ['herbe', 'sable'] : BETES[kind].sols, pres);
    if (!t) continue;
    const b = kind === 'papillon' ? papillon(g, B, couleurs) : bete(kind, g, B), x0 = t[0] + .3 + r() * .4 - N / 2, z0 = t[1] + .3 + r() * .4 - N / 2;
    b.grp.scale.setScalar(TAILLES[kind] || 1); b.grp.traverse(o => { o.raycast = () => {}; }); // on ne touche pas les bêtes qui passent
    grp.add(b.grp); anims.push(b.vole ? voler(b, x0, z0, hy, r) : promener(b, x0, z0, hy, va, r));
  }
  return { grp, anims };
}
