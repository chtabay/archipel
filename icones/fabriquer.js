// L’archipel : fabrique les icônes PNG de l’app à partir des deux SVG, avec le Chromium des tests.
// Après avoir changé un SVG : node icones/fabriquer.js
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const SORTIES = [ // [source, image, côté en pixels]
  ['icone.svg', 'icone-192.png', 192],
  ['icone.svg', 'icone-512.png', 512],
  ['icone-masquable.svg', 'icone-masquable-512.png', 512],
  ['icone-masquable.svg', 'apple-touch-icon.png', 180], // l’iPhone arrondit lui-même les coins
];
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
  for (const [svg, png, n] of SORTIES) {
    await p.setViewportSize({ width: n, height: n });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${n}px;height:${n}px}</style>${fs.readFileSync(path.join(__dirname, svg), 'utf8')}`);
    await p.screenshot({ path: path.join(__dirname, png), omitBackground: true });
    console.log(`${png} : ${n}×${n}`);
  }
  await b.close();
})();
