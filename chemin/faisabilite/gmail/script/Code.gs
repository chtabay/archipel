// Fabriqué par fabriquer.js : ne pas modifier à la main.

// ───────── extraire.js ─────────
// Le chemin, Gmail : ne garder que ses propres mots. Un mail envoyé porte souvent, sous ce qu’on vient d’écrire, ce que
// d’autres ont écrit (la réponse citée, le message transféré) et ce qu’on n’écrit pas chaque fois (la signature, « Envoyé
// de mon iPhone »). On garde la part écrite par soi, ce jour-là, et rien de ce qui dit à qui on écrivait.
// Sans DOM ni réseau : la même lecture sert sur le téléphone, dans Node pour l’essai, et dans le script Apps Script de la
// route B (script/), où elle est recopiée telle quelle. Prototype de faisabilité : rien ici n’est branché sur le chemin.

/* ───────── Le HTML d’un mail : on suit les balises, on tait ce qui est cité ───────── */

const SANS_FIN = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const BLOCS = new Set(('address article aside blockquote dd div dl dt figcaption footer h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre ' +
  'section table tbody td tfoot th thead tr ul').split(' '));
const MUETS = new Set('script style head title template noscript svg object iframe blockquote'.split(' '));
// ce que d’autres ont écrit, ou ce qu’on n’écrit pas : la citation, l’en-tête d’un transfert, la signature (Gmail, Thunderbird,
// Yahoo, Proton, Apple Mail)
const CLASSES_TUES = /\b(gmail_quote|gmail_quote_container|gmail_attr|gmail_signature|gmail_signature_prefix|moz-cite-prefix|moz-signature|yahoo_quoted|protonmail_quote|protonmail_signature_block|AppleOriginalContents)\b/i;
const IDS_TUS = /^(Signature|ms-outlook-mobile-signature|x_Signature)$/i;
// Outlook ne met pas la réponse citée dans un bloc : tout ce qui suit son en-tête de réponse est d’un autre
const IDS_FIN = /^(x_)?(divRplyFwdMsg|appendonsend|mail-editor-reference-message-container|OLK_SRC_BODY_SECTION)$/i;
const JETON = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
const attribut = (attrs, nom) => {
  const m = new RegExp(`(?:^|\\s)${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs || '');
  return m ? (m[1] ?? m[2] ?? m[3]) : '';
};
const NOMMEES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«',
  raquo: '»', hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', aacute: 'á', acirc: 'â',
  auml: 'ä', ccedil: 'ç', icirc: 'î', iuml: 'ï', iacute: 'í', ocirc: 'ô', ouml: 'ö', oacute: 'ó', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  uacute: 'ú', ntilde: 'ñ', oelig: 'œ', aelig: 'æ', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Agrave: 'À', Acirc: 'Â', Ccedil: 'Ç', Ocirc: 'Ô',
  OElig: 'Œ', euro: '€', deg: '°', middot: '·', bull: '•', times: '×', copy: '©', reg: '®', trade: '™', shy: '', zwnj: '', zwj: '' };
const entites = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (tout, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return tout; } }
  return NOMMEES[e] ?? NOMMEES[e.toLowerCase()] ?? tout;
});

function motsDuHtml(html) {
  const pile = []; let muet = 0, sortie = '';
  const ligne = () => { if (!muet && sortie && !sortie.endsWith('\n')) sortie += '\n'; };
  for (const m of String(html || '').matchAll(JETON)) {
    const [tout, ferme, brut, attrs] = m;
    if (brut === undefined) { if (!muet && (tout[0] !== '<' || tout === '<')) sortie += entites(tout.replace(/[ \t\r\n\f]+/g, ' ')); continue; }
    const nom = brut.toLowerCase();
    if (ferme) {
      let k = pile.length - 1; while (k >= 0 && pile[k].nom !== nom) k--;
      if (k < 0) continue; // une fermeture sans ouverture : on l’ignore
      while (pile.length > k) if (pile.pop().muet) muet--;
      if (BLOCS.has(nom)) ligne();
      continue;
    }
    if (nom === 'br') { if (!muet) sortie += '\n'; continue; }
    const id = attribut(attrs, 'id');
    if (!muet && IDS_FIN.test(id)) break;
    const tait = MUETS.has(nom) || CLASSES_TUES.test(attribut(attrs, 'class')) || IDS_TUS.test(id) || /signature/i.test(attribut(attrs, 'data-smartmail'));
    if (BLOCS.has(nom)) ligne();
    if (SANS_FIN.has(nom) || /\/\s*$/.test(attrs)) continue;
    pile.push({ nom, muet: tait }); if (tait) muet++;
  }
  return motsDuTexte(sortie);
}

/* ───────── Le texte brut : on coupe où commence ce qu’un autre a écrit ───────── */

const COUPES = [
  /^\s*--\s?$/, // le séparateur de signature
  /^\s*-{2,}\s*(Forwarded message|Message transféré|Message d['’]origine|Original Message|Mensaje reenviado|Weitergeleitete Nachricht|Messaggio inoltrato|Mensagem encaminhada)\s*-*\s*$/i,
  /^\s*(Début du message (réexpédié|transféré)|Begin forwarded message)\s*:?\s*$/i,
  /^\s*_{10,}\s*$/, // Outlook, avant son en-tête de réponse
];
const ECRIT = '(a écrit|wrote|escribió|schrieb|ha scritto|escreveu)\\s*:?\\s*$';
const ATTRIBUTION = new RegExp(`^\\s*(Le|On|El|Am|Il|Em)\\s.{0,200}?${ECRIT}`, 'i'); // « Le lun. 5 oct. 2026 à 18:42, Jeanne <j@x.fr> a écrit : »
const ATTRIBUTION_NUE = new RegExp(`^.{0,120}<[^<>@\\s]+@[^<>\\s]+>\\s*${ECRIT}`, 'i'); // « Jeanne <j@x.fr> a écrit : »
const DE = /^\s*\*?(De|From|Von|Da|Expéditeur)\s*:\*?\s*\S/i, SUITE = /^\s*\*?(Envoyé|Sent|Date|Gesendet|Inviato|À|To|Objet|Subject|Cc)\s*:/i;
const MOBILE = /^(Envoyé|Envoye|Sent|Expédié|Get|Obtenir|Téléchargez)\s.{0,60}?(iPhone|iPad|Android|Outlook|Samsung|Galaxy|mobile|Gmail|smartphone|BlackBerry)\b.{0,40}$/i; // \b ne connaît pas « é »
const attribution = (lignes, i) => {
  const l = lignes[i].trim();
  if (ATTRIBUTION.test(l) && /\d/.test(l)) return true;
  if (ATTRIBUTION_NUE.test(l)) return true;
  // l’attribution coupée en deux ou trois lignes par le retour à la ligne automatique : on ne recolle qu’un début qui a l’air d’en être
  if (!/^(Le|On|El|Am|Il|Em)\s.{0,80}\d/i.test(l) || /[.!?…]\s*$/.test(l)) return false;
  const deux = `${l} ${(lignes[i + 1] || '').trim()}`, trois = `${deux} ${(lignes[i + 2] || '').trim()}`;
  return ATTRIBUTION.test(deux) || ATTRIBUTION.test(trois);
};

function motsDuTexte(texte) {
  const lignes = String(texte || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/[​-‍﻿]/g, '').split('\n');
  const garde = [];
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    if (COUPES.some(re => re.test(l)) || attribution(lignes, i)) break;
    if (DE.test(l) && lignes.slice(i + 1, i + 6).filter(x => SUITE.test(x)).length >= 2) break; // un en-tête « De : … Envoyé : … Objet : »
    if (/^\s*>/.test(l) || MOBILE.test(l.trim())) continue; // une ligne citée, « Envoyé de mon iPhone »
    garde.push(l.replace(/[ \t]+/g, ' ').trimEnd());
  }
  return garde.join('\n').trim().replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n');
}

// le HTML d’abord : ses marques disent mieux où commence la citation ; le texte brut sinon
function motsASoi({ html, texte } = {}) {
  return (html ? motsDuHtml(html) : '') || (texte ? motsDuTexte(texte) : '');
}

/* ───────── Ce qu’on n’a pas écrit soi-même, même envoyé de sa boîte ───────── */

const SUJET_AUTO = /^\s*(réponse automatique|automatic reply|auto(matic)?[ -]?reply|absent|absence|out of (the )?office|accepté|accepted|refusé|declined|provisoirement accepté|tentatively accepted|invitation mise à jour|updated invitation|lu|read|non lu|not read)\s*:/i;
// entetes : { nom en minuscules: valeur } ; types : les types MIME des parties du mail
function automatique(entetes = {}, types = []) {
  const h = n => String(entetes[n] ?? '').trim().toLowerCase();
  if (h('auto-submitted') && h('auto-submitted') !== 'no') return 'auto-submitted';
  if (/auto[_-]?reply|bulk|junk|list/.test(h('precedence')) || h('x-autoreply') || h('x-autorespond')) return 'réponse automatique';
  if (types.some(t => /text\/calendar|message\/disposition-notification|message\/delivery-status/i.test(t))) return 'agenda ou accusé';
  if (SUJET_AUTO.test(entetes.subject || '')) return 'sujet';
  return null;
}
// le sujet n’est à soi que si on ouvre la conversation ; « Re : … » est le sujet d’un autre
const titre = sujet => (!sujet || /^\s*(re|tr|fw|fwd|réf|ref|aw|wg|r|rv|sv|vs)\s*(\[\d+\])?\s*:/i.test(sujet) ? null : sujet.replace(/\s+/g, ' ').trim());

// une glane, comme celles du glaneur du navigateur (navigateur/extension/fond.js) : { id, fil, site, texte, debut, fin }
function glane({ source, id, fil, quand, entetes = {}, types = [], html, texte }) {
  if (automatique(entetes, types)) return null;
  const mots = motsASoi({ html, texte });
  if ((mots.match(/[\p{L}]{2,}/gu) || []).length < 2) return null; // une pièce jointe sans un mot, un « ok »
  const t = Number(quand) || Date.now();
  return { id: `${source}:${id}`, fil: `${source}:${fil || id}`, site: 'mail.google.com', source, titre: titre(entetes.subject), texte: mots, debut: t, fin: t };
}


// ───────── mime.js ─────────
// Le chemin, Gmail : lire un mail brut (RFC 5322, MIME), une boîte mbox, et l’archive zip de Google Takeout, sur le
// téléphone. Route C : on exporte ses mails envoyés avec Takeout, on choisit le fichier dans le chemin, et tout se lit ici,
// en flux, sans jamais charger l’archive entière en mémoire. Aucune requête réseau.

/* ───────── Octets et textes ───────── */

// une « chaîne binaire » : un caractère par octet, pour découper un mail sans se soucier de son encodage
const octets = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const binaire = b => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return s; };
function decoder(b, charset) {
  const cs = String(charset || 'utf-8').trim().replace(/^"|"$/g, '').toLowerCase();
  let t; try { t = new TextDecoder(cs).decode(b); } catch { t = new TextDecoder('utf-8').decode(b); }
  // un mail qui se dit en UTF-8 et n’en est pas : le plus souvent du Windows-1252
  if (t.includes('�') && /^(utf-?8|us-ascii|ascii)$/.test(cs)) { try { t = new TextDecoder('windows-1252').decode(b); } catch { /* tant pis */ } }
  return t;
}
const qp = s => s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
function b64(s) { // base64 ou base64url, vers une chaîne binaire
  s = String(s || '').replace(/[^A-Za-z0-9+/_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  return atob(s + '==='.slice((s.length + 3) % 4));
}
// les mots encodés des en-têtes (RFC 2047) : « =?UTF-8?Q?Pique-nique_=C3=A0_la_rivi=C3=A8re?= »
const enClair = v => String(v || '').replace(/\?=\s+=\?/g, '?==?')
  .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, e, t) => decoder(octets(e.toUpperCase() === 'B' ? b64(t) : qp(t.replace(/_/g, ' '))), cs.replace(/\*.*$/, '')));
const parametre = (v, nom) => {
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
function lireMail(brut) {
  const res = { entetes: {}, html: null, texte: null, types: [] };
  parcourir(typeof brut === 'string' ? brut : binaire(brut), res, 0);
  return res;
}

/* ───────── Une boîte mbox, en flux ───────── */

const DEBUT = [70, 114, 111, 109, 32]; // « From »
const estFrom = l => DEBUT.every((c, i) => l[i] === c);
// flux : ReadableStream d’octets. Rend chaque mail brut, en octets ; au-delà de « limite », la suite d’un mail (ses pièces
// jointes, le plus souvent, après le texte) n’est pas gardée
async function* lettresMbox(flux, { limite = 4 << 20 } = {}) {
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
async function* entreesZip(fichier) {
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
function envoye(m, moi) {
  const etiquettes = (m.entetes['x-gmail-labels'] || '').split(',').map(x => x.trim()).filter(Boolean);
  if (etiquettes.length) return etiquettes.some(x => ENVOYES.test(x)) && !etiquettes.some(x => JAMAIS.test(x));
  return !!moi && (m.entetes.from || '').toLowerCase().includes(moi.toLowerCase());
}
function glaneDuMail(m, source = 'takeout') {
  const h = m.entetes, id = (h['message-id'] || '').replace(/[<>\s]/g, '') || `${Date.parse(h.date) || 0}-${(h.subject || '').length}`;
  const fil = h['x-gm-thrid'] || (h.references || '').split(/\s+/)[0]?.replace(/[<>]/g, '') || (h['in-reply-to'] || '').replace(/[<>\s]/g, '') || id;
  return glane({ source, id, fil, quand: Date.parse(h.date) || 0, entetes: h, types: m.types, html: m.html, texte: m.texte });
}
// fichier : l’archive zip de Takeout, ou un fichier .mbox. Rend les glanes une à une, et compte ce qu’on a laissé
async function* depuisTakeout(fichier, { moi, compte = {} } = {}) {
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


// ───────── gmail.js ─────────
// Le chemin, Gmail : cueillir les mails envoyés du jour, sur le téléphone. Deux chemins pour le même texte :
//  - route A : la page appelle l’API Gmail elle-même (gmail.googleapis.com répond aux pages d’une autre origine, CORS),
//    avec un jeton d’accès court donné par Google Identity Services, gardé en mémoire seulement ;
//  - route B : la page appelle le script Apps Script de la personne (script/), qui lit Gmail pour elle et ne rend que
//    ses propres mots.
// Dans les deux cas le texte va de Google au téléphone, et nulle part ailleurs. Prototype : rien n’est branché sur le chemin.

const LECTURE_SEULE = 'https://www.googleapis.com/auth/gmail.readonly'; // une portée « restreinte » chez Google
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/* ───────── Un message de l’API (format=full) : ses parties de texte ───────── */

// texteDe(data, charset) : data est la partie en base64url (l’API) ou en octets (le service avancé d’Apps Script)
const texteParDefaut = (data, charset) => decoder(typeof data === 'string' ? octets(b64(data)) : Uint8Array.from(data, x => x & 255), charset);
function contenuDuPayload(payload, { texteDe = texteParDefaut } = {}) {
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
function glaneDuMessage(m, options) {
  if ((m.labelIds || []).some(l => l === 'DRAFT' || l === 'CHAT')) return null;
  const c = contenuDuPayload(m.payload, options);
  return glane({ source: 'gmail', id: m.id, fil: m.threadId, quand: Number(m.internalDate), entetes: c.entetes, types: c.types, html: c.html, texte: c.texte });
}

/* ───────── Route A : l’API Gmail, depuis la page ───────── */

// jeton() rend un jeton d’accès ; depuis : en millisecondes (la dernière cueillette, ou minuit) ; rend { glanes, curseur }.
// Coût, en unités de quota Gmail : 5 par page de liste, 20 par message ; la limite est de 6 000 par minute et par personne.
async function cueillirGmail({ jeton, depuis, max = 200, fetch = globalThis.fetch, enParallele = 4 }) {
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
function jetonGoogle({ clientId, scope = LECTURE_SEULE, document = globalThis.document }) {
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
async function cueillirScript({ url, cle, depuis, fetch = globalThis.fetch }) {
  const u = `${url}?k=${encodeURIComponent(cle)}&depuis=${Math.floor(depuis)}`;
  const r = await fetch(u, { redirect: 'follow', credentials: 'omit', cache: 'no-store' });
  if (!r.ok) throw new Error(`script : ${r.status}`);
  const d = await r.json();
  if (d.erreur) throw new Error(`script : ${d.erreur}`);
  return { glanes: d.glanes || [], curseur: d.jusque || depuis };
}


// ───────── script/Code.js ─────────
// Le chemin, route B : un script à soi, dans son propre compte Google (script.google.com). Il lit ses mails envoyés, en
// lecture seule, n’en garde que ses propres mots (la même lecture que sur le téléphone, recopiée au-dessus par fabriquer.js),
// et les rend au chemin quand celui-ci les demande avec la bonne clé. Il ne garde rien : ni copie, ni base, ni journal.
// Le texte va de Gmail à ce script, chez Google, puis au téléphone ; nulle part ailleurs.
//
// Installer (une fois, une dizaine de minutes) :
//  1. script.google.com, nouveau projet ; coller Code.gs (fabriqué par fabriquer.js) et appsscript.json (afficher le
//     fichier manifeste dans les paramètres du projet).
//  2. Lancer une fois installer() : Google montre l’écran « application non validée » (le script est le sien, personne ne
//     l’a vérifié), puis demande « Afficher vos e-mails et vos paramètres ». La clé s’affiche dans le journal.
//  3. Déployer, « Application Web », exécuter en tant que « Moi », accès « Tout le monde » ; donner au chemin l’adresse
//     /exec et la clé. Qui a l’adresse et la clé lit ce que ce script rend : ses propres mots des sept derniers jours.
//  4. Pour tout arrêter : archiver le déploiement, ou relancer installer() pour changer la clé.

const JOURS_MAX = 7, MAX_MAILS = 200;

function installer() {
  const cle = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); // 244 bits de hasard
  PropertiesService.getScriptProperties().setProperty('CLE', cle);
  console.log(`La clé à donner au chemin : ${cle}`);
  return cle;
}

function doGet(e) {
  const p = (e && e.parameter) || {}, cle = PropertiesService.getScriptProperties().getProperty('CLE');
  if (!cle || !memeCle(String(p.k || ''), cle)) return rendre({ erreur: 'clé' }, p.callback);
  const depuis = Math.max(Number(p.depuis) || 0, Date.now() - JOURS_MAX * 864e5);
  const { glanes, jusque } = cueillirIci(depuis);
  return rendre({ glanes, jusque }, p.callback);
}

function cueillirIci(depuis) {
  const q = `in:sent -in:chats after:${Math.floor(depuis / 1000)}`, ids = [];
  let page;
  do {
    const r = Gmail.Users.Messages.list('me', { q, maxResults: 100, pageToken: page });
    for (const m of r.messages || []) ids.push(m.id);
    page = r.nextPageToken;
  } while (page && ids.length < MAX_MAILS);
  const glanes = []; let jusque = depuis;
  for (const id of ids.slice(0, MAX_MAILS)) {
    const m = Gmail.Users.Messages.get('me', id, { format: 'full' }), t = Number(m.internalDate);
    if (!(t > depuis)) continue;
    jusque = Math.max(jusque, t);
    const g = glaneDuMessage(m, { texteDe: texteAppsScript }); if (g) glanes.push(g);
  }
  return { glanes: glanes.sort((a, b) => a.debut - b.debut), jusque };
}

// le service avancé rend les données d’une partie en base64url, ou déjà en octets selon les cas : on accepte les deux
function texteAppsScript(data, charset) {
  const o = typeof data === 'string' ? Utilities.base64DecodeWebSafe(data.replace(/=+$/, '') + '==='.slice((data.replace(/=+$/, '').length + 3) % 4)) : data;
  try { return Utilities.newBlob(o).getDataAsString(charset || 'UTF-8'); } catch (err) { return Utilities.newBlob(o).getDataAsString('UTF-8'); }
}

function memeCle(a, b) { let d = a.length ^ b.length; for (let i = 0; i < b.length; i++) d |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i); return d === 0; }

function rendre(objet, rappel) {
  const json = JSON.stringify(objet);
  if (rappel && /^[A-Za-z_$][\w$]{0,40}$/.test(rappel)) { // JSONP, documenté par Google, si un navigateur refusait la réponse JSON
    return ContentService.createTextOutput(`${rappel}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
