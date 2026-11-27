import { Control, Field, Segment } from './LiquidControls';
import { OpticalStage } from './OpticalStage';
import BelloSpace from './BelloSpace';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { useStudio, type PageProps, type StudioGarment } from './studio';
import { CATEGORIES } from './domain';
import { GarmentPhoto, Icon } from './presentation';
import { GlassSurface } from './RoomControls';

function Hook() {
  return (
    <svg
      className="rail-hanger"
      viewBox="0 0 160 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M75 10c-1-10 12-10 11-1-.4 5-7 5-7 10v5L15 50q-6 5 1 7h128q7-2 0-7L80 24"
        stroke="var(--bello-slate)"
        strokeWidth="3.8"
      />
      <path
        d="M75 9c-.6-8 10-9 10 0-.3 4-6 4-6 10v5L15 50q-6 5 1 6h127"
        stroke="var(--bello-silver)"
        strokeWidth="1.6"
      />
    </svg>
  );
}
export default function ClosetRail({ page, go }: PageProps) {
  const {
    garments,
    mode,
    setMode,
    setActiveGarmentId,
    setSelectedIds,
    setEditLookId,
  } = useStudio();
  const [query, search] = useState(''),
    [category, filter] = useState('전체'),
    [view, setView] = useState<'rack' | 'list'>('rack');
  const [current, center] = useState<string | null>(null),
    [open, inspect] = useState(false);
  const [objectId, setObject] = useState('');
  const [angle, rotate] = useState(0);
  const gesture = useRef<{ x: number; angle: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null),
    lastSwipe = useRef(0);
  const rack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    search('');
    filter('전체');
    center(null);
    inspect(false);
  }, [mode]);
  const list =
    page === 'closet-empty'
      ? []
      : garments.filter(
          (g) =>
            (category === '전체' || g.category === category) &&
            g.name.toLowerCase().includes(query.trim().toLowerCase()),
        );
  const index = Math.max(
      0,
      list.findIndex((g) => g.id === current),
    ),
    selected = list[index];
  function move(i: number) {
    const g = list[(i + list.length) % list.length];
    if (g) {
      center(g.id);
      inspect(false);
    }
  }
  function pick(g: StudioGarment) {
    if (Date.now() - lastSwipe.current < 240) return;
    if (g.id !== selected?.id) {
      center(g.id);
      inspect(true);
    } else inspect(!open);
  }
  function detail(g: StudioGarment) {
    setActiveGarmentId(g.id);
    go('garment');
  }
  function carry(dest: string) {
    if (!selected) return;
    setActiveGarmentId(selected.id);
    setSelectedIds([selected.id]);
    setEditLookId(null);
    go(dest);
  }
  function release(e: PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x,
      dy = e.clientY - start.current.y;
    rack.current?.style.removeProperty('--drag');
    start.current = null;
    if (Math.abs(dx) > 38 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      lastSwipe.current = Date.now();
      move(index + (dx < 0 ? 1 : -1));
    }
  }
  const empty = page === 'closet-empty' || garments.length === 0;
  return (
    <section className="rack-room">
      <div className="rack-intro">
        <div>
          <span className="date-stamp">
            {mode === 'sample' ? '샘플 컬렉션' : '나의 컬렉션'} ·{' '}
            {empty ? 0 : garments.length}벌
          </span>
          <h1>내 옷장</h1>
        </div>
        <Control
          className="add-thread"
          aria-label="옷 등록"
          onClick={() => go('register')}
        >
          <Icon name="plus" size={17} /> 옷 등록
        </Control>
      </div>
      <div className="rack-layout">
        <div className={'rack-main ' + view}>
          <Segment className="rack-filter" aria-label="분류 필터">
            {[
              '전체',
              ...CATEGORIES.filter((c) =>
                garments.some((g) => g.category === c),
              ),
            ].map((c) => (
              <Control
                key={c}
                aria-pressed={c === category}
                onClick={() => {
                  filter(c);
                  center(null);
                  inspect(false);
                }}
              >
                {c === '기타' ? '액세서리' : c}
              </Control>
            ))}
          </Segment>
          <div className="rack-view-tools">
            <Segment className="view-selector">
              <GlassSurface />
              {(['rack', 'list'] as const).map((v) => (
                <Control
                  key={v}
                  aria-pressed={v === view}
                  onClick={() => {
                    setView(v);
                    inspect(false);
                  }}
                >
                  <Icon name={v === 'rack' ? 'closet' : 'menu'} size={17} />
                  {v === 'rack' ? '레일' : '목록'}
                </Control>
              ))}
            </Segment>
            <label className="catalog-search">
              <Icon name="search" size={16} />
              <Field
                type="search"
                value={query}
                onChange={(e) => {
                  search(e.target.value);
                  inspect(false);
                }}
                placeholder="옷 이름으로 찾기"
                aria-label="의류 검색"
              />
            </label>
          </div>
          <div className="rail-area">
            {view === 'rack' && selected ? (
              <>
                <div
                  className={'cabinet' + (open ? ' extracted' : '')}
                  ref={rack}
                  tabIndex={0}
                  aria-label="의류 레일. 좌우 화살표로 탐색"
                  style={{ '--pigment': selected.color } as CSSProperties}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      move(index + (e.key === 'ArrowRight' ? 1 : -1));
                    } else if (e.key === 'Escape') inspect(false);
                  }}
                  onPointerDown={(e) => {
                    start.current = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerMove={(e) => {
                    if (!start.current) return;
                    const dx = e.clientX - start.current.x;
                    if (
                      Math.abs(dx) > 8 &&
                      Math.abs(dx) > Math.abs(e.clientY - start.current.y)
                    ) {
                      rack.current?.style.setProperty(
                        '--drag',
                        Math.max(-32, Math.min(32, dx * 0.28)) + 'px',
                      );
                      if (!e.currentTarget.hasPointerCapture(e.pointerId))
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }
                  }}
                  onPointerUp={release}
                  onPointerCancel={() => {
                    start.current = null;
                    rack.current?.style.removeProperty('--drag');
                  }}
                >
                  <BelloSpace kind="rail" signal={index} />
                  <OpticalStage mode="rail" signal={index} />
                  <div className="brass-rail" />
                  <div className="rail-track">
                    {list.map((g, i) => {
                      let off = i - index;
                      if (list.length > 2) {
                        if (off > list.length / 2) off -= list.length;
                        else if (off < -list.length / 2) off += list.length;
                      }
                      if (Math.abs(off) > 2) return null;
                      const shelf = ['신발', '기타', '가방'].includes(
                        g.category,
                      );
                      return (
                        <Control
                          key={g.id}
                          className={
                            'hanging-piece' +
                            (off === 0 ? ' chosen' : '') +
                            (shelf ? ' on-shelf' : '')
                          }
                          aria-label={g.name}
                          aria-pressed={off === 0 && open}
                          style={
                            {
                              '--offset': off,
                              '--distance': Math.abs(off),
                              zIndex: 5 - Math.abs(off),
                            } as CSSProperties
                          }
                          onClick={() => pick(g)}
                        >
                          {!shelf && <Hook />}
                          <GarmentPhoto item={g} shared={off === 0} />
                        </Control>
                      );
                    })}
                  </div>
                  <div className="rail-guides">
                    <Control
                      aria-label="이전 의류"
                      disabled={list.length < 2}
                      onClick={() => move(index - 1)}
                    >
                      <Icon name="back" size={17} />
                    </Control>
                    <span>
                      {index + 1} / {list.length}
                    </span>
                    <Control
                      aria-label="다음 의류"
                      disabled={list.length < 2}
                      onClick={() => move(index + 1)}
                    >
                      <Icon name="right" size={17} />
                    </Control>
                  </div>
                </div>
                {selected.id === 'sample-bag' && open && (
                  <div className="object-inspection">
                    <Control
                      className="woven-btn"
                      aria-expanded={objectId === selected.id}
                      onClick={() => {
                        setObject(objectId === selected.id ? '' : selected.id);
                        rotate(0);
                      }}
                    >
                      숄더백 3D 형태 살펴보기
                    </Control>
                    {objectId === selected.id && (
                      <div className="bag-view">
                        <div
                          className="bag-turntable"
                          role="group"
                          aria-label="숄더백 3D 회전"
                          onPointerDown={(e) => {
                            gesture.current = { x: e.clientX, angle };
                            e.currentTarget.setPointerCapture(e.pointerId);
                          }}
                          onPointerMove={(e) => {
                            if (gesture.current)
                              rotate(
                                gesture.current.angle +
                                  (e.clientX - gesture.current.x) * 0.018,
                              );
                          }}
                          onPointerUp={() => (gesture.current = null)}
                          onPointerCancel={() => (gesture.current = null)}
                        >
                          <GarmentPhoto item={selected} />
                          <OpticalStage mode="garment" turn={angle} />
                        </div>
                        <Control
                          aria-label="왼쪽으로 회전"
                          onClick={() => rotate((v) => v - 0.5)}
                        >
                          ↶
                        </Control>
                        <small>샘플 형태 모델 · 드래그로 회전</small>
                        <Control
                          aria-label="오른쪽으로 회전"
                          onClick={() => rotate((v) => v + 0.5)}
                        >
                          ↷
                        </Control>
                      </div>
                    )}
                  </div>
                )}
                <div className={'cloth-tag' + (open ? ' open-tag' : '')}>
                  <Control aria-expanded={open} onClick={() => inspect(!open)}>
                    <i style={{ background: selected.color }} />
                    <span>
                      <small>
                        {selected.category} ·{' '}
                        {selected.material || selected.condition}
                      </small>
                      <b>{selected.name}</b>
                    </span>
                    <span className="tag-handle">
                      <Icon name={open ? 'close' : 'plus'} size={17} />
                    </span>
                  </Control>
                  <div className="tag-fold" inert={!open}>
                    <div>
                      <div className="tag-actions">
                        <Control onClick={() => detail(selected)}>상세</Control>
                        <Control onClick={() => carry('direct')}>
                          직접 코디
                        </Control>
                        <Control onClick={() => carry('home')}>
                          아바타에 입히기
                        </Control>
                        <Control onClick={() => carry('fitting')}>
                          피팅 보드
                        </Control>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : list.length ? (
              <div className="garment-ledger">
                {list.map((g, i) => (
                  <Control
                    key={g.id}
                    aria-label={g.name}
                    onClick={() => detail(g)}
                  >
                    <small>{String(i + 1).padStart(2, '0')}</small>
                    <span className="ledger-photo">
                      <GarmentPhoto item={g} />
                    </span>
                    <span>
                      <b>{g.name}</b>
                      <small>
                        {g.category} · {g.material || g.condition}
                      </small>
                    </span>
                    <i style={{ background: g.color }} />
                    <Icon name="right" size={15} />
                  </Control>
                ))}
              </div>
            ) : (
              <div className="rail-empty">
                <Icon name="closet" size={38} />
                <h2>
                  {empty
                    ? '아직 등록한 옷이 없어요'
                    : '조건에 맞는 옷이 없어요'}
                </h2>
                <Control
                  className="woven-btn"
                  onClick={() =>
                    empty ? go('register') : (search(''), filter('전체'))
                  }
                >
                  {empty ? '첫 옷 등록하기' : '필터 초기화'}
                </Control>
              </div>
            )}
          </div>
        </div>
        <aside className="catalog-tools">
          <Segment className="closet-sources wc-switch">
            {(['sample', 'personal'] as const).map((m) => (
              <Control
                aria-pressed={m === mode}
                key={m}
                onClick={() => {
                  setMode(m);
                  if (page === 'closet-empty') go('closet');
                }}
              >
                {m === 'sample' ? '샘플 옷장' : '개인 옷장'}
              </Control>
            ))}
          </Segment>
          <div className="bench-index">
            {[
              ['space', '공간형 옷장', 'closet'],
              ['purchases', '구매 내역', 'save'],
              ['direct', '직접 코디', 'outfit'],
            ].map(([p, n, ic]) => (
              <Control key={p} onClick={() => go(p)}>
                <Icon name={ic} />
                <span>{n}</span>
                <Icon name="right" size={15} />
              </Control>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
