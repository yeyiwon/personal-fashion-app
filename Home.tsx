import { useState, useRef, type CSSProperties } from 'react';
import { Icon, GarmentPhoto } from './presentation';
import { useStudio, useScopedState, type PageProps } from './studio';
import { sampleOutfits } from './sample';
import { arrange, firstConditions, firstPreferences } from './lookEngine';
const edits = [
  {
    id: 'sample-evening',
    photo: 'cover',
    title: 'After hours',
    name: '트렌치와 새틴으로 입는 저녁',
    color: '#774353',
  },
  {
    id: 'sample-denim',
    photo: 'model-m-denim',
    title: 'Double denim',
    name: '서로 다른 농도의 데님',
    color: '#526572',
  },
  {
    id: 'sample-graphite',
    photo: 'look-2',
    title: 'Soft tailoring',
    name: '여유롭게 겹쳐 입는 테일러링',
    color: '#74756e',
  },
];
export default function Home({ go }: PageProps) {
  const {
    mode,
    garments,
    outfits,
    setActiveGarmentId,
    setSelectedIds,
    setEditLookId,
  } = useStudio();
  const [index, select] = useState(0),
    [pinned, focusPin] = useState<number | null>(null),
    start = useRef<{ x: number; y: number } | null>(null);
  const [conditions] = useScopedState('look.conditions', firstConditions),
    [prefs] = useScopedState('look.preferences', firstPreferences);
  const [name] = useScopedState('display-name', '');
  const edit = edits[index],
    sample = mode === 'sample';
  const suggestions = [0, 1, 2]
    .map((variation) =>
      arrange(garments, conditions, {
        color: prefs.color,
        style: prefs.style,
        variation,
      }),
    )
    .filter(
      (choice, i, list) =>
        list.findIndex(
          (other) =>
            other.map((g) => g.id).join('/') ===
            choice.map((g) => g.id).join('/'),
        ) === i,
    );
  const count = sample || !garments.length ? edits.length : suggestions.length;
  const suggested = suggestions[index % count] ?? [];
  const pieces = sample
    ? sampleOutfits
        .find((o) => o.id === edit.id)!
        .garmentIds.flatMap((id) => garments.filter((g) => g.id === id))
    : suggested;
  const date = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  const move = (d: number) => {
    focusPin(null);
    select((i) => (i + d + count) % count);
  };
  const pinIndex = index === 0 ? 1 : 0,
    tagged = pieces[pinIndex];
  function openLook(page: string) {
    setSelectedIds(pieces.map((g) => g.id));
    setEditLookId(null);
    go(page);
  }
  return (
    <section className="home">
      <div className="home-title">
        <h1>{name && !sample ? name + '의 ' : ''}오늘의 에디트</h1>
        <span>{date}</span>
      </div>
      <div className="edit-layout">
        <article
          className={'edit-cover' + (sample ? '' : ' personal-cover')}
          style={{ '--scene': edit.color } as CSSProperties}
          onTouchStart={(e) => {
            const t = e.touches[0];
            start.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            if (!start.current) return;
            const dx = e.changedTouches[0].clientX - start.current.x,
              dy = e.changedTouches[0].clientY - start.current.y;
            if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5)
              move(dx < 0 ? 1 : -1);
            start.current = null;
          }}
        >
          {sample ? (
            <img
              key={edit.photo}
              className={'cover-photo shot-' + edit.photo}
              src={'/media/editorial/' + edit.photo + '.webp'}
              alt={edit.name}
              fetchPriority="high"
            />
          ) : pieces.length ? (
            <div className="personal-composition">
              {pieces.slice(0, 3).map((g) => (
                <div key={g.id}>
                  <GarmentPhoto item={g} />
                </div>
              ))}
            </div>
          ) : (
            <img
              className={'cover-photo shot-' + edit.photo}
              src={'/media/editorial/' + edit.photo + '.webp'}
              alt={edit.name}
            />
          )}
          <div className="cover-label">
            <span className="light-point" />
            {sample
              ? '샘플 룩북'
              : pieces.length
                ? '내 옷으로 만든 조합'
                : '샘플 룩북'}
          </div>
          {count > 1 && (
            <div className="cover-actions">
              <button aria-label="이전 룩" onClick={() => move(-1)}>
                <Icon name="back" size={15} />
              </button>
              <span>
                0{(index % count) + 1} / 0{count}
              </span>
              <button aria-label="다음 룩" onClick={() => move(1)}>
                <Icon name="right" size={15} />
              </button>
            </div>
          )}
          {sample && tagged && (
            <div
              className={'look-hotspot' + (pinned === index ? ' expanded' : '')}
            >
              <button
                aria-label={
                  pinned === index
                    ? '의류 태그 닫기'
                    : tagged.name + ' 태그 열기'
                }
                aria-expanded={pinned === index}
                className="pin-trigger"
                onClick={() => focusPin(pinned === index ? null : index)}
              >
                <Icon name={pinned === index ? 'close' : 'plus'} size={14} />
              </button>
              {pinned === index && (
                <button
                  className="pin-inspect"
                  onClick={() => {
                    setActiveGarmentId(tagged.id);
                    go('garment');
                  }}
                >
                  <img src={tagged.image} alt="" />
                  <span>
                    <small>{tagged.category}</small>
                    <b>{tagged.name}</b>
                  </span>
                  <Icon name="diagonal" size={15} />
                </button>
              )}
            </div>
          )}
          <div className="cover-caption">
            <div>
              <h2>
                {sample ? edit.title : pieces.length ? 'Daily mix' : edit.title}
              </h2>
              <p>
                {sample
                  ? edit.name
                  : pieces.length
                    ? conditions.occasion +
                      '에 어울리는 ' +
                      pieces.length +
                      '벌'
                    : edit.name}
              </p>
            </div>
            <button
              aria-label={
                pieces.length ? '이 조합으로 직접 코디' : '첫 옷 등록'
              }
              onClick={() =>
                pieces.length ? openLook('direct') : go('register')
              }
            >
              <Icon name="diagonal" size={25} />
            </button>
          </div>
        </article>
        <div className="edit-sidebar">
          <section className="look-index">
            <div className="section-title">
              <h2>이 룩의 옷</h2>
              <button onClick={() => go('space')}>
                공간에서 보기 <Icon name="diagonal" size={13} />
              </button>
            </div>
            <div className="piece-strip">
              {pieces.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setActiveGarmentId(g.id);
                    go('garment');
                  }}
                >
                  <span className="silhouette">
                    <GarmentPhoto item={g} />
                  </span>
                  <span>{g.name}</span>
                </button>
              ))}
            </div>
            {!pieces.length && (
              <button className="action" onClick={() => go('register')}>
                내 옷 등록하기
              </button>
            )}
            {pieces.length > 0 && (
              <div className="edit-outcome">
                <div className="cloth-colors" aria-label="착장 대표색">
                  {pieces.map((g) => (
                    <i key={g.id} style={{ background: g.color }} />
                  ))}
                </div>
                <button
                  className="text-action"
                  onClick={() => openLook('fitting')}
                >
                  피팅 보드에 담기 <Icon name="right" size={15} />
                </button>
              </div>
            )}
          </section>
          <section className="studio-entries">
            <div className="section-title">
              <h2>스타일 스튜디오</h2>
              <button onClick={() => go('tools')}>
                전체 메뉴 <Icon name="grid" size={15} />
              </button>
            </div>
            <div className="entry-grid">
              <button
                onClick={() => go('colors')}
                className="entry-tile color-entry"
              >
                <span className="color-fan" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <b>색상별 코디</b>
                <Icon name="diagonal" size={16} />
              </button>
              <button
                onClick={() => go('model')}
                className="entry-tile model-entry"
              >
                <img src="/media/editorial/model-f.webp" alt="" />
                <b>개인 모델</b>
                <Icon name="diagonal" size={16} />
              </button>
            </div>
            <button className="stylist-line" onClick={() => go('stylist')}>
              <span className="atelier-mark">
                <Icon name="studio" size={19} />
              </span>
              <b>AI 스타일리스트</b>
              <span>코디 상담</span>
              <Icon name="arrow" size={17} />
            </button>
          </section>
        </div>
      </div>
      {suggested.length > 0 && (
        <section className="today-recommend">
          <div>
            <span className="today-meta">
              {conditions.occasion} · {conditions.weather} · {prefs.style}
            </span>
            <h2>오늘의 코디</h2>
            <p>
              {suggested
                .slice(0, 2)
                .map((g) => g.name)
                .join('에 ')}
              {suggested.length > 1 ? ' 조합' : ''}
            </p>
            <button onClick={() => go('ai')}>
              추천 조정하기 <Icon name="arrow" size={15} />
            </button>
          </div>
          <button
            className="today-items"
            onClick={() => go('ai')}
            aria-label="오늘의 코디 살펴보기"
          >
            {suggested.slice(0, 3).map((g) => (
              <span key={g.id}>
                <GarmentPhoto item={g} />
              </span>
            ))}
          </button>
        </section>
      )}
      <div className="home-bottom">
        <div className="section-title">
          <h2>나의 패션 기록</h2>
          <button onClick={() => go('calendar')}>
            캘린더 <Icon name="diagonal" size={13} />
          </button>
        </div>
        <div className="home-links">
          {[
            ['closet', '내 옷장', garments.length + '벌', 'closet'],
            ['saved', '저장한 코디', outfits.length + '개', 'save'],
            ['weather', '날씨와 일정', conditions.occasion, 'settings'],
            ['travel', '여행 코디', '짐 싸기', 'shop'],
          ].map(([p, t, info, icon]) => (
            <button key={p} onClick={() => go(p)}>
              <Icon name={icon} />
              <b>{t}</b>
              <small>{info}</small>
              <Icon name="right" size={15} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
