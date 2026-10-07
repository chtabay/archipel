# Le chemin : le catalogue des objets. À partir des collections Kenney (CC0), dézippées dans un dossier : pour chaque modèle
# retenu, son libellé tiré de son nom, son rôle, les lieux où il se pose, sa taille réelle et le fichier copié dans objets/.
# python3 chemin/outils/catalogue.py <dossier des collections>
import os, sys, re, json, glob, shutil, struct
sys.path.insert(0, os.path.dirname(__file__))
from boites import boite

ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.dirname(ICI)
SOURCE = sys.argv[1] if len(sys.argv) > 1 else 'kits'

# chaque collection : son échelle vers des mètres, son rôle par défaut, ses lieux, ce qu’on écarte, et les exceptions par motif
KITS = {
  'furniture-kit': dict(echelle=1.95, role='objet', lieux=['interieur'], modules=r'^(wall|floor|doorway|stairs|paneling)'),
  'nature-kit': dict(echelle=3.5, role='decor', lieux=['foret', 'champs'], modules=r'^(cliff|ground|path|bridge|platform|crops_dirt)',
    roles={r'^(tent|campfire|canoe|bed|sign|statue|pot|log_stack)': 'objet', r'^fence': 'raccord'},
    lieux_par={r'palm|cactus|lily|canoe': ['rivage'], r'^crop': ['champs'], r'^(statue|pot)': ['champs', 'village']}),
  'city-kit-suburban': dict(echelle=8, role='batiment', lieux=['village'], modules=r'^(driveway|path)',
    roles={r'^tree': 'decor', r'^(fence|planter)': 'raccord'}),
  'city-kit-commercial': dict(echelle=8, role='batiment', lieux=['village'], modules=r'^(low-detail|detail-(awning|overhang))',
    roles={r'^detail-parasol': 'objet'}),
  'food-kit': dict(echelle=0.45, role='petit', lieux=['interieur', 'village'], exclus=r'knife|slicer|fork|spatula|chopstic|wrapper|bones|fries-empty|can-open|frikandel'),
  'car-kit': dict(echelle=1.3, role='objet', lieux=['village'], exclus=r'^(debris|wheel|box|cone)'),
  'watercraft-kit': dict(echelle=1.2, role='objet', lieux=['rivage'], exclus=r'^(arrow|gate|ramp|cargo)', roles={r'^buoy': 'raccord'}),
  'holiday-kit': dict(echelle=1.25, role='objet', lieux=['interieur', 'village', 'champs'], modules=r'^(cabin|floor)', saison='hiver'),
  'survival-kit': dict(echelle=3, role='objet', lieux=['foret', 'champs'], modules=r'^(floor|metal-panel|structure|patch|grass|resource)',
    exclus=r'axe|pickaxe|tool-hoe|hammer', roles={r'^(rock)': 'decor', r'^(fence|signpost)': 'raccord'}),
  'fantasy-town-kit': dict(echelle=1.9, role='objet', lieux=['village', 'champs'],
    modules=r'^(roof|wall|road|planks|pillar|poles|chimney|balcony|overhang|stairs|fountain-(corner|edge|curved|center)|hedge-(curved|large-curved)|blade|wheel)',
    roles={r'^(tree|rock)': 'decor', r'^(hedge|fence|lantern|banner)': 'raccord'}),
  'cube-pets': dict(echelle=0.5, role='animal', lieux=['champs', 'village', 'foret']),
  'mini-characters': dict(echelle=2.2, role='personne', lieux=['village', 'interieur', 'champs', 'foret', 'rivage'], exclus=r'defibrillator|mask'),
  'mini-market': dict(echelle=1.6, role='objet', lieux=['interieur'], modules=r'^(floor|wall|column|fence)', exclus=r'character'),
  'pirate-kit': dict(echelle=2.2, role='objet', lieux=['rivage'],
    modules=r'^(castle|structure|platform|tower|mast|patch|hole|grass)', exclus=r'cannon|flag-pirate|ship-ghost|ship-pirate|ship-wreck|tool-shovel',
    roles={r'^(palm|rocks)': 'decor', r'^flag': 'raccord'}),
  'train-kit': dict(echelle=1.4, role='objet', lieux=['village'], modules=r'^(railroad|spline|track|train-connector)'),
}
# les tailles réelles de quelques bêtes, en mètres de haut : les cubes sont tous pareils
BETES = {'cow': 1.5, 'elephant': 2.8, 'giraffe': 4, 'lion': 1.2, 'tiger': 1.1, 'deer': 1.4, 'panda': 1.2, 'polar': 1.4, 'hog': .9, 'pig': .9,
         'beaver': .5, 'bee': .3, 'bunny': .4, 'cat': .45, 'caterpillar': .25, 'chick': .3, 'crab': .3, 'dog': .65, 'fish': .4, 'fox': .55,
         'koala': .6, 'monkey': .8, 'parrot': .4, 'penguin': .7}
LIEUX_BETES = {r'cow|pig|hog|chick|bunny|bee|caterpillar': ['champs'], r'cat|dog': ['village', 'interieur', 'champs'], r'fish|crab|penguin': ['rivage'],
               r'deer|fox|beaver': ['foret'], r'elephant|giraffe|lion|tiger|monkey|panda|koala|polar|parrot': ['reve']}
EXCLUS = r'knife|sword|gun|pistol|rifle|bomb|skull|grave|coffin|tomb|weapon|spike|trap|syringe|pill|trainset|hanukkah|kwanzaa|festivus'  # jamais montrés
# quelques mots en plus, là où le nom ne dit pas l’essentiel : une maison n’y est qu’un « bâtiment », une pomme qu’une « apple »
SYNONYMES = {
  r'city-kit-suburban/building': ['house', 'home'], r'city-kit-commercial/building-[a-n]$': ['shop', 'store'], r'skyscraper': ['tower', 'office'],
  r'holiday-kit/(tree-decorated|present|wreath|sock|candy-cane|gingerbread|nutcracker|lights|reindeer|snowman|sled)': ['christmas'],
  r'mini-market/(cash|shelf|shopping|freezer|bottle)': ['shop', 'supermarket'], r'display-bread': ['bakery'], r'display-fruit': ['fruit', 'market'],
  r'food-kit/(apple|pear|banana|cherries|grapes|lemon|orange|pineapple|strawberry|watermelon|melon|peach|plum|coconut|avocado)': ['fruit'],
  r'food-kit/(carrot|broccoli|cabbage|corn|eggplant|tomato|onion|pepper|potato|pumpkin|radish|beet|cauliflower|celery|leek|mushroom)': ['vegetable'],
  r'(tent|bedroll)': ['camping'], r'campfire': ['fire', 'camp'], r'(shower|bathtub|toilet|bathroom)': ['bathroom'],
  r'subway': ['metro'], r'tram': ['tramway'], r'boat-sail': ['sailing'], r'animal-bunny': ['rabbit'], r'animal-hog': ['boar'], r'animal-polar': ['bear'],
  r'character-female': ['woman'], r'character-male': ['man'], r'(books|bookcase)': ['library', 'reading'],
}
VIDES = set('a b c d e f g h i j k l m n o p q r s t u v w x y z alt alternative detailed detail type large small short tall long low high wide narrow half quarter corner inner outer round rounded square left right center end top bottom side open closed double single new old upgraded flat straight stage ground default simple plain classic modern basic'.split())

def mots(nom):
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', nom); s = re.sub(r'[-_]', ' ', s)
    out = []
    for m in s.lower().split():
        m = re.sub(r'\d+$', '', m)
        if len(m) < 2 or m in VIDES or m.isdigit(): continue
        out.append(m)
    return out

def trouve(motifs, nom):
    for motif, v in (motifs or {}).items():
        if re.search(motif, nom): return v
    return None

def construire():
    objets, dest = [], os.path.join(RACINE, 'objets')
    if os.path.isdir(dest): shutil.rmtree(dest)
    for kit, K in KITS.items():
        fs = sorted(glob.glob(f'{SOURCE}/{kit}/**/*.glb', recursive=True))
        for f in fs:
            nom = os.path.basename(f)[:-4]
            if re.search(EXCLUS, nom, re.I) or (K.get('exclus') and re.search(K['exclus'], nom)): continue
            if K.get('modules') and re.search(K['modules'], nom): continue
            m = mots(nom)
            if not m: continue
            for motif, plus in SYNONYMES.items():
                if re.search(motif, f'{kit}/{nom}'): m = m + [x for x in plus if x not in m]
            role = trouve(K.get('roles'), nom) or K['role']
            lieux = trouve(K.get('lieux_par'), nom) or K['lieux']
            lo, hi = boite(f); taille = [round((hi[i] - lo[i]) * K['echelle'], 3) for i in range(3)]; base = round(lo[1] * K['echelle'], 3)
            if kit == 'cube-pets':
                bete = nom.replace('animal-', ''); h = BETES.get(bete, .6); k = h / max(hi[1] - lo[1], 1e-3)
                taille = [round((hi[i] - lo[i]) * k, 3) for i in range(3)]; base = round(lo[1] * k, 3); lieux = trouve(LIEUX_BETES, bete) or lieux
            if 'tree' in nom or 'palm' in nom: role = 'decor' if role != 'objet' else role
            saison = 'automne' if nom.endswith('_fall') else 'hiver' if K.get('saison') else None
            fichier = f'objets/{kit}/{nom}.glb'
            os.makedirs(os.path.join(dest, kit), exist_ok=True); shutil.copyfile(f, os.path.join(RACINE, fichier))
            tex = os.path.join(os.path.dirname(f), 'Textures')
            if os.path.isdir(tex) and not os.path.isdir(os.path.join(dest, kit, 'Textures')): shutil.copytree(tex, os.path.join(dest, kit, 'Textures')) # la palette de la collection, une seule fois
            o = dict(id=f'{kit}/{nom}', mots=m, role=role, lieux=lieux, taille=taille, base=base, fichier=fichier)
            if saison: o['saison'] = saison
            if K['echelle'] != 1: o['echelle'] = K['echelle'] if kit != 'cube-pets' else round(k, 4)
            objets.append(o)
    return objets

if __name__ == '__main__':
    objets = construire()
    json.dump(objets, open(os.path.join(ICI, 'catalogue-brut.json'), 'w'), ensure_ascii=False)
    from collections import Counter
    print(len(objets), 'objets', dict(Counter(o['role'] for o in objets)))
    print(dict(Counter(l for o in objets for l in o['lieux'])))
    taille = sum(os.path.getsize(os.path.join(RACINE, o['fichier'])) for o in objets); print(f'{taille / 1048576:.1f} Mo')
