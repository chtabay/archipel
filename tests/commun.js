// L’archipel : ce que les tests partagent. Chromium avec la 3D logicielle, un téléphone, le compte des vérifications,
// et la surveillance des erreurs et des requêtes vers l’extérieur.
const path = require('path'), os = require('os'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:8123/'; // le site, servi depuis la racine du dépôt
const OUT = process.env.CAPTURES || path.join(os.tmpdir(), 'archipel-captures'); // les captures, pour regarder après coup
fs.mkdirSync(OUT, { recursive: true });
const RACINE = path.join(__dirname, '..');
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']; // la 3D, sans carte graphique
const TELEPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

let echecs = 0, total = 0;
const verifier = (ok, quoi) => { total++; console.log(`${ok ? 'ok  ' : 'ÉCHEC'} · ${quoi}`); if (!ok) echecs++; };
const bilan = () => { console.log(echecs ? `\n${echecs} échec(s) sur ${total}` : `\ntout est bon (${total})`); process.exitCode = echecs ? 1 : 0; };
const surveiller = (p, erreurs, dehors) => {
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => erreurs.push(`[pageerror] ${e.message}`));
  p.on('request', r => { const u = r.url(); if (!u.startsWith(BASE.replace(/\/$/, '')) && !u.startsWith('data:') && !u.startsWith('blob:')) dehors.push(u); });
};
const sansIntro = () => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); }; // à passer à page.evaluate

module.exports = { BASE, OUT, RACINE, GL, TELEPHONE, verifier, bilan, surveiller, sansIntro };
