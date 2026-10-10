// Le chemin : les pictos. Des emoji de Twemoji (github.com/jdecked/twemoji, graphismes sous licence CC BY 4.0), découpés
// couche par couche et extrudés en panneaux peints, plantés sur un piquet au bord du chemin : ce qui n’a pas d’objet en 3D,
// la main, l’idée, la question, la balance de la justice, une robe, trouve ainsi quelque chose en face. Chaque couleur de
// l’emoji devient une plaque, un peu en avant de la précédente. Dans Chromium, avec le SVGLoader et le GLTFExporter de three.js.
// node chemin/outils/pictos.mjs <dossier du paquet three> <dossier des SVG de Twemoji, assets/svg> <dossier de sortie> [planche.png]
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(import.meta.url), { servir } = require('../../tests/commun.js');
const [THREE_DIR, SVG, OUT, PLANCHE] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

// le nom du fichier, et le point de code de l’emoji ; leurs noms français sont dans francais.py, leurs liens dans sens/symboles.txt
export const PICTOS = [
  // le corps
  ['main', '270b'], ['doigt', '261d'], ['pied', '1f9b6'], ['jambe', '1f9b5'], ['bras', '1f4aa'], ['yeux', '1f440'], ['bouche', '1f444'], ['nez', '1f443'],
  ['oreille', '1f442'], ['dent', '1f9b7'], ['langue', '1f445'], ['cerveau', '1f9e0'], ['visage', '1f642'], ['traces', '1f463'], ['sang', '1fa78'],
  // la parole, la pensée
  ['bulle', '1f4ac'], ['pensee', '1f4ad'], ['ampoule', '1f4a1'], ['question', '2753'], ['attention', '26a0'], ['porte-voix', '1f4e2'], ['chut', '1f92b'],
  ['lettre', '2709'], ['micro', '1f3a4'],
  // le temps, le monde
  ['calendrier', '1f5d3'], ['horloge', '1f570'], ['reveil', '23f0'], ['globe', '1f30d'], ['carte', '1f5fa'], ['valise', '1f9f3'], ['arc-en-ciel', '1f308'],
  ['etincelles', '2728'],
  // les liens, la justice, la victoire, la vie
  ['accord', '1f91d'], ['balance', '2696'], ['bague', '1f48d'], ['colombe', '1f54a'], ['priere', '1f64f'], ['trophee', '1f3c6'], ['medaille', '1f3c5'],
  ['couronne', '1f451'], ['bebe', '1f476'], ['coeur-brise', '1f494'], ['fete', '1f389'],
  // les vêtements
  ['robe', '1f457'], ['chemise', '1f455'], ['pantalon', '1f456'], ['chaussure', '1f45e'], ['gants', '1f9e4'], ['chapeau', '1f452'], ['echarpe', '1f9e3'],
  ['bottes', '1f462'], ['manteau', '1f9e5'],
  // les signes, les arts
  ['stop', '1f6d1'], ['interdit', '1f6ab'], ['erreur', '274c'], ['loupe', '1f50d'], ['theatre', '1f3ad'], ['cinema', '1f3ac'], ['palette', '1f3a8'],
  // les visages
  ['colere', '1f620'], ['honte', '1f633'], ['etonnement', '1f62e'], ['inquietude', '1f61f'], ['doute', '1f914'], ['ennui', '1f971'], ['folie', '1f92a'],
  ['mensonge', '1f925'],
];

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4efe4">
<script type="importmap">{"imports":{"three":"/_three/build/three.module.js"}}</script>
<script type="module">
import * as T from 'three';
import { SVGLoader } from '/_three/examples/jsm/loaders/SVGLoader.js';
import { GLTFExporter } from '/_three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from '/_three/examples/jsm/utils/BufferGeometryUtils.js';
const HAUT = 1, PIQUET = .5, EPAIS = .03, PAS = .004; // l’image : 1 m de haut, sur un piquet de 50 cm ; chaque plaque, 4 mm devant la précédente
function panneau(svg) {
  const d = new SVGLoader().parse(svg), couches = []; // chaque forme pleine de l’emoji, dans l’ordre où il la peint
  for (const p of d.paths) {
    const st = p.userData.style; if (!st || st.fill === 'none' || st.fill === 'transparent' || (st.fillOpacity ?? 1) < .2) continue;
    for (const s of SVGLoader.createShapes(p)) { // retournée : en SVG, y descend
      const { shape, holes } = s.extractPoints(10), forme = new T.Shape(shape.map(v => new T.Vector2(v.x, -v.y)));
      forme.holes = holes.map(h => new T.Path(h.map(v => new T.Vector2(v.x, -v.y))));
      couches.push({ forme, couleur: p.color.getHex() });
    }
  }
  const b = new T.Box2(); for (const c of couches) for (const v of c.forme.getPoints()) b.expandByPoint(v);
  const k = HAUT / Math.max(b.max.y - b.min.y, b.max.x - b.min.x), cx = (b.min.x + b.max.x) / 2, parCouleur = new Map(); // au plus 1 m dans un sens comme dans l’autre
  couches.forEach((c, n) => {
    const g = new T.ExtrudeGeometry(c.forme, { depth: EPAIS / k, bevelEnabled: false, curveSegments: 6 });
    g.translate(-cx, -b.min.y, n * PAS / k); g.scale(k, k, k); g.translate(0, PIQUET, 0);
    if (!parCouleur.has(c.couleur)) parCouleur.set(c.couleur, []); parCouleur.get(c.couleur).push(g.toNonIndexed());
  });
  const grp = new T.Group(), h = (b.max.y - b.min.y) * k;
  for (const [couleur, gs] of parCouleur) grp.add(new T.Mesh(mergeGeometries(gs), new T.MeshStandardMaterial({ color: couleur, roughness: .85, metalness: 0 })));
  const piquet = new T.Mesh(new T.BoxGeometry(.06, PIQUET + h * .5, .05), new T.MeshStandardMaterial({ color: '#8b6b4a', roughness: .9, metalness: 0 })); // le piquet, derrière
  piquet.position.set(0, (PIQUET + h * .5) / 2, -.03); grp.add(piquet);
  return grp;
}
window.exporter = async svg => {
  const g = panneau(svg), b = new T.Box3().setFromObject(g), t = b.getSize(new T.Vector3());
  const r = await new GLTFExporter().parseAsync(g, { binary: true });
  let s64 = ''; const u = new Uint8Array(r); for (let i = 0; i < u.length; i += 32768) s64 += String.fromCharCode(...u.subarray(i, i + 32768));
  return { glb: btoa(s64), taille: [t.x, t.y, t.z].map(x => +x.toFixed(3)) };
};
window.planche = svgs => { // tous les panneaux, en rangées, dans une scène éclairée comme la frise : pour les voir
  const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }), n = svgs.length, col = 10, lig = Math.ceil(n / col);
  r.setSize(col * 120, lig * 150); r.outputColorSpace = T.SRGBColorSpace; document.body.appendChild(r.domElement);
  const s = new T.Scene(); s.background = new T.Color('#f4efe4'); s.add(new T.HemisphereLight('#e4f0ff', '#b9a98a', 1.25)); const l = new T.DirectionalLight('#fff4e2', 2.4); l.position.set(-3, 6, 8); s.add(l);
  svgs.forEach((svg, i) => { const g = panneau(svg); g.position.set((i % col) * 1.6, -Math.floor(i / col) * 2, 0); g.rotation.y = .25; s.add(g); });
  const cam = new T.OrthographicCamera(-.8, col * 1.6 - .8, 1.75, 1.75 - lig * 2, .1, 50); cam.position.set(0, 0, 10); s.add(cam); r.render(s, cam);
  return r.domElement.toDataURL('image/png');
};
window.pret = true;
</script>`;

const srv = await servir(0), b = await chromium.launch(), p = await b.newPage(), erreurs = [];
p.on('pageerror', e => erreurs.push(e.message)); p.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
await p.route('**/_pictos.html', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
await p.route('**/_three/**', r => { const f = path.join(THREE_DIR, new URL(r.request().url()).pathname.replace('/_three/', '')); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }); });
await p.goto(srv.base + '_pictos.html'); await p.waitForFunction(() => window.pret, null, { timeout: 30000 });
const lus = [];
for (const [nom, code] of PICTOS) {
  const f = path.join(SVG, `${code}.svg`); if (!fs.existsSync(f)) { console.log(nom, ': pas de', `${code}.svg`); continue; }
  const svg = fs.readFileSync(f, 'utf8'); lus.push(svg);
  const r = await p.evaluate(s => window.exporter(s), svg);
  fs.writeFileSync(path.join(OUT, `${nom}.glb`), Buffer.from(r.glb, 'base64'));
  console.log(nom.padEnd(12), r.taille.join(' × '), 'm', `${Math.round(r.glb.length * .75 / 1024)} Ko`);
}
if (PLANCHE) { const url = await p.evaluate(s => window.planche(s), lus); fs.writeFileSync(PLANCHE, Buffer.from(url.split(',')[1], 'base64')); console.log('planche :', PLANCHE); }
console.log(erreurs.length ? `erreurs : ${erreurs.join(' | ')}` : 'sans erreur');
await b.close(); srv.fermer();
