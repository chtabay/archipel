// L’archipel : lance toutes les suites de tests, l’une après l’autre, contre un serveur local du dépôt.
// npm test, ou : node tests/lancer.js [suite…]
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const RACINE = path.join(__dirname, '..'), PORT = +(process.env.PORT || 0); // 0 : un port libre, au hasard
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const SUITES = ['parcours', 'intro', 'retour', 'stabilite'];

const serveur = http.createServer((req, res) => { // comme GitHub Pages : les fichiers tels quels, et 404.html sinon
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(RACINE, path.normalize(p));
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': TYPES['.html'] }); res.end(fs.readFileSync(path.join(RACINE, '404.html'))); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const suite = (s, port) => new Promise(ok => spawn(process.execPath, [path.join(__dirname, `${s}.js`)], { stdio: 'inherit', env: { ...process.env, BASE: `http://127.0.0.1:${port}/` } }).on('exit', ok)); // sans bloquer le serveur
serveur.listen(PORT, '127.0.0.1', async () => {
  const port = serveur.address().port, choisies = process.argv.slice(2).length ? process.argv.slice(2) : SUITES, rates = [];
  for (const s of choisies) {
    console.log(`\n━━━ ${s} ━━━`);
    if (await suite(s, port) !== 0) rates.push(s);
  }
  console.log(rates.length ? `\nsuites en échec : ${rates.join(', ')}` : '\ntoutes les suites sont bonnes');
  serveur.close(); process.exitCode = rates.length ? 1 : 0;
});
