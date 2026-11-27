import { useState, useRef, type CSSProperties, type PointerEvent } from 'react';
import { Icon, GarmentPhoto } from './presentation';
import { useStudio, useScopedState, type PageProps } from './studio';
import { arrange, firstConditions, firstPreferences } from './lookEngine';
import { sampleOutfits } from './sample';
import { initialFigure, type Figure } from './atelierData';
import { GlassSurface } from './RoomControls';

const swatchStyle = (tone: string) => ({ '--pigment': tone }) as CSSProperties;

export default function Home({ go }: PageProps) {
  const {
    mode,
    garments,
    outfits,
    setActiveGarmentId,
    setSelectedIds,
    setEditLookId,
  } = useStudio();
  const [variation, choose] = useState(0),
    [picked, pick] = useState<string | null>(null);
  const [conditions] = useScopedState('look.conditions', firstConditions),
    [preferences] = useScopedState('look.preferences', firstPreferences);
  const [figure] = useScopedState<Figure>('model', initialFigure);
  const [name] = useScopedState('display-name', '');
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{
    x: number;
    y: number;
    node: HTMLButtonElement;
    id: string;
    active: boolean;
  } | null>(null);
  const lastDrop = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suggestion = (v: number) =>
    arrange(garments, conditions, {
      color: preferences.color,
      style: preferences.style,
      variation: v,
    });
  const options =
    mode === 'sample'
      ? sampleOutfits.map((look) => ({
          name: look.name,
          items: look.garmentIds.flatMap((id) =>
            garments.filter((g) => g.id === id),
          ),
        }))
      : [0, 1, 2]
          .map((v) => ({
            name: conditions.occasion + ' 코디',
            items: suggestion(v),
          }))
          .filter(
            (l, i, a) =>
              a.findIndex(
                (o) =>
                  o.items.map((g) => g.id).join('|') ===
                  l.items.map((g) => g.id).join('|'),
              ) === i,
          );
  const index = variation % Math.max(1, options.length),
    look = options[index],
    pieces = look?.items ?? [],
    item = pieces.find((g) => g.id === picked);
  const date = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
  function shift(d: number) {
    pick(null);
    choose((index + d + options.length) % Math.max(1, options.length));
  }
  function send(page: string, ids = pieces.map((g) => g.id)) {
    setSelectedIds(ids);
    setEditLookId(null);
    go(page);
  }
  function dragPiece(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.node !== e.currentTarget) return;
    const dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    if (!g.active && Math.hypot(dx, dy) < 8) return;
    if (!g.active) {
      g.active = true;
      g.node.setPointerCapture(e.pointerId);
      setDragging(true);
      pick(g.id);
      start.current = null;
    }
    g.node.style.setProperty('--mx', dx + 'px');
    g.node.style.setProperty('--my', dy + 'px');
  }
  function endDrag(e: PointerEvent<HTMLButtonElement>, cancel = false) {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.active) return;
    lastDrop.current = Date.now();
    g.node.style.removeProperty('--mx');
    g.node.style.removeProperty('--my');
    setDragging(false);
    if (!cancel) {
      const targets =
        document.querySelectorAll<HTMLElement>('[data-drop-room]');
      for (const el of targets) {
        const b = el.getBoundingClientRect();
        if (
          e.clientX >= b.left &&
          e.clientX <= b.right &&
          e.clientY >= b.top &&
          e.clientY <= b.bottom
        ) {
          send(el.dataset.dropRoom!, [g.id]);
          break;
        }
      }
    }
  }
  return (
    <section className="table-room">
      <div className="table-intro">
        <div>
          <span className="date-stamp">{date}</span>
          <h1>
            {name && mode === 'personal' ? name + '의 착장' : '오늘의 착장'}
          </h1>
        </div>
        {pieces.length > 0 && (
          <div className="look-turn">
            <button
              aria-label="이전 착장"
              disabled={options.length < 2}
              onClick={() => shift(-1)}
            >
              <Icon name="back" size={16} />
            </button>
            <span>
              {String(index + 1).padStart(2, '0')} <i>/</i>{' '}
              {String(options.length).padStart(2, '0')}
            </span>
            <button
              aria-label="다음 착장"
              disabled={options.length < 2}
              onClick={() => shift(1)}
            >
              <Icon name="right" size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="desk-layout">
        <div className="desk-primary">
          <div
            className={
              'cloth-table' +
              (item ? ' inspecting' : '') +
              (dragging ? ' carrying' : '')
            }
            data-count={Math.min(pieces.length, 4)}
            style={swatchStyle(item?.color || pieces[0]?.color || '#80666a')}
            onPointerDown={(e) => {
              start.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              if (start.current && options.length > 1) {
                const dx = e.clientX - start.current.x,
                  dy = e.clientY - start.current.y;
                if (Math.abs(dx) > 58 && Math.abs(dx) > 1.7 * Math.abs(dy)) {
                  shift(dx < 0 ? 1 : -1);
                  start.current = null;
                  e.currentTarget.dataset.swiped = String(Date.now());
                }
              }
            }}
            onPointerCancel={() => {
              start.current = null;
            }}
            onClickCapture={(e) => {
              if (
                Date.now() - Number(e.currentTarget.dataset.swiped || 0) <
                250
              ) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
          >
            <div className="table-fabric" aria-hidden="true" />
            <div className="garment-lay">
              {pieces.slice(0, 4).map((g, i) => (
                <button
                  key={g.id}
                  className={
                    'laid-garment slot-' +
                    i +
                    (item?.id === g.id ? ' is-picked' : '')
                  }
                  aria-label={g.name + ' 살펴보기'}
                  aria-pressed={item?.id === g.id}
                  onPointerDown={(e) => {
                    gesture.current = {
                      x: e.clientX,
                      y: e.clientY,
                      node: e.currentTarget,
                      id: g.id,
                      active: false,
                    };
                  }}
                  onPointerMove={dragPiece}
                  onPointerUp={(e) => endDrag(e)}
                  onPointerCancel={(e) => endDrag(e, true)}
                  onClick={() => {
                    if (Date.now() - lastDrop.current > 250)
                      pick(item?.id === g.id ? null : g.id);
                  }}
                >
                  <GarmentPhoto item={g} shared />
                  <span className="sewn-dot">
                    <Icon
                      name={item?.id === g.id ? 'check' : 'plus'}
                      size={12}
                    />
                  </span>
                </button>
              ))}
            </div>
            {dragging && (
              <div className="drop-zones">
                <span data-drop-room="direct">
                  <Icon name="layer" size={17} />
                  코디에 놓기
                </span>
                <span data-drop-room="fitting">
                  <Icon name="fit" size={17} />
                  피팅에 놓기
                </span>
              </div>
            )}
            {!pieces.length && (
              <div className="table-empty">
                <Icon name="closet" size={38} />
                <h2>첫 옷을 펼쳐 보세요</h2>
                <button className="woven-btn" onClick={() => go('register')}>
                  옷 등록 <Icon name="plus" size={16} />
                </button>
              </div>
            )}
            {pieces.length > 0 && (
              <div className={'object-ticket' + (item ? ' ticket-open' : '')}>
                <GlassSurface />
                {item ? (
                  <>
                    <div className="ticket-copy">
                      <small>
                        {item.category}
                        {item.material ? ' · ' + item.material : ''}
                      </small>
                      <strong>{item.name}</strong>
                    </div>
                    <button
                      aria-label={item.name + ' 상세'}
                      onClick={() => {
                        setActiveGarmentId(item.id);
                        go('garment');
                      }}
                    >
                      <Icon name="diagonal" size={17} />
                    </button>
                    <button
                      aria-label={item.name + ' 코디에 놓기'}
                      onClick={() => send('direct', [item.id])}
                    >
                      <Icon name="layer" size={16} />
                    </button>
                    <button aria-label="선택 해제" onClick={() => pick(null)}>
                      <Icon name="close" size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <i className="ticket-pip" />
                    <span>옷을 눌러 살펴보기</span>
                  </>
                )}
              </div>
            )}
          </div>
          {pieces.length > 0 && (
            <div className="swatch-label">
              <div>
                <div className="swatch-thread" aria-label="착장 색상">
                  {pieces.slice(0, 5).map((g) => (
                    <i key={g.id} style={{ background: g.color }} />
                  ))}
                </div>
                <h2>{look.name}</h2>
              </div>
              <button className="woven-btn" onClick={() => send('direct')}>
                코디 열기 <Icon name="diagonal" size={16} />
              </button>
            </div>
          )}
        </div>
        <aside className="table-side">
          <div className="studio-portals">
            <button className="closet-invite" onClick={() => go('closet')}>
              <div className="mini-archive" aria-hidden="true">
                {garments.slice(0, 3).map((g) => (
                  <span key={g.id}>
                    <GarmentPhoto item={g} />
                  </span>
                ))}
              </div>
              <span className="portal-caption">
                <b>내 옷장</b>
                <small>{garments.length}벌</small>
                <Icon name="diagonal" size={15} />
              </span>
            </button>
            <button className="mirror-invite" onClick={() => go('model')}>
              <div className="mirror-thumb">
                <img
                  src={'/media/editorial/study-' + figure.base + '.jpg'}
                  alt=""
                />
              </div>
              <span className="portal-caption">
                <b>개인 모델</b>
                <Icon name="diagonal" size={15} />
              </span>
            </button>
          </div>
          <div className="bench-index">
            <button onClick={() => go('ai')}>
              <Icon name="layer" />
              <span>오늘의 코디 추천</span>
              <small>{conditions.occasion}</small>
              <Icon name="right" size={15} />
            </button>
            <button onClick={() => go('colors')}>
              <Icon name="palette" />
              <span>색상별 코디</span>
              <Icon name="right" size={15} />
            </button>
          </div>
          {pieces.length > 0 && (
            <button className="text-link" onClick={() => send('fitting')}>
              이 착장 피팅 보드에 담기 <Icon name="arrow" size={15} />
            </button>
          )}
        </aside>
      </div>
      <div className="table-log">
        <h2>나의 패션 기록</h2>
        {[
          ['saved', '저장한 코디', outfits.length + '개'],
          ['calendar', '코디 캘린더', ''],
          ['weather', '날씨와 일정', conditions.weather],
          ['travel', '여행 코디', ''],
        ].map(([p, n, s]) => (
          <button key={p} onClick={() => go(p)}>
            {n}
            <small>{s}</small>
            <Icon name="right" size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}
