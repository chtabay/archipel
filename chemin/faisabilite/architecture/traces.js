// Essai de faisabilité, pas une pièce de l’app. Où ranger les « écrits du jour » à côté des pages du journal, et comment
// en faire des tuiles sans déranger le journal.
//
// Aujourd’hui (chemin/carnet.js, base « chemin » version 2) : pages { date, texte } avec la date pour clé, une page par
// jour ; la zone d’écriture montre et remplace la page d’aujourd’hui. Proposé (version 3) : un magasin de plus, « traces »,
// sans rien changer aux pages. Une trace, c’est un écrit glané (un mail envoyé, un texte tapé dans une page), ou ce qu’un
// autre appareil en a lu :
//   { id, date, at, source, appareil, forme: 'texte' | 'sac' | 'mince', texte | sac | mince, recu }
//   - id : unique partout (appareil + instant + hasard) : deux carnets se réunissent sans conflit, par simple union ;
//   - date : le jour, à l’heure de l’appareil qui a glané ; at : l’instant ; recu : quand ce téléphone l’a reçue ;
//   - source : 'gmail', 'navigateur', 'partage'… ; appareil : un nom court que la personne a choisi (« l’ordinateur »).
// La page du journal reste ce qu’elle est : écrite exprès, montrée et modifiable dans la zone d’écriture. Les traces ne
// s’y montrent pas : elles ont leur propre liste, en lecture seule, où l’on peut en oublier une.

export const VERSION = 3;
// à appeler dans onupgradeneeded, après ce que fait déjà carnet.js : la version 2 reste lisible telle quelle
export function migrer(db) {
  if (!db.objectStoreNames.contains('traces')) {
    const s = db.createObjectStore('traces', { keyPath: 'id' });
    s.createIndex('date', 'date'); // les traces d’un jour, pour la tuile de ce jour
    s.createIndex('recu', 'recu'); // pour oublier les plus vieilles, comme elaguer()
  }
}
const hasard = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), x => x.toString(36).padStart(2, '0')).join('');
export const nouvelleTrace = ({ date, at = Date.now(), source, appareil, forme, contenu }) => ({ id: `${appareil}-${at.toString(36)}-${hasard()}`, date, at, source, appareil, forme, [forme]: contenu, recu: Date.now() });
// une glane du prototype d’extension (../navigateur/extension/fond.js : { id, fil, site, texte, debut, fin }) devient une
// trace ; le site n’est pas gardé : le chemin n’a pas besoin de savoir où l’on écrivait
const deux = n => String(n).padStart(2, '0'), jourDe = ms => { const d = new Date(ms); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`; };
export const deGlane = (g, appareil = 'ordinateur') => ({ id: `${appareil}-${g.id}`, date: jourDe(g.debut), at: g.debut, source: 'navigateur', appareil, forme: 'texte', texte: g.texte, recu: Date.now() });
// deux carnets (ou un carnet et un colis) : l’union, sans doublon ; une trace oubliée ici ne revient pas (liste des oubliées)
export const reunir = (a, b, oubliees = new Set()) => [...new Map([...a, ...b].filter(t => !oubliees.has(t.id)).map(t => [t.id, t])).values()];

/* ───────── Des pages et des traces aux passages de la frise ───────── */

// regroupement :
//   'trace' : chaque écrit est découpé comme une page (decouper), une tuile par passage. Une journée de mails : des
//             dizaines de tuiles, qui noient le journal ; et autant de peintures, lentes sans carte graphique.
//   'jour'  : tous les écrits d’un jour font une seule tuile, avant la page du journal de ce jour. Avec des sacs, la
//             réunion est exacte, quel que soit l’appareil d’où vient chaque écrit.
//   'appareil' : une tuile par jour et par appareil (l’ordinateur, les mails) : utile si les lectures arrivent minces.
// Rend, dans l’ordre de la frise, des passages comme ceux de calculer() : { cle, date, titre, genre, premier, lu? , texte? }
// - genre : 'depart' | 'page' | 'traces' ; une tuile de traces porte aussi { n, sources } pour son étiquette ;
// - lu : la lecture déjà faite ({ lecture, liste }) quand le texte n’est pas là ; sinon texte, que calculer() lira.
export function passages(pages, traces, { regroupement = 'jour', decouper, lire }) {
  const jours = [...new Set([...pages.map(p => p.date), ...traces.map(t => t.date)])].sort();
  const out = [{ cle: 'depart', texte: '', titre: null, date: jours[0], genre: 'depart', depart: true, premier: true }];
  for (const date of jours) {
    const ts = traces.filter(t => t.date === date).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    if (ts.length) {
      const groupes = regroupement === 'trace' ? ts.map(t => [t]) : regroupement === 'appareil' ? [...Map.groupBy(ts, t => t.appareil).values()] : [ts];
      for (const g of groupes) {
        const info = { date, genre: 'traces', n: g.length, sources: [...new Set(g.map(t => t.source))], titre: null };
        if (regroupement === 'trace' && g[0].forme === 'texte') { // comme une page : découpée en passages
          const d = decouper(g[0].texte);
          (d.length ? d : [{ texte: g[0].texte, titre: null }]).forEach((x, k) => out.push({ ...info, cle: `t:${g[0].id}:${k}`, texte: x.texte, premier: k === 0 }));
        } else out.push({ ...info, cle: `t:${g.map(t => t.id).join(',')}`, lu: lire(g), premier: true });
      }
    }
    const p = pages.find(x => x.date === date);
    if (p) {
      const d = decouper(p.texte);
      (d.length ? d : [{ texte: p.texte, titre: null }]).forEach((x, k) => out.push({ cle: `p:${date}:${k}`, date, genre: 'page', texte: x.texte, titre: x.titre, premier: k === 0 }));
    }
  }
  return out;
}

// L’étiquette d’une tuile : celle d’une page ne change pas ; celle des écrits du jour le dit
export const etiquette = (x, quand) => x.genre === 'depart' ? 'Le départ' : x.genre === 'traces' ? [x.premier && quand(x.date), `les écrits du jour${x.n > 1 ? ` (${x.n})` : ''}`].filter(Boolean).join(' · ') : [x.premier && quand(x.date), x.titre].filter(Boolean).join(' · ');
