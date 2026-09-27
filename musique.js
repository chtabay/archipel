// L’archipel : une petite musique de feu de camp, jouée par le navigateur lui-même. Aucun fichier son : les cordes
// sont calculées, le reste est fait de nœuds Web Audio. Une guitare en arpèges, un harmonica de loin, le feu qui crépite.
// Coupée par défaut : elle ne joue que si on l’allume, et jamais deux fois la même chose. Elle se tait quand la page
// est cachée, et quand on quitte.

const midiHz = m => 440 * 2 ** ((m - 69) / 12);
const alea = graine => { let s = Math.abs(Math.floor(graine)) % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

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

/* ───────── La musique ───────── */
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

// Un orchestre dans un contexte audio : la guitare, l’anche, le feu, la réverbération, tout ce qu’il faut pour jouer.
export function orchestre(ctx, sortie = ctx.destination) {
  const sr = ctx.sampleRate, maitre = ctx.createGain(), volume = ctx.createGain(), comp = ctx.createDynamicsCompressor(), reverb = ctx.createConvolver(), retour = ctx.createGain();
  comp.threshold.value = -16; comp.ratio.value = 2.5; comp.attack.value = .01; comp.release.value = .3; maitre.gain.value = .7; volume.gain.value = 1;
  reverb.buffer = impulsion(ctx); retour.gain.value = .9; reverb.connect(retour); retour.connect(maitre); maitre.connect(comp); comp.connect(volume); volume.connect(sortie);
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
  let notes = 0;
  return {
    volume, get notes() { return notes; },
    // un accord : deux mesures de guitare, et l’air par-dessus si on le veut. Rend l’instant où il finit.
    accord(t, ia, r, air = null) {
      const a = ACCORDS[ia];
      for (let mesure = 0; mesure < 2; mesure++) {
        const motif = MOTIFS[Math.floor(r() * MOTIFS.length)], ns = mesure && a.fin ? a.fin : a.notes;
        motif.forEach((ix, k) => {
          if (ix === null || (k && r() < .06)) return; // parfois une note manque : c’est joué à la main
          const basse = k === 0, m = basse && mesure && r() < .6 ? a.basse2 : ns[ix];
          pincer(t + (mesure * 6 + k) * CROCHE + (r() - .5) * .018, m, basse ? .95 : .5 + r() * .22, basse); notes++;
        });
      }
      if (air) for (const [dep, m, du] of air[ia]) { harmonica(ctx, anche, t + dep * CROCHE + .03, midiHz(m), du * CROCHE, .9); notes++; }
      return t + 12 * CROCHE;
    },
    // l’accord de ré, gratté lentement, qui sonne : pour finir
    fin(t) { ACCORDS[0].notes.forEach((m, k) => pincer(t + k * .07, m, k ? .6 : .9, !k)); pincer(t + .55, 69, .45); pincer(t + 1.1, 74, .35); notes += 7; },
    arreter() { try { sf.stop(); } catch { /* déjà arrêté */ } },
  };
}

// Compose de t0 jusqu’à `secondes`, dans n’importe quel contexte, en une fois : pour rendre la musique hors ligne, et pour l’essayer.
export function composer(ctx, secondes, graine = 7) {
  const o = orchestre(ctx), r = alea(graine); let t = 1.4, cycle = 0;
  while (t < secondes) { for (let ia = 0; ia < ACCORDS.length && t < secondes; ia++) t = o.accord(t, ia, r, cycle % 3 ? AIRS[cycle % 2] : null); cycle++; }
  return o;
}

/* ───────── Allumer, couper ───────── */
// Un morceau sans fin, planifié au fur et à mesure, deux secondes et demie devant le temps du navigateur.
// Le premier tour : la guitare seule ; puis l’air, un tour sur deux ; un tour sur trois sans lui.

let ctx = null, o = null, minuteur = null, suivant = 0, cycle = 0, accord = 0, r = null, marche = false, fondu = null;
function planifier() {
  if (!ctx || !o) return;
  while (suivant < ctx.currentTime + 2.5) {
    suivant = o.accord(suivant, accord, r, cycle % 3 ? AIRS[cycle % 2] : null);
    if (++accord === ACCORDS.length) { accord = 0; cycle++; }
  }
}
export const musique = {
  get enMarche() { return marche; },
  get disponible() { return typeof AudioContext === 'function'; },
  demarrer() { // à appeler depuis un geste : le navigateur n’ouvre le son qu’à ce moment-là
    if (marche || !this.disponible) return marche;
    clearTimeout(fondu); fondu = null;
    if (!ctx) { ctx = new AudioContext(); o = orchestre(ctx); suivant = ctx.currentTime + .6; cycle = 0; accord = 0; r = alea(Date.now() % 100000 + 7); }
    marche = true; ctx.resume().catch(() => {});
    o.volume.gain.cancelScheduledValues(ctx.currentTime); o.volume.gain.setValueAtTime(o.volume.gain.value, ctx.currentTime); o.volume.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    planifier(); clearInterval(minuteur); minuteur = setInterval(planifier, 400);
    return true;
  },
  arreter(vite = false) { // en fondu, ou tout de suite ; puis le contexte se ferme, et tout est libéré
    if (!ctx) { marche = false; return; }
    marche = false; clearInterval(minuteur); minuteur = null;
    const c = ctx, orch = o, duree = vite ? .05 : 1.2;
    o.volume.gain.cancelScheduledValues(c.currentTime); o.volume.gain.setValueAtTime(o.volume.gain.value, c.currentTime); o.volume.gain.linearRampToValueAtTime(0, c.currentTime + duree);
    ctx = null; o = null;
    fondu = setTimeout(() => { orch.arreter(); c.close().catch(() => {}); }, duree * 1000 + 100);
  },
  basculer() { return this.enMarche ? (this.arreter(), false) : this.demarrer(); },
  etat() { return { marche, contexte: ctx?.state || 'aucun', notes: o?.notes || 0 }; },
};
document.addEventListener('visibilitychange', () => { // cachée, la page se tait ; revenue, la musique reprend si elle était allumée
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {}); else if (marche) ctx.resume().catch(() => {});
});
