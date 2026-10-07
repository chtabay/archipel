// Le chemin : un journal. Chaque page devient une tranche de chemin, peinte à l’aquarelle sur ce téléphone : ses mots
// choisissent le lieu, les objets et le temps qu’il fait. Les pages restent ici ; rien ne part.

import { chargerSens, lirePage, objetsDeLaPage, lieuDeLaPage } from './sens.js?v=1';
import { familles, planifier, climatDe, Atelier, Modeles, LARGE, HAUT, MARGE } from './monde.js?v=1';
import { demo } from './demo.js?v=1';
import { peindreFrise } from '../aquarelle.js?v=2';
import { LEX, HUMANS } from '../contenu.js?v=2';

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const CLE = 'chemin:pages', aujourdhui = () => new Date().toISOString().slice(0, 10);
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');
const lire = () => { try { const p = JSON.parse(localStorage.getItem(CLE) || '[]'); return Array.isArray(p) ? p.filter(x => x && typeof x.date === 'string' && typeof x.texte === 'string') : []; } catch { return []; } };
const ecrire = p => { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch { /* plein : la page reste à l’écran */ } };
const enDemo = new URLSearchParams(location.search).has('demo');
const quand = d => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

let pages = enDemo ? demo() : lire(), S = null, F = null, atelier = null, plans = [];
const frise = $('#frise'), tuiles = [];

// Les jours : la lecture de chaque page, ses objets, son lieu, son plan ; dans l’ordre, pour que chacun tienne compte de la veille
function calculer() {
  const recents = new Map(), decor = new Map(); let veille = null;
  plans = pages.map((p, i) => {
    const lecture = lirePage(S, p.texte), objets = objetsDeLaPage(S, lecture, { recents, jour: i });
    for (const o of objets) recents.set(o.objet.id, i);
    const lieu = lieuDeLaPage(lecture, objets, veille?.lieu), jour = { i, date: p.date, lieu, objets, climat: climatDe(lecture) };
    veille = planifier(jour, veille, F, decor); veille.lecture = lecture; veille.objets = objets;
    return veille;
  });
}

// La frise : une tuile par jour, peinte quand elle paraît, la plus proche d’abord
function montrer() {
  frise.replaceChildren(); tuiles.length = 0;
  plans.forEach((p, k) => {
    const c = el('canvas', { width: LARGE, height: HAUT }), t = el('div', { className: 'tuile' }, c, el('div', { className: 'attente', textContent: 'Le pinceau passe…' }), el('div', { className: 'date', textContent: quand(p.date) }));
    t.setAttribute('role', 'img'); t.setAttribute('aria-label', `${quand(p.date)} : ${p.lieu}${p.objets.length ? `, ${p.objets.map(o => o.mot).join(', ')}` : ''}`);
    t.addEventListener('click', () => dire(k));
    frise.append(t); tuiles.push({ t, c, k, faite: false });
  });
  const vues = new IntersectionObserver(es => { for (const e of es) { const u = tuiles.find(x => x.t === e.target); if (u) u.visible = e.isIntersecting; } file(); }, { root: frise, rootMargin: '0px 60% 0px 60%' });
  for (const u of tuiles) vues.observe(u.t);
  requestAnimationFrame(() => { frise.scrollLeft = frise.scrollWidth; }); // aujourd’hui, au bout du chemin
}
let enCours = false;
async function file() { // une tuile à la fois
  if (enCours) return;
  const u = tuiles.filter(x => x.visible && !x.faite).sort((a, b) => b.k - a.k)[0]; if (!u) return;
  enCours = true;
  try { await peindreTuile(u); } catch (e) { console.warn(e); u.t.querySelector('.attente').textContent = 'Le pinceau ne passe pas'; }
  u.faite = true; enCours = false; file();
}
async function peindreTuile(u) {
  const { k } = u, vue = await atelier.tuile(plans, k), jour = j => { const p = plans[Math.max(0, Math.min(plans.length - 1, j))]; return { x: (j + .5) * LARGE, teinte: p.climat.teinte, ciel: p.climat.ciel }; };
  const peinte = await peindreFrise(vue, { graine: 7, decalage: [k * LARGE - MARGE, 0], jours: [jour(k - 1), jour(k), jour(k + 1)] });
  u.c.getContext('2d').drawImage(peinte, MARGE, 0, LARGE, HAUT, 0, 0, LARGE, HAUT);
  u.t.querySelector('.attente')?.remove();
}
function dire(k) { // toucher une tuile : sa date, et les mots qui l’ont fait pousser
  const p = plans[k];
  $('#jour').textContent = `${quand(p.date)} · ${{ interieur: 'à la maison', village: 'au village', foret: 'en forêt', champs: 'dans les champs', rivage: 'au bord de l’eau' }[p.lieu]}${p.objets.length ? ` · ${[...new Set(p.objets.map(o => o.mot))].join(', ')}` : ''}`;
}

// Écrire la page du jour : elle remplace celle d’aujourd’hui s’il y en a une
function aide(texte) {
  const t = norm(texte), quoi = LEX.self.some(k => t.includes(k)) ? 'self' : LEX.other.some(k => t.includes(k)) ? 'other' : null, box = $('#aide');
  if (!quoi) { box.hidden = true; return; }
  const g = HUMANS.find(h => h.id === quoi);
  box.replaceChildren(el('p', { textContent: 'Ce que tu écris compte. Des gens peuvent t’écouter, maintenant :' }), ...g.items.map(([nom, href, sous]) => el('p', {}, el('a', { href, textContent: nom }), ` · ${sous}`)));
  box.hidden = false;
}
function preparerEcriture() {
  const zone = $('#page'), jour = aujourdhui(), deja = pages.find(p => p.date === jour);
  if (deja) zone.value = deja.texte;
  zone.addEventListener('input', () => aide(zone.value));
  $('#garder').addEventListener('click', () => {
    const texte = zone.value.trim(); if (!texte) { zone.focus(); return; }
    aide(texte);
    const i = pages.findIndex(p => p.date === jour);
    if (i >= 0) pages[i].texte = texte; else pages.push({ date: jour, texte });
    pages.sort((a, b) => a.date.localeCompare(b.date));
    if (!enDemo) ecrire(pages);
    calculer(); montrer(); $('#dit').textContent = 'Ta page est gardée. Le chemin s’allonge.';
  });
}

(async () => {
  try {
    S = await chargerSens('./'); F = familles(S.catalogue); atelier = new Atelier(new Modeles('./'), F.parId);
    if (!pages.length) { $('#dit').textContent = 'Écris ta première page : le chemin commence là.'; preparerEcriture(); return; }
    calculer(); montrer(); preparerEcriture();
    window.chemin = { plans, S, F, atelier }; // pour les essais
  } catch (e) { console.error(e); $('#dit').textContent = 'Le chemin ne s’ouvre pas sur cet appareil.'; }
})();
