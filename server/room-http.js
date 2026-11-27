import { createHash, timingSafeEqual } from 'node:crypto';

export function reply(res, code, value) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}
export function allowed(req) {
  const secret = process.env.ROOM_ACCESS_CODE;
  const supplied = req.headers['x-room-access'];
  const hash = (value) => createHash('sha256').update(value).digest();
  return (
    typeof secret === 'string' &&
    secret.length >= 16 &&
    typeof supplied === 'string' &&
    timingSafeEqual(hash(secret), hash(supplied))
  );
}
export function sameOrigin(req) {
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}
export async function readBody(req, limit) {
  if (!(req.headers['content-type'] || '').startsWith('application/json'))
    throw Error('JSON 요청이 필요해요.');
  if (Number(req.headers['content-length']) > limit)
    throw Error('요청이 너무 커요.');
  if (req.body !== undefined) {
    const data =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(data) > limit) throw Error('요청이 너무 커요.');
    return JSON.parse(data);
  }
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > limit) throw Error('요청이 너무 커요.');
    parts.push(Buffer.from(part));
  }
  return JSON.parse(Buffer.concat(parts).toString());
}
const windows = new Map();
export function takeSlot(key, hourlyLimit) {
  const hour = Math.floor(Date.now() / 3600000);
  const previous = windows.get(key);
  const count = previous?.hour === hour ? previous.count : 0;
  if (count >= hourlyLimit) return false;
  windows.set(key, { hour, count: count + 1 });
  return true;
}
