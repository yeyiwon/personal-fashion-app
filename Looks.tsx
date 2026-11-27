import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type FormEvent,
} from 'react';
import {
  useStudio,
  useScopedState,
  type PageProps,
  type StudioGarment,
} from './studio';
import { GarmentPhoto, Icon } from './presentation';
import {
  affinity,
  arrange,
  harmonyNotes,
  shuffleLook,
  suggestions,
  climates,
  colorFamily,
  firstConditions,
  firstPreferences,
  idsToItems,
  occasions,
  paletteChoices,
  type Conditions,
  type Harmony,
} from './lookEngine';
import { DiaryPage } from './LookDiary';
import { getForecast, forecastCities, type ForecastCity } from './forecast';
import {
  deviceIntents,
  deviceStylistAvailable,
  readLocalIntent,
  type StyleTool,
} from './stylistActions';
import './looks.css';

export function LookHead({ title, text }: { title: string; text?: string }) {
  return (
    <header className="lk-head">
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </header>
  );
}

export function Miniatures({ items }: { items: StudioGarment[] }) {
  return (
    <div className="lk-minis">
      {items.map((g) => (
        <span key={g.id} title={g.name}>
          <GarmentPhoto item={g} />
        </span>
      ))}
    </div>
  );
}

function Picker<T extends string>({
  label,
  values,
  value,
  change,
}: {
  label: string;
  values: readonly T[];
  value: T;
  change: (next: T) => void;
}) {
  return (
    <fieldset className="lk-fieldset">
      <legend>{label}</legend>
      <div className="lk-pills">
        {values.map((v) => (
          <button
            type="button"
            aria-pressed={value === v}
            className={value === v ? 'active' : ''}
            key={v}
            onClick={() => change(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Empty({ go }: Pick<PageProps, 'go'>) {
  return (
    <div className="lk-empty">
      <Icon name="closet" size={36} />
      <h2>코디에 사용할 옷을 추가해 주세요</h2>
      <p>입을 수 있는 의류가 생기면 조합이 여기에 표시돼요.</p>
      <button className="lk-main" onClick={() => go('closet')}>
        옷장 열기
      </button>
    </div>
  );
}

function flatSlot(category: string) {
  return (
    {
      상의: 'top',
      하의: 'bottom',
      아우터: 'outer',
      원피스: 'dress',
      신발: 'shoes',
      가방: 'bag',
      기타: 'extra',
    } as Record<string, string>
  )[category];
}

function LookBoard({
  items,
  active,
  locked,
  select,
  onSwipe,
}: {
  items: StudioGarment[];
  active?: string;
  locked?: string[];
  select?: (id: string) => void;
  onSwipe?: () => void;
}) {
  const origin = useRef({ x: 0, y: 0 });
  return (
    <div
      className={
        'lk-board ' +
        (items.some((g) => g.category === '원피스') ? 'is-dress ' : '') +
        (items.length === 1 ? 'solo' : '')
      }
      onTouchStart={(e) => {
        origin.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - origin.current.x,
          dy = e.changedTouches[0].clientY - origin.current.y;
        if (onSwipe && Math.abs(dx) > 75 && Math.abs(dy) < 45) onSwipe();
      }}
    >
      {items.map((g) => (
        <button
          type="button"
          aria-label={g.name + ' 선택'}
          aria-pressed={active === g.id}
          key={g.id}
          className={
            'lk-piece lk-' +
            flatSlot(g.category) +
            (active === g.id ? ' is-active' : '')
          }
          onClick={() => select?.(g.id)}
          disabled={!select}
        >
          <GarmentPhoto item={g} />
          {locked?.includes(g.id) && (
            <span className="lk-pin" aria-label="고정됨">
              ✦
            </span>
          )}
        </button>
      ))}
      <div className="lk-board-palette" aria-label="코디 색상">
        {items.map((g) => (
          <i title={g.name} key={g.id} style={{ background: g.color }} />
        ))}
      </div>
    </div>
  );
}

function OutfitComposer({ page, go }: PageProps) {
  const {
    garments,
    outfits,
    mode,
    selectedIds,
    setSelectedIds,
    setEditLookId,
    saveLook,
    notify,
  } = useStudio();
  const [conditions, setConditions] = useScopedState<Conditions>(
    'look.conditions',
    firstConditions,
  );
  const [pref] = useScopedState('look.preferences', firstPreferences);
  const [color, setColor] = useScopedState('look.color', paletteChoices[0].hex);
  const [wearRows] = useScopedState<{ garmentIds: string[] }[]>(
    'look.wear',
    [],
  );
  const signals = affinity(outfits, wearRows);
  const [harmony, setHarmony] = useScopedState<Harmony>(
    'look.harmony',
    '톤온톤',
  );
  const [pinned, setPinned] = useScopedState<string[]>('look.pinned', []);
  const [override, setOverride] = useScopedState<Record<string, string>>(
    'look.overrides',
    {},
  );
  const [variation, setVariation] = useScopedState('look.variation', 0);
  const [source, setSource] = useScopedState<'ai' | 'colors'>(
    'look.source',
    'ai',
  );
  const [active, setActive] = useState('');
  const [editingSave, setEditingSave] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const subset = garments.filter((g) => g.condition !== '수선 필요');
  const inColor = page === 'colors' || page === 'palette';
  const result = page === 'result';
  const fromColor = inColor || (result && source === 'colors');
  const paletteName =
    paletteChoices.find((p) => p.hex === color)?.name ?? '내가 고른 색';
  const choices = suggestions(garments, conditions, {
    locked: pinned,
    color: fromColor ? color : pref.color,
    style: pref.style,
    harmony: fromColor ? harmony : undefined,
    signals: fromColor ? undefined : signals,
  });
  const currentChoice = choices[variation] ?? choices[0] ?? [];
  const generated = currentChoice.map((g) =>
    pinned.includes(g.id)
      ? g
      : (subset.find(
          (o) => o.category === g.category && o.id === override[g.category],
        ) ?? g),
  );
  const items =
    result && selectedIds.length
      ? idsToItems(selectedIds, garments)
      : generated;
  const selected = items.find((g) => g.id === active) ?? items[0];
  const alternatives = selected
    ? subset.filter(
        (g) => g.category === selected.category && g.id !== selected.id,
      )
    : [];
  function switchLook() {
    const next = shuffleLook(generated, subset, pinned);
    if (next === generated) {
      notify('고정하지 않은 분류에 다른 의류가 없어요.');
      return;
    }
    setOverride(Object.fromEntries(next.map((g) => [g.category, g.id])));
    setActive('');
  }
  function resetComposition() {
    setOverride({});
    setVariation(0);
    setActive('');
  }
  function swap(id: string) {
    if (!selected) return;
    setOverride({ ...override, [selected.category]: id });
    setActive(id);
    if (result)
      setSelectedIds(items.map((g) => (g.id === selected.id ? id : g.id)));
  }
  function fix(id: string) {
    const item = subset.find((g) => g.id === id);
    if (!item) return;
    const dressConflict = (category: string) =>
      item.category === '원피스'
        ? ['상의', '하의'].includes(category)
        : ['상의', '하의'].includes(item.category) && category === '원피스';
    setPinned(
      pinned.includes(id)
        ? pinned.filter((v) => v !== id)
        : [
            ...pinned.filter((v) =>
              subset.some(
                (g) =>
                  g.id === v &&
                  g.category !== item.category &&
                  !dressConflict(g.category),
              ),
            ),
            id,
          ],
    );
  }
  function handoff(to: string) {
    setSelectedIds(items.map((g) => g.id));
    setEditLookId(null);
    if (to === 'result') setSource(inColor ? 'colors' : 'ai');
    go(to);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving || !items.length) return;
    setSaving(true);
    try {
      await saveLook(
        name,
        items.map((g) => g.id),
      );
      notify('코디를 저장했어요.');
      setEditingSave(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : '코디를 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }
  const title = result
    ? '코디 결과'
    : page === 'palette'
      ? '팔레트 코디'
      : inColor
        ? '색상별 코디'
        : 'AI 코디';
  return (
    <section
      className={'lk-screen lk-composer ' + (fromColor ? 'color-mode' : '')}
    >
      <LookHead
        title={title}
        text={
          inColor
            ? '마음에 드는 색에서 시작해 옷장의 색을 겹쳐 보세요.'
            : result
              ? undefined
              : '상황을 고르고, 오늘 꼭 입고 싶은 한 벌을 고정하세요.'
        }
      />
      {inColor && (
        <div
          className="lk-palette"
          style={{ '--swatch': color } as CSSProperties}
        >
          <div className="lk-spectrum">
            {paletteChoices.map((p) => (
              <button
                key={p.hex}
                type="button"
                aria-label={p.name}
                aria-pressed={color === p.hex}
                style={{ '--sample': p.hex } as CSSProperties}
                onClick={() => {
                  setColor(p.hex);
                  resetComposition();
                }}
              >
                <span>{color === p.hex ? '✓' : ''}</span>
              </button>
            ))}
          </div>
          <div className="lk-swatch-caption">
            <strong>{paletteName}</strong>
            <label>
              직접 선택
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  resetComposition();
                }}
              />
            </label>
          </div>
          <Picker
            label="배색 방식"
            values={Object.keys(harmonyNotes) as Harmony[]}
            value={harmony}
            change={(v) => {
              setHarmony(v);
              resetComposition();
            }}
          />
          <p className="lk-note">
            {harmonyNotes[harmony]} 보유한 옷 중 가까운 조합을 골라요.
          </p>
          <button className="lk-link" onClick={() => go('color-analysis')}>
            내 옷장 색상 분포 보기 <Icon name="right" size={14} />
          </button>
        </div>
      )}
      {!inColor && !result && (
        <div className="lk-occasion">
          <Picker
            label="입을 상황"
            value={conditions.occasion}
            values={occasions}
            change={(occasion) => {
              setConditions({ ...conditions, occasion });
              resetComposition();
            }}
          />
          <button className="lk-link" onClick={() => go('weather')}>
            {conditions.weather} · 날씨와 일정 설정{' '}
            <Icon name="right" size={14} />
          </button>
        </div>
      )}
      {!result && !inColor && choices.length > 0 && (
        <fieldset className="lk-choicegroup">
          <legend>오늘의 추천 {choices.length}가지</legend>
          <div>
            {choices.map((look, i) => {
              const firstChanged = look.find(
                (g, k) => choices[0][k].id !== g.id,
              );
              const frequent = look.find((g) => signals[g.id]);
              const reason = firstChanged
                ? firstChanged.name + '로 ' + firstChanged.category + ' 변주'
                : frequent
                  ? frequent.name + ' · 저장·착용 기록 반영'
                  : conditions.occasion + ' · ' + conditions.weather + ' 기준';
              return (
                <button
                  key={look.map((g) => g.id).join()}
                  type="button"
                  aria-pressed={
                    i === variation && !Object.keys(override).length
                  }
                  onClick={() => {
                    setVariation(i);
                    setOverride({});
                    setActive('');
                  }}
                >
                  <span>
                    {['취향에 가까운 룩', '두 번째 룩', '세 번째 룩'][i]}
                  </span>
                  <span className="lk-choicehues">
                    {look.map((g) => (
                      <i key={g.id} style={{ background: g.color }} />
                    ))}
                  </span>
                  <small>{reason}</small>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {items.length > 0 ? (
        <div className="lk-workspace">
          <div className="lk-composition">
            <div className="lk-caption">
              <strong>
                {fromColor
                  ? paletteName + ' · ' + harmony
                  : conditions.occasion + ' 코디'}
              </strong>
              <span>
                {mode === 'sample' ? '샘플 옷장' : '내 옷장'} · {items.length}벌
              </span>
            </div>
            <LookBoard
              items={items}
              active={selected?.id}
              locked={pinned}
              select={setActive}
              onSwipe={result ? undefined : switchLook}
            />
            {selected && (
              <div className="lk-tray" key={selected.id}>
                <div>
                  <small>{selected.category}</small>
                  <strong>{selected.name}</strong>
                </div>
                <button
                  aria-pressed={pinned.includes(selected.id)}
                  onClick={() => fix(selected.id)}
                >
                  {pinned.includes(selected.id) ? '고정 해제' : '이 옷 고정'}
                </button>
              </div>
            )}
            {selected &&
              !pinned.includes(selected.id) &&
              alternatives.length > 0 && (
                <div className="lk-alts">
                  <span>부분 교체</span>
                  {alternatives.map((g) => (
                    <button key={g.id} type="button" onClick={() => swap(g.id)}>
                      <i style={{ background: g.color }} />
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
          </div>
          <div className="lk-actions">
            {!result && (
              <label className="lk-label">
                꼭 입을 옷
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      if (!pinned.includes(e.target.value)) fix(e.target.value);
                      setActive(e.target.value);
                    }
                  }}
                >
                  <option value="">옷장에서 골라 고정</option>
                  {subset.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {pinned.includes(g.id) ? ' · 고정됨' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!result && (
              <div className="lk-pair">
                <button className="lk-secondary" onClick={switchLook}>
                  랜덤 조합
                </button>
                <button
                  className="lk-main"
                  onClick={() =>
                    page === 'colors' ? go('palette') : handoff('result')
                  }
                >
                  {page === 'colors' ? '팔레트 상세 보기' : '코디 결과 보기'}
                </button>
              </div>
            )}
            {result && (
              <>
                <div className="lk-pair">
                  <button
                    className="lk-secondary"
                    onClick={() => handoff('direct')}
                  >
                    직접 편집
                  </button>
                  <button
                    className="lk-main"
                    onClick={() => {
                      setEditingSave(!editingSave);
                      setName(
                        (fromColor ? paletteName : conditions.occasion) +
                          ' 코디',
                      );
                    }}
                  >
                    코디 저장
                  </button>
                </div>
                {editingSave && (
                  <form className="lk-savebox" onSubmit={save}>
                    <label className="lk-label">
                      코디 이름
                      <input
                        required
                        maxLength={80}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <button className="lk-main" disabled={saving}>
                      저장하기
                    </button>
                  </form>
                )}
                <div className="lk-pair">
                  <button
                    className="lk-secondary"
                    onClick={() => handoff('fitting')}
                  >
                    가상 피팅
                  </button>
                  <button
                    className="lk-secondary"
                    onClick={() => handoff('wear')}
                  >
                    입은 날 기록
                  </button>
                </div>
              </>
            )}
            <p className="lk-note">
              {fromColor
                ? '보유 의류의 대표색을 비교한 기기 내 배색 추천이에요.'
                : '날씨·상황·취향 규칙으로 옷장에서 골랐어요. 생성형 AI 추천은 연결 전이에요.'}
            </p>
          </div>
        </div>
      ) : (
        <Empty go={go} />
      )}
    </section>
  );
}

function ColorAnalysis({ go }: Pick<PageProps, 'go'>) {
  const { garments } = useStudio();
  const [, setColor] = useScopedState('look.color', paletteChoices[0].hex);
  const [filter, setFilter] = useState('');
  const groups = Array.from(new Set(garments.map((g) => colorFamily(g.color))))
    .map((label) => ({
      label,
      items: garments.filter((g) => colorFamily(g.color) === label),
    }))
    .sort((a, b) => b.items.length - a.items.length);
  const chosen = groups.find((group) => group.label === filter) ?? groups[0];
  return (
    <section className="lk-screen">
      <LookHead
        title="옷장 색상 분석"
        text="등록한 대표색을 색상 계열별로 모았어요."
      />
      {chosen ? (
        <>
          <div className="lk-color-bar">
            {groups.map((g) => (
              <button
                key={g.label}
                aria-label={g.label + ' ' + g.items.length + '벌'}
                style={{ flex: g.items.length, background: g.items[0].color }}
                onClick={() => setFilter(g.label)}
              />
            ))}
          </div>
          <div className="lk-colorlist">
            {groups.map((g) => (
              <button
                key={g.label}
                aria-pressed={chosen.label === g.label}
                onClick={() => setFilter(g.label)}
              >
                <i style={{ background: g.items[0].color }} />
                {g.label}
                <b>{g.items.length}벌</b>
              </button>
            ))}
          </div>
          <h2>{chosen.label}</h2>
          <div className="lk-itemgrid">
            {chosen.items.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setColor(g.color);
                  go('palette');
                }}
              >
                <GarmentPhoto item={g} />
                <span>{g.name}</span>
                <small>이 색으로 코디</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <Empty go={go} />
      )}
    </section>
  );
}

function Weather({ go }: Pick<PageProps, 'go'>) {
  const { notify } = useStudio();
  const [conditions, setConditions] = useScopedState<Conditions>(
    'look.conditions',
    firstConditions,
  );
  const [city, setCity] = useState<ForecastCity>('seoul');
  const [forecast, setForecast] = useState<Awaited<
    ReturnType<typeof getForecast>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function read() {
    setLoading(true);
    setError('');
    setForecast(null);
    try {
      const next = await getForecast(city);
      setForecast(next);
    } catch {
      setError(
        '예보를 불러오지 못했어요. 아래에서 직접 날씨를 선택할 수 있어요.',
      );
    } finally {
      setLoading(false);
    }
  }
  const climate = forecast
    ? /비|눈|소나기|진눈깨비|뇌우|rain|snow|sleet/i.test(forecast.condition)
      ? '비·눈'
      : forecast.temperature < 9
        ? '추움'
        : forecast.temperature > 21
          ? '따뜻함'
          : '선선함'
    : null;
  return (
    <section className="lk-screen">
      <LookHead
        title="날씨와 일정"
        text="외출할 도시의 예보를 보거나 체감 날씨를 직접 골라요."
      />
      <div className="lk-weather">
        <label className="lk-label">
          도시
          <select
            disabled={loading}
            value={city}
            onChange={(e) => {
              setCity(e.target.value as ForecastCity);
              setForecast(null);
              setError('');
            }}
          >
            {Object.entries(forecastCities).map(([key, v]) => (
              <option key={key} value={key}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="lk-secondary" disabled={loading} onClick={read}>
          {loading ? '예보 확인 중…' : '도시 예보 가져오기'}
        </button>
        {error && (
          <p role="status" className="lk-note">
            {error}
          </p>
        )}
        {forecast && climate && (
          <div aria-live="polite" className="lk-weather-value">
            <strong>{Math.round(forecast.temperature)}°</strong>
            <div>
              <b>{forecast.condition}</b>
              <p>
                {forecast.label} ·{' '}
                {new Date(forecast.time).toLocaleString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <small>
              MET Norway · 예보 · 기온 반올림{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
            </small>
            <button
              className="lk-link"
              onClick={() => {
                setConditions({ ...conditions, weather: climate });
                notify('예보를 코디 조건에 반영했어요.');
              }}
            >
              예보 적용 · {climate}
            </button>
          </div>
        )}
      </div>
      <Picker
        label="체감 날씨"
        values={climates}
        value={conditions.weather}
        change={(weather) => setConditions({ ...conditions, weather })}
      />
      <Picker
        label="외출 일정"
        values={occasions}
        value={conditions.occasion}
        change={(occasion) => setConditions({ ...conditions, occasion })}
      />
      <button className="lk-main" onClick={() => go('ai')}>
        이 조건으로 코디 보기
      </button>
    </section>
  );
}

const quickQuestions = [
  '내 옷으로 출근 코디를 골라 줘',
  '이 재킷과 어울리는 색은?',
  '사고 싶은 옷과 내 옷의 조합은?',
];
function Stylist({ go }: Pick<PageProps, 'go'>) {
  const { garments, outfits, notify, setSelectedIds, setEditLookId } =
    useStudio();
  const [tools, setTools] = useState<StyleTool[]>([]);
  const [question, setQuestion] = useState(''),
    [asked, setAsked] = useState(false),
    [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false),
    [deviceOn, setDeviceOn] = useState(false),
    [source, setSource] = useState('');
  const request = useRef<AbortController | null>(null);
  const [conditions, setConditions] = useScopedState<Conditions>(
    'look.conditions',
    firstConditions,
  );
  const [prefs] = useScopedState('look.preferences', firstPreferences);
  const [wearRows] = useScopedState<{ garmentIds: string[] }[]>(
    'look.wear',
    [],
  );
  const [color, setColor] = useScopedState('look.color', paletteChoices[0].hex);
  const [contextColor, changeColor] = useState(color);
  useEffect(() => {
    let live = true;
    void deviceStylistAvailable().then((value) => {
      if (live) setReady(value);
    });
    return () => {
      live = false;
      request.current?.abort();
      request.current = null;
    };
  }, []);
  const items = arrange(garments, conditions, {
    style: prefs.style,
    color: tools.includes('palette') ? contextColor : prefs.color,
    signals: affinity(outfits, wearRows),
  });
  async function run(value: string) {
    const q = value.trim();
    if (!q || busy) return;
    setQuestion(q);
    setAsked(true);
    let next = readLocalIntent(q);
    let engine = '기기 내 키워드 규칙';
    if (deviceOn && ready) {
      setBusy(true);
      setTools([]);
      setSource('');
      const controller = new AbortController();
      request.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        next = await deviceIntents(q, controller.signal);
        engine = '이 기기의 AI';
      } catch {
        if (request.current !== controller) return;
        engine = '기기 AI 응답 없음 · 키워드 규칙';
      } finally {
        clearTimeout(timeout);
        if (request.current === controller) {
          request.current = null;
          setBusy(false);
        }
      }
    }
    const occasion = occasions.find((v) => q.includes(v));
    if (occasion) setConditions({ ...conditions, occasion });
    setTools(next);
    setSource(engine);
  }
  return (
    <section className="lk-screen">
      <LookHead
        title="AI 스타일리스트"
        text="궁금한 점을 적으면 옷장에 맞는 도구를 함께 열어요."
      />
      <div className={'lk-concierge ' + (tools.length ? 'resolved' : '')}>
        <div className="lk-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p>오늘 어떤 옷이 고민인가요?</p>
      </div>
      <div className="lk-suggestions">
        {quickQuestions.map((q) => (
          <button
            type="button"
            key={q}
            disabled={busy}
            onClick={() => void run(q)}
          >
            {q}
            <Icon name="right" size={15} />
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(question);
        }}
        className="lk-query"
      >
        <input
          value={question}
          aria-label="스타일링 질문"
          placeholder="예: 비 오는 날 출근 코디와 어울리는 색"
          maxLength={160}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button disabled={busy || !question.trim()}>
          {busy ? '선택 중…' : '질문하기'}
        </button>
      </form>
      {ready ? (
        <label className="lk-pack">
          <input
            type="checkbox"
            checked={deviceOn}
            disabled={busy}
            onChange={(e) => setDeviceOn(e.target.checked)}
          />
          이 기기에 설치된 AI로 요청 해석
        </label>
      ) : (
        <p className="lk-note">
          이 브라우저에서는 기기 내 키워드 규칙으로 도구를 선택해요.
        </p>
      )}
      {source && (
        <p className="lk-note">
          {source} · 선택된 도구 {tools.length}개
        </p>
      )}
      {asked && !busy && !tools.length && (
        <p role="status">코디·색상·구매·날씨 중 필요한 내용을 적어 주세요.</p>
      )}
      <div aria-live="polite">
        {tools.map((key) => {
          if (key === 'weather')
            return (
              <section className="lk-advice" key={key}>
                <h2>외출 조건</h2>
                <Picker
                  label="체감 날씨"
                  values={climates}
                  value={conditions.weather}
                  change={(weather) =>
                    setConditions({ ...conditions, weather })
                  }
                />
                <button className="lk-link" onClick={() => go('weather')}>
                  도시 예보 확인 <Icon name="right" size={14} />
                </button>
              </section>
            );
          if (key === 'palette')
            return (
              <section className="lk-advice" key={key}>
                <h2>이 색을 중심으로</h2>
                <div className="lk-quickcolor">
                  {paletteChoices.map((p) => (
                    <button
                      key={p.hex}
                      aria-label={p.name}
                      aria-pressed={contextColor === p.hex}
                      style={{ background: p.hex }}
                      onClick={() => {
                        setColor(p.hex);
                        changeColor(p.hex);
                      }}
                    >
                      {contextColor === p.hex ? '✓' : ''}
                    </button>
                  ))}
                </div>
                <button
                  className="lk-link"
                  onClick={() => {
                    setColor(contextColor);
                    go('palette');
                  }}
                >
                  배색 방식 비교 <Icon name="right" size={14} />
                </button>
              </section>
            );
          if (key === 'shopping')
            return (
              <section className="lk-advice" key={key}>
                <h2>구매 전 확인</h2>
                <p>
                  보유한 {garments.length}벌과 조합해 볼 구매 후보를 선택해요.
                </p>
                <div className="lk-pair">
                  <button
                    className="lk-secondary"
                    onClick={() => go('wishlist')}
                  >
                    관심 상품
                  </button>
                  <button className="lk-main" onClick={() => go('shop')}>
                    구매 후보 찾기
                  </button>
                </div>
              </section>
            );
          return (
            <section key={key} className="lk-advice">
              <h2>{conditions.occasion}에 입을 조합</h2>
              <Picker
                label="입을 상황"
                values={occasions}
                value={conditions.occasion}
                change={(occasion) =>
                  setConditions({ ...conditions, occasion })
                }
              />
              <Miniatures items={items} />
              <p>
                {items.length
                  ? items.map((g) => g.name).join(' · ')
                  : '의류를 먼저 등록해 주세요.'}
              </p>
              <div className="lk-pair">
                <button className="lk-secondary" onClick={() => go('ai')}>
                  다른 조합 보기
                </button>
                <button
                  className="lk-main"
                  disabled={!items.length}
                  onClick={() => {
                    setEditLookId(null);
                    setSelectedIds(items.map((g) => g.id));
                    notify('추천 조합을 편집 보드에 담았어요.');
                    go('direct');
                  }}
                >
                  이 조합 편집
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default function Looks(props: PageProps) {
  if (props.page === 'color-analysis') return <ColorAnalysis {...props} />;
  if (props.page === 'weather') return <Weather {...props} />;
  if (props.page === 'stylist') return <Stylist {...props} />;
  if (['calendar', 'wear', 'analytics', 'travel'].includes(props.page))
    return <DiaryPage {...props} />;
  return <OutfitComposer key={props.page} {...props} />;
}
