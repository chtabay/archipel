// Le chemin : ce que le catalogue couvre. Les 3 000 mots pleins les plus fréquents du français (outils/mots-courants.tsv), lus
// un par un par le moteur de sens, tel qu’il tourne dans l’app : formes, pluriels, symboles ; et pour chacun l’objet le plus
// proche. Rend les comptes par nature de mot, écrit outils/couverture.tsv, et montre les mots fréquents qui n’ont encore rien :
// ce qu’il reste à trouver, ou à construire.   node chemin/outils/couverture.mjs [--sans <nombre>]
import fs from 'fs';
import { preparer, regarder } from '../sens.js';
const R = new URL('../', import.meta.url), lire = f => fs.readFileSync(new URL(f, R)), tampon = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const S = preparer(lire('sens/mots.txt').toString(), tampon(lire('sens/vecteurs.bin')), tampon(lire('sens/objets.bin')), JSON.parse(lire('catalogue.json')), tampon(lire('sens/images.bin')), lire('sens/formes.txt').toString(), lire('sens/symboles.txt').toString());
const sans = +(process.argv[process.argv.indexOf('--sans') + 1] || 0) || 60;
const mots = lire('outils/mots-courants.tsv').toString().split('\n').filter(l => l && !l.startsWith('#')).map(l => { const [mot, nature, freq] = l.split('\t'); return { mot, nature, freq: +freq }; });
const verdictDe = r => (r.via === 'vide' ? 'vide' : r.i == null ? 'hors vocabulaire' : r.score >= .7 ? 'objet' : r.porteur ? 'porteur' : 'rien'); // vide : un mot qui ne porte rien, exprès
const lignes = mots.map((m, n) => { const r = regarder(S, m.mot); return { rang: n + 1, ...m, via: r.via || '', lemme: r.lemme || '', score: r.i == null ? '' : r.score.toFixed(2), verdict: verdictDe(r), objet: r.objet?.id || '', noms: (r.objet?.noms || []).slice(0, 3).join(' ') }; });
fs.writeFileSync(new URL('outils/couverture.tsv', R), ['rang\tmot\tnature\tfréquence\tvia\tlemme\tscore\tverdict\tobjet le plus proche\tses noms', ...lignes.map(l => [l.rang, l.mot, l.nature, l.freq, l.via, l.lemme, l.score, l.verdict, l.objet, l.noms].join('\t'))].join('\n') + '\n');
const natures = ['nom', 'verbe', 'adjectif', 'adverbe'], verdicts = ['objet', 'porteur', 'rien', 'vide', 'hors vocabulaire'], total = {};
console.log('nature      mots   objet (≥ 0,7)   porteur   rien   vide   hors vocabulaire');
for (const n of [...natures, 'tous']) {
  const l = lignes.filter(x => n === 'tous' || x.nature === n), c = Object.fromEntries(verdicts.map(v => [v, l.filter(x => x.verdict === v).length]));
  if (n === 'tous') total.objet = c.objet;
  console.log(`${n.padEnd(10)} ${String(l.length).padStart(5)}   ${String(c.objet).padStart(5)}  ${String(Math.round(100 * c.objet / l.length)).padStart(3)} %   ${String(c.porteur).padStart(5)}   ${String(c.rien).padStart(5)}  ${String(c.vide).padStart(5)}   ${String(c['hors vocabulaire']).padStart(5)}`);
}
for (const n of ['nom', 'verbe', 'adjectif']) {
  const l = lignes.filter(x => x.nature === n && x.verdict !== 'objet').slice(0, sans);
  console.log(`\nles ${sans} ${n}s les plus fréquents sans objet :\n` + l.map(x => `${x.mot}${x.verdict === 'porteur' ? '°' : x.verdict === 'hors vocabulaire' ? '?' : x.verdict === 'vide' ? '·' : ''}`).join(' '));
}
console.log('\n° : porteur sans objet (fait une image, ou touche un champ) · ? : hors vocabulaire · · : vide, exprès · écrit outils/couverture.tsv');
