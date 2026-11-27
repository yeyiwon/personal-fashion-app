# 개인 옷장

React·TypeScript 서비스와 iPhone/iPad 앱이 이미지 처리, 데이터 모델, 저장소와 화면을 공유한다. 빈 옷장에서 시작해 내 사진을 직접 등록하고 함께 입을 옷을 골라 코디를 저장할 수 있다. 기록은 현재 브라우저 프로필 또는 iOS 앱의 IndexedDB에 보관된다. 테스트 기기와 브라우저가 달라지면 각자 빈 옷장에서 시작한다.

## 실행

Node 22.12 이상과 npm이 필요하다. 기본 기능은 계정, 결제, API 키 없이 동작한다.

```sh
npm ci
npm run dev
```

터미널에 출력되는 로컬 주소를 연다. `npm run build`는 strict TypeScript 검사와 프로덕션 빌드를 실행한다. iPhone/iPad는 `npm run build && python3 generate-ios.py && open Wardrobe.xcodeproj` 순서로 실행한다. 실기기에는 Xcode의 서명 팀 설정이 필요하다. [iOS 실행 및 검증](./IOS.md)

## 사용

1. **옷 등록**에서 촬영하거나 앨범 사진 여러 장을 선택한다. 한 장씩 이름, 분류, 대표색을 확인한 후 저장한다. 잘못된 파일은 건너뛸 수 있다.
2. 옷장에서 사진을 눌러 상태와 구매 가격을 수정하거나 **코디에 담기**를 선택한다. 대표색은 기기에서 계산하며 직접 바꿀 수 있다.
3. **직접 코디**에서 옷을 더 고르거나 조합 위의 사진을 눌러 뺀다. **코디 저장**에 이름을 입력한다. 저장한 조합은 **저장한 코디**에서 다시 열어 수정할 수 있다.
4. **데이터 설정**에서 의류·코디·원본 사진을 JSON 한 파일로 내보낼 수 있다. 전체 삭제는 확인 후 실행된다. 내보내기 파일에는 개인 사진이 포함되므로 보관과 공유에 유의한다. 가져오기와 기기 간 자동 동기화는 후속 범위다.

## 구현과 데이터

| 소스 | 책임 |
| --- | --- |
| domain.ts / storage.ts | 의류·코디 유효성 검사, IndexedDB 스키마 및 트랜잭션. 기기 프로필과 원본·파생 파일을 분리한다. |
| images.ts | 파일 서명과 크기·해상도 검사, 원본 SHA-256, 최대 1280px JPEG 미리보기, 대표색 계산. 원본 바이트 보존. |
| main.tsx / GarmentForm.tsx / presentation.tsx / style.css | 옷장·코디 상태, 여러 사진 순차 등록, 터치·키보드 조작, 미리보기 URL 수명, 재질·모션. |
| providers.ts / provider-test-double.ts | 인식·피팅 계약, 응답 검사, 명시적으로 주입하는 테스트 인식 공급자. 제품 실행 경로에는 모의 결과를 넣지 않는다. |
| WardrobeApp.swift / generate-ios.py | 동일 서비스 번들을 실행하는 iOS 앱, 시스템 사진 입력, 햅틱, 내보내기. |
| supabase-phase1.sql | 전용 프로젝트에 적용할 서버 마이그레이션 초안. 사용자별 행 정책, 소유권을 포함한 외래키, 비공개 이미지 버킷. 미적용·미검증. |

저장 한 벌은 의류 메타데이터와 이미지 원본·파생본을 한 트랜잭션으로 기록한다. 동일 파일은 해시 고유 인덱스로 차단한다. 다른 사진으로 찍은 같은 옷의 시각적 중복 검출은 후속 과제다. 코디는 순서 있는 실제 의류 ID 1–32개를 참조한다. 저장 시 구성원 존재 여부를 검사하며, 저장한 코디에서 사용하는 의류는 먼저 조합에서 제거해야 삭제할 수 있다. 내보내기는 한 트랜잭션에서 스냅샷을 잡는다. 이미지 원본은 EXIF를 포함할 수 있으며 외부로 전송하지 않는다.

## 디자인과 플랫폼 선택

처음에는 공개 직물 소장품으로 만든 천 표지를 보여준다. 첫 등록 이후에는 실제 선택한 옷과 그 옷의 대표색이 작업 공간을 차지한다. 사진 자체에는 색 필터를 적용하지 않는다. 옷 하나를 선택하면 같은 위치의 표지가 정보와 코디 조작부로 확장된다. 옷장에서 선택한 사진과 코디에 담긴 사진은 동일한 객체 전환 이름을 사용한다. 지원 브라우저가 크기·좌표를 보간하고, 모션 감소 설정에서는 즉시 상태가 바뀐다. 사용자의 의류, 가격, 피팅 사진을 예시로 자동 생성하지 않는다.

초기 구현은 React 19와 Vite의 모바일 웹 UI를 iOS WKWebView에서도 재사용한다. 이 개발 환경에서 Expo 패키지를 내려받아 네이티브 런타임을 검증할 수 없어, 설치된 Apple SDK로 동작하는 별도 앱 타깃을 선택했다. Expo Router·Skia·Three.js·에이전트 프레임워크는 이 흐름의 실행 의존성이 아니다. Android 네이티브, 실기기 촬영·배터리 측정은 후속 범위다.

표지에만 사용한 `cover.jpg`는 19세기 인도네시아 직물 **Headcloth (Ikat Tengahan)**이다. Met Collection API에서 공개 도메인 표시를 확인했다. 사용자 옷장 데이터에 등록되지 않는다. [소장품 308258](https://www.metmuseum.org/art/collection/search/308258) · [Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access)

## 공급자와 장기 로드맵

| 단계 | 범위와 연결 상태 |
| --- | --- |
| 1 · 개인 옷장 | 시스템 사진 입력, 로컬 이미지 처리, 저장·편집·삭제·검색, 실제 의류 코디 및 내보내기 구현. 계정 인증·클라우드 동기화는 전용 프로젝트와 별도 검증이 필요하다. |
| 2 · AI 코디 | Gemini/OpenAI 비전, 배경 제거, 상황·소재·색상 추천, 의류 고정·부분 교체, 허용 컴포넌트 기반 스타일리스트. 현재 기기 분석은 색상만 제공한다. |
| 3 · 모델 및 피팅 | 여성·남성 기본 모델, 키·몸무게·선택 신체 치수·헤어/사진과 비율 미리보기, FASHN Model Create / Try-On, Google VTO 검토. 유료 실사 생성, Bodygram·3DLOOK·Meshcapade 접근, 계약·동의·비용 상한 검증 전. |
| 4 · 구매 | 동의 기반 구매 이메일·캡처·URL 가져오기, 계약된 상품과 옵션·가격·쿠폰·배송비·재고·제휴 API, 구매 판단, 결제와 크레딧 원장. 판매자/구매자 권한을 구분한다. |
| 5 · 확장 | 취향, 착용 기록·캘린더·알림, 날씨·일정·여행·가격 알림, 패션 에이전트, AR·공간 인터페이스. |

상용 AI 요청은 보내지 않았다. Gemini·OpenAI에는 별도 서버 키와 목적별 동의가 필요하다. FASHN·Google VTO에는 계정·권한·과금 설정이 필요하다. 신체 계측과 상품 공급자는 계약 범위를 확인한 뒤 연결한다. 기존 연결 계정에서 이 서비스의 전용 Supabase 프로젝트를 찾지 못했다. 워커 도입 시 서버에서 요청 ID 중복 과금 방지, 사용자별 제한, 재시도·삭제, 짧은 만료 URL, 안전한 파일 검사와 정리 작업을 추가한다. `.env.example`의 키는 서버 전용이고 앱 번들에는 넣지 않는다. 클라우드 SQL은 운영 배포 전에 두 계정과 익명 역할로 정책, 원본 삭제와 참조 무결성을 검증해야 한다.

[Expo 이미지 입력](https://docs.expo.dev/versions/latest/sdk/imagepicker/) · [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) · [Supabase 접근 제어](https://supabase.com/docs/guides/storage/security/access-control) · [Gemini 이미지 이해](https://ai.google.dev/gemini-api/docs/image-understanding) · [FASHN 문서](https://docs.fashn.ai/)

## 변경 및 검증

0.1.0에서 기존 44개 스토리보드와 별도인 서비스 저장소를 시작했다. 기존 기획과 보관 자료는 아래 링크에서 이어 본다.

[전체 기획](https://app.notion.com/p/424aaf785efc8112b5d7e6999dffd6b4) · [MVP](https://app.notion.com/p/424aaf785efc819a8933fc5f33a95a56) · [API 전략](https://app.notion.com/p/425aaf785efc8114bd90dd21d8c715a9) · [디자인 회의록](https://app.notion.com/p/425aaf785efc81bfbe71cdf1095c8639) · [기존 스토리보드](https://fashion-studio-storyboard.vercel.app/storyboard.html) · [모션 연구](https://fashion-studio-storyboard.vercel.app/motion-lab.html) · [Figma](https://www.figma.com/design/cty2UuHQpl6dLSRce1hT04)

2026-11-27에 strict 타입 검사·Vite 빌드와 Chromium에서 실제 사진 두 장 등록 → 코디 저장 → 새로고침 → 같은 두 벌 다시 열기를 검증했다. 이름 검색, 가격 변경, 참조 중인 의류 삭제 차단, JSON 다운로드도 확인했다. 320/390/768/1280px에서 가로 넘침이 없었다. 실제 iOS 기기 촬영, 로그인, 결제 및 클라우드 백업은 검증 범위 밖이다.

로컬 서버를 띄운 상태에서 Chrome이 설치된 개발 기기는 `npm run test:flow`로 핵심 경로를 다시 검증할 수 있다. 테스트는 별도 브라우저 프로필에 생성한 두 장의 이미지만 사용한다. 기본 포트를 변경한 경우 `APP_TEST_URL`로 지정한다.
