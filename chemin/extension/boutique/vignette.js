// La petite vignette du Chrome Web Store, 440 × 280 : un morceau de la frise peinte, pris dans 1-chemin.png, et le nom.
//   node chemin/extension/boutique/vignette.js            → écrit 4-vignette.png ici, depuis 1-chemin.png
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RACINE = path.resolve(__dirname, '../../..');
const SOURCE = path.join(__dirname, '1-chemin.png'), SORTIE = path.join(__dirname, '4-vignette.png');
// le morceau de frise, dans la capture 1280 × 800 : 600 × 382, au rapport de la vignette
const X = 140, Y = 70, L = 600, E = L * 280 / 440, K = 440 / L;
const page = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: Nunito; src: url("${path.join(RACINE, 'fonts/nunito.woff2')}") format("woff2"); font-weight: 200 1000; }
  html, body { margin: 0; width: 440px; height: 280px; overflow: hidden; background: #f4efe4; }
  .frise { position: absolute; inset: 0; background: url("${SOURCE}") no-repeat; background-size: ${1280 * K}px ${800 * K}px; background-position: ${-X * K}px ${-Y * K}px; }
  .nom { position: absolute; left: 22px; top: 16px; margin: 0; font: 800 40px/1 Nunito, sans-serif; letter-spacing: .01em; color: #3a332c;
         text-shadow: 0 0 10px rgba(244, 239, 228, .95), 0 0 3px rgba(244, 239, 228, .9); }
</style><div class="frise"></div><p class="nom">Le chemin</p>`;

(async () => {
  if (!fs.existsSync(SOURCE)) throw new Error('1-chemin.png manque : node chemin/extension/boutique/captures.js');
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  const html = path.join(require('os').tmpdir(), 'chemin-vignette.html'); fs.writeFileSync(html, page);
  await p.goto(`file://${html}`); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: SORTIE }); await b.close(); fs.rmSync(html, { force: true });
  console.log(`écrit : ${path.relative(process.cwd(), SORTIE)} (440 × 280)`);
})().catch(e => { console.error(e); process.exit(1); });
