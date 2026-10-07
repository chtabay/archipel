// Le chemin : le monde de la frise. Un long ruban le long d’un chemin ; chaque jour en est une tranche de L mètres, vue de
// côté, avec tous ses plans à la fois : le premier plan, le chemin, le plan moyen, le lointain et le ciel. Chaque jour a son
// lieu, ses objets, ceux que la page appelle, et à chaque jointure un objet de raccord. Tout se déduit des pages et d’une
// graine : la même page donne la même tranche. La caméra est orthogonale : deux tuiles voisines se raccordent sans couture.

import * as THREE from './vendor/three-chemin.min.js?v=1';
import { rng, hash, melange, nuance } from '../outils.js?v=1';

export const L = 14, V = 11, ELEV = 8 * Math.PI / 180, HAUT = 1000, LARGE = Math.round(HAUT * L / V), MARGE = 40; // un jour : 14 m de long, une tuile de 1273 × 1000 points, et une marge pour le pinceau
const BAS = -2.2; // le bas de l’image, en mètres, sous le chemin
const PLANS = { avant: [1.4, 3], bord: [-2.2, -1.1], milieu: [-3.4, -11], fond: [-15, -26] };
const recul = z => (z >= -1 ? 1 : 1 / (1 + (-z - 1) / 16)); // la fausse perspective : plus loin, plus petit
// Le sol monte vers le fond, comme une scène de théâtre, ou un rouleau peint : vues presque de côté, les choses restent
// debout, et le sol se voit, du premier plan jusqu’à l’horizon
const RAMPE = 1.7, rampe = z => (z < 0 ? RAMPE * (1 - Math.exp(z / 10)) : -.32 * z);
// les tailles, par plan : la plus petite et la plus grande hauteur, la plus grande largeur
const TAILLES = { avant: [.25, 1, 2.4], bord: [.3, 3, 5], chemin: [.2, 1.9, 3], milieu: [.5, 8, 12], fond: [1, 14, 16] };

/* ───────── Le catalogue, par familles ───────── */

const FAMILLES = {
  arbres: /^nature-kit\/tree_(default|oak|detailed|fat|simple|tall|thin|cone|plateau)(_dark)?$/, arbresAutomne: /^nature-kit\/tree_\w+_fall$/,
  pins: /^nature-kit\/tree_pine(Default|Round|Tall)/, sapinsNeige: /^holiday-kit\/tree-snow/, petitsArbres: /^nature-kit\/tree_(small|pineSmall)/,
  buissons: /^nature-kit\/plant_bush/, rochers: /^nature-kit\/rock_(large|tall)/, cailloux: /^nature-kit\/(rock|stone)_small/,
  champignons: /^nature-kit\/mushroom/, souches: /^nature-kit\/(stump|log)/, herbes: /^nature-kit\/grass/, fleurs: /^nature-kit\/flower_/,
  cultures: /^nature-kit\/crops_(wheat|corn)Stage[BCD]/, potager: /^nature-kit\/crop_/, clotures: /^nature-kit\/fence_(simple|planks)$/,
  maisons: /^city-kit-suburban\/building-type/, immeubles: /^city-kit-commercial\/building-[a-n]$/, lanternes: /^fantasy-town-kit\/lantern$/,
  palmiers: /^nature-kit\/tree_palm(Short|Tall|Bend)?$/, bateaux: /^watercraft-kit\/boat-(sail|row|fishing)/, rochersSable: /^pirate-kit\/rocks-sand/,
  meubles: /^furniture-kit\/(bookcaseOpen|bookcaseClosed|lampRoundFloor|lampSquareFloor|pottedPlant|plantSmall\d|loungeChair|sideTable|cabinetTelevision|coatRackStanding)$/,
  tapis: /^furniture-kit\/rug(Rectangle|Round|Rounded|Square)$/, tables: /^furniture-kit\/(table|tableRound|tableCloth)$/, chaises: /^furniture-kit\/(chair|chairCushion|chairRounded)$/,
  haies: /^fantasy-town-kit\/hedge(-large)?$/, portails: /^fantasy-town-kit\/(hedge-gate|hedge-large-gate|fence-gate)$/, rails: /^train-kit\/track$/,
};
export function familles(catalogue) {
  const out = Object.fromEntries(Object.keys(FAMILLES).map(k => [k, []])), parId = new Map();
  for (const o of catalogue) { parId.set(o.id, o); for (const [k, re] of Object.entries(FAMILLES)) if (re.test(o.id)) out[k].push(o); }
  return { ...out, parId };
}

/* ───────── Le temps qu’il fait : la teinte du jour ───────── */

export function saisonDe(date) { const m = new Date(date).getMonth() + 1; return m === 12 || m <= 2 ? 'hiver' : m <= 5 ? 'printemps' : m <= 8 ? 'ete' : 'automne'; }
// la tonalité d’une page : sa valence, son énergie, son heure ; rend la couleur du ciel et la teinte posée sur la peinture
export function climatDe(lecture) {
  const v = Math.max(-1, Math.min(1, lecture.valence * 1.6)), e = Math.max(-1, Math.min(1, lecture.energie * 1.6)), h = lecture.heure;
  let haut = '#8fc3e6', bas = '#eaf0ec', teinte = [1, 1, 1, 0], ciel = [0, 0, 0];
  if (v > .15 && e <= .15) { haut = melange(haut, '#f0c49c', v * .8); bas = melange(bas, '#fde4c2', v); teinte = [1 + .06 * v, 1, 1 - .07 * v, 0]; } // apaisé : la lumière dorée
  if (v > .15 && e > .15) { haut = melange(haut, '#79bdf0', v); bas = melange(bas, '#fff6dc', v); teinte = [1.03, 1.02, .98, -.05]; } // vif et heureux : un matin clair
  if (v < -.15 && e > .15) { haut = melange(haut, '#5c6a80', -v); bas = melange(bas, '#c9b3c2', -v); teinte = [.92, .9, 1, .25 * -v]; ciel = [1, .12 * -v, .3]; } // l’orage
  if (v < -.15 && e <= .15) { haut = melange(haut, '#a9b3bd', -v); bas = melange(bas, '#dde1e4', -v); teinte = [.96, .97, 1.02, .4 * -v]; ciel = [.7, .06 * -v, .45]; } // le gris
  if (h === 'soir') { haut = melange(haut, '#e3a98c', .55); bas = melange(bas, '#fbd6a8', .6); teinte = teinte.map((x, i) => i === 3 ? x : x * [1.06, .99, .9][i]); }
  if (h === 'matin') { bas = melange(bas, '#fff3dd', .5); }
  if (h === 'nuit') { haut = '#1d2a4c'; bas = '#4b5b82'; teinte = [.62, .68, .92, .25]; ciel = [1, .22, .6]; }
  return { haut, bas, teinte, ciel };
}
const pareil = (a, b) => a === b;

/* ───────── Le plan d’un jour : où va chaque chose ───────── */

// jour : { i, date, lieu, objets: [{ objet }], climat } ; veille : le jour d’avant, déjà planifié ; recents : id → dernier jour vu
export function planifier(jour, veille, F, recents) {
  const r = rng(1 + Math.floor(hash(`${jour.date}:${jour.i}`) * 1e6)), x0 = jour.i * L, saison = saisonDe(jour.date), items = [], occupe = { avant: [], bord: [], chemin: [], milieu: [], fond: [] };
  const tirer = (liste, k = 1) => { // un objet de la famille, moins probable s’il a été vu récemment
    if (!liste?.length) return null;
    const p = liste.map(o => { const v = recents.get(o.id); return v == null ? 1 : 1 - .9 * Math.exp(-(jour.i - v) / (2 + k)); }), t = p.reduce((a, b) => a + b, 0);
    let u = r() * t; for (let n = 0; n < liste.length; n++) { u -= p[n]; if (u <= 0) { recents.set(liste[n].id, jour.i); return liste[n]; } }
    return liste[liste.length - 1];
  };
  const place = (plan, largeur, de = x0 + .6, a = x0 + L - .6) => { // une place libre le long du chemin, dans ce plan
    for (let essai = 0; essai < 14; essai++) {
      const x = de + r() * (a - de);
      if (!occupe[plan].some(([u, v]) => x + largeur / 2 > u && x - largeur / 2 < v)) { occupe[plan].push([x - largeur / 2, x + largeur / 2]); return x; }
    }
    return null;
  };
  const poser = (o, plan, { s = 1, x = null, z = null, profil = null, y = 0, h = null, de, a } = {}) => {
    if (!o) return null;
    const [hmin, hmax, wmax] = h || TAILLES[plan] || TAILLES.chemin, haut = Math.max(o.taille[1], .02), large = Math.max(o.taille[0], o.taille[2], .02);
    s = Math.min(Math.max(s, hmin / haut), hmax / haut, wmax / large); // ni trop petit, ni trop grand, pour son plan
    const [zA, zB] = PLANS[plan] || [-.4, .4], zz = z ?? zA + r() * (zB - zA), k = recul(zz) * s, larg = large * k;
    const xx = x ?? place(plan, larg * .9, de, a); if (xx == null) return null;
    const long = o.taille[2] > o.taille[0] * 1.3, ry = (profil ?? long ? Math.PI / 2 * (r() < .5 ? 1 : -1) : 0) + (r() - .5) * .5;
    const it = { id: o.id, x: xx, z: zz, y, ry, s: k, plan }; items.push(it); return it;
  };
  const lieu = jour.lieu, arbres = saison === 'automne' ? F.arbresAutomne : saison === 'hiver' ? [...F.sapinsNeige, ...F.pins] : F.arbres;
  let piece = null;

  // le décor du lieu
  const ARBRE = [4.5, 7.5, 6], CULTURE = [.9, 1.6, 2], MAISON = [5.5, 8.5, 14], BATEAU = [1, 5.5, 7], GENS = [1.6, 1.8, 1.5];
  if (lieu === 'foret') {
    for (let n = 0; n < 12; n++) poser(tirer(r() < .4 ? F.pins : arbres), 'milieu', { s: 1.1 + r() * .5, h: ARBRE });
    for (let n = 0; n < 16; n++) poser(tirer(r() < .5 ? F.pins : arbres), 'fond', { s: 1.4 + r() * .6, h: ARBRE });
    for (let n = 0; n < 4; n++) poser(tirer(r() < .5 ? F.buissons : F.rochers), 'bord');
    for (let n = 0; n < 3; n++) poser(tirer(r() < .5 ? F.champignons : F.souches), 'bord', { s: 1.2 });
    for (let n = 0; n < 10; n++) poser(tirer(r() < .6 ? F.herbes : F.fleurs), 'avant', { s: 1.3 });
    for (let n = 0; n < 2; n++) poser(tirer(F.buissons), 'avant', { z: 2.6, h: [.8, 1.5, 2.6] }); // de gros buissons devant : la profondeur
  } else if (lieu === 'champs') {
    for (let n = 0; n < 9; n++) poser(tirer(saison === 'hiver' ? F.souches : F.cultures), 'milieu', { z: -3.6 - n * .45, h: CULTURE });
    for (let n = 0; n < 9; n++) poser(tirer(saison === 'hiver' ? F.souches : F.cultures), 'milieu', { z: -4.5 - r() * 3, h: CULTURE });
    for (let n = 0; n < 2; n++) poser(tirer(arbres), 'milieu', { z: -8 - r() * 3, h: ARBRE });
    for (let n = 0; n < 7; n++) poser(tirer(arbres), 'fond', { h: ARBRE });
    for (let n = 0; n < 3; n++) poser(tirer(F.clotures), 'bord', { z: -1.3, profil: false });
    for (let n = 0; n < 11; n++) poser(tirer(saison === 'printemps' || saison === 'ete' ? (r() < .6 ? F.fleurs : F.herbes) : F.herbes), 'avant', { s: 1.3 });
  } else if (lieu === 'village') {
    for (let n = 0; n < 2; n++) poser(tirer(F.maisons, 3), 'milieu', { z: -4.6 - r() * 1.2, profil: false, h: MAISON });
    for (let n = 0; n < 6; n++) poser(tirer(F.immeubles, 3), 'fond', { z: -16 - r() * 8, profil: false, h: [8, 16, 14] });
    for (let n = 0; n < 2; n++) poser(tirer(r() < .5 ? arbres : F.petitsArbres), 'milieu', { z: -3.5, h: [3, 5.5, 5] });
    for (let n = 0; n < 2; n++) poser(tirer(F.lanternes), 'bord', { z: -1.2, h: [2.2, 2.8, 1] });
    for (let n = 0; n < 6; n++) poser(tirer(r() < .5 ? F.fleurs : F.herbes), 'avant', { s: 1.1 });
  } else if (lieu === 'rivage') {
    for (let n = 0; n < 2; n++) poser(tirer(F.bateaux, 3), 'milieu', { z: -7 - r() * 6, profil: true, h: BATEAU });
    for (let n = 0; n < 3; n++) poser(tirer(saison === 'ete' ? F.palmiers : F.rochers), 'bord', { h: saison === 'ete' ? [3.5, 5.5, 4] : [.5, 1.4, 3] });
    for (let n = 0; n < 3; n++) poser(tirer(F.rochersSable), 'avant', { s: 1.2 });
    for (let n = 0; n < 3; n++) poser(tirer(F.herbes), 'avant', { s: 1.2 });
  } else if (lieu === 'interieur') { // une maison ouverte, comme une maison de poupée : le chemin y entre par une porte et ressort par l’autre
    piece = { de: x0 + 2.4, a: x0 + L - 2.4, fond: -2.9, haut: 2.6, mur: melange('#efe3cf', '#dcc9ab', r()), sol: melange('#b98a5e', '#a8764c', r()), toit: melange('#a85b45', '#7d6a5f', r()) };
    poser(tirer(F.tapis), 'chemin', { z: -.2, profil: false, x: x0 + L / 2, h: [.01, .05, 3.2] });
    for (let n = 0; n < 5; n++) poser(tirer(F.meubles, 2), 'bord', { z: -2.3, profil: false, h: [1, 2.2, 2.4], de: piece.de + .5, a: piece.a - .5 });
    for (let n = 0; n < 6; n++) poser(tirer(arbres), 'fond', { h: ARBRE }); // derrière la maison, le pays continue
  }

  // ce que la page appelle : au bord du chemin, sur le chemin, devant, ou sur l’eau
  for (const { objet: o } of jour.objets) {
    const role = o.role;
    if (/^watercraft|^pirate-kit\/(boat|ship)/.test(o.id) && lieu === 'rivage') poser(o, 'milieu', { z: -5 - r() * 4, profil: true, h: BATEAU });
    else if (role === 'batiment') poser(o, 'milieu', { z: -5, profil: false, h: MAISON });
    else if (/^train-kit|^holiday-kit\/train/.test(o.id)) { const it = poser(o, 'bord', { z: -1.8, profil: true, s: 1 }); if (it) poser(F.rails[0], 'bord', { x: it.x, z: -1.8, profil: true, s: 1.2 }); }
    else if (role === 'personne') poser(o, 'chemin', { z: (r() - .5) * .5, h: /character/.test(o.id) ? GENS : [.3, 1.5, 1.5] });
    else if (role === 'animal') poser(o, 'chemin', { z: (r() - .5) * .5, h: [.45, 1.8, 2.4] });
    else if (role === 'petit') { // une petite chose : en grand, au premier plan, comme une nature morte ; dans une maison, sur une table
      const h = Math.max(o.taille[1], .05), s = Math.max(1, .6 / h);
      if (piece) { const t = poser(tirer(F.tables), 'chemin', { z: .6, profil: false }); if (t) poser(o, 'chemin', { x: t.x, z: .6, y: .62, s: Math.max(1, .25 / h) }); else poser(o, 'avant', { s }); }
      else poser(o, 'avant', { s, z: 1.5 + r() * .8 });
    } else if (role === 'decor') { for (let n = 0; n < 3; n++) poser(o, n ? 'milieu' : 'bord', { h: /tree|palm|pine/.test(o.id) ? ARBRE : null }); }
    else poser(o, piece ? 'bord' : r() < .6 ? 'bord' : 'avant', { z: piece ? -2 : undefined });
  }

  // à la jointure avec la veille : un objet de raccord, au premier plan, qui couvre le passage d’un lieu à l’autre
  let raccord = null;
  if (veille) {
    const avant = veille.lieu, apres = lieu, choix = pareil(avant, apres)
      ? { foret: F.pins, champs: F.clotures, village: F.lanternes, rivage: F.rochers, interieur: null }[apres]
      : apres === 'interieur' || avant === 'interieur' ? null : [...F.portails, ...F.haies];
    const o = choix && tirer(choix);
    if (o) { const h = /tree|pine/.test(o.id) ? 8 : /lantern/.test(o.id) ? 3 : /gate|hedge/.test(o.id) ? 2.2 : 1.3; raccord = { id: o.id, x: x0, z: 1.9, y: 0, ry: /gate/.test(o.id) ? 0 : (r() - .5) * .6, s: h / Math.max(o.taille[1], .05), plan: 'avant' }; items.push(raccord); }
  }
  return { i: jour.i, x0, date: jour.date, lieu, saison, climat: jour.climat, items, piece, sol: solDe(lieu, saison, r) };
}
function solDe(lieu, saison, r) { // la couleur du sol, et celle du chemin
  const herbe = { printemps: '#8fbf5e', ete: '#9cbf56', automne: '#bfa253', hiver: '#eef2f4' }[saison];
  const S = {
    foret: { sol: nuance(herbe, -.14), chemin: saison === 'hiver' ? '#f6f7f8' : '#d2b98c' },
    champs: { sol: herbe, chemin: saison === 'hiver' ? '#f6f7f8' : '#e3cfa3' },
    village: { sol: melange(herbe, '#b9b3a6', .45), chemin: '#d3cbbb' },
    rivage: { sol: '#e2cf9d', chemin: '#efe2bd' },
    interieur: { sol: herbe, chemin: '#d2b98c' },
  }[lieu] || { sol: herbe, chemin: '#d2b98c' };
  return { ...S, relief: { foret: 1.2, champs: .7, village: .5, rivage: 0, interieur: .7 }[lieu] ?? .7, eau: lieu === 'rivage' };
}

/* ───────── Le sol, l’eau, le ciel ───────── */

const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function bruit(x, z, s = 0) { const h = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 17.3) * 43758.5453; return v - Math.floor(v); }; const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return (h(i, j) * (1 - ux) + h(i + 1, j) * ux) * (1 - uz) + (h(i, j + 1) * (1 - ux) + h(i + 1, j + 1) * ux) * uz; }
// la part de chaque jour en x : 1 en son milieu, et un fondu de quelques mètres à ses bords
function parts(plans, x) {
  const out = [];
  for (const p of plans) { const c = p.x0 + L / 2, w = lisse(L / 2 + 2.5, L / 2 - 2.5, Math.abs(x - c)); if (w > 0) out.push([p, w]); }
  const t = out.reduce((a, [, w]) => a + w, 0) || 1; return out.map(([p, w]) => [p, w / t]);
}
const meandre = x => .35 * Math.sin(x / 9.3) + .2 * Math.sin(x / 4.1 + 1.3); // le chemin ondule un peu
function hauteur(plans, x, z) {
  let relief = 0, eau = 0; for (const [p, w] of parts(plans, x)) { relief += w * p.sol.relief; eau += w * (p.sol.eau ? 1 : 0); }
  if (eau > 0 && eau < 1) eau = lisse(0, 1, eau + (bruit(z / 3.5, x / 6, 11) - .5) * .7); // une côte qui serpente, pas une ligne droite
  const dz = z - meandre(x), loin = Math.max(0, -dz - 2);
  let h = (bruit(x * .35, z * .35, 3) - .5) * .12 + lisse(-1.2, -4, dz) * .1 * relief;
  h += relief * Math.pow(loin / 26, 1.4) * 1.2 * bruit(x / 14, z / 9, 7); // les collines, au loin, sous le ciel
  if (eau > 0) h = h * (1 - eau) + eau * (dz > -1.6 ? .04 - lisse(.4, -1.6, dz) * .1 : -.4); // le rivage : la plage, puis la mer
  for (const p of plans) if (p.piece && x > p.piece.de - 1 && x < p.piece.a + 1) { const w = lisse(p.piece.de - 1, p.piece.de, x) * lisse(p.piece.a + 1, p.piece.a, x) * lisse(p.piece.fond - 1.5, p.piece.fond - .2, z) * lisse(3.2, 2.4, z); return (1 - w) * (rampe(z) + h) + w * .02; } // sous la maison, le sol est plat
  return rampe(z) + h;
}
function couleurSol(plans, x, z, h) {
  const dz = z - meandre(x), c = new THREE.Color(), t = new THREE.Color();
  let sol = new THREE.Color(0, 0, 0), chemin = new THREE.Color(0, 0, 0);
  for (const [p, w] of parts(plans, x)) { sol.add(t.set(p.sol.sol).multiplyScalar(w)); chemin.add(t.set(p.sol.chemin).multiplyScalar(w)); }
  const ad = Math.abs(dz) + (bruit(x * .9, 2, 5) - .5) * .25, bande = lisse(1.15, .95, ad) * (.85 + .15 * bruit(x * 1.7, z * 1.7, 9)); // le chemin, large d’un peu plus de deux mètres, au bord irrégulier
  c.copy(sol).lerp(chemin, bande);
  c.multiplyScalar(1 - .3 * lisse(.75, 1.08, ad) * lisse(1.4, 1.12, ad)); // son bord, plus sombre : l’herbe foulée, l’ombre
  c.multiplyScalar(.92 + .16 * bruit(x * .6, z * .6, 4));
  if (h < -.05) c.lerp(t.set('#c9b98f'), .5); // sous l’eau, le sable
  return c;
}
function terrain(plans, de, a) {
  const xs = [], zs = []; for (let x = de; x <= a + 1e-6; x += .5) xs.push(x);
  for (let z = 6.4; z >= -32; z -= z > -4 ? .35 : z > -14 ? .8 : 1.6) zs.push(z); // devant, jusque sous le bas de l’image
  const pos = [], col = [], idx = [], nx = xs.length;
  zs.forEach(z => xs.forEach(x => { const h = hauteur(plans, x, z), c = couleurSol(plans, x, z, h); pos.push(x, h, z); col.push(c.r, c.g, c.b); }));
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) { const a0 = j * nx + i, b0 = a0 + 1, c0 = a0 + nx, d0 = c0 + 1; idx.push(a0, b0, c0, b0, d0, c0); } // tournés vers le ciel
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; m.userData.sol = true; m.userData.genere = true;
  return m;
}
function eau(plans, de, a) { // la mer, au bord de l’eau : elle monte avec le sol vers l’horizon ; ailleurs, elle plonge sous la terre
  const nx = Math.ceil((a - de) / 1), g = new THREE.PlaneGeometry(a - de, 36, nx, 60).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (de + a) / 2, z = p.getZ(i) - 14.4, w = parts(plans, x).reduce((t, [q, k]) => t + k * (q.sol.eau ? 1 : 0), 0);
    p.setZ(i, z); p.setY(i, rampe(z) - .05 - lisse(.06, .01, w) * 4); // dès qu’un peu de rivage est là, la mer est à niveau ; la terre fait la côte
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#5aa7c4' }));
  m.position.set((de + a) / 2, 0, 0); m.receiveShadow = true; m.userData.eau = true; m.userData.genere = true;
  return m;
}
function ciel(plans, de, a) { // un grand fond, loin derrière : le dégradé du ciel de chaque jour, fondu d’un jour à l’autre
  const ligne = Y => (Y - 60 * Math.sin(ELEV)) / Math.cos(ELEV), H = [BAS - 3, 4.4, 6.9, BAS + V + .6].map(ligne); // le dégradé, réglé sur l’image : clair à l’horizon, plein en haut
  const n = Math.ceil((a - de) / 1) + 1, pos = [], col = [], idx = [], c = new THREE.Color(), t = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = de + (a - de) * i / (n - 1); let haut = new THREE.Color(0, 0, 0), bas = new THREE.Color(0, 0, 0);
    for (const [p, w] of parts(plans, x)) { haut.add(t.set(p.climat.haut).multiplyScalar(w)); bas.add(t.set(p.climat.bas).multiplyScalar(w)); }
    H.forEach((y, j) => { c.copy(bas).lerp(haut, [0, 0, .5, 1][j]); pos.push(x, y, -60); col.push(c.r, c.g, c.b); });
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < 3; j++) { const a0 = i * 4 + j, b0 = a0 + 4; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })); m.userData.ciel = true; m.userData.genere = true;
  return m;
}
function maison(p) { // la maison ouverte d’un jour : un plancher, un mur du fond avec une fenêtre, deux murs percés d’une porte, un toit
  const g = new THREE.Group(), mur = new THREE.MeshLambertMaterial({ color: p.mur }), sol = new THREE.MeshLambertMaterial({ color: p.sol }), toit = new THREE.MeshLambertMaterial({ color: p.toit });
  const larg = p.a - p.de, cx = (p.de + p.a) / 2, prof = 3.4 - p.fond, z0 = p.fond, boite = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  boite(larg, .12, prof - 1, cx, -.04, z0 + (prof - 1) / 2, sol);
  boite(larg, p.haut, .16, cx, p.haut / 2, z0, mur);
  const vitre = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), new THREE.MeshBasicMaterial({ color: '#cfe6f2', toneMapped: false })); vitre.position.set(cx + larg * .18, 1.75, z0 + .09); g.add(vitre);
  for (const [dx, dy, w, h] of [[0, .58, 1.5, .08], [0, -.58, 1.5, .08], [.73, 0, .08, 1.2], [-.73, 0, .08, 1.2], [0, 0, .05, 1.1]]) boite(w, h, .05, cx + larg * .18 + dx, 1.75 + dy, z0 + .12, toit);
  for (const x of [p.de, p.a]) { // les murs des côtés, percés d’une porte pour le chemin
    boite(.16, p.haut, 1.6, x, p.haut / 2, z0 + .8, mur); boite(.16, .8, 2.6, x, p.haut - .4, 0, mur); boite(.16, p.haut, 1.2, x, p.haut / 2, 1.9, mur);
  }
  const pente = 1.1, demi = 2.4; // le toit, coupé comme le reste : seule sa pente du fond, vue de dessous
  const t = new THREE.Mesh(new THREE.BoxGeometry(larg + .6, .12, Math.hypot(demi, pente)), toit); t.position.set(cx, p.haut + pente / 2, z0 + demi / 2 - .2); t.rotation.x = Math.atan2(pente, demi); g.add(t); // sans ombre : la pièce reste claire
  g.traverse(o => { o.userData.sol = true; o.userData.genere = true; });
  return g;
}

/* ───────── Les modèles ───────── */

export class Modeles {
  constructor(base = './') { this.base = new URL(base, location.href); this.cache = new Map(); this.loader = new THREE.GLTFLoader(); this.loader.setMeshoptDecoder(THREE.MeshoptDecoder); }
  charger(o) {
    if (!this.cache.has(o.id)) this.cache.set(o.id, this.loader.loadAsync(new URL(o.fichier, this.base).href).then(g => {
      const s = g.scene; s.scale.setScalar(o.echelle || 1); s.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(s), c = b.getCenter(new THREE.Vector3());
      const r = new THREE.Group(); s.position.set(-c.x, -b.min.y, -c.z); r.add(s);
      r.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      return r;
    }).catch(e => { console.warn(o.id, e); return null; }));
    return this.cache.get(o.id);
  }
}

/* ───────── L’atelier : une tuile, en couleurs, puis sa silhouette ───────── */

export class Atelier {
  constructor(modeles, parId) {
    this.modeles = modeles; this.catalogue = parId; this.canvas = document.createElement('canvas');
    this.rendu = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.rendu.setPixelRatio(1); this.rendu.outputColorSpace = THREE.SRGBColorSpace; this.rendu.toneMapping = THREE.ACESFilmicToneMapping; this.rendu.toneMappingExposure = 1.05;
    this.rendu.shadowMap.enabled = true; this.rendu.shadowMap.type = THREE.PCFShadowMap;
  }
  // k : la tuile, c’est-à-dire le jour k ; plans : tous les jours planifiés ; rend { image, silhouette } avec une marge de chaque côté
  async tuile(plans, k) {
    const W = LARGE + 2 * MARGE, l = W * V / HAUT, xc = k * L + L / 2, de = xc - l / 2 - 1, a = xc + l / 2 + 1;
    const voisins = plans.filter(p => p && p.x0 < a + 2 && p.x0 + L > de - 2), s = new THREE.Scene(), F = this.catalogue;
    s.add(terrain(voisins, de - 1, a + 1), eau(voisins, de - 4, a + 4), ciel(voisins, de - 4, a + 4));
    for (const p of voisins) if (p.piece) s.add(maison(p.piece));
    const items = voisins.flatMap(p => p.items).filter(it => it.x > de - 6 && it.x < a + 6);
    const modeles = await Promise.all(items.map(it => this.modeles.charger(F.get(it.id))));
    items.forEach((it, n) => {
      const m = modeles[n]; if (!m) return;
      const o = m.clone(); o.position.set(it.x, (it.y || 0) + Math.max(hauteur(voisins, it.x, it.z), rampe(it.z) - .05), it.z); o.rotation.y = it.ry; o.scale.setScalar(it.s);
      if (/watercraft|pirate-kit\/(boat|ship)/.test(it.id)) o.position.y = rampe(it.z) - .12; // un bateau flotte
      s.add(o);
    });
    // la lumière : la même partout, pour que les tuiles se raccordent ; le temps du jour vient de la teinte posée par le pinceau
    const soleil = new THREE.DirectionalLight('#fff4e2', 2.4); soleil.position.set(xc - 14, 22, 18); soleil.target.position.set(xc, 0, -4);
    soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048); Object.assign(soleil.shadow.camera, { left: -l / 2 - 6, right: l / 2 + 6, top: 18, bottom: -18, near: 1, far: 90 }); soleil.shadow.bias = -.0005; soleil.shadow.normalBias = .02;
    s.add(soleil, soleil.target, new THREE.HemisphereLight('#e4f0ff', '#b9a98a', 1.25));
    s.fog = new THREE.Fog('#dfe6ea', 106, 165);
    const cam = new THREE.OrthographicCamera(-l / 2, l / 2, V / 2, -V / 2, 1, 400), dir = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV));
    const cible = new THREE.Vector3(xc, (V / 2 + BAS) / Math.cos(ELEV), 0); cam.position.copy(cible).addScaledVector(dir, -100); cam.lookAt(cible); cam.updateMatrixWorld();
    const r = this.rendu; r.setSize(W, HAUT, false); r.render(s, cam);
    const image = copie(this.canvas, W, HAUT);
    // la silhouette, en petit : la terre et ce qui s’y pose en rouge, l’eau en vert, le ciel en noir
    const rouge = new THREE.MeshBasicMaterial({ color: '#ff0000', fog: false, toneMapped: false }), vert = new THREE.MeshBasicMaterial({ color: '#00ff00', fog: false, toneMapped: false });
    s.fog = null; s.background = new THREE.Color('#000000'); r.shadowMap.enabled = false;
    s.traverse(o => { if (!o.isMesh) return; o.userData.avant = o.material; o.material = o.userData.eau ? vert : rouge; if (o.userData.ciel) o.visible = false; });
    const w = Math.round(W / 8), h = Math.round(HAUT / 8); r.setSize(w, h, false); r.render(s, cam);
    const silhouette = copie(this.canvas, w, h); r.shadowMap.enabled = true;
    s.traverse(o => { if (o.isMesh && o.userData.genere) { o.geometry.dispose(); o.userData.avant?.dispose?.(); } }); // les modèles restent, pour les tuiles suivantes
    rouge.dispose(); vert.dispose(); soleil.shadow.dispose();
    return { image, silhouette };
  }
}
const copie = (c, w, h) => { const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, 0, 0, w, h); return o; };
