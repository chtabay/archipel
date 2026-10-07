// Le chemin, Gmail : cueillir les mails envoyés du jour, sur le téléphone. Deux chemins pour le même texte :
//  - route A : la page appelle l’API Gmail elle-même (gmail.googleapis.com répond aux pages d’une autre origine, CORS),
//    avec un jeton d’accès court donné par Google Identity Services, gardé en mémoire seulement ;
//  - route B : la page appelle le script Apps Script de la personne (script/), qui lit Gmail pour elle et ne rend que
//    ses propres mots.
// Dans les deux cas le texte va de Google au téléphone, et nulle part ailleurs. Prototype : rien n’est branché sur le chemin.
import { glane } from './extraire.js';
import { decoder, octets, b64, parametre } from './mime.js';

export const LECTURE_SEULE = 'https://www.googleapis.com/auth/gmail.readonly'; // une portée « restreinte » chez Google
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/* ───────── Un message de l’API (format=full) : ses parties de texte ───────── */

// texteDe(data, charset) : data est la partie en base64url (l’API) ou en octets (le service avancé d’Apps Script)
const texteParDefaut = (data, charset) => decoder(typeof data === 'string' ? octets(b64(data)) : Uint8Array.from(data, x => x & 255), charset);
export function contenuDuPayload(payload, { texteDe = texteParDefaut } = {}) {
  const res = { entetes: {}, html: null, texte: null, types: [] };
  const entetes = p => Object.fromEntries((p.headers || []).map(h => [String(h.name).toLowerCase(), String(h.value)]));
  (function parcourir(p, profondeur) {
    if (!p || profondeur > 8) return;
    const h = entetes(p), type = String(p.mimeType || '').toLowerCase();
    if (!profondeur) res.entetes = h;
    res.types.push(type);
    if (type.startsWith('multipart/')) { for (const q of p.parts || []) parcourir(q, profondeur + 1); return; }
    if (p.filename || /^attachment/i.test(h['content-disposition'] || '') || !/^text\/(plain|html)$/.test(type) || p.body?.data == null) return;
    const t = texteDe(p.body.data, parametre(h['content-type'] || '', 'charset'));
    if (type === 'text/html') { if (res.html == null) res.html = t; } else if (res.texte == null) res.texte = t;
  })(payload, 0);
  return res;
}
export function glaneDuMessage(m, options) {
  if ((m.labelIds || []).some(l => l === 'DRAFT' || l === 'CHAT')) return null;
  const c = contenuDuPayload(m.payload, options);
  return glane({ source: 'gmail', id: m.id, fil: m.threadId, quand: Number(m.internalDate), entetes: c.entetes, types: c.types, html: c.html, texte: c.texte });
}

/* ───────── Route A : l’API Gmail, depuis la page ───────── */

// jeton() rend un jeton d’accès ; depuis : en millisecondes (la dernière cueillette, ou minuit) ; rend { glanes, curseur }.
// Coût, en unités de quota Gmail : 5 par page de liste, 20 par message ; la limite est de 6 000 par minute et par personne.
export async function cueillirGmail({ jeton, depuis, max = 200, fetch = globalThis.fetch, enParallele = 4 }) {
  const appel = async (chemin, essai = 0) => {
    const r = await fetch(`${API}${chemin}`, { headers: { Authorization: `Bearer ${await jeton()}` } });
    if ((r.status === 429 || r.status === 403 || r.status >= 500) && essai < 2) { await new Promise(ok => setTimeout(ok, 500 * 2 ** essai)); return appel(chemin, essai + 1); }
    if (!r.ok) throw Object.assign(new Error(`Gmail : ${r.status}`), { status: r.status });
    return r.json();
  };
  // « after: » en secondes : une date seule serait lue à minuit, heure du Pacifique (doc de l’API, « Filtering »)
  const q = `in:sent -in:chats after:${Math.floor(depuis / 1000)}`, ids = [];
  let page = '';
  do {
    const r = await appel(`/messages?q=${encodeURIComponent(q)}&maxResults=100&fields=${encodeURIComponent('messages(id,threadId),nextPageToken')}${page ? `&pageToken=${page}` : ''}`);
    for (const m of r.messages || []) ids.push(m.id);
    page = r.nextPageToken || '';
  } while (page && ids.length < max);
  const glanes = []; let curseur = depuis, k = 0;
  const ouvrier = async () => {
    while (k < Math.min(ids.length, max)) {
      const m = await appel(`/messages/${ids[k++]}?format=full&fields=${encodeURIComponent('id,threadId,internalDate,labelIds,payload')}`);
      const t = Number(m.internalDate); if (!(t > depuis)) continue; // « after: » arrondit à la seconde
      curseur = Math.max(curseur, t);
      const g = glaneDuMessage(m); if (g) glanes.push(g);
    }
  };
  await Promise.all(Array.from({ length: enParallele }, ouvrier));
  return { glanes: glanes.sort((a, b) => a.debut - b.debut), curseur };
}

// Le jeton, par Google Identity Services, modèle « jeton » : pas de jeton de rafraîchissement, une durée d’environ une heure,
// et un nouveau jeton seulement sur un geste (un toucher). prompt: '' : l’accord n’est demandé que la première fois.
// Le jeton reste en mémoire, jamais sur le disque.
export function jetonGoogle({ clientId, scope = LECTURE_SEULE, document = globalThis.document }) {
  let client = null, courant = null;
  const pret = new Promise((ok, ko) => {
    const fin = () => { client = globalThis.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope, prompt: '', callback: () => {} }); ok(); };
    if (globalThis.google?.accounts?.oauth2) { fin(); return; }
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = fin; s.onerror = () => ko(new Error('Google Identity Services ne s’est pas chargé')); document.head.append(s);
  });
  return {
    pret, // à attendre au chargement de la page : dans le geste, plus rien ne doit être attendu avant requestAccessToken
    valide: () => !!courant && courant.fin > Date.now() + 60e3,
    jeton: () => courant && courant.fin > Date.now() ? Promise.resolve(courant.jeton) : Promise.reject(Object.assign(new Error('un toucher, d’abord'), { geste: true })),
    demander() { // dans le gestionnaire du toucher, sans rien attendre avant
      if (courant && courant.fin > Date.now() + 60e3) return Promise.resolve(courant.jeton);
      return new Promise((ok, ko) => {
        client.callback = r => { if (r.error) { ko(new Error(r.error)); return; } courant = { jeton: r.access_token, fin: Date.now() + Number(r.expires_in) * 1e3 }; ok(r.access_token); };
        client.error_callback = e => ko(new Error(e?.type || 'fenêtre fermée'));
        client.requestAccessToken({ prompt: '' });
      });
    },
    oublier() { if (courant) globalThis.google?.accounts.oauth2.revoke(courant.jeton, () => {}); courant = null; },
  };
}

/* ───────── Route B : le script à soi ───────── */

// url : l’adresse /exec du script, déployé « exécuter en tant que moi », accès « tout le monde » ; cle : le secret partagé
// avec lui, gardé dans le carnet. Une requête GET simple, sans en-tête : pas de requête préalable (preflight).
export async function cueillirScript({ url, cle, depuis, fetch = globalThis.fetch }) {
  const u = `${url}?k=${encodeURIComponent(cle)}&depuis=${Math.floor(depuis)}`;
  const r = await fetch(u, { redirect: 'follow', credentials: 'omit', cache: 'no-store' });
  if (!r.ok) throw new Error(`script : ${r.status}`);
  const d = await r.json();
  if (d.erreur) throw new Error(`script : ${d.erreur}`);
  return { glanes: d.glanes || [], curseur: d.jusque || depuis };
}
