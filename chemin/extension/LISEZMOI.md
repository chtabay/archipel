# Le chemin, l’extension de navigateur

Le chemin tel quel, dans chaque nouvel onglet, plus un glaneur : ce qu’on écrit soi-même dans les pages de la journée
devient un bloc de plus dans la page du jour, et le chemin s’allonge. Rien ne part de l’ordinateur.

- `manifest.json` : Manifest V3, Chrome et Firefox. Les règles de sécurité n’autorisent que les fichiers de l’extension
  (`connect-src 'self'`), et le WebAssembly du décodeur des modèles.
- `glaneur.js` : le script de contenu, branché par le fond après l’accord seulement, et débranché en pause.
- `fond.js` : le service worker (Firefox : la page de fond). Un écrit reçu devient un bloc de la page du jour, par
  `chemin/carnet.js` ; les onglets du chemin sont prévenus.
- `onglet.js` : ajouté à la page du chemin ; relit le carnet quand un bloc arrive.
- `accord.html` : l’accord, la pause, les sites exclus, les moteurs de recherche où ce qu’on cherche compte, tout effacer.
- `fabriquer.js` : assemble `dist/` (ignoré par git), à charger dans le navigateur.

Essayer soi-même : `node chemin/extension/fabriquer.js`, puis dans Chrome, `chrome://extensions`, mode développeur,
« Charger l’extension non empaquetée », le dossier `chemin/extension/dist`. Dans Firefox, `about:debugging`, « Charger
un module temporaire », le fichier `dist/manifest.json`.

Les essais : `node tests/lancer.js extension`.
