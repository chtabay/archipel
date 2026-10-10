// Spike : combien coûte une tuile peinte ? Le vrai chemin, dans Chromium sans carte graphique (SwiftShader, comme les tests),
// sur un téléphone simulé. 1) l’app en démo (chemin/?demo) peint d’elle-même les tuiles proches de l’écran : on chronomètre
// et on pèse ce qu’elle range dans IndexedDB ; 2) dans la même page, un atelier à part peint des tuiles faites des journées
// inventées (corpus/), exactement comme peindre() dans app.js, et on pèse chaque tuile en WebP 0,88 (Chrome, Firefox),
// en JPEG 0,9 (ce que l’app range sur Safari, qui n’encode pas le WebP) et en PNG.
// Lancer : node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON chemin/faisabilite/mesure/peinture.mjs [nombre de tuiles du corpus]
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ICI, sens, chargerMoteur, lireCorpus, pageDuJour } from './moteur.mjs';
import { nettoyerJour } from './nettoyer.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { GL, TELEPHONE, servir, surveiller } = require('../../../tests/commun.js');
const IMAGES = process.env.IMAGES || path.join(process.env.TMPDIR || '/tmp', 'chemin-mesure-tuiles'); // des tuiles, pour les regarder (hors du dépôt)
mkdirSync(IMAGES, { recursive: true });
const MAX = +(process.argv[2] || 6), DEMO = 300000; // au plus 5 minutes pour les tuiles de la démo

// les journées à peindre : (b) une tuile par jour pour chaque persona, puis les premiers passages de (a) pour le bureau
const { S } = chargerMoteur(), jours = {};
for (const id of ['bureau', 'etudiant', 'retraitee', 'anglais']) jours[id] = pageDuJour(nettoyerJour(lireCorpus(path.join(ICI, `corpus/${id}.txt`)).items));
const lots = [
  ...Object.entries(jours).map(([id, page]) => ({ nom: `${id} (b) la journée en une tuile`, textes: [page], k: 1 })),
  { nom: 'bureau (a) passage 1', textes: sens.decouper(S, jours.bureau).map(x => x.texte), k: 1 },
  { nom: 'bureau (a) passage 4', textes: sens.decouper(S, jours.bureau).map(x => x.texte), k: 4 },
].slice(0, MAX);

const local = await servir(), b = await chromium.launch({ args: GL }), c = await b.newContext(TELEPHONE), p = await c.newPage(), erreurs = [], dehors = [];
surveiller(p, erreurs, dehors);
const R = { date: new Date().toISOString(), navigateur: b.version(), gl: GL.join(' '), demo: {}, corpus: [] };
try {
  // 1. l’app, en démo : elle peint seule les tuiles proches de l’écran, une à la fois
  const t0 = Date.now();
  await p.goto(local.base + 'chemin/?demo');
  await p.waitForFunction(() => window.chemin?.tuiles?.length, null, { timeout: 120000 });
  R.demo.msOuverture = Date.now() - t0;
  const faites = new Map();
  const etat = () => p.evaluate(() => window.chemin.tuiles.map(u => ({ k: u.k, etat: u.etat, proche: u.proche, source: u.t.dataset.source || '' })));
  let e = await etat();
  while (Date.now() - t0 < DEMO) {
    e = await etat();
    for (const u of e) if (u.etat === 'faite' && !faites.has(u.k)) faites.set(u.k, Date.now() - t0);
    if (!e.some(u => u.proche && ['vide', 'cherche', 'a-peindre', 'peinture'].includes(u.etat)) && faites.size) break;
    await p.waitForTimeout(250);
  }
  const fins = [...faites.values()].sort((x, y) => x - y);
  R.demo.tuiles = e.length; R.demo.proches = e.filter(u => u.proche).length; R.demo.peintes = faites.size; R.demo.finsMs = fins;
  R.demo.intervallesMs = fins.slice(1).map((x, k) => x - fins[k]); // une tuile à la fois : l’écart entre deux fins, le temps d’une tuile
  R.demo.carnet = await p.evaluate(() => new Promise(ok => {
    const r = indexedDB.open('chemin'); r.onerror = () => ok(null);
    r.onsuccess = () => { const q = r.result.transaction('tuiles').objectStore('tuiles').getAll(); q.onsuccess = () => { ok(q.result.map(x => ({ cle: x.cle, octets: x.image.size, type: x.image.type }))); r.result.close(); }; };
  }));
  R.demo.estimation = await p.evaluate(() => navigator.storage.estimate().then(x => ({ usage: x.usage, quota: x.quota, detail: x.usageDetails || null })));

  // 2. un atelier à part, dans la même page : les tuiles des journées inventées, chronométrées étape par étape
  for (const lot of lots) {
    const r = await p.evaluate(async ({ textes, k }) => {
      const { lirePage, candidats, objetsDeLaPage, lieuDeLaPage } = await import('./sens.js?v=3');
      const { Atelier, Modeles, planifier, climatDe, LARGE, HAUT, MARGE } = await import('./monde.js?v=2');
      const { peindreFrise } = await import('../aquarelle.js?v=2');
      const C = window.chemin, S = C.S, F = C.F;
      window.atelierMesure ??= new Atelier(new Modeles('./'), F.parId); // le sien, pour ne pas gêner celui de l’app
      const atelier = window.atelierMesure;
      const out = [{ texte: '', depart: true }, ...textes.map(texte => ({ texte }))], recents = new Map(), decor = new Map(), plans = []; let veille = null;
      out.forEach((x, i) => { // comme calculer() dans app.js
        const lecture = lirePage(S, x.texte), objets = objetsDeLaPage(S, lecture, { recents, jour: i, liste: candidats(S, lecture) });
        for (const o of objets) recents.set(o.objet.id, i);
        const lieu = x.depart ? 'champs' : lieuDeLaPage(lecture, objets, veille?.lieu);
        veille = planifier({ i, date: '2026-10-05', lieu, objets, climat: climatDe(lecture) }, veille, F, decor); veille.objets = objets; plans.push(veille);
      });
      const blob = (cv, type, q) => new Promise(ok => cv.toBlob(ok, type, q));
      const t0 = performance.now(), vue = await atelier.tuile(plans, k), t1 = performance.now();
      const jour = j => { const q = plans[Math.max(0, Math.min(plans.length - 1, j))]; return { x: (j + .5) * LARGE, teinte: q.climat.teinte, ciel: q.climat.ciel }; };
      const peinte = await peindreFrise(vue, { graine: 7, decalage: [k * LARGE - MARGE, 0], jours: [jour(k - 1), jour(k), jour(k + 1)] }), t2 = performance.now();
      const cv = document.createElement('canvas'); cv.width = LARGE; cv.height = HAUT; cv.getContext('2d').drawImage(peinte, MARGE, 0, LARGE, HAUT, 0, 0, LARGE, HAUT);
      for (const x of [peinte, vue.image, vue.silhouette]) x.width = x.height = 0;
      const webp = await blob(cv, 'image/webp', .88), t3 = performance.now(), jpeg = await blob(cv, 'image/jpeg', .9), png = await blob(cv, 'image/png');
      const enB64 = async x => { const a = new Uint8Array(await x.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768)); return btoa(s); };
      const q = plans[k];
      return { lieu: q.lieu, objets: q.objets.map(o => `${o.mot}→${o.objet.noms?.[0] || o.objet.id}`), items: q.items.length, ms3d: t1 - t0, msAquarelle: t2 - t1, msWebp: t3 - t2, msTotal: t3 - t0,
        webp: webp.size, webpType: webp.type, jpeg: jpeg.size, png: png.size, jpegB64: await enB64(jpeg) };
    }, lot);
    const fichier = path.join(IMAGES, `${lot.nom.replace(/[^a-z0-9]+/gi, '-')}.jpg`);
    writeFileSync(fichier, Buffer.from(r.jpegB64, 'base64')); delete r.jpegB64;
    R.corpus.push({ nom: lot.nom, ...r, image: fichier });
    console.log(`${lot.nom} : ${Math.round(r.msTotal)} ms (3D ${Math.round(r.ms3d)}, aquarelle ${Math.round(r.msAquarelle)}, WebP ${Math.round(r.msWebp)}) ; WebP ${Math.round(r.webp / 1024)} Kio, JPEG ${Math.round(r.jpeg / 1024)} Kio, PNG ${Math.round(r.png / 1024)} Kio ; ${r.lieu} : ${r.objets.join(', ')}`);
  }
} finally {
  await b.close(); local.fermer();
}
const tailles = k => { const v = R.corpus.map(x => x[k]).filter(Boolean); return { n: v.length, moyenne: v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null, min: Math.min(...v), max: Math.max(...v) }; };
R.tailles = { webp: tailles('webp'), jpeg: tailles('jpeg'), png: tailles('png') };
const ms = R.corpus.slice(1).map(x => x.msTotal); // sans la première, qui charge aussi les modèles
R.temps = { premiereMs: Math.round(R.corpus[0]?.msTotal || 0), suivantesMoyenneMs: ms.length ? Math.round(ms.reduce((s, x) => s + x, 0) / ms.length) : null };
R.erreurs = erreurs; R.requetesDehors = dehors;
writeFileSync(path.join(ICI, 'peinture.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify({ demo: { ...R.demo, carnet: R.demo.carnet?.map(x => `${Math.round(x.octets / 1024)} Kio ${x.type}`) }, tailles: R.tailles, temps: R.temps, erreurs: erreurs.slice(0, 5), dehors: dehors.slice(0, 5) }, null, 1));
