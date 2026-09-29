// Les routes entre les îles : partager une île par un lien, le recevoir, garder l’île, tracer une route, la couper seul,
// fermer le lien, tout couper. Deux téléphones, un seul faux archipel en mémoire : les tests ne touchent jamais la vraie base.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, TELEPHONE, verifier, bilan, surveiller, archipelFactice, formeValide } = require('./commun');
const OUT = path.join(CAPTURES, 'routes'); fs.mkdirSync(OUT, { recursive: true });
const SECRET = 'Je ne l’ai jamais dit à personne, pas même à ma sœur.';
const depot = (id, sujets, extra = {}) => ({ id, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets, fait: [], subi: [] }, ...extra });
const ile = (id, depots) => ({ id, seed: 7100 + id, nee: new Date().toISOString(), biome: 'prairie', depots, envoyee: false, quittee: null });
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(50); return test(); };
const RESEAU = /Failed to fetch|net::ERR_|Failed to load resource/; // ce que la console dit d’une panne, ou d’un refus attendu de la base
const calme = e => e.filter(m => !RESEAU.test(m));
const lire = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent || '', sel);
const stockee = (p, cle = 'ile') => p.evaluate(k => JSON.parse(localStorage.getItem(`archipel:${k}`)), cle);
const cocherPuisPoser = async (p, cas) => { // une case, les questions jusqu’aux chemins, puis juste la poser
  await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
  await p.click(`.opt:has-text("${cas}")`);
  for (let i = 0; i < 6 && !(await p.$('.path')); i++) { await p.click('#app .btn'); await p.waitForTimeout(150); }
  await p.click('.path:has-text("Juste le poser")'); await p.waitForSelector('.sheet'); await p.click('.gesture:has-text("Poser sur l’île")'); await p.waitForTimeout(1200);
};
const feuille = async (p, action) => { await p.click(action); await p.waitForSelector('.sheet'); await p.waitForTimeout(200); return lire(p, '.sheet'); };
const fermerFeuille = async p => { await p.click('.sheet .foot-row .quiet'); await p.waitForSelector('.sheet', { state: 'detached' }); };

(async () => {
  const b = await chromium.launch({ args: GL }), a = archipelFactice(), appels = f => a.etat.appels.filter(y => !f || y.f === f);
  const telephone = async () => { const c = await b.newContext(TELEPHONE); await a.installer(c); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x); return { c, p, e, x }; };
  const A = await telephone(), B = await telephone();

  // 1. A partage son île, du bouton posé sur l’image ; pas encore dans l’archipel, la feuille le dit, et ce qui partirait ;
  //    un geste l’y met, puis la feuille du partage prévient d’abord ; rien ne part avant chaque geste
  await A.p.goto(BASE);
  await A.p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, JSON.stringify(ile(1, [depot(1, ['s4']), depot(2, ['s7'], { texte: true, contenu: SECRET })])));
  await A.p.reload(); await A.p.waitForTimeout(1200);
  verifier(await A.p.evaluate(() => !!document.querySelector('.ilewrap #partager-ile') && ![...document.querySelectorAll('.actions button')].some(b => /partager/i.test(b.textContent))), 'le bouton de partage est sur l’image de l’île');
  const mettre = await feuille(A.p, '#partager-ile');
  verifier(/doit d’abord être dans l’archipel/.test(mettre) && /Seule sa forme part/.test(mettre) && /Tu pourras l’en retirer/.test(mettre) && !appels().length, 'pas encore dans l’archipel : la feuille le dit, et ce qui partirait ; rien ne part');
  await A.p.click('.sheet .gesture:has-text("La mettre dans l’archipel, puis la partager")');
  await attendre(A.p, () => A.p.evaluate(() => !!document.querySelector('.sheet .avertir')), 10000);
  const idA = (await stockee(A.p)).archipel.id;
  verifier(!!idA && appels('archipel_poser').length === 1 && !appels('archipel_partager').length, 'un geste la met dans l’archipel, sa forme seulement ; la feuille du partage suit');
  const dit = await lire(A.p, '.sheet');
  verifier(/reconnaîtra ton île dans l’archipel/.test(dit) && /la verra grandir après chaque dépôt/.test(dit) && /quelqu’un de confiance/.test(dit), 'partager : la feuille prévient que le lien fait reconnaître l’île, et la voir grandir');
  verifier(/Une route n’est jamais définitive : chacune des deux îles peut la couper, seule, à tout moment\./.test(dit), 'et qu’une route n’est jamais définitive');
  verifier(!appels('archipel_partager').length, 'rien ne part avant « Créer le lien »');
  await A.p.screenshot({ path: path.join(OUT, '1-prevenir.png') });
  await A.p.click('.sheet .gesture:has-text("Créer le lien")'); await attendre(A.p, () => A.p.$('.sheet input.lien'));
  const lien = await A.p.$eval('.sheet input.lien', i => i.value), code = lien.split('#ile=')[1], envoi = appels('archipel_partager')[0];
  verifier(lien === `${BASE}#ile=${code}` && /^[A-Za-z0-9_-]{22}$/.test(code) && envoi?.c.p_code === code && envoi.c.p_ile === idA, `le lien porte un code tiré au hasard, derrière un # : il ne part vers aucun serveur de pages (${lien.slice(-30)})`);
  verifier((await stockee(A.p)).archipel.code === code, 'le téléphone garde le code, pour remontrer le lien');
  await attendre(A.p, () => A.p.evaluate(() => document.querySelector('.sheet canvas.qr')?.width > 100)); // dessiné : on le lit une fois
  const qr = await A.p.evaluate(() => { const c = document.querySelector('.sheet canvas.qr'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80) n++; return { w: c.width, n }; });
  verifier(qr?.w > 200 && qr.n > 2000, `le code à montrer est dessiné sur le téléphone (${qr?.w} pixels de côté)`);
  await A.p.screenshot({ path: path.join(OUT, '1-lien.png') });
  await fermerFeuille(A.p);

  // 2. B l’ouvre, sans rien sur son téléphone : l’île, et ce qu’une route veut dire ; le code quitte aussitôt l’adresse
  await B.p.goto(BASE); await B.p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); });
  await B.p.goto('about:blank'); const avantB = appels().length;
  await B.p.goto(lien);
  await attendre(B.p, () => B.p.evaluate(() => !!document.querySelector('.lien-dit') && !!window.archipel.vue?.d));
  const accueil = await B.p.evaluate(() => ({ h1: document.querySelector('h1').textContent, texte: document.querySelector('#app').textContent, adresse: location.href, onglet: document.querySelector('.onglets [aria-current]')?.dataset.onglet, vue: window.archipel.vue.d.ile.id }));
  verifier(accueil.h1 === 'Une île t’est confiée' && accueil.vue === idA && accueil.onglet === 'archipel', `le lien ouvre l’île confiée, en 3D (« ${accueil.h1} »)`);
  verifier(/Une route n’est jamais définitive : chacune des deux îles peut la couper, seule, à tout moment\./.test(accueil.texte), 'et dit, avant tout geste, qu’une route n’est jamais définitive');
  verifier(!accueil.adresse.includes('#') && !accueil.adresse.includes(code), 'le code quitte l’adresse aussitôt lu');
  verifier(appels().slice(avantB).every(y => y.f === 'archipel_voir'), 'ouvrir le lien ne fait que lire l’île');
  await B.p.screenshot({ path: path.join(OUT, '2-accueil.png') });

  // 3. B trace une route depuis son île en création : elle attend son île, rien ne part
  const route = await feuille(B.p, '#app .btn:has-text("Tracer une route")');
  verifier(/n’est pas encore dans l’archipel : la route l’attendra/.test(route) && /ni tes mots, ni ton nom/.test(route) && /jamais définitive/.test(route), 'tracer une route : son île n’est pas encore dans l’archipel, la route l’attendra');
  const avant3 = appels().length;
  await B.p.click('.sheet .gesture:has-text("Tracer la route")'); await B.p.waitForSelector('.sheet', { state: 'detached' });
  const ileB0 = await stockee(B.p), gardeesB = await stockee(B.p, 'gardees');
  verifier(ileB0.routesEnAttente?.join() === code && appels().length === avant3, 'la route attend sur le téléphone : aucun appel');
  verifier(gardeesB?.length === 1 && gardeesB[0].id === idA && gardeesB[0].code === code && formeValide(gardeesB[0].forme), 'l’île confiée est gardée ici, avec sa forme');
  verifier(/La route attend ton île/.test(await lire(B.p, '.lien-etat')), 'l’accueil le dit');

  // 4. B dépose, puis met son île dans l’archipel : la route part avec elle, et la feuille le disait
  await B.p.click('#app .quiet:has-text("continuer")'); await B.p.waitForTimeout(400);
  await cocherPuisPoser(B.p, 'On m’a fait du mal');
  const bache = await attendre(B.p, () => B.p.evaluate(() => { const g = window.archipel.vue.pontons; return !!g && g.children.some(o => o.userData.barque && o.userData.attente) && !g.getObjectByName('sillage'); }));
  verifier(bache, 'sur l’île de B, la route qui attend : un ponton, sa barque sous sa bâche, et aucun sillage encore');
  await B.p.screenshot({ path: path.join(OUT, '4-attente.png') });
  const carte = await lire(B.p, '.proposer p');
  verifier(/La route qui l’attend partira avec elle\./.test(carte), `la proposition dit que la route partira avec l’île (« …${carte.slice(-44)} »)`);
  await B.p.click('.proposer .btn:has-text("La mettre dans l’archipel")');
  await attendre(B.p, async () => a.etat.routes.size === 1 && !(await stockee(B.p)).routesEnAttente);
  const ileB = await stockee(B.p), idB = ileB.archipel?.id, relie = appels('archipel_relier')[0];
  verifier(a.etat.routes.size === 1 && [...a.etat.routes][0].split('|').sort().join() === [idA, idB].sort().join() && relie?.c.p_code === code && relie.c.p_ile === idB, 'la route part avec l’île, avec le code du lien');
  verifier(ileB.archipel.routes?.join() === idA && !ileB.routesEnAttente, 'le téléphone de B garde l’île au bout de sa route');

  // 5. A : une route est arrivée ; l’archipel la dessine, et son île le dit ensuite, même lue d’abord depuis l’archipel
  await A.p.click('[data-onglet="archipel"]'); await attendre(A.p, () => A.p.evaluate(() => !!window.archipel.vue.routes && window.archipel.arch.items.length === 2), 10000); await A.p.waitForTimeout(1200);
  const arch = await A.p.evaluate(async () => {
    const r = window.archipel.vue.routes, bq = r?.children.find(o => o.userData.barque), avant = bq?.position.clone();
    await new Promise(ok => setTimeout(ok, 1500));
    return { routes: window.archipel.arch.routes.length, trait: r?.getObjectByName('sillage')?.geometry.attributes.position.count || 0, barques: r?.children.filter(o => o.userData.barque).length, bouge: avant ? bq.position.distanceTo(avant) : 0 };
  });
  verifier(arch.routes === 1 && arch.trait >= 30, `l’archipel dessine la route entre les deux îles, en pointillé (${arch.trait / 6} traits)`);
  verifier(arch.barques === 1 && arch.bouge > .005, `une barque fait l’aller-retour sur la route (${arch.bouge.toFixed(3)} en une seconde et demie)`);
  await A.p.screenshot({ path: path.join(OUT, '5-archipel.png') });
  await A.p.click('[data-onglet="ile"]'); await attendre(A.p, () => A.p.evaluate(() => !!document.querySelector('#ile-routes')?.textContent));
  const vueA = await A.p.evaluate(() => ({ dit: document.querySelector('#ile-routes')?.textContent, bouton: document.querySelector('#les-routes .outil-dit')?.textContent, ligne: document.querySelector('#ile-line')?.textContent }));
  verifier(vueA.dit === 'Une route est arrivée jusqu’à ton île.' && vueA.bouton === '1' && /· 1 route$/.test(vueA.ligne), `l’île de A dit qu’une route est arrivée (« ${vueA.dit} »)`);
  const [pa, pb] = [a.etat.iles.find(y => y.ile === idA), a.etat.iles.find(y => y.ile === idB)], vise = Math.atan2(pb.z - pa.z, pb.x - pa.x);
  const ponton = await A.p.evaluate(() => { const g = window.archipel.vue.pontons, bq = g?.children.find(o => o.userData.barque); return bq ? { angle: Math.atan2(bq.position.z, bq.position.x), bache: bq.userData.attente, sillage: !!g.getObjectByName('sillage') } : null; });
  const ecartAngle = ponton ? Math.abs(Math.atan2(Math.sin(ponton.angle - vise), Math.cos(ponton.angle - vise))) : 9;
  verifier(!!ponton && !ponton.bache && ponton.sillage && ecartAngle < 1.3, `sur l’île de A, un ponton tourné vers l’île de B, sa barque, et le sillage qui part au large (${ecartAngle.toFixed(2)} radian d’écart)`);
  await A.p.screenshot({ path: path.join(OUT, '5-arrivee.png') });

  // 6. A coupe la route, seule, sans rien demander ; B le voit, et on lui dit que chacune peut le faire
  const routesA = await feuille(A.p, '#les-routes');
  verifier(/Une île avec/.test(routesA) && /jamais définitive/.test(routesA) && /Tout couper/i.test(routesA), 'ses routes : l’île au bout, et de quoi couper');
  await A.p.click('.sheet .quiet:has-text("couper cette route")'); await attendre(A.p, () => A.p.evaluate(() => /La route est coupée/.test(document.querySelector('.sheet [role=status]')?.textContent || '')));
  verifier(!a.etat.routes.size && appels('archipel_couper').at(-1)?.c.p_ile === idA, 'couper : A seule, avec son jeton, sans rien demander à B');
  await fermerFeuille(A.p);
  await B.p.click('[data-onglet="ile"]'); await attendre(B.p, () => B.p.evaluate(() => !!document.querySelector('#ile-routes')?.textContent));
  const coupeeB = await lire(B.p, '#ile-routes');
  verifier(coupeeB === 'Une route a été coupée. Chacune des deux îles peut le faire, à tout moment.' && !(await B.p.$('#les-routes')), `B l’apprend, avec des mots doux : « ${coupeeB} »`);
  verifier(await B.p.evaluate(() => !window.archipel.vue.pontons), 'et son ponton s’en va avec la route');

  // 7. A ferme le lien : il ne mène plus nulle part, pour B aussi, et l’île gardée le dit
  const avant7 = appels('archipel_partager').length;
  await feuille(A.p, '#partager-ile');
  await A.p.click('.sheet .quiet:has-text("fermer le lien")'); await attendre(A.p, () => A.p.evaluate(() => /Le lien est fermé/.test(document.querySelector('.sheet [role=status]')?.textContent || '')));
  verifier(appels('archipel_partager').length === avant7 + 1 && appels('archipel_partager').at(-1).c.p_code === null && !a.etat.partages.size && !(await stockee(A.p)).archipel.code, 'fermer le lien : la base l’oublie, le téléphone aussi');
  await fermerFeuille(A.p);
  await B.p.goto(lien); // l’app déjà ouverte : le lien arrive par l’adresse
  await attendre(B.p, () => B.p.evaluate(() => document.querySelector('h1')?.textContent === 'Ce lien ne mène plus nulle part'));
  verifier(await B.p.evaluate(() => !location.hash && /Une île peut toujours se refermer/.test(document.querySelector('#app').textContent)), 'B rouvre le lien : il ne mène plus nulle part, calmement');
  await B.p.click('#app .btn:has-text("Continuer")'); await B.p.waitForTimeout(300);
  await B.p.click('[data-onglet="archipel"]'); await B.p.waitForTimeout(600);
  const confiees = await feuille(B.p, '.actions .outil:has-text("Îles confiées")');
  verifier(/Son lien est fermé\./.test(confiees) && /Oublier une île ne coupe pas sa route/.test(confiees), 'l’île gardée dit que son lien est fermé');
  await fermerFeuille(B.p);

  // 8. un lien neuf ; B trace une route depuis une île déjà dans l’archipel ; puis A coupe tout : son île change de place
  await feuille(A.p, '#partager-ile');
  await A.p.click('.sheet .gesture:has-text("Créer le lien")'); await attendre(A.p, () => A.p.$('.sheet input.lien'));
  const lien2 = await A.p.$eval('.sheet input.lien', i => i.value), code2 = lien2.split('#ile=')[1];
  await fermerFeuille(A.p);
  verifier(code2 !== code && /^[A-Za-z0-9_-]{22}$/.test(code2), 'un lien neuf, un code neuf');
  await B.p.goto(lien2); await attendre(B.p, () => B.p.evaluate(() => document.querySelector('h1')?.textContent === 'Une île t’est confiée' && !!document.querySelector('#app .btn')));
  const route2 = await feuille(B.p, '#app .btn:has-text("Tracer une route")');
  const nomB = (await stockee(B.p)).nom;
  verifier(!!nomB && route2.includes(`La route reliera «\u202f${nomB}\u202f» à cette île.`), `depuis une île déjà dans l’archipel, la route part tout de suite ; la feuille dit l’île par son nom (${nomB})`);
  await B.p.click('.sheet .gesture:has-text("Tracer la route")'); await B.p.waitForSelector('.sheet', { state: 'detached' });
  verifier(a.etat.routes.size === 1 && /La route est tracée/.test(await lire(B.p, '.lien-etat')), 'la route est tracée, et l’accueil le dit');
  const placeAvant = (await stockee(A.p)).archipel;
  await A.p.click('[data-onglet="ile"]'); await A.p.waitForTimeout(600);
  await feuille(A.p, '#les-routes');
  await A.p.click('.sheet .quiet:has-text("tout couper, et déplacer ton île")');
  verifier(/qui l’avait repérée ne la retrouvera plus/.test(await lire(A.p, '.sheet .effacer')), 'tout couper : une seconde touche, qui dit ce qui va se passer');
  await A.p.click('.sheet .effacer .quiet:has-text("tout couper")'); await A.p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 });
  await attendre(A.p, async () => !!(await stockee(A.p)).archipel?.id);
  const placeApres = (await stockee(A.p)).archipel, ecart = Math.hypot(placeApres.x - placeAvant.x, placeApres.z - placeAvant.z);
  verifier(placeApres.id !== placeAvant.id && placeApres.jeton !== placeAvant.jeton && !a.etat.iles.some(y => y.ile === placeAvant.id) && a.etat.iles.some(y => y.ile === placeApres.id), 'tout couper : l’île revient sous un autre nom, avec un autre jeton');
  verifier(ecart > 4 && !a.etat.routes.size && !a.etat.partages.size && !placeApres.code && !placeApres.routes, `les routes et le lien ont disparu, et l’île a changé de place (${ecart.toFixed(1)} plus loin)`);
  verifier(await lire(A.p, 'h1') === 'Tout est coupé', 'la vue de l’île le dit');
  await A.p.screenshot({ path: path.join(OUT, '8-tout-coupe.png') });
  await B.p.goto(lien2); await attendre(B.p, () => B.p.evaluate(() => document.querySelector('h1')?.textContent === 'Ce lien ne mène plus nulle part'));
  verifier(true, 'pour B, le lien ne mène plus nulle part');

  // 9. rien que la forme, et rien sans un geste : ni texte, ni cases, ni dates, ni noms dans aucun appel
  const corps = appels().map(y => y.corps).join('\n');
  verifier(!corps.includes('sœur') && !/"(answers|depots|contenu|duTexte|sujets|date|nee|quad|texte|seed|biome)"/.test(corps) && !/"s\d{1,2}"/.test(corps), 'aucun appel ne porte de mots, de cases ni de dates');
  verifier(appels().every(y => !!y.entetes.apikey && !y.entetes.authorization && !y.entetes.referer), 'la clé publique seule, sans adresse d’origine');

  // 10. sans réseau : le lien le dit, et « Réessayer » marche au retour du réseau
  await feuille(A.p, '#partager-ile');
  await A.p.click('.sheet .gesture:has-text("Créer le lien")'); await attendre(A.p, () => A.p.$('.sheet input.lien'));
  const lien3 = await A.p.$eval('.sheet input.lien', i => i.value); await fermerFeuille(A.p);
  const n0 = B.e.length; a.etat.panne = true;
  await B.p.goto(lien3); await attendre(B.p, () => B.p.evaluate(() => /ne répond pas/.test(document.querySelector('#app .hint')?.textContent || '')));
  verifier(!!(await B.p.$('#app .btn:has-text("Réessayer")')), 'sans réseau, le lien le dit, et propose de réessayer');
  a.etat.panne = false;
  await B.p.click('#app .btn:has-text("Réessayer")'); await attendre(B.p, () => B.p.evaluate(() => !!document.querySelector('.lien-dit')));
  verifier(await lire(B.p, 'h1') === 'Une île t’est confiée', 'le réseau revenu, l’île arrive');
  const bruit = B.e.splice(n0);
  verifier(!calme(bruit).length, `pendant la panne, seulement la panne dans la console${calme(bruit).length ? ' : ' + calme(bruit).join(' | ') : ''}`);

  // 11. un lien vers sa propre île : c’est dit, sans rien proposer
  await A.p.goto(lien3); await attendre(A.p, () => A.p.evaluate(() => document.querySelector('h1')?.textContent === 'C’est ton île'));
  verifier(!(await A.p.$('#app .btn:has-text("Tracer une route")')) && !!(await A.p.$('#app .btn:has-text("Voir ton île")')), 'son propre lien : « C’est ton île », sans route à tracer');

  // 12. « J’ai reçu un lien », dans le menu Plus : coller le lien l’ouvre dans l’app, là où est son île ; autre chose, c’est dit
  await B.p.click('#app .quiet:has-text("continuer")'); await B.p.waitForTimeout(400);
  await B.p.click('[data-onglet="plus"]'); await B.p.waitForSelector('.sheet .row');
  const menu = await B.p.$$eval('.sheet .row', l => l.map(x => x.textContent.trim()));
  verifier(menu.includes('J’ai reçu un lien') && menu.includes('Les îles qu’on t’a confiées'), `le menu Plus propose « J’ai reçu un lien » (${menu.join(' · ')})`);
  await B.p.click('.sheet .row:has-text("J’ai reçu un lien")'); await B.p.waitForSelector('.sheet input.lien');
  await B.p.fill('.sheet input.lien', 'bonjour'); await B.p.click('.sheet .gesture:has-text("Ouvrir le lien")');
  verifier(/Ce n’est pas le lien d’une île/.test(await lire(B.p, '.sheet [role=status]')) && !!(await B.p.$('.sheet input.lien')), 'autre chose qu’un lien d’île : la feuille le dit, et reste ouverte');
  const avant12 = appels().length;
  await B.p.fill('.sheet input.lien', `  ${lien3}  `); await B.p.press('.sheet input.lien', 'Enter');
  await attendre(B.p, () => B.p.evaluate(() => document.querySelector('h1')?.textContent === 'Une île t’est confiée' && !!document.querySelector('.lien-dit')));
  verifier(await lire(B.p, 'h1') === 'Une île t’est confiée' && !(await B.p.$('.sheet')) && appels().slice(avant12).every(y => y.f === 'archipel_voir'), 'le lien collé ouvre l’île confiée, comme s’il était arrivé par l’adresse ; seule l’île est lue');
  await B.p.screenshot({ path: path.join(OUT, '12-colle.png') });

  for (const [nom, t] of [['A', A], ['B', B]]) {
    verifier(!t.x.length, `${nom} : aucune requête extérieure${t.x.length ? ' : ' + t.x.join(', ') : ''}`);
    verifier(!calme(t.e).length, `${nom} : aucune erreur${calme(t.e).length ? ' : ' + calme(t.e).slice(0, 4).join(' | ') : ''}`);
  }
  await b.close();
  bilan();
})().catch(e => { console.error(e); process.exit(1); });
