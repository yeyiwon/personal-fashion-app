import { Choice, Control, Feedback, Field, Segment } from './LiquidControls';
import { useEffect, useRef, useState } from 'react';
import { getImage } from './storage';
import { jpegData, type Piece } from './avatarLayers';
import { useScopedState, useStudio } from './studio';
type Model = { base: 'f' | 'm' };
export default function RoomPhotoFitting({
  items,
  figure,
}: {
  items: Piece[];
  figure: Model;
}) {
  const { notify } = useStudio();
  const [refPhoto] = useScopedState('model-reference', '');
  const [ready, setReady] = useState(false),
    [itemId, setItemId] = useState(''),
    [own, setOwn] = useState(false),
    [approval, approve] = useState(false),
    [code, setCode] = useState('');
  const [job, setJob] = useScopedState<{ ticket: string; name: string } | null>(
    'room.fit-job',
    null,
  );
  const [results, setResults] = useScopedState<
    { name: string; image: string }[]
  >('room.fit-images', []);
  const [selected, show] = useState(0),
    [compare, setCompare] = useState(false),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    fetch('/api/room-fitting')
      .then((r) => r.json())
      .then((r) => {
        if (mounted.current) setReady(r.ready === true);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);
  const item =
    items.find((g) => g.id === itemId) ??
    items.find((g) => !g.photoUnavailable);
  async function call(body: object) {
    const r = await fetch('/api/room-fitting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Room-Access': code },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function check() {
    if (!job || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const d = await call({ action: 'status', ticket: job.ticket });
      if (!mounted.current) return;
      if (d.status === 'completed') {
        const image = await jpegData(d.output, 800);
        if (!mounted.current) return;
        setResults((v) => [{ name: job.name, image }, ...v].slice(0, 3));
        setJob(null);
        show(0);
        setStatus('완성된 이미지를 이 기기에 저장했어요.');
      } else if (d.status === 'failed') {
        setJob(null);
        setStatus(
          '생성에 실패했어요. 사진을 확인한 뒤 새 작업을 시작할 수 있어요.',
        );
      } else setStatus('생성 중이에요. 완료 여부를 다시 확인할 수 있어요.');
    } catch (e) {
      if (mounted.current)
        setStatus(e instanceof Error ? e.message : '조회 실패');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!job || !code || !ready) return;
    const timer = setInterval(() => void check(), 5000);
    return () => clearInterval(timer);
  }, [job?.ticket, code, ready]);
  async function generate() {
    if (!item || !ready || !approval || inFlight.current || job) return;
    inFlight.current = true;
    setBusy(true);
    setStatus('');
    try {
      const src = item.image || (await getImage(item.id));
      if (!src) throw Error('상품 사진이 필요해요.');
      const [model, garment] = await Promise.all([
        jpegData(
          own && refPhoto
            ? refPhoto
            : '/media/dressing/' + figure.base + '.webp',
        ),
        jpegData(src),
      ]);
      const d = await call({
        action: 'generate',
        category: item.category,
        model,
        garment,
        consent: true,
      });
      setJob({ ticket: d.ticket, name: item.name });
      if (mounted.current) {
        approve(false);
        setStatus('생성 요청을 접수했어요.');
      }
    } catch (e) {
      if (mounted.current)
        setStatus(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="room-photo-fit">
      <h3>AI 실사 피팅</h3>
      <p>
        {ready
          ? 'FASHN으로 모델에 상품 한 점을 입힌 이미지를 만들어요.'
          : 'FASHN 인증 설정과 생성 비용 승인이 필요해요.'}
      </p>
      <label>
        모델
        <Choice
          value={own ? 'own' : 'base'}
          onChange={(e) => setOwn(e.target.value === 'own')}
        >
          <option value="base">현재 기본 모델</option>
          {refPhoto && <option value="own">내 전신 참고 사진</option>}
        </Choice>
      </label>
      <label>
        착용할 한 점
        <Choice
          value={item?.id ?? ''}
          onChange={(e) => setItemId(e.target.value)}
        >
          {!item && (
            <option value="">사진이 있는 의류를 먼저 선택하세요</option>
          )}
          {items
            .filter((g) => !g.photoUnavailable)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </Choice>
      </label>
      <small>
        {item && ['신발', '가방', '기타'].includes(item.category)
          ? 'Try-On Max · 1K, fast · 1장'
          : 'Try-On v1.6 · 1크레딧 · 1장'}{' '}
        · 실제 치수와 착용감은 별도로 확인해 주세요.
      </small>
      {ready && (
        <>
          <label>
            운영자 접근 코드
            <Field
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label>
            <Field
              type="checkbox"
              checked={approval}
              onChange={(e) => approve(e.target.checked)}
            />
            선택한 두 사진을 FASHN에 보내고 1회 생성 비용을 사용합니다.
          </label>
        </>
      )}
      {job ? (
        <Control disabled={busy || !code} onClick={() => void check()}>
          기존 작업 상태 확인
        </Control>
      ) : (
        <Control
          aria-busy={busy}
          disabled={!ready || !item || !code || !approval || busy}
          onClick={() => void generate()}
        >
          실사 피팅 1장 생성
        </Control>
      )}
      <Feedback role="status">{status}</Feedback>
      {results.length > 0 && (
        <>
          <Segment className="fit-compares">
            {results.map((r, i) => (
              <Control
                key={i}
                aria-pressed={selected === i}
                onClick={() => {
                  show(i);
                  setCompare(false);
                }}
              >
                {r.name}
              </Control>
            ))}
          </Segment>
          <img
            src={
              compare && results[1]
                ? results[1].image
                : results[selected]?.image
            }
            alt="저장한 AI 실사 피팅 결과"
          />
          {results.length > 1 && selected !== 1 && (
            <Control onClick={() => setCompare(!compare)}>
              {compare ? '선택한 결과' : '이전 결과'} 보기
            </Control>
          )}
          <a
            href={results[selected]?.image}
            download="wardrobe-fitting.jpg"
            onClick={() => notify('피팅 이미지 저장을 열었어요.')}
          >
            이미지 내려받기
          </a>
        </>
      )}
    </section>
  );
}
