// Le menu « Plus », dans la barre du bas : quitter vite, la musique, installer l’app, parler à quelqu’un, revoir l’intro.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller, contexte } = require('./commun');
const OUT = path.join(CAPTURES, 'plus'); fs.mkdirSync(OUT, { recursive: true });
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(50); return test(); };
const ile = JSON.stringify({ id: 1, seed: 4242, nee: new Date().toISOString(), biome: 'prairie', depots: [{ id: 1, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets: ['s4', 's11'], fait: [], subi: [] } }], envoyee: false, quittee: null });
const semer = p => p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, ile);
const ouvrirMenu = async p => { await p.click('[data-onglet="plus"]'); await p.waitForSelector('.sheet .row'); };
const lignes = p => p.$$eval('.sheet .row', l => l.map(x => x.firstChild.textContent));
const sonore = p => p.evaluate(() => window.archipel.musique.etat());

(async () => {
  const b = await chromium.launch({ args: GL });

  // 1. la barre a quatre boutons ; « Plus » ouvre le menu, sans changer d’écran ni d’onglet allumé
  { const c = await contexte(b), p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await semer(p); await p.reload(); await p.waitForTimeout(1200);
    verifier((await p.$$('.onglets button')).length === 4 && (await p.textContent('[data-onglet="plus"]')).trim() === 'Plus', 'la barre du bas a quatre boutons, le dernier est « Plus »');
    await ouvrirMenu(p);
    const l = await lignes(p);
    verifier(l.join(' · ') === 'Quitter vite ce site · Allumer la musique · Installer l’app · Parler à quelqu’un · Revoir l’intro' && (await p.$eval('.onglets [aria-current="page"]', b => b.dataset.onglet)) === 'ile', `le menu : ${l.join(' · ')} ; l’onglet allumé reste Ton île`);
    await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, 'menu.png') });

    // 2. la musique, depuis le menu : allumée sur l’île, le feu de camp joue ; le bouton de la vue et la ligne le disent
    await p.click('.sheet .row:has-text("Allumer la musique")');
    const joue = await attendre(p, async () => { const m = await sonore(p); return m.sonore && m.piece === 'ile'; });
    verifier(joue && (await p.getAttribute('.son', 'aria-pressed')) === 'true' && (await lignes(p))[1] === 'Couper la musique', 'depuis le menu, la musique s’allume : le feu de camp joue, le bouton de la vue et la ligne du menu le disent');
    await p.click('.sheet .row:has-text("Couper la musique")'); await p.waitForTimeout(300);
    verifier(!(await sonore(p)).sonore && (await p.getAttribute('.son', 'aria-pressed')) === 'false' && (await lignes(p))[1] === 'Allumer la musique', 'et se coupe de même');

    // 3. parler à quelqu’un : les numéros prennent la place du menu
    await p.click('.sheet .row:has-text("Parler à quelqu’un")'); await p.waitForSelector('.sheet a[href="tel:3114"]');
    verifier(!(await p.$('.sheet .row:has-text("Quitter vite")')), 'parler à quelqu’un : les numéros prennent la place du menu');
    await p.click('.sheet .quiet:has-text("revenir")'); await p.waitForSelector('.sheet', { state: 'detached' });

    // 4. installer l’app, depuis le menu
    await ouvrirMenu(p); await p.click('.sheet .row:has-text("Installer l’app")'); await p.waitForSelector('.sheet h2:has-text("L’installer comme une app")');
    verifier(/ne le propose pas/.test(await p.textContent('.sheet')), 'installer l’app : la feuille s’ouvre, et dit que ce navigateur ne le propose pas');
    await p.click('.sheet .quiet:has-text("pas maintenant")'); await p.waitForSelector('.sheet', { state: 'detached' });

    // 5. revoir l’intro, puis la passer : on revient où l’on était
    await ouvrirMenu(p); await p.click('.sheet .row:has-text("Revoir l’intro")'); await p.waitForSelector('.intro-nav .quiet:has-text("passer")', { timeout: 20000 });
    verifier(await p.evaluate(() => document.body.classList.contains('en-intro')), 'revoir l’intro : l’intro s’ouvre');
    await p.click('.intro-nav .quiet:has-text("passer")'); await p.waitForTimeout(1200);
    verifier(await p.evaluate(() => !document.body.classList.contains('en-intro') && document.querySelector('.onglets [aria-current="page"]')?.dataset.onglet === 'ile'), 'passée, on revient sur l’île');

    verifier(!e.length && !x.length, `aucune erreur, aucune requête${e.length ? ' : ' + e.join(' | ') : ''}${x.length ? ' ; ' + x.join(', ') : ''}`);

    // 6. quitter vite, depuis le menu : on part, et « retour » ne ramène pas dans l’app
    await p.route('https://www.google.fr/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google</title>ailleurs' }));
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300); await ouvrirMenu(p);
    await p.click('.sheet .row:has-text("Quitter vite")'); await p.waitForURL(/google\.fr/, { timeout: 5000 });
    await p.goBack().catch(() => {}); await p.waitForTimeout(800);
    verifier(!p.url().startsWith(BASE), `quitter depuis le menu : on part, et « retour » ne ramène pas dans l’app (${p.url()})`);
    verifier(!e.length, `aucune erreur${e.length ? ' : ' + e.join(' | ') : ''}`);
    await c.close(); }

  // 7. à 320 px, les quatre boutons tiennent
  { const c = await contexte(b, { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await c.newPage();
    await p.goto(BASE); await semer(p); await p.reload(); await p.waitForTimeout(1000);
    const m = await p.evaluate(() => { const bs = [...document.querySelectorAll('.onglets button')]; return { deborde: document.documentElement.scrollWidth - innerWidth, coupe: bs.some(b => b.scrollWidth > b.clientWidth + 1), droite: Math.max(...bs.map(b => b.getBoundingClientRect().right)) <= innerWidth }; });
    verifier(m.deborde <= 0 && !m.coupe && m.droite, 'à 320 px, les quatre boutons tiennent, sans rien couper');
    await p.screenshot({ path: path.join(OUT, '320.png') });
    await c.close(); }

  // 8. sur iPhone, le menu propose l’installation ; déjà installée, il le dit
  { const c = await contexte(b, IPHONE), p = await c.newPage();
    await p.goto(BASE); await semer(p); await p.reload(); await p.waitForTimeout(1000);
    await ouvrirMenu(p); await p.click('.sheet .row:has-text("Installer l’app")'); await p.waitForSelector('.sheet h2:has-text("L’installer comme une app")');
    verifier(/Partager/.test(await p.textContent('.sheet')), 'sur iPhone, le menu mène aux explications pour Safari');
    await c.close();
    const c2 = await contexte(b, IPHONE); await c2.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    const p2 = await c2.newPage(); await p2.goto(BASE); await semer(p2); await p2.reload(); await p2.waitForTimeout(1000);
    await ouvrirMenu(p2);
    verifier(/Déjà installée/.test(await p2.$eval('.sheet .row:has-text("app") small', s => s.textContent)), 'déjà installée : le menu le dit');
    await c2.close(); }

  // 9. sans 3D : le menu est là, sans « revoir l’intro »
  { const sans = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl'] });
    const c = await contexte(sans, { viewport: { width: 390, height: 844 } }), p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await semer(p); await p.reload(); await p.waitForTimeout(800);
    await ouvrirMenu(p);
    const l = await lignes(p);
    verifier(l.length === 4 && !l.includes('Revoir l’intro') && !e.length, `sans 3D : le menu a ${l.length} lignes, sans l’intro`);
    await sans.close(); }

  await b.close();
  bilan();
})().catch(e => { console.error(e); process.exit(1); });
