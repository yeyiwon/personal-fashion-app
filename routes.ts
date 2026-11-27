export const sections: { title: string; pages: Record<string, string> }[] = [
  {
    title: '패션 공간',
    pages: {
      home: '홈',
      space: '공간형 옷장',
      closet: '내 옷장',
      garment: '의류 상세',
      register: '옷 등록',
      camera: '연속 촬영',
      recognition: 'AI 의류 인식 · 배경 제거',
      purchases: '구매 내역',
      'purchase-link': '상품 링크 등록',
    },
  },
  {
    title: '코디 스튜디오',
    pages: {
      ai: 'AI 코디',
      direct: '직접 코디',
      colors: '색상별 코디',
      palette: '팔레트 조합',
      'color-analysis': '옷장 색상 분포',
      result: '코디 결과',
      stylist: 'AI 스타일리스트',
      'image-search': '이미지로 코디 찾기',
      'image-result': '이미지 분석',
    },
  },
  {
    title: '모델과 피팅',
    pages: {
      model: '개인 모델',
      fitting: '가상 피팅',
      'fitting-result': '착장 비교',
    },
  },
  {
    title: '맞춤 쇼핑',
    pages: {
      shop: '맞춤 쇼핑',
      product: '상품 상세',
      analysis: '구매 전 코디 분석',
      compare: '동일 옵션 가격 비교',
      alternatives: '구매 후보 비교',
      wishlist: '관심 상품',
      'price-alerts': '가격 알림',
    },
  },
  {
    title: '패션 라이프',
    pages: {
      saved: '저장한 코디',
      lookbook: '나의 룩북',
      wear: '착용 기록',
      calendar: '코디 캘린더',
      analytics: '옷장 활용도',
      travel: '여행 코디 · 짐 싸기',
      weather: '날씨와 일정',
    },
  },
  {
    title: '내 설정',
    pages: {
      preferences: '스타일 취향',
      account: '마이페이지',
      privacy: '개인정보',
      connections: '외부 서비스 연결',
      data: '데이터 관리',
      onboarding: '시작 안내',
    },
  },
];
export const stateRoutes: Record<string, string> = {
  'closet-empty': '빈 옷장',
  review: '등록 검토',
  'recognition-pending': '의류 분석 대기',
  'analysis-error': '인식 실패',
  offline: '오프라인 등록',
  'camera-denied': '카메라 접근',
  duplicate: '중복 의류',
  'fitting-wait': '피팅 대기',
  'fitting-error': '피팅 오류',
  'price-unavailable': '가격 미제공',
  'product-unavailable': '상품 정보 미제공',
};
export const titles: Record<string, string> = {
  ...Object.assign({}, ...sections.map((s) => s.pages)),
  ...stateRoutes,
  tools: '전체 메뉴',
};
export const closetPages = [
  'closet',
  'garment',
  'register',
  'camera',
  'recognition',
  'purchases',
  'purchase-link',
  'direct',
  'saved',
  'closet-empty',
  'review',
  'recognition-pending',
  'analysis-error',
  'offline',
  'camera-denied',
  'duplicate',
];
export const lookPages = [
  'ai',
  'colors',
  'palette',
  'color-analysis',
  'result',
  'stylist',
  'wear',
  'calendar',
  'analytics',
  'travel',
  'weather',
];
export const atelierPages = [
  'model',
  'fitting',
  'fitting-result',
  'fitting-wait',
  'fitting-error',
  'image-search',
  'image-result',
  'shop',
  'product',
  'analysis',
  'compare',
  'alternatives',
  'wishlist',
  'price-alerts',
  'price-unavailable',
  'product-unavailable',
];
export const navItems = [
  ['home', '홈', 'home'],
  ['closet', '옷장', 'closet'],
  ['ai', '코디', 'layer'],
  ['fitting', '피팅', 'fit'],
  ['shop', '쇼핑', 'shop'],
];
export function activeTab(page: string) {
  if (
    ['direct', 'saved', 'image-search', 'image-result', ...lookPages].includes(
      page,
    )
  )
    return 'ai';
  if (
    [
      'model',
      'fitting',
      'fitting-result',
      'fitting-wait',
      'fitting-error',
    ].includes(page)
  )
    return 'fitting';
  if (atelierPages.includes(page)) return 'shop';
  if (closetPages.includes(page) || page === 'space') return 'closet';
  return page;
}
