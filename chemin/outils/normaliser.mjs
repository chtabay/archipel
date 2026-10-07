// Le chemin : mettre une collection au format du catalogue. Chaque modèle devient un .glb ; ses images restent à part, une
// seule fois par collection, dans Textures/, comme chez Kenney. Le .glb n’est pas encore allégé : voir alleger.mjs.
// node chemin/outils/normaliser.mjs [--sol] [--teinte <motif>=<couleur>]… <collection> <dossier de sortie> <fichier.gltf|.glb>…
// --sol : ôte ce qui est sous le sol, comme le socle de terre de certains bâtiments ; --teinte : une couleur pour les modèles
// dont le nom répond au motif, et qui n’en ont pas : un chameau gris devient sable
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive } from '@gltf-transform/functions';
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const args = process.argv.slice(2), teintes = [];
let sol = false;
while (args[0]?.startsWith('--')) { const o = args.shift(); if (o === '--sol') sol = true; else if (o === '--teinte') { const [m, c] = args.shift().split('='); teintes.push([new RegExp(m), c]); } }
const [kit, sortie, ...fichiers] = args;
const rgb = c => { const n = parseInt(c.replace('#', ''), 16), l = x => ((x / 255) <= .04045 ? (x / 255) / 12.92 : (((x / 255) + .055) / 1.055) ** 2.4); return [l(n >> 16), l((n >> 8) & 255), l(n & 255), 1]; };
const dest = path.join(sortie, kit), tex = path.join(dest, 'Textures');
fs.mkdirSync(tex, { recursive: true });
const pad = (b, c) => { const n = Math.ceil(b.length / 4) * 4, o = Buffer.alloc(n, c); b.copy(o); return o; };
function glb(json, bin) {
  const j = pad(Buffer.from(JSON.stringify(json)), 0x20), b = pad(Buffer.from(bin || new Uint8Array(0)), 0), h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(j.length, 0); cj.writeUInt32LE(0x4E4F534A, 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(b.length, 0); cb.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([h, cj, j, cb, b]);
}
let n = 0;
const vues = new Map(fs.readdirSync(tex).map(f => [crypto.createHash('sha1').update(fs.readFileSync(path.join(tex, f))).digest('hex'), f])); // les images déjà rangées
for (const f of fichiers) {
  const doc = await io.read(f), nom = path.basename(f).replace(/\.gl(b|tf)$/i, '').replace(/[^\w-]+/g, '_');
  for (const t of doc.getRoot().listTextures()) { // chaque image, rangée une fois dans Textures/ ; le modèle y renvoie
    const image = Buffer.from(t.getImage()), ext = t.getMimeType() === 'image/jpeg' ? '.jpg' : '.png';
    let fichier = (path.basename(t.getURI() || '') || `${t.getName() || nom}${ext}`).replace(/[^\w.-]+/g, '_');
    if (!path.extname(fichier)) fichier += ext;
    const empreinte = crypto.createHash('sha1').update(image).digest('hex');
    if (vues.has(empreinte)) fichier = vues.get(empreinte); // la même image, sous un autre nom : une seule fois
    else {
      if (fs.existsSync(path.join(tex, fichier))) fichier = fichier.replace(/(\.\w+)$/, `-${empreinte.slice(0, 8)}$1`); // même nom, autre image
      fs.writeFileSync(path.join(tex, fichier), image); vues.set(empreinte, fichier);
    }
    t.setURI(`Textures/${fichier}`);
  }
  for (const [m, c] of teintes) if (m.test(nom)) for (const mat of doc.getRoot().listMaterials()) if (!mat.getBaseColorTexture()) mat.setBaseColorFactor(rgb(c));
  if (sol) for (const nd of doc.getRoot().listNodes()) { // les triangles tout entiers sous le sol s’en vont
    const m = nd.getMesh(); if (!m) continue;
    const W = nd.getWorldMatrix(), y = v => W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13];
    for (const pr of m.listPrimitives()) {
      const pos = pr.getAttribute('POSITION'), idx = pr.getIndices(), n = idx ? idx.getCount() : pos.getCount(), garde = [], v = [];
      for (let i = 0; i < n; i += 3) {
        const t = [0, 1, 2].map(k => (idx ? idx.getScalar(i + k) : i + k));
        if (Math.max(...t.map(k => y(pos.getElement(k, v)))) > .05) garde.push(...t);
      }
      const acc = doc.createAccessor().setType('SCALAR').setArray(pos.getCount() > 65535 ? new Uint32Array(garde) : new Uint16Array(garde)).setBuffer(doc.getRoot().listBuffers()[0]);
      pr.setIndices(acc); compactPrimitive(pr); // et les sommets qui ne servent plus
    }
  }
  doc.getRoot().listBuffers().slice(1).forEach(b => { for (const a of doc.getRoot().listAccessors()) if (a.getBuffer() === b) a.setBuffer(doc.getRoot().listBuffers()[0]); b.dispose(); }); // un seul tampon
  const { json, resources } = await io.writeJSON(doc);
  const bufs = json.buffers || [], bin = bufs[0] ? resources[bufs[0].uri] : null; if (bufs[0]) delete bufs[0].uri;
  for (const im of json.images || []) delete im.bufferView; // les images restent dehors
  fs.writeFileSync(path.join(dest, `${nom}.glb`), glb(json, bin)); n++;
}
console.log(kit, ':', n, 'modèles,', fs.readdirSync(tex).length, 'images');
