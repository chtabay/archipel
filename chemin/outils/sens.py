# Le chemin : les vecteurs du sens. Les vecteurs de mots fastText alignés, français et anglais, dans le même espace : les mots
# français les plus fréquents, réduits par une ACP et quantifiés sur un octet ; et le vecteur de chaque objet du catalogue,
# tiré de ses mots anglais. « vélo » et « bicycle » y sont voisins : le journal, en français, trouve les objets, nommés en anglais.
# Chaque objet a aussi ses noms français (francais.py) : son vecteur vient surtout d’eux, un peu de l’anglais.
# python3 chemin/outils/sens.py <wiki.fr.align.vec, ou son début> <wiki.en.align.vec, ou son début>
import os, sys, re, json, math
import numpy as np
ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.dirname(ICI)
sys.path.insert(0, ICI)
from francais import FR, NOMS as NOMS_FR, NUANCES_FR # les noms français des objets
N, D = 40000, 96
MOT_FR = re.compile(r"^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:-[a-zàâäçéèêëîïôöùûüÿœæ]+)*$")
# des mots composés de tous les jours, qu’un journal emploie : on les garde entiers, pour ne pas lire « nique » dans « pique-nique »
COMPOSES = '''pique-nique grand-mère grand-père grands-parents arc-en-ciel après-midi week-end petit-déjeuner chou-fleur belle-mère
beau-père belle-sœur beau-frère porte-monnaie sac-à-dos rez-de-chaussée garde-manger lave-vaisselle sèche-cheveux cerf-volant
pomme-de-terre pommes-de-terre tire-bouchon ouvre-boîte porte-clés casse-croûte grille-pain micro-ondes lave-linge
sèche-linge gratte-ciel hors-bord bouche-à-oreille chauve-souris coccinelle'''.split()
COQUILLES = {'advocado': 'avocado', 'musterd': 'mustard', 'chopstic': 'chopstick', 'rond': 'round', 'darkh': 'dark', 'frappe': 'frappuccino'}
# des mots d’étiquette trompeurs : leur sens le plus courant n’est pas l’objet. « can » est d’abord un verbe, « cup » une coupe
# sportive, « bush » un président, « cabinet » un gouvernement. Pour le calcul du sens, on les remplace par des mots sans détour.
SENS = {
  'can': ['canned', 'soda'], 'chinese': ['takeout', 'noodles'], 'van': ['minivan'], 'cup': ['mug', 'teacup'], 'rock': ['boulders'],
  'present': ['gift', 'gifts'], 'board': ['chopping'], 'race': ['racecar', 'racing'], 'table': ['table', 'dining'], 'fall': ['autumn'],
  'camp': ['campsite'], 'log': ['timber'], 'logs': ['timber'], 'sign': ['signboard'], 'sub': ['sandwich'], 'fox': ['foxes'],
  'row': ['rowboat'], 'fan': ['ventilator'], 'pan': ['saucepan', 'frying'], 'chair': ['armchair'], 'stool': ['armchair'],
  'cabinet': ['cupboard'], 'bush': ['shrubs'], 'hedge': ['shrubs'], 'ottoman': [], 'speaker': ['loudspeaker'], 'apple': ['apples'],
  'plate': ['dish'], 'coat': ['jacket'], 'sock': ['stocking'], 'delivery': ['truck'], 'hood': ['stove'], 'plateau': ['acacia'],
  'bullet': ['shinkansen'], 'ham': ['pork'], 'moss': ['mosses'], 'lily': ['lilies', 'pond'], 'basket': ['baskets'], 'mint': ['peppermint'],
  'sink': [], 'lantern': ['lanterns'], 'shelf': ['shelves'], 'signpost': ['crossroads'], 'stall': ['marketplace'], 'soda': ['lemonade'],
  'leafs': ['leaves'], 'chick': ['chicks'], 'patty': ['sausage'], 'microwave': ['oven'], 'roe': ['caviar'], 'pennant': ['flag'],
  'ribs': ['barbecue'], 'shaker': [], 'stump': ['stumps'], 'wreath': [], 'trashcan': ['garbage'], 'leek': ['leeks'], 'saucer': ['teacup'],
  'maki': ['sushi'], 'chest': ['treasure'], 'barrel': ['cask', 'keg'], 'mortar': ['pestle'], 'planter': ['pot'], 'tank': ['tanker'],
  'workbench': ['carpentry', 'workshop'], 'turkey': ['roast', 'poultry'], 'donut': ['doughnut'], 'tan': [], 'dim': [], 'sum': ['dumplings'],
  'rolling': [], 'pin': ['dough', 'baking'], 'in': [], 'built': [], 'upper': [], 'whole': [], 'packed': [], 'vision': [], 'group': [],
}
NOMS = {r'food-kit/hot-dog': ['sausage']} # des noms entiers qui trompent : « hot dog » n’est pas un chien
# les mots qui précisent sans nommer : couleurs, formes, états ; ils comptent peu, l’objet compte
NUANCES = set('''red green blue yellow purple white black orange pink brown dark colored thin fat curved diagonal broken damaged deep triangle
rectangle hanging crushed stacked stack speed luxury design fortified cross power head standing stand floor display future return block
medium frame blocks stick bend tender raw deluxe vintage rack crooked whipped cut hot male female sports'''.split())

def lire(chemin, garder, limite=None):
    mots, vecs = [], []
    with open(chemin, encoding='utf-8', errors='ignore') as f:
        next(f)
        for ligne in f:
            if not garder(ligne[:ligne.find(' ')]): continue # le mot d’abord : on ne lit son vecteur que s’il est voulu
            p = ligne.rstrip('\n').split(' ')
            if len(p) != 301: continue # la dernière ligne, coupée
            mots.append(p[0]); vecs.append(np.asarray(p[1:], dtype=np.float32))
            if limite and len(mots) >= limite: break
    return mots, np.vstack(vecs)

def main(fr, en):
    cat = json.load(open(os.path.join(ICI, 'catalogue-brut.json'), encoding='utf-8'))
    for o in cat: o['mots'] = [COQUILLES.get(m, m) for m in o['mots']]
    def sens_de(o): # les mots qui portent le sens de l’objet, chacun avec son poids d’origine
        for motif, mots in NOMS.items():
            if re.search(motif, o['id']): return [(m, [m]) for m in mots]
        return [(m, SENS.get(m, [m])) for m in o['mots']]
    voulus = {x for o in cat for _, l in sens_de(o) for x in l}
    def noms_de(o): # ses mots français
        for motif, mots in NOMS_FR.items():
            if re.search(motif, o['id']): return mots.split()
        sans = [m for m in o['mots'] if m not in FR]
        if sans: print('sans nom français :', o['id'], sans)
        return [x for m in o['mots'] for x in FR.get(m, '').split()]
    for o in cat: o['noms'] = list(dict.fromkeys(noms_de(o)))
    vus = set()
    def garder_fr(m):
        if m in vus or not MOT_FR.match(m) or len(m) < 2: return False
        vus.add(m); return True
    mots_fr, V = lire(fr, garder_fr, N)
    # les noms français, même rares : un mot composé absent compte par ses morceaux
    parts = lambda x: [y for y in re.split(r"[-’']", x) if len(y) > 2 and y not in ('des', 'les')]
    voulus_fr = {x for o in cat for n in o['noms'] for x in [n, *parts(n)]} | set(COMPOSES)
    noms_fr, NF = lire(fr, lambda m: m in voulus_fr)
    mots_en, E = lire(en, lambda m: m in voulus)
    print(len(mots_fr), 'mots français ;', len(mots_en), 'mots anglais sur', len(voulus))
    moyenne = V.mean(0); _, s, vt = np.linalg.svd(V - moyenne, full_matrices=False); P = vt[:D].T
    print(f'ACP : {D} axes gardent {(s[:D] ** 2).sum() / (s ** 2).sum():.0%} de la variance')
    def reduire(X): Y = (X - moyenne) @ P; return Y / np.maximum(np.linalg.norm(Y, axis=1, keepdims=True), 1e-6)
    Rf, Re, Rn = reduire(V), reduire(E), reduire(NF)
    nf_index = {m: i for i, m in enumerate(noms_fr)}
    def vec_fr(n): # le vecteur d’un nom français, ou de ses morceaux
        if n in nf_index: return Rn[nf_index[n]]
        l = [Rn[nf_index[y]] for y in parts(n) if y in nf_index]
        if not l: print('nom français inconnu :', n); return None
        u = sum(l); return u / max(np.linalg.norm(u), 1e-6)
    df_fr = {}
    for o in cat:
        for n in set(o['noms']): df_fr[n] = df_fr.get(n, 0) + 1
    q = lambda Y: np.clip(np.round(Y * 127), -127, 127).astype(np.int8)
    # les noms des objets entrent dans le vocabulaire, même rares : « brochette » ou « lampadaire » se retrouvent tels quels
    noms = {n for o in cat for n in o['noms']} | set(COMPOSES)
    connus = set(mots_fr); plus = [m for m in noms_fr if m not in connus and m in noms and MOT_FR.match(m)]
    mots_fr = mots_fr + plus; Rf = np.vstack([Rf, *(Rn[nf_index[m]][None] for m in plus)])
    print(len(plus), 'noms d’objets ajoutés au vocabulaire :', ' '.join(plus[:30]))
    open(os.path.join(RACINE, 'sens', 'mots.txt'), 'w', encoding='utf-8').write('\n'.join(mots_fr) + '\n')
    q(Rf).tofile(os.path.join(RACINE, 'sens', 'vecteurs.bin'))
    # chaque objet : la moyenne de ses mots, pondérés par leur rareté dans le catalogue
    en_index = {m: i for i, m in enumerate(mots_en)}; df = {}
    for o in cat:
        for m in set(o['mots']): df[m] = df.get(m, 0) + 1
    objets, vecs, sans = [], [], []
    for o in cat:
        v = np.zeros(D, np.float32)
        for m, l in sens_de(o):
            l = [x for x in l if x in en_index]
            if not l: continue
            u = sum(Re[en_index[x]] for x in l); u /= max(np.linalg.norm(u), 1e-6)
            v += math.log(len(cat) / df.get(m, 1)) * (.3 if m in NUANCES else 1) * u
        f = np.zeros(D, np.float32)
        for nom in o['noms']:
            u = vec_fr(nom)
            if u is not None: f += math.log(len(cat) / df_fr[nom]) * (.3 if nom in NUANCES_FR else 1) * u
        v, f = v / max(np.linalg.norm(v), 1e-6), f / max(np.linalg.norm(f), 1e-6)
        v = .7 * f + .3 * v # le français d’abord ; l’anglais confirme
        n = np.linalg.norm(v)
        if n < 1e-6: sans.append(o['id']); continue
        objets.append(o); vecs.append(v / n)
    q(np.vstack(vecs)).tofile(os.path.join(RACINE, 'sens', 'objets.bin'))
    images(q(Rf), q(np.vstack(vecs)))
    json.dump(objets, open(os.path.join(RACINE, 'catalogue.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(objets), 'objets avec un vecteur ;', len(sans), 'sans :', ' '.join(sans[:20]))
    return mots_fr, Rf, objets, np.vstack(vecs)

def images(Vq, Oq): # pour chaque mot, sa proximité au plus proche objet du catalogue, sur un octet : les mots porteurs d’images
    V, O = Vq.astype(np.float32) / 127, Oq.astype(np.float32) / 127
    best = np.concatenate([(V[i:i + 4000] @ O.T).max(1) for i in range(0, len(V), 4000)])
    np.round(np.clip(best, 0, 1) * 255).astype(np.uint8).tofile(os.path.join(RACINE, 'sens', 'images.bin'))
    print(f"mots porteurs d’images : {(best >= .5).sum()} à 0,5 ; {(best >= .55).sum()} à 0,55")

if __name__ == '__main__':
    mots, Rf, objets, O = main(sys.argv[1], sys.argv[2])
    idx = {m: i for i, m in enumerate(mots)}
    for m in 'vélo piano chat café pain pomme voiture bateau mer forêt arbre maison lit cuisine fleur chien plage tente feu neige noël gâteau train jardin livre ordinateur pluie amour travail fatigue'.split():
        if m not in idx: print(m, '?'); continue
        sc = O @ Rf[idx[m]]; top = np.argsort(-sc)[:4]
        print(f"{m:12s}", ' · '.join(f"{objets[i]['id'].split('/')[1]} {sc[i]:.2f}" for i in top))
