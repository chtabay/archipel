// Le chemin : les choses de l’archipel, exportées en GLB pour le catalogue. On les construit avec le code même de l’archipel
// (modeles.js), dans Chromium, puis on les exporte avec le GLTFExporter de three.js, à leur taille réelle, en mètres.
// node chemin/outils/archipel.mjs <dossier du paquet three> <dossier de sortie>
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(import.meta.url), { servir } = require('../../tests/commun.js');
const [THREE_DIR, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

// ce qu’on exporte : le nom du fichier, comment le construire, sa hauteur réelle en mètres
const CHOSES = [
  ...['mouton', 'poule', 'crabe', 'renard', 'lievre', 'rougegorge', 'chat', 'chevreuil'].map(b => ({ nom: `bete-${b}`, bete: b, h: { mouton: .9, poule: .45, crabe: .18, renard: .5, lievre: .45, rougegorge: .14, chat: .35, chevreuil: 1.1 }[b] })),
  ...['mouette', 'goeland', 'fou', 'fregate', 'oie'].map(o => ({ nom: `oiseau-${o}`, oiseau: o, l: { mouette: 1.1, goeland: 1.4, fou: 1.7, fregate: 2.1, oie: 1.6 }[o] })), // l : l’envergure
  { nom: 'phare', phare: true, h: 14 },
  ...['prairie', 'automne', 'tropique', 'neige', 'lande'].map(b => ({ nom: `maison-${b}`, a: { famille: 'maison', espece: 'maison', stade: 1 }, biome: b, h: 6.5 })),
  { nom: 'maison-volets', a: { famille: 'maison', espece: 'volets', stade: 1 }, h: 6 },
  { nom: 'pont', a: { famille: 'maison', espece: 'pont', stade: 1 }, h: 1.6 },
  { nom: 'banc', a: { famille: 'maison', espece: 'banc', stade: 1 }, h: .9 },
  { nom: 'puits', a: { famille: 'culture', espece: 'puits', stade: 1 }, h: 2.2 },
  { nom: 'feu', a: { famille: 'culture', espece: 'feu', stade: 1 }, h: .7 },
  { nom: 'nuage-orage', a: { famille: 'meteo', espece: 'orage', stade: 1 }, h: 4 },
  { nom: 'nuage-pluie', a: { famille: 'meteo', espece: 'pluie', stade: 1 }, h: 4 },
  { nom: 'etang', a: { famille: 'meteo', espece: 'etang', stade: 1 }, h: .4 },
  { nom: 'fleurs', a: { famille: 'meteo', espece: 'fleurs', stade: 1 }, h: .5 },
  { nom: 'arbre-fleuri', a: { famille: 'arbre', espece: 'fleuri', stade: 2 }, h: 6 },
  { nom: 'arbre-nu', a: { famille: 'arbre', espece: 'nu', stade: 2 }, h: 6 },
  { nom: 'cairn', a: { famille: 'pierre', espece: 'cairn', stade: 1 }, h: 1.2 },
  { nom: 'menhir', a: { famille: 'pierre', espece: 'pierre', stade: 3 }, h: 3.5 },
  { nom: 'ronce', a: { famille: 'buisson', espece: 'ronce', stade: 1 }, h: 1 },
  { nom: 'baies', a: { famille: 'buisson', espece: 'baies', stade: 1 }, h: 1 },
];

const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/_three/build/three.module.js"}}</script>
<script type="module">
import { GLTFExporter } from '/_three/examples/jsm/exporters/GLTFExporter.js';
import * as T from '/vendor/three.min.js?v=1';
import { modeleChose, modelePhare, bete, oiseau, poseAiles } from '/modeles.js?v=17';
import { BIOMES } from '/biomes.js?v=5';
window.exporter = async c => {
  let g;
  if (c.bete) g = bete(c.bete, 3, BIOMES.prairie).grp;
  else if (c.oiseau) { const o = oiseau(c.oiseau); poseAiles(o, ...o.pose); g = o.grp; } // en vol plané
  else if (c.phare) g = modelePhare().objet;
  else g = modeleChose({ quad: 'ED', ...c.a, etats: {} }, BIOMES[c.biome || 'prairie'], .37, {}).objet;
  const tout = new T.Group(); tout.add(g); tout.updateMatrixWorld(true);
  g.traverse(o => { if (o.isMesh && (o.material?.blending === T.AdditiveBlending || o.material?.transparent)) o.visible = false; }); // ni halo ni faisceau
  const b = new T.Box3(); g.traverse(o => { if (o.isMesh && o.visible) b.expandByObject(o); });
  const t = b.getSize(new T.Vector3()), s = c.l ? c.l / Math.max(t.x, t.z) : c.h / t.y;
  g.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s); g.scale.setScalar(s);
  const cache = []; g.traverse(o => { if (!o.visible) cache.push(o); }); for (const o of cache) o.parent.remove(o);
  const r = await new GLTFExporter().parseAsync(tout, { binary: true });
  let s64 = ''; const u = new Uint8Array(r); for (let i = 0; i < u.length; i += 32768) s64 += String.fromCharCode(...u.subarray(i, i + 32768));
  return { glb: btoa(s64), taille: [t.x * s, t.y * s, t.z * s].map(x => +x.toFixed(3)) };
};
window.pret = true;
</script>`;

const srv = await servir(0), b = await chromium.launch(), p = await b.newPage(), erreurs = [];
p.on('pageerror', e => erreurs.push(e.message)); p.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
await p.route('**/_export.html', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
await p.route('**/_three/**', r => { const f = path.join(THREE_DIR, new URL(r.request().url()).pathname.replace('/_three/', '')); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }); });
await p.goto(srv.base + '_export.html'); await p.waitForFunction(() => window.pret, null, { timeout: 30000 });
for (const c of CHOSES) {
  const r = await p.evaluate(c => window.exporter(c), c);
  fs.writeFileSync(path.join(OUT, `${c.nom}.glb`), Buffer.from(r.glb, 'base64'));
  console.log(c.nom, r.taille.join(' × '), 'm');
}
console.log(erreurs.length ? `erreurs : ${erreurs.join(' | ')}` : 'sans erreur');
await b.close(); srv.fermer();
