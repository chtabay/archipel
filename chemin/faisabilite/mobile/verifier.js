// Essai de faisabilité : ce que l’hébergeur voit passer quand un texte arrive au chemin depuis ailleurs sur le téléphone.
// Un serveur local, comme GitHub Pages, note chaque requête et son corps ; on cherche le texte dedans.
//   node chemin/faisabilite/mobile/verifier.js
// Textes de test inventés. Ne touche ni au vrai chemin ni à ses données : chaque essai a son propre navigateur, vide.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), http = require('http');

const RACINE = path.join(__dirname, '..', '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const vu = []; // tout ce que le serveur a reçu : ligne de requête et corps
function servir() {
  const s = http.createServer((req, res) => {
    let corps = ''; req.on('data', d => { corps += d; });
    req.on('end', () => {
      vu.push(`${req.method} ${req.url} ${corps}`);
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(RACINE, path.normalize(p));
      if (req.method !== 'GET' || !f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(req.method === 'GET' ? 404 : 405); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    });
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok({ base: `http://127.0.0.1:${s.address().port}/`, fermer: () => { s.closeAllConnections(); s.close(); } })));
}
let echecs = 0;
const verifier = (ok, quoi) => { console.log(`${ok ? 'ok  ' : 'ÉCHEC'} · ${quoi}`); if (!ok) echecs++; };
const entendu = secret => vu.some(l => l.includes(secret) || l.includes(encodeURIComponent(secret)) || l.includes(secret.replace(/ /g, '+')));
const attendre = async (test, delai = 10000) => { const fin = Date.now() + delai; while (Date.now() < fin) { if (await test().catch(() => false)) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const textes = p => p.$$eval('#liste li', l => l.map(li => li.firstChild.textContent));
const partager = (p, texte) => p.evaluate(t => { const f = document.createElement('form'); f.method = 'POST'; f.action = 'recevoir'; f.enctype = 'application/x-www-form-urlencoded';
  const i = document.createElement('input'); i.name = 'texte'; i.value = t; f.append(i); document.body.append(f); f.submit(); }, texte); // ce que fait Chrome pour un share_target en POST

(async () => {
  const { base, fermer } = await servir(), ESSAI = `${base}chemin/faisabilite/mobile/`;
  const navigateur = await chromium.launch();
  try {
    // 1. Le texte après « # » : un raccourci iOS ou une app native ouvrent cette adresse ; le serveur n’en reçoit rien
    let ctx = await navigateur.newContext(), p = await ctx.newPage();
    const S1 = 'Café avec Inès, la pluie sur le marché';
    await p.goto(`${ESSAI}#texte=${encodeURIComponent(S1)}`);
    verifier(await attendre(async () => (await textes(p)).includes(S1)), 'adresse avec « # » : le texte est en attente dans le chemin');
    verifier(!entendu(S1), 'adresse avec « # » : le serveur ne l’a jamais reçu');
    verifier(!p.url().includes('#'), 'adresse avec « # » : le texte a quitté la barre d’adresse et l’historique');

    // 2. Partager, avec le service worker actif : le POST est lu sur le téléphone
    await attendre(() => p.evaluate(async () => !!(await navigator.serviceWorker.ready).active));
    if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) await p.reload();
    verifier(await p.evaluate(() => !!navigator.serviceWorker.controller), 'le service worker de l’essai tient la page');
    const S2 = 'Réunion trop longue, envie de mer';
    await Promise.all([p.waitForURL(u => !u.href.includes('recevoir'), { timeout: 10000 }), partager(p, S2)]);
    verifier(await attendre(async () => (await textes(p)).includes(S2)), 'partage avec service worker : le texte est en attente dans le chemin');
    verifier(!entendu(S2), 'partage avec service worker : le serveur ne l’a jamais reçu');
    verifier(!p.url().includes(encodeURIComponent(S2).slice(0, 12)), 'partage avec service worker : rien du texte dans l’adresse');
    await ctx.close();

    // 3. Partager sans service worker actif (premier lancement, données effacées) : le POST part chez l’hébergeur
    ctx = await navigateur.newContext({ serviceWorkers: 'block' }); p = await ctx.newPage();
    await p.goto(ESSAI);
    const S3 = 'Texte qui fuit sans service worker';
    await Promise.all([p.waitForLoadState('load'), partager(p, S3)]).catch(() => {});
    await attendre(async () => entendu(S3), 3000);
    verifier(entendu(S3), 'limite connue : sans service worker actif, le serveur reçoit le texte partagé');
    await ctx.close();

    // 4. Le service worker actuel du chemin, devant une adresse avec « ? » : la page va au réseau d’abord, avec ce qui suit « ? »
    ctx = await navigateur.newContext(); p = await ctx.newPage();
    await p.goto(`${base}404.html`);
    await p.evaluate(() => navigator.serviceWorker.register('/chemin/sw.js', { scope: '/chemin/' }));
    verifier(await attendre(() => p.evaluate(async () => (await navigator.serviceWorker.getRegistration('/chemin/'))?.active?.state === 'activated')), 'le service worker actuel du chemin est actif');
    const S4 = 'Texte partagé en GET', S5 = 'Texte derrière le dièse';
    await p.goto(`${base}chemin/?texte=${encodeURIComponent(S4)}`, { waitUntil: 'commit' });
    await attendre(async () => entendu(S4), 4000);
    verifier(entendu(S4), 'chemin actuel : un share_target en GET ferait passer le texte chez l’hébergeur (journaux)');
    await p.goto(`${base}chemin/#texte=${encodeURIComponent(S5)}`, { waitUntil: 'commit' });
    await new Promise(r => setTimeout(r, 1500));
    verifier(!entendu(S5), 'chemin actuel : un texte après « # » ne part pas');
    await ctx.close();
  } finally { await navigateur.close(); fermer(); }
  console.log(echecs ? `\n${echecs} échec(s)` : '\ntout est conforme à ce qui est attendu');
  process.exitCode = echecs ? 1 : 0;
})();
