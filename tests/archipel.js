// L’archipel partagé : seulement des îles réelles, seulement leur forme, et seulement quand on le choisit.
// Contre un faux serveur, en mémoire, qui répond comme le vrai : les tests ne touchent jamais la vraie base.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller, sansIntro, contexte, peupler, formesInventees, formeValide } = require('./commun');
const OUT = path.join(CAPTURES, 'archipel'); fs.mkdirSync(OUT, { recursive: true });
const SECRET = 'Personne ne sait que je dors dans ma voiture depuis mars.';
const depot = (id, sujets) => ({ id, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets, fait: [], subi: [] } });
const ile = (id, depots, extra = {}) => ({ id, seed: 6000 + id, nee: new Date().toISOString(), biome: 'prairie', depots, envoyee: false, quittee: null, ...extra });
const appels = (a, f) => a.etat.appels.filter(x => !f || x.f === f);
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(50); return test(); };
const RESEAU = /Failed to fetch|net::ERR_|Failed to load resource/; // ce que la console dit d’une panne voulue
const calme = e => e.filter(m => !RESEAU.test(m));
const cocherPuisPoser = async (p, cas) => { // une case, les questions jusqu’aux chemins, puis juste la poser
  await p.click(`.opt:has-text("${cas}")`);
  for (let i = 0; i < 6 && !(await p.$('.path')); i++) { await p.click('#app .btn'); await p.waitForTimeout(150); }
  await p.click('.path:has-text("Juste le poser")'); await p.waitForSelector('.sheet'); await p.click('.gesture:has-text("Poser sur l’île")'); await p.waitForTimeout(1200);
};
const lire = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent || '', sel);
const stockee = (p, cle = 'ile') => p.evaluate(k => JSON.parse(localStorage.getItem(`archipel:${k}`)), cle);

(async () => {
  const b = await chromium.launch({ args: GL });

  // 1. déposer, écrire, garder son texte : rien ne part ; l’archipel vide le dit, sans rien inventer
  { const c = await contexte(b), p = await c.newPage(), e = [], x = [], a = c.archipel; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1000);
    await p.click('.opt:has-text("On m’a fait du mal")');
    for (let i = 0; i < 6 && !(await p.$('.path')); i++) { await p.click('#app .btn'); await p.waitForTimeout(150); }
    await p.click('.path:has-text("Écrire")'); await p.waitForSelector('textarea'); await p.fill('textarea', SECRET); await p.waitForTimeout(400);
    await p.click('#app .btn:has-text("Terminer")'); await p.waitForSelector('.sheet'); await p.click('.gesture:has-text("Garder le texte")'); await p.waitForTimeout(1500);
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
    await cocherPuisPoser(p, 'Il y a quelque chose que je n’ai jamais dit');
    verifier(!appels(a).length && (await p.evaluate(() => window.archipel.ile.depots.length)) === 2, 'deux dépôts, dont un texte gardé : aucun appel au serveur');

    await p.click('[data-onglet="archipel"]'); await attendre(p, () => appels(a, 'archipel_lire').length > 0); await p.waitForTimeout(800);
    const vide = await p.evaluate(() => ({ items: window.archipel.arch.items.length, cap: document.querySelector('#arch-caption').textContent, ligne: document.querySelector('#arch-line').textContent }));
    verifier(!vide.items && vide.cap === 'L’archipel attend sa première île.' && /^0 île dans l’archipel/.test(vide.ligne), `l’archipel vide le dit, et n’invente aucune île (« ${vide.cap} »)`);
    verifier(appels(a).every(y => y.f === 'archipel_lire'), 'regarder l’archipel ne fait que lire');
    await p.screenshot({ path: path.join(OUT, '1-vide.png') });

    // 2. y mettre son île : la forme seulement, sa place, un jeton secret
    await p.click('#mettre-ile'); await p.waitForSelector('.sheet');
    const dit = await lire(p, '.sheet');
    await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, '2-feuille.png') });
    await p.click('.sheet .gesture:has-text("Y mettre ton île")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(1500);
    const envoi = appels(a, 'archipel_poser')[0], f = envoi?.c.p_forme, corps = a.etat.appels.map(y => y.corps).join('\n');
    verifier(/Seule sa forme part/.test(dit) && !/cases/.test(dit) && a.etat.iles.length === 1 && formeValide(f) && !a.etat.refus.length, `« Y mettre ton île » : la feuille dit ce qui part, et le serveur accepte la forme (${envoi?.corps.length} octets)`);
    verifier(Object.keys(envoi.c).sort().join() === 'p_forme,p_ile,p_jeton,p_x,p_z' && envoi.c.p_ile === null && Number.isFinite(envoi.c.p_x) && Number.isFinite(envoi.c.p_z), 'on n’envoie que la forme, sa place et un jeton');
    verifier(!corps.includes('voiture') && !/"(answers|depots|contenu|duTexte|sujets|date|nee|quad|texte|key|id|seed|biome)"/.test(corps) && !/"s\d{1,2}"/.test(corps), 'ni le texte, ni les cases, ni les sujets, ni les dates ne partent');
    const h = envoi.entetes;
    verifier(!!h.apikey && !h.authorization && !h.referer, 'la clé publique seule, sans adresse d’origine');
    const garde = (await stockee(p)).archipel;
    verifier(garde?.id === a.etat.iles[0].ile && /^[0-9a-f]{64}$/.test(garde.jeton) && garde.jeton === envoi.c.p_jeton && a.etat.iles[0].jeton === garde.jeton, 'le téléphone garde sa place et son jeton secret');
    verifier(await p.evaluate(() => window.archipel.arch.items.some(i => i.mine)) && !(await p.$('#mettre-ile')) && /parmi les autres/.test(await lire(p, '#arch-caption')), 'elle paraît dans l’archipel, et le bouton s’en va');
    await p.screenshot({ path: path.join(OUT, '2-posee.png') });

    // 3. un nouveau dépôt : là-bas aussi, elle grandit
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
    await cocherPuisPoser(p, 'J’ai fait quelque chose que je regrette');
    await attendre(p, async () => appels(a, 'archipel_poser').length === 2 && !(await stockee(p)).archipel?.enRetard); // la page a traité la réponse
    const grandi = appels(a, 'archipel_poser')[1]?.c, apres = a.etat.iles[0]?.forme;
    verifier(grandi?.p_ile === garde.id && grandi.p_jeton === garde.jeton && a.etat.iles.length === 1 && apres.choses.length > f.choses.length && !(await stockee(p)).archipel.enRetard, `un nouveau dépôt : sa forme grandit aussi là-bas (${f.choses.length} puis ${apres?.choses.length} choses)`);

    // 4. les îles des autres : leur légende, celles qui arrivent, celles qui grandissent
    await peupler(p, a, 6);
    await p.click('[data-onglet="archipel"]'); await attendre(p, () => p.evaluate(() => window.archipel.arch.items.length === 7)); await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(OUT, '4-autres.png') });
    const autre = await p.evaluate(() => {
      const v = window.archipel.vue, r = v.canvas.getBoundingClientRect();
      return window.archipel.arch.items.filter(i => !i.mine).map(it => { const w = it.grp.position.clone(); w.project(v.camera); return { x: r.left + (w.x + 1) / 2 * r.width, y: r.top + (1 - w.y) / 2 * r.height, z: w.z }; })
        .filter(q => q.x > r.left + 30 && q.x < r.right - 30 && q.y > r.top + 30 && q.y < r.bottom - 30).sort((q1, q2) => q1.z - q2.z)[0];
    });
    if (autre) { await p.mouse.click(autre.x, autre.y); await p.waitForTimeout(1500); }
    const leg = await lire(p, '#arch-caption');
    verifier(/^Une île avec .+\. Là depuis un moment\./.test(leg), `toucher l’île de quelqu’un d’autre : « ${leg.slice(0, 80)}… »`);
    const pres = await p.evaluate(() => { const f = window.archipel.vue.focus; return f ? { riche: !!f.riche, anims: f.riche?.anims.length ?? -1, cachee: f.grp.visible === false, objets: f.riche?.grp.children.length ?? 0 } : null; });
    verifier(!!pres?.riche && pres.cachee && pres.objets > 2, `de près, l’île se construit comme dans sa vue : ${pres?.objets} objets, ${pres?.anims} animations, la version légère cachée`);
    await p.click('#arch-caption .quiet:has-text("revenir à l’archipel")'); await p.waitForTimeout(300);
    verifier(await p.evaluate(() => !window.archipel.vue.focus && window.archipel.vue.items.every(i => !i.riche && i.grp.visible)), 'de loin, la version légère revient, et l’autre est libérée');
    await peupler(p, a, 1, 30); await p.evaluate(() => window.archipel.sonder()); await p.waitForTimeout(300);
    const arrivee = await p.evaluate(() => ({ n: window.archipel.vue.items.length, ligne: document.querySelector('#arch-line').textContent }));
    verifier(arrivee.n === 8 && /regardes\s*:\s*1\b/.test(arrivee.ligne), `une île posée ailleurs arrive de l’horizon (${arrivee.ligne})`);
    const [{ forme: nouvelleForme }] = await formesInventees(p, 1, 50), cible = a.etat.iles.find(i => !i.jeton);
    cible.forme = nouvelleForme; cible.ordre = ++a.etat.rang;
    await p.evaluate(() => window.archipel.sonder()); await p.waitForTimeout(300);
    const g = await p.evaluate(id => { const its = window.archipel.vue.items; return { n: its.filter(i => i.id === id).length, graine: its.find(i => i.id === id)?.d.ile.seed, total: its.length, ligne: document.querySelector('#arch-line').textContent }; }, cible.ile);
    verifier(g.n === 1 && g.graine === nouvelleForme.graine && g.total === 8 && /regardes\s*:\s*1\b/.test(g.ligne), 'une île d’ailleurs qui grandit change de forme sur place, sans compter comme une arrivée');

    // 5. la retirer : elle disparaît du serveur, et reste entière ici
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(1200);
    verifier(/Sa forme est dans l’archipel/.test(await lire(p, '#app .hint')) && !!(await p.$('.actions .outil:has-text("la retirer de l’archipel")')), 'sur l’île : elle se dit dans l’archipel, et on peut l’en retirer');
    await p.click('.actions .outil:has-text("la retirer de l’archipel")'); await p.waitForSelector('.sheet');
    await p.click('.sheet .gesture:has-text("La retirer de l’archipel")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(500);
    const retiree = await stockee(p);
    verifier(!a.etat.iles.some(i => i.ile === garde.id) && !retiree.archipel && !retiree.envoyee && retiree.depots.length === 3 && /Rien ne quitte ce téléphone/.test(await lire(p, '#app .hint')), 'la retirer : elle disparaît du serveur, et reste entière ici');
    await p.click('[data-onglet="archipel"]'); await p.waitForTimeout(1500);
    verifier(!!(await p.$('#mettre-ile')) && await p.evaluate(() => !window.archipel.arch.items.some(i => i.mine)), 'dans l’archipel, elle n’y est plus, et on peut l’y remettre');

    // 6. le serveur ne répond pas : on le dit, rien ne casse, et le même geste marche au retour du réseau
    const n0 = e.length; a.etat.panne = true;
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(300); await p.click('[data-onglet="archipel"]');
    await attendre(p, () => p.evaluate(() => window.archipel.arch.panne)); await p.waitForTimeout(300);
    const panne = await p.evaluate(() => ({ cap: document.querySelector('#arch-caption').textContent, ligne: document.querySelector('#arch-line').textContent }));
    verifier(/ne répond pas/.test(panne.cap) && /Tes îles sont bien là/.test(panne.cap) && /ne répond pas/.test(panne.ligne), 'le serveur ne répond pas : l’archipel le dit, calmement');
    await p.click('#mettre-ile'); await p.waitForSelector('.sheet'); await p.click('.sheet .gesture:has-text("Y mettre ton île")');
    await attendre(p, () => p.evaluate(() => /ne répond pas/.test(document.querySelector('.sheet [role="status"]')?.textContent || '')));
    const echec = await p.evaluate(() => ({ feuille: !!document.querySelector('.sheet'), etat: document.querySelector('.sheet [role="status"]')?.textContent || '', actif: !document.querySelector('.sheet .gesture')?.disabled }));
    verifier(echec.feuille && /ne répond pas/.test(echec.etat) && echec.actif, `et « Y mettre ton île » attend : « ${echec.etat} »`);
    a.etat.panne = false; const avant = a.etat.iles.length;
    await p.click('.sheet .gesture:has-text("Y mettre ton île")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }).catch(() => {});
    verifier(a.etat.iles.length === avant + 1, 'le réseau revenu, le même geste la pose');
    const bruit = e.splice(n0);
    verifier(!calme(bruit).length, `pendant la panne, seulement la panne dans la console${calme(bruit).length ? ' : ' + calme(bruit).join(' | ') : ''}`);
    verifier(!x.length, `aucune requête extérieure${x.length ? ' : ' + x.join(', ') : ''}`);
    verifier(!e.length, `aucune erreur${e.length ? ' : ' + e.slice(0, 4).join(' | ') : ''}`);
    await c.close(); }

  // 7. des îles « envoyées » d’avant le serveur, et des places abîmées : rien ne part tout seul
  { const c = await contexte(b), p = await c.newPage(), e = [], x = [], a = c.archipel; surveiller(p, e, x);
    const quittee = new Date().toISOString();
    await p.goto(BASE);
    await p.evaluate(([i, l]) => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); localStorage.setItem('archipel:iles', l); }, [
      JSON.stringify(ile(1, [depot(1, ['s4'])], { envoyee: true })),
      JSON.stringify([ile(2, [depot(1, ['s11'])], { envoyee: true, quittee, archipel: { id: 5, jeton: 'abc' } }), ile(3, [depot(1, ['s7'])], { envoyee: true, quittee, archipel: { id: 'x', jeton: 'f'.repeat(64), x: 'loin' } })]),
    ]);
    await p.reload(); await p.waitForTimeout(3000);
    const vu = await p.evaluate(() => ({ hint: document.querySelector('#app .hint')?.textContent || '', dedans: [window.archipel.ile, ...window.archipel.iles].filter(y => y.envoyee || y.archipel).length }));
    verifier(!appels(a).length && !vu.dedans && /Rien ne quitte ce téléphone/.test(vu.hint), 'des îles « envoyées » avant le serveur, ou une place abîmée : rien ne part tout seul, et l’île le dit');
    await p.click('[data-onglet="archipel"]'); await p.waitForTimeout(1500);
    verifier(!!(await p.$('#mettre-ile')) && /les tiennes\s*:\s*0/.test(await lire(p, '#arch-line')) && appels(a).every(y => y.f === 'archipel_lire'), 'dans l’archipel, elles n’y sont pas ; on peut y mettre celle d’aujourd’hui');

    // 8. changer d’île : la case est décochée d’office ; cochée, l’île quittée part
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(800);
    await p.click('.actions .outil:has-text("changer d’île")'); await p.waitForSelector('.sheet');
    const coche = await p.$eval('.sheet input[type=checkbox]', i => i.checked);
    await p.click('.sheet .gesture:has-text("Commencer une nouvelle île")'); await p.waitForTimeout(2500);
    verifier(!coche && !appels(a, 'archipel_poser').length && await p.evaluate(() => !window.archipel.iles.at(-1).archipel), 'changer d’île : « la mettre dans l’archipel » est décochée d’office, et rien ne part');
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
    await cocherPuisPoser(p, 'On m’a fait du mal');
    await p.click('.actions .outil:has-text("changer d’île")'); await p.waitForSelector('.sheet');
    await p.click('.sheet label.check'); await p.click('.sheet .gesture:has-text("Commencer une nouvelle île")');
    await attendre(p, () => p.evaluate(() => !!window.archipel.iles.at(-1)?.archipel?.id)); // la page a reçu sa place
    const partie = await p.evaluate(() => window.archipel.iles.at(-1).archipel);
    verifier(a.etat.iles.length === 1 && partie?.id === a.etat.iles[0].ile && formeValide(a.etat.iles[0].forme), 'cochée, l’île quittée part dans l’archipel, avec sa forme seulement');

    // 9. sans réseau, l’île quittée attend ; elle part à la prochaine ouverture
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
    await cocherPuisPoser(p, 'J’ai fait quelque chose que je regrette');
    const n0 = e.length; a.etat.panne = true;
    await p.click('.actions .outil:has-text("changer d’île")'); await p.waitForSelector('.sheet');
    await p.click('.sheet label.check'); await p.click('.sheet .gesture:has-text("Commencer une nouvelle île")'); await p.waitForTimeout(2000);
    const attente = (await stockee(p, 'iles')).at(-1).archipel;
    verifier(attente?.attente === true && !attente.id && a.etat.iles.length === 1, 'sans réseau, l’île quittée attend sur le téléphone');
    a.etat.panne = false;
    await p.reload(); await attendre(p, async () => !!(await stockee(p, 'iles')).at(-1)?.archipel?.id, 10000);
    const envoyee = (await stockee(p, 'iles')).at(-1).archipel;
    verifier(a.etat.iles.length === 2 && envoyee?.id === a.etat.iles[1].ile && !envoyee.attente, 'à la prochaine ouverture, elle part d’elle-même');
    const bruit = e.splice(n0);
    verifier(!calme(bruit).length && !x.length && !e.length, `aucune erreur, hors la panne voulue${calme(bruit).length || e.length ? ' : ' + [...calme(bruit), ...e].slice(0, 4).join(' | ') : ''}`);
    await c.close(); }

  // 10. retirée ailleurs, le serveur ne la connaît plus : le téléphone l’oublie aussi, sans rien perdre
  { const c = await contexte(b), p = await c.newPage(), e = [], x = [], a = c.archipel; surveiller(p, e, x);
    const id = '00000099-0000-4000-8000-000000000000';
    await p.goto(BASE);
    await p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, JSON.stringify(ile(1, [depot(1, ['s4']), depot(2, ['s11'])], { envoyee: true, archipel: { id, jeton: 'ab'.repeat(32), x: 1, z: 2, enRetard: true } })));
    await p.reload(); await attendre(p, async () => appels(a, 'archipel_poser').length > 0 && !(await stockee(p)).archipel, 10000); // la page a lu le refus
    const oubliee = await stockee(p);
    verifier(appels(a, 'archipel_poser')[0]?.c.p_ile === id && !oubliee.archipel && !oubliee.envoyee && oubliee.depots.length === 2, 'retirée ailleurs : à la mise à jour, le serveur ne la connaît plus, et le téléphone l’oublie aussi, sans rien perdre');
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(600);
    verifier(/Rien ne quitte ce téléphone/.test(await lire(p, '#app .hint')) && !(await p.$('.actions .outil:has-text("la retirer de l’archipel")')), 'et l’île ne se dit plus dans l’archipel');
    verifier(!calme(e).length && !x.length, `aucune erreur, hors le refus attendu${calme(e).length ? ' : ' + calme(e).join(' | ') : ''}`);
    await c.close(); }

  // 11. après un dépôt, l’île propose de rejoindre l’archipel : ce qui partirait, et un seul geste ; rien sans lui
  { const c = await contexte(b), p = await c.newPage(), e = [], x = [], a = c.archipel; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1000);
    await cocherPuisPoser(p, 'On m’a fait du mal');
    const carte = await p.evaluate(() => ({ texte: document.querySelector('.proposer p')?.textContent || '', avant: !!document.querySelector('.proposer + nav.actions'), action: document.querySelector('#app .actions .btn')?.textContent, lien: !!document.querySelector('#mettre-ici'), garde: JSON.parse(localStorage.getItem('archipel:ile')).proposer }));
    verifier(/^Ton île peut rejoindre l’archipel\. Les autres y verraient une île avec .+, dans son paysage, sans tes mots ni ton nom\. Tu pourras l’en retirer\.$/.test(carte.texte) && carte.avant && carte.action === 'Déposer autre chose' && !carte.lien && carte.garde === true, `après un dépôt, sous l’île, avant les actions : « ${carte.texte.slice(0, 96)}… »`);
    verifier(!appels(a).length, 'la proposition seule n’envoie rien, et ne lit rien');
    await p.screenshot({ path: path.join(OUT, '11-proposition.png') });
    await p.reload(); await p.waitForTimeout(1200);
    verifier(!!(await p.$('.proposer')) && !appels(a).length, 'rechargée, elle attend toujours une réponse');
    await p.click('.proposer .btn:has-text("La mettre dans l’archipel")');
    await attendre(p, () => p.evaluate(() => /^Elle est dans l’archipel\./.test(document.querySelector('.proposer p')?.textContent || '')), 10000);
    const envoi = appels(a, 'archipel_poser')[0], garde = await stockee(p);
    const vue = await p.evaluate(() => ({ hint: document.querySelector('#app .hint').textContent, retirer: [...document.querySelectorAll('.actions .outil .outil-texte')].some(q => q.firstChild.textContent === 'La retirer de l’archipel'), focus: document.activeElement?.textContent }));
    verifier(a.etat.iles.length === 1 && envoi?.c.p_ile === null && formeValide(envoi.c.p_forme) && garde.archipel?.id === a.etat.iles[0].ile && garde.proposer === undefined, 'un geste : elle part, sa forme seulement, et le téléphone garde sa place');
    verifier(/Sa forme est dans l’archipel/.test(vue.hint) && vue.retirer && vue.focus === 'la voir dans l’archipel', 'la vue de l’île le dit aussitôt, propose de la retirer, et de la voir là-bas');
    await p.screenshot({ path: path.join(OUT, '11-mise.png') });
    await p.click('.proposer .quiet:has-text("la voir dans l’archipel")');
    const vue3 = await attendre(p, () => p.evaluate(() => /parmi les autres/.test(document.querySelector('#arch-caption')?.textContent || '') && window.archipel.vue.focus?.ile === window.archipel.ile), 10000);
    verifier(vue3 && !(await p.$('#mettre-ile')), 'la voir dans l’archipel : on s’approche d’elle, parmi les autres');
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
    await cocherPuisPoser(p, 'J’ai fait quelque chose que je regrette');
    await attendre(p, () => appels(a, 'archipel_poser').length === 2);
    verifier(!(await p.$('.proposer')) && appels(a, 'archipel_poser')[1]?.c.p_ile === a.etat.iles[0].ile, 'dans l’archipel, le dépôt suivant la fait grandir là-bas, sans rien reproposer');
    verifier(!e.length && !x.length, `aucune erreur, aucune requête extérieure${e.length ? ' : ' + e.slice(0, 4).join(' | ') : ''}`);
    await c.close(); }

  // 12. « pas maintenant » : gardé pour cette île ; un lien discret reste, et une île retirée ne se repropose pas
  { const c = await contexte(b), p = await c.newPage(), e = [], x = [], a = c.archipel; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1000);
    await cocherPuisPoser(p, 'On m’a fait du mal');
    await p.click('.proposer .quiet:has-text("pas maintenant")'); await p.waitForTimeout(300);
    const non = await p.evaluate(() => ({ carte: !!document.querySelector('.proposer'), lien: document.querySelector('.actions .btn ~ .outils #mettre-ici .outil-texte')?.firstChild.textContent, focus: document.activeElement?.textContent, garde: JSON.parse(localStorage.getItem('archipel:ile')).proposer }));
    verifier(!non.carte && non.lien === 'La mettre dans l’archipel' && non.garde === false && non.focus === 'Déposer autre chose' && !appels(a).length, '« pas maintenant » : la carte s’en va, rien ne part ; « la mettre dans l’archipel » reste parmi les outils de l’île');
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
    await cocherPuisPoser(p, 'J’ai fait quelque chose que je regrette');
    await p.reload(); await p.waitForTimeout(1200);
    verifier(!(await p.$('.proposer')) && !!(await p.$('#mettre-ici')) && !appels(a).length, 'la proposition ne revient pas pour cette île, même après un autre dépôt');
    await p.click('#mettre-ici'); await p.waitForSelector('.sheet'); await p.click('.sheet .gesture:has-text("Y mettre ton île")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 }); await p.waitForTimeout(300);
    const posee = await p.evaluate(() => ({ hint: document.querySelector('#app .hint').textContent, mettre: !!document.querySelector('#mettre-ici'), retirer: [...document.querySelectorAll('.actions .outil .outil-texte')].some(q => q.firstChild.textContent === 'La retirer de l’archipel') }));
    verifier(a.etat.iles.length === 1 && /Sa forme est dans l’archipel/.test(posee.hint) && !posee.mettre && posee.retirer, 'le lien ouvre la feuille ; posée, la vue de l’île le dit, et propose de la retirer');
    await p.click('.actions .outil:has-text("la retirer de l’archipel")'); await p.waitForSelector('.sheet'); await p.click('.sheet .gesture:has-text("La retirer de l’archipel")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 });
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(300);
    await cocherPuisPoser(p, 'Ça tourne en boucle dans ma tête');
    verifier(!(await p.$('.proposer')) && !!(await p.$('#mettre-ici')) && appels(a, 'archipel_poser').length === 1 && !a.etat.iles.length, 'retirée, elle ne se repropose pas d’elle-même ; le lien reste');
    verifier(!e.length && !x.length, `aucune erreur${e.length ? ' : ' + e.slice(0, 4).join(' | ') : ''}`);
    await c.close(); }

  // 13. l’archipel ne répond pas : la carte le dit, l’île reste ici, et le même geste réessaie
  { const c = await contexte(b), p = await c.newPage(), e = [], x = [], a = c.archipel; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1000);
    await cocherPuisPoser(p, 'On m’a fait du mal');
    a.etat.panne = true;
    await p.click('.proposer .btn:has-text("La mettre dans l’archipel")');
    await attendre(p, () => p.evaluate(() => /ne répond pas/.test(document.querySelector('.proposer [role=status]')?.textContent || '')), 10000);
    const echec = await p.evaluate(() => ({ actif: !document.querySelector('.proposer .btn').disabled, garde: JSON.parse(localStorage.getItem('archipel:ile')) }));
    verifier(echec.actif && !echec.garde.archipel && echec.garde.proposer === true && !a.etat.iles.length, 'sans réseau : la carte le dit calmement, l’île reste ici, le geste attend');
    a.etat.panne = false;
    await p.click('.proposer .btn:has-text("La mettre dans l’archipel")');
    await attendre(p, () => p.evaluate(() => /^Elle est dans l’archipel\./.test(document.querySelector('.proposer p')?.textContent || '')), 10000);
    verifier(a.etat.iles.length === 1, 'le réseau revenu, le même geste la pose');
    verifier(!calme(e).length && !x.length, `aucune erreur, hors la panne voulue${calme(e).length ? ' : ' + calme(e).slice(0, 4).join(' | ') : ''}`);
    await c.close(); }
  await b.close();

  // 14. sans 3D : l’archipel se compte en mots, et on peut y mettre son île
  { const sans = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl'] });
    const c = await contexte(sans, { viewport: { width: 390, height: 844 } }), p = await c.newPage(), e = [], x = [], a = c.archipel; surveiller(p, e, x);
    await p.goto(BASE); await peupler(p, a, 3);
    await p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, JSON.stringify(ile(1, [depot(1, ['s4'])])));
    await p.reload(); await p.waitForTimeout(600);
    await p.click('[data-onglet="archipel"]'); await attendre(p, () => p.evaluate(() => window.archipel.arch.lu)); await p.waitForTimeout(300);
    verifier(/^3 îles dans l’archipel/.test(await lire(p, '#arch-line')) && !!(await p.$('.sans3d')), `sans 3D : l’archipel se compte en mots (« ${(await lire(p, '#arch-line')).slice(0, 40)}… »)`);
    await p.click('#mettre-ile'); await p.waitForSelector('.sheet'); await p.click('.sheet .gesture:has-text("Y mettre ton île")'); await p.waitForSelector('.sheet', { state: 'detached', timeout: 10000 });
    verifier(a.etat.iles.length === 4 && !e.length && !x.length, `sans 3D : on peut quand même y mettre son île${e.length ? ' : ' + e.join(' | ') : ''}`);
    await sans.close(); }

  bilan();
})().catch(e => { console.error(e); process.exit(1); });
