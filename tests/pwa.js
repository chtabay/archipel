// L’installation : le manifeste, les icônes, le service worker qui garde le site, l’ouverture sans réseau,
// et le lien discret « installer l’app », sur Android comme sur iPhone.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { OUT: CAPTURES, GL, verifier, bilan, surveiller, sansIntro, contexte, servir } = require('./commun');
const OUT = path.join(CAPTURES, 'pwa'); fs.mkdirSync(OUT, { recursive: true });
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const ile = JSON.stringify({ id: 1, seed: 4242, nee: new Date().toISOString(), biome: 'prairie', depots: [{ id: 1, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets: ['s4', 's11'], fait: [], subi: [] } }], envoyee: false, quittee: null });
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(50); return test(); };
const calme = e => e.filter(m => !/Failed to fetch|net::ERR_|Failed to load resource|fetching the script/.test(m)); // ce que la console dit d’un réseau coupé exprès
const gardes = p => p.evaluate(async () => { const noms = await caches.keys(); const c = noms.length ? await caches.open(noms[0]) : null; return { noms, urls: c ? (await c.keys()).map(k => k.url) : [] }; });
const semer = p => p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, ile);

(async () => {
  const b = await chromium.launch({ args: GL }), local = await servir(), BASE = local.base; // son propre serveur, pour pouvoir le couper

  // 1. le manifeste et les icônes
  { const c = await contexte(b), p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(800);
    const lien = await p.getAttribute('link[rel="manifest"]', 'href'), m = await (await p.request.get(BASE + lien)).json();
    verifier(m.name === 'L’archipel' && m.display === 'standalone' && m.start_url === './' && m.scope === './' && m.lang === 'fr' && m.theme_color === '#f6f2ea', `le manifeste : « ${m.name} », en plein écran, en français`);
    verifier(m.theme_color === await p.getAttribute('meta[name="theme-color"]', 'content') && m.background_color === m.theme_color, 'la couleur du manifeste est celle de la page');
    const tailles = await p.evaluate(srcs => Promise.all(srcs.map(s => new Promise(ok => { const i = new Image(); i.onload = () => ok(`${i.naturalWidth}×${i.naturalHeight}`); i.onerror = () => ok('absente'); i.src = s; }))), m.icons.map(i => i.src));
    const attendues = m.icons.map(i => i.sizes.replace('x', '×'));
    verifier(m.icons.length === 4 && tailles.join() === attendues.join() && m.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512') && m.icons.some(i => i.purpose === 'any' && i.sizes === '192x192'), `les icônes se chargent, aux bonnes tailles (${tailles.join(', ')}), dont une pour Android qui va jusqu’aux bords`);
    const pomme = await p.evaluate(() => new Promise(ok => { const i = new Image(); i.onload = () => ok(`${i.naturalWidth}×${i.naturalHeight}`); i.onerror = () => ok('absente'); i.src = document.querySelector('link[rel="apple-touch-icon"]').href; }));
    verifier(pomme === '180×180' && await p.$('meta[name="apple-mobile-web-app-capable"][content="yes"]') !== null, `l’icône pour l’iPhone se charge (${pomme}), et la page se dit app`);

    // 2. le service worker garde le site, et laisse passer l’archipel
    const g = await attendre(p, async () => { const g = await gardes(p); return g.urls.some(u => /app\.js\?v=/.test(u)) && g.urls.some(u => /nunito/.test(u)) && g.urls.some(u => /three/.test(u)) && g; });
    const dedans = ['app.js?v=', 'style.css?v=', 'monde.js?v=', 'ile.js?v=', 'modeles.js?v=', 'vendor/three', 'fonts/nunito'].filter(f => !g.urls?.some(u => u.includes(f)));
    verifier(!!g && g.urls.includes(BASE) && !dedans.length, `le service worker garde la page et ses ${g.urls?.length} fichiers${dedans.length ? ' ; manque : ' + dedans.join(', ') : ''}`);
    await p.reload(); await p.waitForTimeout(800);
    verifier(await p.evaluate(() => !!navigator.serviceWorker.controller && !!window.archipel?.vue), 'à l’ouverture suivante, la page passe par lui, et l’app marche pareil');
    await p.click('[data-onglet="archipel"]'); await attendre(p, () => c.archipel.etat.appels.length > 0); await p.waitForTimeout(300);
    verifier(c.archipel.etat.appels.length > 0 && !(await gardes(p)).urls.some(u => /supabase/.test(u)), 'l’archipel partagé passe tel quel, et rien de lui n’est gardé');

    // 3. sans réseau : l’app s’ouvre quand même, avec son île ; l’archipel le dit
    await semer(p); local.etat.coupe = true; local.etat.servies = 0; c.archipel.etat.panne = true; // le serveur ne répond plus, comme sans réseau
    await p.reload(); await p.waitForTimeout(1500);
    const hors = await p.evaluate(() => ({ app: !!window.archipel?.vue, onglet: document.querySelector('.onglets [aria-current="page"]')?.dataset.onglet, objets: window.archipel?.vue?.objets.size || 0, police: document.fonts.check('1em Nunito') }));
    verifier(hors.app && hors.onglet === 'ile' && hors.objets > 0 && hors.police && local.etat.servies === 0, `sans réseau, l’app s’ouvre sur l’île (${hors.objets} choses en 3D), avec sa police, sans rien recevoir du serveur`);
    await p.screenshot({ path: path.join(OUT, 'hors-ligne.png') });
    await p.click('[data-onglet="archipel"]'); await attendre(p, () => p.evaluate(() => window.archipel.arch.panne)); await p.waitForTimeout(300);
    verifier(/ne répond pas/.test(await p.textContent('#arch-caption')), 'sans réseau, l’archipel le dit');
    local.etat.coupe = false; c.archipel.etat.panne = false;

    // 4. une vieille entrée du cache s’en va à l’ouverture suivante
    await p.evaluate(async () => { const [k] = await caches.keys(); await (await caches.open(k)).put(location.origin + '/vieux.js?v=1', new Response('x')); });
    await p.reload();
    verifier(await attendre(p, async () => !(await gardes(p)).urls.some(u => /vieux\.js/.test(u))), 'un fichier d’une version d’avant est oublié à l’ouverture suivante');

    // 5. le lien « installer l’app » : caché tant que le navigateur ne propose rien ; proposé, il paraît, et la feuille installe
    await p.waitForTimeout(500);
    verifier(await p.$eval('#installer', b => b.hidden), 'sans proposition du navigateur, le lien reste caché');
    await p.evaluate(() => { const ev = new Event('beforeinstallprompt', { cancelable: true }); ev.prompt = async () => { window.demande = true; }; ev.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(ev); });
    verifier(!(await p.$eval('#installer', b => b.hidden)), 'le navigateur le propose : le lien paraît sur l’île');
    await p.click('#installer'); await p.waitForSelector('.sheet');
    const feuille = await p.textContent('.sheet');
    await p.screenshot({ path: path.join(OUT, 'installer.png') });
    await p.click('.sheet .gesture:has-text("L’installer")'); await p.waitForTimeout(400);
    verifier(/même sans réseau/.test(feuille) && await p.evaluate(() => window.demande === true) && !(await p.$('.sheet')) && await p.$eval('#installer', b => b.hidden), 'la feuille dit ce que ça change, demande l’installation au navigateur, et le lien s’en va');
    verifier(!calme(e).length && !x.length, `aucune erreur, hors le réseau coupé exprès${calme(e).length ? ' : ' + calme(e).slice(0, 4).join(' | ') : ''}`);
    await c.close(); }

  // 6. sur iPhone : le lien paraît, la feuille explique le bouton Partager ; déjà installée, plus de lien
  { const c = await contexte(b, IPHONE), p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await semer(p); await p.reload(); await p.waitForTimeout(1000);
    verifier(!(await p.$eval('#installer', b => b.hidden)), 'sur iPhone, le lien paraît');
    await p.click('#installer'); await p.waitForSelector('.sheet');
    const t = await p.textContent('.sheet');
    verifier(/Partager/.test(t) && /Sur l’écran d’accueil/.test(t) && /reste dans Safari/.test(t) && !(await p.$('.sheet .gesture')), 'la feuille dit comment faire avec Safari, et que l’app installée commence avec une île vide');
    await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, 'iphone.png') });
    verifier(!e.length && !x.length, `aucune erreur${e.length ? ' : ' + e.join(' | ') : ''}`);
    await c.close();
    const c2 = await contexte(b, IPHONE); await c2.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    const p2 = await c2.newPage(); await p2.goto(BASE); await semer(p2); await p2.reload(); await p2.waitForTimeout(1000);
    verifier(await p2.$eval('#installer', b => b.hidden), 'déjà installée : plus de lien');
    await c2.close(); }

  await b.close(); local.fermer();
  bilan();
})().catch(e => { console.error(e); process.exit(1); });
