# Le chemin dans le navigateur : plan de construction de l’extension

Octobre 2026, deuxième version. La première chiffrait en jours-personne, pour un développeur qui partirait de
loin, et elle ignorait ce que le chemin a reçu dans la nuit du 7 au 8 : les blocs d’une page, chacun à son heure ;
la relecture d’une page en touchant sa tuile ; le chemin qui s’ouvre à sa fin et va au bout après un bloc de plus ;
la molette et la souris sur ordinateur. Tout cela est exactement la mécanique dont l’extension a besoin. Ce plan
s’appuie dessus, et compte en séances de travail comme celles qui ont fait le chemin, plutôt qu’en jours.

## L’idée : l’extension, c’est le chemin tel quel, plus un glaneur

- **Le chemin** s’affiche dans chaque nouvel onglet : la page `chemin/index.html` et ses fichiers, copiés dans
  l’extension, sans autre changement que la fabrication.
- **Un écrit glané est un bloc de plus dans la page du jour**, avec son heure, comme un bloc écrit à la main. Le
  carnet le range, `calculer()` redécoupe la page, le chemin va au bout, la tuile nouvelle se peint quand on
  regarde. La tuile est l’événement, et la dose de 14 porteurs est celle de `decouper()`. On ne construit ni file,
  ni tuile ouverte, ni atelier.
- **Le bloc glané se distingue** : une marque `glané` dans le bloc, que le carnet garde (une ligne), une icône et
  l’heure dans la page sous la frise. Il se modifie et s’efface comme les autres : « oublier cet écrit » existe déjà.
- **Le texte reste**, comme pour le journal : on relit ses écrits du jour en touchant une tuile. L’effacement du
  texte brut est un durcissement pour plus tard, si on le décide.

Ce que ça change par rapport à la première version : la dernière tuile du jour peut se redécouper quand un
écrit s’ajoute, et se repeindre, comme elle le fait déjà quand on ajoute un bloc à la main. Pour l’essai, c’est
acceptable ; la tuile qui se ferme pour de bon est dans « durcir plus tard ».

## Les pièces

| Pièce | Ce qu’elle fait | D’où elle vient |
| --- | --- | --- |
| `glaneur.js` | lit l’écrit posé, n’envoie que l’ajout, exclut le sensible, respecte la pause et les sites exclus | `navigateur/extension/glaneur.js` (33 vérifications), la pause de `extension/glaneur.js` |
| `fond.js` | reçoit l’écrit, ajoute un bloc à la page du jour avec `carnet.garderPage()`, prévient les onglets ouverts | nouveau, une cinquantaine de lignes ; `carnet.js` tourne tel quel dans un service worker |
| `accord.html` | l’accord à l’installation, la pause, les sites exclus, tout effacer | `navigateur/extension/accord.html`, `extension/popup.html` |
| `fabriquer.js` | copie le chemin et ce qu’il emprunte à l’archipel dans `dist/`, en gardant l’arborescence, et écrit le manifeste | nouveau, court |
| `tests/extension.js` | Chromium avec l’extension : on écrit dans des pages d’essai, le chemin a les blocs, rien de sensible, aucune requête | `extension/essai.js` (22 vérifications) et `navigateur/essai/essai.js` |

Le manifeste : `storage`, `unlimitedStorage`, `scripting`, l’accès à tous les sites pour l’essai,
`chrome_url_overrides.newtab`, `incognito: not_allowed`. Les règles de sécurité, vérifiées dans Chromium :
`script-src 'self' 'wasm-unsafe-eval'` (le décodeur des modèles est en WebAssembly ; sans lui, chaque tuile sort
sans objet, en silence), `connect-src 'self'`, `img-src 'self' blob: data:`, `object-src 'none'`. Les styles
écrits dans `index.html` passent dans `style.css`. L’extension pèse environ 47 Mo, dont 41 Mo d’objets 3D ; les boutiques acceptent bien plus.

## Les séances

### Séance 1 : ça marche sur un ordinateur

- `fabriquer.js`, le manifeste, le nouvel onglet qui ouvre le chemin.
- `fond.js` : un écrit reçu devient un bloc de la page du jour ; les onglets ouverts du chemin sont prévenus et
  vont au bout, comme après un bloc écrit à la main.
- `glaneur.js` repris du prototype, enregistré seulement après l’accord, retiré en pause.
- `accord.html` : ce qui est lu, ce qui ne l’est jamais, rien ne part ; sans oui, rien n’est lu.
- `tests/extension.js` dans la suite, avec la fabrication avant, et dans l’intégration continue.

**On voit :** on écrit dans Gmail, on ouvre un onglet, la journée a sa tuile de plus.

### Séance 2 : prêt à soumettre

- La pause, les sites exclus d’office (banque, santé, aide), la marque et l’heure des blocs glanés, tout effacer.
- Le premier jour : la tuile du départ et une phrase, « Écris comme d’habitude, ton chemin pousse derrière ».
  L’accord s’ouvre avant le premier nouvel onglet. Refuser le nouvel onglet, sur Chrome comme sur Firefox, c’est
  désactiver l’extension : l’accord et la fiche le disent, et le présentent comme la fonction première.
- Firefox, à la main : l’extension se charge, l’accord, une glane, aucune requête.
- Les textes : une politique de confidentialité courte sur le site du chemin, exigée même quand rien ne part ; la
  fiche ; les cases de l’onglet confidentialité du Chrome Web Store, formulées « gardé sur cet ordinateur
  seulement » ; sur Firefox, `data_collection_permissions: none`.
- La soumission : une fiche non répertoriée au Chrome Web Store, et la signature par AMO pour Firefox, avec
  `update_url` sur le site pour que les testeurs reçoivent les correctifs. L’examen prend de quelques jours à
  quelques semaines, recommence à chaque version, et s’applique aussi aux fiches non répertoriées.

**On voit :** l’extension est soumise ; en attendant, on l’essaie soi-même, chargée depuis le dossier.

### Séance 3 : les vrais sites, puis l’essai

- Pendant l’examen, tu écris comme d’habitude avec tes propres comptes : Gmail, Outlook, LinkedIn, WhatsApp Web,
  Slack. Tu notes ce qui n’est pas lu, ou lu de travers. Le prototype lit un éditeur qui n’émet aucun événement
  `input`, mais chaque éditeur a ses manières, et c’est le seul travail que je ne peux pas faire ici.
- Les corrections, la resoumission, puis l’essai : quelques personnes invitées, trois à quatre semaines, sur un
  profil personnel, sans compte professionnel ; un retour par formulaire ou courriel, jamais par l’extension.

**On voit :** une personne invitée installe l’extension par un lien, et son chemin pousse.

## Le calendrier

| | Travail | Attente |
| --- | --- | --- |
| Séances 1 et 2 | deux séances comme celle qui a fait le chemin, peut-être trois | |
| Examen des boutiques | | une à trois semaines, pendant lesquelles on l’essaie soi-même |
| Séance 3 et corrections | une séance, plus tes essais sur les vrais sites | |
| L’essai | | trois à quatre semaines |

Frais : quelques dollars une fois pour le Chrome Web Store, rien pour Firefox et Edge ; Apple, 99 $ par an, pour
Safari seulement, plus tard.

## Durcir plus tard, si l’essai le demande

Ce que la relecture critique de la première version a établi, et qu’on garde pour après :

- **La tuile qui se ferme.** Aujourd’hui la page du jour se redécoupe à chaque écrit, et sa dernière tuile peut
  se repeindre. Fermer les tuiles pour de bon demande une tuile ouverte à part, un découpage qui ne reprend que le
  dernier passage, et une graine de `planifier()` tirée de l’identifiant plutôt que du rang. Une tuile fermée se
  repeindrait encore une fois, quand sa voisine arrive : elles se raccordent sans couture.
- **L’arrivée différée** de quelques minutes, pour qu’un voisin d’écran ne lise pas « il vient d’envoyer un
  mail » ; et l’esquisse de la tuile en cours, qui ne changerait qu’à ce rythme.
- **Peindre hors écran** (document hors écran sur Chrome, vérifié : 11,3 s par tuile avec la 3D logicielle, sans
  limite de durée ; page de fond sur Firefox, à vérifier), pour que la tuile arrive déjà peinte.
- **Le texte brut effacé** après lecture : il ne resterait que les objets, le lieu, la tonalité et les mots qui ont
  appelé les objets. L’accord le dirait avec ces mots.
- **Le rideau** et la pause qui cache, pour une réunion ; toucher une tuile d’écrits sans dire ses mots.
- **Les sites à cocher** par défaut, avec « ajouter ce site » ; les sites fréquents sous la frise, en permission
  optionnelle ; la tuile du jour en icône, en option.
- **Le nettoyage** des écrits (signatures, adresses, noms propres : `mesure/nettoyer.mjs`), l’anglais détecté
  pour le dire, le vélo absent du catalogue.
- **Le paquet source** reproductible de `vendor/three-chemin.min.js`, qu’AMO demande pour tout code minifié.
- La sauvegarde connectée, scellée, sans un mot en clair ; Safari.

## Ce qui reste à trancher

1. Tous les sites pour l’essai, comme choisi, avec la charte des testeurs ; ou une courte liste par défaut.
2. Qui essaie, combien, sur quels navigateurs.
3. Le nom dans les boutiques : « Le chemin », ou un nom à part.
