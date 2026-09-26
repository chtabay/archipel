// L’intro : quand elle paraît, comment on la passe, la revoit, et ce qu’elle garde de la page.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller } = require('./commun');
const OUT = path.join(CAPTURES, 'intro'); fs.mkdirSync(OUT, { recursive: true });
const dansLaVue = (p, sel) => p.evaluate(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return !!r && r.top >= 0 && r.bottom <= innerHeight && r.height > 0; }, sel);
(async () => {
  const b = await chromium.launch({ args: GL });
  const errors = [], external = [];
  const ctx = await b.newContext({ viewport: { width: 375, height: 548 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); surveiller(p, errors, external);

  // 1. la première fois : l’intro, avant tout
  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => window.archipel?.vue?.intro, null, { timeout: 20000 });
  verifier(await p.evaluate(() => document.body.classList.contains('en-intro')), 'la première fois, l’intro s’ouvre');
  verifier(await p.evaluate(() => getComputedStyle(document.querySelector('.onglets')).display === 'none' && document.querySelector('#companion').hidden), 'pendant l’intro, ni onglets ni îlot des graines');
  verifier(await dansLaVue(p, '#exit') && await dansLaVue(p, '#humans'), 'sur un petit écran, « quitter » et « parler à quelqu’un » restent visibles sans défiler');
  verifier(await dansLaVue(p, '.intro-nav'), 'le bouton pour passer est visible sans défiler');
  verifier(await p.evaluate(() => document.activeElement?.matches('h1.sr') && document.activeElement.textContent.length > 0), 'le focus est posé sur un titre, pour les lecteurs d’écran');
  const taille = await p.evaluate(() => { const c = document.querySelector('.intro-vue canvas'); return [c.clientWidth, c.clientHeight]; });
  verifier(taille[1] >= 220, `la vue 3D garde de la place sur un petit écran : ${taille.join('×')}`);
  const place = await p.evaluate(() => { const I = window.archipel.vue.intro; return window.archipel.arch.items.reduce((m, it) => Math.min(m, Math.hypot(it.x - I.x1, it.z - I.z1) - it.d.m.rayon * .45 - I.rayon), Infinity); });
  verifier(place > 0, `l’île de l’intro se pose dans l’eau libre, jamais sur une autre île (écart ${place.toFixed(2)})`);
  await p.waitForTimeout(2500);
  verifier(await p.evaluate(() => window.archipel.vue.intro.t > .3 && /archipel/.test(document.querySelector('.intro-ligne').textContent)), 'le temps avance et la première légende paraît');
  const t0 = await p.evaluate(() => window.archipel.vue.intro.t); await p.waitForTimeout(2000); const t1 = await p.evaluate(() => window.archipel.vue.intro.t);
  console.log(`     vitesse ici : ${((t1 - t0) / 2).toFixed(2)} s d’intro par seconde`);
  await p.screenshot({ path: `${OUT}/petit-ecran.png` });
  // la fin, puis commencer
  await p.evaluate(() => window.archipel.vue.introAller(16.3)); await p.waitForSelector('.intro-nav .btn', { timeout: 20000 });
  verifier((await p.textContent('.intro-nav .btn')).trim() === 'Commencer' && await p.$('.intro-nav .quiet:has-text("revoir")') !== null, 'à la fin : « Commencer », et « revoir »');
  await p.evaluate(() => { window.archipel.vue.prochaine = 0; }); await p.waitForTimeout(1500);
  const arrivees = await p.evaluate(() => { const items = window.archipel.arch.items, I = window.archipel.vue.intro, n = items.filter(it => it.born > 0); const tous = [...items, { x: I.x1, z: I.z1, r: I.rayon }]; return { n: n.length, ecart: n.reduce((m, a) => Math.min(m, ...tous.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.z - b.z) - a.d.m.rayon * .45 - (b.r ?? b.d.m.rayon * .45))), Infinity) }; });
  verifier(arrivees.n >= 1 && arrivees.ecart > 0, `à la fin, l’archipel reprend vie : ${arrivees.n} île(s) arrivée(s), sans se poser sur une autre (écart ${arrivees.ecart.toFixed(2)})`);
  await p.click('.intro-nav .quiet:has-text("revoir")'); await p.waitForTimeout(600);
  verifier(await p.evaluate(() => window.archipel.vue.intro.t < 2) && await p.$('.intro-nav .quiet:has-text("passer")') !== null, 'revoir la reprend du début, avec « passer »');
  await p.evaluate(() => window.archipel.vue.introAller(16.3)); await p.waitForSelector('.intro-nav .btn', { timeout: 20000 });
  await p.click('.intro-nav .btn'); await p.waitForTimeout(500);
  verifier(await p.evaluate(() => !document.body.classList.contains('en-intro') && !!document.querySelector('.opts') && localStorage.getItem('archipel:intro') === '1'), 'Commencer mène aux premières cases, et l’intro est notée comme vue');
  verifier(await p.evaluate(() => getComputedStyle(document.querySelector('.onglets')).display !== 'none'), 'les onglets reviennent');
  // pas de retour vers l’intro
  const avant = p.url(); await p.goBack().catch(() => {}); await p.waitForTimeout(400);
  verifier(!(await p.evaluate(() => document.body.classList.contains('en-intro'))), `le bouton retour ne ramène pas à l’intro (${avant} → ${p.url()})`);

  // 2. la fois suivante : directement les cases
  await p.goto(BASE); await p.waitForTimeout(1200);
  verifier(await p.evaluate(() => !document.body.classList.contains('en-intro') && !!document.querySelector('.opts')), 'la fois suivante, on arrive sur les cases');

  // 3. passer, dès le début
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.intro-nav .quiet', { timeout: 20000 });
  await p.click('.intro-nav .quiet:has-text("passer")'); await p.waitForTimeout(500);
  verifier(await p.evaluate(() => !!document.querySelector('.opts') && localStorage.getItem('archipel:intro') === '1'), 'passer mène aux cases, et ne la remontre plus');

  // 4. la revoir depuis l’archipel, puis passer : retour à l’archipel
  await p.click('[data-onglet="archipel"]'); await p.waitForTimeout(1500);
  await p.click('.actions .quiet:has-text("revoir l’intro")'); await p.waitForSelector('.intro-nav .quiet:has-text("passer")', { timeout: 20000 });
  verifier(await p.evaluate(() => document.body.classList.contains('en-intro')), 'l’archipel propose de revoir l’intro');
  await p.click('.intro-nav .quiet:has-text("passer")'); await p.waitForTimeout(1500);
  verifier(await p.evaluate(() => !!document.querySelector('#arch-line')), 'revue puis passée, on revient à l’archipel');

  // 5. quelqu’un qui a déjà une île, d’avant l’intro : pas d’intro
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:ile', JSON.stringify({ id: 1, seed: 7, nee: new Date().toISOString(), biome: 'prairie', depots: [{ id: 1, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets: ['s4'], fait: [], subi: [] } }], envoyee: false, quittee: null })); });
  await p.reload(); await p.waitForTimeout(1200);
  verifier(await p.evaluate(() => !document.body.classList.contains('en-intro')), 'une île déjà là : pas d’intro');
  await ctx.close();

  // 6. mouvement réduit : tout se lit d’un coup, image fixe
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage(); surveiller(p2, errors, external);
  await p2.goto(BASE); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await p2.waitForTimeout(2500);
  verifier(await p2.$$eval('.intro-tout p', l => l.length) === 4 && await p2.$('.intro-nav .btn') !== null, 'mouvement réduit : les quatre phrases d’un coup, et « Commencer »');
  const tr = await p2.evaluate(() => window.archipel.vue.intro.t); await p2.waitForTimeout(800);
  verifier(tr === await p2.evaluate(() => window.archipel.vue.intro.t) && tr > 16, 'mouvement réduit : l’image est fixe, l’île déjà dans l’archipel');
  await p2.screenshot({ path: `${OUT}/reduit.png` });
  await ctx2.close();

  // 7. sans 3D : les phrases, et « Commencer »
  const b3 = await chromium.launch({ args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis'] });
  const p3 = await (await b3.newContext({ viewport: { width: 390, height: 844 } })).newPage(); surveiller(p3, errors, external);
  await p3.goto(BASE); await p3.evaluate(() => localStorage.clear()); await p3.reload(); await p3.waitForTimeout(1200);
  verifier(await p3.$$eval('.intro-tout p', l => l.length) === 4 && !(await p3.$('.intro-vue')), 'sans 3D : les quatre phrases, sans vue');
  await p3.click('.intro-nav .btn'); await p3.waitForTimeout(400);
  verifier(await p3.evaluate(() => !!document.querySelector('.opts')), 'sans 3D : Commencer mène aux cases');
  await b3.close();

  verifier(!external.length, `aucune requête externe${external.length ? ' : ' + external.join(', ') : ''}`);
  verifier(!errors.length, `aucune erreur${errors.length ? ' :\n' + errors.join('\n') : ''}`);
  await b.close();
  bilan();
})();
