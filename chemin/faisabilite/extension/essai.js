// Essai du glaneur, de bout en bout, dans Chromium, avec des données SYNTHÉTIQUES seulement.
//   node chemin/faisabilite/extension/essai.js
// (ou, si l’extension ne se charge pas en headless : GLANEUR_HEADED=1 xvfb-run -a node chemin/faisabilite/extension/essai.js)
//
// Ce qu’il prouve, sur cette machine :
//   1. l’extension (Manifest V3) se charge dans Chromium ;
//   2. son script de contenu glane ce qu’on tape soi-même (journal, éditeur riche « à la Gmail » + bouton Envoyer), et jamais
//      les mots de passe, les cartes, les cryptogrammes ni les recherches ;
//   3. le pont, au chargement de la VRAIE page du chemin (servie depuis le dépôt), pose les glanes du jour dans l’IndexedDB
//      « chemin » de l’origine de la page, AVANT que chemin/app.js lise les pages, via une coupe « * * * » ;
//   4. l’app lit ces textes : window.chemin.passages contient les mots tapés, et window.chemin.plans en tire un lieu et des
//      objets — qu’on affiche ;
//   5. le mot de passe et la carte ne sont NULLE PART (ni chrome.storage, ni IndexedDB) ;
//   6. aucune requête n’est partie ailleurs que vers 127.0.0.1.
//
// Topologie, fidèle à la production : on tape sur un AUTRE site (un petit serveur à part) que celui du chemin. Les glanes
// passent par le stockage de l’extension, pas par l’origine. On n’attend PAS la peinture (lente sans carte graphique) :
// window.chemin paraît de lui-même au bout de ~15 s (l’intro a une limite), et passages/plans sont déjà calculés avant.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const { GL, servir } = require('../../../tests/commun');

const EXT = __dirname; // le dossier de l’extension, chargé tel quel (aucune réécriture : le manifeste vise déjà 127.0.0.1/chemin/*)
const PAGE = path.join(__dirname, 'essai'); // la page où l’on tape, servie à part

// un petit serveur statique pour la page d’essai, sur sa propre origine 127.0.0.1:autre-port
function servirPage() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };
  const s = http.createServer((q, r) => {
    let f = path.join(PAGE, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(PAGE)) { r.writeHead(403).end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'page.html');
    if (!fs.existsSync(f)) { r.writeHead(404).end(); return; }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok({ base: `http://127.0.0.1:${s.address().port}/`, fermer: () => s.close() })));
}

// les écrits de l’essai : ce qui DOIT arriver au chemin, et ce qui ne doit JAMAIS y arriver
const GARDER = {
  journal: 'Ce matin, j’ai longé la rivière sous les grands arbres ; l’eau glissait entre les pierres couvertes de mousse.',
  compose: 'Merci pour ton message. Je passerai dimanche avec des fleurs du jardin et un gâteau aux pommes.',
  riche: 'Le soir tombait sur le village, une lanterne brûlait près du vieux puits de pierre.',
  chat: 'On se retrouve demain au marché avec les enfants vers dix heures.',
};
const JAMAIS = {
  mdp: 'corbeau tunnel violette orage saumon',          // dans un champ password : jamais
  carte: 'quatre mille cinq cent trente neuf azur comète', // dans un champ autocomplete=cc-number : jamais
  cvv: 'cryptogramme marmotte lanterne',                 // champ nommé cvv : jamais
  recherche: 'horaires des marées à Saint-Malo demain',  // une recherche : jamais
};

(async () => {
  const headed = process.env.GLANEUR_HEADED === '1';
  const repo = await servir();            // le dépôt (donc le vrai chemin) sur 127.0.0.1:port
  const pageSrv = await servirPage();      // la page où l’on tape, sur une autre origine 127.0.0.1:port
  const CHEMIN = repo.base + 'chemin/';
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'glaneur-spike-'));

  const resultats = [], noter = (quoi, ok, detail = '') => { resultats.push({ quoi, ok: !!ok, detail }); console.log(`  ${ok ? 'ok   ' : 'RATÉ '} ${quoi}${detail ? `  (${detail})` : ''}`); };
  const infos = [];

  const ctx = await chromium.launchPersistentContext(profil, {
    channel: 'chromium', headless: !headed,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, ...GL],
    viewport: { width: 420, height: 900 },
  });
  const dehors = [];
  const LOCAL = /^http:\/\/127\.0\.0\.1(:\d+)?\//, INTERNE = /^(chrome-extension:|chrome:|devtools:|data:|blob:|about:)/;
  ctx.on('request', r => { const u = r.url(); if (!LOCAL.test(u) && !INTERNE.test(u)) dehors.push(u); });

  try {
    // le service worker de l’extension (la preuve qu’elle s’est bien chargée)
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
    noter('l’extension Manifest V3 se charge (son service worker tourne)', !!sw);
    if (!sw) throw new Error(`pas de service worker : l’extension ne s’est pas chargée${headed ? '' : ' en headless — réessayer avec GLANEUR_HEADED=1 sous xvfb-run'}`);
    const storage = () => sw.evaluate(() => chrome.storage.local.get(['jours', 'injecte']));

    // 1. taper sur un site ordinaire (autre origine que le chemin)
    const page = await ctx.newPage();
    await page.goto(pageSrv.base);
    await page.waitForTimeout(300); // le script de contenu lit ses réglages
    const taper = async (sel, t) => { await page.locator(sel).click(); await page.keyboard.type(t, { delay: 2 }); };

    await taper('#journal', GARDER.journal); await page.locator('#ailleurs').click(); // perte du focus = pose
    await taper('#recherche', JAMAIS.recherche); await page.keyboard.press('Enter'); await page.locator('#ailleurs').click();
    await taper('#login', 'jean le voyageur du dimanche'); await page.locator('#ailleurs').click(); // formulaire de connexion → jamais
    await taper('#mdp', JAMAIS.mdp); await page.locator('#ailleurs').click();
    await taper('#carte', JAMAIS.carte); await page.locator('#ailleurs').click();
    await taper('#cvv', JAMAIS.cvv); await page.locator('#ailleurs').click();
    // l’éditeur riche « à la Gmail » : pas d’événement input, et on clique sur Envoyer
    await taper('#corps', GARDER.compose);
    noter('l’éditeur riche n’émet aucun événement input (un glaneur naïf ne verrait rien)', (await page.evaluate(() => window.__inputs)) === 0, `input : ${await page.evaluate(() => window.__inputs)}`);
    await page.locator('#envoyer').click();
    // un autre éditeur riche, puis un fil où Entrée envoie et vide la zone
    await taper('#riche', GARDER.riche); await page.locator('#ailleurs').click();
    await taper('#chat', GARDER.chat); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    noter('le fil a bien vidé la zone à l’envoi', (await page.locator('#chat').inputValue()) === '');
    await page.locator('#ailleurs').click();
    await page.waitForTimeout(400);

    // 2. ce que le fond a gardé
    const { jours = {} } = await storage();
    const jourLocal = await page.evaluate(() => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; });
    const gardés = Object.values(jours[jourLocal] || {}).map(g => g.texte);
    const stockJSON = JSON.stringify(jours);
    for (const [k, t] of Object.entries(GARDER)) noter(`glané : ${k}`, gardés.some(x => x.includes(t.slice(0, 24))), '');
    for (const [k, t] of Object.entries(JAMAIS)) noter(`jamais dans chrome.storage : ${k}`, !stockJSON.includes(t), '');
    console.log('\n  Glanes gardées :'); for (const g of Object.values(jours[jourLocal] || {})) console.log(`    [${g.source}] ${g.texte.replace(/\n/g, ' / ')}`);

    // 3. ouvrir la VRAIE page du chemin : le pont pose les glanes du jour dans l’IndexedDB avant que l’app lise
    const chemin = await ctx.newPage();
    const erreurs = []; chemin.on('pageerror', e => erreurs.push(String(e))); chemin.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
    await chemin.goto(CHEMIN);
    // window.chemin paraît quand l’intro se retire (≤ ~15 s) ; passages/plans sont déjà calculés
    await chemin.waitForFunction(() => window.chemin && window.chemin.passages && window.chemin.passages.length > 1, null, { timeout: 60000 });
    // le pont écrit dans le monde isolé du script de contenu ; on le vérifie par son effet : la page du jour, dans le carnet
    // (le MÊME IndexedDB), existe, porte une coupe « * * * » et un mot glané, et a été lue par l’app avant d’être affichée
    const pageDuJour = await chemin.evaluate(async d => { const ps = await window.chemin.carnet.lirePages(); return (ps.find(x => x.date === d) || {}).texte || null; }, jourLocal);
    noter('le pont a posé les glanes du jour dans le carnet du chemin (coupe « * * * »)', !!pageDuJour && pageDuJour.includes('* * *') && pageDuJour.includes('rivière'), pageDuJour ? `${(pageDuJour.match(/\* \* \*/g) || []).length} séparateur(s)` : 'pas de page du jour');
    const vu = await chemin.evaluate(dateDuJour => {
      const C = window.chemin;
      const duJour = C.plans.filter(p => !p.passage.depart && p.passage.date === dateDuJour);
      const passagesTexte = C.passages.map(x => x.texte).join('\n');
      return {
        nPassages: C.passages.length,
        texteContient: passagesTexte,
        plans: duJour.map(p => ({ lieu: p.lieu, objets: [...new Set(p.objets.map(o => o.mot))], apercu: p.passage.texte.slice(0, 48) })),
      };
    }, jourLocal);

    const contient = s => vu.texteContient.includes(s);
    noter('les passages du chemin contiennent le journal tapé (« rivière… »)', contient('rivière') && contient('mousse'));
    noter('les passages du chemin contiennent le message « à la Gmail » (« gâteau… »)', contient('gâteau') && contient('fleurs'));
    noter('les passages du chemin contiennent l’éditeur riche et le fil', contient('lanterne') && contient('marché'));
    console.log('\n  Ce que le chemin a fait pousser (lieu · objets) :');
    for (const p of vu.plans) { const l = { interieur: 'à la maison', village: 'au village', foret: 'en forêt', champs: 'dans les champs', rivage: 'au bord de l’eau' }[p.lieu] || p.lieu; console.log(`    ${l} · ${p.objets.join(', ') || '—'}   « ${p.apercu}… »`); infos.push(`${l} : ${p.objets.join(', ')}`); }

    // 4. le mot de passe et la carte ne sont NULLE PART
    const dumpIDB = await chemin.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('chemin'); r.onerror = () => ok('');
      r.onsuccess = () => { const db = r.result; const t = db.transaction('pages').objectStore('pages').getAll(); t.onsuccess = () => { ok(JSON.stringify(t.result)); db.close(); }; t.onerror = () => { ok(''); db.close(); }; };
    }));
    for (const [k, t] of Object.entries(JAMAIS)) noter(`jamais dans l’IndexedDB du chemin : ${k}`, !dumpIDB.includes(t), '');
    noter('aucune erreur dans la console du chemin', erreurs.filter(e => !/Failed to (fetch|load)|net::ERR_|the server responded/.test(e)).length === 0, erreurs.slice(0, 2).join(' | '));

    // 5. idempotence : recharger ne duplique pas les glanes
    const avant = (dumpIDB.match(/\* \* \*/g) || []).length;
    await chemin.reload();
    await chemin.waitForFunction(() => window.chemin && window.chemin.passages && window.chemin.passages.length > 1, null, { timeout: 60000 });
    const apres = await chemin.evaluate(() => new Promise(ok => { const r = indexedDB.open('chemin'); r.onsuccess = () => { const t = r.result.transaction('pages').objectStore('pages').getAll(); t.onsuccess = () => { ok((JSON.stringify(t.result).match(/\* \* \*/g) || []).length); r.result.close(); }; }; r.onerror = () => ok(-1); }));
    noter('après rechargement, les glanes ne sont pas dupliquées (idempotent)', apres === avant, `séparateurs avant ${avant}, après ${apres}`);

    // 6. réseau : rien n’est parti ailleurs que vers 127.0.0.1
    noter('aucune requête vers l’extérieur (tout reste sur 127.0.0.1)', dehors.length === 0, dehors.slice(0, 3).join(' '));
  } catch (e) {
    noter('essai interrompu', false, e.message); console.error(e);
  }

  const échecs = resultats.filter(r => !r.ok).length;
  console.log(`\n${échecs ? `${échecs} raté(s) sur ${resultats.length}` : `tout est bon (${resultats.length})`}`);
  await ctx.close(); repo.fermer(); pageSrv.fermer(); fs.rmSync(profil, { recursive: true, force: true });
  process.exitCode = échecs ? 1 : 0;
})();
