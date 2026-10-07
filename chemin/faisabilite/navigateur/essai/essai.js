// Essai du glaneur, dans Chromium, avec des données synthétiques seulement : node chemin/faisabilite/navigateur/essai/essai.js
// Sert les pages d’essai sur 127.0.0.1 et localhost (deux origines), charge une copie de l’extension où l’adresse du chemin
// devient celle de l’essai, dit oui à l’accord, écrit dans chaque zone, puis ouvre le faux chemin et regarde ce qui y arrive.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require('playwright');

const ICI = __dirname, PAGES = path.join(ICI, 'pages'), EXT = path.join(ICI, '..', 'extension');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };

function servir() {
  const s = http.createServer((q, r) => {
    let f = path.join(PAGES, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(PAGES)) { r.writeHead(403).end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { r.writeHead(404).end(); return; }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok({ port: s.address().port, fermer: () => s.close() })));
}

// les écrits de l’essai : ce qui doit arriver au chemin, et ce qui ne doit jamais y arriver
const GARDER = {
  journal: 'Ce matin j’ai longé le canal sous une pluie fine, les péniches dormaient.',
  riche: 'Ma sœur m’a appelé, on a ri longtemps de nos vacances au bord de la mer.',
  mail: 'Merci pour ton message, je passerai samedi avec le gâteau aux pommes.',
  ombreOuverte: 'Le jardin des voisins sent le tilleul ce soir, c’est doux.',
  ombreFermee: 'Une lettre pour grand-mère, avec des nouvelles du chat et du potager.',
  cadreMeme: 'Dans le train du retour, un enfant chantait doucement près de moi.',
  cadreAutre: 'Réunion déplacée, j’en profite pour marcher jusqu’au port.',
  cadreVide: 'Brouillon dans un cadre vide, comme les zones cachées des éditeurs à canevas.',
  chat: 'On se retrouve au marché vers dix heures avec les enfants ?',
  colleTape: 'Et voici mes propres mots, tapés à la main sur le clavier.',
  prerempli: 'J’ajoute ma phrase à moi pour que le chemin pousse.',
};
const JAMAIS = {
  mdp: 'motdepasse très secret avec plusieurs mots dedans',
  carte: 'quatre neuf sept zéro un deux trois quatre',
  iban: 'FR76 trois mille six mille zéro onze vingt',
  otp: 'un deux trois quatre cinq six',
  recherche: 'horaires des marées à Saint-Malo demain matin',
  combo: 'restaurant italien près de la gare du nord',
  pseudo: 'jean dupont le grand voyageur du dimanche',
  colle: 'Texte collé venu d’ailleurs, à ne pas glaner du tout.',
  cite: 'Texte cité de quelqu’un d’autre',
  dejaLa: 'Texte déjà là avant moi',
};

(async () => {
  const { port, fermer } = await servir(), base = `http://127.0.0.1:${port}`;
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'glaneur-')), ext = path.join(tmp, 'extension'), profil = path.join(tmp, 'profil');
  fs.cpSync(EXT, ext, { recursive: true });
  const CHEMIN = `${base}/archipel/chemin/`;
  const remplacer = (f, a, b) => { const p = path.join(ext, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split(a).join(b)); };
  for (const f of ['glaneur.js', 'fond.js']) remplacer(f, 'https://chtabay.github.io/archipel/chemin/', CHEMIN);
  remplacer('manifest.json', 'https://chtabay.github.io/archipel/chemin/*', 'http://127.0.0.1/archipel/chemin/*');
  remplacer('pont.js', 'const SONDE = false', 'const SONDE = true');

  const ctx = await chromium.launchPersistentContext(profil, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const requetes = []; ctx.on('request', r => requetes.push(r.url()));
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  const resultats = [], noter = (quoi, ok, detail = '') => { resultats.push({ quoi, ok, detail }); };

  try {
    // 1. L’accord : la page s’ouvre seule à l’installation ; rien n’est lu avant le oui
    const accord = ctx.pages().find(p => p.url().includes('accord.html')) || await ctx.waitForEvent('page', { predicate: p => p.url().includes('accord.html'), timeout: 5000 }).catch(() => null);
    noter('la page d’accord s’ouvre à l’installation', !!accord);
    const page = await ctx.newPage();
    await page.goto(`${base}/ecrire.html`);
    await page.locator('#journal').click(); await page.keyboard.type('Avant l’accord, ces mots ne doivent pas partir au chemin.'); await page.locator('body').click({ position: { x: 5, y: 5 } });
    const a = accord || await ctx.newPage(); if (!accord) await a.goto(`chrome-extension://${id}/accord.html`);
    await a.locator('#oui').click(); await a.waitForTimeout(200);
    noter('le oui est gardé', (await sw.evaluate(() => chrome.storage.local.get('actif'))).actif === true);

    // 2. Écrire partout
    await page.reload();
    const ecrire = async (loc, t) => { await loc.click(); await page.keyboard.type(t, { delay: 2 }); await page.locator('body').click({ position: { x: 5, y: 5 } }); };
    await ecrire(page.locator('#journal'), GARDER.journal);
    await ecrire(page.locator('#mdp'), JAMAIS.mdp);
    await ecrire(page.locator('#carte'), JAMAIS.carte);
    await ecrire(page.locator('#iban'), JAMAIS.iban);
    await ecrire(page.locator('#otp'), JAMAIS.otp);
    await ecrire(page.locator('#recherche'), JAMAIS.recherche);
    await ecrire(page.locator('#combo'), JAMAIS.combo);
    await ecrire(page.locator('#pseudo'), JAMAIS.pseudo);
    await ecrire(page.locator('#riche'), GARDER.riche);
    noter('l’éditeur riche n’émet aucun événement input (un glaneur naïf, à l’écoute de input, ne verrait rien)', (await page.evaluate(() => window.__inputs)) === 0, `input : ${await page.evaluate(() => window.__inputs)}`);
    await ecrire(page.locator('#mail-corps'), GARDER.mail);
    await ecrire(page.locator('#ombre-ouverte textarea'), GARDER.ombreOuverte);
    await page.evaluate(() => window.__fermee.querySelector('textarea').focus()); await page.keyboard.type(GARDER.ombreFermee, { delay: 2 }); await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.locator('#chat').click(); await page.keyboard.type(GARDER.chat, { delay: 2 }); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    noter('la page du fil a bien vidé la zone à l’envoi', (await page.locator('#chat').inputValue()) === '');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    // coller, puis taper : seul ce qui est tapé compte
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    await page.evaluate(t => navigator.clipboard.writeText(t), JAMAIS.colle);
    await page.locator('#colle').click(); await page.keyboard.press('Control+V'); await page.keyboard.type(` ${GARDER.colleTape}`, { delay: 2 });
    const colle = await page.locator('#colle').inputValue(); noter('le collage a bien eu lieu dans la page', colle.includes(JAMAIS.colle), colle.slice(0, 40));
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.locator('#prerempli').click(); await page.keyboard.press('End'); await page.keyboard.type(` ${GARDER.prerempli}`, { delay: 2 }); await page.locator('body').click({ position: { x: 5, y: 5 } });
    for (const [cadre, t] of [['#cadre-meme', GARDER.cadreMeme], ['#cadre-autre', GARDER.cadreAutre]]) {
      const z = page.frameLocator(cadre).locator('textarea'); await z.click(); await page.keyboard.type(t, { delay: 2 }); await page.locator('body').click({ position: { x: 5, y: 5 } });
    }
    await page.frameLocator('#cadre-vide').locator('body').click(); await page.keyboard.type(GARDER.cadreVide, { delay: 2 }); await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(400);

    // 3. Ce que le fond a gardé
    const glanes = (await sw.evaluate(() => chrome.storage.local.get('glanes'))).glanes || [], tout = glanes.map(g => g.texte).join('\n');
    noter('rien n’est glané avant l’accord', !tout.includes('Avant l’accord'));
    for (const [k, t] of Object.entries(GARDER)) noter(`glané : ${k}`, tout.includes(t));
    for (const [k, t] of Object.entries(JAMAIS)) noter(`jamais : ${k}`, !tout.includes(t));
    const badge = await sw.evaluate(() => chrome.action.getBadgeText({})); noter('le chiffre sur l’icône montre les glanes en attente', badge === String(glanes.length), `badge ${badge}, glanes ${glanes.length}`);

    // 4. Le pont : la page du chemin reçoit, range dans son propre IndexedDB, et le fond oublie
    const chemin = await ctx.newPage(); await chemin.goto(CHEMIN);
    await chemin.waitForFunction(() => window.__recus > 0, null, { timeout: 5000 }).catch(() => {});
    const recues = await chemin.evaluate(() => new Promise(ok => { const r = indexedDB.open('chemin-essai', 1); r.onsuccess = () => { const q = r.result.transaction('glanes').objectStore('glanes').getAll(); q.onsuccess = () => ok(q.result.map(g => g.texte)); }; r.onerror = () => ok([]); }));
    noter('la page du chemin a reçu toutes les glanes', recues.length === glanes.length && glanes.length > 0, `${recues.length} reçues sur ${glanes.length}`);
    await chemin.waitForTimeout(300);
    noter('le fond les a oubliées après accusé de réception', ((await sw.evaluate(() => chrome.storage.local.get('glanes'))).glanes || []).length === 0);
    const sonde = await chemin.evaluate(() => new Promise(ok => { const r = indexedDB.open('chemin-sonde'); r.onsuccess = () => { if (!r.result.objectStoreNames.contains('notes')) { ok(null); return; } const q = r.result.transaction('notes').objectStore('notes').get('pont'); q.onsuccess = () => ok(q.result || null); }; r.onerror = () => ok(null); }));
    noter('le script de contenu écrit dans l’IndexedDB de l’origine de la page (la page le relit)', sonde?.origine === new URL(base).origin, JSON.stringify(sonde));
    // une autre page de la même origine lit tout autant le carnet : le chemin partage son origine avec tout chtabay.github.io
    const voisine = await ctx.newPage(); await voisine.goto(`${base}/cadre.html`);
    const lu = await voisine.evaluate(() => new Promise(ok => { const r = indexedDB.open('chemin-essai'); r.onsuccess = () => { if (!r.result.objectStoreNames.contains('glanes')) { ok(0); return; } const q = r.result.transaction('glanes').objectStore('glanes').count(); q.onsuccess = () => ok(q.result); }; }));
    noter('une autre page de la même origine (hors du dossier du chemin) lit aussi les glanes', lu === recues.length, `${lu} lues`);

    // 5. Réseau : seulement les pages d’essai
    const ailleurs = requetes.filter(u => !/^(https?:\/\/(127\.0\.0\.1|localhost):\d+\/|chrome-extension:|data:|about:)/.test(u));
    noter('aucune requête hors des pages d’essai', ailleurs.length === 0, ailleurs.slice(0, 3).join(' '));
    console.log('\nGlanes gardées :'); for (const g of glanes) console.log(`  [${g.site}] ${g.texte.replace(/\n/g, ' / ')}`);
  } catch (e) { noter('essai interrompu', false, e.message); }

  console.log('\nRésultats :'); for (const r of resultats) console.log(`  ${r.ok ? 'ok   ' : 'RATÉ '} ${r.quoi}${r.detail ? `  (${r.detail})` : ''}`);
  await ctx.close(); fermer(); fs.rmSync(tmp, { recursive: true, force: true });
  process.exitCode = resultats.every(r => r.ok) ? 0 : 1;
})();
