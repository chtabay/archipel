// Essai de faisabilité, pas une pièce de l’app. Le filet de sécurité d’Archipel (LEX, dans contenu.js) a été pensé pour une
// page qu’on écrit exprès, pour se confier. Que donnerait-il sur les écrits banals d’une journée, glanés partout ?
// Données inventées uniquement : aucune phrase ne vient d’un vrai courriel ni d’une vraie personne.
// Lancer : node chemin/faisabilite/vie-privee/filet-ambiant.mjs
// Attention : les phrases sont choisies pour montrer les pièges ; le chiffre final n’est pas un taux de faux positifs.
import { LEX } from '../../../contenu.js';

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');
// comme aide() dans chemin/app.js : un bout de mot suffit
const commeAujourdhui = t => { t = norm(t); const s = LEX.self.find(k => t.includes(k)); if (s) return ['self', s]; const o = LEX.other.find(k => t.includes(k)); return o ? ['other', o] : null; };
// la même liste, mais en mots entiers (« suicid » et « me scarifi » restent des débuts de mots)
const bord = k => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${/(suicid|scarifi)$/.test(k) ? '' : '(?![a-z])'}`);
const enMotsEntiers = t => { t = norm(t); const s = LEX.self.find(k => bord(k).test(t)); if (s) return ['self', s]; const o = LEX.other.find(k => bord(k).test(t)); return o ? ['other', o] : null; };

// [phrase, ce qu’elle est vraiment]
const journee = [
  ['Bonjour, ci-joint le compte rendu de la réunion sur la prévention du suicide au travail.', 'travail'],
  ['Je vais me battre pour que ce projet passe en comité.', 'travail'],
  ['Il faut en finir avec ce dossier avant vendredi.', 'travail'],
  ['Je dois me taper tout le rapport ce soir, pas le choix.', 'banal'],
  ['J’ai passé l’après-midi à donner des coups de fil aux fournisseurs.', 'travail'],
  ['La robe violette te va très bien !', 'banal'],
  ['Le film de samedi, c’est Suicide Squad, tu viens ?', 'banal'],
  ['Ce règlement viole clairement l’article 12 du contrat.', 'travail'],
  ['Il me force un peu la main sur le planning, mais ça va.', 'travail'],
  ['Le client s’est senti agressé par le ton du mail, on s’excuse.', 'travail'],
  ['Je vais me faire du mal à finir ce marathon, haha.', 'banal'],
  ['Le patron me tape sur les nerfs aujourd’hui.', 'banal'],
  ['On a vu un documentaire sur les violences, très dur.', 'banal'],
  ['Merci pour le café ce matin, à demain.', 'banal'],
  ['Rappel : la réunion d’équipe est décalée à 14 h.', 'travail'],
  ['Je n’ai plus envie de vivre comme ça, je suis épuisé.', 'détresse'],
];

let a = 0, b = 0;
for (const [p, vrai] of journee) {
  const x = commeAujourdhui(p), y = enMotsEntiers(p); if (x) a++; if (y) b++;
  console.log(`${(x ? `${x[0]} « ${x[1]} »` : '—').padEnd(30)} ${(y ? `${y[0]} « ${y[1]} »` : '—').padEnd(30)} ${vrai.padEnd(9)} ${p}`);
}
console.log(`\nComme aujourd’hui : ${a} phrases sur ${journee.length} ouvrent l’encart d’aide. En mots entiers : ${b}.`);
console.log('Les mots entiers ôtent « violette » ou « me battre », pas « prévention du suicide » ni « en finir avec ce dossier » :');
console.log('le contexte d’un écrit pour les autres ne se lit pas avec une liste de mots.');
