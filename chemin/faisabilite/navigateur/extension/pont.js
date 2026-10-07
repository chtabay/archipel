// Le chemin, le glaneur : le pont. Sur la page du chemin seulement, il tend les glanes à la page, par window.postMessage,
// sur la même machine ; la page les range dans son propre carnet, puis dit lesquelles elle a reçues, et le fond les oublie.
// Marche pareil dans Chrome, Edge, Firefox et Safari : pas besoin d’externally_connectable, que Firefox n’a pas.
const ext = globalThis.browser ?? globalThis.chrome;
const SONDE = false; // essai seulement : vérifier que ce script et la page partagent le même IndexedDB
const dire = (type, plus = {}) => window.postMessage({ de: 'chemin-glaneur', type, ...plus }, location.origin);

addEventListener('message', async e => {
  if (e.source !== window || e.origin !== location.origin || e.data?.pour !== 'chemin-glaneur') return;
  if (e.data.type === 'pret') {
    const glanes = await ext.runtime.sendMessage({ type: 'donne' }).catch(() => []);
    if (glanes?.length) dire('glanes', { glanes });
  }
  if (e.data.type === 'recu' && Array.isArray(e.data.ids)) ext.runtime.sendMessage({ type: 'oublie', ids: e.data.ids }).catch(() => {});
});
dire('present'); // la page répond « pret » quand elle peut ranger

if (SONDE) {
  const r = indexedDB.open('chemin-sonde', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('notes');
  r.onsuccess = () => { const t = r.result.transaction('notes', 'readwrite'); t.objectStore('notes').put({ ecrit: 'par le script de contenu', origine: location.origin }, 'pont'); t.oncomplete = () => r.result.close(); };
}
