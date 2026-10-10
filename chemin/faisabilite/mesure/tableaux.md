# Tableaux produits par mesure.mjs (2026-10-07, Node v22.22.0)

## Volumes et découpage (journée entière = une page)

| Mesure | Nadia (bureau) | Léo (étudiant) | Monique (retraitée) | Sam (surtout en anglais) |
| --- | --- | --- | --- | --- |
| Saisies du jour | 26 (4 recherche, 6 chat, 15 mail, 1 formulaire) | 15 (8 chat, 4 recherche, 1 document, 1 mail, 1 commentaire) | 8 (4 mail, 2 recherche, 2 forum) | 11 (5 chat, 4 mail, 2 recherche) |
| Caractères brut → nettoyé | 10660 → 6315 | 3239 → 2752 | 4305 → 3723 | 3920 → 2267 |
| Mots brut → nettoyé | 1756 → 1137 | 579 → 480 | 766 → 689 | 681 → 361 |
| Mots pleins connus du vocabulaire (nettoyé) | 91 % | 82 % | 87 % | 73 % |
| Mots porteurs (occurrences) brut → nettoyé | 187 → 143 | 58 → 51 | 111 → 102 | 45 → 41 |
| Porteurs distincts brut → nettoyé | 99 → 88 | 43 → 40 | 89 → 84 | 37 → 34 |
| Passages = tuiles (decouper) brut → nettoyé | 12 → 10 | 4 → 3 | 7 → 7 | 3 → 3 |
| decouper() sur la journée (ms) | 3.6 → 1.7 | 0.6 → 0.5 | 1 → 0.8 | 0.7 → 0.4 |
| Lecture d’un passage, lirePage+candidats (ms, médiane / p95) | 2.9 / 3.26 | 2.76 / 2.83 | 2.74 / 2.97 | 2.88 / 2.93 |
| Objets + lieu + plan, par tuile (ms) | 2.89 | 2.97 | 3.09 | 3.22 |
| À chaque ouverture : objets + lieu + plan, par tuile, lecture gardée (ms) | 0.07 | 0.08 | 0.09 | 0.04 |
| Lecture gardée par passage (octets JSON) | 5461 | 5863 | 5467 | 4991 |
| Journée qui grandit : passages relus/repeints au fil des saisies (pour N tuiles finales) | 47 (10) | 21 (3) | 11 (7) | 14 (3) |
| Mots tapés (nettoyés) par tuile | 114 | 160 | 98 | 120 |
| Tonalité du jour (valence / énergie → ciel) | 0.11 / 0.13 → clair | 0.27 / 0.1 → clair | 0.29 / 0.11 → clair | 0.3 / -0.03 → doré |
| Filet de sécurité déclenché (brut) | non | non | non | non |

## Stratégie (a), texte nettoyé : objets et lieu de chaque tuile

### Nadia (bureau)

| # | porteurs | lieu | ciel | objets choisis (mot → objet) | posés sur la tuile | début du passage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 14 | interieur | neutre | camion→camion, chaise→chaise, lampe→lampadaire, carton→carton, cuisine→évier | 5 | trafic périphérique nord lyon ce matin Salut , tu peux me confirmer le nombre de palettes |
| 2 | 14 | interieur | neutre | chaise→chaise, table→table, armoire→armoire, chêne→arbre, porte→palissade | 4 | Je suis vraiment désolée d'apprendre que la porte de votre armoire est arrivée rayée. Nous |
| 3 | 14 | interieur | doré | camion→camion, table→table, armoire→armoire, chaise→chaise, chêne→arbre, cuisine→cuisine | 5 | Sophie m'a transmis votre commande : la table ronde en chêne et ses six chaises. Je peux v |
| 4 | 14 | village | doré | gâteau→gâteau, fraise→fraise, fleur→fleur, verre→verre, cadeau→cadeau, poterie→jarre | 5 | Bon, qui s'occupe du gâteau ? Je peux passer chez le pâtissier jeudi midi fraisier ou forê |
| 5 | 14 | interieur | neutre | tabouret→tabouret, chaise→chaise, banc→banc, chêne→arbre | 4 | L'imprimante du deuxième étage affiche « bourrage papier » alors qu'il n'y a plus de feuil |
| 6 | 14 | interieur | gris | chat→animal, table→table | 2 | Pour les ans de maman le j'ai réservé au restaurant du port à , une table pour dix à midi. |
| 7 | 14 | interieur | neutre | bois→wagon, bâtiment→bâtiment, armoire→armoire, chêne→arbre, porte→palissade | 4 | Je te transmets la facture de pour septembre ( € ). Attention, la livraison du à est factu |
| 8 | 14 | interieur | neutre | tapis→tapis, canapé→salon, lampe→lampadaire, camion→benne, plante→plante, cuisine→placard | 5 | Pour la séance photo du catalogue jeudi, je peux faire préparer le canapé vert, les deux l |
| 9 | 14 | village | neutre | bouteille→bouteille, cadeau→cadeau, camion→camionnette, train→train | 3 | Élodie nous quitte après huit ans chez ! Nous fêterons son départ jeudi à dans la salle de |
| 10 | 14 | village | neutre | pain→pain, camion→camionnette, armoire→armoire | 3 | tu peux prendre du pain et des oeufs ? je fais une omelette ce soir Adam a foot à n'oublie |

### Léo (étudiant)

| # | porteurs | lieu | ciel | objets choisis (mot → objet) | posés sur la tuile | début du passage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 14 | interieur | doré | oignon→oignon, lait→lait, pain→pain, pizza→pizza, boulangerie→pain, sel→salière | 6 | qui a fini le lait ??? c'est pas moi jure le chat a encore vomi sur le canapé 😭 je passe  |
| 2 | 14 | interieur | doré | pain→pain, boulangerie→congélateur, train→train | 2 | Error t.test.formula : grouping factor exactly levels t'as groupes dans ta colonne, il fau |
| 3 | 14 | interieur | clair | pizza→pizza, gâteau→gâteau, poubelle→poubelle, fromage→fromage, chat→animal, carton→carton | 6 | pizza fromages ou reine ? les deux j'ai pris des bières et des chips qui sort la poubelle  |

### Monique (retraitée)

| # | porteurs | lieu | ciel | objets choisis (mot → objet) | posés sur la tuile | début du passage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 14 | rivage | doré | crêpes→crêpes, tomate→tomate, table→table, sable→rocher, orange→orange, bateau→barque | 5 | Je suis bien contente que vous veniez pour la , j'ai déjà préparé la chambre bleue pour le |
| 2 | 14 | interieur | neutre | gâteau→gâteau, chocolat→chocolat, boulangerie→pain, fauteuil→fauteuil, chat→animal | 5 |  Votre père aurait aimé ça. Le chat dort toute la journée sur le fauteuil près de la chemi |
| 3 | 14 | foret | doré | feuilles→herbe, figuier→arbre, abeille→animal, feuillage→plante, rose→fleur | 4 | Bonjour à tous, Depuis les pluies de septembre mes rosiers ont des taches noires sur les f |
| 4 | 14 | champs | doré | pot→pot, pomme→pomme | 1 | J'ai bien réfléchi depuis ton message de dimanche et je crois que tu as raison, il faut ve |
| 5 | 14 | village | doré | charrette→charrette, train→train, cuisine→cuisine | 3 |  Dans la grange il y a encore la charrette et l'établi de papa avec ses outils bien rangés |
| 6 | 14 | village | doré | anniversaire→gâteau, bateau→barque, crêpes→beignet | 2 | Joyeux anniversaire pour tes ans ! Ta maman m'a dit que tu rêvais d'un nouveau vélo, alors |
| 7 | 14 | foret | doré | fleur→fleur, café→café, pomme→pomme, feuilles→herbe, printemps→arbre, bois→wagon | 4 | Oui je serai de la sortie jeudi, rendez-vous à au parking du pont du pour la balade le lon |

### Sam (surtout en anglais)

| # | porteurs | lieu | ciel | objets choisis (mot → objet) | posés sur la tuile | début du passage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 14 | village | doré | — | 0 | morning ☕ coffee machine floor broken PR onboarding flow , love review before standup: qui |
| 2 | 14 | interieur | doré | gâteau→gâteau, évier→évier, citron→citron, fleur→fleur, table→table, cuisine→cuisine | 5 | Bonjour , le radiateur de la chambre ne chauffe plus depuis hier et il y a une petite fuit |
| 3 | 14 | interieur | doré | — | 0 | standup notes: , review, blocked copy empty basket state illustration team needs brief au |

## Bruit : chaque étape du nettoyage, seule, sur la journée brute

### Nadia (bureau)

| Variante | caractères | porteurs distincts | tuiles (a) | objets (a) | dont parasites | top 14 du jour : mots parasites | lieu (b) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| brut | 10660 | 99 | 12 | 52 | 2 (salon→salon, salon→table) | — | interieur |
| seule:citations | 9036 | 93 | 10 | 43 | 0 | — | interieur |
| seule:signatures | 8796 | 96 | 11 | 48 | 2 (salon→salon, salon→table) | — | interieur |
| seule:adresses | 9952 | 99 | 12 | 52 | 1 (salon→salon) | — | interieur |
| seule:code | 10566 | 99 | 12 | 52 | 2 (salon→salon, salon→table) | — | interieur |
| seule:nombres | 9856 | 99 | 12 | 52 | 2 (salon→salon, salon→table) | — | interieur |
| seule:propres | 9802 | 96 | 12 | 51 | 2 (salon→salon, salon→table) | — | interieur |
| seule:vides | 10640 | 98 | 12 | 52 | 2 (salon→salon, salon→table) | — | interieur |
| net | 6315 | 88 | 10 | 46 | 0 | — | interieur |

### Léo (étudiant)

| Variante | caractères | porteurs distincts | tuiles (a) | objets (a) | dont parasites | top 14 du jour : mots parasites | lieu (b) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| brut | 3239 | 43 | 4 | 18 | 2 (renne→renne, renne→sanglier) | renne, vanne | interieur |
| seule:citations | 3239 | 43 | 4 | 18 | 2 (renne→renne, renne→sanglier) | renne, vanne | interieur |
| seule:signatures | 3151 | 43 | 4 | 18 | 2 (renne→renne, renne→sanglier) | renne, vanne | interieur |
| seule:adresses | 3192 | 43 | 4 | 18 | 2 (renne→renne, renne→sanglier) | renne, vanne | interieur |
| seule:code | 3129 | 43 | 4 | 18 | 2 (renne→renne, renne→sanglier) | renne, vanne | interieur |
| seule:nombres | 3172 | 43 | 4 | 18 | 2 (renne→renne, renne→sanglier) | renne, vanne | interieur |
| seule:propres | 3161 | 41 | 3 | 14 | 0 | — | interieur |
| seule:vides | 3049 | 42 | 3 | 15 | 2 (renne→renne, renne→sanglier) | renne, vanne | interieur |
| net | 2752 | 40 | 3 | 15 | 0 | — | interieur |

### Monique (retraitée)

| Variante | caractères | porteurs distincts | tuiles (a) | objets (a) | dont parasites | top 14 du jour : mots parasites | lieu (b) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| brut | 4305 | 89 | 7 | 31 | 0 | — | champs |
| seule:citations | 4053 | 86 | 7 | 31 | 0 | — | champs |
| seule:signatures | 4221 | 87 | 7 | 31 | 0 | — | champs |
| seule:adresses | 4214 | 89 | 7 | 30 | 0 | — | champs |
| seule:code | 4305 | 89 | 7 | 31 | 0 | — | champs |
| seule:nombres | 4176 | 89 | 7 | 30 | 0 | — | champs |
| seule:propres | 4107 | 89 | 7 | 31 | 0 | — | champs |
| seule:vides | 4305 | 89 | 7 | 31 | 0 | — | champs |
| net | 3723 | 84 | 7 | 30 | 0 | — | champs |

### Sam (surtout en anglais)

| Variante | caractères | porteurs distincts | tuiles (a) | objets (a) | dont parasites | top 14 du jour : mots parasites | lieu (b) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| brut | 3920 | 37 | 3 | 6 | 0 | pull | interieur |
| seule:citations | 3635 | 36 | 3 | 6 | 0 | pull | interieur |
| seule:signatures | 3410 | 35 | 3 | 6 | 0 | pull | interieur |
| seule:adresses | 3786 | 35 | 3 | 6 | 0 | — | interieur |
| seule:code | 3779 | 37 | 3 | 6 | 0 | pull | interieur |
| seule:nombres | 3732 | 36 | 3 | 6 | 0 | — | interieur |
| seule:propres | 3681 | 36 | 3 | 6 | 0 | pull | interieur |
| seule:vides | 3083 | 37 | 3 | 6 | 0 | pull | interieur |
| net | 2267 | 34 | 3 | 6 | 0 | — | interieur |

## Essais ciblés : une phrase ordinaire, plus un seul type de bruit

Phrase de base : « Ce matin, un café sur le balcon, puis le marché sous la pluie avec mon fils. » → mots balcon, pluie, café, matin, marché, fils ; objets café→café, marché→marché ; lieu village

| Bruit ajouté | mots connus du vocabulaire | dont porteurs | mots ajoutés au top 14 | objets ajoutés | objets perdus | lieu |
| --- | --- | --- | --- | --- | --- | --- |
| lien (URL) | https www recherche category text pouces locations lyon | — | category pouce location www https lyon recherche text | — | — | village |
| adresses de courriel | marc dubois example yves orange example | orange | orange example dubois yves marc | orange→orange | — | village |
| nombres, dates, références | commande palettes | — | palettes commande | — | — | village |
| signature | cordialement nadia responsable logistique ardoise mobilier rue villeurbanne www example envoyé iphone | rue iphone | iphone example ardoise rue villeurbanne nadia logistique mobilier | — | — | village |
| mention légale | message pièces jointes confidentiels destinés exclusivement destinataires reçu message erreur merci détruire avertir | pièce | pièce jointes confidentiel destinataire avertir message détruire exclusivement | — | — | interieur |
| citation (réponse) | oct marc dubois marc dubois example écrit bonjour nadia camion tonnes tombé panne hier soir garage mercredi mieux marc dubois transports rhône express exploitation | écrit camion tonnes soir garage express | garage camion tonnes express soir dubois écrit example marc | camion→camion | — | village |
| code | const panier document cart for let items total items price return total | panier | panier item cart price let const return total | panier→panier | — | interieur |
| formule de tableur | stock faux | — | stock faux | — | — | village |
| phrase anglaise | think the meeting the office with the team and should really bring something for the party | office | office really bring should something think meeting party | — | — | village |
| clavardage | ouais grave lol | grave | grave lol ouais | — | — | village |

## Stratégies d’agrégation (texte nettoyé)

| Persona | Stratégie | tuiles/jour | objets/tuile | tuiles sans objet | tuiles ≤ 1 objet | objets distincts | moments évoqués (objets choisis) | moments évoqués (objets posés) | tuiles qui évoquent un moment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Nadia (bureau) | (a) tous les passages, texte brut | 12 | 4.33 | 0 | 0 | 46 | 6/10 | 6/10 | 12/12 |
| Nadia (bureau) | (a) tous les passages | 10 | 4.6 | 0 | 0 | 42 | 6/10 | 5/10 | 10/10 |
| Nadia (bureau) | (b) une tuile par jour | 1 | 6 | 0 | 0 | 6 | 3/10 | 3/10 | 1/1 |
| Nadia (bureau) | (c) au plus 3 tuiles, les plus riches | 3 | 6 | 0 | 0 | 18 | 4/10 | 4/10 | 3/3 |
| Nadia (bureau) | (e) au plus 3 tuiles, riches et variées | 3 | 6 | 0 | 0 | 18 | 4/10 | 4/10 | 3/3 |
| Nadia (bureau) | (d) une tuile par source (mail / web) | 2 | 6 | 0 | 0 | 12 | 3/10 | 3/10 | 2/2 |
| Léo (étudiant) | (a) tous les passages, texte brut | 4 | 4.5 | 0 | 0 | 18 | 4/10 | 4/10 | 4/4 |
| Léo (étudiant) | (a) tous les passages | 3 | 5 | 0 | 0 | 15 | 5/10 | 4/10 | 3/3 |
| Léo (étudiant) | (b) une tuile par jour | 1 | 6 | 0 | 0 | 6 | 4/10 | 4/10 | 1/1 |
| Léo (étudiant) | (c) au plus 3 tuiles, les plus riches | 3 | 5 | 0 | 0 | 15 | 5/10 | 4/10 | 3/3 |
| Léo (étudiant) | (e) au plus 3 tuiles, riches et variées | 3 | 5 | 0 | 0 | 15 | 5/10 | 4/10 | 3/3 |
| Léo (étudiant) | (d) une tuile par source (mail / web) | 2 | 4 | 0 | 0 | 8 | 4/10 | 4/10 | 2/2 |
| Monique (retraitée) | (a) tous les passages, texte brut | 7 | 4.43 | 0 | 0 | 31 | 8/10 | 8/10 | 7/7 |
| Monique (retraitée) | (a) tous les passages | 7 | 4.29 | 0 | 0 | 30 | 8/10 | 8/10 | 7/7 |
| Monique (retraitée) | (b) une tuile par jour | 1 | 5 | 0 | 0 | 5 | 3/10 | 1/10 | 1/1 |
| Monique (retraitée) | (c) au plus 3 tuiles, les plus riches | 3 | 5.67 | 0 | 0 | 17 | 7/10 | 6/10 | 3/3 |
| Monique (retraitée) | (e) au plus 3 tuiles, riches et variées | 3 | 5.67 | 0 | 0 | 17 | 7/10 | 6/10 | 3/3 |
| Monique (retraitée) | (d) une tuile par source (mail / web) | 2 | 5.5 | 0 | 0 | 11 | 4/10 | 1/10 | 2/2 |
| Sam (surtout en anglais) | (a) tous les passages, texte brut | 3 | 2 | 2 | 2 | 6 | 2/11 | 2/11 | 1/3 |
| Sam (surtout en anglais) | (a) tous les passages | 3 | 2 | 2 | 2 | 6 | 2/11 | 2/11 | 1/3 |
| Sam (surtout en anglais) | (b) une tuile par jour | 1 | 1 | 0 | 1 | 1 | 1/11 | 1/11 | 1/1 |
| Sam (surtout en anglais) | (c) au plus 3 tuiles, les plus riches | 3 | 2 | 2 | 2 | 6 | 2/11 | 2/11 | 1/3 |
| Sam (surtout en anglais) | (e) au plus 3 tuiles, riches et variées | 3 | 2 | 2 | 2 | 6 | 2/11 | 2/11 | 1/3 |
| Sam (surtout en anglais) | (d) une tuile par source (mail / web) | 2 | 2.5 | 0 | 1 | 5 | 3/11 | 3/11 | 2/2 |

### Les tuiles des stratégies (b), (c), (e) et (d)

- Nadia (bureau) (b) une tuile par jour : interieur, ciel clair ; camion→camion, chaise→chaise, armoire→armoire, table→table, chêne→arbre, lampe→lampadaire ; top 14 : armoire, chaise, livraison, camion, vélo, meuble, chêne, entrepôt, table, cadeau, lampe, pause, cuisine, matin
- Nadia (bureau) (c) au plus 3 tuiles, les plus riches #1 : interieur, ciel doré ; chaise→chaise, camion→camion, table→table, armoire→armoire, chêne→arbre, cuisine→évier
- Nadia (bureau) (c) au plus 3 tuiles, les plus riches #2 : village, ciel doré ; gâteau→gâteau, fraise→fraise, fleur→fleur, verre→verre, cadeau→cadeau, poterie→jarre
- Nadia (bureau) (c) au plus 3 tuiles, les plus riches #3 : interieur, ciel neutre ; tapis→tapis, camion→camion, canapé→salon, lampe→lampadaire, plante→plante, cuisine→cuisine
- Nadia (bureau) (e) au plus 3 tuiles, riches et variées #1 : interieur, ciel doré ; chaise→chaise, camion→camion, table→table, armoire→armoire, chêne→arbre, cuisine→évier
- Nadia (bureau) (e) au plus 3 tuiles, riches et variées #2 : village, ciel doré ; gâteau→gâteau, fraise→fraise, fleur→fleur, verre→verre, cadeau→cadeau, poterie→jarre
- Nadia (bureau) (e) au plus 3 tuiles, riches et variées #3 : interieur, ciel neutre ; tapis→tapis, camion→camion, canapé→salon, lampe→lampadaire, plante→plante, cuisine→cuisine
- Nadia (bureau) (d) une tuile par source (mail / web) #1 : village, ciel neutre ; gâteau→gâteau, camion→camion, chaise→chaise, fraise→fraise, armoire→armoire, poterie→jarre
- Nadia (bureau) (d) une tuile par source (mail / web) #2 : interieur, ciel doré ; camion→camion, chaise→chaise, armoire→armoire, table→table, tabouret→tabouret, chêne→arbre
- Léo (étudiant) (b) une tuile par jour : interieur, ciel clair ; pizza→pizza, pain→pain, oignon→oignon, boulangerie→pain, poubelle→poubelle, chat→animal ; top 14 : pizza, boulangerie, oignon, bière, pain, chat, ordi, pull, chips, canapé, poubelle, soir, dort, mangé
- Léo (étudiant) (c) au plus 3 tuiles, les plus riches #1 : interieur, ciel doré ; oignon→oignon, lait→lait, pain→pain, pizza→pizza, boulangerie→pain, sel→salière
- Léo (étudiant) (c) au plus 3 tuiles, les plus riches #2 : interieur, ciel doré ; pain→pain, boulangerie→congélateur, train→train
- Léo (étudiant) (c) au plus 3 tuiles, les plus riches #3 : interieur, ciel clair ; pizza→pizza, gâteau→gâteau, poubelle→poubelle, fromage→fromage, chat→animal, carton→carton
- Léo (étudiant) (e) au plus 3 tuiles, riches et variées #1 : interieur, ciel doré ; oignon→oignon, lait→lait, pain→pain, pizza→pizza, boulangerie→pain, sel→salière
- Léo (étudiant) (e) au plus 3 tuiles, riches et variées #2 : interieur, ciel doré ; pain→pain, boulangerie→congélateur, train→train
- Léo (étudiant) (e) au plus 3 tuiles, riches et variées #3 : interieur, ciel clair ; pizza→pizza, gâteau→gâteau, poubelle→poubelle, fromage→fromage, chat→animal, carton→carton
- Léo (étudiant) (d) une tuile par source (mail / web) #1 : interieur, ciel clair ; pizza→pizza, oignon→oignon, poubelle→poubelle, chat→animal, boulangerie→pain, canapé→salon
- Léo (étudiant) (d) une tuile par source (mail / web) #2 : interieur, ciel doré ; pain→pain, boulangerie→congélateur
- Monique (retraitée) (b) une tuile par jour : champs, ciel clair ; crêpes→crêpes, pomme→pomme, charrette→charrette, feuilles→herbe, figuier→arbre ; top 14 : maman, rosier, crêpes, embrasse, feuilles, pomme, jardin, ramasse, dahlia, bouillie, figuier, cake, charrette, tailler
- Monique (retraitée) (c) au plus 3 tuiles, les plus riches #1 : rivage, ciel doré ; crêpes→crêpes, tomate→tomate, table→table, sable→rocher, orange→orange, bateau→barque
- Monique (retraitée) (c) au plus 3 tuiles, les plus riches #2 : interieur, ciel neutre ; gâteau→gâteau, chocolat→chocolat, boulangerie→pain, fauteuil→fauteuil, chat→animal
- Monique (retraitée) (c) au plus 3 tuiles, les plus riches #3 : foret, ciel doré ; fleur→fleur, café→café, pomme→pomme, feuilles→herbe, printemps→arbre, bois→wagon
- Monique (retraitée) (e) au plus 3 tuiles, riches et variées #1 : rivage, ciel doré ; crêpes→crêpes, tomate→tomate, table→table, sable→rocher, orange→orange, bateau→barque
- Monique (retraitée) (e) au plus 3 tuiles, riches et variées #2 : interieur, ciel neutre ; gâteau→gâteau, chocolat→chocolat, boulangerie→pain, fauteuil→fauteuil, chat→animal
- Monique (retraitée) (e) au plus 3 tuiles, riches et variées #3 : foret, ciel doré ; fleur→fleur, café→café, pomme→pomme, feuilles→herbe, printemps→arbre, bois→wagon
- Monique (retraitée) (d) une tuile par source (mail / web) #1 : champs, ciel doré ; crêpes→crêpes, charrette→charrette, pomme→pomme, tomate→tomate, bateau→barque
- Monique (retraitée) (d) une tuile par source (mail / web) #2 : foret, ciel doré ; fleur→fleur, feuilles→herbe, abeille→animal, figuier→arbre, feuillage→plante, bouillie→céleri
- Sam (surtout en anglais) (b) une tuile par jour : interieur, ciel doré ; évier→évier ; top 14 : bike, shop, cat, illustration, évier, leaves, radiateur, pâtissier, shopping, big, coffee, phone, wine, chauffe
- Sam (surtout en anglais) (c) au plus 3 tuiles, les plus riches #1 : village, ciel doré ; aucun objet
- Sam (surtout en anglais) (c) au plus 3 tuiles, les plus riches #2 : interieur, ciel doré ; gâteau→gâteau, évier→évier, citron→citron, fleur→fleur, table→table, cuisine→cuisine
- Sam (surtout en anglais) (c) au plus 3 tuiles, les plus riches #3 : interieur, ciel doré ; aucun objet
- Sam (surtout en anglais) (e) au plus 3 tuiles, riches et variées #1 : village, ciel doré ; aucun objet
- Sam (surtout en anglais) (e) au plus 3 tuiles, riches et variées #2 : interieur, ciel doré ; gâteau→gâteau, évier→évier, citron→citron, fleur→fleur, table→table, cuisine→cuisine
- Sam (surtout en anglais) (e) au plus 3 tuiles, riches et variées #3 : interieur, ciel doré ; aucun objet
- Sam (surtout en anglais) (d) une tuile par source (mail / web) #1 : interieur, ciel doré ; évier→évier
- Sam (surtout en anglais) (d) une tuile par source (mail / web) #2 : interieur, ciel doré ; gâteau→gâteau, citron→citron, fleur→fleur, dog→hot-dog

## Stockage projeté par an

Taille d’une tuile : 226 Kio en WebP (Chrome, Firefox), 317 Kio en JPEG 0,9 (Safari, qui n’encode pas le WebP) ; source : peinture.json (mesuré).

| Persona (jours actifs/an) | Stratégie | tuiles/jour | tuiles/an | Mo/an WebP | Mo/an JPEG (iPhone) | Mo/an lectures | Mo/an pages |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nadia (bureau) (230) | a | 10 | 2300 | 507.6 | 712.3 | 12 | 2.8 |
| Nadia (bureau) (230) | b | 1 | 230 | 50.8 | 71.2 | 1.2 | 2.8 |
| Nadia (bureau) (230) | c | 3 | 690 | 152.3 | 213.7 | 3.6 | 2.8 |
| Nadia (bureau) (230) | e | 3 | 690 | 152.3 | 213.7 | 3.6 | 2.8 |
| Nadia (bureau) (230) | d | 2 | 460 | 101.5 | 142.5 | 2.4 | 2.8 |
| Léo (étudiant) (280) | a | 3 | 840 | 185.4 | 260.1 | 4.7 | 1.5 |
| Léo (étudiant) (280) | b | 1 | 280 | 61.8 | 86.7 | 1.6 | 1.5 |
| Léo (étudiant) (280) | c | 3 | 840 | 185.4 | 260.1 | 4.7 | 1.5 |
| Léo (étudiant) (280) | e | 3 | 840 | 185.4 | 260.1 | 4.7 | 1.5 |
| Léo (étudiant) (280) | d | 2 | 560 | 123.6 | 173.4 | 3.1 | 1.5 |
| Monique (retraitée) (200) | a | 7 | 1400 | 309 | 433.6 | 7.3 | 1.4 |
| Monique (retraitée) (200) | b | 1 | 200 | 44.1 | 61.9 | 1 | 1.4 |
| Monique (retraitée) (200) | c | 3 | 600 | 132.4 | 185.8 | 3.1 | 1.4 |
| Monique (retraitée) (200) | e | 3 | 600 | 132.4 | 185.8 | 3.1 | 1.4 |
| Monique (retraitée) (200) | d | 2 | 400 | 88.3 | 123.9 | 2.1 | 1.4 |
| Sam (surtout en anglais) (230) | a | 3 | 690 | 152.3 | 213.7 | 3.3 | 1 |
| Sam (surtout en anglais) (230) | b | 1 | 230 | 50.8 | 71.2 | 1.1 | 1 |
| Sam (surtout en anglais) (230) | c | 3 | 690 | 152.3 | 213.7 | 3.3 | 1 |
| Sam (surtout en anglais) (230) | e | 3 | 690 | 152.3 | 213.7 | 3.3 | 1 |
| Sam (surtout en anglais) (230) | d | 2 | 460 | 101.5 | 142.5 | 2.2 | 1 |
