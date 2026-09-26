// L’archipel : le monde en 3D. Le sol en relief, la mer et ses fonds, le ciel et la lumière du climat,
// la caméra qu’on tourne au doigt, l’île, l’archipel, l’îlot des graines, les aperçus des paysages.
// La carte et les dépôts viennent de ile.js : l’île est recalculée à partir de ses dépôts.

import * as THREE from './vendor/three.min.js?v=1';
import { N, CLIMATS, eauDe, sol, carte, deriver, etape } from './ile.js?v=5';
import { biomeDe, BIOMES } from './biomes.js?v=1';
import { hash, melange, versHex, nuance } from './outils.js?v=1';
import { Bati, MAT, modeleChose, modelePhare, decor, halo, nuageBati, F, G, cone, cyl, baton } from './modeles.js?v=5';

const reduit = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ECH_ARCH = .45; // la taille des îles dans l’archipel : la même pour toutes, pour que leurs tailles se comparent
const YS = .82, MARGE = 2.5, ECH = 1.35, NIV = .02, lerp = (a, b, t) => a + (b - a) * t, lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pop = (t, T) => { if (t == null || reduit) return 1; const p = Math.max(0, Math.min(1, (T - t) / .7)) - 1; return 1 + 2.7 * p * p * p + 1.7 * p * p; };
const tirer = (table, r) => { const tot = table.reduce((s, [, w]) => s + w, 0); let t = r * tot; for (const [k, w] of table) { if (t < w) return k; t -= w; } return table[0]?.[0]; };
const mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
function liberer(racine) { racine.traverse(o => { if (o.isLight) o.shadow?.dispose?.(); /* la carte d’ombre du soleil */ if (o.geometry && !o.geometry._partage) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) if (!m._partage) { m.map?.dispose?.(); m.dispose(); } }); }

export function disponible() { try { const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } } // le contexte d’essai est rendu aussitôt
function creerRendu(canvas, { alpha = false, ombres = true } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'default' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1;
  r.shadowMap.enabled = ombres; r.shadowMap.type = THREE.PCFShadowMap;
  if (alpha) r.setClearColor(0x000000, 0);
  return r;
}

/* ───────── La lumière de chaque climat ───────── */

const LUM = {
  N: { soleil: '#fff1dc', i: 2.4, ciel: '#dff1ff', sol: '#b4a27e', hi: 1.25, elev: 50, azim: 35 },
  AS: { soleil: '#fff4e0', i: 2.6, ciel: '#e2f4ff', sol: '#b9a680', hi: 1.3, elev: 56, azim: 30 },
  ES: { soleil: '#ffc890', i: 2.3, ciel: '#ffe6cc', sol: '#a98a66', hi: 1.15, elev: 22, azim: 65 },
  AD: { soleil: '#ff9f86', i: 1.8, ciel: '#e3c0da', sol: '#6d5d80', hi: 1.1, elev: 15, azim: -55 },
  ED: { soleil: '#fbf6ec', i: 1.7, ciel: '#f2f4f8', sol: '#b8bdc4', hi: 1.65, elev: 42, azim: 25 },
};
const PROFOND = '#0b4f7a';
function teintes(climat, B) { // l’eau : claire au bord, profonde au large, et une brume qui tire vers le ciel
  const cl = CLIMATS[climat] || CLIMATS.N, eau = eauDe(climat, B), loin = melange(eau, PROFOND, .5);
  const lagon = B.lagon ? versHex(B.lagon.split(',').map(Number)) : '#c8f8f2';
  const chaud = climat === 'ES' || climat === 'AD'; // sous une lumière orangée, l’eau vire au vert : on la pousse vers le bleu
  const jour = { N: 0, AS: .04, ES: -.06, ED: -.02, AD: -.3 }[climat] ?? 0, fondu = c => nuance(c, jour); // le fond n’est pas éclairé : sa clarté suit le climat
  return { eau, jour, loin: fondu(loin), chaud, pres: fondu(melange(B.sol.sable[0], lagon, .6)), surface: melange(eau, chaud ? '#3f9fe6' : '#52d0ea', chaud ? .38 : .25), lueur: melange(eau, PROFOND, .2), brume: melange(cl.ciel[1], loin, climat === 'ED' ? .3 : .45) };
}
function fondCiel(climat) { // un dégradé, et l’astre peint dedans
  const c = CLIMATS[climat] || CLIMATS.N, cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, c.ciel[0]); g.addColorStop(.62, c.ciel[1]); g.addColorStop(1, c.ciel[1]);
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ───────── Le sol : un relief lissé à partir de la carte ───────── */

function bruit(x, z, s = 0) { // un bruit de valeur, doux
  const h = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 17.3) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h(i, j), h(i + 1, j), ux), lerp(h(i, j + 1), h(i + 1, j + 1), ux), uz);
}
export function relief(m) { // la hauteur du sol en (x, z), en tuiles de 0 à N
  if (m._relief) return m._relief;
  const terre = (i, j) => (i >= 0 && j >= 0 && i < N && j < N && m.land[i * N + j] ? 1 : 0);
  const coin = (i, j) => (i >= 0 && j >= 0 && i <= N && j <= N ? m.vh[i * (N + 1) + j] : 0);
  const bil = (f, x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; return f(i, j) * (1 - fx) * (1 - fy) + f(i + 1, j) * fx * (1 - fy) + f(i, j + 1) * (1 - fx) * fy + f(i + 1, j + 1) * fx * fy; };
  const s = m.seed % 997;
  m._relief = (x, z) => {
    const L = bil(terre, x - .5, z - .5) + (bruit(x * 1.3, z * 1.3, s) - .5) * .32, t = lisse(.22, .78, L);
    const S = Math.max(bil(coin, x, z) * YS, .14) + (bruit(x * 2.6, z * 2.6, s + 5) - .5) * .08;
    return lerp(-.9, S, t); // au large, le sol rejoint le fond marin, à la même hauteur
  };
  return m._relief;
}
const _c = new THREE.Color();
function couleurSol(B, fond, y, ny, x, z, r, s) {
  const doux = t => melange(t[0], t[1], bruit(x * .9, z * .9, s + 2)); // deux tons, par grandes plages
  if (y < NIV) { // au ras de l’eau et dessous : l’écume, le haut-fond clair, puis le fond marin, sans rupture (sans éclairage, comme le fond)
    const clair = melange(melange(B.sol.sable[0], '#d9f6ef', .2), melange(B.sol.sable[0], '#9fe6e0', .25), lisse(-.06, -.4, y));
    const bord = melange(clair, melange(B.sol.sable[0], '#ffffff', .4), lisse(-.03, NIV, y));
    return melange(nuance(bord, fond.jour || 0), fond(x - N / 2, z - N / 2), lisse(-.2, -.86, y));
  }
  if (y < .05) return melange(B.sol.sable[0], '#ffffff', .35); // l’écume, au bord
  if (y < .24) return doux(B.sol.sable);
  if (ny < .7) return melange(doux(B.sol.roche), B.sol.roche[2], .3);
  if (y > 2.05 * YS) return doux(B.sol.neige);
  if (y > 1.3 * YS) return doux(B.sol.roche);
  const h = doux(B.sol.herbe);
  return bruit(x * .6, z * .6, s + 9) < B.taches[1] * 1.15 ? melange(h, B.taches[0], .4) : h;
}
function sol3d(bati, m, B, fond, R) { // les triangles du sol, colorés un par un ; fond(x, z) : la couleur du fond marin à cet endroit
  // renvoie un second maillage : la pente sous l’eau, éclairée sans facettes, qui se fond dans le fond marin
  const h = relief(m), n = Math.round((N + 2 * MARGE) * R), pas = 1 / R, x0 = -MARGE, H = [], s = m.seed % 991, dessous = new Bati(2);
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) H.push(h(x0 + i * pas, x0 + j * pas));
  const P = (i, j) => [x0 + i * pas - N / 2, H[i * (n + 1) + j], x0 + j * pas - N / 2], pos = [], cols = [], posD = [], colsD = [];
  const poser = (a, b, c, r, sous) => {
    if (a[1] < -.86 && b[1] < -.86 && c[1] < -.86) return; // le fond plat : le disque du fond s’en charge
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    const yc = (a[1] + b[1] + c[1]) / 3, xc = (a[0] + b[0] + c[0]) / 3 + N / 2, zc = (a[2] + b[2] + c[2]) / 3 + N / 2;
    if (sous) { // une couleur par sommet : le haut-fond est un dégradé, sans facettes
      posD.push(...a, ...c, ...b);
      for (const v of [a, c, b]) { _c.set(couleurSol(B, fond, Math.min(v[1], NIV - .001), 1, v[0] + N / 2, v[2] + N / 2, r, s)); colsD.push(_c.r, _c.g, _c.b); }
      return;
    }
    _c.set(couleurSol(B, fond, Math.max(yc, NIV), Math.abs(ny / l), xc, zc, r, s)); const k = 1 + (r - .5) * .035;
    pos.push(...a, ...c, ...b); for (let v = 0; v < 3; v++) cols.push(_c.r * k, _c.g * k, _c.b * k);
  };
  const tri = (a, b, c, r) => { // un triangle qui traverse la ligne d’eau est coupé en deux : la terre au-dessus, le haut-fond en dessous
    const T3 = [a, b, c], haut = T3.map(p => p[1] >= NIV), nh = haut.filter(Boolean).length;
    if (nh === 3 || nh === 0) return poser(a, b, c, r, nh === 0);
    const i0 = nh === 1 ? haut.indexOf(true) : haut.indexOf(false), A = T3[i0], Bv = T3[(i0 + 1) % 3], C = T3[(i0 + 2) % 3];
    const cut = (p, q) => { const t = (NIV - p[1]) / (q[1] - p[1]); return [p[0] + (q[0] - p[0]) * t, NIV, p[2] + (q[2] - p[2]) * t]; };
    const AB = cut(A, Bv), AC = cut(A, C), seulEnHaut = nh === 1;
    poser(A, AB, AC, r, !seulEnHaut); poser(AB, Bv, C, r, seulEnHaut); poser(AB, C, AC, r, seulEnHaut);
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1), r1 = hash(`${s}:${i}:${j}`), r2 = (r1 * 7.13) % 1;
    if ((i + j) % 2) { tri(a, b, c, r1); tri(a, c, d, r2); } else { tri(a, b, d, r1); tri(b, c, d, r2); }
  }
  bati.triangles(pos, cols); dessous.triangles(posD, colsD);
  return dessous.maillage(MAT.fond, false, true);
}
function decor3d(bati, m, B, part = 1) {
  const h = relief(m);
  for (const [i, j, dx, dy, r1, r2] of m.decor) {
    if (r2 > B.densite * part) continue;
    const x = i + dx, z = j + dy, y = h(x, z);
    if (y < .06) continue;
    const kind = tirer(B.decor[sol(m, i, j)] || [], r1);
    if (kind) decor(bati, kind, B, x - N / 2, y, z - N / 2, r2);
  }
}
const posTuile = (m, [i, j], barque) => { const y = barque ? 0 : relief(m)(i + .5, j + .5); return [i + .5 - N / 2, y, j + .5 - N / 2]; };

/* ───────── La mer, le fond, le ciel, les nuages ───────── */

const CLAIR = [7, 20], avecJour = (f, T) => Object.assign(f, { jour: T.jour }); // la fonction du fond garde la clarté du climat, pour le haut-fond
const fondIle = T => avecJour((x, z) => melange(T.pres, T.loin, lisse(CLAIR[0], CLAIR[1], Math.hypot(x, z))), T), fondUni = T => avecJour(() => T.loin, T);
function fondMarin(T, rayon = 90, { y = -.92, clair = true } = {}) { // le fond : clair autour de l’île, bleu profond au large
  const g = new THREE.CircleGeometry(rayon, 72, 0, Math.PI * 2).rotateX(-Math.PI / 2), p = g.attributes.position, cols = [], f = clair ? fondIle(T) : fondUni(T);
  for (let i = 0; i < p.count; i++) { _c.set(f(p.getX(i), p.getZ(i))); cols.push(_c.r, _c.g, _c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, MAT.fond); m.position.y = y; m.receiveShadow = true;
  return m;
}
function mer(T, rayon = 90) { // la surface : elle garde son bleu même sous un soleil orangé, et le soleil y brille
  const m = new THREE.Mesh(new THREE.CircleGeometry(rayon, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: T.surface, emissive: T.lueur, emissiveIntensity: T.chaud ? .42 : .32, transparent: true, opacity: .5, roughness: .14, metalness: 0, depthWrite: false }));
  m.receiveShadow = true; m.renderOrder = 1;
  return m;
}
function nuages(n, sombres, rayon = 12, graine = 1, ombre = true) {
  const grp = new THREE.Group(), liste = [];
  for (let i = 0; i < n; i++) {
    const b = new Bati(graine + i), k = { b, s: 1 };
    nuageBati(k, 0, 0, 0, 1.6 + (i % 3) * .5, sombres ? ['#c9d0d8', '#a7b0ba'] : ['#ffffff', '#eef2f7']);
    const m = b.maillage(); m.castShadow = ombre; m.receiveShadow = false; grp.add(m);
    liste.push({ m, an: (i / n) * 6.28 + graine, r: rayon * (1.2 + (i % 2) * .5), y: 7.5 + (i % 3) * 1.4, v: .012 + (i % 3) * .006 });
  }
  return { grp, anim: T => liste.forEach(c => { const a = c.an + T * c.v; c.m.position.set(Math.cos(a) * c.r, c.y, Math.sin(a) * c.r); c.m.rotation.y = -a; }) };
}
function oiseaux(n, rayon = 7) {
  const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#4a3f48', side: THREE.DoubleSide }), liste = [];
  for (let i = 0; i < n; i++) {
    const o = new THREE.Group(), aile = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.05, 0, 0, .05, .28, 0, 0], 3)); return new THREE.Mesh(g, mat); };
    const ag = aile(), ad = aile(); ad.scale.x = -1; o.add(ag, ad); grp.add(o); liste.push({ o, ag, ad, ph: i * 2.1, r: rayon + i * 1.3, y: 3.2 + i * .5 });
  }
  return { grp, anim: T => liste.forEach(b => { const a = T * .22 + b.ph; b.o.position.set(Math.cos(a) * b.r, b.y + Math.sin(T * .7 + b.ph) * .2, Math.sin(a) * b.r); b.o.rotation.y = -a; const f = Math.sin(T * 8 + b.ph) * .5; b.ag.rotation.z = f; b.ad.rotation.z = -f; }) };
}
function scintillements(n, rayon) {
  const grp = new THREE.Group(), liste = [];
  for (let i = 0; i < n; i++) { const s = halo('#ffffff', .35, 0), a = hash(`sc:${i}`) * 6.28, r = rayon * (.45 + hash(`sr:${i}`) * .55); s.position.set(Math.cos(a) * r, .03, Math.sin(a) * r); grp.add(s); liste.push({ s, ph: i * 1.7 }); }
  return { grp, anim: T => liste.forEach(p => { p.s.material.opacity = Math.max(0, Math.sin(T * 1.3 + p.ph)) * .7; }) };
}

/* ───────── La caméra qu’on tourne ───────── */

class Orbite {
  constructor(camera, el) {
    Object.assign(this, { camera, el, azim: Math.PI / 4, elev: .62, dist: 20, cible: new THREE.Vector3() });
    this.but = { azim: this.azim, elev: this.elev, dist: this.dist, cible: this.cible.clone() };
    this.limites = { elev: [.3, 1.05], dist: [7, 60] }; this.repos = 0; this.auto = true;
    let d = null, pts = new Map(), pince = 0;
    el.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); d = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, bouge: false, t: performance.now() }; this.repos = 0; });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !d) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], l = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pince) this.but.dist = Math.max(this.limites.dist[0], Math.min(this.limites.dist[1], this.but.dist * pince / l)); pince = l; d.bouge = true; return; }
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) > 6) d.bouge = true;
      this.but.azim -= dx * .009;
      if (e.pointerType === 'mouse') this.but.elev = Math.max(this.limites.elev[0], Math.min(this.limites.elev[1], this.but.elev + dy * .006));
      d.x = e.clientX; d.y = e.clientY;
    });
    const fin = e => { const tap = d && !d.bouge && pts.size <= 1 && performance.now() - d.t < 600; pts.delete(e.pointerId); if (pts.size < 2) pince = 0; if (tap && e.type === 'pointerup') this.onTap?.(e); if (!pts.size) d = null; };
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin); el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') fin(e); });
    el.addEventListener('wheel', e => { e.preventDefault(); this.but.dist = Math.max(this.limites.dist[0], Math.min(this.limites.dist[1], this.but.dist * (1 + Math.sign(e.deltaY) * .08))); }, { passive: false });
  }
  maj(dt) {
    this.repos += dt;
    if (this.auto && !reduit && this.repos > 5) this.but.azim += dt * .035; // elle tourne doucement, quand on la laisse
    const k = 1 - Math.pow(.001, dt);
    this.azim += (this.but.azim - this.azim) * k; this.elev += (this.but.elev - this.elev) * k; this.dist += (this.but.dist - this.dist) * k; this.cible.lerp(this.but.cible, k);
    const c = Math.cos(this.elev);
    this.camera.position.set(this.cible.x + Math.sin(this.azim) * c * this.dist, this.cible.y + Math.sin(this.elev) * this.dist, this.cible.z + Math.cos(this.azim) * c * this.dist);
    this.camera.lookAt(this.cible);
  }
}

/* ───────── L’île et l’archipel ───────── */

function soleil(scene, climat, portee, ombre = true) { // ombre : non pour l’archipel, où elles ne se voient pas et coûtent cher
  const L = LUM[climat] || LUM.N, sun = new THREE.DirectionalLight(L.soleil, L.i), el = L.elev * Math.PI / 180, az = L.azim * Math.PI / 180;
  sun.position.set(Math.cos(el) * Math.sin(az) * 30, Math.sin(el) * 30, Math.cos(el) * Math.cos(az) * 30);
  sun.castShadow = ombre; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -portee, right: portee, top: portee, bottom: -portee, near: 1, far: 80 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
  scene.add(sun, sun.target, new THREE.HemisphereLight(L.ciel, L.sol, L.hi));
  const disque = halo(L.soleil, 26, climat === 'ED' ? .5 : .9); disque.material.fog = false; disque.position.copy(sun.position).normalize().multiplyScalar(70); scene.add(disque);
  return sun;
}
function ileStatique(d, part = .5, R = 2, fond = null) { // une île entière en un seul maillage (et un pour ce qui éclaire), pour l’archipel et les aperçus
  const B = biomeDe(d.ile.biome), eau = eauDe(d.climat, B), b = new Bati(d.ile.seed % 997 + 1), lum = new Bati(3);
  const dessous = sol3d(b, d.m, B, fond || fondUni(teintes(d.climat, B)), R); decor3d(b, d.m, B, part);
  for (const a of d.assets) { const [x, y, z] = posTuile(d.m, a.tile, a.espece === 'barque'); modeleChose(a, B, hash(`${a.key}:${d.ile.seed}`), { bati: b, lum, dx: x, dy: y, dz: z, s: ECH, eauHex: eau }); }
  const grp = new THREE.Group(), m = b.maillage(); grp.add(m, dessous);
  if (!lum.vide()) grp.add(lum.maillage(MAT.lum, false));
  if (d.phareTile) { const p = modelePhare(), [x, y, z] = posTuile(d.m, d.phareTile); p.objet.position.set(x, y, z); p.objet.scale.setScalar(ECH); grp.add(p.objet); }
  return grp;
}
function etiquette(texte) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.font = '800 30px Nunito, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,40,60,.6)'; x.shadowBlur = 8; x.fillStyle = '#ffffff'; x.fillText(texte, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, fog: false, sizeAttenuation: false })); s.scale.set(.15, .0375, 1); s.renderOrder = 5; // taille fixe à l’écran
  return s;
}
function voilier() {
  const b = new Bati(2), k = { b, s: 1 };
  F(k, cyl(.22, .15, 6), '#8a5a3c', { y: .06, sx: 1, sy: 1.1, sz: .45, rz: Math.PI / 2, ao: .2 }); F(k, cyl(.012, .016, 5), '#6d4a33', { y: .5, sy: .9, ao: 0 });
  F(k, G.prisme, '#fffaf0', { x: .12, y: .12, sx: .02, sy: .8, sz: .5, ry: Math.PI / 2, ao: 0 });
  return b.maillage();
}

/* ───────── L’intro : parler fait pousser l’île, elle en garde la lumière, puis rejoint l’archipel ───────── */
// Rien de littéral : les mots sont des pastilles de lumière, sans lettres. Tout ce que l’intro montre se déduit
// de son temps, en secondes : on peut la revoir, ou la montrer d’emblée terminée quand le mouvement est réduit.

export const INTRO = { descente: 3.4, mots: 5.2, pas: .16, chute: 6.8, intervalle: .26, vol: .55, lanternes: 9.3, depart: 12.6, arrivee: 16.2, fin: 16.5, legendes: [.3, 4.6, 9.3, 12.6] };
// l’île d’exemple : un arbre, une maison, un champ, une pierre, chacun dit avec un texte, donc chacun sous sa lanterne
export const ILE_INTRO = { id: 'intro', seed: 5821, nee: '', biome: 'prairie', envoyee: true, quittee: null, depots: ['s11', 's4', 's3', 's0'].map((s, i) => ({ id: i + 1, quad: 'N', texte: true, answers: { situ: [], mots: [], sujets: [s], fait: [], subi: [] } })) };
const MOTS = [[1, 0, 2, 1], [2, 0, 1, 0]]; // deux lignes, des longueurs de mots, comme un texte qu’on ne lit pas
let _mots = null;
function texturesMots() { // trois longueurs de pastilles : un cœur clair, un halo doré
  if (_mots) return _mots;
  _mots = [1.5, 2.3, 3.2].map(r => {
    const h = 32, w = Math.round(h * r), m = 20, c = document.createElement('canvas'); c.width = w + 2 * m; c.height = h + 2 * m;
    const x = c.getContext('2d'), pastille = () => { x.beginPath(); x.arc(m + h / 2, m + h / 2, h / 2, Math.PI / 2, Math.PI * 1.5); x.arc(m + w - h / 2, m + h / 2, h / 2, -Math.PI / 2, Math.PI / 2); x.closePath(); };
    x.shadowColor = 'rgba(255, 168, 58, 1)'; x.shadowBlur = 18; x.fillStyle = '#ffd98c'; pastille(); x.fill(); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fffaf0'; pastille(); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return { t, r: c.width / c.height, long: r, gauche: m / c.width, haut: c.height / h };
  });
  return _mots;
}
const borne = x => Math.max(0, Math.min(1, x)), sortie = x => 1 - (1 - borne(x)) ** 3; // sortie : un départ vif, une arrivée douce

export class Vue3D {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.className = 'vue3d';
    this.rendu = creerRendu(this.canvas);
    this.camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
    this.orbite = new Orbite(this.camera, this.canvas);
    this.orbite.onTap = e => this.toucher(e);
    this.ray = new THREE.Raycaster(); this.mode = null; this.anims = []; this.cle = ''; this.vie = new Map(); this.objets = new Map();
    this.t0 = performance.now(); this.dernier = 0; this.dimsArch = [18, 36];
  }
  attacher(parent) { parent.append(this.canvas); this.redim(); }
  get actif() { return !!this.canvas.isConnected && !!this.mode; }
  redim() {
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.rendu.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const fit = (larg, haut) => Math.max(haut / (2 * Math.tan(this.camera.fov * Math.PI / 360)), larg / (2 * Math.tan(this.camera.fov * Math.PI / 360) * this.camera.aspect));
    const [L, P] = this.dimsArch;
    const e = this.etendue || N * 1.02; // l’île se cadre selon sa taille : une petite île se voit petite, dans sa mer
    this.distIle = fit(e, e * .62); this.distArch = fit(L * 1.2 + 4, (P * 1.24 + 4) * Math.sin(.72));
    if (this.mode === 'ile' && !this.zoomManuel) this.orbite.but.dist = this.distIle;
  }
  vider() { if (this.scene) { liberer(this.scene); this.scene.background?.dispose?.(); } this.scene = new THREE.Scene(); this.anims = []; this.objets = new Map(); }

  montrerIle(d, opts = {}) {
    const B = biomeDe(d.ile.biome), eau = eauDe(d.climat, B), cle = `${d.ile.id}:${d.ile.seed}:${d.ile.biome}:${d.climat}:${d.ile.depots.length}`;
    this.vie = opts.vie || this.vie; this.sel = null; this.d = d;
    if (this.mode === 'ile' && this.cle === cle) return;
    const premiere = this.mode !== 'ile';
    this.mode = 'ile'; this.cle = cle; this.vider();
    this.etendue = Math.max(d.m.rayon * 2 - .2, 4.6); const cibleY = .05 + .05 * this.etendue; // la caméra suit la taille de l’île : de près quand elle est jeune, de plus loin quand elle a grandi
    this.redim(); if (!premiere) this.orbite.but.cible.y = cibleY;
    const s = this.scene, cl = CLIMATS[d.climat] || CLIMATS.N;
    const T = teintes(d.climat, B), D = this.distIle || 20;
    s.background = fondCiel(d.climat); s.fog = new THREE.Fog(T.brume, D * (d.climat === 'ED' ? 1.1 : 1.5), D * (d.climat === 'ED' ? 3.6 : 4.8));
    soleil(s, d.climat, 9);
    s.add(fondMarin(T)); this.eau = mer(T); s.add(this.eau);
    const b = new Bati(d.ile.seed % 997 + 1), dessous = sol3d(b, d.m, B, fondIle(T), 3); decor3d(b, d.m, B);
    const terrain = b.maillage(); terrain.castShadow = true; s.add(terrain, dessous);
    for (const a of d.assets) {
      const r = modeleChose(a, B, hash(`${a.key}:${d.ile.seed}`), { eauHex: eau }), [x, y, z] = posTuile(d.m, a.tile, a.espece === 'barque');
      r.objet.position.set(x, y, z); r.objet.rotation.y = (hash(`rot:${a.key}:${d.ile.seed}`) - .5) * .8; r.objet.userData.ech = ECH;
      r.objet.traverse(o => { o.userData.key = a.key; });
      s.add(r.objet); this.objets.set(a.key, r.objet); this.anims.push(...r.anims);
      if (a.espece === 'barque') { const o = r.objet; this.anims.push(T => { o.position.y = Math.sin(T * 1.3 + x) * .02; o.rotation.z = Math.sin(T * 1.1 + z) * .04; }); }
    }
    if (d.phareTile) { const p = modelePhare(), [x, y, z] = posTuile(d.m, d.phareTile); p.objet.position.set(x, y, z); p.objet.userData.ech = ECH; p.objet.traverse(o => { o.userData.key = 'phare'; }); s.add(p.objet); this.objets.set('phare', p.objet); this.anims.push(...p.anims); }
    const nu = nuages(4, d.climat === 'ED' || d.climat === 'AD', 12, d.ile.seed % 7); s.add(nu.grp); this.anims.push(nu.anim);
    if (cl.oiseaux) { const oi = oiseaux(3, 6.5); s.add(oi.grp); this.anims.push(oi.anim); }
    const sc = scintillements(16, 12); s.add(sc.grp); this.anims.push(sc.anim);
    for (let k = 0; k < 3; k++) { const far = ileStatique(deriver({ id: `loin${k}`, seed: d.ile.seed + 101 * (k + 1), biome: d.ile.biome, depots: [] }, { pleine: true }), .3, 2, fondUni(T)), an = 2.2 + k * 1.3; far.position.set(Math.cos(an) * (30 + k * 8), 0, Math.sin(an) * (30 + k * 8)); far.scale.setScalar(.6); s.add(far); } // d’autres îles, au loin
    this.anneau = new THREE.Mesh(new THREE.TorusGeometry(.5, .025, 4, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9 })); this.anneau.rotation.x = Math.PI / 2; this.anneau.visible = false; s.add(this.anneau);
    this.orbite.limites = { elev: [.2, 1.1], dist: [4.5, 34] }; this.orbite.auto = true;
    if (premiere) { this.zoomManuel = false; this.redim(); Object.assign(this.orbite.but, { elev: .56, dist: this.distIle }); this.orbite.but.cible.set(0, cibleY, 0); this.orbite.dist = this.distIle * 1.25; this.orbite.cible.set(0, cibleY, 0); }
  }
  tourner() { this.orbite.but.azim += Math.PI / 2; this.orbite.repos = 0; }
  choisir(cle) {
    this.sel = cle; const o = cle ? this.objets.get(cle) : null;
    this.anneau.visible = !!o; if (o) this.anneau.position.set(o.position.x, o.position.y + .03, o.position.z);
  }

  baseArchipel(items) { // la mer du soir, ses îles, ses nuages, ses oiseaux et ses voiliers : pour l’archipel, et pour l’intro
    this.cle = ''; this.vider(); this.items = items; this.focus = null;
    const s = this.scene, T = teintes('ES', BIOMES.tropique);
    this.redim(); const D = this.distArch, [L, P] = this.dimsArch;
    s.background = fondCiel('ES'); s.fog = new THREE.Fog(T.brume, D * .95, D * 2.4);
    soleil(s, 'ES', Math.max(L, P) * .75, false);
    s.add(fondMarin(T, 200, { y: -.9 * .45 - .01, clair: false })); this.eau = mer(T, 200); s.add(this.eau); this.fondArch = fondUni(T);
    for (const it of items) this.ajouterIle(it);
    const nu = nuages(6, false, Math.max(L, P) * .8, 3, false); s.add(nu.grp); this.anims.push(nu.anim);
    const oi = oiseaux(4, 16); s.add(oi.grp); this.anims.push(oi.anim);
    for (let k = 0; k < 3; k++) { const v = voilier(), r = 14 + k * 5, ph = k * 2.2; s.add(v); this.anims.push(T => { const a = T * (.025 + k * .008) + ph; v.position.set(Math.cos(a) * r, Math.sin(T + k) * .03, Math.sin(a) * r * .75); v.rotation.y = -a - Math.PI / 2; }); }
    this.anneau = new THREE.Mesh(new THREE.TorusGeometry(2.6, .06, 4, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9 })); this.anneau.rotation.x = Math.PI / 2; this.anneau.visible = false; s.add(this.anneau);
  }
  montrerArchipel(items, opts = {}) {
    this.mode = 'archipel'; this.baseArchipel(items); this.onArrivee = opts.onArrivee; this.nouvelle = opts.nouvelle;
    const D = this.distArch;
    this.orbite.limites = { elev: [.35, 1.2], dist: [8, D * 1.4] }; this.orbite.auto = false;
    Object.assign(this.orbite.but, { azim: 0, elev: .72, dist: this.distArch }); this.orbite.but.cible.set(0, 0, -1);
    this.orbite.azim = 0; this.orbite.dist = this.distArch * 1.15; this.orbite.cible.set(0, 0, -1);
    this.prochaine = (performance.now() - this.t0) / 1000 + 3;
  }
  ajouterIle(it, depuis = null) {
    const grp = ileStatique(it.d || (it.d = deriver(it.ile)), .35, 3, this.fondArch), e = ECH_ARCH;
    grp.scale.setScalar(e); grp.position.set(it.x, 0, it.z); grp.traverse(o => { o.userData.ile = it; });
    this.scene.add(grp); it.grp = grp;
    if (it.mine) { const lab = etiquette(it.label || 'la tienne'); lab.position.set(it.x, 2.6, it.z); this.scene.add(lab); it.lab = lab; }
    if (depuis) { const t0 = (performance.now() - this.t0) / 1000, [x0, z0] = depuis, x1 = it.x, z1 = it.z; grp.position.set(x0, 0, z0); this.anims.push(T => { const p = Math.min(1, (T - t0) / 5), k = 1 - (1 - p) ** 3; grp.position.set(lerp(x0, x1, k), 0, lerp(z0, z1, k)); if (p >= 1 && !it.arrivee) { it.arrivee = true; this.vague(x1, z1, T); } }); }
  }
  vague(x, z, T0) { // une île arrive : un anneau s’ouvre sur l’eau
    const m = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .8, depthWrite: false })); m.position.set(x, .02, z); this.scene.add(m);
    this.anims.push(T => { const a = T - T0; if (a > 2) { m.visible = false; return; } m.scale.setScalar(1 + a * 2.2); m.material.opacity = (1 - a / 2) * .8; });
  }
  viser(it) { // s’approcher d’une île, ou revenir à l’archipel
    this.focus = it;
    if (it) { const ray = (it.d || (it.d = deriver(it.ile))).m.rayon * ECH_ARCH; this.orbite.but.cible.set(it.x, .3, it.z); this.orbite.but.dist = 5 + ray * 2.6; this.orbite.but.elev = .62; this.anneau.visible = true; this.anneau.position.set(it.x, .03, it.z); this.anneau.scale.setScalar((ray + .35) / 2.6); }
    else { this.orbite.but.cible.set(0, 0, -1); this.orbite.but.dist = this.distArch; this.orbite.but.elev = .72; this.anneau.visible = false; }
  }

  // L’intro : l’archipel, puis un îlot au premier plan. Des mots s’y posent un à un : à chacun la terre monte,
  // et une chose pousse. Leur lumière reste en lanternes. Puis l’île rejoint sa place dans l’archipel.
  // demo : { ile, x, z }, l’île d’exemple et sa place ; opts : { onEtape(i), onFin(), nouvelle }
  montrerIntro(items, demo, opts = {}) {
    this.mode = 'intro'; this.baseArchipel(items); this.nouvelle = opts.nouvelle; this.onArrivee = null; this.prochaine = Infinity;
    const s = this.scene, B = biomeDe(demo.ile.biome), E = ECH_ARCH, seed = demo.ile.seed, eau = eauDe('N', B), [, P] = this.dimsArch;
    const x0 = demo.x + 1.5, z0 = Math.max(demo.z + 8, P / 2 + 6), az = .3; // l’îlot pousse devant l’archipel, puis le rejoint
    const ile = new THREE.Group(); ile.scale.setScalar(E); ile.position.set(x0, 0, z0); s.add(ile);
    const etapes = []; // la terre : l’îlot vide a 12 tuiles, chaque mot en ajoute 3
    for (let q = 0; q <= MOTS.flat().length; q++) {
      const m = etape(seed, 12 + 3 * q), b = new Bati(seed % 997 + 1), dessous = sol3d(b, m, B, this.fondArch, 3); decor3d(b, m, B, .8);
      const g = new THREE.Group(); g.add(b.maillage(), dessous); g.visible = !q; ile.add(g);
      etapes.push({ m, g, h: relief(m) });
    }
    const d = deriver(demo.ile), choses = d.assets.map(a => { // la chose de chaque dépôt ; elle paraît quand son mot touche l’île
      const k = demo.ile.depots.findIndex(x => x.id === a.ne), r = modeleChose(a, B, hash(`${a.key}:${seed}`), { eauHex: eau }), o = r.objet, [x, , z] = posTuile(d.m, a.tile);
      o.position.set(x, 0, z); o.rotation.y = (hash(`rot:${a.key}:${seed}`) - .5) * .8; o.visible = false; ile.add(o); this.anims.push(...r.anims);
      const lanternes = []; o.traverse(c => { if (c.userData.lanterne) lanternes.push({ o: c, s: c.scale.x, halos: [] }); });
      for (const l of lanternes) l.o.traverse(c => { if (c.isSprite) l.halos.push(c); });
      return { o, k, tile: a.tile, lanternes, y: etapes.map(e => e.h(a.tile[0] + .5, a.tile[1] + .5)) };
    });
    const tex = texturesMots(), H = .19, ESP = .1, droite = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const larg = l => l.reduce((t, i) => t + H * tex[i].long, 0) + ESP * (l.length - 1), W = Math.max(...MOTS.map(larg)), mots = [];
    MOTS.forEach((ligne, li) => { // les mots flottent au-dessus de l’îlot, tournés vers nous, alignés comme un texte
      let u = -W / 2;
      for (const i of ligne) {
        const T = tex[i], w = H * T.long, sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.t, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0 }));
        const p0 = new THREE.Vector3(x0, 1.95 - li * .34, z0).addScaledVector(droite, u);
        sp.center.set(T.gauche, .5); sp.renderOrder = 4; sp.position.copy(p0); sp.visible = false; s.add(sp);
        const goutte = halo('#ffd27a', .34, 0); goutte.renderOrder = 4; goutte.visible = false; s.add(goutte);
        const rond = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff6dc', transparent: true, opacity: 0, depthWrite: false })); rond.visible = false; rond.renderOrder = 2; s.add(rond);
        mots.push({ sp, goutte, rond, plein: [H * T.haut * T.r, H * T.haut], y0: p0.y, depart: p0.clone().addScaledVector(droite, w / 2) });
        u += w + ESP;
      }
    });
    mots.forEach((mt, j) => { // où tombe chaque mot : sur la chose qu’il fait pousser, ou sur l’eau, là où la terre va monter
      const avant = etapes[j], apres = etapes[j + 1];
      let t = j % 2 ? choses.find(c => c.k === (j - 1) / 2)?.tile : null, best = -Infinity;
      if (!t) for (let i = 0; i < N; i++) for (let jj = 0; jj < N; jj++) { const kk = i * N + jj, v = (i - N / 2) * Math.sin(az) + (jj - N / 2) * Math.cos(az); if (apres.m.land[kk] && !avant.m.land[kk] && v > best) { best = v; t = [i, jj]; } }
      t = t || [N / 2, N / 2];
      mt.cible = new THREE.Vector3(x0 + (t[0] + .5 - N / 2) * E, Math.max(0, avant.h(t[0] + .5, t[1] + .5)) * E + .02, z0 + (t[1] + .5 - N / 2) * E);
    });
    const vague = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); vague.visible = false; s.add(vague);
    const nom = etiquette('ton île'); nom.material.opacity = 0; s.add(nom);
    this.intro = { t: 0, etape: -1, fini: false, onEtape: opts.onEtape, onFin: opts.onFin, ile, etapes, choses, mots, vague, nom, az, x0, z0, x1: demo.x, z1: demo.z, rayon: d.m.rayon * E };
    this.introAller(reduit ? INTRO.arrivee + 3 : 0); // sans mouvement : tout est déjà en place, l’eau calmée
  }
  introAller(t) { Object.assign(this.intro, { t, etape: -1, fini: false }); this.prochaine = Infinity; } // revoir, ou sauter à un moment
  poserCamera({ az, el, d, c }) { const k = Math.cos(el); this.camera.position.set(c[0] + Math.sin(az) * k * d, c[1] + Math.sin(el) * d, c[2] + Math.cos(az) * k * d); this.camera.lookAt(c[0], c[1], c[2]); }
  introFrame(dt) {
    const I = this.intro, t = (I.t += reduit ? 0 : dt), pose = j => INTRO.chute + j * INTRO.intervalle + INTRO.vol;
    // la terre : l’étape acquise, et celles qui montent encore, de sous l’eau
    let base = 0;
    for (let q = 1; q < I.etapes.length; q++) if (t >= pose(q - 1) + .54) base = q;
    I.etapes.forEach((e, q) => { const monte = q > base && t >= pose(q - 1); e.g.visible = q === base || monte; e.g.position.y = monte ? -.35 * (1 - (t - pose(q - 1)) / .6) ** 2 : 0; });
    for (const c of I.choses) { // chaque chose pousse avec son mot, posée sur la terre qui monte ; puis sa lanterne se lève
      const sc = ECH * pop(pose(2 * c.k + 1), t);
      c.o.visible = sc > .001; c.o.scale.setScalar(Math.max(sc, .001));
      let y = -1; I.etapes.forEach((e, q) => { if (e.g.visible) y = Math.max(y, c.y[q] + e.g.position.y); }); c.o.position.y = y;
      const e = sortie((t - INTRO.lanternes - c.k * .3) / .8);
      for (const l of c.lanternes) { l.o.visible = e > 0; l.o.scale.setScalar(l.s * Math.max(e, .001)); l.o.position.y -= (1 - e) * .45; for (const h of l.halos) h.material.opacity *= e; }
    }
    I.mots.forEach((m, j) => { // un mot paraît, flotte, puis tombe sur l’île en goutte de lumière ; un anneau s’ouvre là où il touche
      const a = sortie((t - INTRO.mots - j * INTRO.pas - (j >= MOTS[0].length ? .2 : 0)) / .25), f = borne((t - INTRO.chute - j * INTRO.intervalle) / INTRO.vol), g = (t - pose(j)) / .3, r = (t - pose(j)) / .9;
      m.sp.visible = a > 0 && f < .35; m.sp.material.opacity = a * (1 - f / .35);
      m.sp.scale.set(m.plein[0] * (.15 + .85 * a), m.plein[1], 1); m.sp.position.y = m.y0 - (1 - a) * .04 + Math.sin(t * 2.2 + j) * .015;
      m.goutte.visible = (f > 0 && f < 1) || (g >= 0 && g < 1);
      if (f > 0 && f < 1) { const u = f ** 1.5, v = 1 - u; m.goutte.position.set(v * v * m.depart.x + 2 * u * v * m.depart.x + u * u * m.cible.x, v * v * m.depart.y + 2 * u * v * (m.depart.y + .3) + u * u * m.cible.y, v * v * m.depart.z + 2 * u * v * m.depart.z + u * u * m.cible.z); m.goutte.scale.setScalar(.34); m.goutte.material.opacity = borne(f / .2); }
      else if (g >= 0 && g < 1) { m.goutte.position.copy(m.cible); m.goutte.scale.setScalar(.34 + g * .5); m.goutte.material.opacity = 1 - g; }
      m.rond.visible = r >= 0 && r < 1;
      if (m.rond.visible) { m.rond.position.copy(m.cible); m.rond.scale.setScalar(.08 + r * .45); m.rond.material.opacity = (1 - r) * .85; }
    });
    // l’île rejoint sa place ; un anneau s’ouvre sur l’eau, et son nom paraît
    const ui = lisse(INTRO.depart, INTRO.arrivee, t), ip = I.ile.position;
    ip.set(lerp(I.x0, I.x1, ui), 0, lerp(I.z0, I.z1, ui));
    const v = (t - INTRO.arrivee) / 2.2; I.vague.visible = v >= 0 && v < 1;
    if (I.vague.visible) { I.vague.position.set(I.x1, .02, I.z1); I.vague.scale.setScalar((I.rayon + .3) * (1 + v * 1.6)); I.vague.material.opacity = (1 - v) * .8; }
    I.nom.position.set(ip.x, 1.9, ip.z); I.nom.material.opacity = lisse(INTRO.arrivee - .4, INTRO.arrivee + .5, t);
    // la caméra : l’archipel de haut, la descente vers l’îlot, puis le recul, pendant que l’île s’en va
    const tan2 = 2 * Math.tan(this.camera.fov * Math.PI / 360), cadre = (l, h) => Math.max(h / tan2, l / (tan2 * this.camera.aspect)), [L, P] = this.dimsArch;
    const pousse = lisse(INTRO.chute, INTRO.lanternes + .6, t), dP = Math.max(6.5, cadre(lerp(2.9, 3.7, pousse), 3.3)), dA = cadre(L + 3, (P + 3) * Math.sin(.78) + 2); // de près, l’îlot et ses mots ; de loin, l’archipel entier, un peu rogné sur les côtés
    const melange3 = (p, q, u, uc = u) => ({ az: lerp(p.az, q.az, u), el: lerp(p.el, q.el, u), d: Math.exp(lerp(Math.log(p.d), Math.log(q.d), u)), c: p.c.map((x, i) => lerp(x, q.c[i], uc)) });
    const haut = { az: -.14, el: .84, d: dA * 1.08, c: [0, 0, 0] }, large = { az: 0, el: .78, d: dA, c: [0, 0, .5] };
    const parmi = { az: .06 * Math.sin(Math.max(0, t - INTRO.depart - 3.6) * .12), el: .8, d: dA * .8, c: [I.x1 * .4, 0, I.z1 - 11] }; // à la fin : ton île, au premier plan, parmi les autres
    const pres = { az: I.az + .02 * (t - INTRO.descente), el: .5, d: dP, c: [ip.x, lerp(.95, .5, pousse), ip.z] };
    if (reduit) this.poserCamera({ az: .35, el: .86, d: dP * 1.6, c: [I.x1, .3, I.z1] }); // sans mouvement : une seule image, l’île déjà parmi les autres, vue d’assez haut pour qu’aucune ne la cache
    else if (t < INTRO.depart) this.poserCamera(melange3(melange3(haut, large, sortie(t / INTRO.descente)), pres, lisse(INTRO.descente, INTRO.mots, t)));
    else { const u = lisse(INTRO.depart, INTRO.depart + 3.6, t); this.poserCamera(melange3(pres, parmi, u, u * u)); } // on recule en gardant l’île au centre, puis on la laisse rejoindre les autres
    // les légendes suivent, et l’archipel reprend vie quand tout est en place
    const n = INTRO.legendes.filter(x => x <= t).length - 1;
    if (n !== I.etape) { I.etape = n; if (n >= 0) I.onEtape?.(n); }
    if (t >= INTRO.fin && !I.fini) { I.fini = true; this.prochaine = (performance.now() - this.t0) / 1000 + 4; I.onFin?.(); }
  }

  toucher(e) {
    if (this.mode === 'intro') return; // l’intro se regarde ; on la passe avec le bouton
    const r = this.canvas.getBoundingClientRect(), v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = this.ray.intersectObjects(this.scene.children, true).find(h => h.object.userData.key || h.object.userData.ile);
    if (this.mode === 'ile') { const cle = hit?.object.userData.key || null; this.choisir(cle); this.onTouche?.(cle); }
    else { const it = hit?.object.userData.ile || null; this.viser(it); this.onTouche?.(it); }
  }

  frame() {
    if (!this.actif) return;
    const T = (performance.now() - this.t0) / 1000, ecart = T - this.dernier, dt = Math.min(.05, ecart || .016); this.dernier = T;
    if ((this.mode === 'archipel' || this.mode === 'intro') && T > this.prochaine && !reduit && this.nouvelle) { const it = this.nouvelle(); this.items.push(it); this.ajouterIle(it, [it.x + (Math.random() - .5) * 8, -70]); this.onArrivee?.(it); this.prochaine = T + 5 + Math.random() * 6; }
    if (this.mode !== 'intro') this.orbite.maj(dt);
    if (this.eau) this.eau.position.y = Math.sin(T * .6) * .015; // la marée, à peine
    for (const f of this.anims) f(T);
    if (this.mode === 'intro') this.introFrame(Math.min(.1, ecart || .016)); // le temps de l’intro s’arrête quand la page est cachée
    const Tv = this.vieT ? this.vieT() : T;
    if (this.mode === 'ile') for (const [cle, o] of this.objets) o.scale.setScalar((o.userData.ech || 1) * pop(this.vie.get(cle), Tv));
    this.rendu.render(this.scene, this.camera);
  }
}

/* ───────── L’îlot des graines ───────── */

export class Ilot3D {
  constructor(canvas) {
    this.canvas = canvas; this.rendu = creerRendu(canvas, { alpha: true, ombres: true });
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(28, 2, .1, 50);
    const sun = this.sun = new THREE.DirectionalLight('#fff4e4', 2.2); sun.position.set(3, 6, 4); sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: .5, far: 20 }); sun.shadow.normalBias = .02;
    this.scene.add(sun, new THREE.HemisphereLight('#eef8ff', '#e2d2b8', 1.6));
    this.groupe = new THREE.Group(); this.scene.add(this.groupe); this.anims = []; this.cle = null; this.t0 = performance.now(); this.objets = [];
  }
  redim() { const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 120; this.rendu.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.cadrer(); }
  cadrer(doux = false) { // la caméra suit ce qui est posé : un caillou seul se voit de près, un arbre et un nuage de plus loin
    const b = this.boite, t = 2 * Math.tan(this.camera.fov * Math.PI / 360);
    const rayon = b ? Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) : .8, bas = b ? b.min.y : -1, haut = (b ? b.max.y : 1.2) + rayon * .35; // vu d’un peu haut, le bord du fond de l’îlot monte
    this.visee = { d: Math.max((haut - bas) * 1.16 / t, (2 * rayon * 1.2) / (t * this.camera.aspect)), y: (haut + bas) / 2 };
    if (!doux || !this.vise) this.vise = { ...this.visee };
    this.placer();
  }
  placer() { const { d, y } = this.vise; this.camera.position.set(0, y + d * Math.sin(.3), d * Math.cos(.3)); this.camera.lookAt(0, y, 0); }
  mesurer(ech) { // la boîte de ce qui est posé, sans les cailloux qui tournent autour ni les lumières
    this.groupe.rotation.y = 0; this.groupe.position.y = 0; this.groupe.scale.setScalar(1);
    for (const o of this.objets) o.scale.setScalar(ech);
    this.groupe.updateMatrixWorld(true);
    const boite = new THREE.Box3(), une = new THREE.Box3();
    this.groupe.traverse(o => { if (!o.isMesh || this.cailloux.includes(o) || (o.material?.transparent && o.material !== MAT.propose)) return; une.setFromObject(o); boite.union(une); });
    this.boite = boite.isEmpty() ? null : boite;
  }
  maj(graines, B, seed, vie, signes = {}) { // signes : { phare, lourd } ; le danger allume un phare, « pas bien du tout » couvre le ciel
    this.vie = vie;
    const cle = `${B === BIOMES.neige}:${Object.keys(BIOMES).find(k => BIOMES[k] === B)}:${seed}:${signes.phare ? 'phare' : ''}:${signes.lourd ? 'lourd' : ''}:${graines.map(g => `${g.key}/${g.espece}/${g.stade}/${g.propose ? 1 : 0}/${Object.entries(g.etats).filter(([, v]) => v).map(([k]) => k).join('+')}`).join(',')}`;
    if (cle === this.cle) return;
    this.cle = cle;
    liberer(this.groupe); this.groupe.clear(); this.anims = []; this.objets = [];
    const n = Math.max(1, Math.min(6, graines.length)), r = [.55, .78, .95, 1, 1.15, 1.2][n - 1], ech = n >= 3 ? .78 : 1; this.rayon = r;
    const b = new Bati(seed % 97 + 1), k = { b, s: 1 };
    F(k, cyl(r, r * .97, 12), B.sol.herbe[0], { y: -.03, sy: .06, ao: 0, varie: .05 });
    F(k, cyl(r * .97, r * .9, 12), B.falaise[0], { y: -.12, sy: .13, ao: .3 });
    const hc = .3 + r * .16; // la base de l’îlot reste discrète : l’îlot et ce qui y pousse prennent la place
    F(k, cone(9), B.enneige ? '#b9c3cf' : '#b8a896', { y: -.19 - hc / 2, sx: r * .9, sy: hc, sz: r * .9, rx: Math.PI, bosse: .12, graine: 3, ao: .35 });
    const rr = n => { const r2 = (n * 16807 % 2147483647) / 2147483647; return r2; };
    for (let i = 0; i < 7; i++) { const an = i * 2.4, d = r * (.35 + rr(i + seed) * .55); decor(b, tirer(B.decor.herbe, rr(i * 7 + seed)), B, Math.cos(an) * d, 0, Math.sin(an) * d, rr(i * 3 + 1)); }
    const socle = b.maillage(); this.groupe.add(socle);
    this.cailloux = [0, 1, 2].map(i => { const cb = new Bati(i + 4); F({ b: cb, s: 1 }, G.dode, B.enneige ? '#a9b3bf' : '#a39383', { s: .09 - i * .02, bosse: .2, graine: i }); const m = cb.maillage(); this.groupe.add(m); return m; });
    const places = [[[0, 0]], [[-.3, 0], [.3, 0]], [[0, -.32], [-.34, .22], [.34, .22]], [[-.33, -.3], [.33, -.3], [-.33, .3], [.33, .3]], [[0, -.5], [-.48, -.12], [.48, -.12], [-.3, .42], [.3, .42]], [[-.5, -.3], [0, -.5], [.5, -.3], [-.5, .3], [0, .5], [.5, .3]]][n - 1];
    graines.slice(0, 6).forEach((a, i) => {
      const [x, z] = places[i], m = modeleChose(a, B, hash(`${a.key}:${seed}`), { bas: true, propose: a.propose, eauHex: eauDe('N', B) });
      m.objet.position.set(x, 0, z); m.objet.userData.cle = a.key; m.objet.userData.ech = ech; this.groupe.add(m.objet); this.objets.push(m.objet); this.anims.push(...m.anims);
    });
    if (signes.phare) { // en danger : un phare au bord de l’îlot, pour parler à quelqu’un
      const p = modelePhare(); p.objet.position.set(r * .8, 0, -r * .3); p.objet.scale.setScalar(.5); this.groupe.add(p.objet); this.anims.push(...p.anims);
    }
    this.mesurer(ech);
    if (signes.lourd) { // pas bien du tout : un nuage gris juste au-dessus de ce qui a poussé, et moins de soleil
      const nb = new Bati(9); nuageBati({ b: nb, s: 1 }, 0, 0, 0, .7, ['#b9c0c9', '#98a1ac']);
      const nu = nb.maillage(); nu.position.set(0, Math.max(.75, (this.boite?.max.y ?? .5) + .32), 0); nu.castShadow = true; this.groupe.add(nu);
      this.mesurer(ech);
    }
    this.sun.intensity = signes.lourd ? 1.35 : 2.2;
    this.cadrer(true);
  }
  frame() {
    const T = (performance.now() - this.t0) / 1000;
    if (this.visee && this.vise) { const k = reduit ? 1 : .08; this.vise.d += (this.visee.d - this.vise.d) * k; this.vise.y += (this.visee.y - this.vise.y) * k; this.placer(); }
    this.groupe.rotation.y = reduit ? .5 : T * .22;
    this.groupe.position.y = reduit ? 0 : Math.sin(T * .9) * .04;
    this.cailloux?.forEach((c, i) => { const a = T * .3 + i * 2.1, r = (this.rayon || .6) * 1.2; c.position.set(Math.cos(a) * r, -.22 - i * .09 + Math.sin(T + i) * .04, Math.sin(a) * r); c.rotation.y = T * .5 + i; });
    const Tv = this.vieT ? this.vieT() : T;
    for (const o of this.objets) o.scale.setScalar(o.userData.ech * pop(this.vie?.get(o.userData.cle), Tv));
    for (const f of this.anims) f(T);
    this.rendu.render(this.scene, this.camera);
  }
}

/* ───────── Les aperçus des paysages ───────── */

let atelier = null;
export function apercu(cible, biome, depots) { // une petite île d’exemple, rendue une fois, copiée dans un canvas 2D
  if (!atelier) { const c = document.createElement('canvas'); c.width = 280; c.height = 252; atelier = { c, r: creerRendu(c, { alpha: false, ombres: true }), cam: new THREE.PerspectiveCamera(30, 280 / 252, .1, 200) }; atelier.r.setPixelRatio(1); atelier.r.setSize(280, 252, false); }
  const s = new THREE.Scene(), eau = eauDe('N', BIOMES[biome]); s.background = new THREE.Color('#5cc6de'); s.fog = new THREE.Fog('#8fd9ea', 20, 60);
  const T = teintes('N', BIOMES[biome]); soleil(s, 'N', 8); s.add(fondMarin(T, 40), mer(T, 40));
  const ex = { id: `apercu:${biome}`, seed: 90210, biome, depots }, ile = ileStatique(deriver(ex, { pleine: true }), .8, 2, fondIle(T)); s.add(ile);
  atelier.cam.position.set(9.5, 9.5, 9.5); atelier.cam.lookAt(0, .2, 0);
  atelier.r.render(s, atelier.cam);
  const x = cible.getContext('2d'), w = cible.width, h = cible.height; x.drawImage(atelier.c, 0, 0, w, h);
  liberer(s);
}
export { reduit };
