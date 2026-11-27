import {useEffect,useRef,useState} from 'react';
import type {OpticalHandle,OpticalMode} from './art/studioRenderer';
export function OpticalStage({mode,focus=0,signal=0,turn=0}:{mode:OpticalMode;focus?:number;signal?:number;turn?:number}){
  const canvas=useRef<HTMLCanvasElement>(null), handle=useRef<OpticalHandle|null>(null);
  const current=useRef({focus,signal,turn});
  const [ready,setReady]=useState(false);
  useEffect(()=>{current.current={focus,signal,turn};handle.current?.set(current.current);},[focus,signal,turn]);
  useEffect(()=>{
    let live=true;const target=canvas.current;
    if(!target)return;
    import('./art/studioRenderer').then(async({mountOptics})=>{
      if(!live)return;
      const instance=await mountOptics(target,mode,current.current,value=>{if(live)setReady(value);});
      if(!live){instance?.dispose();return;}
      handle.current=instance;instance?.set(current.current);
    }).catch(()=>{if(live)setReady(false);});
    return ()=>{live=false;handle.current?.dispose();handle.current=null;};
  },[mode]);
  return <canvas ref={canvas} aria-hidden="true" className={'optical-stage optical-'+mode+(ready?' ready':'')}/>;
}

