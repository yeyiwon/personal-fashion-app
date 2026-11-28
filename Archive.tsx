import { useCallback, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Control } from './LiquidControls';
import { useStudio, useScopedState, type PageProps } from './studio';
import { GarmentPhoto, haptic } from './presentation';
import { BelloMark } from './BelloAtlas';
import { CATEGORIES } from './domain';
import './archive.css';

type View = 'grid' | 'space';

/** 내 옷장 — a digital fashion archive. The cut-out garment photographs are the
 *  interface: a light collection for speed, a dark space where the chosen piece
 *  comes forward. Pulling a piece down sends it to the styling table at home. */
export default function Archive({ go, onAtlas }: PageProps & { onAtlas: () => void }) {
  const { garments, mode, setMode, selectedIds, setSelectedIds, setActiveGarmentId } = useStudio();
  const [view, setView] = useScopedState<View>('archive.view', 'grid');
  const [group, setGroup] = useState('전체'),
    [query, setQuery] = useState(''),
    [picking, setPicking] = useState(false),
    [picked, setPicked] = useState<string[]>([]),
    [centre, setCentre] = useState(0);
  const track = useRef<HTMLDivElement>(null),
    pull = useRef<{ id: number; x: number; y: number; el: HTMLElement } | null>(null);

  const groups = useMemo(
    () => ['전체', ...CATEGORIES.filter((c) => garments.some((g) => g.category === c))],
    [garments],
  );
  const shown = useMemo(() => {
    const word = query.trim().toLowerCase();
    return garments.filter(
      (g) =>
        (group === '전체' || g.category === group) &&
        (!word || (g.name + ' ' + g.category + ' ' + (g.material ?? '')).toLowerCase().includes(word)),
    );
  }, [garments, group, query]);
  const lead = shown[Math.min(centre, shown.length - 1)];

  function detail(id: string) {
    setActiveGarmentId(id);
    go('garment');
  }
  function toTable(ids: string[]) {
    setSelectedIds((q) => [...q.filter((id) => garments.some((g) => g.id === id)), ...ids.filter((id) => !q.includes(id))]);
    haptic('success');
    go('home');
  }
  function tap(id: string) {
    if (!picking) return detail(id);
    haptic('selection');
    setPicked((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]));
  }

  // Space view: pieces sit on a depth curve; the centred one stands in front.
  const settle = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0,
      near = Infinity;
    [...el.children].forEach((child, i) => {
      const node = child as HTMLElement,
        d = (node.offsetLeft + node.offsetWidth / 2 - mid) / el.clientWidth,
        a = Math.min(1.5, Math.abs(d));
      node.style.transform = `translate3d(${(-d * 52).toFixed(1)}%, ${(a * 7).toFixed(1)}%, 0) scale(${(1 - a * 0.46).toFixed(3)})`;
      node.style.opacity = (1 - a * 0.5).toFixed(2);
      node.style.filter = a > 0.2 ? `blur(${(a * 3).toFixed(1)}px) saturate(${(1 - a * 0.4).toFixed(2)})` : '';
      node.style.zIndex = String(100 - Math.round(a * 60));
      if (Math.abs(d) < near) {
        near = Math.abs(d);
        best = i;
      }
    });
    setCentre(best);
  }, []);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el || view !== 'space') return;
    let frame = 0;
    const plan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(settle);
    };
    settle();
    el.addEventListener('scroll', plan, { passive: true });
    addEventListener('resize', plan);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', plan);
      removeEventListener('resize', plan);
    };
  }, [settle, view, shown.length, group]);

  // Pull the front piece down to carry it to the styling table.
  function grab(e: PointerEvent<HTMLElement>) {
    pull.current = { id: e.pointerId, x: e.clientX, y: e.clientY, el: e.currentTarget };
  }
  function drag(e: PointerEvent<HTMLElement>) {
    const p = pull.current;
    if (!p || p.id !== e.pointerId) return;
    const dy = e.clientY - p.y;
    if (dy > 8 && Math.abs(e.clientX - p.x) < dy) {
      p.el.style.setProperty('--pull', Math.min(170, dy) + 'px');
      p.el.dataset.pull = dy > 90 ? 'go' : 'on';
    }
  }
  function drop(e: PointerEvent<HTMLElement>, id: string) {
    const p = pull.current;
    if (!p || p.id !== e.pointerId) return;
    pull.current = null;
    const send = p.el.dataset.pull === 'go';
    p.el.style.removeProperty('--pull');
    delete p.el.dataset.pull;
    if (send) toTable([id]);
  }

  return (
    <div className="archive" data-view={view}>
      <header className="arch-top">
        <Control
          className="arch-mark"
          aria-label="공간 이동"
          onClick={(e) => {
            e.currentTarget.focus({ preventScroll: true });
            onAtlas();
          }}
        >
          <BelloMark size={24} />
        </Control>
        <nav aria-label="옷 추가">
          <Control className="arch-link" onClick={() => go('register')}>
            옷 등록
          </Control>
          <Control className="arch-link" onClick={() => go('camera')}>
            촬영
          </Control>
          <Control className="arch-link" onClick={() => go('purchases')}>
            구매 내역
          </Control>
        </nav>
      </header>

      <div className="arch-title">
        <span aria-hidden="true">{String(shown.length).padStart(2, '0')}</span>
        <h1>내 옷장</h1>
        <p>
          {group === '전체' ? '전체' : group} {shown.length}벌
          {selectedIds.length > 0 && ` · 코디 중 ${selectedIds.length}`}
        </p>
        <div className="wc-switch arch-mode" role="group" aria-label="옷장 선택">
          <Control className="arch-word" aria-pressed={mode === 'sample'} onClick={() => setMode('sample')}>
            샘플 옷장
          </Control>
          <Control className="arch-word" aria-pressed={mode === 'personal'} onClick={() => setMode('personal')}>
            개인 옷장
          </Control>
        </div>
      </div>

      <div className="arch-tools">
        <div className="arch-groups" role="group" aria-label="분류">
          {groups.map((name) => (
            <Control key={name} className="arch-word" aria-pressed={group === name} onClick={() => setGroup(name)}>
              {name}
            </Control>
          ))}
        </div>
        <div className="arch-row">
          <input
            type="search"
            aria-label="의류 검색"
            placeholder="이름, 소재로 찾기"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="arch-views" role="group" aria-label="보기">
            <Control className="arch-word" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
              컬렉션
            </Control>
            <Control className="arch-word" aria-pressed={view === 'space'} onClick={() => setView('space')}>
              공간
            </Control>
          </div>
        </div>
      </div>

      {!shown.length ? (
        <p className="arch-empty">
          {garments.length ? '조건에 맞는 옷이 없어요.' : '아직 등록한 옷이 없어요.'}
          <Control className="arch-link" onClick={() => (garments.length ? (setQuery(''), setGroup('전체')) : go('register'))}>
            {garments.length ? '조건 지우기' : '옷 등록하기'}
          </Control>
        </p>
      ) : view === 'grid' ? (
        <>
          <div className="arch-pick">
            <Control
              className="arch-link"
              aria-pressed={picking}
              onClick={() => {
                setPicking(!picking);
                setPicked([]);
              }}
            >
              {picking ? '선택 끝내기' : '여러 벌 선택'}
            </Control>
          </div>
          <div className={'arch-grid' + (picking ? ' picking' : '')}>
            {shown.map((g) => (
              <Control
                key={g.id}
                className="arch-item"
                aria-label={g.name}
                aria-pressed={picking ? picked.includes(g.id) : undefined}
                data-on={selectedIds.includes(g.id) || undefined}
                onClick={() => tap(g.id)}
              >
                <GarmentPhoto item={g} />
                <b>{g.name}</b>
                <small>
                  {g.category}
                  {g.material ? ' · ' + g.material : ''}
                </small>
              </Control>
            ))}
          </div>
        </>
      ) : (
        <section className="arch-space" aria-label="공간 보기">
          <div className="arch-track" ref={track}>
            {shown.map((g) => (
              <Control
                key={g.id}
                className="arch-piece"
                aria-label={g.name}
                onPointerDown={grab}
                onPointerMove={drag}
                onPointerUp={(e) => drop(e, g.id)}
                onPointerCancel={(e) => drop(e, g.id)}
                onClick={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })}
              >
                <GarmentPhoto item={g} />
              </Control>
            ))}
          </div>
          {lead && (
            <div className="arch-lead">
              <span>
                {String(Math.min(centre, shown.length - 1) + 1).padStart(2, '0')}
                <i> / {String(shown.length).padStart(2, '0')}</i>
              </span>
              <h2>{lead.name}</h2>
              <p>
                {lead.category}
                {lead.material ? ' · ' + lead.material : ''}
              </p>
              <div>
                <Control className="arch-go" onClick={() => toTable([lead.id])}>
                  코디 공간으로
                </Control>
                <Control className="arch-link" onClick={() => detail(lead.id)}>
                  자세히
                </Control>
              </div>
              <small>옷을 아래로 끌어내려도 코디 공간으로 가져가요.</small>
            </div>
          )}
        </section>
      )}

      {picking && picked.length > 0 && (
        <div className="arch-bar">
          <Control className="arch-go" onClick={() => toTable(picked)}>
            코디 공간으로 {picked.length}
          </Control>
          <Control className="arch-link" onClick={() => setPicked([])}>
            선택 지우기
          </Control>
        </div>
      )}
    </div>
  );
}
