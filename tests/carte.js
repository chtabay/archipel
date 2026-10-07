// La carte postale : l’île peinte à l’aquarelle, sur le téléphone, du côté où on la regarde ; à hauteur d’île, ou d’en haut.
// Elle reste ici : rien ne part, sauf si on l’envoie ou l’enregistre. Son nom n’y est écrit que si on le demande.
// Un faux archipel en mémoire : les tests ne touchent jamais la vraie base.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, TELEPHONE, verifier, bilan, surveiller, contexte } = require('./commun');
const OUT = path.join(CAPTURES, 'carte'); fs.mkdirSync(OUT, { recursive: true });
const depot = (id, sujets) => ({ id, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets, fait: [], subi: [] } });
const ile = (id, depots, extra = {}) => ({ id, seed: 4200 + id, nee: new Date().toISOString(), biome: 'prairie', depots, envoyee: false, quittee: null, ...extra });
const semer = (p, s) => p.evaluate(s => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(`archipel:${k}`, JSON.stringify(v)); }, s);
const lire = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent || '', sel);
const PEINTURE = 120000; // sans carte graphique, le pinceau est lent
// ce que montre la carte : sa taille, la couleur de ses coins, l’écart des couleurs en son milieu, et l’encre en bas à gauche
const regarder = p => p.evaluate(async () => {
  const img = document.querySelector('.sheet .carte-postale img'); await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data, px = (i, j) => { const k = 4 * (j * W + i); return [d[k], d[k + 1], d[k + 2]]; };
  const coins = [[8, 8], [W - 9, 8], [8, H - 9], [W - 9, H - 9]].map(([i, j]) => px(i, j));
  let s = 0, s2 = 0, n = 0, encre = 0;
  for (let j = H * .3; j < H * .7; j += 7) for (let i = W * .3; i < W * .7; i += 7) { const [r, g, b] = px(i | 0, j | 0), l = (r + g + b) / 3; s += l; s2 += l * l; n++; }
  for (let j = Math.round(H * .9); j < H * .97; j++) for (let i = 20; i < W * .45; i++) { const [r, g, b] = px(i, j); if (r + g + b < 420) encre++; }
  return { W, H, coins, ecart: Math.sqrt(s2 / n - (s / n) ** 2), encre, src: img.src };
});

(async () => {
  const b = await chromium.launch({ args: GL });
  const c = await contexte(b, { ...TELEPHONE, acceptDownloads: true }), a = c.archipel, p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
  const NOM = 'Le refuge du soir', ancienne = ile(1, [depot(1, ['s7'])], { quittee: new Date().toISOString(), nom: 'La vieille' });
  await p.goto(BASE);
  await semer(p, { ile: ile(2, [depot(1, ['s4']), depot(2, ['s11']), depot(3, ['s3']), depot(4, ['s9'])], { nom: NOM }), iles: [ancienne] });
  await p.reload(); await p.waitForTimeout(1500);

  // 1. parmi les outils de l’île : la carte postale
  const outils = await p.$$eval('#app .outils[aria-label="Ton île"] .outil-texte', l => l.map(n => n.textContent));
  verifier(outils.includes('Carte postale'), `parmi les outils de l’île : « Carte postale » (${outils.join(' · ')})`);
  const avant = await p.evaluate(() => { const v = window.archipel.vue; return { w: v.canvas.width, h: v.canvas.height, pr: v.rendu.getPixelRatio() }; });

  // 2. la feuille : ce qu’elle dit, deux vues, et le pinceau qui passe ; à hauteur d’île d’abord
  await p.click('#app .outil:has-text("Carte postale")'); await p.waitForSelector('.sheet .carte-postale');
  const feuille = await lire(p, '.sheet');
  verifier(/Une carte postale/.test(feuille) && /peinte à l’aquarelle/.test(feuille) && /Elle reste sur ce téléphone, sauf si tu l’envoies/.test(feuille), 'la feuille dit ce qu’est la carte, et qu’elle reste sur ce téléphone');
  const vues = await p.$$eval('.sheet .vues-carte button', l => l.map(n => `${n.textContent}:${n.getAttribute('aria-pressed')}`));
  verifier(vues.join() === 'À hauteur d’île:true,D’en haut:false', `deux vues, à hauteur d’île d’abord (${vues.join(' · ')})`);
  verifier(!(await p.isChecked('.sheet .check input')), 'son nom n’est pas écrit sur la carte, sauf si on le demande');
  await p.waitForSelector('.sheet .carte-postale img', { timeout: PEINTURE });
  const bas = await regarder(p);
  await p.screenshot({ path: path.join(OUT, '1-a-hauteur-d-ile.png') });
  const papier = ([r, g, b]) => r > 225 && g > 220 && b > 200 && r >= b;
  verifier(bas.W === 1500 && bas.H === 1000, `une image de ${bas.W} × ${bas.H}`);
  verifier(bas.coins.every(papier), `ses coins sont du papier : ${bas.coins.map(k => k.join(',')).join(' · ')}`);
  verifier(bas.ecart > 12, `en son milieu, l’île peinte : des couleurs qui varient (écart ${bas.ecart.toFixed(1)})`);
  verifier(bas.encre < 30, `sans son nom, rien d’écrit en bas à gauche (${bas.encre} points d’encre)`);
  const apres = await p.evaluate(() => { const v = window.archipel.vue; return { w: v.canvas.width, h: v.canvas.height, pr: v.rendu.getPixelRatio() }; });
  verifier(apres.w === avant.w && apres.h === avant.h && apres.pr === avant.pr, `la vue de l’île reprend aussitôt, à sa taille (${apres.w} × ${apres.h})`);

  // 3. son nom, si on le demande : la même peinture, et son nom en bas à gauche
  await p.check('.sheet .check input');
  await p.waitForFunction(s => document.querySelector('.sheet .carte-postale img')?.src !== s, bas.src);
  const nommee = await regarder(p);
  verifier(nommee.encre > 300, `avec son nom : de l’encre en bas à gauche (${nommee.encre} points)`);
  await p.screenshot({ path: path.join(OUT, '2-avec-son-nom.png') });

  // 4. l’enregistrer : une image JPEG, nommée sans le nom de l’île
  const dl = p.waitForEvent('download');
  await p.click('.sheet .partage-gestes a'); const f = await dl;
  const octets = fs.readFileSync(await f.path());
  verifier(f.suggestedFilename() === 'carte-postale-archipel.jpg' && octets[0] === 0xff && octets[1] === 0xd8 && octets.length > 50000, `l’enregistrer : ${f.suggestedFilename()}, une image JPEG de ${Math.round(octets.length / 1024)} Ko`);

  // 5. d’en haut : une autre peinture, l’île au milieu du papier
  await p.click('.sheet .vues-carte button:has-text("D’en haut")');
  const pinceau = await p.evaluate(() => [document.querySelector('.sheet .carte-postale')?.textContent, [...document.querySelectorAll('.sheet .vues-carte button')].every(b => b.disabled)]);
  verifier(pinceau[0] === 'Le pinceau passe…' && pinceau[1], 'pendant que le pinceau passe, la feuille le dit, et les vues attendent');
  await p.waitForSelector('.sheet .carte-postale img', { timeout: PEINTURE });
  const haut = await regarder(p);
  verifier(haut.src !== nommee.src && haut.coins.every(papier) && haut.ecart > 12 && haut.encre > 300, `d’en haut : une autre peinture, des coins de papier, son nom toujours écrit (écart ${haut.ecart.toFixed(1)})`);
  await p.screenshot({ path: path.join(OUT, '3-d-en-haut.png') });
  await p.click('.sheet .vues-carte button:has-text("À hauteur d’île")'); await p.waitForTimeout(300);
  verifier(!(await p.$('.sheet .carte-postale p')), 'revenir à une vue déjà peinte ne la repeint pas');
  await p.click('.sheet .quiet:has-text("revenir")'); await p.waitForSelector('.sheet', { state: 'detached' });

  // 6. une île d’avant a sa carte postale aussi
  await p.click('#app .outil:has-text("Tes îles d’avant")'); await p.click('.sheet .row:has-text("La vieille")'); await p.waitForTimeout(800);
  const vieux = await p.$$eval('#app .outils[aria-label="Ton île"] .outil-texte', l => l.map(n => n.textContent));
  verifier(vieux.includes('Carte postale'), `une île d’avant a sa carte postale aussi (${vieux.join(' · ')})`);

  verifier(!a.etat.appels.some(y => /poser|deplacer|retirer|partager|relier|couper/.test(y.f)), 'rien n’est parti dans l’archipel');
  verifier(!e.length && !x.length, `aucune erreur, aucune requête vers l’extérieur${e.length ? ' : ' + e.join(' | ') : ''}${x.length ? ' ; ' + x.join(', ') : ''}`);
  await c.close();

  // 7. sans 3D : pas de carte postale, rien ne casse
  const sans = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl'] });
  const c2 = await contexte(sans), p2 = await c2.newPage(), e2 = [], x2 = []; surveiller(p2, e2, x2);
  await p2.goto(BASE); await semer(p2, { ile: ile(5, [depot(1, ['s4'])], { nom: 'Sans 3D' }) }); await p2.reload(); await p2.waitForTimeout(800);
  const sans3d = await p2.$$eval('#app .outil-texte', l => l.map(n => n.textContent));
  verifier(!sans3d.includes('Carte postale') && !e2.length && !x2.length, `sans 3D, pas de carte postale (${sans3d.join(' · ')})${e2.length ? ' : ' + e2.join(' | ') : ''}`);
  await sans.close();

  await b.close();
  bilan();
})().catch(err => { console.error(err); process.exit(1); });
