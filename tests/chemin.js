// Le chemin : un journal dont chaque page devient un bout de chemin, peint à l’aquarelle. L’intro qui se dessine pendant que
// tout se prépare ; la première page, gardée sur le téléphone ; un long texte, découpé en passages d’environ 14 mots porteurs ;
// les tuiles peintes, gardées, qui reviennent sans repeindre ; l’app qui s’ouvre sans réseau ; et l’archipel, sur le même site,
// dont les caches restent à lui. Rien ne part.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { OUT: CAPTURES, GL, TELEPHONE, verifier, bilan, surveiller, servir } = require('./commun');
const OUT = path.join(CAPTURES, 'chemin'); fs.mkdirSync(OUT, { recursive: true });
const PEINTURE = 240000; // sans carte graphique, le pinceau est lent
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(100); return test(); };
const calme = e => e.filter(m => !/Failed to fetch|net::ERR_|Failed to load resource|fetching the script/.test(m)); // ce que la console dit d’un réseau coupé exprès
const tuiles = p => p.$$eval('.tuile', l => l.map(t => ({ nom: t.querySelector('.date').textContent, peinte: t.classList.contains('peinte') && !!t.querySelector('img[src]'), source: t.dataset.source || '' })));
const PAGE = 'Balade en forêt avec ma sœur. Des champignons partout, l’odeur de la mousse après la pluie. On a vu un chevreuil près du ruisseau.';
// un long texte : trois chapitres, des paragraphes, un dialogue ; de quoi faire plusieurs tuiles par chapitre
const LONG = `Chapitre I

Le matin, nous sommes partis dans la forêt. Les chênes et les hêtres formaient une voûte au-dessus du sentier, et la mousse couvrait les rochers.

Un écureuil a traversé devant nous. Plus loin, des champignons poussaient au pied d’une souche, près d’un tronc couché par l’orage.

Nous avons suivi le ruisseau jusqu’à une cabane de bûcherons. Le bois coupé sentait la résine, une hache était plantée dans un billot.

À midi, pique-nique sur une pierre plate : du pain, du fromage, des pommes. Un chevreuil nous regardait depuis les fougères.

Le soir, la lanterne accrochée à la porte de la cabane éclairait les branches des sapins, et un hibou chantait.

Chapitre II

Le lendemain, la route descendait vers la mer. Au port, les bateaux de pêche rentraient, et les mouettes tournaient autour des filets.

— Tu veux faire un tour en barque ?
— Oui, si la mer reste calme.
— Alors prends les rames, je prends le seau et les cannes à pêche.
— Et le chapeau, le soleil tape fort.
— Le chapeau aussi.

Nous avons ramé jusqu’à la plage d’en face. Le sable était chaud, les vagues roulaient les galets, un voilier passait au loin près du phare.

Sur la plage, des enfants construisaient un château de sable avec une pelle et un seau. Un crabe s’est caché sous un rocher.

Au retour, le pêcheur nous a donné des poissons et des moules, que nous avons cuits sur un feu de bois flotté.

Chapitre III

Puis ce fut la ville. Le train est entré en gare, et nous avons pris le tramway jusqu’au marché couvert.

Les étals débordaient de légumes, de tomates, de carottes et de fromages. Le boulanger vendait des croissants et des baguettes.

Dans la rue, les voitures et les vélos se croisaient devant la boulangerie, la librairie et le café, sous les réverbères.

Le soir, à l’hôtel, la chambre donnait sur les toits. Un lit, une lampe, une table, et un livre ouvert près de la fenêtre.

Avant de dormir, j’ai écrit une lettre à ma mère, sur le bureau, avec un stylo emprunté à la réception.`;

(async () => {
  const b = await chromium.launch({ args: GL }), local = await servir(), BASE = local.base; // son propre serveur, pour pouvoir le couper
  const c = await b.newContext(TELEPHONE), p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
  const aujourdhui = await p.evaluate(() => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }));

  // 1. l’arrivée : le chemin se dessine au pinceau pendant que tout se prépare, puis s’efface de lui-même
  await p.goto(BASE + 'chemin/');
  const intro = await p.evaluate(() => { const i = document.querySelector('#intro'); return { la: !i.hidden && getComputedStyle(i).opacity !== '0', trace: i.classList.contains('trace'), traits: i.querySelectorAll('.trait').length, nom: i.querySelector('.nom').textContent }; });
  verifier(intro.la && intro.trace && intro.traits >= 5 && intro.nom === 'Le chemin', `à l’arrivée, l’intro : le chemin se trace au pinceau (${intro.traits} traits), sous son nom`);
  await p.screenshot({ path: path.join(OUT, 'intro.png') });
  await attendre(p, () => p.evaluate(() => document.querySelector('#intro').hidden), 30000);
  const vide = await p.evaluate(() => ({ dit: document.querySelector('#dit').textContent, vu: localStorage.getItem('chemin:vu') }));
  verifier(vide.dit.includes('Écris ta première page') && vide.vu === '1', `l’intro s’efface d’elle-même ; sans page, l’app invite à écrire (« ${vide.dit} »)`);
  let t = await tuiles(p);
  verifier(t.length === 1 && t[0].nom === 'Le départ', 'le chemin commence par une tuile : « Le départ »');
  await attendre(p, async () => (await tuiles(p))[0].peinte, PEINTURE);
  const depart = await p.evaluate(() => { const i = document.querySelector('.tuile img'); return { w: i.naturalWidth, h: i.naturalHeight, source: i.closest('.tuile').dataset.source }; });
  verifier(depart.w === 1273 && depart.h === 1000 && depart.source === 'pinceau', `la tuile du départ est peinte, au pinceau (${depart.w} × ${depart.h})`);

  // 2. le découpage, dans la page : une page courte reste entière ; les dates, les séparateurs coupent
  const d = await p.evaluate(async () => {
    const { decouper } = await import('./sens.js?v=4'), S = window.chemin.S;
    return {
      court: decouper(S, 'Café au soleil sur le balcon, le chat dort sur le canapé.').length, vide: decouper(S, '  \n ').length,
      dates: decouper(S, 'Lundi 3 mars\n\nRéveil difficile, métro bondé, bureau, réunion.\n\nMardi 4 mars\n\nRien.\n\nMercredi 5 mars\n\nForêt, champignons, mousse.').map(x => x.titre),
      separateur: decouper(S, 'La mer, le sable, un bateau.\n\n* * *\n\nLa forêt, les arbres, la mousse.').length,
      lignes: decouper(S, 'une ligne avec un vélo\nune ligne avec un chien\nune ligne avec un bateau').length,
      verne: decouper(S, 'M. Fogg prit le train à Londres. Il emporta un sac et un parapluie. J. Passepartout le suivait avec la valise.').length,
    };
  });
  verifier(d.court === 1 && d.vide === 0 && d.lignes === 1 && d.verne === 1, 'une page courte, même sans ponctuation, ou avec « M. Fogg », reste d’un seul tenant ; un texte vide ne fait rien');
  verifier(d.dates.join(' | ') === 'Lundi 3 mars | Mardi 4 mars | Mercredi 5 mars' && d.separateur === 2, `les dates et les séparateurs coupent : un jour, un passage, même vide (${d.dates.join(', ')})`);

  // 2 bis. au-delà des choses : un verbe conjugué trouve sa pose, le temps qu’il fait change le ciel, les mots mènent ailleurs
  const v = await p.evaluate(async () => {
    const { lirePage, objetsDeLaPage, lieuDeLaPage } = await import('./sens.js?v=4'), { climatDe, planifier } = await import('./monde.js?v=3'), S = window.chemin.S, F = window.chemin.F;
    const lire = t => { const l = lirePage(S, t), o = objetsDeLaPage(S, l); return { l, o, mots: l.mots.map(x => x.m), lieu: lieuDeLaPage(l, o) }; };
    const mer = lire('Une baleine au loin, des mouettes dans le ciel, et nous avons nagé.');
    const plan = planifier({ i: 0, date: '2026-07-01', lieu: 'rivage', objets: mer.o, climat: climatDe(mer.l) }, null, F, new Map());
    const champs = planifier({ i: 1, date: '2026-07-02', lieu: 'champs', objets: mer.o, climat: climatDe(mer.l) }, null, F, new Map());
    return { dormi: lire('Hier soir, j’ai dormi longtemps.').mots, marche: lire('J’ai marché jusqu’au marché.').mots, lit: lire('Il lit dans son lit.').mots,
      pluie: climatDe(lire('Il pleut, une averse, nous sommes trempés.').l).meteo, neige: climatDe(lire('Il neigeait, des flocons partout.').l),
      nuit: climatDe(lire('La nuit, les étoiles.').l).meteo, desert: lire('Le désert, le sable, les dunes, un chameau près de l’oasis.').lieu,
      ciel: plan.items.filter(it => it.vol).map(it => it.id), eau: plan.items.filter(it => it.eau).map(it => it.id), eauAuxChamps: champs.items.filter(it => it.eau).length };
  });
  verifier(v.dormi.includes('dormir') && v.marche.includes('marcher') && v.marche.includes('marché') && v.lit.includes('lire') && v.lit.includes('lit'),
    `un verbe conjugué compte par son infinitif ; « marché » et « lit » restent des noms, sauf après un auxiliaire ou un pronom (${v.marche.join(', ')} ; ${v.lit.join(', ')})`);
  verifier(v.pluie[0] >= .5 && v.neige.meteo[1] >= .5 && v.nuit[3] === 1, `le temps qu’il fait vient des mots : la pluie, la neige, la nuit (${v.pluie} · ${v.neige.meteo} · ${v.nuit})`);
  verifier(v.desert === 'desert', 'les mots mènent ailleurs : le sable, les dunes et le chameau font le désert');
  verifier(v.ciel.some(id => /mouette/.test(id)) && v.eau.some(id => /whale/.test(id)) && !v.eauAuxChamps, `au bord de l’eau, les mouettes volent et la baleine nage (${v.ciel.concat(v.eau).join(', ')}) ; loin de l’eau, pas de baleine`);

  // 3. la première page : gardée sur le téléphone, une tuile de plus, peinte
  await p.fill('#page', PAGE); await p.click('#garder');
  await attendre(p, () => p.evaluate(() => /gardée/.test(document.querySelector('#dit').textContent)), 20000);
  t = await tuiles(p);
  verifier(t.length === 2 && t[1].nom === aujourdhui, `la page est gardée : une tuile de plus, à la date du jour (${t.map(x => x.nom).join(' · ')})`);
  const gardees = await p.evaluate(async () => (await window.chemin.carnet.lirePages()).map(x => x.texte));
  verifier(gardees.length === 1 && gardees[0] === PAGE, 'la page est dans le carnet du téléphone');
  await attendre(p, async () => (await tuiles(p))[1].peinte, PEINTURE);
  const lieu = await p.evaluate(() => { const q = window.chemin.plans[1]; return { lieu: q.lieu, objets: q.objets.map(o => o.mot) }; });
  verifier(lieu.lieu === 'foret' && lieu.objets.length >= 2, `la tuile de la page est peinte : en forêt, avec ${lieu.objets.join(', ')}`);
  await p.click('.tuile >> nth=1'); const jour = await p.textContent('#jour');
  verifier(jour.includes(aujourdhui) && jour.includes('en forêt'), `toucher la tuile dit sa date, son lieu et ses mots (« ${jour} »)`);
  await p.screenshot({ path: path.join(OUT, 'premiere-page.png') });

  // 4. à la visite suivante : la page revient du carnet, les tuiles aussi, sans repeindre
  await p.reload();
  await attendre(p, () => p.evaluate(() => document.querySelector('#intro').hidden), 20000);
  await attendre(p, async () => (await tuiles(p)).every(x => x.peinte), 10000);
  t = await tuiles(p);
  verifier(t.length === 2 && t.every(x => x.peinte && x.source === 'carnet') && await p.inputValue('#page') === PAGE, 'à la visite suivante, la page revient dans la zone d’écriture, et ses tuiles, gardées, sans repeindre');

  // 5. un long texte, collé d’un coup : des passages d’environ 14 mots porteurs, coupés aux chapitres et entre les phrases
  await p.fill('#page', LONG); await p.click('#garder');
  await attendre(p, () => p.evaluate(() => /gardée/.test(document.querySelector('#dit').textContent)), 30000);
  const l = await p.evaluate(() => { const C = window.chemin, ps = C.passages.filter(x => !x.depart && x.page === C.pages.length - 1); return { dit: document.querySelector('#dit').textContent, ps: ps.map(x => ({ titre: x.titre, porteurs: x.porteurs, texte: x.texte })), lieux: C.plans.filter(q => q.passage.page === C.pages.length - 1).map(q => q.lieu) }; });
  const titres = l.ps.filter(x => x.titre).map(x => x.titre), fins = l.ps.every(x => /[.!?…»]$/.test(x.texte.trim()));
  verifier(l.ps.length >= 5 && l.dit.includes(`${l.ps.length} tuiles`), `le long texte fait ${l.ps.length} tuiles (« ${l.dit} »)`);
  verifier(titres.join(' | ') === 'Chapitre I | Chapitre II | Chapitre III' && l.ps.filter(x => x.titre).every((x, k) => x.texte.startsWith(['Le matin', 'Le lendemain', 'Puis ce fut'][k])), 'chaque chapitre ouvre son passage, et donne son nom à sa première tuile');
  const repliques = l.ps.filter(x => x.texte.includes('— ')), porteurs = l.ps.map(x => x.porteurs);
  verifier(fins && repliques.length === 1 && (repliques[0].texte.match(/^— /gm) || []).length === 5, 'les coupes tombent entre les phrases, et le dialogue reste d’un seul tenant');
  verifier(Math.max(...porteurs) <= 22 && porteurs.filter(n => n >= 8).length >= l.ps.length - 3, `environ 14 mots porteurs par passage (${porteurs.join(', ')})`);
  verifier(l.lieux.includes('foret') && l.lieux.includes('rivage'), `les lieux suivent le texte : ${l.lieux.join(', ')}`);
  t = await tuiles(p);
  verifier(t.some(x => x.nom === `${aujourdhui} · Chapitre I`) && t.some(x => x.nom === 'Chapitre II'), 'la première tuile du texte porte sa date et son premier chapitre, les suivantes leur chapitre');
  await attendre(p, () => p.evaluate(() => [...document.querySelectorAll('.tuile')].some((t, k) => k > 1 && t.classList.contains('peinte'))), PEINTURE);
  await p.screenshot({ path: path.join(OUT, 'long-texte.png') });
  const lues = await p.evaluate(() => new Promise(ok => { const r = indexedDB.open('chemin'); r.onsuccess = () => { const n = r.result.transaction('lectures').objectStore('lectures').count(); n.onsuccess = () => { ok(n.result); r.result.close(); }; }; r.onerror = () => ok(0); }));
  verifier(lues >= l.ps.length, `la lecture de chaque passage est gardée : un long texte se rouvre sans tout relire (${lues} lectures)`);

  // 6. hors ligne : le service worker a gardé l’app et les objets vus ; sans réseau, le chemin s’ouvre avec ses tuiles
  const g = await attendre(p, () => p.evaluate(async () => {
    const noms = await caches.keys(), app = noms.includes('chemin-1') ? (await (await caches.open('chemin-1')).keys()).map(k => k.url) : [], objets = noms.includes('chemin-objets-1') ? (await (await caches.open('chemin-objets-1')).keys()).length : 0;
    const voulus = ['chemin/app.js?v=', 'chemin/sens.js?v=', 'chemin/monde.js?v=', 'chemin/carnet.js?v=', 'chemin/sens/vecteurs.bin', 'chemin/catalogue.json', 'chemin/vendor/three-chemin', 'aquarelle.js?v=', 'outils.js?v=', 'contenu.js?v=', 'fonts/nunito'];
    return { noms, objets, manque: voulus.filter(v => !app.some(u => u.includes(v))), page: app.some(u => u.endsWith('/chemin/')) };
  }).then(r => (r.manque.length || !r.page || !r.objets ? false : r)), 30000);
  verifier(!!g && g.noms.every(n => n.startsWith('chemin-')), `le service worker garde l’app, ce qu’elle prend à l’archipel, et ${g?.objets} objets déjà vus, dans ses propres caches`);
  local.etat.coupe = true; local.etat.servies = 0;
  await p.reload();
  await attendre(p, () => p.evaluate(() => document.querySelector('#intro').hidden), 30000);
  await attendre(p, async () => (await tuiles(p)).some(x => x.peinte), 15000);
  const hors = await p.evaluate(() => ({ app: !!window.chemin?.plans.length, police: document.fonts.check('1em Nunito'), peintes: [...document.querySelectorAll('.tuile.peinte img[src]')].length }));
  verifier(hors.app && hors.police && hors.peintes >= 1 && local.etat.servies === 0, `sans réseau, le chemin s’ouvre avec sa police et ses tuiles gardées (${hors.peintes} à l’écran), sans rien demander au serveur`);
  local.etat.coupe = false;

  // 7. l’archipel, sur le même site : son service worker et le nôtre ne touchent qu’à leurs caches
  const q = await c.newPage(); surveiller(q, e, x);
  await q.goto(BASE); await q.evaluate(() => { localStorage.setItem('archipel:intro', '1'); }); await q.reload();
  const deux = await attendre(q, () => q.evaluate(async () => { const n = await caches.keys(); return n.some(k => k.startsWith('archipel-')) && n.includes('chemin-1') && n.includes('chemin-objets-1') && n; }), 30000);
  verifier(!!deux, `l’archipel garde ses fichiers à côté, sans toucher à ceux du chemin (${deux || 'manque un cache'})`);
  await q.close();

  // 8. la démo : elle se dit démo, et ce qu’on y écrit ne touche pas au journal du téléphone
  const dm = await c.newPage(); surveiller(dm, e, x);
  await dm.goto(BASE + 'chemin/?demo');
  await attendre(dm, () => dm.evaluate(() => document.querySelector('#intro').hidden && window.chemin?.pages.length > 0), 60000);
  const demo = await dm.evaluate(() => { const b = document.querySelector('#demo'); return { vue: !b.hidden && b.getBoundingClientRect().height > 0, liens: [...document.querySelectorAll('#demo a, #promesse a')].map(a => a.href), zone: document.querySelector('#page').value, pages: window.chemin.pages.length }; });
  verifier(demo.vue && demo.liens.length === 2 && demo.liens.every(h => h === BASE + 'chemin/') && demo.zone === '' && demo.pages === 32, `la démo se dit démo, avec ses ${demo.pages} pages d’exemple et un lien vers son propre journal ; la zone d’écriture reste vide`);
  await dm.screenshot({ path: path.join(OUT, 'demo.png') });
  await dm.fill('#page', PAGE); await dm.click('#garder');
  await attendre(dm, () => dm.evaluate(() => /sans être gardée/.test(document.querySelector('#dit').textContent)), 30000);
  const ecrite = await dm.evaluate(async () => ({ dit: document.querySelector('#dit').textContent, pages: (await window.chemin.carnet.lirePages()).map(x => x.texte) }));
  verifier(ecrite.dit.startsWith('Démo') && ecrite.pages.length === 1 && ecrite.pages[0] === LONG, `une page écrite dans la démo s’ajoute au chemin sans être gardée ; le journal du téléphone n’a pas bougé (« ${ecrite.dit} »)`);
  await dm.close();

  verifier(!calme(e).length, `aucune erreur dans la console${calme(e).length ? ' : ' + calme(e).slice(0, 4).join(' | ') : ''}`);
  verifier(!x.length, `aucune requête vers l’extérieur${x.length ? ' : ' + x.slice(0, 3).join(' ') : ''}`);
  await b.close(); local.fermer(); bilan();
})().catch(err => { console.error(err); process.exit(1); });
