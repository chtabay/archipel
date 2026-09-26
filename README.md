# L’archipel

Un endroit où l’on peut tout déposer, sans jugement. On coche quelques cases, on écrit si on veut, et une île en 3D pousse avec ce qu’on dépose. Quand on veut, on la pose dans l’archipel, sans son nom, parmi les îles des autres.

**→ https://chtabay.github.io/archipel/**

## Le parcours

En bas de l’écran, trois onglets restent toujours à portée de pouce : **Déposer**, **Ton île** et **L’archipel**. Chaque écran n’a qu’une action principale.

**La première fois**, une courte intro, d’une quinzaine de secondes, montre l’idée sans aucun exemple. D’abord l’archipel au soir. Puis un îlot au premier plan, au-dessus duquel flottent des mots sans lettres, des pastilles de lumière. Ils tombent un à un : à chacun, la terre monte de l’eau et une chose pousse. Leur lumière reste au-dessus, en lanternes. Enfin l’île rejoint sa place parmi les autres, et « ton île » s’affiche. Quatre phrases l’accompagnent. On peut la passer à tout moment, puis la revoir depuis l’archipel. « Parler à quelqu’un » et « quitter » restent visibles. Sans mouvement ou sans 3D, les quatre phrases se lisent d’un coup.

**Au retour**, une île déjà commencée s’ouvre d’abord sur l’onglet **Ton île**. Si quelque chose était en cours de dépôt, l’action principale le reprend. Sans île commencée, on arrive sur les premières cases.

1. **Les questions.** Quelques cases à cocher. En haut, un îlot montre en direct ce que les cases feraient pousser. Chaque case de la première question s’y voit : la terre qui recouvre ce qui n’a jamais été dit, le sentier de ce qui tourne en boucle, la taille selon l’ancienneté, un nuage gris quand on ne va pas bien du tout, un phare quand il y a un danger.
2. **Par où aller ?** Parler à quelqu’un, écrire, le dire en trois lignes, juste le poser, ou voir son île.
3. **La page.** Des débuts de phrases tirés des cases. Le texte est lu sur le téléphone : les sujets dont il parle s’ajoutent aux graines, et des lanternes s’allument sur l’îlot pendant qu’on écrit. Si des mots inquiètent, des numéros d’écoute s’affichent.
4. **Terminer.** Tout ce qui a été déposé pousse sur l’île, texte compris : on ne choisit pas ce que le texte fait pousser. S’il y a un texte, le seul choix porte sur lui : le garder sur le téléphone, pour le relire en touchant ce qu’il a fait pousser, ou le brûler sous ses yeux. Il n’en reste alors que ses lanternes. Un lien discret permet aussi de tout effacer sans rien poser, après confirmation.
5. **L’île.** Ce qui vient de pousser, avec une phrase. On la fait tourner du doigt, ou avec le bouton posé sur la vue, et on zoome en écartant deux doigts. Toucher une chose dit ce qu’elle est, d’après quelles cases, et depuis quand. L’action principale est « Déposer autre chose ».
6. **Changer d’île.** Celle-ci reste sur le téléphone et se revoit. Elle peut rejoindre l’archipel sans nom : les autres verraient « une île avec deux arbres nus, une pierre et une maison », rien d’autre.
7. **L’archipel.** Une mer au soir, avec des voiliers. Les îles des autres y arrivent depuis l’horizon, placées par sensation, dans l’eau libre la plus proche de leur place. Toucher une île fait s’en approcher.

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
- **L’archipel.** Cadré pour un téléphone tenu droit. Toutes les îles y ont la même échelle, pour que leurs tailles se comparent. Il n’a pas d’ombres, pour rester léger.
- **Toujours clair.** L’application garde ses couleurs claires, même quand le téléphone est en mode sombre.

Sans WebGL, la page reste utilisable : l’île et l’archipel ne s’affichent pas, et ce qui a poussé reste écrit en mots.

## Ce qui n’existe pas encore

- **Les îles des autres sont inventées**, ainsi que leurs arrivées : des dépôts au hasard passés par la même grammaire. Un archipel partagé demande un serveur.
- **Rien ne part.** Ton île, tes îles d’avant et les textes gardés restent sur ce téléphone, sans chiffrement.
- Ce qui serait transmis à l’archipel est déjà délimité : des comptes par espèce, une sensation moyenne, le paysage. Jamais un texte, une date ou une case.

## Confidentialité

- Site 100 % statique : pas de serveur, pas de cookie, pas de traceur, aucune requête externe. La police et la bibliothèque 3D sont dans le dépôt.
- Ce qu’on dépose reste sur le téléphone. Le texte y est lu, pour y trouver des sujets, et n’en sort jamais.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page |
| `style.css` | Le style |
| `app.js` | Les écrans, les feuilles, les gestes, le stockage local |
| `contenu.js` | Les cases, les sujets et leurs poids, les mots-clés d’alerte, les numéros |
| `grammaire.js` | Les familles par sujet, les espèces, les états, la composition, les phrases |
| `lexique.js` | Les mots qui font pousser un sujet ou donnent une sensation, lus sur l’appareil |
| `biomes.js` | Les paysages : couleurs, essences, maisons, cultures, décor |
| `ile.js` | La carte, les quartiers, l’île recalculée depuis ses dépôts, les îles inventées |
| `monde.js` | Le relief, la mer, le ciel, la lumière, la caméra, l’île, l’archipel, l’intro, l’îlot, les aperçus |
| `modeles.js` | Les choses en 3D, leurs formes, leurs états, le petit décor |
| `outils.js` | Les nombres stables et le mélange des couleurs |
| `vendor/` | three.js 0.186, réduit aux pièces utilisées (licence MIT) |
| `fonts/` | Nunito (licence SIL OFL 1.1) |
| `404.html` | Page introuvable ; les anciennes adresses des maquettes et de `limbes/` mènent à l’accueil |
| `.nojekyll` | Sert les fichiers tels quels sur GitHub Pages |

Le stockage local utilise le préfixe `archipel:`. Au premier passage, l’île gardée sous un ancien nom du projet est reprise, sans rien effacer. `archipel:intro` retient que l’intro a été vue ou passée.

Chaque fichier est appelé avec un numéro de version, comme `?v=1`. Après une modification, on augmente le numéro de ce fichier là où il est appelé, pour qu’un téléphone ne mélange pas deux versions en cache.

Tester en local, depuis la racine du dépôt :

```sh
python3 -m http.server
# puis http://localhost:8000/
```
