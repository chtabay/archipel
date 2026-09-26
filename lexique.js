// L’archipel : le lexique. Une lecture du texte, sur l’appareil, jamais ailleurs.
//
// Le texte est lu ici pour y trouver des sujets et une sensation : ce qu’il y trouve pousse sur l’île,
// comme des cases cochées, et le texte y allume des lanternes. Ce qui est lu ne part jamais ; ce qui
// est transmis à l’archipel reste des comptes par espèce.

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');

// Par sujet : des débuts de mots (les formes fléchies suivent), avec un poids. 2 points proposent le sujet.
export const SUJETS = {
  s0: [['fait du mal', 2], ['fait souffrir', 2], ['fait pleurer', 2], ['blesse', 1], ['cruel', 2], ['mechan', 1], ['violent', 1], ['cogne', 1], ['gifl', 2], ['insult', 1], ['humili', 1], ['trahi', 1], ['frappe', 1], ['harcel', 1], ['menace', 1]],
  s1: [['menti', 2], ['mensonge', 2], ['je mens', 2], ['cache', 1], ['secret', 1], ['dissimul', 2], ['trich', 2], ['vole', 1], ['fraud', 2], ['faux papiers', 2], ['double vie', 2]],
  s2: [['trompe', 2], ['infidel', 2], ['amant', 2], ['maitresse', 2], ['adulter', 2], ['quelqu\'un d\'autre', 1], ['un autre homme', 2], ['une autre femme', 2], ['couche avec', 1], ['embrasse', 1], ['attire', 1], ['desir', 1]],
  s3: [['sexe', 2], ['sexuel', 2], ['porno', 1], ['masturb', 2], ['fantasme', 2], ['libido', 2], ['impuiss', 2], ['coucher', 1], ['desir', 1], ['nudite', 1], ['orgasme', 2]],
  s4: [['couple', 2], ['mon mari', 2], ['ma femme', 2], ['mon copain', 2], ['ma copine', 2], ['mon conjoint', 2], ['ma conjointe', 2], ['mon compagnon', 2], ['ma compagne', 2], ['mon ex', 2], ['separ', 1], ['divorc', 2], ['rupture', 2], ['dispute', 1], ['engueul', 1], ['mariage', 1], ['on ne se parle plus', 2]],
  s5: [['famille', 2], ['ma mere', 2], ['mon pere', 2], ['mes parents', 2], ['ma fille', 2], ['mon fils', 2], ['mes enfants', 2], ['mon enfant', 2], ['mon frere', 2], ['ma soeur', 2], ['grand-mere', 2], ['grand-pere', 2], ['mamie', 2], ['papi', 2], ['beau-pere', 2], ['belle-mere', 2], ['maman', 2], ['papa', 2], ['mon oncle', 2], ['ma tante', 2]],
  s6: [['argent', 2], ['dette', 2], ['credit', 1], ['emprunt', 2], ['loyer', 1], ['facture', 1], ['huissier', 2], ['banque', 1], ['decouvert', 2], ['fric', 2], ['thune', 2], ['euros', 1], ['pari', 1], ['casino', 2], ['jeux d\'argent', 2], ['je dois de l\'argent', 2]],
  s7: [['travail', 2], ['boulot', 2], ['taf', 2], ['patron', 2], ['mon chef', 2], ['ma chef', 2], ['collegue', 2], ['bureau', 1], ['licenci', 2], ['chomage', 2], ['demission', 2], ['burn', 1], ['etudes', 2], ['ecole', 1], ['lycee', 2], ['la fac', 2], ['universit', 2], ['examen', 2], ['concours', 2], ['prof', 1], ['entreprise', 1], ['salaire', 1], ['clients', 1]],
  s8: [['alcool', 2], ['je bois', 2], ['trop bu', 2], ['ivre', 2], ['saoul', 2], ['bourre', 1], ['biere', 1], ['drogue', 2], ['cannabis', 2], ['joint', 1], ['coke', 2], ['cocaine', 2], ['heroine', 2], ['medicament', 1], ['addict', 2], ['dependan', 2], ['fume', 1], ['cigarette', 1], ['ecrans', 1], ['jeux video', 1]],
  s9: [['depress', 2], ['deprim', 2], ['angoiss', 1], ['anxi', 2], ['panique', 2], ['crise', 1], ['therap', 2], ['psy', 2], ['hopital', 1], ['suicid', 2], ['idees noires', 2], ['dans ma tete', 1], ['burn-out', 2], ['anorex', 2], ['boulim', 2], ['bipol', 2], ['insomni', 2], ['plus dormir', 2], ['antidepress', 2], ['anxiolyt', 2]],
  s10: [['mon corps', 2], ['gros', 1], ['grosse', 1], ['maigre', 2], ['poids', 2], ['kilos', 2], ['moche', 2], ['laid', 2], ['miroir', 2], ['ma peau', 2], ['cheveux', 1], ['ventre', 1], ['regime', 2], ['apparence', 2], ['physique', 1], ['cicatrice', 2], ['vieilli', 1], ['me trouve', 1]],
  s11: [['agress', 2], ['viol', 2], ['abus', 2], ['attouch', 2], ['inceste', 2], ['battu', 2], ['m\'a frappe', 2], ['m\'a touche', 2], ['m\'a force', 2], ['on m\'a', 1], ['il m\'a', 1], ['elle m\'a', 1], ['violence', 1], ['harcel', 1], ['humili', 1], ['menace', 1], ['m\'a fait du mal', 2], ['victime', 2]],
  s12: [['mort', 2], ['decede', 2], ['deces', 2], ['enterr', 2], ['deuil', 2], ['perdu', 1], ['la perte', 2], ['disparu', 2], ['cimetiere', 2], ['fausse couche', 2], ['cancer', 1], ['malad', 1], ['me manque', 2], ['plus la', 1], ['partie pour toujours', 2], ['obseques', 2]],
  s13: [['qui je suis', 2], ['identit', 2], ['croire', 1], ['je crois', 1], ['la foi', 2], ['dieu', 2], ['religion', 2], ['prier', 2], ['genre', 1], ['trans', 1], ['orientation', 2], ['homo', 2], ['mes valeurs', 2], ['honte de moi', 2], ['imposteur', 2], ['je suis nul', 2], ['je ne vaux', 2], ['ce que je suis', 2], ['je ne sais plus qui', 2]],
  s14: [['reve', 2], ['envie de', 1], ['voudrais', 1], ['aimerais', 1], ['projet', 2], ['partir', 1], ['changer de vie', 2], ['tout plaquer', 2], ['oser', 1], ['un jour', 1], ['commencer', 1], ['creer', 1], ['voyage', 1], ['ailleurs', 1], ['recommencer', 1]],
};

// Le sens : ce qu’on a fait, ce qu’on nous a fait. Pour les mots qui vont dans les deux sens.
const RECU = /(m'a|m'ont|on m'|me |il m|elle m|ils m|elles m|m'avait|m'avaient)\s*$/;
const COMMIS = /(j'ai|je l'ai|je lui ai|je les ai|j'aurais|je la|je le|je les)\s*$/;
const DEUX_SENS = new Set(['frappe', 'humili', 'harcel', 'insult', 'menace', 'trahi', 'blesse', 'violent']);

// La sensation, par quadrant.
export const MOTS = {
  AD: ['colere', 'rage', 'peur', 'angoiss', 'panique', 'furieu', 'enerve', 'terrifi', 'stress', 'nerveu', 'je tremble', 'haine', 'en veux'],
  ED: ['honte', 'triste', 'vide', 'fatigu', 'epuis', 'coupable', 'culpabil', 'seul', 'solitude', 'pleur', 'deprim', 'nul', 'desesp', 'abandonn', 'lourd', 'plus la force'],
  AS: ['envie', 'espoir', 'esper', 'hate', 'excit', 'curieu', 'motiv', 'vivant', 'enfin'],
  ES: ['soulag', 'calme', 'apais', 'paix', 'serein', 'tranquille', 'accept', 'repos', 'leger', 'mieux'],
};

// Lit un texte. Renvoie { sujets: [[id, score], …] (score ≥ 2, les plus forts d’abord, trois au plus), quad: 'AD'|'ED'|'AS'|'ES'|'N', quads: { … } }.
export function lire(texte) {
  const t = norm(texte || '');
  const scores = {};
  if (t.length >= 8) {
    for (const [id, stems] of Object.entries(SUJETS)) {
      let sc = 0;
      for (const [stem, w] of stems) {
        let i = t.indexOf(stem);
        while (i >= 0) {
          const avant = t.slice(Math.max(0, i - 16), i), debutMot = i === 0 || /[^a-z]/.test(t[i - 1]);
          if (debutMot) {
            if (DEUX_SENS.has(stem) && (id === 's0' || id === 's11')) {
              const recu = RECU.test(avant), commis = COMMIS.test(avant);
              if (recu && id === 's0') { /* pas pour ce sujet */ } else if (commis && id === 's11') { /* pas pour ce sujet */ } else sc += recu || commis ? w : w * .5;
            } else sc += w;
          }
          i = t.indexOf(stem, i + stem.length);
        }
      }
      if (sc >= 2) scores[id] = sc;
    }
  }
  const quads = { ED: 0, AD: 0, ES: 0, AS: 0 };
  for (const [q, stems] of Object.entries(MOTS)) for (const stem of stems) { let i = t.indexOf(stem); while (i >= 0) { if (i === 0 || /[^a-z]/.test(t[i - 1])) quads[q]++; i = t.indexOf(stem, i + stem.length); } }
  const best = Object.entries(quads).sort((p, q) => q[1] - p[1])[0];
  return { sujets: Object.entries(scores).sort((p, q) => q[1] - p[1]).slice(0, 3), quad: best[1] ? best[0] : 'N', quads };
}
