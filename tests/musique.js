// La musique : coupée par défaut, rien sans un geste ; le bouton l’allume et s’en souvient ; cachée, la page se tait ;
// le générateur donne un son propre, sans fichier ni requête.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller, sansIntro, contexte } = require('./commun');
const OUT = path.join(CAPTURES, 'musique'); fs.mkdirSync(OUT, { recursive: true });
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(50); return test(); };
const compter = () => { window.contextes = 0; const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.contextes++; } }; }; // compte les contextes audio ouverts
const etat = p => p.evaluate(() => ({ ...window.archipel.musique.etat(), contextes: window.contextes, texte: document.querySelector('#musique').textContent, presse: document.querySelector('#musique').getAttribute('aria-pressed'), garde: localStorage.getItem('archipel:musique') }));

(async () => {
  const b = await chromium.launch({ args: GL });

  // 1. coupée par défaut : rien n’est ouvert, même après un geste dans l’app
  { const c = await contexte(b); await c.addInitScript(compter); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1200);
    let m = await etat(p);
    verifier(m.contextes === 0 && !m.marche && m.texte === 'musique' && m.presse === 'false' && m.garde === null && !(await p.$eval('#musique', b => b.hidden)), 'coupée par défaut : aucun son, rien n’est ouvert, le bouton dit « musique »');
    await p.click('.opt:has-text("en danger")'); await p.waitForTimeout(600); m = await etat(p);
    verifier(m.contextes === 0 && !m.marche, 'un geste dans l’app n’ouvre pas le son');

    // 2. le bouton l’allume, et s’en souvient
    await p.click('#musique');
    const jouee = await attendre(p, async () => { const m = await etat(p); return m.marche && m.contexte === 'running' && m.notes > 0; });
    m = await etat(p);
    verifier(jouee && m.contextes === 1 && m.texte === 'couper la musique' && m.presse === 'true' && m.garde === '1', `le bouton l’allume : ${m.notes} notes déjà prévues, « ${m.texte} », et le choix est gardé`);
    await p.screenshot({ path: path.join(OUT, 'allumee.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });
    const n0 = m.notes; await p.waitForTimeout(3500); m = await etat(p);
    verifier(m.notes > n0 && m.contexte === 'running', `elle continue de jouer (${n0} puis ${m.notes} notes)`);

    // 3. cachée, la page se tait ; revenue, elle reprend
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    verifier(await attendre(p, async () => (await etat(p)).contexte === 'suspended'), 'la page cachée, la musique se tait');
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    verifier(await attendre(p, async () => (await etat(p)).contexte === 'running'), 'la page revenue, elle reprend');

    // 4. la couper : un fondu, puis plus rien d’ouvert
    await p.click('#musique'); m = await etat(p);
    verifier(!m.marche && m.texte === 'musique' && m.presse === 'false' && m.garde === '0', 'la couper : le bouton redit « musique », et le choix est gardé');
    await p.waitForTimeout(1600); m = await etat(p);
    verifier(m.contexte === 'aucun' && m.notes === 0, 'après le fondu, plus rien n’est ouvert');
    verifier(!e.length && !x.length, `aucune erreur, aucune requête${e.length ? ' : ' + e.join(' | ') : ''}${x.length ? ' ; ' + x.join(', ') : ''}`);
    await c.close(); }

  // 5. allumée la dernière fois : elle attend un premier geste, puis reprend ; quitter ne la rallume pas
  { const c = await contexte(b); await c.addInitScript(compter); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:musique', '1'); }); await p.reload(); await p.waitForTimeout(1200);
    let m = await etat(p);
    verifier(m.contextes === 0 && !m.marche && m.texte === 'musique', 'allumée la dernière fois : rien avant un geste');
    await p.click('.opt:has-text("en danger")');
    verifier(await attendre(p, async () => { const m = await etat(p); return m.marche && m.contexte === 'running'; }) && (await etat(p)).texte === 'couper la musique', 'au premier geste, elle reprend, et le bouton le dit');
    await c.close();
    const c2 = await contexte(b); await c2.addInitScript(compter); const p2 = await c2.newPage();
    await p2.route('https://www.google.fr/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google</title>ailleurs' }));
    await p2.goto(BASE); await p2.evaluate(() => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:musique', '1'); }); await p2.reload(); await p2.waitForTimeout(1000);
    await p2.click('#exit'); await p2.waitForURL(/google\.fr/, { timeout: 5000 });
    verifier(/google\.fr/.test(p2.url()), 'si le premier geste est « quitter », on part sans musique');
    await c2.close(); }

  // 6. le générateur : un son propre, sans fichier
  { const c = await contexte(b), p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE);
    const r = await p.evaluate(async () => {
      const { composer } = await import('./musique.js?v=1');
      const sr = 44100, sec = 16, ctx = new OfflineAudioContext(2, sr * sec, sr), t0 = performance.now(), o = composer(ctx, sec), calcul = Math.round(performance.now() - t0);
      const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
      let pic = 0, s = 0, nan = 0, debut = 0;
      for (let i = 0; i < buf.length; i++) { const a = L[i], b = R[i]; if (!Number.isFinite(a + b)) nan++; pic = Math.max(pic, Math.abs(a), Math.abs(b)); s += a * a + b * b; if (i < sr) debut += a * a + b * b; }
      return { calcul, notes: o.notes, pic: +pic.toFixed(3), rms: +Math.sqrt(s / (2 * buf.length)).toFixed(4), nan, debut: +Math.sqrt(debut / (2 * sr)).toFixed(4) };
    });
    verifier(r.nan === 0 && r.pic > .2 && r.pic < 1 && r.rms > .03 && r.notes > 30 && r.debut < r.rms, `le générateur donne un son propre : ${r.notes} notes en 16 s, pic ${r.pic}, niveau ${r.rms}, calculé en ${r.calcul} ms, le feu d’abord`);
    verifier(!x.length && !e.length, `aucune requête, aucun fichier son, aucune erreur${e.length ? ' : ' + e.join(' | ') : ''}`);
    await c.close(); }

  // 7. sans Web Audio : pas de bouton, et l’app marche pareil
  { const c = await contexte(b); await c.addInitScript(() => { delete window.AudioContext; }); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1000);
    verifier(await p.$eval('#musique', b => b.hidden) && !!(await p.$('.opts')) && !e.length, 'sans Web Audio : pas de bouton, et l’app marche pareil');
    await c.close(); }

  await b.close();
  bilan();
})().catch(e => { console.error(e); process.exit(1); });
