// L’extension du chemin : la fabrication. Une extension doit contenir tous ses fichiers : on copie dans dist/ le chemin tel
// quel, ce qu’il emprunte à l’archipel, et les pièces de l’extension, en gardant l’arborescence (monde.js importe ../outils.js).
//   node chemin/extension/fabriquer.js   → dist/, pour Chrome, Edge et Firefox (Chrome ignore background.scripts, Firefox background.service_worker)
const fs = require('fs'), path = require('path');
const ICI = __dirname, RACINE = path.resolve(ICI, '../..'), DIST = path.join(ICI, 'dist');
const copier = (de, a) => { fs.mkdirSync(path.dirname(a), { recursive: true }); fs.cpSync(de, a, { recursive: true }); };

function fabriquer() {
  fs.rmSync(DIST, { recursive: true, force: true });
  for (const f of ['aquarelle.js', 'outils.js', 'contenu.js', 'fonts']) copier(path.join(RACINE, f), path.join(DIST, f)); // ce que le chemin emprunte à l’archipel
  for (const f of ['app.js', 'sens.js', 'monde.js', 'carnet.js', 'demo.js', 'style.css', 'catalogue.json', 'vendor', 'sens', 'objets']) copier(path.join(RACINE, 'chemin', f), path.join(DIST, 'chemin', f));
  copier(path.join(RACINE, 'vendor/LICENSE-three.txt'), path.join(DIST, 'vendor/LICENSE-three.txt')); // la licence de three.js, que chemin/vendor/LISEZMOI.txt cite
  // la page du chemin, avec ce que l’extension y ajoute ; sans sw.js : une page d’extension n’a pas de service worker à elle
  const html = fs.readFileSync(path.join(RACINE, 'chemin/index.html'), 'utf8').replace('</body>', '  <script type="module" src="onglet.js"></script>\n</body>').replace('href="extension/confidentialite.html"', 'href="../confidentialite.html"'); // dans le paquet, la politique est à la racine
  fs.writeFileSync(path.join(DIST, 'chemin/index.html'), html);
  copier(path.join(ICI, 'onglet.js'), path.join(DIST, 'chemin/onglet.js'));
  for (const f of ['manifest.json', 'fond.js', 'glaneur.js', 'accord.html', 'accord.css', 'accord.js']) copier(path.join(ICI, f), path.join(DIST, f));
  for (const f of ['favicon-16.png', 'favicon-32.png', 'symbole-96.png', 'icone-128.png', 'icone-192.png']) copier(path.join(RACINE, 'icones', f), path.join(DIST, 'icones', f));
  copier(path.join(ICI, 'confidentialite.html'), path.join(DIST, 'confidentialite.html')); // la politique, aussi dans le paquet
  return DIST;
}
module.exports = { fabriquer, DIST };
if (require.main === module) console.log(`L’extension est fabriquée dans ${path.relative(process.cwd(), fabriquer())}`);
