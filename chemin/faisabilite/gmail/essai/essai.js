// Essai des routes Gmail, avec des mails inventés seulement (jamais une vraie boîte) : node chemin/faisabilite/gmail/essai/essai.js
// Une journée de Camille, personne fictive : quelques mails envoyés, banals, avec ce qui les entoure d’habitude (citations,
// transfert, signature, « Envoyé de mon iPhone », une réponse d’agenda, une réponse automatique, un brouillon, un mail reçu).
// Les trois routes doivent en tirer les mêmes mots : A (l’API Gmail depuis la page, contre une fausse API), B (le script
// Apps Script, exécuté ici avec de faux services Google), C (une archive Takeout, zip et mbox). Puis le chemin les lit.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');

const ICI = __dirname, HAUT = path.join(ICI, '..'), CHEMIN = path.join(HAUT, '..', '..');
const enc = new TextEncoder();
let echecs = 0;
const verifier = (nom, f) => Promise.resolve().then(f).then(() => console.log(`  ok  ${nom}`), e => { echecs++; console.log(`  ÉCHEC  ${nom}\n        ${e.message.split('\n').join('\n        ')}`); });

/* ───────── Une journée inventée ───────── */

const JOUR = Date.parse('2026-10-06T00:00:00+02:00');
const h = (heure) => JOUR + heure * 3600e3;
const CITE_FR = 'Tu es libre ce week-end ? On pourrait aller marcher, il paraît qu’il fera beau.';
const MAILS = [
  { id: 'm1', fil: 't1', quand: h(8.2), sujet: 'Re: Ce week-end', a: 'Jeanne Durand <jeanne@example.org>',
    texte: 'Bonjour Jeanne,\n\nOui pour samedi ! On pourrait pique-niquer au bord du lac, sous les saules, s’il ne pleut pas. J’apporterai la nappe à carreaux et une tarte aux prunes.\n\nÀ samedi,\nCamille\n\n-- \nCamille Martin\nBibliothécaire, médiathèque des Tilleuls\n\nLe lun. 5 oct. 2026 à 18:42, Jeanne Durand <jeanne@example.org> a écrit :\n\n> ' + CITE_FR + '\n',
    html: '<div dir="ltr">Bonjour Jeanne,<div><br></div><div>Oui pour samedi&nbsp;! On pourrait pique-niquer au bord du lac, sous les saules, s&#39;il ne pleut pas. J’apporterai la nappe à carreaux et une tarte aux prunes.</div><div><br></div><div>À samedi,</div><div>Camille</div><div><br></div><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">Camille Martin<br>Bibliothécaire, médiathèque des Tilleuls</div></div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">Le lun. 5 oct. 2026 à 18:42, Jeanne Durand &lt;<a href="mailto:jeanne@example.org">jeanne@example.org</a>&gt; a écrit&nbsp;:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex">' + CITE_FR + '</blockquote></div>',
    garde: ['pique-niquer au bord du lac', 'tarte aux prunes', 'À samedi'], jamais: ['libre ce week-end', 'Bibliothécaire', 'a écrit', 'jeanne@example.org'] },
  { id: 'm2', fil: 't2', quand: h(9.5), sujet: 'Fuite sous l’évier', a: 'plombier@example.com', qp: true,
    texte: 'Bonjour Monsieur,\n\nLa fuite sous l’évier de la cuisine a repris cette nuit, il y a une flaque près du lave-vaisselle. Pourriez-vous passer jeudi matin ?\n\nMerci d’avance,\nCamille Martin\n\nEnvoyé de mon iPhone\n',
    garde: ['fuite sous l’évier de la cuisine', 'jeudi matin'], jamais: ['iPhone'], titre: 'Fuite sous l’évier' },
  { id: 'm3', fil: 't3', quand: h(12.75), sujet: 'Fwd: Les dahlias', a: 'Léo <leo@example.net>',
    texte: 'Regarde, ce sont les photos du jardin de mamie, les dahlias sont magnifiques cette année.\n\n---------- Forwarded message ---------\nDe : Mamie <mamie@example.net>\nDate: lun. 5 oct. 2026 à 17:03\nSubject: Les dahlias\nTo: Camille <camille@example.com>\n\nMes chéris, voici le jardin, la glycine a encore poussé.\n',
    html: '<div dir="ltr">Regarde, ce sont les photos du jardin de mamie, les dahlias sont magnifiques cette année.<br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De&nbsp;: <strong class="gmail_sendername" dir="auto">Mamie</strong></div><br><br>Mes chéris, voici le jardin, la glycine a encore poussé.</div></div>',
    joint: { type: 'image/jpeg', nom: 'jardin.jpg', octets: 3000 },
    garde: ['dahlias sont magnifiques'], jamais: ['glycine', 'Mes chéris', 'Forwarded'] },
  { id: 'm4', fil: 't4', quand: h(14), sujet: 'RE: Réunion', a: 'Paul Lefèvre <paul@example.com>',
    texte: 'Je confirme la réunion de vendredi au bureau, j’apporterai le dossier du projet et des croissants.\n\n________________________________\nDe : Paul Lefèvre <paul@example.com>\nEnvoyé : lundi 5 octobre 2026 09:12\nÀ : Camille Martin\nObjet : Réunion\n\nPeux-tu confirmer vendredi ?\n',
    garde: ['dossier du projet et des croissants'], jamais: ['Peux-tu confirmer', 'Envoyé :'] },
  { id: 'm5', fil: 't5', quand: h(15), sujet: 'Accepté : Dentiste', a: 'cabinet@example.com', agenda: true,
    texte: 'Camille Martin a accepté cette invitation.\n', rien: 'agenda' },
  { id: 'm6', fil: 't6', quand: h(16), sujet: 'Réponse automatique : Absente', a: 'quelquun@example.org', entetes: { 'Auto-Submitted': 'auto-replied' },
    texte: 'Je suis absente jusqu’au 12 octobre.\n', rien: 'automatique' },
  { id: 'm7', fil: 't7', quand: h(18.4), sujet: 'Re: the lighthouse', a: 'Sam <sam@example.org>',
    texte: 'Thanks Sam, the old lighthouse by the harbour was beautiful at sunset, the gulls were everywhere.\n\nOn Mon, Oct 5, 2026 at 6:42 PM Sam Taylor <\nsam@example.org> wrote:\n\n> Did you see the lighthouse?\n',
    garde: ['old lighthouse by the harbour'], jamais: ['Did you see', 'wrote'] },
  { id: 'm8', fil: 't8', quand: h(19), sujet: 'Café', a: 'Lucie <lucie@example.org>', charset: 'windows-1252',
    texte: 'Café avec Lucie près de la gare demain ? Elle m’a parlé de son voyage en Écosse, des moutons sur la route.\n',
    garde: ['voyage en Écosse', 'Café avec Lucie'], titre: 'Café' },
  { id: 'm9', fil: 't9', quand: h(20.5), sujet: 'Facture du vélo', a: 'atelier@example.com', b64: true,
    html: '<p>Bonjour,</p><p>Voici la facture du vélo, la roue arrière est enfin réparée. Le soir, je roule le long du canal.</p><div id="Signature"><p>Camille</p></div>',
    joint: { type: 'application/pdf', nom: 'facture.pdf', octets: 5000 },
    garde: ['roue arrière est enfin réparée', 'long du canal'], jamais: ['<p>'] },
  { id: 'm10', fil: 't10', quand: h(21), sujet: 'Brouillon', a: 'x@example.com', brouillon: true, texte: 'Un brouillon jamais envoyé, la lune sur le toit.\n', rien: 'brouillon' },
  { id: 'm11', fil: 't11', quand: h(10), sujet: 'Votre colis', a: 'camille@example.com', de: 'Boutique <noreply@example.com>', recu: true,
    texte: 'Votre colis est en route vers la bibliothèque.\n', rien: 'reçu' },
];

/* ───────── Les mails, en MIME brut et en messages de l’API ───────── */

const versCp1252 = s => Uint8Array.from([...s], c => ({ '’': 0x92, '€': 0x80, 'œ': 0x9c }[c] ?? c.charCodeAt(0))); // assez pour l’essai
const corpsOctets = (m, quoi) => (m.charset === 'windows-1252' ? versCp1252(m[quoi]) : enc.encode(m[quoi]));
const enB64 = o => Buffer.from(o).toString('base64').replace(/.{76}/g, '$&\r\n');
const enQp = o => { let s = '', l = 0; for (const b of o) { const c = b === 10 ? '\r\n' : (b >= 33 && b <= 126 && b !== 61) || b === 32 ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, '0')}`; if (c === '\r\n') { s += c; l = 0; continue; } if (l + c.length > 75) { s += '=\r\n'; l = 0; } s += c; l += c.length; } return s; };
const enteteMot = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`;
const dateMail = t => new Date(t).toUTCString().replace('GMT', '+0000');
// l’arbre MIME d’un mail : le même pour le brut (Takeout) et pour l’API (format=full)
function arbre(m) {
  const cs = m.charset || 'UTF-8', cte = m.b64 ? 'base64' : m.qp || m.charset ? 'quoted-printable' : '8bit';
  const feuille = (type, o, plus = {}) => ({ type, charset: cs, cte, o, ...plus });
  const textes = [m.texte != null && feuille('text/plain', corpsOctets(m, 'texte')), m.html != null && feuille('text/html', corpsOctets(m, 'html')),
    m.agenda && { type: 'text/calendar', charset: 'UTF-8', cte: '7bit', methode: 'REPLY', o: enc.encode('BEGIN:VCALENDAR\r\nMETHOD:REPLY\r\nEND:VCALENDAR\r\n') }].filter(Boolean);
  let racine = textes.length > 1 ? { type: 'multipart/alternative', parts: textes } : textes[0];
  if (m.joint) racine = { type: 'multipart/mixed', parts: [racine, { type: m.joint.type, nom: m.joint.nom, cte: 'base64', o: Uint8Array.from({ length: m.joint.octets }, (_, i) => (i * 37) & 255) }] };
  return racine;
}
const entetesDe = m => ({ From: m.de || 'Camille Martin <camille@example.com>', To: m.a, Subject: m.sujet, Date: dateMail(m.quand), 'Message-ID': `<${m.id}@mail.example.com>`, 'X-GM-THRID': m.fil, ...(m.entetes || {}) });
let bord = 0;
function brut(m, plus = {}) {
  const ecrire = (n, tete) => {
    const lignes = Object.entries(tete).map(([k, v]) => `${k}: ${k === 'Subject' || k === 'From' || k === 'To' ? enteteMot(v) : v}`);
    if (n.parts) {
      const b = `----=_Part_${++bord}_essai`;
      lignes.push('MIME-Version: 1.0', `Content-Type: ${n.type}; boundary="${b}"`);
      return `${lignes.join('\r\n')}\r\n\r\nPréambule ignoré.\r\n${n.parts.map(p => `--${b}\r\n${ecrire(p, {})}`).join('\r\n')}\r\n--${b}--\r\n`;
    }
    lignes.push(`Content-Type: ${n.type}${n.nom ? `; name="${n.nom}"` : `; charset="${n.charset}"`}${n.methode ? `; method=${n.methode}` : ''}`, `Content-Transfer-Encoding: ${n.cte}`);
    if (n.nom) lignes.push(`Content-Disposition: attachment; filename="${n.nom}"`);
    const corps = n.cte === 'base64' ? enB64(n.o) : n.cte === 'quoted-printable' ? enQp(n.o) : Buffer.from(n.o).toString('latin1').replace(/\r?\n/g, '\r\n');
    return `${lignes.join('\r\n')}\r\n\r\n${corps}`;
  };
  return Buffer.from(ecrire(arbre(m), { ...entetesDe(m), ...plus }), 'latin1');
}
const b64url = o => Buffer.from(o).toString('base64url');
function message(m) { // ce que rend messages.get, format=full (forme : la référence de l’API, ressource Message)
  const partie = (n, tete = {}) => {
    const headers = Object.entries(tete).map(([name, value]) => ({ name, value }));
    if (n.parts) return { mimeType: n.type, filename: '', headers: [...headers, { name: 'Content-Type', value: `${n.type}; boundary="x"` }], body: { size: 0 }, parts: n.parts.map(p => partie(p)) };
    headers.push({ name: 'Content-Type', value: `${n.type}${n.nom ? '' : `; charset="${n.charset}"`}` });
    return { mimeType: n.type, filename: n.nom || '', headers, body: n.nom ? { attachmentId: 'ANGjdJ_essai', size: n.o.length } : { size: n.o.length, data: b64url(n.o) } };
  };
  return { id: m.id, threadId: m.fil, internalDate: String(m.quand), labelIds: m.brouillon ? ['DRAFT'] : m.recu ? ['INBOX', 'UNREAD'] : ['SENT'], payload: partie(arbre(m), entetesDe(m)) };
}

/* ───────── Une fausse API Gmail, qui suit la forme de la vraie ───────── */

function fausseApi(liste, { jeton = 'jeton-essai', parPage = 3 } = {}) {
  const vus = { list: 0, get: 0, unites: 0 };
  const repondre = (status, corps) => ({ ok: status < 300, status, json: async () => corps });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    assert.strictEqual(u.origin, 'https://gmail.googleapis.com');
    if (init.headers?.Authorization !== `Bearer ${jeton}`) return repondre(401, { error: { code: 401 } });
    const p = u.pathname.replace('/gmail/v1/users/me', '');
    if (p === '/messages') {
      vus.list++; vus.unites += 5;
      const q = u.searchParams.get('q'), apres = Number(/after:(\d+)/.exec(q)?.[1] || 0) * 1000;
      assert.match(q, /in:sent/);
      const tous = liste.filter(m => !m.recu && !m.brouillon && m.quand >= apres).sort((a, b) => b.quand - a.quand); // un brouillon n’est pas « in:sent »
      const debut = Number(u.searchParams.get('pageToken') || 0), page = tous.slice(debut, debut + parPage);
      return repondre(200, { messages: page.map(m => ({ id: m.id, threadId: m.fil })), ...(debut + parPage < tous.length ? { nextPageToken: String(debut + parPage) } : {}) });
    }
    const id = /^\/messages\/([^/]+)$/.exec(p)?.[1], m = liste.find(x => x.id === id);
    if (!m) return repondre(404, {});
    assert.strictEqual(u.searchParams.get('format'), 'full');
    vus.get++; vus.unites += 20;
    return repondre(200, message(m));
  };
  return { fetch, vus };
}

/* ───────── Les essais ───────── */

const sansPrefixe = g => ({ cle: g.id.split(':').slice(1).join(':').replace(/@.*$/, ''), texte: g.texte, titre: g.titre, debut: g.debut });

(async () => {
  const extraire = await import(path.join(HAUT, 'extraire.js'));
  const mime = await import(path.join(HAUT, 'mime.js'));
  const gmail = await import(path.join(HAUT, 'gmail.js'));
  const attendus = MAILS.filter(m => !m.rien);
  const regarder = (glanes, nom) => {
    for (const m of MAILS) {
      const g = glanes.find(x => x.id.endsWith(`:${m.id}`) || x.id.endsWith(`:${m.id}@mail.example.com`));
      if (m.rien) { assert.ok(!g, `${nom} : ${m.id} (${m.rien}) ne devait pas venir`); continue; }
      assert.ok(g, `${nom} : ${m.id} manque`);
      for (const x of m.garde || []) assert.ok(g.texte.includes(x), `${nom} : ${m.id} devait garder « ${x} »\n${g.texte}`);
      for (const x of m.jamais || []) assert.ok(!g.texte.includes(x), `${nom} : ${m.id} ne devait pas garder « ${x} »\n${g.texte}`);
      assert.strictEqual(g.titre, m.titre ?? (/^(re|fwd)\s*:/i.test(m.sujet) ? null : m.sujet), `${nom} : le titre de ${m.id}`);
      assert.strictEqual(g.debut, m.quand, `${nom} : la date de ${m.id}`);
      assert.ok(!/@example\./.test(g.texte), `${nom} : une adresse est restée dans ${m.id}`);
    }
    assert.strictEqual(glanes.length, attendus.length, `${nom} : ${glanes.length} glanes au lieu de ${attendus.length}`);
  };
  let A, B, C;

  console.log('Les mots à soi');
  await verifier('un HTML de Gmail : citation, attribution et signature tues', () => {
    const t = extraire.motsDuHtml(MAILS[0].html);
    assert.strictEqual(t, 'Bonjour Jeanne,\n\nOui pour samedi ! On pourrait pique-niquer au bord du lac, sous les saules, s\'il ne pleut pas. J’apporterai la nappe à carreaux et une tarte aux prunes.\n\nÀ samedi,\nCamille');
  });
  await verifier('le même mail en texte brut donne les mêmes mots', () => assert.strictEqual(extraire.motsDuTexte(MAILS[0].texte).replaceAll('’', '\''), extraire.motsDuHtml(MAILS[0].html).replaceAll('’', '\'')));
  await verifier('une attribution anglaise coupée sur deux lignes', () => assert.strictEqual(extraire.motsDuTexte(MAILS[6].texte), 'Thanks Sam, the old lighthouse by the harbour was beautiful at sunset, the gulls were everywhere.'));
  await verifier('une phrase qui commence par « Le » n’est pas une attribution', () => assert.strictEqual(extraire.motsDuTexte('Le chat dort sur le radiateur.\nLe 12 octobre, on part.'), 'Le chat dort sur le radiateur.\nLe 12 octobre, on part.'));
  await verifier('un en-tête de réponse d’Outlook, en HTML', () => assert.strictEqual(extraire.motsDuHtml('<div>Merci, à jeudi au marché.</div><hr><div id="divRplyFwdMsg"><b>De :</b> Paul</div><div>Texte de Paul</div>'), 'Merci, à jeudi au marché.'));

  console.log('Route A : l’API Gmail, depuis la page (fausse API)');
  await verifier('les mails envoyés du jour, et seulement les miens', async () => {
    const api = fausseApi(MAILS);
    const r = await gmail.cueillirGmail({ jeton: async () => 'jeton-essai', depuis: JOUR, fetch: api.fetch });
    A = r.glanes; regarder(A, 'A');
    assert.strictEqual(r.curseur, Math.max(...MAILS.filter(m => !m.recu && !m.brouillon).map(m => m.quand)));
    console.log(`        ${api.vus.list} pages de liste, ${api.vus.get} messages lus : ${api.vus.unites} unités de quota (limite : 6 000 par minute et par personne)`);
  });
  await verifier('la cueillette suivante ne reprend que les nouveaux', async () => {
    const api = fausseApi(MAILS), r = await gmail.cueillirGmail({ jeton: async () => 'jeton-essai', depuis: h(19), fetch: api.fetch });
    assert.deepStrictEqual(r.glanes.map(g => g.id), ['gmail:m9']);
  });
  await verifier('un jeton périmé : une erreur 401, que la page traduit en « un toucher »', async () => {
    const api = fausseApi(MAILS);
    await assert.rejects(gmail.cueillirGmail({ jeton: async () => 'vieux', depuis: JOUR, fetch: api.fetch }), e => e.status === 401);
  });

  console.log('Route B : le script Apps Script à soi (faux services Google)');
  const { fabriquer } = require(path.join(HAUT, 'script', 'fabriquer.js'));
  const lancerScript = ({ octetsSignes = false } = {}) => {
    const signe = o => Array.from(o, x => (x > 127 ? x - 256 : x));
    const proprietes = new Map(), journal = [];
    const ctx = {
      console: { log: x => journal.push(x) }, Date, Math, JSON, Number, String, Object, Array, RegExp, Error, Promise, Uint8Array, Map, Set, encodeURIComponent,
      Utilities: {
        getUuid: () => require('crypto').randomUUID(),
        base64DecodeWebSafe: s => signe(Buffer.from(s, 'base64url')),
        newBlob: o => ({ getDataAsString: cs => new TextDecoder(cs).decode(Uint8Array.from(o, x => x & 255)) }),
      },
      PropertiesService: { getScriptProperties: () => ({ getProperty: k => proprietes.get(k) ?? null, setProperty: (k, v) => proprietes.set(k, v) }) },
      ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: t => ({ t, setMimeType(m) { this.m = m; return this; } }) },
      Gmail: { Users: { Messages: {
        list: (_, { q, pageToken }) => { const apres = Number(/after:(\d+)/.exec(q)[1]) * 1000, tous = MAILS.filter(m => !m.recu && !m.brouillon && m.quand >= apres), d = Number(pageToken || 0); return { messages: tous.slice(d, d + 4).map(m => ({ id: m.id, threadId: m.fil })), nextPageToken: d + 4 < tous.length ? String(d + 4) : undefined }; },
        get: (_, id) => { const msg = message(MAILS.find(m => m.id === id)); if (octetsSignes) (function signer(p) { if (p.body?.data) p.body.data = signe(Buffer.from(p.body.data, 'base64url')); (p.parts || []).forEach(signer); })(msg.payload); return msg; },
      } } },
    };
    vm.createContext(ctx);
    vm.runInContext(fabriquer(), ctx, { filename: 'Code.gs' });
    return { ctx, journal };
  };
  await verifier('Code.gs se fabrique et se lit comme un seul fichier, sans modules', () => { const { ctx } = lancerScript(); assert.strictEqual(typeof ctx.doGet, 'function'); });
  await verifier('sans la bonne clé, rien', () => {
    const { ctx } = lancerScript(); ctx.installer();
    const r = ctx.doGet({ parameter: { k: 'mauvaise', depuis: String(JOUR) } });
    assert.deepStrictEqual(JSON.parse(r.t), { erreur: 'clé' });
  });
  for (const octetsSignes of [false, true]) {
    await verifier(`avec la clé, les mêmes mots que la route A (données ${octetsSignes ? 'en octets' : 'en base64url'})`, () => {
      const { ctx } = lancerScript({ octetsSignes }), cle = ctx.installer();
      const r = ctx.doGet({ parameter: { k: cle, depuis: String(JOUR) } }), d = JSON.parse(r.t);
      assert.strictEqual(r.m, 'json');
      B = d.glanes; regarder(B, 'B');
      assert.deepStrictEqual(B.map(sansPrefixe), A.map(sansPrefixe));
    });
  }
  await verifier('JSONP, si un navigateur refusait la réponse JSON', () => {
    const { ctx } = lancerScript(), cle = ctx.installer(), r = ctx.doGet({ parameter: { k: cle, depuis: String(JOUR), callback: 'recevoir' } });
    assert.strictEqual(r.m, 'js'); assert.match(r.t, /^recevoir\(\{"glanes":/);
    assert.strictEqual(ctx.doGet({ parameter: { k: cle, callback: 'alert(1);x' } }).m, 'json');
  });
  await verifier('la page, côté route B : une simple requête GET', async () => {
    const { ctx } = lancerScript(), cle = ctx.installer();
    const fetch = async (url, init) => { const u = new URL(url); assert.strictEqual(init.credentials, 'omit'); assert.ok(!init.headers); const r = ctx.doGet({ parameter: Object.fromEntries(u.searchParams) }); return { ok: true, status: 200, json: async () => JSON.parse(r.t) }; };
    const r = await gmail.cueillirScript({ url: 'https://script.google.com/macros/s/ESSAI/exec', cle, depuis: JOUR, fetch });
    assert.strictEqual(r.glanes.length, attendus.length);
  });

  console.log('Route C : une archive Google Takeout, lue sur le téléphone');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chemin-gmail-'));
  const ligneFrom = m => `From ${m.id}@xxx ${new Date(m.quand).toUTCString()}\r\n`;
  const etiquettes = m => (m.recu ? 'Boîte de réception,Non lus' : m.brouillon ? 'Brouillons' : 'Messages envoyés,Ouvert');
  const mbox = Buffer.concat(MAILS.flatMap(m => [Buffer.from(ligneFrom(m)), brut(m, { 'X-Gmail-Labels': etiquettes(m) }), Buffer.from('\r\n')]));
  const fMbox = path.join(tmp, 'Messages envoyés.mbox'); fs.writeFileSync(fMbox, mbox);
  const zipper = (sortie, zip64, methode) => execFileSync('python3', ['-I', '-c', `import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'w', compression=zipfile.${methode}) as z:
    z.writestr('Takeout/LISEZMOI.html', '<p>archive</p>')
    with open(sys.argv[2], 'rb') as f, z.open('Takeout/Mail/Messages envoyés.mbox', 'w', force_zip64=${zip64 ? 'True' : 'False'}) as d: d.write(f.read())`, sortie, fMbox]);
  const fZip = path.join(tmp, 'takeout.zip'), fZip64 = path.join(tmp, 'takeout64.zip'), fStocke = path.join(tmp, 'stocke.zip');
  zipper(fZip, false, 'ZIP_DEFLATED'); zipper(fZip64, true, 'ZIP_DEFLATED'); zipper(fStocke, false, 'ZIP_STORED');
  const fichier = (f, nom) => new File([fs.readFileSync(f)], nom || path.basename(f));
  for (const [f, nom] of [[fZip, 'zip, deflate'], [fZip64, 'zip, ZIP64'], [fStocke, 'zip, sans compression'], [fMbox, 'mbox seule']]) {
    await verifier(`${nom} : les mêmes mots que la route A`, async () => {
      const compte = {}, glanes = []; for await (const g of mime.depuisTakeout(fichier(f), { compte })) glanes.push(g);
      C = glanes; regarder(C, 'C');
      assert.deepStrictEqual(C.map(g => g.texte), A.map(g => g.texte));
      assert.strictEqual(compte.recus, 2); // le mail reçu et le brouillon
    });
  }
  await verifier('une boîte sans étiquettes Gmail : on reconnaît son adresse', async () => {
    const sans = Buffer.concat(MAILS.filter(m => !m.brouillon).flatMap(m => [Buffer.from(ligneFrom(m)), brut(m), Buffer.from('\r\n')]));
    const glanes = []; for await (const g of mime.depuisTakeout(new File([sans], 'boite.mbox'), { moi: 'camille@example.com' })) glanes.push(g);
    assert.strictEqual(glanes.length, attendus.length);
  });
  await verifier('un gros mail : la pièce jointe au-delà de la limite n’est pas gardée, le texte oui', async () => {
    const gros = { ...MAILS[8], id: 'gros', joint: { type: 'application/pdf', nom: 'plan.pdf', octets: 6 << 20 } };
    const b = Buffer.concat([Buffer.from(ligneFrom(gros)), brut(gros, { 'X-Gmail-Labels': 'Messages envoyés' }), Buffer.from('\r\n'), Buffer.from(ligneFrom(MAILS[1])), brut(MAILS[1], { 'X-Gmail-Labels': 'Messages envoyés' })]);
    const glanes = []; for await (const g of mime.depuisTakeout(new File([b], 'gros.mbox'))) glanes.push(g);
    assert.deepStrictEqual(glanes.map(g => g.id.split(':')[1].split('@')[0]), ['gros', 'm2']);
  });
  await verifier('« >From » dans un corps de mail ne coupe pas la boîte', async () => {
    const m = { ...MAILS[7], id: 'from', texte: 'Ligne une.\n\nFrom the window I see the sea, the boats are back.\n' };
    const b = Buffer.concat([Buffer.from(ligneFrom(m)), Buffer.from(brut(m, { 'X-Gmail-Labels': 'Sent' }).toString('latin1').replace('\r\nFrom the', '\r\n>From the'), 'latin1')]);
    const glanes = []; for await (const g of mime.depuisTakeout(new File([b], 'from.mbox'))) glanes.push(g);
    assert.strictEqual(glanes.length, 1); assert.match(glanes[0].texte, /^Ligne une\.\n\nFrom the window/);
  });
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('Et le chemin les lit');
  await verifier('les mots du jour deviennent des passages, donc des tuiles', async () => {
    const sens = await import(path.join(CHEMIN, 'sens.js'));
    const lire = f => fs.readFileSync(path.join(CHEMIN, f.replace(/\?.*$/, '')));
    const [mots, V, O, I, catalogue] = sens.FICHIERS_SENS.map(lire);
    const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const S = sens.preparer(mots.toString('utf8'), ab(V), ab(O), JSON.parse(catalogue.toString('utf8')), ab(I));
    const texte = A.map(g => [g.titre, g.texte].filter(Boolean).join('\n\n')).join('\n\n');
    const passages = sens.decouper(S, texte);
    assert.ok(passages.length >= 2, 'trop peu de passages');
    console.log(`        ${A.length} mails envoyés, ${texte.split(/\s+/).length} mots à soi : ${passages.length} passages, donc ${passages.length} tuiles`);
    for (const [n, p] of passages.entries()) {
      const l = sens.lirePage(S, p.texte), porteurs = l.mots.filter(x => sens.porteur(S, x.i)).map(x => x.m);
      const lieu = Object.entries(l.champs).sort((a, b) => b[1] - a[1])[0][0];
      console.log(`        tuile ${n + 1} : ${porteurs.slice(0, 9).join(', ')} (champ dominant : ${lieu})`);
    }
  });

  console.log(echecs ? `\n${echecs} échec(s)` : '\nTout va bien.');
  process.exitCode = echecs ? 1 : 0;
})();
