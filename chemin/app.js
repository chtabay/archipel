// Le chemin : un journal. Chaque page devient un bout de chemin, peint à l’aquarelle sur ce téléphone : ses mots
// choisissent le lieu, les objets et le temps qu’il fait. Une page courte fait une tuile ; un long texte, un roman collé
// d’un coup, se découpe en passages d’environ 14 mots porteurs, une tuile chacun. Les pages restent ici ; rien ne part.

import { chargerSens, decouper, lirePage, candidats, objetsDeLaPage, lieuDeLaPage, LECTURE } from './sens.js?v=4';
import { familles, planifier, climatDe, Atelier, Modeles, LARGE, HAUT, MARGE, MOTEUR } from './monde.js?v=3';
import { demo } from './demo.js?v=2';
import * as carnet from './carnet.js?v=1';
import { peindreFrise } from '../aquarelle.js?v=3';
import { LEX, HUMANS } from '../contenu.js?v=2';

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const deux = n => String(n).padStart(2, '0'), aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`; }; // la date d’ici, pas celle de Greenwich
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');
const enDemo = new URLSearchParams(location.search).has('demo');
const dates = new Map(), quand = d => { // « 7 octobre », et l’année si ce n’est pas celle-ci
  if (!dates.has(d)) { const x = new Date(`${d}T12:00:00`); dates.set(d, x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(x.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) })); }
  return dates.get(d);
};
const LIEUX = { interieur: 'à la maison', village: 'au village', foret: 'en forêt', champs: 'dans les champs', rivage: 'au bord de l’eau', desert: 'dans le désert',
  savane: 'dans la savane', tropiques: 'sous les tropiques', montagne: 'en montagne' };
const dit = t => { $('#dit').textContent = t; };
const souffle = () => new Promise(r => setTimeout(r, 0));
const empreinte = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (b >>> 0).toString(36) + (a >>> 0).toString(36); };

let pages = [], passages = [], plans = [], S = null, F = null, atelier = null, gen = 0;
const frise = $('#frise'), tuiles = [], lus = new Map(); // lus : le texte d’un passage → sa lecture et ses objets possibles, calculés une fois

/* ───────── L’intro : le chemin se dessine au pinceau pendant que tout se prépare ───────── */

const intro = (() => {
  const box = $('#intro'), calme = matchMedia('(prefers-reduced-motion: reduce)').matches, deja = (() => { try { return localStorage.getItem('chemin:vu') === '1'; } catch { return false; } })();
  const duree = calme ? 500 : deja ? 1300 : 2600, etat = $('#intro-etat'); // le trait part dès l’affichage de la page, avant ce script
  let partie = false, lent = setTimeout(() => { if (!etat.textContent) etat.textContent = 'Le pinceau se prépare…'; }, Math.max(0, 3200 - performance.now()));
  box.style.setProperty('--trace', `${duree}ms`); // la deuxième fois, plus court
  let fermee; const ferme = new Promise(r => { fermee = r; });
  const fermer = () => {
    if (partie) return; partie = true; clearTimeout(lent); fermee();
    try { localStorage.setItem('chemin:vu', '1'); } catch { /* sans effet */ }
    box.classList.add('partie'); setTimeout(() => { box.hidden = true; }, calme ? 0 : 600);
    document.body.classList.remove('accueil');
  };
  box.addEventListener('click', fermer); addEventListener('keydown', e => { if (!partie && !e.metaKey && !e.ctrlKey) fermer(); });
  const trait = new Promise(r => setTimeout(r, Math.max(0, duree - performance.now()))); // le trait fini : le pinceau peut peindre sans le saccader
  return {
    trait,
    dire: t => { etat.textContent = t; },
    // se ferme quand le pinceau a fini son trait et que le chemin est prêt ; jamais plus tard que limite
    async quand(pret, limite = 15000) {
      await Promise.race([Promise.all([pret, trait]), new Promise(r => setTimeout(r, Math.max(0, limite - performance.now()))), ferme]);
      fermer();
    },
    fermee: ferme,
    get partie() { return partie; },
  };
})();

/* ───────── Les passages, puis le plan de chaque tuile ───────── */

// Le départ, puis chaque page, découpée en passages ; dans l’ordre, pour que chaque tuile tienne compte de celle d’avant.
// Long, pour un roman : on rend la main au téléphone de temps en temps, et on s’arrête si une nouvelle page arrive.
async function calculer(suivre = () => {}) {
  const g = ++gen, out = [{ texte: '', titre: null, date: pages[0]?.date || aujourdhui(), depart: true }];
  let t = performance.now();
  const respirer = async () => { if (performance.now() - t > 30) { await souffle(); t = performance.now(); } return g === gen; };
  for (const [n, p] of pages.entries()) {
    const d = decouper(S, p.texte);
    (d.length ? d : [{ texte: p.texte, titre: null, porteurs: 0 }]).forEach((x, k) => out.push({ ...x, date: p.date, page: n, premier: k === 0 }));
    if (!(await respirer())) return false;
  }
  const manquent = out.filter(x => !lus.has(x.texte)), nouvelles = [];
  if (manquent.length > 1) { // la lecture d’un long texte, déjà faite à une visite d’avant
    const gardees = await carnet.lectures(manquent.map(x => cleLue(x.texte))).catch(() => new Map());
    for (const x of manquent) { const v = gardees.get(cleLue(x.texte)); if (v) lus.set(x.texte, relire(v)); }
    if (g !== gen) return false;
  }
  const recents = new Map(), decor = new Map(), faits = []; let veille = null;
  for (const [i, x] of out.entries()) {
    let l = lus.get(x.texte);
    if (!l) { const lecture = lirePage(S, x.texte); l = { lecture, liste: candidats(S, lecture) }; lus.set(x.texte, l); nouvelles.push([cleLue(x.texte), ecrire(l)]); }
    const objets = objetsDeLaPage(S, l.lecture, { recents, jour: i, liste: l.liste });
    for (const o of objets) recents.set(o.objet.id, i);
    const lieu = x.depart ? 'champs' : lieuDeLaPage(l.lecture, objets, veille?.lieu), jour = { i, date: x.date, lieu, objets, climat: climatDe(l.lecture) };
    veille = planifier(jour, veille, F, decor); veille.lecture = l.lecture; veille.objets = objets; veille.passage = x;
    faits.push(veille);
    if (i % 20 === 0) suivre(i, out.length);
    if (!(await respirer())) return false;
  }
  passages = out; plans = faits;
  carnet.garderLectures(nouvelles).catch(() => {});
  if (lus.size > 4 * out.length + 200) for (const k of [...lus.keys()].slice(0, lus.size - 2 * out.length)) lus.delete(k); // la mémoire ne garde que l’utile
  return true;
}
// une lecture gardée : ses mots, son contexte, ses champs, sa tonalité, et ses objets possibles, par leur nom
const cleLue = texte => `${LECTURE}:${empreinte(texte)}:${texte.length}`;
const ecrire = l => ({ l: { ...l.lecture, contexte: [...l.lecture.contexte] }, o: l.liste.map(o => [o.objet.id, o.brut, o.mot]) });
const relire = v => ({ lecture: { ...v.l, contexte: Float32Array.from(v.l.contexte) }, liste: v.o.map(([id, brut, mot]) => ({ objet: F.parId.get(id), brut, mot })).filter(o => o.objet) });
// la clé d’une tuile peinte : tout ce dont dépend sa peinture, elle et ses deux voisines, et la version du peintre
const signe = p => (p ? JSON.stringify([p.i, p.date, p.lieu, p.saison, p.climat, p.items, p.piece, p.sol]) : '');
const cle = k => `${MOTEUR}:${empreinte(`${signe(plans[k - 1])}|${signe(plans[k])}|${signe(plans[k + 1])}`)}`;

/* ───────── La frise : une tuile par passage, peinte quand elle approche, gardée une fois peinte ───────── */

let vues = null, premiere = null;
const etiquette = x => (x.depart ? 'Le départ' : [x.premier && quand(x.date), x.titre].filter(Boolean).join(' · '));
function montrer() {
  vues?.disconnect(); for (const u of tuiles) if (u.url) URL.revokeObjectURL(u.url);
  frise.replaceChildren(); tuiles.length = 0;
  plans.forEach((p, k) => {
    const x = p.passage, img = el('img', { alt: '', decoding: 'async', width: LARGE, height: HAUT }), t = el('div', { className: 'tuile' }, img, el('div', { className: 'attente' }), el('div', { className: 'date', textContent: etiquette(x) }));
    const mots = poses(p);
    t.setAttribute('role', 'img'); t.setAttribute('aria-label', `${etiquette(x) || quand(x.date)} : ${LIEUX[p.lieu]}${mots.length ? `, ${mots.join(', ')}` : ''}`);
    t.addEventListener('click', () => dire(k));
    frise.append(t); tuiles.push({ t, img, k, cle: cle(k), etat: 'vide', proche: false });
  });
  let pret; premiere = new Promise(r => { pret = r; }); premiere.pret = pret;
  vues = new IntersectionObserver(es => {
    for (const e of es) { const u = tuiles[+e.target.dataset.k]; if (!u) continue; u.proche = e.isIntersecting; if (u.proche) approcher(u); else eloigner(u); }
    file();
  }, { root: frise, rootMargin: '0px 150% 0px 150%' });
  tuiles.forEach(u => { u.t.dataset.k = u.k; vues.observe(u.t); });
  if (!tuiles.length) premiere.pret();
  if (enDemo) return; // la démo ne range pas le carnet : ce qu’il garde du journal y reste
  carnet.elaguer('tuiles', new Set(tuiles.map(u => u.cle))).catch(() => {});
  carnet.elaguer('lectures', new Set(passages.map(x => cleLue(x.texte)))).catch(() => {});
}
// au départ, et après une page gardée : le début de la dernière page, au bord droit de l’écran s’il tient
function allerAuBout() {
  const dernier = passages.findIndex(x => x.page === pages.length - 1 && x.premier), t = tuiles[Math.max(0, dernier)]?.t;
  if (!t) return;
  frise.scrollLeft = Math.min(t.offsetLeft - frise.offsetLeft - 8, frise.scrollWidth); // la frise ne va pas plus loin que son bout
}
async function approcher(u) { // une tuile entre dans le champ : gardée, on la montre ; sinon, au pinceau
  if (u.etat !== 'vide') return;
  u.etat = 'cherche'; const g = gen;
  const image = await carnet.tuile(u.cle).catch(() => null);
  if (g !== gen) return;
  if (image) { afficher(u, image, 'carnet'); return; }
  u.etat = 'a-peindre'; u.t.querySelector('.attente').textContent = 'Le pinceau passe…'; file();
}
function eloigner(u) { // loin de l’écran, l’image est rendue à la mémoire ; elle reviendra du carnet
  if (u.etat !== 'faite') return;
  URL.revokeObjectURL(u.url); u.url = null; u.img.removeAttribute('src'); u.etat = 'vide';
}
function afficher(u, image, source) {
  if (!u.proche) { u.etat = 'vide'; return; }
  u.url = URL.createObjectURL(image); u.img.src = u.url; u.etat = 'faite'; u.t.dataset.source = source;
  u.img.decode().catch(() => {}).then(() => { u.t.querySelector('.attente').textContent = ''; u.t.classList.add('peinte'); if (visible(u)) premiere?.pret(); });
}
const visible = u => { const a = u.t.getBoundingClientRect(), f = frise.getBoundingClientRect(); return a.right > f.left && a.left < f.right; };
const distance = u => { const a = u.t.getBoundingClientRect(), f = frise.getBoundingClientRect(); return Math.abs(a.left + a.width / 2 - (f.left + f.width / 2)); };
let enCours = false;
async function file() { // une tuile à la fois, la plus proche du milieu de l’écran d’abord
  if (enCours) return;
  const u = tuiles.filter(x => x.proche && (x.etat === 'a-peindre' || x.etat === 'cherche')).sort((a, b) => distance(a) - distance(b))[0];
  if (u?.etat !== 'a-peindre') return; // la plus proche se cherche encore dans le carnet : on l’attend
  enCours = true; u.etat = 'peinture'; const g = gen;
  try {
    if (!intro.partie) await Promise.race([intro.trait, intro.fermee]); // pendant que le chemin se trace, le pinceau attend
    const image = await peindre(u.k);
    carnet.garderTuile(u.cle, image); // même si le chemin a changé entre-temps : une autre tuile peut avoir la même clé
    if (g === gen) afficher(u, image, 'pinceau');
  } catch (e) { console.warn(e); if (g === gen) { u.etat = 'rate'; u.t.querySelector('.attente').textContent = 'Le pinceau ne passe pas'; premiere?.pret(); } }
  enCours = false; file();
}
async function peindre(k) {
  const vue = await atelier.tuile(plans, k), jour = j => { const p = plans[Math.max(0, Math.min(plans.length - 1, j))]; return { x: (j + .5) * LARGE, teinte: p.climat.teinte, ciel: p.climat.ciel, meteo: p.climat.meteo, astres: p.climat.astres }; };
  const peinte = await peindreFrise(vue, { graine: 7, decalage: [k * LARGE - MARGE, 0], jours: [jour(k - 1), jour(k), jour(k + 1)] });
  const c = el('canvas', { width: LARGE, height: HAUT }); c.getContext('2d').drawImage(peinte, MARGE, 0, LARGE, HAUT, 0, 0, LARGE, HAUT);
  for (const x of [peinte, vue.image, vue.silhouette]) x.width = x.height = 0; // la mémoire, tout de suite
  const image = await new Promise(ok => c.toBlob(b => (b?.type === 'image/webp' ? ok(b) : c.toBlob(ok, 'image/jpeg', .9)), 'image/webp', .88));
  c.width = c.height = 0;
  if (!image) throw new Error('la tuile ne se range pas en image');
  return image;
}
// les mots du passage dont l’objet a trouvé sa place sur la tuile
const poses = p => [...new Set(p.objets.filter(o => p.items.some(it => it.id === o.objet.id)).map(o => o.mot))];
function dire(k) { // toucher une tuile : son nom, son lieu, et les mots qui l’ont fait pousser
  const p = plans[k], x = p.passage, mots = poses(p);
  $('#jour').textContent = [x.depart ? 'Le départ' : [quand(x.date), x.titre].filter(Boolean).join(' · '), LIEUX[p.lieu], mots.join(', ')].filter(Boolean).join(' · ');
}

/* ───────── Écrire la page du jour : elle remplace celle d’aujourd’hui s’il y en a une ───────── */

function aide(texte) { // le filet de sécurité d’Archipel : des gens à qui parler, si les mots le disent
  const t = norm(texte), quoi = LEX.self.some(k => t.includes(k)) ? 'self' : LEX.other.some(k => t.includes(k)) ? 'other' : null, box = $('#aide');
  if (!quoi) { box.hidden = true; return; }
  const g = HUMANS.find(h => h.id === quoi);
  box.replaceChildren(el('p', { textContent: 'Ce que tu écris compte. Des gens peuvent t’écouter, maintenant :' }), ...g.items.map(([nom, href, sous]) => el('p', {}, el('a', { href, textContent: nom }), ` · ${sous}`)));
  box.hidden = false;
}
if (enDemo) { // la démo le dit : ses pages sont des exemples, et ce qu’on y écrit n’est pas gardé
  $('#demo').hidden = false;
  $('#promesse').replaceChildren('Dans la démo, ta page n’est pas gardée. ', el('a', { href: './', textContent: 'Commencer mon journal' }));
}
function preparerEcriture() {
  const zone = $('#page'), bouton = $('#garder'), jour = aujourdhui(), deja = pages.find(p => p.date === jour);
  if (deja && !enDemo) zone.value = deja.texte;
  let attente = null;
  zone.addEventListener('input', () => { clearTimeout(attente); attente = setTimeout(() => aide(zone.value), 250); });
  bouton.addEventListener('click', async () => {
    const texte = zone.value.replace(/\r\n?/g, '\n').trim(); if (!texte) { zone.focus(); return; }
    aide(texte); bouton.disabled = true;
    const i = pages.findIndex(p => p.date === jour), premiere = !pages.length;
    if (i >= 0) pages[i].texte = texte; else pages.push({ date: jour, texte });
    pages.sort((a, b) => a.date.localeCompare(b.date));
    const garde = enDemo || await carnet.garderPage({ date: jour, texte });
    if (premiere && !enDemo) carnet.proteger();
    dit(texte.length > 3000 ? 'Le texte se lit…' : 'Le chemin s’allonge…');
    if (await calculer((n, t) => dit(`Le texte se lit : ${n} passages sur ${t}`))) {
      montrer(); allerAuBout();
      const n = passages.filter(x => !x.depart && x.date === jour).length;
      dit(enDemo ? 'Démo : ta page s’ajoute au chemin, sans être gardée.' : !garde ? 'Ta page n’a pas pu être gardée : la place manque sur ce téléphone.' : n > 1 ? `Ta page est gardée. Elle fait ${n} tuiles de chemin.` : 'Ta page est gardée. Le chemin s’allonge.');
    }
    bouton.disabled = false;
  });
}

/* ───────── Hors ligne : le service worker garde l’app et les objets déjà vus ───────── */

function garderHorsLigne() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready)
    .then(r => r.active?.postMessage({ type: 'garder', urls: performance.getEntriesByType('resource').map(e => e.name) }))
    .catch(() => {}); // sans service worker, l’app marche pareil, en ligne
}

(async () => {
  let pret = Promise.resolve();
  try {
    const [s, p] = await Promise.all([chargerSens('./'), enDemo ? demo() : carnet.lirePages()]);
    S = s; pages = p; F = familles(S.catalogue); atelier = new Atelier(new Modeles('./'), F.parId);
    preparerEcriture();
    if (await calculer((n, t) => { if (t > 60) { intro.dire(`Le texte se relit : ${n} passages sur ${t}`); dit(`Le texte se relit : ${n} passages sur ${t}`); } })) { montrer(); allerAuBout(); }
    dit(pages.length ? 'Chaque page devient un bout de chemin.' : 'Écris ta première page : le chemin commence là.');
    pret = premiere;
  } catch (e) { console.error(e); dit('Le chemin ne s’ouvre pas sur cet appareil.'); }
  await intro.quand(pret);
  window.chemin = { get plans() { return plans; }, get passages() { return passages; }, get pages() { return pages; }, get tuiles() { return tuiles; }, S, F, atelier, carnet }; // pour les essais
  if (document.readyState === 'complete') garderHorsLigne(); else addEventListener('load', garderHorsLigne);
})();
