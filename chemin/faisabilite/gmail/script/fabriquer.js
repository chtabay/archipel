// Le chemin, route B : fabriquer Code.gs, le fichier unique à coller dans Apps Script. Apps Script ne connaît pas les modules :
// on recopie extraire.js, mime.js et gmail.js sans leurs import et export, puis Code.js. La lecture des mails est donc la même
// sur le téléphone et dans le script. node chemin/faisabilite/gmail/script/fabriquer.js
const fs = require('fs'), path = require('path');
const ICI = __dirname, HAUT = path.join(ICI, '..');

function fabriquer() {
  const morceau = f => `// ───────── ${f} ─────────\n` + fs.readFileSync(path.join(HAUT, f), 'utf8')
    .replace(/^import [^;]+;\n/gm, '').replace(/^export (?=(async )?function|const|let|class)/gm, '');
  return ['// Fabriqué par fabriquer.js : ne pas modifier à la main.', morceau('extraire.js'), morceau('mime.js'), morceau('gmail.js'),
    `// ───────── script/Code.js ─────────\n${fs.readFileSync(path.join(ICI, 'Code.js'), 'utf8')}`].join('\n\n');
}
module.exports = { fabriquer };
if (require.main === module) { fs.writeFileSync(path.join(ICI, 'Code.gs'), fabriquer()); console.log('script/Code.gs fabriqué'); }
