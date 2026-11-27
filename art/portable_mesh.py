"""CPU mesh authoring and glTF 2.0 export on workstations without a Metal device."""
import json
import math
import struct

COLORS={'porcelain':'F4F7FC','alloy':'C6D2E4','silk':'BEB6E4','lens':'91D5DD','graphite':'293244','ink':'101520','leather':'513831'}
meshes=[]
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(a):return tuple(x/max(1e-9,math.sqrt(dot(a,a))) for x in a)

def surface(name,rows,mat,wrap=True,cap=False):
    verts=[tuple(p) for r in rows for p in r];n=len(rows[0]);faces=[]
    for i in range(len(rows)-1):
        for j in range(n if wrap else n-1):
            a=i*n+j;b=i*n+(j+1)%n
            faces.extend([(a,a+n,b+n),(a,b+n,b)])
    if cap:
        for j in range(1,n-1):faces.extend([(0,j,j+1),(len(verts)-n,len(verts)-n+j+1,len(verts)-n+j)])
    mesh=(name,verts,faces,mat)
    meshes.append(mesh)
    return mesh

def ring(name,profile,mat,steps=72):
    return surface(name,[[(rx*math.cos(math.tau*i/steps),y,rz*math.sin(math.tau*i/steps)) for i in range(steps)] for y,rx,rz in profile],mat,cap=True)

def tube(name,points,thickness,mat,cyclic=False):
    count=len(points)
    def at(i):return points[i%count if cyclic else min(count-1,max(0,i))]
    centers=[]
    segments=(count if cyclic else count-1)*5
    for j in range(segments+1):
        i,t=divmod(j,5); t/=5
        a,b,c,d=[at(i+k) for k in (-1,0,1,2)]
        centers.append(tuple(.5*((2*q)+(-p+r)*t+(2*p-5*q+4*r-s)*t*t+(-p+3*q-3*r+s)*t**3) for p,q,r,s in zip(a,b,c,d)))
    rows=[];prior=None
    for j,p in enumerate(centers):
        tangent=unit(sub(centers[min(j+1,segments)],centers[max(0,j-1)]))
        if prior is None:prior=(0,0,1) if abs(tangent[2])<.92 else (1,0,0)
        u=unit(sub(prior,tuple(x*dot(tangent,prior) for x in tangent)));v=cross(u,tangent);prior=u
        rows.append([tuple(p[k]+thickness*(u[k]*math.cos(math.tau*i/10)+v[k]*math.sin(math.tau*i/10)) for k in range(3)) for i in range(10)])
    return surface(name,rows,mat,cap=not cyclic)

def block(name,pos,dims,bevel,mat):
    half=[d/2 for d in dims];r=min(bevel,min(half)*.92)
    for axis in range(3):
        u=(axis+1)%3;v=(axis+2)%3
        for sign in (-1,1):
            rows=[]
            def levels(h):return [-h,-h+r*.28,-h+r*.67,-h+r,0,h-r,h-r*.67,h-r*.28,h]
            for a in levels(half[u]):
                row=[]
                for b in levels(half[v]):
                    point=[0.,0.,0.];point[axis]=half[axis]*sign;point[u]=a;point[v]=b*sign
                    center=[max(-half[k]+r,min(half[k]-r,point[k])) for k in range(3)]
                    direction=unit(sub(point,center))
                    row.append(tuple(pos[k]+center[k]+r*direction[k] for k in range(3)))
                rows.append(row)
            surface(name,rows,mat,False)

def sphere(name,radius,mat):
    return ring(name,[(radius*math.sin(math.pi*(i/18-.5)),max(.0001,radius*math.cos(math.pi*(i/18-.5))),max(.0001,radius*math.cos(math.pi*(i/18-.5)))) for i in range(19)],mat,36)

def write_glb(path):
    data=bytearray();views=[];access=[];parts=[];nodes=[]
    def buffer(rows,kind,fmt,component,target,bounds=False):
        while len(data)%4:data.append(0)
        start=len(data); pack=struct.Struct('<'+fmt)
        for row in rows:data.extend(pack.pack(*row))
        idx=len(views);views.append({'buffer':0,'byteOffset':start,'byteLength':len(data)-start,'target':target})
        item={'bufferView':idx,'componentType':component,'count':len(rows),'type':kind}
        if bounds:item.update(min=list(map(min,zip(*rows))),max=list(map(max,zip(*rows))))
        access.append(item);return len(access)-1
    # Merge solid pieces of a material to reduce draw calls while keeping the stage rails addressable.
    clusters={}
    for name,verts,faces,material in meshes:
        key=(name.split('_')[0],material);vs,fs=clusters.setdefault(key,([],[]))
        offset=len(vs);vs.extend(verts);fs.extend([tuple(x+offset for x in f) for f in faces])
    for (name,material),(verts,faces) in clusters.items():
        norms=[[0,0,0] for _ in verts]
        for face in faces:
            a,b,c=[verts[i] for i in face];normal=cross(sub(b,a),sub(c,a))
            for i in face:
                for j in range(3):norms[i][j]+=normal[j]
        norm=[unit(n) for n in norms]
        attrs={'POSITION':buffer(verts,'VEC3','fff',5126,34962,True),'NORMAL':buffer(norm,'VEC3','fff',5126,34962)}
        idx=buffer([(i,) for f in faces for i in f],'SCALAR','H',5123,34963)
        nodes.append({'mesh':len(parts),'name':name+'_'+material})
        parts.append({'primitives':[{'attributes':attrs,'indices':idx,'material':list(COLORS).index(material)}]})
    materials=[{'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[(int(value[i:i+2],16)/255)**2.2 for i in (0,2,4)]+[1],'metallicFactor':.75 if name=='alloy' else .18,'roughnessFactor':.3 if name in ('lens','alloy') else .58}} for name,value in COLORS.items()]
    doc={'asset':{'version':'2.0','generator':'BELLO studio mesh tools'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':parts,'materials':materials,'accessors':access,'bufferViews':views,'buffers':[{'byteLength':len(data)}]}
    raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*(-len(raw)%4);data.extend(b'\0'*(-len(data)%4))
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(data))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(data),b'BIN\0')+data)
    meshes.clear()

