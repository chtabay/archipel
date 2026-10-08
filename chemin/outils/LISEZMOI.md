# Les outils du chemin

Ils fabriquent, une fois pour toutes, ce que l’app lit : les objets, leur catalogue, et les vecteurs du sens.

1. Télécharger les collections libres (CC0) et les dézipper dans un dossier, une par sous-dossier : Kenney
   (kenney.nl/assets), les KayKit (kaylousberg.itch.io), Quaternius (quaternius.com, ou sur OpenGameArt), et quelques
   modèles d’OpenGameArt ; voir `chemin/objets/LISEZMOI.txt`.
2. Ce qui n’est pas déjà en `.glb` à la Kenney passe par Blender (4.2), sans écran :
   `blender --background --python chemin/outils/blender-glb.py -- <liste>` convertit les `.blend`, `.fbx`, `.obj` et
   `.dae`, chaque ligne de la liste disant la source et la destination. Puis `node chemin/outils/normaliser.mjs`
   (`[--sol] [--teinte <motif>=<couleur>] <collection> <sortie> <fichiers…>`) range chaque collection comme Kenney : un
   `.glb` par modèle, ses images une seule fois dans `Textures/`. `--sol` ôte ce qui est sous le sol ; `--teinte` colore
   les modèles gris. Les KayKit, en `.gltf`, passent directement par `normaliser.mjs`.
3. Les choses de l’archipel : `node chemin/outils/archipel.mjs <paquet three> <sortie>` les construit avec le code de
   l’archipel et les exporte en `.glb`, à leur taille réelle.
4. Les gens et les bêtes en action : `node chemin/outils/poser.mjs <paquet three> <collections> <sortie> chemin/outils/poses.json`
   fige chaque pose de la liste : un modèle animé, une de ses animations, un instant, et parfois un objet dans la main ou
   un siège. Puis `normaliser.mjs poses …`.
5. `python3 chemin/outils/catalogue.py <dossier> [<autre dossier>…]` : choisit les modèles de chaque collection (`KITS` :
   ce qu’on garde, l’échelle, la hauteur réelle de certains, le rôle, les lieux), tire leurs mots de leur nom, mesure leur
   taille, et les copie dans `chemin/objets/` avec leurs images.
6. `node chemin/outils/alleger.mjs $(find chemin/objets -name '*.glb')`, depuis un dossier où sont installés
   `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions` et `meshoptimizer` : allège chaque
   modèle, et simplifie les plus lourds, sans toucher aux images ; celles qu’un modèle contient passent dans le
   `Textures/` de sa collection. Les images de plus de 256 points de côté se réduisent à part ; les palettes de Kenney
   restent telles quelles.
7. Télécharger les vecteurs alignés de fastText : `wiki.fr.align.vec` en entier, pour trouver les noms d’objets rares
   comme « brochette », et le début de `wiki.en.align.vec` (400 Mo suffisent). Puis `python3 chemin/outils/sens.py <fr> <en>`
   (avec numpy) : écrit `chemin/sens/` et `chemin/catalogue.json`, et montre les objets les plus proches de quelques mots.
   Le vecteur d’un objet vient surtout de ses noms français, écrits dans `francais.py` pour chaque mot d’étiquette anglais
   (`FR`), ou pour un objet entier (`NOMS`) ; un peu de ses mots anglais, dont les trompeurs sont remplacés (`SENS` : « can »
   est d’abord un verbe, « cup » une coupe sportive). Les poses et les choses de l’archipel, nommées en français, n’ont que
   leurs noms français. Les couleurs et les formes comptent peu. Les noms d’objets rares entrent dans le vocabulaire. Il
   écrit aussi `images.bin`, qui dit quels mots font une image.

8. `node chemin/outils/couverture.mjs [--sans <nombre>]` : ce que le catalogue couvre. Lit les 3 000 mots pleins les plus
   fréquents du français (`outils/mots-courants.tsv`, tirés de Lexique 3.83, CC BY-SA 4.0) un par un avec le moteur de sens tel
   qu’il tourne dans l’app, symboles compris (`chemin/sens/symboles.txt` : un mot sans objet à lui, et les noms d’objets qui le
   montrent, le préféré d’abord), compte par nature de mot, écrit `outils/couverture.tsv`, et montre les mots fréquents qui
   n’ont encore rien : ce qu’il reste à trouver, ou à construire. À relancer après un ajout d’objets ou de symboles.

Après un changement des objets ou du sens, augmenter les numéros de version : `?v=` dans `chemin/sens.js`
(`FICHIERS_SENS`), `MOTEUR` dans `chemin/monde.js` pour repeindre les tuiles gardées, et `OBJETS` dans `chemin/sw.js` si
un modèle déjà publié change sous le même nom.
