// L’archipel : fabrique les icônes de l’app à partir des trois images de départ, dans sources/, avec le Chromium des tests.
// riche : l’emblème sur fond cyan, pour l’écran d’accueil et l’iPhone ; masquable : le même, réduit dans la zone sûre d’Android ;
// symbole : trois couleurs sur transparence, pour l’en-tête et les favicons. Après un changement d’une source : node icones/fabriquer.js
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const SORTIES = [ // [source, image, côté en pixels, recadrer au plus près du dessin]
  ['riche-1024.png', 'icone-192.png', 192],
  ['riche-1024.png', 'icone-512.png', 512],
  ['riche-1024.png', 'apple-touch-icon.png', 180], // l’iPhone arrondit lui-même les coins
  ['masquable-1024.png', 'icone-masquable-192.png', 192],
  ['masquable-1024.png', 'icone-masquable-512.png', 512],
  ['symbole-1024.png', 'symbole-96.png', 96, true], // l’en-tête : 24 px, net jusqu’aux écrans 4x
  ['symbole-1024.png', 'favicon-32.png', 32, true],
  ['symbole-1024.png', 'favicon-16.png', 16, true],
];
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
  for (const [src, png, n, recadrer] of SORTIES) {
    await p.setViewportSize({ width: n, height: n });
    const data = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'sources', src)).toString('base64')}`;
    await p.setContent(`<style>html,body{margin:0;background:transparent}canvas{display:block}</style><canvas id="c" width="${n}" height="${n}"></canvas>`);
    await p.evaluate(async ([data, n, recadrer]) => { // réduite par moitiés successives, pour garder les détails fins
      const img = new Image(); img.src = data; await img.decode();
      let cur = img, w = img.width;
      if (recadrer) { // le symbole, cadré au plus près de son dessin, avec une petite marge : en petit, chaque pixel compte
        const c0 = document.createElement('canvas'); c0.width = c0.height = w; const x0 = c0.getContext('2d'); x0.drawImage(img, 0, 0);
        const a = x0.getImageData(0, 0, w, w).data; let x1 = w, y1 = w, x2 = 0, y2 = 0;
        for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 8) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
        const cote = Math.ceil(Math.max(x2 - x1, y2 - y1) * 1.06), sx = Math.round((x1 + x2 - cote) / 2), sy = Math.round((y1 + y2 - cote) / 2);
        const c1 = document.createElement('canvas'); c1.width = c1.height = cote; c1.getContext('2d').drawImage(img, sx, sy, cote, cote, 0, 0, cote, cote); cur = c1; w = cote;
      }
      while (w / 2 > n) { const c = document.createElement('canvas'); c.width = c.height = w / 2; const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(cur, 0, 0, w / 2, w / 2); cur = c; w /= 2; }
      const x = document.getElementById('c').getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, n, n);
    }, [data, n, !!recadrer]);
    await p.screenshot({ path: path.join(__dirname, png), omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } });
    console.log(`${png} : ${n}×${n}`);
  }
  await b.close();
})();
