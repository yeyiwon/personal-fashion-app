import { Control, Field, Segment } from './LiquidControls';
import { useState } from 'react';
import { GarmentPhoto, Icon } from './presentation';
import { CATEGORIES } from './domain';
import { useStudio, type StudioGarment } from './studio';

export function WardrobeGrid({
  onPick,
  marked,
  compact = false,
}: {
  onPick: (item: StudioGarment) => void;
  marked?: string[];
  compact?: boolean;
}) {
  const { garments } = useStudio();
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const shown = garments.filter(
    (g) =>
      (category === '전체' || g.category === category) &&
      g.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  if (!garments.length) return null;
  return (
    <>
      <label className="wc-search">
        <Icon name="search" size={18} />
        <Field
          type="search"
          aria-label="의류 검색"
          placeholder="옷 이름으로 찾기"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <Segment className="wc-filters" aria-label="분류 필터">
        {[
          '전체',
          ...CATEGORIES.filter((c) => garments.some((g) => g.category === c)),
        ].map((c) => (
          <Control
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c === '기타' ? '기타·액세서리' : c}
          </Control>
        ))}
      </Segment>
      <div className={'wc-grid' + (compact ? ' compact' : '')}>
        {shown.map((g) => (
          <Control
            key={g.id}
            className={'wc-piece' + (marked?.includes(g.id) ? ' marked' : '')}
            aria-label={g.name}
            aria-pressed={marked ? marked.includes(g.id) : undefined}
            onClick={() => onPick(g)}
          >
            <span className="wc-piece-photo">
              <GarmentPhoto item={g} />
              {marked?.includes(g.id) && (
                <i>
                  <Icon name="check" size={13} />
                </i>
              )}
            </span>
            <span className="wc-piece-type">
              <i style={{ backgroundColor: g.color }} />
              {g.category === '기타' ? '기타·액세서리' : g.category}
            </span>
            <strong>{g.name}</strong>
          </Control>
        ))}
      </div>
      {!shown.length && (
        <div className="wc-empty">
          <h2>조건에 맞는 옷이 없어요</h2>
          <Control
            className="wc-text"
            onClick={() => {
              setCategory('전체');
              setSearch('');
            }}
          >
            필터 초기화
          </Control>
        </div>
      )}
    </>
  );
}
