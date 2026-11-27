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
