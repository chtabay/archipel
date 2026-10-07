// Le glaneur : l’accord. Rien n’est lu tant qu’on n’a pas dit oui ici ; dire non, ou plus tard, arrête tout.
const ext = globalThis.browser ?? globalThis.chrome;
const dit = t => { document.getElementById('dit').textContent = t; };
document.getElementById('oui').addEventListener('click', () => ext.storage.local.set({ actif: true }).then(() => dit('C’est noté : le glaneur lit ce que tu écris, et le garde ici.')));
document.getElementById('non').addEventListener('click', () => ext.storage.local.set({ actif: false }).then(() => dit('C’est noté : le glaneur ne lit rien.')));
