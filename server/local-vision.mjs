import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reply, readBody, sameOrigin } from './room-http.js';
let bin,
  active = 0;
function executable() {
  if (!bin)
    bin = (async () => {
      if (process.platform !== 'darwin') return null;
      const dir = await mkdtemp(join(tmpdir(), 'wardrobe-vision-')),
        target = join(dir, 'vision');
      await promisify(execFile)(
        'xcrun',
        [
          'swiftc',
          '-parse-as-library',
          '-module-cache-path',
          join(dir, 'cache'),
          fileURLToPath(
            new URL('../native/GarmentVision.swift', import.meta.url),
          ),
          '-o',
          target,
        ],
        { timeout: 120000 },
      );
      return target;
    })().catch(() => null);
  return bin;
}
export async function vision(req, res, local) {
  const executablePath = local && (await executable());
  if (req.method === 'GET')
    return reply(res, 200, { available: !!executablePath });
  if (!executablePath || req.method !== 'POST' || !sameOrigin(req))
    return reply(res, 403, {
      error: '이 Mac의 로컬 드레스룸에서만 사용할 수 있어요.',
    });
  if (active >= 2)
    return reply(res, 429, { error: '다른 사진을 처리하고 있어요.' });
  let data;
  try {
    data = await readBody(req, 1900000);
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.image))
      throw Error();
  } catch {
    return reply(res, 400, { error: '사진을 확인해 주세요.' });
  }
  active++;
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(executablePath, [], {
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 35000,
      });
      let output = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (part) => {
        output += part;
        if (output.length > 5000000) child.kill();
      });
      child.stdin.on('error', () => {});
      child.on('error', reject);
      child.on('close', (code) => {
        try {
          if (code !== 0) throw Error();
          resolve(JSON.parse(output));
        } catch {
          reject(Error());
        }
      });
      child.stdin.end(Buffer.from(data.image.split(',')[1], 'base64'));
    });
    return reply(res, 200, result);
  } catch {
    return reply(res, 502, { error: '기기에서 피사체를 분석하지 못했어요.' });
  } finally {
    active--;
  }
}
