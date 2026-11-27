// Local Vite only. This module and the native helper are never deployed as a cloud provider.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
let building;
function executable() {
  if (!building)
    building = (async () => {
      if (process.platform !== 'darwin') return null;
      const dir = await mkdtemp(join(tmpdir(), 'wardrobe-language-'));
      await chmod(dir, 0o700);
      const bin = join(dir, 'stylist');
      const source = fileURLToPath(
        new URL('../native/RoomStylist.swift', import.meta.url),
      );
      await exec(
        'xcrun',
        [
          'swiftc',
          '-parse-as-library',
          '-module-cache-path',
          join(dir, 'modules'),
          source,
          '-o',
          bin,
        ],
        { timeout: 120000 },
      );
      return (
        await exec(bin, ['--status'], { timeout: 10000 })
      ).stdout.trim() === 'available'
        ? bin
        : null;
    })().catch(() => null);
  return building;
}
export async function localAvailable() {
  return Boolean(await executable());
}
let active = false;
export async function localAdvice(input) {
  const bin = await executable();
  if (!bin || active)
    throw Error('기기 모델이 준비 중이에요. 잠시 뒤 다시 요청해 주세요.');
  active = true;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(bin, [], {
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 45000,
      });
      let output = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (part) => {
        output += part;
        if (output.length > 12000) child.kill();
      });
      child.on('error', reject);
      child.stdin.on('error', () => {});
      child.on('close', (code) => {
        try {
          if (code !== 0) throw Error();
          resolve(JSON.parse(output));
        } catch {
          reject(
            Error(
              '기기 모델이 응답을 완료하지 못했어요. 요청을 줄여 다시 시도해 주세요.',
            ),
          );
        }
      });
      child.stdin.end(JSON.stringify(input));
    });
  } finally {
    active = false;
  }
}
