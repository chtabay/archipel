# Les boutiques : ce qu’il y a à coller

Tout ce qu’il faut pour déposer l’extension « Le chemin » sur le Chrome Web Store, sur addons.mozilla.org (Firefox) et sur
les modules complémentaires d’Edge : les textes, en français, prêts à copier, et la liste des pas. Vérifié sur les pages des
boutiques le 8 octobre 2026 ; les pages ouvertes sont à la fin. Ce qui n’a pas pu être vérifié est marqué « non vérifié ».

L’état : un essai. Les fiches sont cachées (Chrome : *Unlisted* ; Edge : *Hidden* ; Firefox : auto-distribuée) : on n’y
arrive que par le lien. La relecture, elle, est la même que pour une fiche publique.

## Avant de coller quoi que ce soit

- **Le résumé du manifeste** fait 128 caractères, dans la limite de 132 de Chrome ; c’est lui que la boutique affiche
  comme résumé (Edge aussi).
- **Le paquet** : `node chemin/extension/fabriquer.js`, puis un zip du *contenu* de `dist/` (le `manifest.json` à la racine
  du zip, pas dans un dossier). Environ 47 Mo. Chrome accepte jusqu’à 2 Go, Mozilla jusqu’à 200 Mo. Le même zip sert aux
  trois boutiques (Chrome et Edge ignorent `background.scripts`, Firefox ignore `background.service_worker`).
- **Les images** sont dans `chemin/extension/boutique/` : les trois captures en 1280×800, le logo 300×300 pour Edge,
  l’icône 64×64 pour Firefox ; l’icône 128×128 de Chrome est dans le manifeste (`icones/icone-128.png`).
- **La politique de confidentialité** : `chemin/extension/confidentialite.html`, servie à
  https://chtabay.github.io/archipel/chemin/extension/confidentialite.html. Vérifier qu’elle répond avant de soumettre :
  les trois boutiques demandent son adresse, et Google exige que la déclaration d’usage limité soit sur le site de
  l’extension, sur la page d’accueil ou à un clic d’elle : un lien « Confidentialité » depuis
  https://chtabay.github.io/archipel/chemin/ fera l’affaire.
- **La version** : 0.1.0 dans le manifeste. Chaque nouvel envoi doit porter un numéro plus grand.

## Les captures : lesquelles

Trois, dans cet ordre, en 1280×800 :

1. **Le chemin** : la frise en grand, et dessous, la page du jour avec un bloc marqué « écrit ailleurs ». C’est
   l’extension entière en une image.
2. **L’accord** : l’écran du oui, tel qu’il s’ouvre à l’installation, avec la liste des « jamais ». Les relecteurs y
   voient le consentement avant toute lecture.
3. **L’encart** : la frise, petite, au coin d’un moteur de recherche d’essai inventé (pas de marque à l’écran), sur une
   recherche anodine.

Une quatrième si on veut : les réglages (la pause, les sites exclus, les moteurs, « Tout effacer »). Pas de texte ajouté
sur les images ; ce qu’elles montrent se dit dans la description. Les mêmes trois servent à Edge (640×480 ou 1280×800,
six au plus) et à Firefox (1280×800 recommandé).

## Le résumé (132 caractères au plus)

À mettre dans `description` du manifeste ; Chrome et Edge le reprennent tel quel, et il sert aussi de résumé sur Firefox.

```
Ce que tu écris dans la journée fait pousser un chemin à l’aquarelle, d’un clic sur son icône. Rien ne part de cet ordinateur.
```

128 caractères, comptés.

## La description longue

Le même texte pour les trois boutiques. Edge demande entre 250 et 10 000 caractères ; Firefox accepte un peu de Markdown,
les autres du texte brut : coller tel quel.

```
Le chemin est un journal qui se peint tout seul. Chaque page devient un bout de chemin, à l’aquarelle, et le chemin s’allonge de jour en jour. L’extension l’ouvre d’un clic sur son icône, le montre au coin des sites que tu choisis, et y ajoute un glaneur : ce que tu écris toi-même dans la journée, un courriel, un message, une note, devient un bloc de plus dans la page du jour, et le chemin pousse. Sans rien faire.

Rien ne part de cet ordinateur. L’extension n’a pas de serveur, ne fait aucune requête vers l’extérieur, et ses règles de sécurité le lui interdisent. Tout reste dans ce navigateur, et « Tout effacer » efface tout, pour de bon.

Ce qu’elle lit : seulement ce que tu tapes toi-même dans les zones de texte des pages, et seulement après que tu as dit oui sur l’écran de l’accord, qui s’ouvre à l’installation. Elle ne suit pas les touches : elle compare la zone à l’entrée et à la sortie, et garde ce que tu as ajouté.

Ce qu’elle ne lit jamais : les mots de passe, les cartes bancaires, les codes reçus par SMS, les identifiants, les adresses, l’objet et les destinataires d’un courriel, ce que tu colles, ce que tu cites d’un autre. Rien en navigation privée. Rien sur les sites que tu exclus (d’office : les impôts, la santé). Les recherches, seulement sur les moteurs que tu choisis.

Ce que tu vois : le chemin, d’un clic sur l’icône ; sous la frise, la page du jour, où chaque écrit glané se relit, se modifie, s’efface. Sur les sites que tu choisis (les moteurs de recherche, d’office), un petit encart au coin de la page montre les dernières tuiles ; une croix le replie. Une pause, dans les réglages, arrête tout le temps qu’on veut.

C’est un essai, fait par une personne, pas une entreprise. Le code est public : https://github.com/chtabay/archipel, dossier chemin/extension. Le chemin existe aussi comme app, sur le téléphone : https://chtabay.github.io/archipel/chemin/ ; les deux ne se parlent pas, puisque rien ne part.
```

## Chrome Web Store

### L’onglet « Store listing » : la fiche

| Champ | À mettre |
| --- | --- |
| Nom | « Le chemin » (vient du manifeste) |
| Résumé | vient du manifeste : le résumé ci-dessus |
| Description détaillée | la description longue ci-dessus |
| Catégorie | « Well-being » (bien-être : aide à soi, pleine conscience, développement personnel). Sinon « Workflow & Planning ». La liste des catégories n’est pas dans la doc : à confirmer dans le tableau de bord (non vérifié) |
| Langue | Français |
| Icône | 128×128, PNG |
| Captures | les trois ci-dessus, 1280×800 (cinq au plus) |
| Petite vignette | 440×280, PNG ou JPEG : la doc la liste sans la dire facultative ; en prévoir une (la frise, recadrée) |
| Grande vignette | 1400×560, facultative : non |
| Vidéo | non |
| URL officielle | demande un site vérifié dans la Search Console de Google ; sinon, laisser vide |
| Page d’accueil | https://chtabay.github.io/archipel/chemin/ |
| URL d’assistance | https://github.com/chtabay/archipel/issues |
| Contenu pour adultes | non |

### L’onglet « Privacy » : les pratiques de confidentialité

**Finalité unique (*Single purpose description*)**

```
Tenir un journal du jour, peint à l’aquarelle, ouvert d’un clic sur l’icône : ce que la personne écrit elle-même dans les pages (courriels, messages, notes) devient des blocs de la page du jour, gardés dans le navigateur seulement, et le chemin s’allonge.
```

**La justification de chaque permission** (un champ par permission ; les permissions d’hôte ont leur propre champ,
« Host permission justification », dans le tableau de bord : non vérifié dans la doc, vu à l’usage)

`storage` :

```
Garder l’accord, la pause et les réglages (sites exclus, moteurs de recherche, sites de l’encart), et le fil de l’écrit en cours (une empreinte, pas le texte). storage.local seulement : rien n’est synchronisé.
```

`unlimitedStorage` :

```
Le journal garde ses pages et ses tuiles peintes (des images) dans IndexedDB ; sur des mois, cela dépasse le quota par défaut. Tout reste sur l’ordinateur.
```

`scripting` :

```
Brancher le script de lecture (scripting.registerContentScripts) seulement après que la personne a dit oui sur l’écran de l’accord, et le débrancher quand elle met l’extension en pause. Sans l’accord, aucun script n’est injecté.
```

Permissions d’hôte `<all_urls>` :

```
On écrit partout : un courriel, un message, une note, sur des sites que l’extension ne peut pas connaître d’avance. Elle lit uniquement ce que la personne tape elle-même dans les zones de texte, après l’accord ; jamais les mots de passe, cartes, codes, identifiants, ni ce qui est collé ou cité ; jamais en navigation privée ni sur les sites exclus. L’accès sert aussi à poser un petit encart (un iframe de l’extension) au coin des sites choisis. Aucune donnée ne quitte l’ordinateur : la CSP n’autorise que connect-src 'self'.
```

**Code distant (*Are you using remote code?*)** : « No, I am not using remote code ». Tout le code est dans le paquet,
three.js compris ; aucun script n’est chargé depuis le web, et la CSP (`script-src 'self' 'wasm-unsafe-eval'`) l’interdit.

**Les données (*Data usage*)**. Google demande de déclarer ce que l’extension traite même quand tout reste sur
l’appareil (FAQ n° 3 des données utilisateur). Le formulaire n’a que des cases, sans explication possible : la nuance
« gardé sur cet ordinateur seulement » est dans la politique et dans la description. À cocher :

- **Personal communications** (courriels, messages, discussions) : oui. L’extension lit ce que la personne écrit dans un
  courriel ou un message, et le garde dans son journal, gardé sur cet ordinateur seulement.
- **Website content** (texte, images, sons, vidéos, liens) : oui. Ce qui est lu est le texte des zones de saisie d’une
  page, gardé sur cet ordinateur seulement.
- Toutes les autres : non. Pas d’identité, de santé, de paiement, d’identifiants (les champs sensibles sont écartés avant
  lecture), pas de position, pas d’historique de navigation (les adresses des pages ne sont pas gardées), pas d’activité
  (aucune frappe, aucun clic, aucun mouvement de souris n’est suivi).

**Les trois certifications** : cocher les trois. Leur sens, d’après le formulaire de 2020 (le texte exact du jour est dans
le tableau de bord : non vérifié mot à mot) :

1. Je ne vends ni ne transfère les données des utilisateurs à des tiers, hors des cas d’usage approuvés.
2. Je n’utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec la finalité unique de
   l’extension.
3. Je n’utilise ni ne transfère les données des utilisateurs pour évaluer la solvabilité ou accorder des prêts.

**URL de la politique de confidentialité** : https://chtabay.github.io/archipel/chemin/extension/confidentialite.html.
La même adresse va aussi dans la page « Account » du tableau de bord : les deux doivent concorder.

### L’onglet « Distribution »

- **Visibilité** : *Unlisted* (non répertoriée) : pas de page dans la boutique, mais quiconque a le lien installe. Même
  relecture et mêmes règles que *Public*. On passera à *Public* plus tard sans rien resoumettre.
- **Régions** : toutes.
- **Paiement** : gratuit.
- **Commerçant ou non (DSA)** : déclarer **non-commerçant** (*Non-trader*). Google ne tranche pas à la place du
  développeur ; la définition européenne vise « une personne agissant à des fins qui n’entrent pas dans le cadre de son
  activité commerciale, industrielle, artisanale ou libérale ». Les visiteurs de l’Union voient alors que les droits des
  consommateurs ne s’appliquent pas au contrat. On peut changer plus tard (le statut de commerçant déclenche une
  vérification : nom légal, téléphone, adresse). L’endroit exact dans le tableau de bord n’est pas dans la doc (non
  vérifié) ; c’est dans les réglages du compte.

### L’onglet « Test instructions »

```
Pas de compte à créer, pas de serveur. 1) À l’installation, l’écran de l’accord s’ouvre : cliquer « Oui, lire ce que j’écris » (Chrome demande l’accès aux sites). 2) Sur duckduckgo.com ou qwant.com (moteurs choisis d’office), taper une recherche de deux mots ou plus, Entrée. Ou, sur n’importe quel site, écrire au moins quatre mots dans un champ de commentaire, puis cliquer ailleurs. 3) Cliquer sur l’icône de l’extension : le chemin s’ouvre ; sous la frise, la page du jour contient l’écrit, marqué « écrit ailleurs », et l’icône porte le nombre d’écrits du jour. 4) L’icône de l’extension ouvre l’accord et les réglages : la pause, les sites exclus, les moteurs, l’encart, « Tout effacer ». Aucune requête réseau : l’onglet Network des outils de développement reste vide, la CSP n’autorise que connect-src 'self'. Les modèles 3D (41 Mo, CC0) et les vecteurs de mots sont dans le paquet.
```

### Si le relecteur préfère l’anglais

Les mêmes champs, pour coller à la place des français si une relecture le demande.

```
Single purpose: A watercolour daily journal opened from the toolbar icon: what the person writes themselves in web pages (emails, messages, notes) becomes blocks of today’s page, kept in the browser only, and the path grows.

storage: Keeps the consent flag, the pause flag and the settings (excluded sites, search engines, sites with the inset), plus a fingerprint of the entry being written (not its text). storage.local only, nothing synced.

unlimitedStorage: The journal keeps its pages and painted tiles (images) in IndexedDB; over months this exceeds the default quota. Everything stays on the computer.

scripting: Registers the reading content script (scripting.registerContentScripts) only after the person clicks “yes” on the consent screen, and unregisters it when they pause the extension. Without consent, no script is injected.

Host permissions <all_urls>: People write everywhere, on sites the extension cannot know in advance. It reads only what the person types themselves in text fields, after consent; never passwords, cards, one-time codes, identifiers, pasted or quoted text; never in private browsing nor on excluded sites. The access is also used to place a small inset (an extension iframe) in the corner of chosen sites. No data leaves the computer: the CSP only allows connect-src 'self'.

Remote code: none. Data: personal communications and website content (the text the user types in page text fields), stored locally only, never transmitted. Privacy policy: https://chtabay.github.io/archipel/chemin/extension/confidentialite.html
```

## Firefox : addons.mozilla.org

### Répertoriée, ou auto-distribuée ?

**Pour l’essai : auto-distribuée** (*On your own*, dite aussi *unlisted*). Pourquoi :

- Firefox refuse une extension non signée (hors chargement temporaire dans `about:debugging`). Même pour trois
  personnes, on passe donc par addons.mozilla.org, qui signe le paquet.
- Auto-distribuée, l’extension est validée, puis signée ; on reçoit un courriel, on télécharge le `.xpi` signé, et on le
  donne soi-même, depuis le site. Pas de page publique à tenir, pas de catégories, pas de licence à choisir tout de suite.
  Les mises à jour passent par `update_url`, un fichier JSON sur le site.
- Répertoriée, l’extension a sa page sur addons.mozilla.org, qui distribue aussi les mises à jour ; elle est trouvable
  par tout le monde, et une relecture humaine peut venir à tout moment. C’est pour plus tard, quand les sites cochés et
  l’effacement du texte brut seront là (voir `chemin/faisabilite/CHOIX.md`, « pour le public »).
- Dans les deux cas : les mêmes règles, le même paquet de sources (voir plus bas), le même compte avec validation en
  deux étapes. Une fiche répertoriée peut aussi se marquer « expérimentale », ce qui la rend moins visible.

Un point à savoir : le validateur d’AMO refuse `update_url` dans une extension répertoriée (d’expérience ; non vérifié
sur une page officielle). Le manifeste le porte aujourd’hui, pour l’auto-distribution de l’essai ; le jour d’une fiche
répertoriée, on le retire.

### Le manifeste, côté Firefox

- `browser_specific_settings.gecko.id` : `chemin@chtabay.github.io`. Ne change jamais : c’est l’identité de l’extension.
- `strict_min_version` : `128.0` (il faut `matchOriginAsFallback` dans `registerContentScripts`).
- `data_collection_permissions.required: ["none"]` : obligatoire pour toute nouvelle extension depuis le 3 novembre
  2025 ; Firefox 140 et plus l’affiche à l’installation comme « cette extension ne collecte aucune donnée ». Chez
  Mozilla, « collecter » veut dire transmettre hors de l’appareil ; ce que l’extension garde dans son propre stockage n’en
  est pas (non vérifié mot à mot, c’est le sens de la doc). Les Firefox 128 à 139 ignorent la clé : l’écran de l’accord
  fait office de consentement, comme la règle 6.2 le demande.
- `incognito: "not_allowed"`, `chrome_url_overrides.newtab`, `web_accessible_resources` : pris en charge.
- `update_url` : déjà dans le manifeste, vers `https://chtabay.github.io/archipel/chemin/extension/updates.json`, servi
  en HTTPS par GitHub Pages. Le fichier `chemin/extension/updates.json` est dans le dépôt ; à chaque version, on y ajoute
  la nouvelle, avec le lien du `.xpi` signé, déposé dans la version « extension-essai » du dépôt GitHub
  (`https://github.com/chtabay/archipel/releases/download/extension-essai/chemin-0.1.0.xpi`).

Un lien GitHub sert le `.xpi` comme un fichier à enregistrer, pas à installer d’un clic : la personne l’enregistre, puis
`about:addons`, la roue dentée, « Installer un module depuis un fichier ». Les mises à jour, elles, se font toutes seules
par `update_url`.

### Le paquet de sources

Obligatoire ici, parce que `chemin/vendor/three-chemin.min.js` est minifié : three.js 0.186.1 réduit aux pièces
utilisées, avec GLTFLoader et le décodeur meshopt, assemblé par esbuild. La règle des bibliothèques tierces veut une
copie identique à la distribution officielle (les relecteurs comparent les sommes de contrôle) ; un assemblage à soi est
donc traité comme du code à soi, et doit se reconstruire à l’identique. À fournir, dans un zip à part :

- Le dépôt, sans `node_modules`, sans `dist`, avec `package-lock.json`.
- Un `LISEZMOI` pour le relecteur, avec le système et les versions (le relecteur part d’Ubuntu 24.04, Node 24.14.0,
  npm 11.9.0 ; dire si on a fait autrement), et toutes les commandes : `cd chemin/outils/three && npm ci`, puis
  `node chemin/outils/fabriquer-three.mjs`, qui refait `three-chemin.min.js` octet pour octet depuis `three@0.186.1` et
  `esbuild@0.28.2` (épinglés dans `chemin/outils/three/package-lock.json` ; le sha256 est dans `chemin/vendor/LISEZMOI.txt`),
  puis `node chemin/extension/fabriquer.js`. L’intégration continue vérifie la reproduction à chaque changement.
- Le résultat doit être identique octet pour octet au paquet soumis. Les outils doivent être libres, pas en ligne.
- Les 41 Mo de modèles 3D sont des données, pas du code ; leurs auteurs et licences (CC0) sont dans
  `chemin/objets/LISEZMOI.txt`, les vecteurs de fastText (CC BY-SA 3.0) dans `chemin/sens/`.

### Les notes au relecteur (*Notes for Reviewers*)

En français, puis la même chose en anglais, pour coller à la suite : les relecteurs d’AMO lisent surtout l’anglais.

```
Le chemin est un journal local : ce que la personne écrit elle-même dans les pages (courriels, messages, notes) devient des blocs de la page du jour, peinte à l’aquarelle dans le nouvel onglet. Tout reste dans le stockage de l’extension (IndexedDB, storage.local). Aucune requête vers l’extérieur : la CSP est connect-src 'self', et les seuls fetch du code chargent des fichiers de l’extension elle-même (les vecteurs de mots, le catalogue, les modèles 3D). Pas de compte, pas de serveur.

<all_urls> : on écrit partout, sur des sites inconnus d’avance. Le script de contenu (glaneur.js) n’est enregistré par scripting.registerContentScripts qu’après le oui sur l’écran de l’accord (accord.html, ouvert à l’installation), et désenregistré en pause. Il ne suit pas les touches : il compare la zone de texte à l’entrée et à la sortie. Il écarte les champs sensibles (autocomplete, noms de champs, formulaires avec mot de passe), l’objet et les destinataires d’un courriel, le texte collé ou cité, les boîtes de recherche hors des moteurs choisis, la navigation privée (incognito: not_allowed) et les sites exclus. Si la personne retire l’accès aux sites, l’icône porte « ! » et l’accord propose de le redonner.

'wasm-unsafe-eval' : la page du chemin peint des tuiles en 3D avec three.js (chemin/vendor/three-chemin.min.js, three.js 0.186.1 réduit aux modules utilisés, avec GLTFLoader et MeshoptDecoder, assemblé par esbuild). Le WebAssembly est le décodeur meshopt embarqué dans three.js, qui décompresse les modèles 3D du paquet (chemin/objets/, CC0). Rien n’est chargé depuis le web. Le paquet de sources joint reconstruit ce fichier et le paquet entier.

background : service_worker pour Chrome, scripts pour Firefox, dans le même manifeste. update_url : auto-distribution, le fichier de mises à jour est sur le site de l’extension, en HTTPS.

Pour essayer : installer, dire oui, taper une recherche de deux mots sur duckduckgo.com (moteur choisi d’office) et Entrée, ou quatre mots dans un champ de commentaire n’importe où ; cliquer sur l’icône : le bloc est dans la page du jour, marqué « écrit ailleurs ». L’icône ouvre les réglages et « Tout effacer ». Le code est public : https://github.com/chtabay/archipel, dossier chemin/extension. Politique : https://chtabay.github.io/archipel/chemin/extension/confidentialite.html
```

```
Le chemin is a local-only journal: what the person writes themselves in web pages (emails, messages, notes) becomes blocks of today’s page, painted as a watercolour path, opened from the toolbar icon. Everything stays in the extension’s own storage (IndexedDB, storage.local). No request ever leaves the computer: the CSP is connect-src 'self', and the only fetch calls in the code load the extension’s own files (word vectors, catalogue, 3D models). No account, no server.

<all_urls>: people write everywhere, on sites unknown in advance. The content script (glaneur.js) is registered with scripting.registerContentScripts only after the person clicks “yes” on the consent screen (accord.html, opened on install), and unregistered while paused. It does not log keystrokes: it compares the text field on focus in and focus out. It skips sensitive fields (autocomplete, field names, forms with a password field), email subject and recipients, pasted or quoted text, search boxes outside the chosen engines, private browsing (incognito: not_allowed) and excluded sites. If the person revokes site access, the badge shows “!” and the consent page offers to grant it again.

'wasm-unsafe-eval': the path page paints 3D tiles with three.js (chemin/vendor/three-chemin.min.js: three.js 0.186.1 reduced to the modules used, with GLTFLoader and MeshoptDecoder, bundled with esbuild). The WebAssembly is the meshopt decoder embedded in three.js, which decompresses the packaged 3D models (chemin/objets/, CC0). Nothing is loaded from the web. The attached source package rebuilds this file and the whole package.

background: service_worker for Chrome, scripts for Firefox, in the same manifest. update_url: self-distributed, the update manifest is on the extension’s site, over HTTPS.

To test: install, click yes, type a two-word search on duckduckgo.com (a default chosen engine) and press Enter, or four words in any comment field; click the toolbar icon: the block is in today’s page, marked “écrit ailleurs” (written elsewhere). The toolbar icon opens the settings and “Tout effacer” (erase everything). Source: https://github.com/chtabay/archipel, folder chemin/extension. Privacy policy: https://chtabay.github.io/archipel/chemin/extension/confidentialite.html
```

### La fiche, le jour où elle est répertoriée

| Champ | À mettre |
| --- | --- |
| Nom | Le chemin |
| Résumé (250 caractères au plus) | voir ci-dessous |
| Description | la description longue |
| Catégories (deux au plus) | « Other » ; la liste du jour n’a pas été vérifiée (non vérifié) |
| Expérimentale | oui, le temps de l’essai |
| Paiement requis | non |
| Courriel d’assistance | à choisir : AMO en veut un (au minimum, dit la doc) |
| Site d’assistance | https://github.com/chtabay/archipel/issues |
| Page d’accueil | https://chtabay.github.io/archipel/chemin/ |
| Licence | à choisir : le dépôt n’en déclare aucune, et AMO en exige une pour une fiche répertoriée |
| Politique de confidentialité | un champ texte, pas une adresse : coller le texte court ci-dessous, et l’adresse de la page |
| Icône | 64×64 et 32×32, PNG |
| Captures | les trois, 1280×800 |
| Plateformes | Windows, macOS, Linux |

Le résumé pour AMO :

```
Un journal qui se peint tout seul, d’un clic sur son icône. Ce que tu écris toi-même dans la journée, un courriel, un message, une note, devient un bloc de la page du jour, et le chemin s’allonge à l’aquarelle. Rien ne part de cet ordinateur.
```

La politique, en texte court, pour le champ d’AMO :

```
Le chemin ne collecte ni ne transmet rien. Après ton accord, et seulement alors, l’extension lit ce que tu tapes toi-même dans les zones de texte des pages, et le garde comme un bloc de la page du jour, dans le stockage de l’extension, sur cet ordinateur. Jamais : les mots de passe, les cartes, les codes, les identifiants, l’objet et les destinataires d’un courriel, ce que tu colles ou cites ; rien en navigation privée, rien sur les sites exclus ; les recherches seulement sur les moteurs choisis. Aucune requête vers l’extérieur, aucune statistique, aucune synchronisation. Un bloc se modifie et s’efface ; « Tout effacer » efface tout ; désinstaller supprime le stockage. La page entière : https://chtabay.github.io/archipel/chemin/extension/confidentialite.html
```

## Edge : les modules complémentaires

Le Partner Center de Microsoft suit le même plan que Chrome : mêmes textes, mêmes réponses.

- **Compte** : gratuit, dans Partner Center, avec un compte Microsoft (on peut se connecter avec son compte GitHub, qui en
  crée un). Type « Individual » ; le nom d’éditeur affiché (50 caractères au plus) doit être libre. La vérification d’un
  compte individuel se borne à ce nom.
- **Le paquet** : le même zip. Le nom et le résumé court viennent du manifeste (lecture seule dans la fiche).
- **Availability** : visibilité *Hidden* (on partage le lien) ; marchés : tous.
- **Properties** : catégorie « Productivity » ou « Entertainment » (liste non vérifiée) ; site :
  https://chtabay.github.io/archipel/chemin/ ; assistance : https://github.com/chtabay/archipel/issues ; contenu pour
  adultes : non.
- **Privacy** : la finalité unique, la justification de chaque permission, « No, I am not using remote code », les cases
  de données et les certifications : exactement les textes de la section Chrome. L’adresse de la politique :
  https://chtabay.github.io/archipel/chemin/extension/confidentialite.html.
- **Store listings**, pour la langue « Français » : la description longue (250 à 10 000 caractères), le logo 300×300
  (128×128 au minimum), les trois captures (640×480 ou 1280×800, six au plus), pas de vidéo, et les mots-clés (sept au
  plus, 30 caractères chacun, 21 mots en tout) : `journal`, `aquarelle`, `écriture`, `carnet`, `chemin`,
  `hors ligne`.
- **Notes for certification** (à la soumission) : les instructions d’essai de la section Chrome, mot pour mot.
- **La certification** prend jusqu’à sept jours ouvrés. Ensuite, le statut passe à *In the Store*.
- Une déclaration commerçant ou non pour l’Union européenne peut aussi être demandée dans Partner Center (non vérifié
  pour les extensions) : répondre « non ».

## La liste des pas

**Avant** : raccourcir `description` dans le manifeste ; exporter les icônes (128, 300, 64, 32) ; faire les trois
captures ; mettre en ligne `confidentialite.html` et un lien vers elle depuis la page du chemin ; fabriquer et zipper ;
écrire la recette esbuild de `three-chemin.min.js` et zipper les sources pour Mozilla.

**Chrome Web Store**

1. Un compte Google avec la validation en deux étapes : obligatoire avant toute publication ou mise à jour.
2. S’inscrire sur le tableau de bord développeur : des frais uniques, 5 $ US d’après des sources tierces ; la page
   officielle ne donne plus le montant (non vérifié). L’adresse du compte ne se change plus ensuite.
3. Le compte : le nom d’éditeur, l’adresse de la politique, la déclaration non-commerçant.
4. « Add new item », le zip ; puis les quatre onglets ci-dessus ; « Submit for review ». Un nouvel éditeur a droit à
   deux extensions.
5. La relecture : « quelques jours, jusqu’à quelques semaines » ; `<all_urls>` la rallonge. Au-delà de trois semaines,
   écrire au support. Une fois acceptée, on a 30 jours pour publier si on a choisi la publication différée.

**Firefox**

1. Un compte Mozilla avec la validation en deux étapes : obligatoire pour les développeurs depuis le 15 mars 2021.
   Garder les codes de secours : un compte perdu ne se récupère pas.
2. Le Developer Hub, « Submit a New Add-on », « On your own ». Le zip ; le validateur ; « oui » au paquet de sources, et le
   zip des sources ; les notes au relecteur.
3. Attendre le courriel de signature, télécharger le `.xpi` signé, le poser sur le site avec `mises-a-jour.json`.
4. Les délais : la signature d’une extension auto-distribuée est automatique après validation ; une relecture humaine
   peut venir à tout moment. Aucune durée officielle n’est publiée (non vérifié) ; les forums parlent de jours à semaines
   quand il y a beaucoup de dépôts.
5. Une mise à jour s’envoie depuis la page de l’extension sur AMO, jamais comme une nouvelle extension.

**Edge**

1. Partner Center, inscription au programme Edge : gratuit, compte individuel.
2. « Create new extension », le zip, puis Availability, Properties, Privacy, Store listings, et les notes de
   certification. « Publish ».
3. Jusqu’à sept jours ouvrés.

## Les pages ouvertes

Chrome Web Store :

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing : les champs de la fiche, les tailles (icône 128,
  captures 1280×800, vignettes 440×280 et 1400×560), la langue, les URL.
- https://developer.chrome.com/docs/extensions/reference/manifest/description : `description`, 132 caractères au plus.
- https://developer.chrome.com/docs/webstore/best-listing : le résumé à 132 caractères, les captures 1280×800 ou
  640×400, sans marge, cinq au plus.
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy : finalité unique, justification des permissions,
  code distant, cases de données et certifications, adresse de la politique.
- https://developer.chrome.com/docs/webstore/user_data et
  https://developer.chrome.com/docs/webstore/program-policies/user-data-faq : FAQ n° 3 (déclarer même ce qui reste sur
  l’appareil), n° 6 et 14 (la politique obligatoire), et la divulgation d’usage limité sur la page d’accueil ou à un clic.
- https://developer.chrome.com/docs/webstore/program-policies/limited-use : la formule « Chrome Web Store User Data
  Policy, including the Limited Use requirements », et les quatre règles.
- https://developer.chrome.com/docs/webstore/cws-dashboard-distribution : *Public*, *Unlisted*, *Private*, même relecture.
- https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure et
  https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq : commerçant ou non.
- https://developer.chrome.com/docs/webstore/program-policies/two-step-verification : la validation en deux étapes.
- https://developer.chrome.com/docs/webstore/register : les frais uniques (montant non indiqué), l’adresse du compte.
- https://developer.chrome.com/docs/webstore/publish : les onglets, la limite de deux extensions, les 30 jours.
- https://developer.chrome.com/docs/webstore/review-process : les délais, `<all_urls>`.
- Les catégories et le libellé des certifications viennent de recherches (9to5google, 18 novembre 2020 ;
  developer.chrome.com/webstore/best_practices) : à confirmer dans le tableau de bord.

Firefox :

- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/ : répertoriée ou auto-distribuée, les
  étapes, les champs, les notes au relecteur, la limite de 200 Mo.
- https://extensionworkshop.com/documentation/publish/self-distribution/ : la signature, `application/x-xpinstall`,
  `update_url`.
- https://extensionworkshop.com/documentation/manage/updating-your-extension/ : le format du fichier de mises à jour,
  HTTPS obligatoire.
- https://extensionworkshop.com/documentation/publish/source-code-submission/ : quand les sources sont dues, le
  LISEZMOI, l’environnement du relecteur.
- https://extensionworkshop.com/documentation/publish/third-party-library-usage/ : copie identique à la distribution
  officielle, sinon code à soi.
- https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ : `data_collection_permissions`,
  « none », le 3 novembre 2025, Firefox 140.
- https://extensionworkshop.com/documentation/publish/add-on-policies/ : consentement (6.2), code distant (4), code
  minifié et sources (3.1), navigation privée.
- https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/ : résumé à 250 caractères, captures
  1280×800, icône 32 et 64, deux catégories, courriel d’assistance.
- https://extensionworkshop.com/documentation/publish/what-does-review-rejection-mean-to-users/ : relecture humaine à
  tout moment.
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy :
  `'wasm-unsafe-eval'` permis en MV3.
- https://blog.mozilla.org/addons/2021/03/11/two-factor-authentication-required-for-extension-developers (par
  recherche) : la validation en deux étapes depuis le 15 mars 2021.

Edge :

- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension : les huit étapes, *Hidden*, la
  page Privacy, la description de 250 à 10 000 caractères, le logo 300×300, les captures, les mots-clés, les notes, sept
  jours ouvrés.
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account : gratuit, compte Microsoft
  ou GitHub, individuel ou société, nom d’éditeur.
- https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies : finalité unique (1.1.1),
  données personnelles et politique (1.5), permissions (1.6), notes de test (1.3).
