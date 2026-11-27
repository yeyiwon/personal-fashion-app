import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { useStudio, useScopedState, type PageProps } from './studio';
import { GarmentPhoto, Icon, haptic, message } from './presentation';
import {
  initialFigure,
  products,
  photoPath,
  hairNames,
  type Figure,
} from './atelierData';
import { RoomAssistant, type Advice } from './RoomAssistant';
import { GlassSurface } from './RoomControls';
import {
  arrange,
  firstConditions,
  firstPreferences,
  localDate,
} from './lookEngine';
import {
  slots,
  slot,
  wearPiece,
  paintAvatar,
  skinTones,
  clearRoomAssets,
  jpegData,
  type Piece,
} from './avatarLayers';
import { FigurePreview } from './FigurePreview';
import { scales, Tape } from './MeasureMirror';
import Capture from './Capture';
import { GarmentForm } from './GarmentForm';
import { prepareImage } from './images';
import { CATEGORIES, type Category } from './domain';
import RoomPhotoFitting from './RoomPhotoFitting';
import './dressing.css';
import { OpticalStage } from './OpticalStage';
import BelloSpace from './BelloSpace';
import {BelloMark} from './BelloAtlas';

type Panel =
  | 'closet'
  | 'model'
  | 'current'
  | 'camera'
  | 'save'
  | 'fit'
  | 'palette'
  | 'reference'
  | null;
type RefPiece = {
  id: string;
  name: string;
  category: Category;
  image: string;
  color: string;
};
const shopPieces: Piece[] = products.map((p) => ({
  ...p,
  id: 'shop-' + p.id,
  image: photoPath(p.id),
  source: 'candidate',
  condition: '착용 중',
  createdAt: '',
  updatedAt: '',
}));
const initialDress = ['sample-shirt', 'sample-skirt', 'sample-slingback'];
function same(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
function SmallButton({
  icon,
  label,
  onClick,
  pressed,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      className="mirror-tool"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
    >
      <Icon name={icon} size={18} />
      <small>{label}</small>
    </button>
  );
}
export default function Home({
  go,
  onMode,onAtlas,
  page,
}: { onMode: () => void; onAtlas:()=>void } & PageProps) {
  const studio = useStudio();
  const {
    mode,
    garments,
    outfits,
    selectedIds,
    setSelectedIds,
    saveLook,
    refresh,
    setMode,
    notify,
  } = studio;
  const [figure, setFigure] = useScopedState<Figure>('model', initialFigure),
    [skin, setSkin] = useScopedState('avatar.skin', '기본');
  const [privatePhoto, setPhoto] = useScopedState('model-reference', ''),
    [face, setFace] = useScopedState('model-face', '');
  const [refPieces, setRefs] = useScopedState<RefPiece[]>('avatar.refs', []);
  const [externals, setExternals] = useScopedState<string[]>(
      'avatar.extra',
      [],
    ),
    [touched, touch] = useScopedState('avatar.dressed', false);
  const [locks, setLocks] = useScopedState<string[]>('avatar.locks', []);
  const [candidate, setCandidate] = useScopedState('fitting-product', '');
  const [favs, setFavs] = useScopedState<
    { name: string; ids: string[]; figure: Figure; skin: string }[]
  >('avatar.looks', []);
  const [conditions] = useScopedState('look.conditions', firstConditions),
    [prefs] = useScopedState('look.preferences', firstPreferences);
  const [panel, setPanel] = useState<Panel>(page === 'model' ? 'model' : page === 'fitting' ? 'current' : null),
    [assistant, setAssistant] = useState(page === 'stylist'),
    [group, setGroup] = useState('전체'),
    [source, setSource] = useState('내 옷'),
    [search, setSearch] = useState('');
  const [dim, setDim] = useState<(typeof scales)[number][0]>('height');
  const [angle, turn] = useState(0),
    [diagram, setDiagram] = useState(false),
    [zoom, setZoom] = useState(false);
  const [history, record] = useState<string[][]>([]),
    [selection, select] = useState(''),
    [error, showError] = useState(''),
    [working, busy] = useState(false);
  const [missing, setMissing] = useState<{ misses: string[]; uncut: string[] }>(
    { misses: [], uncut: [] },
  );
  const [files, setFiles] = useState<File[]>([]),
    [lookName, setLookName] = useState(''),
    [dragging, drag] = useState<Piece | null>(null);
  const [refName, setRefName] = useState(''),
    [refCategory, refCat] = useState<Category>('상의'),
    [refImage, refImg] = useState(''),
    [refColor, refTone] = useState('#85837e');
  const avatar = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    ghost = useRef<HTMLDivElement>(null);
  const imported = useRef(false);
  const avatarReady = useRef(false),
    dragged = useRef(false),
    pointer = useRef<{ x: number; y: number; id: number; item: Piece } | null>(
      null,
    );
  const pointers = useRef(new Map<number, { x: number; y: number }>()),
    pinchDistance = useRef(0);
  const all = useMemo<Piece[]>(
    () => [
      ...garments,
      ...shopPieces,
      ...refPieces.map((p): Piece => ({
        ...p,
        source: 'reference',
        condition: '착용 중',
        createdAt: '',
        updatedAt: p.id,
        price: null,
      })),
    ],
    [garments, refPieces],
  );
  const owned = selectedIds.filter((id) => garments.some((g) => g.id === id));
  const ids = [
    ...(!touched && !owned.length && mode === 'sample' ? initialDress : owned),
    ...externals,
  ].filter((id) => all.some((g) => g.id === id));
  const items = ids.flatMap((id) => all.filter((g) => g.id === id)),
    active = all.find((g) => g.id === selection);
  const signature = JSON.stringify(items.map((g) => [g.id, g.updatedAt]));
  useEffect(() => {
    let live = true;
    avatarReady.current = false;
    if (avatar.current)
      paintAvatar(avatar.current, figure, skin, items, () => live)
        .then((r) => {
          if (live && r) {
            setMissing(r);
            avatarReady.current = true;
          }
        })
        .catch(() => {
          if (live) showError('아바타를 불러오지 못했어요. 다시 열어 주세요.');
        });
    return () => {
      live = false;
    };
  }, [figure, skin, signature]);
  useEffect(
    () => () => {
      clearRoomAssets();
    },
    [],
  );
  useEffect(() => {
    if (!candidate) return;
    const p = shopPieces.find((g) => g.id === 'shop-' + candidate);
    if (p) {
      apply(wearPiece(ids, p, all, locks));
      select(p.id);
      setPanel('current');
    }
    setCandidate('');
  }, [candidate]);
  const openPanel = useCallback((v: Panel) => {
    setAssistant(false);
    setPanel(v);
    showError('');
  }, []);
  const openAssistant = useCallback((v: boolean) => {
    if (v) setPanel(null);
    setAssistant(v);
  }, []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
        setAssistant(false);
        setPanel(null);
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  function apply(next: string[], remember = true) {
    if (same(ids, next)) return;
    if (remember) record((h) => [...h.slice(-11), ids]);
    touch(true);
    setSelectedIds(next.filter((id) => garments.some((g) => g.id === id)));
    setExternals(next.filter((id) => all.some((g) => g.id === id && g.source)));
    haptic('selection');
  }
  function put(g: Piece) {
    const next = wearPiece(ids, g, all, locks);
    if (same(next, ids) && !ids.includes(g.id)) {
      notify('교체할 부위의 고정을 먼저 풀어 주세요.');
      return;
    }
    apply(next);
    select(g.id);
    setDiagram(false);
  }
  function toggleLock(id: string) {
    setLocks((q) => (q.includes(id) ? q.filter((v) => v !== id) : [...q, id]));
  }
  function remove(id: string) {
    if (locks.includes(id)) {
      notify('고정을 먼저 풀어 주세요.');
      return;
    }
    apply(ids.filter((v) => v !== id));
  }
  function undo() {
    if (!history.length) return;
    apply(history.at(-1)!, false);
    record((h) => h.slice(0, -1));
  }
  function whole(next: string[]) {
    let result = ids.filter((id) => locks.includes(id));
    next.forEach((id) => {
      const g = all.find((x) => x.id === id);
      if (g) result = wearPiece(result, g, all, locks);
    });
    apply(result);
    setDiagram(false);
  }
  function roll() {
    const picks = arrange(garments, conditions, {
      locked: locks,
      variation: 1 + Math.floor(Math.random() * 17),
      style: prefs.style,
      color: prefs.color,
    });
    whole(picks.map((p) => p.id));
  }
  function action(a: Advice) {
    const valid = a.ids.filter((id) => garments.some((g) => g.id === id));
    if (valid.length !== a.ids.length) {notify('제안 이후 옷장이 바뀌었어요. 현재 옷으로 다시 요청해 주세요.');return;}
    if (a.tool === 'none') return;
    if (a.tool === 'outfit' && valid.length) {
      whole(valid);
      openPanel('current');
    } else if (a.tool === 'swap' && valid.length) {
      let next = ids;
      for (const id of valid)
        next = wearPiece(
          next,
          all.find((g) => g.id === id)!,
          all,
          locks,
        );
      apply(next);
      openPanel('current');
    } else if (a.tool === 'lock' && valid.length) {
      const targets = valid.filter((id) => ids.includes(id));
      if (targets.length) setLocks((q) => [...new Set([...q, ...targets])]);
      else notify('현재 착용 중인 옷을 선택해 주세요.');
      openPanel('current');
    } else if (a.tool === 'shopping') {
      setSource('구매 후보');
      setGroup('전체');
      openPanel('closet');
    } else if (a.tool === 'save') {
      void save(true);
    } else if (a.tool === 'palette') {
      openPanel('palette');
    } else if (a.tool === 'fitting') {
      if (valid.length) whole(valid);
      openPanel('fit');
    } else openPanel('closet');
  }
  function start(e: PointerEvent<HTMLButtonElement>, g: Piece) {
    if (e.button !== 0) return;
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, item: g };
    dragged.current = false;
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    // A vertical swipe browses the rail. Pull a piece inward to dress the avatar.
    if (
      !dragged.current &&
      e.clientX-p.x > 9 && Math.abs(e.clientY-p.y) < e.clientX-p.x
    ) {
      dragged.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag(p.item);
    }
    if (dragged.current && ghost.current) {
      ghost.current.style.left = e.clientX + 'px';
      ghost.current.style.top = e.clientY + 'px';
    }
  }
  function finish(e: PointerEvent<HTMLButtonElement>) {
    const p = pointer.current;
    pointer.current = null;
    if (!p) return;
    const b = avatar.current?.getBoundingClientRect();
    if (
      dragged.current &&
      b &&
      e.clientY >= b.top &&
      e.clientY < b.bottom &&
      e.clientX >= b.left &&
      e.clientX <= b.right
    ) {
      put(p.item);
      setPanel(null);
    }
    drag(null);
  }
  const [savedKey,markSaved]=useState('');
  const snapshotKey=JSON.stringify([ids,figure,skin]);
  async function save(quick=false) {
    if (working) return;
    busy(true);
    try {
      const title=quick ? (items.find(g=>['상의','원피스','아우터'].includes(g.category))?.name??items[0]?.name??'오늘')+' 착장' : lookName.trim();
      if (!title) throw Error('착장 이름을 입력해 주세요.');
      if (!ids.length) throw Error('먼저 옷을 입혀 주세요.');
      if (items.every((g) => !g.source)) await saveLook(title, ids);
      setFavs((f) =>
        [
          { name: title, ids, figure: { ...figure }, skin },
          ...f,
        ].slice(0, 30),
      );
      setLookName('');
      markSaved(snapshotKey);haptic('success');
      notify(title+'을 저장했어요.');
      openPanel(null);
    } catch (e) {
      showError(message(e));
    } finally {
      busy(false);
    }
  }
  async function share() {
    if (!avatarReady.current || !avatar.current) return;
    const blob = await new Promise<Blob | null>((r) =>
      avatar.current!.toBlob(r, 'image/png'),
    );
    if (!blob) return;
    const file = new File([blob], 'wardrobe-look.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '나의 드레스룸 착장' });
        return;
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      notify('착장 이미지를 내보냈어요.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        showError('이미지를 내보낼 수 없어요.');
    }
  }
  const selectionItems = (
    source === '구매 후보'
      ? shopPieces
      : source === '참고 사진'
        ? all.filter((g) => g.source === 'reference')
        : garments
  ).filter(
    (g) =>
      (group === '전체' || slot(g) === group) && g.name.includes(search.trim()),
  );
  const shelf =
    panel === 'closet'
      ? selectionItems
      : [
          ...garments.filter((g) => !ids.includes(g.id)),
          ...items.filter((g) => !g.source),
        ].slice(0, 8);
  const occluded = [...missing.misses, ...missing.uncut];
  function garmentButton(g: Piece) {
    return (
      <button
        key={g.id}
        className={'hanger-piece' + (ids.includes(g.id) ? ' wearing' : '')}
        aria-label={g.name + ' 입히기'}
        aria-pressed={ids.includes(g.id)}
        onPointerDown={(e) => start(e, g)}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          pointer.current = null;
          drag(null);
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          put(g);
        }}
      >
        <span>
          <GarmentPhoto item={g} />
          {ids.includes(g.id) && (
            <i>
              <Icon name="check" size={11} />
            </i>
          )}
        </span>
        <small>{g.name}</small>
      </button>
    );
  }
  const gauge = scales.find((d) => d[0] === dim)!;
  return (
    <div
      className={
        'live-room ' +
        (panel ? ' has-panel panel-' + panel : '') +
        (assistant ? ' assistant-open' : '')
      }
      style={
        {
          '--garment-light': active?.color ?? items[0]?.color ?? '#a2a995',
        } as CSSProperties
      }
    >
      <h1 className="visually-hidden">{page === 'model' ? '개인 모델' : page === 'fitting' ? '가상 피팅' : '나의 드레스룸'}</h1>
      <div className="room-scene" ref={stage}>
        <BelloSpace signal={items.length+selection.length} /><OpticalStage mode="mirror" focus={panel ? 1 : 0} signal={items.length+selection.length}/>
        <div className="alcove-bounce" />
        <header className="dressing-head">
          <button
            onClick={onAtlas}
            className="room-sign"
            aria-label="공간 이동"
          >
            <BelloMark size={25} /><span>BELLO</span><Icon name="grid" size={13}/>
          </button>
          <button className="mode-pin" onClick={onMode}>
            {mode === 'sample' ? '샘플 옷장' : '개인 옷장'}{' '}
            <Icon name="down" size={12} />
          </button>
        </header>
        <div
          className={
            'avatar-floor ' +
            (zoom ? 'closeup ' : '') +
            (diagram ? ' schematic' : '')
          }
          onPointerDown={(e) => {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.current.size === 2) {
              const [a, b] = [...pointers.current.values()];
              pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
            }
          }}
          onPointerMove={(e) => {
            if (!pointers.current.has(e.pointerId)) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.current.size === 2) {
              const [a, b] = [...pointers.current.values()];
              const d =
                Math.hypot(a.x - b.x, a.y - b.y) - pinchDistance.current;
              if (Math.abs(d) > 12) setZoom(d > 0);
            }
          }}
          onPointerUp={(e) => pointers.current.delete(e.pointerId)}
          onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        >
          <div className="sole-shadow" />
          <canvas
            ref={avatar}
            width={400}
            height={1000}
            aria-label={
              '실시간 2D 착장 · ' +
              (items.map((g) => g.name).join(', ') || '기본 아바타')
            }
            role="img"
            hidden={diagram}
          />
          {diagram && (
            <FigurePreview
              figure={figure}
              angle={angle}
              turn={turn}
              garments={items}
            />
          )}
        </div>
        {!assistant && (
          <>
            <div className="room-edge-tools">
              <SmallButton
                icon="model"
                label="모델 조절"
                onClick={() => openPanel(panel === 'model' ? null : 'model')}
                pressed={panel === 'model'}
              />
              <SmallButton
                icon="fit"
                label={zoom ? '전신 보기' : '확대'}
                onClick={() => setZoom(!zoom)}
                pressed={zoom}
              />
            </div>
            <div className="room-caption">
              <i />
              {diagram ? '착장 실루엣 도식' : '실시간 2D 착장'}
              {occluded.length > 0 && (
                <button onClick={() => openPanel('current')}>
                  사진 확인 {occluded.length}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <RoomAssistant
        key={mode}
        open={assistant}
        setOpen={openAssistant}
        worn={ids}
        locked={locks.filter((id) => ids.includes(id))}
        act={action}
      />
      <div
        className={'wardrobe-tray ' + (panel === 'closet' ? 'unfold' : '')}
        inert={assistant || !!(panel && panel !== 'closet')}
      >
        <div className="tray-grip" />
        <div className="tray-heading">
          <button
            onClick={() => {
              openPanel(panel === 'closet' ? null : 'closet');
              setSource('내 옷');
              setGroup('전체');
              setSearch('');
            }}
            aria-expanded={panel === 'closet'}
          >
            <Icon name="closet" size={20} />
            <strong>내 옷장</strong>
            <small>{garments.length}벌</small>
            <Icon name="down" size={13} />
          </button>
          <button onClick={() => openPanel('camera')} aria-label="옷 촬영">
            <Icon name="camera" size={19} />
            <span>촬영</span>
          </button>
        </div>
        {panel === 'closet' && (
          <div className="tray-filters">
            <div className="source-tabs">
              {['내 옷', '구매 후보', '참고 사진'].map((t) => (
                <button
                  key={t}
                  aria-pressed={source === t}
                  onClick={() => {
                    setSource(t);
                    setGroup('전체');
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="slot-strip">
              {['전체', ...slots].map((t) => (
                <button
                  key={t}
                  aria-pressed={group === t}
                  onClick={() => setGroup(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="search"
              aria-label="드레스룸 의류 검색"
              placeholder="옷 이름으로 찾기"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {source === '구매 후보' && (
              <small>구매 전 조합을 위한 샘플 상품</small>
            )}
            {source === '참고 사진' && (
              <button onClick={() => openPanel('reference')}>
                참고 사진 추가
              </button>
            )}
          </div>
        )}
        <div className="hanger-strip">
          {shelf.map(garmentButton)}
          {!shelf.length && (
            <p>
              {garments.length
                ? '이 조건에 맞는 옷이 없어요.'
                : '아직 옷이 없어요. 촬영하거나 앨범에서 첫 옷을 담아 보세요.'}
            </p>
          )}
        </div>
      </div>
      {!panel&&!assistant&&<div className="look-stamp">
        <button className="look-label" onClick={()=>openPanel('current')} aria-label={'착장 '+items.length+'점'}><span>나의 피팅룸</span><small>착장 {items.length}점 <Icon name="right" size={12}/></small></button>
        <button className={'stamp-save '+(savedKey===snapshotKey?'stamped':'')} onClick={()=>void save(true)} disabled={!items.length||working||savedKey===snapshotKey}><GlassSurface/><Icon name={savedKey===snapshotKey?'check':'save'} size={17}/>{savedKey===snapshotKey?'저장됨':'착장 저장'}</button>
      </div>}
      {panel && panel !== 'closet' && (
        <section className="room-drawer" aria-label="드레스룸 도구">
          <div className="tray-grip" />
          <header>
            <h2>
              {
                {
                  model: '나의 아바타',
                  current: '입고 있는 옷',
                  camera: '내 옷 촬영',
                  save: '착장 저장',
                  fit: '피팅 엔진',
                  palette: '착장 팔레트',
                  reference: '참고 사진',
                }[panel]
              }
            </h2>
            <button
              aria-label="드레스룸 도구 닫기"
              onClick={() => openPanel(null)}
            >
              <Icon name="close" size={19} />
            </button>
          </header>
          <div className="drawer-scroll">
            {panel === 'current' && (
              <>
                <div className="dressing-actions">
                  <button onClick={undo} disabled={!history.length}>
                    되돌리기
                  </button>
                  <button onClick={roll} disabled={!garments.length}>
                    랜덤 스타일링
                  </button>
                  <button onClick={() => openPanel('fit')}>AI 실사 피팅</button>
                </div>
                {items.map((g) => (
                  <div className="worn-row" key={g.id}>
                    <GarmentPhoto item={g} />
                    <span>
                      <b>{g.name}</b>
                      <small>
                        {slot(g)}
                        {g.source
                          ? ' · ' +
                            (g.source === 'candidate'
                              ? '구매 후보'
                              : '참고 사진')
                          : ''}
                        {occluded.includes(g.name)
                          ? ' · 사진 분리 불가, 보드에서 확인'
                          : ''}
                      </small>
                    </span>
                    <button
                      aria-label={g.name + ' 고정'}
                      aria-pressed={locks.includes(g.id)}
                      onClick={() => toggleLock(g.id)}
                    >
                      {locks.includes(g.id) ? '고정됨' : '고정'}
                    </button>
                    <button
                      aria-label={g.name + ' 벗기기'}
                      onClick={() => remove(g.id)}
                      disabled={locks.includes(g.id)}
                    >
                      벗기기
                    </button>
                  </div>
                ))}
                {!items.length && <p>옷장에서 한 벌을 골라 입혀 주세요.</p>}
                <div className="dressing-actions">
                  <button onClick={() => openPanel('closet')}>옷 고르기</button>
                  <button onClick={() => openPanel('save')} disabled={!items.length}>이름 지정해 저장</button>
                  <button onClick={() => go('fitting-board')}>피팅 보드</button>
                  <button onClick={() => void share()}>착장 이미지 공유</button>
                </div>
                {(outfits.length > 0 || favs.length > 0) && (
                  <details>
                    <summary>저장한 착장 입기</summary>
                    {favs.map((f, i) => (
                      <button
                        className="room-row"
                        key={'f' + i}
                        onClick={() => {
                          whole(f.ids);
                          setFigure(f.figure);
                          setSkin(f.skin);
                        }}
                      >
                        {f.name}
                      </button>
                    ))}
                    {outfits
                      .filter((o) => !favs.some((f) => f.name === o.name))
                      .map((o) => (
                        <button
                          className="room-row"
                          key={o.id}
                          onClick={() => whole(o.garmentIds)}
                        >
                          {o.name}
                        </button>
                      ))}
                  </details>
                )}
              </>
            )}
            {panel === 'model' && (
              <>
                <button className="room-row" onClick={() => go('model-study')}>모델 치수와 참고 사진 <Icon name="arrow" size={15}/></button>
                <div className="dressing-actions">
                  {(['f', 'm'] as const).map((base) => (
                    <button
                      key={base}
                      aria-pressed={figure.base === base}
                      onClick={() => setFigure((f) => ({ ...f, base }))}
                    >
                      {base === 'f' ? '여성형' : '남성형'}
                    </button>
                  ))}
                  <button
                    aria-pressed={diagram}
                    onClick={() => {
                      setDiagram(!diagram);
                      setZoom(false);
                    }}
                  >
                    {diagram ? '착장 정면' : '회전 도식'}
                  </button>
                </div>
                {diagram && (
                  <label>
                    도식 회전 {angle}°
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={angle}
                      onChange={(e) => turn(+e.target.value)}
                    />
                  </label>
                )}
                <div className="slot-strip">
                  {scales.map((d) => (
                    <button
                      key={d[0]}
                      aria-pressed={d[0] === dim}
                      onClick={() => setDim(d[0])}
                    >
                      {d[1]}
                    </button>
                  ))}
                </div>
                <label className="measure-reading">
                  {gauge[1]}{' '}
                  <b>
                    {figure[dim] ?? gauge[5]}
                    {gauge[4]}
                  </b>
                </label>
                <Tape
                  title={gauge[1]}
                  min={gauge[2]}
                  max={gauge[3]}
                  value={figure[dim] ?? gauge[5]}
                  unit={gauge[4]}
                  change={(v) => setFigure((f) => ({ ...f, [dim]: v }))}
                />
                <div className="skin-row">
                  피부 톤{' '}
                  {skinTones.map((v, i) => (
                    <button
                      key={v}
                      aria-label={v + ' 피부 톤'}
                      aria-pressed={skin === v}
                      onClick={() => {
                        setSkin(v);
                        setDiagram(false);
                      }}
                      style={{
                        background: [
                          '#dfb59b',
                          '#cc9c7e',
                          '#aa9378',
                          '#795941',
                        ][i],
                      }}
                    />
                  ))}
                </div>
                <details>
                  <summary>헤어와 참고 사진</summary>
                  <div className="dressing-actions">
                    {Object.entries(hairNames).map(([v, n]) => (
                      <button
                        key={v}
                        aria-pressed={figure.hair === v}
                        onClick={() => {
                          setFigure((f) => ({
                            ...f,
                            hair: v as Figure['hair'],
                          }));
                          setDiagram(true);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <label>
                    도식 헤어 컬러
                    <input
                      type="color"
                      value={figure.hairColor ?? '#40312e'}
                      onChange={(e) => {
                        setFigure((f) => ({ ...f, hairColor: e.target.value }));
                        setDiagram(true);
                      }}
                    />
                  </label>
                  {(['전신', '얼굴'] as const).map((t) => (
                    <label key={t}>
                      {t} 참고 사진
                      {(t === '전신' ? privatePhoto : face) ? ' · 저장됨' : ''}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const p = await prepareImage(f);
                            (t === '전신' ? setPhoto : setFace)(
                              await jpegData(p.preview, 680),
                            );
                            notify('기기에 보관했어요.');
                          } catch (x) {
                            showError(message(x));
                          }
                        }}
                      />
                    </label>
                  ))}
                </details>
              </>
            )}
            {panel === 'camera' && (
              <>
                <Capture
                  go={(p) => (p === 'register' ? openPanel(null) : go(p))}
                  onReview={(list) => {
                    imported.current = false;
                    setFiles(list);
                  }}
                />
                <button className="room-row" onClick={() => go('purchases')}>
                  구매 내역·상품 링크로 가져오기 <Icon name="arrow" size={15} />
                </button>
              </>
            )}
            {panel === 'reference' && (
              <>
                <label>
                  의류 사진
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const p = await prepareImage(f);
                        refImg(await jpegData(p.preview, 640));
                        refTone(p.color);
                        setRefName(f.name.replace(/\.[^.]+$/, ''));
                      } catch (x) {
                        showError(message(x));
                      }
                    }}
                  />
                </label>
                <label>
                  이름
                  <input
                    value={refName}
                    maxLength={80}
                    onChange={(e) => setRefName(e.target.value)}
                  />
                </label>
                <label>
                  분류
                  <select
                    value={refCategory}
                    onChange={(e) => refCat(e.target.value as Category)}
                  >
                    {CATEGORIES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={!refImage || !refName.trim()}
                  onClick={() => {
                    try {
                      setRefs((v) => [
                        ...v,
                        {
                          id: 'ref-' + crypto.randomUUID(),
                          name: refName.trim(),
                          image: refImage,
                          color: refColor,
                          category: refCategory,
                        },
                      ]);
                      refImg('');
                      setSource('참고 사진');
                      openPanel('closet');
                    } catch (e) {
                      showError(message(e));
                    }
                  }}
                >
                  참고 옷걸이에 보관
                </button>
              </>
            )}
            {panel === 'save' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <p>
                  {items.map((g) => g.name).join(' · ') ||
                    '아직 선택한 옷이 없어요.'}
                </p>
                <label>
                  착장 이름
                  <input
                    autoFocus
                    value={lookName}
                    onChange={(e) => setLookName(e.target.value)}
                    maxLength={80}
                    placeholder={localDate() + ' 착장'}
                  />
                </label>
                <button
                  className="primary-room"
                  disabled={working || !items.length || !lookName.trim()}
                >
                  이 착장 저장
                </button>
                <button type="button" onClick={() => void share()}>
                  이미지 공유
                </button>
              </form>
            )}
            {panel === 'fit' && (
              <RoomPhotoFitting items={items} figure={figure} />
            )}
            {panel === 'palette' && (
              <>
                {items.map((g) => (
                  <div className="room-row" key={g.id}>
                    <i
                      className="pigment-chip"
                      style={{ background: g.color }}
                    />
                    {g.name}
                  </div>
                ))}
                <button onClick={() => go('colors')}>톤온톤·톤인톤 탐색</button>
              </>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <GarmentForm
          files={files}
          onClose={() => {
            setFiles([]);
            if (imported.current) setMode('personal');
            openPanel('closet');
          }}
          onSaved={(g) => {
            imported.current = true;
            void refresh();
            select(g.id);
            setSource('내 옷');
            notify('개인 옷장에 저장했어요. 바로 입어 볼 수 있어요.');
          }}
        />
      )}
      {dragging && (
        <div ref={ghost} className="lifted-garment">
          <GarmentPhoto item={dragging} />
        </div>
      )}
      {error && !panel && (
        <p className="room-fault" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
