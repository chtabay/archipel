# Le chemin : convertir des modèles en GLB avec Blender, sans écran, un par fichier, animations comprises : .blend, .fbx,
# .obj, .dae (Collada). Les images perdues sont recherchées dans le paquet du modèle ; les matériaux que le format glTF ne
# lit pas sont ramenés au BSDF principal, avec leur image ; ni caméra, ni lumière, ni volume de collision.
# blender --background --python chemin/outils/blender-glb.py -- <liste.txt>
#   chaque ligne : source<TAB>destination[<TAB>dossier du paquet, où chercher les images]. Une destination déjà là est gardée.
import bpy, sys, os, re, traceback

def textures_dae(src): # l’importeur Collada laisse les images de côté : on les rebranche, d’après le fichier
    import xml.etree.ElementTree as ET
    ns = lambda t: t.split('}')[-1]
    racine = ET.parse(src).getroot(); par = {}
    for e in racine.iter():
        par.setdefault(ns(e.tag), []).append(e)
    images = {}
    for im in par.get('image', []):
        f = next((x.text for x in im.iter() if ns(x.tag) == 'init_from' and x.text), None)
        if f: images[im.get('id')] = os.path.basename(f.replace('\\', '/'))
    effets = {}
    for fx in par.get('effect', []):
        surf = {}; samp = {}
        for p in fx.iter():
            if ns(p.tag) != 'newparam': continue
            for x in p.iter():
                if ns(x.tag) == 'surface':
                    i = next((y.text for y in x.iter() if ns(y.tag) == 'init_from'), None)
                    if i: surf[p.get('sid')] = i
                if ns(x.tag) == 'sampler2D':
                    s2 = next((y.text for y in x.iter() if ns(y.tag) == 'source'), None)
                    if s2: samp[p.get('sid')] = s2
        for d in fx.iter():
            if ns(d.tag) == 'diffuse':
                t = next((y.get('texture') for y in d.iter() if ns(y.tag) == 'texture'), None)
                if t:
                    i = surf.get(samp.get(t, ''), t)
                    effets[fx.get('id')] = images.get(i, images.get(t))
    mats = {}
    for m in par.get('material', []):
        ie = next((x.get('url') for x in m.iter() if ns(x.tag) == 'instance_effect'), '')
        if effets.get(ie.lstrip('#')): mats[m.get('name') or m.get('id')] = effets[ie.lstrip('#')]; mats[m.get('id')] = effets[ie.lstrip('#')]
    dossier = os.path.dirname(src)
    for m in bpy.data.materials:
        f = mats.get(m.name) or mats.get(m.name.rsplit('.', 1)[0])
        if not f: continue
        noms = [f] + [os.path.splitext(f)[0] + e for e in ('.dds', '.DDS', '.png', '.jpg', '.tga')] # parfois rangée sous un autre format
        chemin = next((os.path.join(dossier, x) for x in noms if os.path.exists(os.path.join(dossier, x))), os.path.join(dossier, f))
        if not os.path.exists(chemin):
            for r, _, fs in os.walk(os.path.dirname(dossier)):
                x = next((x for x in noms if x in fs), None)
                if x: chemin = os.path.join(r, x); break
        if not os.path.exists(chemin): print('IMAGE MANQUANTE', f); continue
        nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(chemin)
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if chemin.lower().endswith(('.png', '.dds', '.tga')) and tex.image.channels == 4 and tex.image.depth >= 32:
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha']); m.blend_method = 'CLIP'
        bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)

def materiaux_simples(): # le format glTF ne lit que le BSDF principal : on y ramène les autres matériaux, avec leur image
    existe = lambda i: i and i.source == 'FILE' and (i.packed_file or os.path.exists(bpy.path.abspath(i.filepath)))
    images = [i for i in bpy.data.images if existe(i)]
    for m in bpy.data.materials:
        if not m.use_nodes: # un matériau à l’ancienne : sa couleur, et l’image du fichier s’il n’y en a qu’une
            m.use_nodes = True; nt = m.node_tree; bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if not bsdf: # un ancien arbre de nœuds, sans BSDF principal : on en met un, branché à la sortie
                bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
                sortie = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
                nt.links.new(bsdf.outputs['BSDF'], sortie.inputs['Surface'])
            bsdf.inputs['Base Color'].default_value = tuple(m.diffuse_color); bsdf.inputs['Roughness'].default_value = .8
            if len(images) == 1: tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = images[0]; nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
            continue
        nt = m.node_tree
        if any(n.type == 'BSDF_PRINCIPLED' for n in nt.nodes): continue
        tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and existe(n.image)), None)
        if not tex and len(images) == 1: tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = images[0]
        sortie = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.inputs['Roughness'].default_value = .8
        ancien = next((n for n in nt.nodes if n.type in ('BSDF_DIFFUSE', 'EMISSION')), None)
        if ancien and 'Color' in ancien.inputs: bsdf.inputs['Base Color'].default_value = ancien.inputs['Color'].default_value
        if tex: nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        nt.links.new(bsdf.outputs['BSDF'], sortie.inputs['Surface'])
liste = sys.argv[sys.argv.index('--') + 1]
for ligne in open(liste, encoding='utf-8'):
    if not ligne.strip(): continue
    src, dst, *paquet = ligne.rstrip('\n').split('\t')
    if os.path.exists(dst): continue
    try:
        ext = os.path.splitext(src)[1].lower()
        if ext == '.blend': bpy.ops.wm.open_mainfile(filepath=src)
        else:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
            elif ext == '.obj': bpy.ops.wm.obj_import(filepath=src)
            elif ext == '.dae':
                bpy.ops.wm.collada_import(filepath=src); textures_dae(src)
                for o in list(bpy.data.objects): # les volumes de collision et de visée, peints d’une couleur de repérage
                    mats = [m.name for m in getattr(o.data, 'materials', []) if m] if o.type == 'MESH' else []
                    if o.type == 'MESH' and (re.match(r'(?i)(col|los|bounds|collision)', o.name) or (mats and all(m.startswith('ColorEffect') for m in mats))):
                        bpy.data.objects.remove(o, do_unlink=True)
            else: raise ValueError(ext)
        racine = paquet[0] if paquet else os.path.dirname(os.path.dirname(src)) # les images, quelque part dans le paquet du modèle
        try: bpy.ops.file.find_missing_files(directory=racine)
        except Exception: pass
        materiaux_simples()
        for o in list(bpy.data.objects): # ni caméra, ni lumière
            if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=True, export_apply=False, export_yup=True, use_selection=False)
        print('OK', dst)
    except Exception:
        print('RATE', src); traceback.print_exc()
