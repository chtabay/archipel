# Le chemin dans le navigateur : plan de construction de l’extension

Octobre 2026. Ce plan part des choix de `CHOIX.md` et des prototypes de ce dossier. Une première version a été
relue par trois critiques (technique, produit et boutiques, complétude), qui ont vérifié leurs points dans Chromium
141 et dans la documentation des navigateurs ; cette version en tient compte. Les coûts sont en jours-personne,
pour quelqu’un qui connaît déjà le code du chemin.

## Ce qu’on construit

Une extension de navigateur, Chrome et Firefox d’abord, qui lit ce qu’on écrit soi-même dans les pages, au
moment où l’écrit est posé, et fait pousser un chemin qui vit dans l’extension. Rien ne part de l’ordinateur.

- **Le glaneur** lit les zones de texte des pages, jamais les mots de passe, les cartes, les codes, les
  recherches, ce qui est collé ou cité. Il ne suit pas les touches : il lit la zone quand l’écrit est posé, et
  n’envoie que ce qui a été ajouté depuis la dernière fois.
- **La tuile ouverte** accumule les écrits du jour. Quand elle tient sa dose de mots porteurs, 14 au moins,
  jusqu’à une vingtaine selon où tombent les phrases, elle se ferme, se lit, se peint, et arrive au bout du chemin
  quelques minutes plus tard. Une tuile fermée ne se relit jamais. Sa peinture est refaite une seule fois, sans
  animation, quand sa voisine de droite arrive : les deux tuiles se raccordent sans couture, comme aujourd’hui.
- **Le chemin** s’affiche dans chaque nouvel onglet, en grand, sans champ de recherche. Le journal écrit garde sa
  place, plié sous la frise. Il y a un chemin par profil de navigateur ; le site du chemin reste l’app du téléphone,
  avec son propre carnet.
- **La promesse** reste celle du chemin : l’extension ne fait aucune requête vers l’extérieur, ses règles de
  sécurité (CSP) l’interdisent, et un essai automatique le vérifie à chaque version.

Le téléphone ne reçoit rien pour le moment. La sauvegarde connectée viendra plus tard, et pourra ne porter que
les lectures et les images, scellées (`architecture/`).

## Les pièces, et d’où elles viennent

| Pièce | Rôle | Point de départ |
| --- | --- | --- |
| `glaneur.js` | script de contenu : lire l’écrit posé, n’envoyer que l’ajout, exclure le sensible | `navigateur/extension/glaneur.js` (33 vérifications), plus la pause et la liste de sites de `extension/glaneur.js` |
| `fond.js` | service worker : la file des glanes, les états des tuiles, les alarmes, l’icône, la pause, la reprise au démarrage | `navigateur/extension/fond.js`, à réécrire autour des états |
| `atelier.html` | le seul calculateur et le seul peintre : découper, lire, planifier, peindre, ranger ; document hors écran sur Chrome, page de fond sur Firefox | nouveau ; reprend `sens.js`, `monde.js`, `aquarelle.js` |
| `onglet.html` | le nouvel onglet : la frise depuis les images rangées, l’arrivée, le journal plié, le rideau | `chemin/index.html` et `chemin/app.js`, réindexés |
| `accord.html` | l’accord à l’installation, puis les réglages : pause, sites, oublier, tout effacer, diagnostic | `navigateur/extension/accord.html`, `extension/popup.html` |
| `carnet.js` | pages, traces, index de la frise, images, dans l’IndexedDB de l’extension | `chemin/carnet.js`, avec les magasins `traces` et `frise` |
| le moteur | `sens.js`, `monde.js`, `aquarelle.js`, `contenu.js`, `outils.js`, `vendor/`, `sens/`, `objets/`, `catalogue.json`, partagés avec le site | copiés tels quels par la fabrication, en gardant l’arborescence (`monde.js` importe `../outils.js`) |

Le code source vit dans `chemin/extension/`. Un script `fabriquer.js` assemble `chemin/extension/dist/` (ignoré par
git) : une extension doit contenir tous ses fichiers. Elle pèse environ 17 Mo, dont 10 Mo d’objets 3D et 4 Mo de
vecteurs du sens ; les boutiques acceptent bien plus. Le moteur ne change pas pour le site, à deux détails près,
compatibles : `planifier()` accepte une graine à part de l’indice, et `candidats()` un seuil.

Les règles de sécurité de l’extension, vérifiées dans Chromium : `script-src 'self' 'wasm-unsafe-eval'` (le
décodeur des modèles est en WebAssembly ; sans lui, chaque tuile serait peinte sans aucun objet, en silence),
`connect-src 'self'` (ses propres fichiers, et rien d’autre), `img-src 'self' blob: data:`, `object-src 'none'`.
Les styles écrits dans `index.html` passent dans `style.css`.

## De l’écrit à la tuile

1. **Le glaneur** voit un écrit posé : perte du focus après une modification, Entrée sur une ligne, clic sur
   « Envoyer », envoi du formulaire, fermeture de la page. Il garde, par zone et par page, le texte déjà cueilli, et
   n’envoie au fond que l’ajout, s’il fait au moins quatre mots. Un brouillon repris trois fois ne fait donc qu’une
   fois son chemin. Un même texte envoyé deux fois le même jour ne compte qu’une fois.
2. **Le fond** range l’écrit dans la file du jour et réveille l’atelier. Il ne calcule rien lui-même : le service
   worker meurt après trente secondes d’inactivité, et le sens pèse quatre mégaoctets.
3. **L’atelier** nettoie l’écrit (signatures, adresses, noms propres appris dans la journée, d’après
   `mesure/nettoyer.mjs` : la dose de 14 a été mesurée sur du texte nettoyé), l’ajoute à la tuile ouverte, et
   découpe avec `decouper()`. Tous les passages sauf le dernier se ferment ; le dernier reste ouvert s’il a moins de
   14 porteurs. **Après une fermeture, la tuile ouverte ne contient plus que ce dernier passage** : une tuile fermée
   ne repasse jamais dans `decouper()`, dont les coupes bougeraient. Un long mail peut fermer deux tuiles d’un coup.
4. **Une tuile fermée est lue** : `lirePage`, `candidats` avec un seuil un peu plus bas que celui du site, pour
   garder de la marge. Le texte brut est alors effacé. Il ne reste que sa lecture mince : les champs, la tonalité,
   l’heure, et la liste des objets possibles avec le mot qui les a appelés. L’essai `architecture/` montre que le
   plan d’une tuile est identique, au bit près, qu’on parte du texte ou de cette lecture. La lecture d’une trace est
   définitive : sans texte, on ne relit pas.
5. **L’atelier planifie** toute la chaîne du jour (0,08 ms par tuile), avec une graine tirée de l’identifiant de la
   trace, et non de son rang : insérer ou oublier une tuile ne replanifie pas celles qui suivent. Il peint la
   nouvelle tuile et repeint sa voisine de gauche, dont le bord porte l’objet de raccord. Avec une carte graphique,
   quelques secondes ; sans, une dizaine par tuile. Il range les images et met à jour l’index de la frise.
6. **L’arrivée** : une alarme, entre deux et six minutes après la fermeture, et seulement si la tuile est peinte.
   Les onglets ouverts du chemin sont prévenus ; la voisine se remplace sans bruit, la nouvelle se révèle au
   pinceau.
7. **À minuit**, et au premier écrit du lendemain, et au démarrage du navigateur, la tuile ouverte de la veille se
   ferme si elle a au moins quatre porteurs ; sinon elle attend le lendemain. Les alarmes sont recréées à chaque
   réveil du fond : Chrome les efface à la mise à jour de l’extension.

Dans la frise, un jour montre d’abord ses tuiles d’écrits, dans l’ordre de leur fermeture, puis les tuiles de sa
page de journal. Une tuile d’écrits qui se ferme après que la page du jour a été écrite peut faire repeindre les
tuiles de cette page, et elles seules. L’étiquette : la date sur la première tuile du jour ; la date et le titre
sur les tuiles du journal, avec une petite plume devant ; jamais le site.

### Les états d’une trace, et la reprise

Une trace passe par `ouverte`, `fermée`, `lue`, `peinte`, `arrivée`, ou `ratée`. Chaque état est rangé dans le
carnet, jamais seulement en mémoire : le fond peut mourir entre deux étapes, le navigateur se fermer pendant une
peinture ou à minuit. À chaque réveil (`onStartup`, `onInstalled`, premier message), le fond ferme la tuile de la
veille, réarme minuit, relance la lecture et la peinture de ce qui n’est pas peint, réarme les arrivées. Une tuile
`ratée` est retentée au réveil suivant. Un seul peintre, l’atelier : un onglet du chemin n’affiche que des images.

## Les phases

### Phase 0 : préparer (3 jours)

- Le dossier `chemin/extension/`, `fabriquer.js`, `dist/` dans `.gitignore`, un `LISEZMOI`, et le premier
  `manifest.json` : `storage`, `unlimitedStorage`, `alarms`, `scripting`, `offscreen` (Chrome), l’accès à tous les
  sites pour l’essai, `chrome_url_overrides.newtab`, `incognito: not_allowed`, la CSP ci-dessus. `topSites` en
  permission optionnelle, demandée seulement si la personne veut ses sites fréquents sous la frise : à
  l’installation, Chrome l’annoncerait à côté de l’accès à tous les sites.
- Le banc d’essai : `tests/extension.js` dans `SUITES` et dans la matrice de `tests.yml`, avec la fabrication
  avant la suite ; Chromium avec l’extension chargée et la 3D logicielle ; une page d’essai qui imite Gmail, un
  formulaire, un mot de passe, une carte. Une suite de fumée Firefox en intégration continue, avec geckodriver et
  un module temporaire : chargement, accord, une glane, aucune requête.
- Les vérifications : un modèle `.glb` se charge dans une page d’extension sous la CSP ; un `fetch` vers l’extérieur
  est refusé ; sur Firefox, la page de fond rend du WebGL et survit à une peinture de vingt-cinq secondes, sinon
  l’atelier sera un onglet d’extension caché ; les dialogues réels « garder ce nouvel onglet » de Chrome, Firefox et
  Edge, à la main ; le curseur dans la barre d’adresse.
- Le compte Chrome Web Store (frais unique de quelques dollars, double authentification, déclaration de
  non-commerçant), le compte AMO, et un premier brouillon de politique de confidentialité.

Déjà vérifié dans Chromium 141 par la relecture : le document hors écran peint une vraie tuile en 11,3 s avec la
3D logicielle, garde le moteur en mémoire, et survit sans limite de durée ; les imports avec `?v=` fonctionnent
dans une page d’extension.

**On voit :** l’extension se charge dans Chromium et Firefox, les deux bancs d’essai tournent, le site du chemin ne change pas.

### Phase 1 : le socle, de l’écrit à la tuile (9 à 12 jours)

- `glaneur.js` : l’ajout seulement, les exclusions, la pause, les sites exclus d’office (banque, santé, aide).
  Enregistré après le oui, avec `scripting.registerContentScripts`, retiré en pause : « pas d’accord, pas de glane »
  devient vrai dans le code, pas seulement dans le stockage. Sur Firefox, qui laisse retirer l’accès aux sites à
  tout moment, l’icône le dit.
- `fond.js` : la file, les états, les alarmes, la reprise au démarrage, l’icône, la pause.
- `atelier.html` : le nettoyage, la tuile ouverte, `decouper()`, la lecture mince, la chaîne des plans avec graine
  stable, la peinture de la tuile et de sa voisine, l’index de la frise. Sur Chrome, un document hors écran, raison
  `BLOBS`, justifiée dans la fiche : il range la tuile en image. Il n’a que `runtime` : tout accès au stockage et
  aux alarmes passe par le fond.
- `carnet.js` : `traces` (identifiant, date, état, lecture mince, titre, porteurs ; jamais le site) et `frise`
  (l’ordre des tuiles, leurs clés d’image, leurs étiquettes, leurs mots posés), pour que l’onglet s’affiche sans
  charger ni le sens ni la 3D.
- `app.js` réindexé par identifiant de trace, et non par texte : `lus`, `cleLue`, l’élagage, « aller au bout »,
  l’étiquette.
- L’accord (`accord.html`, déjà prototypé), la politique de confidentialité, les textes de fiche, et **une
  première soumission** non répertoriée au Chrome Web Store, pour lancer l’examen : il prend de quelques jours à
  quelques semaines, et recommence à chaque version.
- Les essais : une journée simulée fait les tuiles attendues, dans l’ordre ; un brouillon repris trois fois ne fait
  qu’une tuile ; une tuile fermée garde la même image après trois arrivées, hors sa voisine de droite ; aucun texte
  brut ne subsiste après fermeture ; mot de passe, carte et recherche n’apparaissent nulle part ; aucune requête ne
  sort ; navigateur fermé à minuit, peinture interrompue, deux onglets ouverts.

**On voit :** on écrit dans trois pages d’essai, et, quelques minutes plus tard, une tuile peinte est au bout du chemin, dans la page ouverte depuis l’icône.

### Phase 2 : voir (6 à 9 jours)

- Le nouvel onglet : la frise en grand depuis l’index et les images rangées, sans sens ni 3D, en moins de
  150 ms même avec deux mille tuiles (mesuré par un essai) ; le curseur reste à la barre d’adresse ; le journal du
  jour plié sous la frise, « Écrire aujourd’hui » pour le déplier ; une tuile se touche au clavier aussi.
- L’arrivée : la nouveauté depuis le dernier regard se révèle au pinceau, une fois ; la voisine se remplace sans
  animation ; rien ne bouge s’il n’y a rien de neuf ; pas d’animation si le système demande moins de mouvement.
- La tuile ouverte en esquisse : la 3D seule, rendue par l’atelier en image, au bout du chemin. Elle ne change
  qu’au rythme des arrivées, jamais en direct : un voisin d’écran ne lit pas ce qu’on vient d’écrire.
- Toucher une tuile d’écrits dit son lieu et ses objets, pas ses mots. Les mots, seulement après un réglage explicite.
- Le rideau : une touche ou un clic vide l’onglet, dans l’esprit de « quitter vite ». La pause a deux sens, à
  choisir : ne plus lire, et ne plus montrer (onglet sobre, icône neutre, aucune arrivée), pour une réunion ou un
  partage d’écran.
- L’icône : fixe, avec un état de pause net. La tuile du jour en icône est une option : à seize pixels, une
  aquarelle est une tache, et Chrome range l’icône dans un menu tant qu’on ne l’épingle pas.
- Le premier jour : la tuile du départ livrée déjà peinte dans l’extension, et une phrase : « Écris comme
  d’habitude, ton chemin pousse derrière. » L’accord s’ouvre avant le premier nouvel onglet.
- L’importation unique des pages écrites sur le site : un export depuis le site, un import dans l’extension.

**On voit :** on ouvre un onglet, le chemin est là tout de suite ; on revient plus tard, ce qui a poussé se peint sous les yeux.

### Phase 3 : la confiance, puis l’essai (6 à 8 jours, plus l’examen des boutiques)

- Les réglages : pause, oublier ce site (ne plus le lire, et retirer ce qu’il a mis dans la tuile ouverte ; pour le
  passé, oublier ce jour), tout effacer, la place occupée, un écran de diagnostic sans aucun texte (version,
  compteurs), la liste de sites à cocher, prête, vide pour l’essai.
- Les textes des boutiques : l’onglet confidentialité du Chrome Web Store oblige à cocher les catégories traitées
  même en local (« communications personnelles », « contenu des sites »), formulées « gardé sur cet ordinateur
  seulement » ; la déclaration d’usage limité sur le site du chemin ; sur Firefox, `data_collection_permissions:
  none`, avec une note au relecteur ; le nouvel onglet présenté comme la fonction première, dans les deux fiches.
- Firefox : la signature par AMO, qui relit les règles et peut demander les sources ; `update_url` et un
  `updates.json` sur le site du chemin, sans quoi les testeurs ne recevraient jamais un correctif (c’est le
  navigateur qui interroge le site, sans rien dire de la personne : à écrire dans la politique) ; le paquet source
  reproductible de `vendor/three-chemin.min.js`, exigé pour tout code minifié, par un script de fabrication épinglé.
- La resoumission, puis l’essai (ci-dessous).

**On voit :** une personne invitée installe l’extension par un lien, lit l’accord, et son chemin pousse.

### Phase 4 : après l’essai, pour le public (à chiffrer alors)

- Les sites à cocher par défaut, proposés d’après une liste toute faite et les sites fréquents, et « ajouter ce
  site » d’un clic.
- L’anglais, détecté pour le dire (« le chemin ne lit que le français ») plutôt que peindre des tuiles vides ; le
  vélo absent du catalogue.
- Le panneau latéral, le paysage en fond de barre sur Firefox, les nuages lents et la lumière de l’heure.
- Des images plus légères pour les jours d’écrits, si la place le demande : à la dose de 14, une journée de bureau
  chargée fait une dizaine de tuiles de 230 Ko, soit jusqu’à un demi-gigaoctet par an.
- Éviter la seconde peinture à chaque arrivée, en déplaçant l’objet de raccord dans la nouvelle tuile.
- Safari, par une app sur l’App Store (6 à 10 jours).
- La sauvegarde connectée, scellée, sans un mot en clair.

## L’essai

- **Qui :** quelques personnes invitées, sur un profil de navigateur personnel, sans compte professionnel, pas de
  personne tenue au secret, pas de mineur. Elles savent que l’extension peut apparaître sur leurs autres
  ordinateurs reliés au même compte, et que la désinstaller efface tout.
- **Combien de temps :** trois à quatre semaines.
- **Les consignes :** écrire comme d’habitude, en français ; la pause au travail si l’employeur n’est pas d’accord ;
  oublier un site ou un jour quand on veut ; se retirer à tout moment.
- **Le retour :** sans aucune mesure dans l’extension, un formulaire ou une adresse sur le site, et l’écran de
  diagnostic que la personne recopie.
- **Ce qu’on regarde :** une tuile par jour actif chez la majorité ; aucune capture indue signalée ; le nouvel
  onglet gardé ; ce que les tuiles évoquent de la journée, de l’avis de la personne.

Avant l’essai, éprouver le glaneur site par site, avec des comptes de test : Gmail, Outlook, LinkedIn, WhatsApp
Web, Slack, Notion. Le prototype lit un éditeur qui n’émet aucun événement `input`, mais chaque éditeur a ses manières.

## Le coût

| Travail | Jours-personne |
| --- | --- |
| 0 · préparer | 3 |
| 1 · le socle | 9 à 12 |
| 2 · voir | 6 à 9 |
| 3 · la confiance | 6 à 8 |
| éprouver site par site | 4 à 6 |
| soutenir l’essai | 2 à 4 |
| **Total jusqu’à la fin de l’essai** | **30 à 42** |

À part de l’effort, le calendrier des boutiques : deux à quatre semaines d’examen, lancé dès la fin de la phase 1
avec une version provisoire, et recommencé à chaque version. Frais : quelques dollars une fois pour le Chrome Web
Store, rien pour Firefox et Edge ; Apple, 99 $ par an, seulement pour Safari.

## Ce que ce plan décide, au-delà de `CHOIX.md`

- Le filet d’aide ne tourne pas sur les écrits ambiants. « Parler à quelqu’un » reste dans le menu.
- D’une tuile d’écrits, il reste ses objets, son lieu, sa tonalité, et les mots qui ont appelé ses objets ; le texte
  est effacé à la fermeture. Le journal, lui, reste lisible. L’accord le dit avec ces mots. Aucun réglage ne garde
  le texte dans une version publiée.
- Les tuiles d’écrits ne disent jamais leur site, et le carnet ne garde pas les sites : ce serait un historique de
  navigation.
- Une tuile fermée est repeinte une fois, quand sa voisine arrive ; la graine d’une tuile vient de son identifiant.
- L’atelier est le seul peintre ; l’onglet n’affiche que des images.
- L’icône est fixe par défaut, la tuile du jour en option ; les sites fréquents sous la frise sont une permission
  optionnelle.
- Le nouvel onglet est la fonction première, dite dans l’accord et les fiches : refuser le nouvel onglet, sur Chrome
  comme sur Firefox, c’est désactiver l’extension.
- La lumière de l’heure et les nuages attendent la phase 4.

## Ce qui reste à trancher

1. **Tous les sites pour l’essai, ou une courte liste par défaut.** L’étude juridique place les écrits
   professionnels hors de l’exemption domestique. Le plan garde « tous les sites », avec la charte d’essai et les
   exclusions d’office ; une liste par défaut avec « ajouter ce site » coûterait environ un jour de plus.
2. Qui essaie, combien, sur quels navigateurs : à décider avant la phase 3.
3. Le nom dans les boutiques : « Le chemin », ou un nom à part.
