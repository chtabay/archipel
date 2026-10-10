// Les captures des fiches de boutique, en 1280 × 800, avec des écrits INVENTÉS : le chemin et ses écrits glanés, l’accord,
// l’encart au coin d’un moteur de recherche d’essai (sans marque à l’écran). Dans Chromium, l’extension chargée depuis dist/.
//   node chemin/extension/boutique/captures.js            → écrit 1-chemin.png, 2-accord.png, 3-encart.png ici
// La peinture des tuiles, sans carte graphique, prend quelques minutes.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const RACINE = path.resolve(__dirname, '../../..');
const { GL, servir } = require(path.join(RACINE, 'tests/commun'));
const { fabriquer } = require(path.join(RACINE, 'chemin/extension/fabriquer'));
const OUT = process.argv[2] || __dirname;
const ECRITS = [
  ['#journal', 'Ce matin, j’ai longé la rivière sous les grands arbres ; l’eau glissait entre les pierres couvertes de mousse. Puis le chemin montait vers un moulin, et des moutons paissaient derrière une clôture.'],
  ['#corps', 'Merci pour ton message. Je passerai dimanche avec des fleurs du jardin et un gâteau aux pommes, on mangera sur la terrasse si le soleil est là.'],
  ['#riche', 'Le soir tombait sur le village, une lanterne brûlait près du vieux puits de pierre et le boulanger fermait sa boutique.'],
  ['#journal', 'Un héron s’est posé sur la barque, au bord de l’étang, sous la pluie fine, pendant que les enfants cherchaient des champignons.'],
];
const attendre = async (t, d = 15000) => { const fin = Date.now() + d; while (!(await t()) && Date.now() < fin) await new Promise(r => setTimeout(r, 150)); return t(); };
// le moteur d’essai (moteur.html, à côté de ce script), servi sur « localhost » : l’encart s’y montre, comme sur un moteur choisi
const servirPages = () => new Promise(ok => {
  const s = http.createServer((q, r) => {
    const f = path.join(__dirname, path.normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)));
    if (!f.startsWith(__dirname) || !f.endsWith('.html') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end(); return; }
    r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fs.readFileSync(f));
  });
  s.listen(0, '0.0.0.0', () => ok({ port: s.address().port, fermer: () => s.close() }));
});

(async () => {
  const DIST = fabriquer(), repo = await servir(), moteur = await servirPages(), profil = fs.mkdtempSync(path.join(os.tmpdir(), 'chemin-boutique-'));
  const ctx = await chromium.launchPersistentContext(profil, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, ...GL], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    await attendre(() => sw.evaluate(() => typeof chrome?.scripting?.getRegisteredContentScripts === 'function').catch(() => false));
    const ID = new URL(sw.url()).host;
    // l’accord, tel qu’il s’ouvre à l’installation
    const accord = await ctx.newPage(); await accord.goto(`chrome-extension://${ID}/accord.html`); await accord.waitForTimeout(300);
    await accord.screenshot({ path: path.join(OUT, '2-accord.png') }); await accord.close();
    // le oui, puis quatre écrits dans les pages d’essai
    await sw.evaluate(() => chrome.storage.local.set({ accord: true, pause: false, exclus: ['chtabay.github.io'], recherches: ['localhost'], encart: ['localhost'] }));
    await attendre(() => sw.evaluate(() => chrome.scripting.getRegisteredContentScripts({ ids: ['glaneur'] }).then(l => l.length > 0)));
    const p = await ctx.newPage(); await p.goto(`${repo.base}tests/extension/page.html`); await p.waitForTimeout(300);
    for (const [sel, t] of ECRITS) { await p.locator(sel).click(); await p.keyboard.type(t, { delay: 1 }); await p.locator('#ailleurs').click(); await p.waitForTimeout(300); }
    await p.close();
    // le chemin, d’un clic sur l’icône : sa frise peinte, et sous elle, la page du jour
    const chemin = await ctx.newPage(); await chemin.goto(`chrome-extension://${ID}/chemin/index.html`);
    await chemin.waitForFunction(() => window.chemin?.passages?.length > 1, null, { timeout: 90000 });
    await attendre(() => chemin.evaluate(() => document.querySelectorAll('.tuile.peinte').length >= Math.min(3, window.chemin.plans.length)), 300000);
    await chemin.waitForTimeout(500);
    await chemin.screenshot({ path: path.join(OUT, '1-chemin.png') });
    // l’encart, au coin du moteur d’essai, pendant qu’on tape une recherche anodine
    const m = await ctx.newPage(); await m.goto(`http://localhost:${moteur.port}/moteur.html`);
    const f = await attendre(() => m.frames().find(x => x.url().includes('chemin/index.html?encart')) || null, 10000);
    if (f) await attendre(() => f.evaluate(() => document.querySelectorAll('.tuile.peinte').length >= Math.min(2, window.chemin?.plans?.length || 99)).catch(() => false), 120000);
    await m.locator('textarea[name=q]').click(); await m.keyboard.type('où voir des grues cendrées en automne', { delay: 20 }); await m.waitForTimeout(400);
    await m.screenshot({ path: path.join(OUT, '3-encart.png') });
    console.log(`captures écrites dans ${path.relative(process.cwd(), OUT) || '.'} : tuiles peintes ${await chemin.evaluate(() => document.querySelectorAll('.tuile.peinte').length)} sur ${await chemin.evaluate(() => window.chemin.plans.length)}`);
  } finally {
    await ctx.close(); repo.fermer(); moteur.fermer(); fs.rmSync(profil, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
