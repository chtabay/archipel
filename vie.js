// L’archipel : la vie qui ne dit rien. Des bêtes qui se promènent sur l’île, choisies par le paysage, jamais par une
// confession : des moutons en prairie, des poules près des maisons, des crabes sur le sable, un renard en automne,
// des lièvres dans la lande, des rouges-gorges dans la neige, des papillons. Chacune va d’une place libre à une autre,
// s’arrête, broute, picore, flaire, saute. Elles évitent les cases où quelque chose a poussé. Le mouvement réduit les
// laisse en place. Les bêtes elles-mêmes sont dessinées dans modeles.js : la famille des animaux les partage.
// Et le ciel : des oiseaux du paysage, qui tournent, planent, plongent ou passent en V (plus bas).

import * as THREE from './vendor/three.min.js?v=1';
import { N, solVu } from './ile.js?v=13';
import { BETES, bete, activite, oiseau, poseAiles } from './modeles.js?v=17';
import { rng, hash } from './outils.js?v=1';

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

/* ───────── Le ciel ───────── */
// Des oiseaux choisis par le paysage, seulement sous un ciel clair : des mouettes qui tournent au-dessus de l’île, planent,
// battent des ailes par moments et s’inclinent dans les virages ; des goélands dans la neige ; des frégates très haut, qui
// planent sans presque battre ; des fous de Bassan qui plongent dans la mer ; des oies qui passent en V, puis reviennent
// d’ailleurs. Leur ombre passe sur l’île, jamais sur la mer, où elle ferait un oiseau sombre de plus. Le mouvement réduit les
// laisse en vol plané, immobiles.

const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function orienter(b, p, q, s) { // l’oiseau en p, tourné vers q ; il s’incline dans le virage qui mène à s, et lève le bec quand il monte
  const dx = q[0] - p[0], dz = q[2] - p[2], hor = Math.hypot(dx, dz) || 1e-6, cap = Math.atan2(dx, dz), d = Math.atan2(s[0] - q[0], s[2] - q[2]) - cap, vire = Math.atan2(Math.sin(d), Math.cos(d));
  b.grp.position.set(p[0], p[1], p[2]); b.grp.rotation.set(-Math.atan2(q[1] - p[1], hor) * .7, cap, Math.max(-.7, Math.min(.7, -vire * 14)));
}
function battre(b, vol, dt, envie) { // envie : 1 pour battre, 0 pour planer ; l’amplitude suit en douceur. Renvoie le petit rebond du corps
  vol.amp += (envie - vol.amp) * Math.min(1, dt * 2.5); vol.phase += dt * b.bat * 6.283;
  const A = vol.amp;
  poseAiles(b, b.pose[0] * (1 - A) + A * (.12 + .55 * Math.sin(vol.phase)), b.pose[1] * (1 - A) + A * .35 * Math.sin(vol.phase - 1.1));
  return -A * Math.sin(vol.phase) * .012; // le corps monte quand les ailes descendent
}
const CHUTE = 1, SOUS = .9, POSE = .8, ENVOL = 3; // les temps d’un plongeon : la chute, sous l’eau, posé sur l’eau, l’envol
function plonger(b, vol, T, dt, route) { // le fou replie ses ailes, pique, disparaît dans une gerbe, flotte un instant, puis rejoint sa route
  const P = vol.plonge, t = T - P.t0, cap = Math.atan2(P.u[0], P.u[1]), x = P.p[0] + P.u[0] * b.vitesse * CHUTE * .5, z = P.p[2] + P.u[1] * b.vitesse * CHUTE * .5;
  if (t < CHUTE) {
    const f = t / CHUTE, d = b.vitesse * t * (1 - f * .5);
    b.grp.position.set(P.p[0] + P.u[0] * d, Math.max(.02, P.p[1] * (1 - f * f)), P.p[2] + P.u[1] * d); b.grp.rotation.set(lisse(0, .45, t) * 1.3, cap, 0);
    vol.amp = 0; poseAiles(b, .05, -.05, lisse(0, .4, t)); return;
  }
  if (!P.gerbe) { P.gerbe = true; vol.gerbe?.jouer(x, z, T); }
  if (t < CHUTE + SOUS) { b.grp.visible = false; return; }
  b.grp.visible = true;
  if (t < CHUTE + SOUS + POSE) { b.grp.position.set(x, .02, z); b.grp.rotation.set(0, cap, 0); poseAiles(b, .3, .4, .85); return; } // posé sur l’eau, les ailes repliées
  const t1 = P.t0 + CHUTE + SOUS + POSE, at = tt => { const k = lisse(0, ENVOL, tt - t1), c = route(tt); return [x + (c[0] - x) * k, .02 + (c[1] - .02) * Math.min(1, k * 1.3), z + (c[2] - z) * k]; };
  if (t >= CHUTE + SOUS + POSE + ENVOL) { vol.plonge = null; vol.prochain = T + 12 + vol.r() * 14; }
  const p = at(T), bond = battre(b, vol, dt, 1); orienter(b, p, at(T + .1), at(T + .2)); b.grp.position.y += bond;
}
function tourner(b, r, rayon, haut, eau, gerbe, ombrer) { // de grands cercles qui dérivent au-dessus de l’île ; un fou, lui, tourne au-dessus de la mer
  const R = rayon * (b.plonge ? .85 + r() * .3 : .5 + r() * .45), sens = r() < .5 ? 1 : -1, w = sens * b.vitesse * (.85 + r() * .3) / R, a0 = r() * 6.283, ph = r() * 60;
  const cx = (r() - .5) * rayon * .4, cz = (r() - .5) * rayon * .4, y0 = haut + (b.haut || 0) + r() * .6;
  const route = t => { const a = a0 + w * t; return [cx + Math.cos(a) * R + Math.sin(t * .07 + ph) * 1.4, y0 + Math.sin(t * .23 + ph) * .35, cz + Math.sin(a) * R + Math.cos(t * .05 + ph) * 1.4]; };
  const vol = { amp: 0, phase: r() * 6, dernier: null, plonge: null, prochain: 6 + r() * 12, r, gerbe };
  return T => {
    const dt = vol.dernier === null ? 0 : Math.min(.05, Math.max(0, T - vol.dernier)); vol.dernier = T;
    if (immobile) { orienter(b, route(0), route(.1), route(.2)); poseAiles(b, ...b.pose); ombrer(b); return; }
    if (b.plonge && !vol.plonge && T > vol.prochain) { // il plonge s’il survole la mer, un peu devant lui
      const p = route(T), q = route(T + .1), l = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1, u = [(q[0] - p[0]) / l, (q[2] - p[2]) / l];
      if (eau(p[0] + u[0] * .7, p[2] + u[1] * .7)) vol.plonge = { t0: T, p, u }; else vol.prochain = T + 2;
    }
    if (vol.plonge) { plonger(b, vol, T, dt, route); return ombrer(b); }
    const p = route(T), q = route(T + .1), envie = ((T + ph) * .16) % 1 > b.plane || q[1] - p[1] > .012 ? 1 : 0; // planer le plus souvent ; battre par moments, et pour monter
    const bond = battre(b, vol, dt, envie); orienter(b, p, q, route(T + .2)); b.grp.position.y += bond; ombrer(b);
  };
}
function gerbe() { // l’eau qui gicle quand un fou plonge : une colonne d’écume, des gouttes qui retombent, un anneau qui s’élargit
  const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const anneau = new THREE.Mesh(new THREE.RingGeometry(.55, 1, 24).rotateX(-Math.PI / 2), mat), colonne = new THREE.Mesh(new THREE.ConeGeometry(.09, 1, 7).translate(0, .5, 0), mat), goutte = new THREE.IcosahedronGeometry(.045, 0);
  const gouttes = Array.from({ length: 9 }, (_, i) => { const m = new THREE.Mesh(goutte, mat); grp.add(m); return { m, an: i * .7, v: 1.2 + (i % 3) * .35, l: .35 + (i % 2) * .2 }; });
  grp.add(anneau, colonne); grp.traverse(o => { o.renderOrder = 2; }); grp.visible = false; let t0 = null; // après la mer, pour ne pas passer dessous
  return { grp,
    jouer(x, z, T) { t0 = T; grp.position.set(x, .025, z); grp.visible = true; },
    anim: T => {
      if (t0 === null) return;
      const t = T - t0; if (t > 2) { grp.visible = false; t0 = null; return; }
      anneau.scale.setScalar(.08 + t * .45); mat.opacity = (1 - t / 2) * .9;
      colonne.scale.set(1, Math.max(.001, Math.sin(Math.min(1, t / .7) * Math.PI) * .5), 1);
      for (const g of gouttes) { const y = g.v * t - 3 * t * t; g.m.visible = y > 0; g.m.position.set(Math.cos(g.an) * t * g.l, y, Math.sin(g.an) * t * g.l); }
    } };
}
function passer(vol, r, rayon, haut, ombrer) { // un vol d’oies en V : il traverse le ciel, se perd au loin, puis revient d’ailleurs
  const L = rayon * 3.2, v = vol[0].vitesse, duree = 2 * L / v, cycle = duree + 8 + r() * 10, t0 = r() * cycle, g = Math.floor(r() * 1e5);
  const places = vol.map((b, i) => { const rang = Math.ceil(i / 2); return [(i % 2 ? 1 : -1) * rang * .44, -rang * .38, rang]; }); // de côté, en arrière, le rang dans le V
  return T => {
    const n = immobile ? 0 : Math.floor((T + t0) / cycle), t = immobile ? duree / 2 : (T + t0) % cycle, dans = t < duree;
    const cap = hash(`oies:${g}:${n}`) * 6.283, ecart = (hash(`ecart:${g}:${n}`) - .5) * rayon, fx = Math.sin(cap), fz = Math.cos(cap), d = -L + v * t, taille = Math.max(0, Math.min(1, t / 3, (duree - t) / 3));
    vol.forEach((b, i) => {
      b.grp.visible = dans; if (!dans) return;
      const [cote, arriere, rang] = places[i];
      b.grp.position.set(fx * (d + arriere) + fz * (ecart + cote), haut - rang * .03 + (immobile ? 0 : Math.sin(T * 1.1 + i * .9) * .05), fz * (d + arriere) - fx * (ecart + cote));
      b.grp.rotation.set(0, cap, 0); b.grp.scale.setScalar(taille); // il grandit en arrivant, et s’efface en partant
      if (immobile) poseAiles(b, .3, .1); else { const s = T * b.bat * 6.283 - rang * .8; poseAiles(b, .12 + .5 * Math.sin(s), .3 * Math.sin(s - 1.1)); } // les battements passent le long du V
      ombrer(b);
    });
  };
}
// liste : [[espèce, nombre]…] ; rayon : le cercle des oiseaux autour du centre ; haut : leur hauteur ; h : le relief, pour que les fous
// plongent dans la mer et jamais sur l’île ; soleil : sa direction, pour savoir où tombe l’ombre. Renvoie un groupe à poser dans la
// scène, et ses animations.
export function ciel(liste, { rayon = 6.5, haut = 3.4, h = null, soleil = null, graine = 1 } = {}) {
  const grp = new THREE.Group(), anims = [], r = rng(graine * 7 + 3), eau = (x, z) => !h || h(x + N / 2, z + N / 2) < -.3;
  const ombrer = b => { // l’ombre, seulement si elle tombe sur la terre
    const p = b.grp.position, k = soleil ? Math.max(0, p.y - .4) / soleil.y : 0, v = !!(h && soleil && b.grp.visible) && h(p.x - soleil.x * k + N / 2, p.z - soleil.z * k + N / 2) > .05;
    if (v !== b.ombre) { b.ombre = v; b.grp.traverse(o => { if (o.isMesh) o.castShadow = v; }); }
  };
  for (const [espece, n] of liste || []) {
    if (espece === 'oie') { const vol = Array.from({ length: n }, () => oiseau('oie')); for (const b of vol) grp.add(b.grp); anims.push(passer(vol, r, rayon, haut + (vol[0].haut || 0), ombrer)); continue; }
    for (let k = 0; k < n; k++) {
      const b = oiseau(espece), g = b.plonge ? gerbe() : null; grp.add(b.grp);
      if (g) { grp.add(g.grp); anims.push(g.anim); }
      anims.push(tourner(b, r, rayon, haut, eau, g, ombrer));
    }
  }
  grp.traverse(o => { o.raycast = () => {}; }); // on ne touche pas les oiseaux
  return { grp, anims };
}
