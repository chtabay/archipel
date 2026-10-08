# Les écrits du jour font pousser le chemin : les choix pris

Étude de faisabilité, octobre 2026. Ce que le porteur du projet a décidé au fil de l’échange, pour qu’on
s’en souvienne au moment de construire. Les essais et les mesures sont dans les dossiers voisins.

## L’intention

- Les écrits ordinaires de la journée (mails, messages, formulaires) font pousser le chemin **sans rien faire**,
  même si ce n’est qu’une partie des écrits.
- C’est pour **le public**, pour qui veut un chemin plutôt qu’un copilote au quotidien.
- Le journal écrit garde sa place ; les écrits du jour s’ajoutent à côté, et ne remplacent jamais la page du jour.

## La route : une extension de navigateur, sur ordinateur

- Une extension Manifest V3, Chrome et Firefox d’abord, Safari plus tard. Deux prototypes tournent
  (`navigateur/`, `extension/`) : capture au moment où l’écrit est posé, jamais les mots de passe, les cartes,
  les codes, les recherches, ce qui est collé ou cité ; aucune requête réseau.
- **Pour l’essai, tous les sites.** Des sites à cocher viendront ensuite, proposés d’après une liste toute faite,
  les sites les plus visités, et « ajouter ce site » d’un clic.
- Gmail se capte dans la page, au moment d’envoyer, plutôt que par l’API Gmail : pas de vérification Google.
- **Le chemin vit dans l’extension**, pas sur le site : le stockage du site est partagé par tout
  `chtabay.github.io`, et les règles de Firefox interdisent de transmettre les données à un site.
- Le téléphone ne capte rien : il regarde. Le passage de l’ordinateur au téléphone reste à trancher.

## Où et comment ça se voit

- **La frise dans chaque nouvel onglet**, en grand, sans champ de recherche (la barre d’adresse garde le
  curseur), avec les raccourcis des sites les plus visités dessous. La tuile du jour en icône de l’extension.
  Sur Firefox, le paysage du jour en fond de barre. Un panneau latéral à la demande. Pas de bandeau en haut des pages.
- **L’ajout d’une tuile est l’événement.** Elle arrive au bout du chemin, révélée au pinceau. On n’anime que la
  nouveauté ; le reste reste calme (nuages lents, lumière de l’heure).
- La tuile ouverte peut se montrer en esquisse (la 3D nette), et devient aquarelle à sa fermeture.
- Un délai de quelques minutes, un peu variable, entre l’écrit et son arrivée, pour qu’un voisin d’écran ne
  lise pas « il vient d’envoyer un mail ».

## La dose : 28 mots porteurs par tuile

- Les écrits du jour s’accumulent dans une tuile ouverte ; à **28 mots porteurs**, elle se ferme, se peint, et
  arrive. Une tuile fermée ne se repeint jamais. À minuit, la tuile ouverte se ferme, même incomplète.
- Mesuré sur les quatre journées inventées de `mesure/corpus/`, texte nettoyé :

  | Journée | mots à soi | tuiles à 14 | tuiles à 28 |
  | --- | --- | --- | --- |
  | bureau (Nadia) | 1 137 | 10 | 4 |
  | étudiant (Léo) | 480 | 3 | 2 |
  | retraitée (Monique) | 689 | 7 | 4 |
  | surtout en anglais (Sam) | 361 | 3 | 1 |

- Les tuiles du journal gardent leur étiquette, pour se distinguer des tuiles des écrits.

## Recommandations non encore tranchées

- Le filet d’aide (`aide()`) ne tourne pas sur les écrits ambiants : 14 phrases banales sur 16 l’ouvrent
  (`vie-privee/filet-ambiant.mjs`). « Parler à quelqu’un » reste toujours visible.
- Pour le public : des sites cochés plutôt que tous, et le texte brut effacé dès qu’il est lu.
- L’anglais, les noms propres et le vélo absent du catalogue sont à traiter avant le public (`mesure/RESULTATS.md`).
- Du poste au téléphone : un chemin par appareil, ou la lecture du jour portée par un code QR, sans réseau
  (`architecture/`).
