// Le chemin : alléger les modèles. Soudure, quantification, compression meshopt ; la palette reste à part, une par collection.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs'; import path from 'path';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
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
  const doc = await io.read(f);
  await doc.transform(dedup(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }), prune());
  const { json, resources } = await io.writeJSON(doc);
  const bufs = json.buffers || [], vrais = bufs.filter(x => x.uri); // le tampon des données ; l’autre, vide, sert de repli à meshopt
  if (vrais.length !== 1 || !bufs[0].uri || bufs.slice(1).some(x => !x.extensions?.EXT_meshopt_compression?.fallback)) throw new Error(`${f} : tampons inattendus`);
  const bin = resources[bufs[0].uri]; delete bufs[0].uri;
  for (const im of json.images || []) im.uri = 'Textures/colormap.png'; // la palette de la collection, à côté
  const out = glb(json, bin); avant += fs.statSync(f).size; apres += out.length;
  fs.writeFileSync(f, out);
}
console.log(fichiers.length, 'modèles :', (avant / 1048576).toFixed(1), 'Mo ->', (apres / 1048576).toFixed(1), 'Mo');
