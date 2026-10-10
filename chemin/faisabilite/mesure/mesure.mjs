// Spike : que fait le vrai moteur du chemin des écrits banals d’une journée ? Quatre personas inventés (corpus/), lus par
// chemin/sens.js et planifiés par chemin/monde.js, sans rien y changer. Écrit resultats.json et tableaux.md.
// Lancer : node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON chemin/faisabilite/mesure/mesure.mjs
// (après peinture.cjs, s’il a tourné, les projections de stockage utilisent la taille mesurée des tuiles peintes)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { sens, monde, chargerMoteur, lireCorpus, pageDuJour, familleSource, planifierTuiles, poses, lectureGardee, motsDe, jetonsDe, VIDES, ICI } from './moteur.mjs';
import { nettoyerJour, ETAPES } from './nettoyer.mjs';
import { LEX } from '../../../contenu.js';

const { S, F, msPreparer } = chargerMoteur();
const PERSONAS = { bureau: 'Nadia (bureau)', etudiant: 'Léo (étudiant)', retraitee: 'Monique (retraitée)', anglais: 'Sam (surtout en anglais)' };
const JOURS_ACTIFS = { bureau: 230, etudiant: 280, retraitee: 200, anglais: 230 }; // hypothèse : jours par an où l’on tape autant
const CAP = 3; // stratégie (c) : au plus 3 tuiles par jour
const attendus = JSON.parse(readFileSync(path.join(ICI, 'corpus/attendus.json'), 'utf8'));
const peinture = existsSync(path.join(ICI, 'peinture.json')) ? JSON.parse(readFileSync(path.join(ICI, 'peinture.json'), 'utf8')) : null;

const trie = a => [...a].sort((x, y) => x - y), mediane = a => (a.length ? trie(a)[Math.floor(a.length / 2)] : 0), centile = (a, p) => (a.length ? trie(a)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100, moyenne = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const chrono = (f, n = 5) => { const t = []; let r; for (let k = 0; k < n; k++) { const t0 = performance.now(); r = f(); t.push(performance.now() - t0); } return { r, ms: mediane(t) }; };
const nom = o => o.objet.noms?.[0] || o.objet.id.split('/')[1];
const humeur = l => { const v = l.valence * 1.6, e = l.energie * 1.6; return v > .15 ? (e > .15 ? 'clair' : 'doré') : v < -.15 ? (e > .15 ? 'orage' : 'gris') : 'neutre'; }; // comme climatDe()

// combien de caractères, de mots, de mots connus du vocabulaire, de mots porteurs
function compter(texte) {
  const mots = motsDe(texte), pleins = mots.filter(m => m.length >= 3 && !VIDES.has(m)), j = jetonsDe(S, texte, VIDES), p = j.filter(([, i]) => sens.porteur(S, i));
  return { caracteres: texte.length, octets: Buffer.byteLength(texte), mots: texte.split(/\s+/).filter(Boolean).length, motsLus: mots.length, pleins: pleins.length,
    connus: j.length, couverture: pleins.length ? j.length / pleins.length : 0, porteurs: p.length, porteursDistincts: new Set(p.map(([, i]) => i)).size };
}
const vocabulaire = texte => new Set(jetonsDe(S, texte, VIDES).map(([, i]) => S.liste[i]));

// un moment du jour est évoqué si un objet d’une tuile a pour mot, ou pour nom, l’un des mots attendus
function evoquer(attendu, plans, seulementPoses = false) {
  const evts = Object.entries(attendu).filter(([k]) => !k.startsWith('_')), couverts = [];
  const objetsDe = p => (seulementPoses ? p.objets.filter(o => p.items.some(it => it.id === o.objet.id)) : p.objets);
  const touche = (o, set) => set.has(o.mot) || (o.objet.noms || []).some(n => set.has(n));
  for (const [evt, mots] of evts) { const set = new Set(mots); if (plans.some(p => objetsDe(p).some(o => touche(o, set)))) couverts.push(evt); }
  const tuilesQuiEvoquent = plans.filter(p => evts.some(([, mots]) => { const set = new Set(mots); return objetsDe(p).some(o => touche(o, set)); })).length;
  return { couverts: couverts.length, total: evts.length, liste: couverts, tuilesQuiEvoquent };
}
function decrire(plans) {
  return plans.map(p => ({ porteurs: p.lecture.mots.length, mots: p.lecture.mots.map(m => m.m), objets: p.objets.map(o => `${o.mot}→${nom(o)}`), nObjets: p.objets.length,
    poses: poses(p), lieu: p.lieu, valence: r2(p.lecture.valence), energie: r2(p.lecture.energie), humeur: humeur(p.lecture), extrait: p.texte.slice(0, 90).replace(/\s+/g, ' ') }));
}
function resumer(nomStrat, plans, attendu, msPlan) {
  const t = decrire(plans), n = t.length;
  return { strategie: nomStrat, tuiles: n, objetsParTuile: r2(moyenne(t.map(x => x.nObjets))), sansObjet: t.filter(x => !x.nObjets).length, unOuMoins: t.filter(x => x.nObjets <= 1).length,
    deuxOuMoins: t.filter(x => x.nObjets <= 2).length, objetsDistincts: new Set(plans.flatMap(p => p.objets.map(o => o.objet.id))).size,
    lieux: Object.fromEntries(Object.entries(t.reduce((a, x) => ((a[x.lieu] = (a[x.lieu] || 0) + 1), a), {}))), evocation: evoquer(attendu, plans), evocationPoses: evoquer(attendu, plans, true),
    msPlan: r1(msPlan), detail: t };
}

// les stratégies d’agrégation, sur une journée déjà nettoyée
function strategies(items, attendu) {
  const page = pageDuJour(items), out = {};
  const d = sens.decouper(S, page), passages = d.length ? d.map(x => x.texte) : [page];
  let t0 = performance.now(), plans = planifierTuiles(S, F, passages);
  out.a = resumer('(a) tous les passages', plans, attendu, performance.now() - t0);
  t0 = performance.now(); plans = planifierTuiles(S, F, [page]);
  out.b = resumer('(b) une tuile par jour', plans, attendu, performance.now() - t0);
  out.b.top14 = plans[0].lecture.mots.map(m => m.m);
  // (c) les CAP passages les plus riches en images : la somme des scores de leurs objets possibles, sans tenir compte des récents
  const riches = passages.map((texte, k) => { const lecture = sens.lirePage(S, texte), liste = sens.candidats(S, lecture); return { k, texte, r: sens.objetsDeLaPage(S, lecture, { liste }).reduce((s, o) => s + o.brut, 0) }; });
  const gardes = [...riches].sort((x, y) => y.r - x.r).slice(0, CAP).sort((x, y) => x.k - y.k);
  t0 = performance.now(); plans = planifierTuiles(S, F, gardes.map(x => x.texte));
  out.c = resumer(`(c) au plus ${CAP} tuiles, les plus riches`, plans, attendu, performance.now() - t0);
  out.c.gardes = gardes.map(x => x.k);
  // (e) au plus CAP tuiles, riches et variées : chaque passage gardé doit apporter des objets que les autres n’ont pas
  const choix = [], vus = new Set();
  const lusE = passages.map((texte, k) => { const lecture = sens.lirePage(S, texte), liste = sens.candidats(S, lecture); return { k, texte, objets: sens.objetsDeLaPage(S, lecture, { liste }) }; });
  while (choix.length < Math.min(CAP, lusE.length)) {
    const gain = x => x.objets.filter(o => !vus.has(o.objet.id) && !vus.has(o.mot)).reduce((s, o) => s + o.brut, 0);
    const meilleur = lusE.filter(x => !choix.includes(x)).sort((x, y) => gain(y) - gain(x))[0];
    choix.push(meilleur); for (const o of meilleur.objets) { vus.add(o.objet.id); vus.add(o.mot); }
  }
  choix.sort((x, y) => x.k - y.k);
  t0 = performance.now(); plans = planifierTuiles(S, F, choix.map(x => x.texte));
  out.e = resumer(`(e) au plus ${CAP} tuiles, riches et variées`, plans, attendu, performance.now() - t0);
  out.e.gardes = choix.map(x => x.k);
  // (d) une tuile par source : les courriels d’un côté, tout le reste du navigateur de l’autre
  const groupes = new Map(); for (const it of items) { const g = familleSource(it.source); groupes.set(g, [...(groupes.get(g) || []), it]); }
  t0 = performance.now(); plans = planifierTuiles(S, F, [...groupes.values()].map(pageDuJour));
  out.d = resumer('(d) une tuile par source (mail / web)', plans, attendu, performance.now() - t0);
  out.d.sources = [...groupes.keys()];
  return { out, passages };
}

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' '); // comme app.js
const filet = t => { t = norm(t); return { self: LEX.self.filter(k => t.includes(k)), other: LEX.other.filter(k => t.includes(k)), soft: LEX.soft.filter(k => t.includes(k)) }; };

const R = { date: new Date().toISOString(), node: process.version, msPreparer: r1(msPreparer), personas: {} };
for (const [id, libelle] of Object.entries(PERSONAS)) {
  const { fiche, items } = lireCorpus(path.join(ICI, `corpus/${id}.txt`)), propres = nettoyerJour(items);
  const brut = pageDuJour(items), net = pageDuJour(propres), P = { libelle, fiche, saisies: items.length, parSource: {} };
  for (const it of items) P.parSource[it.source] = (P.parSource[it.source] || 0) + 1;
  P.brut = compter(brut); P.net = compter(net);

  // 1. le découpage d’une journée entière, comme une page : brute, puis nettoyée
  const db = chrono(() => sens.decouper(S, brut)), dn = chrono(() => sens.decouper(S, net));
  P.decoupage = { brut: { passages: db.r.length, ms: r1(db.ms), porteurs: db.r.map(x => x.porteurs) }, net: { passages: dn.r.length, ms: r1(dn.ms), porteurs: dn.r.map(x => x.porteurs) } };

  // 2. le temps de lecture d’un passage (lirePage + candidats : le calcul lourd, gardé ensuite dans « lectures ») et du reste
  const lectures = [], tailles = [];
  for (const x of dn.r) { const c = chrono(() => { const l = sens.lirePage(S, x.texte); return { l, liste: sens.candidats(S, l) }; }); lectures.push(c.ms); tailles.push(JSON.stringify(lectureGardee(c.r.l, c.r.liste)).length); }
  P.lecture = { msMediane: r2(mediane(lectures)), msP95: r2(centile(lectures, .95)), msMax: r2(Math.max(...lectures)), octetsLectureGardee: Math.round(moyenne(tailles)) };

  // 3. le bruit : chaque étape du nettoyage seule, puis toutes ; les objets « parasites » viennent de mots absents du texte nettoyé
  const voc = vocabulaire(net), bruit = {};
  const mesurerBruit = its => {
    const page = pageDuJour(its), d = sens.decouper(S, page), plans = planifierTuiles(S, F, d.length ? d.map(x => x.texte) : [page]);
    const objets = plans.flatMap(p => p.objets), parasites = objets.filter(o => !voc.has(o.mot));
    const un = planifierTuiles(S, F, [page])[0], top = un.lecture.mots.map(m => m.m);
    return { ...compter(page), tuiles: plans.length, objets: objets.length, parasites: parasites.length, exemplesParasites: [...new Set(parasites.map(o => `${o.mot}→${nom(o)}`))].slice(0, 12),
      top14Parasites: top.filter(m => !voc.has(m)), objetsJourParasites: un.objets.filter(o => !voc.has(o.mot)).map(o => `${o.mot}→${nom(o)}`), lieuJour: un.lieu };
  };
  bruit.brut = mesurerBruit(items);
  for (const e of ETAPES) bruit[`seule:${e}`] = mesurerBruit(nettoyerJour(items, { etapes: [e] }));
  bruit.net = mesurerBruit(propres);
  P.bruit = bruit;

  // 4. les stratégies d’agrégation, sur la journée nettoyée ; et (a) sur la journée brute, pour comparer
  const { out } = strategies(propres, attendus[id]);
  const dBrut = sens.decouper(S, brut), plansBrut = planifierTuiles(S, F, dBrut.map(x => x.texte));
  out.aBrut = resumer('(a) tous les passages, texte brut', plansBrut, attendus[id], 0);
  P.strategies = out;
  // la tonalité du jour entier
  const jour = sens.lirePage(S, net); P.ton = { valence: r2(jour.valence), energie: r2(jour.energie), humeur: humeur(jour), heure: jour.heure };
  // le temps du reste du calcul, par tuile, refait à chaque ouverture de l’app : objets, lieu, plan
  const n = out.a.tuiles, tPlan = chrono(() => planifierTuiles(S, F, dn.r.map(x => x.texte)), 3);
  P.msParTuileTout = r2(tPlan.ms / Math.max(1, n));
  // à chaque ouverture de l’app, la lecture vient du carnet ; restent les objets, le lieu et le plan de chaque tuile
  const lus = dn.r.map(x => { const l = sens.lirePage(S, x.texte); return { l, liste: sens.candidats(S, l) }; });
  const ouvrir = chrono(() => { const recents = new Map(), decor = new Map(); let veille = null; lus.forEach((x, i) => { const objets = sens.objetsDeLaPage(S, x.l, { recents, jour: i + 1, liste: x.liste }); for (const o of objets) recents.set(o.objet.id, i + 1); const lieu = sens.lieuDeLaPage(x.l, objets, veille?.lieu); veille = monde.planifier({ i: i + 1, date: '2026-10-05', lieu, objets, climat: monde.climatDe(x.l) }, veille, F, decor); }); }, 7);
  P.msOuvertureParTuile = r2(ouvrir.ms / Math.max(1, lus.length));
  // la journée qui grandit : après chaque saisie, la page du jour est redécoupée ; combien de passages changent de texte ?
  // (chaque passage changé est à relire et sa tuile à repeindre, et la clé d’une tuile dépend aussi de ses deux voisines)
  let avant = [], changes = 0;
  for (let k = 1; k <= propres.length; k++) { const d = sens.decouper(S, pageDuJour(propres.slice(0, k))).map(x => x.texte); changes += d.filter(x => !avant.includes(x)).length; avant = d; }
  P.croissance = { saisies: propres.length, tuilesFinales: avant.length, passagesRecalcules: changes };
  // le filet de sécurité d’Archipel (aide() dans app.js) sur la journée : se déclencherait-il ?
  P.filet = { brut: filet(brut), net: filet(net) };
  R.personas[id] = P;
}

// 5. des essais ciblés : une phrase ordinaire, puis la même avec un seul type de bruit
const BASE = 'Ce matin, un café sur le balcon, puis le marché sous la pluie avec mon fils.';
const BRUITS = {
  'lien (URL)': 'https://www.leboncoin.fr/recherche?category=55&text=velo%2020%20pouces&locations=Lyon',
  'adresses de courriel': 'marc.dubois@rhone-express.example, yves.legoff29@orange.example',
  'nombres, dates, références': 'Commande n° BC-2026-0917 du 05/10/2026 : 3 palettes, 14h30, 2 340,00 € TTC, tél. 06 39 98 41 27',
  'signature': 'Cordialement,\n\nNadia Benali\nResponsable logistique\nArdoise Mobilier\n12 rue des Tanneurs, 69100 Villeurbanne\nTél. : 01 99 00 41 27 | www.ardoise-mobilier.example\nEnvoyé de mon iPhone',
  'mention légale': 'Ce message et ses pièces jointes sont confidentiels et destinés exclusivement à leurs destinataires. Si vous avez reçu ce message par erreur, merci de le détruire et d’en avertir l’expéditeur.',
  'citation (réponse)': 'Le lun. 5 oct. 2026 à 07:58, Marc Dubois <marc.dubois@rhone-express.example> a écrit :\n> Bonjour Nadia,\n> Notre camion 19 tonnes est tombé en panne hier soir sur l’A42, il est au garage jusqu’à mercredi au mieux.\n> Bien à vous,\n> Marc Dubois\n> Transports Rhône Express - Exploitation',
  'code': '```js\nconst panier = document.querySelector(".cart");\nfor (let i = 0; i < items.length; i++) { total += items[i].price; }\nreturn total;\n```',
  'formule de tableur': '=RECHERCHEV(A2;Stock!A:D;4;FAUX)',
  'phrase anglaise': 'I think the meeting is at the office with the team, and we should really bring something for the party.',
  'clavardage': 'mdr jsp stp ouais grave lol ok',
};
const lire = t => { const l = sens.lirePage(S, t), o = sens.objetsDeLaPage(S, l); return { mots: l.mots.map(m => m.m), objets: o.map(x => `${x.mot}→${nom(x)}`), lieu: sens.lieuDeLaPage(l, o), tuiles: sens.decouper(S, t).length, humeur: humeur(l) }; };
const base = lire(BASE);
R.essais = { base: { texte: BASE, ...base }, bruits: {} };
for (const [k, b] of Object.entries(BRUITS)) {
  const avec = lire(`${BASE}\n\n${b}`), seul = compter(b), jseul = jetonsDe(S, b, VIDES);
  R.essais.bruits[k] = { extrait: b.slice(0, 80).replace(/\s+/g, ' '), motsConnus: jseul.map(([m]) => m), porteurs: jseul.filter(([, i]) => sens.porteur(S, i)).map(([, i]) => S.liste[i]),
    motsAjoutes: avec.mots.filter(m => !base.mots.includes(m)), motsPerdus: base.mots.filter(m => !avec.mots.includes(m)), objetsAjoutes: avec.objets.filter(o => !base.objets.includes(o)),
    objetsPerdus: base.objets.filter(o => !avec.objets.includes(o)), lieu: avec.lieu, humeur: avec.humeur, porteursSeul: seul.porteurs };
}

// 6. le stockage : par jour et par an, pour chaque stratégie ; la taille d’une tuile vient de peinture.cjs s’il a tourné
const tuileWebp = peinture?.tailles?.webp?.moyenne ?? null, tuileJpeg = peinture?.tailles?.jpeg?.moyenne ?? null;
R.stockage = { tuileWebp, tuileJpeg, source: peinture ? 'peinture.json (mesuré)' : 'pas encore mesuré', parPersona: {} };
for (const [id, P] of Object.entries(R.personas)) {
  const j = JOURS_ACTIFS[id], ligne = { joursActifs: j, page: P.net.octets * 2, lecture: P.lecture.octetsLectureGardee }; // une chaîne JS : deux octets par caractère, au pire
  for (const k of ['a', 'b', 'c', 'd', 'e']) {
    const n = P.strategies[k].tuiles;
    ligne[k] = { tuilesJour: n, tuilesAn: n * j, moWebpAn: tuileWebp ? r1(n * j * tuileWebp / 1048576) : null, moJpegAn: tuileJpeg ? r1(n * j * tuileJpeg / 1048576) : null,
      moLecturesAn: r1(n * j * P.lecture.octetsLectureGardee / 1048576), moPagesAn: r1(j * P.net.octets * 2 / 1048576) };
  }
  R.stockage.parPersona[id] = ligne;
}
writeFileSync(path.join(ICI, 'resultats.json'), JSON.stringify(R, null, 1));

/* ───────── les tableaux, en Markdown ───────── */
const L = [], t = (...c) => L.push(`| ${c.join(' | ')} |`), sep = n => L.push(`|${' --- |'.repeat(n)}`);
const ids = Object.keys(PERSONAS), P = id => R.personas[id];
L.push('## Volumes et découpage (journée entière = une page)', '');
t('Mesure', ...ids.map(id => PERSONAS[id])); sep(5);
t('Saisies du jour', ...ids.map(id => `${P(id).saisies} (${Object.entries(P(id).parSource).map(([k, v]) => `${v} ${k}`).join(', ')})`));
t('Caractères brut → nettoyé', ...ids.map(id => `${P(id).brut.caracteres} → ${P(id).net.caracteres}`));
t('Mots brut → nettoyé', ...ids.map(id => `${P(id).brut.mots} → ${P(id).net.mots}`));
t('Mots pleins connus du vocabulaire (nettoyé)', ...ids.map(id => `${Math.round(100 * P(id).net.couverture)} %`));
t('Mots porteurs (occurrences) brut → nettoyé', ...ids.map(id => `${P(id).brut.porteurs} → ${P(id).net.porteurs}`));
t('Porteurs distincts brut → nettoyé', ...ids.map(id => `${P(id).brut.porteursDistincts} → ${P(id).net.porteursDistincts}`));
t('Passages = tuiles (decouper) brut → nettoyé', ...ids.map(id => `${P(id).decoupage.brut.passages} → ${P(id).decoupage.net.passages}`));
t('decouper() sur la journée (ms)', ...ids.map(id => `${P(id).decoupage.brut.ms} → ${P(id).decoupage.net.ms}`));
t('Lecture d’un passage, lirePage+candidats (ms, médiane / p95)', ...ids.map(id => `${P(id).lecture.msMediane} / ${P(id).lecture.msP95}`));
t('Objets + lieu + plan, par tuile (ms)', ...ids.map(id => P(id).msParTuileTout));
t('À chaque ouverture : objets + lieu + plan, par tuile, lecture gardée (ms)', ...ids.map(id => P(id).msOuvertureParTuile));
t('Lecture gardée par passage (octets JSON)', ...ids.map(id => P(id).lecture.octetsLectureGardee));
t('Journée qui grandit : passages relus/repeints au fil des saisies (pour N tuiles finales)', ...ids.map(id => `${P(id).croissance.passagesRecalcules} (${P(id).croissance.tuilesFinales})`));
t('Mots tapés (nettoyés) par tuile', ...ids.map(id => Math.round(P(id).net.mots / Math.max(1, P(id).decoupage.net.passages))));
t('Tonalité du jour (valence / énergie → ciel)', ...ids.map(id => `${P(id).ton.valence} / ${P(id).ton.energie} → ${P(id).ton.humeur}`));
t('Filet de sécurité déclenché (brut)', ...ids.map(id => { const f = P(id).filet.brut; return [...f.self, ...f.other].join(', ') || 'non'; }));
L.push('', '## Stratégie (a), texte nettoyé : objets et lieu de chaque tuile', '');
for (const id of ids) {
  L.push(`### ${PERSONAS[id]}`, ''); t('#', 'porteurs', 'lieu', 'ciel', 'objets choisis (mot → objet)', 'posés sur la tuile', 'début du passage'); sep(7);
  P(id).strategies.a.detail.forEach((x, k) => t(k + 1, x.porteurs, x.lieu, x.humeur, x.objets.join(', ') || '—', x.poses.length, x.extrait.replace(/\|/g, '/')));
  L.push('');
}
L.push('## Bruit : chaque étape du nettoyage, seule, sur la journée brute', '');
for (const id of ids) {
  L.push(`### ${PERSONAS[id]}`, ''); t('Variante', 'caractères', 'porteurs distincts', 'tuiles (a)', 'objets (a)', 'dont parasites', 'top 14 du jour : mots parasites', 'lieu (b)'); sep(8);
  for (const [k, v] of Object.entries(P(id).bruit)) t(k, v.caracteres, v.porteursDistincts, v.tuiles, v.objets, `${v.parasites}${v.exemplesParasites.length ? ` (${v.exemplesParasites.slice(0, 5).join(', ')})` : ''}`, v.top14Parasites.join(', ') || '—', v.lieuJour);
  L.push('');
}
L.push('## Essais ciblés : une phrase ordinaire, plus un seul type de bruit', '', `Phrase de base : « ${BASE} » → mots ${R.essais.base.mots.join(', ')} ; objets ${R.essais.base.objets.join(', ')} ; lieu ${R.essais.base.lieu}`, '');
t('Bruit ajouté', 'mots connus du vocabulaire', 'dont porteurs', 'mots ajoutés au top 14', 'objets ajoutés', 'objets perdus', 'lieu'); sep(7);
for (const [k, v] of Object.entries(R.essais.bruits)) t(k, v.motsConnus.join(' ') || '—', v.porteurs.join(' ') || '—', v.motsAjoutes.join(' ') || '—', v.objetsAjoutes.join(', ') || '—', v.objetsPerdus.join(', ') || '—', v.lieu);
L.push('', '## Stratégies d’agrégation (texte nettoyé)', '');
t('Persona', 'Stratégie', 'tuiles/jour', 'objets/tuile', 'tuiles sans objet', 'tuiles ≤ 1 objet', 'objets distincts', 'moments évoqués (objets choisis)', 'moments évoqués (objets posés)', 'tuiles qui évoquent un moment'); sep(10);
for (const id of ids) for (const k of ['aBrut', 'a', 'b', 'c', 'e', 'd']) { const s = P(id).strategies[k]; t(PERSONAS[id], s.strategie, s.tuiles, s.objetsParTuile, s.sansObjet, s.unOuMoins, s.objetsDistincts, `${s.evocation.couverts}/${s.evocation.total}`, `${s.evocationPoses.couverts}/${s.evocationPoses.total}`, `${s.evocation.tuilesQuiEvoquent}/${s.tuiles}`); }
L.push('', '### Les tuiles des stratégies (b), (c), (e) et (d)', '');
for (const id of ids) for (const k of ['b', 'c', 'e', 'd']) { const s = P(id).strategies[k]; s.detail.forEach((x, n) => L.push(`- ${PERSONAS[id]} ${s.strategie}${s.detail.length > 1 ? ` #${n + 1}` : ''} : ${x.lieu}, ciel ${x.humeur} ; ${x.objets.join(', ') || 'aucun objet'}${k === 'b' && !n ? ` ; top 14 : ${s.top14.join(', ')}` : ''}`)); }
L.push('', '## Stockage projeté par an', '', `Taille d’une tuile : ${tuileWebp ? `${Math.round(tuileWebp / 1024)} Kio en WebP (Chrome, Firefox), ${Math.round(tuileJpeg / 1024)} Kio en JPEG 0,9 (Safari, qui n’encode pas le WebP)` : 'non mesurée'} ; source : ${R.stockage.source}.`, '');
t('Persona (jours actifs/an)', 'Stratégie', 'tuiles/jour', 'tuiles/an', 'Mo/an WebP', 'Mo/an JPEG (iPhone)', 'Mo/an lectures', 'Mo/an pages'); sep(8);
for (const id of ids) { const s = R.stockage.parPersona[id]; for (const k of ['a', 'b', 'c', 'e', 'd']) t(`${PERSONAS[id]} (${s.joursActifs})`, k, s[k].tuilesJour, s[k].tuilesAn, s[k].moWebpAn ?? '?', s[k].moJpegAn ?? '?', s[k].moLecturesAn, s[k].moPagesAn); }
writeFileSync(path.join(ICI, 'tableaux.md'), `# Tableaux produits par mesure.mjs (${R.date.slice(0, 10)}, Node ${R.node})\n\n${L.join('\n')}\n`);
console.log(L.join('\n'));
console.log(`\npréparation du moteur : ${R.msPreparer} ms ; résultats : resultats.json, tableaux.md`);
