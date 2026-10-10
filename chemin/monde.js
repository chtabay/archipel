// Le chemin : le monde de la frise. Un long ruban le long d’un chemin ; chaque jour en est une tranche de L mètres, vue de
// côté, avec tous ses plans à la fois : le premier plan, le chemin, le plan moyen, le lointain et le ciel. Chaque jour a son
// lieu, ses objets, ceux que la page appelle, et à chaque jointure un objet de raccord. Tout se déduit des pages et d’une
// graine : la même page donne la même tranche. La caméra est orthogonale : deux tuiles voisines se raccordent sans couture.

import * as THREE from './vendor/three-chemin.min.js?v=1';
import { rng, hash, melange, nuance } from '../outils.js?v=1';

export const MOTEUR = 5; // la version du peintre, ici et dans l’aquarelle : on l’augmente quand une même page se peindrait autrement
export const L = 14, V = 11, ELEV = 8 * Math.PI / 180, HAUT = 1000, LARGE = Math.round(HAUT * L / V), MARGE = 40; // un jour : 14 m de long, une tuile de 1273 × 1000 points, et une marge pour le pinceau
const BAS = -2.2, CIBLE = (V / 2 + BAS) / Math.cos(ELEV); // le bas de l’image, en mètres, sous le chemin ; la hauteur que vise la caméra
const PLANS = { avant: [1.4, 3], bord: [-2.2, -1.1], milieu: [-3.4, -11], fond: [-15, -26] };
const recul = z => (z >= -1 ? 1 : 1 / (1 + (-z - 1) / 16)); // la fausse perspective : plus loin, plus petit
// Le sol monte vers le fond, comme une scène de théâtre, ou un rouleau peint : vues presque de côté, les choses restent
// debout, et le sol se voit, du premier plan jusqu’à l’horizon
const RAMPE = 1.7, rampe = z => (z < 0 ? RAMPE * (1 - Math.exp(z / 10)) : -.32 * z);
// les tailles, par plan : la plus petite et la plus grande hauteur, la plus grande largeur
const TAILLES = { avant: [.25, 1, 2.4], bord: [.3, 3, 5], chemin: [.2, 1.9, 3], milieu: [.5, 8, 12], fond: [1, 14, 16], ciel: [.4, 2, 5], eau: [.2, 2, 12] };

/* ───────── Le catalogue, par familles ───────── */

const FAMILLES = {
  arbres: /^nature-kit\/tree_(default|oak|detailed|fat|simple|tall|thin|cone|plateau)(_dark)?$|^q-nature\/(CommonTree_[123]|BirchTree_[12]|Willow_[12])$|^kaykit-forest\/Tree_[1-4]_A|^fantasy-town-kit\/tree(-high|-high-round|-crooked|-high-crooked)?$|^survival-kit\/tree(-tall)?$/,
  arbresAutomne: /^nature-kit\/tree_\w+_fall$|^q-nature\/\w+_Autumn_\d$|^survival-kit\/tree-autumn(-tall)?$|^kaykit-medieval\/tree_pine_(orange|yellow)_(medium|large)$/,
  pins: /^nature-kit\/tree_pine(Default|Round|Tall)|^q-nature\/PineTree_[12]$/, sapinsNeige: /^holiday-kit\/tree-snow|^q-nature\/(PineTree|CommonTree|BirchTree|Willow)_Snow_\d$|^platformer-kit\/tree-(pine-)?snow$/,
  arbresNus: /^kaykit-forest\/Tree_Bare|^kaykit-medieval\/tree_dead_(small|medium|large)$|^archipel\/arbre-nu$/, petitsArbres: /^nature-kit\/tree_(small|pineSmall)/,
  buissons: /^nature-kit\/plant_bush|^kaykit-forest\/Bush_[1-4]|^q-nature\/(Bush_1|BushBerries_1)$|^kaykit-city-builder-bits\/bush$/,
  rochers: /^nature-kit\/rock_(large|tall)|^kaykit-forest\/Rock_[1-3]|^q-nature\/Rock_Moss_1$|^survival-kit\/rock-[abc]$|^fantasy-town-kit\/rock-(large|wide)$|^kaykit-medieval\/rock_single_A$/,
  cailloux: /^nature-kit\/(rock|stone)_small|^fantasy-town-kit\/rock-small$|^survival-kit\/rock-flat(-grass)?$/,
  champignons: /^nature-kit\/mushroom|^q-crops\/Mushroom_4$/, souches: /^nature-kit\/(stump|log)|^survival-kit\/tree-(log|trunk|log-small|autumn-trunk)$|^q-nature\/(TreeStump_Moss|WoodLog_Moss)$/,
  herbes: /^nature-kit\/grass|^kaykit-forest\/Grass_[12]/, fleurs: /^nature-kit\/flower_|^q-nature\/(Flowers|Plant_1|Plant_3)$|^archipel\/fleurs$/, herbesPlage: /^tropiques\/BeachGrass01$|^nature-kit\/grass_leafs/,
  cultures: /^nature-kit\/crops_(wheat|corn)Stage[BCD]|^q-crops\/(Wheat|Corn|Rice)_4$/, legumes: /^nature-kit\/crop_|^q-crops\/(Tomato|Lettuce|Pumpkin|Carrot|Beet|Watermelon)_4$/, fruitiers: /^q-crops\/(Apple|Orange)_4$|^archipel\/arbre-fleuri$/,
  clotures: /^nature-kit\/fence_(simple|planks|simpleHigh|simpleLow|planksDouble)$|^fantasy-town-kit\/fence(-curved|-broken)?$|^survival-kit\/fence$|^quaternius-farm\/Fence2?$|^city-kit-suburban\/fence-low$/,
  haies: /^fantasy-town-kit\/hedge(-large)?$/, portails: /^fantasy-town-kit\/(hedge-gate|hedge-large-gate|fence-gate)$/,
  maisons: /^city-kit-suburban\/building-type|^kaykit-medieval\/building_(home_[AB]|tavern|market|grain)|^q-buildings\/(House\d?|Shop)$|^textured-buildings\/[12]Story_|^archipel\/maison-(automne|lande|prairie|volets)$/,
  immeubles: /^city-kit-commercial\/building-[a-n]$|^textured-buildings\/(3Story_Slim|4Story|4Story_Center)$|^kaykit-city-builder-bits\/building_[A-H]_withoutBase$/,
  fermes: /^quaternius-farm\/(Barn|BigBarn|SmallBarn|OpenBarn|Silo|Silo_House|Windmill|TowerWindmill|WaterTower)$|^fantasy-town-kit\/(windmill|watermill)$|^kaykit-medieval\/building_(windmill|watermill)_blue$/,
  ateliers: /^kaykit-medieval\/building_(blacksmith|lumbermill)_blue$/, betail: /^poses\/(bete-(cow|sheep|horse|pig|chick)|mange-cube-(cow|pig)|galop-horse)$|^archipel\/bete-(mouton|poule)$/,
  betesBois: /^poses\/(bete-red-fox|mange-cube-bunny)$|^archipel\/bete-(chevreuil|lievre|renard)$/,
  fontaines: /^fantasy-town-kit\/fountain|^kaykit-medieval\/building_well_blue$|^quaternius-farm\/Well$|^archipel\/puits$/, bancs: /^kaykit-city-builder-bits\/bench$|^retro-urban-kit\/detail-bench$|^archipel\/banc$|^fantasy-town-kit\/stall-bench$/,
  etals: /^fantasy-town-kit\/stall(-green|-red)?$/, caisses: /^survival-kit\/(barrel|barrel-open|box|box-large|box-open|box-large-open)$|^kaykit-medieval\/(barrel|crate_A_big|sack)$|^platformer-kit\/(barrel|crate)$|^kaykit-city-builder-bits\/box_A$/,
  charrettes: /^fantasy-town-kit\/cart(-high)?$|^kaykit-medieval\/wheelbarrow$/, panneaux: /^survival-kit\/signpost(-single)?$|^platformer-kit\/sign$|^nature-kit\/sign$/, lanternes: /^fantasy-town-kit\/lantern$|^kaykit-city-builder-bits\/streetlight$/,
  palmiers: /^nature-kit\/tree_palm(Short|Tall|Bend)?$/, bateaux: /^watercraft-kit\/boat-(sail|row|fishing)/, rochersSable: /^pirate-kit\/rocks-sand/,
  meubles: /^furniture-kit\/(bookcaseOpen|bookcaseClosed|lampRoundFloor|lampSquareFloor|pottedPlant|plantSmall\d|loungeChair|sideTable|cabinetTelevision|coatRackStanding)$|^q-furniture\/(BookCaseBooks|BookCaseLargeBooks|Closet|Lamp|Plant|Sofa|SofaLong|Vase2?)$|^kaykit-furniture-bits\/(armchair(_pillows)?|cabinet_(medium|small)(_decorated)?|couch(_pillows)?|lamp_standing|shelf_[AB]_(big|small|large)(_decorated)?|pictureframe_standing_A)$|^q-interior\/(Bookshelf|Couch_\w+|Drawer_[13]|Fireplace|Houseplant_\d|Light_Floor1|Shelf_Large)$/,
  tapis: /^furniture-kit\/rug(Rectangle|Round|Rounded|Square)$|^kaykit-furniture-bits\/rug_/, tables: /^furniture-kit\/(table|tableRound|tableCloth)$|^q-furniture\/Table$|^kaykit-furniture-bits\/table_(medium|small)$/, chaises: /^furniture-kit\/(chair|chairCushion|chairRounded)$|^q-furniture\/Chair(Cushioned)?$|^kaykit-furniture-bits\/chair_[AC]$/,
  // le désert, la savane, les tropiques, la montagne
  cactus: /^(q-desert\/Cactus\d?$|q-nature\/Cactus_1$|nature-kit\/cactus_)/, palmiersOasis: /^q-desert\/(Big|Small)PalmTree$/, arbresMorts: /^q-desert\/DeadTree$|^savane\/af_deadTree/,
  rochersRouges: /^savane\/africaRock_0[56]$/, pyramides: /^q-desert\/Pyramid$/, maisonsTerre: /^mali\/mali_(house_[1-4]|storehouse|farmstead)$/,
  acacias: /^savane\/(acacciaTree|umbrellaAcacia|umbreallAcacia)/, baobabs: /^savane\/AfricanBoabab/, arbresSavane: /^savane\/(AfricaTree|africanMahogany_0[12]|genericTree)/,
  buissonsSavane: /^savane\/(africaBush|yellowBush|africanThorn)/, herbesSavane: /^savane\/(africaGrass_0[12]|AfricanWheatGrass)/, cases: /^savane\/Shack/,
  palmiersTropiques: /^tropiques\/(Palm0\d|QueensPalm01)$/, bananiers: /^tropiques\/Banana/, bambous: /^tropiques\/Bamboo/,
  fougeres: /^tropiques\/(TropicFern|ElephantEar|Phila|BirdNestPlant)/, arbresJungle: /^tropiques\/(CecropiaTree|CiabaTree|CopalTree)/, paillotes: /^tropiques\/JungleHut/,
  montagnes: /^kaykit-medieval\/(mountain_|hills_A_trees)/, pinsNeige: /^(q-nature\/PineTree_Snow|platformer-kit\/tree-pine-snow)/,
  rochersMontagne: /^(q-nature\/Rock_(Moss|Snow)_1|nature-kit\/rock_(large|tall)\w*)$/, chalets: /^archipel\/maison-neige$/,
  // les repères du second plan : ce qui se voit de loin, une fois de temps en temps
  moulins: /^quaternius-farm\/(Windmill|TowerWindmill)$|^kaykit-medieval\/building_windmill_blue$|^fantasy-town-kit\/windmill$|^city-kit-industrial\/windmill-low$/,
  clochers: /^kaykit-medieval\/building_church_blue$/, tours: /^kaykit-medieval\/building_tower_A_blue$|^mali\/mali_(defense|sentry)_tower$/,
  chateauxEau: /^quaternius-farm\/(WaterTower|Silo)$|^kaykit-city-builder-bits\/watertower$|^city-kit-industrial\/water-tower$/, cheminees: /^city-kit-industrial\/chimney-large$/,
  chateaux: /^kaykit-medieval\/building_castle_blue$|^mali\/mali_fortress$/, ruines: /^kaykit-medieval\/building_destroyed$|^nature-kit\/statue_(column|columnDamaged|ring)$/,
  menhirs: /^archipel\/(menhir|cairn)$|^nature-kit\/statue_obelisk$|^q-desert\/Monument$/, tentes: /^nature-kit\/tent_|^survival-kit\/tent(-canvas)?$|^maya\/merchant-tent$/,
  phares: /^archipel\/phare$/, navires: /^watercraft-kit\/ship-(cargo-[abc]|large|ocean-liner-small|small)$|^q-ships\/(Sail_ship|Viking_boat|BoatWSail)$|^pirate-kit\/ship-(small|medium)$/,
  pontons: /^tropiques\/Tropical_Jetty0[12]$|^savane\/AfricaDock01$/, mosquees: /^mali\/mali_(temple|library|market|civic_center)$/, temples: /^maya\/mayan$/,
  grandsBatiments: /^q-buildings\/(Bank|Hospital)$|^textured-buildings\/4Story(_Center)?$/, granges: /^quaternius-farm\/(Barn|BigBarn|OpenBarn|SmallBarn)$/,
  troupeaux: /^poses\/bete-(cow|sheep|horse)$|^archipel\/bete-mouton$/, troupeauxSavane: /^poses\/bete-zebra$|^cube-pets\/animal-(giraffe|elephant)$/, caravanes: /^objets-oga\/chameau$/,
  gens: /^poses\/(marche|course)-(femme|homme|kenney)$/, locomotives: /^train-kit\/train-(locomotive-[abc]|diesel-[abc]|electric-city-[abc])$/, wagons: /^train-kit\/train-carriage-(box|wood|container-\w+|flatbed-wood|tank)$/,
  tracteurs: /^car-kit\/tractor(-shovel)?$/,
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
  // le temps qu’il fait, dit par les mots : la pluie, l’orage, la neige, la brume, le soleil
  const M = lecture.meteo || {}, pluie = Math.max(M.pluie || 0, M.orage || 0), orage = M.orage || 0, neige = M.neige || 0, brume = M.brume || 0, soleil = h === 'nuit' ? 0 : M.soleil || 0;
  if (pluie) { haut = melange(haut, orage ? '#4f5a72' : '#8995a5', pluie); bas = melange(bas, '#cdd3d8', pluie); teinte = [teinte[0] * (1 - .05 * pluie), teinte[1] * (1 - .03 * pluie), teinte[2], Math.max(teinte[3], .3 * pluie + .15 * orage)]; ciel = [Math.max(ciel[0], .85 * pluie), Math.max(ciel[1], .06 * pluie + .08 * orage), Math.max(ciel[2], .4 * pluie)]; }
  if (neige) { haut = melange(haut, '#c4cfd9', .7 * neige); bas = melange(bas, '#f2f4f5', neige); teinte = [teinte[0] * (1 - .03 * neige), teinte[1], teinte[2] * (1 + .03 * neige), Math.max(teinte[3], .15 * neige)]; }
  if (brume) { haut = melange(haut, '#d6dce1', .8 * brume); bas = melange(bas, '#eef0f1', brume); ciel = [ciel[0], ciel[1], Math.max(ciel[2], .5 * brume)]; }
  if (soleil) { haut = melange(haut, '#6db3ea', .5 * soleil); bas = melange(bas, '#fff1d0', .6 * soleil); teinte = [teinte[0] * (1 + .04 * soleil), teinte[1] * (1 + .01 * soleil), teinte[2] * (1 - .05 * soleil), teinte[3] * (1 - .5 * soleil)]; }
  if (h === 'nuit') { haut = '#1d2a4c'; bas = '#4b5b82'; teinte = [.62, .68, .92, .25]; ciel = [1, .22, .6]; }
  const r2 = x => Math.round(x * 100) / 100; // la météo, pour le pinceau : la pluie, la neige, la brume, la nuit ; puis le soleil, l’orage
  return { haut, bas, teinte, ciel, meteo: [pluie, neige, brume, h === 'nuit' ? 1 : 0].map(r2), astres: [soleil, orage, 0, 0].map(r2) };
}
const pareil = (a, b) => a === b;

/* ───────── Le plan d’un jour : où va chaque chose ───────── */

// jour : { i, date, lieu, objets: [{ objet }], climat } ; veille : le jour d’avant, déjà planifié ; recents : id → dernier jour vu
export function planifier(jour, veille, F, recents) {
  const r = rng(1 + Math.floor(hash(`${jour.date}:${jour.i}`) * 1e6)), x0 = jour.i * L, saison = (jour.climat?.meteo?.[1] || 0) >= .5 ? 'hiver' : saisonDe(jour.date), items = [], occupe = { avant: [], bord: [], chemin: [], milieu: [], fond: [], ciel: [], eau: [] };
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
    const [zA, zB] = plan === 'bord' && lieu === 'rivage' ? [-1.5, -1.1] : PLANS[plan] || [-.4, .4], zz = z ?? zA + r() * (zB - zA), k = recul(zz) * s * (plan === 'fond' ? .8 : 1), larg = large * k; // au bord de l’eau, le bord du chemin est la plage ; le fond, un peu plus petit, laisse voir le lointain
    const xx = x ?? place(plan, larg * .9, de, a); if (xx == null) return null;
    const long = o.taille[2] > o.taille[0] * 1.3, ry = o.tourne ? o.tourne * Math.PI / 180 + (r() - .5) * .3 : (profil ?? long ? Math.PI / 2 * (r() < .5 ? 1 : -1) : 0) + (r() - .5) * .5; // tourne : un demi-tour, une personne de dos
    const it = { id: o.id, x: xx, z: zz, y, ry, s: k, plan }; items.push(it); return it;
  };
  const taille = (o, [hmin, hmax, wmax]) => { const haut = Math.max(o.taille[1], .02), large = Math.max(o.taille[0], o.taille[2], .02); return [Math.min(Math.max(1, hmin / haut), hmax / haut, wmax / large), haut, large]; };
  const poserCiel = (o, h = TAILLES.ciel) => { // dans le ciel, au-dessus de l’horizon, sans toucher le haut de l’image
    const [s0, haut, large] = taille(o, h), z = -8 - r() * 8, s = s0 * Math.sqrt(recul(z)), v = 3.3 + r() * 1.3; // v : la hauteur dans l’image, depuis son milieu ; au loin, un peu plus petit
    const x = place('ciel', large * s); if (x == null) return null;
    const y = CIBLE + (v + z * Math.sin(ELEV)) / Math.cos(ELEV) - haut * s / 2;
    const it = { id: o.id, x, z, y, ry: (r() < .5 ? 1 : -1) * Math.PI / 2 + (r() - .5) * .5, s, plan: 'ciel', vol: true }; items.push(it); return it;
  };
  const poserEau = o => { // dans l’eau, au bord de l’eau seulement : le dos d’une baleine, un nageur, un poisson qui saute
    if (lieu !== 'rivage') return null;
    const [s0, haut, large] = taille(o, TAILLES.eau), z = -4.5 - r() * 4.5, s = s0 * recul(z);
    const x = place('eau', large * s); if (x == null) return null;
    const saute = /nage-(fish|piranha)/.test(o.id), enfonce = saute ? -.6 : /nage-(homme|femme)/.test(o.id) ? .25 : .5;
    const it = { id: o.id, x, z, y: -enfonce * haut * s, ry: (r() < .5 ? 1 : -1) * Math.PI / 2 + (r() - .5) * .4, s, plan: 'eau', eau: true }; items.push(it); return it;
  };
  const lieu = jour.lieu, arbres = saison === 'automne' ? F.arbresAutomne : saison === 'hiver' ? [...F.sapinsNeige, ...F.pins, ...F.arbresNus] : F.arbres;
  let piece = null;

  const ARBRE = [4.5, 7.5, 6], CULTURE = [.9, 1.6, 2], MAISON = [5.5, 8.5, 14], BATEAU = [1, 5.5, 7], GENS = [1.6, 1.8, 1.5];
  if (lieu === 'interieur') piece = { de: x0 + 2.4, a: x0 + L - 2.4, fond: -2.9, haut: 2.6, mur: melange('#efe3cf', '#dcc9ab', r()), sol: melange('#b98a5e', '#a8764c', r()), toit: melange('#a85b45', '#7d6a5f', r()) };

  // ce que la page appelle, d’abord : il a sa place avant le décor ; au bord du chemin, sur le chemin, devant, dans le ciel ou sur l’eau
  for (const { objet: o } of jour.objets) {
    const role = o.role;
    if (F.montagnes.includes(o)) continue; // une montagne nommée : ce sont les sommets du lointain, pas un rocher au bord du chemin
    if (/^watercraft|^pirate-kit\/(boat|ship)|^q-ships\/|^q-survival\/Raft/.test(o.id)) { if (lieu === 'rivage') poser(o, 'milieu', { z: -5 - r() * 4, profil: true, h: BATEAU }); } // loin de l’eau, pas de bateau
    else if (role === 'batiment') poser(o, 'milieu', { z: -5, profil: false, h: MAISON });
    else if (/^train-kit|^holiday-kit\/train/.test(o.id)) { poser(o, 'bord', { z: lieu === 'rivage' ? -1.3 : -1.8, profil: true, s: 1 }); } // au bord de l’eau, sur la plage
    else if (role === 'personne') poser(o, 'chemin', { z: (r() - .5) * .5, h: /character/.test(o.id) ? GENS : [.3, 1.5, 1.5] });
    else if (role === 'ciel') poserCiel(o, /^kaykit-medieval\/cloud|^archipel\/nuage/.test(o.id) ? [1.5, 3, 7] : /avion-ligne/.test(o.id) ? [1.5, 3, 9] : TAILLES.ciel);
    else if (role === 'eau') poserEau(o);
    else if (role === 'picto') poser(o, 'bord', { profil: false, h: [1.45, 1.8, 1.8] }); // un panneau peint, planté au bord du chemin, face à nous
    else if (role === 'animal' && o.taille[1] > 2.6) poser(o, 'milieu', { z: -4 - r() * 3, h: [2.6, 6, 12] }); // un éléphant, un dinosaure : un peu en retrait
    else if (role === 'animal') poser(o, 'chemin', { z: (r() - .5) * .5, h: [.45, 1.8, 2.4] });
    else if (role === 'petit') { // une petite chose : en grand, au premier plan, comme une nature morte ; dans une maison, sur une table
      const h = Math.max(o.taille[1], .05), s = Math.max(1, .6 / h);
      if (piece) { const t = poser(tirer(F.tables), 'chemin', { z: .6, profil: false }); if (t) poser(o, 'chemin', { x: t.x, z: .6, y: .62, s: Math.max(1, .25 / h) }); else poser(o, 'avant', { s }); }
      else poser(o, 'avant', { s, z: 1.5 + r() * .8 });
    } else if (role === 'decor') { for (let n = 0; n < 3; n++) poser(o, n ? 'milieu' : 'bord', { h: /tree|palm|pine/.test(o.id) ? ARBRE : null }); }
    else poser(o, piece ? 'bord' : r() < .6 ? 'bord' : 'avant', { z: piece ? -2 : undefined });
  }

  // le décor du lieu, autour : des motifs tirés au sort, et des nombres qui changent, pour que deux jours ne se ressemblent pas
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1)), quelques = (liste, k) => { const l = [...liste], out = []; while (out.length < k && l.length) out.push(l.splice(Math.floor(r() * l.length), 1)[0]); return out; };
  const bordure = () => { // le bord du chemin : une clôture, une haie, des pierres, ou rien
    const u = r();
    if (u < .4) { const o = tirer(F.clotures, 2); for (let i = 0, k = entre(1, 3); i < k; i++) poser(o, 'bord', { z: -1.3, profil: false }); }
    else if (u < .6) { for (let i = 0, k = entre(1, 2); i < k; i++) poser(tirer(F.haies, 2), 'bord', { z: -1.3, profil: false, h: [.6, 1.2, 4] }); }
    else if (u < .75) { for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(F.rochers, 2), 'bord', { h: [.3, .9, 2] }); }
  };
  const devant = (k = entre(3, 8)) => { for (let i = 0; i < k; i++) { const u = r(); poser(tirer(u < .45 ? F.herbes : u < .75 ? F.fleurs : u < .9 ? F.cailloux : F.champignons), 'avant', { s: 1.2 }); } };
  // un repère, une fois sur deux : ce qui se voit de loin et dit un pays. Au fond, debout et de face, un moulin, un clocher, une tour,
  // un château, un navire au large ; au milieu, groupés, un troupeau, un campement, des pierres levées. Chaque lieu a les siens, et
  // un repère vu récemment devient moins probable. Le repère prend sa place avant le décor, qui pousse autour
  const REPERES = {
    foret: [['tours', 1, [7, 11, 8]], ['ruines', 1, [4, 7, 8]], ['clochers', 1, [9, 12, 10]], ['tentes', 2, [1.8, 2.6, 3.2], 'milieu'], ['menhirs', 3, [2, 3.5, 3], 'milieu']],
    champs: [['moulins', 1, [8, 12, 12]], ['clochers', 1, [9, 12, 10]], ['chateauxEau', 1, [7, 11, 8]], ['granges', 1, [5, 8, 12]], ['chateaux', 1, [9, 14, 16]], ['tours', 1, [7, 11, 8]], ['troupeaux', 4, [1, 1.5, 2.6], 'milieu'], ['menhirs', 2, [2.5, 3.5, 3], 'milieu']],
    village: [['clochers', 1, [9, 12, 10]], ['chateaux', 1, [9, 14, 16]], ['chateauxEau', 1, [7, 11, 8]], ['moulins', 1, [8, 12, 12]], ['grandsBatiments', 1, [9, 13, 18]], ['cheminees', 1, [10, 14, 10]], ['tours', 1, [7, 11, 8]]],
    rivage: [['navires', 1, [3, 6, 11]], ['navires', 2, [2.5, 4.5, 9]], ['phares', 1, [8, 11, 6]], ['pontons', 1, [1.6, 2.4, 6], 'milieu']],
    interieur: [['moulins', 1, [8, 12, 12]], ['clochers', 1, [9, 12, 10]], ['chateauxEau', 1, [7, 11, 8]]],
    desert: [['mosquees', 1, [8, 12, 18]], ['tours', 1, [7, 11, 8]], ['menhirs', 1, [3, 5, 3]], ['tentes', 2, [2, 2.8, 3.5], 'milieu'], ['caravanes', 3, [1.8, 2.4, 3], 'milieu']],
    savane: [['tours', 1, [7, 11, 8]], ['troupeauxSavane', 3, [1.4, 2.8, 3.6], 'milieu'], ['tentes', 1, [2, 2.8, 3.5], 'milieu']],
    tropiques: [['temples', 1, [7, 11, 18]], ['tentes', 1, [1.8, 2.6, 3.2], 'milieu']],
    montagne: [['chateaux', 1, [9, 14, 16]], ['clochers', 1, [8, 12, 10]], ['tours', 1, [7, 11, 8]], ['troupeaux', 4, [1, 1.5, 2.6], 'milieu'], ['menhirs', 2, [2, 3.5, 3], 'milieu'], ['tentes', 1, [1.8, 2.6, 3.2], 'milieu']],
  }[lieu] || [];
  if (REPERES.length && r() < .55) {
    const [fam, n, h, plan = 'fond'] = REPERES[Math.floor(r() * REPERES.length)], liste = F[fam];
    if (fam === 'navires') { const o = tirer(liste, 6); for (let i = 0; i < n; i++) poser(o, 'fond', { z: -16 - r() * 8, profil: true, h }); } // au large, un navire, ou deux qui se suivent
    else if (plan === 'fond') { // un seul, debout, de face : il se reconnaît de loin
      const it = poser(tirer(liste, 6), 'fond', { z: -17 - r() * 7, profil: false, h });
      if (it && fam === 'phares') for (const dx of [1.8, -1.5]) poser(tirer(F.rochersSable), 'fond', { x: it.x + dx, z: it.z + .4, h: [1.5, 3, 4] }); // le phare, sur son îlot
    } else { // groupés, un peu en retrait du chemin
      const o = tirer(liste, 4), xc = x0 + 2.5 + r() * (L - 5), z = -5.5 - r() * 3;
      for (let i = 0; i < n; i++) poser(r() < .7 ? o : tirer(liste, 4), 'milieu', { x: xc + (r() - .5) * 5, z: z - r() * 1.5, h });
    }
  }
  if (lieu !== 'interieur' && r() < .4) { // un peu de vie, plus loin que le chemin : des promeneurs ; dans les champs, un tracteur, ou un train qui passe
    const u = lieu === 'champs' ? r() : 1, zv = -4.2 - r() * 3;
    if (u < .3) { // un train qui passe, droit, au fond du pré : chaque wagon à la suite de la locomotive
      const z = -7.5, l = tirer(F.locomotives, 6), w = tirer(F.wagons, 4), it = l && w && poser(l, 'milieu', { z, profil: true, s: 1, h: [2.4, 3.2, 5] });
      if (it) { const sens = it.ry > 0 ? 1 : -1, pas = Math.max(w.taille[2], l.taille[2]) * it.s * 1.02; it.ry = sens * Math.PI / 2;
        for (let i = 1, k = entre(1, 3); i <= k; i++) { const q = poser(w, 'milieu', { x: it.x - sens * pas * i, z, profil: true, s: 1, h: [0, 1e3, 1e3] }); if (q) { q.s = it.s; q.ry = it.ry; } } }
    } else if (u < .5) poser(tirer(F.tracteurs, 4), 'milieu', { z: zv, profil: true, h: [1.6, 2.2, 3.5] });
    else { const o = tirer(F.gens, 2); for (let i = 0, k = entre(1, 2); i < k; i++) { const q = r() < .6 ? o : tirer(F.gens, 2); if (lieu === 'rivage') poser(q, 'bord', { h: GENS }); else poser(q, 'milieu', { z: zv - r() * 1.5, h: [1.5, 1.8, 1.6] }); } } // au bord de l’eau, sur la plage
  }
  if (lieu === 'foret') {
    const m = quelques(['futaie', 'clairiere', 'sousbois', 'rochers'], 1)[0], dense = m === 'futaie' ? entre(10, 14) : m === 'clairiere' ? entre(4, 7) : entre(7, 10);
    for (let i = 0; i < dense; i++) poser(tirer(r() < .4 ? F.pins : arbres), 'milieu', { s: 1.1 + r() * .5, h: ARBRE });
    for (let i = 0, k = entre(10, 16); i < k; i++) poser(tirer(r() < .5 ? F.pins : arbres), 'fond', { s: 1.4 + r() * .6, h: ARBRE });
    if (m === 'clairiere') { for (let i = 0, k = entre(4, 8); i < k; i++) poser(tirer(r() < .6 ? F.fleurs : F.herbes), 'milieu', { z: -3.6 - r() * 2.5, h: [.3, .7, 1.2] }); if (r() < .6) poser(tirer(F.betesBois, 3), 'milieu', { z: -4 - r() * 2, h: [.5, 1.4, 2] }); }
    if (m === 'sousbois') { for (let i = 0, k = entre(3, 6); i < k; i++) poser(tirer(r() < .5 ? F.champignons : F.souches), 'bord', { s: 1.2 }); for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(F.fougeres), 'bord', { h: [.6, 1.2, 2] }); }
    if (m === 'rochers') { for (let i = 0, k = entre(3, 5); i < k; i++) poser(tirer(F.rochers, 2), 'bord', { h: [.5, 1.6, 3] }); for (let i = 0; i < 2; i++) poser(tirer(F.rochers), 'milieu', { z: -4 - r() * 3, h: [1, 2.5, 4] }); }
    for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(r() < .5 ? F.buissons : F.rochers), 'bord');
    devant(entre(5, 10));
    for (let i = 0, k = entre(1, 2); i < k; i++) poser(tirer(F.buissons), 'avant', { z: 2.6, h: [.8, 1.5, 2.6] }); // de gros buissons devant : la profondeur
  } else if (lieu === 'champs') {
    for (const m of quelques(['cultures', 'prairie', 'verger', 'potager', 'ferme', 'bosquet'], 2)) {
      if (m === 'cultures') { const c = tirer(saison === 'hiver' ? F.souches : F.cultures, 2); for (let i = 0, k = entre(5, 10); i < k; i++) poser(r() < .7 || saison === 'hiver' ? c : tirer(F.cultures), 'milieu', { z: -3.6 - i * .45, h: CULTURE }); }
      else if (m === 'prairie') { for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(F.betail, 3), 'milieu', { z: -4 - r() * 3, h: [.8, 1.6, 2.4] }); for (let i = 0, k = entre(4, 8); i < k; i++) poser(tirer(r() < .6 ? F.fleurs : F.herbes), 'milieu', { z: -3.6 - r() * 2, h: [.3, .7, 1.2] }); }
      else if (m === 'verger') { for (let i = 0, k = entre(3, 6); i < k; i++) poser(tirer(F.fruitiers, 2), 'milieu', { z: -5 - (i % 2) * 2, h: [3, 4.5, 4] }); }
      else if (m === 'potager') { for (let i = 0, k = entre(4, 8); i < k; i++) poser(tirer(F.legumes), 'milieu', { z: -3.5 - r() * 1.5, h: [.3, .9, 1.5] }); if (r() < .5) poser(tirer(F.charrettes), 'milieu', { z: -4, h: [.8, 1.4, 2.5] }); }
      else if (m === 'ferme') { poser(tirer(F.fermes, 3), 'milieu', { z: -7 - r() * 3, profil: false, h: [4, 8, 14] }); if (r() < .5) poser(tirer(F.betail, 3), 'milieu', { z: -5, h: [.8, 1.6, 2.4] }); }
      else if (m === 'bosquet') { const x = x0 + 2 + r() * (L - 4); for (let i = 0, k = entre(3, 5); i < k; i++) poser(tirer(arbres), 'milieu', { x: x + (r() - .5) * 4, z: -6 - r() * 4, h: ARBRE }); for (let i = 0; i < 2; i++) poser(tirer(F.buissons), 'milieu', { x: x + (r() - .5) * 5, z: -5, h: [.6, 1.4, 2.5] }); }
    }
    for (let i = 0, k = entre(3, 7); i < k; i++) poser(tirer(arbres), 'fond', { h: ARBRE });
    bordure(); devant(entre(4, 9));
  } else if (lieu === 'village') {
    for (const m of quelques(['rue', 'place', 'marche', 'jardin', 'atelier'], 2)) {
      if (m === 'rue') { for (let i = 0, k = entre(1, 2); i < k; i++) poser(tirer(F.maisons, 4), 'milieu', { z: -4.6 - r() * 1.2, profil: false, h: MAISON }); for (let i = 0, k = entre(1, 2); i < k; i++) poser(tirer(F.lanternes, 2), 'bord', { z: -1.2, h: [2.2, 2.8, 1] }); }
      else if (m === 'place') { poser(tirer(F.fontaines, 3), 'milieu', { z: -3.6, profil: false, h: [1.2, 2.4, 3] }); for (let i = 0, k = entre(1, 2); i < k; i++) poser(tirer(F.bancs, 2), 'bord', { z: -1.3, h: [.4, .6, 1.8] }); poser(tirer(F.maisons, 4), 'milieu', { z: -6, profil: false, h: MAISON }); }
      else if (m === 'marche') { for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(F.etals, 2), 'milieu', { z: -3.5, profil: false, h: [1.5, 2.4, 3] }); for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(F.caisses, 2), 'bord', { z: -1.3, h: [.5, 1, 1.2] }); }
      else if (m === 'jardin') { poser(tirer(F.maisons, 4), 'milieu', { z: -5, profil: false, h: MAISON }); for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(F.haies, 2), 'bord', { z: -1.3, profil: false, h: [.6, 1.2, 4] }); for (let i = 0, k = entre(2, 5); i < k; i++) poser(tirer(F.fleurs), 'milieu', { z: -3.4, h: [.3, .7, 1.2] }); }
      else if (m === 'atelier') { poser(tirer(F.ateliers, 3), 'milieu', { z: -5.5, profil: false, h: MAISON }); for (let i = 0, k = entre(1, 2); i < k; i++) poser(tirer(F.charrettes, 2), 'bord', { z: -1.4, h: [.8, 1.4, 2.5] }); }
    }
    for (let i = 0, k = entre(2, 6); i < k; i++) poser(tirer(r() < .6 ? F.immeubles : F.maisons, 3), 'fond', { z: -16 - r() * 8, profil: false, h: [8, 16, 14] });
    for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(r() < .5 ? arbres : F.petitsArbres), 'milieu', { z: -3.5, h: [3, 5.5, 5] });
    devant(entre(3, 7));
  } else if (lieu === 'rivage') {
    const m = quelques(['plage', 'port', 'dunes', 'rochers'], 1)[0];
    for (let i = 0, k = m === 'port' ? entre(2, 3) : entre(1, 2); i < k; i++) poser(tirer(F.bateaux, 3), 'milieu', { z: -7 - r() * 6, profil: true, h: BATEAU });
    if (m === 'port') { for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(F.caisses, 2), 'bord', { h: [.5, 1, 1.2] }); if (r() < .5) poser(tirer(F.panneaux), 'bord', { h: [1.2, 1.8, 1] }); if (r() < .35) poser(F.parId.get('archipel/phare'), 'milieu', { z: -9, profil: false, h: [6, 9, 4] }); }
    if (m === 'plage') for (let i = 0, k = entre(2, 3); i < k; i++) poser(tirer(saison === 'ete' ? F.palmiers : F.rochers), 'bord', { h: saison === 'ete' ? [3.5, 5.5, 4] : [.5, 1.4, 3] });
    if (m === 'dunes') { for (let i = 0, k = entre(4, 7); i < k; i++) poser(tirer(F.herbesPlage), 'bord', { h: [.3, .7, 1.5] }); for (let i = 0, k = entre(1, 2); i < k; i++) poser(tirer(F.souches), 'bord', { s: 1.2 }); }
    if (m === 'rochers') for (let i = 0, k = entre(3, 5); i < k; i++) poser(tirer(F.rochersSable, 2), 'bord', { h: [.5, 1.6, 3] });
    for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(F.rochersSable), 'avant', { s: 1.2 });
    for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(r() < .6 ? F.herbesPlage : F.herbes), 'avant', { s: 1.2 });
  } else if (lieu === 'interieur') { // une maison ouverte, comme une maison de poupée : le chemin y entre par une porte et ressort par l’autre
    poser(tirer(F.tapis, 2), 'chemin', { z: -.2, profil: false, x: x0 + L / 2, h: [.01, .05, 3.2] });
    for (let i = 0, k = entre(4, 6); i < k; i++) poser(tirer(F.meubles, 3), 'bord', { z: -2.3, profil: false, h: [1, 2.2, 2.4], de: piece.de + .5, a: piece.a - .5 });
    for (let i = 0, k = entre(4, 7); i < k; i++) poser(tirer(arbres), 'fond', { h: ARBRE }); // derrière la maison, le pays continue
  } else if (lieu === 'desert') { // le sable, des cactus, une oasis ; au loin, parfois, une pyramide ou un village de terre
    for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(F.palmiersOasis), 'milieu', { z: -5 - r() * 4, h: ARBRE });
    for (let i = 0, k = entre(3, 6); i < k; i++) poser(tirer(r() < .65 ? F.cactus : F.arbresMorts), 'milieu', { h: [1.2, 3, 4] });
    if (r() < .35) poser(tirer(F.pyramides), 'fond', { z: -24, profil: false, h: [8, 13, 16] });
    else if (r() < .5) for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(F.maisonsTerre, 3), 'fond', { z: -16 - r() * 6, profil: false, h: [5, 8, 12] });
    for (let i = 0, k = entre(2, 5); i < k; i++) poser(tirer(F.rochersRouges), 'fond', { h: [2, 5, 8] });
    for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(F.cactus), 'bord', { h: [.6, 1.6, 1.5] });
    for (let i = 0, k = entre(1, 3); i < k; i++) poser(tirer(F.rochersRouges), 'avant', { h: [.3, .8, 1.5] });
  } else if (lieu === 'savane') { // l’herbe sèche, les acacias, un baobab
    for (let i = 0, k = entre(3, 5); i < k; i++) poser(tirer(r() < .2 ? F.baobabs : r() < .75 ? F.acacias : F.arbresSavane), 'milieu', { z: -5 - r() * 6, h: ARBRE });
    for (let i = 0, k = entre(5, 8); i < k; i++) poser(tirer(r() < .85 ? F.acacias : F.baobabs), 'fond', { h: ARBRE });
    for (let i = 0, k = entre(3, 6); i < k; i++) poser(tirer(F.buissonsSavane), 'bord', { h: [.8, 1.8, 3] });
    for (let i = 0, k = entre(6, 10); i < k; i++) poser(tirer(F.herbesSavane), 'avant', { h: [.5, 1.1, 1.5] });
    if (r() < .3) poser(tirer(F.cases), 'milieu', { z: -9, profil: false, h: [3, 4.5, 6] });
  } else if (lieu === 'tropiques') { // la jungle : palmiers, bananiers, bambous, de grandes feuilles
    for (let i = 0, k = entre(4, 6); i < k; i++) poser(tirer(r() < .5 ? F.palmiersTropiques : r() < .6 ? F.bananiers : F.bambous), 'milieu', { h: ARBRE });
    for (let i = 0, k = entre(8, 12); i < k; i++) poser(tirer(r() < .55 ? F.arbresJungle : F.palmiersTropiques), 'fond', { h: [6, 12, 12] });
    for (let i = 0, k = entre(4, 7); i < k; i++) poser(tirer(F.fougeres), 'bord', { h: [.8, 1.6, 2.5] });
    for (let i = 0, k = entre(2, 4); i < k; i++) poser(tirer(F.fougeres), 'avant', { z: 2.3, h: [.6, 1.2, 2] });
    if (r() < .3) poser(tirer(F.paillotes), 'milieu', { z: -8, profil: false, h: [4, 6, 9] });
  } else if (lieu === 'montagne') { // des rochers, les sapins ; l’hiver, la neige ; les sommets, eux, sont au lointain
    for (let i = 0; i < 2; i++) poser(tirer(F.montagnes), 'fond', { z: -22 - r() * 4, profil: false, h: [4, 6.5, 14] });
    const pins = saison === 'hiver' && F.pinsNeige.length ? [...F.pinsNeige, ...F.sapinsNeige] : F.pins;
    for (let i = 0, k = entre(6, 10); i < k; i++) poser(tirer(pins), 'milieu', { h: ARBRE });
    for (let i = 0, k = entre(3, 5); i < k; i++) poser(tirer(F.rochersMontagne), 'bord', { h: [.5, 1.6, 3] });
    for (let i = 0, k = entre(4, 7); i < k; i++) poser(tirer(saison === 'hiver' ? F.rochersMontagne : F.fleurs), 'avant', { s: 1.2 });
    if (r() < .3) poser(tirer(F.chalets), 'milieu', { z: -7, profil: false, h: MAISON });
  }

  // à la jointure avec la veille : un objet de raccord, au premier plan, qui couvre le passage d’un lieu à l’autre
  let raccord = null;
  if (veille) {
    const avant = veille.lieu, apres = lieu, PROPRES = { foret: F.pins, champs: F.clotures, village: F.lanternes, rivage: F.rochers, interieur: null,
      desert: F.cactus, savane: F.acacias, tropiques: F.palmiersTropiques, montagne: F.pins }, AILLEURS = ['desert', 'savane', 'tropiques', 'montagne'];
    const choix = pareil(avant, apres) ? PROPRES[apres]
      : apres === 'interieur' || avant === 'interieur' ? null : AILLEURS.includes(apres) ? PROPRES[apres] : AILLEURS.includes(avant) ? PROPRES[avant] : [...F.portails, ...F.haies];
    const o = choix && tirer(choix);
    if (o) { const h = /tree|pine|palm|acacia/i.test(o.id) ? 8 : /lantern/.test(o.id) ? 3 : /gate|hedge/.test(o.id) ? 2.2 : 1.3; raccord = { id: o.id, x: x0, z: 1.9, y: 0, ry: /gate/.test(o.id) ? 0 : (r() - .5) * .6, s: h / Math.max(o.taille[1], .05), plan: 'avant' }; items.push(raccord); }
  }
  return { i: jour.i, x0, date: jour.date, lieu, saison, climat: jour.climat, items, piece, sol: solDe(lieu, saison, r), fond: fondDe(lieu, jour.horizon, r) };
}
function solDe(lieu, saison, r) { // la couleur du sol, et celle du chemin
  const herbe = { printemps: '#8fbf5e', ete: '#9cbf56', automne: '#bfa253', hiver: '#eef2f4' }[saison];
  const S = {
    foret: { sol: nuance(herbe, -.14), chemin: saison === 'hiver' ? '#f6f7f8' : '#d2b98c' },
    champs: { sol: herbe, chemin: saison === 'hiver' ? '#f6f7f8' : '#e3cfa3' },
    village: { sol: melange(herbe, '#b9b3a6', .45), chemin: '#d3cbbb' },
    rivage: { sol: '#e2cf9d', chemin: '#efe2bd' },
    interieur: { sol: herbe, chemin: '#d2b98c' },
    desert: { sol: '#e3cb93', chemin: '#efdcb0' },
    savane: { sol: '#c9b26c', chemin: '#dcc28c' },
    tropiques: { sol: '#5f9a45', chemin: '#c9ae82' },
    montagne: { sol: saison === 'hiver' ? '#eef2f4' : nuance(herbe, -.06), chemin: saison === 'hiver' ? '#f6f7f8' : '#c4b79c' },
  }[lieu] || { sol: herbe, chemin: '#d2b98c' };
  return { ...S, relief: { foret: 1.2, champs: .7, village: .5, rivage: 0, interieur: .7, desert: 1.5, savane: .5, tropiques: 1, montagne: 2.4 }[lieu] ?? .7, eau: lieu === 'rivage' };
}

/* ───────── Le lointain : entre le bout du sol et le ciel, des silhouettes pâlies par la distance ───────── */

// par le lieu, puis par les mots de la page : une lisière, des collines, des montagnes, la mer, des toits ; chacun de 0 à 1
function fondDe(lieu, horizon, r) {
  const f = { lisiere: 0, collines: 0, montagnes: 0, mer: 0, toits: 0, ...({
    foret: { lisiere: .9, collines: .3 }, champs: { collines: .45 + .45 * r(), lisiere: .3 * r() }, village: { toits: .4 + .35 * r(), collines: .35 },
    rivage: { mer: 1, collines: .15 * r() }, interieur: { collines: .45 }, desert: { collines: .5 + .4 * r() }, savane: { collines: .3 + .3 * r() },
    tropiques: { lisiere: .8, montagnes: .3 + .3 * r() }, montagne: { montagnes: .8 + .2 * r(), collines: .4 },
  }[lieu] || { collines: .45 }) };
  for (const k in f) if (horizon?.[k]) f[k] = Math.max(f[k], .5 + .5 * horizon[k]); // nommé une fois, c’est déjà presque tout l’horizon
  for (const k in f) f[k] = Math.round(f[k] * 100) / 100;
  return f;
}
const COS = Math.cos(ELEV), SIN = Math.sin(ELEV), yDeV = (v, z) => CIBLE + (v + z * SIN) / COS; // la hauteur, à z, d’un point vu à v dans l’image (depuis son milieu, en mètres)
const b1 = (x, l, s) => bruit(x / l, .5, s); // du bruit le long de x
function pics(x, l, s) { // des sommets pointus, un tous les l mètres environ, chacun à sa hauteur et sa pente
  const i0 = Math.floor(x / l); let v = 0;
  for (let i = i0 - 1; i <= i0 + 1; i++) { const xi = (i + .5 + (hash(`${s}:${i}`) - .5) * .6) * l, hi = .35 + .65 * hash(`${s}:h${i}`), wi = l * (.6 + .6 * hash(`${s}:w${i}`)); v = Math.max(v, hi * Math.max(0, 1 - Math.abs(x - xi) / wi)); }
  return v;
}
function toits(x) { // des toits plats, des pignons, un clocher de loin en loin
  const seg = Math.floor(x / 3), u = x / 3 - seg, h = hash(`toit:${seg}`), k = hash(`clocher:${seg}`);
  return .35 + .45 * h + (k > .92 ? .6 * Math.max(0, 1 - Math.abs(u - .5) * 5) : k > .6 ? .18 * Math.max(0, 1 - Math.abs(u - .5) * 2.4) : 0);
}
// chaque bande : sa profondeur, sa part de brume, sa teinte, et le haut de sa silhouette en hauteur d’image pour une part a ;
// le bout du sol se voit à 2,77 : une bande sans part reste cachée derrière
const SOL_LOIN = 2.6, LISIERE = { printemps: '#3f6f44', ete: '#36613c', automne: '#6f5d34', hiver: '#4f5e66' };
const BANDES = [ // teinte : par le lieu ou donnée ; les mélanges se font en couleurs d’écran, comme le ciel
  { nom: 'lisiere', z: -37, brume: .3, teinte: p => LISIERE[p.saison] || LISIERE.ete, haut: (x, a) => SOL_LOIN + a * (.6 + .3 * b1(x, .7, 23) + .25 * b1(x, 5, 24)) },
  { nom: 'toits', z: -41, brume: .35, teinte: () => '#7d7066', haut: (x, a) => SOL_LOIN + a * toits(x) },
  { nom: 'collines', z: -45, brume: .3, teinte: p => nuance(p.sol.sol, -.45), haut: (x, a) => SOL_LOIN + Math.min(1.6, a * (.8 + 1.5 * (.5 * b1(x, 14, 27) + .35 * b1(x, 5, 28) + .15 * b1(x, 1.8, 29)))) },
  { nom: 'mer', z: -50, brume: .25, teinte: () => '#5f9fbf', eau: true, haut: (x, a) => SOL_LOIN + .9 * a },
  { nom: 'montagnes', z: -56, brume: .35, teinte: () => '#4a566e', neige: '#e4e9ef', haut: (x, a) => SOL_LOIN + Math.min(2, a * (1 + 1.3 * (.7 * pics(x, 4, 31) + .2 * pics(x, 1.4, 32) + .1 * b1(x, 12, 33)))) },
];
// comme parts, mais fondu sur toute la largeur d’un jour : le lointain change lentement, d’un jour à l’autre
function partsLoin(plans, x) {
  const out = []; for (const p of plans) { const c = p.x0 + L / 2, w = lisse(L / 2 + 6, L / 2 - 6, Math.abs(x - c)); if (w > 0) out.push([p, w]); }
  const t = out.reduce((a, [, w]) => a + w, 0) || 1; return out.map(([p, w]) => [p, w / t]);
}
function lointain(plans, de, a) {
  const g = new THREE.Group(), xs = []; for (let x = de; x <= a + 1e-6; x += .5) xs.push(x);
  const t = new THREE.Color(), brumeDe = p => melange('#cdd6de', p.climat.bas, .45); // la brume, entre le gris et le bas du ciel du jour
  for (const B of BANDES) {
    const cols = xs.map(x => { // à chaque x : la part de la bande, fondue d’un jour à l’autre, et ses couleurs, pâlies par la brume
      let part = 0, neige = 0; const couleur = new THREE.Color(0, 0, 0), neigeC = new THREE.Color(0, 0, 0);
      for (const [p, w] of partsLoin(plans, x)) {
        const brume = brumeDe(p); part += w * (p.fond?.[B.nom] || 0); neige += w * (p.saison === 'hiver' ? 1 : 0);
        couleur.add(t.set(melange(B.teinte(p), brume, B.brume)).multiplyScalar(w)); if (B.neige) neigeC.add(t.set(melange(B.neige, brume, .3)).multiplyScalar(w));
      }
      return { x, part, neige, haut: B.haut(x, part), couleur, neigeC };
    });
    if (!cols.some(c => c.part > .02)) continue;
    const pos = [], col = [], idx = [], rangs = B.neige ? 3 : 2;
    for (const c of cols) {
      const ligne = B.neige ? Math.max(SOL_LOIN, c.haut - (.22 + .35 * c.neige) * Math.max(0, c.haut - 2.77)) : c.haut; // la neige : le haut de ce qui dépasse du sol, davantage l’hiver
      (rangs === 3 ? [1.6, ligne, c.haut] : [1.6, c.haut]).forEach((v, j) => { pos.push(c.x, yDeV(v, B.z), B.z); const k = j === 2 ? c.neigeC : c.couleur; col.push(k.r, k.g, k.b); });
    }
    for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < rangs - 1; j++) { const a0 = i * rangs + j, b0 = a0 + rangs; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, side: THREE.DoubleSide }));
    m.userData.genere = true; if (B.eau) m.userData.eau = true;
    g.add(m);
  }
  return g;
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
  h += Math.min(relief, 1.5) * Math.pow(loin / 26, 1.4) * .36 * bruit(x / 14, z / 9, 7); // le sol ondule vers le fond ; les collines et les sommets, eux, sont au lointain, derrière
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
      const r = new THREE.Group(); s.position.set(-c.x, -b.min.y - (o.sous || 0), -c.z); r.add(s); // un socle, sous terre
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
    s.add(terrain(voisins, de - 1, a + 1), eau(voisins, de - 4, a + 4), ciel(voisins, de - 4, a + 4), lointain(voisins, de - 4, a + 4));
    for (const p of voisins) if (p.piece) s.add(maison(p.piece));
    const items = voisins.flatMap(p => p.items).filter(it => it.x > de - 6 && it.x < a + 6);
    const modeles = await Promise.all(items.map(it => this.modeles.charger(F.get(it.id))));
    items.forEach((it, n) => {
      const m = modeles[n]; if (!m) return;
      const o = m.clone(); o.position.set(it.x, it.vol ? it.y : it.eau ? rampe(it.z) - .05 + it.y : (it.y || 0) + Math.max(hauteur(voisins, it.x, it.z), rampe(it.z) - .05), it.z); o.rotation.y = it.ry; o.scale.setScalar(it.s);
      if (/watercraft|pirate-kit\/(boat|ship)|q-ships\/|q-survival\/Raft/.test(it.id)) o.position.y = rampe(it.z) - .12; // un bateau flotte
      if (it.vol) o.traverse(m => { if (m.isMesh) m.castShadow = false; }); // ce qui vole n’assombrit pas le sol
      s.add(o);
    });
    // la lumière : la même partout, pour que les tuiles se raccordent ; le temps du jour vient de la teinte posée par le pinceau
    const soleil = new THREE.DirectionalLight('#fff4e2', 2.4); soleil.position.set(xc - 14, 22, 18); soleil.target.position.set(xc, 0, -4);
    soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048); Object.assign(soleil.shadow.camera, { left: -l / 2 - 6, right: l / 2 + 6, top: 18, bottom: -18, near: 1, far: 90 }); soleil.shadow.bias = -.0005; soleil.shadow.normalBias = .02;
    s.add(soleil, soleil.target, new THREE.HemisphereLight('#e4f0ff', '#b9a98a', 1.25));
    s.fog = new THREE.Fog('#dfe6ea', 106, 165);
    const cam = new THREE.OrthographicCamera(-l / 2, l / 2, V / 2, -V / 2, 1, 400), dir = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV));
    const cible = new THREE.Vector3(xc, CIBLE, 0); cam.position.copy(cible).addScaledVector(dir, -100); cam.lookAt(cible); cam.updateMatrixWorld();
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
