// Le chemin, Gmail : ne garder que ses propres mots. Un mail envoyé porte souvent, sous ce qu’on vient d’écrire, ce que
// d’autres ont écrit (la réponse citée, le message transféré) et ce qu’on n’écrit pas chaque fois (la signature, la formule
// de politesse, « Envoyé de mon iPhone », l’avertissement juridique). On garde la part écrite par soi, et son jour.
//
// extraire(entrée) prend un mail brut (RFC 5322 et MIME : chaîne binaire, octets, ou texte) ou un message de l’API Gmail
// (users.messages.get, format=full ou format=raw), et rend { date: 'AAAA-MM-JJ', texte, … } : le jour local de l’en-tête
// Date, et les seuls mots de la personne. Sans DOM, sans réseau, sans dépendance : la même lecture sert dans la page (le
// téléphone), dans Node pour l’essai, et dans le script Apps Script de la route B (script/), qui recopie ce fichier.
//
// Deux étages. Le premier (motsDuHtml, motsDuTexte, glane…) vient du premier prototype et ne change pas : mime.js, gmail.js
// et essai/essai.js s’en servent. Le second (plus bas) lit le MIME lui-même, préfère text/plain, et nettoie davantage.
// Prototype de faisabilité : rien ici n’est branché sur le chemin.

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

export function motsDuHtml(html) {
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

export function motsDuTexte(texte) {
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
export function motsASoi({ html, texte } = {}) {
  return (html ? motsDuHtml(html) : '') || (texte ? motsDuTexte(texte) : '');
}

/* ───────── Ce qu’on n’a pas écrit soi-même, même envoyé de sa boîte ───────── */

const SUJET_AUTO = /^\s*(réponse automatique|automatic reply|auto(matic)?[ -]?reply|absent|absence|out of (the )?office|accepté|accepted|refusé|declined|provisoirement accepté|tentatively accepted|invitation mise à jour|updated invitation|lu|read|non lu|not read)\s*:/i;
// entetes : { nom en minuscules: valeur } ; types : les types MIME des parties du mail
export function automatique(entetes = {}, types = []) {
  const h = n => String(entetes[n] ?? '').trim().toLowerCase();
  if (h('auto-submitted') && h('auto-submitted') !== 'no') return 'auto-submitted';
  if (/auto[_-]?reply|bulk|junk|list/.test(h('precedence')) || h('x-autoreply') || h('x-autorespond')) return 'réponse automatique';
  if (types.some(t => /text\/calendar|message\/disposition-notification|message\/delivery-status/i.test(t))) return 'agenda ou accusé';
  if (SUJET_AUTO.test(entetes.subject || '')) return 'sujet';
  return null;
}
// le sujet n’est à soi que si on ouvre la conversation ; « Re : … » est le sujet d’un autre
export const titre = sujet => (!sujet || /^\s*(re|tr|fw|fwd|réf|ref|aw|wg|r|rv|sv|vs)\s*(\[\d+\])?\s*:/i.test(sujet) ? null : sujet.replace(/\s+/g, ' ').trim());

// une glane, comme celles du glaneur du navigateur (navigateur/extension/fond.js) : { id, fil, site, texte, debut, fin }
export function glane({ source, id, fil, quand, entetes = {}, types = [], html, texte }) {
  if (automatique(entetes, types)) return null;
  const mots = motsASoi({ html, texte });
  if ((mots.match(/[\p{L}]{2,}/gu) || []).length < 2) return null; // une pièce jointe sans un mot, un « ok »
  const t = Number(quand) || Date.now();
  return { id: `${source}:${id}`, fil: `${source}:${fil || id}`, site: 'mail.google.com', source, titre: titre(entetes.subject), texte: mots, debut: t, fin: t };
}

/* ═════════ Second étage : un mail entier, du MIME brut ou de l’API Gmail, jusqu’aux mots à soi ═════════ */
// Rien ici ne s’exécute au chargement hors des expressions régulières et d’une table : ni TextDecoder ni Intl, que le
// script Apps Script (route B) n’a pas tous ; on ne les appelle qu’au moment de lire.

/* ───────── Octets, base64, quoted-printable, jeux de caractères ───────── */

// une « chaîne binaire » : un caractère par octet. On découpe le mail ainsi, sans se soucier de ses jeux de caractères,
// et on ne décode qu’au bout, partie par partie
export function enBinaire(x) {
  if (x == null) return '';
  if (typeof x === 'string') return /[^\x00-\xff]/.test(x) ? enBinaire(new TextEncoder().encode(x)) : x; // un texte déjà décodé : ses octets UTF-8
  const b = x instanceof Uint8Array ? x : ArrayBuffer.isView(x) ? new Uint8Array(x.buffer, x.byteOffset, x.byteLength) : new Uint8Array(x);
  let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return s;
}
const versOctets = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const TABLE64 = (() => { const t = new Int16Array(256).fill(-1), a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; for (let i = 0; i < 64; i++) t[a.charCodeAt(i)] = i; t[45] = 62; t[95] = 63; return t; })();
// base64 ou base64url (l’API Gmail), vers une chaîne binaire ; les retours à la ligne et le bourrage sont ignorés
export function deBase64(s) {
  s = String(s || ''); const out = []; let acc = 0, n = 0, bloc = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i), v = c < 256 ? TABLE64[c] : -1; if (v < 0) continue;
    acc = ((acc << 6) | v) & 0xffffff; n += 6;
    if (n >= 8) { n -= 8; bloc += String.fromCharCode((acc >> n) & 255); if (bloc.length >= 0x4000) { out.push(bloc); bloc = ''; } }
  }
  out.push(bloc); return out.join('');
}
// quoted-printable (RFC 2045) : les blancs de fin de ligne sont du bourrage, « = » en fin de ligne est une coupure douce
export const deQuotedPrintable = s => String(s || '').replace(/[ \t]+(?=\r?\n|$)/g, '').replace(/=\r?\n/g, '')
  .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
// Node 22.13 et suivants (et 20.18.3+) décodent windows-1252 comme de l’ISO-8859-1 strict : 0x80–0x9F y deviennent des
// caractères de contrôle au lieu de « € ’ œ … » (nodejs/node#60888, #59515). On répare ; dans un navigateur, rien à faire
const C1_1252 = '\u20ac\x81\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\x8d\u017d\x8f\x90\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\x9d\u017e\u0178';
function decoderAvec(etiquette, b, fatal = false) {
  const d = new TextDecoder(etiquette, fatal ? { fatal: true } : undefined), t = d.decode(b);
  return d.encoding === 'windows-1252' ? t.replace(/[\x80-\x9f]/g, c => C1_1252[c.charCodeAt(0) - 0x80]) : t;
}
// des octets, dans le jeu de caractères annoncé. Un mail qui se dit UTF-8 (ou ASCII) et n’en est pas est presque toujours
// du Windows-1252 ; ISO-8859-1 est lu en Windows-1252, comme le veut le standard Encoding des navigateurs
export function decoderTexte(binaire, charset) {
  const b = versOctets(binaire);
  let cs = String(charset || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (!cs || /^(us-)?ascii$|^ansi_x3\.4|^utf-?8$/.test(cs)) cs = 'utf-8';
  const strict = () => { try { return decoderAvec('utf-8', b, true); } catch { return decoderAvec('windows-1252', b); } };
  if (cs === 'utf-8') return strict();
  try { return decoderAvec(cs, b); } catch { return strict(); } // une étiquette inconnue
}

/* ───────── Les en-têtes ───────── */

// les mots encodés (RFC 2047) : « =?UTF-8?Q?Pique-nique_=C3=A0_la_rivi=C3=A8re?= ». Des mots voisins, séparés de blancs
// seulement, se recollent, et leurs octets d’abord : un caractère peut être coupé entre deux mots
const MOTS_ENCODES = /=\?[^?\s]+\?[BbQq]\?[^?\s]*\?=(?:\s+=\?[^?\s]+\?[BbQq]\?[^?\s]*\?=)*/g, MOT_ENCODE = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;
export function decoderEntete(v, { brut = true } = {}) {
  let s = String(v ?? '');
  if (brut && /[\x80-\xff]/.test(s) && !/[^\x00-\xff]/.test(s)) s = decoderTexte(s, 'utf-8'); // de l’UTF-8 nu dans un en-tête (Takeout, SMTPUTF8)
  return s.replace(MOTS_ENCODES, suite => {
    let out = '', cs = null, bin = '';
    const vider = () => { if (cs != null) out += decoderTexte(bin, cs); bin = ''; };
    for (const [, c, e, t] of suite.matchAll(MOT_ENCODE)) {
      const charset = c.replace(/\*.*$/, '').toLowerCase(); // « UTF-8*fr » : la langue, RFC 2231
      if (charset !== cs) { vider(); cs = charset; }
      bin += e.toUpperCase() === 'B' ? deBase64(t) : t.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    vider(); return out;
  });
}
// un bloc d’en-têtes (chaîne binaire) : [[nom en minuscules, valeur brute]], dans l’ordre, lignes dépliées
function lireEntetes(bloc) {
  const liste = [];
  for (const l of String(bloc || '').split(/\r?\n/)) {
    if (/^[ \t]/.test(l)) { if (liste.length) liste[liste.length - 1][1] += ' ' + l.trim(); continue; }
    const k = l.indexOf(':'); if (k <= 0) continue;
    liste.push([l.slice(0, k).trim().toLowerCase(), l.slice(k + 1).trim()]);
  }
  return liste;
}
// « text/plain; charset="iso-8859-1"; format=flowed » → { type, p: { charset, format } } ; RFC 2231 compris
// (« filename*=UTF-8''pi%C3%A8ce.pdf », et les suites « name*0= », « name*1*= »)
export function parametres(valeur) {
  const v = String(valeur || ''), i = v.indexOf(';'), p = {}, suites = {};
  const type = (i < 0 ? v : v.slice(0, i)).trim().toLowerCase();
  for (const m of v.slice(Math.max(0, i)).matchAll(/;\s*([^\s=;]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/g)) {
    const nom = m[1].toLowerCase(); let val = m[2].trim();
    if (val[0] === '"') val = val.slice(1, -1).replace(/\\(.)/g, '$1');
    const r = /^(.+?)\*(?:(\d+)\*?|)$/.exec(nom), encode = nom.endsWith('*');
    if (!r) { p[nom] = val; continue; }
    (suites[r[1]] ||= []).push({ n: Number(r[2] || 0), val, encode });
  }
  for (const [nom, morceaux] of Object.entries(suites)) {
    morceaux.sort((a, b) => a.n - b.n);
    let cs = 'utf-8', bin = '';
    morceaux.forEach((x, k) => {
      let val = x.val;
      if (x.encode && k === 0) { const q = /^([^']*)'[^']*'(.*)$/.exec(val); if (q) { cs = q[1] || cs; val = q[2]; } }
      bin += x.encode ? val.replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : val;
    });
    p[nom] = decoderTexte(bin, cs);
  }
  return { type, p };
}
// « "Martin, Camille" <camille.martin@example.com> » → { nom, adresse }
export function adresseDe(valeur) {
  const v = String(valeur || '').trim(), m = /^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>/.exec(v);
  if (m) return { nom: m[1].trim().replace(/^"|"$/g, '').replace(/\\(.)/g, '$1').trim(), adresse: m[2].toLowerCase() };
  const a = /[^\s<>"',;:()]+@[^\s<>"',;:()]+/.exec(v);
  return a ? { nom: v.replace(a[0], '').replace(/[()"]/g, '').trim(), adresse: a[0].toLowerCase() } : null;
}

/* ───────── L’arbre MIME ───────── */

// une partie : { entetes, type, params, disposition, fichier, cte, corps (chaîne binaire, encore encodée), parties }
export function lireMime(brut, profondeur = 0) {
  const bin = enBinaire(brut);
  let tete = '', corps = bin;
  if (/^\r?\n/.test(bin)) corps = bin.replace(/^\r?\n/, ''); // une partie sans en-têtes
  else { const m = /\r?\n\r?\n/.exec(bin); if (m) { tete = bin.slice(0, m.index); corps = bin.slice(m.index + m[0].length); } else { tete = bin; corps = ''; } }
  const entetes = lireEntetes(tete), h = nom => entetes.find(e => e[0] === nom)?.[1];
  const ct = parametres(h('content-type') || 'text/plain'), cd = parametres(h('content-disposition'));
  const p = { entetes, type: ct.type || 'text/plain', params: ct.p, disposition: cd.type, fichier: cd.p.filename || ct.p.name || '',
    cte: String(h('content-transfer-encoding') || '').trim().toLowerCase(), corps: null, parties: [] };
  if (p.type.startsWith('multipart/') && p.params.boundary && profondeur < 12) p.parties = morceauxMultipart(corps, p.params.boundary).map(x => lireMime(x, profondeur + 1));
  else p.corps = corps;
  return p;
}
// les parties d’un multipart : entre les lignes « --frontière », jusqu’à « --frontière-- ». Le saut de ligne qui précède
// une frontière lui appartient (RFC 2046). Un mail tronqué garde sa dernière partie commencée
function morceauxMultipart(corps, frontiere) {
  const d = `--${frontiere}`, out = [];
  const suivante = depuis => { for (let k = corps.indexOf(d, depuis); k >= 0; k = corps.indexOf(d, k + 1)) if (k === 0 || corps[k - 1] === '\n') return k; return -1; };
  let debut = -1;
  for (let at = suivante(0); at >= 0;) {
    const fl = corps.indexOf('\n', at), finLigne = fl < 0 ? corps.length : fl, reste = corps.slice(at + d.length, finLigne);
    if (!/^(--)?[ \t\r]*$/.test(reste)) { at = suivante(at + 1); continue; } // « --frontièreXYZ » : une autre frontière
    if (debut >= 0) { let fin = at - 1; if (fin > debut && corps[fin - 1] === '\r') fin--; out.push(corps.slice(debut, Math.max(debut, fin))); }
    if (reste.startsWith('--')) return out;
    debut = Math.min(corps.length, finLigne + 1); at = suivante(debut);
  }
  if (debut >= 0 && debut < corps.length) out.push(corps.slice(debut));
  return out;
}
// une partie d’un message de l’API Gmail (format=full) : mêmes champs. body.data est en base64url ; ses octets sont déjà
// ceux du contenu (sans Content-Transfer-Encoding), d’où cte 'binary'. Un texte trop long peut n’avoir qu’un attachmentId :
// api.js va le chercher (users.messages.attachments.get) et le remet dans body.data avant d’appeler extraire
export function partieDuPayload(mp, profondeur = 0) {
  const entetes = (mp?.headers || []).map(x => [String(x.name).toLowerCase(), String(x.value)]), h = nom => entetes.find(e => e[0] === nom)?.[1];
  const ct = parametres(h('content-type') || mp?.mimeType || 'text/plain'), cd = parametres(h('content-disposition'));
  return { entetes, type: String(mp?.mimeType || ct.type || 'text/plain').toLowerCase(), params: ct.p, disposition: cd.type, fichier: mp?.filename || cd.p.filename || '',
    cte: 'binary', corps: mp?.body?.data != null ? deBase64(mp.body.data) : null, attachmentId: mp?.body?.attachmentId || null,
    parties: profondeur < 12 ? (mp?.parts || []).map(q => partieDuPayload(q, profondeur + 1)) : [], api: true };
}
const typesDe = p => [p.type, ...p.parties.flatMap(typesDe)];

// format=flowed (RFC 3676, Apple Mail, Thunderbird) : une ligne qui finit par une espace continue sur la suivante
export function deplier(texte, delsp = false) {
  const out = []; let tampon = null, prof = 0;
  const pousser = () => { if (tampon != null) out.push(prof ? `${'>'.repeat(prof)} ${tampon}` : tampon); tampon = null; };
  for (const brute of String(texte).replace(/\r\n?/g, '\n').split('\n')) {
    const q = /^>*/.exec(brute)[0].length; let l = brute.slice(q); if (l[0] === ' ') l = l.slice(1); // le bourrage d’espace
    if (tampon != null && q !== prof) pousser();
    const souple = l.endsWith(' ') && l !== '-- ', morceau = souple && delsp ? l.slice(0, -1) : l;
    tampon = tampon == null ? morceau : tampon + morceau; prof = q;
    if (!souple) pousser();
  }
  pousser(); return out.join('\n');
}
function texteDe(p) {
  const bin = p.corps == null ? '' : p.cte === 'base64' ? deBase64(p.corps) : p.cte === 'quoted-printable' ? deQuotedPrintable(p.corps) : p.corps;
  const t = decoderTexte(bin, p.params.charset);
  return p.type === 'text/plain' && /^flowed$/i.test(p.params.format || '') ? deplier(t, /^yes$/i.test(p.params.delsp || '')) : t;
}
// le texte et le HTML d’une partie : dans multipart/alternative, la dernière version de chaque sorte (la plus fidèle, RFC
// 2046) ; dans multipart/mixed, les morceaux en ligne bout à bout (Apple Mail coupe le texte autour d’une image) ; dans
// related, la racine. Jamais une pièce jointe, ni un mail joint (message/rfc822 : les mots d’un autre), ni un agenda
const RIEN = { texte: null, html: null };
function contenus(p) {
  if (p.type.startsWith('multipart/')) {
    if (p.type === 'multipart/encrypted') return RIEN;
    if (p.type === 'multipart/signed') return p.parties[0] ? contenus(p.parties[0]) : RIEN;
    if (p.type === 'multipart/related') {
      const id = String(p.params.start || '').replace(/[<>]/g, ''), racine = (id && p.parties.find(e => String(e.entetes.find(x => x[0] === 'content-id')?.[1] || '').replace(/[<>\s]/g, '') === id)) || p.parties[0];
      return racine ? contenus(racine) : RIEN;
    }
    const c = p.parties.map(contenus);
    if (p.type === 'multipart/alternative') return { texte: c.reduce((x, e) => e.texte ?? x, null), html: c.reduce((x, e) => e.html ?? x, null) };
    const t = c.map(e => e.texte).filter(x => x != null), h = c.map(e => e.html).filter(x => x != null);
    return { texte: t.length ? t.join('\n\n') : null, html: h.length ? h.join('\n') : null };
  }
  if (p.disposition === 'attachment' || p.fichier) return RIEN; // Apple Mail joint « inline; filename=notes.txt » : un nom de fichier, c’est une pièce jointe
  if (p.type === 'text/plain') return { texte: texteDe(p), html: null };
  if (p.type === 'text/html') return { texte: null, html: texteDe(p) };
  return RIEN;
}

/* ───────── La date : le jour local de l’en-tête Date ───────── */

const MOIS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const ZONES = { ut: 0, utc: 0, gmt: 0, z: 0, est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420, cet: 60, cest: 120, wet: 0, west: 60, bst: 60 };
const surDeux = n => String(n).padStart(2, '0');
// « Tue, 6 Oct 2026 23:50:00 +0200 (CEST) » → { instant (ms), jour: '2026-10-06', decalage: 120 } : le jour est celui de
// l’horloge de qui a écrit, tel que son logiciel l’a noté. Formes anciennes (année sur deux chiffres, zones nommées) comprises
export function dateDuMail(valeur) {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([+-]\d{4}|[A-Za-z]{1,5}\b))?/.exec(String(valeur || ''));
  const mois = m && MOIS[m[2].toLowerCase()]; if (!mois) return null;
  let an = Number(m[3]); if (m[3].length === 2) an += an < 50 ? 2000 : 1900; else if (m[3].length === 3) an += 1900;
  const z = m[7] || '', decalage = /^[+-]\d{4}$/.test(z) ? (z[0] === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3))) : ZONES[z.toLowerCase()] ?? 0;
  const jour = new Date(Date.UTC(an, mois - 1, Number(m[1])));
  return { instant: Date.UTC(an, mois - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0)) - decalage * 60e3,
    jour: `${jour.getUTCFullYear()}-${surDeux(jour.getUTCMonth() + 1)}-${surDeux(jour.getUTCDate())}`, decalage };
}
// le jour d’un instant, dans un fuseau (IANA : 'Europe/Paris') ; sans fuseau, celui du téléphone, comme le chemin
export function jourDans(instant, fuseau = null) {
  const d = new Date(instant);
  if (!fuseau) return `${d.getFullYear()}-${surDeux(d.getMonth() + 1)}-${surDeux(d.getDate())}`;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/* ───────── Ce qui reste à enlever : avertissements, formule de politesse, son propre nom ───────── */

// un avertissement juridique : une marque explicite, ou au moins trois signes (confidentiel, destinataire, par erreur…)
const AVERTI = /^\W*(?:confidentiality notice|disclaimer|avertissement|mention l[ée]gale|legal notice|ce message est confidentiel)\b|avant d['’]imprimer|pensez à l['’]environnement|consider the environment before printing/i;
const SIGNES = [/confidenti/i, /\b(destinataires?|intended|addressee|recipients?)\b/i, /(par erreur|in error|by mistake|erron)/i, /(supprim|d[ée]trui|delete|destroy)/i,
  /(interdit|prohib|strictly|unauthori[sz]ed|non autoris)/i, /(responsabilit|liabilit|liable)/i, /\bvirus/i];
const avertissement = p => { const t = p.replace(/\s+/g, ' '); return AVERTI.test(t) || SIGNES.filter(r => r.test(t)).length >= 3; };
// un paragraphe qui finit par un avertissement : on le coupe à la première ligne qui en porte un signe (le HTML d’Outlook
// colle parfois l’avertissement à la formule de politesse, sans ligne vide)
function sansAvertissement(p) {
  if (!avertissement(p)) return p;
  const lignes = p.split('\n');
  for (let k = 0; k < lignes.length; k++) {
    if ((AVERTI.test(lignes[k]) || SIGNES.some(r => r.test(lignes[k]))) && avertissement(lignes.slice(k).join(' '))) return lignes.slice(0, k).join('\n');
  }
  return '';
}
// la formule de politesse, seule sur sa ligne ; ce qui la suit doit avoir l’air d’une signature (nom, fonction, téléphone)
const FORMULE = new RegExp(`^(?:${[
  '(?:bien |très |tres )?cordialement', 'cdlt', 'bien (?:à|a) (?:vous|toi|tous|vous tous)', '(?:mes |nos )?(?:sinc[eè]res |meilleures |bien )?salutations(?: distingu[ée]es)?',
  '(?:bien |très )?amicalement', 'amiti[ée]s', '(?:grosses |gros )?bis(?:es|ous)', '(?:je )?(?:t|vous)[\'’ ]?embrasse(?: fort)?',
  '(?:un grand |mille )?mercis?(?: (?:d[\'’]avance|par avance|beaucoup|encore|à (?:toi|vous)))?', 'bonne (?:journée|soirée|fin de journée|semaine|fin de semaine|nuit|week-end)',
  'belle (?:journée|soirée|semaine)', 'à (?:bientôt|plus|\\+|très vite)', 'a\\+',
  '(?:best|kind|warm|warmest|many) (?:regards|wishes|thanks)', 'regards', 'best', 'cheers', 'thanks(?: again| in advance| a lot)?', 'thank you(?: so much)?',
  'sincerely', 'yours(?: sincerely| truly| faithfully)?', 'all the best', '(?:lots of )?love', 'take care', '(?:talk|speak|see you) soon', 'x+o*', 'xo+',
].join('|')})[\\s,.!…:;)]*$`, 'i');
const FORMULE_LONGUE = /^(?:je vous prie d['’]agr[ée]er|veuillez (?:recevoir|agr[ée]er)|recevez[, ].{0,80}salutations|dans l['’]attente de (?:votre|ta|vous)\b|looking forward to hearing from you|hoping to hear from you)/i;
const signature = l => (l.length <= 60 && !/[.!?…]["»”)]?$/.test(l)) || /^(?:t[ée]l|tel|phone|mobile|portable|fax|www\.|https?:)|^\+?\d[\d .()/-]{6,}$/i.test(l);
// les mots du nom de la personne, pris dans l’en-tête From (« Camille Martin », ou l’adresse camille.martin@…)
const motsDuNom = de => new Set(`${de?.nom || ''} ${(de?.adresse || '').split('@')[0]}`.toLowerCase().split(/[^\p{L}]+/u).filter(x => x.length >= 2));
function sansNomFinal(lignes, nom) {
  for (;;) {
    let k = lignes.length - 1; while (k >= 0 && !lignes[k].trim()) k--;
    if (k < 0) return lignes;
    const mots = lignes[k].trim().split(/[\s,.;–—-]+/).filter(Boolean);
    if (!mots.length || mots.length > 4 || !mots.every(w => nom.has(w.toLowerCase()) || /^\p{Lu}\.?$/u.test(w))) return lignes;
    lignes = lignes.slice(0, k);
  }
}
function sansFormule(lignes) {
  for (let i = lignes.length - 1, apres = 0; i >= 0; i--) {
    const l = lignes[i].trim(); if (!l) continue;
    if (FORMULE.test(l) || (FORMULE_LONGUE.test(l) && l.length <= 240)) return lignes.slice(0, i);
    if (!signature(l) || ++apres > 8) return lignes;
  }
  return lignes;
}
// la salutation d’ouverture, seule sur sa ligne : une formule, qui porte surtout le nom de l’autre (« Bonjour Madame Roux, »
// ferait de « roux » un mot porteur). Gardée sur demande (salutation: true)
const SALUTATION = /^(?:bonjour|bonsoir|salut|coucou|hello|hi|hey|dear|cher|ch[èe]re|chers|ch[èe]res|madame|monsieur|mesdames|messieurs|good (?:morning|afternoon|evening))\b[^.!?]{0,50}[,!]?$/i;
// après motsDuTexte ou motsDuHtml (citations, attributions, « -- », « Envoyé de mon iPhone » déjà partis)
export function nettoyer(texte, { de = null, salutation = false } = {}) {
  const paragraphes = String(texte || '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map(sansAvertissement).filter(p => p.trim());
  let lignes = paragraphes.join('\n\n').split('\n');
  if (!salutation) { const k = lignes.findIndex(l => l.trim()); if (k >= 0 && SALUTATION.test(lignes[k].trim())) lignes = lignes.slice(k + 1); }
  const nom = motsDuNom(de);
  lignes = sansFormule(sansNomFinal(lignes, nom));
  lignes = sansNomFinal(lignes, nom);
  while (lignes.length && /^[\s*_=~#.·•\-–—]*$/.test(lignes[lignes.length - 1])) lignes.pop(); // les filets et lignes vides de la fin
  return lignes.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

/* ───────── extraire : un mail, ses mots, son jour ───────── */

const valeur = (p, nom, brut) => { const v = p.entetes.find(e => e[0] === nom)?.[1]; return v == null ? null : decoderEntete(v, { brut }); };
// une copie à part : un morceau de chaîne découpé dans le mail brut (V8 : « sliced string ») retiendrait en mémoire le mail
// entier, pièces jointes comprises, aussi longtemps que le résultat. Mesuré : 1 200 mails gardés, 200 Mo de tas sans copie
const aPart = s => (s == null ? s : JSON.parse(JSON.stringify(s)));
// entree : un mail brut (chaîne, Uint8Array, ArrayBuffer), un message de l’API Gmail ({ id, payload } ou { id, raw }), ou un
// payload seul. options : fuseau (IANA) pour ramener le jour à ce fuseau plutôt qu’à l’horloge de l’en-tête ; preferer :
// 'texte' (défaut : text/plain d’abord, HTML sinon) ou 'html' ; repli : un instant (ms) si l’en-tête Date manque ;
// salutation : true pour garder « Bonjour Jeanne, ».
// Rend { id, messageId, origine, date, instant, de, sujet, sujetASoi, texte, forme, ignore } ; ignore dit pourquoi un mail
// ne compte pas (brouillon, automatique, vide), et texte est alors vide
export function extraire(entree, { fuseau = null, preferer = 'texte', repli = null, salutation = false } = {}) {
  let racine, origine, id = null, labels = null, interne = repli;
  if (entree && typeof entree === 'object' && !ArrayBuffer.isView(entree) && !(entree instanceof ArrayBuffer)) {
    id = entree.id ?? null; labels = entree.labelIds ?? null; if (entree.internalDate != null) interne = Number(entree.internalDate);
    if (typeof entree.raw === 'string') { racine = lireMime(deBase64(entree.raw)); origine = 'api-raw'; } else if (entree.payload) { racine = partieDuPayload(entree.payload); origine = 'api-full'; } else if (entree.mimeType || entree.headers) { racine = partieDuPayload(entree); origine = 'api-full'; } else throw new TypeError('extraire : ni mail brut, ni message de l’API Gmail');
  } else { racine = lireMime(entree); origine = 'rfc822'; }
  const brut = !racine.api, h = nom => valeur(racine, nom, brut);
  const de0 = adresseDe(h('from')), de = de0 && { nom: aPart(de0.nom), adresse: aPart(de0.adresse) }, sujet = aPart(h('subject')), quand = dateDuMail(h('date'));
  const instant = quand ? quand.instant : Number.isFinite(interne) ? interne : null;
  const date = quand && !fuseau ? quand.jour : instant != null ? jourDans(instant, fuseau) : null;
  const res = { id, messageId: aPart((h('message-id') || '').replace(/[<>\s]/g, '')) || null, origine, date, instant, de, sujet, sujetASoi: titre(sujet) != null, texte: '', forme: null, ignore: null };
  if (labels && labels.some(l => l === 'DRAFT' || l === 'CHAT')) { res.ignore = 'brouillon'; return res; }
  const entetes = {}; for (const [n] of racine.entetes) if (!(n in entetes)) entetes[n] = h(n);
  if (automatique(entetes, typesDe(racine))) { res.ignore = 'automatique'; return res; }
  const c = contenus(racine), formes = preferer === 'html' ? ['html', 'texte'] : ['texte', 'html'];
  for (const f of formes) {
    if (c[f] == null) continue;
    const t = nettoyer(f === 'html' ? motsDuHtml(c.html) : motsDuTexte(c.texte), { de, salutation });
    if ((t.match(/\p{L}{2,}/gu) || []).length >= 2) { res.texte = aPart(t); res.forme = f; return res; }
  }
  res.ignore = 'vide'; return res;
}

// des mails extraits → les pages du chemin, une par jour : [{ date, texte }], les mails du jour dans l’ordre où ils sont
// partis, séparés d’une ligne vide (le découpage les regroupe ensuite en passages). sujets : le sujet d’un mail qu’on
// ouvre (pas « Re : ») est aussi de soi, il vient en tête de son texte. Un même mail vu deux fois ne compte qu’une fois
export function pagesParJour(extraits, { sujets = true } = {}) {
  const vus = new Set(), jours = new Map();
  for (const x of [...extraits].filter(x => x && x.date && x.texte && !x.ignore).sort((a, b) => (a.instant ?? 0) - (b.instant ?? 0))) {
    const cle = x.messageId || x.id; if (cle) { if (vus.has(cle)) continue; vus.add(cle); }
    const t = sujets && x.sujetASoi ? `${titre(x.sujet)}\n\n${x.texte}` : x.texte;
    if (!jours.has(x.date)) jours.set(x.date, []);
    jours.get(x.date).push(t);
  }
  return [...jours].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, textes]) => ({ date, texte: textes.join('\n\n') }));
}
