// L’archipel : la stabilité. Réponses qui ne comptent plus, quitter vite, données abîmées, 3D qui refuse de démarrer,
// écran qui échoue, app qui ne se lance pas, mémoire graphique, choses jamais empilées, retour qui ferme une feuille,
// les oiseaux du ciel, ce que tu as fait qui ne change pas tout en pierres.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller, sansIntro, contexte, peupler } = require('./commun');
const OUT = path.join(CAPTURES, 'stabilite'); fs.mkdirSync(OUT, { recursive: true });
const ile = (depots, extra = {}) => JSON.stringify({ id: 1, seed: 77, nee: new Date().toISOString(), biome: 'prairie', envoyee: true, quittee: null, depots, ...extra });
const depot = (id, answers) => ({ id, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets: [], fait: [], subi: [], ...answers } });

(async () => {
  const b = await chromium.launch({ args: GL });
  const nouvelle = async (init) => { const c = await contexte(b); if (init) await c.addInitScript(init); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x); return { c, p, e, x }; };

  // 1. décocher « je regrette » retire ce que la question de plus faisait pousser
  { const { c, p, e } = await nouvelle();
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1200);
    await p.click('.opt:has-text("que je regrette")'); await p.click('#app .btn'); await p.waitForTimeout(200); // les mots
    await p.click('#app .btn'); await p.waitForTimeout(200); await p.click('#app .btn'); await p.waitForTimeout(300); // les sujets, puis la question de plus
    await p.click('.opt:has-text("jamais réparé")'); await p.waitForTimeout(400);
    const avant = await p.evaluate(() => window.archipel.preview.map(g => `${g.famille}${g.etats.fissure ? ' fendue' : ''}`));
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(400);
    await p.click('.opt:has-text("que je regrette")'); await p.waitForTimeout(600);
    const apres = await p.evaluate(() => window.archipel.preview.map(g => `${g.famille}${g.etats.fissure ? ' fendue' : ''}`));
    verifier(avant.includes('pierre fendue') && !apres.some(x => x.startsWith('pierre')), `décocher « je regrette » retire la pierre fendue de l’îlot (${avant.join(', ')} puis ${apres.join(', ') || 'rien'})`);
    await p.click('.opt:has-text("On m’a fait du mal")'); for (let i = 0; i < 6 && !(await p.$('.path')); i++) { await p.click('#app .btn'); await p.waitForTimeout(200); }
    verifier(!(await p.textContent('.recap')).includes('jamais réparé'), 'le récapitulatif ne montre plus la réponse qui ne compte plus');
    await p.click('.path:has-text("Juste le poser")'); await p.waitForSelector('.sheet'); await p.click('.gesture:has-text("Poser sur l’île")'); await p.waitForTimeout(1500);
    const d = await p.evaluate(() => window.archipel.ile.depots.at(-1).answers);
    verifier(!d.fait.length && d.situ.includes('mal'), `le dépôt ne garde pas la réponse qui ne comptait plus (fait : ${JSON.stringify(d.fait)})`);
    verifier(!e.length, `aucune erreur${e.length ? ' : ' + e.join(' | ') : ''}`);
    await c.close(); }

  // 2. quitter vite : toujours visible, même par-dessus une feuille, et « retour » ne ramène pas dans l’app
  { const { c, p } = await nouvelle();
    await p.route('https://www.google.fr/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google</title>ailleurs' }));
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1200);
    await p.click('.opt:has-text("en danger")'); await p.click('#app .btn'); await p.waitForTimeout(200); await p.click('#app .btn'); await p.waitForTimeout(200);
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(200);
    const visible = await p.evaluate(() => { const r = document.querySelector('#exit').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.id === 'exit'; });
    verifier(visible, '« quitter » reste visible et touchable en bas de page');
    await p.click('#humans'); await p.waitForSelector('.sheet');
    const dessus = await p.evaluate(() => { const r = document.querySelector('#exit').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.id === 'exit'; });
    verifier(dessus, '« quitter » reste touchable par-dessus une feuille ouverte');
    const n = await p.evaluate(() => history.state.n);
    await p.click('#exit'); await p.waitForURL(/google\.fr/, { timeout: 5000 });
    await p.goBack().catch(() => {}); await p.waitForTimeout(800);
    verifier(!p.url().startsWith(BASE), `après avoir quitté depuis le ${n + 1}e écran, « retour » ne ramène pas dans l’app (${p.url()})`);
    await c.close(); }

  // 3. des données abîmées sur le téléphone : l’app s’ouvre quand même
  { const { c, p, e } = await nouvelle();
    await p.goto(BASE);
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', JSON.stringify({ seed: 'x', biome: 'lune', depots: [{ id: 1 }, null, { answers: { situ: 'mal', sujets: [5, 's4'] }, contenu: 42, duTexte: 's4' }] })); localStorage.setItem('archipel:iles', '{"a":1}'); localStorage.setItem('archipel:draft', '{"answers":{"situ":5,"mots":"x"},"text":7}'); });
    await p.reload(); await p.waitForTimeout(1800);
    const vu = await p.evaluate(() => ({ h1: document.querySelector('#app h1')?.textContent, choses: window.archipel.courant.assets.length }));
    verifier(!!vu.h1 && !e.length, `des données abîmées : l’app s’ouvre sur « ${vu.h1} », ${vu.choses} chose(s), aucune erreur${e.length ? ' : ' + e.join(' | ') : ''}`);
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(400);
    verifier(!!(await p.$('.opts')) && !e.length, 'et on peut déposer');
    await c.close(); }

  // 4. la 3D refuse de démarrer : l’app continue, sans 3D
  { const refus = () => { let n = 0; const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(t) && ++n > 1) return null; return g.call(this, t, ...a); }; };
    const { c, p, e } = await nouvelle(refus);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1500);
    const etat = await p.evaluate(() => ({ vue: window.archipel?.vue, opts: !!document.querySelector('.opts'), ent: document.querySelector('#ent').hidden }));
    verifier(etat.vue === null && etat.opts && etat.ent, 'la 3D refuse de démarrer : l’app s’ouvre, sans 3D');
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(500);
    verifier(!!(await p.$('.sans3d')) && !e.filter(x => x.includes('pageerror')).length, 'et l’île se dit en mots');
    await c.close(); }

  // 5. un écran qui échoue : le secours, jamais une page vide
  { const { c, p } = await nouvelle();
    await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); }); await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(() => { window.archipel.vue.montrerIle = () => { throw new Error('essai'); }; });
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(500);
    const h1 = await p.textContent('#app h1');
    verifier(/mal passé/.test(h1) && !!(await p.$('#app .actions .btn')), `un écran qui échoue laisse place au secours (« ${h1} »)`);
    await p.click('#app .actions .btn'); await p.waitForTimeout(500);
    verifier(!!(await p.$('.opts')), 'et le secours ramène aux premières cases');
    await c.close(); }

  // 6. l’app ne se lance pas du tout : il reste les numéros
  { const c = await contexte(b), p = await c.newPage();
    await p.route(/app\.js/, r => r.abort());
    await p.goto(BASE); await p.waitForTimeout(8800);
    verifier(await p.evaluate(() => !document.querySelector('#secours').hidden && !!document.querySelector('#secours a[href="tel:3114"]')), 'si l’app ne se lance pas, le secours paraît, avec le 3114');
    await p.screenshot({ path: path.join(OUT, 'secours.png') });
    await c.close(); }

  // 7. la mémoire graphique ne grandit pas en passant de l’île à l’archipel
  { const { c, p } = await nouvelle();
    await p.goto(BASE); await p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, ile([depot(1, { situ: ['danger'], sujets: ['s4', 's11'] })]));
    await p.reload(); await p.waitForTimeout(1500); await peupler(p, c.archipel, 12); // des îles à dessiner, et à libérer
    const tex = [];
    for (let i = 0; i < 3; i++) { await p.click('[data-onglet="archipel"]'); await p.waitForTimeout(1500); await p.click('[data-onglet="ile"]'); await p.waitForTimeout(1200); tex.push(await p.evaluate(() => window.archipel.vue.rendu.info.memory.textures)); }
    verifier(tex[2] <= tex[0], `la mémoire graphique reste stable d’une visite à l’autre (${tex.join(', ')} textures)`);
    await c.close(); }

  // 8. beaucoup de sujets d’un coup : jamais deux choses sur la même case
  { const { c, p } = await nouvelle();
    await p.goto(BASE);
    const empilees = await p.evaluate(async () => {
      const { deriver } = await import('./ile.js?v=13'), tous = Array.from({ length: 15 }, (_, i) => `s${i}`);
      let pire = 0;
      for (let s = 1; s <= 40; s++) { const d = deriver({ id: 1, seed: 1000 + s * 7, biome: 'prairie', depots: [{ id: 1, quad: 'N', answers: { situ: ['regret', 'mal'], mots: [], sujets: tous, fait: [], subi: [] } }] }), vus = new Set(); let n = 0; for (const a of d.assets) { if (a.famille === 'meteo' && a.espece !== 'etang') continue; const k = a.tile.join(); if (vus.has(k)) n++; vus.add(k); } pire = Math.max(pire, n); }
      return pire;
    });
    verifier(empilees === 0, `quinze sujets d’un coup : aucune chose posée sur une autre (${empilees})`);
    await c.close(); }

  // 9. le bouton retour ferme la feuille ouverte
  { const { c, p } = await nouvelle();
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1200);
    await p.click('.opt:has-text("On m’a fait du mal")'); await p.click('#app .btn'); await p.waitForTimeout(300);
    await p.click('#humans'); await p.waitForSelector('.sheet');
    await p.goBack(); await p.waitForTimeout(500);
    verifier(!(await p.$('.sheet')), 'le bouton retour ferme la feuille ouverte');
    await c.close(); }

  // 10. le ciel : les oiseaux du paysage sous un ciel clair, aucun sous un ciel lourd
  { const { c, p, e } = await nouvelle();
    await p.goto(BASE);
    const ciel = async (biome, mots) => {
      await p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, ile([depot(1, { mots, sujets: ['s4'] })], { biome }));
      await p.reload(); await p.waitForTimeout(1500);
      return p.evaluate(() => { const n = {}; window.archipel.vue.scene.traverse(o => { if (o.userData?.oiseau) n[o.userData.oiseau] = (n[o.userData.oiseau] || 0) + 1; }); return n; });
    };
    const lande = await ciel('lande', ['calme']), automne = await ciel('automne', []), lourd = await ciel('prairie', ['colere']);
    verifier(lande.fou === 2 && lande.mouette === 1, `la lande : deux fous de Bassan et une mouette (${JSON.stringify(lande)})`);
    verifier(automne.oie === 5 && automne.mouette === 1, `l’automne : un vol de cinq oies et une mouette (${JSON.stringify(automne)})`);
    verifier(!Object.keys(lourd).length, `sous un ciel lourd, aucun oiseau (${JSON.stringify(lourd)})`);
    verifier(!e.length, `aucune erreur${e.length ? ' : ' + e.join(' | ') : ''}`);
    await c.close(); }

  // 11. ce que tu as fait ne change pas tout en pierres : chaque sujet garde sa chose, une petite pierre à son pied, et une pierre pour le regret
  { const { c, p } = await nouvelle();
    await p.goto(BASE);
    const r = await p.evaluate(async () => {
      const { deriver } = await import('./ile.js?v=13');
      const d = deriver({ id: 1, seed: 77, biome: 'prairie', depots: [{ id: 1, quad: 'N', answers: { situ: ['regret'], mots: ['culpa'], sujets: ['s4', 's7', 's6'], fait: ['fpense'], subi: [] } }] });
      return d.assets.filter(a => a.famille !== 'meteo').map(a => `${a.famille}${a.etats.commis ? ' commis' : ''}`).sort();
    });
    verifier(r.join(',') === 'culture commis,culture commis,maison commis,pierre', `« je regrette », couple, travail et argent : une maison et deux cultures, chacune sa petite pierre, et une pierre pour le regret (${r.join(', ')})`);
    await c.close(); }

  // 12. le rivage : des falaises d’un seul côté, jamais tout autour ; la part du rivage en falaise, sur quarante îles, petites et pleines
  { const { c, p } = await nouvelle();
    await p.goto(BASE);
    const parts = await p.evaluate(async () => {
      const { relief } = await import('./monde.js?v=26'), { etape, tuilesPleines, N, BIOMES } = await import('./ile.js?v=13'), out = {};
      for (const [id, B] of Object.entries(BIOMES)) {
        let f = 0, t = 0, pire = 0;
        for (let k = 0; k < 40; k++) for (const taille of [.3, 1]) {
          const seed = 1000 + k * 7919, m = etape(seed, Math.max(12, tuilesPleines(seed) * taille)), h = relief(m, B); let fi = 0, ti = 0;
          for (const [i, j] of m.rive) for (const [a, bb] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
            if (a < 0 || bb < 0 || a >= N || bb >= N || !m.land[a * N + bb]) continue;
            ti++; if (h.falaise(i + .5 + (a - i) * .5, j + .5 + (bb - j) * .5) > .55) fi++;
          }
          f += fi; t += ti; pire = Math.max(pire, fi / ti);
        }
        out[id] = { moyenne: Math.round(f / t * 100), pire: Math.round(pire * 100) };
      }
      return out;
    });
    const MOYENNE = { prairie: 25, automne: 25, neige: 25, tropique: 10, lande: 45 };
    for (const [id, { moyenne, pire }] of Object.entries(parts)) {
      verifier(pire <= 65, `${id} : jamais une île cernée de falaises (au pire ${pire} % du rivage)`);
      verifier(moyenne <= (MOYENNE[id] ?? 25), `${id} : des falaises mesurées (${moyenne} % du rivage en moyenne)`);
    }
    await c.close(); }

  await b.close();
  bilan();
})().catch(e => { console.error(e); process.exit(1); });
