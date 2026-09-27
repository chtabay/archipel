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
  p.on('request', r => { const u = r.url(); if (!u.startsWith(BASE.replace(/\/$/, '')) && !u.startsWith('data:') && !u.startsWith('blob:') && !ARCHIPEL.test(u)) dehors.push(u); }); // l’archipel est simulé à part
};
const sansIntro = () => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); }; // à passer à page.evaluate

// Un faux archipel, en mémoire, qui répond comme le vrai serveur : les tests ne touchent jamais la vraie base.
const ARCHIPEL = /^https:\/\/alvxrjftenialifyktyz\.supabase\.co\/rest\/v1\/rpc\/(\w+)/;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const ESPECES = ['pin', 'nu', 'feuillu', 'fleuri', 'sombre', 'moussue', 'cairn', 'galet', 'pierre', 'cloture', 'volets', 'pont', 'banc', 'maison', 'feu', 'puits', 'champ', 'barque', 'orage', 'pluie', 'fleurs', 'etang', 'caillou'];
const ETATS = ['ferme', 'lueur', 'boucle', 'double', 'pluie', 'mousse', 'fissure', 'caillou', 'clos'];
const entier = (v, a, b) => Number.isInteger(v) && v >= a && v <= b, laCase = c => Array.isArray(c) && c.length === 2 && c.every(v => entier(v, 0, 9));
function formeValide(f) { // les mêmes règles que la base : seulement ce que la 3D dessine
  if (!f || typeof f !== 'object' || Array.isArray(f) || JSON.stringify(f).length > 16000) return false;
  if (Object.keys(f).some(k => !['paysage', 'graine', 'taille', 'climat', 'phare', 'choses'].includes(k))) return false;
  if (!['prairie', 'automne', 'tropique', 'neige', 'lande'].includes(f.paysage) || !['N', 'AS', 'ES', 'AD', 'ED'].includes(f.climat)) return false;
  if (!entier(f.graine, 1, 2147483647) || !entier(f.taille, 1, 100) || (f.phare !== null && f.phare !== undefined && !laCase(f.phare))) return false;
  if (!Array.isArray(f.choses) || f.choses.length > 80) return false;
  return f.choses.every(c => c && typeof c === 'object' && !Object.keys(c).some(k => !['famille', 'espece', 'stade', 'case', 'etats', 'textes', 'v'].includes(k))
    && ['arbre', 'pierre', 'maison', 'culture', 'meteo', 'caillou'].includes(c.famille) && ESPECES.includes(c.espece) && entier(c.stade, 0, 3) && entier(c.textes, 0, 3)
    && typeof c.v === 'number' && c.v >= 0 && c.v <= 1 && laCase(c.case) && Array.isArray(c.etats) && c.etats.length <= 9 && c.etats.every(e => ETATS.includes(e)));
}
function archipelFactice() {
  const etat = { iles: [], rang: 0, appels: [], panne: false, refus: [] };
  const ajouter = (forme, x, z, jeton = null) => { const i = { ile: `${String(++etat.rang).padStart(8, '0')}-0000-4000-8000-000000000000`, ordre: etat.rang, forme, x, z, jeton }; etat.iles.push(i); return i; };
  const repondre = async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const f = req.url().match(ARCHIPEL)[1], c = JSON.parse(req.postData() || '{}');
    etat.appels.push({ f, c, entetes: req.headers(), corps: req.postData() || '' });
    if (etat.panne) return route.abort('internetdisconnected');
    const json = (x, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(x) });
    if (f === 'archipel_lire') return json(etat.iles.filter(i => i.ordre > (c.p_depuis || 0)).sort((a, b) => b.ordre - a.ordre).slice(0, c.p_limite || 60).map(({ jeton, ...i }) => ({ ...i, total: etat.iles.length })));
    if (f === 'archipel_poser') {
      if (!/^[0-9a-f]{64}$/.test(c.p_jeton || '')) return json({ message: 'jeton invalide' }, 400);
      if (!formeValide(c.p_forme)) { etat.refus.push(c.p_forme); return json({ message: 'forme invalide' }, 400); }
      if (c.p_ile) { const i = etat.iles.find(x => x.ile === c.p_ile && x.jeton === c.p_jeton); if (!i) return json({ message: 'île inconnue' }, 400); i.forme = c.p_forme; i.ordre = ++etat.rang; return json([{ ile: i.ile, ordre: i.ordre }]); }
      if (typeof c.p_x !== 'number' || typeof c.p_z !== 'number') return json({ message: 'place invalide' }, 400);
      const i = ajouter(c.p_forme, c.p_x, c.p_z, c.p_jeton); return json([{ ile: i.ile, ordre: i.ordre }]);
    }
    if (f === 'archipel_retirer') { const n = etat.iles.length; etat.iles = etat.iles.filter(x => !(x.ile === c.p_ile && x.jeton === c.p_jeton)); return json(etat.iles.length < n); }
    return json({ message: 'fonction inconnue' }, 404);
  };
  return { etat, ajouter, installer: cible => cible.route(ARCHIPEL, repondre) };
}
// un contexte de navigateur, toujours avec son faux archipel
async function contexte(navigateur, options = TELEPHONE) { const c = await navigateur.newContext(options), a = archipelFactice(); await a.installer(c); c.archipel = a; return c; }
// des îles des autres, pour le faux archipel : inventées dans la page par la même grammaire, réduites à leur forme,
// et placées comme l’app place la sienne : l’eau libre la plus proche de leur sensation, autour de celles déjà là
const formesInventees = (page, n, depart = 0, deja = []) => page.evaluate(async ([n, depart, deja]) => {
  const { archipelInvente, deriver, depuisForme, forme } = await import('./ile.js?v=6'), A = window.archipel;
  const fixes = deja.map((i, k) => ({ d: depuisForme(i.forme, `deja-${k}`), x: i.x, z: i.z }));
  return archipelInvente(depart + n).slice(depart).map(o => { const it = { d: deriver(o.ile) }; A.placeLibre(it, fixes, A.posArch(o.a, o.v)); fixes.push(it); return { forme: forme(it.d), x: it.x, z: it.z }; });
}, [n, depart, deja.map(({ forme, x, z }) => ({ forme, x, z }))]);
const peupler = async (page, archipel, n, depart = 0) => { for (const { forme, x, z } of await formesInventees(page, n, depart, archipel.etat.iles)) archipel.ajouter(forme, x, z); };

module.exports = { BASE, OUT, RACINE, GL, TELEPHONE, verifier, bilan, surveiller, sansIntro, archipelFactice, contexte, formeValide, formesInventees, peupler, ARCHIPEL };
