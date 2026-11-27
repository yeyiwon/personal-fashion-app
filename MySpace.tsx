import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Control } from './LiquidControls';
import { useStudio, useScopedState, type PageProps } from './studio';
import { GarmentPhoto, Icon, haptic, message } from './presentation';
import { RoomAssistant, type Advice } from './RoomAssistant';
import { BelloMark } from './BelloAtlas';
import { wearPiece } from './avatarLayers';
import { getImage } from './storage';
import { CATEGORIES } from './domain';
import type { SignalState } from './BelloSignal';
import type { SpaceStage, StagePlace } from './art/spaceStage';
import './dressing.css';
import './myspace.css';

type View = 'table' | 'model';
const glyphs: Record<string, string> = {
  lock: 'M7 10V7.5a5 5 0 0 1 10 0V10M5.5 10h13v9.5h-13zM12 14v2.5',
  unlock: 'M7 10V7.5a5 5 0 0 1 9.2-2.7M5.5 10h13v9.5h-13zM12 14v2.5',
  swap: 'M4 8h13l-3.5-3.5M20 16H7l3.5 3.5',
  tune: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
};
function Glyph({ name }: { name: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={glyphs[name]} />
    </svg>
  );
}

/** 나의 공간 — the real wardrobe laid out, composed and saved in one space. */
export default function MySpace({
  go,
  onMode,
  onAtlas,
}: { onMode: () => void; onAtlas: () => void } & PageProps) {
  const { mode, garments, selectedIds, setSelectedIds, saveLook, notify } =
    useStudio();
  const [layout, setLayout] = useScopedState<Record<string, StagePlace>>(
      'space.layout',
      {},
    ),
    [locks, setLocks] = useScopedState<string[]>('avatar.locks', []);
  const [view, setView] = useState<View>('table'),
    [group, setGroup] = useState('전체'),
    [chosen, choose] = useState<string | null>(null),
    [tuning, tune] = useState(false),
    [assistant, setAssistant] = useState(false),
    [signal, setSignal] = useState<SignalState>('waiting'),
    [naming, setNaming] = useState(false),
    [lookName, setLookName] = useState(''),
    [saving, setSaving] = useState(false),
    [fault, setFault] = useState(''),
    [stageState, setStage] = useState<'loading' | 'ready' | 'none'>('loading'),
    [figure, setFigure] = useState(false),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [centre, setCentre] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<SpaceStage | null>(null),
    capsule = useRef<HTMLDivElement>(null),
    track = useRef<HTMLDivElement>(null),
    origin = useRef<Record<string, { x: number; y: number }>>({}),
    blobs = useRef<Record<string, string>>({});

  const placed = useMemo(
    () =>
      selectedIds
        .map((id) => garments.find((g) => g.id === id))
        .filter((g): g is (typeof garments)[number] => !!g),
    [selectedIds, garments],
  );
  const ids = useMemo(() => placed.map((g) => g.id), [placed]);
  const groups = useMemo(
    () => ['전체', ...CATEGORIES.filter((c) => garments.some((g) => g.category === c))],
    [garments],
  );
  const shelf = useMemo(
    () => garments.filter((g) => group === '전체' || g.category === group),
    [garments, group],
  );
  const active = placed.find((g) => g.id === chosen) ?? null;

  // Photo sources: bundled samples are plain URLs, private photos are stored blobs.
  useEffect(() => {
    let live = true;
    for (const g of placed) {
      if (g.image || g.photoUnavailable || blobs.current[g.id]) continue;
      blobs.current[g.id] = 'pending';
      getImage(g.id)
        .then((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          blobs.current[g.id] = url;
          if (live) setUrls((u) => ({ ...u, [g.id]: url }));
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [placed]);
  useEffect(
    () => () => {
      for (const url of Object.values(blobs.current))
        if (url !== 'pending') URL.revokeObjectURL(url);
    },
    [],
  );

  // Stage lifecycle. three.js is loaded only when this space opens.
  const events = useRef({
    remove: (_id: string) => {},
    layout: (_l: Record<string, StagePlace>, _o: string[]) => {},
  });
  useEffect(() => {
    let gone = false;
    import('./art/spaceStage')
      .then(({ SpaceStage }) => {
        if (gone || !canvas.current) return;
        stage.current = new SpaceStage(canvas.current, {
          onSelect: (id) => {
            choose(id);
            tune(false);
            if (id) haptic('selection');
          },
          onRemove: (id) => events.current.remove(id),
          onLayout: (l, o) => events.current.layout(l, o),
          onFigure: setFigure,
          onAnchor: (point) => {
            const el = capsule.current;
            if (!el) return;
            if (!point) return void (el.dataset.at = '');
            const half = el.offsetWidth / 2,
              x = Math.max(half + 10, Math.min(innerWidth - half - 10, point.x)),
              y = Math.max(132, point.y - 14);
            el.style.transform = `translate3d(${x - half}px, ${y}px, 0) translateY(-100%)`;
            el.dataset.at = '1';
          },
        });
        setStage('ready');
      })
      .catch(() => !gone && setStage('none'));
    return () => {
      gone = true;
      stage.current?.destroy();
      stage.current = null;
    };
  }, []);

  events.current.remove = (id) => {
    if (locks.includes(id)) return;
    setSelectedIds((q) => q.filter((x) => x !== id));
    haptic('selection');
  };
  events.current.layout = (next, order) => {
    setLayout((old) => ({ ...old, ...next }));
    setSelectedIds((q) => {
      const kept = order.filter((id) => q.includes(id));
      const rest = q.filter((id) => !kept.includes(id));
      const merged = [...rest, ...kept];
      return merged.every((id, i) => id === q[i]) ? q : merged;
    });
  };

  useEffect(() => {
    if (stageState !== 'ready') return;
    stage.current?.sync(
      placed
        .filter((g) => g.image || urls[g.id])
        .map((g) => ({
          id: g.id,
          url: g.image ?? urls[g.id],
          category: g.category,
          locked: locks.includes(g.id),
          place: layout[g.id],
        })),
      origin.current,
    );
    origin.current = {};
  }, [stageState, placed, urls, layout, locks]);
  useEffect(() => {
    if (stageState === 'ready')
      stage.current?.setMood(
        placed.map((g) => g.color),
        signal,
      );
  }, [stageState, placed, signal]);
  useEffect(() => {
    stage.current?.setView(view);
    if (view === 'model') stage.current?.select(null);
  }, [view, stageState]);
  useEffect(() => {
    if (chosen && !ids.includes(chosen)) choose(null);
  }, [chosen, ids]);

  // Arc dial: thumbnails ride a curve; the centred one leads.
  const arc = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2,
      span = el.clientWidth / 2;
    let best = 0,
      near = Infinity;
    [...el.children].forEach((child, i) => {
      const node = child as HTMLElement,
        d = (node.offsetLeft + node.offsetWidth / 2 - mid) / span,
        a = Math.min(1.4, Math.abs(d));
      node.style.transform = `translateY(${(a * a * 26).toFixed(1)}px) rotate(${(d * 13).toFixed(2)}deg) scale(${(1.04 - a * 0.3).toFixed(3)})`;
      node.style.opacity = (1 - Math.max(0, a - 0.75) * 1.3).toFixed(2);
      if (Math.abs(d) < near) {
        near = Math.abs(d);
        best = i;
      }
    });
    setCentre(best);
  }, []);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const plan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(arc);
    };
    el.scrollLeft = 0;
    arc();
    el.addEventListener('scroll', plan, { passive: true });
    const watch = new ResizeObserver(plan);
    watch.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', plan);
      watch.disconnect();
    };
  }, [arc, shelf.length, group, view]);

  function fromOrb() {
    origin.current['*'] = { x: innerWidth / 2, y: 96 };
  }
  function toggle(id: string, from?: DOMRect) {
    if (ids.includes(id)) {
      if (locks.includes(id)) return notify('고정한 옷이에요. 고정을 풀면 치울 수 있어요.');
      setSelectedIds((q) => q.filter((x) => x !== id));
    } else {
      if (from)
        origin.current[id] = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
      setSelectedIds((q) => [...q.filter((x) => garments.some((g) => g.id === x)), id]);
      if (view !== 'table') setView('table');
    }
    haptic('selection');
  }
  function swap() {
    if (!active || locks.includes(active.id)) return;
    const pool = garments.filter((g) => g.category === active.category && !g.photoUnavailable),
      start = pool.findIndex((g) => g.id === active.id);
    const next = pool
      .slice(start + 1)
      .concat(pool.slice(0, start))
      .find((g) => !ids.includes(g.id));
    if (!next) return notify('같은 분류에 바꿀 옷이 더 없어요.');
    const place = layout[active.id];
    setLayout((old) => {
      const { [active.id]: _gone, ...rest } = old;
      return place ? { ...rest, [next.id]: place } : rest;
    });
    origin.current[next.id] = { x: innerWidth / 2, y: innerHeight - 120 };
    setSelectedIds((q) => q.map((id) => (id === active.id ? next.id : id)));
    choose(next.id);
    stage.current?.select(next.id, true);
    haptic('selection');
  }
  function arrange() {
    setLayout((old) => {
      const next = { ...old };
      for (const id of ids) if (!locks.includes(id)) delete next[id];
      return next;
    });
    haptic('selection');
  }
  function act(a: Advice) {
    const valid = a.ids.filter((id) => garments.some((g) => g.id === id));
    if (valid.length !== a.ids.length)
      return notify('제안 이후 옷장이 바뀌었어요. 현재 옷으로 다시 요청해 주세요.');
    if (a.tool === 'none') return;
    fromOrb();
    if ((a.tool === 'outfit' || a.tool === 'fitting') && valid.length) {
      const kept = ids.filter((id) => locks.includes(id));
      setLayout((old) => {
        const next = { ...old };
        for (const id of [...ids, ...valid]) if (!kept.includes(id)) delete next[id];
        return next;
      });
      setSelectedIds([...kept, ...valid.filter((id) => !kept.includes(id))]);
      setView('table');
      if (a.tool === 'fitting') go('fitting');
    } else if (a.tool === 'swap' && valid.length) {
      let next = ids;
      for (const id of valid)
        next = wearPiece(next, garments.find((g) => g.id === id)!, garments, locks);
      setSelectedIds(next);
      setView('table');
    } else if (a.tool === 'lock' && valid.length) {
      const targets = valid.filter((id) => ids.includes(id));
      if (targets.length) setLocks((q) => [...new Set([...q, ...targets])]);
      else notify('테이블에 올린 옷 중에서 선택해 주세요.');
    } else if (a.tool === 'save') openSave();
    else if (a.tool === 'palette') go('palette');
    else if (a.tool === 'shopping') go('shop');
    else track.current?.querySelector('button')?.focus();
    setAssistant(false);
  }
  function openSave() {
    if (!ids.length) return notify('먼저 옷을 테이블에 올려 주세요.');
    const now = new Date();
    setLookName((v) => v || `${now.getMonth() + 1}월 ${now.getDate()}일 코디`);
    setFault('');
    setNaming(true);
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const title = lookName.trim();
      if (!title) throw Error('코디 이름을 입력해 주세요.');
      await saveLook(title, ids);
      haptic('success');
      notify(title + '을 저장했어요.');
      setNaming(false);
      setLookName('');
    } catch (e) {
      setFault(message(e));
    } finally {
      setSaving(false);
    }
  }

  const lead = shelf[Math.min(centre, shelf.length - 1)];
  const locked = !!active && locks.includes(active.id);
  return (
    <div
      className={'live-room my-space view-' + view + (assistant ? ' assistant-open' : '')}
      data-signal={signal}
      style={{ '--garment-light': active?.color ?? placed[0]?.color ?? 'var(--bello-silver)' } as CSSProperties}
    >
      <h1 className="visually-hidden">나의 공간</h1>
      <canvas ref={canvas} className="space-canvas" aria-hidden="true" />
      {stageState === 'none' && (
        <p className="space-flat" role="status">
          이 기기에서는 공간 렌더링을 열 수 없어요.
          <Control className="link" onClick={() => go('direct')}>직접 코디로 이동</Control>
        </p>
      )}
      <p className="visually-hidden" aria-live="polite">
        {placed.length
          ? `테이블에 ${placed.length}점: ${placed.map((g) => g.name).join(', ')}`
          : '테이블이 비어 있어요.'}
      </p>

      <header className="dressing-head space-head">
        <Control
          className="room-sign"
          aria-label="공간 이동"
          onClick={(e) => {
            e.currentTarget.focus({ preventScroll: true });
            onAtlas();
          }}
        >
          <BelloMark size={25} />
          <span>BELLO</span>
          <Icon name="grid" size={13} />
        </Control>
        <Control className="mode-pin" onClick={onMode}>
          {mode === 'sample' ? '샘플 옷장' : '개인 옷장'} <Icon name="down" size={12} />
        </Control>
      </header>

      <RoomAssistant
        key={mode}
        open={assistant}
        setOpen={setAssistant}
        worn={ids}
        locked={locks.filter((id) => ids.includes(id))}
        act={act}
        onSignal={setSignal}
      />

      {view === 'table' && !placed.length && stageState === 'ready' && (
        <p className="space-hint">
          옷장에서 옷을 꺼내
          <br />
          테이블에 올려 보세요
        </p>
      )}
      {view === 'model' && (
        <div className="space-note">
          <strong>{figure ? '기본 마네킹' : '마네킹을 불러오는 중'}</strong>
          <span>좌우로 끌어 돌려 볼 수 있어요. 실제 옷 착용은 피팅 모듈에서 진행해요.</span>
          <Control onClick={() => go('fitting')}>
            피팅룸 열기 <Icon name="arrow" size={14} />
          </Control>
        </div>
      )}

      <div
        ref={capsule}
        className={'space-capsule' + (tuning ? ' tuning' : '')}
        role="toolbar"
        aria-label={active ? active.name + ' 조작' : '의류 조작'}
        inert={!active || view !== 'table'}
      >
        {active && (
          <>
            <b>{active.name}</b>
            <div>
              <Control
                aria-pressed={locked}
                onClick={() =>
                  setLocks((q) => (locked ? q.filter((id) => id !== active.id) : [...q, active.id]))
                }
              >
                <Glyph name={locked ? 'lock' : 'unlock'} />
                <span>{locked ? '고정됨' : '고정'}</span>
              </Control>
              <Control onClick={swap} disabled={locked}>
                <Glyph name="swap" />
                <span>교체</span>
              </Control>
              <Control aria-expanded={tuning} onClick={() => tune((v) => !v)} disabled={locked}>
                <Glyph name="tune" />
                <span>조정</span>
              </Control>
              <span className="tuners" inert={!tuning}>
                <Control className="t" aria-label="왼쪽으로 돌리기" onClick={() => stage.current?.nudge({ r: 0.2 })}>
                  ↺
                </Control>
                <Control className="t" aria-label="오른쪽으로 돌리기" onClick={() => stage.current?.nudge({ r: -0.2 })}>
                  ↻
                </Control>
                <Control className="t" aria-label="작게" onClick={() => stage.current?.nudge({ s: 0.9 })}>
                  −
                </Control>
                <Control className="t" aria-label="크게" onClick={() => stage.current?.nudge({ s: 1.11 })}>
                  +
                </Control>
              </span>
              <Control onClick={() => toggle(active.id)} disabled={locked}>
                <Icon name="close" size={17} />
                <span>치우기</span>
              </Control>
            </div>
          </>
        )}
      </div>

      <div className="space-deck" inert={assistant}>
        <div className="space-actions">
          <div className="space-views" role="group" aria-label="보기">
            <i data-at={view} />
            <Control aria-pressed={view === 'table'} onClick={() => setView('table')}>
              코디
            </Control>
            <Control aria-pressed={view === 'model'} onClick={() => setView('model')}>
              모델
            </Control>
          </div>
          <form
            className={'space-save' + (naming ? ' open' : '')}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {naming ? (
              <>
                <input
                  key="name"
                  autoFocus
                  aria-label="코디 이름"
                  value={lookName}
                  maxLength={80}
                  onChange={(e) => setLookName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
                  aria-invalid={!!fault}
                />
                <Control key="go" className="go" type="submit" disabled={saving} aria-busy={saving}>
                  저장
                </Control>
                <Control key="cancel" type="button" aria-label="취소" onClick={() => setNaming(false)}>
                  <Icon name="close" size={15} />
                </Control>
              </>
            ) : (
              <>
                {placed.length > 1 && (
                  <Control key="arrange" type="button" className="quiet" onClick={arrange}>
                    정돈
                  </Control>
                )}
                <Control key="open" type="button" onClick={openSave} disabled={!placed.length}>
                  <Icon name="save" size={16} />
                  코디 저장{placed.length ? ` · ${placed.length}` : ''}
                </Control>
              </>
            )}
          </form>
        </div>
        {fault && naming && (
          <p className="space-fault" role="alert">
            {fault}
          </p>
        )}
        {view === 'table' && (
          <section className="space-dial" aria-label="내 옷장">
            <div className="dial-groups" role="group" aria-label="분류">
              {groups.map((name) => (
                <Control key={name} aria-pressed={group === name} onClick={() => setGroup(name)}>
                  {name}
                </Control>
              ))}
              <Control className="dial-add" onClick={() => go('camera')} aria-label="옷 촬영해 등록">
                <Icon name="camera" size={16} />
              </Control>
            </div>
            {shelf.length ? (
              <div className="dial-track" ref={track}>
                {shelf.map((g) => (
                  <Control
                    key={g.id}
                    aria-pressed={ids.includes(g.id)}
                    aria-label={g.name + (ids.includes(g.id) ? ' 치우기' : ' 올리기')}
                    onClick={(e) => toggle(g.id, e.currentTarget.getBoundingClientRect())}
                  >
                    <GarmentPhoto item={g} />
                  </Control>
                ))}
              </div>
            ) : (
              <p className="dial-empty">
                아직 등록한 옷이 없어요.
                <Control className="link" onClick={() => go('register')}>옷 등록하기</Control>
              </p>
            )}
            {lead && (
              <p className="dial-lead" aria-hidden="true">
                <b>{lead.name}</b>
                <span>
                  {lead.category}
                  {lead.material ? ' · ' + lead.material : ''}
                </span>
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
