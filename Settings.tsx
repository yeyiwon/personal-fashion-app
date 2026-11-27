import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStudio, useScopedState, type PageProps } from './studio';
import { exportData, clearData } from './storage';
import { importWardrobe } from './backup';
import { Icon } from './presentation';
import './settings.css';

const colors = [
  ['잉크', '#252936'],
  ['스틸 블루', '#839aad'],
  ['크림', '#eadfc9'],
  ['버건디', '#78404d'],
  ['피스타치오', '#b2bb94'],
  ['라일락', '#b4a3c6'],
];
const styles = ['미니멀', '캐주얼', '클래식'];
const occasions = ['일상', '출근', '데이트', '여행'];
const conditions = ['선선함', '따뜻함', '추움', '비·눈'];

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="settings-heading">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
function SettingLink({
  title,
  note,
  open,
}: {
  title: string;
  note?: string;
  open: () => void;
}) {
  return (
    <button type="button" className="settings-link" onClick={open}>
      <span>
        {title}
        {note && <small>{note}</small>}
      </span>
      <Icon name="right" size={18} />
    </button>
  );
}
function Choices({
  title,
  options,
  selected,
  choose,
}: {
  title: string;
  options: string[];
  selected: string;
  choose: (s: string) => void;
}) {
  return (
    <fieldset className="settings-choices">
      <legend>{title}</legend>
      <div>
        {options.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === selected}
            onClick={() => choose(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function Preferences() {
  const [preference, setPreference] = useScopedState('look.preferences', {
    style: '미니멀',
    color: '#839aad',
  });
  const [condition, setCondition] = useScopedState('look.conditions', {
    occasion: '일상',
    weather: '선선함',
  });
  const defaultColor = colors.find(
    ([, hex]) => hex.toLowerCase() === preference.color.toLowerCase(),
  )?.[0];
  return (
    <section className="settings-view">
      <Heading title="내 취향">
        다음 코디를 추천할 때 먼저 살펴볼 취향을 골라주세요.
      </Heading>
      <div
        className="settings-swatch"
        style={{ backgroundColor: preference.color }}
        aria-label={'선호 색상 ' + preference.color}
      >
        <span>
          {defaultColor || '직접 고른 색'}
          <small>{preference.color.toUpperCase()}</small>
        </span>
      </div>
      <fieldset className="settings-choices">
        <legend>자주 입고 싶은 색</legend>
        <div className="settings-colors">
          {colors.map(([name, hex]) => (
            <button
              key={hex}
              className="color-pick"
              type="button"
              aria-label={name}
              title={name}
              aria-pressed={
                hex.toLowerCase() === preference.color.toLowerCase()
              }
              style={{ '--swatch': hex } as React.CSSProperties}
              onClick={() => setPreference({ ...preference, color: hex })}
            />
          ))}
          <label className="settings-custom-color">
            직접 선택
            <input
              aria-label="선호 색상 직접 선택"
              type="color"
              value={preference.color}
              onChange={(e) =>
                setPreference({ ...preference, color: e.target.value })
              }
            />
          </label>
        </div>
      </fieldset>
      <Choices
        title="옷을 고르는 스타일"
        options={styles}
        selected={preference.style}
        choose={(style) => setPreference({ ...preference, style })}
      />
      <Choices
        title="자주 입는 상황"
        options={occasions}
        selected={condition.occasion}
        choose={(occasion) => setCondition({ ...condition, occasion })}
      />
      <Choices
        title="기본 날씨 조건"
        options={conditions}
        selected={condition.weather}
        choose={(weather) => setCondition({ ...condition, weather })}
      />
      <p className="settings-hint">선택한 값은 현재 옷장에 바로 저장돼요.</p>
    </section>
  );
}
function Account({ go }: Pick<PageProps, 'go'>) {
  const { mode, setMode, garments, outfits, notify } = useStudio();
  const [name, setName] = useScopedState('display-name', '');
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [mode, name]);
  return (
    <section className="settings-view">
      <Heading title="내 프로필" />
      <div className="settings-identity">
        <span className="settings-monogram" aria-hidden="true">
          {name.trim().slice(0, 1) || (mode === 'sample' ? 'S' : 'W')}
        </span>
        <div>
          <strong>
            {name || (mode === 'sample' ? '샘플 옷장' : '나의 옷장')}
          </strong>
          <p>이 기기의 프로필</p>
        </div>
      </div>
      <form
        className="settings-name"
        onSubmit={(event) => {
          event.preventDefault();
          setName(draft.trim());
          notify('프로필 이름을 저장했어요.');
        }}
      >
        <label htmlFor="profile-name">불리고 싶은 이름</label>
        <div>
          <input
            id="profile-name"
            autoComplete="nickname"
            value={draft}
            maxLength={24}
            placeholder="이름 또는 별명"
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="quiet"
            type="submit"
            disabled={draft.trim() === name}
          >
            저장
          </button>
        </div>
      </form>
      <div className="settings-mode">
        <h2>사용 중인 옷장</h2>
        <div className="settings-segment">
          <button
            aria-pressed={mode === 'sample'}
            onClick={() => setMode('sample')}
          >
            샘플 옷장
          </button>
          <button
            aria-pressed={mode === 'personal'}
            onClick={() => setMode('personal')}
          >
            개인 옷장
          </button>
        </div>
        <p>
          옷 {garments.length}벌 · 저장한 코디 {outfits.length}개
        </p>
      </div>
      <div className="settings-menu">
        <SettingLink
          title="내 취향"
          note="스타일, 선호 색상과 코디 조건"
          open={() => go('preferences')}
        />
        <SettingLink
          title="데이터 관리"
          note="백업, 가져오기와 기기 데이터 삭제"
          open={() => go('data')}
        />
        <SettingLink
          title="계정과 개인정보"
          note="기기 저장 범위와 외부 연결"
          open={() => go('privacy')}
        />
      </div>
    </section>
  );
}
function Privacy() {
  return (
    <section className="settings-view">
      <Heading title="계정과 개인정보" />
      <dl className="settings-privacy">
        <dt>이 기기의 보관함</dt>
        <dd>
          등록한 사진 원본, 미리보기와 코디는 브라우저의 IndexedDB에 저장돼요.
          신체 치수, 모델 참고 사진, 취향과 활동은 이 기기의 현재 옷장에
          보관해요. 사이트 데이터를 지우면 함께 삭제돼요.
        </dd>
        <dt>사진 처리</dt>
        <dd>
          사진의 대표색과 미리보기는 기기에서 계산해요. 의류 인식·AI 모델
          생성·가상 피팅 제공처로 사진을 보내는 단계는 연동 전이에요.
        </dd>
        <dt>날씨와 쇼핑</dt>
        <dd>
          날씨 조회를 누르면 선택한 도시로 서버가 MET Norway에 예보를 요청해요.
          정확한 기기 위치, 옷장 사진, 신체 치수는 요청에 포함되지 않아요. 제휴
          상품 검색에는 직접 입력한 검색어가 사용돼요.
        </dd>
        <dt>계정 연결</dt>
        <dd>
          현재는 기기 프로필을 사용해요. 이메일 로그인, 기기 간 동기화와 구매
          계정 연동은 개발 예정이에요.
        </dd>
      </dl>
    </section>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    name + '-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function scopeKeys(mode: string) {
  const prefix = 'wardrobe.studio.v2.' + mode + '.';
  return Object.keys(localStorage).filter((key) => key.startsWith(prefix));
}
function DataSettings() {
  const {
    mode,
    setMode,
    refresh,
    setSelectedIds,
    setEditLookId,
    setActiveGarmentId,
  } = useStudio();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setConfirm(false);
    setTyped('');
    setStatus('');
    setError('');
  }, [mode]);
  async function run(operation: () => Promise<string>) {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      setStatus(await operation());
    } catch (e) {
      setError(e instanceof Error ? e.message : '기기 저장소를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  async function erase() {
    if (typed !== '삭제') return '';
    const keys = scopeKeys(mode);
    if (mode === 'personal') await clearData();
    for (const key of keys) localStorage.removeItem(key);
    setSelectedIds([]);
    setEditLookId(null);
    setActiveGarmentId(null);
    window.dispatchEvent(new Event('studio-scope-change'));
    await refresh();
    setTyped('');
    setConfirm(false);
    return mode === 'personal'
      ? '이 기기의 개인 옷장을 비웠어요.'
      : '샘플에서 변경한 내용을 초기화했어요.';
  }
  return (
    <section className="settings-view">
      <Heading title="데이터 관리">
        {mode === 'personal' ? '개인 옷장' : '샘플 옷장'}의 저장 내용을
        관리해요.
      </Heading>
      <div className="settings-data-block">
        <h2>옷장 백업</h2>
        <p>
          등록한 옷, 코디, 원본 사진을 JSON으로 보관해요. 원본 사진에는 촬영
          위치 등 메타데이터가 포함될 수 있어요.
        </p>
        {mode === 'personal' ? (
          <>
            <button
              disabled={busy}
              className="action"
              onClick={() =>
                void run(async () => {
                  download(await exportData(), '개인-옷장');
                  return '옷장 백업 파일을 만들었어요.';
                })
              }
            >
              사진과 코디 내보내기
            </button>
            <button
              disabled={busy}
              className="quiet"
              onClick={() => fileInput.current?.click()}
            >
              옷장 백업 가져오기
            </button>
            <input
              ref={fileInput}
              hidden
              aria-label="옷장 백업 파일"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file)
                  void run(async () => {
                    const result = await importWardrobe(file);
                    await refresh();
                    return (
                      '의류 ' +
                      result.addedGarments +
                      '벌과 코디 ' +
                      result.addedOutfits +
                      '개를 추가했어요.'
                    );
                  });
              }}
            />
            <p className="settings-hint">
              기존 의류와 중복 사진은 유지하고 새 항목만 추가해요. 가져오기 최대
              192MB.
            </p>
          </>
        ) : (
          <button
            className="quiet"
            disabled={busy}
            onClick={() => setMode('personal')}
          >
            개인 옷장의 백업 열기
          </button>
        )}
      </div>
      <div className="settings-data-block">
        <h2>활동 기록 내보내기</h2>
        <p>
          현재 옷장의 취향, 모델 설정, 참고 사진과 기기에 저장한 활동을 읽을 수
          있는 JSON 파일로 내려받아요.
        </p>
        <button
          className="quiet"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const records: Record<string, unknown> = Object.create(null);
              const prefix = 'wardrobe.studio.v2.' + mode + '.';
              for (const key of scopeKeys(mode)) {
                const value = localStorage.getItem(key);
                if (value !== null)
                  records[key.slice(prefix.length)] = JSON.parse(value);
              }
              download(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        format: 'wardrobe-activity',
                        version: 1,
                        mode,
                        exportedAt: new Date().toISOString(),
                        records,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                ),
                '옷장-활동-기록',
              );
              return '활동 기록 파일을 만들었어요.';
            })
          }
        >
          활동 기록 내려받기
        </button>
      </div>
      <div className="settings-data-block">
        <h2>
          {mode === 'personal' ? '이 기기의 개인 데이터 삭제' : '샘플 초기화'}
        </h2>
        {!confirm ? (
          <button
            className="settings-danger"
            disabled={busy}
            onClick={() => {
              setConfirm(true);
              setStatus('');
              setError('');
            }}
          >
            {mode === 'personal' ? '삭제 범위 확인' : '초기화 범위 확인'}
          </button>
        ) : (
          <div className="settings-confirm">
            <p>
              {mode === 'personal'
                ? '개인 옷장의 모든 사진·코디·활동과 모델 설정이 이 기기에서 영구 삭제돼요.'
                : '샘플 옷장의 코디 변경, 개인 설정과 체험 기록을 지우고 시작 상태로 돌아가요.'}
            </p>
            <label>
              계속하려면 ‘삭제’를 입력하세요.
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div>
              <button
                className="quiet"
                disabled={busy}
                onClick={() => {
                  setTyped('');
                  setConfirm(false);
                }}
              >
                취소
              </button>
              <button
                className="settings-danger"
                disabled={typed !== '삭제' || busy}
                onClick={() => void run(erase)}
              >
                확인하고 삭제
              </button>
            </div>
          </div>
        )}
      </div>
      <p aria-live="polite" className="settings-feedback">
        {busy ? '처리 중…' : status}
      </p>
      {error && (
        <p role="alert" className="settings-error">
          {error}
        </p>
      )}
    </section>
  );
}
export default function Settings({ page, go }: PageProps) {
  if (page === 'preferences') return <Preferences />;
  if (page === 'privacy') return <Privacy />;
  if (page === 'data') return <DataSettings />;
  return <Account go={go} />;
}
