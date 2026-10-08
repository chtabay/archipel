// Le chemin : alléger les modèles. Soudure, quantification, compression meshopt ; les images restent à part, dans le Textures/
// de leur collection.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs'; import path from 'path';
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const LOURD = 300 * 1024; // au-delà, un modèle est simplifié : le pinceau n’en verrait pas le détail
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const pad = (b, c) => { const n = Math.ceil(b.length / 4) * 4, o = Buffer.alloc(n, c); b.copy(o); return o; };
function glb(json, bin) { // un .glb : le JSON, puis le binaire
  const j = pad(Buffer.from(JSON.stringify(json)), 0x20), b = pad(Buffer.from(bin), 0), h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(j.length, 0); cj.writeUInt32LE(0x4E4F534A, 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(b.length, 0); cb.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([h, cj, j, cb, b]);
}
let avant = 0, apres = 0;
const fichiers = process.argv.slice(2);
for (const f of fichiers) {
  const doc = await io.read(f), lourd = fs.statSync(f).size > 3 * LOURD;
  for (const t of doc.getRoot().listTextures()) if (!t.getURI()) { // une image dans le modèle : à part elle aussi, sous son nom
    const dossier = path.join(path.dirname(f), 'Textures'), image = Buffer.from(t.getImage());
    let nom = `${t.getName() || 'image'}.${t.getMimeType() === 'image/jpeg' ? 'jpg' : 'png'}`;
    if (fs.existsSync(path.join(dossier, nom)) && !image.equals(fs.readFileSync(path.join(dossier, nom)))) nom = `${path.basename(f, '.glb')}-${nom}`;
    fs.mkdirSync(dossier, { recursive: true }); fs.writeFileSync(path.join(dossier, nom), image); t.setURI(`Textures/${nom}`);
  }
  await doc.transform(dedup(), weld(), ...(lourd ? [simplify({ simplifier: MeshoptSimplifier, ratio: .25, error: .01 })] : []), meshopt({ encoder: MeshoptEncoder, level: 'medium' }), prune());
  const { json, resources } = await io.writeJSON(doc);
  const bufs = json.buffers || [], vrais = bufs.filter(x => x.uri); // le tampon des données ; l’autre, vide, sert de repli à meshopt
  if (vrais.length !== 1 || !bufs[0].uri || bufs.slice(1).some(x => !x.extensions?.EXT_meshopt_compression?.fallback)) throw new Error(`${f} : tampons inattendus`);
  const bin = resources[bufs[0].uri]; delete bufs[0].uri;
  for (const im of json.images || []) im.uri = `Textures/${path.basename(im.uri || 'colormap.png')}`; // la palette de la collection, à côté
  const out = glb(json, bin); avant += fs.statSync(f).size; apres += out.length;
  fs.writeFileSync(f, out);
}
console.log(fichiers.length, 'modèles :', (avant / 1048576).toFixed(1), 'Mo ->', (apres / 1048576).toFixed(1), 'Mo');
