import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { GarmentPhoto, Icon } from './presentation';
import { IMAGE_ACCEPT, prepareImage } from './images';
import { useScopedState, useStudio, type PageProps } from './studio';
import {
  editorial,
  initialFigure,
  matchReference,
  matchWardrobe,
  photoPath,
  products,
  won,
  type Figure,
  type Product,
} from './atelierData';
import MeasureMirror from './MeasureMirror';
import { sampleOutfits } from './sample';
import { searchRetail, type RetailOffer } from './retail';
import { OfferConditions, PriceAlerts } from './ShopConditions';
import './atelier.css';

type Nav = Pick<PageProps, 'go'>;
type View = 'photo' | 'diagram' | 'own';
type SavedFit = {
  ids: string[];
  figure: Figure;
  date: string;
  product?: string;
  source?: 'own' | 'model';
};
const modelSrc = (base: Figure['base']) =>
  editorial(base === 'f' ? 'model-f' : 'model-m');
function Heading({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="at-heading">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {aside}
    </header>
  );
}
function Tab({
  chosen,
  onClick,
  children,
}: {
  chosen: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={'at-tab' + (chosen ? ' on' : '')}
      aria-pressed={chosen}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Next({
  children,
  onClick,
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={secondary ? 'at-next at-secondary' : 'at-next'}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      <Icon name="right" size={17} />
    </button>
  );
}
function Subnav({ items, go }: { items: [string, string][] } & Nav) {
  return (
    <nav className="at-subnav" aria-label="관련 메뉴">
      {items.map(([p, t]) => (
        <button key={p} onClick={() => go(p)}>
          {t}
          <Icon name="right" size={14} />
        </button>
      ))}
    </nav>
  );
}
function Blank({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="at-blank">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
async function smallPhoto(preview: Blob) {
  const bitmap = await createImageBitmap(preview);
  const canvas = document.createElement('canvas'),
    scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('사진을 미리 볼 수 없어요.');
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.72);
}
function ModelRoom({ go }: Nav) {
  const [figure, setFigure] = useScopedState<Figure>('model', initialFigure);
  const [ownPhoto, setOwnPhoto] = useScopedState<string>('model-reference', '');
  const [face, setFace] = useScopedState<string>('model-face', '');
  const [angle, setAngle] = useState(0);
  const [selectedView, setView] = useState<View>('photo');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { notify, mode } = useStudio();
  const view = selectedView === 'own' && !ownPhoto ? 'photo' : selectedView;
  const fileRef = useRef<HTMLInputElement>(null),
    faceRef = useRef<HTMLInputElement>(null);
  const uploadId = useRef(0);
  useEffect(
    () => () => {
      uploadId.current++;
    },
    [],
  );
  function tweak<K extends keyof Figure>(key: K, value: Figure[K]) {
    setFigure((previous) => ({ ...previous, [key]: value }));
    if (key !== 'base') setView('diagram');
  }
  async function accept(file?: File, kind: 'body' | 'face' = 'body') {
    if (!file) return;
    const id = ++uploadId.current;
    setBusy(true);
    setError('');
    try {
      const { preview } = await prepareImage(file);
      const data = await smallPhoto(preview);
      if (id === uploadId.current) {
        if (kind === 'body') {
          setOwnPhoto(data);
          setView('own');
        } else setFace(data);
        notify('참고 사진을 기기에 보관했어요.');
      }
    } catch (err) {
      if (id === uploadId.current)
        setError(err instanceof Error ? err.message : '사진을 읽을 수 없어요.');
    } finally {
      if (id === uploadId.current) setBusy(false);
    }
  }
  return (
    <MeasureMirror
      figure={figure}
      view={view}
      ownPhoto={ownPhoto}
      angle={angle}
      turn={setAngle}
      setView={setView}
      tweak={tweak}
      fitting={() => go('fitting')}
    >
      <div className="at-source-grid">
        {[
          {
            name: '얼굴',
            src: face,
            ref: faceRef,
            clear: () => setFace(''),
          },
          {
            name: '전신',
            src: ownPhoto,
            ref: fileRef,
            clear: () => {
              setOwnPhoto('');
              setView('photo');
            },
          },
        ].map((r) => (
          <div key={r.name}>
            {r.src && <img src={r.src} alt={r.name + ' 참고 사진'} />}
            <button disabled={busy} onClick={() => r.ref.current?.click()}>
              <Icon name="photo" size={16} />
              {r.name} 사진 {r.src ? '변경' : '선택'}
            </button>
            {r.src && <button onClick={r.clear}>{r.name} 사진 삭제</button>}
          </div>
        ))}
      </div>
      <p className="at-footnote">
        참고 사진은 이 기기의 {mode === 'sample' ? '샘플' : '개인'} 공간에만
        저장돼요.
      </p>
      <input
        ref={faceRef}
        type="file"
        aria-label="얼굴 사진 파일"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          void accept(e.target.files?.[0], 'face');
          e.target.value = '';
        }}
      />
      <input
        ref={fileRef}
        type="file"
        aria-label="전신 사진 파일"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && (
        <p role="alert" className="at-error">
          {error}
        </p>
      )}
    </MeasureMirror>
  );
}
function FitRoom({ page, go }: PageProps) {
  const { garments, outfits, selectedIds, setSelectedIds, notify, mode } =
    useStudio();
  const [figure, setFigure] = useScopedState<Figure>('model', initialFigure);
  const [ownPhoto] = useScopedState<string>('model-reference', '');
  const [reference, setReference] = useScopedState<'model' | 'own'>(
    'fitting-source',
    'model',
  );
  const [saved, setSaved] = useScopedState<SavedFit[]>('fit-boards', []);
  const [position, setPosition] = useState(50);
  const [candidateId, setCandidateId] = useScopedState<string>(
    'fitting-product',
    '',
  );
  const candidate = products.find((p) => p.id === candidateId);
  const [replaceId, setReplaceId] = useState('');
  const replacement = garments.find(
    (g) => g.id === replaceId && selectedIds.includes(g.id),
  );
  const alternatives = replacement
    ? garments.filter(
        (g) =>
          g.category === replacement.category && !selectedIds.includes(g.id),
      )
    : [];
  const selected = garments.filter((g) => selectedIds.includes(g.id));
  const own = reference === 'own' && !!ownPhoto;
  const examples =
    figure.base === 'f'
      ? [
          { id: 'sample-sand', file: 'model-f', name: '스커트 착장' },
          { id: 'sample-graphite', file: 'look-2', name: '팬츠 착장' },
        ]
      : [
          { id: 'sample-navy', file: 'model-m', name: '메리노 니트 착장' },
          {
            id: 'sample-denim',
            file: 'model-m-denim',
            name: '데님 트러커 착장',
          },
        ];
  const matched =
    mode === 'sample' && !own && !candidate
      ? examples.find((example) => {
          const look = sampleOutfits.find((o) => o.id === example.id);
          return (
            look?.garmentIds.length === selected.length &&
            look.garmentIds.every((id) => selected.some((g) => g.id === id))
          );
        })
      : undefined;
  const isResult = page === 'fitting-result',
    stage =
      page === 'fitting-wait'
        ? 'wait'
        : page === 'fitting-error'
          ? 'error'
          : null;
  const recent = saved.at(-1);
  function toggle(id: string) {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id].slice(0, 32),
    );
  }
  function saveBoard() {
    if (!selected.length && !candidate) return;
    setSaved((rows) => [
      ...rows.slice(-19),
      {
        ids: selected.map((g) => g.id),
        figure: { ...figure },
        product: candidate?.id,
        source: own ? 'own' : 'model',
        date: new Date().toISOString(),
      },
    ]);
    notify('피팅 보드의 모델 설정과 선택한 옷을 저장했어요.');
  }
  const savedCurrent =
    !!recent &&
    (recent.product ?? '') === (candidate?.id ?? '') &&
    JSON.stringify(recent.ids) === JSON.stringify(selected.map((g) => g.id)) &&
    JSON.stringify(recent.figure) === JSON.stringify(figure) &&
    (recent.source ?? 'model') === reference;
  if (stage)
    return (
      <>
        <Heading
          title={
            stage === 'wait' ? '생성 대기 상태 예시' : '생성 실패 상태 예시'
          }
        />
        <div className="at-state-layout">
          <img src={modelSrc(figure.base)} alt="선택한 기본 모델 예시" />
          <div>
            <h2>
              {stage === 'wait'
                ? '요청이 대기 중일 때'
                : '생성 결과를 받지 못했을 때'}
            </h2>
            <p>
              {stage === 'wait'
                ? '연동 후에는 처리 중인 요청의 상태를 이곳에서 확인해요.'
                : '모델과 선택한 옷을 유지한 채 요청 내용을 다시 확인해요.'}{' '}
              현재 보낸 요청은 없어요.
            </p>
            <Next
              onClick={() =>
                go(stage === 'wait' ? 'fitting-result' : 'fitting')
              }
            >
              {stage === 'wait'
                ? '고정 착장 비교 보기'
                : '피팅 준비로 돌아가기'}
            </Next>
          </div>
        </div>
      </>
    );
  if (isResult)
    return (
      <>
        <Heading
          title="착장 비교"
          aside={
            <button className="at-arrowlink" onClick={() => go('fitting')}>
              피팅룸 <Icon name="right" size={15} />
            </button>
          }
        >
          같은 모델의 두 가지 고정 착장 예시예요.
        </Heading>
        <button className="action" onClick={() => go('home')}>선택한 옷을 아바타에 입히기 <Icon name="arrow" size={16}/></button>
      <div className="at-fit-layout">
          <div
            className="at-compare-stage"
            style={{ '--split': position + '%' } as CSSProperties}
          >
            <img src={editorial(examples[0].file)} alt={examples[0].name} />
            <img
              className="at-slide-layer"
              src={editorial(examples[1].file)}
              alt={examples[1].name}
            />
            <div className="at-slider-rule">
              <span>‹ ›</span>
            </div>
            <input
              className="at-drag"
              type="range"
              min="0"
              max="100"
              value={position}
              onChange={(e) => setPosition(+e.target.value)}
              aria-label="착장 비교 경계"
              aria-valuetext={'두 번째 착장 ' + position + '%'}
            />
            <span className="at-stage-label">
              {examples[1].name} / {examples[0].name}
            </span>
            <span className="at-drag-caption">경계를 좌우로 움직여 보세요</span>
          </div>
          <section className="at-controls">
            <h2>내 피팅 보드</h2>
            <p className="at-note">
              {matched
                ? matched.name + ' 예시는 선택한 샘플 코디와 구성이 같아요.'
                : '위 사진은 미리 제작한 예시예요.'}{' '}
              내 치수와 선택한 옷을 반영한 사진 생성에는 피팅 API가 필요해요.
            </p>
            <div className="at-fit-items">
              {candidate && (
                <div>
                  <img src={photoPath(candidate.id)} alt={candidate.name} />
                  <small>구매 후보 · {candidate.name}</small>
                </div>
              )}
              {selected.map((g) => (
                <div key={g.id}>
                  <GarmentPhoto item={g} />
                  <small>{g.name}</small>
                </div>
              ))}
            </div>
            {selected.length === 0 && !candidate && (
              <Blank title="선택한 옷이 없어요." />
            )}
            <Next
              disabled={savedCurrent || (!selected.length && !candidate)}
              onClick={saveBoard}
            >
              {savedCurrent ? '보드 저장됨' : '피팅 보드 저장'}
            </Next>
            <Next secondary onClick={() => go('fitting')}>
              모델·옷 다시 선택
            </Next>
          </section>
        </div>
      </>
    );
  return (
    <>
      <Heading
        title="가상 피팅"
        aside={
          <button className="at-arrowlink" onClick={() => go('model')}>
            모델 편집 <Icon name="right" size={16} />
          </button>
        }
      >
        선택한 옷을 아바타에 입혀 보거나 피팅 보드를 구성하세요.
      </Heading>
      <div className="at-fit-layout">
        <div className="at-fitting-set">
          <div className="at-fitting-person">
            <img
              src={
                own
                  ? ownPhoto
                  : matched
                    ? editorial(matched.file)
                    : modelSrc(figure.base)
              }
              alt={
                own
                  ? '내 참고 사진'
                  : matched
                    ? '선택한 샘플 코디의 고정 착장 예시'
                    : '기본 모델 착장 예시'
              }
            />
            <small>
              {own
                ? '내 참고 사진'
                : matched
                  ? '선택 코디 착장 예시'
                  : '기본 착장 예시'}
            </small>
          </div>
          <div className="at-fitting-rail">
            {candidate && (
              <button
                onClick={() => setCandidateId('')}
                aria-label={candidate.name + ' 후보 제외'}
              >
                <img src={photoPath(candidate.id)} alt={candidate.name} />
              </button>
            )}
            {selected.slice(0, candidate ? 2 : 3).map((g) => (
              <button
                key={g.id}
                aria-label={g.name + ' 선택 해제'}
                onClick={() => toggle(g.id)}
              >
                <GarmentPhoto item={g} shared />
              </button>
            ))}
            {!selected.length && !candidate && (
              <span>
                입혀 볼 옷을
                <br />
                선택해 주세요
              </span>
            )}
            {selected.length > (candidate ? 2 : 3) && (
              <small>외 {selected.length - (candidate ? 2 : 3)}벌</small>
            )}
          </div>
        </div>
        <section className="at-controls">
          <div className="at-sectiontitle">
            <h2>피팅 준비</h2>
            <small>
              {figure.height} cm · {figure.weight} kg
            </small>
          </div>
          {ownPhoto && (
            <div className="at-line">
              <strong>모델 이미지</strong>
              <div className="at-segment">
                <Tab chosen={!own} onClick={() => setReference('model')}>
                  기본 모델
                </Tab>
                <Tab chosen={own} onClick={() => setReference('own')}>
                  내 사진
                </Tab>
              </div>
            </div>
          )}
          {outfits.length > 0 && (
            <label className="at-field">
              저장한 코디 가져오기
              <select
                value=""
                onChange={(e) => {
                  const look = outfits.find((o) => o.id === e.target.value);
                  if (look) setSelectedIds(look.garmentIds);
                }}
              >
                <option value="">코디 선택</option>
                {outfits.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="at-sectiontitle">
            <h3>옷장에서 선택</h3>
            <small>{selected.length}벌 선택</small>
          </div>
          {garments.length ? (
            <div className="at-picker">
              {garments.map((g) => (
                <button
                  key={g.id}
                  aria-pressed={selectedIds.includes(g.id)}
                  onClick={() => toggle(g.id)}
                >
                  <div>
                    <GarmentPhoto item={g} />
                    {selectedIds.includes(g.id) && (
                      <i>
                        <Icon name="check" size={12} />
                      </i>
                    )}
                  </div>
                  <small>{g.name}</small>
                </button>
              ))}
            </div>
          ) : (
            <Next secondary onClick={() => go('register')}>
              첫 옷 등록하기
            </Next>
          )}
          <label className="at-field">
            구매 후보 추가
            <select
              value={candidate?.id ?? ''}
              onChange={(e) => setCandidateId(e.target.value)}
            >
              <option value="">구매 후보 없음</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · 샘플 상품
                </option>
              ))}
            </select>
          </label>
          {selected.length > 0 && (
            <details className="at-details">
              <summary>한 벌만 교체</summary>
              <label className="at-field">
                교체할 옷
                <select
                  value={replacement?.id ?? ''}
                  onChange={(e) => setReplaceId(e.target.value)}
                >
                  <option value="">선택</option>
                  {selected.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              {replacement &&
                (alternatives.length ? (
                  <div className="at-picker">
                    {alternatives.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setSelectedIds((ids) =>
                            ids.map((id) => (id === replaceId ? g.id : id)),
                          );
                          setReplaceId('');
                          notify('선택한 한 벌만 교체했어요.');
                        }}
                      >
                        <div>
                          <GarmentPhoto item={g} />
                        </div>
                        <small>{g.name}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="at-note">
                    같은 분류에서 교체할 다른 옷이 없어요.
                  </p>
                ))}
            </details>
          )}
          <Next onClick={() => go('fitting-result')}>착장 비교 예시 보기</Next>
          <p className="at-note">
            AI 피팅 생성은 외부 API 연결 후 이용할 수 있어요. 선택한 옷은 피팅
            보드에서 확인할 수 있어요.
          </p>
          {recent && (
            <button
              className="at-textbtn"
              onClick={() => {
                setSelectedIds(
                  recent.ids.filter((id) => garments.some((g) => g.id === id)),
                );
                setFigure(recent.figure);
                setCandidateId(recent.product ?? '');
                setReference(
                  recent.source === 'own' && ownPhoto ? 'own' : 'model',
                );
                notify('마지막 피팅 보드의 모델과 옷을 가져왔어요.');
              }}
            >
              마지막 피팅 보드 다시 열기
            </button>
          )}
          <details className="at-details">
            <summary>생성 요청 상태 예시</summary>
            <Subnav
              go={go}
              items={[
                ['fitting-wait', '대기 상태'],
                ['fitting-error', '실패 상태'],
              ]}
            />
          </details>
        </section>
      </div>
    </>
  );
}

type Reference = { src: string; color: string; name: string };
function ImageSearch({ page, go }: PageProps) {
  const { garments, setSelectedIds } = useStudio();
  const [ref, setRef] = useScopedState<Reference | null>(
    'style-reference',
    null,
  );
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const task = useRef(0),
    input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      task.current++;
    },
    [],
  );
  async function choose(source: File | string, name: string) {
    const id = ++task.current;
    setBusy(true);
    setError('');
    try {
      let file: File;
      if (typeof source === 'string') {
        const r = await fetch(source);
        if (!r.ok) throw Error('예시 사진을 열 수 없어요.');
        file = new File([await r.blob()], 'sample.webp', {
          type: 'image/webp',
        });
      } else file = source;
      const prepared = await prepareImage(file);
      const src =
        typeof source === 'string'
          ? source
          : await smallPhoto(prepared.preview);
      if (id !== task.current) return;
      setRef({ src, color: prepared.color, name });
    } catch (err) {
      if (id === task.current)
        setError(
          err instanceof Error ? err.message : '이미지를 확인할 수 없어요.',
        );
    } finally {
      if (id === task.current) setBusy(false);
    }
  }
  const matches = ref ? matchReference(ref.color, garments) : [];
  const result = page === 'image-result' && !!ref;
  return (
    <>
      <Heading title={result ? '내 옷장에서 찾은 조합' : '이미지로 코디 찾기'}>
        {result
          ? '참고 사진의 대표색에 가까운 옷을 분류별로 골랐어요.'
          : '마음에 든 착장 사진에서 내 옷과 이어지는 색을 찾아요.'}
      </Heading>
      <div className="at-reference-layout">
        <section className={'at-reference ' + (!ref ? 'empty' : '')}>
          {ref ? (
            <>
              <img src={ref.src} alt={ref.name} />
              <span className="at-stage-label">{ref.name}</span>
            </>
          ) : (
            <div className="at-upload-target">
              <Icon name="photo" size={44} />
              <h2>참고 착장 사진</h2>
              <button
                className="at-textbtn"
                onClick={() => input.current?.click()}
              >
                앨범에서 선택
              </button>
            </div>
          )}
          {ref && (
            <div className="at-extracted">
              <i style={{ background: ref.color }} />
              대표색 <b>{ref.color.toUpperCase()}</b>
            </div>
          )}
        </section>
        <section className="at-controls">
          <h2>{result ? '가까운 색 조합' : '참고 이미지 선택'}</h2>
          {result ? (
            <>
              {matches.length ? (
                <div className="at-fit-items">
                  {matches.map((g) => (
                    <div key={g.id}>
                      <GarmentPhoto item={g} />
                      <small>{g.name}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <Blank title="비교할 옷이 없어요.">
                  <Subnav go={go} items={[['register', '옷 등록하기']]} />
                </Blank>
              )}
              <Next
                disabled={!matches.length}
                onClick={() => {
                  setSelectedIds(matches.map((g) => g.id));
                  go('direct');
                }}
              >
                직접 코디에서 편집
              </Next>
              <Next secondary onClick={() => go('image-search')}>
                다른 이미지 선택
              </Next>
              <p className="at-note">
                기기에서 읽은 대표색과 옷장의 색상·분류를 비교한 결과예요.
                실루엣과 소재 인식에는 비전 API가 필요해요.
              </p>
            </>
          ) : (
            <>
              <div className="at-photo-input">
                <button disabled={busy} onClick={() => input.current?.click()}>
                  <Icon name="photo" size={17} />
                  {busy
                    ? '사진 색상 읽는 중'
                    : ref
                      ? '다른 사진 선택'
                      : '내 사진 선택'}
                </button>
                {ref && (
                  <button
                    onClick={() => {
                      task.current++;
                      setBusy(false);
                      setRef(null);
                    }}
                  >
                    지우기
                  </button>
                )}
              </div>
              <p className="at-note">
                사진과 추출한 색상은 이 기기에 보관돼요.
              </p>
              <h3>착장 예시로 시작</h3>
              <div className="at-reference-samples">
                {[
                  ['look-2', '크롭 트렌치'],
                  ['model-m', '메리노 니트'],
                  ['model-f', '블랙 스커트'],
                ].map(([p, n]) => (
                  <button
                    disabled={busy}
                    key={p}
                    onClick={() => void choose(editorial(p), n + ' 착장 예시')}
                  >
                    <img src={editorial(p)} alt="" />
                    {n}
                  </button>
                ))}
              </div>
              <Next disabled={!ref || busy} onClick={() => go('image-result')}>
                내 옷에서 색상 조합 찾기
              </Next>
            </>
          )}
          {error && (
            <p className="at-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f, '내 참고 사진');
          e.target.value = '';
        }}
      />
    </>
  );
}
function ProductCard({
  product,
  open,
  saved,
  toggle,
}: {
  product: Product;
  open: () => void;
  saved: boolean;
  toggle: () => void;
}) {
  return (
    <article className="at-product">
      <div className="at-product-visual">
        <button
          className="at-product-image"
          onClick={open}
          aria-label={product.name + ' 상세 보기'}
        >
          <img loading="lazy" src={photoPath(product.id)} alt={product.name} />
        </button>
        <button
          aria-label={product.name + (saved ? ' 관심 해제' : ' 관심 저장')}
          aria-pressed={saved}
          className="at-bookmark"
          onClick={toggle}
        >
          <Icon name="save" size={16} />
        </button>
      </div>
      <button className="at-product-info" onClick={open}>
        <span>
          {product.tone} · {product.category}
        </span>
        <strong>{product.name}</strong>
        <small>{won(product.price)}</small>
      </button>
    </article>
  );
}
function RetailSearch() {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<RetailOffer[]>([]),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [submitted, setSubmitted] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit() {
    if (!query.trim()) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setSubmitted(false);
    setResults([]);
    setError('');
    setPending(true);
    try {
      const offers = await searchRetail(query.trim(), current.signal);
      if (!current.signal.aborted) {
        setResults(offers);
        setSubmitted(true);
      }
    } catch (err) {
      if (!current.signal.aborted)
        setError(
          err instanceof Error ? err.message : '상품을 검색할 수 없어요.',
        );
    } finally {
      if (!current.signal.aborted) setPending(false);
    }
  }
  return (
    <details className="at-details at-retail">
      <summary>제휴몰 상품 검색</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="at-field">
          찾고 싶은 상품
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
            placeholder="예: 네이비 메리노 니트"
            type="search"
          />
        </label>
        <button className="at-smallbtn" disabled={!query.trim() || pending}>
          {pending ? '검색 중' : '제휴몰 검색'}
        </button>
      </form>
      <div aria-live="polite">
        {error && <p>{error}</p>}
        {submitted && results.length === 0 && (
          <p>조건과 일치하는 상품이 없어요.</p>
        )}
      </div>
      {results.length > 0 && (
        <>
          <p>
            애드픽 제휴 상품 · 구매 시 수수료를 받을 수 있어요. 최종 옵션과
            배송비는 판매처에서 확인해 주세요.
          </p>
          <ul className="at-live-list">
            {results.map((offer) => (
              <li key={offer.id}>
                <a
                  href={offer.link}
                  rel="sponsored noopener noreferrer"
                  target="_blank"
                >
                  <strong>{offer.title}</strong>
                  <span>
                    {offer.merchant} ·{' '}
                    {offer.price === null ? '가격 미제공' : won(offer.price)}
                  </span>
                  <small>
                    {new Date(offer.observedAt).toLocaleString('ko-KR')} 조회
                  </small>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && query.trim() && (
        <a
          href={
            'https://search.shopping.naver.com/search/all?query=' +
            encodeURIComponent(query.trim())
          }
          rel="noreferrer"
          target="_blank"
        >
          네이버 쇼핑에서 직접 검색 ↗
        </a>
      )}
    </details>
  );
}
function Shopping({ page, go }: PageProps) {
  const { garments, notify } = useStudio();
  const [chosen, select] = useScopedState<string>(
    'shop-product',
    products[0].id,
  );
  const [, setCandidateId] = useScopedState<string>('fitting-product', '');
  const [wishlist, setWishlist] = useScopedState<string[]>('wishlist', []);
  const [size, setSize] = useScopedState<string>('shop-option', 'M');
  const [alternative, setAlternative] = useScopedState<string>(
    'shop-alternative',
    'merino',
  );
  const [filter, setFilter] = useState('전체'),
    [sort, setSort] = useState('wardrobe');
  const [budget, setBudget] = useState('all');
  const product = products.find((p) => p.id === chosen) || products[0];
  const other =
    products.find((p) => p.id === alternative && p.id !== product.id) ||
    products.find((p) => p.id !== product.id)!;
  const selected = matchWardrobe(product, garments);
  function toggle(id: string) {
    setWishlist((rows) =>
      rows.includes(id) ? rows.filter((x) => x !== id) : [...rows, id],
    );
  }
  function open(id: string) {
    if (id !== chosen) setSize('M');
    select(id);
    go('product');
  }
  const candidates = products
    .filter(
      (p) =>
        (page !== 'wishlist' || wishlist.includes(p.id)) &&
        (filter === '전체' || p.category === filter) &&
        (budget === 'all' || p.price <= Number(budget)),
    )
    .sort((a, b) => {
      if (sort === 'price') return a.price - b.price;
      const score = (x: Product) => {
        const r = matchWardrobe(x, garments);
        return r.pairs.length - r.neighbors.length;
      };
      return score(b) - score(a);
    });
  const optionLabel = (p: Product) =>
    p.category === '신발'
      ? '250 mm'
      : ['가방', '기타'].includes(p.category)
        ? '단일 옵션'
        : size;
  function openProduct(id: string) {
    open(id);
  }
  function productCard(p: Product) {
    return (
      <ProductCard
        key={p.id}
        product={p}
        open={() => openProduct(p.id)}
        saved={wishlist.includes(p.id)}
        toggle={() => toggle(p.id)}
      />
    );
  }
  if (page === 'price-alerts')
    return (
      <PriceAlerts product={product} option={optionLabel(product)} go={go} />
    );
  if (page === 'shop' || page === 'wishlist') {
    const wish = page === 'wishlist';
    return (
      <>
        <Heading
          title={wish ? '관심 상품' : '맞춤 쇼핑'}
          aside={
            <button
              className="at-arrowlink"
              onClick={() => {
                setFilter('전체');
                setBudget('all');
                go(wish ? 'shop' : 'wishlist');
              }}
            >
              {wish ? '쇼핑' : '관심 ' + wishlist.length}
              <Icon name={wish ? 'right' : 'save'} size={16} />
            </button>
          }
        >
          {wish
            ? '구매를 고민하는 샘플 상품을 모아두세요.'
            : '옷장에 있는 옷과 함께 입을 구매 후보를 살펴보세요.'}
        </Heading>
        {!wish && (
          <div className="at-shop-feature">
            <img src={photoPath('trench')} alt="샌드 컬러 크롭 트렌치" />
            <div>
              <span>샘플 셀렉션</span>
              <h2>크롭 트렌치</h2>
              <button onClick={() => open('trench')}>
                내 옷과 맞춰보기 <Icon name="right" size={16} />
              </button>
            </div>
          </div>
        )}
        <div className="at-sectiontitle">
          <h2>{wish ? '저장한 후보' : '샘플 상품'}</h2>
          <span>{candidates.length}개</span>
        </div>
        <div className="at-filter-scroller">
          {[
            '전체',
            '아우터',
            '상의',
            '하의',
            '원피스',
            '신발',
            '가방',
            '기타',
          ].map((c) => (
            <Tab key={c} chosen={filter === c} onClick={() => setFilter(c)}>
              {c === '기타' ? '액세서리' : c}
            </Tab>
          ))}
        </div>
        <div className="at-sort">
          <label>
            예산{' '}
            <select
              aria-label="최대 가격"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="80000">8만원 이하</option>
              <option value="100000">10만원 이하</option>
            </select>
          </label>
          <select
            aria-label="정렬"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="wardrobe">내 옷 조합순</option>
            <option value="price">낮은 가격순</option>
          </select>
        </div>
        {candidates.length ? (
          <div className="at-product-grid">{candidates.map(productCard)}</div>
        ) : (
          <Blank
            title={
              wish && !wishlist.length
                ? '아직 저장한 상품이 없어요.'
                : '조건에 맞는 상품이 없어요.'
            }
          >
            {wish && !wishlist.length ? (
              <Next secondary onClick={() => go('shop')}>
                샘플 상품 보기
              </Next>
            ) : (
              <button
                className="at-textbtn"
                onClick={() => {
                  setFilter('전체');
                  setBudget('all');
                }}
              >
                필터 초기화
              </button>
            )}
          </Blank>
        )}
        <p className="at-note">
          샘플 상품과 가격은 구매 검토용 예시예요. 실제 판매가·재고·배송비는
          제휴사 연결이 필요해요.
        </p>
        {wish ? (
          <Subnav
            go={go}
            items={[
              ['alternatives', '구매 후보 비교'],
              ['price-alerts', '가격 알림'],
              ['shop', '맞춤 쇼핑'],
            ]}
          />
        ) : (
          <RetailSearch />
        )}
      </>
    );
  }
  if (page === 'price-unavailable' || page === 'product-unavailable') {
    return (
      <>
        <Heading
          title={
            page === 'price-unavailable'
              ? '가격 확인이 필요해요'
              : '상품 정보를 확인해 주세요'
          }
        />
        <Blank title="판매처 정보 미연결">
          <p>
            현재 상품의 실시간 가격·재고·판매처 상세 정보를 확인할 수 없어요.
            샘플 후보와 옷장 조합은 계속 살펴볼 수 있어요.
          </p>
          <Next onClick={() => go('shop')}>맞춤 쇼핑으로</Next>
        </Blank>
      </>
    );
  }
  if (page === 'alternatives') {
    return (
      <>
        <Heading title="구매 후보 비교">
          서로 다른 두 후보를 가격, 색상, 보유 의류 조합으로 비교해요.
        </Heading>
        <div className="at-candidate-compare">
          {[product, other].map((p, i) => (
            <div key={i}>
              <label className="at-field">
                후보 {i === 0 ? 'A' : 'B'}
                <select
                  value={p.id}
                  onChange={(e) =>
                    i === 0
                      ? select(e.target.value)
                      : setAlternative(e.target.value)
                  }
                >
                  {products
                    .filter((x) =>
                      i === 0 ? x.id !== other.id : x.id !== product.id,
                    )
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
              <img src={photoPath(p.id)} alt={p.name} />
              <h2>{p.name}</h2>
              <p>
                {won(p.price)} · {p.tone}
              </p>
              <ul>
                <li>
                  함께 입을 옷 {matchWardrobe(p, garments).pairs.length}벌
                </li>
                <li>
                  비슷한 옷 {matchWardrobe(p, garments).neighbors.length}벌
                </li>
              </ul>
              <Next secondary onClick={() => open(p.id)}>
                상세 보기
              </Next>
            </div>
          ))}
        </div>
        <p className="at-note">샘플 카탈로그 기준이에요.</p>
      </>
    );
  }
  const priceCompare = page === 'compare',
    analysis = page === 'analysis';
  const sizes = ['가방', '기타', '신발'].includes(product.category)
    ? null
    : ['S', 'M', 'L'];
  return (
    <>
      <Heading
        title={
          priceCompare
            ? '판매처별 가격 비교'
            : analysis
              ? '구매 전 코디 분석'
              : product.name
        }
        aside={
          <button className="at-arrowlink" onClick={() => go('shop')}>
            쇼핑 <Icon name="right" size={15} />
          </button>
        }
      >
        {priceCompare
          ? '같은 상품·옵션의 배송비 포함 금액을 비교해요.'
          : analysis
            ? '같이 입을 옷과 이미 가진 비슷한 옷을 확인해요.'
            : '샘플 카탈로그'}
      </Heading>
      <div className="at-product-layout">
        <section className="at-detail-photo">
          <img src={photoPath(product.id)} alt={product.name} />
          <span className="at-stage-label">샘플 상품</span>
        </section>
        <section className="at-controls">
          <div className="at-sectiontitle">
            <h2>{product.name}</h2>
            <button
              className="at-bookmark inline"
              aria-pressed={wishlist.includes(product.id)}
              aria-label="관심 상품 저장 또는 해제"
              onClick={() => {
                toggle(product.id);
                notify(
                  wishlist.includes(product.id)
                    ? '관심에서 해제했어요.'
                    : '관심 상품에 저장했어요.',
                );
              }}
            >
              <Icon name="save" size={20} />
            </button>
          </div>
          <p className="at-product-meta">
            <i style={{ background: product.color }} />
            {product.tone} · {product.material} ·{' '}
            {product.category === '기타' ? '액세서리' : product.category}
          </p>
          {priceCompare ? (
            <>
              <OfferConditions
                product={product}
                option={optionLabel(product)}
              />
              <Subnav
                go={go}
                items={[
                  ['price-alerts', '목표 가격 알림'],
                  ['price-unavailable', '실시간 가격 확인 상태'],
                  ['alternatives', '다른 상품과 비교'],
                ]}
              />
            </>
          ) : analysis ? (
            <>
              <h3>
                함께 입을 옷 <small>{selected.pairs.length}벌</small>
              </h3>
              <p className="at-note">
                겹치지 않는 분류에서 색상 거리가 가까운 옷을 골랐어요.
              </p>
              {selected.pairs.length ? (
                <div className="at-fit-items">
                  {selected.pairs.map((g) => (
                    <div key={g.id}>
                      <GarmentPhoto item={g} />
                      <small>{g.name}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <Blank title="함께 입을 옷을 찾지 못했어요." />
              )}
              <h3>
                비슷한 옷 <small>{selected.neighbors.length}벌</small>
              </h3>
              <p className="at-note">
                {selected.neighbors.length
                  ? selected.neighbors.map((g) => g.name).join(' · ')
                  : '같은 분류에서 색이 가까운 보유 의류가 없어요.'}
              </p>
              <Next
                onClick={() => {
                  setCandidateId(product.id);
                  go('fitting');
                }}
              >
                구매 후보로 피팅
              </Next>
              <Next secondary onClick={() => go('alternatives')}>
                다른 구매 후보와 비교
              </Next>
            </>
          ) : (
            <>
              <strong className="at-detail-price">{won(product.price)}</strong>
              <div className="at-line">
                <strong>옵션</strong>
                {sizes ? (
                  <div className="at-segment">
                    {sizes.map((s) => (
                      <Tab
                        key={s}
                        chosen={size === s}
                        onClick={() => setSize(s)}
                      >
                        {s}
                      </Tab>
                    ))}
                  </div>
                ) : (
                  <span>{optionLabel(product)}</span>
                )}
              </div>
              <Next onClick={() => go('analysis')}>내 옷과 코디 분석</Next>
              <Next secondary onClick={() => go('compare')}>
                같은 옵션 가격 비교
              </Next>
              <Next
                secondary
                onClick={() => {
                  setCandidateId(product.id);
                  go('fitting');
                }}
              >
                이 상품으로 피팅
              </Next>
              <Subnav
                go={go}
                items={[
                  ['alternatives', '구매 후보 비교'],
                  ['price-alerts', '가격 알림'],
                  ['product-unavailable', '판매처 정보 상태'],
                ]}
              />
            </>
          )}
        </section>
      </div>
    </>
  );
}
export default function Atelier({ page, go }: PageProps) {
  return (
    <div className="at">
      {page === 'model' ? (
        <ModelRoom go={go} />
      ) : page.startsWith('fitting') ? (
        <FitRoom page={page} go={go} />
      ) : page.startsWith('image-') ? (
        <ImageSearch page={page} go={go} />
      ) : (
        <Shopping page={page} go={go} />
      )}
    </div>
  );
}
export { Atelier };
