// L’archipel : deux petites musiques, jouées par le navigateur lui-même. Aucun fichier son : les cordes sont calculées,
// le reste est fait de nœuds Web Audio. Sur l’île, un feu de camp : une guitare en arpèges, un harmonica de loin, le feu
// qui crépite. Dans l’archipel, la mer au soir : une boîte à musique, une nappe, les vagues, une cloche au loin.
// Coupées par défaut : elles ne jouent que si on les allume, et jamais deux fois la même chose. Elles se taisent quand
// on quitte la vue, quand la page est cachée, et quand on quitte.

const midiHz = m => 440 * 2 ** ((m - 69) / 12);
const alea = graine => { let s = Math.abs(Math.floor(graine)) % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const rampe = (param, t, vers, duree) => { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(vers, t + duree); };

/* ───────── Les sons ───────── */

// une corde pincée : un bruit bref qui tourne dans une boucle accordée, et s’éteint doucement (Karplus-Strong)
export function corde(sr, f, { t60 = 3.2, eclat = .45, position = .2, duree = 4, graine = 1 } = {}) {
  const n = Math.floor(sr * duree), out = new Float32Array(n), r = alea(graine);
  const P = sr / f, N = Math.floor(P - .5 - 1e-6), frac = P - .5 - N, C = (1 - frac) / (1 + frac); // la boucle : N échantillons, la moyenne (½), le passe-tout (frac)
  const perte = 10 ** (-3 / (f * t60)), ligne = new Float32Array(N);
  let lp = 0; const k = .12 + .7 * eclat; // un pincement plus ou moins brillant
  for (let i = 0; i < N; i++) { lp += k * (r() * 2 - 1 - lp); ligne[i] = lp; }
  const M = Math.max(1, Math.round(position * N)); for (let i = N - 1; i >= M; i--) ligne[i] -= ligne[i - M]; // l’endroit où le doigt pince
  let moy = 0; for (const v of ligne) moy += v; moy /= N; let pic = 0; for (let i = 0; i < N; i++) { ligne[i] -= moy; pic = Math.max(pic, Math.abs(ligne[i])); }
  for (let i = 0; i < N; i++) ligne[i] /= pic || 1;
  let j = 0, avant = 0, apx = 0, apy = 0;
  for (let i = 0; i < n; i++) {
    const x = ligne[j], moyenne = .5 * (x + avant); avant = x;
    const y = C * moyenne + apx - C * apy; apx = moyenne; apy = y;
    ligne[j] = perte * y; out[i] = x; j = j + 1 === N ? 0 : j + 1;
  }
  const fin = Math.floor(sr * .08); for (let i = 0; i < fin; i++) out[n - 1 - i] *= i / fin; // pas de clic à la fin
  return out;
}

// le feu : un souffle sourd, et des crépitements au hasard
export function feu(sr, duree, graine = 3) {
  const n = Math.floor(sr * duree), out = new Float32Array(n), r = alea(graine), b = () => r() * 2 - 1;
  let brun = 0, lp = 0;
  for (let i = 0; i < n; i++) { brun = .997 * brun + .03 * b(); lp += .09 * (brun - lp); out[i] = lp * .35 * (1 + .35 * Math.sin(i / sr * 1.3) * Math.sin(i / sr * .47)); } // le souffle, qui monte et retombe
  for (let t = r() * .2; t < duree; t += -Math.log(1 - r() * .999) / 6) {
    const i0 = Math.floor(t * sr), a = r() ** 2.4 * .7, long = Math.floor(sr * (.0006 + r() * .004)), grave = r() < .12;
    let p = 0;
    for (let k = 0; k < long && i0 + k < n; k++) { const w = b(), h = grave ? w : w - p; p = w; out[i0 + k] += a * h * Math.exp(-k / (long * .28)) * (grave ? 1.6 : 1); }
  }
  return out;
}

function impulsion(ctx, duree = 2.4, graine = 11) { // une réverbération tiède : un bruit qui s’éteint, de plus en plus sourd
  const sr = ctx.sampleRate, n = Math.floor(sr * duree), buf = ctx.createBuffer(2, n, sr), r = alea(graine);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / sr, k = .06 + .55 * Math.exp(-t / .45); lp += k * (r() * 2 - 1 - lp); d[i] = lp * Math.exp(-t / .7) * Math.min(1, t / .015); }
  }
  return buf;
}

function harmonica(ctx, sortie, t, f, duree, force) { // une anche : deux oscillateurs, un filtre chaud, un vibrato qui vient tard
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), m2 = ctx.createGain(), vib = ctx.createOscillator(), vd = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = .5; pk.type = 'peaking'; pk.frequency.value = 1250; pk.Q.value = 1.1; pk.gain.value = 4;
  o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = o2.frequency.value = f; o2.detune.value = 6; m2.gain.value = .35;
  vib.frequency.value = 5.1; vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(0, t + .35); vd.gain.linearRampToValueAtTime(11, t + Math.max(.4, duree * .8));
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(force, t + .12); g.gain.setTargetAtTime(force * .78, t + .12, .25); g.gain.setTargetAtTime(0, t + duree, .14);
  vib.connect(vd); vd.connect(o1.detune); vd.connect(o2.detune); o1.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(pk); pk.connect(g); g.connect(sortie);
  for (const o of [o1, o2, vib]) { o.start(t); o.stop(t + duree + 1); }
}

function boite(ctx, sortie, t, f, force, pan = 0, longue = false) { // une boîte à musique : trois partiels qui s’éteignent, le plus haut en premier
  const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sortie);
  for (const [k, a, tau] of [[1, 1, longue ? 1.1 : .7], [2.005, .3, .2], [3.01, .1, .1]]) { // le rapport, la force, le temps pour s’éteindre
    const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = f * k;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(force * a, t + .006); e.gain.setTargetAtTime(0, t + .006, tau);
    o.connect(e); e.connect(g); o.start(t); o.stop(t + tau * 8);
  }
}

function cloche(ctx, sortie, t, f, force, pan) { // une cloche au loin : des partiels qui ne s’accordent pas tout à fait
  const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sortie);
  for (const [k, a, tau] of [[1, 1, 2.2], [2.76, .45, 1.3], [5.4, .18, .7]]) {
    const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = f * k;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(force * a, t + .01); e.gain.setTargetAtTime(0, t + .01, tau);
    o.connect(e); e.connect(g); o.start(t); o.stop(t + tau * 7);
  }
}

function nappe(ctx, sortie, t, duree, notes, force) { // une nappe : deux dents de scie désaccordées par note, filtrées bas, qui montent et redescendent lentement
  const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = .6;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(force, t + 2.4); g.gain.setValueAtTime(force, t + duree - 2.2); g.gain.linearRampToValueAtTime(0, t + duree + .6);
  for (const m of notes) for (const d of [-5, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + duree + 1); }
  f.connect(g); g.connect(sortie);
}

function vagues(ctx, sortie) { // la mer : un souffle qui va et vient, et l’écume, plus claire, à son propre rythme
  const sr = ctx.sampleRate, n = sr * 4, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), r = alea(5), arrets = [];
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  const couche = (freq, type, q, base, ampl, lfoHz, niveau) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), sg = ctx.createGain();
    s.buffer = b; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = base; lfo.frequency.value = lfoHz; lg.gain.value = ampl; lfo.connect(lg); lg.connect(g.gain); sg.gain.value = niveau;
    s.connect(f); f.connect(g); g.connect(sg); sg.connect(sortie); s.start(0); lfo.start(0);
    arrets.push(() => { s.stop(); lfo.stop(); });
  };
  couche(520, 'lowpass', .7, .55, .45, .09, .13); // le souffle
  couche(1900, 'bandpass', .9, .35, .3, .13, .05); // l’écume
  return () => { for (const a of arrets) try { a(); } catch { /* déjà arrêtée */ } };
}

/* ───────── L’île : le feu de camp ───────── */
// La grille : ré majeur, des accords ouverts, deux mesures de 6/8 chacun. Les notes en MIDI, du grave à l’aigu.

const CROCHE = .3; // la durée d’une croche, en secondes
const ACCORDS = [
  { nom: 'Dadd9', notes: [50, 57, 62, 64, 66], basse2: 45 },
  { nom: 'Bm7(11)', notes: [47, 54, 57, 62, 64], basse2: 54 },
  { nom: 'Gmaj7', notes: [43, 50, 59, 62, 66], basse2: 50 },
  { nom: 'Asus4-A', notes: [45, 52, 57, 62, 64], fin: [45, 52, 57, 61, 64], basse2: 52 },
];
const MOTIFS = [[0, 2, 3, 4, 3, 2], [0, 2, 4, 3, 2, 3], [0, 1, 3, 4, 3, 1], [0, null, 3, 4, null, 2], [0, 2, 3, 2, 4, 3]];
// un air, lent, par-dessus : [croche de départ, note, durée en croches], pour chaque accord ; deux airs, pour ne pas lasser
const AIRS = [
  [[[0, 69, 4], [5, 66, 3], [8, 64, 4]], [[0, 66, 5], [6, 62, 6]], [[0, 71, 3], [3, 69, 3], [6, 66, 6]], [[0, 64, 6], [7, 61, 5]]],
  [[[0, 74, 3], [3, 73, 3], [6, 71, 5]], [[0, 69, 4], [5, 66, 6]], [[0, 67, 3], [3, 71, 3], [6, 69, 5]], [[0, 66, 4], [4, 64, 3], [7, 62, 5]]],
];
const cordes = new Map(); // chaque note, calculée une fois, gardée d’une fois sur l’autre

function sortieCommune(ctx, sortie, reverbDuree, reverbGraine, retourGain) { // la réverbération, le compresseur, le volume : pareil pour les deux pièces
  const maitre = ctx.createGain(), volume = ctx.createGain(), comp = ctx.createDynamicsCompressor(), reverb = ctx.createConvolver(), retour = ctx.createGain();
  comp.threshold.value = -16; comp.ratio.value = 2.5; comp.attack.value = .01; comp.release.value = .3; maitre.gain.value = .7; volume.gain.value = 1;
  reverb.buffer = impulsion(ctx, reverbDuree, reverbGraine); retour.gain.value = retourGain; reverb.connect(retour); retour.connect(maitre); maitre.connect(comp); comp.connect(volume); volume.connect(sortie);
  return { maitre, volume, reverb };
}

export function feuDeCamp(ctx, sortie = ctx.destination) {
  const sr = ctx.sampleRate, { maitre, volume, reverb } = sortieCommune(ctx, sortie, 2.4, 11, .9);
  const guitare = ctx.createGain(), hp = ctx.createBiquadFilter(), corps = ctx.createBiquadFilter(), doux = ctx.createBiquadFilter(), envoiG = ctx.createGain();
  hp.type = 'highpass'; hp.frequency.value = 70; corps.type = 'peaking'; corps.frequency.value = 190; corps.Q.value = 1; corps.gain.value = 3; doux.type = 'lowpass'; doux.frequency.value = 6200;
  guitare.connect(hp); hp.connect(corps); corps.connect(doux); doux.connect(maitre); doux.connect(envoiG); envoiG.gain.value = .32; envoiG.connect(reverb);
  const anche = ctx.createGain(), envoiA = ctx.createGain(); anche.gain.value = .11; envoiA.gain.value = .5; anche.connect(maitre); anche.connect(envoiA); envoiA.connect(reverb);
  const pincer = (t, m, force, basse = false) => {
    const cle = `${sr}:${m}:${basse}`;
    if (!cordes.has(cle)) { const d = corde(sr, midiHz(m), { t60: basse ? 6 : 3.8 + (70 - m) * .04, eclat: basse ? .35 : .5, position: basse ? .23 : .17, duree: basse ? 5.5 : 4.5, graine: m * 31 + 5 }), b = ctx.createBuffer(1, d.length, sr); b.copyToChannel(d, 0); cordes.set(cle, b); }
    const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = cordes.get(cle); g.gain.value = force; p.pan.value = Math.max(-.35, Math.min(.35, (m - 56) / 36));
    s.connect(g); g.connect(p); p.connect(guitare); s.start(Math.max(0, t));
  };
  const fb = feu(sr, 7), bf = ctx.createBuffer(1, fb.length, sr); bf.copyToChannel(fb, 0); // le feu, tout du long
  const sf = ctx.createBufferSource(), gf = ctx.createGain(), bp = ctx.createBiquadFilter(); sf.buffer = bf; sf.loop = true; bp.type = 'highpass'; bp.frequency.value = 140; gf.gain.value = .55;
  sf.connect(bp); bp.connect(gf); gf.connect(maitre); sf.start(0);
  let notes = 0, cycle = 0, ia = 0;
  return {
    volume, get notes() { return notes; },
    // un accord : deux mesures de guitare, et l’air par-dessus un tour sur deux, un tour sur trois sans lui. Rend l’instant où il finit.
    suite(t, r) {
      const a = ACCORDS[ia], air = cycle % 3 ? AIRS[cycle % 2] : null;
      for (let mesure = 0; mesure < 2; mesure++) {
        const motif = MOTIFS[Math.floor(r() * MOTIFS.length)], ns = mesure && a.fin ? a.fin : a.notes;
        motif.forEach((ix, k) => {
          if (ix === null || (k && r() < .06)) return; // parfois une note manque : c’est joué à la main
          const basse = k === 0, m = basse && mesure && r() < .6 ? a.basse2 : ns[ix];
          pincer(t + (mesure * 6 + k) * CROCHE + (r() - .5) * .018, m, basse ? .95 : .5 + r() * .22, basse); notes++;
        });
      }
      if (air) for (const [dep, m, du] of air[ia]) { harmonica(ctx, anche, t + dep * CROCHE + .03, midiHz(m), du * CROCHE, .9); notes++; }
      if (++ia === ACCORDS.length) { ia = 0; cycle++; }
      return t + 12 * CROCHE;
    },
    arreter() { try { sf.stop(); } catch { /* déjà arrêté */ } },
  };
}

/* ───────── L’archipel : la mer au soir ───────── */
// Mi mineur, lent : une nappe sur la basse, une boîte à musique sur huit temps avec des silences, un air certains tours,
// une cloche au loin de temps en temps, et les vagues tout du long.

const TEMPS = .85; // la durée d’un temps, en secondes
const ACCORDS_MER = [
  { nom: 'Em9', nappe: [40, 47], notes: [62, 66, 71, 74, 78] },
  { nom: 'Cmaj9', nappe: [36, 43], notes: [62, 64, 67, 71, 76] },
  { nom: 'Gmaj7', nappe: [43, 50], notes: [59, 62, 66, 71, 74] },
  { nom: 'Dsus2', nappe: [38, 45], notes: [57, 62, 64, 69, 76] },
];
const MOTIFS_MER = [[0, null, 2, 3, null, 4, null, 1], [0, 2, null, 3, 4, null, 2, null], [null, 1, 3, null, 4, 3, null, 0], [0, null, null, 3, null, 4, 2, null]];
const AIRS_MER = [ // [temps de départ, note], pour chaque accord
  [[[0, 83], [4, 79]], [[1, 81], [5, 76]], [[0, 78], [2, 79], [4, 74]], [[0, 76], [5, 74]]],
  [[[1, 79], [3, 83]], [[0, 76], [4, 79]], [[1, 81], [3, 78]], [[0, 74], [4, 76]]],
];

export function mer(ctx, sortie = ctx.destination) {
  const { maitre, volume, reverb } = sortieCommune(ctx, sortie, 3.2, 13, 1.1);
  const boiteG = ctx.createGain(), envoiB = ctx.createGain(); boiteG.gain.value = .68; envoiB.gain.value = .6; boiteG.connect(maitre); boiteG.connect(envoiB); envoiB.connect(reverb);
  const nappeG = ctx.createGain(), envoiN = ctx.createGain(); nappeG.gain.value = .1; envoiN.gain.value = .4; nappeG.connect(maitre); nappeG.connect(envoiN); envoiN.connect(reverb);
  const clocheG = ctx.createGain(), envoiC = ctx.createGain(); clocheG.gain.value = .3; envoiC.gain.value = 1; clocheG.connect(maitre); clocheG.connect(envoiC); envoiC.connect(reverb);
  const merG = ctx.createGain(); merG.gain.value = 1; merG.connect(maitre); const arretVagues = vagues(ctx, merG);
  let notes = 0, cycle = 0, ia = 0;
  return {
    volume, get notes() { return notes; },
    suite(t, r) { // un accord : la nappe, les notes de la boîte à musique, l’air par-dessus, une cloche parfois
      const a = ACCORDS_MER[ia], duree = 8 * TEMPS, motif = MOTIFS_MER[Math.floor(r() * MOTIFS_MER.length)];
      nappe(ctx, nappeG, t, duree, a.nappe, 1); notes++;
      motif.forEach((ix, k) => { if (ix === null || r() < .08) return; const m = a.notes[ix]; boite(ctx, boiteG, t + k * TEMPS + (r() - .5) * .03, midiHz(m), .2 + r() * .1, Math.max(-.5, Math.min(.5, (m - 68) / 24))); notes++; });
      if (cycle % 3 === 1 || (cycle % 3 === 2 && r() < .7)) for (const [dep, m] of AIRS_MER[cycle % 2][ia]) { boite(ctx, boiteG, t + dep * TEMPS, midiHz(m), .3, (m - 80) / 30, true); notes++; }
      if (r() < .25) { cloche(ctx, clocheG, t + r() * duree, midiHz([52, 59, 64][Math.floor(r() * 3)]), .09, r() < .5 ? -.7 : .7); notes++; }
      if (++ia === ACCORDS_MER.length) { ia = 0; cycle++; }
      return t + duree;
    },
    arreter() { arretVagues(); },
  };
}

export const PIECES = { ile: feuDeCamp, archipel: mer };

// Compose une pièce jusqu’à `secondes`, dans n’importe quel contexte, en une fois : pour la rendre hors ligne, et pour l’essayer.
export function composer(ctx, secondes, piece = 'ile', graine = 7) {
  const o = PIECES[piece](ctx), r = alea(graine); let t = piece === 'ile' ? 1.4 : .8;
  while (t < secondes) t = o.suite(t, r);
  return o;
}

/* ───────── Jouer, se taire, couper ───────── */
// Une pièce à la fois, planifiée au fur et à mesure, deux secondes et demie devant le temps du navigateur.
// On passe de l’une à l’autre en fondu. Le navigateur n’ouvre le son qu’après un geste : avant, la pièce attend le premier.

let ctx = null, courant = null, minuteur = null, sonore = false, attendue = null, fondu = null;
const actif = () => navigator.userActivation?.hasBeenActive ?? true;
function planifier() { if (!ctx || !courant || !sonore) return; while (courant.suivant < ctx.currentTime + 2.5) courant.suivant = courant.o.suite(courant.suivant, courant.r); }
function eteindre(c, ctxDe, duree) { rampe(c.o.volume.gain, ctxDe.currentTime, 0, duree); setTimeout(() => c.o.arreter(), duree * 1000 + 200); } // une pièce qui se tait : un fondu, puis ses sources s’arrêtent
export const musique = {
  get disponible() { return typeof AudioContext === 'function'; },
  get piece() { return sonore ? courant?.piece || null : null; },
  jouer(piece) { // la pièce de la vue où l’on est
    if (!this.disponible || !PIECES[piece]) return false;
    if (!actif()) { attendue = piece; return false; }
    attendue = null; clearTimeout(fondu); fondu = null;
    if (!ctx) ctx = new AudioContext();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (courant && courant.piece !== piece) { eteindre(courant, ctx, 1.4); courant = null; }
    if (!courant) { const o = PIECES[piece](ctx); o.volume.gain.value = 0; courant = { piece, o, suivant: ctx.currentTime + .4, r: alea(Date.now() % 100000 + 7) }; }
    rampe(courant.o.volume.gain, ctx.currentTime, 1, 1.2);
    sonore = true; courant.suivant = Math.max(courant.suivant, ctx.currentTime + .3);
    planifier(); clearInterval(minuteur); minuteur = setInterval(planifier, 400);
    return true;
  },
  taire() { // on quitte la vue : un fondu, puis le silence ; le son reviendra avec la vue
    attendue = null;
    if (!ctx || !courant || !sonore) { sonore = false; return; }
    sonore = false; clearInterval(minuteur); minuteur = null;
    const c = ctx; rampe(courant.o.volume.gain, c.currentTime, 0, 1);
    clearTimeout(fondu); fondu = setTimeout(() => { if (!sonore && ctx === c) c.suspend().catch(() => {}); }, 1300);
  },
  arreter(vite = false) { // coupée : un fondu, ou tout de suite ; le contexte se ferme, tout est libéré
    attendue = null; sonore = false; clearInterval(minuteur); minuteur = null; clearTimeout(fondu); fondu = null;
    if (!ctx) return;
    const c = ctx, cour = courant, duree = vite ? .05 : 1.2; ctx = null; courant = null;
    if (cour) rampe(cour.o.volume.gain, c.currentTime, 0, duree);
    setTimeout(() => { try { cour?.o.arreter(); } catch { /* déjà arrêtée */ } c.close().catch(() => {}); }, duree * 1000 + 100);
  },
  etat() { return { piece: this.piece, sonore, attendue, contexte: ctx?.state || 'aucun', notes: courant?.o.notes || 0 }; },
};
// le premier geste : la pièce qui attendait joue, un instant après, pour laisser le geste faire d’abord ce qu’il fait
const premierGeste = () => { if (attendue) setTimeout(() => { if (attendue) musique.jouer(attendue); }, 60); };
addEventListener('pointerup', premierGeste); addEventListener('keydown', premierGeste);
document.addEventListener('visibilitychange', () => { // cachée, la page se tait ; revenue, la musique reprend si elle jouait
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {}); else if (sonore) ctx.resume().catch(() => {});
});
