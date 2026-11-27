import { useState, type FormEvent } from 'react';
import {
  useStudio,
  useScopedState,
  type PageProps,
  type StudioGarment,
} from './studio';
import { GarmentPhoto, Icon } from './presentation';
import {
  arrange,
  dateAtNoon,
  firstConditions,
  firstPreferences,
  idsToItems,
  localDate,
  shiftDate,
  tripLength,
  type Conditions,
} from './lookEngine';
import { LookHead, Miniatures } from './Looks';

type WearEvent = {
  id: string;
  date: string;
  name: string;
  note: string;
  garmentIds: string[];
};
type TripPlan = {
  destination: string;
  start: string;
  end: string;
  days: { date: string; ids: string[] }[];
};
const dayTitle = (date: string) =>
  dateAtNoon(date).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
function JournalNav({ page, go }: PageProps) {
  return (
    <nav className="lk-journal-nav" aria-label="옷장 기록">
      {[
        ['wear', '착용 기록'],
        ['calendar', '캘린더'],
        ['analytics', '활용도'],
      ].map(([key, label]) => (
        <button
          key={key}
          aria-current={page === key ? 'page' : undefined}
          onClick={() => go(key)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function Wear({ go }: Pick<PageProps, 'go'>) {
  const { garments, outfits, selectedIds, notify } = useStudio();
  const [entries, setEntries] = useScopedState<WearEvent[]>('look.wear', []);
  const [day, setDay] = useScopedState('look.day', localDate());
  const initialIds = idsToItems(selectedIds, garments).map((g) => g.id);
  const [picked, setPicked] = useState<string[]>(initialIds);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  function chooseOutfit(id: string) {
    const outfit = outfits.find((o) => o.id === id);
    if (outfit) {
      setPicked(idsToItems(outfit.garmentIds, garments).map((g) => g.id));
      setName(outfit.name);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const items = idsToItems(picked, garments);
    if (!items.length || !day || day > localDate()) return;
    const row: WearEvent = {
      id: crypto.randomUUID(),
      date: day,
      name: name.trim() || items.map((g) => g.name).join(' / '),
      note: note.trim(),
      garmentIds: items.map((g) => g.id),
    };
    setEntries((prev) => [...prev, row]);
    notify('착용 기록을 저장했어요.');
    go('calendar');
  }
  return (
    <>
      <LookHead
        title="착용 기록"
        text="그날 입은 옷과 기억하고 싶은 한 줄을 남겨요."
      />
      {garments.length ? (
        <form className="lk-diaryform" onSubmit={save}>
          <label className="lk-label">
            입은 날짜
            <input
              type="date"
              required
              max={localDate()}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          {outfits.length > 0 && (
            <label className="lk-label">
              저장한 코디에서 불러오기
              <select value="" onChange={(e) => chooseOutfit(e.target.value)}>
                <option value="">코디 선택</option>
                {outfits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <fieldset className="lk-fieldset">
            <legend>입은 옷 · {picked.length}벌</legend>
            <div className="lk-itemgrid">
              {garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={picked.includes(g.id)}
                  onClick={() =>
                    setPicked(
                      picked.includes(g.id)
                        ? picked.filter((i) => i !== g.id)
                        : [...picked, g.id],
                    )
                  }
                >
                  <GarmentPhoto item={g} />
                  <span>{g.name}</span>
                  {picked.includes(g.id) && <i>✓</i>}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="lk-label">
            코디 이름 <small>선택</small>
            <input
              maxLength={80}
              placeholder="예: 금요일 출근"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="lk-label">
            메모 <small>선택</small>
            <textarea
              value={note}
              maxLength={300}
              placeholder="하루 종일 걷기 편했던 조합"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            className="lk-main"
            disabled={!picked.length || !day || day > localDate()}
          >
            착용 기록 저장
          </button>
        </form>
      ) : (
        <div className="lk-empty">
          <h2>먼저 옷을 등록해 주세요</h2>
          <button className="lk-main" onClick={() => go('register')}>
            옷 등록
          </button>
        </div>
      )}
      <p className="lk-note">
        지금까지 {entries.length}개의 착용 기록을 남겼어요.
      </p>
    </>
  );
}

function Calendar({ go }: Pick<PageProps, 'go'>) {
  const { garments, notify } = useStudio();
  const [entries, setEntries] = useScopedState<WearEvent[]>('look.wear', []);
  const [selected, setSelected] = useScopedState('look.day', localDate());
  const [month, setMonth] = useState((selected || localDate()).slice(0, 7));
  const [removing, setRemoving] = useState('');
  const active = selected || localDate();
  const first = dateAtNoon(month + '-01');
  const count = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  const chosen = entries.filter((row) => row.date === active);
  function move(delta: number) {
    const d = new Date(first.getFullYear(), first.getMonth() + delta, 1, 12);
    setMonth(localDate(d).slice(0, 7));
    setSelected(localDate(d));
    setRemoving('');
  }
  return (
    <>
      <LookHead title="코디 캘린더" />
      <div className="lk-month">
        <h2>
          {first.getFullYear()}
          <em>.</em>
          {String(first.getMonth() + 1).padStart(2, '0')}
        </h2>
        <div>
          <button aria-label="이전 달" onClick={() => move(-1)}>
            <Icon name="back" />
          </button>
          <button aria-label="다음 달" onClick={() => move(1)}>
            <Icon name="right" />
          </button>
        </div>
      </div>
      <div className="lk-dates">
        {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
          <span className="lk-wday" key={w}>
            {w}
          </span>
        ))}
        {Array.from({ length: first.getDay() }, (_, i) => (
          <span key={'empty' + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = month + '-' + String(i + 1).padStart(2, '0');
          const records = entries.filter((r) => r.date === date);
          return (
            <button
              type="button"
              key={date}
              aria-label={
                dayTitle(date) + ' 착용 기록 ' + records.length + '개'
              }
              aria-pressed={date === active}
              className={date === localDate() ? 'is-today' : ''}
              onClick={() => {
                setSelected(date);
                setRemoving('');
              }}
            >
              {i + 1}
              {records.length > 0 && <i />}
            </button>
          );
        })}
      </div>
      <section className="lk-day">
        <div className="lk-sectionline">
          <h2>{dayTitle(active)}</h2>
          {active <= localDate() && (
            <button className="lk-link" onClick={() => go('wear')}>
              기록 추가 <Icon name="plus" size={16} />
            </button>
          )}
        </div>
        {chosen.length ? (
          chosen.map((row) => (
            <article className="lk-log" key={row.id}>
              <Miniatures items={idsToItems(row.garmentIds, garments)} />
              <h3>{row.name}</h3>
              {row.note && <p>{row.note}</p>}
              {removing === row.id ? (
                <div className="lk-pair">
                  <button
                    className="lk-secondary"
                    onClick={() => setRemoving('')}
                  >
                    유지
                  </button>
                  <button
                    className="lk-secondary"
                    onClick={() => {
                      setEntries((prev) => prev.filter((r) => r.id !== row.id));
                      setRemoving('');
                      notify('기록을 삭제했어요.');
                    }}
                  >
                    삭제 확인
                  </button>
                </div>
              ) : (
                <button className="lk-link" onClick={() => setRemoving(row.id)}>
                  기록 삭제
                </button>
              )}
            </article>
          ))
        ) : (
          <p className="lk-note">
            {active > localDate()
              ? '해당 날짜가 되면 착용 기록을 남길 수 있어요.'
              : '이날 남긴 착용 기록이 없어요.'}
          </p>
        )}
      </section>
    </>
  );
}

function Analytics({ go }: Pick<PageProps, 'go'>) {
  const { garments } = useStudio();
  const [events] = useScopedState<WearEvent[]>('look.wear', []);
  const [filter, setFilter] = useState('전체');
  const counts = new Map<string, number>();
  events.forEach((e) =>
    e.garmentIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)),
  );
  const worn = garments.filter((g) => counts.has(g.id)).length;
  const percent = garments.length
    ? Math.round((worn / garments.length) * 100)
    : 0;
  const rows = garments
    .filter(
      (g) => filter === '전체' || (filter === '입은 옷') === counts.has(g.id),
    )
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  return (
    <>
      <LookHead title="옷장 활용도" text="직접 남긴 착용 기록으로 계산해요." />
      <div className="lk-stat">
        <span>한 번 이상 입은 옷</span>
        <strong>
          {percent}
          <small>%</small>
        </strong>
        <div className="lk-meter">
          <i style={{ width: percent + '%' }} />
        </div>
        <p>
          보유한 {garments.length}벌 중 {worn}벌 · 착용 기록 {events.length}건
        </p>
      </div>
      <div className="lk-pills">
        {['전체', '입은 옷', '아직 안 입은 옷'].map((v) => (
          <button
            key={v}
            aria-pressed={v === filter}
            className={v === filter ? 'active' : ''}
            onClick={() => setFilter(v)}
          >
            {v}
          </button>
        ))}
      </div>
      {rows.map((g) => {
        const n = counts.get(g.id) ?? 0;
        return (
          <article className="lk-statrow" key={g.id}>
            <div>
              <GarmentPhoto item={g} />
            </div>
            <section>
              <b>{g.name}</b>
              <small>
                {g.price !== null && n > 0
                  ? '착용당 ' +
                    Math.round(g.price / n).toLocaleString('ko-KR') +
                    '원'
                  : g.price === null
                    ? '구매 가격 미입력'
                    : '첫 기록을 기다려요'}
              </small>
            </section>
            <strong>
              {n}
              <small>회</small>
            </strong>
          </article>
        );
      })}
      {!rows.length && (
        <p className="lk-note">이 조건에 해당하는 의류가 없어요.</p>
      )}
      <button className="lk-link" onClick={() => go('wear')}>
        착용 기록 남기기 <Icon name="right" size={15} />
      </button>
    </>
  );
}

function Travel({ go }: Pick<PageProps, 'go'>) {
  const { garments, notify, setSelectedIds, setEditLookId } = useStudio();
  const [conditions] = useScopedState<Conditions>(
    'look.conditions',
    firstConditions,
  );
  const [prefs] = useScopedState('look.preferences', firstPreferences);
  const [trip, setTrip] = useScopedState<TripPlan | null>('look.trip', null);
  const [place, setPlace] = useState(trip?.destination ?? '');
  const [start, setStart] = useState(trip?.start ?? localDate());
  const [end, setEnd] = useState(trip?.end ?? shiftDate(localDate(), 2));
  const [day, setDay] = useState(0);
  const [error, setError] = useState('');
  const [checked, setChecked] = useScopedState<string[]>('look.packed', []);
  function create(e: FormEvent) {
    e.preventDefault();
    const size = tripLength(start, end);
    if (!Number.isInteger(size) || size < 1 || size > 14) {
      setError('하루부터 14일 사이의 일정을 골라 주세요.');
      return;
    }
    if (!place.trim()) {
      setError('목적지를 입력해 주세요.');
      return;
    }
    const conditionsForTrip = { ...conditions, occasion: '여행' } as const;
    const base = arrange(garments, conditionsForTrip, {
      style: prefs.style,
      color: prefs.color,
    });
    if (!base.length) {
      setError('옷장에 착용 가능한 의류가 없어요.');
      return;
    }
    const rewear = base
      .filter((g) => ['신발', '아우터', '가방'].includes(g.category))
      .map((g) => g.id);
    const days = Array.from({ length: size }, (_, i) => ({
      date: shiftDate(start, i),
      ids: arrange(garments, conditionsForTrip, {
        locked: rewear,
        variation: i % 3,
        style: prefs.style,
        color: prefs.color,
      }).map((g) => g.id),
    }));
    setTrip({ destination: place.trim(), start, end, days });
    setChecked([]);
    setDay(0);
    setError('');
    notify('여행 코디와 준비물을 저장했어요.');
  }
  const packed = trip
    ? idsToItems(Array.from(new Set(trip.days.flatMap((d) => d.ids))), garments)
    : [];
  const choice = trip?.days[Math.min(day, trip.days.length - 1)];
  return (
    <>
      <LookHead
        title="여행 코디"
        text="외투와 신발을 다시 입고, 날짜별로 바꿔 입을 옷을 챙겨요."
      />
      <form className="lk-tripform" onSubmit={create}>
        <label className="lk-label">
          목적지
          <input
            required
            maxLength={60}
            placeholder="어디로 떠나나요?"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </label>
        <div className="lk-twodates">
          <label className="lk-label">
            가는 날
            <input
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="lk-label">
            오는 날
            <input
              type="date"
              required
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <button type="button" className="lk-link" onClick={() => go('weather')}>
          여행지 날씨 조건 · {conditions.weather}{' '}
          <Icon name="right" size={14} />
        </button>
        <button className="lk-main">
          {trip ? '여행 코디 다시 구성' : '날짜별 코디 구성'}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      {trip && choice && (
        <section className="lk-tripresult">
          <h2>{trip.destination}</h2>
          <p>
            {trip.start} – {trip.end} · {packed.length}벌
          </p>
          <div className="lk-daystrip">
            {trip.days.map((d, i) => (
              <button
                key={d.date}
                aria-pressed={d === choice}
                onClick={() => setDay(i)}
              >
                {dateAtNoon(d.date).getDate()}일
              </button>
            ))}
          </div>
          <Miniatures items={idsToItems(choice.ids, garments)} />
          <button
            className="lk-link"
            onClick={() => {
              setSelectedIds(idsToItems(choice.ids, garments).map((g) => g.id));
              setEditLookId(null);
              go('direct');
            }}
          >
            이날의 코디 편집 <Icon name="right" size={13} />
          </button>
          <div className="lk-sectionline">
            <h3>챙길 옷</h3>
            <span>
              {checked.filter((id) => packed.some((g) => g.id === id)).length} /{' '}
              {packed.length}
            </span>
          </div>
          {packed.map((g) => (
            <label className="lk-pack" key={g.id}>
              <input
                type="checkbox"
                checked={checked.includes(g.id)}
                onChange={() =>
                  setChecked((prev) =>
                    prev.includes(g.id)
                      ? prev.filter((id) => id !== g.id)
                      : [...prev, g.id],
                  )
                }
              />
              {g.name}
              <small>{g.category}</small>
            </label>
          ))}
        </section>
      )}
    </>
  );
}

export function DiaryPage({ page, go }: PageProps) {
  return (
    <section className="lk-screen">
      {page !== 'travel' && <JournalNav page={page} go={go} />}
      {page === 'wear' ? (
        <Wear go={go} />
      ) : page === 'calendar' ? (
        <Calendar go={go} />
      ) : page === 'analytics' ? (
        <Analytics go={go} />
      ) : (
        <Travel go={go} />
      )}
    </section>
  );
}
