// Le chemin, Gmail : une boîte mbox de Google Takeout, lue en flux, sur le téléphone. On choisit dans la page le fichier
// « Messages envoyés.mbox » (ou toute la boîte) ; il se lit morceau par morceau, sans jamais tenir en mémoire, et sans
// requête réseau. On ne garde que les mails envoyés par la personne, et d’eux, que ses propres mots, rangés par jour en
// pages prêtes pour le chemin : [{ date: 'AAAA-MM-JJ', texte }].
//
// Le format : chaque mail commence par une ligne « From_ » (« From 1781234567890123456@xxx Tue Oct 06 06:12:00 +0000
// 2026 ») ; une ligne du corps qui commençait par « From » a reçu un « > » de plus (mboxrd : « >From », « >>From »…), qu’on
// retire. Les étiquettes Gmail sont dans l’en-tête X-Gmail-Labels (« Messages envoyés,Ouvert »), séparées de virgules.
// Prototype de faisabilité : rien ici n’est branché sur le chemin.
import { extraire, decoderEntete, adresseDe, pagesParJour } from './extraire.js';

export { pagesParJour };

// la ligne From_ d’un vrai séparateur : une adresse (ou un identifiant), puis une date asctime
// (« From MAILER-DAEMON Fri Jul  8 12:08:34 2011 », « From - Tue Oct 06 10:00:00 2026 », Takeout avec « +0000 »). Une ligne
// « From … » d’un corps mal échappé (mboxo) ne coupe donc pas le mail, même après une ligne vide
const FROM_STRICT = /^From \S+ +(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) +(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) +\d{1,2} +\d{1,2}:\d{2}(?::\d{2})?(?: +(?:[+-]\d{4}|[A-Z]{2,5}))? +\d{4}\s*$/;
const MOIS_FROM = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// l’instant de la ligne From_ : le repli d’un mail sans en-tête Date
export function instantFrom(ligne) {
  const m = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) +(\d{1,2}) +(\d{1,2}):(\d{2})(?::(\d{2}))?(?: +([+-])(\d{2})(\d{2}))? +(\d{4})/.exec(ligne || '');
  if (!m) return null;
  const decalage = m[6] ? (m[6] === '-' ? -1 : 1) * (Number(m[7]) * 60 + Number(m[8])) : 0;
  return Date.UTC(Number(m[9]), MOIS_FROM[m[1]], Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5] || 0)) - decalage * 60e3;
}

// des en-têtes vite lus, pour décider avant de garder le corps : { nom en minuscules: valeur décodée } (la première)
function entetesRapides(lignes) {
  const h = {}; let nom = null, val = '';
  const fin = () => { if (nom && !(nom in h)) h[nom] = decoderEntete(val); nom = null; };
  for (const l of lignes) {
    const s = l.replace(/\r?\n$/, '');
    if (/^[ \t]/.test(s)) { if (nom) val += ' ' + s.trim(); continue; }
    fin(); const k = s.indexOf(':'); if (k > 0) { nom = s.slice(0, k).trim().toLowerCase(); val = s.slice(k + 1).trim(); }
  }
  fin(); return h;
}

/* ───────── Le lecteur, morceau par morceau ───────── */

// garder(entetes, ligneFrom) décide, dès la fin des en-têtes, si le corps vaut d’être gardé : sinon il est sauté ligne à
// ligne sans être retenu (un mail reçu ne laisse rien en mémoire). limite : au-delà, la fin d’un mail (ses pièces jointes,
// le plus souvent, après le texte) n’est pas gardée.
// pousser(morceau) prend des octets (Uint8Array, ArrayBuffer) ou une chaîne binaire, et rend les mails finis :
// [{ ligneFrom, brut (chaîne binaire, prête pour extraire), entetes, tronque }] ; finir() rend le dernier.
export class LecteurMbox {
  constructor({ garder = null, limite = 8 << 20 } = {}) {
    this.garder = garder; this.limite = limite; this.reste = ''; this.courant = null; this.premiere = true;
    this.compte = { mails: 0, gardes: 0, sautes: 0, octetsSautes: 0, tronques: 0 };
  }
  pousser(morceau) {
    const s = this.reste + versBinaire(morceau), sortie = [];
    let a = 0;
    for (let n = s.indexOf('\n'); n >= 0; n = s.indexOf('\n', a)) { this.ligne(s.slice(a, n + 1), sortie); a = n + 1; }
    this.reste = s.slice(a);
    return sortie;
  }
  finir() {
    const sortie = [];
    if (this.reste) { this.ligne(this.reste, sortie); this.reste = ''; }
    this.clore(sortie); return sortie;
  }
  ligne(l, sortie) {
    const nue = l.replace(/\r?\n$/, '');
    if (nue.startsWith('From ') && (this.premiere || FROM_STRICT.test(nue))) {
      this.clore(sortie);
      this.courant = { ligneFrom: nue, tete: [], corps: [], enTete: true, garde: null, taille: 0, tronque: false };
      this.compte.mails++; this.premiere = false; return;
    }
    this.premiere = false;
    const c = this.courant; if (!c) return; // du texte avant le premier From_ : ce n’est pas une boîte, ou son début manque
    if (c.garde === false) { this.compte.octetsSautes += l.length; return; }
    if (/^>+From /.test(l)) l = l.slice(1); // mboxrd
    if (c.enTete) {
      if (nue !== '') { c.tete.push(l); return; }
      c.enTete = false; this.decider(c, l); return;
    }
    if (c.taille > this.limite) { c.tronque = true; return; }
    c.corps.push(l); c.taille += l.length;
  }
  decider(c, blanc = '') { // à la fin des en-têtes : on garde le mail, ou on saute son corps
    c.entetes = entetesRapides(c.tete);
    c.garde = this.garder ? !!this.garder(c.entetes, c.ligneFrom) : true;
    if (!c.garde) { this.compte.sautes++; c.tete = []; return; }
    c.corps.push(...c.tete.splice(0)); if (blanc) c.corps.push(blanc);
    c.taille = c.corps.reduce((n, x) => n + x.length, 0);
  }
  clore(sortie) {
    const c = this.courant; this.courant = null;
    if (!c) return;
    if (c.enTete) this.decider(c); // un mail sans corps
    if (!c.garde) return;
    if (c.corps.length && /^\r?\n$/.test(c.corps[c.corps.length - 1])) c.corps.pop(); // la ligne vide avant le From_ suivant est au format, pas au mail
    if (c.tronque) this.compte.tronques++;
    this.compte.gardes++;
    sortie.push({ ligneFrom: c.ligneFrom, brut: c.corps.join(''), entetes: c.entetes, tronque: c.tronque });
  }
}
function versBinaire(x) {
  if (typeof x === 'string') return x;
  const b = x instanceof Uint8Array ? x : ArrayBuffer.isView(x) ? new Uint8Array(x.buffer, x.byteOffset, x.byteLength) : new Uint8Array(x);
  let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return s;
}

// les morceaux d’une source : un File ou un Blob (sa méthode stream), un ReadableStream, un itérable asynchrone (un flux de
// Node), ou tout d’un bloc (chaîne, octets)
export async function* morceauxDe(source) {
  if (source == null) return;
  if (typeof source === 'string' || source instanceof ArrayBuffer || ArrayBuffer.isView(source)) { yield source; return; }
  if (typeof source.getReader !== 'function' && typeof source.stream === 'function') source = source.stream();
  if (typeof source.getReader === 'function') { // Safari n’itère pas encore tous les ReadableStream : on lit à la main
    const lecteur = source.getReader();
    try { for (;;) { const { value, done } = await lecteur.read(); if (done) return; yield value; } } finally { lecteur.releaseLock?.(); }
  }
  if (source[Symbol.asyncIterator] || source[Symbol.iterator]) { for await (const x of source) yield x; return; }
  throw new TypeError('mbox : source illisible');
}
export async function* lettres(source, options) {
  const lecteur = options instanceof LecteurMbox ? options : new LecteurMbox(options);
  for await (const morceau of morceauxDe(source)) yield* lecteur.pousser(morceau);
  yield* lecteur.finir();
}

/* ───────── Les mails envoyés par la personne ───────── */

// les étiquettes Gmail, en CSV (une étiquette à soi peut contenir une virgule, entre guillemets) ; les noms des étiquettes
// système suivent la langue du compte
export function etiquettes(valeur) {
  const out = []; let cur = '', guill = false;
  for (const ch of String(valeur || '')) {
    if (ch === '"') guill = !guill; else if (ch === ',' && !guill) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim()); return out.filter(Boolean);
}
const ENVOYES = /^(sent|sent mail|sent messages|envoyés|messages envoyés|enviados|gesendet|inviati|posta inviata|verzonden)$/i;
const JAMAIS = /^(drafts?|brouillons?|chats?|spam|trash|bin|corbeille)$/i;
// moi : son adresse, ou ses adresses (alias compris)
export function estEnvoye(entetes, { moi = [] } = {}) {
  const e = etiquettes(entetes['x-gmail-labels']);
  if (e.some(x => JAMAIS.test(x))) return false; // un brouillon, une discussion, la corbeille, le spam
  if (e.some(x => ENVOYES.test(x))) return true;
  const de = adresseDe(entetes.from)?.adresse, mes = [].concat(moi || []).map(x => String(x).toLowerCase());
  return !!de && mes.includes(de);
}

// tout le trajet : une boîte → ses pages. compte dit ce qu’on a lu, gardé, laissé, et pourquoi
export async function depuisMbox(source, { moi = [], fuseau = null, preferer = 'texte', sujets = true, limite } = {}) {
  const compte = { mails: 0, envoyes: 0, recus: 0, ignores: {}, extraits: 0, tronques: 0, octetsSautes: 0 };
  const lecteur = new LecteurMbox({ limite, garder: h => { const ok = estEnvoye(h, { moi }); compte[ok ? 'envoyes' : 'recus']++; return ok; } });
  const extraits = [];
  for await (const m of lettres(source, lecteur)) {
    const x = extraire(m.brut, { fuseau, preferer, repli: instantFrom(m.ligneFrom) });
    if (x.ignore) { compte.ignores[x.ignore] = (compte.ignores[x.ignore] || 0) + 1; continue; }
    compte.extraits++; extraits.push(x);
  }
  Object.assign(compte, { mails: lecteur.compte.mails, tronques: lecteur.compte.tronques, octetsSautes: lecteur.compte.octetsSautes });
  return { pages: pagesParJour(extraits, { sujets }), extraits, compte };
}
