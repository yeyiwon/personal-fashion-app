import { createHmac } from 'node:crypto';
import {
  allowed,
  readBody,
  reply,
  sameOrigin,
  takeSlot,
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
    process.env.ROOM_FITTING_ENABLED === 'true' &&
    process.env.ROOM_ACCESS_CODE?.length >= 16
  );
  if (req.method === 'GET') return reply(res, 200, { ready });
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
    if (
      d.action !== 'generate' ||
      d.consent !== true ||
      !image(d.model) ||
      !image(d.garment)
    )
      return reply(res, 400, {
        error: '모델·상품 사진과 전송 및 비용 동의를 확인해 주세요.',
      });
    const basic = ['상의', '하의', '원피스', '아우터'].includes(d.category);
    if (!basic && !['신발', '가방', '기타'].includes(d.category))
      return reply(res, 400, { error: '착용 분류를 확인해 주세요.' });
    if (!takeSlot('fitting', 2))
      return reply(res, 429, {
        error: '이번 시간의 피팅 생성 한도에 도달했어요.',
      });
    const inputs = {
      model_image: d.model,
      return_base64: true,
      output_format: 'jpeg',
      ...(basic
        ? {
            garment_image: d.garment,
            num_samples: 1,
            category: {
              상의: 'tops',
              아우터: 'tops',
              하의: 'bottoms',
              원피스: 'one-pieces',
            }[d.category],
            mode: 'balanced',
          }
        : {
            product_image: d.garment,
            num_images: 1,
            generation_mode: 'fast',
            resolution: '1k',
          }),
    };
    const r = await fetch('https://api.fashn.ai/v1/run', {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model_name: basic ? 'tryon-v1.6' : 'tryon-max',
        inputs,
      }),
    });
    const job = await r.json();
    if (!r.ok || !job.id || job.error) throw Error();
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
