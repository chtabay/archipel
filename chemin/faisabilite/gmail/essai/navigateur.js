// Essai de la route C dans Chromium (Playwright), avec une archive inventée : node chemin/faisabilite/gmail/essai/navigateur.js
// Vérifie que la page lit l’archive par morceaux (File, DecompressionStream « deflate-raw »), et range ses glanes dans IndexedDB.
// Pour une archive de taille réelle : TAILLE=200 (en Mo de mails envoyés, inventés), pour mesurer le temps et la mémoire.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const RACINE = path.join(__dirname, '..'), TAILLE = Number(process.env.TAILLE || 3);

function servir() {
  const s = http.createServer((q, r) => {
    const f = path.join(RACINE, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end(); return; }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript' }).end(fs.readFileSync(f));
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok({ port: s.address().port, fermer: () => s.close() })));
}
// une boîte de mails envoyés, inventés : des journées de phrases banales, répétées jusqu’à la taille voulue
function boite(fichier, mo) {
  const phrases = ['On se retrouve au marché samedi matin, j’apporte les paniers.', 'La réunion est déplacée à jeudi, salle du fond, près des archives.',
    'Merci pour les photos de la plage, les enfants ont adoré les crabes.', 'Le train de 18 h 12 est annulé, je prendrai le bus jusqu’à la gare.'];
  const fd = fs.openSync(fichier, 'w'); let n = 0, ecrit = 0;
  while (ecrit < mo * 1048576) {
    const t = Date.UTC(2025, 0, 1) + n * 3600e3, corps = Buffer.from(`${phrases[n % 4]}\n\nLe lun. 5 janv. 2025 à 10:00, Quelqu’un <q@example.org> a écrit :\n> une citation\n`, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
    const b = Buffer.from(`From ${n}@xxx ${new Date(t).toUTCString()}\r\nX-GM-THRID: ${n}\r\nX-Gmail-Labels: Messages envoyés\r\nFrom: Camille <camille@example.com>\r\nDate: ${new Date(t).toUTCString()}\r\nSubject: Mail ${n}\r\nMessage-ID: <${n}@example.com>\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${corps}\r\n\r\n`, 'latin1');
    fs.writeSync(fd, b); ecrit += b.length; n++;
  }
  fs.closeSync(fd); return n;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chemin-gmail-nav-')), mbox = path.join(tmp, 'Messages envoyés.mbox'), zip = path.join(tmp, 'takeout.zip');
  const n = boite(mbox, TAILLE);
  execFileSync('python3', ['-I', '-c', `import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'w', compression=zipfile.ZIP_DEFLATED) as z: z.write(sys.argv[2], 'Takeout/Mail/Messages envoyés.mbox')`, zip, mbox]);
  const { port, fermer } = await servir(), navigateur = await chromium.launch(), page = await navigateur.newPage();
  let ok = true;
  try {
    await page.goto(`http://127.0.0.1:${port}/essai/page.html`);
    await page.setInputFiles('#archive', zip);
    await page.waitForFunction(() => window.resultat, null, { timeout: 600e3 });
    const r = await page.evaluate(() => ({ compte: window.resultat.compte, ms: window.resultat.ms, premier: window.resultat.glanes[0]?.texte, memoire: performance.memory?.usedJSHeapSize }));
    const ranges = await page.evaluate(() => new Promise(ok => { const q = indexedDB.open('chemin-essai-gmail'); q.onsuccess = () => { const c = q.result.transaction('glanes').objectStore('glanes').count(); c.onsuccess = () => ok(c.result); }; }));
    console.log(`  ${TAILLE} Mo de mbox (${(fs.statSync(zip).size / 1048576).toFixed(1)} Mo en zip), ${n} mails : ${r.compte.glanes} glanes en ${r.ms} ms, ${ranges} rangées ; tas JS ${Math.round((r.memoire || 0) / 1048576)} Mo`);
    console.log(`  première glane : « ${r.premier} »`);
    if (r.compte.glanes !== n || ranges !== n || r.premier !== 'On se retrouve au marché samedi matin, j’apporte les paniers.') { ok = false; console.log('  ÉCHEC'); } else console.log('  ok  la page lit l’archive par morceaux et range les glanes');
  } finally { await navigateur.close(); fermer(); fs.rmSync(tmp, { recursive: true, force: true }); process.exitCode = ok ? 0 : 1; }
})();
