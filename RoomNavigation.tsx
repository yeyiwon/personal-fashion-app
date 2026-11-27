import { useEffect, useRef } from 'react';
import { sections, titles } from './routes';
import { Icon } from './presentation';
import { Control, Segment } from './LiquidControls';
import type { PageProps } from './studio';

const stateOwners: Record<string, number> = {
  'closet-empty': 0,
  review: 0,
  'recognition-pending': 0,
  'analysis-error': 0,
  offline: 0,
  'camera-denied': 0,
  duplicate: 0,
  'fitting-wait': 2,
  'fitting-error': 2,
  'price-unavailable': 3,
  'product-unavailable': 3,
};
export function spaceFor(page: string) {
  const i = sections.findIndex((s) => Object.hasOwn(s.pages, page));
  return i < 0 ? (stateOwners[page] ?? 0) : i;
}
const doors = [
  [
    ['closet', '옷장'],
    ['register', '옷 등록'],
    ['camera', '촬영'],
    ['purchases', '구매 내역'],
  ],
  [
    ['ai', '코디 추천'],
    ['direct', '직접 코디'],
    ['colors', '색상 탐색'],
    ['image-search', '이미지 찾기'],
  ],
  [
    ['model', '모델'],
    ['model-study', '치수'],
    ['fitting', '피팅룸'],
    ['fitting-board', '착장 보드'],
  ],
  [
    ['shop', '쇼핑'],
    ['analysis', '구매 전 조합'],
    ['compare', '가격 비교'],
    ['wishlist', '관심 상품'],
  ],
  [
    ['lookbook', '룩북'],
    ['saved', '저장한 코디'],
    ['calendar', '캘린더'],
    ['travel', '여행'],
    ['analytics', '활용도'],
  ],
  [
    ['account', '프로필'],
    ['preferences', '취향'],
    ['privacy', '개인정보'],
    ['data', '데이터'],
    ['connections', '연결'],
  ],
];
export function RoomNavigation({ page, go }: PageProps) {
  const group = spaceFor(page),
    links = doors[group],
    active = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = active.current,
      parent = link?.parentElement;
    if (link && parent && parent.scrollWidth > parent.clientWidth) {
      parent.scrollLeft =
        link.offsetLeft -
        parent.offsetLeft -
        parent.clientWidth / 2 +
        link.offsetWidth / 2;
    }
  }, [page]);
  return (
    <nav className="station-nav" aria-label={sections[group].title + ' 작업'}>
      <div className="station-spine" aria-hidden="true">
        <svg width="20" height="26" viewBox="0 0 20 26">
          <path
            d="M3 1v12q0 8 8 8h6m-4-4 4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      </div>
      <div className="station-links">
        {links.map(([id, name]) => (
          <a
            key={id}
            href={'#/' + id}
            aria-current={id === page ? 'page' : undefined}
            ref={id === page ? active : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              go(id);
            }}
          >
            {name}
          </a>
        ))}
        {!links.some(([id]) => id === page) && (
          <span className="station-current" aria-current="page">
            {titles[page]}
          </span>
        )}
      </div>
    </nav>
  );
}

export function FeatureIndex({
  group,
  setGroup,
  go,
}: {
  group: number;
  setGroup: (v: number) => void;
  go: (p: string) => void;
}) {
  return (
    <div className="feature-index">
      <Segment className="index-zones" aria-label="기능 색인의 공간">
        {['옷장', '스타일링', '피팅룸', '쇼핑', '기록', '설정'].map(
          (label, i) => (
            <Control
              key={label}
              aria-pressed={group === i}
              onClick={() => setGroup(i)}
            >
              {label}
            </Control>
          ),
        )}
      </Segment>
      <nav aria-label={sections[group].title + ' 기능'}>
        {Object.entries(titles)
          .filter(([id]) => id !== 'tools' && spaceFor(id) === group)
          .map(([id, label]) => (
            <a
              key={id}
              href={'#/' + id}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                go(id);
              }}
            >
              {label}
              <Icon name="diagonal" size={14} />
            </a>
          ))}
      </nav>
    </div>
  );
}
