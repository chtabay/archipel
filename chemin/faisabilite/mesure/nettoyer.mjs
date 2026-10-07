// Prototype : nettoyer un texte tapé dans la journée avant que le chemin le lise. On ne garde que ce que la personne a écrit
// elle-même, et qui peut faire une image : sans les citations des messages auxquels elle répond, sans ses signatures ni
// les mentions légales, sans adresses, sans numéros, sans code, sans les mots vides de l’anglais et du clavardage.
// Chaque étape est séparable, pour mesurer ce qu’elle apporte. Rien ne sort du téléphone : c’est du texte, sur place.

export const ETAPES = ['citations', 'signatures', 'adresses', 'code', 'nombres', 'propres', 'vides'];

// 1. Les citations : la réponse s’arrête où commence le message cité
const CITE_FR = /^(?:le|on)\s[^\n]{4,200}?(?:a écrit|wrote)\s*:\s*$/im; // « Le lun. 5 oct. 2026 à 10:12, X a écrit : »
const ORIGINE = /^\s*-{2,}\s*(?:message d.origine|original message|forwarded message|message transféré)\s*-{2,}\s*$/im;
const ENTETE = /^(?:de|from)\s*:\s.+\n(?:.*\n){0,2}?(?:envoyé|sent|date)\s*:\s.+$/im; // De : … / Envoyé : … (Outlook)
function citations(t) {
  for (const re of [CITE_FR, ORIGINE, ENTETE]) { const m = t.match(re); if (m) t = t.slice(0, m.index); }
  return t.split('\n').filter(l => !/^\s*>/.test(l)).join('\n');
}

// 2. Les signatures, les formules d’appel et de politesse, les mentions légales, « Envoyé de mon iPhone »
const ENVOYE = /^\s*(?:envoyé|envoye|sent)\s(?:de|depuis|from)\s.{0,40}$/i;
const LEGAL = /(confidenti\w+.{0,200}destinataire|destinataire.{0,200}confidenti|this (?:e-?mail|message).{0,120}(?:confidential|intended))/is;
const APPEL = /^\s*(?:bonjour|bonsoir|salut|coucou|hello|hi|hey|dear|cher|chère|mon cher|ma chère|ma chérie|madame|monsieur)\b[^\n.!?]{0,40}[,!]?\s*$/i;
const POLITESSE = /^\s*(?:(?:bien|très)\s+)?(?:cordialement|sincèrement|amicalement|amitiés|bises|bisous|grosses bises|bien à (?:vous|toi)|à (?:bientôt|demain|plus)|bonne (?:journée|soirée|fin de journée|semaine)|merci(?: beaucoup| d.avance| encore)?|best(?: regards)?|kind regards|regards|cheers|thanks|many thanks|love|take care)\b[^\n]{0,25}[,.!]?\s*$/i;
export function signatures(t, { repetees = new Set() } = {}) {
  let l = t.split('\n');
  const tiret = l.findIndex(x => /^--\s?$/.test(x)); if (tiret >= 0) l = l.slice(0, tiret); // la signature « -- » : tout ce qui suit
  l = l.filter(x => !ENVOYE.test(x) && !repetees.has(x.trim()) && !(/\|/.test(x) && x.split('|').length >= 3)); // « Nadia | Resp. | Ardoise | 01… »
  while (l.length && !l[0].trim()) l.shift();
  if (l.length && APPEL.test(l[0])) l.shift();
  // la formule de politesse, et le bloc court qui la suit (nom, fonction, société, adresse, téléphone)
  for (let i = l.length - 1; i >= 0; i--) {
    if (!POLITESSE.test(l[i])) continue;
    const apres = l.slice(i + 1).filter(x => x.trim());
    if (apres.length <= 8 && apres.every(x => x.trim().length <= 70)) { l = l.slice(0, i); break; }
  }
  return l.join('\n').split(/\n[ \t]*\n/).filter(p => !LEGAL.test(p)).join('\n\n');
}
// les lignes qui reviennent dans au moins trois saisies du jour : une signature apprise, sans la connaître d’avance
export function lignesRepetees(items, min = 3) {
  const n = new Map();
  for (const it of items) for (const x of new Set(it.texte.split('\n').map(s => s.trim()).filter(s => s.length > 3))) n.set(x, (n.get(x) || 0) + 1);
  return new Set([...n].filter(([, k]) => k >= min).map(([x]) => x));
}

// 3. Les adresses : liens, courriels, @mentions, #étiquettes, noms de fichiers
const ADRESSES = [
  /\b(?:https?:\/\/|www\.)\S+/gi, /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, /\b[\w-]+(?:\.[\w-]+)*\.(?:fr|com|org|net|io|eu|example|be|ch|uk|de)\b(?:\/\S*)?/gi,
  /(?:^|\s)[@#][\w.-]+/g, /\b[\w-]+\.(?:pdf|docx?|xlsx?|csv|pptx?|png|jpe?g|zip|aspx?|html?)\b/gi,
];
const adresses = t => ADRESSES.reduce((s, re) => s.replace(re, ' '), t);

// 4. Les nombres : dates, heures, téléphones, références, prix ; tout jeton qui contient un chiffre
const nombres = t => t.replace(/[^\s()]*\d[^\s()]*/g, ' ').replace(/(^|\s)(?:n°|réf\.?|ref\.?)(?=\s|$)/gim, ' ');

// 6. Les noms propres : un mot à majuscule au milieu d’une phrase (« Rennes », « Orange », « Mme Garnier »), ou un sigle.
// En début de phrase, de ligne ou de puce, on ne peut pas savoir : on le garde. Une recherche tapée en minuscules y échappe.
const MAJ = /[A-ZÀ-ÖØ-ÞŒ][A-Za-zÀ-ÖØ-öø-ÿœŒ'’-]*/g;
const debutDePhrase = (l, i) => { const avant = l.slice(0, i).trimEnd(); return !avant || /[.!?…:»"“—–•*(\-]$/.test(avant); };
// appris : les noms propres vus ailleurs dans la journée (« Rennes » dans un courriel), retirés aussi là où ils sont écrits en
// minuscules (« météo rennes »), car le chemin y lirait « renne »
function propres(t, { appris = new Set() } = {}) {
  t = t.split('\n').map(l => l.replace(MAJ, (m, i) => (debutDePhrase(l, i) ? m : ' '))).join('\n');
  return appris.size ? t.replace(/[A-Za-zÀ-ÖØ-öø-ÿœŒ'’-]+/g, m => (appris.has(m.toLowerCase()) ? ' ' : m)) : t;
}
// les noms propres de la journée : à majuscule au milieu d’une phrase dans un texte rédigé (courriel, forum, document),
// et jamais écrits en minuscules dans ces mêmes textes ; les recherches et les messages, tapés vite, ne comptent pas
export function nomsPropresDuJour(items) {
  const maj = new Set(), min = new Set();
  for (const it of items) {
    if (!['mail', 'forum', 'document'].includes(it.source)) continue;
    for (const l of it.texte.split('\n')) {
      if (/^\s*>/.test(l)) continue;
      for (const m of l.matchAll(/[A-Za-zÀ-ÖØ-öø-ÿœŒ-]+/g)) {
        const w = m[0], bas = w.toLowerCase();
        if (w === bas) min.add(bas); else if (w.length > 2 && /^[A-ZÀ-ÖØ-ÞŒ][a-zà-öø-ÿœ-]+$/.test(w) && !debutDePhrase(l, m.index)) maj.add(bas);
      }
    }
  }
  return new Set([...maj].filter(w => !min.has(w)));
}

// 5. Le code : blocs entre ```, formules de tableur, lignes faites surtout de symboles (après les adresses, avant les nombres)
function code(t) {
  t = t.replace(/```[\s\S]*?(?:```|$)/g, '\n').replace(/=[A-ZÀ-Ü.]{2,}\([^\n]*\)/g, ' ');
  return t.split('\n').filter(l => { const s = l.replace(/\s/g, ''); if (s.length < 8) return true; const sym = (s.match(/[{}[\];=<>$|\\]|<-|->|\(\)/g) || []).length; return sym / s.length < .08; }).join('\n');
}

// 7. Les mots vides que sens.js ne connaît pas : ceux de l’anglais, et ceux du clavardage
const VIDES_EN = `a an the and or but if then so of to in on at by for from with without about into over under up down out off
i me my mine you your yours he him his she her hers it its we us our they them their this that these those there here
is am are was were be been being have has had do does did done will would shall should can could may might must
not no yes ok okay just really very too also only still even quite pretty much many more most some any all each every
what which who whom whose when where why how than as like get got getting go going gone come came make made take took
let lets thing things stuff way lot lots bit one two first last next new good great nice well back again now today tonight
hi hey hello thanks thank please sorry btw lol haha omg yeah yep nope sure cool bro same`;
const VIDES_CHAT = 'mdr ptdr lol jsp stp svp qqn qqch tkt jpp bjr slt cc ouais grave ok okay ah oh bah wesh hein';
const EN = new Set(VIDES_EN.split(/\s+/)), CHAT = new Set(VIDES_CHAT.split(/\s+/));
// une ligne est en anglais si elle a plus de mots outils anglais que français : on n’y retire les mots vides anglais
// que là, pour ne pas ôter « lot », « nice » ou « pretty » d’une phrase française
const OUTILS_FR = new Set('le la les un une des du de et est je tu il elle nous vous ils pour que qui pas dans sur avec ce cette mais ou au aux en ne se sa son mes mon ma'.split(' '));
const MOTS = /[A-Za-zÀ-ÿœæŒÆ'’-]+/g;
function vides(t) {
  return t.split('\n').map(l => {
    const m = (l.match(MOTS) || []).map(x => x.toLowerCase());
    const en = m.filter(x => EN.has(x)).length, fr = m.filter(x => OUTILS_FR.has(x)).length, anglais = en > fr;
    return l.replace(MOTS, x => { const k = x.toLowerCase(); return CHAT.has(k) || (anglais && EN.has(k)) ? ' ' : x; });
  }).join('\n');
}

const FONCTIONS = { citations, signatures, adresses, nombres, code, propres, vides };
// nettoyer une saisie ; source : « mail » pour les étapes propres aux courriels (citations, signatures)
export function nettoyer(texte, { source = 'mail', etapes = ETAPES, repetees, appris } = {}) {
  let t = (texte || '').replace(/\r\n?/g, '\n');
  for (const e of etapes) {
    if ((e === 'citations' || e === 'signatures') && source !== 'mail') { if (e === 'signatures') t = t.split('\n').filter(x => !ENVOYE.test(x)).join('\n'); continue; }
    t = e === 'signatures' ? signatures(t, { repetees }) : e === 'propres' ? propres(t, { appris }) : FONCTIONS[e](t);
  }
  return t.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// toute une journée : les signatures apprises par répétition, puis chaque saisie
export function nettoyerJour(items, { etapes = ETAPES } = {}) {
  const repetees = etapes.includes('signatures') ? lignesRepetees(items.filter(it => it.source === 'mail')) : new Set();
  const appris = etapes.includes('propres') ? nomsPropresDuJour(items) : new Set();
  return items.map(it => ({ ...it, texte: nettoyer(it.texte, { source: it.source, etapes, repetees, appris }) })).filter(it => it.texte);
}
