import { Control, Segment } from './LiquidControls';
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { useStudio, type PageProps } from './studio';
import { GarmentPhoto, Icon } from './presentation';
import { CATEGORIES } from './domain';
import './space.css';

function morph(change: () => void) {
  if (
    document.startViewTransition &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.startViewTransition(() => flushSync(change));
  } else change();
}
export default function Space({ go }: PageProps) {
  const {
    garments,
    mode,
    activeGarmentId,
    setActiveGarmentId,
    selectedIds,
    setSelectedIds,
    setEditLookId,
    notify,
  } = useStudio();
  const [filter, setFilter] = useState('전체'),
    [inspect, setInspect] = useState(false);
  const rail = useRef<HTMLDivElement>(null),
    opening = useRef<HTMLButtonElement | null>(null),
    close = useRef<HTMLButtonElement | null>(null);
  const frame = useRef(0);
  const mouse = useRef<{ x: number; left: number; dragged: boolean } | null>(
    null,
  );
  const preventClick = useRef(false);
  const scene = useRef<HTMLDivElement>(null);
  const items = garments.filter(
    (g) => filter === '전체' || filter === g.category,
  );
  const [active, setActive] = useState(
    Math.max(
      0,
      items.findIndex((i) => i.id === activeGarmentId),
    ),
  );
  const index = Math.max(0, Math.min(active, items.length - 1)),
    item = items[index];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function align(n: number, smooth: boolean) {
    const el = rail.current?.children[n] as HTMLElement | undefined;
    const node = rail.current;
    if (!el || !node) return;
    cancelAnimationFrame(frame.current);
    const goal = el.offsetLeft - (node.clientWidth - el.offsetWidth) / 2;
    if (!smooth || reduced()) {
      node.scrollLeft = goal;
      return;
    }
    // Damped spring toward the item's center. Stop rendering once settled.
    let position = node.scrollLeft,
      velocity = 0,
      last = performance.now();
    node.style.scrollSnapType = 'none';
    function step(now: number) {
      if (!node || !node.isConnected) return;
      const dt = Math.min((now - last) / 1000, 0.025);
      last = now;
      velocity += ((goal - position) * 220 - velocity * 29) * dt;
      position += velocity * dt;
      node.scrollLeft = position;
      if (Math.abs(goal - position) < 0.6 && Math.abs(velocity) < 6) {
        node.scrollLeft = goal;
        node.style.scrollSnapType = '';
        return;
      }
      frame.current = requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
  }
  useLayoutEffect(() => () => cancelAnimationFrame(frame.current), []);
  function startDrag(e: PointerEvent<HTMLDivElement>) {
    cancelAnimationFrame(frame.current);
    e.currentTarget.style.scrollSnapType = '';
    if (e.pointerType === 'mouse' && e.button === 0) {
      preventClick.current = false;
      mouse.current = {
        x: e.clientX,
        left: e.currentTarget.scrollLeft,
        dragged: false,
      };
    }
  }
  function drag(e: PointerEvent<HTMLDivElement>) {
    const pointer = mouse.current;
    if (!pointer || !e.buttons) return;
    const dx = e.clientX - pointer.x;
    if (Math.abs(dx) > 5 && !pointer.dragged) {
      pointer.dragged = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.style.scrollSnapType = 'none';
    }
    if (pointer.dragged) {
      e.currentTarget.scrollLeft = pointer.left - dx;
      e.preventDefault();
    }
  }
  function drop(e: PointerEvent<HTMLDivElement>) {
    const pointer = mouse.current;
    mouse.current = null;
    if (!pointer?.dragged) return;
    preventClick.current = true;
    const node = e.currentTarget;
    if (node.hasPointerCapture(e.pointerId))
      node.releasePointerCapture(e.pointerId);
    const center = node.scrollLeft + node.clientWidth / 2;
    const closest = Array.from(node.children).reduce(
      (best, element, i) => {
        const el = element as HTMLElement;
        const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
        return distance < best.distance ? { i, distance } : best;
      },
      { i: index, distance: Infinity },
    );
    align(closest.i, true);
  }
  useLayoutEffect(() => {
    if (!inspect) align(index, false);
  }, [filter, inspect]);
  useLayoutEffect(() => {
    if (inspect) close.current?.focus({ preventScroll: true });
  }, [inspect]);
  function show(n: number) {
    setActiveGarmentId(items[n].id);
    morph(() => {
      setActive(n);
      setInspect(true);
    });
  }
  function hide() {
    morph(() => {
      setInspect(false);
      requestAnimationFrame(() =>
        rail.current
          ?.querySelector<HTMLButtonElement>('.front')
          ?.focus({ preventScroll: true }),
      );
    });
  }
  function take(page: string) {
    if (!item) return;
    if (!selectedIds.includes(item.id) && selectedIds.length >= 32) {
      notify('코디에는 최대 32벌까지 담을 수 있어요.');
      return;
    }
    setActiveGarmentId(item.id);
    setEditLookId(null);
    if (!selectedIds.includes(item.id))
      setSelectedIds([...selectedIds, item.id]);
    go(page);
  }
  return (
    <section
      className="space-page"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && inspect) hide();
      }}
    >
      <div className="space-heading">
        <div>
          <h1>공간형 옷장</h1>
          <p>
            {mode === 'sample' ? '샘플 옷장' : '내 옷장'} · {garments.length}벌
          </p>
        </div>
        <Control className="quiet" onClick={() => go('closet')}>
          <Icon name="grid" size={17} />
          목록 보기
        </Control>
      </div>
      <Segment className="rail-filters" aria-label="레일 분류">
        {['전체', ...CATEGORIES].map((t) => (
          <Control
            key={t}
            aria-pressed={t === filter}
            onClick={() => {
              setFilter(t);
              setInspect(false);
              setActive(0);
            }}
          >
            {t === '기타' ? '액세서리' : t}
          </Control>
        ))}
      </Segment>
      {item ? (
        <div
          ref={scene}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' && !reduced()) {
              const r = e.currentTarget.getBoundingClientRect();
              scene.current?.style.setProperty(
                '--light-at',
                Math.round(((e.clientX - r.left) / r.width) * 100) + '%',
              );
            }
          }}
          className={'dressing-space' + (inspect ? ' inspecting' : '')}
          style={
            {
              '--fabric': item.color,
              '--rail-view':
                38 +
                (items.length > 1 ? (index / (items.length - 1)) * 24 : 12) +
                '%',
            } as CSSProperties
          }
        >
          <div className="room-light" aria-hidden="true" />
          <div className="room-track" aria-hidden="true" />
          <div className="room-floor" aria-hidden="true" />
          {!inspect ? (
            <>
              <div
                className="garment-rail"
                onPointerDown={startDrag}
                onPointerMove={drag}
                onPointerUp={drop}
                onPointerCancel={drop}
                onClickCapture={(e) => {
                  if (preventClick.current) {
                    e.stopPropagation();
                    preventClick.current = false;
                  }
                }}
                ref={rail}
                aria-label="의류 레일"
                onScroll={(e) => {
                  const node = e.currentTarget,
                    center = node.scrollLeft + node.clientWidth / 2;
                  let near = 0,
                    distance = Infinity;
                  for (let i = 0; i < node.children.length; i++) {
                    const el = node.children[i] as HTMLElement,
                      d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
                    if (d < distance) {
                      distance = d;
                      near = i;
                    }
                  }
                  setActive(near);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    align(
                      Math.min(
                        items.length - 1,
                        Math.max(0, index + (e.key === 'ArrowRight' ? 1 : -1)),
                      ),
                      true,
                    );
                  }
                }}
              >
                {items.map((g, i) => (
                  <Control
                    key={g.id}
                    className={'rack-piece' + (i === index ? ' front' : '')}
                    style={
                      {
                        '--offset': Math.min(2, Math.max(-2, i - index)),
                        viewTransitionName:
                          g.id === item.id ? 'studio-object' : 'none',
                      } as CSSProperties
                    }
                    aria-label={g.name + ' 살펴보기'}
                    onClick={(e) => {
                      opening.current = e.currentTarget;
                      show(i);
                    }}
                  >
                    <svg
                      className="rail-mount"
                      aria-hidden="true"
                      viewBox="0 0 120 70"
                      preserveAspectRatio="none"
                    >
                      <path d="M55 12c0-13 16-13 16-3 0 7-10 6-10 16v8" />
                      {['상의', '아우터', '원피스'].includes(g.category) ? (
                        <path d="m61 28 45 27c4 3 2 6-3 6H17c-4 0-5-4-1-6Z" />
                      ) : (
                        <>
                          <path d="m60 32-33 15h66L60 32" />
                          <path d="M27 47v13m66-13v13" />
                        </>
                      )}
                    </svg>
                    <GarmentPhoto item={g} />
                  </Control>
                ))}
              </div>
              <div className="room-lens">
                <Control
                  aria-label="이전 의류"
                  disabled={!index}
                  onClick={() => align(index - 1, true)}
                >
                  <Icon name="back" />
                </Control>
                <Control
                  className="lens-name"
                  onClick={(e) => {
                    opening.current = e.currentTarget;
                    show(index);
                  }}
                >
                  <small>
                    {String(index + 1).padStart(2, '0')} /{' '}
                    {String(items.length).padStart(2, '0')}
                  </small>
                  <b>{item.name}</b>
                  <span>살펴보기</span>
                </Control>
                <Control
                  aria-label="다음 의류"
                  disabled={index === items.length - 1}
                  onClick={() => align(index + 1, true)}
                >
                  <Icon name="right" />
                </Control>
              </div>
            </>
          ) : (
            <div className="specimen">
              <Control className="space-back" ref={close} onClick={hide}>
                <Icon name="back" size={16} />
                레일로
              </Control>
              <div
                className="specimen-photo"
                style={{ viewTransitionName: 'studio-object' }}
              >
                <GarmentPhoto item={item} />
              </div>
              <div className="room-lens lens-tools">
                <div>
                  <small>
                    {item.category} {item.material ? ' / ' + item.material : ''}
                  </small>
                  <h2>{item.name}</h2>
                </div>
                <div className="lens-actions">
                  <Control onClick={() => take('direct')}>
                    <Icon name="layer" size={16} />
                    코디에 담기
                  </Control>
                  <Control onClick={() => take('fitting')}>
                    <Icon name="fit" size={16} />
                    피팅 보드
                  </Control>
                  <Control
                    aria-label="의류 상세 정보"
                    onClick={() => go('garment')}
                  >
                    <Icon name="diagonal" size={18} />
                  </Control>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-empty">
          <Icon name="closet" size={45} />
          <h2>레일에 걸린 옷이 없어요</h2>
          <Control className="action" onClick={() => go('register')}>
            옷 등록하기
          </Control>
        </div>
      )}
    </section>
  );
}
