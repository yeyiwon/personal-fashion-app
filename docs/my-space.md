# 나의 공간 — 통합 디자인 브랜치 기록

브랜치 `design/claude-rebuild` · 기준 `design/bello 3e7135c` + `feature/bello-product-ai 6144d17` (병합 커밋 `a98f45d`).
이전 Claude 프로토타입 `design/claude-spatial 4fd9da0`은 그대로 보존했고 이 브랜치에 포함하지 않았다.

## 바뀐 것

| 영역 | 내용 | 파일 |
| --- | --- | --- |
| 홈 `#/home` | 실제 의류 사진을 경사 테이블에 올려 옮기고·돌리고·키우는 공간. 마네킹은 뒤에 서 있고 착용하지 않는다. | `MySpace.tsx`, `myspace.css`, `art/spaceStage.js` |
| BELLO 상태 | `BelloSignal`이 WebGL 셰이더 렌즈로 그려진다. WebGL이 없으면 기존 SVG. 상태는 `RoomAssistant`의 실제 값. | `BelloOrb.tsx`, `BelloSignal.tsx` |
| 공간 반응 | `RoomAssistant`에 선택 prop `onSignal` 추가(기존 호출부 영향 없음). 생각 중·구성 중에 테이블 위로 스캔이 지나간다. | `RoomAssistant.tsx` |
| 마네킹 | 얼굴 없는 조형 마네킹 GLB, 리깅 53본, 체형 모프 5종(`slim` `full` `bust` `hips` `shoulders`). | `public/media/bello/mannequin.glb`, `art/mannequin/` |

## 경로 대응

- `#/home` → 나의 공간(신규).
- `#/dressing` → 이전 홈이던 드레스룸(2D 착장). 기능·데이터 그대로.
- `#/fitting` `#/model` `#/stylist` → 기존 드레스룸 그대로(독립 피팅 모듈).
- 나머지 경로와 전체 메뉴(`BelloAtlas`)는 변경하지 않았다.

## 데이터

- 테이블 위 의류 = 기존 `selectedIds`. 배치는 `space.layout`(모드별), 고정은 기존 `avatar.locks`.
- 저장은 기존 `saveLook`. BELLO 제안은 기존 `BelloAdvice` 계약을 그대로 실행한다
  (`outfit` `swap` `lock` `save`는 공간 안에서, `palette` `shopping` `fitting`은 해당 화면으로 이동).

## 마네킹 출처

MakeHuman HM08 베이스 메시(MPFB2 2.0.18 번들, CC0 1.0). `art/mannequin/build.py`가 Blender(bpy 5.3)에서
체형 타깃 적용 → 눈·입 내부 면 제거와 구멍 메우기 → 머리 이완 → 리깅 → GLB 내보내기를 수행한다.
재빌드: `MPFB_DATA=<mpfb2>/src/mpfb/data python3 art/mannequin/build.py --export public/media/bello/mannequin.glb`.
의상 메시는 만들지 않았다(`garments.py`는 빈 훅).

## 확인한 것

- `tsc --noEmit`, `npm run build`, `interface-check.mjs`(나의 공간 단계 추가, 18항목), `service-check.mjs`, `backup-check.mjs` 통과.
- 헤드리스 Chrome(SwiftShader) 320×700, 390×844, 430×932, 1280×800에서 올리기·선택·조정·끌기·저장·모델 보기.

## 확인하지 못한 것

- 실제 iPhone Safari, 실기기 GPU·발열·배터리, 두 손가락 확대·회전의 실터치 동작.
- FASHN VTON v1.5 실행(가중치가 있는 Hugging Face에 작업 환경에서 접근 불가).
- 데스크톱 구도는 동작만 확인했고 별도 설계를 하지 않았다.

## 공간 이동 (2차)

| 경로 | 동작 | 파일 |
| --- | --- | --- |
| 포인터(터치·마우스) | BELLO 마크를 누르면 액체 방울이 두 호를 따라 갈라져 나온다. 누른 채 방울 위에서 놓으면 그 공간으로 바로 이동한다. 방울 위에 0.38초 머물거나 탭하면 그 공간의 기능이 작은 방울로 돋아난다. | `SpaceFlow.tsx`, `space-flow.css` |
| 키보드·검색·전체 색인 | 마크에서 Enter, 또는 흐름 메뉴의 검색 방울 → 목록형 대화상자(검색, 공간별 펼침, 전체 기능 색인). | `BelloAtlas.tsx`, `SpaceFold.tsx`, `atlas-fold.css` |

- 액체는 SVG 한 덩어리다. 흐림 → 임계값 → 같은 높이맵에 스펙큘러 조명을 계산하므로 합쳐짐·갈라짐과 광택이 형태에서 나온다.
- 이전 궤도형 메뉴(`SpaceCarousel.tsx`, `Relic`)는 파일을 남겼고 더 이상 화면에 쓰지 않는다.
- `main.tsx`의 `openAtlas`는 포인터 누름이 흐름 메뉴에서 처리 중이면 대화상자를 열지 않는다(`flowGate`).
- `interface-check.mjs`에 흐름 메뉴 탭 경로·Escape·키보드 경로를 추가했다. 한 획 이동(누름→끌기→놓기)은 헤드리스 마우스로 `#/wishlist`, `#/closet` 도착을 확인했다. 실제 터치 기기에서는 미확인.

## 아트 디렉션 (3차)

`direction.css`가 마지막에 로드되어 전 화면의 톤·타이포·조작부 재질을 하나로 정리한다.
- 두 톤 구조: Optical White 바탕 + Deep Slate 주체. Silver Blue는 면, Lavender·Hologram은 신호.
- 제목은 31–42px, 자간 -0.058em. 보조 글자는 Slate 70% 아래로 내려가지 않는다.
- 주 동작 하나만 Slate 채움, 나머지는 테두리 또는 밑줄 텍스트. 분류 선택은 채움 알약.
- 홈: 그래파이트 마네킹을 밝은 개구부 앞 실루엣으로 세우고, 테이블은 흰 면 + Slate 옆면.
- 각 화면의 레이아웃 구조 자체는 이 단계에서 바꾸지 않았다(토큰·재질·타이포만 적용). 다크 테마 토큰은 건드리지 않았다.

## 내 옷장 아카이브 (4차)

`#/closet` → `Archive.tsx`, `archive.css`. 옷걸이·봉 연출(`ClosetRail`)은 이 경로에서 쓰지 않는다(파일은 남김).
- 컬렉션(밝음): 수량 숫자와 제목, 단어형 분류, 밑줄 검색, 불규칙한 2열 리듬의 의류 사진. 탭 → 의류 상세.
- 공간(Midnight): 가운데 옷이 앞으로 나오고 나머지는 깊이로 물러난다. 아래로 끌어내리면 홈 코디 테이블로 간다.
- 유지: 옷 등록·촬영·구매 내역, 검색, 분류, 여러 벌 선택 → 코디 공간, 샘플/개인 옷장 전환.
- 이 화면은 공통 헤더·탭 줄 없이 BELLO 마크(공간 이동)만 둔다.
- `service-check.mjs`는 상세 진입이 한 번의 탭이 된 것에 맞춰 한 줄을 고쳤다.
