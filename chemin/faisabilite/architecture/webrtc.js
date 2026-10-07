// Essai de faisabilité : deux navigateurs (« l’ordinateur » et « le téléphone ») se parlent en direct, en WebRTC, sans
// serveur de signalisation : l’offre et la réponse passent par des QR codes (ici, recopiées par l’essai). Aucun serveur
// STUN ni TURN : seulement les adresses locales, ce qui suppose le même réseau (le même Wi-Fi).
//   node chemin/faisabilite/architecture/webrtc.js
// Mesure la taille de l’offre et de la réponse (donc combien de QR codes), vérifie que le colis arrive entier, et qu’aucune
// requête ne part ailleurs que vers le petit serveur local qui sert la page. Textes inventés.
const { chromium } = require('playwright');
const http = require('http');

const PAGE = '<!doctype html><meta charset="utf-8"><title>essai</title><p>essai WebRTC</p>';
const COLIS = { v: 1, appareil: 'ordinateur', traces: [{ id: 'ordinateur-essai-1', date: '2026-10-07', source: 'navigateur', texte: 'Pique-nique au parc à midi ? J’apporte du pain, du fromage et des tomates.' }] };
const QR = { 'V40-M': 2331, 'V25-M': 997, 'V15-M': 412 }; // octets par QR code, vérifiés avec segno 1.6.6
const qr = n => Object.entries(QR).map(([v, c]) => `${Math.ceil(n / c)} × ${v}`).join(', ');
let echecs = 0;
const verifier = (ok, quoi) => { console.log(`${ok ? 'ok  ' : 'ÉCHEC'} · ${quoi}`); if (!ok) echecs++; };
// ce qu’il faut vraiment garder d’une description de session pour un canal de données : le reste se reconstruit
const essentiel = sdp => sdp.split(/\r?\n/).filter(l => /^a=(ice-ufrag|ice-pwd|fingerprint|setup|candidate)|^m=/.test(l)).join('\n');

async function essai(nom, args) {
  const s = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE); });
  await new Promise(ok => s.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${s.address().port}/`, b = await chromium.launch({ args }), dehors = [];
  const [A, B] = await Promise.all([b.newContext(), b.newContext()].map(async c => { const p = await (await c).newPage(); p.on('request', r => { if (!r.url().startsWith(base)) dehors.push(r.url()); }); await p.goto(base); return p; }));
  console.log(`\n── ${nom}`);
  try {
    const offre = await A.evaluate(async () => {
      const pc = new RTCPeerConnection({ iceServers: [] }); window.pc = pc;
      window.canal = pc.createDataChannel('chemin');
      window.ouvert = new Promise((ok, ko) => { window.canal.onopen = ok; setTimeout(() => ko(new Error('le canal ne s’ouvre pas')), 15000); });
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise(ok => { if (pc.iceGatheringState === 'complete') ok(); pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && ok(); setTimeout(ok, 5000); });
      return pc.localDescription.sdp;
    });
    const reponse = await B.evaluate(async sdp => {
      const pc = new RTCPeerConnection({ iceServers: [] }); window.pc = pc;
      window.recu = new Promise(ok => { pc.ondatachannel = e => { e.channel.onmessage = m => ok(m.data); }; });
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await new Promise(ok => { if (pc.iceGatheringState === 'complete') ok(); pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && ok(); setTimeout(ok, 5000); });
      return pc.localDescription.sdp;
    }, offre);
    const cands = [...offre.matchAll(/a=candidate:\S+ \d \S+ \d+ (\S+) /g)].map(m => m[1]);
    console.log(`     candidats de l’ordinateur : ${cands.join(', ') || 'aucun'}`);
    for (const [quoi, sdp] of [['offre (ordinateur → téléphone)', offre], ['réponse (téléphone → ordinateur)', reponse]]) {
      const e = essentiel(sdp);
      console.log(`     ${quoi} : ${sdp.length} caractères, ${e.length} pour l’essentiel → ${qr(sdp.length)} (entière) ; ${qr(e.length)} (l’essentiel)`);
    }
    await A.evaluate(async sdp => { await window.pc.setRemoteDescription({ type: 'answer', sdp }); }, reponse);
    const ok = await A.evaluate(async colis => { await window.ouvert; window.canal.send(colis); return true; }, JSON.stringify(COLIS)).catch(e => (console.log(`     ${e.message}`), false));
    const recu = ok ? await B.evaluate(() => Promise.race([window.recu, new Promise(r => setTimeout(() => r(null), 5000))])) : null;
    verifier(recu === JSON.stringify(COLIS), 'le colis passe d’un navigateur à l’autre, sans serveur de signalisation, sans STUN ni TURN');
    const chemin = await A.evaluate(async () => { const st = await window.pc.getStats(); let paire = null; st.forEach(r => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') paire = r; }); if (!paire) return null; const loc = st.get(paire.localCandidateId), dist = st.get(paire.remoteCandidateId); return `${loc.candidateType} ${loc.address || loc.ip} ↔ ${dist.candidateType} ${dist.address || dist.ip}`; });
    if (chemin) console.log(`     la paire choisie : ${chemin}`);
  } finally {
    verifier(!dehors.length, `aucune requête hors du serveur local (${dehors.length})`);
    await b.close(); s.close();
  }
}

(async () => {
  await essai('Chromium, réglages par défaut (adresses locales cachées derrière des noms en .local, mDNS)', []);
  await essai('Chromium, adresses locales en clair', ['--disable-features=WebRtcHideLocalIpsWithMdns']);
  console.log(echecs ? `\n${echecs} échec(s)` : '\ntout est bon');
  process.exitCode = echecs ? 1 : 0;
})();
