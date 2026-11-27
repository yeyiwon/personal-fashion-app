"""Author the BELLO stage and six small-scale objects. Blender 5.2, glTF Y-up, units in metres."""
import math
from pathlib import Path

TAU = 2 * math.pi
OUT = Path(__file__).resolve().parents[1] / 'public/media/bello'
OUT.mkdir(exist_ok=True, parents=True)
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
try:
    import bpy
except ImportError:
    from portable_mesh import surface,ring,tube,block,sphere,write_glb
    def export(name):write_glb(OUT/name)
else:
    from blender_mesh import surface,ring,tube,block,sphere,export

# An offset catwalk crosses the room at an angle. Its rolled leading edge wraps
# beneath the floor instead of enclosing the wearer on a pedestal.
for k,material in enumerate(['porcelain','alloy','lens']):
    rows=[]
    for j in range(53):
        t=j/52; x=-2.65+5.3*t
        center=.16*math.sin(t*5.1-1.2)-.30*x
        depth=.52+.16*math.sin(t*3.2)
        profile=[(-1,-.024),(-.72,-.013),(.36,-.008),(.89,-.012),(1,-.028)]
        if k==1: profile=[(1,-.028),(1.017,-.035),(1.019,-.072),(1.003,-.089),(.985,-.093)]
        if k==2: profile=[(1.021,-.056),(1.024,-.060),(1.021,-.065)]
        rows.append([(x,y,center+d*depth) for d,y in profile])
    surface('Runway_'+str(k),rows,material,False)
# Broad ruled surfaces twist between the gallery wall and the overhead skylight.
for side, count in [(-1,4),(1,3)]:
    for k in range(count):
        rows = []
        for j in range(37):
            t=j/36
            y = -.26 + 3.55*t
            x = side*(.94 + .14*k + .34*math.sin(t*math.pi) + .24*t + .21*math.cos(t*TAU+.45*k))
            z = -.57 - .22*k + .26*math.sin(t*TAU + .66*k)
            cross = []
            angle = -.6 + 1.75*t + .21*k
            for i in range(16):
                a=TAU*i/16
                wide=.24*math.cos(a)
                thin=.042*math.sin(a)
                cross.append((x+side*(wide*math.cos(angle)-thin*math.sin(angle)),y,z+wide*math.sin(angle)+thin*math.cos(angle)))
            rows.append(cross)
        surface(('Wing_L_' if side<0 else 'Wing_R_') + str(k), rows,
                'lens' if k == 1 else 'alloy' if k==2 else 'porcelain', cap=True)
# Recessed gallery portal, open at floor level. Two rails lean toward different
# vanishing points. The horizon remains visible through the opening.
for k in range(2):
    tube('Mirror_Bezel_'+str(k),[
        (-1.07-.07*k,-.19,-.8),(-1.04-.065*k,.68,-.98),(-.95-.06*k,1.64,-1.17),
        (-.72-.04*k,2.26,-1.26),(-.25,2.59+.035*k,-1.31),(.36,2.71+.04*k,-1.24),
        (.83+.05*k,2.64+.032*k,-1.08),(1.01+.06*k,2.43,-.91),(1.16+.06*k,2.08,-.82)
    ],.020 if not k else .008,'alloy' if not k else 'lens')
export('studio.glb')


def garment(name, material, shape, z=0):
    rows=[]
    for j,(y,rx,rz,center) in enumerate(shape):
        row=[]
        for i in range(48):
            a=TAU*i/48
            pleat=1+.042*math.sin(8*a+.41*j)+.018*math.cos(13*a-.23*j)
            row.append((center+rx*math.cos(a)*pleat,y+.018*math.sin(4*a+j*.1),z+rz*math.sin(a)*pleat))
        rows.append(row)
    return surface(name,rows,material,cap=True)


def collar(side):
    return surface('Wardrobe_Lapel', [[(x*side,y,z) for x,y,z in row] for row in [
        [(.04,.57,.07),(.13,.56,.055),(.24,.48,.055)],
        [(.072,.39,.17),(.17,.42,.15),(.265,.38,.14)],
        [(.11,.18,.195),(.12,.29,.18),(.20,.34,.159)]
    ]], 'silk', False)


# 1. A short, darted jacket on a bent-metal hanger.
garment('Wardrobe_Body','graphite',[(-.40,.34,.17,0),(-.34,.355,.163,0),(-.01,.30,.17,0),(.23,.35,.195,0),(.43,.385,.14,0),(.54,.21,.108,0),(.56,.15,.09,0)])
for side in [-1,1]:
    garment('Wardrobe_Sleeve','graphite',[(-.34,.088,.108,.45*side),(-.28,.112,.12,.44*side),(.05,.121,.139,.40*side),(.34,.13,.132,.34*side),(.43,.095,.09,.30*side)])
    collar(side)
tube('Wardrobe_Hook',[(0,.51,0),(0,.64,0),(.055,.7,0),(.015,.775,0),(-.064,.74,0)],.013,'alloy')
tube('Wardrobe_Seam',[(.105,.17,.19),(.023,-.08,.176),(.018,-.38,.155)],.006,'graphite')
for y in [.11,-.065,-.22]:
    block('Wardrobe_Button',(.06,y,.179),(.037,.037,.015),.009,'alloy')
export('closet.glb')

# 2. Bias cut lengths of cloth overlap without intersecting. Each has a rolled selvedge.
for k in range(3):
    rows=[]
    for j in range(27):
        t=j/26
        row=[]
        for i in range(10):
            v=i/9-.5
            row.append((-.64+1.28*t+.12*v,.10*k+.155*math.sin(TAU*(t*.86+.16*k))+.045*math.cos(3*v+5*t),v*.61+.19*(k-1)+.055*math.sin(5*t)))
        rows.append(row)
    surface('Bias_Silk',rows,['porcelain','silk','alloy'][k],False)
    tube('Bias_Selvedge',[row[0] for row in rows[::2]],.010,'alloy')
export('styling.glb')

# 3. Double-sided silver backed vanity mirror on a bent stainless steel support.
ring('Mirror_Platform',[(-.56,.31,.21),(-.53,.34,.23),(-.49,.32,.22)],'alloy',48)
tube('Mirror_Stand',[(0,-.50,-.06),(0,-.34,-.06),(0,.05,-.21)],.033,'graphite')
block('Mirror_Frame',(0,.13,0),(.71,.93,.13),.18,'alloy')
block('Mirror_Face',(0,.13,.07),(.65,.86,.035),.13,'lens')
export('fitting.glb')

# 4. Crescent shoulder bag. A gusseted leather shell, piping, paired attachment rings and strap.
rows=[]
for j in range(19):
    t=j/18; row=[]
    for i in range(64):
        a=TAU*i/64; u,v=math.cos(a),math.sin(a)
        env=.78+.22*math.sin(math.pi*t*.86)
        x=.58*u*env
        y=-.36+.54*t-.155*(1-u*u)*t+.042*abs(u)**3
        z=.19*v*(.32+.68*math.sin(math.pi*(.08+.85*t)))+.013*math.sin(3*a+5*t)
        row.append((x,y,z))
    rows.append(row)
surface('Bag_Gusset',rows,'leather',cap=True)
for side in [-1,1]:
    tube('Bag_Piping',[(side*x,y,z) for x,y,z in [(.50,.20,.028),(.53,.04,.10),(.53,-.16,.08),(.45,-.29,.072),(.26,-.34,.135)]],.009,'leather')
    tube('Bag_Ring',[(side*.48+.048*math.cos(TAU*i/12),.211+.056*math.sin(TAU*i/12),.013) for i in range(12)],.013,'alloy',True)
for edge in [-1,1]:
    tube('Bag_Handle',[(x,y,z+.011*edge) for x,y,z in [(-.485,.24,0),(-.42,.45,-.012),(-.24,.68,-.024),(.03,.745,-.01),(.33,.61,.015),(.47,.33,.004),(.48,.24,0)]],.024,'leather')
tube('Bag_Zipper', [rows[-1][i] for i in range(0,33,2)], .009, 'alloy')
block('Bag_Pull',(.42,.13,.064),(.021,.075,.012),.005,'alloy')
export('shop.glb')

for k in range(3):
    b=block('Folio_Cover',((k-1)*.09,(k-1)*.026,(k-1)*.062),(.61,.86,.055),.037,['graphite','porcelain','silk'][k])
    if b is not None: b.rotation_euler.y = math.radians(8*(k-1))
block('Folio_Inlay',(.09,.076,.10),(.39,.48,.017),.026,'alloy')
export('archive.glb')
for k in range(3):
    angle=math.radians(60*k)
    pts=[]
    for i in range(32):
        a=TAU*i/32; x=.49*math.cos(a);y=.17*math.sin(a)
        pts.append((x*math.cos(angle)-y*math.sin(angle),x*math.sin(angle)+y*math.cos(angle),.19*math.sin(a+k*.7)))
    tube('Optical_Gimbal',pts,.040,['alloy','lens','silk'][k],True)
sphere('Gimbal_Heart',.17,'alloy')
export('settings.glb')
