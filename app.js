// L’archipel : les cases, les graines, l’île qui pousse, et l’archipel où la poser, en 3D.
// Tout reste sur cet appareil ; rien ne part. Pour l’instant, les îles des autres sont inventées.

import { SUBJECTS, QUESTIONS, KEYS, BASE, LEX, HUMANS, MOCK } from './contenu.js?v=2';
import { graines, quadDe, nomDe, phrasesDe, casesDe, sujetLabel, listeDe, listeGraines, FAMILLES, ESPECES, NOMS } from './grammaire.js?v=2';
import { nouvelleIle, deriver, resume, archipelInvente, ileInventee, BIOMES, BIOME_IDS, biomeDe } from './ile.js?v=3';
import { Vue3D, Ilot3D, apercu, disponible, ECH_ARCH } from './monde.js?v=4';
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
const checked = k => QUESTIONS[k].items.filter(it => state.answers[k].has(it.id));
const has = (k, id) => state.answers[k].has(id);
const anyChecked = () => KEYS.some(k => state.answers[k].size);
const pack = answers => Object.fromEntries(KEYS.map(k => [k, [...answers[k]]]));
const unpack = obj => Object.fromEntries(KEYS.map(k => [k, new Set(obj?.[k] || [])]));
const sequence = () => [...BASE, ...KEYS.filter(k => QUESTIONS[k].extra && QUESTIONS[k].when(state.answers))];
const signals = () => {
  const items = KEYS.flatMap(k => checked(k));
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
  state.answers = unpack(d.answers); state.text = d.text || ''; state.short = !!d.short;
}
function clearDraft() {
  state.answers = emptyAnswers(); state.text = ''; state.path = null;
  store.del('draft');
  derive();
}

/* ───────── L’île, et celles d’avant ───────── */

let ile = store.get('ile', null) || nouvelleIle(); // celle qui pousse
let iles = store.get('iles', []); // celles d’avant, gardées ici
const saveIle = () => store.set('ile', ile);
const saveIles = () => store.set('iles', iles);
const vie = new Map(); // clé → instant d’apparition, pour le petit rebond
let courant = deriver(ile); // ce que l’île montre
let regard = null; // une île d’avant qu’on regarde, sinon null
const t0 = performance.now();
const now = () => (performance.now() - t0) / 1000;

/* ───────── Les graines, en compagnie ───────── */

const companion = $('#companion'), entCanvas = $('#ent'), en3D = disponible();
if (!en3D) { entCanvas.hidden = true; $('#ent-hint').hidden = true; } // sans 3D, pas d’îlot : les graines restent dites en mots
let preview = [], signes = {}; // les graines, et ce que l’îlot montre en plus : le phare, le ciel lourd
const ilot = en3D ? new Ilot3D(entCanvas) : null, vue = en3D ? new Vue3D() : null; // l’îlot des graines ; la vue de l’île et de l’archipel
if (ilot) ilot.vieT = now;
if (vue) vue.vieT = now;

let lu = { sujets: [], quad: 'N' }, proposes = []; // ce que le texte dit (lu sur l’appareil), et les sujets qu’il propose
const avecTexte = () => ({ ...state.answers, sujets: new Set([...state.answers.sujets, ...proposes]) }); // les sujets du texte comptent comme des cases

function derive() { // ce que la confession en cours ferait pousser
  const before = new Set(preview.map(a => a.key));
  lu = lire(state.text);
  proposes = lu.sujets.map(([id]) => id).filter(id => !state.answers.sujets.has(id));
  const r = anyChecked() || state.text.trim() ? graines(avecTexte(), state.text.trim(), state.answers.mots.size ? null : { quad: lu.quad }) : null, g = r ? r.graines : [];
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

function renderIle() {
  const d = regard ? deriver(regard) : courant, mine = !regard;
  const wrap = el('div', { className: 'ilewrap' });
  const invite = d.assets.length ? 'Touche ce qui a poussé. Tourne l’île du doigt, écarte deux doigts pour zoomer.' : 'Rien n’a encore poussé. Ça viendra avec ta première confession.';
  const caption = el('p', { className: 'ile-caption', id: 'ile-caption', textContent: invite });
  const excerpt = el('p', { className: 'excerpt', id: 'ile-excerpt', hidden: true });
  const line = el('p', { className: 'ile-line', id: 'ile-line' });
  const nav = el('nav', { className: 'actions' }); // une action principale ; les autres, plus discrètes, à côté
  if (mine) {
    const brouillon = anyChecked() || state.text.trim();
    nav.append(bouton(brouillon ? 'Reprendre ce que tu déposais' : 'Déposer autre chose', () => go('q:situ')));
    if (ile.depots.length) nav.append(quiet('changer d’île', changerSheet));
    else nav.append(quiet('choisir le paysage', paysageSheet));
    if (iles.length) nav.append(quiet('tes îles d’avant', ilesSheet));
  } else nav.append(bouton('Revenir à ton île', () => { regard = null; go('ile'); }));
  const pousses = el('ul', {}, ...(d.assets.length ? d.assets.map(a => el('li', { textContent: ligneDe(a, d) })) : [el('li', { textContent: 'rien encore' })]));
  const what = titre && mine ? titre : null;
  app.replaceChildren(
    el('p', { className: 'step', textContent: mine ? (what ? 'Ton île' : 'Ton île, aujourd’hui') : `Une île d’avant · ${mois(regard.nee)}` }),
    el('h1', { textContent: what ? what.h1 : mine ? 'Ton île' : 'Elle ne pousse plus' }),
    el('p', { className: 'hint', textContent: what ? what.line : mine ? 'Elle pousse avec ce que tu déposes. Rien ne quitte ce téléphone.' : 'Elle reste ici, telle que tu l’as laissée.' }),
    wrap, caption, excerpt, line,
    nav,
    el('details', {}, el('summary', { textContent: 'Ce qui a poussé' }), pousses),
    el('details', {}, el('summary', { textContent: 'Comment ça pousse' }), legende()),
    el('details', {}, el('summary', { textContent: 'Ce qui serait compté' }), el('ul', {}, ...(trace.length ? trace : ['rien']).map(t => el('li', { textContent: t })))),
    el('p', { className: 'tiny', textContent: 'Pour l’instant, ton île reste sur ce téléphone, sans chiffrement, et l’archipel des autres est inventé.' }),
  );
  titre = null;
  scene.d = d;
  if (!vue) { wrap.classList.add('sans'); caption.hidden = true; wrap.append(el('p', { className: 'sans3d', textContent: 'Cet appareil n’affiche pas la 3D. Ton île est bien là : ce qui a poussé est écrit plus bas.' })); updateIleLine(); return; }
  vue.attacher(wrap);
  vue.canvas.setAttribute('aria-label', mine ? 'Ton île, en 3D, et ce qui y a poussé' : 'Une de tes îles d’avant, en 3D');
  const tourner = el('button', { type: 'button', className: 'tourner', innerHTML: ICONE_TOURNER }); // tourner, sur la vue elle-même
  tourner.setAttribute('aria-label', 'Tourner l’île'); tourner.addEventListener('click', () => { vue.tourner(); note('geste : tourner l’île'); });
  wrap.append(tourner);
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
  ul.append(el('li', {}, el('b', { textContent: 'Le temps qu’il fait. ' }), 'Le ciel de l’île suit ta dernière confession. Chaque sensation cochée en plus de la principale laisse un temps qu’il fait : un nuage d’orage, un nuage de pluie, des fleurs, un étang. Sans sujet, la situation suffit : on m’a fait du mal, un arbre ; je regrette, une pierre. Rien du tout : un caillou posé.'));
  return ul;
}

/* ───────── L’archipel ───────── */

const arch = { autres: [], items: [], arrivals: 0 };
const miennes = () => [...iles.filter(x => x.envoyee), ...(ile.envoyee ? [ile] : [])];
const LARG = 18, PROF = 36; // l’archipel est plus profond que large : on le regarde en portrait, d’un peu haut
if (vue) vue.dimsArch = [LARG, PROF];
const posArch = (a, v) => [(v - .5) * LARG, (.5 - a) * PROF]; // supportable à droite, agité au loin

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

function placerArchipel() {
  const items = arch.autres.map(o => ({ ...o, d: o.d || (o.d = deriver(o.ile)), mine: false }));
  for (const m of miennes()) { const d = deriver(m), r = resume(d); items.push({ ile: m, d, a: r.a, v: r.v, mine: true, label: m === ile ? 'la tienne' : `la tienne, ${mois(m.nee).split(' ')[0]}` }); }
  for (const it of items) [it.x, it.z] = posArch(it.a, it.v);
  ecarter(items);
  arch.items = items;
}

function nouvelleAutre() { // une île de quelqu’un d’autre (inventée) arrive depuis l’horizon
  const r = Math.random(), q = r < .27 ? 'AD' : r < .68 ? 'ED' : r < .82 ? 'AS' : 'ES';
  const a = (q[0] === 'A' ? .5 : 0) + Math.random() * .5, v = (q[1] === 'S' ? .5 : 0) + Math.random() * .5;
  const it = { ile: ileInventee(5000 + Math.floor(Math.random() * 1e6), q), a, v, mine: false, born: now() };
  [it.x, it.z] = posArch(a, v);
  ecarter([it], arch.items);
  arch.arrivals++;
  updateArchLine();
  return it;
}

function updateArchLine() {
  const line = $('#arch-line');
  if (!line) return;
  const n = miennes().length;
  line.textContent = `Ce mois-ci${NB}: ${(MOCK.total + n).toLocaleString('fr-FR')} îles · arrivées depuis que tu regardes${NB}: ${arch.arrivals} · les tiennes${NB}: ${n}`;
}

const INVITE_ARCH = 'Touche une île pour t’en approcher. Fais tourner l’archipel du doigt.';
function legendeArch(it) {
  const d = it.d || deriver(it.ile), rs = resume(d);
  return it.mine ? `La tienne${it.ile === ile ? ', celle d’aujourd’hui' : `, celle de ${mois(it.ile.nee)}`}${NB}: ${listeDe(rs.comptes)}.` : `Une île avec ${listeDe(rs.comptes)}${rs.phare ? ', et un phare' : ''}. ${it.born ? 'Arrivée à l’instant.' : 'Là depuis un moment.'}`;
}
function montrerArchipel(caption) {
  vue.montrerArchipel(arch.items, { nouvelle: nouvelleAutre });
  vue.onTouche = it => {
    if (!it) { caption.textContent = INVITE_ARCH; return; }
    caption.replaceChildren(`${legendeArch(it)} `, quiet('revenir à l’archipel', () => { vue.viser(null); caption.textContent = INVITE_ARCH; }));
  };
}
function renderArchipel() {
  const wrap = el('div', { className: 'ilewrap mer' });
  const caption = el('p', { className: 'ile-caption', id: 'arch-caption', textContent: INVITE_ARCH });
  const nav = el('nav', { className: 'actions' });
  if (!ile.envoyee && ile.depots.length) { const b = bouton('Y mettre ton île', envoyerSheet); b.id = 'mettre-ile'; nav.append(b); }
  app.replaceChildren(
    el('p', { className: 'step', textContent: 'L’archipel' }),
    el('h1', { textContent: 'L’archipel, ce soir' }),
    el('p', { className: 'hint', textContent: 'Les îles des autres arrivent au fil de l’eau, placées par sensation. Personne ne lit rien : ce sont des formes.' }),
    wrap, caption, el('p', { className: 'ile-line', id: 'arch-line' }),
    nav,
    el('p', { className: 'tiny', textContent: 'Pour l’instant, les îles des autres sont inventées. Les tiennes restent sur ce téléphone.' }),
  );
  if (!arch.autres.length) arch.autres = archipelInvente(26);
  placerArchipel();
  arch.arrivals = 0;
  if (!vue) { wrap.classList.add('sans'); caption.hidden = true; wrap.append(el('p', { className: 'sans3d', textContent: 'Cet appareil n’affiche pas la 3D : l’archipel ne peut pas se montrer ici. Ton île y est quand même, si tu l’y as mise.' })); updateArchLine(); return; }
  vue.attacher(wrap);
  vue.canvas.setAttribute('aria-label', 'L’archipel en 3D : les îles des autres, et les tiennes');
  montrerArchipel(caption);
  updateArchLine();
}

/* ───────── Navigation ───────── */

const bouton = (text, fn) => { const b = el('button', { type: 'button', className: 'btn', textContent: text }); b.addEventListener('click', fn); return b; };
const ICONE_TOURNER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/></svg>';
const quiet = (text, fn) => { const b = el('button', { type: 'button', className: 'quiet', textContent: text }); b.addEventListener('click', fn); return b; };

function go(screen) { history.pushState({ screen }, '', ''); render(screen); }

let ecran = 'q:situ';
const ongletDe = screen => (screen === 'ile' || screen === 'archipel' ? screen : 'deposer');
const ONGLETS = { deposer: () => go('q:situ'), ile: () => { regard = null; go('ile'); }, archipel: () => go('archipel') };
function updateOnglets() {
  const actif = ongletDe(ecran), n = courant.assets.length, c = $('.onglets .compte');
  for (const b of document.querySelectorAll('.onglets button')) { if (b.dataset.onglet === actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  c.hidden = !n; c.textContent = n;
}

function render(screen) {
  ecran = screen;
  document.body.classList.toggle('short', state.short && screen === 'page');
  companion.hidden = ['ile', 'archipel'].includes(screen);
  if (!companion.hidden) ilot?.redim();
  if (screen === 'orient') renderOrient();
  else if (screen === 'page') renderPage();
  else if (screen === 'ile') renderIle();
  else if (screen === 'archipel') renderArchipel();
  else renderQ(QUESTIONS[screen.slice(2)] ? screen.slice(2) : 'situ');
  scrollTo(0, 0);
  const h = app.querySelector('h1, .big');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  updateOnglets();
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
  const texte = state.text.trim(), g = preview.length ? preview : graines(state.answers, '').graines;
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
  body.append(footRow(quiet('pas maintenant', closeSheet), quiet('voir l’île', () => { closeSheet(); regard = null; go('ile'); })));
  openSheet(body);
}

const APERCU = [{ id: 1, quad: 'N', texte: false, answers: { situ: [], mots: [], sujets: ['s4', 's11', 's7', 's0'], fait: [], subi: [] } }];
function dessinerApercu(c, id) { // un aperçu du paysage : une île d’exemple, en 3D, rendue une fois
  const dpr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth || 132, h = c.clientHeight || 119;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  if (en3D) apercu(c, id, APERCU);
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
  const [row, send] = checkRow('L’ajouter à l’archipel, sans ton nom', !ile.envoyee);
  const body = el('div', {},
    el('h2', { textContent: 'Changer d’île' }),
    el('p', { className: 'intro', textContent: `Celle-ci restera sur ce téléphone, telle qu’elle est${NB}: ${listeDe(rs.comptes)}. Une île vide t’attend.` }));
  if (ile.envoyee) body.append(el('p', { className: 'intro', textContent: 'Elle est déjà dans l’archipel, et y restera.' }));
  else body.append(row, el('p', { className: 'tiny', textContent: `Les autres verraient une île avec ${listeDe(rs.comptes)}${rs.phare ? ', et un phare' : ''}. Rien d’autre${NB}: ni texte, ni date, ni case.` }));
  let paysage = BIOME_IDS[(BIOME_IDS.indexOf(ile.biome || 'prairie') + 1) % BIOME_IDS.length];
  body.append(el('h3', { textContent: 'Le paysage de la prochaine' }), choixPaysage(paysage, id => { paysage = id; }));
  const b = el('button', { type: 'button', className: 'gesture', textContent: 'Commencer une nouvelle île' });
  b.addEventListener('click', () => {
    closeSheet();
    if (!ile.envoyee && send.checked) { ile.envoyee = true; note(`île : ajoutée à l’archipel (${listeDe(rs.comptes)})`); }
    ile.quittee = new Date().toISOString();
    iles = [...iles, ile]; saveIles();
    ile = nouvelleIle(paysage); saveIle();
    note(`paysage : ${BIOMES[paysage].nom}`);
    courant = deriver(ile); vie.clear();
    note('geste : changer d’île');
    titre = { h1: 'Une île vide', line: 'Elle poussera avec ce que tu déposeras. Celle d’avant reste ici.' };
    go('ile');
  });
  body.append(b, footRow(quiet('pas maintenant', closeSheet)));
  openSheet(body);
}

function envoyerSheet() {
  const rs = resume(courant);
  const b = el('button', { type: 'button', className: 'gesture', textContent: 'Y mettre ton île' });
  b.addEventListener('click', () => {
    closeSheet();
    ile.envoyee = true; saveIle();
    note(`île : ajoutée à l’archipel (${listeDe(rs.comptes)})`);
    placerArchipel();
    const moi = arch.items.find(it => it.ile === ile), cap0 = $('#arch-caption');
    if (vue && cap0) { montrerArchipel(cap0); if (moi) { vue.viser(moi); vue.vague(moi.x, moi.z, (performance.now() - vue.t0) / 1000); } }
    updateArchLine();
    const cap = $('#arch-caption'); if (cap) cap.textContent = 'Elle est là, parmi les autres. Elle y grandira avec toi.';
    $('#mettre-ile')?.remove();
  });
  openSheet(el('div', {},
    el('h2', { textContent: 'Y mettre ton île' }),
    el('p', { className: 'intro', textContent: `Elle partira sans ton nom, et sans rien qui permette de te reconnaître. Les autres verraient une île avec ${listeDe(rs.comptes)}${rs.phare ? ', et un phare' : ''}. Rien d’autre${NB}: ni texte, ni date, ni case.` }),
    el('p', { className: 'intro', textContent: 'Elle continuera de pousser ici, et là-bas avec elle.' }),
    b, footRow(quiet('pas maintenant', closeSheet))));
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

/* ───────── Gestes ───────── */

function poser(garderTexte, brule = false) {
  const texte = state.text.trim();
  const ok = [...proposes];
  for (const id of ok) state.answers.sujets.add(id);
  const depot = { id: Date.now(), date: new Date().toISOString(), quad: quadDe(state.answers), texte: !!texte, answers: pack(state.answers) };
  if (ok.length) { depot.duTexte = ok; note(`texte : lu ici, fait pousser ${ok.map(sujetLabel).join(', ')}`); }
  if (!state.answers.mots.size && lu.quad !== 'N') { depot.quadTexte = lu.quad; depot.quad = lu.quad; note('texte : donne la sensation, aucun mot coché'); }
  if (texte && garderTexte) depot.contenu = texte;
  ile.depots.push(depot); saveIle();
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
}

function bruler() { // le texte brûle sous tes yeux ; ce qu’il a fait pousser reste
  const ta = app.querySelector('textarea'), fin = () => poser(false, true);
  if (reduced || !ta) return fin();
  ta.readOnly = true; ta.classList.add('brule');
  setTimeout(fin, 1400);
}

/* ───────── Boucle et départ ───────── */

function frame() {
  if (!document.hidden) {
    if (!companion.hidden) drawCompanion();
    if (vue?.actif) vue.frame();
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', () => { if (!companion.hidden) ilot?.redim(); vue?.redim(); });

loadDraft();
derive();
for (const b of document.querySelectorAll('.onglets button')) b.addEventListener('click', () => ONGLETS[b.dataset.onglet]());
$('#humans').addEventListener('click', () => humansSheet());
$('#exit').addEventListener('click', e => { e.preventDefault(); location.replace(e.currentTarget.href); });
addEventListener('popstate', e => render(e.state?.screen || 'q:situ'));
history.replaceState({ screen: 'q:situ' }, '', '');
render('q:situ');
requestAnimationFrame(frame);
window.archipel = { state, get ile() { return ile; }, get iles() { return iles; }, get courant() { return courant; }, get preview() { return preview; }, arch, vie, vue, ilot }; // pour les tests
