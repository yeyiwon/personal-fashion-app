import { Choice, Control, Feedback, Field } from './LiquidControls';
import { useEffect, useRef, useState } from 'react';
import type { Piece } from './avatarLayers';
import { firstPreferences, localDate, affinity } from './lookEngine';
import { forecastCities, getForecast, type ForecastCity } from './forecast';
import { useScopedState, useStudio } from './studio';
import { GlassSurface } from './RoomControls';
import { Icon } from './presentation';
import { BelloSignal } from './BelloSignal';

import type {BelloAdvice} from './bello-contract';
export type Advice = BelloAdvice;
type Weather = Awaited<ReturnType<typeof getForecast>>;
const greetings = new Map<string, Advice>();
const pendingWelcome = new Map<string, Promise<Advice>>();
async function api(
  data: object,
  code = '',
  signal?: AbortSignal,
): Promise<Advice> {
  const res = await fetch('/api/room-stylist', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'X-Room-Access': code },
    body: JSON.stringify({...data,requestId:crypto.randomUUID()}),
  });
  if (!res.headers.get('content-type')?.includes('application/json'))
    throw Error('이 환경에서는 언어 모델을 열 수 없어요.');
  const json = await res.json();
  if (!res.ok) throw Error(json.error || '다시 요청해 주세요.');
  if(json.version!==1||json.state!=='proposed'||!Array.isArray(json.ui?.garmentIds))throw Error('벨로의 응답 형식을 확인하지 못했어요.');
  return json;
}
function say(message: string) {
  if (!('speechSynthesis' in window)) return;
  const voice = speechSynthesis
    .getVoices()
    .find((v) => v.lang.startsWith('ko') && v.localService);
  if (!voice) return;
  speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(message);
  phrase.voice = voice;
  phrase.lang = 'ko-KR';
  speechSynthesis.speak(phrase);
}
const toolLabel: Record<string, string> = {
  outfit: '아바타에 입히기',
  swap: '이 옷만 교체',
  lock: '선택한 옷 고정',
  closet: '옷장 펼치기',
  palette: '배색 보기',
  fitting: '피팅 보기',
  shopping: '구매 전 조합 보기',
  save: '착장 저장하기',
};
export function RoomAssistant({
  open,
  setOpen,
  worn,
  locked,
  act,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  worn: string[];
  locked: string[];
  act: (a: Advice) => void;
}) {
  const { garments, mode, outfits } = useStudio();
  const [name] = useScopedState('display-name', ''),
    [prefs] = useScopedState('look.preferences', firstPreferences);
  const [voice, setVoice] = useScopedState('room.voice', false),
    [city, setCity] = useScopedState<ForecastCity | ''>(
      'room.forecast-city',
      mode === 'sample' ? 'seoul' : '',
    );
  const [trip] = useScopedState<{
    destination: string;
    start: string;
    end: string;
  } | null>('look.trip', null);
  const [event, setEvent] = useScopedState<{ day: string; value: string }>(
    'room.schedule',
    { day: '', value: '' },
  );
  const [wear] = useScopedState<{ garmentIds: string[] }[]>('look.wear', []),
    [feedback, setFeedback] = useScopedState<Record<string, number>>(
      'room.feedback',
      {},
    );
  const [now, clock] = useState(() => new Date()),
    [forecast, setForecast] = useState<Weather | null>(null),
    [weatherNote, setWeatherNote] = useState('');
  const [engine, engines] = useState<{ local: boolean; cloud: boolean } | null>(
      null,
    ),
    [attempt, retry] = useState(0);
  const [welcome, setWelcome] = useState<Advice | null>(null),
    [result, setResult] = useState<Advice | null>(null),
    [working, setWorking] = useState(false),
    [fault, setFault] = useState('');
  const [question, setQuestion] = useState(''),
    [access, setAccess] = useState(''),
    [consent, setConsent] = useState(false),
    [settings, setSettings] = useState(false);
  const [rated, rate] = useState(false);
  const [welcoming, showWelcomeWork] = useState(false),
    [acting, setActing] = useState(false);
  const abort = useRef<AbortController | null>(null),
    latest = useRef(0),
    expanded = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setInterval(() => clock(new Date()), 60000);
    return () => {
      clearInterval(timer);
      abort.current?.abort();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    let live = true;
    fetch('/api/room-stylist')
      .then((r) => r.json())
      .then((r) => {
        if (live) engines({ local: r.local === true, cloud: r.cloud === true });
      })
      .catch(() => {
        if (live) engines({ local: false, cloud: false });
      });
    return () => {
      live = false;
    };
  }, [attempt]);
  useEffect(() => {
    const ctrl = new AbortController();
    setForecast(null);
    setWeatherNote('');
    if (city)
      getForecast(city, ctrl.signal)
        .then(setForecast)
        .catch(() => {
          if (!ctrl.signal.aborted) setWeatherNote('예보 조회 실패');
        });
    return () => ctrl.abort();
  }, [city, attempt]);
  const today = localDate(now),
    hour = now.getHours(),
    part =
      hour < 5 ? '늦은 밤' : hour < 12 ? '아침' : hour < 18 ? '오후' : '저녁';
  const schedule = [
    event.day === today ? event.value : '',
    trip && today >= trip.start && today <= trip.end
      ? trip.destination + ' 여행'
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const recent = [...garments]
    .filter((g) => g.purchase?.purchasedAt && g.purchase.purchasedAt <= today)
    .sort((a, b) =>
      b.purchase!.purchasedAt.localeCompare(a.purchase!.purchasedAt),
    )[0];
  const signals = affinity(outfits, wear);
  const current = garments
    .slice()
    .sort(
      (a, b) =>
        Number(worn.includes(b.id) || locked.includes(b.id)) -
          Number(worn.includes(a.id) || locked.includes(a.id)) ||
        Number(b.id === recent?.id) - Number(a.id === recent?.id),
    )
    .slice(0, 32);
  const payload = {
    time: today + ' ' + part,
    weather: forecast
      ? forecast.label + ' ' + forecast.temperature + '° ' + forecast.condition
      : '',
    schedule,
    preferences: prefs.style + ' ' + prefs.color,
    recent: recent?.name ?? '',
    worn,
    locked,
    garments: current.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      color: g.color,
      material: g.material ?? '',
      purchased: g.purchase?.purchasedAt ?? '',
      affinity: (signals[g.id] ?? 0) + (feedback[g.id] ?? 0),
    })),
  };
  const cacheKey = JSON.stringify([
    mode,
    name,
    payload.time,
    payload.weather,
    payload.schedule,
    payload.preferences,
    payload.recent,
    payload.worn,payload.locked,payload.garments.map((g) => [g.id,g.name,g.category,g.color,g.material,g.purchased,g.affinity]),
  ]);
  const lastWelcomeKey = useRef('');
  useEffect(() => {
    let live = true;
    setWelcome(null);
    showWelcomeWork(false);
    if (!engine?.local || (city && !forecast && !weatherNote)) return;
    const existing = greetings.get(cacheKey);
    if (existing) {
      setWelcome(existing);
      return;
    }
    showWelcomeWork(true);
    let task = pendingWelcome.get(cacheKey);
    if (!task) {
      task = api({
        ...payload,
        request:
          '지금 시간에 맞게 먼저 인사하고 현재 옷장에서 입을 수 있는 코디와 이유를 한두 문장으로 추천해 줘.',
        engine: 'local',
      });
      pendingWelcome.set(cacheKey, task);
    }
    task
      .then((advice) => {
        if (greetings.size > 16) greetings.clear();
        greetings.set(cacheKey, advice);
        if (live) {
          setWelcome(advice);
          if (voice && lastWelcomeKey.current !== cacheKey) say(advice.message);
          lastWelcomeKey.current = cacheKey;
        }
      })
      .catch(() => {
        if (live)
          setFault(
            '기기 모델이 첫 제안을 끝내지 못했어요. 직접 요청할 수 있어요.',
          );
      })
      .finally(() => {
        pendingWelcome.delete(cacheKey);
        if (live) showWelcomeWork(false);
      });
    return () => {
      live = false;
    };
  }, [
    engine?.local,
    cacheKey,
    attempt,
    Boolean(city && !forecast && !weatherNote),
  ]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        expanded.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open, setOpen]);
  async function ask(q: string) {
    if (!q.trim() || working) return;
    if (!engine?.local && !(engine?.cloud && consent && access)) {
      setSettings(true);
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const sequence = ++latest.current;
    setWorking(true);
    setFault('');
    rate(false);
    try {
      const advice = await api(
        {
          ...payload,
          previous: result?.message,
          request: q,
          engine: engine?.local ? 'local' : 'cloud',
          consent,
        },
        access,
        ctrl.signal,
      );
      if (sequence !== latest.current) return;
      setResult(advice);
      setQuestion('');
      if (voice) say(advice.message);
    } catch (e) {
      if (!ctrl.signal.aborted)
        setFault(e instanceof Error ? e.message : '제안을 불러올 수 없어요.');
    } finally {
      if (sequence === latest.current) setWorking(false);
    }
  }
  const note =
    welcome?.message ||
    (recent
      ? '최근 구매한 ' + recent.name + '부터 입어 볼까요?'
      : schedule
        ? schedule + '에 입을 옷을 골라보세요.'
        : garments.length
          ? '옷장에 ' + garments.length + '벌이 준비돼 있어요.'
          : '첫 옷을 촬영하면 여기서 입어 볼 수 있어요.');
  const answer = result ?? welcome;
  const useAdvice = () => {
    if (!answer) return;
    setActing(true);
    try {
      act(answer);
      setOpen(false);
    } finally {
      requestAnimationFrame(() => setActing(false));
    }
  };
  const [voiceSupported, supportVoice] = useState(false);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const update = () =>
      supportVoice(
        speechSynthesis
          .getVoices()
          .some((v) => v.localService && v.lang.startsWith('ko')),
      );
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return (
    <aside
      className={
        'room-assistant ' +
        (open ? 'expanded ' : '') +
        (working ? 'thinking' : '')
      }
      aria-label="AI 스타일리스트 벨로"
    >
      <div className="assistant-shell">
        <GlassSurface morph={open} />
        <Control
          ref={expanded}
          className="assistant-peek"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          aria-label={
            open ? '스타일리스트 대화 접기' : '스타일리스트에게 요청하기'
          }
        >
          <BelloSignal
            state={
              acting
                ? 'acting'
                : working || welcoming
                  ? 'thinking'
                  : fault
                    ? 'error'
                    : rated
                      ? 'complete'
                      : result
                        ? 'proposed'
                        : welcome
                          ? 'greeting'
                          : engine && !engine.local && !engine.cloud
                            ? 'limited'
                            : 'waiting'
            }
          />
          <span>
            <b>BELLO</b>
            <small>
              {engine?.local
                ? '기기 내 AI'
                : engine?.cloud
                  ? 'AI 연결 가능'
                  : '스타일리스트'}
              <em /> {part}
            </small>
          </span>
          <Icon name="down" size={15} />
        </Control>
        {!open && (
          <p className="arrival-message" aria-live="polite">
            {welcome
              ? note
              : (part === '늦은 밤'
                  ? '편안한 밤이에요. '
                  : part === '아침'
                    ? '좋은 아침이에요. '
                    : part === '오후'
                      ? '좋은 오후예요. '
                      : '좋은 저녁이에요. ') + note}
          </p>
        )}
        {open && (
          <div className="assistant-dialog">
            <div className="room-context">
              <span>
                {now.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <Control onClick={() => setSettings(!settings)}>
                {forecast
                  ? forecast.label +
                    ' ' +
                    Math.round(forecast.temperature) +
                    '°'
                  : city
                    ? weatherNote || '예보 조회 중'
                    : '날씨·일정 설정'}{' '}
                <Icon name="settings" size={12} />
              </Control>
            </div>
            <p className="assistant-line" aria-live="polite">
              {working
                ? '옷장 안에서 어울리는 조합을 찾고 있어요…'
                : (answer?.message ?? note)}
            </p>
            {answer && !working && (
              <div className="advice-result">
                <small>{answer.source} 제안</small>
                <div>
                  {answer.ids.map((id) => {
                    const g = garments.find((x) => x.id === id);
                    return g ? (
                      <span key={id} style={{ borderLeftColor: g.color }}>
                        {g.name}
                      </span>
                    ) : null;
                  })}
                </div>
                {toolLabel[answer.tool] && (
                  <Control onClick={useAdvice}>
                    {toolLabel[answer.tool]} <Icon name="arrow" size={15} />
                  </Control>
                )}
                {!!answer.ids.length && (
                  <Control
                    disabled={rated}
                    onClick={() => {
                      setFeedback((f) => {
                        const n = { ...f };
                        answer.ids.forEach((id) => (n[id] = (n[id] ?? 0) + 4));
                        return n;
                      });
                      rate(true);
                    }}
                  >
                    {rated ? '취향에 반영됨' : '이 조합이 좋아요'}
                  </Control>
                )}
              </div>
            )}
            {fault && (
              <Feedback role="status">
                {fault}{' '}
                <Control onClick={() => retry((v) => v + 1)}>다시 확인</Control>
              </Feedback>
            )}
            {engine && !engine.local && !engine.cloud && (
              <p className="room-unavailable">
                이 브라우저에는 대화 모델이 연결되지 않았어요. 옷장에서 직접
                입어 볼 수 있어요.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
            >
              <Field
                aria-label="스타일링 요청"
                maxLength={400}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="어떤 옷을 입고 싶으세요?"
              />
              <Control
                aria-label="스타일링 요청 보내기"
                disabled={working || !question.trim()}
              >
                <Icon name="arrow" size={18} />
              </Control>
            </form>
            <div className="assistant-actions">
              <Control
                onClick={() =>
                  void ask('지금 날씨와 일정에 맞게 오늘의 코디를 추천해 줘.')
                }
                disabled={working}
              >
                오늘 뭐 입을까?
              </Control>
              <Control
                onClick={() => setSettings(!settings)}
                aria-expanded={settings}
              >
                벨로 설정
              </Control>
            </div>
            {settings && (
              <div className="assistant-config">
                <label>
                  예보 도시
                  <Choice
                    value={city}
                    onChange={(e) =>
                      setCity(e.target.value as ForecastCity | '')
                    }
                  >
                    <option value="">선택 안 함</option>
                    {Object.entries(forecastCities).map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </Choice>
                </label>
                {forecast && (
                  <small>
                    예보 · MET Norway / CC BY 4.0 ·{' '}
                    {new Date(forecast.time).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                )}
                <label>
                  오늘 일정
                  <Field
                    placeholder="예: 저녁 전시 관람"
                    maxLength={80}
                    value={event.day === today ? event.value : ''}
                    onChange={(e) =>
                      setEvent({ day: today, value: e.target.value })
                    }
                  />
                </label>
                <label>
                  <Field
                    type="checkbox"
                    role="switch"
                    checked={voice}
                    disabled={!voiceSupported}
                    onChange={(e) => {
                      setVoice(e.target.checked);
                      if (e.target.checked) say(answer?.message ?? note);
                      else speechSynthesis.cancel();
                    }}
                  />
                  한국어 음성 안내{!voiceSupported ? ' · 기기 음성 없음' : ''}
                </label>
                {engine?.cloud && !engine.local && (
                  <>
                    <label>
                      드레스룸 접근 코드
                      <Field
                        type="password"
                        value={access}
                        onChange={(e) => setAccess(e.target.value)}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      <Field
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      요청 시 옷 목록·취향·일정·질문을 OpenAI에 전송하고 호출
                      비용 사용
                    </label>
                  </>
                )}
                {!engine?.cloud && !engine?.local && (
                  <small>
                    배포용 AI는 운영자의 서버 키 설정과 사용 승인이 필요해요.
                  </small>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
