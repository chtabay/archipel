// Le chemin, Gmail : les mails envoyés, lus par la page elle-même avec l’API Gmail, pour un site statique (GitHub Pages),
// sans serveur. Le téléphone demande un jeton d’accès à Google (Google Identity Services, modèle « jeton »), appelle
// gmail.googleapis.com directement (l’API répond aux pages d’autres origines : CORS, avec une requête préalable OPTIONS),
// et lit chaque mail ici avec extraire.js. Le texte va de Google au téléphone, et nulle part ailleurs ; le jeton reste en
// mémoire, jamais sur le disque. Prototype de faisabilité : rien ici n’est branché sur le chemin.
//
// Ce qui a été vérifié sur developers.google.com (octobre 2026) :
//  - users.messages.list : GET https://gmail.googleapis.com/gmail/v1/users/{userId}/messages, paramètres q, maxResults
//    (100 par défaut, 500 au plus), pageToken, labelIds[], includeSpamTrash ; réponse { messages: [{ id, threadId }],
//    nextPageToken, resultSizeEstimate } ;
//  - users.messages.get : GET …/messages/{id}?format=minimal|full|raw|metadata ; full rend payload (MessagePart :
//    partId, mimeType, filename, headers [{ name, value }], body { attachmentId, size, data en base64url }, parts) ;
//    raw rend raw, le mail entier en base64url ; internalDate en millisecondes ;
//  - users.messages.attachments.get : GET …/messages/{messageId}/attachments/{id} → MessagePartBody ;
//  - les dates de q sont lues à minuit, heure du Pacifique : on passe after: en secondes (guide « Filtering ») ;
//  - quotas : 5 unités par list, 20 par get, 20 par attachments.get ; 6 000 unités par minute et par personne ;
//  - gmail.readonly est une portée « restreinte » ;
//  - GIS : initTokenClient({ client_id, scope, callback, error_callback, prompt, login_hint }), requestAccessToken(),
//    hasGrantedAllScopes(), revoke() ; prompt '' : l’accord n’est demandé que la première fois ; un geste de la personne
//    déclenche la demande.
import { extraire, pagesParJour } from './extraire.js';

export const PORTEE_GMAIL = 'https://www.googleapis.com/auth/gmail.readonly';
export const SCRIPT_GIS = 'https://accounts.google.com/gsi/client';
const RACINE = 'https://gmail.googleapis.com/gmail/v1/users/me';
export const UNITES = { list: 5, get: 20, attachment: 20 };

/* ───────── Le jeton : Google Identity Services, modèle « jeton » ───────── */

// charger la bibliothèque GIS (une seule fois) ; à faire au chargement de la page, pas dans le geste
export function chargerGis({ document = globalThis.document } = {}) {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve(globalThis.google);
  return new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = SCRIPT_GIS; s.async = true;
    s.onload = () => ok(globalThis.google); s.onerror = () => ko(new Error('Google Identity Services ne s’est pas chargé'));
    document.head.append(s);
  });
}
// demander() s’appelle dans le gestionnaire d’un toucher, sans rien attendre avant (sinon la fenêtre de Google est
// bloquée) ; il rend le jeton. Pas de jeton de rafraîchissement dans ce modèle : quand il expire (expires_in), il faut un
// nouveau geste. La personne peut décocher Gmail dans la fenêtre d’accord : on le vérifie (hasGrantedAllScopes).
export function clientJeton({ clientId, google = globalThis.google, portee = PORTEE_GMAIL, indice = undefined, maintenant = () => Date.now() }) {
  let courant = null, attente = null;
  const finir = (f, x) => { const a = attente; attente = null; a?.[f](x); };
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId, scope: portee, prompt: '', login_hint: indice, include_granted_scopes: false,
    callback: r => {
      if (r.error) return finir('ko', Object.assign(new Error(`Google : ${r.error}`), { code: r.error }));
      if (!google.accounts.oauth2.hasGrantedAllScopes(r, portee)) return finir('ko', Object.assign(new Error('l’accès à Gmail n’a pas été accordé'), { code: 'portee' }));
      courant = { jeton: r.access_token, fin: maintenant() + Number(r.expires_in || 0) * 1e3 };
      finir('ok', courant.jeton);
    },
    error_callback: e => finir('ko', Object.assign(new Error(`fenêtre de Google : ${e?.type || 'erreur'}`), { code: e?.type || 'unknown' })),
  });
  return {
    valide: () => !!courant && courant.fin - 60e3 > maintenant(),
    jeton: () => (courant && courant.fin - 60e3 > maintenant() ? courant.jeton : null),
    demander() {
      if (courant && courant.fin - 60e3 > maintenant()) return Promise.resolve(courant.jeton);
      return new Promise((ok, ko) => { attente = { ok, ko }; client.requestAccessToken(); });
    },
    oublier() { if (courant) google.accounts.oauth2.revoke(courant.jeton, () => {}); courant = null; },
  };
}

/* ───────── Les appels ───────── */

const enSecondes = d => Math.floor((d instanceof Date ? d.getTime() : Number(d)) / 1000);
// un appel, avec deux reprises pour 429 et 5xx (et 403 de débit), en attendant de plus en plus. 401 : le jeton a expiré,
// la page doit en redemander un dans un geste
async function appeler(chemin, { jeton, fetch, attendre, compte, debit, unites }) {
  for (let essai = 0; ; essai++) {
    await debit(unites, attendre);
    const r = await fetch(`${RACINE}${chemin}`, { headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json' } });
    compte.requetes++; compte.unites += unites;
    if (r.ok) return r.json();
    const corps = await r.text().catch(() => '');
    if (r.status === 401) throw Object.assign(new Error('Gmail : jeton refusé ou expiré, il faut un nouveau toucher'), { status: 401, code: 'jeton' });
    const tropVite = r.status === 429 || r.status >= 500 || (r.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(corps));
    if (tropVite && essai < 2) { compte.reprises++; await attendre(500 * 2 ** essai + Math.floor(Math.random() * 250)); continue; }
    throw Object.assign(new Error(`Gmail : ${r.status}`), { status: r.status, corps });
  }
}
// le débit : un seau de jetons partagé par tous les appels d’une cueillette. budget : unités par minute (Google en permet
// 6 000 par personne ; on reste en dessous) ; un quart du budget peut partir d’un coup, le reste au rythme du budget
export function seau(budget = 5000, maintenant = () => Date.now()) {
  let jetons = budget / 4, t = maintenant();
  return async (unites, attendre) => {
    const n = maintenant(); jetons = Math.min(budget / 4, jetons + (n - t) * budget / 60e3); t = n;
    jetons -= unites;
    if (jetons < 0) await attendre(Math.ceil(-jetons * 60e3 / budget));
  };
}
const contexte = o => ({ fetch: o.fetch || globalThis.fetch.bind(globalThis), attendre: o.attendre || (ms => new Promise(f => setTimeout(f, ms))), jeton: o.jeton,
  compte: o.compte || { requetes: 0, unites: 0, reprises: 0 }, debit: o.debit || seau(o.budget, o.maintenant) });

// les identifiants des mails envoyés depuis un instant (et jusqu’à un autre), page après page, les plus récents d’abord
export async function listerEnvoyes({ depuis, jusqua = null, parPage = 100, max = 1000, ...o }) {
  const c = contexte(o), q = `in:sent after:${enSecondes(depuis)}${jusqua != null ? ` before:${enSecondes(jusqua)}` : ''}`, ids = [];
  let page = '';
  do {
    const r = await appeler(`/messages?q=${encodeURIComponent(q)}&maxResults=${parPage}${page ? `&pageToken=${encodeURIComponent(page)}` : ''}` +
      `&fields=${encodeURIComponent('messages(id,threadId),nextPageToken,resultSizeEstimate')}`, { ...c, unites: UNITES.list });
    for (const m of r.messages || []) ids.push(m.id);
    page = r.nextPageToken || '';
  } while (page && ids.length < max);
  return ids.slice(0, max);
}
// un message. format 'full' (défaut) : les parties déjà découpées par Google, sans télécharger les pièces jointes ; une
// partie de texte qui n’a qu’un attachmentId est cherchée à part. format 'raw' : le mail entier, pièces jointes comprises
export async function lireMessage({ id, format = 'full', ...o }) {
  const c = contexte(o), champs = format === 'raw' ? 'id,threadId,labelIds,internalDate,raw' : 'id,threadId,labelIds,internalDate,payload';
  const m = await appeler(`/messages/${encodeURIComponent(id)}?format=${format}&fields=${encodeURIComponent(champs)}`, { ...c, unites: UNITES.get });
  if (format !== 'raw' && m.payload) {
    const manquent = [];
    (function chercher(p) {
      if (/^text\/(plain|html)$/i.test(p.mimeType || '') && !p.filename && p.body?.attachmentId && p.body.data == null) manquent.push(p);
      for (const q of p.parts || []) chercher(q);
    })(m.payload);
    for (const p of manquent) {
      const b = await appeler(`/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(p.body.attachmentId)}?fields=${encodeURIComponent('size,data')}`, { ...c, unites: UNITES.attachment });
      p.body = { ...p.body, data: b.data, size: b.size };
    }
  }
  return m;
}

// tout le trajet : les mails envoyés depuis « depuis » → les pages du chemin. parallele : quelques lectures à la fois ; le
// seau garde la cadence sous le budget (un mail coûte 20 unités : à 5 000 unités par minute, 250 mails par minute, les 62
// premiers d’un coup)
export async function cueillir({ depuis, jusqua = null, format = 'full', parallele = 4, fuseau = null, preferer = 'texte', sujets = true, salutation = false, max = 500, ...o }) {
  const c = contexte(o), ids = await listerEnvoyes({ ...o, ...c, depuis, jusqua, max });
  const extraits = [], ignores = {}; let k = 0;
  const debut = depuis instanceof Date ? depuis.getTime() : Number(depuis);
  const ouvrier = async () => {
    while (k < ids.length) {
      const m = await lireMessage({ ...o, ...c, id: ids[k++], format });
      if (Number(m.internalDate) < debut) continue; // after: arrondit à la seconde
      const x = extraire(m, { fuseau, preferer, salutation });
      if (x.ignore) { ignores[x.ignore] = (ignores[x.ignore] || 0) + 1; continue; }
      extraits.push(x);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, parallele) }, ouvrier));
  return { pages: pagesParJour(extraits, { sujets }), extraits, compte: { ...c.compte, messages: ids.length, extraits: extraits.length, ignores } };
}
