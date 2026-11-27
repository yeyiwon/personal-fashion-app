import {useEffect,useState} from 'react';
import {providerDirectory} from './provider-contracts';
import {Icon} from './presentation';
import {visionAvailable} from './localVision';
import type {PageProps} from './studio';

export default function BelloConnections({go}:Pick<PageProps,'go'>){
  const [state,set]=useState<{local:boolean;cloud:boolean;vision:boolean;fit:boolean}|null>(null);
  useEffect(()=>{let live=true;
    const status=async(path:string)=>{try{const r=await fetch(path);return r.ok?await r.json():{};}catch{return {};}};
    Promise.all([status('/api/room-stylist'),visionAvailable(),status('/api/room-fitting')]).then(([s,v,f])=>{if(live)set({local:s.local===true,cloud:s.cloud===true,vision:v,fit:f.ready===true});});
    return()=>{live=false;};
  },[]);
  const nativeState=state?.vision?'기기 내 처리 구현 완료':'이 환경에서는 Mac 기기 내 처리 미지원';
  const entries=[
    ['기기 내 BELLO','stylist',state?.local?'기기 내 처리 구현 완료':'Apple Intelligence 사용 가능 기기 필요','지원 Mac의 로컬 드레스룸에서 옷장 ID, 취향, 일정으로 코디를 제안합니다.'],
    ['의류 인식 · 배경 분리','recognition',nativeState,'Vision으로 의류 분류 후보와 투명 이미지를 얻습니다. 소재는 직접 확인합니다.'],
    ['구매 캡처 문자 인식','purchases',nativeState,'캡처에서 읽은 줄을 사용자가 선택해 상품명으로 등록합니다.'],
    ['OpenAI 스타일링','stylist',state?.cloud?'비용 승인 필요':'인증 설정 필요','설정 시 요청마다 질문·옷 목록 전송과 호출 비용에 동의합니다.'],
    ['FASHN 실사 피팅','fitting',state?.fit?'비용 승인 필요':'인증 설정 필요','한 장 생성 전 모델·의류 사진 전송과 크레딧 사용을 확인합니다.'],
    ...(['model','receipts','prices','alerts'] as const).map(k=>{const p=providerDirectory[k];return [p.name,p.page,k==='receipts'||k==='prices'?'상업 계약 또는 계정 권한 필요':'미구현',p.local+' · '+p.requires];})
  ];
  return <section className="connections"><h1>연결 상태</h1><div>{entries.map(([k,page,s,d])=><details key={k}><summary><b>{k}</b><small>{state?s:'확인 중'}</small></summary><p>{d}</p><button className="quiet" onClick={()=>go(page)}>기능 열기 <Icon name="arrow" size={15}/></button></details>)}</div></section>;
}
