import type { Category, Garment } from './domain';
import { sampleGarments } from './sample';

export type Figure = {
  base: 'f' | 'm';
  height: number;
  weight: number;
  shoulder: number;
  leg: number;
  waist?: number;
  hip?: number;
  torso?: number;
  hairColor?: string;
  hair: 'short' | 'bob' | 'long';
};
export const initialFigure: Figure = {
  base: 'f',
  height: 168,
  weight: 56,
  shoulder: 50,
  leg: 51,
  torso: 100,
  hairColor: '#3f302b',
  hair: 'bob',
};
export const hairNames = { short: '쇼트', bob: '단발', long: '긴 머리' };

export type Product = {
  id: string;
  name: string;
  category: Category;
  color: string;
  tone: string;
  material: string;
  price: number;
};
const shopInventory: [id: string, tone: string, price: number][] = [
  ['trench', '샌드', 149000],
  ['merino', '네이비', 79000],
  ['polo', '버터 옐로', 55000],
  ['trouser', '그래파이트', 89000],
  ['bag', '에스프레소', 99000],
  ['shirt', '아이보리', 59000],
  ['loafer', '블랙', 119000],
  ['dress', '와인', 95000],
  ['jeans', '인디고', 69000],
  ['bangle', '실버', 39000],
  ['scarf', '라일락', 49000],
  ['cardigan', '로즈', 83000],
];
export const products: Product[] = shopInventory.map(([id, tone, price]) => {
  const item = sampleGarments.find((g) => g.id === 'sample-' + id);
  if (!item) throw new Error('샘플 상품 사진을 찾을 수 없어요.');
  return {
    id,
    name: item.name,
    category: item.category,
    color: item.color,
    material: item.material || '',
    tone,
    price,
  };
});
export const photoPath = (id: string) => '/media/capsule/' + id + '.webp';
export const editorial = (id: string) => '/media/editorial/' + id + '.webp';
export const won = (price: number) => price.toLocaleString('ko-KR') + '원';

function channels(hex: string) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}
export function colorDistance(a: string, b: string) {
  const x = channels(a),
    y = channels(b);
  return Math.sqrt(
    x.reduce((sum, v, i) => sum + (v - y[i]) ** 2 * [0.3, 0.59, 0.11][i], 0),
  );
}
function canPair(category: Category, other: Category) {
  if (category === other) return false;
  return !(
    (category === '원피스' && ['상의', '하의'].includes(other)) ||
    (other === '원피스' && ['상의', '하의'].includes(category))
  );
}
export function matchWardrobe<T extends Garment>(
  product: Product,
  garments: T[],
) {
  const neighbors = garments.filter(
    (g) =>
      g.category === product.category &&
      colorDistance(g.color, product.color) < 48,
  );
  const compatible = garments
    .filter(
      (g) =>
        canPair(g.category, product.category) && g.condition !== '수선 필요',
    )
    .sort(
      (a, b) =>
        colorDistance(a.color, product.color) -
        colorDistance(b.color, product.color),
    );
  const pairs: T[] = [];
  for (const item of compatible) {
    if (
      !pairs.some((g) => g.category === item.category) &&
      pairs.every((g) => canPair(g.category, item.category))
    )
      pairs.push(item);
  }
  return { neighbors, pairs: pairs.slice(0, 4) };
}
export function matchReference<T extends Garment>(
  color: string,
  garments: T[],
) {
  const ranked = garments
    .filter((g) => g.condition !== '수선 필요')
    .sort(
      (a, b) => colorDistance(a.color, color) - colorDistance(b.color, color),
    );
  const picks: T[] = [];
  for (const item of ranked) {
    if (picks.every((other) => canPair(other.category, item.category)))
      picks.push(item);
    if (picks.length === 4) break;
  }
  return picks;
}
