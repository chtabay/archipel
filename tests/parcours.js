// L’archipel : le parcours, les paysages, l’archipel, la reprise des îles d’avant, le repli sans 3D, les anciennes adresses.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { BASE, OUT: CAPTURES, RACINE, GL, verifier, bilan, surveiller, contexte, peupler, formeValide } = require('./commun');
const OUT = path.join(CAPTURES, 'parcours'), L = BASE;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const RICHE = [
  { quad: 'ED', texte: true, contenu: 'x', answers: { situ: ['mal', 'longtemps', 'jamais'], mots: ['peur', 'honte'], sujets: ['s5', 's11'], fait: [], subi: ['slong'] } },
  { quad: 'ED', texte: false, answers: { situ: ['regret', 'boucle'], mots: ['culpa'], sujets: ['s0', 's4'], fait: ['frep'], subi: [] } },
  { quad: 'AS', texte: true, answers: { situ: ['recent'], mots: ['espoir'], sujets: ['s7', 's14'], fait: [], subi: [] } },
  { quad: 'ES', texte: false, answers: { situ: [], mots: ['calme'], sujets: ['s12', 's9'], fait: [], subi: [] } },
  { quad: 'AS', texte: false, answers: { situ: ['danger'], mots: ['soulagement', 'envie'], sujets: ['s6', 's13'], fait: [], subi: [] } },
];
const ileDe = (seed, biome, depots, prefixe = 'archipel:') => ({ prefixe, ile: JSON.stringify({ id: 1, seed, nee: new Date().toISOString(), biome, depots: depots.map((d, i) => ({ id: i + 1, date: new Date().toISOString(), ...d })), envoyee: true, quittee: null }) });
const semer = ({ prefixe, ile }) => { localStorage.clear(); localStorage.setItem(`${prefixe}ile`, ile); };
(async () => {
  const browser = await chromium.launch({ args: GL });
  const errors = [], external = [], requetes = [];
  const ctx = await contexte(browser); // avec son faux archipel : jamais la vraie base
  const p = await ctx.newPage(); surveiller(p, errors, external);
  p.on('request', r => requetes.push(r.url()));

  // 1. le parcours, depuis une île vide
  await p.goto(L); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); }); await p.reload(); await p.waitForTimeout(800);
  verifier(await p.evaluate(() => !!window.archipel?.vue), '3D disponible et application chargée');
  verifier((await p.textContent('.brand')).trim() === 'L’archipel' && await p.$('.brand img.logo') !== null && (await p.title()) === 'L’archipel', 'le titre : l’icône de l’île et « L’archipel », dans la page et l’onglet');
  verifier(!/limbes/i.test(await p.evaluate(() => document.documentElement.outerHTML)), 'le mot « limbes » n’apparaît nulle part dans la page');
  await p.screenshot({ path: `${OUT}/0-accueil.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });
  const chevauche = await p.evaluate(() => { const c = document.querySelector('#ent').getBoundingClientRect(), h = document.querySelector('#ent-hint').getBoundingClientRect(); return h.top < c.bottom - 1; });
  verifier(!chevauche, 'la phrase d’aide est sous l’îlot, pas dessus');
  const libelles = await p.$$eval('.opt span', l => l.map(x => x.textContent));
  verifier(libelles.length === 8 && !libelles.some(t => /juste le poser|Personne ne le sait/.test(t)), `la première question a ${libelles.length} cases, sans « juste le poser » ni « personne ne le sait »`);
  await p.click('.opt:has-text("en danger")'); await p.waitForTimeout(700);
  verifier(await p.evaluate(() => window.archipel.ilot.cle.includes(':phare:')), 'en danger : un phare apparaît sur l’îlot');
  await p.click('.opt:has-text("pas bien du tout")'); await p.waitForTimeout(700);
  verifier(await p.evaluate(() => window.archipel.ilot.cle.includes(':lourd:')), 'pas bien du tout : un nuage gris passe au-dessus de l’îlot');
  await p.click('.opt:has-text("en danger")'); await p.click('.opt:has-text("pas bien du tout")');
  await p.click('.opt:has-text("On m’a fait du mal")'); await p.click('.opt:has-text("depuis longtemps")'); await p.waitForTimeout(900);
  verifier(await p.evaluate(() => window.archipel.preview.length > 0), 'les graines apparaissent en cochant');
  verifier(await p.$$eval('#app nav button, #app nav .quiet', l => l.filter(x => /passer/i.test(x.textContent)).length) === 0, 'les questions n’ont plus qu’un bouton pour avancer');
  verifier(await p.$eval('[data-onglet="deposer"]', b => b.getAttribute('aria-current') === 'page'), 'l’onglet Déposer est allumé pendant les questions');
  await p.click('.btn'); await p.click('.opt:has-text("de l’espoir")'); await p.click('.opt:has-text("de la tristesse")'); await p.click('.btn');
  await p.click('.opt:has-text("famille")'); await p.waitForTimeout(300);
  await p.click('.btn'); await p.waitForTimeout(100); await p.click('.btn'); await p.waitForTimeout(200);
  await p.click('.path:has-text("Juste le poser")'); await p.waitForSelector('.sheet'); await p.click('.gesture:has-text("Poser sur l’île")');
  await p.waitForTimeout(2500);
  const n1 = await p.evaluate(() => window.archipel.vue.objets.size);
  verifier(n1 > 0, `poser fait pousser l’île (${n1} objets 3D) · titre : ${await p.textContent('#app h1')}`);
  verifier(await p.evaluate(() => !!localStorage.getItem('archipel:ile') && !localStorage.getItem('limbes:ile')), 'l’île est gardée sous le préfixe archipel:');
  await p.screenshot({ path: `${OUT}/1-ile.png` });

  // 1 bis. avec un texte : il agit sur l’île sans qu’on ait à choisir ; on choisit seulement de le garder ou de le brûler
  for (const geste of ['Brûler le texte', 'Garder le texte']) {
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); }); await p.reload(); await p.waitForTimeout(700);
    await p.click('.opt:has-text("On m’a fait du mal")');
    for (let i = 0; i < 6 && !(await p.$('.path')); i++) { await p.click('#app .btn'); await p.waitForTimeout(150); }
    await p.click('.path:has-text("Écrire")'); await p.waitForSelector('textarea');
    await p.fill('textarea', 'Ma mère ne me parle plus depuis des mois. Au travail, je n’en peux plus.'); await p.waitForTimeout(900);
    const avant = await p.evaluate(() => ({ lueur: window.archipel.ilot.cle.includes('lueur'), note: document.querySelector('#ent-note').textContent }));
    if (geste === 'Brûler le texte') verifier(avant.lueur && /Ton texte ajoute/.test(avant.note), `en écrivant, des lanternes s’allument sur l’îlot et le texte ajoute des sujets (${avant.note})`);
    await p.click('#app .btn:has-text("Terminer")'); await p.waitForSelector('.sheet');
    const feuille = await p.evaluate(() => ({ cases: document.querySelectorAll('.sheet input[type=checkbox]').length, gestes: [...document.querySelectorAll('.sheet .gesture')].map(b => b.firstChild.textContent) }));
    if (geste === 'Brûler le texte') verifier(!feuille.cases && feuille.gestes.join('|') === 'Garder le texte|Brûler le texte', `à la fin, aucun choix sur ce que fait le texte ; seulement ${feuille.gestes.join(' ou ')}`);
    await p.click(`.gesture:has-text("${geste}")`);
    if (geste === 'Brûler le texte') { await p.waitForTimeout(300); verifier(await p.evaluate(() => document.querySelector('textarea')?.classList.contains('brule')), 'brûler : le texte rougeoie et s’en va en fumée'); }
    await p.waitForFunction(() => document.querySelector('#app h1')?.textContent.includes('ont') || document.querySelector('#app h1')?.textContent.includes('a '), null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const apres = await p.evaluate(() => { const ile = window.archipel.ile, d = ile.depots[ile.depots.length - 1], c = window.archipel.courant; return { texte: d.texte, garde: !!d.contenu, duTexte: d.duTexte || [], lanternes: c.assets.filter(a => a.etats.lueur).length, ligne: document.querySelector('#app .hint').textContent }; });
    verifier(apres.texte && apres.duTexte.length > 0 && apres.lanternes > 0 && apres.garde === (geste === 'Garder le texte'), `${geste.toLowerCase()} : ${apres.duTexte.length} sujet(s) du texte ont poussé, ${apres.lanternes} chose(s) sous des lanternes, texte ${apres.garde ? 'gardé' : 'effacé'} · « ${apres.ligne.slice(-60)} »`);
  }

  // 1 ter. la séquence signalée : jamais dit, puis je regrette, puis on m’a fait du mal ; puis tout effacer
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); }); await p.reload(); await p.waitForTimeout(700);
  for (const c of ['Il y a quelque chose que je n’ai jamais dit', 'J’ai fait quelque chose que je regrette', 'On m’a fait du mal']) { await p.click(`.opt:has-text("${c}")`); await p.waitForTimeout(250); }
  await p.waitForTimeout(1200);
  const seq = await p.evaluate(() => window.archipel.preview.map(x => `${x.famille}${x.etats.ferme ? ' fermé' : ''}`));
  verifier(seq.includes('arbre fermé') && seq.includes('pierre fermé'), `les trois cases gardent chacune leur trace sur l’îlot : ${seq.join(', ')}`);
  await (await p.$('#companion')).screenshot({ path: `${OUT}/1-sequence.png` });
  for (let i = 0; i < 6 && !(await p.$('.path')); i++) { await p.click('#app .btn'); await p.waitForTimeout(150); }
  await p.click('.path:has-text("Juste le poser")'); await p.waitForSelector('.sheet');
  const nAvant = await p.evaluate(() => window.archipel.ile.depots.length);
  await p.click('.effacer .quiet'); await p.waitForTimeout(200);
  const demande = await p.textContent('.effacer');
  await p.click('.effacer .quiet:text-is("tout effacer")'); await p.waitForTimeout(600);
  const efface = await p.evaluate(() => ({ depots: window.archipel.ile.depots.length, coches: document.querySelectorAll('.opt input:checked').length, brouillon: localStorage.getItem('archipel:draft'), feuille: !!document.querySelector('.sheet') }));
  verifier(/rien ne poussera/.test(demande) && efface.depots === nAvant && !efface.coches && !efface.brouillon && !efface.feuille, `tout effacer : une confirmation, puis rien n’est posé et le brouillon disparaît (« ${demande.trim().slice(0, 60)}… »)`);

  // 2. les cinq paysages, le toucher, tourner
  let k = 0;
  for (const [biome, climat] of [['prairie', 'AS'], ['tropique', 'ES'], ['automne', 'N'], ['neige', 'ED'], ['lande', 'AD']]) {
    const deps = RICHE.map(d => ({ ...d })); deps[deps.length - 1] = { ...deps[deps.length - 1], quad: climat, answers: { ...deps[deps.length - 1].answers, mots: { AS: ['espoir'], ES: ['calme'], N: [], ED: ['tristesse'], AD: ['colere'] }[climat] } };
    await p.evaluate(semer, ileDe(424242 + ++k * 11, biome, deps)); await p.reload(); await p.waitForTimeout(400);
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(2200);
    const c = await p.evaluate(() => window.archipel.courant.climat), n = await p.evaluate(() => window.archipel.vue.objets.size);
    verifier(c === climat && n > 5, `${biome} · climat ${c} · ${n} objets`);
    await p.screenshot({ path: `${OUT}/2-${k}-${biome}.png`, clip: { x: 0, y: 170, width: 390, height: 420 } });
  }
  const pos = await p.evaluate(() => { const v = window.archipel.vue, o = [...v.objets.values()][0], w = o.position.clone(); w.y += .4; w.project(v.camera); const r = v.canvas.getBoundingClientRect(); return { x: r.left + (w.x + 1) / 2 * r.width, y: r.top + (1 - w.y) / 2 * r.height }; });
  await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(400);
  verifier(await p.evaluate(() => window.archipel.vue.anneau.visible), `toucher une chose : ${(await p.textContent('#ile-caption')).slice(0, 70)}…`);
  verifier(await p.$eval('[data-onglet="ile"]', b => b.getAttribute('aria-current') === 'page') && (await p.textContent('#app .actions .btn')) === 'Déposer autre chose', 'sur l’île : l’onglet Ton île est allumé, l’action principale est « Déposer autre chose »');
  const az0 = await p.evaluate(() => window.archipel.vue.orbite.but.azim); await p.click('.tourner');
  verifier(await p.evaluate(a => window.archipel.vue.orbite.but.azim > a + 1, az0), 'le bouton tourner fait tourner l’île');

  // 3. l’archipel : seulement des îles reçues du serveur ; la tienne y va d’un geste, et seulement sa forme
  const serveur = ctx.archipel;
  await peupler(p, serveur, 27);
  await p.click('[data-onglet="archipel"]'); await p.waitForFunction(() => window.archipel.arch.lu, null, { timeout: 10000 }); await p.waitForTimeout(2500);
  const recues = await p.evaluate(() => window.archipel.arch.items.map(it => ({ id: it.id, mine: !!it.mine, taille: it.d.m.taille })));
  const ids = new Set(serveur.etat.iles.map(i => i.ile));
  verifier(recues.length === 27 && recues.every(r => ids.has(r.id) && !r.mine), `l’archipel montre les ${recues.length} îles du serveur, aucune inventée`);
  const tailles = recues.map(r => r.taille);
  verifier(new Set(tailles).size >= 5, `les îles de l’archipel ont des tailles différentes (de ${Math.min(...tailles)} à ${Math.max(...tailles)} tuiles)`);
  await p.screenshot({ path: `${OUT}/3-archipel.png`, clip: { x: 0, y: 170, width: 390, height: 560 } });
  await p.click('#mettre-ile'); await p.waitForSelector('.sheet'); await p.click('.sheet .gesture:has-text("Y mettre ton île")');
  await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(2500);
  const envoi = serveur.etat.appels.filter(a => a.f === 'archipel_poser');
  verifier(envoi.length === 1 && formeValide(envoi[0].c.p_forme) && !serveur.etat.refus.length && serveur.etat.iles.length === 28, `« Y mettre ton île » : seule sa forme part, et le serveur l’accepte (${envoi[0]?.corps.length} octets)`);
  const ile = await p.evaluate(() => { const v = window.archipel.vue, it = window.archipel.arch.items.find(i => i.mine), w = it.grp.position.clone(); w.project(v.camera); const r = v.canvas.getBoundingClientRect(); return { x: r.left + (w.x + 1) / 2 * r.width, y: r.top + (1 - w.y) / 2 * r.height }; });
  await p.mouse.click(ile.x, ile.y); await p.waitForTimeout(2000);
  verifier((await p.textContent('#arch-caption')).startsWith('La tienne'), 'toucher sa propre île la désigne');
  await p.screenshot({ path: `${OUT}/3-archipel-la-tienne.png`, clip: { x: 0, y: 170, width: 390, height: 560 } });
  await peupler(p, serveur, 1, 40); await p.evaluate(() => window.archipel.sonder()); await p.waitForTimeout(300);
  verifier(/arrivées depuis que tu regardes\s*:\s*1\b/.test(await p.textContent('#arch-line')), 'une île posée ailleurs arrive');

  // 4. les aperçus des paysages
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', JSON.stringify({ id: 9, seed: 777, nee: new Date().toISOString(), biome: 'prairie', depots: [], envoyee: false })); });
  await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-onglet="ile"]'); await p.waitForTimeout(1000);
  await p.click('text=choisir le paysage'); await p.waitForSelector('.paysages'); await p.waitForTimeout(2500);
  const apercus = await p.evaluate(() => [...document.querySelectorAll('.paysage canvas')].filter(c => { const x = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return x[3] > 0; }).length);
  verifier(apercus === 5, `les cinq aperçus de paysage sont dessinés (${apercus})`);
  await p.screenshot({ path: `${OUT}/4-apercus.png` });

  // 5. la reprise d’une île gardée sous un ancien nom : celui des maquettes D et E, puis celui d’hier
  for (const [ancien, biome] of [['limbesD.', 'automne'], ['limbes:', 'lande']]) {
    await p.evaluate(semer, ileDe(5151, biome, RICHE.slice(0, 3), ancien));
    await p.reload(); await p.waitForTimeout(500);
    const repris = await p.evaluate(a => ({ cle: !!localStorage.getItem('archipel:ile'), ancienne: !!localStorage.getItem(`${a}ile`), choses: window.archipel.courant.assets.length, paysage: window.archipel.ile.biome }), ancien);
    verifier(repris.cle && repris.ancienne && repris.choses > 0 && repris.paysage === biome, `l’île gardée sous « ${ancien} » est reprise (${repris.choses} choses, ${repris.paysage}), l’ancienne clé reste intacte`);
  }
  await p.evaluate(() => localStorage.setItem('limbes:ile', JSON.stringify({ id: 3, seed: 2, nee: new Date().toISOString(), biome: 'tropique', depots: [], envoyee: false })));
  await p.reload(); await p.waitForTimeout(400);
  verifier(await p.evaluate(() => window.archipel.ile.biome === 'lande'), 'une île déjà reprise n’est pas écrasée par une ancienne');
  await p.evaluate(() => localStorage.setItem('limbesD.ile', JSON.stringify({ id: 2, seed: 1, nee: new Date().toISOString(), biome: 'neige', depots: [], envoyee: false })));
  await p.reload(); await p.waitForTimeout(400);
  verifier(await p.evaluate(() => window.archipel.ile.biome === 'lande'), 'la reprise ne se fait qu’une fois : elle n’écrase pas l’île en cours');

  // 5 bis. l’île grandit avec les dépôts
  const croit = await p.evaluate(async deps => {
    const { deriver } = await import('./ile.js?v=10');
    const base = { id: 1, seed: 4242, nee: '', biome: 'prairie', envoyee: false };
    return [0, 1, 3, 5].map(k => deriver({ ...base, depots: deps.slice(0, k).map((d, i) => ({ id: i + 1, ...d })) }).m.taille);
  }, RICHE);
  verifier(croit.every((t, i) => !i || t > croit[i - 1]), `l’île grandit avec les dépôts (${croit.join(', ')} tuiles pour 0, 1, 3 et 5 dépôts)`);

  // 6. plus rien ne vient de l’ancien dossier, ni de l’extérieur
  const hors = [...new Set(requetes)].filter(u => u.startsWith(BASE + 'limbes'));
  verifier(!hors.length, `plus aucun fichier chargé depuis l’ancien dossier${hors.length ? ' : ' + hors.join(', ') : ''}`);
  verifier(!external.length, `aucune requête extérieure${external.length ? ' : ' + external.join(', ') : ''}`);
  verifier(!errors.length, `aucune erreur${errors.length ? ' : ' + errors.slice(0, 4).join(' | ') : ''}`);
  await ctx.close();

  // 7. la mise en page à 320 px et sur ordinateur
  for (const [nom, vp, mob] of [['320', { width: 320, height: 640 }, true], ['bureau', { width: 1280, height: 800 }, false]]) {
    const errs = [], ext = [];
    const c2 = await contexte(browser, { viewport: vp, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob }); const q = await c2.newPage(); surveiller(q, errs, ext);
    await q.goto(L); await q.evaluate(semer, ileDe(9090, 'tropique', RICHE)); await q.reload(); await q.waitForTimeout(1500); await peupler(q, c2.archipel, 12);
    let deborde = 0; const mesurer = async () => { deborde = Math.max(deborde, await q.evaluate(() => document.documentElement.scrollWidth - innerWidth)); };
    verifier(await q.$eval('[data-onglet="ile"]', b => b.getAttribute('aria-current') === 'page'), `${nom} : au retour, l’île déjà commencée s’ouvre sur l’onglet Ton île`); await mesurer();
    await q.click('[data-onglet="deposer"]'); await q.waitForTimeout(400);
    await q.click('.opt:has-text("On m’a fait du mal")'); await q.waitForTimeout(600); await mesurer();
    await q.click('[data-onglet="ile"]'); await q.waitForTimeout(2000); await mesurer();
    await q.screenshot({ path: `${OUT}/7-${nom}-ile.png`, fullPage: true });
    await q.click('[data-onglet="archipel"]'); await q.waitForTimeout(3000); await mesurer();
    await q.screenshot({ path: `${OUT}/7-${nom}-archipel.png`, fullPage: true });
    verifier(deborde <= 0 && !errs.length && !ext.length, `${nom} : pas de défilement horizontal, aucune erreur`);
    await c2.close();
  }
  // 7 bis. un téléphone en mode sombre : l’application reste claire
  { const c5 = await contexte(browser, { viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const q = await c5.newPage();
    await q.goto(L); await q.waitForTimeout(500);
    const fond = await q.evaluate(() => getComputedStyle(document.body).backgroundColor);
    verifier(fond === 'rgb(246, 242, 234)', `en mode sombre, le fond reste clair (${fond})`);
    await c5.close(); }

  await browser.close();

  // 8. un appareil sans 3D
  const sans = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl'] });
  const c3 = await contexte(sans, { viewport: { width: 390, height: 844 } }); const s = await c3.newPage(); const e3 = [], x3 = []; surveiller(s, e3, x3);
  await s.goto(L); await s.evaluate(semer, ileDe(3131, 'prairie', RICHE)); await s.reload(); await s.waitForTimeout(600);
  verifier(await s.evaluate(() => !window.archipel.vue && document.querySelector('#ent').hidden), 'sans 3D : pas d’îlot, la page reste là');
  verifier(await s.evaluate(() => document.querySelector('[data-onglet="ile"]').getAttribute('aria-current') === 'page' && !!document.querySelector('.sans3d')), 'sans 3D : au retour, on retrouve aussi son île, en mots');
  await s.click('[data-onglet="deposer"]'); await s.waitForTimeout(300);
  await s.click('.opt:has-text("On m’a fait du mal")'); await s.click('[data-onglet="ile"]'); await s.waitForTimeout(500);
  verifier((await s.textContent('.sans3d')).includes('Cet appareil n’affiche pas la 3D'), 'sans 3D : l’île le dit, et la liste de ce qui a poussé reste');
  await s.click('[data-onglet="archipel"]'); await s.waitForTimeout(500);
  verifier((await s.textContent('.sans3d')).includes('l’archipel ne peut pas se montrer'), 'sans 3D : l’archipel le dit');
  await s.screenshot({ path: `${OUT}/8-sans3d.png`, fullPage: true });
  verifier(!e3.length, `sans 3D : aucune erreur${e3.length ? ' : ' + e3.slice(0, 3).join(' | ') : ''}`);
  await sans.close();

  // 9. les anciennes adresses : GitHub Pages sert 404.html ; on le simule
  const b4 = await chromium.launch(); const r = await (await contexte(b4, {})).newPage();
  const page404 = fs.readFileSync(path.join(RACINE, '404.html'), 'utf8');
  await r.route(/\/(limbes(-[a-z]+)?|maquettes|entites|nulle-part)(\/.*)?$/, route => route.fulfill({ status: 404, contentType: 'text/html', body: page404 }));
  for (const vieille of ['limbes/', 'limbes-e/', 'limbes-d/planche.html', 'maquettes/', 'entites/', 'limbes-b']) {
    await r.goto(BASE + vieille); await r.waitForURL(u => !/limbes|maquettes|entites/.test(u.toString()), { timeout: 3000 }).catch(() => {});
    verifier(r.url() === L, `${vieille} mène à l’accueil (${r.url().replace(BASE, '/')})`);
  }
  await r.goto(BASE + 'nulle-part/'); await r.waitForTimeout(300);
  verifier(r.url().endsWith('nulle-part/') && (await r.textContent('h1')).includes('n’existe pas') && (await r.textContent('a')).includes('l’archipel'), 'une adresse inconnue affiche la page introuvable, avec un lien vers l’archipel');
  await r.goto(BASE); await r.waitForTimeout(800);
  verifier(r.url() === L && (await r.textContent('.brand')).trim() === 'L’archipel', 'la racine du site est l’application elle-même');
  await b4.close();
  bilan();
})().catch(e => { console.error(e); process.exit(1); });
