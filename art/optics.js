// All lighting colours are supplied by the six CSS brand tokens. Mesh normals come from the authored GLBs.
export const vertex = `
varying vec3 vNormal;
varying vec3 vPosition;
uniform float unfolding,wing;
void main(){
  vec3 p=position;vec3 normalLocal=normal;
  if(wing>.5){
    float h=clamp((p.y+.28)/3.55,0.,1.);
    float bend=sin(h*3.14159)*unfolding;
    p.x+=sign(p.x)*bend*.21;
    p.z+=bend*bend*.26;
    normalLocal.y-=normalLocal.x*sign(p.x)*cos(h*3.14159)*unfolding*.185;
  }
  vec4 eye=modelViewMatrix*vec4(p,1.);
  vPosition=eye.xyz; vNormal=normalize(normalMatrix*normalLocal);
  gl_Position=projectionMatrix*eye;
}`;
export const fragment = `
precision highp float;
varying vec3 vNormal;
varying vec3 vPosition;
uniform vec3 base,pearl,alloy,iris,ice,slate,midnight;
uniform float finish,night,hasBack;
uniform vec2 resolution;
uniform sampler2D back;
float strip(vec3 d, vec3 dir,float width) { return exp(-pow((dot(d,normalize(dir))-.56)/width,2.)); }
vec3 gallery(vec3 r){
  vec3 field=mix(mix(slate,alloy,.37),pearl,smoothstep(-.68,.85,r.y));
  field=mix(field,slate,.54*smoothstep(.20,.84,cos(r.x*4.3+r.z*3.5)));
  field=mix(field,pearl,.93*strip(r,vec3(-.63,.75,.12),.08));
  field=mix(field,mix(ice,pearl,.36),.84*strip(r,vec3(.85,.24,-.34),.075));
  return mix(field,midnight,night*.26);
}
void main(){
  vec3 n=normalize(vNormal); if(!gl_FrontFacing)n=-n;
  vec3 v=normalize(vec3(-vPosition.xy*.13,-vPosition.z));
  vec3 l=normalize(vec3(-.47,.71,.72)), r=reflect(-v,n);
  float ndv=abs(dot(n,v)), f=pow(1.-min(ndv,1.),3.);
  float wrap=clamp(dot(n,l)*.56+.49,0.,1.);
  vec3 env=gallery(r); vec3 darkBase=mix(base,midnight,night*.42);
  vec3 painted=mix(darkBase*.61,darkBase,wrap);
  painted+=pearl*.065*pow(max(0.,dot(reflect(-l,n),v)),28.);
  if(finish>0.5 && finish<1.5){ // Polished, directionally lit silver
    painted=mix(darkBase,env,.79)+pearl*.09*pow(max(0.,dot(reflect(-l,n),v)),60.);
  } else if(finish>1.5 && finish<2.5){ // Finite-thickness screen-space refracting lens
    float thickness=.032+.028*(1.-ndv);
    vec2 uv=gl_FragCoord.xy/resolution;
    vec2 bend=refract(-v,n,1./1.47).xy*thickness;
    vec3 transmitted;
    if(hasBack>.5){
      transmitted.r=texture2D(back,clamp(uv+bend*1.032,.002,.998)).r;
      transmitted.g=texture2D(back,clamp(uv+bend,.002,.998)).g;
      transmitted.b=texture2D(back,clamp(uv+bend*.968,.002,.998)).b;
    }else transmitted=mix(gallery(refract(-v,n,.68)),ice,.17);
    painted=mix(transmitted,env,.20+.66*f);
    painted=mix(painted,mix(iris,ice,smoothstep(-.4,.5,r.x)),.08+.25*f);
  } else if(finish>2.5 && finish<3.5){ // Satin, anisotropic grazing response
    float sheen=pow(1.-abs(dot(n,v)),2.)*.30+pow(max(0.,dot(reflect(-l,n),v)),8.)*.25;
    painted=mix(painted,mix(pearl,iris,.42),sheen);
  } else if(finish>3.5){ // Product leather retains its own colour
    float grain=fract(sin(dot(floor(vPosition.xy*440.),vec2(12.9898,78.233)))*43758.5453);
    painted=base*(.61+.45*wrap+.026*grain)+pearl*(.085*pow(max(dot(reflect(-l,n),v),0.),24.)+.055*f);
  } else painted=mix(painted,env,.07+.19*f);
  gl_FragColor=vec4(painted,1.);
}`;
export const backdropVertex = `varying vec2 uvp;void main(){uvp=position.xy*.5+.5;gl_Position=vec4(position.xy,.999998,1.);}`;
export const backdropFragment = `
varying vec2 uvp;
uniform vec3 pearl,alloy,iris,ice,slate,midnight;
uniform float night,aspect,aim,tint;
void main(){
  vec2 p=uvp;float dx=(p.x-.51-aim*.015)*aspect;
  float beam=exp(-pow((dx+.36*p.y)/.39,2.));
  float pool=exp(-dot(vec2(dx*1.85,(p.y-.45)*1.4),vec2(dx*1.85,(p.y-.45)*1.4)));
  vec3 wall=mix(alloy,pearl,.18+.76*pool);
  float fabric=exp(-pow((dx+.25-.10*sin(p.y*4.5))/.42,2.));
  wall=mix(wall,mix(iris,ice,.5+.45*tint),.18*fabric+.17*beam);
  wall=mix(wall,slate,.23*smoothstep(.18,1.05,dx+.3*p.y));
  wall=mix(wall,pearl,.45*exp(-pow((dx-.17+.36*p.y)/.10,2.)));
  float floorMix=1.-smoothstep(.05,.28,p.y);
  vec3 floorCol=mix(alloy,pearl,.48+.15*beam);
  vec3 lit=mix(wall,floorCol,floorMix);
  vec3 dim=mix(midnight,slate,.38+.49*pool);
  dim=mix(dim,alloy,.085*beam+.085*floorMix);
  float contact=exp(-pow(dx/.37,2.)-pow((p.y-.114)/.021,2.));
  vec3 shade=mix(lit,dim,night);
  gl_FragColor=vec4(mix(shade,midnight,.26*contact),1.);
}`;
