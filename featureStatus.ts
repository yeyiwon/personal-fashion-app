// Product capabilities can have a working local input and a separate provider result.
export type ImplementationState =
  | '실제 구현 완료'
  | '샘플 데이터 기반 동작'
  | '외부 API 연동 필요'
  | '개발 예정';
export const capabilities: {
  page: string;
  label: string;
  state: ImplementationState;
}[] = [
  {
    page: 'closet',
    label: '의류 등록 · 수정 · 기기 보관',
    state: '실제 구현 완료',
  },
  {
    page: 'space',
    label: '의류 레일 탐색 · 선택 · 피팅 보드',
    state: '실제 구현 완료',
  },
  {
    page: 'recognition',
    label: 'AI 재질 인식 · 자동 배경 제거',
    state: '외부 API 연동 필요',
  },
  {
    page: 'purchases',
    label: '구매일 · 가격 · 링크 수기 등록',
    state: '실제 구현 완료',
  },
  {
    page: 'purchases',
    label: '이메일 · 쇼핑몰 구매 이력 동기화',
    state: '외부 API 연동 필요',
  },
  {
    page: 'colors',
    label: '기기 내 배색 분석 · 코디 편집',
    state: '실제 구현 완료',
  },
  { page: 'model', label: '체형 비율 조작', state: '실제 구현 완료' },
  {
    page: 'fitting-result',
    label: '같은 예시 모델의 착장 비교',
    state: '샘플 데이터 기반 동작',
  },
  {
    page: 'fitting',
    label: '실제 개인 모델 · 피팅 사진 생성',
    state: '외부 API 연동 필요',
  },
  {
    page: 'shop',
    label: '맞춤 상품 카탈로그 · 동일 옵션 비교',
    state: '샘플 데이터 기반 동작',
  },
  {
    page: 'shop',
    label: '제휴 상품 실검색 · 실시간 시세',
    state: '외부 API 연동 필요',
  },
  {
    page: 'weather',
    label: '도시 예보 · 외출 일정 입력',
    state: '실제 구현 완료',
  },
  {
    page: 'calendar',
    label: '착용 기록 · 월간 캘린더',
    state: '실제 구현 완료',
  },
  {
    page: 'account',
    label: '계정 로그인 · 여러 기기 간 동기화',
    state: '개발 예정',
  },
];
