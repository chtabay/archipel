# L’archipel

Un endroit où l’on peut tout déposer, sans jugement. On coche quelques cases, on écrit si on veut, et une île en 3D pousse avec ce qu’on dépose. Quand on veut, on la pose dans l’archipel, parmi les îles des autres : seulement sa forme, sans son nom.

**→ https://chtabay.github.io/archipel/**

## Le parcours

En bas de l’écran, trois onglets restent toujours à portée de pouce : **Déposer**, **Ton île** et **L’archipel**. Chaque écran n’a qu’une action principale. Un quatrième bouton, **Plus**, ouvre un menu avec ce qui sert partout : quitter vite ce site, allumer ou couper la musique, installer l’app, parler à quelqu’un, revoir l’intro. Ce sont des actions qu’on trouve aussi ailleurs, à leur place.

**La première fois**, une courte intro, d’une quinzaine de secondes, montre l’idée sans aucun exemple. D’abord l’archipel au soir. Puis un îlot au premier plan, au-dessus duquel flottent des mots sans lettres, des pastilles de lumière. Ils tombent un à un : à chacun, la terre monte de l’eau et une chose pousse. Leur lumière reste au-dessus, en lanternes. Enfin l’île rejoint sa place parmi les autres, et « ton île » s’affiche. Quatre phrases l’accompagnent. Les îles de l’intro sont inventées, pour montrer l’idée ; l’archipel, lui, ne montre que des îles réelles. On peut la passer à tout moment, puis la revoir depuis l’archipel. « Parler à quelqu’un » et « quitter » restent visibles. Sans mouvement ou sans 3D, les quatre phrases se lisent d’un coup.

**Au retour**, une île déjà commencée s’ouvre d’abord sur l’onglet **Ton île**. Si quelque chose était en cours de dépôt, l’action principale le reprend. Sans île commencée, on arrive sur les premières cases.

1. **Les questions.** Quelques cases à cocher. En haut, un îlot montre en direct ce que les cases feraient pousser. Chaque case de la première question s’y voit : la terre qui recouvre ce qui n’a jamais été dit, le sentier de ce qui tourne en boucle, la taille selon l’ancienneté, un nuage gris quand on ne va pas bien du tout, un phare quand il y a un danger.
2. **Par où aller ?** Parler à quelqu’un, écrire, le dire en trois lignes, juste le poser, ou voir son île.
3. **La page.** Des débuts de phrases tirés des cases. Le texte est lu sur le téléphone : les sujets dont il parle s’ajoutent aux graines, et des lanternes s’allument sur l’îlot pendant qu’on écrit. Si des mots inquiètent, des numéros d’écoute s’affichent.
4. **Terminer.** Tout ce qui a été déposé pousse sur l’île, texte compris : on ne choisit pas ce que le texte fait pousser. S’il y a un texte, le seul choix porte sur lui : le garder sur le téléphone, pour le relire en touchant ce qu’il a fait pousser, ou le brûler sous ses yeux. Il n’en reste alors que ses lanternes. Un lien discret permet aussi de tout effacer sans rien poser, après confirmation.
5. **L’île.** Ce qui vient de pousser, avec une phrase. On la fait tourner du doigt, ou avec le bouton posé sur la vue, et on zoome en écartant deux doigts. Toucher une chose dit ce qu’elle est, d’après quelles cases, et depuis quand. L’action principale est « Déposer autre chose ».
6. **Changer d’île.** Celle-ci reste sur le téléphone et se revoit. Une case, décochée d’office, la met dans l’archipel : les autres verraient « une île avec deux arbres nus, une pierre et une maison », dans son paysage, rien d’autre.
7. **L’archipel.** Une mer au soir, avec des voiliers, et les îles réelles : celles que des personnes y ont mises, les soixante plus récentes. Aucune n’est inventée ; tant que personne n’y a mis d’île, l’archipel le dit. Pendant qu’on regarde, les îles qui arrivent viennent de l’horizon, et celles qui grandissent changent sur place. Toucher une île fait s’en approcher : de près, elle se construit comme dans sa vue, avec tout son décor et ses choses animées ; de loin, les îles sont dessinées en version légère. « Y mettre ton île » y pose la sienne, dans l’eau libre la plus proche de sa sensation ; ensuite, chaque dépôt la fait grandir là-bas aussi. On peut l’en retirer depuis son île.

## L’installer comme une app

Le site s’installe sur l’écran d’accueil, et s’ouvre alors en plein écran, comme une app, même sans réseau. Sur l’île, un lien discret, « installer l’app », paraît quand le navigateur le permet, et le menu **Plus** y mène toujours : sur Android et sur ordinateur, il ouvre la proposition du navigateur ; sur iPhone, il explique le bouton Partager de Safari, puis « Sur l’écran d’accueil ». Rien ne surgit tout seul au milieu d’un dépôt.

- `manifest.webmanifest` donne le nom, les couleurs et les icônes. Les icônes sont dans `icones/`, avec leurs sources en SVG et le script qui les fabrique.
- `sw.js` est le service worker. Il garde les fichiers du site que la page a chargés, jamais ce qu’on dépose, et ne touche pas à l’archipel partagé. La page se prend d’abord sur le réseau, pour avoir la dernière version ; sans réseau, c’est celle gardée. Les fichiers numérotés, comme `app.js?v=12`, ne changent jamais : gardés, ils servent tels quels. Après un changement de `sw.js`, on change son nom de cache, `CACHE`.
- Sur iPhone, l’app installée a sa propre mémoire : elle commence avec une île vide, et l’île de Safari reste dans Safari. Sur Android, on retrouve son île.

## La musique

Deux petites musiques, coupées par défaut. Un bouton de son, en bas à gauche de la vue de l’île et de celle de l’archipel, les allume, comme le menu **Plus** ; le choix reste sur le téléphone. Chaque vue a sa pièce : sur l’île, un feu de camp ; dans l’archipel, la mer au soir. On passe de l’une à l’autre en fondu, et ailleurs, sur les questions ou la page, c’est le silence. Rallumée au retour, la musique attend un premier geste : le navigateur n’ouvre le son qu’à ce moment-là. Elle se tait quand la page est cachée, et quand on quitte.

Elles sont jouées par le navigateur lui-même, sans fichier son, avec la Web Audio API, dans `musique.js`.

- **Le feu de camp.** Les cordes d’une guitare, calculées, une anche d’harmonica, le feu qui crépite. Ré majeur, des accords ouverts, des arpèges en 6/8 dont une note manque parfois, un air par-dessus un tour sur deux, et un tour sur trois sans lui.
- **La mer au soir.** Une boîte à musique sur huit temps lents, avec des silences, une nappe sur la basse, un air certains tours, une cloche au loin de temps en temps, et les vagues tout du long. Mi mineur.

Chaque pièce est planifiée au fur et à mesure, quelques secondes devant, et ne se répète jamais tout à fait. Rien de ce qu’on dépose n’y entre, pour l’instant.

## La grammaire : quatre axes lus dans les cases

Une confession ne se réduit pas à quelques nombres. Elle garde toutes ses cases, dans un « dépôt », et l’île est recalculée à partir des dépôts. La grammaire est dans `grammaire.js`. Elle lit les cases. Le texte est lu par `lexique.js`, sur l’appareil seulement, pour y trouver des sujets et une sensation, qui poussent comme des cases cochées. Sur l’île, le texte allume des lanternes, jamais ses mots.

| Axe | D’après | Ce que ça fait |
| --- | --- | --- |
| **1. La place** (d’où ça vient) | le sujet coché, déplacé par « on m’a fait du mal » ou la question de plus | **la famille** : *reçu*, un arbre, dans la forêt ; *commis ou voulu*, une pierre, sur la colline ; *entre vous*, une construction, dans le village ; *soi et ce qui vient*, une culture, dans les champs ; *une sensation sans sujet*, le temps qu’il fait |
| **2. La sensation** (comment c’est ressenti) | le quadrant des mots : agité ou éteint, douloureux ou supportable | **l’espèce** : voir le tableau ci-dessous |
| **3. Le temps** (depuis quand) | récent, depuis longtemps, il y a longtemps ; plus d’une fois, ça continue | **la taille** : jeune, adulte, vieux ; un sujet redit grandit d’un cran (bosquet, pierre levée, hameau, moulin) ; « plus d’une fois » met en deux |
| **4. Le silence** (qui le sait) | jamais dit, cette personne ne le sait pas, jamais parlé ; et la présence d’un texte | **l’état** : fermé (un creux, enterrée, porte close, couvert, en friche) ; des lanternes s’il y a un texte, jamais son contenu |

Les espèces, famille par sensation :

| | agité, douloureux | éteint, douloureux | agité, supportable | éteint, supportable | sans mot |
| --- | --- | --- | --- | --- | --- |
| **arbre** (reçu) | pin | arbre nu | arbre | arbre en fleurs | arbre |
| **pierre** (commis, voulu) | pierre sombre | pierre moussue | cairn | galet | pierre |
| **construction** (entre vous) | clôture | maison aux volets fermés | pont | banc | maison |
| **culture** (soi, ce qui vient) | feu | puits | champ | barque | champ |
| **temps** (une sensation) | nuage d’orage | nuage de pluie | fleurs | étang | — |

Les autres cases : *ça tourne en boucle*, un sentier usé autour ; *ça continue*, il pleut dessus ; *je regrette*, la mousse et des fleurs reprennent la pierre ; *jamais réparé*, la pierre est fendue ; *je me sens responsable*, un caillou au pied de l’arbre ; *danger* ou *peur de cette personne*, un phare sur la rive, qu’on touche pour parler à quelqu’un ; *pas bien du tout*, le ciel se couvre.

## La composition : un dépôt complète l’île

- **Un sujet par graine.** Une confession qui parle de trois sujets fait pousser trois choses. Sans sujet, la situation suffit : « on m’a fait du mal », un arbre ; « je regrette », une pierre ; les deux, un arbre et une pierre. Avec des sujets, une situation qu’aucun sujet ne porte fait aussi pousser sa chose. Sinon la sensation laisse un temps qu’il fait. Rien du tout : un caillou posé, qui porte quand même ses états.
- **Chaque quadrant coché laisse sa trace.** Le quadrant principal donne l’espèce. Les autres ajoutent un temps qu’il fait : « tristesse et espoir », une maison aux volets fermés et des fleurs.
- **Le texte compte comme des cases.** Les sujets repérés dans le texte poussent comme s’ils avaient été cochés. Le texte donne aussi la sensation quand aucun mot n’est coché. Il allume une lanterne de papier au-dessus de ce qu’il fait pousser, une de plus à chaque texte, jusqu’à trois. Ses mots, eux, ne sont jamais sur l’île.
- **Un sujet redit fait grandir**, jamais une deuxième chose. Les arbres et les pierres suivent la sensation du jour. Une construction ou une culture garde son espèce.
- **Le climat** de l’île suit la dernière confession : grand jour, jour ordinaire, soir doux, crépuscule, brume du matin.
- **L’île grandit avec ce qu’on y dépose.** Une île vide est un îlot. Chaque dépôt étend la terre, tuile après tuile, depuis le centre, jusqu’à l’île pleine après six ou sept dépôts. Une île finie a donc la taille de ce qu’on y a laissé, dans sa vue comme dans l’archipel.
- **Le placement** est par quartiers : la forêt, la colline de pierres, le village, les champs ; les barques à la rive, les cailloux sur la plage. Ce que fait pousser un dépôt se place sur l’île telle qu’elle est à ce moment-là. La terre ne fait que s’ajouter, donc les positions ne bougent pas. Seules les barques suivent le rivage quand il s’éloigne.

## Les paysages et les formes

La personne choisit le **paysage** en commençant une île, avec un aperçu en 3D : la prairie, la forêt d’automne, l’île tropicale, l’île enneigée, la lande. Le paysage change les couleurs du sol, l’eau, les essences, les maisons, les cultures et le petit décor. Chaque chose a aussi plusieurs **formes**, tirées d’un nombre stable pour chaque île. Ni le paysage ni les formes ne disent quelque chose : ils rendent chaque île différente.

## Le rendu en 3D

- **Le relief.** Un sol lissé à partir de la carte, à facettes, coloré selon la hauteur et la pente : plage, herbe, roche, neige. La ligne d’eau coupe les triangles, et le haut-fond est un dégradé qui rejoint le fond marin.
- **La mer.** Transparente, claire près de l’île, bleue au large. Elle garde son bleu sous les lumières du soir.
- **La lumière.** Un soleil aux ombres douces, une lumière du ciel et une brume, réglés pour chaque climat.
- **Le mouvement.** L’île tourne du doigt, et seule quand on la laisse. Des nuages passent, des oiseaux tournent, le phare balaie, les moulins tournent, les barques tanguent.
- **L’intro.** Tout ce qu’elle montre se déduit de son temps. Elle se revoit donc depuis le début, et elle s’arrête quand la page est cachée. L’îlot grandit de trois tuiles par mot, depuis sous l’eau.
- **L’archipel.** La caméra cadre les îles qui y sont : peu d’îles se voient de près, beaucoup de plus loin. Toutes les îles y ont la même échelle, pour que leurs tailles se comparent. De loin, chaque île est un seul maillage, sans animation ; celle qu’on approche se reconstruit comme dans sa vue, puis se libère quand on s’éloigne. Il n’a pas d’ombres, pour rester léger.
- **Toujours clair.** L’application garde ses couleurs claires, même quand le téléphone est en mode sombre.

Sans WebGL, la page reste utilisable : l’île et l’archipel ne s’affichent pas, et ce qui a poussé reste écrit en mots.

## L’archipel partagé

L’archipel vit dans la base du projet Supabase de Pyramides, dans un espace à part : le schéma `archipel`, sans aucun lien avec les tables de Pyramides. On n’y entre que par trois fonctions publiques : `archipel_poser`, qui pose une île ou la fait grandir, `archipel_lire` et `archipel_retirer`. Le reste est fermé. La base est décrite dans `base/archipel.sql`.

- **Seulement la forme.** Ce qui part est ce que la 3D dessine : le paysage, la graine du relief, la taille, le ciel, le phare, et pour chaque chose sa famille, son espèce, sa taille, sa case, ses états visibles et le nombre de ses lanternes. Jamais le texte, les cases cochées, les sujets, les dates, un nom ou un compte. La variante de chaque chose se tire de ce qui se voit, et les choses partent rangées par case : ni le sujet ni l’ordre des dépôts ne se lisent.
- **Ce que la forme laisse deviner.** Elle montre ce qui a poussé, et la grammaire est publique : un phare dit un danger, une pierre fendue dit « jamais réparé ». C’est pour cela que rien ne part sans un geste, et que la feuille dit ce que les autres verront.
- **Seulement quand on le choisit.** « Y mettre ton île », ou la case en changeant d’île. Sans ce geste, rien ne part : même une île marquée « envoyée » avant le serveur reste sur le téléphone. Une fois dans l’archipel, chaque dépôt envoie sa nouvelle forme.
- **Un jeton, pas de compte.** Le téléphone tire un jeton secret pour chaque île. La base n’en garde que l’empreinte : seul ce téléphone peut faire grandir l’île ou la retirer.
- **La base se protège.** Chaque forme est vérifiée, clé par clé, valeur par valeur. Les places restent dans la mer. Au plus trente nouvelles îles par minute, pour tout l’archipel. Pas de date : un simple rang dit l’ordre des arrivées.
- **Sans réseau**, l’archipel le dit, et les îles restent sur le téléphone. Une île quittée hors ligne part à la prochaine ouverture.

## Confidentialité

- Site statique : pas de cookie, pas de traceur. La police et la bibliothèque 3D sont dans le dépôt. Le service worker ne garde que les fichiers du site.
- La seule requête vers l’extérieur va au serveur de l’archipel : pour le lire quand on le regarde, et pour y mettre, faire grandir ou retirer son île. Sans cookie ni adresse d’origine. Comme tout serveur, il voit passer l’adresse IP de la requête dans ses journaux ; la base, elle, ne la garde pas.
- Ce qu’on dépose reste sur le téléphone, sans chiffrement. Le texte y est lu, pour y trouver des sujets, et n’en sort jamais.

## Sécurité et solidité

- **Quitter vite.** Le bouton « quitter » reste en haut à droite de chaque écran, même par-dessus une feuille ouverte. Il vide l’écran aussitôt, remonte les écrans de l’app dans l’historique, puis les remplace par une page neutre : le bouton retour ne ramène pas ici. L’historique du navigateur garde quand même la visite ; seule la navigation privée l’évite.
- **Si l’app ne se lance pas**, la page affiche quand même les numéros d’écoute. Si un écran échoue, un écran de secours le remplace, jamais une page vide.
- **Si la 3D refuse de démarrer**, l’app continue sans elle, et l’île se dit en mots.
- **Les données du téléphone** sont vérifiées à la lecture : ce qui est abîmé est laissé de côté, l’app s’ouvre quand même.
- **Si le serveur ne répond pas**, l’archipel le dit calmement, et le même geste marche au retour du réseau. Une île retirée ailleurs est oubliée ici aussi, sans rien perdre de ce qui a été déposé.
- **Une question de plus qui ne se pose plus**, parce qu’on a décoché ce qui l’ouvrait, ne compte plus pour l’île. Pour proposer de l’aide, on reste prudent : toute case cochée compte.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page |
| `style.css` | Le style |
| `app.js` | Les écrans, les feuilles, les gestes, le stockage local, l’archipel partagé |
| `serveur.js` | Les appels au serveur de l’archipel : lire, poser, faire grandir, retirer une île |
| `musique.js` | Les deux musiques, le feu de camp et la mer, calculées et jouées par le navigateur |
| `sw.js` | Le service worker : les fichiers du site, gardés pour s’ouvrir sans réseau |
| `manifest.webmanifest` | Le manifeste de l’app installable : nom, couleurs, icônes |
| `icones/` | Les icônes de l’app, leurs sources SVG et `fabriquer.js`, qui les dessine avec le Chromium des tests |
| `contenu.js` | Les cases, les sujets et leurs poids, les mots-clés d’alerte, les numéros |
| `grammaire.js` | Les familles par sujet, les espèces, les états, la composition, les phrases |
| `lexique.js` | Les mots qui font pousser un sujet ou donnent une sensation, lus sur l’appareil |
| `biomes.js` | Les paysages : couleurs, essences, maisons, cultures, décor |
| `ile.js` | La carte, les quartiers, l’île recalculée depuis ses dépôts, sa forme partagée, les îles inventées de l’intro |
| `monde.js` | Le relief, la mer, le ciel, la lumière, la caméra, l’île, l’archipel, l’intro, l’îlot, les aperçus |
| `modeles.js` | Les choses en 3D, leurs formes, leurs états, le petit décor |
| `outils.js` | Les nombres stables et le mélange des couleurs |
| `vendor/` | three.js 0.186, réduit aux pièces utilisées (licence MIT) |
| `fonts/` | Nunito (licence SIL OFL 1.1) |
| `404.html` | Page introuvable ; les anciennes adresses des maquettes et de `limbes/` mènent à l’accueil |
| `base/archipel.sql` | La base de l’archipel partagé, telle qu’elle est dans le projet de Pyramides |
| `tests/` | Les tests, dans Chromium avec une 3D logicielle : le parcours, l’intro, le retour, la stabilité, l’archipel partagé, l’installation, la musique, le menu Plus. Ils parlent à un faux serveur, en mémoire, jamais à la vraie base |
| `package.json` | Seulement pour les tests ; le site n’a besoin de rien |
| `.nojekyll` | Sert les fichiers tels quels sur GitHub Pages |

Le stockage local utilise le préfixe `archipel:`. Une île mise dans l’archipel y garde sa place et son jeton. Au premier passage, l’île gardée sous un ancien nom du projet est reprise, sans rien effacer. `archipel:intro` retient que l’intro a été vue ou passée.

Chaque fichier est appelé avec un numéro de version, comme `?v=1`. Après une modification, on augmente le numéro de ce fichier là où il est appelé, pour qu’un téléphone ne mélange pas deux versions en cache. Le service worker s’y fie aussi : en local, sans changer le numéro, il resservirait l’ancien fichier ; les outils de développement du navigateur permettent de le contourner.

Voir le site en local, depuis la racine du dépôt :

```sh
python3 -m http.server
# puis http://localhost:8000/
```

Lancer les tests, qui servent eux-mêmes le site, en une dizaine de minutes :

```sh
npm install
npm test            # toutes les suites
npm test -- archipel    # une seule : parcours, intro, retour, stabilite, archipel, pwa, musique ou plus
```

Les captures d’écran des tests vont dans un dossier temporaire, ou dans celui que désigne `CAPTURES`. Sur GitHub, les tests tournent à chaque proposition de changement, une suite par job, en parallèle : le tout dure le temps de la plus longue, 4 à 5 minutes.
