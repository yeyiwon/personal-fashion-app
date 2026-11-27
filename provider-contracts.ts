import type { Category } from './domain';
import type { FittingProvider, RecognitionProvider } from './providers';
import type { StyleTool } from './stylistActions';

type AuthorizedAsset = { assetId: string; consentId: string };
type JobRequest = { idempotencyKey: string; consentId: string };
export type GenerationState =
  | { state: 'queued' | 'running'; jobId: string }
  | { state: 'ready'; jobId: string; derivedAssetId: string; provider: string }
  | { state: 'failed'; jobId: string; retryable: boolean; reason: string };

export interface BackgroundRemovalProvider {
  remove(input: AuthorizedAsset & JobRequest): Promise<GenerationState>;
}
export interface ModelProvider {
  generate(
    input: JobRequest & {
      base: 'f' | 'm';
      heightCm: number;
      weightKg: number;
      proportions: {
        shoulder: number;
        waist: number;
        hip: number;
        torso: number;
        leg: number;
      };
      hair: { style: string; color: string };
      faceAssetId?: string;
      bodyAssetId?: string;
    },
  ): Promise<GenerationState>;
  status(jobId: string): Promise<GenerationState>;
}
export interface PurchaseHistoryProvider {
  // Merchant OAuth and mail scopes must be granted per account. Only reviewed lines become garments.
  read(input: {
    accountConnectionId: string;
    consentId: string;
    cursor?: string;
  }): Promise<{
    nextCursor?: string;
    purchases: {
      sourceTransactionId: string;
      lineId: string;
      purchasedAt: string;
      name: string;
      merchant: string;
      total: number | null;
      currency: string;
      category?: Category;
      productUrl?: string;
    }[];
  }>;
  disconnect(accountConnectionId: string): Promise<void>;
}
export interface OutfitStylistProvider {
  plan(input: {
    question: string;
    allowedTools: StyleTool[];
    garmentIds: string[];
    consentId: string;
  }): Promise<{
    tools: StyleTool[];
    garmentIds: string[];
    reasons: string[];
    source: 'provider';
  }>;
}
export interface PriceFeedProvider {
  offers(input: { productId: string; variantId: string }): Promise<
    {
      merchant: string;
      productId: string;
      variantId: string;
      observedAt: string;
      currency: string;
      price: number;
      shipping: number | null;
      discount: number | null;
      eligibleCoupon: number | null;
      inStock: boolean | null;
    }[]
  >;
}
export interface PriceAlertProvider {
  subscribe(input: {
    productId: string;
    variantId: string;
    threshold: number;
    currency: string;
    channelConsentId: string;
  }): Promise<{ subscriptionId: string }>;
  unsubscribe(subscriptionId: string): Promise<void>;
}
export interface ServiceProviders {
  recognition: RecognitionProvider;
  background: BackgroundRemovalProvider;
  model: ModelProvider;
  fitting: FittingProvider;
  receipts: PurchaseHistoryProvider;
  stylist: OutfitStylistProvider;
  prices: PriceFeedProvider;
  alerts: PriceAlertProvider;
}
// This catalogue drives the connection screen. A displayed contract does not activate a provider.
export const providerDirectory: Record<
  keyof ServiceProviders,
  { name: string; page: string; requires: string; local: string }
> = {
  recognition: {
    name: '의류 분류 · 소재 인식',
    page: 'recognition',
    requires: '서버 키와 의류 사진 전송 동의',
    local: '사진 검증, 대표색 추출, 직접 분류',
  },
  background: {
    name: '자동 배경 제거',
    page: 'recognition',
    requires: '상업 사용 가능한 모델 또는 API 계약',
    local: '원본 보관과 미리보기',
  },
  model: {
    name: '개인 모델 생성',
    page: 'model',
    requires: '이미지 생성 권한, 비용 승인과 사진 처리 동의',
    local: '체형 도식, 회전, 예시 모델 선택',
  },
  fitting: {
    name: 'AI 가상 피팅',
    page: 'fitting',
    requires: '피팅 크레딧, 서버 키, 생성 작업 큐',
    local: '옷 선택, 피팅 보드, 예시 착장 비교',
  },
  receipts: {
    name: '구매 계정 연결',
    page: 'purchases',
    requires: '이메일 OAuth 또는 쇼핑몰의 구매자 이력 사용 승인',
    local: '주문 파일, 캡처와 상품 링크 수기 확인',
  },
  stylist: {
    name: '서버 AI 스타일리스트',
    page: 'stylist',
    requires: '서버 모델 사용 권한과 호출 비용 승인',
    local: '요청별 도구 구성, 지원 기기의 설치된 모델 선택',
  },
  prices: {
    name: '실시간 옵션별 가격',
    page: 'compare',
    requires: '옵션 식별이 가능한 판매처 가격 피드',
    local: '샘플 가격과 배송 조건, 할인 비교',
  },
  alerts: {
    name: '가격 변동 알림',
    page: 'price-alerts',
    requires: '가격 수집 권한과 푸시 수신 동의',
    local: '관심 상품별 목표가 저장',
  },
};
