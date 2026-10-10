// Essai du prototype Gmail, avec des mails inventés seulement (jamais une vraie boîte) : node chemin/faisabilite/gmail/essai.mjs
// Trois jours de Camille Martin, personne fictive : ses mails envoyés, banals, avec ce qui les entoure d’habitude (citations,
// transferts, signatures, formules de politesse, avertissements juridiques, « Envoyé de mon iPhone »), en plusieurs
// encodages ; un mail reçu, un brouillon, une réponse automatique et une réponse d’agenda, qui ne doivent rien donner.
// Chaque passage cité porte un mot-témoin en capitales (VOLCAN, GIRAFE…) : aucun ne doit rester. Puis les pages du jour
// passent dans le vrai sens.js du chemin (decouper, lirePage, candidats), comme sur le téléphone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as X from './extraire.js';
import * as M from './mbox.js';
import * as A from './api.js';

const ICI = path.dirname(fileURLToPath(import.meta.url)), CHEMIN = path.join(ICI, '..', '..');
let echecs = 0, reussites = 0;
async function verifier(nom, f) {
  try { await f(); reussites++; console.log(`  ok  ${nom}`); } catch (e) { echecs++; console.log(`  ÉCHEC  ${nom}\n        ${String(e.stack || e.message).split('\n').slice(0, 8).join('\n        ')}`); }
}

/* ═════════ Fabriquer des mails, comme les logiciels les écrivent ═════════ */

// Windows-1252, écrit à la main (le TextDecoder de Node 22 se trompe sur 0x80–0x9F : on ne s’en sert pas pour fabriquer)
const CP1252 = (() => {
  const m = new Map(), c1 = '€\x81‚ƒ„…†‡ˆ‰Š‹Œ\x8dŽ\x8f\x90‘’“”•–—˜™š›œ\x9džŸ';
  for (let b = 0; b < 256; b++) m.set(b >= 0x80 && b < 0xa0 ? c1[b - 0x80] : String.fromCharCode(b), b);
  return m;
})();
const octetsEn = (texte, cs = 'utf-8') => (/^utf-?8$/i.test(cs) ? Buffer.from(texte, 'utf8')
  : Buffer.from([...texte].map(ch => { const b = CP1252.get(ch); if (b == null) throw new Error(`« ${ch} » n’existe pas en ${cs}`); return b; })));
const huitBits = (texte, cs = 'utf-8') => octetsEn(texte.replace(/\r?\n/g, '\r\n'), cs).toString('latin1'); // un corps 8bit, une chaîne binaire
const hex = x => `=${x.toString(16).toUpperCase().padStart(2, '0')}`;
function enQP(texte, cs = 'utf-8') { // quoted-printable, lignes de 76 au plus, coupures douces
  const out = [];
  for (const l of texte.split(/\r?\n/)) {
    const b = octetsEn(l, cs); let ligne = '';
    b.forEach((x, i) => {
      const fin = i === b.length - 1, t = ((x >= 33 && x <= 126 && x !== 61) || ((x === 32 || x === 9) && !fin)) ? String.fromCharCode(x) : hex(x);
      if (ligne.length + t.length > 75) { out.push(`${ligne}=`); ligne = ''; }
      ligne += t;
    });
    out.push(ligne);
  }
  return out.join('\r\n');
}
const enBase64 = b => Buffer.from(b).toString('base64').replace(/.{76}/g, '$&\r\n');
const motQ = (t, cs = 'UTF-8') => `=?${cs}?Q?${[...octetsEn(t, cs)].map(x => (x === 32 ? '_' : x >= 33 && x <= 126 && !'=?_'.includes(String.fromCharCode(x)) ? String.fromCharCode(x) : hex(x))).join('')}?=`;
const motB = t => `=?UTF-8?B?${Buffer.from(t).toString('base64')}?=`;
const motBCoupe = (t, n) => { const b = Buffer.from(t); return `=?UTF-8?B?${b.subarray(0, n).toString('base64')}?=\r\n =?UTF-8?B?${b.subarray(n).toString('base64')}?=`; }; // un « é » coupé en deux
const tete = entetes => entetes.filter(([, v]) => v != null).map(([n, v]) => `${n}: ${v}`).join('\r\n');
const partie = (entetes, corps) => `${tete(entetes)}\r\n\r\n${corps}`;
const multipart = (frontiere, parties) => `${parties.map(p => `--${frontiere}\r\n${p}`).join('\r\n')}\r\n--${frontiere}--\r\n`;
const texteQP = (texte, cs = 'UTF-8', extra = '') => partie([['Content-Type', `text/plain; charset="${cs}"${extra}`], ['Content-Transfer-Encoding', 'quoted-printable']], `${enQP(texte, cs)}\r\n`);
const htmlQP = (html, cs = 'UTF-8') => partie([['Content-Type', `text/html; charset="${cs}"`], ['Content-Transfer-Encoding', 'quoted-printable']], `${enQP(html, cs)}\r\n`);
const enB64 = (type, texte, cs = 'UTF-8') => partie([['Content-Type', `${type}; charset="${cs}"`], ['Content-Transfer-Encoding', 'base64']], `${enBase64(octetsEn(texte, cs))}\r\n`);
const fauxFichier = (n, graine) => { const b = Buffer.alloc(n); let x = graine; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; b[i] = x >>> 24; } return b; };

const MOI = 'Camille Martin <camille.martin@example.com>', NNBSP = ' ';
const entetesDe = ({ id, date, de = MOI, a, sujet, type, autres = [] }) => [['MIME-Version', '1.0'], ['Date', date], ['Message-ID', `<${id}.x7f3@mail.example.com>`],
  ['Subject', sujet], ['From', de], ['To', a], ...autres, ['Content-Type', type]];

/* ═════════ Le corpus : trois jours de Camille ═════════ */

const CITE_HTML = 'style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex"';
const CORPUS = [];
const ajouter = m => CORPUS.push(m);

// M01 : réponse Gmail en français, multipart/alternative, quoted-printable UTF-8, signature « -- », réponse citée
{
  const texte = `Bonjour Jeanne,

Oui pour samedi ! On pourrait pique-niquer au bord de la rivière, sous les saules, s'il ne pleut pas. J'apporterai la nappe à carreaux et une tarte aux prunes.

À samedi,
Camille

--
Camille Martin
Bibliothécaire, médiathèque des Tilleuls

Le lun. 5 oct. 2026 à 18:42, Jeanne Durand <jeanne.durand@example.org> a écrit${NNBSP}:

> Tu es libre ce week-end ? Il paraît qu'on verra les montgolfières
> au-dessus du VOLCAN.
>
`;
  const html = `<div dir="ltr">Bonjour Jeanne,<div><br></div><div>Oui pour samedi&nbsp;! On pourrait pique-niquer au bord de la rivière, sous les saules, s&#39;il ne pleut pas. J&#39;apporterai la nappe à carreaux et une tarte aux prunes.</div><div><br></div><div>À samedi,</div><div>Camille</div><div><br></div><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">Camille Martin<br>Bibliothécaire, médiathèque des Tilleuls</div></div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">Le lun. 5 oct. 2026 à 18:42, Jeanne Durand &lt;<a href="mailto:jeanne.durand@example.org">jeanne.durand@example.org</a>&gt; a écrit&nbsp;:<br></div><blockquote class="gmail_quote" ${CITE_HTML}>Tu es libre ce week-end ? Il paraît qu&#39;on verra les montgolfières au-dessus du VOLCAN.</blockquote></div>`;
  ajouter({ id: 'm01', jour: '2026-10-06', labels: 'Messages envoyés,Ouvert', quoi: 'Gmail FR, réponse, QP UTF-8, alternative',
    brut: `${tete(entetesDe({ id: 'm01', date: 'Tue, 6 Oct 2026 08:12:31 +0200', a: 'Jeanne Durand <jeanne.durand@example.org>', sujet: `Re: Pique-nique ${motQ('à la rivière')}`, type: 'multipart/alternative; boundary="000000000000a1b2c3d4e5f60001"' }))}\r\n\r\n` +
      multipart('000000000000a1b2c3d4e5f60001', [texteQP(texte), htmlQP(html)]),
    exact: 'Oui pour samedi ! On pourrait pique-niquer au bord de la rivière, sous les saules, s\'il ne pleut pas. J\'apporterai la nappe à carreaux et une tarte aux prunes.\n\nÀ samedi,',
    sujet: 'Re: Pique-nique à la rivière', jamais: ['montgolfières', 'Bibliothécaire', 'a écrit', 'jeanne.durand@', '\nCamille'], html: true });
}
// M02 : iPhone, text/plain format=flowed en base64, « Envoyé de mon iPhone », attribution citée elle aussi
{
  const texte = 'Coucou Paul,\n\nLa fuite sous l’évier de la cuisine a repris cette nuit, il y a une flaque \nprès du lave-vaisselle. Tu pourrais passer jeudi matin avec ta caisse à \noutils ?\n\nEnvoyé de mon iPhone\n\n> Le 5 oct. 2026 à 21:03, Paul Lefèvre <paul.lefevre@example.net> a écrit :\n> \n> Besoin d’un coup de main pour monter la GIRAFE en kit ?\n';
  ajouter({ id: 'm02', jour: '2026-10-06', labels: 'Messages envoyés', quoi: 'iPhone, flowed, base64',
    brut: partie([...entetesDe({ id: 'm02', date: 'Tue, 6 Oct 2026 07:58:12 +0200', a: 'Paul Lefèvre <paul.lefevre@example.net>', sujet: 'Re: Fuite', type: 'text/plain;\r\n\tcharset=utf-8;\r\n\tformat=flowed', autres: [['X-Mailer', 'iPhone Mail (23A341)']] }), ['Content-Transfer-Encoding', 'base64']], `${enBase64(octetsEn(texte.replace(/\n/g, '\r\n')))}\r\n`),
    exact: 'La fuite sous l’évier de la cuisine a repris cette nuit, il y a une flaque près du lave-vaisselle. Tu pourrais passer jeudi matin avec ta caisse à outils ?',
    jamais: ['iPhone', 'a écrit', 'coup de main'] });
}
// M03 : Outlook, Windows-1252 en quoted-printable, « Cordialement » + signature, avertissement juridique, « De : … Envoyé : … »
{
  const texte = `Bonjour Paul,

Je confirme la réunion de vendredi au bureau : j’apporterai le dossier du projet, la maquette en carton et des croissants.

Cordialement,

Camille Martin
Chargée de projet | Médiathèque des Tilleuls
Tél. : 01 23 45 67 89

Ce message et ses pièces jointes sont confidentiels et destinés exclusivement à leurs destinataires. Si vous l’avez reçu par erreur, merci de le supprimer et d’en avertir l’expéditeur. Toute diffusion non autorisée est interdite (ZEPPELIN).

De : Paul Lefèvre <paul.lefevre@example.net>
Envoyé : lundi 5 octobre 2026 09:12
À : Camille Martin <camille.martin@example.com>
Objet : Réunion de vendredi

Peux-tu confirmer vendredi pour la réunion du KANGOUROU ?
`;
  const html = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=Windows-1252"><style>p{margin:0}</style></head><body><div class="elementToProof">Bonjour Paul,</div><div class="elementToProof"><br></div><div class="elementToProof">Je confirme la réunion de vendredi au bureau : j’apporterai le dossier du projet, la maquette en carton et des croissants.</div><div class="elementToProof"><br></div><div class="elementToProof">Cordialement,</div><div id="Signature"><p>Camille Martin<br>Chargée de projet | Médiathèque des Tilleuls<br>Tél. : 01 23 45 67 89</p></div><p style="font-size:8pt">Ce message et ses pièces jointes sont confidentiels et destinés exclusivement à leurs destinataires. Si vous l’avez reçu par erreur, merci de le supprimer et d’en avertir l’expéditeur. Toute diffusion non autorisée est interdite (ZEPPELIN).</p><hr style="display:inline-block;width:98%"><div id="divRplyFwdMsg" dir="ltr"><b>De :</b> Paul Lefèvre &lt;paul.lefevre@example.net&gt;<br><b>Envoyé :</b> lundi 5 octobre 2026 09:12<br><b>À :</b> Camille Martin<br><b>Objet :</b> Réunion de vendredi</div><div>Peux-tu confirmer vendredi pour la réunion du KANGOUROU ?</div></body></html>';
  ajouter({ id: 'm03', jour: '2026-10-06', labels: 'Messages envoyés', quoi: 'Outlook, Windows-1252 QP, avertissement',
    brut: `${tete(entetesDe({ id: 'm03', date: 'Tue, 6 Oct 2026 14:05:44 +0200', a: 'Paul Lefèvre <paul.lefevre@example.net>', sujet: motQ('RE: Réunion de vendredi', 'Windows-1252'), type: 'multipart/alternative;\r\n\tboundary="_000_PAXPR03MB0001_"', autres: [['Thread-Topic', motQ('Réunion de vendredi', 'Windows-1252')], ['Content-Language', 'fr-FR']] }))}\r\n\r\n` +
      multipart('_000_PAXPR03MB0001_', [texteQP(texte, 'Windows-1252'), htmlQP(html, 'Windows-1252')]),
    exact: 'Je confirme la réunion de vendredi au bureau : j’apporterai le dossier du projet, la maquette en carton et des croissants.',
    sujet: 'RE: Réunion de vendredi', jamais: ['Cordialement', 'Chargée de projet', '01 23 45', 'confidentiels', 'Peux-tu'], html: true, texteEnPieceJointe: true });
}
// M04 : réponse Gmail en anglais, attribution coupée sur deux lignes, espace fine insécable avant PM, « Best regards »
{
  const texte = `Hi Sam,

Thanks, the old lighthouse by the harbour was beautiful at sunset, and the
gulls followed the fishing boats all the way back.

Best regards,
Camille

On Mon, Oct 5, 2026 at 6:42${NNBSP}PM Sam Taylor <sam.taylor@example.org>
wrote:

> Did you see the TROMBONE festival on the pier?
`;
  const html = `<div dir="ltr">Hi Sam,<div><br></div><div>Thanks, the old lighthouse by the harbour was beautiful at sunset, and the gulls followed the fishing boats all the way back.</div><div><br></div><div>Best regards,</div><div>Camille</div></div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On Mon, Oct 5, 2026 at 6:42${NNBSP}PM Sam Taylor &lt;<a href="mailto:sam.taylor@example.org">sam.taylor@example.org</a>&gt; wrote:<br></div><blockquote class="gmail_quote" ${CITE_HTML}>Did you see the TROMBONE festival on the pier?</blockquote></div>`;
  ajouter({ id: 'm04', jour: '2026-10-06', labels: 'Sent,Opened', quoi: 'Gmail EN, réponse, attribution sur 2 lignes',
    brut: `${tete(entetesDe({ id: 'm04', date: 'Tue, 6 Oct 2026 18:51:02 +0200', a: 'Sam Taylor <sam.taylor@example.org>', sujet: 'Re: The lighthouse', type: 'multipart/alternative; boundary="000000000000a1b2c3d4e5f60004"' }))}\r\n\r\n` +
      multipart('000000000000a1b2c3d4e5f60004', [texteQP(texte), htmlQP(html)]),
    exact: 'Thanks, the old lighthouse by the harbour was beautiful at sunset, and the\ngulls followed the fishing boats all the way back.',
    jamais: ['wrote', 'Best regards', 'sam.taylor@', 'pier'], html: true });
}
// M05 : transfert Gmail, multipart/mixed avec une photo jointe
{
  const texte = `Regarde les photos du jardin de mamie : les dahlias sont magnifiques cette année, et le vieux pommier croule sous les fruits.

---------- Forwarded message ---------
De : Odette Martin <odette.martin@example.fr>
Date: lun. 5 oct. 2026 à 17:03
Subject: Le jardin
To: Camille Martin <camille.martin@example.com>


Mes chéris, voici le jardin, la glycine a encore poussé près du KAYAK.
`;
  const html = '<div dir="ltr">Regarde les photos du jardin de mamie : les dahlias sont magnifiques cette année, et le vieux pommier croule sous les fruits.<br><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De&nbsp;: <strong class="gmail_sendername" dir="auto">Odette Martin</strong> <span dir="auto">&lt;<a href="mailto:odette.martin@example.fr">odette.martin@example.fr</a>&gt;</span><br>Date: lun. 5 oct. 2026 à 17:03<br>Subject: Le jardin<br>To: Camille Martin &lt;<a href="mailto:camille.martin@example.com">camille.martin@example.com</a>&gt;<br></div><br><br><div dir="ltr">Mes chéris, voici le jardin, la glycine a encore poussé près du KAYAK.</div></div></div>';
  const photo = partie([['Content-Type', 'image/jpeg; name="jardin.jpg"'], ['Content-Disposition', 'attachment; filename="jardin.jpg"'], ['Content-Transfer-Encoding', 'base64'], ['X-Attachment-Id', 'f_m5']],
    `${enBase64(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), fauxFichier(3000, 5)]))}\r\n`);
  ajouter({ id: 'm05', jour: '2026-10-06', labels: 'Messages envoyés', quoi: 'Gmail, transfert + photo jointe',
    brut: `${tete(entetesDe({ id: 'm05', date: 'Tue, 6 Oct 2026 12:45:09 +0200', a: 'Léo Bernard <leo.bernard@example.net>', sujet: 'Fwd: Le jardin', type: 'multipart/mixed; boundary="000000000000f00d0005"' }))}\r\n\r\n` +
      multipart('000000000000f00d0005', [partie([['Content-Type', 'multipart/alternative; boundary="000000000000f00d0005a"']], multipart('000000000000f00d0005a', [texteQP(texte), htmlQP(html)])), photo]),
    exact: 'Regarde les photos du jardin de mamie : les dahlias sont magnifiques cette année, et le vieux pommier croule sous les fruits.',
    jamais: ['glycine', 'Forwarded', 'Odette', 'chéris'], html: true });
}
// M06 : HTML seul, ISO-8859-1 en quoted-printable, citation Gmail en blockquote, signature en div
{
  const html = '<html><body><p>Bonjour Madame Roux,</p><p>Je vous rapporte demain les trois livres de la biblioth&egrave;que, dont le roman sur les phares de Bretagne. Mon fils a adoré l\'album sur les baleines et le petit bateau rouge.</p><p>Bien &agrave; vous,</p><div class="gmail_signature">Camille Martin<br>06 12 34 56 78</div><div class="gmail_quote"><div class="gmail_attr">Le mar. 6 oct. 2026 &agrave; 16:20, Claire Roux &lt;claire.roux@example.org&gt; a &eacute;crit&nbsp;:<br></div><blockquote class="gmail_quote">Les livres sont en retard depuis le passage du MAMMOUTH.</blockquote></div></body></html>';
  ajouter({ id: 'm06', jour: '2026-10-07', labels: 'Messages envoyés', quoi: 'HTML seul, ISO-8859-1 QP', forme: 'html',
    brut: `${tete(entetesDe({ id: 'm06', date: 'Wed, 7 Oct 2026 09:30:00 +0200', a: 'Claire Roux <claire.roux@example.org>', sujet: 'Re: Livres en retard', type: 'text/html; charset=ISO-8859-1', autres: [['Content-Transfer-Encoding', 'quoted-printable']] }))}\r\n\r\n${enQP(html, 'ISO-8859-1')}\r\n`,
    exact: 'Je vous rapporte demain les trois livres de la bibliothèque, dont le roman sur les phares de Bretagne. Mon fils a adoré l\'album sur les baleines et le petit bateau rouge.',
    jamais: ['Bien à vous', '06 12 34', 'a écrit', 'en retard'] });
}
// M07 : Outlook en anglais, texte seul, « Kind regards », CONFIDENTIALITY NOTICE, « -----Original Message----- »
{
  const texte = `Hello Ms Chen,

Please find below the plan for the garden workshop: we will plant tulip bulbs along the fence and build a small wooden bench near the pond.

Kind regards,
Camille Martin
Médiathèque des Tilleuls

CONFIDENTIALITY NOTICE: This e-mail and any attachments are confidential and intended solely for the addressee. If you have received it in error, please delete it (ACCORDEON).

-----Original Message-----
From: Lin Chen <lin.chen@example.org>
Sent: Tuesday, October 6, 2026 4:15 PM
To: Camille Martin <camille.martin@example.com>
Subject: Garden workshop

Could you send the plan for the PELICAN workshop?
`;
  ajouter({ id: 'm07', jour: '2026-10-07', labels: 'Sent', quoi: 'Outlook EN, Original Message, notice',
    brut: `${tete(entetesDe({ id: 'm07', date: 'Wed, 7 Oct 2026 11:02:17 +0200', a: 'Lin Chen <lin.chen@example.org>', sujet: 'RE: Garden workshop', type: 'text/plain; charset="utf-8"', autres: [['Content-Transfer-Encoding', 'quoted-printable']] }))}\r\n\r\n${enQP(texte)}\r\n`,
    exact: 'Please find below the plan for the garden workshop: we will plant tulip bulbs along the fence and build a small wooden bench near the pond.',
    jamais: ['Kind regards', 'CONFIDENTIALITY', 'Original Message', 'Could you'] });
}
// M08 : nouveau mail, ISO-8859-1 en 8bit, sujet encodé (à soi : il vient en tête de la page), « Bises »
{
  const texte = 'Coucou maman,\n\nPour dimanche, je m\'occupe du dessert : une tarte aux pommes et des crêpes. Papa pourra allumer le feu dans la cheminée si le vent souffle encore.\n\nBises,\nCamille\n';
  ajouter({ id: 'm08', jour: '2026-10-05', labels: 'Messages envoyés', quoi: 'nouveau mail, ISO-8859-1 8bit',
    brut: `${tete(entetesDe({ id: 'm08', date: 'Mon, 5 Oct 2026 19:20:00 +0200', a: 'Maman <helene.martin@example.fr>', sujet: '=?ISO-8859-1?Q?D=EEner_de_dimanche?=', type: 'text/plain; charset=ISO-8859-1; format=flowed', autres: [['Content-Transfer-Encoding', '8bit']] }))}\r\n\r\n${huitBits(texte, 'ISO-8859-1')}`,
    exact: 'Pour dimanche, je m\'occupe du dessert : une tarte aux pommes et des crêpes. Papa pourra allumer le feu dans la cheminée si le vent souffle encore.',
    sujet: 'Dîner de dimanche', sujetASoi: true, jamais: ['Bises'] });
}
// M09 : un mail REÇU : rien ne doit en rester, pas même en mémoire
ajouter({ id: 'm09', jour: '2026-10-06', labels: 'Boîte de réception,Ouvert', recu: true, quoi: 'mail reçu',
  brut: `${tete(entetesDe({ id: 'm09', date: 'Tue, 6 Oct 2026 10:00:00 +0200', de: 'Jeanne Durand <jeanne.durand@example.org>', a: MOI, sujet: 'Au port', type: 'text/plain; charset=utf-8', autres: [['Content-Transfer-Encoding', '8bit']] }))}\r\n\r\n${huitBits('Coucou ! J\'ai vu un BALEINEAU au port ce matin, viens vite.\n')}` });
// M10 : une réponse automatique, partie de la boîte de Camille
ajouter({ id: 'm10', jour: '2026-10-05', labels: 'Messages envoyés', ignore: 'automatique', quoi: 'réponse automatique',
  brut: `${tete(entetesDe({ id: 'm10', date: 'Mon, 5 Oct 2026 08:00:00 +0200', a: 'Lin Chen <lin.chen@example.org>', sujet: motQ('Réponse automatique : Absente'), type: 'text/plain; charset=utf-8', autres: [['Auto-Submitted', 'auto-replied'], ['Content-Transfer-Encoding', '8bit']] }))}\r\n\r\n${huitBits('Je suis absente jusqu\'au 12 octobre. OCTOPUS\n')}` });
// M11 : une réponse d’agenda (« Accepté : … »), avec sa partie text/calendar
ajouter({ id: 'm11', jour: '2026-10-07', labels: 'Messages envoyés', ignore: 'automatique', quoi: 'réponse d’agenda',
  brut: `${tete(entetesDe({ id: 'm11', date: 'Wed, 7 Oct 2026 08:05:00 +0200', a: 'cabinet.dentaire@example.com', sujet: motQ('Accepté : Dentiste @ mer. 14 oct. 2026'), type: 'multipart/alternative; boundary="cal11"' }))}\r\n\r\n` +
    multipart('cal11', [texteQP('Camille Martin a accepté cette invitation. SQUID\n'), partie([['Content-Type', 'text/calendar; charset="UTF-8"; method=REPLY'], ['Content-Transfer-Encoding', '7bit']], 'BEGIN:VCALENDAR\r\nMETHOD:REPLY\r\nBEGIN:VEVENT\r\nSUMMARY:Dentiste SQUID\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n')]) });
// M12 : Apple Mail (macOS) en anglais, juste après minuit : le jour est celui de l’horloge de l’en-tête
{
  const texte = 'Dear Sam,\n\nI couldn’t sleep, so I walked to the beach under the full moon and listened to the waves on the pebbles.\n\nLove,\nCamille\n\n> On Oct 6, 2026, at 21:40, Sam Taylor <sam.taylor@example.org> wrote:\n> \n> Are you still awake? The NARWHAL documentary is on.\n';
  const html = '<html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"></head><body style="overflow-wrap: break-word; -webkit-nbsp-mode: space;"><div>Dear Sam,</div><div><br></div><div>I couldn’t sleep, so I walked to the beach under the full moon and listened to the waves on the pebbles.</div><div><br></div><div>Love,</div><div>Camille</div><div><br><blockquote type="cite"><div>On Oct 6, 2026, at 21:40, Sam Taylor &lt;sam.taylor@example.org&gt; wrote:</div><br class="Apple-interchange-newline"><div><div>Are you still awake? The NARWHAL documentary is on.</div></div></blockquote></div></body></html>';
  ajouter({ id: 'm12', jour: '2026-10-07', labels: 'Sent', quoi: 'Apple Mail EN, 00:20 +0200',
    brut: `${tete(entetesDe({ id: 'm12', date: 'Wed, 7 Oct 2026 00:20:00 +0200', a: 'Sam Taylor <sam.taylor@example.org>', sujet: 'Re: Still awake?', type: 'multipart/alternative;\r\n\tboundary="Apple-Mail=_5C1E6F0A-0012"', autres: [['X-Mailer', 'Apple Mail (2.3826)']] }))}\r\n\r\n` +
      multipart('Apple-Mail=_5C1E6F0A-0012', [texteQP(texte, 'utf-8'), htmlQP(html, 'utf-8')]),
    exact: 'I couldn’t sleep, so I walked to the beach under the full moon and listened to the waves on the pebbles.',
    jamais: ['Love', 'wrote', 'awake'], html: true });
}
// M13 : réponse Gmail, corps en base64, sujet en deux mots encodés qui coupent un « é », attribution sur deux lignes
{
  const texte = `Salut Léo,

Le vélo est réparé : nouvelle chaîne, pneus gonflés, et un panier en osier à l’avant pour aller au marché samedi.

Bonne journée,
Camille

Le mer. 7 oct. 2026 à 10:02, Léo Bernard <leo.bernard@example.net> a
écrit${NNBSP}:

> Il est prêt, le vélo ? Le PANGOLIN attend.
`;
  const html = `<div dir="ltr"><div>Salut Léo,</div><div><br></div><div>Le vélo est réparé : nouvelle chaîne, pneus gonflés, et un panier en osier à l’avant pour aller au marché samedi.</div><div><br></div><div>Bonne journée,</div><div>Camille</div></div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">Le mer. 7 oct. 2026 à 10:02, Léo Bernard &lt;<a href="mailto:leo.bernard@example.net">leo.bernard@example.net</a>&gt; a écrit${NNBSP}:<br></div><blockquote class="gmail_quote" ${CITE_HTML}>Il est prêt, le vélo ? Le PANGOLIN attend.</blockquote></div>`;
  ajouter({ id: 'm13', jour: '2026-10-07', labels: 'Messages envoyés', quoi: 'Gmail FR, base64, sujet coupé',
    brut: `${tete(entetesDe({ id: 'm13', date: 'Wed, 7 Oct 2026 13:15:40 +0200', a: 'Léo Bernard <leo.bernard@example.net>', sujet: motBCoupe('Re: Le vélo réparé', 9), type: 'multipart/alternative; boundary="000000000000a1b2c3d4e5f60013"' }))}\r\n\r\n` +
      multipart('000000000000a1b2c3d4e5f60013', [enB64('text/plain', texte.replace(/\n/g, '\r\n')), enB64('text/html', html)]),
    exact: 'Le vélo est réparé : nouvelle chaîne, pneus gonflés, et un panier en osier à l’avant pour aller au marché samedi.',
    sujet: 'Re: Le vélo réparé', jamais: ['Bonne journée', 'a écrit', 'prêt'], html: true });
}
// M14 : Outlook pour Android, UTF-8 en 8bit, sujet en base64, « Obtenir Outlook pour Android »
{
  const texte = 'Salut Inès,\n\nPour la crémaillère, je prends le pain, les fromages et deux bouquets de tournesols. Il faudra aussi des bougies pour le balcon.\n\nObtenir Outlook pour Android\n';
  ajouter({ id: 'm14', jour: '2026-10-05', labels: 'Messages envoyés', quoi: 'Outlook Android, UTF-8 8bit',
    brut: `${tete(entetesDe({ id: 'm14', date: 'Mon, 5 Oct 2026 12:30:05 +0200', a: 'Inès Moreau <ines.moreau@example.org>', sujet: motB('Courses pour la crémaillère'), type: 'text/plain; charset="utf-8"', autres: [['Content-Transfer-Encoding', '8bit']] }))}\r\n\r\n${huitBits(texte)}`,
    exact: 'Pour la crémaillère, je prends le pain, les fromages et deux bouquets de tournesols. Il faudra aussi des bougies pour le balcon.',
    sujet: 'Courses pour la crémaillère', sujetASoi: true, jamais: ['Outlook'] });
}
// M15 : en anglais, texte brut, une ligne qui commence par « From » (échappée « >From » dans la boîte), réponse entrelacée
{
  const texte = 'Hi Lin,\n\nFrom the window of the reading room I can see the old oak in the courtyard, its leaves turning red.\n\n> Shall we hold the OSTRICH workshop indoors?\nYes, indoors, by the big fireplace.\n\nCheers,\nCamille\n';
  ajouter({ id: 'm15', jour: '2026-10-07', labels: 'Sent', quoi: 'EN, « From » en début de ligne, entrelacé',
    brut: `${tete(entetesDe({ id: 'm15', date: 'Wed, 7 Oct 2026 17:40:00 +0200', a: 'Lin Chen <lin.chen@example.org>', sujet: 'Re: Workshop venue', type: 'text/plain; charset=us-ascii', autres: [['Content-Transfer-Encoding', '7bit']] }))}\r\n\r\n${huitBits(texte)}`,
    exact: 'From the window of the reading room I can see the old oak in the courtyard, its leaves turning red.\n\nYes, indoors, by the big fireplace.',
    jamais: ['Cheers', 'Shall we'] });
}
// M16 : sans étiquettes Gmail (une vieille boîte) : reconnu par l’adresse ; un PDF (nom en RFC 2231) et un mail joint
{
  const texte = 'Bonsoir à tous,\n\nVoici le compte rendu de l\'atelier d\'écriture : nous avons lu des poèmes sur la neige, la forêt et les loups, puis chacun a écrit une lettre à un arbre.\n\nAmicalement,\nCamille\n';
  const pdf = partie([['Content-Type', 'application/pdf'], ['Content-Disposition', 'attachment;\r\n filename*=UTF-8\'\'compte%20rendu%20%C3%A9crit.pdf'], ['Content-Transfer-Encoding', 'base64']], `${enBase64(Buffer.concat([Buffer.from('%PDF-1.7\n'), fauxFichier(2000, 16)]))}\r\n`);
  const joint = partie([['Content-Type', 'message/rfc822'], ['Content-Disposition', 'attachment; filename="ancien.eml"']], 'From: Lin Chen <lin.chen@example.org>\r\nSubject: Minutes\r\nContent-Type: text/plain\r\n\r\nThe WALRUS minutes, as promised.\r\n');
  ajouter({ id: 'm16', jour: '2026-10-05', labels: null, quoi: 'sans étiquettes, PDF + mail joint',
    brut: `${tete(entetesDe({ id: 'm16', date: 'Mon, 5 Oct 2026 21:10:00 +0200', a: 'atelier@example.org', sujet: motQ('Compte rendu de l\'atelier d\'écriture'), type: 'multipart/mixed; boundary="----=_Part_16"' }))}\r\n\r\n` +
      multipart('----=_Part_16', [texteQP(texte), pdf, joint]),
    exact: 'Voici le compte rendu de l\'atelier d\'écriture : nous avons lu des poèmes sur la neige, la forêt et les loups, puis chacun a écrit une lettre à un arbre.',
    sujet: 'Compte rendu de l\'atelier d\'écriture', sujetASoi: true, jamais: ['Amicalement', 'minutes'] });
}
// M17 : un brouillon : pas envoyé, rien ne doit en venir
ajouter({ id: 'm17', jour: '2026-10-07', labels: 'Brouillons', brouillon: true, quoi: 'brouillon',
  brut: `${tete(entetesDe({ id: 'm17', date: 'Wed, 7 Oct 2026 20:00:00 +0200', a: 'Léo Bernard <leo.bernard@example.net>', sujet: 'Idée', type: 'text/plain; charset=utf-8', autres: [['Content-Transfer-Encoding', '8bit']] }))}\r\n\r\n${huitBits('Brouillon pas fini : le FLAMANT rose du parc…\n')}` });

const TEMOINS = ['VOLCAN', 'GIRAFE', 'ZEPPELIN', 'KANGOUROU', 'TROMBONE', 'KAYAK', 'MAMMOUTH', 'ACCORDEON', 'PELICAN', 'BALEINEAU', 'OCTOPUS', 'SQUID', 'NARWHAL', 'PANGOLIN', 'OSTRICH', 'WALRUS', 'FLAMANT'];
const GARDES = CORPUS.filter(m => !m.recu && !m.brouillon && !m.ignore);
for (const m of CORPUS) { m.instant = X.dateDuMail(/\r\nDate: ([^\r]+)/.exec(m.brut)[1]).instant; assert.ok(!/[^\x00-\xff]/.test(m.brut), `${m.id} : un mail brut est fait d’octets`); }
const sansTemoin = (t, ou) => { for (const w of TEMOINS) assert.ok(!t.includes(w), `${ou} : le mot-témoin ${w} est resté`); };
const enBinaireTest = s => Buffer.from(s, 'utf8').toString('latin1');
const egalSouple = (a, b) => assert.equal(a.replace(/[’']/g, '\'').replace(/\s+/g, ' ').trim(), b.replace(/[’']/g, '\'').replace(/\s+/g, ' ').trim());

/* ═════════ 1. extraire.js : chaque mail, seul ═════════ */

console.log(`Le corpus : ${CORPUS.length} mails inventés (${GARDES.length} envoyés qui comptent, 1 reçu, 1 brouillon, 1 réponse automatique, 1 réponse d’agenda)`);
console.log('\n1. extraire.js : les mots à soi, mail par mail');
const extraitsBruts = new Map();
for (const m of CORPUS.filter(m => !m.recu && !m.brouillon)) {
  await verifier(`${m.id} ${m.quoi}`, () => {
    const x = X.extraire(m.brut);
    extraitsBruts.set(m.id, x);
    assert.equal(x.date, m.jour, 'le jour');
    assert.equal(x.de?.adresse, 'camille.martin@example.com');
    if (m.ignore) { assert.equal(x.ignore, m.ignore); assert.equal(x.texte, ''); return; }
    assert.equal(x.ignore, null, `ignoré : ${x.ignore}`);
    assert.equal(x.texte, m.exact);
    assert.equal(x.forme, m.forme || 'texte');
    if (m.sujet) assert.equal(x.sujet, m.sujet);
    assert.equal(x.sujetASoi, !!m.sujetASoi);
    for (const j of m.jamais || []) assert.ok(!x.texte.includes(j), `« ${j} » est resté`);
    sansTemoin(x.texte, m.id);
  });
}
await verifier('le HTML (preferer: \'html\') donne les mêmes mots que le texte brut, mail par mail', () => {
  for (const m of CORPUS.filter(m => m.html)) { const x = X.extraire(m.brut, { preferer: 'html' }); assert.equal(x.forme, 'html', m.id); egalSouple(x.texte, m.exact); }
});
await verifier('la salutation d’ouverture : retirée (elle porte le nom de l’autre), gardée sur demande', () => {
  const m01 = CORPUS.find(m => m.id === 'm01');
  assert.equal(X.extraire(m01.brut, { salutation: true }).texte, `Bonjour Jeanne,\n\n${m01.exact}`);
  assert.equal(X.nettoyer('Salut Léo, le vélo est prêt.'), 'Salut Léo, le vélo est prêt.'); // une phrase, pas une formule
  assert.equal(X.nettoyer('Coucou !\nOn part demain.'), 'On part demain.');
});
await verifier('le jour local : celui de l’en-tête, ou ramené à un fuseau', () => {
  const m12 = CORPUS.find(m => m.id === 'm12').brut;
  assert.equal(X.extraire(m12).date, '2026-10-07');
  assert.equal(X.extraire(m12, { fuseau: 'Europe/Paris' }).date, '2026-10-07');
  assert.equal(X.extraire(m12, { fuseau: 'America/New_York' }).date, '2026-10-06');
  assert.deepEqual(X.dateDuMail('Tue, 6 Oct 2026 23:50:00 +0200 (CEST)'), { instant: Date.parse('2026-10-06T21:50:00Z'), jour: '2026-10-06', decalage: 120 });
  assert.equal(X.dateDuMail('6 Oct 26 10:00 GMT').jour, '2026-10-06');
  assert.equal(X.dateDuMail('Mon, 5 Oct 2026 23:30:00 -0700').instant, Date.parse('2026-10-06T06:30:00Z'));
});
await verifier('les en-têtes : RFC 2047 (Q, B, un caractère coupé entre deux mots), RFC 2231, UTF-8 nu', () => {
  assert.equal(X.decoderEntete('=?UTF-8?B?UmU6IExlIHbD?=\r\n =?UTF-8?B?qWxvIHLDqXBhcsOp?='.replace(/\r\n/g, ' ')), 'Re: Le vélo réparé');
  assert.equal(X.decoderEntete('=?iso-8859-1?q?caf=E9?= et =?utf-8?q?cr=C3=A8me?='), 'café et crème');
  assert.equal(X.decoderEntete(Buffer.from('Messages envoyés', 'utf8').toString('latin1')), 'Messages envoyés');
  assert.equal(X.parametres('attachment; filename*=UTF-8\'\'compte%20rendu%20%C3%A9crit.pdf').p.filename, 'compte rendu écrit.pdf');
  assert.equal(X.parametres('attachment; name*0="un "; name*1*=%C3%A9t%C3%A9').p.name, 'un été');
});
await verifier('un fichier texte joint « inline » (Apple Mail) n’est pas pris pour le corps du mail', () => {
  const brut = `${tete(entetesDe({ id: 'pj', date: 'Wed, 7 Oct 2026 10:00:00 +0200', a: 'x@example.org', sujet: 'Notes', type: 'multipart/mixed; boundary="am"' }))}\r\n\r\n` +
    multipart('am', [texteQP('Voici mes notes sur la promenade au lac.\n'), partie([['Content-Type', 'text/plain; name="notes.txt"'], ['Content-Disposition', 'inline; filename="notes.txt"']], 'Notes de quelqu’un d’autre : TAPIR.\r\n')]);
  assert.equal(X.extraire(enBinaireTest(brut)).texte, 'Voici mes notes sur la promenade au lac.');
});
await verifier('format=flowed : les lignes souples se recollent, la signature « -- » reste à part', () => {
  assert.equal(X.deplier('Une ligne \nqui continue.\n-- \nCamille'), 'Une ligne qui continue.\n-- \nCamille');
  assert.equal(X.deplier('> cité \n> encore\nà moi'), '> cité encore\nà moi');
});
await verifier('un message de l’API Gmail écrit à la main, comme dans la documentation (format=full)', () => {
  const b64url = t => Buffer.from(t, 'utf8').toString('base64url');
  const message = { id: '19a6b2c3d4e5f601', threadId: '19a6b2c3d4e5f601', labelIds: ['SENT'], internalDate: String(Date.parse('2026-10-07T07:00:00Z')),
    payload: { partId: '', mimeType: 'multipart/alternative', filename: '', headers: [{ name: 'From', value: 'Camille Martin <camille.martin@example.com>' }, { name: 'Date', value: 'Wed, 7 Oct 2026 09:00:00 +0200' }, { name: 'Subject', value: 'Les châtaignes' }],
      body: { size: 0 }, parts: [
        { partId: '0', mimeType: 'text/plain', filename: '', headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }, { name: 'Content-Transfer-Encoding', value: 'quoted-printable' }], body: { size: 80, data: b64url('On a ramassé des châtaignes dans le bois, les mains toutes noires.\r\n\r\nBisous,\r\nCamille\r\n') } },
        { partId: '1', mimeType: 'text/html', filename: '', headers: [{ name: 'Content-Type', value: 'text/html; charset="UTF-8"' }], body: { size: 90, data: b64url('<div>On a ramassé des châtaignes dans le bois, les mains toutes noires.</div><div><br></div><div>Bisous,</div><div>Camille</div>') } }] } };
  const x = X.extraire(message);
  assert.equal(x.origine, 'api-full'); assert.equal(x.date, '2026-10-07'); assert.equal(x.sujet, 'Les châtaignes'); assert.equal(x.sujetASoi, true);
  assert.equal(x.texte, 'On a ramassé des châtaignes dans le bois, les mains toutes noires.');
  assert.equal(X.extraire({ ...message, labelIds: ['DRAFT'] }).ignore, 'brouillon');
  const sansDate = { ...message, payload: { ...message.payload, headers: message.payload.headers.filter(h => h.name !== 'Date') } };
  assert.equal(X.extraire(sansDate, { fuseau: 'Europe/Paris' }).date, '2026-10-07'); // internalDate, à défaut
});

/* ═════════ 2. mbox.js : une archive Takeout, en flux ═════════ */

const JOURS_SEM = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MOIS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asctime = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${JOURS_SEM[d.getUTCDay()]} ${MOIS_EN[d.getUTCMonth()]} ${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`; };
// comme Takeout : une ligne From_, X-GM-THRID et X-Gmail-Labels en tête (en UTF-8 nu), lignes en CRLF, « From » échappé (mboxrd)
const versMbox = mails => mails.map((m, n) => {
  const entetes = [`X-GM-THRID: ${1781000000000000000n + BigInt(n)}`, ...(m.labels != null ? [`X-Gmail-Labels: ${Buffer.from(m.labels, 'utf8').toString('latin1')}`] : [])].join('\r\n');
  return `From ${1781234567890000000n + BigInt(n)}@xxx ${asctime(m.instant)}\r\n${`${entetes}\r\n${m.brut}`.replace(/^(>*From )/gm, '>$1')}\r\n`;
}).join('');
const MBOX = Buffer.from(versMbox(CORPUS), 'latin1');
const decoupe = (b, n) => { const out = []; for (let i = 0; i < b.length; i += n) out.push(b.subarray(i, i + n)); return out; };
console.log(`\n2. mbox.js : une archive Takeout inventée (${MBOX.length} octets, ${CORPUS.length} mails)`);
let parMbox = null;
await verifier('la boîte d’un bloc : les envoyés seulement, rangés en pages par jour', async () => {
  parMbox = await M.depuisMbox(MBOX, { moi: 'camille.martin@example.com' });
  const { pages, compte } = parMbox;
  console.log(`        compte : ${JSON.stringify(compte)}`);
  assert.equal(compte.mails, 17); assert.equal(compte.envoyes, 15); assert.equal(compte.recus, 2); assert.equal(compte.extraits, 13);
  assert.deepEqual(compte.ignores, { automatique: 2 });
  assert.deepEqual(pages.map(p => p.date), ['2026-10-05', '2026-10-06', '2026-10-07']);
  for (const p of pages) sansTemoin(p.texte, p.date);
  const attendu = jour => GARDES.filter(m => m.jour === jour).sort((a, b) => a.instant - b.instant).map(m => (m.sujetASoi ? `${m.sujet}\n\n${m.exact}` : m.exact)).join('\n\n');
  for (const p of pages) assert.equal(p.texte, attendu(p.date), p.date);
  assert.ok(pages[2].texte.includes('From the window of the reading room'), '« >From » rendu à « From »');
});
await verifier('en morceaux de 1, 2, 7, 64, 1000 et 65 536 octets : exactement les mêmes pages', async () => {
  for (const n of [1, 2, 7, 64, 1000, 65536]) {
    const r = await M.depuisMbox(Readable.from(decoupe(MBOX, n)), { moi: 'camille.martin@example.com' });
    assert.deepEqual(r.pages, parMbox.pages, `morceaux de ${n}`);
  }
});
await verifier('une boîte en fins de ligne LF (Thunderbird, Apple Mail) : les mêmes pages', async () => {
  const r = await M.depuisMbox(Buffer.from(MBOX.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'), { moi: 'camille.martin@example.com' });
  assert.deepEqual(r.pages, parMbox.pages);
});
await verifier('depuis un Blob (File.stream(), comme dans la page) : les mêmes pages', async () => {
  const r = await M.depuisMbox(new Blob([MBOX]), { moi: 'camille.martin@example.com' });
  assert.deepEqual(r.pages, parMbox.pages);
});
await verifier('le corps d’un mail reçu n’est jamais gardé : on décide sur les en-têtes', async () => {
  const lecteur = new M.LecteurMbox({ garder: h => M.estEnvoye(h, { moi: 'camille.martin@example.com' }) }), sortis = [];
  for (const b of decoupe(MBOX, 4096)) sortis.push(...lecteur.pousser(b));
  sortis.push(...lecteur.finir());
  assert.equal(sortis.length, 15); assert.equal(lecteur.compte.sautes, 2);
  assert.ok(lecteur.compte.octetsSautes > 0);
  for (const s of sortis) { assert.ok(!s.brut.includes('BALEINEAU') && !s.brut.includes('FLAMANT')); assert.ok(!s.brut.startsWith('From ')); }
  console.log(`        ${lecteur.compte.sautes} mails sautés après leurs en-têtes, ${lecteur.compte.octetsSautes} octets de corps jamais retenus`);
});
await verifier('sans l’adresse de la personne : seules les étiquettes comptent (le mail sans étiquettes est perdu)', async () => {
  const r = await M.depuisMbox(MBOX);
  assert.equal(r.compte.extraits, 12); assert.ok(!r.pages[0].texte.includes('atelier d\'écriture'));
});
await verifier('un gros mail : au-delà de la limite, la pièce jointe n’est pas gardée, le texte oui', async () => {
  const m05 = CORPUS.find(m => m.id === 'm05');
  const gros = { ...m05, brut: m05.brut.replace(/(Content-Disposition: attachment; filename="jardin.jpg"\r\nContent-Transfer-Encoding: base64\r\nX-Attachment-Id: f_m5\r\n\r\n)/, `$1${enBase64(fauxFichier(3 << 20, 7))}\r\n`) };
  const lecteur = new M.LecteurMbox({ limite: 1 << 20 }), sortis = [];
  for await (const s of M.lettres(Readable.from(decoupe(Buffer.from(versMbox([gros, CORPUS[0]]), 'latin1'), 1 << 16)), lecteur)) sortis.push(s);
  assert.equal(sortis.length, 2); assert.equal(sortis[0].tronque, true); assert.ok(sortis[0].brut.length < (1 << 20) + 200);
  assert.equal(X.extraire(sortis[0].brut).texte, m05.exact); assert.equal(X.extraire(sortis[1].brut).texte, CORPUS[0].exact);
});
await verifier('une ligne « From … » mal échappée (mboxo), après une ligne vide, ne coupe pas le mail', async () => {
  const brut = `From - Wed Oct 07 08:00:00 2026\r\nX-Gmail-Labels: Sent\r\nFrom: ${MOI}\r\nDate: Wed, 7 Oct 2026 10:00:00 +0200\r\nSubject: Re: x\r\n\r\nJe regarde la mer.\r\n\r\nFrom here the boats look tiny.\r\n\r\n` +
    `From MAILER-DAEMON Wed Oct  7 09:00:00 2026\r\nX-Gmail-Labels: Sent\r\nFrom: ${MOI}\r\nDate: Wed, 7 Oct 2026 11:00:00 +0200\r\nSubject: Re: y\r\n\r\nUn second mail, sur les mouettes.\r\n`;
  const r = await M.depuisMbox(Buffer.from(brut, 'latin1'));
  assert.equal(r.compte.mails, 2);
  assert.deepEqual(r.extraits.map(x => x.texte), ['Je regarde la mer.\n\nFrom here the boats look tiny.', 'Un second mail, sur les mouettes.']);
});
await verifier('les étiquettes : CSV, guillemets, langues, brouillons et corbeille exclus', () => {
  assert.deepEqual(M.etiquettes('Messages envoyés,"Famille, amis",Ouvert'), ['Messages envoyés', 'Famille, amis', 'Ouvert']);
  assert.equal(M.estEnvoye({ 'x-gmail-labels': 'Sent,Opened' }), true);
  assert.equal(M.estEnvoye({ 'x-gmail-labels': 'Envoyés,Corbeille' }), false);
  assert.equal(M.estEnvoye({ 'x-gmail-labels': 'Boîte de réception', from: MOI }, { moi: ['CAMILLE.MARTIN@example.com'] }), true); // un mail à soi-même
  assert.equal(M.estEnvoye({ from: 'Jeanne <jeanne.durand@example.org>' }, { moi: 'camille.martin@example.com' }), false);
});

await verifier('une grosse boîte (≈ 210 Mo, 1 500 mails, pièces jointes) dans un tas plafonné à 24 Mo : la mémoire ne grandit pas', () => {
  const code = `
    const M = await import(${JSON.stringify(new URL('./mbox.js', import.meta.url).href)});
    const { Readable } = await import('node:stream');
    const N = 1500, PJ = Buffer.alloc(300 << 10, 7).toString('base64').replace(/.{76}/g, '$&\\r\\n');
    function* boite() {
      for (let i = 0; i < N; i++) {
        const recu = i % 5 < 3, pj = i % 3 === 0, d = new Date(Date.UTC(2026, 8, 1 + (i % 28), 8 + (i % 12), i % 60)).toUTCString().replace('GMT', '+0000');
        const corps = 'Message ' + i + ' : on se retrouve au jardin, près du vieux chêne, avec le dossier bleu et des pommes.\\r\\n\\r\\nCordialement,\\r\\nCamille\\r\\n';
        const tete = 'X-Gmail-Labels: ' + (recu ? 'Inbox' : 'Sent') + '\\r\\nDate: ' + d + '\\r\\nMessage-ID: <b' + i + '@example.com>\\r\\nFrom: ' + (recu ? 'x@example.org' : 'camille.martin@example.com') + '\\r\\nSubject: Re: test ' + i + '\\r\\n';
        yield Buffer.from('From ' + i + '@xxx Mon Oct 05 10:00:00 +0000 2026\\r\\n' + tete + (pj
          ? 'Content-Type: multipart/mixed; boundary=b' + i + '\\r\\n\\r\\n--b' + i + '\\r\\nContent-Type: text/plain; charset=utf-8\\r\\n\\r\\n' + corps + '\\r\\n--b' + i + '\\r\\nContent-Type: application/pdf\\r\\nContent-Disposition: attachment; filename=p.pdf\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n' + PJ + '\\r\\n--b' + i + '--\\r\\n'
          : 'Content-Type: text/plain; charset=utf-8\\r\\n\\r\\n' + corps) + '\\r\\n', 'latin1');
      }
    }
    let octets = 0, pic = 0; const surveille = setInterval(() => { pic = Math.max(pic, process.memoryUsage().heapUsed); }, 5);
    const flux = Readable.from((function* () { for (const b of boite()) { octets += b.length; yield b; } })());
    const t0 = performance.now(), r = await M.depuisMbox(flux, { moi: 'camille.martin@example.com' }), ms = performance.now() - t0;
    clearInterval(surveille);
    console.log(JSON.stringify({ mo: +(octets / 1e6).toFixed(0), ms: Math.round(ms), extraits: r.compte.extraits, pages: r.pages.length, tasPicMo: Math.round(Math.max(pic, process.memoryUsage().heapUsed) / 1e6) }));`;
  const sortie = execFileSync(process.execPath, ['--max-old-space-size=24', '--input-type=module', '-e', code], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const r = JSON.parse(sortie.trim().split('\n').pop());
  assert.equal(r.extraits, 600); assert.equal(r.pages, 28);
  console.log(`        ${r.mo} Mo lus en ${r.ms} ms (${(r.mo / (r.ms / 1000)).toFixed(0)} Mo/s, génération comprise), tas au plus haut : ${r.tasPicMo} Mo`);
});

/* ═════════ 3. api.js : l’API Gmail, contre une fausse API ═════════ */

// une fausse gmail.googleapis.com, d’après les formes de la documentation : list (q, maxResults, pageToken), get (format full
// ou raw), attachments.get. Les parties sont découpées comme Google le fait : body.data en base64url des octets du contenu
function payloadDe(brut) {
  let n = 0;
  const qp = s => Buffer.from(s.replace(/[ \t]+(?=\r?\n)/g, '').replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  return (function vers(p, partId) {
    const headers = p.entetes.map(([name, value]) => ({ name: name.replace(/(^|-)([a-z])/g, (_, a, b) => a + b.toUpperCase()), value }));
    const mp = { partId, mimeType: p.type, filename: p.fichier || '', headers, body: { size: 0 } };
    if (p.parties.length) mp.parts = p.parties.map((q, k) => vers(q, partId ? `${partId}.${k}` : String(k)));
    else {
      const octets = p.cte === 'base64' ? Buffer.from(p.corps, 'base64') : p.cte === 'quoted-printable' ? qp(p.corps) : Buffer.from(p.corps, 'latin1');
      if (p.fichier || !p.type.startsWith('text/')) mp.body = { size: octets.length, attachmentId: `ANGjdJ_${++n}` }; else mp.body = { size: octets.length, data: octets.toString('base64url') };
      mp.octets = octets;
    }
    return mp;
  })(X.lireMime(brut), '');
}
function fausseApi({ jeton = 'jeton-essai', echecs429 = 1 } = {}) {
  const vus = { list: 0, get: 0, attachment: 0, q: [], formats: new Set(), champs: new Set() }, pieces = new Map();
  const messages = CORPUS.filter(m => !m.brouillon).map(m => {
    const labelIds = m.recu ? ['INBOX', 'UNREAD'] : ['SENT'], payload = payloadDe(m.brut);
    (function retenir(p) { if (p.body.attachmentId) pieces.set(`${m.id}/${p.body.attachmentId}`, p.octets); delete p.octets; (p.parts || []).forEach(retenir); })(payload);
    if (m.texteEnPieceJointe) (function cacher(p) { if (p.mimeType === 'text/plain') { const o = Buffer.from(p.body.data, 'base64url'); pieces.set(`${m.id}/ANGjdJ_texte`, o); p.body = { size: o.length, attachmentId: 'ANGjdJ_texte' }; } (p.parts || []).forEach(cacher); })(payload);
    return { id: m.id, threadId: `t${m.id}`, labelIds, internalDate: String(m.instant), payload, raw: Buffer.from(m.brut, 'latin1').toString('base64url') };
  });
  const repondre = (status, corps) => ({ ok: status >= 200 && status < 300, status, json: async () => corps, text: async () => JSON.stringify(corps) });
  let restants429 = echecs429;
  return {
    vus,
    fetch: async (url, init = {}) => {
      const u = new URL(url);
      assert.equal(u.origin, 'https://gmail.googleapis.com');
      if (init.headers?.Authorization !== `Bearer ${jeton}`) return repondre(401, { error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } });
      vus.champs.add(u.searchParams.get('fields'));
      let m;
      if (u.pathname === '/gmail/v1/users/me/messages') {
        vus.list++; const q = u.searchParams.get('q'); vus.q.push(q);
        const apres = Number(/\bafter:(\d+)\b/.exec(q)[1]) * 1000, avant = /\bbefore:(\d+)\b/.exec(q), max = Number(u.searchParams.get('maxResults') || 100), de = Number(u.searchParams.get('pageToken') || 0);
        assert.ok(/\bin:sent\b/.test(q) && max <= 500);
        const tous = messages.filter(x => x.labelIds.includes('SENT') && Number(x.internalDate) >= apres && (!avant || Number(x.internalDate) < Number(avant[1]) * 1000)).sort((a, b) => b.internalDate - a.internalDate);
        const page = tous.slice(de, de + max);
        return repondre(200, { messages: page.map(x => ({ id: x.id, threadId: x.threadId })), ...(de + max < tous.length ? { nextPageToken: String(de + max) } : {}), resultSizeEstimate: tous.length });
      }
      if ((m = /^\/gmail\/v1\/users\/me\/messages\/([^/]+)\/attachments\/([^/]+)$/.exec(u.pathname))) {
        vus.attachment++; const o = pieces.get(`${m[1]}/${m[2]}`); if (!o) return repondre(404, { error: { code: 404 } });
        return repondre(200, { size: o.length, data: o.toString('base64url') });
      }
      if ((m = /^\/gmail\/v1\/users\/me\/messages\/([^/]+)$/.exec(u.pathname))) {
        vus.get++; if (restants429-- > 0) return repondre(429, { error: { code: 429, message: 'User-rate limit exceeded.', status: 'RESOURCE_EXHAUSTED' } });
        const x = messages.find(y => y.id === m[1]); if (!x) return repondre(404, { error: { code: 404 } });
        const format = u.searchParams.get('format') || 'full'; vus.formats.add(format);
        const { raw, payload, ...reste } = x;
        return repondre(200, format === 'raw' ? { ...reste, raw } : { ...reste, payload: structuredClone(payload) });
      }
      return repondre(404, { error: { code: 404 } });
    },
  };
}
const OCT6 = Date.parse('2026-10-06T00:00:00+02:00'), OCT5 = Date.parse('2026-10-05T00:00:00+02:00');
const sansAttente = { attendre: async () => {} };
console.log('\n3. api.js : l’API Gmail, contre une fausse API (formes vérifiées sur developers.google.com)');
await verifier('format=full, depuis le 6 octobre : les mêmes pages que l’archive, pagination et reprise après 429 comprises', async () => {
  const api = fausseApi();
  const r = await A.cueillir({ jeton: 'jeton-essai', fetch: api.fetch, depuis: OCT6, parPage: 4, ...sansAttente });
  assert.deepEqual(r.pages, parMbox.pages.filter(p => p.date >= '2026-10-06'));
  assert.equal(api.vus.q[0], `in:sent after:${OCT6 / 1000}`);
  assert.ok(api.vus.list >= 3, 'plusieurs pages de liste');
  assert.equal(r.compte.reprises, 1); assert.equal(api.vus.attachment, 1, 'le texte de m03, cherché à part');
  assert.ok([...api.vus.champs].every(Boolean), 'chaque appel demande seulement les champs utiles');
  console.log(`        ${api.vus.list} pages de liste, ${api.vus.get} lectures (dont 1 refusée en 429 puis reprise), ${api.vus.attachment} texte cherché à part : ${r.compte.unites} unités de quota (limite : 6 000 par minute et par personne)`);
});
await verifier('format=raw, depuis le 5 octobre : les mêmes pages que l’archive', async () => {
  const api = fausseApi({ echecs429: 0 });
  const r = await A.cueillir({ jeton: 'jeton-essai', fetch: api.fetch, depuis: OCT5, format: 'raw', ...sansAttente });
  assert.deepEqual(r.pages, parMbox.pages); assert.deepEqual([...api.vus.formats], ['raw']);
  assert.deepEqual(r.compte.ignores, { automatique: 2 });
});
await verifier('before: borne la cueillette (un seul jour)', async () => {
  const api = fausseApi({ echecs429: 0 });
  const r = await A.cueillir({ jeton: 'jeton-essai', fetch: api.fetch, depuis: OCT5, jusqua: OCT6, ...sansAttente });
  assert.deepEqual(r.pages.map(p => p.date), ['2026-10-05']); assert.equal(api.vus.q[0], `in:sent after:${OCT5 / 1000} before:${OCT6 / 1000}`);
});
await verifier('le débit : jamais plus que le budget par minute (horloge simulée)', async () => {
  let horloge = 0; const journal = [];
  const api = fausseApi({ echecs429: 0 }), budget = 200; // un budget minuscule : 10 lectures par minute
  const fetch = async (url, init) => { journal.push({ t: horloge, unites: /\/attachments\//.test(url) ? 20 : /messages\?/.test(url) ? 5 : 20 }); return api.fetch(url, init); };
  const r = await A.cueillir({ jeton: 'jeton-essai', fetch, depuis: OCT5, parallele: 4, budget, maintenant: () => horloge, attendre: async ms => { horloge += ms; } });
  assert.deepEqual(r.pages, parMbox.pages);
  for (const { t } of journal) { const fenetre = journal.filter(x => x.t > t - 60e3 && x.t <= t).reduce((n, x) => n + x.unites, 0); assert.ok(fenetre <= budget * 1.25 + 20, `${fenetre} unités en une minute`); }
  console.log(`        ${r.compte.unites} unités avec un budget de ${budget} par minute : ${(horloge / 60e3).toFixed(1)} minutes simulées`);
});
await verifier('un jeton expiré : 401, une erreur que la page traduit en « un toucher, s’il te plaît »', async () => {
  const api = fausseApi();
  await assert.rejects(A.cueillir({ jeton: 'vieux', fetch: api.fetch, depuis: OCT6, ...sansAttente }), e => e.status === 401 && e.code === 'jeton');
});
await verifier('Google Identity Services (fausse bibliothèque) : la portée, le geste, le refus, l’expiration', async () => {
  let maintenant = 1e12;
  const fauxGoogle = reponse => { const vu = { demandes: 0 }; return { vu, accounts: { oauth2: {
    initTokenClient(config) { vu.config = config; return { requestAccessToken() { vu.demandes++; queueMicrotask(() => (reponse.type ? config.error_callback(reponse) : config.callback(reponse))); } }; },
    hasGrantedAllScopes: (r, ...portees) => portees.every(p => String(r.scope || '').split(' ').includes(p)),
    revoke(jeton, fait) { vu.revoque = jeton; fait?.(); } } } }; };
  const g = fauxGoogle({ access_token: 'ya29.essai', expires_in: 3599, scope: `${A.PORTEE_GMAIL} openid`, token_type: 'Bearer' });
  const c = A.clientJeton({ clientId: '1234-essai.apps.googleusercontent.com', google: g, maintenant: () => maintenant });
  assert.equal(g.vu.config.scope, 'https://www.googleapis.com/auth/gmail.readonly'); assert.equal(g.vu.config.prompt, '');
  assert.equal(await c.demander(), 'ya29.essai'); assert.equal(await c.demander(), 'ya29.essai'); assert.equal(g.vu.demandes, 1, 'le jeton est gardé en mémoire');
  maintenant += 3600e3; assert.equal(c.valide(), false); assert.equal(c.jeton(), null);
  c.oublier(); assert.equal(g.vu.revoque, 'ya29.essai');
  const refus = A.clientJeton({ clientId: 'x', google: fauxGoogle({ access_token: 'ya29.x', expires_in: 3599, scope: 'openid' }) });
  await assert.rejects(refus.demander(), e => e.code === 'portee');
  const fermee = A.clientJeton({ clientId: 'x', google: fauxGoogle({ type: 'popup_closed' }) });
  await assert.rejects(fermee.demander(), e => e.code === 'popup_closed');
});

/* ═════════ 4. Le chemin lit ces pages : decouper, lirePage, candidats, comme sur le téléphone ═════════ */

console.log('\n4. Le chemin lit les pages du jour (chemin/sens.js, vrais vecteurs, vrai catalogue)');
const sens = await import(new URL('../../sens.js', import.meta.url));
const lire = f => readFileSync(path.join(CHEMIN, f.replace(/\?.*$/, '')));
const [mots, V, O, I, catalogue] = sens.FICHIERS_SENS.map(lire);
const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const t0 = performance.now();
const S = sens.preparer(mots.toString('utf8'), ab(V), ab(O), JSON.parse(catalogue.toString('utf8')), ab(I));
const tPrep = performance.now() - t0;
await verifier('chaque jour devient des passages, chaque passage une tuile : porteurs, objets, lieu', () => {
  const recents = new Map(); let veille = null, i = 0, tuiles = 0, avecObjets = 0; const t1 = performance.now();
  for (const page of parMbox.pages) {
    const passages = sens.decouper(S, page.texte);
    assert.ok(passages.length >= 1, `${page.date} : aucun passage`);
    console.log(`\n    ${page.date} : ${page.texte.split(/\s+/).length} mots écrits dans les mails du jour → ${passages.length} passage(s), donc ${passages.length} tuile(s)`);
    for (const [k, p] of passages.entries()) {
      i++; tuiles++;
      sansTemoin(p.texte, `${page.date} passage ${k + 1}`);
      const lecture = sens.lirePage(S, p.texte), liste = sens.candidats(S, lecture);
      const objets = sens.objetsDeLaPage(S, lecture, { recents, jour: i, liste });
      for (const o of objets) recents.set(o.objet.id, i);
      const lieu = sens.lieuDeLaPage(lecture, objets, veille); veille = lieu;
      if (objets.length) avecObjets++;
      const porteurs = lecture.mots.filter(x => sens.porteur(S, x.i)).map(x => x.m);
      const champs = Object.entries(lecture.champs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(', ');
      console.log(`      tuile ${k + 1} (${p.porteurs} porteurs) « ${p.texte.replace(/\s+/g, ' ').slice(0, 72)}… »`);
      console.log(`        porteurs : ${porteurs.join(', ')}`);
      console.log(`        objets   : ${objets.map(o => `${o.objet.id.split('/').pop()} ← ${o.mot}`).join(', ') || '(aucun au-dessus du seuil)'}`);
      console.log(`        lieu     : ${lieu}   (champs : ${champs} ; heure : ${lecture.heure || '—'} ; valence ${lecture.valence.toFixed(2)})`);
    }
  }
  console.log(`\n    ${tuiles} tuiles, ${avecObjets} avec au moins un objet ; sens préparé en ${tPrep.toFixed(0)} ms, lecture des ${tuiles} passages en ${(performance.now() - t1).toFixed(0)} ms (Node, sans GPU : la peinture n’est pas mesurée ici)`);
  assert.ok(tuiles >= 3 && avecObjets >= 1);
});

console.log(echecs ? `\n${echecs} échec(s), ${reussites} réussite(s)` : `\nTout va bien : ${reussites} vérifications.`);
process.exitCode = echecs ? 1 : 0;
