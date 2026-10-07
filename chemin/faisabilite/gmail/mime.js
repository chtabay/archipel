// Le chemin, Gmail : lire un mail brut (RFC 5322, MIME), une boîte mbox, et l’archive zip de Google Takeout, sur le
// téléphone. Route C : on exporte ses mails envoyés avec Takeout, on choisit le fichier dans le chemin, et tout se lit ici,
// en flux, sans jamais charger l’archive entière en mémoire. Aucune requête réseau.
import { glane } from './extraire.js';

/* ───────── Octets et textes ───────── */

// une « chaîne binaire » : un caractère par octet, pour découper un mail sans se soucier de son encodage
export const octets = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
export const binaire = b => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return s; };
export function decoder(b, charset) {
  const cs = String(charset || 'utf-8').trim().replace(/^"|"$/g, '').toLowerCase();
  let t; try { t = new TextDecoder(cs).decode(b); } catch { t = new TextDecoder('utf-8').decode(b); }
  // un mail qui se dit en UTF-8 et n’en est pas : le plus souvent du Windows-1252
  if (t.includes('�') && /^(utf-?8|us-ascii|ascii)$/.test(cs)) { try { t = new TextDecoder('windows-1252').decode(b); } catch { /* tant pis */ } }
  return t;
}
export const qp = s => s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
export function b64(s) { // base64 ou base64url, vers une chaîne binaire
  s = String(s || '').replace(/[^A-Za-z0-9+/_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  return atob(s + '==='.slice((s.length + 3) % 4));
}
// les mots encodés des en-têtes (RFC 2047) : « =?UTF-8?Q?Pique-nique_=C3=A0_la_rivi=C3=A8re?= »
export const enClair = v => String(v || '').replace(/\?=\s+=\?/g, '?==?')
  .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, e, t) => decoder(octets(e.toUpperCase() === 'B' ? b64(t) : qp(t.replace(/_/g, ' '))), cs.replace(/\*.*$/, '')));
export const parametre = (v, nom) => {
  const m = new RegExp(`(?:^|;)\\s*${nom}\\*?=\\s*(?:"([^"]*)"|([^;\\s]*))`, 'i').exec(v || '');
  return m ? (m[1] ?? m[2]) : null;
};

/* ───────── Un mail ───────── */

function couper(s) { // les en-têtes, le corps ; une partie sans en-têtes commence par une ligne vide
  if (/^\r?\n/.test(s)) return ['', s.replace(/^\r?\n/, '')];
  const m = /\r?\n\r?\n/.exec(s);
  return m ? [s.slice(0, m.index), s.slice(m.index + m[0].length)] : [s, ''];
}
function entetes(bloc) {
  const h = {};
  const t = decoder(octets(bloc), 'utf-8'); // des en-têtes en UTF-8 brut existent (Takeout, SMTPUTF8)
  for (const l of t.replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ').split('\n')) {
    const k = l.indexOf(':'); if (k <= 0) continue;
    const nom = l.slice(0, k).trim().toLowerCase(); if (!(nom in h)) h[nom] = enClair(l.slice(k + 1).trim());
  }
  return h;
}
function parcourir(s, res, profondeur) {
  const [tete, corps] = couper(s), h = entetes(tete);
  if (profondeur === 0) res.entetes = h;
  const ct = h['content-type'] || 'text/plain', type = ct.split(';')[0].trim().toLowerCase();
  res.types.push(type);
  if (type.startsWith('multipart/')) {
    const b = parametre(ct, 'boundary'); if (!b || profondeur > 8) return;
    const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), morceaux = corps.split(new RegExp(`(?:^|\\r?\\n)--${esc}(?:--)?[ \\t]*(?=\\r?\\n|$)`));
    for (const p of morceaux.slice(1)) { const q = p.replace(/^\r?\n/, ''); if (q.trim()) parcourir(q, res, profondeur + 1); }
    return;
  }
  if (type === 'message/rfc822') return; // un mail joint : les mots d’un autre
  if (/^attachment/i.test(h['content-disposition'] || '') || !/^text\/(plain|html)$/.test(type)) return;
  const cte = (h['content-transfer-encoding'] || '').trim().toLowerCase();
  const t = decoder(octets(cte === 'base64' ? b64(corps) : cte === 'quoted-printable' ? qp(corps) : corps), parametre(ct, 'charset'));
  if (type === 'text/html') { if (res.html == null) res.html = t; } else if (res.texte == null) res.texte = t;
}
// brut : une chaîne binaire ou des octets. Rend { entetes, html, texte, types }
export function lireMail(brut) {
  const res = { entetes: {}, html: null, texte: null, types: [] };
  parcourir(typeof brut === 'string' ? brut : binaire(brut), res, 0);
  return res;
}

/* ───────── Une boîte mbox, en flux ───────── */

const DEBUT = [70, 114, 111, 109, 32]; // « From »
const estFrom = l => DEBUT.every((c, i) => l[i] === c);
// flux : ReadableStream d’octets. Rend chaque mail brut, en octets ; au-delà de « limite », la suite d’un mail (ses pièces
// jointes, le plus souvent, après le texte) n’est pas gardée
export async function* lettresMbox(flux, { limite = 4 << 20 } = {}) {
  const lecteur = flux.getReader(), prets = [];
  let morceaux = null, taille = 0, apresVide = true, reste = null;
  const finir = () => { if (morceaux) { const b = new Uint8Array(taille); let o = 0; for (const m of morceaux) { b.set(m, o); o += m.length; } prets.push(b); } };
  const traiter = l => {
    if (apresVide && estFrom(l)) { finir(); morceaux = []; taille = 0; apresVide = false; return; }
    apresVide = l.length <= 2 && (l[0] === 10 || l[0] === 13);
    if (!morceaux || taille >= limite) return;
    if (l[0] === 62) { let k = 0; while (l[k] === 62) k++; if (estFrom(l.subarray(k))) l = l.subarray(1); } // « >From » : mboxrd
    morceaux.push(l); taille += l.length;
  };
  for (;;) {
    const { value, done } = await lecteur.read();
    let buf = value && value.length ? (reste ? concat(reste, value) : value) : reste;
    reste = null;
    if (buf) {
      let a = 0, n;
      while ((n = buf.indexOf(10, a)) >= 0) { traiter(buf.subarray(a, n + 1)); a = n + 1; }
      if (a < buf.length) reste = buf.slice(a);
    }
    if (done) { if (reste) traiter(reste); finir(); yield* prets.splice(0); return; }
    yield* prets.splice(0);
  }
}
const concat = (a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; };

/* ───────── L’archive zip de Takeout, lue par morceaux ───────── */

// fichier : un Blob (un File choisi dans la page). Rend les entrées, sans rien décompresser d’avance ; ZIP64 compris
export async function* entreesZip(fichier) {
  const lire = async (a, n) => new DataView(await fichier.slice(a, a + n).arrayBuffer());
  const debutFin = Math.max(0, fichier.size - 65557), fin = await lire(debutFin, fichier.size - debutFin);
  let e = -1; for (let i = fin.byteLength - 22; i >= 0; i--) if (fin.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ce n’est pas une archive zip');
  let nombre = fin.getUint16(e + 10, true), taille = fin.getUint32(e + 12, true), debut = fin.getUint32(e + 16, true);
  if (nombre === 0xffff || taille === 0xffffffff || debut === 0xffffffff) { // ZIP64 : la vraie fin est plus haut
    const loc = e - 20; if (loc < 0 || fin.getUint32(loc, true) !== 0x07064b50) throw new Error('ZIP64 sans localisateur');
    const f64 = await lire(Number(fin.getBigUint64(loc + 8, true)), 56);
    nombre = Number(f64.getBigUint64(32, true)); taille = Number(f64.getBigUint64(40, true)); debut = Number(f64.getBigUint64(48, true));
  }
  const cd = await lire(debut, taille), utf8 = new TextDecoder();
  for (let p = 0, k = 0; k < nombre && p + 46 <= cd.byteLength; k++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break;
    const methode = cd.getUint16(p + 10, true), nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true);
    let compresse = cd.getUint32(p + 20, true), brut = cd.getUint32(p + 24, true), local = cd.getUint32(p + 42, true);
    const nom = utf8.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nl));
    for (let x = p + 46 + nl; x + 4 <= p + 46 + nl + xl;) { // le champ ZIP64 donne, dans l’ordre, les tailles et l’adresse qui débordent
      const id = cd.getUint16(x, true), l = cd.getUint16(x + 2, true);
      if (id === 1) { let o = x + 4; if (brut === 0xffffffff) { brut = Number(cd.getBigUint64(o, true)); o += 8; } if (compresse === 0xffffffff) { compresse = Number(cd.getBigUint64(o, true)); o += 8; } if (local === 0xffffffff) local = Number(cd.getBigUint64(o, true)); }
      x += 4 + l;
    }
    const c = compresse;
    yield {
      nom, taille: brut,
      async ouvrir() {
        const t = await lire(local, 30); if (t.getUint32(0, true) !== 0x04034b50) throw new Error(`entrée abîmée : ${nom}`);
        const a = local + 30 + t.getUint16(26, true) + t.getUint16(28, true), flux = fichier.slice(a, a + c).stream();
        if (methode === 0) return flux;
        if (methode === 8) return flux.pipeThrough(new DecompressionStream('deflate-raw'));
        throw new Error(`compression inconnue (${methode}) : ${nom}`);
      },
    };
    p += 46 + nl + xl + cl;
  }
}

/* ───────── Takeout : les mails envoyés d’une archive, en glanes ───────── */

const ENVOYES = /^(sent|envoyés|messages envoyés|enviados|gesendet|inviata|posta inviata)$/i, JAMAIS = /^(chat|chats|drafts|brouillons|spam|trash|corbeille)$/i;
// moi : son adresse, pour une boîte sans étiquettes Gmail
export function envoye(m, moi) {
  const etiquettes = (m.entetes['x-gmail-labels'] || '').split(',').map(x => x.trim()).filter(Boolean);
  if (etiquettes.length) return etiquettes.some(x => ENVOYES.test(x)) && !etiquettes.some(x => JAMAIS.test(x));
  return !!moi && (m.entetes.from || '').toLowerCase().includes(moi.toLowerCase());
}
export function glaneDuMail(m, source = 'takeout') {
  const h = m.entetes, id = (h['message-id'] || '').replace(/[<>\s]/g, '') || `${Date.parse(h.date) || 0}-${(h.subject || '').length}`;
  const fil = h['x-gm-thrid'] || (h.references || '').split(/\s+/)[0]?.replace(/[<>]/g, '') || (h['in-reply-to'] || '').replace(/[<>\s]/g, '') || id;
  return glane({ source, id, fil, quand: Date.parse(h.date) || 0, entetes: h, types: m.types, html: m.html, texte: m.texte });
}
// fichier : l’archive zip de Takeout, ou un fichier .mbox. Rend les glanes une à une, et compte ce qu’on a laissé
export async function* depuisTakeout(fichier, { moi, compte = {} } = {}) {
  const tete = new Uint8Array(await fichier.slice(0, 4).arrayBuffer()), zip = tete[0] === 0x50 && tete[1] === 0x4b;
  const boites = [];
  if (zip) { for await (const e of entreesZip(fichier)) if (/\.mbox$/i.test(e.nom)) boites.push(e); } else boites.push({ nom: fichier.name || 'boîte', ouvrir: async () => fichier.stream() });
  Object.assign(compte, { boites: boites.map(b => b.nom), lus: 0, recus: 0, vides: 0, glanes: 0 });
  for (const b of boites) for await (const brut of lettresMbox(await b.ouvrir())) {
    compte.lus++;
    const m = lireMail(brut);
    if (!envoye(m, moi)) { compte.recus++; continue; }
    const g = glaneDuMail(m);
    if (!g) { compte.vides++; continue; }
    compte.glanes++; yield g;
  }
}
