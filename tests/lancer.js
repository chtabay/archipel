// L’archipel : lance toutes les suites de tests, l’une après l’autre, contre un serveur local du dépôt.
// npm test, ou : node tests/lancer.js [suite…]
const path = require('path'), { spawn } = require('child_process');
const { servir } = require('./commun');
const PORT = +(process.env.PORT || 0); // 0 : un port libre, au hasard
const SUITES = ['parcours', 'intro', 'retour', 'stabilite', 'archipel', 'routes', 'noms', 'pwa', 'musique', 'plus'];

const suite = (s, base) => new Promise(ok => spawn(process.execPath, [path.join(__dirname, `${s}.js`)], { stdio: 'inherit', env: { ...process.env, BASE: base } }).on('exit', ok)); // sans bloquer le serveur
(async () => {
  const { base, fermer } = await servir(PORT), choisies = process.argv.slice(2).length ? process.argv.slice(2) : SUITES, rates = [];
  for (const s of choisies) {
    console.log(`\n━━━ ${s} ━━━`);
    if (await suite(s, base) !== 0) rates.push(s);
  }
  console.log(rates.length ? `\nsuites en échec : ${rates.join(', ')}` : '\ntoutes les suites sont bonnes');
  fermer(); process.exitCode = rates.length ? 1 : 0;
})();
