// L’archipel : les cases, les graines, l’île qui pousse, et l’archipel où la poser, en 3D.
// Ce qu’on dépose reste sur cet appareil. Seule la forme d’une île part dans l’archipel, et seulement quand on l’y met.

import { SUBJECTS, QUESTIONS, KEYS, BASE, LEX, HUMANS } from './contenu.js?v=2';
import { graines, quadDe, nomDe, phrasesDe, casesDe, sujetLabel, listeDe, listeGraines, FAMILLES, ESPECES, NOMS } from './grammaire.js?v=4';
import { nouvelleIle, deriver, resume, forme, depuisForme, archipelInvente, ileInventee, BIOMES, BIOME_IDS, biomeDe } from './ile.js?v=11';
import { Vue3D, Ilot3D, apercu, disponible, ECH_ARCH, ILE_INTRO } from './monde.js?v=19';
import { lireArchipel, poserIle, retirerIle, nouveauJeton } from './serveur.js?v=1';
import { musique } from './musique.js?v=2';
import { lire } from './lexique.js?v=2';

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NB = '\u202f'; // espace fine insécable
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const lerp = (a, b, x) => a + (b - a) * x;
const jour = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const mois = iso => new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/* ───────── État ───────── */

const emptyAnswers = () => Object.fromEntries(KEYS.map(k => [k, new Set()]));
const state = { answers: emptyAnswers(), text: '', short: false, help: 0, helpKind: '', softShown: false, path: null, hinted: false };
const trace = []; // ce qui serait compté (jamais le texte)
const note = s => trace.push(s);
const app = $('#app');
// une question de plus qui ne se pose plus (on a décoché ce qui l’ouvrait) ne compte plus ; ses réponses restent gardées, sans effet
const actives = a => Object.fromEntries(KEYS.map(k => [k, QUESTIONS[k].extra && !QUESTIONS[k].when(a) ? new Set() : a[k]]));
const checked = k => QUESTIONS[k].items.filter(it => actives(state.answers)[k].has(it.id));
const has = (k, id) => state.answers[k].has(id);
const anyChecked = () => { const a = actives(state.answers); return KEYS.some(k => a[k].size); };
const pack = answers => Object.fromEntries(KEYS.map(k => [k, [...answers[k]]]));
const unpack = obj => Object.fromEntries(KEYS.map(k => [k, new Set(Array.isArray(obj?.[k]) ? obj[k].filter(v => typeof v === 'string') : [])]));
const sequence = () => [...BASE, ...KEYS.filter(k => QUESTIONS[k].extra && QUESTIONS[k].when(state.answers))];
const signals = () => { // pour l’aide, on reste prudent : toute case cochée compte, même celle d’une question qui ne se pose plus
  const items = KEYS.flatMap(k => QUESTIONS[k].items.filter(it => state.answers[k].has(it.id)));
  return { strong: items.some(it => it.strong), soft: items.some(it => it.soft), other: has('situ', 'mal') || has('sujets', 's11') || state.answers.subi.size > 0 };
};
const PREFIXE = 'archipel:';
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(PREFIXE + k) || 'null') ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(PREFIXE + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem(PREFIXE + k); } catch { /* rien à effacer */ } },
};
(function reprendre() { // une seule fois : l’île, les îles d’avant et le brouillon gardés sous les noms d’avant, du plus récent au plus ancien
  try {
    if (localStorage.getItem(`${PREFIXE}ile`) !== null) return;
    const avant = ['limbes:', 'limbesD.'].find(p => localStorage.getItem(`${p}ile`) !== null);
    if (avant) for (const k of ['ile', 'iles', 'draft']) { const v = localStorage.getItem(avant + k); if (v !== null) localStorage.setItem(PREFIXE + k, v); }
  } catch { /* stockage indisponible */ }
})();

function saveDraft() { store.set('draft', { answers: pack(state.answers), text: state.text, short: state.short }); }
function loadDraft() {
  const d = store.get('draft', null);
  if (!d) return;
  state.answers = unpack(d.answers); state.text = typeof d.text === 'string' ? d.text : ''; state.short = !!d.short;
}
function clearDraft() {
  state.answers = emptyAnswers(); state.text = ''; state.path = null;
  store.del('draft');
  derive();
}

/* ───────── L’île, et celles d’avant ───────── */

function saine(x) { // une île relue sur ce téléphone : sa forme est vérifiée, et ce qui est abîmé est laissé de côté
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const depots = (Array.isArray(x.depots) ? x.depots : []).filter(d => d && typeof d === 'object').map((d, i) => {
    const r = { ...d, id: d.id ?? i + 1, answers: pack(unpack(d.answers && typeof d.answers === 'object' ? d.answers : {})) };
    if (typeof r.contenu !== 'string') delete r.contenu;
    if (!Array.isArray(r.duTexte)) delete r.duTexte;
    return r;
  });
  const a = x.archipel && typeof x.archipel === 'object' ? x.archipel : null; // sa place dans l’archipel partagé, ou une place qui l’attend
  const archipel = a && ((typeof a.id === 'string' && /^[0-9a-f]{64}$/.test(a.jeton) && Number.isFinite(a.x) && Number.isFinite(a.z)) || (!a.id && a.attente)) ? a : undefined;
  return { ...x, id: x.id ?? Date.now(), seed: Number.isFinite(x.seed) ? x.seed : 1, biome: BIOMES[x.biome] ? x.biome : 'prairie', depots, archipel, envoyee: !!archipel?.id }; // « envoyée » d’avant le serveur : elle n’avait rien quitté
}
let ile = saine(store.get('ile', null)) || nouvelleIle(); // celle qui pousse
let iles = [].concat(store.get('iles', [])).map(saine).filter(Boolean); // celles d’avant, gardées ici
const saveIle = () => store.set('ile', ile);
const saveIles = () => store.set('iles', iles);
const vie = new Map(); // clé → instant d’apparition, pour le petit rebond
let courant; // ce que l’île montre
try { courant = deriver(ile); } catch (e) { console.error(e); ile = nouvelleIle(); courant = deriver(ile); } // une île illisible : on repart d’une île vide plutôt que de ne rien montrer
let regard = null; // une île d’avant qu’on regarde, sinon null
const t0 = performance.now();
const now = () => (performance.now() - t0) / 1000;

/* ───────── Les graines, en compagnie ───────── */

const companion = $('#companion'), entCanvas = $('#ent');
let preview = [], signes = {}; // les graines, et ce que l’îlot montre en plus : le phare, le ciel lourd
let ilot = null, vue = null; // l’îlot des graines ; la vue de l’île et de l’archipel
if (disponible()) try { ilot = new Ilot3D(entCanvas); vue = new Vue3D(); } catch (e) { console.error(e); ilot?.rendu.dispose(); ilot = vue = null; } // la 3D peut refuser de démarrer : on continue sans
const en3D = !!vue;
if (!en3D) { entCanvas.hidden = true; $('#ent-hint').hidden = true; } // sans 3D, pas d’îlot : les graines restent dites en mots
if (ilot) ilot.vieT = now;
if (vue) vue.vieT = now;

let lu = { sujets: [], quad: 'N' }, proposes = []; // ce que le texte dit (lu sur l’appareil), et les sujets qu’il propose
const avecTexte = () => ({ ...state.answers, sujets: new Set([...state.answers.sujets, ...proposes]) }); // les sujets du texte comptent comme des cases

function derive() { // ce que la confession en cours ferait pousser
  const before = new Set(preview.map(a => a.key));
  lu = lire(state.text);
  proposes = lu.sujets.map(([id]) => id).filter(id => !state.answers.sujets.has(id));
  const r = anyChecked() || state.text.trim() ? graines(actives(avecTexte()), state.text.trim(), state.answers.mots.size ? null : { quad: lu.quad }) : null, g = r ? r.graines : [];
  signes = { phare: !!r?.phare, lourd: !!r?.lourd };
  preview = g;
  for (const a of preview) if (!before.has(a.key)) vie.set(a.key, now());
  const noteEl = $('#ent-note');
  if (noteEl) { noteEl.hidden = !proposes.length; noteEl.textContent = proposes.length ? `Ton texte ajoute${NB}: ${proposes.map(sujetLabel).join(' · ')}` : ''; }
}

function drawCompanion() { if (!ilot) return; ilot.maj(preview, biomeDe(ile.biome), ile.seed, vie, signes); ilot.frame(); }

/* ───────── L’île, à l’écran ───────── */

const scene = { d: null };
let titre = null; // ce qui vient de pousser, pour le titre de l’écran
const DIT_ICI = 'Elle pousse avec ce que tu déposes. Rien ne quitte ce téléphone.', DIT_ARCHIPEL = 'Elle pousse avec ce que tu déposes. Sa forme est dans l’archipel ; le reste ne quitte pas ce téléphone.';

function renderIle() {
  const d = regard ? deriver(regard) : courant, mine = !regard;
  const wrap = el('div', { className: 'ilewrap' });
  const invite = d.assets.length ? 'Touche ce qui a poussé. Tourne l’île du doigt, écarte deux doigts pour zoomer.' : 'Rien n’a encore poussé. Ça viendra avec ce que tu déposeras.';
  const caption = el('p', { className: 'ile-caption', id: 'ile-caption', textContent: invite });
  const excerpt = el('p', { className: 'excerpt', id: 'ile-excerpt', hidden: true });
  const line = el('p', { className: 'ile-line', id: 'ile-line' });
  const nav = el('nav', { className: 'actions' }); // une action principale ; les autres, plus discrètes, à côté
  if (mine) {
    const brouillon = anyChecked() || state.text.trim();
    nav.append(bouton(brouillon ? 'Reprendre ce que tu déposais' : 'Déposer autre chose', () => go('q:situ')));
    if (ile.depots.length && !ile.archipel && ile.proposer !== true) nav.append(lienMettre()); // la proposition est passée : l’archipel reste à portée, discrètement
    if (ile.depots.length) nav.append(quiet('changer d’île', changerSheet));
    else nav.append(quiet('choisir le paysage', paysageSheet));
    if (iles.length) nav.append(quiet('tes îles d’avant', ilesSheet));
    const inst = quiet('installer l’app', installerSheet); inst.id = 'installer'; inst.hidden = !installable(); nav.append(inst); // paraît quand le navigateur le permet
  } else nav.append(bouton('Revenir à ton île', () => { regard = null; go('ile'); }));
  if ((regard || ile).archipel?.id) nav.append(quiet('la retirer de l’archipel', () => retirerSheet(regard || ile)));
  const pousses = el('ul', {}, ...(d.assets.length ? d.assets.map(a => el('li', { textContent: ligneDe(a, d) })) : [el('li', { textContent: 'rien encore' })]));
  const what = titre && mine ? titre : null;
  const carte = mine && ile.proposer === true && !ile.archipel ? propositionArchipel() : null; // après un dépôt, rejoindre l’archipel est proposé
  app.replaceChildren(
    el('p', { className: 'step', textContent: mine ? (what ? 'Ton île' : 'Ton île, aujourd’hui') : `Une île d’avant · ${mois(regard.nee)}` }),
    el('h1', { textContent: what ? what.h1 : mine ? 'Ton île' : 'Elle ne pousse plus' }),
    el('p', { className: 'hint', id: 'ile-hint', textContent: what ? what.line : mine ? (ile.envoyee ? DIT_ARCHIPEL : DIT_ICI) : 'Elle reste ici, telle que tu l’as laissée.' }),
    wrap, caption, excerpt, line,
    ...(carte ? [carte] : []),
    nav,
    el('details', {}, el('summary', { textContent: 'Ce qui a poussé' }), pousses),
    el('details', {}, el('summary', { textContent: 'Comment ça pousse' }), legende()),
    el('details', {}, el('summary', { textContent: 'Ce qui serait compté' }), el('ul', {}, ...(trace.length ? trace : ['rien']).map(t => el('li', { textContent: t })))),
    el('p', { className: 'tiny', textContent: 'Ton île reste sur ce téléphone, sans chiffrement. Si tu la mets dans l’archipel, seule sa forme part, telle qu’on la voit : ni tes mots, ni tes dates, ni ton nom.' }),
  );
  titre = null;
  scene.d = d;
  if (!vue) { wrap.classList.add('sans'); caption.hidden = true; wrap.append(el('p', { className: 'sans3d', textContent: 'Cet appareil n’affiche pas la 3D. Ton île est bien là : ce qui a poussé est écrit plus bas.' })); updateIleLine(); return; }
  vue.attacher(wrap);
  vue.canvas.setAttribute('aria-label', mine ? 'Ton île, en 3D, et ce qui y a poussé' : 'Une de tes îles d’avant, en 3D');
  const tourner = el('button', { type: 'button', className: 'tourner', innerHTML: ICONE_TOURNER }); // tourner, sur la vue elle-même
  tourner.setAttribute('aria-label', 'Tourner l’île'); tourner.addEventListener('click', () => { vue.tourner(); note('geste : tourner l’île'); });
  wrap.append(tourner);
  if (musique.disponible) wrap.append(boutonSon('ile')); // le son, sur la vue aussi
  vue.montrerIle(d, { vie }); vue.choisir(null);
  vue.onTouche = key => {
    const best = key ? { key } : null;
    excerpt.hidden = true;
    if (!best) { caption.textContent = invite; return; }
    if (best.key === 'phare') { caption.replaceChildren('Un phare. Si tu veux parler à quelqu’un, c’est là. ', quiet('parler à quelqu’un', () => humansSheet(signals().other ? 'other' : 'self'))); return; }
    const a = d.assets.find(x => x.key === best.key);
    caption.textContent = ligneDe(a, d);
    const texte = (d.ile.depots.filter(x => a.depots.includes(x.id) && x.contenu).pop() || {}).contenu;
    if (texte) { excerpt.textContent = `« ${texte.trim().replace(/\s+/g, ' ').slice(0, 140)}${texte.trim().length > 140 ? '…' : ''} »`; excerpt.hidden = false; }
  };
  updateIleLine();
}

function ligneDe(a, d) {
  const deps = d.ile.depots.filter(x => a.depots.includes(x.id));
  const first = deps[0], cases = first ? casesDe(unpack(first.answers)) : [];
  const quoi = `${cap(nomDe(a))} · ${FAMILLES[a.famille].de}${a.sujet ? `${NB}: ${sujetLabel(a.sujet)}` : ''}`;
  const quand = first?.date ? (deps.length > 1 ? `Depuis le ${jour(first.date)}, redit ${deps.length - 1 === 1 ? 'une fois' : `${deps.length - 1} fois`}.` : `Le ${jour(first.date)}.`) : '';
  const texte = deps.some(x => x.duTexte?.includes(a.sujet)) ? 'Ton texte l’a fait pousser. ' : a.etats?.lueur ? 'Ton texte l’éclaire. ' : ''; // ce que le texte a fait, sans jamais ses mots
  return `${quoi}. ${cases.length ? `${cap(cases.join(', '))}. ` : ''}${texte}${quand}`.trim();
}

// Après un dépôt, l’île propose de rejoindre l’archipel, sous la vue : ce que les autres verraient, et un seul geste pour l’y
// mettre. Rien ne part sans ce geste. « Pas maintenant » est gardé pour cette île : la proposition ne revient pas, un lien
// discret reste à côté des actions.
function propositionArchipel() {
  const rs = resume(courant), carte = el('section', { className: 'proposer' }), etat = el('p', { className: 'tiny' });
  carte.setAttribute('aria-label', 'Rejoindre l’archipel'); etat.setAttribute('role', 'status');
  const dit = el('p', {}, el('b', { textContent: 'Ton île peut rejoindre l’archipel.' }), ` Les autres y verraient une île avec ${listeDe(rs.comptes)}${rs.phare ? ', et un phare' : ''}, dans son paysage, sans tes mots ni ton nom. Tu pourras l’en retirer.`);
  dit.setAttribute('aria-live', 'polite');
  const oui = el('button', { type: 'button', className: 'btn second', textContent: 'La mettre dans l’archipel' });
  const non = quiet('pas maintenant', () => {
    ile.proposer = false; saveIle(); note('île : pas dans l’archipel, pas maintenant');
    const nav = $('#app .actions'), m = lienMettre(); carte.remove();
    if (nav) { nav.firstElementChild ? nav.firstElementChild.after(m) : nav.append(m); nav.querySelector('.btn')?.focus(); }
  });
  const gestes = el('p', { className: 'proposer-actions' }, oui, non);
  oui.addEventListener('click', async () => {
    oui.disabled = non.disabled = true; etat.textContent = 'Elle part…';
    if (!(await envoyer(ile))) { oui.disabled = non.disabled = false; etat.textContent = 'L’archipel ne répond pas pour l’instant. Ton île reste ici ; réessaie un peu plus tard.'; return; }
    note(`île : mise dans l’archipel (${listeDe(rs.comptes)})`);
    etat.textContent = '';
    dit.replaceChildren(el('b', { textContent: 'Elle est dans l’archipel.' }), ' Elle y grandira avec toi.');
    const voir = quiet('la voir dans l’archipel', () => { voirLaTienne = true; ONGLETS.archipel(); }); voir.classList.add('voir');
    gestes.replaceChildren(voir); voir.focus();
    majIleArchipel();
  });
  carte.append(dit, gestes, etat);
  return carte;
}
function lienMettre() { const m = quiet('la mettre dans l’archipel', envoyerSheet); m.id = 'mettre-ici'; return m; }
function majIleArchipel() { // l’île vient d’entrer dans l’archipel : la vue de l’île le dit, sans se redessiner
  if (ecran !== 'ile' || regard) return;
  const hint = $('#ile-hint'); if (hint?.textContent === DIT_ICI) hint.textContent = DIT_ARCHIPEL;
  $('#mettre-ici')?.remove();
  const nav = $('#app .actions'); if (nav && ile.archipel?.id) nav.append(quiet('la retirer de l’archipel', () => retirerSheet(ile)));
}

function updateIleLine() {
  const line = $('#ile-line');
  if (!line) return;
  const d = scene.d || courant, n = d.assets.length, k = d.ile.depots.length;
  line.textContent = `${cap(biomeDe(d.ile.biome).nom)} · ` + (n ? `${n} chose${n > 1 ? 's' : ''} · ${k} dépôt${k > 1 ? 's' : ''}${d.ile.nee ? ` · depuis le ${jour(d.ile.nee)}` : ''}${d.ile.envoyee ? ' · dans l’archipel' : ''}` : `Rien encore${d.ile.nee ? ` · île commencée le ${jour(d.ile.nee)}` : ''}`);
}

function legende() {
  const Q = { AD: 'agité et douloureux', ED: 'éteint et douloureux', AS: 'agité et supportable', ES: 'éteint et supportable' };
  const ul = el('ul', { className: 'legende' });
  ul.append(el('li', {}, el('b', { textContent: 'D’où ça vient, la famille. ' }), ...Object.values(FAMILLES).map(f => `${f.de} → ${f.nom}, ${f.zone}. `)));
  ul.append(el('li', {}, el('b', { textContent: 'Comment c’est ressenti, l’espèce. ' }), ...Object.entries(Q).map(([q, t]) => `${cap(t)}${NB}: ${Object.keys(ESPECES).map(f => NOMS[ESPECES[f][q]][0].replace(/^(un|une|des) /, '')).join(', ')}. `)));
  ul.append(el('li', {}, el('b', { textContent: 'Depuis quand, la taille. ' }), 'Récent, c’est petit ; depuis longtemps, c’est grand. Un sujet redit fait grandir la même chose, jamais une deuxième. Un arbre nu peut se couvrir de feuilles.'));
  ul.append(el('li', {}, el('b', { textContent: 'Le paysage et les variantes. ' }), 'Tu choisis le paysage en commençant une île : la prairie, la forêt d’automne, l’île tropicale, l’île enneigée ou la lande. Il change les couleurs du sol, les essences, les maisons, les cultures et le petit décor. Chaque chose a aussi plusieurs formes. Ni le paysage ni les formes ne disent quelque chose : ils rendent chaque île différente.'));
  ul.append(el('li', {}, el('b', { textContent: 'Qui le sait, l’état. ' }), 'Jamais dit, c’est fermé. Un texte allume des lanternes au-dessus de ce qu’il fait pousser, jamais ses mots. En boucle, un sentier usé. Plus d’une fois, en deux. Ça continue, il pleut dessus. Regret, la mousse reprend la pierre. Jamais réparé, elle est fendue. Un danger, c’est un phare, pour parler à quelqu’un.'));
  ul.append(el('li', {}, el('b', { textContent: 'Ton texte. ' }), 'Il est lu ici, sur ce téléphone, jamais ailleurs. Les sujets dont il parle poussent comme des cases cochées, et s’il n’y a aucun mot coché, il donne la sensation. Sur l’île, il allume une lanterne au-dessus de ce qu’il fait pousser, une de plus à chaque texte, jusqu’à trois. À la fin, tu le gardes sur ce téléphone, ou tu le brûles : il n’en reste alors que ses lanternes.'));
  ul.append(el('li', {}, el('b', { textContent: 'Le temps qu’il fait. ' }), 'Le ciel de l’île suit ta dernière confession. Chaque sensation cochée en plus de la principale laisse un temps qu’il fait : un nuage d’orage, un nuage de pluie, des fleurs, un étang. Sans sujet, la situation suffit : on m’a fait du mal, un arbre ; je regrette, une pierre ; les deux, un arbre et une pierre. Rien du tout : un caillou posé.'));
  return ul;
}

/* ───────── L’archipel ───────── */
// Les îles réelles, lues sur le serveur de l’archipel : seulement leur forme. Les tiennes se dessinent depuis ce téléphone.

const arch = { reelles: [], items: [], arrivals: 0, rang: 0, total: 0, lu: false, panne: false };
const miennes = () => [...iles.filter(x => x.envoyee), ...(ile.envoyee ? [ile] : [])];
const LARG = 18, PROF = 36; // la place d’une île suit sa sensation : supportable à droite, agité au loin
if (vue) vue.dimsArch = [LARG, PROF];
const posArch = (a, v) => [(v - .5) * LARG, (.5 - a) * PROF];
const sauver = x => (x === ile ? saveIle() : saveIles());

function ecarter(items, fixes = []) { // les îles ne se chevauchent pas : on les écarte un peu, autour de leur place
  const tous = [...fixes, ...items], fixe = new Set(fixes), R = it => (it.d || (it.d = deriver(it.ile))).m.rayon * ECH_ARCH + .15; // chaque île, selon sa taille
  for (let k = 0; k < 150; k++) {
    let bouge = false;
    for (let i = 0; i < tous.length; i++) for (let j = i + 1; j < tous.length; j++) {
      const a = tous[i], b = tous[j];
      if (fixe.has(a) && fixe.has(b)) continue;
      const dx = b.x - a.x || (i - j) * .01, dz = b.z - a.z, dist = Math.hypot(dx, dz) || .01, min = R(a) + R(b) + .5;
      if (dist >= min) continue;
      bouge = true;
      const ma = fixe.has(a) ? 0 : 1, mb = fixe.has(b) ? 0 : 1, push = (min - dist) / (ma + mb), ux = dx / dist, uz = dz / dist;
      a.x -= ux * push * ma; a.z -= uz * push * ma; b.x += ux * push * mb; b.z += uz * push * mb;
    }
    for (const it of items) { it.x = Math.max(-LARG * .6, Math.min(LARG * .6, it.x)); it.z = Math.max(-PROF * .62, Math.min(PROF * .62, it.z)); } // on reste dans l’archipel
    if (!bouge) break;
  }
}
function placeLibre(it, fixes, [px, pz]) { // une île qui arrive : l’eau libre la plus proche de sa place, pour ne jamais se poser sur une autre
  const R = x => (x.d || (x.d = deriver(x.ile))).m.rayon * ECH_ARCH + .15, r = R(it), k = Math.max(1, Math.sqrt((fixes.length + 1) / 28)); // l’archipel s’étend avec ses îles
  let libre = null, pres = Infinity, secours = null, jeuMax = -Infinity;
  for (let x = -LARG * .6 * k; x <= LARG * .6 * k; x += .5) for (let z = -PROF * .62 * k; z <= PROF * .62 * k; z += .5) {
    const jeu = fixes.reduce((m, f) => Math.min(m, Math.hypot(f.x - x, f.z - z) - R(f) - r - .5), Infinity), loin = Math.hypot(x - px, z - pz);
    if (jeu >= 0 && loin < pres) { pres = loin; libre = [x, z]; }
    if (jeu > jeuMax) { jeuMax = jeu; secours = [x, z]; } // l’archipel est plein : la place la moins serrée
  }
  [it.x, it.z] = libre || secours || [px, pz];
}

const reelle = r => ({ id: r.ile, x: r.x, z: r.z, d: depuisForme(r.forme, r.ile), mine: false }); // une île reçue : sa forme, à sa place
const lisible = r => { try { return reelle(r); } catch (e) { console.warn(e); return null; } }; // une île illisible est laissée de côté, pas l’archipel
async function chargerArchipel() { // les îles les plus récentes
  try {
    const rangs = await lireArchipel(0, 60);
    arch.reelles = rangs.map(lisible).filter(Boolean); arch.total = rangs[0]?.total ?? 0; arch.rang = Math.max(0, ...rangs.map(r => r.ordre)); arch.lu = true; arch.panne = false;
  } catch (e) { console.warn(e); arch.panne = true; }
}
function placerArchipel() { // les îles des autres, et les tiennes, dessinées depuis ce téléphone
  const tiennes = miennes().filter(m => m.archipel?.id), ids = new Set(tiennes.map(m => m.archipel.id));
  arch.items = [...arch.reelles.filter(r => !ids.has(r.id)), ...tiennes.map(m => ({ id: m.archipel.id, ile: m, d: deriver(m), x: m.archipel.x, z: m.archipel.z, mine: true, label: m === ile ? 'la tienne' : `la tienne, ${mois(m.nee).split(' ')[0]}` }))];
}
function cadrer() { // la caméra suit les îles : peu d’îles se voient de près, beaucoup de plus loin
  const it = arch.items, R = i => i.d.m.rayon * ECH_ARCH;
  if (!it.length) return { dims: [8, 10], centre: [0, 0] };
  const x0 = Math.min(...it.map(i => i.x - R(i))), x1 = Math.max(...it.map(i => i.x + R(i))), z0 = Math.min(...it.map(i => i.z - R(i))), z1 = Math.max(...it.map(i => i.z + R(i)));
  return { dims: [Math.max(6, (x1 - x0 + 2) / 1.2), Math.max(8, (z1 - z0) / 1.24)], centre: [(x0 + x1) / 2, (z0 + z1) / 2 + (z1 - z0) * .07] }; // la vue ajoute sa marge ; le centre avance un peu, car le bord proche paraît plus grand
}

let sondage = null; // la lecture régulière de l’archipel, tant qu’on le regarde
async function sonder() { // les îles arrivées ou grandies depuis la dernière lecture
  if (ecran !== 'archipel' || !arch.lu) return;
  let rangs; try { rangs = await lireArchipel(arch.rang, 60); } catch { return; }
  if (ecran !== 'archipel') return;
  const tiennes = new Set(miennes().map(m => m.archipel?.id).filter(Boolean));
  for (const r of rangs.sort((a, b) => a.ordre - b.ordre)) {
    arch.rang = Math.max(arch.rang, r.ordre); arch.total = r.total ?? arch.total;
    if (tiennes.has(r.ile)) continue; // les tiennes sont déjà là
    const lue = lisible(r); if (!lue) continue;
    const avant = arch.items.find(i => i.id === r.ile), nouvelle = { ...lue, born: avant ? avant.born : now() }; // grandie, elle garde son âge
    arch.reelles = [...arch.reelles.filter(x => x.id !== r.ile), nouvelle];
    if (avant) { if (vue) vue.remplacerIle(avant, nouvelle); else arch.items[arch.items.indexOf(avant)] = nouvelle; } // elle a grandi
    else { arch.arrivals++; if (vue) vue.arriver(nouvelle); else arch.items.push(nouvelle); } // elle arrive
  }
  updateArchLine();
}

function updateArchLine() {
  const line = $('#arch-line');
  if (!line) return;
  const n = miennes().length;
  line.textContent = arch.panne ? 'L’archipel ne répond pas pour l’instant.' : arch.lu ? `${arch.total} île${arch.total > 1 ? 's' : ''} dans l’archipel · arrivées depuis que tu regardes${NB}: ${arch.arrivals} · les tiennes${NB}: ${n}` : '';
}

const INVITE_ARCH = 'Touche une île pour t’en approcher. Fais tourner l’archipel du doigt.';
let voirLaTienne = false; // venue de l’île juste après l’y avoir mise : l’archipel s’approche d’elle
function viserLaTienne(cap) { // elle vient d’y être mise : on s’en approche, et un anneau s’ouvre sur l’eau
  const moi = arch.items.find(it => it.ile === ile);
  if (vue && moi) { vue.viser(moi); vue.vague(moi.x, moi.z, (performance.now() - vue.t0) / 1000); }
  if (moi) cap.textContent = 'Elle est là, parmi les autres. Elle y grandira avec toi.';
}
function legendeArch(it) {
  const rs = resume(it.d || deriver(it.ile));
  return it.mine ? `La tienne${it.ile === ile ? ', celle d’aujourd’hui' : `, celle de ${mois(it.ile.nee)}`}${NB}: ${listeDe(rs.comptes)}.` : `Une île avec ${listeDe(rs.comptes)}${rs.phare ? ', et un phare' : ''}. ${it.born ? 'Arrivée à l’instant.' : 'Là depuis un moment.'}`;
}
const inviteArch = () => (arch.panne ? 'L’archipel ne répond pas pour l’instant. Tes îles sont bien là, sur ce téléphone.' : !arch.lu ? 'L’archipel se charge…' : arch.items.length ? INVITE_ARCH : 'L’archipel attend sa première île.');
function montrerArchipel(caption) {
  if (!vue) return;
  const { dims, centre } = cadrer();
  vue.dimsArch = dims; vue.montrerArchipel(arch.items, { centre });
  vue.onTouche = it => {
    if (!it) { caption.textContent = inviteArch(); return; }
    caption.replaceChildren(`${legendeArch(it)} `, quiet('revenir à l’archipel', () => { vue.viser(null); caption.textContent = inviteArch(); }));
  };
}
function renderArchipel() {
  const wrap = el('div', { className: 'ilewrap mer' });
  const caption = el('p', { className: 'ile-caption', id: 'arch-caption', textContent: inviteArch() });
  const nav = el('nav', { className: 'actions' });
  if (!ile.envoyee && ile.depots.length) { const b = bouton('Y mettre ton île', envoyerSheet); b.id = 'mettre-ile'; nav.append(b); }
  if (vue) nav.append(quiet('revoir l’intro', () => { revue = true; go('intro'); }));
  app.replaceChildren(
    el('p', { className: 'step', textContent: 'L’archipel' }),
    el('h1', { textContent: 'L’archipel, ce soir' }),
    el('p', { className: 'hint', textContent: 'Les îles des autres arrivent au fil de l’eau, placées par sensation. Personne ne lit rien : ce sont des formes.' }),
    wrap, caption, el('p', { className: 'ile-line', id: 'arch-line' }),
    nav,
    el('p', { className: 'tiny', textContent: 'Chaque île est la forme de ce que quelqu’un a déposé. Ni mots, ni dates, ni noms.' }),
  );
  arch.arrivals = 0;
  if (!vue) { wrap.classList.add('sans'); wrap.append(el('p', { className: 'sans3d', textContent: 'Cet appareil n’affiche pas la 3D : l’archipel ne peut pas se montrer ici. Ton île y est quand même, si tu l’y as mise.' })); }
  else { vue.attacher(wrap); vue.canvas.setAttribute('aria-label', 'L’archipel en 3D : les îles des autres, et les tiennes'); if (musique.disponible) wrap.append(boutonSon('archipel')); }
  placerArchipel(); montrerArchipel(caption); updateArchLine(); // les tiennes d’abord, tout de suite
  chargerArchipel().then(() => { // puis celles des autres
    if (ecran !== 'archipel') return;
    placerArchipel(); montrerArchipel(caption); updateArchLine(); caption.textContent = inviteArch();
    if (voirLaTienne) { voirLaTienne = false; viserLaTienne(caption); }
    clearInterval(sondage); if (!arch.panne) sondage = setInterval(sonder, 20000);
  });
}

// Mettre une île dans l’archipel : sa forme seulement, à une place libre près de sa sensation, avec un jeton secret gardé ici.
async function envoyer(x) {
  try {
    if (!arch.lu || arch.panne) await chargerArchipel(); // après une panne, on relit avant de réessayer
    if (arch.panne) return false;
    const d = deriver(x), rs = resume(d), it = { d }, jeton = x.archipel?.jeton || nouveauJeton();
    const autres = [...arch.reelles, ...miennes().filter(m => m !== x && m.archipel?.id).map(m => ({ d: deriver(m), x: m.archipel.x, z: m.archipel.z }))];
    placeLibre(it, autres, posArch(rs.a, rs.v));
    const r = await poserIle(jeton, forme(d), { x: it.x, z: it.z });
    x.archipel = { id: r.ile, jeton, x: it.x, z: it.z }; x.envoyee = true; delete x.proposer; sauver(x);
    arch.total++;
    return true;
  } catch (e) { console.warn(e); return false; }
}
// Ce qui attend d’être envoyé : une île à mettre dans l’archipel, ou une île qui y a grandi. Sans réseau, on réessaiera.
// Une seule à la fois : demandée pendant qu’elle tourne, elle repasse à la fin, sans jamais poser deux fois la même île.
let synchro = null, encore = false;
function synchroniser() {
  if (synchro) { encore = true; return synchro; }
  synchro = (async () => { do { encore = false; await envoyerTout(); } while (encore); })().catch(e => console.warn(e)).finally(() => { synchro = null; });
  return synchro;
}
async function envoyerTout() {
  for (const x of [ile, ...iles]) {
    const a = x.archipel;
    if (!a) continue;
    if (!a.id) { if (!(await envoyer(x))) return; continue; }
    if (!a.enRetard) continue;
    try { await poserIle(a.jeton, forme(deriver(x)), { ile: a.id }); delete a.enRetard; sauver(x); }
    catch (e) { if (/inconnue/.test(e.message)) { delete x.archipel; x.envoyee = false; sauver(x); } else return; } // retirée de l’archipel : elle n’y est plus
  }
}

/* ───────── L’intro, au premier passage ───────── */
// Elle montre l’archipel, puis une île qui pousse quand on parle, qui porte ce qu’on a dit, et qui rejoint les autres.
// Aucun exemple : les mots sont des formes de lumière. Elle se passe, et se revoit depuis l’archipel.

const LEGENDES = [
  'Voici l’archipel. Chaque île y a poussé avec ce que quelqu’un a confié.',
  'Quand tu parles, ton île pousse.',
  'Elle porte ce que tu as dit, sans jamais montrer tes mots.',
  'Quand tu le veux, elle rejoint l’archipel. Sans ton nom.',
];
let revue = false, suivi = null, decorIntro = null; // revue : l’intro revue depuis l’archipel ; suivi : la taille de sa vue ; decorIntro : ses îles inventées
function finIntro(comment) {
  store.set('intro', 1); note(`intro : ${comment}`);
  if (revue && comment === 'passée') { revue = false; history.back(); return; } // revue puis passée : on revient où l’on était
  revue = false;
  history.replaceState({ screen: 'q:situ', n: history.state?.n || 0 }, '', ''); render('q:situ'); // sans retour possible vers l’intro
}
function renderIntro() {
  const tout = !vue || reduced; // sans 3D, ou sans mouvement : tout se lit d’un coup
  const wrap = el('div', { className: 'ilewrap mer intro-vue' }), nav = el('nav', { className: 'nav intro-nav' });
  const commencer = () => bouton('Commencer', () => finIntro('vue')), titre = el('h1', { className: 'sr', textContent: 'Bienvenue dans l’archipel' });
  let suite = null; // ce que font les légendes, au fil de l’intro
  if (tout) {
    nav.append(el('span', { className: 'spacer' }), commencer()); wrap.classList.add('fixe');
    app.replaceChildren(titre, ...(vue ? [wrap] : []), el('div', { className: 'intro-tout' }, ...LEGENDES.map(t => el('p', { textContent: t }))), nav);
  } else {
    const ligne = el('p', { className: 'intro-ligne' }), points = el('span', { className: 'dots intro-points' }, ...LEGENDES.map(() => el('i')));
    ligne.setAttribute('aria-live', 'polite'); points.setAttribute('aria-hidden', 'true');
    const enCours = () => nav.replaceChildren(points, el('span', { className: 'spacer' }), quiet('passer', () => finIntro('passée')));
    let fondu;
    suite = { // une légende à la fois, en fondu ; à la fin, commencer
      etape: i => { clearTimeout(fondu); ligne.classList.remove('vue'); [...points.children].forEach((p, j) => { p.className = j === i ? 'now' : j < i ? 'done' : ''; }); fondu = setTimeout(() => { ligne.textContent = LEGENDES[i]; ligne.classList.add('vue'); }, 220); },
      fin: () => nav.replaceChildren(quiet('revoir', () => { note('geste : revoir l’intro'); vue.introAller(0); enCours(); }), el('span', { className: 'spacer' }), commencer()),
    };
    enCours();
    app.replaceChildren(titre, wrap, ligne, nav);
  }
  if (!vue) return;
  vue.attacher(wrap);
  vue.canvas.setAttribute('aria-label', 'Une île pousse quand on parle, garde la lumière de ce qui a été dit, puis rejoint l’archipel');
  if (!decorIntro) { decorIntro = archipelInvente(26).map(o => ({ ...o, d: deriver(o.ile), mine: false })); for (const it of decorIntro) [it.x, it.z] = posArch(it.a, it.v); ecarter(decorIntro); } // l’intro montre l’idée avec des îles inventées ; l’archipel, lui, n’a que des îles réelles
  const demo = { ile: ILE_INTRO, mine: false };
  placeLibre(demo, decorIntro, [1.5, PROF * .3]); // sa place : au premier plan, dans l’eau libre
  vue.dimsArch = [LARG, PROF];
  vue.montrerIntro([...decorIntro], demo, { onEtape: i => suite?.etape(i), onFin: () => suite?.fin(), nouvelle: () => nouvelleAutre([...vue.items, demo]) }); // une copie : les îles arrivées ne restent pas dans le décor
  if (typeof ResizeObserver === 'function') { suivi = new ResizeObserver(() => vue.redim()); suivi.observe(wrap); }
}

function nouvelleAutre(fixes) { // une île inventée arrive dans le décor de l’intro
  const r = Math.random(), q = r < .27 ? 'AD' : r < .68 ? 'ED' : r < .82 ? 'AS' : 'ES';
  const a = (q[0] === 'A' ? .5 : 0) + Math.random() * .5, v = (q[1] === 'S' ? .5 : 0) + Math.random() * .5;
  const it = { ile: ileInventee(5000 + Math.floor(Math.random() * 1e6), q), a, v, mine: false, born: now() };
  placeLibre(it, fixes, posArch(a, v));
  return it;
}

/* ───────── Secours ───────── */

function secours(screen) { // un écran qui a échoué : jamais de page vide, toujours de quoi parler à quelqu’un
  const ailleurs = screen === 'q:situ' ? ['Voir ton île', 'ile'] : ['Revenir aux premières cases', 'q:situ'];
  app.replaceChildren(
    el('h1', { textContent: 'Quelque chose s’est mal passé' }),
    el('p', { className: 'hint', textContent: 'Ce que tu as déposé est toujours sur ce téléphone.' }),
    el('nav', { className: 'actions' }, bouton(ailleurs[0], () => go(ailleurs[1])), quiet('parler à quelqu’un', () => humansSheet())),
  );
}

/* ───────── Navigation ───────── */

const bouton = (text, fn) => { const b = el('button', { type: 'button', className: 'btn', textContent: text }); b.addEventListener('click', fn); return b; };
const ICONE_TOURNER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/></svg>';
const ICONE_SON = { // un haut-parleur : avec ses ondes quand la musique joue, barré sinon
  true: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 9.6v4.8h3.4l4.6 3.9V5.7L7.9 9.6z"/><path d="M15.4 9.3a3.9 3.9 0 0 1 0 5.4"/><path d="M18 6.7a7.4 7.4 0 0 1 0 10.6"/></svg>',
  false: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 9.6v4.8h3.4l4.6 3.9V5.7L7.9 9.6z"/><path d="M15.6 9.8l4.4 4.4M20 9.8l-4.4 4.4"/></svg>',
};
const quiet = (text, fn) => { const b = el('button', { type: 'button', className: 'quiet', textContent: text }); b.addEventListener('click', fn); return b; };

function go(screen) { history.pushState({ screen, n: (history.state?.n || 0) + 1 }, '', ''); render(screen); } // n : combien d’écrans de l’app le précèdent

let ecran = 'q:situ';
const ongletDe = screen => (screen === 'ile' || screen === 'archipel' ? screen : 'deposer');
const ONGLETS = { deposer: () => go('q:situ'), ile: () => { regard = null; go('ile'); }, archipel: () => go('archipel'), plus: () => plusSheet() }; // Plus : un menu, pas un écran
function updateOnglets() {
  const actif = ongletDe(ecran), n = courant.assets.length, c = $('.onglets .compte');
  for (const b of document.querySelectorAll('.onglets button')) { if (b.dataset.onglet === actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  c.hidden = !n; c.textContent = n;
}

function render(screen) {
  ecran = screen; majSon = null;
  suivi?.disconnect(); suivi = null; clearInterval(sondage); sondage = null;
  document.body.classList.toggle('short', state.short && screen === 'page');
  document.body.classList.toggle('en-intro', screen === 'intro');
  companion.hidden = ['ile', 'archipel', 'intro'].includes(screen);
  if (!companion.hidden) ilot?.redim();
  try {
    if (screen === 'orient') renderOrient();
    else if (screen === 'page') renderPage();
    else if (screen === 'ile') renderIle();
    else if (screen === 'archipel') renderArchipel();
    else if (screen === 'intro') renderIntro();
    else renderQ(QUESTIONS[screen.slice(2)] ? screen.slice(2) : 'situ');
  } catch (e) { console.error(e); secours(screen); } // un écran qui échoue laisse place au secours, jamais à une page vide
  scrollTo(0, 0);
  const h = app.querySelector('h1, .big');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  updateOnglets();
  suivreMusique(screen);
}

/* ───────── Les questions ───────── */

function renderQ(key) {
  const q = QUESTIONS[key];
  const scores = q.boost ? q.boost(state.answers) : {};
  const items = [...q.items].sort((x, y) => (scores[y.id] || 0) - (scores[x.id] || 0));
  const boosted = items.some(it => scores[it.id]);
  const dots = el('div', { className: 'dots' }), step = el('p', { className: 'step' }), next = el('button', { type: 'button', className: 'btn' }), nav = el('nav', { className: 'nav' });
  const refresh = () => {
    const seq = sequence(), i = seq.indexOf(key), last = i === seq.length - 1, n = state.answers[key].size;
    dots.replaceChildren(...seq.map((k, j) => el('i', { className: j === i ? 'now' : j < i ? 'done' : '' })));
    step.textContent = q.extra ? 'Une question de plus' : `${i + 1} sur ${seq.length}`;
    next.textContent = (last ? 'Voir' : 'Suivant') + (n ? ` (${n})` : '');
    next.onclick = () => go(last ? 'orient' : `q:${seq[i + 1]}`);
    nav.replaceChildren(key === 'situ' ? el('span') : quiet('retour', () => history.back()), el('span', { className: 'spacer' }), next); // un seul bouton pour avancer, coché ou non
  };
  const list = el('div', { className: `opts${q.grid ? ' grid' : ''}` }, ...items.map(it => {
    const input = el('input', { type: 'checkbox', checked: has(key, it.id) });
    input.addEventListener('change', () => {
      if (input.checked) { state.answers[key].add(it.id); note(`case : ${it.label}`); } else state.answers[key].delete(it.id);
      if (!state.hinted) { state.hinted = true; $('#ent-hint').hidden = true; }
      derive(); saveDraft(); refresh();
    });
    const opt = el('label', { className: 'opt' }, input, el('span', { textContent: it.label }));
    if (scores[it.id]) { const m = el('i', { className: 'mark' }); m.setAttribute('title', 'd’après tes cases'); opt.append(m); }
    return opt;
  }));
  refresh();
  app.replaceChildren(dots, step, el('h1', { textContent: q.title }),
    el('p', { className: 'hint', textContent: boosted ? 'Les premières viennent de tes cases. Tout le reste est là aussi.' : q.hint }), list, nav);
}

/* ───────── Par où aller ───────── */

function starters() {
  const out = KEYS.filter(k => k !== 'mots' && k !== 'sujets').flatMap(k => checked(k).filter(it => it.starter).map(it => ({ label: it.chip, text: it.starter })));
  const words = checked('mots').map(it => it.label);
  if (words.length) out.push({ label: 'Il y a…', text: `Il y a ${words.join(' et ')}. ` });
  const subs = checked('sujets').map(it => it.label);
  if (subs.length) out.push({ label: 'Ça parle de…', text: `Ça parle de${NB}: ${subs.join(', ')}. ` });
  return out;
}

const pousseraient = () => (preview.length ? `Ça ferait pousser ${listeGraines(preview)}.` : 'Rien coché : ça poserait un caillou.');

function renderOrient() {
  const sig = signals(), total = anyChecked();
  const recap = el('div', { className: 'recap' });
  if (!total) recap.append(el('p', { className: 'hint', textContent: 'Tu n’as rien coché. C’est très bien aussi. Voilà par où on peut aller.' }));
  else for (const k of KEYS) {
    const c = checked(k);
    if (!c.length) continue;
    recap.append(el('p', { className: 'recap-row' }, el('span', { className: 'k', textContent: `${QUESTIONS[k].key}${NB}:` }), ...c.map(it => {
      const b = el('button', { type: 'button', className: 'tag', textContent: it.label });
      b.addEventListener('click', () => go(`q:${k}`));
      return b;
    })));
  }
  const paths = el('div', { className: 'paths' });
  const path = (title, sub, fn, cls = '') => {
    const b = el('button', { type: 'button', className: `path ${cls}`.trim() }, el('b', { textContent: title }), el('small', { textContent: sub }));
    b.addEventListener('click', () => { state.path = title; note(`chemin : ${title}`); fn(); });
    paths.append(b);
  };
  const humans = () => humansSheet(sig.other ? 'other' : 'self');
  if (sig.strong) path('Parler à quelqu’un, maintenant', 'des humains, à toute heure', humans, 'first');
  path('Écrire', starters().length ? 'avec des débuts de phrases tirés de tes cases' : 'la page est à toi', () => { state.short = false; go('page'); });
  path('Le dire en trois lignes', 'court, et c’est tout', () => { state.short = true; go('page'); });
  path('Juste le poser', 'sans écrire, directement sur ton île', finishSheet);
  if (!sig.strong && sig.soft) path('Parler à quelqu’un', 'des humains, ailleurs, à toute heure', humans);
  path('Voir ton île', courant.assets.length ? 'ce qui a poussé, et l’archipel' : 'elle est vide, pour l’instant', () => { regard = null; go('ile'); });
  const seq = sequence();
  app.replaceChildren(
    el('p', { className: 'step', textContent: 'D’après tes cases' }),
    el('h1', { textContent: 'Par où aller ?' }),
    recap,
    el('p', { className: 'hint', textContent: total ? `${pousseraient()} Tu choisis. Tu pourras revenir.` : '' }),
    paths,
    el('nav', { className: 'nav' }, quiet('retour aux questions', () => go(`q:${seq[seq.length - 1]}`))),
  );
}

/* ───────── La page ───────── */

let assessTimer;

function grow(ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }

function insert(ta, str) {
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s, before = ta.value.slice(0, s);
  ta.setRangeText(before && !/\n\s*$/.test(before) ? `\n${str}` : str, s, e, 'end');
  ta.focus({ preventScroll: true });
  ta.dispatchEvent(new Event('input'));
}

function moment() {
  const h = new Date().getHours();
  return h >= 22 || h < 6 ? 'cette nuit' : h >= 18 ? 'ce soir' : 'aujourd’hui';
}

function showHelp(box, level, kind = 'self') {
  if (level < state.help || (level === state.help && kind === state.helpKind)) return;
  if (level === 2) { if (state.softShown) return; state.softShown = true; }
  state.help = level; state.helpKind = kind;
  paintHelp(box);
}

function paintHelp(box) {
  if (!state.help) return;
  box.replaceChildren();
  box.hidden = false;
  if (state.help === 2) {
    note('aide : une ligne douce');
    const x = el('button', { type: 'button', className: 'x', textContent: '×' });
    x.setAttribute('aria-label', 'fermer');
    x.addEventListener('click', () => { box.hidden = true; });
    box.append(el('p', {}, `Si c’est trop lourd ${moment()}, des gens répondent au `, el('a', { href: 'tel:3114', textContent: '3114' }), ', à toute heure.'), x);
  } else if (state.helpKind === 'other') {
    note('aide : une ligne qui reste (quelqu’un fait du mal)');
    box.append(el('div', {}, el('p', {}, `Si quelqu’un te fait du mal, le 3919 écoute, à toute heure. En danger immédiat${NB}: le 17, ou le 114 par SMS.`),
      el('div', { className: 'calls' }, el('a', { className: 'call', href: 'tel:3919', textContent: 'Appeler le 3919' }), el('a', { className: 'call', href: 'tel:17', textContent: '17' }), el('a', { className: 'call', href: 'sms:114', textContent: '114 par SMS' }))));
  } else {
    note('aide : une ligne qui reste');
    box.append(el('div', {}, el('p', {}, 'Des gens répondent au 3114, maintenant, à toute heure.'),
      el('div', { className: 'calls' }, el('a', { className: 'call', href: 'tel:3114', textContent: 'Appeler le 3114' }), el('a', { className: 'call', href: 'https://www.sos-amitie.com', target: '_blank', rel: 'noopener', textContent: 'Écrire à SOS Amitié' }))));
  }
}

function assess(text, box) {
  const t = norm(text);
  if (LEX.self.some(k => t.includes(k))) return showHelp(box, 3, 'self');
  if (LEX.other.some(k => t.includes(k))) return showHelp(box, 3, 'other');
  if (LEX.soft.some(k => t.includes(k))) showHelp(box, 2);
}

function renderPage() {
  const ta = el('textarea', { rows: 6, value: state.text, placeholder: state.short ? 'Trois lignes, pas plus.' : 'Écris ce que tu veux. Ou rien.' });
  ta.setAttribute('aria-label', 'Ta page');
  if (state.short) ta.maxLength = 280;
  const count = el('p', { className: 'count', hidden: !state.short });
  const help = el('div', { className: 'help', hidden: true });
  help.setAttribute('role', 'status'); help.setAttribute('aria-live', 'polite');
  ta.addEventListener('input', () => {
    grow(ta); state.text = ta.value;
    if (state.short) count.textContent = `${ta.value.length} / 280`;
    derive(); saveDraft();
    clearTimeout(assessTimer); assessTimer = setTimeout(() => assess(ta.value, help), 600);
  });
  const chips = el('div', { className: 'chips' }, ...starters().map(s => {
    const b = el('button', { type: 'button', className: 'chip', textContent: s.label });
    b.addEventListener('click', () => { insert(ta, s.text); note(`amorce : ${s.label}`); });
    return b;
  }));
  const finish = el('button', { type: 'button', className: 'btn', textContent: 'Terminer' });
  finish.addEventListener('click', finishSheet);
  app.replaceChildren(
    el('p', { className: 'step', textContent: state.short ? 'En trois lignes' : 'La page' }),
    el('h1', { textContent: state.short ? 'Dis-le court.' : 'À toi.' }),
    el('p', { className: 'hint', textContent: 'Rien ne part. Ton texte est lu ici, sur ce téléphone : les sujets dont il parle poussent sur ton île, et il y allume des lanternes. À la fin, tu choisis de le garder ou de le brûler.' }),
    ta, count, help, chips,
    el('nav', { className: 'nav' }, quiet('retour', () => history.back()), el('span', { className: 'spacer' }), finish),
  );
  requestAnimationFrame(() => { grow(ta); if (state.short) count.textContent = `${ta.value.length} / 280`; });
  const sig = signals();
  if (sig.strong) showHelp(help, 3, sig.other ? 'other' : 'self');
  else if (sig.soft) showHelp(help, 2);
  else paintHelp(help);
  if (state.text) assess(state.text, help);
}

/* ───────── Feuilles ───────── */

let sheetNode = null, lastFocus = null;

function openSheet(body, onClose) {
  closeSheet();
  lastFocus = document.activeElement;
  const back = el('div', { className: 'sheet' });
  const box = el('div', { className: 'sheet-body', tabIndex: -1 }, el('div', { className: 'handle' }), body);
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  back.append(box);
  back.addEventListener('click', e => { if (e.target === back) closeSheet(); });
  document.body.append(back);
  sheetNode = back; sheetNode.onClose = onClose;
  box.focus({ preventScroll: true });
}
function closeSheet() {
  if (!sheetNode) return;
  const cb = sheetNode.onClose;
  sheetNode.remove(); sheetNode = null;
  cb?.();
  lastFocus?.focus?.({ preventScroll: true });
}
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
const footRow = (...btns) => el('p', { className: 'foot-row' }, ...btns);
const checkRow = (label, checked = true) => { const input = el('input', { type: 'checkbox', checked }); return [el('label', { className: 'check' }, input, el('span', { textContent: label })), input]; };

function humansSheet(first = 'self') {
  note('canal : parler à quelqu’un');
  const body = el('div', {}, el('h2', { textContent: 'Parler à quelqu’un' }), el('p', { className: 'intro', textContent: 'Ici, personne ne lit. Là-bas, quelqu’un répond.' }));
  for (const g of [...HUMANS].sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0))) {
    body.append(el('h3', { textContent: g.title }), el('div', { className: 'list' }, ...g.items.map(([name, href, sub]) => {
      const a = el('a', { className: 'row', href }, name, el('small', { textContent: sub }));
      if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
      return a;
    })));
  }
  body.append(footRow(quiet('revenir', closeSheet)));
  openSheet(body);
}

function finishSheet() { // ce qui a été déposé pousse sur l’île, texte compris ; s’il y a un texte, on choisit de le garder ou de le brûler
  const texte = state.text.trim(), g = preview.length ? preview : graines(actives(state.answers), '').graines;
  const body = el('div', {}, el('h2', { textContent: 'Et maintenant ?' }));
  const guillemets = ids => ids.map(id => `«${NB}${sujetLabel(id)}${NB}»`).reduce((t, x, i, l) => (i ? t + (i === l.length - 1 ? ' et ' : ', ') : '') + x, '');
  let dit = `${texte ? '' : 'Juste tes cases, sans texte. Ça suffit. '}Sur ton île, ça va faire pousser ${listeGraines(g)}.`;
  if (texte) dit += proposes.length ? ` C’est ton texte qui a apporté ${guillemets(proposes)}, et il allume des lanternes au-dessus de ce qui pousse.` : ' Ton texte allume des lanternes au-dessus de ce qui pousse.';
  body.append(el('p', { className: 'intro', textContent: dit }));
  const gesture = (t, sub, fn) => {
    const b = el('button', { type: 'button', className: 'gesture' }, t, el('small', { textContent: sub }));
    b.addEventListener('click', () => { closeSheet(); fn(); });
    body.append(b);
  };
  if (texte) {
    body.append(el('p', { className: 'intro', textContent: 'Et ton texte ?' }));
    gesture('Garder le texte', 'sur ce téléphone seulement ; en touchant ce qu’il a fait pousser, tu le reliras', () => poser(true));
    gesture('Brûler le texte', 'il n’en restera que ce qu’il a fait pousser', bruler);
  } else gesture('Poser sur l’île', 'ça restera sur ce téléphone, et ça poussera', () => poser(false));
  const effacer = el('p', { className: 'effacer' }); // abandonner, sans rien poser : une seconde touche pour confirmer
  const lien = quiet('tout effacer, sans rien poser', () => effacer.replaceChildren(
    texte ? 'Tes cases et ton texte vont disparaître, et rien ne poussera. ' : 'Tes cases vont disparaître, et rien ne poussera. ',
    quiet('tout effacer', () => { closeSheet(); clearDraft(); note('geste : tout effacer, sans rien poser'); go('q:situ'); }), ' · ', quiet('non', () => effacer.replaceChildren(lien))));
  effacer.append(lien);
  body.append(effacer, footRow(quiet('pas maintenant', closeSheet), quiet('voir l’île', () => { closeSheet(); regard = null; go('ile'); })));
  openSheet(body);
}

const APERCU = [{ id: 1, quad: 'N', texte: false, answers: { situ: [], mots: [], sujets: ['s4', 's11', 's7', 's0'], fait: [], subi: [] } }];
function dessinerApercu(c, id) { // un aperçu du paysage : une île d’exemple, en 3D, rendue une fois
  const dpr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth || 132, h = c.clientHeight || 119;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  if (en3D) try { apercu(c, id, APERCU); } catch (e) { console.error(e); } // sans aperçu, le paysage se choisit quand même
}
function choixPaysage(depart, onPick) {
  const wrap = el('div', { className: 'paysages' }), boutons = [];
  for (const id of BIOME_IDS) {
    const B = BIOMES[id], c = el('canvas'), b = el('button', { type: 'button', className: 'paysage' }, c, el('b', { textContent: cap(B.nom) }), el('small', { textContent: B.dit }));
    b.setAttribute('aria-pressed', String(id === depart));
    b.addEventListener('click', () => { for (const [bid, bb] of boutons) bb.setAttribute('aria-pressed', String(bid === id)); onPick(id); });
    boutons.push([id, b]); wrap.append(b);
    requestAnimationFrame(() => dessinerApercu(c, id));
  }
  return wrap;
}
function paysageSheet() { // tant que l’île est vide, on peut changer son paysage
  let choisi = ile.biome || 'prairie';
  const ok = el('button', { type: 'button', className: 'gesture', textContent: 'Garder ce paysage' });
  ok.addEventListener('click', () => { closeSheet(); ile.biome = choisi; saveIle(); courant = deriver(ile); note(`paysage : ${BIOMES[choisi].nom}`); titre = { h1: cap(BIOMES[choisi].nom), line: 'Ton île vide, dans ce paysage. Elle poussera avec ce que tu déposeras.' }; go('ile'); });
  openSheet(el('div', {}, el('h2', { textContent: 'Le paysage de ton île' }), el('p', { className: 'intro', textContent: 'Il ne dit rien de toi : c’est pour tes yeux. Il change les couleurs, les arbres, les maisons et le petit décor.' }), choixPaysage(choisi, id => { choisi = id; }), ok, footRow(quiet('pas maintenant', closeSheet))));
}

function changerSheet() {
  const rs = resume(courant);
  const [row, send] = checkRow('La mettre dans l’archipel : seulement sa forme, sans ton nom', false);
  const body = el('div', {},
    el('h2', { textContent: 'Changer d’île' }),
    el('p', { className: 'intro', textContent: `Celle-ci restera sur ce téléphone, telle qu’elle est${NB}: ${listeDe(rs.comptes)}. Une île vide t’attend.` }));
  if (ile.envoyee) body.append(el('p', { className: 'intro', textContent: 'Elle est déjà dans l’archipel, et y restera.' }));
  else body.append(row, el('p', { className: 'tiny', textContent: `Les autres verraient une île avec ${listeDe(rs.comptes)}${rs.phare ? ', et un phare' : ''}, dans son paysage. Rien d’autre${NB}: ni mots, ni dates, ni nom.` }));
  let paysage = BIOME_IDS[(BIOME_IDS.indexOf(ile.biome || 'prairie') + 1) % BIOME_IDS.length];
  body.append(el('h3', { textContent: 'Le paysage de la prochaine' }), choixPaysage(paysage, id => { paysage = id; }));
  const b = el('button', { type: 'button', className: 'gesture', textContent: 'Commencer une nouvelle île' });
  b.addEventListener('click', () => {
    closeSheet();
    if (!ile.envoyee && send.checked) { ile.archipel = { attente: true }; note(`île : mise dans l’archipel (${listeDe(rs.comptes)})`); } // elle partira dès que possible
    ile.quittee = new Date().toISOString();
    iles = [...iles, ile]; saveIles();
    ile = nouvelleIle(paysage); saveIle();
    note(`paysage : ${BIOMES[paysage].nom}`);
    courant = deriver(ile); vie.clear();
    note('geste : changer d’île');
    titre = { h1: 'Une île vide', line: 'Elle poussera avec ce que tu déposeras. Celle d’avant reste ici.' };
    go('ile');
    synchroniser();
  });
  body.append(b, footRow(quiet('pas maintenant', closeSheet)));
  openSheet(body);
}

function envoyerSheet() {
  const rs = resume(courant), etat = el('p', { className: 'tiny' });
  etat.setAttribute('role', 'status');
  const b = el('button', { type: 'button', className: 'gesture', textContent: 'Y mettre ton île' });
  b.addEventListener('click', async () => {
    b.disabled = true; etat.textContent = 'Elle part…';
    if (!(await envoyer(ile))) { b.disabled = false; etat.textContent = 'L’archipel ne répond pas pour l’instant. Ton île reste ici ; réessaie un peu plus tard.'; return; }
    closeSheet(); note(`île : mise dans l’archipel (${listeDe(rs.comptes)})`);
    if (ecran === 'ile') { majIleArchipel(); return; }
    const cap = $('#arch-caption');
    if (ecran !== 'archipel' || !cap) return;
    placerArchipel(); montrerArchipel(cap); updateArchLine(); $('#mettre-ile')?.remove();
    viserLaTienne(cap);
  });
  openSheet(el('div', {},
    el('h2', { textContent: 'Y mettre ton île' }),
    el('p', { className: 'intro', textContent: `Seule sa forme part, telle que les autres la verront${NB}: ${listeDe(rs.comptes)}${rs.phare ? ', et un phare' : ''}, dans son paysage. Ni tes mots, ni tes dates, ni ton nom.` }),
    el('p', { className: 'intro', textContent: 'Elle continuera de pousser ici, et là-bas avec elle. Tu pourras l’en retirer quand tu veux.' }),
    b, etat, footRow(quiet('pas maintenant', closeSheet))));
}

function retirerSheet(x) { // la retirer de l’archipel : elle disparaît pour les autres, et reste ici
  const etat = el('p', { className: 'tiny' }), b = el('button', { type: 'button', className: 'gesture', textContent: 'La retirer de l’archipel' });
  etat.setAttribute('role', 'status');
  b.addEventListener('click', async () => {
    b.disabled = true; etat.textContent = 'Un instant…';
    try { await retirerIle(x.archipel.id, x.archipel.jeton); } catch (e) { console.warn(e); b.disabled = false; etat.textContent = 'L’archipel ne répond pas pour l’instant. Réessaie un peu plus tard.'; return; }
    arch.reelles = arch.reelles.filter(r => r.id !== x.archipel.id); arch.total = Math.max(0, arch.total - 1);
    delete x.archipel; x.envoyee = false; x.proposer = false; sauver(x); note('île : retirée de l’archipel'); // retirée : elle ne se propose plus d’elle-même
    closeSheet(); render(ecran);
  });
  openSheet(el('div', {},
    el('h2', { textContent: 'La retirer de l’archipel ?' }),
    el('p', { className: 'intro', textContent: 'Elle disparaîtra pour les autres. Elle reste ici, sur ce téléphone, et tu pourras l’y remettre.' }),
    b, etat, footRow(quiet('pas maintenant', closeSheet))));
}

function ilesSheet() {
  const body = el('div', {}, el('h2', { textContent: 'Tes îles d’avant' }), el('p', { className: 'intro', textContent: 'Elles restent ici. Elles ne poussent plus.' }));
  body.append(el('div', { className: 'list' }, ...[...iles].reverse().map(x => {
    const d = deriver(x), rs = resume(d);
    const open = el('button', { type: 'button', className: 'row' }, `L’île de ${mois(x.nee)}`, el('small', { textContent: `${listeDe(rs.comptes)}${x.envoyee ? ' · dans l’archipel' : ''}` }));
    open.addEventListener('click', () => { closeSheet(); regard = x; go('ile'); });
    return open;
  })));
  body.append(footRow(quiet('revenir', closeSheet)));
  openSheet(body);
}

/* ───────── L’installer ───────── */
// Sur Android et sur ordinateur, le navigateur propose d’installer l’app : on garde sa proposition pour quand on la
// demande, sans bandeau qui surgisse au milieu d’un dépôt. Sur iPhone, rien ne se propose : on dit comment faire.

let invitation = null; // la proposition du navigateur, gardée
const installee = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const surIPhone = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installable = () => !installee() && (!!invitation || surIPhone());
const lienInstaller = () => { const b = $('#installer'); if (b) b.hidden = !installable(); };
addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitation = e; lienInstaller(); });
addEventListener('appinstalled', () => { invitation = null; lienInstaller(); note('app : installée'); });

function installerSheet() {
  const body = el('div', {}, el('h2', { textContent: 'L’installer comme une app' }));
  if (installee()) body.append(el('p', { className: 'intro', textContent: 'Elle est installée sur cet appareil : tu es dedans. Elle s’ouvre depuis ton écran d’accueil, même sans réseau.' }));
  else body.append(el('p', { className: 'intro', textContent: 'L’archipel s’ouvrira depuis ton écran d’accueil, en plein écran, même sans réseau. Seul l’archipel partagé a besoin du réseau.' }));
  if (installee()) { /* rien à faire */ } else if (invitation) {
    const b = el('button', { type: 'button', className: 'gesture', textContent: 'L’installer' });
    b.addEventListener('click', async () => {
      const i = invitation; invitation = null; closeSheet(); note('geste : installer l’app');
      try { await i.prompt(); const { outcome } = await i.userChoice; if (outcome !== 'accepted') note('app : pas installée'); } catch (e) { console.warn(e); }
      lienInstaller();
    });
    body.append(el('p', { className: 'tiny', textContent: 'Tu y retrouveras ton île. Son icône, « L’archipel », sera visible sur ton écran d’accueil.' }), b);
  } else if (surIPhone()) body.append(
    el('p', { className: 'intro', textContent: 'Dans Safari, touche le bouton Partager, puis « Sur l’écran d’accueil ».' }),
    el('p', { className: 'tiny', textContent: 'Sur iPhone, l’app installée a sa propre mémoire : elle commence avec une île vide, et celle d’ici reste dans Safari. Son icône, « L’archipel », sera visible sur ton écran d’accueil.' }));
  else body.append(el('p', { className: 'intro', textContent: 'Ce navigateur ne le propose pas. Sur Android, Chrome le propose ; sur iPhone, Safari, avec le bouton Partager.' }));
  body.append(footRow(quiet(installee() ? 'revenir' : 'pas maintenant', closeSheet)));
  openSheet(body);
}

/* ───────── Gestes ───────── */

function poser(garderTexte, brule = false) {
  const texte = state.text.trim();
  const ok = [...proposes];
  for (const id of ok) state.answers.sujets.add(id);
  const a = actives(state.answers); // une question de plus qui ne se pose plus n’est pas déposée
  const depot = { id: Date.now(), date: new Date().toISOString(), quad: quadDe(a), texte: !!texte, answers: pack(a) };
  if (ok.length) { depot.duTexte = ok; note(`texte : lu ici, fait pousser ${ok.map(sujetLabel).join(', ')}`); }
  if (!state.answers.mots.size && lu.quad !== 'N') { depot.quadTexte = lu.quad; depot.quad = lu.quad; note('texte : donne la sensation, aucun mot coché'); }
  if (texte && garderTexte) depot.contenu = texte;
  ile.depots.push(depot); if (ile.archipel?.id) ile.archipel.enRetard = true; // dans l’archipel, sa forme grandira aussi
  else if (!ile.archipel && ile.proposer !== false) ile.proposer = true; // sinon, la vue de l’île proposera de l’y mettre
  saveIle();
  const d = deriver(ile);
  courant = d;
  const { nouvelles, grandies } = d.dernier;
  const T = now();
  for (const a of [...nouvelles, ...grandies]) vie.set(a.key, T);
  if (d.phare === depot.id) vie.set('phare', T);
  note(`geste : poser sur l’île (${[...nouvelles, ...grandies].map(nomDe).join(', ')})`);
  const phrases = phrasesDe(nouvelles, grandies);
  const n = nouvelles.length + grandies.length, NOMBRES = ['', '', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit'];
  const verbe = !nouvelles.length ? 'grandi' : !grandies.length ? 'poussé' : 'bougé';
  titre = { h1: n === 1 ? `Quelque chose a ${verbe}` : `${NOMBRES[n] || n} choses ont ${verbe}`, line: phrases.join(' ') + (d.phare === depot.id ? ' Un phare s’est allumé sur la rive.' : '') + (texte ? (brule ? ' Ton texte a brûlé : il n’en reste que ses lanternes.' : ' Ton texte y a allumé des lanternes.') : '') };
  if (texte) note(brule ? 'geste : brûler le texte' : 'geste : garder le texte, sur ce téléphone');
  clearDraft();
  regard = null;
  go('ile');
  if (ile.archipel) synchroniser();
}

function bruler() { // le texte brûle sous tes yeux ; ce qu’il a fait pousser reste
  const ta = app.querySelector('textarea'), fin = () => poser(false, true);
  if (reduced || !ta) return fin();
  ta.readOnly = true; ta.classList.add('brule');
  setTimeout(fin, 1400);
}

/* ───────── Boucle et départ ───────── */

let pannes = 0; // si la 3D échoue sans cesse, elle s’arrête ; le reste de l’app continue
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden || pannes > 5) return;
  try { if (!companion.hidden) drawCompanion(); if (vue?.actif) vue.frame(); } catch (e) { if (++pannes > 5) console.error(e); }
}

addEventListener('resize', () => { if (!companion.hidden) ilot?.redim(); vue?.redim(); });

loadDraft();
derive();
for (const b of document.querySelectorAll('.onglets button')) b.addEventListener('click', () => ONGLETS[b.dataset.onglet]());
$('#humans').addEventListener('click', () => humansSheet());
/* ───────── La musique ───────── */
// Coupée par défaut. Un bouton de son sur la vue de l’île, et sur celle de l’archipel, l’allume ; le choix reste sur ce
// téléphone. Chaque vue a sa pièce : le feu de camp sur l’île, la mer dans l’archipel ; ailleurs, le silence.
// Rallumée au retour, elle attend un premier geste : le navigateur n’ouvre le son qu’à ce moment-là.
const musiqueVoulue = () => !!store.get('musique', 0);
const PIECE_DE = { ile: 'ile', archipel: 'archipel' };
function suivreMusique(screen) { if (!musique.disponible || !musiqueVoulue()) return; if (PIECE_DE[screen]) musique.jouer(PIECE_DE[screen]); else musique.taire(); }
let majSon = null; // le bouton de son de la vue en cours, pour le tenir à jour quand le menu change la musique
function basculerMusique(piece = PIECE_DE[ecran]) { // depuis le bouton d’une vue, ou depuis le menu
  const on = !musiqueVoulue(); store.set('musique', on ? 1 : 0); note(on ? 'musique : allumée' : 'musique : coupée');
  if (!on) musique.arreter(); else if (piece) musique.jouer(piece);
  majSon?.(); return on;
}
function boutonSon(piece) {
  const b = el('button', { type: 'button', className: 'son' });
  const maj = () => { const on = musiqueVoulue(); b.innerHTML = ICONE_SON[on]; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Couper la musique' : 'Allumer la musique'); };
  b.addEventListener('click', () => basculerMusique(piece));
  maj(); majSon = maj; return b;
}

/* ───────── Le menu Plus ───────── */
// Dans la barre du bas : ce qui sert partout, à portée de pouce. Ce sont des actions qu’on trouve aussi ailleurs, à leur place.

const ICONES_MENU = {
  quitter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H13"/><path d="M16 8.5l3.5 3.5-3.5 3.5M9.5 12h10"/></svg>',
  installer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v10M8.5 11l3.5 3.5 3.5-3.5"/><path d="M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2"/></svg>',
  parler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.5 1.5A14 14 0 0 1 5 6a1.5 1.5 0 0 1 1.5-1.5z"/></svg>',
  intro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
};
function plusSheet() { // compact : une icône et quelques mots par ligne
  note('geste : menu plus');
  const ligne = (icone, titre, fn) => { const b = el('button', { type: 'button', className: 'row' }); b.innerHTML = icone; b.append(el('span', { textContent: titre })); b.addEventListener('click', fn); return b; };
  const ligneMusique = () => { const on = musiqueVoulue(), b = ligne(ICONE_SON[on], on ? 'Couper la musique' : 'Allumer la musique', () => { basculerMusique(); b.replaceWith(ligneMusique()); }); return b; };
  const liste = el('div', { className: 'list menu' },
    ligne(ICONES_MENU.quitter, 'Quitter vite ce site', () => quitter($('#exit').href)),
    ...(musique.disponible ? [ligneMusique()] : []),
    ligne(ICONES_MENU.installer, installee() ? 'L’app est installée' : 'Installer l’app', installerSheet),
    ligne(ICONES_MENU.parler, 'Parler à quelqu’un', () => humansSheet()),
    ...(vue ? [ligne(ICONES_MENU.intro, 'Revoir l’intro', () => { closeSheet(); revue = true; go('intro'); })] : []));
  openSheet(el('div', {}, el('h2', { textContent: 'Plus' }), liste, footRow(quiet('revenir', closeSheet))));
}
let fuite = false; // on part : plus rien ne s’affiche
function quitter(url) { // partir vite : l’écran se vide, on remonte l’historique de l’app, puis on le remplace. « Retour » ne ramène plus ici.
  fuite = true; document.body.style.visibility = 'hidden'; closeSheet(); musique.arreter(true);
  const n = history.state?.n || 0;
  if (n > 0) { history.go(-n); setTimeout(() => location.replace(url), 700); } else location.replace(url);
}
$('#exit').addEventListener('click', e => { e.preventDefault(); quitter(e.currentTarget.href); });
addEventListener('popstate', e => { if (fuite) { location.replace($('#exit').href); return; } closeSheet(); render(e.state?.screen || 'q:situ'); });
const premiere = !store.get('intro', false) && !ile.depots.length && !iles.length && !anyChecked() && !state.text.trim(); // la toute première fois : rien encore sur ce téléphone
const depart = premiere ? 'intro' : ile.depots.length || iles.length ? 'ile' : 'q:situ'; // au retour, une île déjà commencée : on la retrouve d’abord
history.replaceState({ screen: depart, n: history.state?.n || 0 }, '', ''); // après un rechargement, les écrans d’avant sont toujours là
render(depart);
requestAnimationFrame(frame);
if ([ile, ...iles].some(x => x.archipel && (!x.archipel.id || x.archipel.enRetard))) setTimeout(synchroniser, 1500); // sans rien en attente, aucune requête
function garderHorsLigne() { // le service worker garde les fichiers que la page a chargés : installée, l’app s’ouvre sans réseau
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready)
    .then(r => r.active?.postMessage({ type: 'garder', urls: performance.getEntriesByType('resource').map(e => e.name) }))
    .catch(() => {}); // sans service worker, l’app marche pareil, en ligne
}
if ('serviceWorker' in navigator) { if (document.readyState === 'complete') garderHorsLigne(); else addEventListener('load', garderHorsLigne); }
window.archipel = { state, get ile() { return ile; }, get iles() { return iles; }, get courant() { return courant; }, get preview() { return preview; }, arch, vie, vue, ilot, sonder, synchroniser, placeLibre, posArch, musique }; // pour les tests
