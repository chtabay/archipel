# Le chemin : la boîte d’un modèle glb, avec les transformations de ses nœuds, sans rien charger d’autre que son en-tête JSON
import os, json, struct, glob, math, sys
def mat_trs(n):
    if 'matrix' in n: m=n['matrix']; return [[m[0],m[4],m[8],m[12]],[m[1],m[5],m[9],m[13]],[m[2],m[6],m[10],m[14]],[0,0,0,1]]
    t=n.get('translation',[0,0,0]); r=n.get('rotation',[0,0,0,1]); s=n.get('scale',[1,1,1])
    x,y,z,w=r
    R=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    return [[R[i][0]*s[0],R[i][1]*s[1],R[i][2]*s[2],t[i]] for i in range(3)]+[[0,0,0,1]]
def mul(a,b): return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def boite(f):
    d=open(f,'rb').read(); n=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+n])
    lo=[1e9]*3; hi=[-1e9]*3
    def visit(i,M):
        nd=j['nodes'][i]; M2=mul(M,mat_trs(nd))
        if 'mesh' in nd:
            for p in j['meshes'][nd['mesh']]['primitives']:
                a=j['accessors'][p['attributes']['POSITION']]; mn,mx=a['min'],a['max']
                for cx in (mn[0],mx[0]):
                    for cy in (mn[1],mx[1]):
                        for cz in (mn[2],mx[2]):
                            v=[sum(M2[r][c]*[cx,cy,cz,1][c] for c in range(4)) for r in range(3)]
                            for k in range(3): lo[k]=min(lo[k],v[k]); hi[k]=max(hi[k],v[k])
        for c in nd.get('children',[]): visit(c,M2)
    I=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
    for r in j['scenes'][j.get('scene',0)]['nodes']: visit(r,I)
    return lo,hi
