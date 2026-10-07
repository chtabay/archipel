// Le chemin : des gens et des bêtes en action. Un modèle animé, une de ses animations, un instant : on fige la pose en un
// modèle simple, sans squelette, à sa taille réelle, en mètres. Une pose peut tenir un objet dans la main, ou changer une
// couleur. On le fait dans Chromium, avec three.js, puis on l’exporte avec son GLTFExporter.
// node chemin/outils/poser.mjs <dossier du paquet three> <dossier des collections> <dossier de sortie> <poses.json>
// poses.json : [{ nom, src, anim?, clip, t, h | l, couleurs?, cacher?, tenir?: [{ src | forme, os, h, p, r }], avec?: [{ src, h, p, r }] }]
//   src : le modèle, relatif au dossier des collections ; anim : un autre fichier d’où viennent les animations, s’il le faut ;
//   clip : le nom de l’animation ; t : l’instant, de 0 à 1 ; h : la hauteur au repos, ou l : la longueur, en mètres ;
//   couleurs : { matériau: couleur } ; cacher : les maillages à ôter ; tenir : un objet dans la main, rattaché à un os ;
//   avec : un objet posé à côté, comme un siège. Les tailles et les décalages des objets sont en mètres.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const [THREE_DIR, COLL, OUT, LISTE] = process.argv.slice(2);
const POSES = JSON.parse(fs.readFileSync(LISTE, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/_three/build/three.module.js"}}</script>
<script type="module">
import * as T from 'three';
import { GLTFLoader } from '/_three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from '/_three/examples/jsm/exporters/GLTFExporter.js';
import { MeshoptDecoder } from '/_three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from '/_three/examples/jsm/utils/SkeletonUtils.js';
const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map(), charger = f => { if (!cache.has(f)) cache.set(f, L.loadAsync('/_f/' + f.split('/').map(encodeURIComponent).join('/'))); return cache.get(f); };
function cuire(racine) { // chaque maillage, figé dans sa pose, en coordonnées du monde
  racine.updateMatrixWorld(true);
  const out = new T.Group(), v = new T.Vector3();
  racine.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    let g = o.geometry.clone();
    if (o.isSkinnedMesh) {
      o.skeleton.update();
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { o.getVertexPosition(i, v); p.setXYZ(i, v.x, v.y, v.z); }
      g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight');
    }
    g.morphAttributes = {}; g.applyMatrix4(o.matrixWorld);
    if (o.isSkinnedMesh || o.matrixWorld.determinant() < 0) { g.deleteAttribute('normal'); g.computeVertexNormals(); }
    const nu = m => { m = m.clone(); for (const k of ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'lightMap']) m[k] = null; return m; }; // la couleur seule : le pinceau fait le reste
    const m = new T.Mesh(g, Array.isArray(o.material) ? o.material.map(nu) : nu(o.material)); m.name = o.name; out.add(m);
  });
  return out;
}
window.poser = async (c) => {
  const gl = await charger(c.src), anims = c.anim ? (await charger(c.anim)).animations : gl.animations;
  const racine = clone(gl.scene), bas = new T.Group(); bas.add(racine);
  if (c.cacher) racine.traverse(o => { if (o.isMesh && new RegExp(c.cacher, 'i').test(o.name)) o.visible = false; });
  // l’échelle, prise au repos : une pose assise ou couchée garde la taille de la personne debout
  bas.updateMatrixWorld(true);
  const repos = new T.Box3(); racine.traverse(o => { if (o.isMesh && o.visible) repos.expandByObject(o, true); });
  const tr = repos.getSize(new T.Vector3()), s = c.l ? c.l / Math.max(tr.x, tr.z) : c.h / tr.y;
  if (c.clip) {
    const clip = anims.find(a => a.name === c.clip) || anims.find(a => new RegExp(c.clip, 'i').test(a.name));
    if (!clip) throw new Error(c.nom + ' : pas d’animation ' + c.clip + ' parmi ' + anims.map(a => a.name).join(', '));
    const mixer = new T.AnimationMixer(racine), action = mixer.clipAction(clip); action.play(); mixer.setTime((c.t ?? .5) * clip.duration);
  }
  racine.updateMatrixWorld(true);
  const monde = (o, h) => { const b = new T.Box3().setFromObject(o), t = b.getSize(new T.Vector3()); return h / Math.max(t.x, t.y, t.z, 1e-6); }; // un objet ramené à sa taille, en mètres
  const objet = async x => {
    if (x.forme === 'baton') { const m = new T.Mesh(new T.CylinderGeometry(x.rayon || .015, x.rayon || .015, x.h, 6), new T.MeshStandardMaterial({ color: x.couleur || '#6b4a2b', roughness: .8 })); const g = new T.Group(); g.add(m); return g; }
    const o = clone((await charger(x.src)).scene); o.updateMatrixWorld(true); const k = monde(o, x.h); o.scale.multiplyScalar(k);
    const g = new T.Group(); g.add(o); if (x.centre !== false) { g.updateMatrixWorld(true); const b = new T.Box3().setFromObject(o), c2 = b.getCenter(new T.Vector3()); o.position.sub(c2); }
    return g;
  };
  for (const x of c.tenir || []) { // un objet dans la main, rattaché à l’os ; sa taille et son décalage sont en mètres
    const os = racine.getObjectByName(x.os) || racine.getObjectByName(T.PropertyBinding.sanitizeNodeName(x.os)); if (!os) throw new Error(c.nom + ' : pas d’os ' + x.os); // le chargeur ôte les points des noms
    const o = await objet(x), e = new T.Vector3(); os.getWorldScale(e);
    o.scale.multiplyScalar(1 / s).divide(e); o.position.fromArray(x.p || [0, 0, 0]).multiplyScalar(1 / s).divide(e); o.rotation.fromArray(x.r || [0, 0, 0]);
    os.add(o);
  }
  for (const [nom, couleur] of Object.entries(c.couleurs || {})) racine.traverse(o => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const re = new RegExp(nom, 'i'), neufs = ms.map(m => { if (!re.test(m.name)) return m; const n = m.clone(); n.color.set(couleur); n.map = null; return n; });
    o.material = Array.isArray(o.material) ? neufs : neufs[0];
  });
  const g = cuire(bas), b = new T.Box3().setFromObject(g);
  g.children.forEach(m => { m.geometry.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); m.geometry.scale(s, s, s); });
  for (const x of c.avec || []) { // à côté de la pose : un siège, un fauteuil, en mètres
    const o = await objet({ ...x, centre: false }); o.position.fromArray(x.p || [0, 0, 0]); o.rotation.fromArray(x.r || [0, 0, 0]);
    const tout = new T.Group(); tout.add(o); g.add(...cuire(tout).children);
  }
  const t = new T.Box3().setFromObject(g).getSize(new T.Vector3());
  const r = await new GLTFExporter().parseAsync(g, { binary: true });
  let s64 = ''; const u = new Uint8Array(r); for (let i = 0; i < u.length; i += 32768) s64 += String.fromCharCode(...u.subarray(i, i + 32768));
  return { glb: btoa(s64), taille: [t.x, t.y, t.z].map(x => +x.toFixed(2)) };
};
window.pret = true;
</script>`;

const b = await chromium.launch(), p = await b.newPage(), erreurs = [];
p.on('pageerror', e => erreurs.push(e.message)); p.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
await p.route('**/_poser.html', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
await p.route('**/_three/**', r => { const f = path.join(THREE_DIR, new URL(r.request().url()).pathname.replace('/_three/', '')); r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }); });
await p.route('**/_f/**', r => { // les modèles, et ce qu’ils chargent à côté d’eux, comme leurs textures
  const u = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/_f\//, '')), f = path.join(COLL, u);
  fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' });
});
await p.goto('http://poser.local/_poser.html'); await p.waitForFunction(() => window.pret, null, { timeout: 30000 });
for (const c of POSES) {
  try {
    const r = await p.evaluate(c => window.poser(c), c);
    fs.writeFileSync(path.join(OUT, `${c.nom}.glb`), Buffer.from(r.glb, 'base64'));
    console.log(c.nom, r.taille.join(' × '), 'm');
  } catch (e) { erreurs.push(e.message.split('\n')[0]); console.log('RATÉ', c.nom); }
}
console.log(erreurs.length ? `erreurs : ${erreurs.join(' | ')}` : 'sans erreur');
await b.close();
