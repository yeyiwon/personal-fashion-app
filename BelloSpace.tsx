import {useEffect,useRef} from 'react';
type RGB=[number,number,number];
function color(a:RGB,b:RGB,t:number,alpha=1){return 'rgba('+a.map((c,i)=>Math.round(c+(b[i]-c)*t)).join(',')+','+alpha+')';}
function rgb(el:CSSStyleDeclaration,key:string):RGB{
  const v=el.getPropertyValue(key).trim().replace('#','');return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)) as RGB;
}
// Curved shell cross-sections projected onto the mirror plane. Only render on resize, input or a state change.
export default function BelloSpace({kind='mirror',signal=0}:{kind?:'mirror'|'rail'|'atlas';signal?:number}){
  const ref=useRef<HTMLCanvasElement>(null),state=useRef({x:0,y:0,pulse:0}),redraw=useRef<()=>void>(()=>{});
  useEffect(()=>{state.current.pulse=1;redraw.current();},[signal]);
  useEffect(()=>{
    const c=ref.current,host=c?.parentElement;if(!c||!host)return;const ctx=c.getContext('2d',{alpha:false});if(!ctx)return;
    let frame=0,visible=true,goalX=0,goalY=0,last=0;const reduced=matchMedia('(prefers-reduced-motion:reduce)');
    function draw(now:number){
      frame=0;if(!ctx||!c||!host||!visible)return;const {width:w,height:h}=host.getBoundingClientRect();if(!w||!h)return;
      const ratio=Math.min(1.5,window.devicePixelRatio||1);if(c.width!==Math.round(w*ratio)||c.height!==Math.round(h*ratio)){c.width=Math.round(w*ratio);c.height=Math.round(h*ratio);}
      ctx.setTransform(ratio,0,0,ratio,0,0);
      const p=state.current,k=reduced.matches?1:Math.min(1,(now-last||16)/85);last=now;p.x+=(goalX-p.x)*k;p.y+=(goalY-p.y)*k;p.pulse=reduced.matches?0:p.pulse*.88;
      const tokens=getComputedStyle(host),white=rgb(tokens,'--bello-optical'),silver=rgb(tokens,'--bello-silver'),lilac=rgb(tokens,'--bello-lavender'),ice=rgb(tokens,'--bello-hologram'),slate=rgb(tokens,'--bello-slate'),night=rgb(tokens,'--bello-midnight');
      const dark=document.documentElement.dataset.theme==='dark',paper=dark?night:white,edge=dark?slate:silver;
      const cx=w*(.5+p.x*.012),floor=h*(kind==='rail'?.81:.855),top=h*.095;
      const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,color(edge,slate,dark?.52:.23));bg.addColorStop(.44,color(paper,edge,.20));bg.addColorStop(1,color(edge,lilac,.28));ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      const light=ctx.createRadialGradient(cx,floor*.54,1,cx,floor*.54,h*.66);
      light.addColorStop(0,color(paper,white,dark?.11:.72));light.addColorStop(1,color(paper,paper,0,0));ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
      // Ribbed, concave side walls. Separate curves catch different portions of a moving strip light.
      for(const side of [-1,1]){
        const edgeX=side<0?0:w,dir=side<0?1:-1;
        for(let i=13;i>=0;i--){
          const t=i/13, s=w*(.035+t*.195), bow=w*(.03+t*.042);
          ctx.beginPath();ctx.moveTo(edgeX+dir*s,-h*.10);
          ctx.bezierCurveTo(edgeX+dir*(s+bow),h*.17,edgeX+dir*(s-bow*.55),h*.48,edgeX+dir*s*.63,floor-h*.04);
          ctx.quadraticCurveTo(edgeX+dir*s*.46,floor+h*.028,edgeX-dir*w*.1,h*1.07);ctx.lineTo(edgeX-dir*w*.15,-h*.10);ctx.closePath();
          const lighting=ctx.createLinearGradient(edgeX,0,edgeX+dir*s*1.14,h*.06);
          lighting.addColorStop(0,color(edge,slate,dark?.83:.56));lighting.addColorStop(.66,color(edge,lilac,.18));lighting.addColorStop(.90,color(edge,ice,.17+.15*p.pulse));lighting.addColorStop(.97,color(white,silver,dark?.83:.1));lighting.addColorStop(1,color(edge,slate,.42));
          ctx.fillStyle=lighting;ctx.fill();ctx.lineWidth=.8;ctx.strokeStyle=color(white,silver,.12,dark?.30:.58);ctx.stroke();
        }
      }
      const mw=Math.min(w*(kind==='mirror'?.65:.72),h*.72),mh=floor-top, left=cx-mw/2;
      ctx.beginPath();ctx.roundRect(left,top,mw,mh,[mw*.44,mw*.44,mw*.2,mw*.2]);const pane=ctx.createLinearGradient(left,0,left+mw,h*.3);
      pane.addColorStop(0,color(ice,white,.6,dark?.13:.44));pane.addColorStop(.25,color(white,silver,.15,.05));pane.addColorStop(.73,color(white,silver,.3,.02));pane.addColorStop(1,color(lilac,white,.39,.28));ctx.fillStyle=pane;ctx.fill();
      ctx.strokeStyle=color(white,silver,.16,dark?.36:.85);ctx.lineWidth=1.6;ctx.stroke();
      const floorGrad=ctx.createLinearGradient(0,floor-h*.04,0,h);floorGrad.addColorStop(0,color(edge,white,.18,0));floorGrad.addColorStop(.23,color(edge,paper,.33));floorGrad.addColorStop(1,color(edge,slate,dark?.84:.22));ctx.fillStyle=floorGrad;ctx.fillRect(0,floor-h*.04,w,h-floor+h*.04);
      const rx=Math.min(w*.38,h*.31),ry=Math.max(9,h*.034),cy=floor+h*.014;
      const shadow=ctx.createRadialGradient(cx,cy+6,0,cx,cy+6,rx*1.12);shadow.addColorStop(0,color(slate,night,.62,.40));shadow.addColorStop(1,color(night,night,0,0));ctx.save();ctx.translate(cx,cy+6);ctx.scale(1,.19);ctx.translate(-cx,-cy-6);ctx.fillStyle=shadow;ctx.fillRect(cx-rx*1.4,cy-rx*1.4,rx*2.8,rx*2.8);ctx.restore();
      for(let i=6;i>=0;i--){ctx.beginPath();ctx.ellipse(cx,cy+i*.8,rx,ry,0,0,Math.PI*2);ctx.fillStyle=i?color(silver,slate,.24+i*.05):color(paper,silver,.46);ctx.fill();}
      const rim=ctx.createLinearGradient(cx-rx,0,cx+rx,0);rim.addColorStop(0,color(lilac,white,.18));rim.addColorStop(.35,color(white,ice,.13));rim.addColorStop(.67,color(ice,silver,.1));rim.addColorStop(1,color(silver,lilac,.55));ctx.strokeStyle=rim;ctx.lineWidth=2+p.pulse;ctx.stroke();
      if(!reduced.matches&&(Math.abs(p.x-goalX)+Math.abs(p.y-goalY)>.025||p.pulse>.025))schedule();
    }
    function schedule(){if(!frame&&visible)frame=requestAnimationFrame(draw);}
    function move(e:globalThis.PointerEvent){const b=host!.getBoundingClientRect();goalX=Math.max(-1,Math.min(1,((e.clientX-b.left)/b.width-.5)*2));goalY=(e.clientY-b.top)/b.height-.5;schedule();}
    const resize=new ResizeObserver(schedule);resize.observe(host);
    const theme=new MutationObserver(schedule);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    const observer=new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible)schedule();});observer.observe(host);
    host.addEventListener('pointermove',move,{passive:true});redraw.current=schedule;schedule();
    return()=>{redraw.current=()=>{};host.removeEventListener('pointermove',move);resize.disconnect();theme.disconnect();observer.disconnect();cancelAnimationFrame(frame);};
  },[kind]);
  return <canvas ref={ref} className="bello-architecture" aria-hidden="true"/>;
}

