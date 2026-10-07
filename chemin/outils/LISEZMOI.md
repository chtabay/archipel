# Les outils du chemin

Ils fabriquent, une fois pour toutes, ce que l’app lit : les objets, leur catalogue, et les vecteurs du sens.

1. Télécharger les collections de Kenney (kenney.nl/assets, CC0) et les dézipper dans un dossier, une par sous-dossier.
2. `python3 chemin/outils/catalogue.py <dossier>` : choisit les modèles, tire leurs mots de leur nom, leur rôle et leurs
   lieux de leur collection, mesure leur taille, et les copie dans `chemin/objets/`.
3. `node chemin/outils/alleger.mjs $(find chemin/objets -name '*.glb')`, depuis un dossier où sont installés
   `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions` et `meshoptimizer` : allège chaque
   modèle, sans toucher à la palette de sa collection.
4. Télécharger le début des vecteurs alignés de fastText, `wiki.fr.align.vec` et `wiki.en.align.vec` (les 200 et 400
   premiers Mo suffisent), puis `python3 chemin/outils/sens.py <fr> <en>` (avec numpy) : écrit `chemin/sens/` et
   `chemin/catalogue.json`, et montre les objets les plus proches de quelques mots. Les mots d’étiquette trompeurs y sont
   remplacés pour le calcul du sens (`SENS`, `NOMS` : « can » est d’abord un verbe, « cup » une coupe sportive), et les
   couleurs et les formes comptent peu (`NUANCES`). Il écrit aussi `images.bin`, qui dit quels mots font une image.

Après un changement des objets ou du sens, augmenter les numéros de version : `?v=` dans `chemin/sens.js`
(`FICHIERS_SENS`), `MOTEUR` dans `chemin/monde.js` pour repeindre les tuiles gardées, et `OBJETS` dans `chemin/sw.js`.
