// Tes îles côte à côte : une nouvelle île posée à côté d’une île d’avant, par un pont ou collée à elle. Le lien reste sur ce
// téléphone ; dans l’archipel, les deux îles sont voisines, et seule leur place part. Un faux archipel en mémoire : les tests ne
// touchent jamais la vraie base.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller, contexte, peupler } = require('./commun');
const OUT = path.join(CAPTURES, 'voisines'); fs.mkdirSync(OUT, { recursive: true });
const depot = (id, sujets) => ({ id, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets, fait: [], subi: [] } });
const lire = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent || '', sel);
const stockee = p => p.evaluate(() => JSON.parse(localStorage.getItem('archipel:ile')));
const cocherPuisPoser = async (p, cas) => { // une case, les questions jusqu’aux chemins, puis juste la poser
  await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
  await p.click(`.opt:has-text("${cas}")`);
  for (let i = 0; i < 6 && !(await p.$('.path')); i++) { await p.click('#app .btn'); await p.waitForTimeout(150); }
  await p.click('.path:has-text("Juste le poser")'); await p.waitForSelector('.sheet'); await p.click('.gesture:has-text("Poser sur l’île")'); await p.waitForTimeout(1500);
};
// où est l’île d’aujourd’hui, et où elle devrait être : à côté de sa voisine, à la distance que leurs formes demandent
const place = p => p.evaluate(async () => {
  const { ecart, JEU, ECH_ARCH } = await import('./monde.js?v=26'), { deriver } = await import('./ile.js?v=13'), A = window.archipel, x = A.ile, v = x.voisine, P = v && A.iles.find(y => y.id === v.ile);
  if (!P) return null;
  const t = ecart(deriver(P).m, deriver(x).m, v.angle, JEU[v.mode]) * ECH_ARCH;
  return { mode: v.mode, angle: v.angle, t, attendu: [P.archipel.x + Math.cos(v.angle) * t, P.archipel.z + Math.sin(v.angle) * t], ici: x.archipel?.id ? [x.archipel.x, x.archipel.z] : null, P: [P.archipel.x, P.archipel.z] };
});
const vue = p => p.evaluate(() => { const v = window.archipel.vue; return { voisines: v.voisins?.children.filter(o => o.isGroup).length || 0, pont: !!v.voisins?.getObjectByName('pont') }; });

(async () => {
  const b = await chromium.launch({ args: GL });
  const c = await contexte(b), a = c.archipel, p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
  const appels = f => a.etat.appels.filter(y => !f || y.f === f);

  // 1. une île, mise dans l’archipel
  await p.goto(BASE);
  await peupler(p, a, 8);
  await p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, JSON.stringify({ id: 1, seed: 5151, nee: new Date().toISOString(), biome: 'automne', depots: [depot(1, ['s4']), depot(2, ['s11']), depot(3, ['s7'])], envoyee: false, quittee: null, nom: 'L’île aux Hérons' }));
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('#app .actions .outil:has-text("Mettre dans l’archipel")'); await p.waitForSelector('.sheet .gesture');
  await p.click('.sheet .gesture:has-text("Y mettre ton île")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 });
  const P = (await stockee(p)).archipel;
  verifier(!!P?.id, 'une île d’avant, mise dans l’archipel');

  // 2. changer d’île : la prochaine, à côté de celle-ci, par un pont ; rien ne part
  const avant2 = appels().length;
  await p.click('#app .actions .outil:has-text("changer d’île")'); await p.waitForSelector('.sheet .list.choix');
  const choix = await p.$$eval('.sheet .list.choix .row', l => l.map(r => r.firstChild.textContent));
  verifier(choix.join(' · ') === 'Non · Par un pont · Collée à côté' && await p.evaluate(() => document.querySelector('.sheet .list.choix .row[aria-pressed="true"]')?.firstChild.textContent === 'Non'), `changer d’île : la prochaine, à côté de celle-ci ? ${choix.join(' · ')} ; non, d’office`);
  await p.click('.sheet .list.choix .row:has-text("Par un pont")');
  const avis = await p.evaluate(() => [...document.querySelectorAll('.sheet p.tiny')].find(t => /voisines/.test(t.textContent) && !t.hidden)?.textContent || '');
  verifier(/qui reconnaît l’une pourra deviner que l’autre est à toi aussi/.test(avis) && /Le pont et les noms restent sur ce téléphone/.test(avis), 'choisi, un pont : la feuille dit ce que les autres pourront deviner, et ce qui reste ici');
  await p.screenshot({ path: path.join(OUT, '2-changer.png') });
  await p.click('.sheet .gesture:has-text("Commencer une nouvelle île")'); await p.waitForTimeout(2500);
  let s = await stockee(p);
  verifier(s.voisine?.ile === 1 && s.voisine.mode === 'pont' && Number.isFinite(s.voisine.angle) && /reliée par un pont à «\u202fL’île aux Hérons\u202f»/.test(await lire(p, '#ile-hint')), `la nouvelle île est reliée par un pont à celle d’avant : « ${await lire(p, '#ile-hint')} »`);
  let v = await vue(p);
  verifier(v.voisines === 1 && v.pont && !!(await p.$('#app .actions .outil:has-text("sa voisine")')), 'dans sa vue, l’île d’avant est là, au bout d’un pont de bois ; « sa voisine » est à portée');
  verifier(appels().length === avant2, 'relier deux îles ne fait rien partir');
  await p.screenshot({ path: path.join(OUT, '2-pont.png') });

  // 3. elle rejoint l’archipel : à côté de sa voisine, à la distance que leurs formes demandent ; seule sa place part
  await cocherPuisPoser(p, 'C’est arrivé récemment');
  await p.waitForSelector('.proposer .btn'); await p.click('.proposer .btn'); await p.waitForSelector('.proposer .voir', { timeout: 10000 });
  let q = await place(p);
  const pose = appels('archipel_poser').pop().c;
  verifier(!!q.ici && Math.hypot(q.ici[0] - q.attendu[0], q.ici[1] - q.attendu[1]) < .01 && Math.abs(pose.p_x - q.ici[0]) < 1e-3 && Math.abs(pose.p_z - q.ici[1]) < 1e-3, `dans l’archipel, elle se pose à côté de sa voisine, à ${q.t.toFixed(2)} de son centre`);
  s = await stockee(p);
  const serveur = a.etat.iles.filter(i => i.ile !== P.id && i.ile !== s.archipel.id);
  const chevauche = await p.evaluate(([ici, autres]) => autres.some(o => Math.hypot(o.x - ici[0], o.z - ici[1]) < 1.2), [q.ici, serveur.map(i => ({ x: i.x, z: i.z }))]);
  verifier(!chevauche, 'sans se poser sur une autre île');
  verifier(appels().every(y => !/voisine|pont|collee|Hérons/i.test(y.corps)), 'aucune requête ne dit le lien, ni un nom');

  // 4. l’archipel, sur ce téléphone : le pont entre les deux ; la légende le dit
  await p.click('[data-onglet="archipel"]'); await p.waitForFunction(() => window.archipel.arch.lu, null, { timeout: 10000 }); await p.waitForTimeout(2000);
  const arch = await p.evaluate(() => { const A = window.archipel, it = A.arch.items.find(i => i.mine && i.ile === A.ile), v = A.vue, w = it.grp.position.clone(); w.project(v.camera); const r = v.canvas.getBoundingClientRect(); return { ponts: v.ponts?.children.length || 0, x: r.left + (w.x + 1) / 2 * r.width, y: r.top + (1 - w.y) / 2 * r.height }; });
  verifier(arch.ponts === 1, 'dans l’archipel, sur ce téléphone, un pont relie les deux îles');
  await p.screenshot({ path: path.join(OUT, '4-archipel.png') });
  await p.mouse.click(arch.x, arch.y); await p.waitForTimeout(1500);
  const legende = await lire(p, '#arch-caption');
  verifier(/Reliée par un pont à «\u202fL’île aux Hérons\u202f»/.test(legende) && await p.evaluate(() => { const A = window.archipel, it = A.arch.items.find(i => i.mine && i.ile === A.ile); return it.lab && !it.lab.visible; }), `approchée, la légende dit le pont, et son nom ne flotte plus au-dessus d’elle : « ${legende.slice(0, 80)}… »`);
  await p.screenshot({ path: path.join(OUT, '4-pres.png') });

  // 5. elle grandit : sa place suit sa taille, avec son jeton ; rien d’autre que sa place. Tant que ce qui pousse ne l’approche
  //    pas de sa voisine, elle ne bouge pas ; on dépose jusqu’à ce qu’elle doive bouger
  const avant5 = appels().length; let bouge = [], n5 = 0, justes = true;
  await p.click('[data-onglet="ile"]'); await p.waitForTimeout(600);
  for (const cas of ['Ça tourne en boucle dans ma tête', 'C’est lourd depuis longtemps', 'Il y a quelque chose que je n’ai jamais dit', 'C’est arrivé récemment']) {
    await cocherPuisPoser(p, cas); await p.waitForTimeout(1500); n5++;
    q = await place(p); justes &&= Math.hypot(q.ici[0] - q.attendu[0], q.ici[1] - q.attendu[1]) < .01;
    bouge = appels().slice(avant5).filter(y => y.f === 'archipel_deplacer');
    if (bouge.length) break;
  }
  verifier(justes && bouge.length === 1 && Object.keys(bouge[0].c).sort().join() === 'p_ile,p_jeton,p_x,p_z', `elle a grandi, ${n5} dépôt${n5 > 1 ? 's' : ''} : sa place suit, pour rester au bout de son pont (${q.t.toFixed(2)} du centre de sa voisine) ; seule sa place part`);
  const srv = a.etat.iles.find(i => i.ile === s.archipel.id);
  verifier(Math.abs(srv.x - q.ici[0]) < 1e-3 && Math.abs(srv.z - q.ici[1]) < 1e-3, 'le serveur a sa nouvelle place');

  // 6. sa voisine : la relier autrement, collée à côté ; elle vient se poser contre elle
  const avant6 = appels().length, t6 = q.t;
  await p.click('#app .actions .outil:has-text("sa voisine")'); await p.waitForSelector('.sheet .list.choix');
  await p.screenshot({ path: path.join(OUT, '6-voisine.png') });
  await p.click('.sheet .list.choix .row:has-text("Collée à côté")'); await p.click('.sheet .gesture:has-text("La relier ainsi")');
  await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(1500);
  q = await place(p); v = await vue(p);
  verifier(q.mode === 'collee' && q.t < t6 && appels().slice(avant6).filter(y => y.f === 'archipel_deplacer').length === 1 && Math.hypot(q.ici[0] - q.attendu[0], q.ici[1] - q.attendu[1]) < .01, `collée à côté : elle vient contre sa voisine (${q.t.toFixed(2)} au lieu de ${t6.toFixed(2)})`);
  verifier(await lire(p, '#app h1') === 'Côte à côte' && v.voisines === 1 && !v.pont, 'sa vue le dit : côte à côte, sans pont');
  await p.screenshot({ path: path.join(OUT, '6-collee.png') });

  // 7. l’île d’avant, regardée : la nouvelle est à côté d’elle
  await p.click('#app .actions .outil:has-text("tes îles d’avant")'); await p.waitForSelector('.sheet .list .row');
  await p.click('.sheet .list .row:has-text("L’île aux Hérons")'); await p.waitForTimeout(1500);
  v = await vue(p);
  verifier(await lire(p, '#app h1') === 'L’île aux Hérons' && v.voisines === 1, 'l’île d’avant, regardée : la nouvelle est collée à elle');
  await p.click('#app .actions .btn:has-text("Revenir à ton île")'); await p.waitForTimeout(800);

  // 8. la détacher : elle reste à sa place dans l’archipel, et n’a plus de voisine
  const avant8 = appels().length, ici8 = (await stockee(p)).archipel;
  await p.click('#app .actions .outil:has-text("sa voisine")'); await p.waitForSelector('.sheet .effacer');
  await p.click('.sheet .effacer .quiet:has-text("la détacher")'); await p.waitForTimeout(150);
  verifier(/Dans l’archipel, elle reste où elle est/.test(await lire(p, '.sheet .effacer')), 'la détacher : une seconde touche, et la feuille dit qu’elle reste à sa place');
  await p.click('.sheet .effacer .quiet:has-text("la détacher")'); await p.waitForSelector('.sheet', { state: 'detached' }); await p.waitForTimeout(1200);
  s = await stockee(p); v = await vue(p);
  verifier(!s.voisine && v.voisines === 0 && s.archipel.x === ici8.x && s.archipel.z === ici8.z && appels().length === avant8 && !!(await p.$('#app .actions .outil:has-text("Relier")')), 'détachée : plus de voisine, la même place, rien n’est parti');

  // 9. la relier de nouveau, par un pont ; puis tout couper : ailleurs, elle n’est plus à côté d’elle
  await p.click('#app .actions .outil:has-text("Relier")'); await p.waitForSelector('.sheet .list.choix');
  await p.click('.sheet .gesture:has-text("La relier")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(1200);
  q = await place(p);
  verifier(q.mode === 'pont' && Math.hypot(q.ici[0] - q.attendu[0], q.ici[1] - q.attendu[1]) < .01, 'reliée de nouveau, par un pont : elle revient au bout de son pont');
  await p.click('#partager-ile'); await p.waitForSelector('.sheet .avertir');
  verifier(/Il pourra aussi deviner que ses voisines sont à toi/.test(await lire(p, '.sheet .avertir')), 'partager une île reliée : la feuille prévient que ses voisines se devineront');
  await p.click('.sheet .gesture:has-text("Créer le lien")'); await p.waitForSelector('.sheet input.lien'); await p.click('.sheet .foot-row .quiet'); await p.waitForSelector('.sheet', { state: 'detached' });
  await p.click('#les-routes'); await p.waitForSelector('.sheet .effacer');
  await p.click('.sheet .effacer .quiet:has-text("tout couper")'); await p.waitForTimeout(150);
  verifier(/Elle ne sera plus à côté de tes autres îles/.test(await lire(p, '.sheet .effacer')), 'tout couper : la feuille dit qu’elle ne sera plus à côté de ses îles');
  await p.click('.sheet .effacer .quiet:text-is("tout couper")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(2000);
  s = await stockee(p);
  verifier(!s.voisine && s.archipel?.id && Math.hypot(s.archipel.x - P.x, s.archipel.z - P.z) > 3, 'tout coupé : elle est ailleurs, et n’est plus reliée à sa voisine');

  // 10. un lien abîmé est laissé de côté
  await p.evaluate(() => { const i = JSON.parse(localStorage.getItem('archipel:ile')); i.voisine = { ile: i.id, mode: 'pont', angle: 1 }; localStorage.setItem('archipel:ile', JSON.stringify(i)); const l = JSON.parse(localStorage.getItem('archipel:iles')); l[0].voisine = { ile: 99, mode: 'autre', angle: 'x' }; localStorage.setItem('archipel:iles', JSON.stringify(l)); });
  await p.reload(); await p.waitForTimeout(1500);
  verifier(await p.evaluate(() => !window.archipel.ile.voisine && !window.archipel.iles[0].voisine && !window.archipel.vue.voisins), 'un lien vers elle-même, ou abîmé, est laissé de côté');

  verifier(!e.length && !x.length, `aucune erreur, aucune requête vers l’extérieur${e.length ? ' : ' + e.join(' | ') : ''}${x.length ? ' ; ' + x.join(', ') : ''}`);
  await b.close();
  bilan();
})().catch(err => { console.error(err); process.exit(1); });
