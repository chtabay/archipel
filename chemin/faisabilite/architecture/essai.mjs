// Essai de faisabilité : des écrits de l’ordinateur au chemin du téléphone, sans que personne d’autre ne lise.
//   node chemin/faisabilite/architecture/essai.mjs
// Données inventées uniquement : la journée de « Camille » ci-dessous n’est celle de personne, et l’historique est le
// journal d’exemple du chemin (chemin/demo.js). Ne touche ni au carnet, ni au réseau.
//
// Ce que l’essai vérifie :
//   1. une tuile n’a pas besoin du texte : le plan de chaque tuile (ce qui décide de sa peinture) est le même, au bit près,
//      qu’on parte du texte ou de sa lecture mince, même passée en octets (float32) ;
//   2. la place que prend une journée d’écrits, selon sa forme : texte, sac, lecture mince ; en QR codes ;
//   3. une tuile par écrit, ou une par jour : combien de tuiles ; et la réunion exacte des sacs de plusieurs appareils ;
//   4. ce que coûte l’arrivée tardive d’écrits : combien de tuiles déjà peintes sont à repeindre ;
//   5. ce que chaque forme laisse lire ;
//   6. le colis scellé : ce que garde le relais.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparer, decouper, lirePage, candidats, objetsDeLaPage, lieuDeLaPage, FICHIERS_SENS } from '../../sens.js';
import { familles, planifier, climatDe, MOTEUR } from '../../monde.js';
import { demo } from '../../demo.js';
import { tokeniseur, sacDe, additionner, tronquer, lireSac, mince, relireMince, reunirMinces, emballer, deballer } from './lecture.js';
import { passages as ordonner, reunir, nouvelleTrace } from './traces.js';
import { appairer, cles, sceller, ouvrir, b64 } from './scelle.js';

const ICI = path.dirname(fileURLToPath(import.meta.url)), CHEMIN = path.join(ICI, '..', '..');
const lire = f => fs.readFileSync(path.join(CHEMIN, f.replace(/\?.*$/, '')));
const [mots, V, O, I, cat] = FICHIERS_SENS.map(lire);
const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const S = preparer(mots.toString('utf8'), buf(V), buf(O), JSON.parse(cat), buf(I)), F = familles(S.catalogue);
const T = tokeniseur(fs.readFileSync(path.join(CHEMIN, 'sens.js'), 'utf8'));
let echecs = 0;
const verifier = (ok, quoi) => { console.log(`${ok ? 'ok  ' : 'ÉCHEC'} · ${quoi}`); if (!ok) echecs++; };
const titre = t => console.log(`\n── ${t}`);
const octets = s => Buffer.byteLength(s, 'utf8'), deflate = b => zlib.deflateRawSync(b, { level: 9 }).length;
const QR = { 'V40-M': 2331, 'V25-M': 997, 'V15-M': 412 }; // octets par QR code (mode octet), vérifiés avec segno 1.6.6
const qr = n => Object.entries(QR).map(([v, c]) => `${Math.ceil(n / c)} × ${v}`).join(', ');

/* ───────── La journée inventée de Camille, le 7 octobre 2026 ───────── */

const JOUR = '2026-10-07';
const ECRITS = [
  ['08:12', 'gmail', 'Bonjour Marc, je te transmets le compte rendu de la réunion d’hier sur le projet de la médiathèque. Le client souhaite revoir le planning du chantier et déplacer la livraison des bureaux à décembre. Peux-tu regarder le budget avant jeudi ? Bonne journée, Camille'],
  ['08:40', 'navigateur', 'Je dépose les enfants à l’école et j’arrive, garde-moi un café.'],
  ['09:31', 'navigateur', 'horaires train Lyon Grenoble samedi matin'],
  ['10:05', 'gmail', `Bonjour à toutes et à tous,

Suite à notre réunion de lundi, voici les points retenus pour le déménagement des bureaux. Les cartons seront livrés mercredi ; chacun range son poste, ses dossiers et son ordinateur avant vendredi midi. Les écrans et les claviers partent avec le camion de la société, les plantes vertes aussi.

Au nouveau bâtiment, l’open space du deuxième étage accueille l’équipe projet. La salle de réunion donne sur le parc, avec une grande table et un tableau blanc. La cuisine est au rez-de-chaussée, avec une machine à café neuve et un frigo partagé.

Le parking à vélos est derrière l’immeuble ; les badges seront distribués à l’accueil lundi matin. Merci de vérifier que vos clés de l’ancien bureau sont rendues au secrétariat.

Bien à vous, Camille`],
  ['11:20', 'navigateur', 'J’ai testé avec des pommes du jardin et un peu de cannelle, la tarte était parfaite. Merci pour la recette !'],
  ['12:44', 'navigateur', 'Pique-nique au parc à midi ? Il fait beau, j’apporte du pain, du fromage et des tomates.'],
  ['14:10', 'gmail', 'Bonjour Madame, la fuite sous le lavabo de la salle de bain a repris ce week-end. Le plombier peut-il passer cette semaine ? Je serai à la maison mardi après-midi. Cordialement, Camille'],
  ['15:32', 'navigateur', 'Mon vélo électrique ne charge plus : la batterie clignote en rouge depuis hier. Le chargeur est neuf.'],
  ['16:50', 'navigateur', 'Notes : appeler le fournisseur de chaises, réserver la salle pour la fête de fin d’année, commander le gâteau et les ballons.'],
  ['18:21', 'navigateur', 'Maman a appelé, elle est fatiguée mais ça va. On passe dimanche avec un gâteau et des fleurs ?'],
  ['21:03', 'navigateur', 'Quelqu’un connaît un beau sentier en forêt près de Chambéry ? Avec un chien, pas trop de rochers.'],
  ['21:40', 'gmail', `Chers voisins,

La fête du village aura lieu samedi sur la place de l’église. Le marché ouvre à neuf heures : fromages, légumes du potager, pain de campagne et confitures. À midi, grande table sous les arbres, chacun apporte un plat.

L’après-midi, jeux pour les enfants, course en sac et pêche aux canards près de la fontaine. Le club de musique jouera sur l’estrade, guitare, accordéon et tambour. Une tombola permettra de gagner un panier garni et un vélo.

Le soir, bal sous les lampions et feu de camp au bord de la rivière, si le temps le permet. Pensez à vos lampes de poche pour le retour par le chemin du moulin.

Nous cherchons encore des bénévoles pour monter les tentes, porter les bancs et tenir la buvette. Répondez à ce message, merci !

Le comité des fêtes`],
];
const PAGE = { date: JOUR, texte: 'Journée chargée au bureau. Le soir, une balade au bord du lac avec le chien, le ciel était rose et l’eau très calme.' };
const HISTOIRE = demo(new Date('2026-10-06T12:00:00')); // trente pages d’exemple, la dernière la veille
const at = h => new Date(`${JOUR}T${h}:00`).getTime();
const TRACES = ECRITS.map(([h, source, texte]) => nouvelleTrace({ date: JOUR, at: at(h), source, appareil: source === 'gmail' ? 'telephone' : 'ordinateur', forme: 'texte', contenu: texte }));

/* ───────── Le calcul de calculer(), sans IndexedDB ni attente ───────── */

const luDuTexte = texte => { const lecture = lirePage(S, texte); return { lecture, liste: candidats(S, lecture) }; };
function planifierTout(liste) { // la boucle de calculer() dans chemin/app.js, telle quelle
  const recents = new Map(), decor = new Map(), faits = []; let veille = null;
  for (const [i, x] of liste.entries()) {
    const l = x.lu || luDuTexte(x.texte);
    const objets = objetsDeLaPage(S, l.lecture, { recents, jour: i, liste: l.liste });
    for (const o of objets) recents.set(o.objet.id, i);
    const lieu = x.depart ? 'champs' : lieuDeLaPage(l.lecture, objets, veille?.lieu), jour = { i, date: x.date, lieu, objets, climat: climatDe(l.lecture) };
    veille = planifier(jour, veille, F, decor); veille.objets = objets; veille.passage = x;
    faits.push(veille);
  }
  return faits;
}
const empreinte = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (b >>> 0).toString(36) + (a >>> 0).toString(36); };
const signe = p => (p ? JSON.stringify([p.i, p.date, p.lieu, p.saison, p.climat, p.items, p.piece, p.sol]) : '');
const clesDesTuiles = plans => plans.map((_, k) => `${MOTEUR}:${empreinte(`${signe(plans[k - 1])}|${signe(plans[k])}|${signe(plans[k + 1])}`)}`); // cle() de app.js
const poses = p => [...new Set(p.objets.filter(o => p.items.some(it => it.id === o.objet.id)).map(o => o.mot))];
const decoupe = t => decouper(S, t);

/* ───────── 1. Une tuile a-t-elle besoin du texte ? ───────── */

titre('1. Une tuile sans le texte');
{
  const parTexte = ordonner([...HISTOIRE, PAGE], [], { decouper: decoupe });
  const plansTexte = planifierTout(parTexte), ref = plansTexte.map(signe);
  const formes = {
    'lecture mince (JSON)': x => relireMince(F, JSON.parse(JSON.stringify(mince(S, luDuTexte(x.texte).lecture)))),
    'lecture mince en octets (float32)': x => relireMince(F, deballer(emballer(mince(S, luDuTexte(x.texte).lecture), S.catalogue), S.catalogue)),
    'lecture mince, mots remplacés par des numéros': x => relireMince(F, deballer(emballer(mince(S, luDuTexte(x.texte).lecture, { opaque: true }), S.catalogue), S.catalogue)),
    'sac complet': x => { const lecture = lireSac(S, sacDe(S, T, x.texte)); return { lecture, liste: candidats(S, lecture) }; },
  };
  for (const [nom, f] of Object.entries(formes)) {
    const plans = planifierTout(parTexte.map(x => ({ ...x, lu: f(x) })));
    const memes = plans.filter((p, k) => signe(p) === ref[k]).length;
    verifier(memes === ref.length, `${nom} : ${memes} tuiles sur ${ref.length} ont exactement le même plan qu’avec le texte`);
  }
  const p = plansTexte.at(-1), opaque = planifierTout(parTexte.map(x => ({ ...x, lu: formes['lecture mince, mots remplacés par des numéros'](x) }))).at(-1);
  const nomsPoses = p => [...new Set(p.objets.filter(o => p.items.some(it => it.id === o.objet.id)).map(o => o.objet.noms?.[0] || o.objet.id))];
  console.log(`     la page du jour, touchée : « ${poses(p).join(', ')} » (ses mots) ; sans les mots, on ne peut dire que ses objets : « ${nomsPoses(opaque).join(', ')} »`);
}

/* ───────── 2. La place d’une journée d’écrits ───────── */

titre('2. La place d’une journée d’écrits (12 écrits inventés)');
{
  const texte = TRACES.map(t => t.texte).join('\n\n'), lecture = lirePage(S, texte), liste = candidats(S, lecture);
  const sacs = TRACES.map(t => sacDe(S, T, t.texte)), sac = additionner(sacs), sac40 = tronquer(S, sac, 40);
  const mJ = mince(S, lecture), mB = emballer(mJ, S.catalogue), mO = emballer(mince(S, lecture, { opaque: true }), S.catalogue);
  const sacOctets = s => 3 * s.n.length + s.ton.reduce((a, [m]) => a + 2 + octets(m), 0) + 2; // numéro sur 2 octets + nombre sur 1, à peu près
  const lignes = [
    ['le texte, tel quel', octets(texte), deflate(Buffer.from(texte))],
    ['le sac complet (JSON)', octets(JSON.stringify(sac)), deflate(Buffer.from(JSON.stringify(sac)))],
    ['le sac complet (en octets, estimé)', sacOctets(sac), null],
    ['le sac des 40 mots les plus lourds (JSON)', octets(JSON.stringify(sac40)), deflate(Buffer.from(JSON.stringify(sac40)))],
    ['la lecture mince du jour (JSON)', octets(JSON.stringify(mJ)), deflate(Buffer.from(JSON.stringify(mJ)))],
    ['la lecture mince du jour (octets)', mB.length, deflate(mB)],
    ['la lecture mince, sans les mots (octets)', mO.length, deflate(mO)],
  ];
  for (const [nom, n, z] of lignes) console.log(`     ${nom.padEnd(44)} ${String(n).padStart(6)} o${z != null ? `  (compressé : ${String(z).padStart(5)} o)` : '                    '}  → ${qr(z ?? n)}`);
  console.log(`     ${TRACES.length} écrits, ${texte.split(/\s+/).length} mots ; ${sac.n.length} mots distincts dans le sac ; ${liste.length} objets possibles dans la lecture du jour`);
  verifier(mB.length <= QR['V25-M'], `la lecture mince d’une journée tient dans un seul QR code moyen (${mB.length} o ≤ ${QR['V25-M']} o, version 25, correction M)`);
}

/* ───────── 3. Une tuile par écrit, ou une par jour ───────── */

titre('3. Une tuile par écrit, ou une par jour');
{
  const lireGroupe = g => { const lecture = lireSac(S, additionner(g.map(t => sacDe(S, T, t.texte)))); return { lecture, liste: candidats(S, lecture) }; };
  for (const mode of ['trace', 'appareil', 'jour']) {
    const l = ordonner([...HISTOIRE, PAGE], TRACES, { regroupement: mode, decouper: decoupe, lire: lireGroupe });
    console.log(`     regroupement « ${mode} » : ${l.filter(x => x.genre === 'traces').length} tuiles d’écrits pour la journée, à côté de ${l.filter(x => x.genre === 'page' && x.date === JOUR).length} tuile de journal`);
  }
  // exactitude : les sacs de l’ordinateur et du téléphone, réunis sur le téléphone, contre le texte entier lu d’un coup
  const ordi = TRACES.filter(t => t.appareil === 'ordinateur'), tel = TRACES.filter(t => t.appareil === 'telephone');
  const tous = [...TRACES].sort((a, b) => a.at - b.at), entier = lirePage(S, tous.map(t => t.texte).join('\n\n'));
  const parSacs = lireSac(S, additionner(tous.map(t => sacDe(S, T, t.texte)))); // dans l’ordre des heures
  const pareil = (a, b) => JSON.stringify({ ...a, contexte: [...a.contexte] }) === JSON.stringify({ ...b, contexte: [...b.contexte] });
  verifier(pareil(entier, parSacs), 'les sacs additionnés donnent exactement la lecture du texte entier (mots, champs, tonalité, heure)');
  const K = [10, 20, 40, 80].map(k => { const l = lireSac(S, additionner(tous.map(t => tronquer(S, sacDe(S, T, t.texte), k)))); const vrais = new Set(entier.mots.map(m => m.i)); return [k, l.mots.filter(m => vrais.has(m.i)).length]; });
  console.log(`     sacs tronqués à K mots par écrit, mots porteurs du jour retrouvés : ${K.map(([k, n]) => `K=${k} → ${n}/14`).join(' ; ')}`);
  // deux lectures minces (ordinateur, téléphone), réunies à peu près, contre l’exact
  const mOrdi = mince(S, lireSac(S, additionner(ordi.map(t => sacDe(S, T, t.texte))))), mTel = mince(S, lireSac(S, additionner(tel.map(t => sacDe(S, T, t.texte)))));
  const exact = { lu: { lecture: entier, liste: candidats(S, entier) } }, approx = { lu: relireMince(F, reunirMinces([mOrdi, mTel])) };
  const base = ordonner(HISTOIRE, [], { decouper: decoupe }), jour = x => planifierTout([...base, { ...x, date: JOUR, genre: 'traces' }]).at(-1);
  const pe = jour(exact), pa = jour(approx);
  console.log(`     tuile du jour, exacte : ${pe.lieu}, ${pe.objets.map(o => o.objet.id.split('/')[1]).join(' ')}`);
  console.log(`     tuile du jour, lectures minces réunies : ${pa.lieu}, ${pa.objets.map(o => o.objet.id.split('/')[1]).join(' ')}`);
  verifier(pe.lieu === pa.lieu, 'réunir deux lectures minces garde le lieu du jour (sur cet exemple seulement)');
}

/* ───────── 4. Les écrits qui arrivent tard : ce qui est à repeindre ───────── */

titre('4. Des écrits qui arrivent tard : combien de tuiles à repeindre');
{
  const lireGroupe = g => { const lecture = lireSac(S, additionner(g.map(t => sacDe(S, T, t.texte)))); return { lecture, liste: candidats(S, lecture) }; };
  const plans = (pages, traces) => planifierTout(ordonner(pages, traces, { regroupement: 'jour', decouper: decoupe, lire: lireGroupe }));
  const avant = new Set(clesDesTuiles(plans([...HISTOIRE, PAGE], [])));
  const repeindre = (pages, traces) => { const k = clesDesTuiles(plans(pages, traces)); return `${k.filter(c => !avant.has(c)).length} sur ${k.length}`; };
  console.log(`     la page du jour seule, déjà peinte : ${avant.size} tuiles`);
  console.log(`     les écrits du jour arrivent le soir, rangés avant la page du jour : ${repeindre([...HISTOIRE, PAGE], TRACES)} tuiles à peindre`);
  // un chemin d’ordinateur, tenu à part pendant des semaines, réuni d’un coup : des écrits sur dix jours passés
  const passes = HISTOIRE.slice(-10).map((p, n) => nouvelleTrace({ date: p.date, at: new Date(`${p.date}T10:00:00`).getTime(), source: 'navigateur', appareil: 'ordinateur', forme: 'texte', contenu: ECRITS[n % ECRITS.length][2] }));
  const tard = reunir(TRACES, passes);
  console.log(`     dix jours d’écrits d’un ordinateur, réunis d’un coup, chacun à sa date : ${repeindre([...HISTOIRE, PAGE], tard)} tuiles à peindre`);
  // la même chose, mais les écrits en retard sont posés au jour où ils arrivent, au bout du chemin
  const auBout = passes.map(t => ({ ...t, date: JOUR }));
  console.log(`     les mêmes, posés au jour de leur arrivée, au bout du chemin : ${repeindre([...HISTOIRE, PAGE], [...TRACES, ...auBout])} tuiles à peindre`);
}

/* ───────── 5. Ce que chaque forme laisse lire ───────── */

titre('5. Ce que chaque forme laisse lire (la journée de Camille)');
{
  const texte = TRACES.map(t => t.texte).join('\n\n'), lecture = lirePage(S, texte), sac = additionner(TRACES.map(t => sacDe(S, T, t.texte)));
  const m = mince(S, lecture), mo = mince(S, lecture, { opaque: true });
  console.log(`     sac des 40 : ${tronquer(S, sac, 40).n.map(([i]) => S.liste[i]).join(' ')}`);
  console.log(`     lecture mince, ses mots : ${[...new Set(m.o.map(x => x[2]))].join(' ')}`);
  console.log(`     lecture mince sans mots, ses objets : ${[...new Set(mo.o.slice(0, 20).map(x => x[0].split('/')[1]))].join(' ')}…`);
  const champs = Object.keys(S.champs).map((k, n) => [k, m.champs[n]]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`     et toujours : champs dominants ${champs.map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')} ; valence ${m.valence.toFixed(2)} ; énergie ${m.energie.toFixed(2)} ; heure ${m.heure}`);
  // le contexte (96 nombres) n’est pas dans la lecture mince : il dirait le sujet à qui a le vocabulaire public
  const c = lecture.contexte, proches = [];
  for (let i = 0; i < 20000; i++) { let s = 0; for (let k = 0; k < 96; k++) s += S.V[i * 96 + k] * c[k]; proches.push([s, i]); }
  console.log(`     le contexte, s’il partait : ses mots voisins dans le vocabulaire public : ${proches.sort((a, b) => b[0] - a[0]).slice(0, 12).map(([, i]) => S.liste[i]).join(' ')}`);
}

/* ───────── 6. Le colis scellé, et ce que le relais garde ───────── */

titre('6. Le colis scellé : ce que garde le relais');
{
  const graine = appairer(), ordi = await cles(graine), tel = await cles(graine);
  const relais = new Map(); // un relais idiot : boîte/id → enveloppe
  const deposer = e => relais.set(`${e.boite}/${e.id}`, structuredClone(e));
  const colisTexte = { v: 1, appareil: 'ordinateur', traces: TRACES.filter(t => t.appareil === 'ordinateur') };
  const lecture = lirePage(S, colisTexte.traces.map(t => t.texte).join('\n\n'));
  const colisMince = { v: 1, appareil: 'ordinateur', jours: [{ date: JOUR, n: colisTexte.traces.length, mince: b64(emballer(mince(S, lecture, { opaque: true }), S.catalogue)) }] };
  const e1 = await sceller(ordi, colisTexte), e2 = await sceller(ordi, colisMince); deposer(e1); deposer(e2);
  const vu = JSON.stringify([...relais]);
  const fuite = ['Chambéry', 'cannelle', 'Maman', 'plombier', 'batterie', 'pommes', 'cuisine'].filter(m => vu.includes(m));
  verifier(!fuite.length, `le relais ne garde aucun mot des écrits (${relais.size} enveloppes, ${vu.length} caractères)`);
  console.log(`     ce qu’il voit : la boîte ${e1.boite}, deux identifiants au hasard, deux tailles : ${Math.round(e1.ct.length * 3 / 4)} o (les textes de l’ordinateur) et ${Math.round(e2.ct.length * 3 / 4)} o (leur lecture mince, sans les mots), arrondies au palier`);
  const recu = await ouvrir(tel, relais.get(`${e1.boite}/${e1.id}`));
  verifier(recu.traces.length === colisTexte.traces.length && recu.traces[0].texte === colisTexte.traces[0].texte, 'le téléphone ouvre le colis avec la clé lue dans le QR code');
  const abime = { ...e1, ct: e1.ct.slice(0, 40) + (e1.ct[40] === 'A' ? 'B' : 'A') + e1.ct.slice(41) };
  verifier(await ouvrir(tel, abime).then(() => false, () => true), 'un colis modifié en route ne s’ouvre pas');
  verifier(await ouvrir(await cles(appairer()), e1).then(() => false, () => true), 'une autre clé n’ouvre pas le colis');
  verifier(await ouvrir(tel, { ...e2, id: e1.id }).then(() => false, () => true), 'un colis déplacé sous un autre identifiant ne s’ouvre pas');
}

console.log(echecs ? `\n${echecs} échec(s)` : '\ntout est bon');
process.exitCode = echecs ? 1 : 0;
