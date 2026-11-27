import {budgetConfigured,isJobKey,reservePaid,recordJob} from '../server/paid-budget.js';
import { createHmac } from 'node:crypto';
import {
  allowed,
  readBody,
  reply,
  sameOrigin,
} from '../server/room-http.js';
const image = (value) =>
  typeof value === 'string' &&
  value.length <= 1600000 &&
  /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(value);
const signed = (id) =>
  createHmac('sha256', process.env.FASHN_API_KEY)
    .update('wardrobe-job:' + id)
    .digest('base64url');
export default async function fit(req, res) {
  const ready = !!(
    process.env.FASHN_API_KEY &&
    budgetConfigured('fashn') &&
    process.env.ROOM_ACCESS_CODE?.length >= 16
  );
  const fitEnabled=ready && process.env.ROOM_FITTING_ENABLED === 'true';
  const modelEnabled=ready && process.env.ROOM_MODEL_ENABLED === 'true';
  if (req.method === 'GET') return reply(res,200,{ready:fitEnabled,modelReady:modelEnabled,credits:{tryon:1,model:1}});
  if (req.method !== 'POST' || !sameOrigin(req))
    return reply(res, 403, { error: '같은 드레스룸에서 요청해 주세요.' });
  if (!ready)
    return reply(res, 503, {
      error: 'FASHN 인증 설정과 비용 승인이 필요해요.',
    });
  if (!allowed(req))
    return reply(res, 403, { error: '운영자 접근 코드를 확인해 주세요.' });
  let d;
  try {
    d = await readBody(req, 3300000);
  } catch {
    return reply(res, 400, { error: '이미지 크기나 형식을 확인해 주세요.' });
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + process.env.FASHN_API_KEY,
  };
  try {
    if (d.action === 'status') {
      const [id, sig] = String(d.ticket ?? '').split('.');
      if (!/^[A-Za-z0-9-]{8,120}$/.test(id) || sig !== signed(id))
        return reply(res, 400, { error: '생성 작업 번호가 올바르지 않아요.' });
      const upstream = await fetch('https://api.fashn.ai/v1/status/' + id, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (!upstream.ok) throw Error();
      const job = await upstream.json();
      if (job.status === 'completed') {
        const first = job.output?.[0];
        if (
          typeof first !== 'string' ||
          !/^data:image\/jpeg;base64,/.test(first) ||
          first.length > 5200000
        )
          throw Error();
        return reply(res, 200, { status: 'completed', output: first });
      }
      return reply(res, 200, {
        status: ['failed', 'canceled', 'cancelled'].includes(job.status)
          ? 'failed'
          : 'pending',
      });
    }
    if(!isJobKey(d.requestId)||d.consent!==true)return reply(res,400,{error:'이번 요청의 비용 동의와 요청 ID가 필요해요.'});
    let modelName,inputs;
    if(d.action==='create-model'){
      if(!modelEnabled)return reply(res,503,{error:'개인 모델 생성 설정이 필요해요.'});
      if(typeof d.prompt!=='string'||d.prompt.trim().length<4||d.prompt.trim().length>500)return reply(res,400,{error:'모델 설명은 4~500자로 입력해 주세요.'});
      modelName='model-create';
      inputs={prompt:d.prompt.trim(),num_images:1,resolution:'1k',generation_mode:'fast',output_format:'jpeg',return_base64:true};
    }else{
      if(!fitEnabled)return reply(res,503,{error:'실사 피팅 설정이 필요해요.'});
      if(d.action!=='generate'||!image(d.model)||!image(d.garment))return reply(res,400,{error:'선택한 모델·상품 사진을 확인해 주세요.'});
      const category={상의:'tops',아우터:'tops',하의:'bottoms',원피스:'one-pieces'}[d.category];
      if(!category&&!['신발','가방','기타'].includes(d.category))return reply(res,400,{error:'착용 분류를 확인해 주세요.'});
      modelName=category?'tryon-v1.6':'tryon-max';
      inputs={model_image:d.model,return_base64:true,output_format:'jpeg',...(category?{garment_image:d.garment,num_samples:1,category,mode:'balanced'}:{product_image:d.garment,num_images:1,generation_mode:'fast',resolution:'1k'})};
    }
    let reservation;
    try{reservation=await reservePaid('fashn',d.requestId,{modelName,inputs},1);}catch{return reply(res,503,{error:'비용 한도를 확인할 수 없어 생성 요청을 보류했어요.'});}
    if(reservation.state==='existing' && reservation.reference){const id=reservation.reference;return reply(res,202,{ticket:id+'.'+signed(id),status:'pending'});}
    if(reservation.state==='limit')return reply(res,429,{error:'오늘의 FASHN 크레딧 한도에 도달했어요.'});
    if(reservation.state!=='reserved')return reply(res,409,{error:'같은 요청의 접수 상태를 확인 중이에요. 새 요청 전 대시보드에서 확인해 주세요.'});
    const r = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model_name:modelName,
        inputs,
      }),
    });
    const job = await r.json();
    if (!r.ok || !/^[A-Za-z0-9-]{8,120}$/.test(job.id) || job.error) throw Error();
    await recordJob('fashn',d.requestId,job.id);
    return reply(res, 202, {
      ticket: job.id + '.' + signed(job.id),
      status: 'pending',
    });
  } catch {
    return reply(res, 502, {
      error:
        d.action === 'status'
          ? '조회에 실패했어요. 기존 작업을 다시 조회해 주세요.'
          : '접수 여부가 불확실해요. 재생성 전에 FASHN 대시보드에서 확인해 주세요.',
    });
  }
}
