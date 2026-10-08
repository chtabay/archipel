# Le chemin dans le navigateur : plan de construction de l’extension

Octobre 2026. Ce plan part des choix de `CHOIX.md` et des prototypes de ce dossier. Il décrit ce qu’on construit,
dans quel ordre, ce qu’on doit voir à chaque jalon, et ce que ça coûte. Les coûts sont en jours-personne, pour
quelqu’un qui connaît déjà le code du chemin.

## Ce qu’on construit

Une extension de navigateur, Chrome et Firefox d’abord, qui lit ce qu’on écrit soi-même dans les pages, au
moment où l’écrit est posé, et fait pousser un chemin qui vit dans l’extension. Rien ne part de l’ordinateur.

- **Le glaneur** lit les zones de texte de toutes les pages (pour l’essai), jamais les mots de passe, les
  cartes, les codes, les recherches, ce qui est collé ou cité. Il ne suit pas les touches : il lit la zone
  entière quand l’écrit est posé.
- **La tuile ouverte** accumule les écrits du jour. À 14 mots porteurs, elle se ferme, se lit, se peint, et
  arrive au bout du chemin, quelques minutes plus tard. Une tuile fermée ne bouge plus. À minuit, la tuile
  ouverte se ferme, même incomplète.
- **Le chemin** s’affiche dans chaque nouvel onglet, en grand, sans champ de recherche, avec les raccourcis des
  sites les plus visités dessous. La tuile du jour sert d’icône. Le journal écrit garde sa place sous la frise.
- **La promesse** reste celle du chemin : l’extension n’a aucun accès au réseau, et ses règles de sécurité
  (CSP) le lui interdisent.

Le téléphone ne reçoit rien pour le moment : un chemin par navigateur. La sauvegarde connectée viendra plus tard,
et pourra ne porter que les lectures et les images, scellées (`architecture/`).

## Les pièces, et d’où elles viennent

| Pièce | Rôle | Point de départ |
| --- | --- | --- |
| `glaneur.js` | script de contenu : lire l’écrit posé, exclure le sensible | `navigateur/extension/glaneur.js` (33 vérifications), plus la pause et la liste de sites de `extension/glaneur.js` |
| `fond.js` | service worker : recevoir les glanes, tenir la tuile ouverte, fermer, retarder l’arrivée, minuit | `navigateur/extension/fond.js`, à réécrire autour de la tuile ouverte |
| `atelier.html` | document hors écran (Chrome) ou page de fond (Firefox) : lire, planifier, peindre, ranger | nouveau ; reprend `sens.js`, `monde.js`, `aquarelle.js` tels quels |
| `onglet.html` | la page du nouvel onglet : la frise, l’arrivée, le journal plié, les raccourcis | `chemin/index.html` et `chemin/app.js`, adaptés |
| `accord.html` | l’écran d’accord à l’installation, et les réglages : pause, sites, oublier, tout effacer | `navigateur/extension/accord.html`, `extension/popup.html` |
| `carnet.js` | pages, traces (tuiles fermées), tuiles peintes, lectures, dans l’IndexedDB de l’extension | `chemin/carnet.js`, avec un magasin `traces` de plus |
| `sens.js`, `monde.js`, `aquarelle.js`, `contenu.js`, `outils.js`, `vendor/`, `sens/`, `objets/`, `catalogue.json` | le moteur, partagé avec le site | copiés tels quels par la fabrication |

Le code source vit dans `chemin/extension/`. Un script `fabriquer.js` assemble `chemin/extension/dist/` (ignoré par
git) à partir des fichiers du chemin et de l’archipel : une extension doit contenir tous ses fichiers. Les
objets 3D font 12 Mo et les vecteurs du sens 4 Mo : tout entre dans l’extension, et plus rien ne se charge en ligne.

## Comment ça marche, de l’écrit à la tuile

1. Dans la page, le glaneur voit un écrit posé : perte du focus après une modification, Entrée sur une ligne,
   clic sur « Envoyer », envoi du formulaire, fermeture de la page. Il garde la dernière version du champ, et
   envoie au fond `{ site, texte, quand }`. Rien de ce qui précède l’accord n’est pris.
2. Le fond ajoute l’écrit à la tuile ouverte du jour : `buffer += '\n\n' + texte`. Il découpe le buffer avec
   `decouper()` : tous les passages sauf le dernier sont fermés ; le dernier reste ouvert s’il a moins de
   14 porteurs. Un long mail peut fermer deux tuiles d’un coup.
3. Une tuile fermée part à l’atelier : `lirePage`, `candidats`, `objetsDeLaPage`, `lieuDeLaPage`, `climatDe`,
   `planifier`, dans l’ordre du jour, comme `calculer()` le fait aujourd’hui. Le texte brut de la tuile est
   alors effacé : il ne reste que sa lecture (les objets possibles avec leur mot, les champs, la tonalité) et
   son plan. C’est la règle proposée par défaut ; un réglage de développement garde le texte pour mettre au point.
4. L’atelier peint la tuile (3D puis aquarelle) et la range en image. Avec une carte graphique, quelques
   secondes ; sans, une dizaine.
5. Une alarme, entre deux et six minutes après la fermeture, déclenche l’arrivée : les onglets ouverts du chemin
   sont prévenus, la tuile apparaît au bout du chemin, révélée au pinceau. L’icône de l’extension prend la
   tuile du jour.
6. À minuit, une alarme ferme la tuile ouverte, même incomplète, pour que le jour garde sa place.

Dans la frise, un jour montre d’abord ses tuiles d’écrits, dans l’ordre de leur fermeture, puis les tuiles de sa
page de journal. Les tuiles d’écrits portent leur propre étiquette.

## Les phases

### Phase 0 : préparer (2 jours)

- Le dossier `chemin/extension/`, le script `fabriquer.js`, et un premier `manifest.json` avec les permissions
  voulues : `storage`, `unlimitedStorage`, `alarms`, `offscreen` (Chrome), `topSites`, l’accès à tous les sites
  pour l’essai, `chrome_url_overrides.newtab`, `incognito: not_allowed`, une CSP sans `connect-src`.
- Le banc d’essai : `tests/extension.js`, à partir de `navigateur/essai/essai.js`, dans Chromium avec
  l’extension chargée et la 3D logicielle, et une page d’essai qui imite Gmail, un formulaire, un mot de passe,
  une carte. Firefox se vérifie à la main avec `web-ext run`, faute de Firefox automatisable ici.
- Deux vérifications courtes, avant d’engager le reste : la durée de vie du document hors écran de Chrome
  pendant une peinture de dix secondes ; et les imports avec `?v=` dans une page d’extension.

**On voit :** l’extension se charge dans Chromium et Firefox, le banc d’essai tourne, le site du chemin ne change pas.

### Phase 1 : le socle, de l’écrit à la tuile (6 à 8 jours)

- `carnet.js` : le magasin `traces`, une tuile fermée par enregistrement (`id`, `date`, `fermee`, `lecture`,
  `plan`), et la tuile ouverte du jour, en texte, à part. Le reste du carnet ne change pas.
- `fond.js` : la file des glanes, la tuile ouverte, `decouper()` pour fermer, les alarmes d’arrivée et de
  minuit, la dernière version d’un champ, l’oubli d’un site ou d’un jour.
- `atelier.html` : lecture et plan dans l’ordre du jour, peinture, rangement. Quand une page du chemin est
  ouverte, c’est elle qui peint, comme aujourd’hui ; sinon l’atelier.
- `app.js` : `calculer()` parcourt les pages et les traces ; l’étiquette et la classe CSS des tuiles d’écrits ;
  « toucher une tuile » dit ses mots comme aujourd’hui, depuis la lecture.
- Les essais : une journée simulée fait les tuiles attendues ; mot de passe, carte et recherche n’apparaissent
  nulle part ; aucune requête ne sort ; après rechargement, rien ne se duplique ; minuit ferme.

**On voit :** on écrit dans trois pages d’essai, et, quelques minutes plus tard, une tuile peinte est au bout du chemin.

### Phase 2 : voir (5 à 7 jours)

- Le nouvel onglet : la frise en grand depuis les images rangées, ouverture immédiate, le curseur reste à la
  barre d’adresse, les raccourcis des sites les plus visités dessous (`topSites`), le journal du jour plié sous
  la frise, « Écrire aujourd’hui » pour le déplier.
- L’arrivée : la nouveauté depuis le dernier regard se révèle au pinceau, une fois, comme le trait de l’intro.
  Le reste reste calme. Si rien n’est nouveau, rien ne bouge.
- La tuile ouverte en esquisse : la 3D nette de ce qui s’y pose déjà, sans aquarelle, au bout du chemin.
- L’icône de l’extension : la tuile du jour, réduite, redessinée à chaque arrivée.
- Le premier jour : sans tuile encore, le départ et une phrase : « Écris comme d’habitude, ton chemin pousse derrière. »

**On voit :** on ouvre un onglet, le chemin est là tout de suite ; on revient plus tard, ce qui a poussé se peint sous les yeux.

### Phase 3 : la confiance, puis la publication (4 à 6 jours)

- L’accord à l’installation : ce qui est lu, ce qui ne l’est jamais, rien ne part. Pas d’accord, pas de glane.
- Les réglages : pause en un geste, état visible sur l’icône, oublier ce site, oublier ce jour, tout effacer
  (traces, tuiles, lectures). La liste de sites à cocher, prête mais vide pour l’essai : tous les sites.
- La navigation privée : jamais. L’extension s’y déclare interdite, et Firefox ne l’y active pas.
- La politique de confidentialité, courte, publiée sur le site du chemin, exigée par les boutiques même quand
  rien ne part. Sur Firefox, la déclaration `data_collection_permissions: none`.
- La publication pour l’essai : une fiche non répertoriée sur le Chrome Web Store, ouverte par lien ; une
  version auto-distribuée signée pour Firefox. Code public, sans minification, fabrication reproductible.
- Un délai à prévoir : l’examen du Chrome Web Store, plus long pour une extension qui lit tous les sites.

**On voit :** une personne invitée installe l’extension par un lien, lit l’accord, et son chemin pousse.

### Phase 4 : après l’essai, pour le public (à chiffrer alors)

- Les sites à cocher par défaut, proposés d’après une liste toute faite et les sites les plus visités, et
  « ajouter ce site » d’un clic.
- Le nettoyage des écrits : noms propres, signatures, citations, d’après `mesure/nettoyer.mjs`.
- L’anglais, et le vélo absent du catalogue.
- Le panneau latéral, le paysage en fond de barre sur Firefox, les nuages lents.
- Safari, par une app sur l’App Store (6 à 10 jours).
- La sauvegarde connectée, scellée, sans un mot en clair.

## Le coût

| Phase | Jours-personne |
| --- | --- |
| 0 · préparer | 2 |
| 1 · le socle | 6 à 8 |
| 2 · voir | 5 à 7 |
| 3 · la confiance, la publication | 4 à 6 |
| **Total pour l’essai** | **17 à 23** |

Frais : l’inscription au Chrome Web Store (unique, quelques dollars), rien pour Firefox et Edge ; Apple, 99 $
par an, seulement pour Safari.

## Ce qui n’entre pas, et ce qu’on vérifie en route

- **Hors de portée :** Google Docs, dessiné en image ; les visionneuses PDF ; les pages internes du navigateur ;
  les applications installées ; le téléphone.
- **À éprouver site par site :** les éditeurs riches de Gmail, Outlook, LinkedIn, WhatsApp Web, Slack, Notion.
  Le prototype lit un éditeur qui n’émet aucun événement `input`, mais chaque éditeur a ses manières.
- **Le nouvel onglet :** après l’installation, Chrome demande si on garde ce nouvel onglet. Le premier regard
  doit convaincre ; sinon la frise reste accessible par l’icône.
- **La peinture sans carte graphique :** une dizaine de secondes par tuile. Acceptable pour une arrivée
  différée ; à mesurer sur de vrais ordinateurs.
- **Le filet d’aide :** il ne tourne pas sur les écrits ambiants. « Parler à quelqu’un » reste dans le menu.
- **La sécurité de la publication :** envois vérifiés, clé matérielle, aucune dépendance, aucune clé de
  boutique dans l’intégration continue.

## Les choix qui restent à prendre

1. Le texte brut d’une tuile est effacé à sa fermeture : c’est le défaut proposé. Le garder, c’est pouvoir
   relire ; l’effacer, c’est ne rien laisser à voler.
2. Le journal dans le nouvel onglet : plié sous la frise, ou absent, le journal restant sur le site.
3. Le nom de l’extension dans les boutiques : « Le chemin », ou un nom à part.
4. Qui essaie : combien de personnes, et sur quels navigateurs.
