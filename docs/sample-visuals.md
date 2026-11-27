# 샘플 옷장 이미지

샘플 옷장 21점과 화보 5장은 프로젝트용으로 생성한 가상의 의류·모델이다. 실제 구매 상품, 이용자의 소지품, 개인의 사진을 사용하지 않았다. 별도 유료 패션 API를 호출하지 않았으며 모든 화면은 같은 도메인의 WebP와 JPEG를 읽는다. 상품, 인물, 배경 사진을 외부 서버에서 가져오지 않는다.

## 구성과 출처

| 에셋 | 출처 | 용도 |
| --- | --- | --- |
| `public/media/capsule`의 blazer, shirt, skirt, slingback, trench, merino, trouser, loafer, trucker, tank, jeans, sneaker | 같은 프로젝트의 기존 스토리보드에 기록된 자체 생성 의류 12종 | 누끼 이미지로 옷장·코디 조합·비교에 사용 |
| dress, bag, bangle, polo, cardigan, bomber, pleats, slingbag, scarf | 이번 개편에서 생성한 프로젝트용 상품 사진 | 원피스·가방·액세서리와 다양한 색상 조합 확장 |
| `model-f.webp`, `look-2.webp` | 이전 스토리보드의 자체 생성 여성 모델 착장 2종 | 같은 인물의 스커트와 팬츠 비교 |
| `model-m.webp`, `model-m-denim.webp` | 이번 개편에서 제작한 동일 남성 모델의 스튜디오 착장 2종 | 메리노 니트와 데님 트러커 비교 |
| `cover.webp` | 이번 개편에서 여성 모델·샘플 의류에 맞춰 제작한 도시 화보 | 홈의 와인 슬립 드레스 착장 |

공간형 옷장의 `room.webp`는 같은 프로젝트의 자체 생성 스튜디오 배경인 `v4-room.jpg`를 WebP로 최적화했다. 레일 위의 옷과 조명, 조작부는 현재 옷장 데이터로 그린다.

## 사진과 실제 선택의 대응

| 코디 ID | 사진 | 사진에 보이는 의류 ID (`sample-` 접두어 생략) |
| --- | --- | --- |
| `sample-evening` | cover | dress, trench, bag, bangle |
| `sample-sand` | model-f | trench, shirt, skirt, slingback |
| `sample-graphite` | look-2 | trench, shirt, trouser, loafer |
| `sample-navy` | model-m | merino, trouser, loafer |
| `sample-denim` | model-m-denim | trucker, shirt, jeans, sneaker |

`sample.ts`가 의류와 코디 ID를 제공한다. 모델의 실루엣 조작은 별도의 비율 미리보기다. 이 사진은 사용자의 입력에 따라 새로 생성된 피팅 결과로 표시할 수 없다. 사진에 대응하지 않는 조합에서는 선택한 의류 자체를 보여 준다.


## 드레싱룸 디자인 프리뷰

`worktable.jpg`와 `cabinet.jpg`는 이번 UI를 위해 제작한 빈 재단 테이블과 옷장 내부다. 실제 의류를 별도의 터치 대상으로 배치한다. `study-f.jpg`와 `study-m.jpg`는 기존 프로젝트의 가상 기본 모델 두 명을 참고해 만든 정적인 기준 착장이다. 사용자의 사진이나 치수를 외부에 전송해 생성한 결과가 아니다. 드레싱룸의 네 JPEG는 합계 약 187KB다.
