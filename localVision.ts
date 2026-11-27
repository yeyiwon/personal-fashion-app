import type { Category } from './domain';
let availability: Promise<boolean> | undefined;
export function visionAvailable() {
  return (availability ??=
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? fetch('/api/room-vision')
          .then((r) => r.json())
          .then((r) => r.available === true)
          .catch(() => false)
      : Promise.resolve(false));
}
const categories: [Category, RegExp][] = [
  ['원피스', /\b(dress|gown|frock)\b/i],
  ['아우터', /\b(jacket|coat|parka|blazer)\b/i],
  ['상의', /\b(shirt|blouse|sweater|jersey|cardigan|top|t-shirt)\b/i],
  ['하의', /\b(skirt|pants|jeans|trousers|shorts)\b/i],
  ['신발', /\b(footwear|shoe|sandal|sneaker|boot)\b/i],
  ['가방', /\b(bag|purse|handbag|backpack)\b/i],
  ['기타', /\b(hat|cap|scarf|jewelry)\b/i],
];
export async function analyseGarment(image: string) {
  if (!(await visionAvailable())) return null;
  const res = await fetch('/api/room-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw Error('기기 분석이 끝나지 않았어요.');
  const r = await res.json();
  const labels = (r.labels ?? []) as { name: string; score: number }[];
  const category = labels
    .filter((l) => l.score >= 0.25)
    .map(
      (l) =>
        categories.find(([, rx]) => rx.test(l.name.replace(/_/g, ' ')))?.[0],
    )
    .find(Boolean);
  return {
    category,
    cutout:
      typeof r.cutout === 'string' &&
      r.cutout.startsWith('data:image/png;base64,')
        ? (r.cutout as string)
        : null,
  };
}
