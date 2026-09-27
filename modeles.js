// L’archipel : les choses de l’île, en 3D. Des volumes à facettes, colorés par sommet, fusionnés en peu de maillages.
// Chaque famille, espèce, taille et état de la grammaire a sa forme, et chaque paysage ses variantes.
// Unité : une tuile = 1. Chaque chose est construite à son pied, en (0, 0, 0).

import * as THREE from './vendor/three.min.js?v=1';
import { BIOMES } from './biomes.js?v=1';

const B0 = BIOMES.prairie;
const choix = (liste, v) => liste[Math.floor(Math.max(0, Math.min(.9999, v)) * liste.length) % liste.length];
const rngL = seed => { let s = Math.abs(Math.floor(seed)) % 2147483647 || 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const FLEURS = { prairie: ['#ff6b6b', '#ffd166', '#ff9ecf', '#ffffff', '#b08cff'], automne: ['#ff8e3c', '#ffd166', '#e0552e', '#fff1c1'], tropique: ['#ff4d6d', '#ff8e3c', '#ffd166', '#ff9ecf'], neige: ['#ffffff', '#cfe3ff', '#ffd6e5'], lande: ['#b08cff', '#d7b8ff', '#ffffff', '#ffd166'] };
const idDe = B => Object.keys(BIOMES).find(k => BIOMES[k] === B) || 'prairie';
export const PIERRES = { sombre: ['#7a7486', '#575166', '#3d3948'], moussue: ['#b3b0a6', '#928f85', '#716e66'], cairn: ['#d9d2c3', '#b9b1a1', '#958d7e'], galet: ['#eee8dc', '#d4cbbb', '#b6ad9c'], pierre: ['#c3bfb6', '#a29e95', '#807c74'], caillou: ['#e6e0d4', '#c9c1b2', '#a9a092'] };
const BOIS = ['#c79a63', '#a3784a', '#7f5a36'];

/* ───────── Les matériaux ───────── */

export const MAT = {
  base: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8, metalness: 0 }), // un peu de reflet du soleil sur les facettes
  lum: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), // ce qui éclaire : fenêtres, flammes, lanternes
  propose: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, metalness: 0, transparent: true, opacity: .45, depthWrite: false }),
  fond: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), // sous l’eau : la couleur telle quelle, sans facettes ni mappage ; le climat la règle d’avance
};
let _glow = null;
export function texGlow() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.22, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}
export function halo(couleur = '#ffd98a', taille = .6, opacite = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), color: couleur, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacite }));
  s.scale.set(taille, taille, 1);
  return s;
}

/* ───────── L’assembleur ───────── */

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
function bosseler(g, amp, graine) { // des bosses stables : un même sommet bouge toujours de la même façon, sans fissure
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hash3(Math.round(x * 1e3) / 1e3 + graine, Math.round(y * 1e3) / 1e3, Math.round(z * 1e3) / 1e3) * 2 - 1) * amp; p.setXYZ(i, x * k, y * k, z * k); }
}
export class Bati { // on y pose des formes colorées ; on les fusionne en un seul maillage
  constructor(graine = 1) { this.pos = []; this.col = []; this.r = rngL(graine); }
  forme(geo, couleur, t = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (t.bosse) bosseler(g, t.bosse, t.graine || 1);
    _e.set(t.rx || 0, t.ry || 0, t.rz || 0); _q.setFromEuler(_e);
    const s = t.s ?? 1; _s.set(t.sx ?? s, t.sy ?? s, t.sz ?? s); _p.set(t.x || 0, t.y || 0, t.z || 0);
    _m.compose(_p, _q, _s); g.applyMatrix4(_m);
    const p = g.attributes.position.array, n = p.length / 9;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 1; i < p.length; i += 3) { if (p[i] < ymin) ymin = p[i]; if (p[i] > ymax) ymax = p[i]; }
    _c.set(couleur);
    const varie = t.varie ?? .07, ao = t.ao ?? .28; // ao : le bas de chaque forme, un peu plus sombre
    for (let f = 0; f < n; f++) {
      const yc = (p[f * 9 + 1] + p[f * 9 + 4] + p[f * 9 + 7]) / 3, k = (1 + (this.r() - .5) * 2 * varie) * (1 - ao + ao * (ymax > ymin ? (yc - ymin) / (ymax - ymin) : 1));
      for (let v = 0; v < 9; v++) this.pos.push(p[f * 9 + v]);
      for (let v = 0; v < 3; v++) this.col.push(_c.r * k, _c.g * k, _c.b * k);
    }
    g.dispose();
    return this;
  }
  triangles(pos, cols) { for (const v of pos) this.pos.push(v); for (const v of cols) this.col.push(v); return this; } // pour le sol
  vide() { return !this.pos.length; }
  geometrie(plat = false) { // plat : toutes les normales vers le haut, pour le fond de l’eau
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (plat) { const n = new Float32Array(this.pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); } else g.computeVertexNormals();
    g.computeBoundingSphere(); return g;
  }
  maillage(mat = MAT.base, ombre = true, plat = false) { const m = new THREE.Mesh(this.geometrie(plat), mat); m.castShadow = ombre; m.receiveShadow = true; return m; }
}

/* ───────── Les formes de base ───────── */

const G = { ico0: new THREE.IcosahedronGeometry(1, 0), ico1: new THREE.IcosahedronGeometry(1, 1), dode: new THREE.DodecahedronGeometry(1, 0), tetra: new THREE.TetrahedronGeometry(1, 0), octa: new THREE.OctahedronGeometry(1, 0), box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 8, 6), sphL: new THREE.SphereGeometry(1, 12, 8) };
const CY = new Map(), CO = new Map();
const cyl = (rt, rb, n = 7) => { const k = `${rt}:${rb}:${n}`; if (!CY.has(k)) CY.set(k, new THREE.CylinderGeometry(rt, rb, 1, n)); return CY.get(k); }; // hauteur 1, centrée
const cone = (n = 7) => { if (!CO.has(n)) CO.set(n, new THREE.ConeGeometry(1, 1, n)); return CO.get(n); };
function prisme() { // un toit : faîte le long de X, base en y = 0, largeur, profondeur et hauteur 1
  const A = [-.5, 0, -.5], B2 = [.5, 0, -.5], C2 = [.5, 0, .5], D2 = [-.5, 0, .5], E = [-.5, 1, 0], F2 = [.5, 1, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([D2, C2, F2, D2, F2, E, B2, A, E, B2, E, F2, A, D2, E, C2, B2, F2].flat(), 3));
  return g;
}
G.prisme = prisme();
for (const g of Object.values(G)) g._partage = true; // des formes partagées : on ne les libère jamais
for (const m of Object.values(MAT)) m._partage = true;

// Tout passe par F : la chose est posée avec un décalage (dx, dy, dz) et une échelle (s), pour les doubles, les bosquets, les hameaux.
function F(k, geo, col, t = {}, bati = k.b) {
  const s = k.s ?? 1, ts = t.s ?? 1;
  bati.forme(geo, col, { ...t, x: (t.x || 0) * s + (k.dx || 0), y: (t.y || 0) * s + (k.dy || 0), z: (t.z || 0) * s + (k.dz || 0), sx: (t.sx ?? ts) * s, sy: (t.sy ?? ts) * s, sz: (t.sz ?? ts) * s, s: undefined });
}
const FL = (k, geo, col, t) => F(k, geo, col, t, k.lum);
function baton(k, a, b, r0, r1, col, n = 5, bati = k.b) { // un cylindre d’un point à un autre
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _d.length(); _d.normalize();
  _q.setFromUnitVectors(_up, _d); _e.setFromQuaternion(_q, 'XYZ');
  F(k, cyl(r1, r0, n), col, { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2, rx: _e.x, ry: _e.y, rz: _e.z, sx: 1, sy: len, sz: 1, ao: 0 }, bati);
}
const touffe = (k, x, z, B) => { const c = B.enneige ? '#ffffff' : B.sol.herbe[2]; for (const [dx, dz, rz, rx] of [[0, 0, .25, 0], [.02, .015, -.2, .2], [-.02, .01, 0, -.25]]) F(k, cone(4), c, { x: x + dx, y: .045, z: z + dz, sx: .012, sy: .09, sz: .012, rz, rx, ao: .4 }); };

/* ───────── Les arbres ───────── */

function tronc(k, h, r, col = '#8a5a3c') { F(k, cyl(r * .72, r, 6), col, { y: h / 2, sy: h, ao: .35 }); }
function boule(k, x, y, z, r, col, g = 1, sy = .92) { F(k, G.ico1, col, { x, y, z, s: r, sy: r * sy, bosse: .13, graine: g, ao: .45 }); }
function creux(k, y) { F(k, G.sph, '#3a2a1f', { y, z: .075, sx: .05, sy: .08, sz: .025, ao: 0 }); } // jamais dit : un creux dans le tronc
function unArbre(k, a, v) {
  const B = k.B, e = a.espece;
  if (e === 'pin') {
    const forme = choix(B.pin.formes, v), t = B.pin.tons[0];
    tronc(k, .32, .065);
    if (forme === 'cypres') { F(k, G.ico1, t[1], { y: .82, sx: .2, sy: .64, sz: .2, bosse: .06, graine: v * 9, ao: .45 }); if (B.enneige) F(k, G.ico1, '#ffffff', { y: 1.26, sx: .1, sy: .14, sz: .1 }); }
    else {
      const n = forme === 'elance' ? 5 : 3;
      for (let l = 0; l < n; l++) {
        const r = forme === 'elance' ? .3 - l * .05 : .44 - l * .11, h = forme === 'elance' ? .34 : .48, y = .26 + l * (forme === 'elance' ? .19 : .27);
        F(k, cone(7), t[l % 2 ? 1 : 0], { y: y + h / 2, sx: r, sy: h, sz: r, ry: l * .45 + v * 3, ao: .5 });
        if (B.enneige) F(k, cone(7), '#ffffff', { y: y + h * .78, sx: r * .5, sy: h * .45, sz: r * .5, ry: l * .45 + v * 3, ao: 0 });
      }
    }
    if (a.etats.ferme) creux(k, .14);
    return;
  }
  if (e === 'nu') {
    const autre = v > .5, c = '#7d6a5e';
    baton(k, [0, 0, 0], [0, .95, 0], .075, .035, c, 6);
    const br = autre ? [[[0, .42, 0], [.3, .74, .08]], [[0, .58, 0], [-.28, .88, -.06]], [[0, .8, 0], [.1, 1.12, -.12]], [[.2, .63, .05], [.33, .82, .2]]] : [[[0, .45, 0], [-.34, .8, .05]], [[0, .6, 0], [.3, .92, -.08]], [[0, .9, 0], [-.1, 1.18, .08]], [[0, .9, 0], [.14, 1.16, -.1]], [[-.18, .64, .02], [-.28, .86, -.15]]];
    for (const [p0, p1] of br) { baton(k, p0, p1, .03, .012, c, 5); if (B.enneige) baton(k, [p0[0], p0[1] + .025, p0[2]], [p1[0], p1[1] + .02, p1[2]], .018, .008, '#ffffff', 4); }
    if (B.feuillesNues) for (const [x, y, z, col] of [[-.33, .8, .05, '#f08a2c'], [.3, .9, -.06, '#e5603a'], [.12, 1.12, -.1, '#f2b93e']]) F(k, G.tetra, col, { x, y, z, s: .045, rx: x * 5, ao: 0 });
    if (a.etats.ferme) creux(k, .3);
    return;
  }
  const cfg = e === 'fleuri' ? B.fleuri : B.feuillu, forme = choix(cfg.formes, v), t = choix(cfg.tons, (v * 7.31) % 1), g = v * 11;
  if (forme === 'palmier') {
    const lean = (v < .5 ? -1 : 1) * .24, ang = v * 6.28, ca = Math.cos(ang), sa = Math.sin(ang), pt = u => [lean * u * u * ca, 1.15 * u, lean * u * u * sa];
    for (let s = 0; s < 6; s++) baton(k, pt(s / 6), pt((s + 1) / 6), .065 - s * .006, .06 - s * .006, s % 2 ? '#b48a5c' : '#9c7249', 6);
    const top = pt(1);
    for (let f = 0; f < 7; f++) {
      const an = (f / 7) * 6.28 + v * 2, dx = Math.cos(an), dz = Math.sin(an), m1 = [top[0] + dx * .3, top[1] + .06, top[2] + dz * .3], m2 = [top[0] + dx * .56, top[1] - .16, top[2] + dz * .56];
      baton(k, top, m1, .05, .04, t[f % 3], 4); baton(k, m1, m2, .04, .008, t[(f + 1) % 3], 4);
    }
    for (let c = 0; c < 3; c++) F(k, G.sph, '#7a5233', { x: top[0] + Math.cos(c * 2.1) * .06, y: top[1] - .07, z: top[2] + Math.sin(c * 2.1) * .06, s: .045, ao: 0 });
    return;
  }
  if (forme === 'bouleau') {
    F(k, cyl(.035, .05, 6), '#efece4', { y: .5, sy: 1, ao: .15 });
    for (let s = 0; s < 5; s++) F(k, G.box, '#3a3530', { y: .12 + s * .17, z: .042, sx: .05, sy: .014, sz: .01, ry: s, ao: 0 });
    baton(k, [0, .55, 0], [-.2, .76, .04], .02, .012, '#e8e3d9'); baton(k, [0, .7, 0], [.18, .9, -.03], .02, .012, '#e8e3d9');
    for (const [x, y, z, r] of [[-.05, .72, .06, .15], [.2, .78, -.04, .14], [-.2, .84, -.02, .17], [.14, .96, .05, .17], [0, 1.1, 0, .2]]) boule(k, x, y, z, r, t[(x * 10 & 3) % 3], g + x);
    return;
  }
  if (forme === 'peuplier') { tronc(k, .32, .06); F(k, G.ico1, t[1], { y: .92, sx: .25, sy: .64, sz: .25, bosse: .09, graine: g, ao: .45 }); F(k, G.ico1, t[0], { x: -.06, y: 1.1, z: .05, sx: .15, sy: .36, sz: .15, bosse: .1, graine: g + 1, ao: .3 }); }
  else if (forme === 'etage') { tronc(k, .8, .07); [[.52, .46, 0], [.76, .37, 1], [.97, .25, 2]].forEach(([y, r, i]) => { F(k, G.ico1, t[i], { y, sx: r, sy: r * .36, sz: r, bosse: .12, graine: g + i, ao: .55 }); if (B.enneige) F(k, G.ico1, '#ffffff', { y: y + r * .16, sx: r * .7, sy: r * .16, sz: r * .7, bosse: .1, graine: g + i + 5, ao: 0 }); }); }
  else if (forme === 'hibiscus') { tronc(k, .32, .06); for (const [x, y, z, r, i] of [[-.18, .5, .06, .24, 0], [.19, .52, -.05, .23, 1], [0, .74, 0, .3, 2], [.02, .45, -.16, .2, 0]]) boule(k, x, y, z, r, t[i], g + i); }
  else { tronc(k, .46, .08); for (const [x, y, z, r, i] of [[0, .8, 0, .36, 1], [-.21, .62, .1, .26, 0], [.21, .66, -.08, .27, 2], [.03, .99, .04, .25, 0], [-.05, .7, -.2, .22, 1]]) boule(k, x, y, z, r, t[i], g + i); if (B.enneige) F(k, G.ico1, '#ffffff', { y: 1.1, sx: .22, sy: .1, sz: .22, bosse: .1, graine: g + 7, ao: 0 }); }
  if (e === 'fleuri' || forme === 'hibiscus') { const r = rngL(g * 100 + 3), pal = forme === 'hibiscus' ? ['#ff4d6d', '#ff4d6d', '#ffd166'] : ['#ffffff', '#fff4f7']; for (let i = 0; i < 12; i++) { const an = r() * 6.28, h = .5 + r() * .5, rr = .24 + r() * .14; F(k, G.ico0, pal[i % pal.length], { x: Math.cos(an) * rr, y: h, z: Math.sin(an) * rr, s: .035, ao: 0 }); } }
  if (a.etats.ferme) creux(k, .22);
}
function arbre(a, k) {
  const v = k.v, st = a.stade, s0 = k.s ?? 1;
  if (st >= 3) for (const [dx, dz, s, dv] of [[-.26, -.12, .72, .37], [.25, -.16, .68, .71], [.02, .12, 1, 0]]) unArbre({ ...k, dx: (k.dx || 0) + dx * s0, dz: (k.dz || 0) + dz * s0, s: s0 * s }, a, (v + dv) % 1);
  else unArbre({ ...k, s: s0 * [.62, .85, 1.1][st] }, a, v);
  touffe(k, -.22 * s0 + (k.dx || 0), .14 * s0 + (k.dz || 0), k.B); touffe(k, .2 * s0 + (k.dx || 0), .18 * s0 + (k.dz || 0), k.B);
  if (a.etats.caillou) F(k, G.dode, PIERRES.pierre[1], { x: .3, y: .06, z: .2, sx: .1, sy: .07, sz: .09, bosse: .15 });
  if (a.etats.pluie) { nuageBati(k, 0, 1.5 * [.62, .85, 1.1, 1.2][st] + .3, 0, .55, ['#c9d0d8', '#a7b0ba']); pluie(k, 0, 1.5 * [.62, .85, 1.1, 1.2][st] + .2, 0, .3, 10); }
}

/* ───────── Les pierres ───────── */

function pierre(a, k) {
  const B = k.B, e = a.espece, st = a.stade, v = k.v, tons = PIERRES[e] || PIERRES.pierre, g = v * 13;
  const forme = ['cairn', 'caillou', 'galet'].includes(e) ? e : st >= 3 ? 'menhir' : choix(['bloc', 'rond', 'dalle'], v);
  const w = [.3, .45, .62, .38][st], h = [.22, .34, .48, 1.05][st], bas = a.etats.ferme && st < 3 ? -h * .45 : 0;
  let hh = h;
  if (forme === 'caillou') { const c = [.09, .15, .22, .26][st]; F(k, G.dode, tons[1], { y: c * .55 + bas * .6, sx: c, sy: c * .7, sz: c * .85, bosse: .18, graine: g }); if (v > .5) F(k, G.dode, tons[0], { x: c + .04, y: .04, z: .08, s: .05, bosse: .2, graine: g + 1 }); hh = 0; } // récent, il est petit ; ancien, il est gros
  else if (forme === 'galet') { [[-.1, .02, 1], [.13, .08, .75], [0, -.1, .6]].slice(0, 1 + Math.min(2, st)).forEach(([x, z, s], i) => F(k, G.sphL, tons[i % 2], { x, y: .045 * s, z, sx: .14 * s, sy: .06 * s, sz: .11 * s, ao: .3 })); hh = 0; }
  else if (forme === 'cairn') { let y = 0, r = .2 + st * .03; for (let i = 0; i < 2 + st; i++) { const hi = .07 + .015 * (2 + st - i); F(k, G.dode, tons[i % 3], { x: (i % 2 ? .02 : -.02), y: y + hi * .5, sx: r, sy: hi, sz: r * .85, ry: i, bosse: .12, graine: g + i }); y += hi * .9; r *= .8; } hh = 0; }
  else if (forme === 'menhir') { F(k, G.box, tons[1], { y: h / 2, sx: w * .55, sy: h, sz: w * .3, ry: v * 2, bosse: .1, graine: g }); const r = rngL(g); for (let i = 0; i < 14; i++) { const t = i / 14, an = t * 12.5, rr = .02 + t * .08; F(k, G.sph, '#e6e2d8', { x: Math.cos(v * 2) * Math.cos(an) * rr, y: h * .56 + Math.sin(an) * rr, z: w * .16 + .01 - Math.sin(v * 2) * Math.cos(an) * rr * .2, s: .012, ao: 0 }); } r(); }
  else if (forme === 'rond') F(k, G.ico1, tons[1], { y: h * .42 + bas, sx: w * .55, sy: h * .52, sz: w * .5, bosse: .12, graine: g, ao: .35 });
  else if (forme === 'dalle') { F(k, G.box, tons[1], { y: h * .7 + bas, sx: w * .6, sy: h * 1.4, sz: w * .22, ry: v * 2, bosse: .09, graine: g }); hh = h * 1.4; }
  else F(k, G.dode, tons[1], { y: h * .45 + bas, sx: w * .55, sy: h * .56, sz: w * .46, ry: v * 3, bosse: .16, graine: g, ao: .35 });
  if (hh && !B.enneige && (e === 'moussue' || (B.mousse && e !== 'sombre' && v > .45))) F(k, G.ico1, '#86b94f', { y: hh * .9 + bas, sx: w * .38, sy: hh * .14, sz: w * .34, bosse: .18, graine: g + 3, ao: .2 });
  if (hh && B.enneige) F(k, G.ico1, '#ffffff', { y: hh * .92 + bas, sx: w * .42, sy: hh * .15, sz: w * .36, bosse: .15, graine: g + 4, ao: 0 });
  if (a.etats.ferme && st < 3) { // jamais dit : la terre la recouvre à moitié
    const f = B.falaise || B0.falaise; F(k, G.ico1, f[0], { y: .02, sx: w * .82, sy: .11, sz: w * .7, bosse: .14, graine: g + 5, ao: .25 }); F(k, G.ico1, (B.sol.herbe || B0.sol.herbe)[1], { y: .07, sx: w * .6, sy: .05, sz: w * .5, bosse: .12, graine: g + 6, ao: .1 });
  }
  if (a.etats.fissure && hh) F(k, G.box, '#3d3948', { y: hh * .5 + bas, z: w * .22, sx: .02, sy: hh * .7, sz: .02, rz: .2, ao: 0 });
  if (a.etats.mousse) { for (const [x, z] of [[-.2, .1], [.18, .12], [0, -.18]]) F(k, G.ico1, '#7bb661', { x, y: .02, z, sx: .08, sy: .03, sz: .07, bosse: .2, ao: 0 }); fleurette(k, -.26, .16, '#ff6b6b'); fleurette(k, .25, .18, '#ffd166'); }
}
function fleurette(k, x, z, col, h = .1, t = .028) { F(k, cyl(.006, .008, 4), '#5f9e34', { x, y: h / 2, z, sy: h, ao: 0 }); F(k, G.ico0, col, { x, y: h + t * .5, z, s: t, ao: 0 }); }

/* ───────── Les constructions ───────── */

function boite(k, o) {
  const W = .56, D = .46, H = .42, murs = o.murs, toit = o.toit, sty = o.style;
  F(k, G.box, murs[0], { y: H / 2, sx: W, sy: H, sz: D, ao: .18, varie: .03 });
  const poutre = '#7a4e33', fin = .026;
  if (sty === 'colombage') { for (const x of [-W / 2 + .02, 0, W / 2 - .02]) F(k, G.box, poutre, { x, y: H / 2, z: D / 2 + .004, sx: fin, sy: H, sz: .01, ao: 0 }); for (const z of [-D / 2 + .02, D / 2 - .02]) F(k, G.box, poutre, { x: W / 2 + .004, y: H / 2, z, sx: .01, sy: H, sz: fin, ao: 0 }); F(k, G.box, poutre, { y: H * .55, z: D / 2 + .005, sx: W, sy: fin, sz: .01, ao: 0 }); F(k, G.box, poutre, { x: W / 2 + .005, y: H * .55, sx: .01, sy: fin, sz: D, ao: 0 }); F(k, G.box, poutre, { x: W / 4, y: H * .3, z: D / 2 + .006, sx: .012, sy: H * .55, sz: .01, rz: .7, ao: 0 }); }
  else if (sty === 'pierre') { const r = rngL(Math.round(W * 1e3 + o.graine * 97)); for (let i = 0; i < 14; i++) { const face = i % 2, x = face ? W / 2 + .004 : (r() - .5) * W * .85, z = face ? (r() - .5) * D * .85 : D / 2 + .004; F(k, G.box, i % 3 ? '#b8b2a6' : '#d9d3c7', { x, y: .04 + r() * (H - .08), z, sx: face ? .01 : .07, sy: .045, sz: face ? .07 : .01, ao: 0 }); } }
  else if (sty === 'bois' || sty === 'paillote') { for (const y of [.1, .2, .3]) { F(k, G.box, '#6d4a33', { y, z: D / 2 + .004, sx: W, sy: .008, sz: .01, ao: 0 }); F(k, G.box, '#6d4a33', { x: W / 2 + .004, y, sx: .01, sy: .008, sz: D, ao: 0 }); } }
  else F(k, G.box, murs[1], { y: .03, sx: W + .02, sy: .06, sz: D + .02, ao: 0 });
  F(k, G.prisme, toit[0], { y: H, sx: W + .1, sy: .3, sz: D + .14, ao: .3, varie: .04 });
  F(k, G.box, toit[1], { y: H + .3, sx: W + .12, sy: .03, sz: .05, ao: 0 });
  if (o.neige) F(k, G.prisme, '#ffffff', { y: H + .13, sx: W + .12, sy: .18, sz: (D + .14) * .56, ao: 0 });
  // la porte, ses marches ; les fenêtres, leur croisée
  const lit = o.lit, dx = -W * .2;
  F(k, G.box, '#bdb6aa', { x: dx, y: .015, z: D / 2 + .05, sx: .16, sy: .03, sz: .08, ao: 0 }); F(k, G.box, '#a39c90', { x: dx, y: .04, z: D / 2 + .03, sx: .14, sy: .025, sz: .05, ao: 0 });
  F(k, G.box, '#6d4a33', { x: dx, y: .14, z: D / 2 + .006, sx: .14, sy: .26, sz: .012, ao: 0 });
  (lit ? FL : F)(k, G.box, o.ferme ? '#4a3626' : lit ? '#ffcf6a' : '#8a5a3c', { x: dx, y: .13, z: D / 2 + .012, sx: .11, sy: .23, sz: .01, ao: 0 });
  for (const [x, z, face] of [[W * .22, D / 2 + .01, 0], [W / 2 + .01, 0, 1]]) {
    F(k, G.box, '#e9e0cf', { x, y: .25, z, sx: face ? .012 : .15, sy: .15, sz: face ? .15 : .012, ao: 0 });
    (lit ? FL : F)(k, G.box, lit ? '#ffd766' : '#6a7d93', { x: x + (face ? .004 : 0), y: .25, z: z + (face ? 0 : .004), sx: face ? .01 : .11, sy: .11, sz: face ? .11 : .01, ao: 0 });
    F(k, G.box, '#f3ead8', { x: x + (face ? .007 : 0), y: .25, z: z + (face ? 0 : .007), sx: face ? .008 : .012, sy: .11, sz: face ? .012 : .008, ao: 0 });
    if (o.volets) for (const sgn of [-1, 1]) F(k, G.box, '#6f8f6a', { x: x + (face ? .008 : sgn * .04), y: .25, z: z + (face ? sgn * .04 : .008), sx: face ? .01 : .07, sy: .12, sz: face ? .07 : .01, ao: 0 });
  }
  if (sty !== 'paillote') F(k, G.box, '#9a9a9a', { x: W * .25, y: H + .24, z: -D * .15, sx: .07, sy: .2, sz: .07, ao: .2 });
  if (lit && k.anims) { const h1 = halo('#ffc86a', .5, .8); h1.position.set(W * .22 * (k.s ?? 1) + (k.dx || 0), .25 * (k.s ?? 1) + (k.dy || 0), (D / 2 + .08) * (k.s ?? 1) + (k.dz || 0)); k.grp.add(h1); fumee(k, W * .25, H + .38, -D * .15); }
}
function fumee(k, x, y, z) {
  if (!k.anims) return;
  const s = k.s ?? 1, puffs = [0, 1, 2].map(() => { const p = new THREE.Mesh(G.ico0, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .5, flatShading: true, depthWrite: false })); k.grp.add(p); return p; });
  k.anims.push(T => puffs.forEach((p, i) => { const t = (T * .35 + i / 3) % 1; p.position.set(x * s + (k.dx || 0) + t * .12, y * s + (k.dy || 0) + t * .5, z * s + (k.dz || 0)); p.scale.setScalar((.04 + t * .07) * s); p.material.opacity = (1 - t) * .55; }));
}
function lanterne(k, x, z) {
  F(k, cyl(.012, .015, 5), '#3f3834', { x, y: .22, z, sy: .44, ao: 0 });
  FL(k, G.box, '#ffe39a', { x, y: .47, z, sx: .06, sy: .07, sz: .06, ao: 0 });
  F(k, cone(4), '#3f3834', { x, y: .53, z, sx: .06, sy: .05, sz: .06, ry: .78, ao: 0 });
  if (k.grp) { const h = halo('#ffd98a', .45, .8); h.position.set(x * (k.s ?? 1) + (k.dx || 0), .47 * (k.s ?? 1) + (k.dy || 0), z * (k.s ?? 1) + (k.dz || 0)); k.grp.add(h); }
}
function maison(a, k) {
  const B = k.B, e = a.espece, st = a.stade, v = k.v, s0 = k.s ?? 1;
  if (e === 'pont') {
    const s = s0 * [.8, .92, 1.05, 1.15][st];
    F({ ...k, s }, cyl(.44, .46, 12), k.o.eauHex || '#46bcd9', { y: -.02, sy: .04, sz: .55, ao: 0 });
    for (const x of [-.44, .44]) F({ ...k, s }, G.dode, PIERRES.pierre[1], { x, y: .04, s: .08, bosse: .15 });
    for (let i = 0; i < 9; i++) { const t = i / 8, x = -.4 + t * .8, y = .06 + Math.sin(t * Math.PI) * .2, ang = Math.cos(t * Math.PI) * .45; F({ ...k, s }, G.box, i % 2 ? BOIS[0] : BOIS[1], { x, y, sx: .1, sy: .03, sz: .26, rz: ang, ao: 0 }); }
    for (const z of [-.12, .12]) { for (let i = 0; i < 3; i++) { const t = i / 2, x = -.4 + t * .8, y = .06 + Math.sin(t * Math.PI) * .2; F({ ...k, s }, G.box, BOIS[2], { x, y: y + .08, z, sx: .025, sy: .16, sz: .025, ao: 0 }); } for (let i = 0; i < 8; i++) { const t0 = i / 8, t1 = (i + 1) / 8; baton({ ...k, s }, [-.4 + t0 * .8, .06 + Math.sin(t0 * Math.PI) * .2 + .15, z], [-.4 + t1 * .8, .06 + Math.sin(t1 * Math.PI) * .2 + .15, z], .012, .012, BOIS[2], 4); } }
    if (a.etats.ferme) F({ ...k, s }, G.box, '#4a3626', { y: .32, sx: .04, sy: .03, sz: .3, rz: .3, ao: 0 });
    return;
  }
  if (e === 'banc') {
    const kk = { ...k, s: s0 * [.8, .95, 1.1, 1.2][st] };
    for (const x of [-.2, .2]) F(kk, G.box, BOIS[2], { x, y: .08, sx: .03, sy: .16, sz: .14, ao: 0 });
    F(kk, G.box, BOIS[0], { y: .17, sx: .5, sy: .035, sz: .16, ao: 0 }); F(kk, G.box, BOIS[1], { y: .3, z: -.07, sx: .5, sy: .1, sz: .025, rx: -.15, ao: 0 });
    if (B.enneige) F(kk, G.box, '#ffffff', { y: .195, sx: .48, sy: .015, sz: .15, ao: 0 });
    fleurette(k, -.36, .12, choix(FLEURS[idDe(B)], v));
    if (st >= 2) lanterne(kk, .36, .05);
    return;
  }
  if (e === 'cloture') {
    const n = 3 + Math.min(st, 2);
    for (let i = 0; i < n; i++) { const x = -.42 + (i * .84) / (n - 1); F(k, G.box, BOIS[2], { x, y: .15, z: x * -.3, sx: .04, sy: .3, sz: .04, ao: .2 }); F(k, cone(4), BOIS[1], { x, y: .32, z: x * -.3, sx: .035, sy: .05, sz: .035, ry: .78, ao: 0 }); }
    for (const y of [.1, .22]) baton(k, [-.42, y, .126], [.42 * (n - 2) / (n - 1), y, -.126 * (n - 2) / (n - 1)], .015, .015, BOIS[y > .15 ? 0 : 1], 4);
    baton(k, [.42 * (n - 2) / (n - 1), .22, -.126 * (n - 2) / (n - 1)], [.46, .02, -.2], .015, .015, BOIS[1], 4); // la traverse tombée
    return;
  }
  const lieu = i => { const vv = (v + i * .29) % 1; return { murs: choix(B.maisons.murs, vv), toit: choix(B.maisons.toits, (vv * 3.7) % 1), style: choix(B.maisons.styles, (vv * 5.3) % 1), neige: B.enneige, graine: i + 1 }; };
  const ici = { ...lieu(0), lit: a.etats.lueur, volets: (e === 'volets' && a.quad[1] !== 'S') || a.etats.ferme, ferme: a.etats.ferme }; // jamais dit : les volets sont clos
  if (st >= 3) { boite({ ...k, dx: (k.dx || 0) - .34 * s0, dz: (k.dz || 0) - .26 * s0, s: s0 * .62 }, lieu(1)); boite({ ...k, dx: (k.dx || 0) + .34 * s0, dz: (k.dz || 0) - .24 * s0, s: s0 * .58 }, lieu(2)); }
  else if (st >= 2) boite({ ...k, dx: (k.dx || 0) - .34 * s0, dz: (k.dz || 0) - .24 * s0, s: s0 * .6 }, lieu(1));
  boite({ ...k, s: s0 * (st === 0 ? .74 : .95) }, ici);
  if (!B.enneige) fleurette(k, -.4, .28, choix(FLEURS[idDe(B)], v));
}

/* ───────── Les cultures ───────── */

function champ(a, k) {
  const B = k.B, v = k.v, sorte = a.etats.ferme ? 'friche' : choix(B.champs, v), st = a.stade;
  const SOL = { ble: '#d9bd55', potager: '#8a5d3b', lavande: '#8a7e5c', riz: '#8fd3cf', ananas: '#c7a765', citrouilles: '#7d6a3c', neige: '#f3f7fb', friche: '#cfc9a3' };
  F(k, G.box, SOL[sorte], { y: .03, sx: .82, sy: .06, sz: .82, ao: .3, varie: .03 });
  const r = rngL(v * 1e4 + 5);
  for (const z of [-.3, -.1, .1, .3]) {
    F(k, G.box, sorte === 'riz' ? '#b4e6e2' : '#6f4a2e', { y: .062, z, sx: .76, sy: .006, sz: .03, ao: 0 });
    for (const x of [-.3, -.15, 0, .15, .3]) {
      const jx = x + (r() - .5) * .04, jz = z + (r() - .5) * .03;
      if (sorte === 'ble') { F(k, cyl(.006, .008, 4), '#c9a032', { x: jx, y: .14, z: jz, sy: .16, ao: 0 }); F(k, G.ico0, '#f2cf5f', { x: jx, y: .23, z: jz, sx: .02, sy: .04, sz: .02, ao: 0 }); }
      else if (sorte === 'potager') { F(k, G.ico1, '#76bf4a', { x: jx, y: .1, z: jz, s: .05, bosse: .2, graine: x + z, ao: .3 }); if (r() < .35) F(k, cone(5), '#ff8e3c', { x: jx + .03, y: .08, z: jz, sx: .015, sy: .05, sz: .015, rx: Math.PI, ao: 0 }); }
      else if (sorte === 'lavande') { if (x === .3) continue; F(k, G.ico1, r() < .5 ? '#a47fd9' : '#b894e6', { x: jx, y: .11, z: jz, sx: .065, sy: .06, sz: .055, bosse: .2, graine: x * z, ao: .3 }); }
      else if (sorte === 'riz') { F(k, cone(3), '#5cbf4a', { x: jx, y: .1, z: jz, sx: .012, sy: .09, sz: .012, rz: .15, ao: 0 }); F(k, cone(3), '#7ed957', { x: jx + .015, y: .1, z: jz, sx: .012, sy: .08, sz: .012, rz: -.2, ao: 0 }); }
      else if (sorte === 'ananas') { if ((x * 20 + z * 10) % 2) continue; F(k, G.ico1, '#f2b93e', { x: jx, y: .11, z: jz, sx: .035, sy: .05, sz: .035, ao: .3 }); for (const rz of [-.4, 0, .4]) F(k, cone(3), '#4f9a3a', { x: jx, y: .18, z: jz, sx: .01, sy: .07, sz: .01, rz, ao: 0 }); }
      else if (sorte === 'citrouilles') { if (r() < .5) continue; F(k, G.sphL, '#f08a2c', { x: jx, y: .1, z: jz, sx: .06, sy: .045, sz: .06, ao: .3 }); F(k, cyl(.005, .007, 4), '#5f7a2e', { x: jx, y: .16, z: jz, sy: .04, ao: 0 }); }
      else if (sorte === 'neige') F(k, cone(3), '#6fa36a', { x: jx, y: .09, z: jz, sx: .01, sy: .05, sz: .01, ao: 0 });
      else if (sorte === 'friche' && r() < .4) F(k, cyl(.004, .006, 3), '#b3ad88', { x: jx, y: .1, z: jz, sy: .08, rz: .3, ao: 0 });
    }
  }
  if (st >= 2) { // le moulin, dans un coin du champ
    const mx = .3, mz = -.3;
    F(k, cyl(.1, .14, 8), '#f6f1e6', { x: mx, y: .38, z: mz, sy: .64, ao: .2 });
    F(k, cone(8), B.enneige ? '#ffffff' : BOIS[1], { x: mx, y: .8, z: mz, sx: .13, sy: .2, sz: .13, ao: 0 });
    F(k, G.box, '#8a5a3c', { x: mx, y: .12, z: mz + .12, sx: .06, sy: .14, sz: .02, ao: 0 });
    if (k.grp) {
      const ailes = new Bati(9), kk = { B, b: ailes, s: 1 };
      for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; F(kk, G.box, BOIS[2], { x: Math.cos(an) * .2, y: Math.sin(an) * .2, sx: Math.abs(Math.cos(an)) * .4 + .02, sy: Math.abs(Math.sin(an)) * .4 + .02, sz: .015, ao: 0 }); F(kk, G.box, '#f3e7cf', { x: Math.cos(an) * .24 - Math.sin(an) * .04, y: Math.sin(an) * .24 + Math.cos(an) * .04, sx: Math.abs(Math.cos(an)) * .28 + Math.abs(Math.sin(an)) * .07, sy: Math.abs(Math.sin(an)) * .28 + Math.abs(Math.cos(an)) * .07, sz: .006, ao: 0 }); }
      F(kk, G.sph, BOIS[2], { s: .03, ao: 0 });
      const m = ailes.maillage(); const s = k.s ?? 1; m.scale.setScalar(s); m.position.set(mx * s + (k.dx || 0), .66 * s + (k.dy || 0), (mz + .15) * s + (k.dz || 0));
      k.grp.add(m); k.anims?.push(T => { m.rotation.z = T * .7; });
    }
  }
}
function culture(a, k) {
  const B = k.B, e = a.espece, st = a.stade, v = k.v, s0 = k.s ?? 1;
  if (e === 'champ') return champ(a, k);
  if (e === 'puits') {
    const kk = { ...k, s: s0 * [.8, .95, 1.1, 1.2][st] };
    for (let i = 0; i < 9; i++) { const an = i / 9 * 6.28; F(kk, G.box, i % 2 ? '#b9b3a8' : '#a39d92', { x: Math.cos(an) * .17, y: .07, z: Math.sin(an) * .17, sx: .09, sy: .14, sz: .06, ry: -an, ao: .2 }); }
    F(kk, cyl(.15, .15, 10), a.etats.ferme ? BOIS[1] : '#2c4a5e', { y: .1, sy: .02, ao: 0 });
    for (const x of [-.18, .18]) F(kk, G.box, BOIS[2], { x, y: .3, sx: .03, sy: .46, sz: .03, ao: 0 });
    F(kk, cyl(.015, .015, 5), BOIS[1], { y: .42, sy: .38, rz: Math.PI / 2, ao: 0 });
    const toit = choix(B.maisons.toits, v); F(kk, G.prisme, toit[0], { y: .52, sx: .46, sy: .16, sz: .3, ao: .2 });
    if (B.enneige) F(kk, G.prisme, '#ffffff', { y: .6, sx: .47, sy: .08, sz: .16, ao: 0 });
    F(kk, cyl(.03, .025, 6), BOIS[2], { y: .3, sy: .06, ao: 0 });
    return;
  }
  if (e === 'feu') {
    const kk = { ...k, s: s0 * [.75, .9, 1.05, 1.2][st] };
    for (let i = 0; i < 7; i++) { const an = i / 7 * 6.28; F(kk, G.dode, PIERRES.pierre[i % 3], { x: Math.cos(an) * .2, y: .03, z: Math.sin(an) * .2, s: .05, bosse: .2, graine: i }); }
    baton(kk, [-.14, .03, -.05], [.14, .06, .05], .025, .025, BOIS[2], 5); baton(kk, [-.12, .06, .08], [.13, .03, -.08], .025, .025, BOIS[1], 5);
    if (a.etats.ferme) { for (const [x, z] of [[-.04, 0], [.04, .03], [0, -.04]]) FL(kk, G.ico0, '#e07a3a', { x, y: .04, z, s: .025, ao: 0 }); return; }
    if (k.grp) {
      const fl = new Bati(5), kf = { b: fl, s: 1 };
      F(kf, cone(6), '#ff8e3c', { y: .15, sx: .09, sy: .3, sz: .09, ao: 0 }); F(kf, cone(5), '#ffd166', { y: .11, sx: .05, sy: .18, sz: .05, ry: .4, ao: 0 });
      const m = fl.maillage(MAT.lum, false), s = kk.s; m.scale.setScalar(s); m.position.set(k.dx || 0, (k.dy || 0) + .02 * s, k.dz || 0); k.grp.add(m);
      const h = halo('#ff9a3c', .9 * s, .8); h.position.set(k.dx || 0, (k.dy || 0) + .2 * s, k.dz || 0); k.grp.add(h);
      k.anims?.push(T => { const f = 1 + .12 * Math.sin(T * 9) + .07 * Math.sin(T * 13.7); m.scale.set(s, s * f, s); h.material.opacity = .65 + .2 * Math.sin(T * 7); });
    }
    return;
  }
  if (e === 'barque') {
    const coque = choix([['#7f5a36', '#a3784a'], ['#5d7fa3', '#7ea0c4'], ['#b4503c', '#dc6a52']], v);
    const une = kk => { F(kk, cyl(.11, .08, 6), coque[0], { y: .02, sx: .6, sy: .56, sz: .55, rz: Math.PI / 2, ao: .2 }); F(kk, G.box, a.etats.ferme ? '#98a1ab' : BOIS[0], { y: .07, sx: .44, sy: .012, sz: .14, ao: 0 }); F(kk, G.box, coque[1], { y: .085, sx: .5, sy: .012, sz: .018, ao: 0 }); baton(kk, [.05, .08, .05], [.3, .03, .16], .008, .008, BOIS[2], 4); };
    une({ ...k, s: s0 * [.85, 1, 1.1, 1.2][st] });
    if (st >= 2) une({ ...k, dx: (k.dx || 0) + .28 * s0, dz: (k.dz || 0) - .22 * s0, s: s0 * .7 });
    return;
  }
}

/* ───────── Le temps qu’il fait ───────── */

function nuageBati(k, x, y, z, s, tons) { for (const [dx, dy, dz, r, i] of [[0, 0, 0, .3, 0], [-.26, -.05, .05, .22, 1], [.27, -.04, -.03, .23, 0], [.05, .12, -.05, .24, 0], [-.08, -.04, -.18, .18, 1]]) F(k, G.ico1, tons[i], { x: x + dx * s, y: y + dy * s, z: z + dz * s, s: r * s, sy: r * s * .8, bosse: .1, graine: dx * 7 + dz, ao: .3, varie: .03 }); }
function pluie(k, x, y, z, rayon, n, neige = false) {
  if (!k.grp) return;
  const s = k.s ?? 1, pos = new Float32Array(n * 6), g = new THREE.BufferGeometry(), r = rngL(n * 7 + 1), gouttes = [];
  for (let i = 0; i < n; i++) gouttes.push([(r() - .5) * 2 * rayon, r(), (r() - .5) * 2 * rayon]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: neige ? '#ffffff' : '#9fd0ee', transparent: true, opacity: .85 }));
  ls.frustumCulled = false; k.grp.add(ls);
  k.anims?.push(T => { for (let i = 0; i < n; i++) { const [gx, ph, gz] = gouttes[i], t = (T * (neige ? .35 : 1.4) + ph) % 1, yy = (y - t * y) * s + (k.dy || 0), l = neige ? .02 : .09; pos.set([(x + gx) * s + (k.dx || 0), yy, (z + gz) * s + (k.dz || 0), (x + gx) * s + (k.dx || 0) + (neige ? .02 : -.015), yy - l * s, (z + gz) * s + (k.dz || 0)], i * 6); } g.attributes.position.needsUpdate = true; });
}
function meteo(a, k) {
  const B = k.B, e = a.espece, st = a.stade, s = [.8, 1, 1.15, 1.3][st], haut = k.o.bas ? 1.05 : 1.6;
  if (e === 'orage') {
    nuageBati(k, 0, haut, 0, s, ['#7a8190', '#5d6574']);
    if (k.grp) {
      const eclair = new Bati(4), ke = { b: eclair, s: k.s ?? 1, dx: k.dx, dy: k.dy, dz: k.dz };
      baton(ke, [.04, haut - .1, 0], [-.06, haut * .6, .02], .018, .018, '#ffe066', 4); baton(ke, [-.06, haut * .6, .02], [.05, haut * .55, 0], .018, .018, '#ffe066', 4); baton(ke, [.05, haut * .55, 0], [-.04, .05, .01], .018, .012, '#ffe066', 4);
      const m = eclair.maillage(MAT.lum, false); k.grp.add(m);
      k.anims?.push(T => { m.visible = Math.sin(T * 6.3) > .86; });
    }
  } else if (e === 'pluie') { nuageBati(k, 0, haut, 0, s, ['#c9d0d8', '#a7b0ba']); pluie(k, 0, haut - .1, 0, .3 * s, 16, !!B.enneige); F(k, cyl(.2, .22, 10), B.enneige ? '#ffffff' : '#8fc8e0', { y: .005, sy: .01, ao: 0 }); }
  else if (e === 'fleurs') { const r = rngL(k.v * 1e4 + 11), pal = FLEURS[idDe(B)]; for (let i = 0; i < 9 + st * 4; i++) { const x = (r() - .5) * .85, z = (r() - .5) * .85; fleurette(k, x, z, pal[i % pal.length], .1 + r() * .1, .05); F(k, G.ico1, '#6fb84a', { x: x + .03, y: .03, z: z + .02, sx: .06, sy: .04, sz: .05, bosse: .2, graine: i, ao: .3 }); } }
  else if (e === 'etang') {
    F(k, cyl(.44 * s, .46 * s, 11), B.sol.sable[0], { y: .015, sy: .03, bosse: .06, graine: 3, ao: .1 });
    F(k, cyl(.36 * s, .37 * s, 11), k.o.eauHex || '#46bcd9', { y: .03, sy: .012, bosse: .06, graine: 3, ao: 0, varie: .02 });
    for (const [x, z, r] of [[-.15, .05, .06], [.1, .1, .05], [.02, -.12, .045]]) F(k, cyl(r * s, r * s, 7), '#6cc04a', { x: x * s, y: .04, z: z * s, sy: .006, ao: 0 });
    if (!B.enneige) F(k, G.ico0, '#ff9ecf', { x: -.14 * s, y: .06, z: .05 * s, s: .025, ao: 0 });
    for (let i = 0; i < 4; i++) { const x = .34 * s + i * .03, z = -.12 + i * .04; F(k, cyl(.006, .008, 4), '#5f8f3a', { x, y: .12, z, sy: .22, ao: 0 }); if (i % 2) F(k, cyl(.014, .014, 5), '#8a5a3c', { x, y: .22, z, sy: .06, ao: 0 }); }
    F(k, G.dode, PIERRES.pierre[1], { x: -.42 * s, y: .04, z: .12, s: .06, bosse: .2 });
  }
}

/* ───────── Le phare, les états, l’ensemble ───────── */

export function phare(k) {
  for (const [x, z, r] of [[-.2, .15, .1], [.22, .12, .09], [.05, .25, .08]]) F(k, G.dode, PIERRES.pierre[1], { x, y: .04, z, s: r, bosse: .2, graine: x });
  F(k, cyl(.11, .15, 10), '#fbfbf8', { y: .6, sy: 1.2, ao: .2 });
  for (const y of [.35, .75]) F(k, cyl(.135 - y * .02, .14 - y * .02, 10), '#e04e4e', { y, sy: .14, ao: 0 });
  F(k, G.box, '#7a5236', { y: .1, z: .14, sx: .08, sy: .18, sz: .02, ao: 0 });
  F(k, cyl(.16, .16, 10), '#4a4a55', { y: 1.21, sy: .03, ao: 0 });
  FL(k, cyl(.08, .08, 8), '#ffe9a3', { y: 1.31, sy: .16, ao: 0 });
  F(k, cone(8), '#4a4a55', { y: 1.46, sx: .12, sy: .14, sz: .12, ao: 0 });
  if (k.grp) {
    const h = halo('#fff0b0', 1.1, .9); h.position.set(k.dx || 0, 1.31, k.dz || 0); k.grp.add(h);
    const faisceau = new THREE.Mesh(new THREE.ConeGeometry(.35, 2.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    faisceau.geometry.translate(0, -1.2, 0); faisceau.rotation.z = Math.PI / 2;
    const pivot = new THREE.Group(); pivot.position.set(k.dx || 0, 1.31, k.dz || 0); pivot.add(faisceau); k.grp.add(pivot);
    k.anims?.push(T => { pivot.rotation.y = T * .8; });
  }
}
/* ───────── Les lanternes : ce que le texte a éclairé ───────── */
// Un texte ne montre jamais ses mots. Il allume des lanternes de papier qui flottent au-dessus de ce qu’il a fait pousser :
// une par dépôt écrit, jusqu’à trois. Dans l’archipel, elles restent des points chauds, immobiles.

const LANTERNE = { corps: new THREE.CylinderGeometry(.075, .06, .14, 6), chapeau: new THREE.ConeGeometry(.085, .05, 6), fond: new THREE.CylinderGeometry(.045, .045, .015, 6) };
for (const g of Object.values(LANTERNE)) g._partage = true;
const MAT_LANTERNE = { corps: new THREE.MeshBasicMaterial({ color: '#ffc870', toneMapped: false }), bois: new THREE.MeshStandardMaterial({ color: '#7a4630', flatShading: true, roughness: .8 }) };
for (const m of Object.values(MAT_LANTERNE)) m._partage = true;
const HAUT_LANTERNE = a => ({ arbre: [1.05, 1.3, 1.6, 1.85], maison: [.95, 1.1, 1.2, 1.3], pierre: [.65, .8, .95, 1.45], caillou: [.55, .6, .7, .75], culture: [.7, .8, .9, 1], meteo: [.6, .65, .7, .75] }[a.famille] || [.8, .9, 1, 1.1])[Math.min(3, a.stade || 0)];
const PLACES_LANTERNE = [[.05, 0, .1], [.34, -.14, -.12], [-.3, -.07, -.16]], TAILLE_LANTERNE = 1.7; // assez grandes pour se voir de loin
function lanternes(a, k) {
  if (a.famille === 'meteo' && !['fleurs', 'etang'].includes(a.espece)) return; // pas sous les nuages
  const n = Math.max(1, Math.min(3, a.textes || 1)), s = k.s ?? 1;
  let h0 = HAUT_LANTERNE(a);
  if (k.grp && k.b.pos.length) { let haut = 0; for (let i = 1; i < k.b.pos.length; i += 3) haut = Math.max(haut, k.b.pos[i]); h0 = Math.max(h0 * .6, (haut - (k.dy || 0)) / s + .28); } // juste au-dessus de la chose, jamais dans son feuillage
  for (let i = 0; i < n; i++) {
    const [x, dy, z] = PLACES_LANTERNE[i], y = h0 + dy;
    if (!k.grp) { FL(k, G.box, '#ffc870', { x, y, z, sx: .2, sy: .22, sz: .2, ao: 0 }); continue; } // immobile, fondue dans l’île
    const grp = new THREE.Group(), corps = new THREE.Mesh(LANTERNE.corps, MAT_LANTERNE.corps), chapeau = new THREE.Mesh(LANTERNE.chapeau, MAT_LANTERNE.bois), fond = new THREE.Mesh(LANTERNE.fond, MAT_LANTERNE.bois), h = halo('#ffbe5c', .8, .95);
    chapeau.position.y = .095; fond.position.y = -.078; grp.add(corps, chapeau, fond, h); grp.userData.lanterne = true; // l’intro les fait se lever
    const X = x * s + (k.dx || 0), Y = y * s + (k.dy || 0), Z = z * s + (k.dz || 0), ph = i * 2.1 + X * 3 + Z * 5;
    grp.scale.setScalar(s * TAILLE_LANTERNE); grp.position.set(X, Y, Z); k.grp.add(grp);
    k.anims?.push(T => { grp.position.y = Y + Math.sin(T * .8 + ph) * .07 * s; grp.rotation.y = T * .3 + ph; grp.rotation.z = Math.sin(T * .6 + ph) * .06; h.material.opacity = .78 + .18 * Math.sin(T * 2.2 + ph); });
  }
}

function etatsCommuns(a, k) {
  if (a.etats?.boucle && a.famille !== 'meteo') F(k, new THREE.TorusGeometry(.44, .065, 4, 24), '#d9bb86', { y: .014, rx: Math.PI / 2, sz: .25, ao: 0 }); // en boucle : un sentier usé tout autour
  if (a.etats?.ferme && a.famille === 'arbre') { // jamais dit : la terre recouvre ses racines, comme elle recouvre les pierres
    const f = k.B.falaise || B0.falaise, st = Math.min(3, a.stade || 0), w = [.3, .38, .46, .5][st];
    F(k, G.ico1, f[0], { y: .02, sx: w, sy: .1, sz: w * .85, bosse: .14, graine: 11, ao: .25 }); F(k, G.ico1, (k.B.sol.herbe || B0.sol.herbe)[1], { y: .065, sx: w * .7, sy: .045, sz: w * .6, bosse: .12, graine: 12, ao: .1 });
  }
  if (a.etats?.lueur) lanternes(a, k); // un texte : des lanternes, jamais ses mots
}
const FAMILLES = { arbre, pierre, caillou: pierre, maison, culture, meteo };

// Construit une chose. o : { bati, lum (pour tout fusionner, sans animation), dx, dy, dz, s, bas, eauHex, propose }
export function modeleChose(a, B = B0, v = .5, o = {}) {
  const statique = !!o.bati, grp = statique ? null : new THREE.Group(), anims = statique ? null : [];
  const k = { B, v, o, b: o.bati || new Bati(Math.floor(v * 1e6) + 7), lum: o.lum || new Bati(3), grp, anims, dx: o.dx || 0, dy: o.dy || 0, dz: o.dz || 0, s: o.s ?? 1 };
  if (a.etats?.double && a.famille !== 'meteo') FAMILLES[a.famille](a, { ...k, dx: k.dx + .3 * k.s, dz: k.dz - .22 * k.s, s: k.s * .68, v: (v + .5) % 1 });
  FAMILLES[a.famille](a, k);
  etatsCommuns(a, k);
  if (statique) return null;
  if (!k.b.vide()) grp.add(k.b.maillage(o.propose ? MAT.propose : MAT.base));
  if (!k.lum.vide()) grp.add(k.lum.maillage(MAT.lum, false));
  return { objet: grp, anims };
}
export function modelePhare(o = {}) { const grp = new THREE.Group(), anims = [], k = { b: new Bati(5), lum: new Bati(6), grp, anims, s: 1 }; phare(k); grp.add(k.b.maillage(), k.lum.maillage(MAT.lum, false)); return { objet: grp, anims }; }
export { nuageBati, F, G, cone, cyl, baton };

/* ───────── Le petit décor du sol ───────── */
// Ajouté à un assembleur partagé, en (x, y, z). Il ne dit rien : il habille le paysage.

export function decor(bati, kind, B, x, y, z, r = .5) {
  const k = { b: bati, s: 1, dx: x, dy: y, dz: z, B }, h = B.sol.herbe;
  switch (kind) {
    case 'touffe': touffe(k, 0, 0, B); break;
    case 'paquerette': fleurette(k, 0, 0, '#ffffff', .05); break;
    case 'bouton': fleurette(k, 0, 0, '#ffd166', .06); break;
    case 'trefle': for (const [dx, dz] of [[-.015, 0], [.015, 0], [0, .02]]) F(k, G.ico0, h[2], { x: dx, y: .012, z: dz, s: .018, ao: 0 }); break;
    case 'dalle': F(k, cyl(.08, .085, 7), '#b9b4ab', { y: .01, sy: .02, bosse: .1, graine: r, ao: 0 }); break;
    case 'galet': F(k, G.sphL, B.sol.sable[2], { y: .015, sx: .04, sy: .018, sz: .03, ao: 0 }); break;
    case 'eclat': F(k, G.tetra, B.sol.roche[2], { y: .025, s: .04, rx: r * 3, ao: 0 }); break;
    case 'mousse': F(k, G.ico1, '#7fae4a', { y: .01, sx: .06, sy: .02, sz: .05, bosse: .2, graine: r, ao: 0 }); break;
    case 'feuilles': for (const [dx, dz, c] of [[-.03, 0, '#f08a2c'], [.03, .02, '#e5603a'], [0, -.03, '#f2b93e']]) F(k, G.box, c, { x: dx, y: .005, z: dz, sx: .03, sy: .005, sz: .02, ry: dx * 30, ao: 0 }); break;
    case 'champignon': for (const [dx, s] of [[0, 1], [.04, .7]]) { F(k, cyl(.008 * s, .01 * s, 5), '#f4ecdc', { x: dx, y: .025 * s, sy: .05 * s, ao: 0 }); F(k, G.sph, '#e0413a', { x: dx, y: .05 * s, sx: .03 * s, sy: .02 * s, sz: .03 * s, ao: 0 }); } break;
    case 'souche': F(k, cyl(.045, .055, 7), '#8a5a3c', { y: .03, sy: .06, ao: .3 }); F(k, cyl(.043, .043, 7), '#d9b27c', { y: .061, sy: .004, ao: 0 }); break;
    case 'buche': F(k, cyl(.025, .025, 6), '#8a5a3c', { y: .025, sy: .14, rz: Math.PI / 2, ry: r * 3, ao: 0 }); break;
    case 'fougere': for (let i = 0; i < 4; i++) { const an = i / 4 * 6.28 + r; F(k, cone(3), '#4f9a3a', { x: Math.cos(an) * .03, y: .04, z: Math.sin(an) * .03, sx: .015, sy: .1, sz: .006, rz: Math.cos(an) * .7, rx: Math.sin(an) * .7, ao: 0 }); } break;
    case 'fleurrouge': fleurette(k, 0, 0, '#ff4d6d', .06); break;
    case 'coquillage': F(k, cone(5), '#f7c6c0', { y: .01, sx: .025, sy: .02, sz: .02, rx: Math.PI / 2, ao: 0 }); break;
    case 'etoile': for (let i = 0; i < 5; i++) F(k, G.box, '#f08a2c', { x: Math.cos(i * 1.257) * .015, y: .005, z: Math.sin(i * 1.257) * .015, sx: .03, sy: .006, sz: .008, ry: -i * 1.257, ao: 0 }); break;
    case 'tasneige': F(k, G.ico1, '#ffffff', { y: .01, sx: .07, sy: .035, sz: .06, bosse: .15, graine: r, ao: .1 }); break;
    case 'baies': F(k, G.ico1, '#3f7a4f', { y: .035, s: .04, bosse: .2, graine: r, ao: .3 }); F(k, G.sph, '#e0413a', { x: .02, y: .05, z: .02, s: .01, ao: 0 }); F(k, G.sph, '#e0413a', { x: -.02, y: .045, z: .015, s: .01, ao: 0 }); break;
    case 'sapineau': F(k, cone(6), '#3f6f55', { y: .06, sx: .04, sy: .12, sz: .04, ao: .3 }); if (B.enneige) F(k, cone(6), '#ffffff', { y: .1, sx: .02, sy: .04, sz: .02, ao: 0 }); break;
    case 'bruyere': for (const [dx, dz] of [[-.02, 0], [.02, .01], [0, -.02]]) F(k, G.ico0, r > .5 ? '#a57dc4' : '#c299e0', { x: dx, y: .02, z: dz, s: .022, ao: 0 }); break;
    default: break;
  }
}
