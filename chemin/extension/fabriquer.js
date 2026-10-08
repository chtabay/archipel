// L’extension du chemin : la fabrication. Une extension doit contenir tous ses fichiers : on copie dans dist/ le chemin tel
// quel, ce qu’il emprunte à l’archipel, et les pièces de l’extension, en gardant l’arborescence (monde.js importe ../outils.js).
//   node chemin/extension/fabriquer.js            → dist/, pour Chrome et Edge
//   node chemin/extension/fabriquer.js --firefox  → dist-firefox/ : Firefox veut background.scripts, que Chrome ne supporte pas
//                                                   à côté d’un service worker en module
const fs = require('fs'), path = require('path');
const ICI = __dirname, RACINE = path.resolve(ICI, '../..'), DIST = path.join(ICI, 'dist'), DIST_FIREFOX = path.join(ICI, 'dist-firefox');
const copier = (de, a) => { fs.mkdirSync(path.dirname(a), { recursive: true }); fs.cpSync(de, a, { recursive: true }); };

function fabriquer({ firefox = false } = {}) {
  const DIST = firefox ? DIST_FIREFOX : module.exports.DIST;
  fs.rmSync(DIST, { recursive: true, force: true });
  for (const f of ['aquarelle.js', 'outils.js', 'contenu.js', 'fonts']) copier(path.join(RACINE, f), path.join(DIST, f)); // ce que le chemin emprunte à l’archipel
  for (const f of ['app.js', 'sens.js', 'monde.js', 'carnet.js', 'demo.js', 'style.css', 'catalogue.json', 'vendor', 'sens', 'objets']) copier(path.join(RACINE, 'chemin', f), path.join(DIST, 'chemin', f));
  // la page du chemin, avec ce que l’extension y ajoute ; sans sw.js : une page d’extension n’a pas de service worker à elle
  const html = fs.readFileSync(path.join(RACINE, 'chemin/index.html'), 'utf8').replace('</body>', '  <script type="module" src="onglet.js"></script>\n</body>');
  fs.writeFileSync(path.join(DIST, 'chemin/index.html'), html);
  copier(path.join(ICI, 'onglet.js'), path.join(DIST, 'chemin/onglet.js'));
  for (const f of ['fond.js', 'glaneur.js', 'accord.html', 'accord.css', 'accord.js']) copier(path.join(ICI, f), path.join(DIST, f));
  const manifeste = JSON.parse(fs.readFileSync(path.join(ICI, 'manifest.json'), 'utf8'));
  if (firefox) manifeste.background = { scripts: ['fond.js'], type: 'module' };
  fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifeste, null, 2) + '\n');
  for (const f of ['favicon-16.png', 'favicon-32.png', 'symbole-96.png', 'icone-192.png']) copier(path.join(RACINE, 'icones', f), path.join(DIST, 'icones', f));
  return DIST;
}
module.exports = { fabriquer, DIST };
if (require.main === module) { const firefox = process.argv.includes('--firefox'); console.log(`L’extension est fabriquée dans ${path.relative(process.cwd(), fabriquer({ firefox }))}`); }
