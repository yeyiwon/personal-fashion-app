import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {vertex,fragment,backdropVertex,backdropFragment} from './optics.js';

const glbs=new Map();
const names=['closet','styling','fitting','shop','archive','settings'];
function resource(name){
  if(!glbs.has(name)){
    const task=new GLTFLoader().loadAsync('/media/bello/'+name+'.glb').then(v=>v.scene).catch(e=>{glbs.delete(name);throw e;});
    glbs.set(name,task);
  }
  return glbs.get(name);
}
function rgb(token,style){
  const hex=style.getPropertyValue('--bello-'+token).trim();
  return new T.Vector3(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255));
}
export async function mountOptics(canvas,mode,initial,ready){
  const room=mode==='mirror'||mode==='rail',atlas=mode==='atlas';
  const host=canvas.parentElement;
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas,alpha:!room,antialias:true,stencil:false,powerPreference:'low-power'});}catch{return null;}
  renderer.setClearColor(0,0);
  const style=getComputedStyle(host);
  const colors={pearl:rgb('optical',style),alloy:rgb('silver',style),iris:rgb('lavender',style),ice:rgb('hologram',style),slate:rgb('slate',style),midnight:rgb('midnight',style)};
  const uniforms=Object.fromEntries(Object.entries(colors).map(([k,v])=>[k,{value:v}]));
  Object.assign(uniforms,{night:{value:0},aim:{value:0},aspect:{value:1},resolution:{value:new T.Vector2(1,1)},back:{value:null},hasBack:{value:room?1:0},unfolding:{value:0}});
  const target=room?new T.WebGLRenderTarget(1,1,{depthBuffer:true,generateMipmaps:false}):null;
  const materials=new Map();
  const baseNames={porcelain:'pearl',alloy:'alloy',silk:'iris',lens:'ice',graphite:'slate',ink:'midnight'};
  function material(name,wing){
    const key=name+(wing?'_wing':'');
    if(!materials.has(key)){
      const base=colors[baseNames[name]]??new T.Vector3(.32,.22,.19);
      const finish=({alloy:1,lens:2,silk:3,leather:4})[name]??0;
      materials.set(key,new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:T.DoubleSide, uniforms:{...uniforms,base:{value:base},finish:{value:finish},wing:{value:wing?1:0}}}));
    }
    return materials.get(key);
  }
  function clone(scene){
    const obj=scene.clone(true);
    obj.traverse(mesh=>{if(mesh.isMesh){const name=mesh.material.name;mesh.material=material(name,mesh.name.startsWith('Wing'));if(room&&name==='lens')mesh.layers.set(1);}});
    return obj;
  }
  const camera=new T.OrthographicCamera(-1,1,1,-1,.02,32);
  const stage=new T.Scene();
  const backdrop=room?new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({vertexShader:backdropVertex,fragmentShader:backdropFragment,uniforms,depthTest:false,depthWrite:false})):null;
  if(backdrop){backdrop.frustumCulled=false;backdrop.renderOrder=-99;stage.add(backdrop);}
  const files=room?['studio']:atlas?names:['shop'];
  let raw;
  try{raw=await Promise.all(files.map(resource));}catch{target?.dispose();backdrop?.geometry.dispose();backdrop?.material.dispose();renderer.dispose();renderer.forceContextLoss();return null;}
  const objects=raw.map(clone);
  const views=objects.map(obj=>{const scene=room?stage:new T.Scene();scene.add(obj);return scene;});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,previous=0,disposed=false,visible=true,first=true;
  let tx=0,ty=0,x=0,y=0,focus=0,goalFocus=initial.focus??0,turn=initial.turn??0,goalTurn=turn,pulse=0;
  let W=0,H=0,D=1;
  const drawSize=new T.Vector2();
  function schedule(){if(!frame&&!disposed&&visible)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(disposed||!visible)return;
    const box=canvas.getBoundingClientRect(),w=Math.round(box.width),h=Math.round(box.height);
    if(!w||!h)return;
    const d=Math.min(devicePixelRatio||1,room?1.35:1.5,Math.sqrt(1450000/(w*h)));
    if(w!==W||h!==H||D!==d){
      W=w;H=h;D=d;renderer.setPixelRatio(D);renderer.setSize(w,h,false);
      renderer.getDrawingBufferSize(drawSize);uniforms.resolution.value.copy(drawSize);
      if(target)target.setSize(Math.max(1,Math.round(drawSize.x*.65)),Math.max(1,Math.round(drawSize.y*.65)));
    }
    const a=reduced.matches?1:1-Math.exp(-Math.min(.06,(now-previous)/1000||.016)*11);previous=now;
    x+=(tx-x)*a;y+=(ty-y)*a;focus+=(goalFocus-focus)*a;turn+=(goalTurn-turn)*a;pulse=reduced.matches?0:pulse*(1-a);
    uniforms.night.value=document.documentElement.dataset.theme==='dark'?1:0;
    uniforms.aspect.value=w/h;uniforms.aim.value=x;uniforms.unfolding.value=focus;
    renderer.setViewport(0,0,w,h);renderer.setScissorTest(false);
    if(room){
      const height=mode==='rail'?2.48:2.86;
      const span=height*w/h;
      camera.left=-span/2;camera.right=span/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
      const anchor=(w<660?.26:.125)*span*focus;
      const center=mode==='rail'?1.29:1.06;
      camera.position.set(x*.135-anchor,center+.92+y*.05,5.35+Math.abs(focus)*.17);
      camera.lookAt(-anchor,center,0);
      const obj=objects[0];obj.rotation.y=x*.035;
      obj.traverse(o=>{if(o.name.startsWith('Wing')) o.scale.x=Math.min(2.9,span*.374)*(1+.045*focus+.018*pulse);
        else if(o.name.startsWith('Mirror')) o.scale.x=Math.min(1.2,span*.435);
        else if(o.name.startsWith('Dais')) o.scale.x=Math.min(1.29,span*.419);});
      camera.layers.set(0);uniforms.back.value=null;renderer.setRenderTarget(target);renderer.render(stage,camera);
      uniforms.back.value=target.texture;renderer.setRenderTarget(null);
      camera.layers.enable(1);renderer.render(stage,camera);
    }else{
      renderer.clear();renderer.setScissorTest(true);
      const slots=atlas?[...host.querySelectorAll('.atlas-relic')]:[canvas];
      slots.forEach((el,i)=>{
        const rect=el.getBoundingClientRect(),vw=Math.max(1,rect.width),vh=Math.max(1,rect.height);
        const left=rect.left-box.left,bottom=box.bottom-rect.bottom;
        renderer.setViewport(left,bottom,vw,vh);renderer.setScissor(left,bottom,vw,vh);
        const half=atlas?(i===0||i===3?.70:.65):.75;
        camera.left=-half*vw/vh;camera.right=half*vw/vh;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
        camera.position.set(0,.40,3.6);camera.lookAt(0,i===0||i===3?.12:0,0);
        const obj=objects[i];obj.rotation.y=atlas?-.49+i*.095+x*.29:turn+x*.09;
        obj.rotation.x=atlas?-.10+y*.11:-.035+y*.055;
        const pointed=atlas&&el.closest('a')?.matches(':hover,:focus-visible');
        obj.rotation.z=pointed?.045:0;renderer.render(views[i],camera);
      });
      renderer.setScissorTest(false);
    }
    if(first){first=false;canvas.dataset.renderer='webgl2';ready(true);}
    if(Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(goalTurn-turn)+Math.abs(goalFocus-focus)+pulse>.012)schedule();
  }
  function pointer(e){if(reduced.matches)return;const b=host.getBoundingClientRect();tx=Math.max(-1,Math.min(1,(e.clientX-b.left)/b.width*2-1));ty=Math.max(-1,Math.min(1,(e.clientY-b.top)/b.height*2-1));schedule();}
  function reset(){tx=0;ty=0;schedule();}
  function lost(e){e.preventDefault();visible=false;ready(false);}
  function restored(){visible=true;first=true;schedule();}
  const resize=new ResizeObserver(schedule);resize.observe(host);
  const theme=new MutationObserver(schedule);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  const observer=new IntersectionObserver(es=>{visible=es[0].isIntersecting&&!document.hidden;if(visible)schedule();});observer.observe(host);
  function visibility(){visible=!document.hidden&&host.getBoundingClientRect().bottom>0;if(visible)schedule();}
  document.addEventListener('visibilitychange',visibility);host.addEventListener('pointermove',pointer,{passive:true});host.addEventListener('pointerleave',reset);host.addEventListener('focusin',schedule);
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
  schedule();
  return {set(next){goalFocus=next.focus??0;goalTurn=next.turn??0;pulse=.7;schedule();},dispose(){
    disposed=true;cancelAnimationFrame(frame);resize.disconnect();theme.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);
    host.removeEventListener('pointermove',pointer);host.removeEventListener('pointerleave',reset);host.removeEventListener('focusin',schedule);
    canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
    materials.forEach(m=>m.dispose());backdrop?.geometry.dispose();backdrop?.material.dispose();target?.dispose();renderer.dispose();renderer.forceContextLoss();
  }};
}
