// La musique : coupée par défaut, rien sans un geste ; un bouton de son sur la vue de l’île et sur celle de l’archipel,
// chacune avec sa pièce ; le silence ailleurs ; cachée, la page se tait ; les deux générateurs donnent un son propre.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { BASE, OUT: CAPTURES, GL, verifier, bilan, surveiller, sansIntro, contexte } = require('./commun');
const OUT = path.join(CAPTURES, 'musique'); fs.mkdirSync(OUT, { recursive: true });
const attendre = async (p, test, delai = 8000) => { const fin = Date.now() + delai; while (!(await test()) && Date.now() < fin) await p.waitForTimeout(50); return test(); };
const compter = () => { window.contextes = 0; const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.contextes++; } }; }; // compte les contextes audio ouverts
const etat = p => p.evaluate(() => ({ ...window.archipel.musique.etat(), contextes: window.contextes, bouton: document.querySelector('.son')?.getAttribute('aria-pressed') ?? null, garde: localStorage.getItem('archipel:musique') }));
const ile = JSON.stringify({ id: 1, seed: 4242, nee: new Date().toISOString(), biome: 'prairie', depots: [{ id: 1, date: new Date().toISOString(), quad: 'N', texte: false, answers: { situ: [], mots: [], sujets: ['s4', 's11'], fait: [], subi: [] } }], envoyee: false, quittee: null });
const semer = p => p.evaluate(i => { localStorage.clear(); localStorage.setItem('archipel:intro', '1'); localStorage.setItem('archipel:ile', i); }, ile);
const cachee = (p, oui) => p.evaluate(h => { Object.defineProperty(document, 'hidden', { get: () => h, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, oui);

(async () => {
  const b = await chromium.launch({ args: GL });

  // 1. coupée par défaut : rien n’est ouvert, même après un geste ; le bouton est sur la vue de l’île, et nulle part ailleurs
  { const c = await contexte(b); await c.addInitScript(compter); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await p.evaluate(sansIntro); await p.reload(); await p.waitForTimeout(1200);
    let m = await etat(p);
    verifier(m.contextes === 0 && !m.sonore && m.bouton === null && m.garde === null, 'coupée par défaut : aucun son, rien n’est ouvert, pas de bouton sur les questions');
    await p.click('.opt:has-text("en danger")'); await p.waitForTimeout(600); m = await etat(p);
    verifier(m.contextes === 0 && !m.sonore, 'un geste dans l’app n’ouvre pas le son');
    await p.click('[data-onglet="ile"]'); await p.waitForTimeout(1200); m = await etat(p);
    verifier(m.bouton === 'false' && m.contextes === 0 && (await p.getAttribute('.son', 'aria-label')) === 'Allumer la musique', 'sur l’île, le bouton de son est là, coupé');

    // 2. le bouton l’allume : le feu de camp, et le choix est gardé
    await p.click('.son');
    const jouee = await attendre(p, async () => { const m = await etat(p); return m.sonore && m.piece === 'ile' && m.contexte === 'running' && m.notes > 0; });
    m = await etat(p);
    verifier(jouee && m.contextes === 1 && m.bouton === 'true' && m.garde === '1', `le bouton l’allume : le feu de camp, ${m.notes} notes déjà prévues, et le choix est gardé`);
    await p.screenshot({ path: path.join(OUT, 'ile.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });
    const n0 = m.notes; await p.waitForTimeout(3500); m = await etat(p);
    verifier(m.notes > n0 && m.contexte === 'running', `elle continue de jouer (${n0} puis ${m.notes} notes)`);

    // 3. dans l’archipel, l’autre pièce, en fondu, dans le même contexte
    await p.click('[data-onglet="archipel"]');
    verifier(await attendre(p, async () => { const m = await etat(p); return m.sonore && m.piece === 'archipel' && m.contexte === 'running' && m.notes > 0; }) && (await etat(p)).contextes === 1 && (await etat(p)).bouton === 'true', 'dans l’archipel, la mer prend la place du feu de camp, et le bouton y est aussi, allumé');
    await p.waitForTimeout(1500); await p.screenshot({ path: path.join(OUT, 'archipel.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });

    // 4. ailleurs, le silence ; de retour sur l’île, le feu de camp reprend
    await p.click('[data-onglet="deposer"]');
    verifier(await attendre(p, async () => { const m = await etat(p); return !m.sonore && m.piece === null && m.contexte === 'suspended'; }), 'sur les questions, la musique se tait, et le contexte se met en pause');
    await p.click('[data-onglet="ile"]');
    verifier(await attendre(p, async () => { const m = await etat(p); return m.sonore && m.piece === 'ile' && m.contexte === 'running'; }), 'de retour sur l’île, le feu de camp reprend');

    // 5. cachée, la page se tait ; revenue, elle reprend
    await cachee(p, true);
    verifier(await attendre(p, async () => (await etat(p)).contexte === 'suspended'), 'la page cachée, la musique se tait');
    await cachee(p, false);
    verifier(await attendre(p, async () => (await etat(p)).contexte === 'running'), 'la page revenue, elle reprend');

    // 6. la couper : un fondu, puis plus rien d’ouvert
    await p.click('.son'); m = await etat(p);
    verifier(!m.sonore && m.bouton === 'false' && m.garde === '0' && (await p.getAttribute('.son', 'aria-label')) === 'Couper la musique'.replace('Couper', 'Allumer'), 'la couper : le bouton se barre, et le choix est gardé');
    await p.waitForTimeout(1600); m = await etat(p);
    verifier(m.contexte === 'aucun' && m.notes === 0, 'après le fondu, plus rien n’est ouvert');
    verifier(!e.length && !x.length, `aucune erreur, aucune requête${e.length ? ' : ' + e.join(' | ') : ''}${x.length ? ' ; ' + x.join(', ') : ''}`);
    await c.close(); }

  // 7. allumée la dernière fois : sur l’île, elle attend un premier geste, puis joue
  { const c = await contexte(b); await c.addInitScript(compter); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await semer(p); await p.evaluate(() => localStorage.setItem('archipel:musique', '1')); await p.reload(); await p.waitForTimeout(1500);
    let m = await etat(p);
    verifier(m.contextes === 0 && !m.sonore && m.attendue === 'ile' && m.bouton === 'true', 'allumée la dernière fois : le bouton le dit, mais rien avant un geste');
    await p.click('.tourner');
    verifier(await attendre(p, async () => { const m = await etat(p); return m.sonore && m.piece === 'ile' && m.contexte === 'running'; }), 'au premier geste sur l’île, le feu de camp joue');
    verifier(!e.length && !x.length, `aucune erreur, aucune requête${e.length ? ' : ' + e.join(' | ') : ''}`);
    await c.close(); }

  // 8. si le premier geste mène ailleurs, ou sert à quitter, pas de musique
  { const c = await contexte(b); await c.addInitScript(compter); const p = await c.newPage();
    await p.goto(BASE); await semer(p); await p.evaluate(() => localStorage.setItem('archipel:musique', '1')); await p.reload(); await p.waitForTimeout(1200);
    await p.click('[data-onglet="deposer"]'); await p.waitForTimeout(1200);
    const m = await etat(p);
    verifier(!m.sonore && m.piece === null && m.attendue === null && m.contexte !== 'running', 'si le premier geste mène aux questions, pas de musique');
    await c.close();
    const c2 = await contexte(b); const p2 = await c2.newPage();
    await p2.route('https://www.google.fr/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google</title>ailleurs' }));
    await p2.goto(BASE); await semer(p2); await p2.evaluate(() => localStorage.setItem('archipel:musique', '1')); await p2.reload(); await p2.waitForTimeout(1000);
    await p2.click('#exit'); await p2.waitForURL(/google\.fr/, { timeout: 5000 });
    verifier(/google\.fr/.test(p2.url()), 'si le premier geste est « quitter », on part sans musique');
    await c2.close(); }

  // 9. les deux générateurs : un son propre, sans fichier
  { const c = await contexte(b), p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE);
    for (const piece of ['ile', 'archipel']) {
      const r = await p.evaluate(async piece => {
        const { composer } = await import('./musique.js?v=2');
        const sr = 44100, sec = 16, ctx = new OfflineAudioContext(2, sr * sec, sr), t0 = performance.now(), o = composer(ctx, sec, piece), calcul = Math.round(performance.now() - t0);
        const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
        let pic = 0, s = 0, nan = 0;
        for (let i = 0; i < buf.length; i++) { const a = L[i], b = R[i]; if (!Number.isFinite(a + b)) nan++; pic = Math.max(pic, Math.abs(a), Math.abs(b)); s += a * a + b * b; }
        return { calcul, notes: o.notes, pic: +pic.toFixed(3), rms: +Math.sqrt(s / (2 * buf.length)).toFixed(4), nan };
      }, piece);
      verifier(r.nan === 0 && r.pic > .15 && r.pic < 1 && r.rms > .02 && r.notes > (piece === 'ile' ? 30 : 12), `${piece === 'ile' ? 'le feu de camp' : 'la mer'} : un son propre, ${r.notes} notes en 16 s, pic ${r.pic}, niveau ${r.rms}, calculé en ${r.calcul} ms`);
    }
    verifier(!x.length && !e.length, `aucune requête, aucun fichier son, aucune erreur${e.length ? ' : ' + e.join(' | ') : ''}`);
    await c.close(); }

  // 10. sans Web Audio : pas de bouton, et l’app marche pareil
  { const c = await contexte(b); await c.addInitScript(() => { delete window.AudioContext; }); const p = await c.newPage(), e = [], x = []; surveiller(p, e, x);
    await p.goto(BASE); await semer(p); await p.reload(); await p.waitForTimeout(1200);
    verifier(!(await p.$('.son')) && !!(await p.$('.tourner')) && !e.length, 'sans Web Audio : pas de bouton de son, et l’île est là');
    await c.close(); }

  await b.close();
  bilan();
})().catch(e => { console.error(e); process.exit(1); });
