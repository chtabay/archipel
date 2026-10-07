# Le chemin : les vecteurs du sens. Les vecteurs de mots fastText alignés, français et anglais, dans le même espace : les mots
# français les plus fréquents, réduits par une ACP et quantifiés sur un octet ; et le vecteur de chaque objet du catalogue,
# tiré de ses mots anglais. « vélo » et « bicycle » y sont voisins : le journal, en français, trouve les objets, nommés en anglais.
# python3 chemin/outils/sens.py <wiki.fr.align.vec, ou son début> <wiki.en.align.vec, ou son début>
import os, sys, re, json, math
import numpy as np
ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.dirname(ICI)
N, D = 40000, 96
MOT_FR = re.compile(r"^[a-zàâäçéèêëîïôöùûüÿœæ]+(?:-[a-zàâäçéèêëîïôöùûüÿœæ]+)*$")
COQUILLES = {'advocado': 'avocado', 'musterd': 'mustard', 'chopstic': 'chopstick', 'rond': 'round', 'darkh': 'dark', 'frappe': 'frappuccino'}

def lire(chemin, garder, limite=None):
    mots, vecs = [], []
    with open(chemin, encoding='utf-8', errors='ignore') as f:
        next(f)
        for ligne in f:
            p = ligne.rstrip('\n').split(' ')
            if len(p) != 301: continue # la dernière ligne, coupée
            if not garder(p[0]): continue
            mots.append(p[0]); vecs.append(np.asarray(p[1:], dtype=np.float32))
            if limite and len(mots) >= limite: break
    return mots, np.vstack(vecs)

def main(fr, en):
    cat = json.load(open(os.path.join(ICI, 'catalogue-brut.json'), encoding='utf-8'))
    for o in cat: o['mots'] = [COQUILLES.get(m, m) for m in o['mots']]
    voulus = {m for o in cat for m in o['mots']}
    vus = set()
    def garder_fr(m):
        if m in vus or not MOT_FR.match(m) or len(m) < 2: return False
        vus.add(m); return True
    mots_fr, V = lire(fr, garder_fr, N)
    mots_en, E = lire(en, lambda m: m in voulus)
    print(len(mots_fr), 'mots français ;', len(mots_en), 'mots anglais sur', len(voulus))
    moyenne = V.mean(0); _, s, vt = np.linalg.svd(V - moyenne, full_matrices=False); P = vt[:D].T
    print(f'ACP : {D} axes gardent {(s[:D] ** 2).sum() / (s ** 2).sum():.0%} de la variance')
    def reduire(X): Y = (X - moyenne) @ P; return Y / np.maximum(np.linalg.norm(Y, axis=1, keepdims=True), 1e-6)
    Rf, Re = reduire(V), reduire(E)
    q = lambda Y: np.clip(np.round(Y * 127), -127, 127).astype(np.int8)
    open(os.path.join(RACINE, 'sens', 'mots.txt'), 'w', encoding='utf-8').write('\n'.join(mots_fr) + '\n')
    q(Rf).tofile(os.path.join(RACINE, 'sens', 'vecteurs.bin'))
    # chaque objet : la moyenne de ses mots, pondérés par leur rareté dans le catalogue
    en_index = {m: i for i, m in enumerate(mots_en)}; df = {}
    for o in cat:
        for m in set(o['mots']): df[m] = df.get(m, 0) + 1
    objets, vecs, sans = [], [], []
    for o in cat:
        v = np.zeros(D, np.float32)
        for m in o['mots']:
            if m in en_index: v += math.log(len(cat) / df[m]) * Re[en_index[m]]
        n = np.linalg.norm(v)
        if n < 1e-6: sans.append(o['id']); continue
        objets.append(o); vecs.append(v / n)
    q(np.vstack(vecs)).tofile(os.path.join(RACINE, 'sens', 'objets.bin'))
    json.dump(objets, open(os.path.join(RACINE, 'catalogue.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(objets), 'objets avec un vecteur ;', len(sans), 'sans :', ' '.join(sans[:20]))
    return mots_fr, Rf, objets, np.vstack(vecs)

if __name__ == '__main__':
    mots, Rf, objets, O = main(sys.argv[1], sys.argv[2])
    idx = {m: i for i, m in enumerate(mots)}
    for m in 'vélo piano chat café pain pomme voiture bateau mer forêt arbre maison lit cuisine fleur chien plage tente feu neige noël gâteau train jardin livre ordinateur pluie amour travail fatigue'.split():
        if m not in idx: print(m, '?'); continue
        sc = O @ Rf[idx[m]]; top = np.argsort(-sc)[:4]
        print(f"{m:12s}", ' · '.join(f"{objets[i]['id'].split('/')[1]} {sc[i]:.2f}" for i in top))
