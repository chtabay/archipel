// Le chemin : fabrique chemin/vendor/three-chemin.min.js, three.js 0.186.1 réduit aux pièces que le chemin utilise, avec
// GLTFLoader et le décodeur meshopt (celui que three.js livre, meshoptimizer 1.1), assemblé et minifié par esbuild 0.28.2.
// Le résultat est reproductible : mêmes versions (épinglées dans chemin/outils/three/package-lock.json), même entrée, mêmes
// octets ; le sha256 s’affiche à la fin, et se compare au fichier déjà là.
//
//   cd chemin/outils/three && npm ci && cd ../../..     installe three@0.186.1 et esbuild@0.28.2, rien d’autre
//   node chemin/outils/fabriquer-three.mjs              écrit chemin/vendor/three-chemin.min.js
//   node chemin/outils/fabriquer-three.mjs --verifier   n’écrit rien : compare au fichier présent, code de sortie 1 s’il diffère
//
// L’équivalent en ligne de commande, depuis chemin/outils/three, l’entrée ci-dessous (NOMS + les deux addons) écrite dans entree.js :
//   npx esbuild entree.js --bundle --minify --format=esm --target=es2022 --legal-comments=none --outfile=../../vendor/three-chemin.min.js
// (--legal-comments=none : le bandeau @license de three.js n’est pas repris dans le fichier ; la licence MIT est dans
// vendor/LICENSE-three.txt. La cible es2022 ne change rien à la sortie : c’est celle d’esnext pour ce code.)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PAQUET = path.join(ICI, 'three'); // package.json + package-lock.json : three et esbuild, épinglés
const SORTIE = path.join(ICI, '..', 'vendor', 'three-chemin.min.js');
const VERSIONS = { three: '0.186.1', esbuild: '0.28.2' }; // d’autres versions donneraient d’autres octets

// Ce que le paquet exporte de three : ce que chemin/monde.js nomme (THREE.Mesh, THREE.Color…), et quelques pièces de plus,
// gardées pour que le fichier reste celui qui a été publié. Ordre sans effet : esbuild trie les exports.
const NOMS = ['ACESFilmicToneMapping', 'AmbientLight', 'Box3', 'BoxGeometry', 'BufferAttribute', 'BufferGeometry', 'Cache',
  'CanvasTexture', 'CircleGeometry', 'Color', 'ConeGeometry', 'CylinderGeometry', 'DirectionalLight', 'DoubleSide', 'Euler',
  'Float32BufferAttribute', 'Fog', 'FrontSide', 'Group', 'HemisphereLight', 'InstancedMesh', 'LinearFilter', 'LinearSRGBColorSpace',
  'LoadingManager', 'MathUtils', 'Matrix4', 'Mesh', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshStandardMaterial',
  'NearestFilter', 'NoToneMapping', 'Object3D', 'OrthographicCamera', 'PCFShadowMap', 'PCFSoftShadowMap', 'PerspectiveCamera',
  'PlaneGeometry', 'Quaternion', 'SRGBColorSpace', 'Scene', 'SphereGeometry', 'Texture', 'Vector2', 'Vector3', 'Vector4', 'WebGLRenderer'];
const ENTREE = `export { ${NOMS.join(', ')} } from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
`;

const sha256 = octets => crypto.createHash('sha256').update(octets).digest('hex');
const verifier = process.argv.includes('--verifier');

// les outils, depuis chemin/outils/three seulement : pas ceux d’un autre dossier
const require = createRequire(path.join(PAQUET, 'package.json'));
let esbuild, three;
try { esbuild = require('esbuild'); three = JSON.parse(fs.readFileSync(path.join(PAQUET, 'node_modules', 'three', 'package.json'), 'utf8')); } // three n’exporte pas son package.json
catch (e) { console.error(`three et esbuild manquent (${e.code || e.message}) : d’abord « cd ${path.relative(process.cwd(), PAQUET)} && npm ci ».`); process.exit(2); }
for (const [nom, voulue] of [['three', three.version], ['esbuild', esbuild.version]]) {
  if (voulue !== VERSIONS[nom]) { console.error(`${nom} ${voulue} au lieu de ${VERSIONS[nom]} : la sortie ne serait pas la même. npm ci dans ${path.relative(process.cwd(), PAQUET)}.`); process.exit(2); }
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'three-chemin-'));
let octets;
try {
  const entree = path.join(temp, 'entree.js');
  fs.writeFileSync(entree, ENTREE);
  const r = await esbuild.build({
    entryPoints: [entree], bundle: true, minify: true, format: 'esm', target: 'es2022', legalComments: 'none',
    nodePaths: [path.join(PAQUET, 'node_modules')], // l’entrée est hors du paquet : où trouver three
    write: false, logLevel: 'warning',
  });
  octets = Buffer.from(r.outputFiles[0].contents);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

const empreinte = sha256(octets), avant = fs.existsSync(SORTIE) ? sha256(fs.readFileSync(SORTIE)) : null;
console.log(`three ${three.version}, esbuild ${esbuild.version} : ${octets.length} octets, sha256 ${empreinte}`);
if (avant === empreinte) console.log(`identique à ${path.relative(process.cwd(), SORTIE)}, rien à réécrire`);
else console.log(avant ? `différent de ${path.relative(process.cwd(), SORTIE)} (sha256 ${avant})` : `${path.relative(process.cwd(), SORTIE)} n’existait pas`);
if (verifier) process.exit(avant === empreinte ? 0 : 1);
if (avant !== empreinte) { fs.writeFileSync(SORTIE, octets); console.log(`écrit : ${path.relative(process.cwd(), SORTIE)}`); }
