export const CATEGORIES = [
  '상의',
  '하의',
  '아우터',
  '원피스',
  '신발',
  '가방',
  '기타',
] as const;
export const CONDITIONS = ['착용 중', '보관 중', '수선 필요'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Condition = (typeof CONDITIONS)[number];

export interface PurchaseInfo {
  sourceKey?: string;
  url: string;
  shop: string;
  purchasedAt: string;
}

export interface GarmentDraft {
  name: string;
  category: Category;
  condition?: Condition;
  price?: number | null;
  color?: string;
  purchase?: PurchaseInfo;
}

export interface Garment {
  id: string;
  name: string;
  category: Category;
  condition: Condition;
  purchase?: PurchaseInfo;
  photoUnavailable?: boolean;
  price: number | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Outfit {
  id: string;
  name: string;
  garmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type WardrobeErrorCode =
  | 'INVALID'
  | 'DUPLICATE'
  | 'IN_USE'
  | 'NOT_FOUND'
  | 'STORAGE'
  | 'QUOTA'
  | 'BLOCKED';

export class WardrobeError extends Error {
  readonly code: WardrobeErrorCode;
  readonly existingId?: string;

  constructor(code: WardrobeErrorCode, message: string, existingId?: string) {
    super(message);
    this.name = 'WardrobeError';
    this.code = code;
    if (existingId !== undefined) this.existingId = existingId;
  }
}

export function itemName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    throw new WardrobeError('INVALID', '이름을 1~80자로 입력해 주세요.');
  }
  return value.trim();
}

export function garmentFields(draft: GarmentDraft, fallbackColor: string) {
  const name = itemName(draft.name);
  const category = draft.category;
  const condition = draft.condition ?? CONDITIONS[0];
  const color = draft.color ?? fallbackColor;
  const price = draft.price ?? null;
  if (!CATEGORIES.includes(category) || !CONDITIONS.includes(condition)) {
    throw new WardrobeError(
      'INVALID',
      '목록에 있는 분류와 의류 상태를 선택해 주세요.',
    );
  }
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
    throw new WardrobeError('INVALID', '대표색을 다시 선택해 주세요.');
  }
  if (
    price !== null &&
    (!Number.isSafeInteger(price) || price < 0 || price > 9999999999)
  ) {
    throw new WardrobeError(
      'INVALID',
      '구매 가격은 0~9,999,999,999원의 정수로 입력해 주세요.',
    );
  }
  const purchase = draft.purchase;
  if (purchase) {
    if (
      (purchase.sourceKey !== undefined &&
        (typeof purchase.sourceKey !== 'string' ||
          purchase.sourceKey.length > 150)) ||
      typeof purchase.shop !== 'string' ||
      purchase.shop.trim().length > 100 ||
      typeof purchase.url !== 'string' ||
      purchase.url.length > 2048 ||
      typeof purchase.purchasedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(purchase.purchasedAt)
    ) {
      throw new WardrobeError('INVALID', '구매 정보를 다시 확인해 주세요.');
    }
    if (purchase.url) {
      try {
        const url = new URL(purchase.url);
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error();
      } catch {
        throw new WardrobeError(
          'INVALID',
          'http 또는 https로 시작하는 상품 링크를 입력해 주세요.',
        );
      }
    }
  }
  return {
    name,
    category,
    condition,
    color: color.toLowerCase(),
    price,
    ...(purchase ? { purchase } : {}),
  };
}

export function outfitMembers(value: readonly string[]): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 32 ||
    value.some((id) => typeof id !== 'string' || !id || id.length > 128) ||
    new Set(value).size !== value.length
  ) {
    throw new WardrobeError(
      'INVALID',
      '옷장에서 서로 다른 의류를 1~32벌 골라 주세요.',
    );
  }
  return [...value];
}
