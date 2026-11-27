import { Control, Feedback, Field } from './LiquidControls';
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useStudio, useScopedState, type PageProps } from './studio';
import { GarmentPhoto, Icon, Sheet, message } from './presentation';
import { WardrobeGrid } from './WardrobeGrid';

interface Spot {
  x: number;
  y: number;
}
type Layout = Record<string, Spot>;
type Layouts = Record<string, Layout>;
const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));
function defaultSpot(index: number, count: number): Spot {
  if (count === 1) return { x: 50, y: 49 };
  if (count <= 4)
    return [
      { x: 31, y: 31 },
      { x: 67, y: 61 },
      { x: 25, y: 76 },
      { x: 72, y: 24 },
    ][index]!;
  const cols = Math.ceil(Math.sqrt(count)),
    rows = Math.ceil(count / cols);
  return {
    x: 15 + ((index % cols) * 70) / Math.max(1, cols - 1),
    y: 15 + (Math.floor(index / cols) * 70) / Math.max(1, rows - 1),
  };
}
export function SavedOutfits({ go }: PageProps) {
  const {
    outfits,
    garments,
    selectedIds,
    editLookId,
    setEditLookId,
    setSelectedIds,
    mode,
  } = useStudio();
  const [pending, setPending] = useState<() => void>();
  const current = outfits.find((o) => o.id === editLookId);
  const dirty =
    selectedIds.length > 0 &&
    (!current || current.garmentIds.join('/') !== selectedIds.join('/'));
  function replace(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  return (
    <div className="wc">
      <div className="wc-title">
        <div>
          <h1>저장한 코디</h1>
          <p>
            {mode === 'sample' ? '샘플 옷장' : '내 옷장'}의 조합{' '}
            {outfits.length}개
          </p>
        </div>
        <Control
          className="wc-outline"
          onClick={() =>
            replace(() => {
              setEditLookId(null);
              setSelectedIds([]);
              go('direct');
            })
          }
        >
          <Icon name="plus" size={16} />새 코디
        </Control>
      </div>
      {outfits.length > 0 && (
        <Control className="wc-text" onClick={() => go('lookbook')}>
          룩북 이미지 만들기 <Icon name="diagonal" size={14} />
        </Control>
      )}
      {outfits.length ? (
        <div className="wc-looks">
          {outfits.map((o) => (
            <Control
              className="wc-look"
              key={o.id}
              onClick={() =>
                replace(() => {
                  setEditLookId(o.id);
                  setSelectedIds(o.garmentIds);
                  go('direct');
                })
              }
            >
              <span className="wc-look-photos">
                {o.garmentIds.slice(0, 4).map((id) => {
                  const item = garments.find((g) => g.id === id);
                  return (
                    item && (
                      <span key={id}>
                        <GarmentPhoto item={item} />
                      </span>
                    )
                  );
                })}
              </span>
              <span>
                <strong>{o.name}</strong>
                <small>{o.garmentIds.length}벌</small>
              </span>
              <Icon name="right" size={18} />
            </Control>
          ))}
        </div>
      ) : (
        <div className="wc-empty">
          <Icon name="outfit" size={38} />
          <h2>저장한 코디가 없어요</h2>
          <Control className="wc-text" onClick={() => go('direct')}>
            첫 조합 만들기
          </Control>
        </div>
      )}
      {pending && (
        <Sheet
          title="작성 중인 조합을 바꿀까요?"
          onClose={() => setPending(undefined)}
        >
          <div className="wc-actions">
            <Control
              className="wc-outline"
              onClick={() => setPending(undefined)}
            >
              계속 편집
            </Control>
            <Control
              className="wc-solid"
              onClick={() => {
                pending();
                setPending(undefined);
              }}
            >
              조합 바꾸기
            </Control>
          </div>
        </Sheet>
      )}
    </div>
  );
}
export default function OutfitCanvas({ go }: PageProps) {
  const {
    garments,
    outfits,
    mode,
    selectedIds: ids,
    setSelectedIds: setIds,
    editLookId,
    setEditLookId,
    saveLook,
    removeLook,
    notify,
  } = useStudio();
  const members = ids
    .map((id) => garments.find((g) => g.id === id))
    .filter((g) => g !== undefined);
  const look = outfits.find((o) => o.id === editLookId);
  const [layouts, setLayouts] = useScopedState<Layouts>('look-layouts', {});
  const key = editLookId ?? 'draft';
  const [liveLayout, setLiveLayout] = useState<{
    key: string;
    positions: Layout;
  } | null>(null);
  const layout =
    liveLayout?.key === key ? liveLayout.positions : (layouts[key] ?? {});
  const [active, setActive] = useState('');
  const [allLocks, setAllLocks] = useScopedState<Record<string, string[]>>(
    'canvas-locks',
    {},
  );
  const locked = allLocks[key] ?? [];
  const focused = members.find((g) => g.id === active) ?? members[0];
  const alternatives = focused
    ? garments.filter(
        (g) =>
          g.category === focused.category &&
          !ids.includes(g.id) &&
          g.condition !== '수선 필요',
      )
    : [];
  function toggleLock() {
    if (!focused) return;
    setAllLocks((old) => ({
      ...old,
      [key]: locked.includes(focused.id)
        ? locked.filter((id) => id !== focused.id)
        : [...locked, focused.id],
    }));
  }
  function swap(next: string) {
    if (
      !focused ||
      locked.includes(focused.id) ||
      !alternatives.some((g) => g.id === next)
    )
      return;
    const spot =
      layout[focused.id] ??
      defaultSpot(members.indexOf(focused), members.length);
    const positions = { ...layout, [next]: spot };
    delete positions[focused.id];
    setIds(ids.map((id) => (id === focused.id ? next : id)));
    setLiveLayout({ key, positions });
    setActive(next);
    setSheet(null);
  }
  const [sheet, setSheet] = useState<
    null | 'save' | 'delete' | 'reset' | 'swap'
  >(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; spot: Spot } | null>(
    null,
  );
  function move(id: string, pos: Spot) {
    if (locked.includes(id)) return;
    const point = { x: clamp(pos.x, 12, 88), y: clamp(pos.y, 13, 87) };
    setLiveLayout((previous) => ({
      key,
      positions: {
        ...(previous?.key === key ? previous.positions : layout),
        [id]: point,
      },
    }));
  }
  function pointerDown(
    e: PointerEvent<HTMLButtonElement>,
    id: string,
    spot: Spot,
  ) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, x: e.clientX, y: e.clientY, spot };
    setActive(id);
  }
  function pointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || !board.current) return;
    const { width, height } = board.current.getBoundingClientRect();
    move(d.id, {
      x: d.spot.x + ((e.clientX - d.x) * 100) / width,
      y: d.spot.y + ((e.clientY - d.y) * 100) / height,
    });
  }
  function toggle(id: string) {
    if (ids.includes(id) && locked.includes(id)) {
      notify('고정을 풀면 이 옷을 뺄 수 있어요.');
      return;
    }
    if (ids.includes(id)) {
      setIds(ids.filter((member) => member !== id));
      if (active === id) setActive('');
    } else if (ids.length < 32) {
      setIds([...ids, id]);
      setActive(id);
    } else notify('코디 한 개에 32벌까지 담을 수 있어요.');
  }
  async function commit(remove = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (remove && editLookId) {
        await removeLook(editLookId);
        setLayouts((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([id]) => id !== editLookId),
          ),
        );
        setIds([]);
        setEditLookId(null);
        go('saved');
        notify('코디를 삭제했어요.');
      } else {
        const saved = await saveLook(name, ids, editLookId ?? undefined);
        const positions: Layout = Object.fromEntries(
          members.map((item, i) => [
            item.id,
            layout[item.id] ?? defaultSpot(i, members.length),
          ]),
        );
        setLayouts((prev) => ({ ...prev, [saved.id]: positions }));
        setAllLocks((old) => ({
          ...old,
          [saved.id]: locked.filter((id) => ids.includes(id)),
        }));
        setEditLookId(saved.id);
        setLiveLayout({ key: saved.id, positions });
        notify('코디를 저장했어요.');
      }
      setSheet(null);
    } catch (err) {
      setError(message(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function newLook() {
    setAllLocks((old) => ({ ...old, draft: [] }));
    setIds([]);
    setEditLookId(null);
    setActive('');
    setLiveLayout({ key: 'draft', positions: {} });
    setSheet(null);
  }
  return (
    <div className="wc">
      <div className="wc-title">
        <div>
          <h1>직접 코디</h1>
          <p>
            {look?.name || '새 조합'} <span>·</span>{' '}
            {mode === 'sample' ? '샘플 옷장' : '내 옷장'}
          </p>
        </div>
        <Control
          className="wc-icon"
          aria-label={'저장한 코디 ' + outfits.length}
          onClick={() => go('saved')}
        >
          <Icon name="save" />
        </Control>
      </div>
      <div className="wc-editor">
        <div>
          <div className="wc-board" ref={board} aria-label="코디 캔버스">
            <div className="wc-board-label">
              <Icon name="layer" size={14} />
              {members.length}벌
            </div>
            {members.length ? (
              members.map((g, i) => {
                const spot = layout[g.id] ?? defaultSpot(i, members.length);
                return (
                  <Control
                    key={g.id}
                    className={'wc-cutout' + (active === g.id ? ' active' : '')}
                    aria-label={g.name + ' 위치 조절'}
                    aria-pressed={active === g.id}
                    style={
                      {
                        left: spot.x + '%',
                        top: spot.y + '%',
                        width:
                          (members.length > 4
                            ? Math.max(17, 64 / Math.sqrt(members.length))
                            : members.length === 1
                              ? 53
                              : 40) + '%',
                        '--layer': i + 1,
                      } as CSSProperties
                    }
                    onPointerDown={(e) => pointerDown(e, g.id, spot)}
                    onPointerMove={pointerMove}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    onFocus={() => setActive(g.id)}
                    onKeyDown={(e) => {
                      const d: Record<string, [number, number]> = {
                        ArrowLeft: [-3, 0],
                        ArrowRight: [3, 0],
                        ArrowUp: [0, -3],
                        ArrowDown: [0, 3],
                      };
                      if (d[e.key]) {
                        e.preventDefault();
                        move(g.id, {
                          x: spot.x + d[e.key]![0],
                          y: spot.y + d[e.key]![1],
                        });
                      }
                    }}
                  >
                    <GarmentPhoto item={g} shared />
                  </Control>
                );
              })
            ) : (
              <div className="wc-board-empty">
                <Icon name="layer" size={44} />
                <strong>함께 입을 옷을 골라 주세요</strong>
              </div>
            )}
          </div>
          <p className="wc-hint">
            옷을 끌어 위치를 조정해요. 키보드에서는 방향키를 사용하세요.
          </p>
          {focused && (
            <div className="canvas-context">
              <b>{focused.name}</b>
              <Control
                aria-pressed={locked.includes(focused.id)}
                onClick={toggleLock}
              >
                {locked.includes(focused.id) ? '고정 풀기' : '이 옷 고정'}
              </Control>
              <Control
                disabled={locked.includes(focused.id) || !alternatives.length}
                onClick={() => setSheet('swap')}
              >
                같은 분류로 교체
              </Control>
            </div>
          )}
          {members.length > 0 && (
            <div className="wc-selected">
              {members.map((g) => (
                <Control
                  key={g.id}
                  aria-label={g.name + ' 코디에서 빼기'}
                  onClick={() => toggle(g.id)}
                >
                  {g.name}
                  <Icon name="close" size={12} />
                </Control>
              ))}
            </div>
          )}
          <div className="wc-actions">
            <Control
              className="wc-solid"
              disabled={!members.length}
              onClick={() => {
                setError('');
                setName(look?.name ?? '');
                setSheet('save');
              }}
            >
              <Icon name="save" size={16} />
              코디 저장
            </Control>
            <Control
              className="wc-outline"
              disabled={!members.length}
              onClick={() => go('fitting')}
            >
              피팅으로 보기
            </Control>
          </div>
          <div className="wc-subactions">
            <Control
              className="wc-text"
              onClick={() => (ids.length ? setSheet('reset') : newLook())}
            >
              새 코디
            </Control>
            {look && (
              <Control
                className="wc-text"
                onClick={() => {
                  setError('');
                  setSheet('delete');
                }}
              >
                저장한 코디 삭제
              </Control>
            )}
          </div>
        </div>
        <section>
          <h2>옷장에서 고르기</h2>
          <WardrobeGrid
            onPick={(item) => toggle(item.id)}
            marked={ids}
            compact
          />
          {!garments.length && (
            <Control className="wc-outline" onClick={() => go('register')}>
              옷 등록
            </Control>
          )}
        </section>
      </div>
      {sheet === 'swap' && (
        <Sheet title="교체할 의류" onClose={() => setSheet(null)}>
          <div className="swap-choices">
            {alternatives.map((g) => (
              <Control key={g.id} onClick={() => swap(g.id)}>
                <GarmentPhoto item={g} />
                <span>{g.name}</span>
              </Control>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === 'save' && (
        <Sheet
          title="코디 저장"
          onClose={() => {
            if (!busy) setSheet(null);
          }}
        >
          <form
            className="wc-fields"
            onSubmit={(e) => {
              e.preventDefault();
              void commit();
            }}
          >
            <label>
              코디 이름
              <Field
                required
                autoFocus
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 금요일 출근"
              />
            </label>
            {error && (
              <Feedback role="alert" className="wc-alert">
                {error}
              </Feedback>
            )}
            <Control
              className="wc-solid full"
              aria-busy={busy}
              disabled={busy || !name.trim()}
            >
              {busy ? '저장 중' : '저장하기'}
            </Control>
          </form>
        </Sheet>
      )}
      {(sheet === 'delete' || sheet === 'reset') && (
        <Sheet
          title={
            sheet === 'delete'
              ? '이 코디를 삭제할까요?'
              : '새 조합을 시작할까요?'
          }
          onClose={() => {
            if (!busy) setSheet(null);
          }}
        >
          <p>
            {sheet === 'delete'
              ? '옷장에 있는 개별 의류는 보관돼요.'
              : '저장하지 않은 캔버스 편집은 사라져요.'}
          </p>
          {error && (
            <Feedback role="alert" className="wc-alert">
              {error}
            </Feedback>
          )}
          <div className="wc-actions">
            <Control className="wc-outline" onClick={() => setSheet(null)}>
              취소
            </Control>
            <Control
              className="wc-solid"
              disabled={busy}
              onClick={() =>
                sheet === 'delete' ? void commit(true) : newLook()
              }
            >
              {sheet === 'delete' ? '삭제하기' : '새 코디 시작'}
            </Control>
          </div>
        </Sheet>
      )}
    </div>
  );
}
