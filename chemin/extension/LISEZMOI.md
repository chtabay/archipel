# Le chemin, l’extension de navigateur

Le chemin tel quel, d’un clic sur l’icône, plus un glaneur : ce qu’on écrit soi-même dans les pages de la journée
devient un bloc de plus dans la page du jour, et le chemin s’allonge. Rien ne part de l’ordinateur.

- `manifest.json` : Manifest V3, Chrome et Firefox. Les règles de sécurité n’autorisent que les fichiers de l’extension
  (`default-src 'self'`, `connect-src 'self'`), et le WebAssembly du décodeur des modèles.
- `glaneur.js` : le script de contenu, branché par le fond après l’accord seulement, et débranché en pause.
- `fond.js` : le service worker (Firefox : la page de fond). Un écrit reçu devient un bloc de la page du jour, par
  `chemin/carnet.js` ; les onglets du chemin sont prévenus.
- `onglet.js` : ajouté à la page du chemin ; relit le carnet quand un bloc arrive.
- `accord.html` : l’accord, la pause, les sites exclus, les moteurs de recherche où ce qu’on cherche compte, les sites de
  l’encart, tout effacer ; et la version avec des comptes, sans un mot, pour dire où on en est.
- `updates.json` : où Firefox cherche une nouvelle version (`update_url`), pour une extension signée hors boutique.
- `confidentialite.html` : la politique de confidentialité, servie par le site ; `BOUTIQUES.md`, les textes des fiches.
- `fabriquer.js` : assemble `dist/` (ignoré par git), le même pour Chrome, Edge et Firefox, à charger dans le navigateur.
  Environ 47 Mo, dont 41 Mo d’objets 3D.

Sans rien installer : GitHub fabrique l’extension à chaque changement (`.github/workflows/extension.yml`) ; le dossier
fabriqué est une pièce jointe de l’exécution, et, depuis `main`, un zip dans la version « extension-essai ». Sinon,
`node chemin/extension/fabriquer.js`, puis dans Chrome, `chrome://extensions`, mode développeur,
« Charger l’extension non empaquetée », le dossier `chemin/extension/dist`. Dans Firefox, `about:debugging`, « Charger
un module temporaire », le fichier `dist/manifest.json` ; si l’icône porte un « ! », donner l’accès aux sites depuis l’accord.

Les essais : `node tests/lancer.js extension`.
