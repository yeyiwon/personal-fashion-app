import type { Garment, Category } from './domain';

export const occasions = ['일상', '출근', '데이트', '여행'] as const;
export const climates = ['선선함', '따뜻함', '추움', '비·눈'] as const;
export type Occasion = (typeof occasions)[number];
export type Climate = (typeof climates)[number];
export type Conditions = { occasion: Occasion; weather: Climate };
export const harmonyNotes = {
  톤온톤: '비슷한 색상에서 밝기 차이를 찾습니다.',
  톤인톤: '밝기와 채도가 가까운 다른 색을 찾습니다.',
  유사색: '색상환에서 가까운 두 색을 이어요.',
  보색: '기준색 맞은편에 있는 색으로 대비를 만들어요.',
  '삼색 배색': '색상환을 세 등분한 색을 찾아 조합해요.',
  '포인트 컬러': '기준색 한 벌과 채도가 낮은 옷을 함께 골라요.',
} as const;
export type Harmony = keyof typeof harmonyNotes;
export const firstConditions: Conditions = {
  occasion: '일상',
  weather: '선선함',
};
export const firstPreferences = { style: '미니멀', color: '#839aad' };

function labCurve(value: number) {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

// Convert sRGB into CIELAB (D65) so hue and lightness can be weighted separately.
function lab(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const x = labCurve((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047);
  const y = labCurve(r * 0.2126729 + g * 0.7151522 + b * 0.072175);
  const z = labCurve((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883);
  const a = 500 * (x - y),
    blue = 200 * (y - z);
  return {
    light: 116 * y - 16,
    a,
    b: blue,
    chroma: Math.hypot(a, blue),
    hue: Math.atan2(blue, a),
  };
}

function colorScore(
  hex: string,
  target: string,
  harmony: Harmony | undefined,
  index: number,
) {
  const color = lab(hex),
    base = lab(target);
  const light = Math.abs(color.light - base.light),
    chroma = Math.abs(color.chroma - base.chroma);
  const hue =
    Math.abs(
      Math.atan2(
        Math.sin(color.hue - base.hue),
        Math.cos(color.hue - base.hue),
      ),
    ) / Math.PI;
  if (!harmony || !index)
    return 100 - Math.hypot(light, color.a - base.a, color.b - base.b);
  if (harmony === '포인트 컬러') return 100 - color.chroma * 1.5;
  if (harmony === '보색' || harmony === '삼색 배색' || harmony === '유사색') {
    const goal =
      harmony === '보색' ? 1 : harmony === '삼색 배색' ? 2 / 3 : 0.16;
    return (
      100 -
      Math.abs(hue - goal) * Math.min(color.chroma + 10, 50) * 2 -
      Math.abs(color.chroma - base.chroma) * 0.5
    );
  }
  if (harmony === '톤인톤')
    return (
      100 -
      light * 1.3 -
      chroma * 0.75 +
      hue * Math.min(color.chroma, base.chroma) * 0.35
    );
  return (
    100 -
    hue * Math.min(color.chroma, base.chroma) * 2.2 -
    chroma * 0.7 -
    Math.abs(light - 25) * 0.22
  );
}

const occasionTerms: Record<Occasion, RegExp> = {
  일상: /데님|진|티셔츠|스니커|니트|셔츠/,
  출근: /재킷|블레이저|셔츠|슬랙스|트라우저|로퍼|토트|코트/,
  데이트: /원피스|드레스|니트|스커트|슬링백|실크|숄더/,
  여행: /데님|티셔츠|스니커|백팩|운동화|팬츠|패딩/,
};
const weatherTerms: Record<Climate, RegExp> = {
  따뜻함: /리넨|반팔|슬리브리스|탱크|샌들|린넨/,
  선선함: /니트|셔츠|데님|재킷|가디건/,
  추움: /코트|울|메리노|패딩|부츠|니트|기모/,
  '비·눈': /부츠|파카|재킷|트렌치|나일론|레인/,
};
export const paletteChoices = [
  { name: '슬레이트 블루', hex: '#71899b' },
  { name: '버터 옐로', hex: '#decc8b' },
  { name: '올리브', hex: '#808966' },
  { name: '로즈', hex: '#b98796' },
  { name: '잉크', hex: '#373b47' },
  { name: '오트', hex: '#c5b9a6' },
];

export function colorFamily(hex: string) {
  const c = lab(hex);
  if (c.light < 22) return '블랙';
  if (c.chroma < 10) return c.light > 81 ? '화이트' : '그레이';
  let angle = (c.hue * 180) / Math.PI;
  if (angle < 0) angle += 360;
  if (angle < 50 || angle >= 325) return '레드·핑크';
  if (angle < 105) return c.chroma < 33 ? '베이지·브라운' : '옐로·오렌지';
  if (angle < 200) return '그린';
  if (angle < 305) return '블루';
  return '퍼플';
}

type Item = Garment & { material?: string };
export function arrange<T extends Item>(
  items: T[],
  conditions: Conditions,
  options: {
    locked?: string[];
    variation?: number;
    color?: string;
    harmony?: Harmony;
    style?: string;
    signals?: Record<string, number>;
  } = {},
): T[] {
  const available = items.filter((g) => g.condition !== '수선 필요');
  const locked = (options.locked ?? []).flatMap((id) =>
    available.filter((g) => g.id === id),
  );
  const slots: Category[] = [];
  const has = (category: Category) =>
    available.some((g) => g.category === category);
  const pinned = (category: Category) =>
    locked.some((g) => g.category === category);
  const dress =
    pinned('원피스') ||
    (!pinned('상의') &&
      !pinned('하의') &&
      has('원피스') &&
      (conditions.occasion === '데이트' || (!has('상의') && !has('하의'))));
  if (dress) slots.push('원피스');
  else slots.push('상의', '하의');
  if (conditions.weather !== '따뜻함' || pinned('아우터')) slots.push('아우터');
  slots.push('신발', '가방');
  if (pinned('기타') || (!slots.some(has) && has('기타'))) slots.push('기타');
  const offset = Math.max(0, options.variation ?? 0);
  return slots.flatMap((category, index) => {
    const fixed = locked.find((g) => g.category === category);
    if (fixed) return [fixed];
    const candidates = available.filter((g) => g.category === category);
    const score = (g: T) => {
      const text = g.name + ' ' + (g.material ?? '');
      let value = occasionTerms[conditions.occasion].test(text) ? 15 : 0;
      if (weatherTerms[conditions.weather].test(text)) value += 18;
      if (options.style?.includes('캐주얼') && /데님|스니커|티셔츠/.test(text))
        value += 9;
      if (options.style?.includes('미니멀') && lab(g.color).chroma < 24)
        value += 6;
      if (
        options.style?.includes('클래식') &&
        /코트|셔츠|슬랙스|로퍼/.test(text)
      )
        value += 9;
      if (options.color)
        value +=
          colorScore(g.color, options.color, options.harmony, index) *
          (options.harmony ? 1 : 0.17);
      return value + Math.min(24, options.signals?.[g.id] ?? 0);
    };
    candidates.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
    return candidates.length ? [candidates[offset % candidates.length]] : [];
  });
}

export const localDate = (d = new Date()) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
export const dateAtNoon = (key: string) => new Date(key + 'T12:00:00');
export function shiftDate(key: string, days: number) {
  const date = dateAtNoon(key);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function tripLength(start: string, end: string) {
  return (
    (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) /
      86400000 +
    1
  );
}
export function idsToItems<T extends Garment>(ids: string[], garments: T[]) {
  return ids.flatMap((id) => garments.filter((g) => g.id === id));
}

export function affinity(
  outfits: { garmentIds: string[] }[],
  worn: { garmentIds: string[] }[],
) {
  const counts: Record<string, number> = {};
  for (const outfit of outfits)
    for (const id of outfit.garmentIds) counts[id] = (counts[id] ?? 0) + 3;
  for (const entry of worn)
    for (const id of entry.garmentIds) counts[id] = (counts[id] ?? 0) + 5;
  return counts;
}

// Alternate one eligible slot at a time to keep outfit suggestions distinct on small wardrobes.
export function suggestions<T extends Item>(
  items: T[],
  conditions: Conditions,
  options: NonNullable<Parameters<typeof arrange>[2]>,
) {
  const best = arrange(items, conditions, { ...options, variation: 0 });
  if (!best.length) return [];
  const looks = [best],
    keys = new Set([best.map((g) => g.id).join('|')]);
  for (
    let distance = 1;
    distance < items.length && looks.length < 3;
    distance++
  ) {
    const variant = arrange(items, conditions, {
      ...options,
      variation: distance,
    });
    for (let slot = 0; slot < variant.length && looks.length < 3; slot++) {
      if (variant[slot].id === best[slot].id) continue;
      const choice = best.map((g, i) => (i === slot ? variant[slot] : g));
      const key = choice.map((g) => g.id).join('|');
      if (!keys.has(key)) {
        looks.push(choice);
        keys.add(key);
      }
    }
  }
  return looks;
}

export function shuffleLook<T extends Item>(
  current: T[],
  available: T[],
  locked: string[],
): T[] {
  const alternatives = current.map((g) =>
    locked.includes(g.id)
      ? []
      : available.filter(
          (o) =>
            o.condition !== '수선 필요' &&
            o.category === g.category &&
            o.id !== g.id,
        ),
  );
  const eligible = alternatives.flatMap((options, index) =>
    options.length ? [index] : [],
  );
  if (!eligible.length) return current;
  const required = eligible[Math.floor(Math.random() * eligible.length)];
  return current.map((g, i) => {
    const options = alternatives[i];
    if (!options.length || (i !== required && Math.random() < 0.48)) return g;
    return options[Math.floor(Math.random() * options.length)];
  });
}
