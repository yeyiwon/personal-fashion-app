import { WardrobeError } from './domain';

export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 32_000_000;
const MAX_SIDE = 10_000;
const PREVIEW_EDGE = 1280;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export interface PreparedImage {
  original: Blob;
  preview: Blob;
  hash: string;
  color: string;
  /** Display orientation after EXIF is applied, before resizing. */
  width: number;
  height: number;
}
export interface ImageProcessor {
  readonly kind: 'device';
  prepare(file: Blob): Promise<PreparedImage>;
}

type SupportedType = 'image/jpeg' | 'image/png' | 'image/webp';
interface ImageHeader {
  type: SupportedType;
  width: number;
  height: number;
}
function invalid(message: string): never {
  throw new WardrobeError('INVALID', message);
}
function checkSize(width: number, height: number): void {
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_SIDE ||
    height > MAX_SIDE ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    invalid('사진은 3,200만 화소 이하, 한 변 10,000픽셀 이하로 선택해 주세요.');
  }
}

/** Read dimensions before giving potentially very large images to the platform decoder. */
export function readImageHeader(buffer: ArrayBuffer): ImageHeader {
  if (buffer.byteLength < 12) invalid('사진 파일이 손상되었어요.');
  const b = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const n = bytes.length;
  let width = 0,
    height = 0,
    type: SupportedType;
  if (b.getUint32(0) === 0x89504e47 && b.getUint32(4) === 0x0d0a1a0a) {
    type = 'image/png';
    if (n < 33 || b.getUint32(8) !== 13 || b.getUint32(12) !== 0x49484452)
      invalid('PNG 사진을 읽을 수 없어요.');
    width = b.getUint32(16);
    height = b.getUint32(20);
    for (let pos = 33; pos + 12 <= n;) {
      const length = b.getUint32(pos);
      if (pos + 12 + length > n) invalid('PNG 사진 파일이 잘렸어요.');
      const tag = b.getUint32(pos + 4);
      if (tag === 0x6163544c) invalid('움직이는 사진은 정지 이미지로 내보낸 뒤 등록해 주세요.');
      if (tag === 0x49444154) break;
      pos += 12 + length;
    }
  } else if (b.getUint16(0) === 0xffd8 && bytes[2] === 0xff) {
    type = 'image/jpeg';
    for (let pos = 2; pos + 4 <= n;) {
      if (bytes[pos++] !== 0xff) invalid('JPEG 사진을 읽을 수 없어요.');
      while (pos < n && bytes[pos] === 0xff) pos++;
      if (pos + 3 > n) break;
      const marker = bytes[pos++]!;
      if (marker === 0xd9 || marker === 0xda) break;
      if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) continue;
      const length = b.getUint16(pos);
      if (length < 2 || pos + length > n) invalid('JPEG 사진 파일이 잘렸어요.');
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (length < 8) invalid('JPEG 사진 크기를 확인할 수 없어요.');
        height = b.getUint16(pos + 3);
        width = b.getUint16(pos + 5);
        break;
      }
      pos += length;
    }
  } else if (b.getUint32(0) === 0x52494646 && b.getUint32(8) === 0x57454250) {
    type = 'image/webp';
    if (b.getUint32(4, true) + 8 > n) invalid('WebP 사진 파일이 잘렸어요.');
    let canvasWidth = 0,
      canvasHeight = 0;
    for (let pos = 12; pos + 8 <= n;) {
      const tag = b.getUint32(pos),
        length = b.getUint32(pos + 4, true),
        d = pos + 8;
      if (d + length > n) invalid('WebP 사진 파일이 잘렸어요.');
      if (tag === 0x56503858 && length >= 10) {
        if (bytes[d]! & 2) invalid('움직이는 사진은 정지 이미지로 내보낸 뒤 등록해 주세요.');
        canvasWidth = 1 + bytes[d + 4]! + 256 * bytes[d + 5]! + 65536 * bytes[d + 6]!;
        canvasHeight = 1 + bytes[d + 7]! + 256 * bytes[d + 8]! + 65536 * bytes[d + 9]!;
        checkSize(canvasWidth, canvasHeight);
      } else if (
        tag === 0x56503820 &&
        length >= 10 &&
        bytes[d + 3] === 0x9d &&
        bytes[d + 4] === 0x01 &&
        bytes[d + 5] === 0x2a
      ) {
        width = b.getUint16(d + 6, true) & 0x3fff;
        height = b.getUint16(d + 8, true) & 0x3fff;
        break;
      } else if (tag === 0x5650384c && length >= 5 && bytes[d] === 0x2f) {
        const bits = b.getUint32(d + 1, true);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
        break;
      }
      pos = d + length + (length & 1);
    }
    if (canvasWidth && (canvasWidth !== width || canvasHeight !== height))
      invalid('WebP 사진 크기가 일치하지 않아요.');
  } else {
    invalid('JPG, PNG 또는 WebP 사진을 선택해 주세요.');
  }
  checkSize(width, height);
  return { type, width, height };
}

const SHA_ROUND_CONSTANTS = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotate = (word: number, bits: number) => (word >>> bits) | (word << (32 - bits));
const hex = (v: number, n: number) => v.toString(16).padStart(n, '0');

/** FIPS 180-4 fallback for WebViews without SubtleCrypto. Used only for local duplicate detection. */
export function portableSha256(buffer: ArrayBuffer): string {
  const size = buffer.byteLength;
  const bytes = new Uint8Array(Math.ceil((size + 9) / 64) * 64);
  bytes.set(new Uint8Array(buffer));
  bytes[size] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length - 8, Math.floor(size / 0x20000000));
  view.setUint32(bytes.length - 4, size * 8);
  const hash = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + 4 * i);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!,
        b = w[i - 2]!;
      w[i] =
        w[i - 16]! +
        (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) +
        w[i - 7]! +
        (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10));
    }
    let a = hash[0]!,
      b = hash[1]!,
      c = hash[2]!,
      d = hash[3]!,
      e = hash[4]!,
      f = hash[5]!,
      g = hash[6]!,
      h = hash[7]!;
    for (let i = 0; i < 64; i++) {
      const t1 =
        h +
        (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
        ((e & f) ^ (~e & g)) +
        SHA_ROUND_CONSTANTS[i]! +
        w[i]!;
      const t2 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => {
      hash[i] = hash[i]! + v;
    });
  }
  return Array.from(hash, (v) => hex(v, 8)).join('');
}

async function fileDigest(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) return portableSha256(buffer);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), (v) =>
    hex(v, 2),
  ).join('');
}

type Cluster = { weight: number; r: number; g: number; b: number };
function cluster(map: Map<number, Cluster>, r: number, g: number, b: number, weight: number) {
  const key = ((r >> 5) << 6) + ((g >> 5) << 3) + (b >> 5);
  const C = map.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
  C.weight += weight;
  C.r += r * weight;
  C.g += g * weight;
  C.b += b * weight;
  map.set(key, C);
}

/** Center-weighted color estimate that suppresses an edge color only when it dominates the border. */
export function representativeColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string {
  const edges = new Map<number, Cluster>(),
    all = new Map<number, Cluster>(),
    subject = new Map<number, Cluster>();
  let edgeWeight = 0,
    totalWeight = 0,
    subjectWeight = 0;
  const ranked = (m: Map<number, Cluster>) =>
    [...m.values()].sort((a, b) => b.weight - a.weight)[0];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = 4 * (width * y + x);
      if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue;
      if (data[i + 3]! < 128) continue;
      cluster(edges, data[i]!, data[i + 1]!, data[i + 2]!, 1);
      edgeWeight++;
    }
  const edge = ranked(edges);
  const bg =
    edge && edge.weight > edgeWeight * 0.55
      ? [edge.r / edge.weight, edge.g / edge.weight, edge.b / edge.weight]
      : null;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = 4 * (width * y + x),
        alpha = data[i + 3]!;
      if (alpha < 128) continue;
      const r = data[i]!,
        g = data[i + 1]!,
        b = data[i + 2]!;
      const distance = ((2 * (x + 0.5)) / width - 1) ** 2 + ((2 * (y + 0.5)) / height - 1) ** 2;
      const weight = alpha / 255 / (1 + distance * 2);
      cluster(all, r, g, b, weight);
      totalWeight += weight;
      if (bg && Math.hypot(r - bg[0]!, g - bg[1]!, b - bg[2]!) < 38) continue;
      cluster(subject, r, g, b, weight);
      subjectWeight += weight;
    }
  const color = ranked(subjectWeight > totalWeight * 0.08 ? subject : all);
  if (!color) invalid('투명한 영역만 있는 사진이에요. 의류가 보이는 사진을 선택해 주세요.');
  return (
    '#' + [color.r, color.g, color.b].map((c) => hex(Math.round(c / color.weight), 2)).join('')
  );
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  if (!(file instanceof Blob) || !file.size || file.size > MAX_IMAGE_BYTES) {
    invalid('16MB 이하의 의류 사진을 선택해 주세요.');
  }
  const bytes = await file.arrayBuffer();
  const header = readImageHeader(bytes);
  const claimed = file.type.toLowerCase().split(';')[0];
  if (
    claimed &&
    claimed !== header.type &&
    !(claimed === 'image/jpg' && header.type === 'image/jpeg')
  ) {
    invalid('파일 형식과 실제 이미지 내용이 일치하지 않아요.');
  }
  const original = file.slice(0, file.size, header.type);
  const objectUrl = URL.createObjectURL(original);
  const img = new Image(),
    sample = document.createElement('canvas'),
    previewCanvas = document.createElement('canvas');
  try {
    img.src = objectUrl;
    try {
      await img.decode();
    } catch {
      invalid('사진을 열 수 없어요. JPG, PNG 또는 WebP로 다시 저장해 주세요.');
    }
    const width = img.naturalWidth,
      height = img.naturalHeight;
    checkSize(width, height);
    const factor = Math.min(1, PREVIEW_EDGE / Math.max(width, height));
    previewCanvas.width = Math.max(1, Math.round(width * factor));
    previewCanvas.height = Math.max(1, Math.round(height * factor));
    const ctx = previewCanvas.getContext('2d', { alpha: false });
    if (!ctx) invalid('이 기기에서 이미지 처리를 시작할 수 없어요.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
    const scale = 64 / Math.max(width, height);
    sample.width = Math.max(1, Math.round(width * scale));
    sample.height = Math.max(1, Math.round(height * scale));
    const sampler = sample.getContext('2d', { willReadFrequently: true });
    if (!sampler) invalid('사진 색상을 읽을 수 없어요.');
    sampler.drawImage(img, 0, 0, sample.width, sample.height);
    const color = representativeColor(
      sampler.getImageData(0, 0, sample.width, sample.height).data,
      sample.width,
      sample.height,
    );
    const preview = await new Promise<Blob>((resolve, reject) =>
      previewCanvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new WardrobeError('INVALID', '미리보기를 만들 수 없어요.')),
        'image/jpeg',
        0.84,
      ),
    );
    return { original, preview, hash: await fileDigest(bytes), color, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
    previewCanvas.width = sample.width = 0;
    previewCanvas.height = sample.height = 0;
  }
}

export const localImageProcessor: ImageProcessor = { kind: 'device', prepare: prepareImage };
