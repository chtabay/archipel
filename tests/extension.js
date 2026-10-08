// L’extension du chemin, dans Chromium, avec des données INVENTÉES seulement. Elle se fabrique, se charge ; rien n’est lu avant
// l’accord ; après, ce qu’on écrit soi-même dans des pages d’essai (un journal, un courriel « à la Gmail », un fil, un éditeur
// riche, une recherche sur un moteur choisi) devient des blocs de la page du jour, et jamais le mot de passe, la carte, le
// cryptogramme, la connexion, ni une recherche ailleurs ; un écrit repris dans la même zone reste un seul bloc ; le chemin, dans
// le nouvel onglet, lit ces blocs, se relit quand un écrit arrive pendant qu’il est ouvert, et se recharge sans rien dupliquer ;
// la pause débranche le glaneur ; et aucune requête ne part vers l’extérieur. On n’attend pas la peinture, lente sans carte graphique.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const { GL, verifier, bilan, servir } = require('./commun');
const { fabriquer } = require('../chemin/extension/fabriquer');

const PAGES = path.join(__dirname, 'extension');
const attendre = async (test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await new Promise(r => setTimeout(r, 100)); return test(); };
const jourLocal = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };

// les pages d’essai, servies sur « localhost » : un autre nom d’hôte que 127.0.0.1, pour un moteur de recherche « choisi »
function servirPages() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
  const s = http.createServer((q, r) => {
    const f = path.join(PAGES, path.normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)));
    if (!f.startsWith(PAGES) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end(); return; }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
  });
  return new Promise((ok, ko) => { s.once('error', ko); s.listen(0, '::', () => ok({ port: s.address().port, fermer: () => s.close() })); })
    .catch(() => new Promise(ok => s.listen(0, '0.0.0.0', () => ok({ port: s.address().port, fermer: () => s.close() })))); // sans IPv6
}

// ce qui DOIT arriver au chemin, et ce qui ne doit JAMAIS y arriver
const GARDER = {
  journal: 'Ce matin, j’ai longé la rivière sous les grands arbres ; l’eau glissait entre les pierres couvertes de mousse.',
  suite: 'Puis le chemin montait vers un moulin, et des moutons paissaient derrière une clôture.',
  compose: 'Merci pour ton message. Je passerai dimanche avec des fleurs du jardin et un gâteau aux pommes.',
  riche: 'Le soir tombait sur le village, une lanterne brûlait près du vieux puits de pierre.',
  chat: 'On se retrouve demain au marché avec les enfants vers dix heures.',
  recherche: 'recette tarte aux poires',
  apres: 'Un héron s’est posé sur la barque, au bord de l’étang, sous la pluie fine.',
  lent: 'Le phare clignotait au loin pendant que les mouettes criaient sur le port.',
  ctrl: 'Bonjour Camille, je t’envoie les photos du jardin et de la vieille grange.',
  pendant: 'Pendant que le chemin se prépare, un renard a traversé la clairière enneigée.',
  main: 'Écrit à la main dans le chemin, sous les tilleuls, un soir de juin.',
  efface: 'Après avoir tout effacé, une barque neuve attendait sur le sable mouillé.',
};
const JAMAIS = {
  mdp: 'corbeau tunnel violette orage saumon',
  carte: 'quatre mille cinq cent trente neuf azur comète',
  cvv: 'cryptogramme marmotte lanterne',
  connexion: 'jean le voyageur du dimanche',
  rechercheAilleurs: 'horaires des marées à Saint-Malo demain',
  avant: 'Un mot écrit avant l’accord, qui ne compte pas pour le chemin.',
  pause: 'Un mot écrit pendant la pause, qui ne compte pas non plus.',
  destinataires: 'Marie Inventée Paul Fictif',
  objet: 'Devis toiture grange',
  court: 'ok merci',
};

(async () => {
  const DIST = fabriquer();
  verifier(fs.existsSync(path.join(DIST, 'manifest.json')) && fs.existsSync(path.join(DIST, 'chemin/index.html')) && fs.existsSync(path.join(DIST, 'chemin/objets')), 'l’extension se fabrique : le manifeste, la page du chemin, les objets');
  const repo = process.env.BASE ? null : await servir(), BASE = process.env.BASE || repo.base; // le dépôt, sur 127.0.0.1 : la page d’essai ordinaire
  const moteur = await servirPages(); // sur localhost : le moteur de recherche
  const ORDINAIRE = `${BASE}tests/extension/page.html`, MOTEUR = `http://localhost:${moteur.port}/recherche.html`;
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'chemin-ext-'));
  const ctx = await chromium.launchPersistentContext(profil, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, ...GL], viewport: { width: 1100, height: 800 } });
  const dehors = [], LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, INTERNE = /^(chrome-extension:|chrome:|devtools:|data:|blob:|about:)/;
  ctx.on('request', r => { const u = r.url(); if (!LOCAL.test(u) && !INTERNE.test(u)) dehors.push(u); });

  try {
    let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => null);
    verifier(!!sw, 'l’extension se charge : son fond tourne');
    await attendre(() => sw.evaluate(() => typeof chrome?.scripting?.getRegisteredContentScripts === 'function').catch(() => false), 15000); // le fond en module : ses API arrivent après son chargement
    const ID = new URL(sw.url()).host, CHEMIN = `chrome-extension://${ID}/chemin/index.html`;
    const pages = () => sw.evaluate(() => new Promise(ok => { // le carnet, lu tel quel dans l’IndexedDB de l’extension (pas d’import dynamique dans un service worker)
      const r = indexedDB.open('chemin'); r.onerror = () => ok([]);
      r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('pages')) { db.close(); ok([]); return; } const t = db.transaction('pages').objectStore('pages').getAll(); t.onsuccess = () => { ok(t.result); db.close(); }; t.onerror = () => { ok([]); db.close(); }; };
    }));
    const blocsDuJour = async () => ((await pages()).find(p => p.date === jourLocal()) || {}).blocs || [];
    const branche = () => sw.evaluate(() => chrome.scripting.getRegisteredContentScripts({ ids: ['glaneur'] }).then(l => l.length > 0));
    const reglage = v => sw.evaluate(v => chrome.storage.local.set(v), v);
    const taper = async (p, sel, t) => { await p.locator(sel).click(); await p.keyboard.type(t, { delay: 2 }); };
    const poser = async (p, sel, t) => { await taper(p, sel, t); await p.locator('#ailleurs').click(); await p.waitForTimeout(250); }; // la perte du focus pose l’écrit

    // 1. avant l’accord, rien : le glaneur n’est même pas branché
    verifier(!(await branche()), 'avant l’accord, le glaneur n’est pas branché');
    const p0 = await ctx.newPage(); await p0.goto(ORDINAIRE); await poser(p0, '#journal', JAMAIS.avant); await p0.close();
    verifier((await blocsDuJour()).length === 0, 'avant l’accord, un écrit ne fait rien');
    const onglet0 = await ctx.newPage(); await onglet0.goto(CHEMIN);
    verifier(await onglet0.locator('.tete .accord a').count() === 1, 'sans accord, le nouvel onglet dit où le donner'); await onglet0.close();

    // 2. l’accord, et le moteur de recherche d’essai parmi ceux qui comptent
    await reglage({ accord: true, pause: false, exclus: ['chtabay.github.io'], recherches: ['localhost'], encart: ['localhost'] });
    verifier(await attendre(branche), 'après l’accord, le glaneur est branché sur toutes les pages');

    // 3. une page ordinaire : ce qui compte, ce qui ne compte jamais, et un écrit repris
    const p = await ctx.newPage(); await p.goto(ORDINAIRE); await p.waitForTimeout(300);
    await poser(p, '#journal', GARDER.journal);
    await poser(p, '#journal', ' ' + GARDER.suite); // la suite, dans la même zone : le même bloc
    await taper(p, '#recherche', JAMAIS.rechercheAilleurs); await p.keyboard.press('Enter'); await p.locator('#ailleurs').click();
    await poser(p, '#login', JAMAIS.connexion); await poser(p, '#mdp', JAMAIS.mdp); await poser(p, '#carte', JAMAIS.carte); await poser(p, '#cvv', JAMAIS.cvv);
    await taper(p, '#corps', GARDER.compose); await p.locator('#envoyer').click(); await p.waitForTimeout(250);
    await poser(p, '#riche', GARDER.riche);
    verifier((await p.evaluate(() => window.__inputs)) === 0, 'l’éditeur riche n’a émis aucun événement input : le glaneur lit la zone, pas les touches');
    await taper(p, '#chat', GARDER.chat); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    verifier((await p.locator('#chat').inputValue()) === '', 'le fil a vidé la zone à l’envoi');
    await p.locator('#ailleurs').click();
    await taper(p, '#chatlent', GARDER.lent); await p.keyboard.press('Enter'); await p.waitForTimeout(600); await p.locator('#ailleurs').click(); // vidé après un aller-retour
    verifier(await attendre(async () => (await blocsDuJour()).length >= 5), 'les écrits sont dans le carnet');
    let blocs = await blocsDuJour(); const tout = JSON.stringify(blocs);
    const bloc = t => blocs.find(b => b.texte.includes(t.slice(0, 30)));
    verifier(bloc(GARDER.journal) && bloc(GARDER.journal).texte.includes(GARDER.suite.slice(0, 30)) && bloc(GARDER.journal).source === 'glane', 'le journal et sa suite font un seul bloc, marqué « glané »');
    verifier(bloc(GARDER.compose) && !tout.includes('cité de quelqu’un'), 'le courriel « à la Gmail » est un bloc, sans le message cité');
    verifier(bloc(GARDER.riche) && bloc(GARDER.chat), 'l’éditeur riche et le fil sont des blocs');
    verifier(!!bloc(GARDER.lent), 'un fil qui ne vide la zone qu’après un aller-retour est un bloc aussi');
    // Ctrl+Entrée envoie, et la fenêtre de composition disparaît : l’écrit est posé quand même
    const p1 = await ctx.newPage(); await p1.goto(ORDINAIRE); await p1.waitForTimeout(300);
    await taper(p1, '#corps', GARDER.ctrl); await p1.keyboard.press('Control+Enter'); await p1.waitForTimeout(600);
    verifier(await attendre(async () => !!(await blocsDuJour()).find(b => b.texte.includes('grange'))), 'Ctrl+Entrée, qui retire la fenêtre de composition, pose l’écrit'); await p1.close();
    blocs = await blocsDuJour();
    for (const [k, t] of Object.entries(JAMAIS)) if (k !== 'pause') verifier(!tout.includes(t.slice(0, 24)), `jamais dans le carnet : ${k}`);
    verifier(blocs.every(b => /^\d{2}:\d{2}$/.test(b.heure)), 'chaque bloc glané a son heure');
    verifier(await attendre(async () => (await sw.evaluate(() => chrome.action.getBadgeText({}))) === String(blocs.length)), `l’icône compte les écrits du jour : ${blocs.length}`);

    // 4. un moteur choisi : ce qu’on y cherche compte, même court ; Entrée envoie et la page change
    const m = await ctx.newPage(); await m.goto(MOTEUR); await m.waitForTimeout(300);
    await poser(m, '#a', JAMAIS.destinataires); await poser(m, '#objet', JAMAIS.objet); await poser(m, '#corps', JAMAIS.court); // sur ce même hôte, un courriel : rien de tout ça
    await taper(m, '#q', GARDER.recherche); await m.keyboard.press('Enter'); await m.waitForURL(/resultats\.html/); await m.waitForTimeout(300); await m.close();
    verifier(await attendre(async () => (await blocsDuJour()).some(b => b.texte === GARDER.recherche)), 'sur un moteur choisi, la recherche est un bloc');
    blocs = await blocsDuJour(); const toutM = JSON.stringify(blocs);
    verifier(!toutM.includes('Inventée') && !toutM.includes('toiture') && !toutM.includes('ok merci'), 'sur ce moteur, ni les destinataires, ni l’objet, ni deux mots dans un corps de courriel');
    // 4 bis. l’encart : sur le moteur, la frise du chemin au coin de la page ; pas ailleurs ; la croix la replie pour la session
    verifier(await p.locator('#chemin-encart').count() === 0, 'sur une page ordinaire, pas d’encart');
    const m2 = await ctx.newPage(); await m2.goto(MOTEUR);
    verifier(await attendre(() => m2.locator('#chemin-encart iframe').count().then(n => n === 1)), 'sur le moteur, l’encart est posé au coin de la page');
    const cadre = await attendre(() => m2.frames().find(f => f.url().includes('chemin/index.html?encart')) || null, 10000);
    verifier(!!cadre && await attendre(() => cadre.evaluate(() => window.chemin?.passages?.length > 1 && !document.querySelector('.intro:not([hidden])')).catch(() => false), 60000), 'l’encart montre la frise, sans intro');
    await m2.locator('#chemin-encart button').click();
    verifier(await m2.locator('#chemin-encart').count() === 0, 'la croix replie l’encart');
    await m2.reload(); await m2.waitForTimeout(600);
    verifier(await m2.locator('#chemin-encart').count() === 0, 'et il reste replié sur la page suivante'); await m2.close();
    await sw.evaluate(() => chrome.storage.session.remove('encartReplie'));

    // 5. le chemin, dans le nouvel onglet : il lit les blocs, et les montre « écrits ailleurs »
    const onglet = await ctx.newPage(); const erreurs = []; onglet.on('pageerror', e => erreurs.push(String(e))); onglet.on('console', x => { if (x.type() === 'error') erreurs.push(x.text()); });
    await onglet.goto(CHEMIN);
    await onglet.waitForFunction(() => window.chemin?.passages?.length > 1, null, { timeout: 60000 });
    const vu = await onglet.evaluate(j => ({
      texte: window.chemin.passages.map(x => x.texte).join('\n'),
      plans: window.chemin.plans.filter(q => !q.passage.depart && q.passage.date === j).map(q => ({ lieu: q.lieu, objets: [...new Set(q.objets.map(o => o.mot))] })),
      ailleurs: document.querySelectorAll('#blocs .bloc.glane').length, accord: document.querySelectorAll('.tete .accord').length,
    }), jourLocal());
    verifier(vu.texte.includes('rivière') && vu.texte.includes('gâteau') && vu.texte.includes('lanterne') && vu.texte.includes('marché') && vu.texte.includes('poires'), 'le chemin a lu les écrits glanés');
    verifier(vu.ailleurs === blocs.length && vu.accord === 0, `la page du jour montre ses ${blocs.length} blocs « écrits ailleurs », et plus le mot de l’accord`);
    for (const q of vu.plans) console.log(`    ${q.lieu} · ${q.objets.join(', ') || '—'}`);
    verifier(vu.plans.some(q => q.objets.length), 'les tuiles du jour ont des objets');

    // 6. un écrit arrive pendant que le chemin est ouvert : il se relit tout seul
    const p2 = await ctx.newPage(); await p2.goto(ORDINAIRE); await p2.waitForTimeout(300); await poser(p2, '#journal', GARDER.apres); await p2.close();
    verifier(await attendre(() => onglet.evaluate(() => window.chemin.passages.map(x => x.texte).join('\n').includes('héron')), 15000), 'le chemin ouvert a relu le carnet : l’écrit nouveau y est');
    verifier(await onglet.evaluate(() => document.querySelector('#dit').textContent.includes('écrit de plus')), 'et il le dit');

    // 6 bis. un écrit arrivé pendant que l’onglet se prépare n’est pas perdu, même si on écrit ensuite à la main
    const onglet2 = await ctx.newPage(); const allerSansAttendre = onglet2.goto(CHEMIN);
    const p4 = await ctx.newPage(); await p4.goto(ORDINAIRE); await p4.waitForTimeout(200);
    const pret = await onglet2.evaluate(() => !!window.chemin).catch(() => false); await poser(p4, '#journal', GARDER.pendant); await p4.close(); await allerSansAttendre;
    console.log(`    (le chemin était ${pret ? 'déjà prêt' : 'encore en préparation'} quand l’écrit est arrivé)`);
    await onglet2.waitForFunction(() => window.chemin?.passages?.length > 1, null, { timeout: 60000 });
    await onglet2.locator('#page').fill(GARDER.main); await onglet2.locator('#garder').click();
    await onglet2.waitForFunction(() => /gardée|s’allonge/.test(document.querySelector('#dit').textContent), null, { timeout: 60000 });
    blocs = await blocsDuJour();
    verifier(blocs.some(b => b.texte.includes('renard')) && blocs.some(b => b.texte.includes('tilleuls')), 'l’écrit arrivé pendant la préparation et le bloc écrit à la main sont tous deux gardés');
    verifier(await attendre(() => onglet2.evaluate(() => window.chemin.pages.some(p => p.blocs.some(b => b.texte.includes('renard'))))), 'et l’onglet les a relus'); await onglet2.close();

    // 7. recharger ne duplique rien
    const n = (await blocsDuJour()).length;
    await onglet.reload(); await onglet.waitForFunction(() => window.chemin?.passages?.length > 1, null, { timeout: 60000 });
    verifier((await blocsDuJour()).length === n, `après rechargement, toujours ${n} blocs`);
    verifier(erreurs.filter(e => !/Failed to (fetch|load)|net::ERR_/.test(e)).length === 0, `aucune erreur dans la console du chemin${erreurs.length ? ` (${erreurs[0].slice(0, 80)})` : ''}`);

    // 8. la pause débranche le glaneur
    await reglage({ pause: true });
    verifier(await attendre(async () => !(await branche())), 'en pause, le glaneur est débranché');
    const p3 = await ctx.newPage(); await p3.goto(ORDINAIRE); await poser(p3, '#journal', JAMAIS.pause); await p3.close();
    verifier(!JSON.stringify(await blocsDuJour()).includes(JAMAIS.pause.slice(0, 24)), 'en pause, un écrit ne fait rien');
    await reglage({ pause: false }); verifier(await attendre(branche), 'la pause levée, le glaneur revient');

    // 8 bis. tout effacer, puis écrire encore : le carnet se rouvre
    const accord = await ctx.newPage(); accord.on('dialog', d => d.accept()); await accord.goto(`chrome-extension://${ID}/accord.html`);
    await onglet.close(); await accord.locator('#effacer').click(); await accord.waitForFunction(() => document.querySelector('#dit').textContent.includes('effacé'), null, { timeout: 15000 });
    verifier((await blocsDuJour()).length === 0, 'tout effacer vide le carnet');
    await reglage({ accord: true, pause: false, exclus: ['chtabay.github.io'], recherches: ['localhost'] }); await attendre(branche);
    const p5 = await ctx.newPage(); await p5.goto(ORDINAIRE); await p5.waitForTimeout(300); await poser(p5, '#journal', GARDER.efface); await p5.close();
    verifier(await attendre(async () => (await blocsDuJour()).some(b => b.texte.includes('barque neuve'))), 'après tout effacer, un écrit fait de nouveau un bloc');
    verifier(await sw.evaluate(() => chrome.action.onClicked.hasListeners()), 'l’icône de l’extension ouvre l’accord'); await accord.close();

    // 9. rien n’est parti
    verifier(dehors.length === 0, `aucune requête vers l’extérieur${dehors.length ? ` (${dehors[0]})` : ''}`);
  } catch (e) { verifier(false, `essai interrompu : ${e.message}`); console.error(e); }
  await ctx.close(); repo?.fermer(); moteur.fermer(); fs.rmSync(profil, { recursive: true, force: true });
  bilan();
})();
