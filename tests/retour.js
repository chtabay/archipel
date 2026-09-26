// Au retour : une île déjà commencée s’ouvre sur l’onglet Ton île ; sinon, les premières cases.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE: L, OUT: CAPTURES, GL, verifier, bilan } = require('./commun');
const OUT = path.join(CAPTURES, 'retour'); fs.mkdirSync(OUT, { recursive: true });
const depot = (id, sujets) => ({ id, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets, fait: [], subi: [] } });
const ile = (id, depots, extra = {}) => JSON.stringify({ id, seed: 4000 + id, nee: new Date().toISOString(), biome: 'prairie', depots, envoyee: false, quittee: null, ...extra });
const brouillon = JSON.stringify({ answers: { situ: ['regret'], mots: [], sujets: [], fait: [], subi: [] }, text: '', short: false });
(async () => {
  const b = await chromium.launch({ args: GL }), errors = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push(e.message));
  await p.goto(L);
  const ouvrir = async stock => { await p.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, stock); await p.reload(); await p.waitForTimeout(1800); };
  const etat = () => p.evaluate(() => ({ onglet: document.querySelector('.onglets [aria-current="page"]')?.dataset.onglet, h1: document.querySelector('#app h1')?.textContent, action: document.querySelector('#app .actions .btn')?.textContent, cases: document.querySelectorAll('.opt input:checked').length, objets: window.archipel.vue?.objets.size || 0, intro: document.body.classList.contains('en-intro') }));

  await ouvrir({ 'archipel:ile': ile(1, [depot(1, ['s4']), depot(2, ['s11'])]) });
  let e = await etat();
  verifier(e.onglet === 'ile' && e.h1 === 'Ton île' && e.objets > 0 && e.action === 'Déposer autre chose' && !e.intro, `une île commencée : on arrive sur Ton île (${e.objets} choses en 3D), l’action principale est « ${e.action} »`);
  await p.screenshot({ path: path.join(OUT, 'retour.png') });
  await p.click('#app .actions .btn'); await p.waitForTimeout(500);
  verifier(await p.evaluate(() => !!document.querySelector('.opts') && document.querySelector('.onglets [aria-current="page"]').dataset.onglet === 'deposer'), 'de là, « Déposer autre chose » mène aux premières cases');
  await p.goBack(); await p.waitForTimeout(800);
  verifier((await etat()).onglet === 'ile', 'le bouton retour ramène à l’île');

  await ouvrir({ 'archipel:ile': ile(1, [depot(1, ['s4'])]), 'archipel:draft': brouillon });
  e = await etat();
  verifier(e.onglet === 'ile' && e.action === 'Reprendre ce que tu déposais', `une île et un dépôt en cours : on arrive sur l’île, l’action principale est « ${e.action} »`);
  await p.click('#app .actions .btn'); await p.waitForTimeout(500);
  verifier((await etat()).cases === 1, 'reprendre retrouve les cases cochées');

  await ouvrir({ 'archipel:intro': '1', 'archipel:ile': ile(2, []), 'archipel:iles': JSON.stringify([JSON.parse(ile(1, [depot(1, ['s4'])], { quittee: new Date().toISOString() }))]) });
  e = await etat();
  verifier(e.onglet === 'ile' && await p.$('.actions .quiet:has-text("tes îles d’avant")') !== null, 'une île vide, mais des îles d’avant : on arrive aussi sur l’île, avec ses îles d’avant à portée');

  await ouvrir({ 'archipel:intro': '1', 'archipel:ile': ile(3, []), 'archipel:draft': brouillon });
  e = await etat();
  verifier(e.onglet === 'deposer' && e.cases === 1, 'rien de posé, un dépôt en cours : on arrive sur les cases, déjà cochées');

  await ouvrir({ 'archipel:intro': '1' });
  e = await etat();
  verifier(e.onglet === 'deposer' && !!(await p.$('.opts')) && !e.intro, 'l’intro vue, rien d’autre : on arrive sur les premières cases');

  await ouvrir({});
  verifier((await etat()).intro, 'la toute première fois : l’intro');

  verifier(!errors.length, `aucune erreur${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await b.close();
  bilan();
})();
