// Le nom de ton île : tiré au hasard, sans rien dire de ce qu’elle porte, ou écrit à la main. Il remplace les dates, reste
// sur ce téléphone, et ne part jamais dans l’archipel. Un faux archipel en mémoire : les tests ne touchent jamais la vraie base.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller, contexte, peupler } = require('./commun');
const OUT = path.join(CAPTURES, 'noms'); fs.mkdirSync(OUT, { recursive: true });
const depot = (id, sujets) => ({ id, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets, fait: [], subi: [] } });
const ile = (id, depots, extra = {}) => ({ id, seed: 6300 + id, nee: new Date().toISOString(), biome: 'prairie', depots, envoyee: false, quittee: null, ...extra });
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(50); return test(); };
const lire = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent || '', sel);
const stock = p => p.evaluate(() => ({ ile: JSON.parse(localStorage.getItem('archipel:ile') || 'null'), iles: JSON.parse(localStorage.getItem('archipel:iles') || '[]') }));
const semer = (p, s) => p.evaluate(s => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(`archipel:${k}`, JSON.stringify(v)); }, s);
const NOM = 'Le refuge du soir';

(async () => {
  const b = await chromium.launch({ args: GL });
  const c = await contexte(b), a = c.archipel, p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
  const appels = () => a.etat.appels;

  // 1. des îles d’avant la mise à jour, sans nom : chacune en reçoit un, tiré de la liste, jamais deux fois le même ; il est gardé
  await p.goto(BASE);
  await semer(p, { ile: ile(3, [depot(1, ['s4']), depot(2, ['s11'])]), iles: [ile(1, [depot(1, ['s7'])], { quittee: new Date().toISOString() }), ile(2, [depot(1, ['s0'])], { quittee: new Date().toISOString(), nom: 12 })] });
  await p.reload(); await p.waitForTimeout(1500);
  const liste = await p.evaluate(() => window.archipel.nomsIles);
  let s = await stock(p);
  const noms = [s.ile?.nom, ...s.iles.map(y => y.nom)];
  verifier(liste.length >= 40 && new Set(liste).size === liste.length && liste.every(n => n.length <= 40), `une liste de ${liste.length} noms, tous différents`);
  verifier(noms.every(n => liste.includes(n)) && new Set(noms).size === 3, `sans nom, ou avec un nom illisible, chaque île en reçoit un de la liste, jamais deux fois le même : ${noms.join(' · ')}`);
  verifier(await lire(p, '#app h1') === s.ile.nom && await lire(p, '#app .step') === 'Ton île, aujourd’hui', `la vue de l’île a son nom pour titre : « ${s.ile.nom} »`);
  verifier(liste.every(n => !/arbre|pierre|maison|champ|pluie|orage|fleur|étang|phare|lanterne|caillou|feu|mousse|barque|pont|puits|moulin/i.test(n)), 'aucun nom de la liste ne parle de ce qui pousse sur une île');
  await p.reload(); await p.waitForTimeout(800);
  const s2 = await stock(p);
  verifier(s2.ile.nom === s.ile.nom && s2.iles.map(y => y.nom).join() === s.iles.map(y => y.nom).join() && await lire(p, '#app h1') === s.ile.nom, 'rouverte, chaque île garde son nom');
  verifier(!appels().length, 'rien n’est parti');
  await p.screenshot({ path: path.join(OUT, '1-titre.png') });

  // 2. la renommer : un autre nom, au hasard, jamais celui d’une autre de ses îles ; ou un nom écrit à la main, nettoyé
  await p.click('#app .actions .outil:has-text("la renommer")'); await p.waitForSelector('.sheet .nommer input');
  const feuille = await lire(p, '.sheet');
  verifier(/Le nom de ton île/.test(feuille) && /Personne d’autre ne le voit, même quand ton île est dans l’archipel/.test(feuille) && await p.inputValue('.sheet .nommer input') === s.ile.nom, 'la renommer : la feuille dit que le nom reste ici, et montre le nom d’aujourd’hui');
  const tires = [];
  for (let i = 0; i < 12; i++) { await p.click('.sheet .quiet:has-text("un autre nom")'); tires.push(await p.inputValue('.sheet .nommer input')); }
  verifier(tires.every((n, i) => liste.includes(n) && n !== (i ? tires[i - 1] : s.ile.nom) && !s.iles.some(y => y.nom === n)), `« un autre nom » en tire un autre de la liste, jamais celui d’une autre de ses îles (${tires.slice(0, 3).join(' · ')}…)`);
  await p.screenshot({ path: path.join(OUT, '2-renommer.png') });
  await p.fill('.sheet .nommer input', '   '); await p.click('.sheet .gesture:has-text("Garder ce nom")'); await p.waitForTimeout(200);
  verifier(!!(await p.$('.sheet')) && /Écris un nom/.test(await lire(p, '.sheet [role="status"]')) && (await stock(p)).ile.nom === s.ile.nom, 'un nom vide n’est pas gardé : la feuille le dit');
  await p.fill('.sheet .nommer input', `  Le\u200b refuge \u202e  du soir  `);
  await p.click('.sheet .gesture:has-text("Garder ce nom")'); await p.waitForSelector('.sheet', { state: 'detached' });
  s = await stock(p);
  verifier(s.ile.nom === NOM && await lire(p, '#app h1') === NOM, `un nom écrit à la main, nettoyé des signes invisibles et des espaces en trop : « ${s.ile.nom} »`);
  verifier(!appels().length, 'renommer ne fait rien partir');

  // 3. un nom trop long, ou abîmé, se relit en une ligne de quarante signes au plus
  await semer(p, { ile: { ...s.ile, nom: `\u0007 Une île\n\n au nom ${'très '.repeat(20)}long` }, iles: s.iles });
  await p.reload(); await p.waitForTimeout(800);
  const long = await lire(p, '#app h1');
  verifier(long.startsWith('Une île au nom très très') && [...long].length <= 40 && !/[\u0000-\u001f]/.test(long), `un nom abîmé se relit en une ligne, coupé à quarante signes : « ${long} »`);
  await semer(p, s); await p.reload(); await p.waitForTimeout(800);

  // 4. les îles d’avant : chacune par son nom, sans date ; regardée, elle a son nom pour titre, et se renomme aussi
  await p.click('#app .actions .outil:has-text("tes îles d’avant")'); await p.waitForSelector('.sheet .list .row');
  const rangs = await p.$$eval('.sheet .list .row', l => l.map(r => r.firstChild.textContent));
  verifier(rangs.join() === [...s.iles].reverse().map(y => y.nom).join() && !(await lire(p, '.sheet')).match(/\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/), `tes îles d’avant, par leur nom, sans date : ${rangs.join(' · ')}`);
  await p.click('.sheet .list .row >> nth=0'); await p.waitForTimeout(1000);
  const avant = s.iles[s.iles.length - 1];
  verifier(await lire(p, '#app h1') === avant.nom && await lire(p, '#app .step') === 'Une île d’avant' && (await lire(p, '#ile-hint')).startsWith('Elle ne pousse plus'), `une île d’avant a son nom pour titre : « ${avant.nom} »`);
  await p.click('#app .actions .outil:has-text("la renommer")'); await p.waitForSelector('.sheet .nommer input');
  await p.fill('.sheet .nommer input', 'L’île des premiers jours'); await p.press('.sheet .nommer input', 'Enter'); await p.waitForSelector('.sheet', { state: 'detached' });
  s = await stock(p);
  verifier(await lire(p, '#app h1') === 'L’île des premiers jours' && s.iles[s.iles.length - 1].nom === 'L’île des premiers jours' && s.ile.nom === NOM, 'renommée, l’île d’avant garde son nouveau nom ; celle d’aujourd’hui garde le sien');
  await p.click('#app .actions .btn:has-text("Revenir à ton île")'); await p.waitForTimeout(600);

  // 5. l’archipel : seule sa forme part ; son nom, dessiné ici seulement, est sur l’eau au-dessus d’elle
  await peupler(p, a, 6);
  await p.click('#app .actions .outil:has-text("la mettre dans l’archipel")'); await p.waitForSelector('.sheet .gesture');
  await p.click('.sheet .gesture:has-text("Y mettre ton île")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 });
  const envoi = appels().find(y => y.f === 'archipel_poser');
  verifier(!!envoi && appels().every(y => !y.corps.includes('refuge') && !y.corps.includes('premiers jours') && !Object.keys(y.c).some(k => /nom/i.test(k))), `dans l’archipel, seule sa forme part : ni son nom, ni celui d’une autre de ses îles (${appels().length} requêtes relues)`);
  await p.click('[data-onglet="archipel"]'); await p.waitForFunction(() => window.archipel.arch.lu, null, { timeout: 10000 }); await p.waitForTimeout(2000);
  const la = await p.evaluate(() => { const it = window.archipel.arch.items.find(i => i.mine), v = window.archipel.vue, w = it.grp.position.clone(); w.project(v.camera); const r = v.canvas.getBoundingClientRect(); return { label: it.label, large: it.lab?.material.map.image.width, x: r.left + (w.x + 1) / 2 * r.width, y: r.top + (1 - w.y) / 2 * r.height }; });
  verifier(la.label === NOM && la.large > 256, `dans l’archipel, sur ce téléphone, son nom flotte au-dessus d’elle (« ${la.label} », ${la.large} pixels de large)`);
  await p.mouse.click(la.x, la.y); await p.waitForTimeout(1500);
  const legende = await lire(p, '#arch-caption');
  verifier(legende.startsWith(`La tienne, «\u202f${NOM}\u202f»`), `la toucher la désigne par son nom : « ${legende.slice(0, 60)}… »`);
  await p.screenshot({ path: path.join(OUT, '5-archipel.png') });

  // 6. changer d’île : la prochaine reçoit un nom tiré au hasard, qu’on garde ou qu’on change ; celles d’avant gardent le leur
  await p.click('[data-onglet="ile"]'); await p.waitForTimeout(800);
  await p.click('#app .actions .outil:has-text("changer d’île")'); await p.waitForSelector('.sheet .nommer input');
  const propose = await p.inputValue('.sheet .nommer input'), pris = [s.ile.nom, ...s.iles.map(y => y.nom)];
  verifier(liste.includes(propose) && !pris.includes(propose) && /Il reste sur ce téléphone/.test(await lire(p, '.sheet')), `la prochaine île a déjà un nom, tiré au hasard, jamais celui d’une autre : « ${propose} »`);
  await p.click('.sheet .quiet:has-text("un autre nom")');
  const autre = await p.inputValue('.sheet .nommer input');
  verifier(autre !== propose && liste.includes(autre) && !pris.includes(autre), `un autre nom, au hasard : « ${autre} »`);
  await p.screenshot({ path: path.join(OUT, '6-changer.png') });
  await p.fill('.sheet .nommer input', 'La petite dernière'); await p.click('.sheet .gesture:has-text("Commencer une nouvelle île")'); await p.waitForTimeout(1000);
  s = await stock(p);
  verifier(s.ile.nom === 'La petite dernière' && await lire(p, '#app .step') === 'La petite dernière' && await lire(p, '#app h1') === 'Une île vide' && s.iles.map(y => y.nom).join() === [...pris.slice(1), NOM].join(), 'la nouvelle île porte le nom choisi ; celles d’avant gardent le leur');
  const compte = await p.evaluate(() => [...document.querySelectorAll('#app details')].find(d => d.textContent.includes('Ce qui serait compté'))?.textContent || '');
  verifier(!!compte && !compte.includes(NOM) && !compte.includes('petite dernière') && !compte.includes('premiers jours'), 'ce qui serait compté ne dit jamais un nom');

  verifier(!e.length && !x.length, `aucune erreur, aucune requête vers l’extérieur${e.length ? ' : ' + e.join(' | ') : ''}${x.length ? ' ; ' + x.join(', ') : ''}`);
  await c.close();

  // 7. sans 3D : le nom est là aussi, et se change de même
  const sans = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl'] });
  const c2 = await contexte(sans), p2 = await c2.newPage(), e2 = [], x2 = []; surveiller(p2, e2, x2);
  await p2.goto(BASE); await semer(p2, { ile: ile(5, [depot(1, ['s4'])], { nom: 'Mon île sans 3D' }) }); await p2.reload(); await p2.waitForTimeout(800);
  await p2.click('#app .actions .outil:has-text("la renommer")'); await p2.waitForSelector('.sheet .nommer input');
  await p2.fill('.sheet .nommer input', 'Toujours là'); await p2.click('.sheet .gesture:has-text("Garder ce nom")'); await p2.waitForSelector('.sheet', { state: 'detached' });
  verifier(await lire(p2, '#app h1') === 'Toujours là' && !e2.length && !x2.length, `sans 3D, le nom se lit et se change de même${e2.length ? ' : ' + e2.join(' | ') : ''}`);
  await sans.close();

  await b.close();
  bilan();
})().catch(err => { console.error(err); process.exit(1); });
