// Le chemin, le glaneur — le pont. Sur la page du chemin SEULEMENT, et au plus tôt (document_start), il prend les glanes du
// jour dans le stockage de l’extension et les pose dans le carnet du chemin, c’est-à-dire dans l’IndexedDB « chemin » de
// l’origine de la page — le MÊME que celui où chemin/carnet.js lit les pages. Un script de contenu partage l’IndexedDB, le
// localStorage et le DOM de la page : il écrit donc là où l’app lira, sans aucune requête réseau.
//
// Pose : les glanes du jour sont ajoutées à la page d’aujourd’hui, après une ligne « * * * » (que decouper() traite comme
// une coupe forcée : chaque glane devient donc son ou ses passages). C’est idempotent : on se souvient du bloc qu’on a
// injecté, et on le reconstruit à chaque fois au lieu de l’empiler. Si aucune glane, on ne touche à rien.
//
// Course avec l’app : document_start s’exécute bien avant que app.js (module différé) ne lise les pages ; l’écriture d’un
// petit enregistrement dans IndexedDB est quasi instantanée. La bonne solution de long terme (une API explicite dans
// app.js, un magasin « glanes » à part) est décrite dans le rapport et dans essai.js, et n’est PAS implémentée ici.
(() => {
  const ext = globalThis.browser ?? globalThis.chrome;
  if (!ext?.runtime?.id) return;

  const NOM = 'chemin', VERSION = 2; // le même nom et la même version que chemin/carnet.js
  const SEP = '\n\n* * *\n\n';
  const jourLocal = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };

  // Ouvrir « chemin » avec EXACTEMENT la même montée de version que chemin/carnet.js : si le pont crée la base avant l’app,
  // son schéma est identique, et l’app ne déclenchera pas d’autre montée de version.
  const ouvrir = () => new Promise((ok, ko) => {
    if (!globalThis.indexedDB) { ko(new Error('sans IndexedDB')); return; }
    const r = indexedDB.open(NOM, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'date' });
      for (const n of ['tuiles', 'lectures']) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'cle' }).createIndex('vu', 'vu');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error('carnet bloqué'));
  });
  const lirePage = (db, date) => new Promise(ok => { const q = db.transaction('pages').objectStore('pages').get(date); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); });
  const ecrirePage = (db, page) => new Promise((ok, ko) => { const t = db.transaction('pages', 'readwrite'); t.objectStore('pages').put(page); t.oncomplete = ok; t.onerror = () => ko(t.error); });

  async function poser() {
    const date = jourLocal();
    const { jours = {}, injecte = {} } = await ext.storage.local.get(['jours', 'injecte']).catch(() => ({}));
    const duJour = jours[date] ? Object.values(jours[date]).sort((a, b) => a.at - b.at) : [];
    // les textes du jour, sans doublon, dans l’ordre
    const vus = new Set(), frags = [];
    for (const g of duJour) { const t = (g.texte || '').trim(); if (t && !vus.has(t)) { vus.add(t); frags.push(t); } }
    if (!frags.length) return { pose: 0, date };

    const bloc = frags.join(SEP); // chaque glane séparée par « * * * » : coupe forcée
    const db = await ouvrir();
    try {
      const page = await lirePage(db, date);
      const ancien = injecte[date] || '';
      // base = ce que l’utilisateur a écrit lui-même, sans le bloc qu’on avait injecté la dernière fois
      let base = page?.texte || '';
      if (ancien && base.endsWith(ancien)) base = base.slice(0, base.length - ancien.length);
      const injection = (base.trim() ? SEP : '* * *\n\n') + bloc; // un séparateur mène toujours au premier fragment
      const final = base + injection; // on garde la base telle quelle (espaces compris) pour pouvoir la retrancher ensuite
      await ecrirePage(db, { date, texte: final });
      // se souvenir du bloc injecté, et oublier les autres jours
      const neuf = {}; neuf[date] = injection; await ext.storage.local.set({ injecte: neuf });
      return { pose: frags.length, date, apercu: final.slice(0, 120) };
    } finally { db.close(); }
  }

  // On pose dès que possible, au plus tôt. Le script de contenu vit dans un « monde isolé » : ce globalThis n’est pas celui
  // de la page (l’essai vérifie donc le pont par son effet dans le carnet, pas en lisant cette variable).
  globalThis.__pontChemin = poser().catch(e => ({ erreur: String(e) }));
})();
