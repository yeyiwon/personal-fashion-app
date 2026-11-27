import { analyseGarment } from './localVision';
import { getImage } from './storage';
import type { StudioGarment } from './studio';
import type { Figure } from './atelierData';

export interface Piece extends StudioGarment {
  source?: 'candidate' | 'reference';
}
export const slot = (g: Piece) =>
  g.category === '기타'
    ? /모자|캡|비니|hat|cap/i.test(g.name)
      ? '모자'
      : '액세서리'
    : g.category;
export const slots = [
  '상의',
  '하의',
  '원피스',
  '아우터',
  '신발',
  '가방',
  '모자',
  '액세서리',
];
export function wearPiece(
  ids: string[],
  item: Piece,
  all: Piece[],
  locks: string[],
) {
  const which = slot(item);
  const conflict = (g: Piece) =>
    slot(g) === which ||
    (which === '원피스' && ['상의', '하의'].includes(slot(g))) ||
    (slot(g) === '원피스' && ['상의', '하의'].includes(which));
  if (
    all.some(
      (g) =>
        ids.includes(g.id) &&
        g.id !== item.id &&
        locks.includes(g.id) &&
        conflict(g),
    )
  )
    return ids;
  return [
    ...ids.filter(
      (id) => id !== item.id && !all.some((g) => g.id === id && conflict(g)),
    ),
    item.id,
  ];
}
type Raster = HTMLCanvasElement;
function surface(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
export async function readBitmap(src: string | Blob) {
  const object = typeof src !== 'string';
  const url = object ? URL.createObjectURL(src) : src;
  const im = new Image();
  try {
    im.src = url;
    await im.decode();
    return im;
  } finally {
    if (object) URL.revokeObjectURL(url);
  }
}
export async function jpegData(src: string | Blob, edge = 950) {
  const im = await readBitmap(src);
  const scale = Math.min(1, edge / Math.max(im.width, im.height));
  const c = surface(
    Math.max(1, Math.round(im.width * scale)),
    Math.max(1, Math.round(im.height * scale)),
  );
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#edece6';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
// Conservative edge-connected segmentation for simple studio/album backgrounds. Never alter the stored original.
export function isolate(im: HTMLImageElement) {
  const s = Math.min(1, 480 / Math.max(im.width, im.height)),
    w = Math.max(1, Math.round(im.width * s)),
    h = Math.max(1, Math.round(im.height * s));
  const c = surface(w, h),
    ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(im, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h),
    d = pixels.data,
    n = w * h;
  let transparent = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 32) transparent++;
  if (transparent < n * 0.06) {
    const refs = [0, w - 1, (h - 1) * w, n - 1].map((i) => [
      d[i * 4],
      d[i * 4 + 1],
      d[i * 4 + 2],
    ]);
    const distance = (a: number[], b: number[]) =>
      Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const common = refs.filter(
      (r) => refs.filter((other) => distance(other, r) < 32).length >= 3,
    );
    if (!common.length) return { canvas: c, cut: false };
    const seen = new Uint8Array(n),
      queue = new Int32Array(n);
    let from = 0,
      to = 0;
    const visit = (i: number) => {
      if (seen[i]) return;
      seen[i] = 1;
      const p = i * 4;
      if (
        common.some(
          (rgb) =>
            Math.max(
              Math.abs(d[p] - rgb[0]),
              Math.abs(d[p + 1] - rgb[1]),
              Math.abs(d[p + 2] - rgb[2]),
            ) < 37,
        )
      )
        queue[to++] = i;
    };
    for (let x = 0; x < w; x++) {
      visit(x);
      visit(n - w + x);
    }
    for (let y = 0; y < h; y++) {
      visit(y * w);
      visit(y * w + w - 1);
    }
    while (from < to) {
      const i = queue[from++];
      if (i % w) visit(i - 1);
      if (i % w < w - 1) visit(i + 1);
      if (i >= w) visit(i - w);
      if (i < n - w) visit(i + w);
    }
    if (to < n * 0.09 || to > n * 0.94) return { canvas: c, cut: false };
    for (let i = 0; i < to; i++) d[queue[i] * 4 + 3] = 0;
    ctx.putImageData(pixels, 0, 0);
  }
  let x1 = w,
    y1 = h,
    x2 = -1,
    y2 = -1;
  for (let i = 0; i < n; i++)
    if (d[i * 4 + 3] > 48) {
      let x = i % w,
        y = Math.floor(i / w);
      x1 = Math.min(x1, x);
      x2 = Math.max(x2, x);
      y1 = Math.min(y1, y);
      y2 = Math.max(y2, y);
    }
  if (x2 <= x1 || y2 <= y1) return { canvas: c, cut: false };
  const out = surface(x2 - x1 + 1, y2 - y1 + 1);
  out.getContext('2d')!.drawImage(c, -x1, -y1);
  return { canvas: out, cut: true };
}
const assetCache = new Map<
  string,
  Promise<{ canvas: Raster; cut: boolean } | null>
>();
function registered(g: Piece) {
  const match = /^(?:sample|shop)-(shirt|skirt|slingback)$/.exec(g.id);
  return match?.[1];
}
async function loadPiece(g: Piece) {
  const key = g.id + '|' + g.updatedAt;
  if (!assetCache.has(key)) {
    const pending = (async () => {
      const registeredId = registered(g);
      const src = registeredId
        ? '/media/dressing/' + registeredId + '.webp'
        : g.image || (await getImage(g.id, 'original'));
      if (!src) return null;
      const basic = isolate(await readBitmap(src));
      if (!basic.cut && (!g.image || g.source === 'reference')) {
        try {
          const result = await analyseGarment(await jpegData(src, 720));
          if (result?.cutout) return isolate(await readBitmap(result.cutout));
        } catch {
          /* keep the original available as a photo */
        }
      }
      return basic;
    })().catch(() => null);
    if (assetCache.size >= 48)
      assetCache.delete(assetCache.keys().next().value!);
    assetCache.set(key, pending);
  }
  return assetCache.get(key)!;
}
export function clearRoomAssets() {
  assetCache.clear();
}
const bases = new Map<string, Promise<HTMLImageElement>>();
function loadBase(base: string) {
  if (!bases.has(base))
    bases.set(base, readBitmap('/media/dressing/' + base + '.webp'));
  return bases.get(base)!;
}
export const skinTones = ['기본', '웜', '올리브', '딥'] as const;
const paints: Record<string, number[]> = {
  웜: [1.04, 0.94, 0.87],
  올리브: [0.93, 0.91, 0.78],
  딥: [0.65, 0.53, 0.46],
};
function complexion(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tone: string,
) {
  const rgb = paints[tone];
  if (!rgb) return;
  const img = ctx.getImageData(0, 0, w, h),
    p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i],
      g = p[i + 1],
      b = p[i + 2];
    const amount = Math.max(
      0,
      Math.min(1, (r - g - 6) / 14, (g - b - 1) / 6, (r - 44) / 40),
    );
    for (let j = 0; j < 3; j++)
      p[i + j] = p[i + j] * (1 + (rgb[j] - 1) * amount);
  }
  ctx.putImageData(img, 0, 0);
}
// All anchor boxes use the same calibrated front-view photograph registration (320 by 960).
function anchor(g: Piece, male: boolean): [number, number, number, number] {
  const broad = male ? 1.14 : 1;
  const centered = (
    y: number,
    w: number,
    h: number,
  ): [number, number, number, number] => [
    160 - (w * broad) / 2,
    y,
    w * broad,
    h,
  ];
  switch (registered(g)) {
    case 'shirt':
      return centered(148, 247, 351);
    case 'skirt':
      return centered(353, 278, 433);
    case 'slingback':
      return [104, 897, 114, 64];
  }
  switch (slot(g)) {
    case '상의':
      return /탱크|슬리브리스/.test(g.name)
        ? centered(159, 153, 265)
        : centered(157, 227, 317);
    case '하의':
      return /스커트|치마/.test(g.name)
        ? centered(405, 225, 345)
        : centered(410, 190, 505);
    case '원피스':
      return centered(158, 201, 595);
    case '아우터':
      return centered(155, 247, /코트|롱/.test(g.name) ? 460 : 306);
    case '신발':
      return [101, 890, 121, 70];
    case '가방':
      return [222, 423, 90, 132];
    case '모자':
      return [101, 0, 120, 92];
    default:
      return /스카프|목도리|목걸이/.test(g.name)
        ? [105, 153, 113, 112]
        : [50, 494, 39, 20];
  }
}
// Follow the shoulder line measured on each neutral avatar, preserving the photographed collar and cuffs.
function sleeveMesh(
  asset: Raster,
  male: boolean,
  box: [number, number, number, number],
) {
  const [x, y, w, h] = box,
    aw = asset.width,
    ah = asset.height;
  const ctx = asset.getContext('2d', { willReadFrequently: true })!,
    pixels = ctx.getImageData(0, 0, aw, ah).data;
  const layer = surface(330, Math.ceil(h));
  const draw = layer.getContext('2d')!;
  const shoulders = male
    ? [
        [0, 63],
        [0.04, 99],
        [0.085, 182],
        [0.14, 244],
        [0.21, 267],
        [0.38, 277],
        [0.7, 270],
        [1, 242],
      ]
    : [
        [0, 56],
        [0.04, 91],
        [0.085, 173],
        [0.14, 207],
        [0.21, 223],
        [0.38, 228],
        [0.7, 223],
        [1, 210],
      ];
  for (let sy = 0; sy < ah; sy++) {
    const t = sy / (ah - 1),
      row = sy * aw * 4;
    let l = 0,
      r = aw - 1;
    while (l < r && pixels[row + l * 4 + 3] < 75) l++;
    while (r > l && pixels[row + r * 4 + 3] < 75) r--;
    if (r <= l) continue;
    const k = shoulders.findIndex((p, i) => i > 0 && p[0] >= t),
      lo = shoulders[k - 1],
      hi = shoulders[k];
    const target = lo[1] + ((hi[1] - lo[1]) * (t - lo[0])) / (hi[0] - lo[0]);
    const natural = ((r - l + 1) * w) / aw,
      tail = Math.max(0, Math.min(1, (0.79 - t) / 0.25));
    const desired = Math.max(natural, natural + (target - natural) * tail);
    draw.drawImage(
      asset,
      l,
      sy,
      r - l + 1,
      1,
      163 - desired / 2,
      t * (h - 1),
      desired,
      h / ah + 0.28,
    );
  }
  return { canvas: layer, x: 160 - 163, y };
}
const meshes = new WeakMap<
  Raster,
  Map<string, ReturnType<typeof sleeveMesh>>
>();
function dressedSleeves(
  asset: Raster,
  g: Piece,
  male: boolean,
  box: [number, number, number, number],
) {
  let cache = meshes.get(asset);
  if (!cache) {
    cache = new Map();
    meshes.set(asset, cache);
  }
  const key = String(male) + g.category;
  if (!cache.has(key)) cache.set(key, sleeveMesh(asset, male, box));
  return cache.get(key)!;
}
export async function paintAvatar(
  canvas: HTMLCanvasElement,
  figure: Figure,
  skin: string,
  items: Piece[],
  current: () => boolean,
) {
  const W = 400,
    H = 1000,
    off = surface(W, H),
    ctx = off.getContext('2d', { willReadFrequently: true })!;
  const [base, ...layers] = await Promise.all([
    loadBase(figure.base),
    ...items.map(loadPiece),
  ] as const);
  if (!current()) return;
  const center = 200,
    sy = Math.max(0.86, Math.min(1.01, figure.height / 170)),
    sx = Math.max(
      0.84,
      Math.min(
        1.16,
        1 + (figure.weight - 56) * 0.0035 + (figure.shoulder - 50) * 0.003,
      ),
    );
  const top = H - 22 - 960 * sy;
  ctx.translate(center - 160 * sx, top);
  ctx.scale(sx, sy);
  ctx.drawImage(base, 0, 0, 320, 960);
  complexion(ctx, W, H, skin);
  const misses: string[] = [],
    uncut: string[] = [];
  const order = [
    '하의',
    '원피스',
    '신발',
    '상의',
    '아우터',
    '모자',
    '액세서리',
    '가방',
  ];
  for (const i of items
    .map((_, i) => i)
    .sort(
      (a, b) => order.indexOf(slot(items[a])) - order.indexOf(slot(items[b])),
    )) {
    const g = items[i],
      asset = layers[i];
    if (!asset) {
      misses.push(g.name);
      continue;
    }
    if (!asset.cut) {
      uncut.push(g.name);
      continue;
    }
    const [x, y, w, h] = anchor(g, figure.base === 'm');
    ctx.save();
    ctx.shadowColor = 'rgba(42,30,24,.18)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1.6;
    if (
      !registered(g) &&
      (g.category === '상의' || g.category === '아우터') &&
      !/탱크|슬리브리스|반팔|폴로/.test(g.name)
    ) {
      const m = dressedSleeves(asset.canvas, g, figure.base === 'm', [
        x,
        y,
        w,
        h,
      ]);
      ctx.drawImage(m.canvas, m.x, m.y);
    } else ctx.drawImage(asset.canvas, x, y, w, h);
    ctx.restore();
  }
  // A continuous piecewise warp changes body proportions and clothes together.
  const dst = canvas.getContext('2d')!;
  canvas.width = W;
  canvas.height = H;
  const leg = Math.max(-0.06, Math.min(0.06, (figure.leg - 51) * 0.004));
  const torso = ((figure.torso ?? 100) - 100) * 0.001;
  const bands = [
    [0, 1],
    [0.19, 1 + (figure.shoulder - 50) * 0.007],
    [0.38, 1 + ((figure.waist ?? 50) - 50) * 0.009],
    [0.49, 1 + ((figure.hip ?? 50) - 50) * 0.007],
    [0.75, 1],
    [1, 1],
  ];
  for (let y = 0; y < H; y += 2) {
    const t = Math.max(0, Math.min(1, (y - top) / (960 * sy)));
    const k = Math.max(
        1,
        bands.findIndex((b, i) => i > 0 && b[0] >= t),
      ),
      lo = bands[k - 1],
      hi = bands[k];
    const scale = lo[1] + ((hi[1] - lo[1]) * (t - lo[0])) / (hi[0] - lo[0]);
    const offY = (torso - leg) * Math.sin(t * Math.PI) * 960 * sy;
    const nextOff =
      (torso - leg) *
      Math.sin(Math.min(1, t + 2 / (960 * sy)) * Math.PI) *
      960 *
      sy;
    dst.drawImage(
      off,
      0,
      y,
      W,
      2,
      center - (W * scale) / 2,
      y + offY,
      W * scale,
      2 + nextOff - offY + 0.4,
    );
  }
  return { misses, uncut };
}
