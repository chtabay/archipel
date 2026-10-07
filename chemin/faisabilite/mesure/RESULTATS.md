# Le chemin et les écrits banals de la journée : ce que fait le vrai moteur

Spike de mesure, 7 octobre 2026. On répond à une question : si tout ce qu’une personne tape dans la journée (pages web, Gmail) nourrissait son chemin, qu’en ferait le moteur actuel ? On n’a rien modifié dans `chemin/`. Les fichiers `chemin/sens.js` et `chemin/monde.js` sont importés tels quels sous Node 22, avec les vrais fichiers de `chemin/sens/` et `chemin/catalogue.json`. La peinture est mesurée avec Playwright dans Chromium, sur l’app réelle (`chemin/?demo`).

Toutes les données sont **inventées** : quatre journées écrites pour l’occasion, sans aucun courriel réel ni donnée personnelle. Les numéros de téléphone viennent des plages réservées à la fiction, et les domaines sont en `.example`.

Machine de mesure : Intel Xeon à 2,8 GHz, 4 cœurs, sans carte graphique ; Node 22.22.0 ; Chromium de Playwright 1.56.1 avec SwiftShader (`--use-angle=swiftshader`, comme les tests). Aucun téléphone n’a été mesuré.

## En bref

1. **Un jour de frappe ordinaire produit 3 à 12 tuiles, pas une.** Le moteur fait une tuile pour environ 100 à 160 mots tapés. Sur la journée de bureau (26 saisies, 1 756 mots bruts), il en fait **12**, et encore **10** après nettoyage. Sur un an de jours ouvrés, cela fait **2 300 tuiles**, soit environ **510 Mo en WebP**, ou **710 Mo en JPEG sur iPhone**.
2. **Le moteur résiste assez bien au bruit, grâce à son filtre de mots porteurs.** Liens, signatures, mentions légales, références et code ne donnent presque jamais d’objet. Trois choses passent pourtant :
   - Les **citations** des réponses dupliquent le contenu : la journée de bureau fait 12 tuiles au lieu de 10, soit +20 %.
   - Les **noms propres** sont lus comme des noms communs. « Rennes » devient un **renne**, qu’on voit peint sur la tuile de l’étudiant ; « Vannes » donne « vanne », `@orange…` une orange, `/pull/` un pull, et une variable `panier` dans du code un panier.
   - Les **mots non porteurs** entrent dans le top 14 et déplacent le lieu. Une seule mention légale fait passer la tuile du village à l’intérieur.
3. **Le prototype `nettoyer()` règle l’essentiel** : citations, signatures (y compris celles apprises par répétition), adresses, code, nombres, noms propres (appris dans la journée) et mots vides anglais. Sur la journée de bureau, le texte perd 41 % de ses caractères, passe de 12 à 10 tuiles, et les objets parasites tombent de 2 à 0 (de 2 à 0 aussi pour l’étudiant, dont le renne disparaît).
4. **L’anglais est le vrai trou.** Le vocabulaire du sens ne contient que des mots français. Les mots anglais qu’il connaît viennent de textes français, et mènent au mauvais objet ou à aucun : *bike* donne un kart, *coffee* un soda, *dog* un hot-dog, *shop* une pizza. Sur la journée de Sam, 2 tuiles sur 3 n’ont **aucun objet**, et 1 à 3 moments sur 11 seulement sont évoqués.
5. **Agréger fait perdre ce qui rend la journée reconnaissable.** On compte les moments du jour évoqués par au moins un objet :
   - (a) tous les passages : 6/10 (bureau), 5/10 (étudiant), 8/10 (retraitée) ;
   - (b) une tuile par jour : 3/10, 4/10, 3/10 ;
   - (c) trois tuiles au plus, les plus riches : 4/10, 5/10, 7/10 ;
   - (d) une tuile par source : 3/10, 4/10, 4/10.

   Une tuile par jour devient une nature morte du thème dominant. Pour Nadia, ce sont un camion, une chaise et une armoire : le pot de départ, le vélo du fils et la randonnée disparaissent.
6. **Le travail écrase l’intime.** Plusieurs moments de Nadia n’apparaissent dans aucune stratégie : la randonnée en forêt (« j’ai besoin de marcher en forêt »), l’anniversaire de sa mère et la chute de vélo d’Adam. Le volume des courriels professionnels l’emporte.
7. **La peinture coûte environ 12 s par tuile sans carte graphique**, dont 11,4 s pour l’aquarelle et 0,1 à 0,3 s pour la 3D. Une tuile pèse **226 Kio en WebP 0,88** et **317 Kio en JPEG 0,9**. Safari n’encode pas le WebP, et l’app range alors du JPEG.
8. **Une journée qui grandit fait beaucoup repeindre.** Si on redécoupe la page du jour après chaque saisie, la journée de bureau produit **47 versions de passages pour 10 tuiles finales**. Sans clore la journée, la capture ambiante ferait repeindre sans cesse.
9. **La tonalité sort presque toujours « claire » ou « dorée ».** La valence va de 0,11 à 0,30 sur les quatre journées. La journée stressée de Nadia (camion en panne, armoire rayée, dégât des eaux) n’assombrit qu’une tuile sur dix.
10. **La lecture n’est pas un problème** : 2,7 à 2,9 ms par passage (`lirePage` + `candidats`) et 2 à 4 ms pour découper une journée entière, sur cette machine. Une fois la lecture gardée, chaque tuile coûte 0,08 ms à chaque ouverture.

## 1. Le corpus : quatre journées inventées, et combien on tape

Les fichiers sont dans `corpus/`, au format `### source | heure | outil | sujet`. La ligne d’en-tête n’est pas du texte tapé. Ce que le chemin devrait reconnaître de chaque journée est écrit **avant** les mesures, dans `corpus/attendus.json` : 10 ou 11 « moments », chacun avec ses mots.

| Persona | Saisies | Mots bruts | Contenu |
| --- | --- | --- | --- |
| Nadia, 41 ans, logistique dans une PME de meubles | 26 : 15 courriels, 6 fils Teams ou WhatsApp, 4 recherches, 1 formulaire | 1 756 | Courriels pro avec formules, signatures, citations (« Le lun. 5 oct. 2026 à 07:58, X a écrit : », lignes `>`, en-têtes Outlook « De : / Envoyé : »), mentions légales, un lien de cagnotte, une formule de tableur. Courriels perso : l’anniversaire de sa mère, une randonnée. |
| Léo, 20 ans, étudiant en biologie | 15 : 8 fils de discussion, 4 recherches, 1 compte rendu de TP, 1 candidature, 1 commentaire YouTube | 579 | Messages courts (« jsp », « mdr »), un peu d’anglais, du code R dans Discord |
| Monique, 72 ans, retraitée | 8 : 4 longs courriels familiaux, 2 messages de forum, 2 recherches | 766 | Courriels d’un seul bloc, une citation sans `>`, une recette, des rosiers malades |
| Sam, 34 ans, designer britannique à Paris | 11 : 4 courriels (2 en anglais, 1 en français, 1 personnel en anglais), 5 fils Slack ou WhatsApp, 2 recherches | 681 | Surtout de l’anglais, une citation « On … wrote: », du CSS, des numéros de tickets |

**Pourquoi ces volumes.** On ne dispose d’aucune mesure publique du nombre de mots qu’une personne tape par jour, et on n’a trouvé aucune source primaire. Les volumes sont donc des **estimations raisonnées**, appuyées sur trois repères :

- **Les courriels et messages reçus.** Microsoft (WorkLab, *Breaking down the infinite workday*, 17 juin 2025, télémétrie Microsoft 365) compte en moyenne **117 courriels** et **153 messages Teams** reçus par jour ouvré. Les locataires européens et ceux de l’éducation sont exclus. Radicati (*Email Statistics Report 2024-2028*) compte 361,6 milliards de courriels par jour pour 4,48 milliards d’utilisateurs, soit environ 81 par personne et par jour, envois et réceptions, spam et automatiques compris (calcul fait ici).

  Ce sont des messages **reçus**. Une personne en écrit beaucoup moins : on a retenu une quinzaine de courriels et une vingtaine de lignes de discussion pour une employée de bureau.
- **La vitesse de frappe.** 36,2 mots par minute en moyenne sur mobile, environ 70 % de la vitesse sur clavier (Palin et al., MobileHCI 2019, 37 370 volontaires). Les 1 137 mots que Nadia a vraiment tapés (après nettoyage) représentent donc 22 à 31 minutes de frappe pure dans la journée. C’est plausible pour un poste administratif.
- **Ce qu’une capture verrait réellement.** Une extension de navigateur ne voit pas les applications mobiles. Pour Léo, on a supposé WhatsApp Web et Discord sur ordinateur. Dans la réalité, l’essentiel de ses messages passe par son téléphone et échapperait à la capture.

Dans tous les cas, le texte capté est plus long que le texte tapé. Ce que `nettoyer()` retire (citations, signatures, mentions légales, adresses, nombres…) fait 41 % des caractères de la journée de Nadia (10 660 contre 6 315).

## 2. Ce que le moteur fait d’une journée entière, prise comme une page

Ces chiffres viennent de `mesure.mjs`, et le tableau complet est dans `tableaux.md`. Les temps sont des médianes de 5 passes.

| Mesure | Nadia (bureau) | Léo (étudiant) | Monique (retraitée) | Sam (en anglais) |
| --- | --- | --- | --- | --- |
| Caractères, brut → nettoyé | 10 660 → 6 315 | 3 239 → 2 752 | 4 305 → 3 723 | 3 920 → 2 267 |
| Mots, brut → nettoyé | 1 756 → 1 137 | 579 → 480 | 766 → 689 | 681 → 361 |
| Mots pleins connus du vocabulaire (nettoyé) | 91 % | 82 % | 87 % | 73 % |
| Mots porteurs (occurrences), brut → nettoyé | 187 → 143 | 58 → 51 | 111 → 102 | 45 → 41 |
| Porteurs distincts, brut → nettoyé | 99 → 88 | 43 → 40 | 89 → 84 | 37 → 34 |
| **Passages, donc tuiles (`decouper`), brut → nettoyé** | **12 → 10** | **4 → 3** | **7 → 7** | **3 → 3** |
| Mots tapés (nettoyés) par tuile | 114 | 160 | 98 | 120 |
| `decouper()` sur la journée (ms) | 3,6 → 1,9 | 0,6 → 0,5 | 0,9 → 0,7 | 0,9 → 0,5 |
| Lecture d’un passage, `lirePage` + `candidats` (ms, médiane / p95) | 2,84 / 3,56 | 2,82 / 2,84 | 2,71 / 2,80 | 2,80 / 2,84 |
| À chaque ouverture, lecture gardée : objets + lieu + plan, par tuile (ms) | 0,08 | 0,08 | 0,08 | 0,04 |
| Lecture gardée par passage (JSON, octets) | 5 461 | 5 863 | 5 467 | 4 991 |
| Tuiles sans objet ; tuiles avec 1 objet ou moins | 0 ; 0 | 0 ; 0 | 0 ; 0 | **2 ; 2** (sur 3) |
| Lieux des tuiles (a) | intérieur 7, village 3 | intérieur 3 | rivage 1, intérieur 1, forêt 2, champs 1, village 2 | village 1, intérieur 2 |
| Tonalité du jour (valence / énergie → ciel) | 0,11 / 0,13 → clair | 0,27 / 0,10 → clair | 0,29 / 0,11 → clair | 0,30 / −0,03 → doré |
| Journée qui grandit : passages relus et repeints au fil des saisies (tuiles finales) | 47 (10) | 21 (3) | 11 (7) | 14 (3) |
| Filet de sécurité (`aide()`) déclenché | non | non | non | non |

### Les tuiles de Nadia, stratégie (a), texte nettoyé

| # | Lieu | Ciel | Objets choisis (mot → objet) | Posés |
| --- | --- | --- | --- | --- |
| 1 | intérieur | neutre | camion→camion, chaise→chaise, lampe→lampadaire, carton→carton, cuisine→évier | 5 |
| 2 | intérieur | neutre | chaise→chaise, table→table, armoire→armoire, chêne→arbre, porte→palissade | 4 |
| 3 | intérieur | doré | camion→camion, table→table, armoire→armoire, chaise→chaise, chêne→arbre, cuisine→cuisine | 5 |
| 4 | village | doré | gâteau→gâteau, fraise→fraise, fleur→fleur, verre→verre, cadeau→cadeau, poterie→jarre | 5 |
| 5 | intérieur | neutre | tabouret→tabouret, chaise→chaise, banc→banc, chêne→arbre | 4 |
| 6 | intérieur | gris | chat→animal, table→table | 2 |
| 7 | intérieur | neutre | bois→wagon, bâtiment→bâtiment, armoire→armoire, chêne→arbre, porte→palissade | 4 |
| 8 | intérieur | neutre | tapis→tapis, canapé→salon, lampe→lampadaire, camion→benne, plante→plante, cuisine→placard | 5 |
| 9 | village | neutre | bouteille→bouteille, cadeau→cadeau, camion→camionnette, train→train | 3 |
| 10 | village | neutre | pain→pain, camion→camionnette, armoire→armoire | 3 |

Ce qu’on y voit :

- La journée de travail est lisible : meubles, camion, pot de départ (tuile 4), séance photo (tuile 8). Mais elle se répète : le camion revient sur 5 tuiles, l’armoire et le chêne sur 4. La mémoire des objets récents (`recents`) ne suffit pas à varier sur une seule journée.
- La tuile 6 est la seule grise, celle du courriel à sa sœur (dent cassée, chute de vélo).
- La randonnée en forêt du soir est fondue dans la tuile 10, qui reste au village avec du pain et une camionnette.
- **Le catalogue n’a pas de vélo** : « vélo » mène au mieux à un chariot (0,70). Le vélo d’Adam, celui de Lucas et celui de Sam ne peuvent pas apparaître.

### Les tuiles de Sam : l’anglais ne fait pas d’images

| # | Lieu | Objets choisis | Les 14 mots retenus (début) |
| --- | --- | --- | --- |
| 1 | village | aucun | bike, shopping, coffee, phone, shop, metro, cat, illustration, tunnel… |
| 2 | intérieur | gâteau, évier, citron, fleur, table, cuisine | les deux messages **en français** (propriétaire, belle-mère) |
| 3 | intérieur | aucun | shop, leaves, bike, wine, tree, room, dog, cat… |

Les mots anglais sont bien dans le vocabulaire, et ils sont même porteurs. Mais leur vecteur vient de textes français, où *coffee* et *dog* apparaissent surtout dans des noms (« coffee shop », « hot-dog »). Les meilleurs scores tombent donc sous le seuil de 0,7 : `shop→pizza 0,65`, `coffee→soda 0,64`, `bike→karting 0,64`. S’ils le dépassent, c’est vers le mauvais objet : `dog→hot-dog 0,78`. En comparaison, *café* donne un café à 1,07, *chien* un animal à 1,00, *vin* du vin à 1,03.

## 3. Le bruit, et le prototype `nettoyer()`

`nettoyer.mjs` enchaîne sept étapes, séparables : **citations, signatures, adresses, code, nombres, noms propres, mots vides**.

- **Citations et signatures** ne s’appliquent qu’aux courriels. Les signatures comprennent les formules d’appel et de politesse, le bloc court qui suit, « Envoyé de mon iPhone », les mentions légales et les lignes vues dans au moins trois courriels du jour (une signature apprise sans la connaître d’avance).
- **Les noms propres** sont les mots à majuscule au milieu d’une phrase. Ceux qu’on a vus dans un texte rédigé de la journée sont aussi retirés là où ils sont écrits en minuscules, par exemple « météo rennes ».
- **Les mots vides anglais** ne sont retirés que des lignes où les mots outils anglais l’emportent sur les français, pour ne pas toucher « lot », « nice » ou « pretty » dans une phrase française. On y ajoute les abréviations de messagerie : « mdr », « jsp », « lol »…

### Essais ciblés : une phrase ordinaire, plus un seul type de bruit

Phrase de base : « Ce matin, un café sur le balcon, puis le marché sous la pluie avec mon fils. » Le moteur en tire café→café et marché→marché, au village.

| Bruit ajouté | Mots reconnus (porteurs) | Entrent dans les 14 mots retenus | Objets ajoutés | Lieu |
| --- | --- | --- | --- | --- |
| Lien (URL leboncoin) | https, www, category, text, pouces, location, lyon (aucun) | category, pouce, location, www, https, lyon, recherche, text | — | village |
| Adresses de courriel | marc, dubois, example, yves, **orange** | orange, example, dubois, yves, marc | **orange→orange** | village |
| Nombres, dates, références | commande, palettes (aucun) | palettes, commande | — | village |
| Signature complète | … ardoise, mobilier, logistique, **rue**, **iphone** | iphone, example, ardoise, rue, villeurbanne, nadia… | — | village |
| Mention légale | … **pièce**, jointes, confidentiels, destinataires | pièce, jointes, confidentiel, destinataire… | — | **intérieur** |
| Citation de réponse (« … a écrit : » + `>`) | écrit, **camion**, tonnes, soir, **garage**, express | garage, camion, tonnes, express, soir… | **camion→camion** | village |
| Code JavaScript | const, **panier**, document, cart, let, items, price… | panier, item, cart, price, let, const… | **panier→panier** | **intérieur** |
| Formule de tableur | stock, faux (aucun) | stock, faux | — | village |
| Phrase anglaise | think, the, meeting, with, team, **office**… | office, really, bring, should, something… | — | village |
| Messagerie (« mdr jsp stp ouais grave lol ») | ouais, **grave**, lol | grave, lol, ouais | — | village |

Le filtre des mots porteurs fait la plus grande partie du travail : sur dix types de bruit, trois seulement ajoutent un objet (l’orange, le camion cité, le panier du code). Deux défauts demeurent :

- Un mot non porteur peut entrer dans le top 14 avec un poids de 0,3, parce que le poids croît avec la rareté du mot (`log(1 + i/60)`). Il pèse alors sur le vecteur de contexte : la mention légale et le code font basculer le lieu.
- Les citations répètent ce qui a déjà été écrit, ce qui double les mêmes objets.

### Chaque étape seule, sur la journée brute (stratégie (a))

| Persona, variante | Caractères | Porteurs distincts | Tuiles | Objets | Dont parasites | Parasites dans les 14 mots du jour |
| --- | --- | --- | --- | --- | --- | --- |
| Nadia, brut | 10 660 | 99 | 12 | 52 | 2 (salon→salon, salon→table) | — |
| Nadia, citations seules | 9 036 | 93 | **10** | 43 | 0 | — |
| Nadia, signatures seules | 8 796 | 96 | 11 | 48 | 2 | — |
| Nadia, adresses seules | 9 952 | 99 | 12 | 52 | 1 | — |
| Nadia, **tout `nettoyer()`** | **6 315** | 88 | **10** | 46 | **0** | — |
| Léo, brut | 3 239 | 43 | 4 | 18 | 2 (renne→renne, renne→sanglier) | renne, vanne |
| Léo, noms propres seuls | 3 161 | 41 | 3 | 14 | 0 | — |
| Léo, **tout `nettoyer()`** | 2 752 | 40 | **3** | 15 | **0** | — |
| Monique, brut → nettoyé | 4 305 → 3 723 | 89 → 84 | 7 → 7 | 31 → 30 | 0 → 0 | — |
| Sam, brut → nettoyé | 3 920 → 2 267 | 37 → 34 | 3 → 3 | 6 → 6 | 0 → 0 | pull (de `github…/pull/1842`) → — |

Un « parasite » est un objet dont le mot n’existe plus dans le texte nettoyé. Les deux parasites de Nadia viennent d’un seul mot : le « salon de la maison » cité dans un courriel de son patron.

Ce que `nettoyer()` ne règle pas :

- l’anglais ;
- un nom de lieu tapé en minuscules s’il n’apparaît jamais avec sa majuscule dans un texte rédigé du jour ;
- une sortie d’erreur collée dans un message (« Error in t.test.formula… » reste) ;
- les homographes ordinaires (« orange » la couleur reste une orange, ce qui est juste).

Ses règles ont été mises au point sur ce corpus : elles demandent à être éprouvées sur d’autres textes.

## 4. Agréger pour ne pas inonder la frise

Toutes les stratégies sont mesurées sur le texte nettoyé, et la variante (a) aussi sur le texte brut.

- **(c)** garde les 3 passages dont les objets possibles ont la plus forte somme de scores.
- **(e)**, ajoutée en cours de route, garde 3 passages riches **et** variés : chaque passage choisi doit apporter des objets nouveaux. Sur ces quatre journées, elle a fait exactement les mêmes choix que (c).
- **(d)** fait une tuile pour les courriels et une pour tout le reste du navigateur.

Un moment est « évoqué » si un objet d’une tuile du jour a pour mot, ou pour nom, l’un des mots attendus.

| Persona | Stratégie | Tuiles/jour | Objets/tuile | Tuiles sans objet | Objets distincts | Moments évoqués (objets choisis) | (objets posés) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nadia | (a) brut | 12 | 4,33 | 0 | 46 | 6/10 | 6/10 |
| Nadia | (a) tous les passages | 10 | 4,6 | 0 | 42 | **6/10** | 5/10 |
| Nadia | (b) une tuile par jour | 1 | 6 | 0 | 6 | 3/10 | 3/10 |
| Nadia | (c) 3 au plus, les plus riches | 3 | 6 | 0 | 18 | 4/10 | 4/10 |
| Nadia | (d) une par source | 2 | 6 | 0 | 12 | 3/10 | 3/10 |
| Léo | (a) | 3 | 5 | 0 | 15 | **5/10** | 4/10 |
| Léo | (b) | 1 | 6 | 0 | 6 | 4/10 | 4/10 |
| Léo | (c) | 3 | 5 | 0 | 15 | 5/10 | 4/10 |
| Léo | (d) | 2 | 4 | 0 | 8 | 4/10 | 4/10 |
| Monique | (a) | 7 | 4,29 | 0 | 30 | **8/10** | 8/10 |
| Monique | (b) | 1 | 5 | 0 | 5 | 3/10 | 1/10 |
| Monique | (c) | 3 | 5,67 | 0 | 17 | 7/10 | 6/10 |
| Monique | (d) | 2 | 5,5 | 0 | 11 | 4/10 | 1/10 |
| Sam | (a) | 3 | 2 | **2** | 6 | 2/11 | 2/11 |
| Sam | (b) | 1 | 1 | 0 | 1 | 1/11 | 1/11 |
| Sam | (c) | 3 | 2 | **2** | 6 | 2/11 | 2/11 |
| Sam | (d) | 2 | 2,5 | 0 | 5 | 3/11 | 3/11 |

Ce que montrent ces chiffres, persona par persona :

- **Nadia.**
  - En **(b)**, on retient : armoire, chaise, livraison, camion, vélo, meuble, chêne, entrepôt, table, cadeau, lampe, pause, cuisine, matin. La tuile montre un camion, une chaise, une armoire, une table, un arbre et un lampadaire, dans la maison ouverte. C’est la journée de travail, sans le pot de départ.
  - En **(c)**, on retrouve la commande (meubles et camion), le pot de départ (fraisier, fleurs, cadeau) et la séance photo (tapis, canapé, plante). Trois tuiles, toutes trois du travail.
  - En **(d)**, deux tuiles presque identiques : les meubles et le camion dans les deux.
- **Léo.** En **(b)**, la tuile donne pizza, pain, oignon, poubelle et le chat : la coloc et le TP s’y lisent. Avant nettoyage, le renne de Rennes était le premier mot retenu.
- **Monique.**
  - Le texte rédigé et imagé de ses longs courriels donne les meilleures tuiles. En (a), 8 moments sur 10 sont évoqués : la plage et les crêpes, le chat dans son fauteuil, les rosiers, la charrette de la grange, la balade avec son café.
  - En **(b)**, il ne reste qu’un champ avec crêpes, pomme, charrette et figuier. 3 moments sur 10 sont évoqués par les objets choisis, et 1 seul par les objets réellement posés.
  - **(c)** garde l’essentiel : 7 sur 10.
- **Sam.** Aucune stratégie ne sauve une journée en anglais.

**Ce qu’on a vu sur les tuiles peintes** (section 5) :

- La journée de Nadia en une tuile : une maison ouverte, un camion garé, une chaise, un meuble. On reconnaît son métier, pas sa journée.
- Son passage du pot de départ : un fraisier, des fraises, un paquet cadeau, des tulipes et un verre devant une maison de village. Celui-là se reconnaît tout de suite.
- La journée de Léo : une pizza géante sur une table et un **renne au nez rouge**, peint avant que le nettoyage n’apprenne les noms propres.
- La journée de Sam : une maison vide avec un évier.

**Jugement.**

- Une tuile par jour (b) et une tuile par source (d) n’évoquent plus la journée : elles en gardent le thème dominant, qui est le travail.
- Trois tuiles au plus, choisies parmi les plus riches (c), gardent l’essentiel pour la retraitée et l’étudiant, et la moitié pour l’employée de bureau. C’est le meilleur compromis mesuré, pour un volume réduit de 70 %.
- Aucune stratégie ne fait remonter l’intime noyé dans le travail. Il faudrait le pondérer à part, par exemple par source (boîte perso ou boîte pro), ou laisser la personne le choisir.

## 5. La peinture et le stockage

### Mesuré avec Playwright

Ces mesures viennent de `peinture.mjs`.

1. **L’app elle-même.** On a ouvert `chemin/?demo` sur un téléphone simulé de 390 × 844, avec les arguments GL de `tests/commun.js`. L’app a peint seule les **2 tuiles proches de l’écran**, à 11,35 s d’intervalle, puisqu’elle peint une tuile à la fois. Elle les a rangées dans IndexedDB en WebP : **206 et 216 Kio**. Pour ce stockage, `navigator.storage.estimate()` donne 507 071 octets dans IndexedDB et 5,4 Mo dans les caches du service worker.
2. **Un atelier séparé**, dans la même page, a peint six tuiles faites des journées inventées. Il reproduit `peindre()` d’`app.js` : `Atelier.tuile`, puis `peindreFrise`, puis `toBlob`.

| Tuile | 3D (ms) | Aquarelle (ms) | WebP (ms) | Total (ms) | WebP 0,88 (Kio) | JPEG 0,9 (Kio) | PNG (Kio) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nadia, la journée en une tuile (b) | 290 | 11 774 | 236 | 12 301 | 225 | 312 | 2 628 |
| Léo (b) | 183 | 11 378 | 226 | 11 787 | 224 | 310 | 2 629 |
| Monique (b) | 130 | 11 447 | 230 | 11 807 | 244 | 336 | 2 666 |
| Sam (b) | 131 | 11 338 | 254 | 11 722 | 210 | 299 | 2 564 |
| Nadia, passage 1 (a) | 121 | 11 318 | 231 | 11 671 | 215 | 306 | 2 584 |
| Nadia, passage 4 : le pot de départ (a) | 182 | 11 717 | 224 | 12 123 | 237 | 339 | 2 665 |
| **Moyenne** | | | | **≈ 11 900** | **226** | **317** | **2 622** |

- **Le temps est mesuré sans carte graphique** (SwiftShader). L’aquarelle, un shader plein écran sur 1 353 × 1 000 points, en prend 96 %. Sur un téléphone avec GPU, ce sera sans doute bien plus rapide, mais ce n’est **pas mesuré**.
- **La taille, elle, ne dépend pas du GPU** : environ 226 Kio par tuile en WebP 0,88. Elle varie peu (de 210 à 244 Kio), car c’est le papier et le lavis qui pèsent, pas les objets.
- **Safari et iPhone.** Safari n’encode pas le WebP depuis un canvas : `toBlob('image/webp')` y rend du PNG. L’app range donc du JPEG 0,9, plus lourd d’environ 40 % (317 Kio). Sources : le bogue WebKit 226950, classé WONTFIX, et caniuse, consulté le 7 octobre 2026, qui ne note aucune prise en charge dans Safari macOS ni iOS.

### Projection sur un an

Hypothèse : chaque jour actif ressemble au jour mesuré. Jours actifs par an : 230 pour Nadia et Sam, 280 pour Léo, 200 pour Monique. Les tuiles ne sont peintes, et donc rangées, que si on les fait défiler : ces chiffres sont un plafond.

| Persona | Stratégie | Tuiles/an | Mo/an WebP | Mo/an JPEG (iPhone) | Lectures gardées (Mo/an) | Pages (Mo/an) | Peinture sans GPU (h/an) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nadia | (a) | 2 300 | **508** | **712** | 12 | 2,8 | 7,6 |
| Nadia | (b) | 230 | 51 | 71 | 1,2 | 2,8 | 0,8 |
| Nadia | (c) | 690 | 152 | 214 | 3,6 | 2,8 | 2,3 |
| Nadia | (d) | 460 | 102 | 143 | 2,4 | 2,8 | 1,5 |
| Léo | (a) / (c) | 840 | 185 | 260 | 4,7 | 1,5 | 2,8 |
| Léo | (b) | 280 | 62 | 87 | 1,6 | 1,5 | 0,9 |
| Monique | (a) | 1 400 | 309 | 434 | 7,3 | 1,4 | 4,6 |
| Monique | (b) | 200 | 44 | 62 | 1,0 | 1,4 | 0,7 |
| Monique | (c) | 600 | 132 | 186 | 3,1 | 1,4 | 2,0 |
| Sam | (a) / (c) | 690 | 152 | 214 | 3,3 | 1,0 | 2,3 |
| Sam | (b) | 230 | 51 | 71 | 1,1 | 1,0 | 0,8 |

Une personne qui tape beaucoup, autour de 4 000 mots par jour, ferait environ 35 tuiles par jour en (a), au rythme de 114 mots par tuile. Sur 230 jours, cela donne **8 000 tuiles par an, environ 1,8 Go en WebP ou 2,5 Go en JPEG**, et 26 h de peinture sans GPU (extrapolation, non mesurée).

**Les quotas et l’éviction**, vérifiés le 7 octobre 2026 :

- **Chrome.** Une origine peut stocker jusqu’à 60 % du disque (MDN, *Storage quotas and eviction criteria*, page modifiée le 5 janvier 2026).
- **Safari (navigateur et application web installée).** Jusqu’à environ 60 % du disque par origine (WebKit, *Updates to Storage Policy*, 10 août 2023, et MDN).
- **Éviction au bout de sept jours.** Safari efface le stockage écrit par script d’un site resté sept jours d’usage sans interaction (MDN). Une application web posée sur l’écran d’accueil a son propre compteur, qui avance avec son usage (WebKit, *Full Third-Party Cookie Blocking and More*, 24 mars 2020).
- **Stockage persistant.** `persist()`, que l’app appelle déjà (`carnet.proteger()`), est accordé ou refusé sans dialogue, selon des heuristiques, par Chromium et Safari (MDN).

**Ces volumes tiennent dans les quotas, mais un demi-gigaoctet par an pour un journal, c’est beaucoup sur un téléphone.** En cas de manque de place, une origine non persistante est effacée en entier, la moins récemment utilisée d’abord (MDN, WebKit).

**Le code actuel ajoute deux effets.**

- `elaguer()` ne retire jamais une tuile du chemin courant. Son plafond de 3 000 entrées ne limite donc rien quand toutes les tuiles sont dans la frise : le stockage croît tant qu’on fait défiler.
- La clé d’une tuile dépend de ses deux voisines. Si la page du jour est réécrite à chaque saisie, comme le ferait une capture, ses passages changent : 47 versions pour 10 tuiles chez Nadia. Les tuiles du jour et celle de la veille seraient repeintes, et les anciennes resteraient orphelines jusqu’à 30 jours.

## 6. Recommandations

1. **Ne pas brancher la capture sur le découpage actuel (a).** Plafonner à **3 tuiles par jour au plus**, les plus riches (c). Une option « déplier la journée » pourrait montrer les autres passages sans les peindre d’avance. Garder les pages écrites exprès dans le journal comme aujourd’hui, et distinguer les tuiles « du journal » des tuiles « ambiantes ».
2. **Clore la journée avant de peindre.** Le texte capté s’accumule dans la journée, sans être découpé ni peint. La journée se fige à minuit, ou au premier lancement du lendemain, puis on la lit et on la peint une fois. On évite ainsi les 47 lectures et repeintures, et les tuiles orphelines.
3. **Nettoyer avant de lire, et ne garder que le nettoyé.** Retirer d’abord les citations : c’est le gain le plus net, et elles contiennent les mots d’autres personnes. Puis les signatures apprises, les adresses, le code, les nombres et les noms propres appris. Le texte brut d’un courriel ne devrait pas être rangé dans `pages`.
4. **L’anglais.** Soit ajouter un vocabulaire anglais (les vecteurs alignés de fastText existent aussi en anglais, dans le même espace), avec son propre `images.bin`. Soit détecter la langue et prévenir que le chemin ne lit que le français. En l’état, une journée en anglais donne des tuiles vides ou fausses.
5. **Faire place à l’intime.** Donner plus de poids aux sources personnelles (boîte perso, messages à des proches) qu’aux sources professionnelles, ou laisser la personne exclure une source. Sinon la frise d’une employée de bureau devient un catalogue de mobilier.
6. **Le catalogue.** Ajouter un vélo : le mot revient dans trois journées sur quatre. Revoir les objets qui attirent les mots anglais et les noms propres (renne, hot-dog, karting).
7. **Le poids des tuiles.** Mesurer une qualité WebP plus basse, ou des tuiles plus petites pour les jours ambiants : ce n’est pas fait ici. Sur iPhone, envisager un autre format que le JPEG 0,9, par exemple un JPEG 0,8 (non mesuré).

## 7. Limites

- **Quatre journées écrites par la même personne.** Ce n’est pas une statistique. Les volumes sont des estimations, et aucune source primaire n’a été trouvée sur le nombre de mots tapés par jour.
- **La liste des moments attendus** a été écrite avant les mesures, mais par l’auteur du corpus. Le score « moments évoqués » reste un indicateur grossier.
- **Les temps de lecture** sont mesurés sur un Xeon de serveur. Sur téléphone, ils seront plus longs, mais ce n’est pas mesuré.
- **La peinture** est mesurée sans GPU (SwiftShader), et seulement sur 8 tuiles (2 par l’app, 6 par l’atelier). Le temps sur un vrai téléphone n’est pas mesuré. `peinture.json` vient d’un passage fait avant l’ajout de l’étape « noms propres » à `nettoyer()` : c’est pourquoi la tuile de Léo porte encore le renne. Relancer `peinture.mjs` ne le peindrait plus ; les temps et les poids, eux, ne changent guère d’une tuile à l’autre (de 210 à 244 Kio).
- **La projection annuelle** suppose des jours identiques au jour mesuré, et que toutes les tuiles sont vues.
- **Le prototype `nettoyer()`** est heuristique et réglé sur ce corpus.
- **La capture elle-même** n’est pas testée ici : extension, Gmail, et passage du texte vers le stockage de `chtabay.github.io`. Le filet de sécurité appliqué à du texte ambiant ne l’est pas non plus. Ces sujets relèvent des autres essais de `chemin/faisabilite/`. Aucune des quatre journées ne déclenche `aide()`.
- **Non vérifié** : le temps de peinture sur GPU mobile, et le comportement exact de `persist()` sur iOS 26.

## Rejouer

```sh
# la mesure du moteur (environ 2 s) : écrit resultats.json et tableaux.md
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON chemin/faisabilite/mesure/mesure.mjs
# la peinture (environ 2 min) : écrit peinture.json, et des tuiles en JPEG hors du dépôt (variable IMAGES, /tmp par défaut)
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON chemin/faisabilite/mesure/peinture.mjs 6
# puis relancer mesure.mjs pour que les projections prennent la taille mesurée des tuiles
```

| Fichier | Rôle |
| --- | --- |
| `corpus/*.txt` | Les quatre journées inventées |
| `corpus/attendus.json` | Les moments de chaque journée, écrits avant les mesures |
| `moteur.mjs` | Charge `sens.js` et `monde.js` tels quels, et refait `calculer()` d’`app.js` |
| `nettoyer.mjs` | Le prototype de nettoyage, en sept étapes |
| `mesure.mjs` | Les mesures du moteur, du bruit, des stratégies et du stockage |
| `peinture.mjs` | La peinture et le poids des tuiles, avec Playwright |
| `resultats.json`, `tableaux.md`, `peinture.json` | Les résultats bruts |

## Sources

- MDN, *Storage quotas and eviction criteria*, modifiée le 5 janvier 2026 : https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- WebKit, *Updates to Storage Policy*, 10 août 2023 : https://webkit.org/blog/14403/updates-to-storage-policy/
- WebKit, *Full Third-Party Cookie Blocking and More*, 24 mars 2020 : https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- Bogue WebKit 226950, export du canvas en WebP, WONTFIX : https://bugs.webkit.org/show_bug.cgi?id=226950
- caniuse, `toBlob` avec `image/webp` : https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp
- Microsoft WorkLab, *Breaking down the infinite workday*, 17 juin 2025 : https://www.microsoft.com/en-us/worklab/work-trend-index/breaking-down-infinite-workday
- Radicati Group, *Email Statistics Report 2024-2028*, résumé : https://radicati.com/wp/wp-content/uploads/2024/10/Email-Statistics-Report-2024-2028-Executive-Summary.pdf
- Palin et al., *How do People Type on Mobile Devices?*, MobileHCI 2019 : https://userinterfaces.aalto.fi/typing37k/
