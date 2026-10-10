// Le glaneur — le popup : un interrupteur de pause, et le nombre d’écrits du jour en attente. Facultatif.
const ext = globalThis.browser ?? globalThis.chrome;
const bascule = document.getElementById('bascule'), compte = document.getElementById('compte');

const montrer = pause => { bascule.textContent = pause ? 'Reprendre' : 'Mettre en pause'; };

ext.storage.local.get('pause').then(r => montrer(r.pause === true));
ext.runtime.sendMessage({ type: 'compte' }).then(n => { if (typeof n === 'number') compte.textContent = String(n); }).catch(() => {});

bascule.addEventListener('click', async () => {
  const { pause } = await ext.storage.local.get('pause');
  await ext.storage.local.set({ pause: !(pause === true) });
  montrer(!(pause === true));
});
