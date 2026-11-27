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
    label: '지원 Mac의 의류 분류 · 자동 배경 제거',
    state: '실제 구현 완료',
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
  { page: 'home', label: '오늘의 코디 · 옷장 모드별 홈', state: '실제 구현 완료' },
  { page: 'closet', label: '샘플 의류 21벌 · 착장 화보', state: '샘플 데이터 기반 동작' },
  { page: 'register', label: '여러 사진 검토 · 대표색 · 중복 확인', state: '실제 구현 완료' },
  { page: 'camera', label: '연속 촬영 · 앨범 가져오기', state: '실제 구현 완료' },
  { page: 'purchases', label: '주문 캡처 · 선택한 이메일 파일 등록', state: '실제 구현 완료' },
  { page: 'purchases', label: '예시 판매처 동의 · 상품 선택', state: '샘플 데이터 기반 동작' },
  { page: 'purchases', label: '지원 Mac의 주문 캡처 문자 인식', state: '실제 구현 완료' },
  { page: 'ai', label: '상황과 선호도를 반영한 규칙 기반 추천 · 랜덤 조합', state: '실제 구현 완료' },
  { page: 'direct', label: '직접 배치 · 의류 고정 · 개별 교체', state: '실제 구현 완료' },
  { page: 'palette', label: '톤온톤 · 톤인톤 등 여섯 가지 배색', state: '실제 구현 완료' },
  { page: 'image-search', label: '입력 사진 대표색과 보유 의류 매칭', state: '실제 구현 완료' },
  { page: 'image-result', label: '참고 사진의 실루엣과 레이어 인식', state: '외부 API 연동 필요' },
  { page: 'model', label: '신체·헤어 설정 · 참고 사진 · 회전 도식', state: '실제 구현 완료' },
  { page: 'model', label: '남성형·여성형 기본 실사 모델 사진', state: '샘플 데이터 기반 동작' },
  { page: 'fitting', label: '선택 의류 변경 · 피팅 보드 저장', state: '실제 구현 완료' },
  { page: 'analysis', label: '샘플 상품 구매 전 조합 · 중복 후보', state: '샘플 데이터 기반 동작' },
  { page: 'compare', label: '동일 옵션 쿠폰·배송비·재고 비교', state: '샘플 데이터 기반 동작' },
  { page: 'wishlist', label: '관심 상품 · 목표 가격 저장', state: '실제 구현 완료' },
  { page: 'price-alerts', label: '실시간 가격 알림 발송', state: '외부 API 연동 필요' },
  { page: 'lookbook', label: '저장 코디 편집 · 룩북 이미지 내보내기', state: '실제 구현 완료' },
  { page: 'analytics', label: '착용 횟수 · 활용도 · 착용당 비용', state: '실제 구현 완료' },
  { page: 'travel', label: '날짜별 여행 코디 · 짐 체크리스트', state: '실제 구현 완료' },
  { page: 'preferences', label: '취향 설정 · 저장 및 착용 이력 반영', state: '실제 구현 완료' },
  { page: 'stylist', label: '질문에 맞는 코디·배색·날씨·구매 도구 구성', state: '실제 구현 완료' },
  { page: 'stylist', label: '서버 언어 모델 스타일 상담', state: '외부 API 연동 필요' },
  { page: 'privacy', label: '기기별 데이터 관리 · 개인 옷장 백업 복원', state: '실제 구현 완료' },
  { page: 'offline', label: '원격 업로드 중단 후 재개', state: '개발 예정' },
];
