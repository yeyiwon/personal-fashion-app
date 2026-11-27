import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { CATEGORIES, type Garment, type Outfit } from './domain';
import * as db from './storage';
import { IMAGE_ACCEPT } from './images';
import { GarmentForm } from './GarmentForm';
import { GarmentPhoto, Sheet, Icon, haptic, message } from './presentation';
import cover from './cover.jpg';
import './style.css';

type Mode = 'closet' | 'outfit';
type Panel =
  | 'new'
  | 'import'
  | 'edit'
  | 'options'
  | 'saved'
  | 'erase'
  | 'remove'
  | 'removeOutfit'
  | 'save'
  | 'discard'
  | null;
type Snapshot = { garments: Garment[]; outfits: Outfit[] };
function Textile({ small = false }: { small?: boolean }) {
  return (
    <div
      className={'textileSet ' + (small ? 'smallSet' : '')}
      aria-label="직물로 제작한 옷장 표지"
    >
      <div className="cloth under"></div>
      <div
        className="cloth mainCloth"
        style={{ backgroundImage: 'url(' + cover + ')' }}
      >
        <i className="spine" />
        <span className="clothTag">
          <Icon name="closet" size={25} />
          <b>내 옷장</b>
        </span>
      </div>
    </div>
  );
}
function App() {
  const [{ garments, outfits }, setData] = useState<Snapshot>({
    garments: [],
    outfits: [],
  });
  const [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<Mode>('closet'),
    [panel, panelTo] = useState<Panel>(null);
  const [selected, select] = useState<string | null>(null),
    [ids, setIds] = useState<string[]>([]),
    [savedId, setSavedId] = useState<string>(),
    [name, setName] = useState('');
  const [dirty, setDirty] = useState(false),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('전체'),
    [files, setFiles] = useState<File[]>([]);
  const [notice, tell] = useState(''),
    [error, fail] = useState(''),
    [busy, working] = useState(false),
    [edit, setEdit] = useState<Garment>();
  const version = useRef(0),
    op = useRef(false),
    album = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    pending = useRef<() => void>(() => {});
  const current = garments.find((g) => g.id === selected),
    members = ids
      .map((id) => garments.find((g) => g.id === id))
      .filter((g): g is Garment => !!g);
  const shown = garments.filter(
    (g) =>
      (filter === '전체' || g.category === filter) &&
      g.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const refresh = useCallback(async () => {
    const n = ++version.current;
    try {
      const [g, o] = await Promise.all([db.listGarments(), db.listOutfits()]);
      if (n === version.current) {
        setData({ garments: g, outfits: o });
        select((previous) =>
          g.some((item) => item.id === previous) ? previous : (g[0]?.id ?? null)
        );
        setLoadError('');
        setLoaded(true);
      }
    } catch (e) {
      if (n === version.current) setLoadError(message(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => tell(''), 3500);
    return () => clearTimeout(id);
  }, [notice]);
  function open(p: Panel) {
    fail('');
    panelTo(p);
  }
  function close() {
    if (!op.current) open(null);
  }
  function morph(fn: () => void) {
    haptic('selection');
    if (
      document.startViewTransition &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const tx = document.startViewTransition(() => flushSync(fn));
      tx.ready.catch(() => {});
    } else fn();
  }
  function focusItem(id: string) {
    morph(() => select(id));
    const stage = document.querySelector('.stage');
    if (
      matchMedia('(max-width:640px)').matches &&
      stage &&
      stage.getBoundingClientRect().top < -40
    )
      stage.scrollIntoView({
        block: 'start',
        behavior: matchMedia('(prefers-reduced-motion:reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }
  function switchTo(m: Mode) {
    if (m === mode) return;
    morph(() => {
      setMode(m);
      setFilter('전체');
      setSearch('');
    });
  }
  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setFiles(Array.from(list));
    open('import');
  }
  function changeMembers(next: string[]) {
    if (next.length > 32) {
      tell('코디 한 개에 32벌까지 담을 수 있어요.');
      return;
    }
    setIds(next);
    setDirty(true);
  }
  function toggle(id: string) {
    morph(() =>
      changeMembers(
        ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
      )
    );
  }
  function startOutfit(id: string) {
    morph(() => {
      if (!ids.includes(id)) changeMembers([...ids, id]);
      setMode('outfit');
      setFilter('전체');
      setSearch('');
    });
  }
  function replaceDraft(fn: () => void) {
    if (dirty) {
      pending.current = fn;
      open('discard');
    } else fn();
  }
  function loadOutfit(o: Outfit) {
    replaceDraft(() => {
      morph(() => {
        setMode('outfit');
        setIds(o.garmentIds);
        setSavedId(o.id);
        setName(o.name);
        setDirty(false);
        open(null);
      });
    });
  }
  function newOutfit() {
    replaceDraft(() => {
      morph(() => {
        setIds([]);
        setSavedId(undefined);
        setName('');
        setDirty(false);
        setMode('outfit');
        open(null);
      });
    });
  }
  async function action(fn: () => Promise<void>) {
    if (op.current) return;
    op.current = true;
    working(true);
    fail('');
    try {
      await fn();
    } catch (e) {
      fail(message(e));
    } finally {
      op.current = false;
      working(false);
    }
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    void action(async () => {
      const o = await db.saveOutfit(name, ids, savedId);
      setSavedId(o.id);
      setName(o.name);
      setDirty(false);
      await refresh();
      open(null);
      haptic('success');
      tell('코디를 저장했어요.');
    });
  }
  const isCloset = mode === 'closet',
    tone = (isCloset ? current : members[0])?.color ?? '#997249';
  return (
    <div className="app" style={{ '--tone': tone } as CSSProperties}>
      <header className="mast">
        <div className="identity" aria-label="개인 옷장">
          <span className="seamMark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>개인 옷장</span>
        </div>
        <nav aria-label="작업 공간">
          {(['closet', 'outfit'] as Mode[]).map((m, i) => (
            <button
              key={m}
              aria-current={mode === m ? 'page' : undefined}
              onClick={() => switchTo(m)}
            >
              <Icon name={m === 'closet' ? 'closet' : 'layer'} size={17} />
              {i ? '코디' : '옷장'}
            </button>
          ))}
        </nav>
        <button
          className="icon settings"
          aria-label="데이터 설정"
          onClick={() => open('options')}
        >
          <Icon name="settings" />
        </button>
      </header>
      <main>
        <div className="pageLine">
          <h1>{isCloset ? '내 옷장' : '직접 코디'}</h1>
          <span>
            {isCloset
              ? '등록한 의류 ' + garments.length + '벌'
              : '선택한 의류 ' + ids.length + '벌'}
          </span>
        </div>
        {loadError && (
          <div className="error" role="alert">
            {loadError} <button onClick={refresh}>다시 불러오기</button>
          </div>
        )}
        <div className="workspace">
          <section
            className={
              'stage ' +
              (isCloset ? 'closetStage' : 'outfitStage') +
              (current && isCloset ? ' hasItem' : '')
            }
            aria-label={isCloset ? '선택한 의류' : '코디 조합'}
          >
            <div className="stageLine">
              <span>
                <i className="dot" />
                {isCloset
                  ? current
                    ? current.category
                    : '옷장 표지'
                  : savedId && !dirty
                    ? '저장된 코디'
                    : '코디 작업 중'}
              </span>
              {!isCloset && (
                <button onClick={() => open('saved')}>
                  <Icon name="save" size={16} />
                  저장한 코디 {outfits.length}
                </button>
              )}
            </div>
            {isCloset ? (
              current ? (
                <div className="singleObject" key={current.id}>
                  <GarmentPhoto item={current} shared />
                </div>
              ) : (
                <Textile />
              )
            ) : members.length ? (
              <div
                className={'composition pieces' + Math.min(4, members.length)}
              >
                {members.map((g, i) => (
                  <button
                    key={g.id}
                    aria-label={g.name + ' 코디에서 빼기'}
                    onClick={() => toggle(g.id)}
                  >
                    <GarmentPhoto item={g} shared />
                    <span>{i + 1}</span>
                    <i>
                      <Icon name="close" size={14} />
                    </i>
                  </button>
                ))}
              </div>
            ) : (
              <div className="emptyLayout">
                <span className="pattern one" />
                <span className="pattern two" />
                <Icon name="outfit" size={36} />
                <p>함께 입을 옷을 골라 보세요</p>
              </div>
            )}
            <div
              className={
                'objectPocket ' +
                ((current && isCloset) || (members.length && !isCloset)
                  ? 'expanded'
                  : '')
              }
            >
              <div>
                <h2>
                  {isCloset
                    ? (current?.name ??
                      (garments.length
                        ? '옷을 선택해 주세요'
                        : '첫 옷을 등록하세요'))
                    : name.trim() || '새 코디'}
                </h2>
                <p>
                  {isCloset ? (
                    current ? (
                      <>
                        <i
                          className="swatch"
                          style={{ background: current.color }}
                        />
                        {current.condition}
                        {current.price !== null
                          ? ' · ' + current.price.toLocaleString('ko-KR') + '원'
                          : ''}
                      </>
                    ) : garments.length ? (
                      '목록에서 옷을 눌러 자세히 볼 수 있어요.'
                    ) : (
                      '찍거나 앨범에서 골라 옷장에 보관해요.'
                    )
                  ) : members.length ? (
                    '조합 위의 옷을 누르면 뺄 수 있어요.'
                  ) : (
                    '등록한 의류로 나만의 조합을 만들어요.'
                  )}
                </p>
              </div>
              <div className="pocketBtns">
                {isCloset && current ? (
                  <>
                    <button
                      className="quietIcon"
                      aria-label="의류 정보 수정"
                      onClick={() => {
                        setEdit(current);
                        open('edit');
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      className="primary"
                      onClick={() => startOutfit(current.id)}
                    >
                      <Icon name="layer" />
                      코디에 담기
                    </button>
                  </>
                ) : isCloset ? (
                  <button className="primary" onClick={() => open('new')}>
                    <Icon name="plus" />옷 등록
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={!members.length}
                    onClick={() => open('save')}
                  >
                    <Icon name="save" />
                    {savedId && dirty ? '변경 저장' : '코디 저장'}
                  </button>
                )}
              </div>
            </div>
          </section>
          <section className="inventory" aria-label="의류 목록">
            <div className="listHeading">
              <div>
                <h2>{isCloset ? '등록한 의류' : '옷장에서 고르기'}</h2>
                <p>
                  {isCloset
                    ? '내가 보관한 사진과 의류 정보'
                    : '함께 입을 옷을 한 벌씩 선택하세요.'}
                </p>
              </div>
              <button
                className="addSmall"
                aria-label="옷 추가 등록"
                onClick={() => open('new')}
              >
                <Icon name="plus" />
              </button>
            </div>
            {garments.length > 0 ? (
              <>
                <label className="search">
                  <Icon name="search" size={18} />
                  <input
                    aria-label="의류 검색"
                    placeholder="의류 이름 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="filter" aria-label="분류 필터">
                  {[
                    '전체',
                    ...CATEGORIES.filter((c) =>
                      garments.some((g) => g.category === c)
                    ),
                  ].map((c) => (
                    <button
                      key={c}
                      aria-pressed={filter === c}
                      onClick={() => setFilter(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="shelf">
                  {shown.map((g) => {
                    const marked = isCloset
                      ? g.id === selected
                      : ids.includes(g.id);
                    return (
                      <button
                        className={'piece ' + (marked ? 'chosen' : '')}
                        key={g.id}
                        aria-pressed={marked}
                        aria-label={g.name}
                        onClick={() =>
                          isCloset ? focusItem(g.id) : toggle(g.id)
                        }
                      >
                        <div className="thumb">
                          <GarmentPhoto item={g} />
                          {marked && (
                            <i>
                              <Icon name="check" size={14} />
                            </i>
                          )}
                        </div>
                        <div className="pieceTitle">
                          <i
                            className="swatch"
                            style={{ background: g.color }}
                          />
                          {g.name}
                        </div>
                        <small>{g.category}</small>
                      </button>
                    );
                  })}
                </div>
                {!shown.length && (
                  <p className="emptyState">
                    조건에 맞는 의류가 없어요.{' '}
                    <button
                      className="textBtn"
                      onClick={() => {
                        setFilter('전체');
                        setSearch('');
                      }}
                    >
                      필터 초기화
                    </button>
                  </p>
                )}
              </>
            ) : (
              <div className="emptyInventory">
                <Icon name="closet" size={32} />
                <div>
                  <b>
                    {loaded ? '아직 등록한 옷이 없어요' : '옷장을 열고 있어요'}
                  </b>
                  <p>등록한 사진은 이 기기에 저장돼요.</p>
                </div>
              </div>
            )}
            {isCloset && current && (
              <button
                className="textBtn deleteLink"
                onClick={() => open('remove')}
              >
                이 의류 삭제
              </button>
            )}
            {!isCloset && (
              <div className="outfitTools">
                <button className="plain" onClick={newOutfit}>
                  <Icon name="plus" size={16} />새 코디
                </button>
                {savedId && (
                  <button
                    className="textBtn"
                    onClick={() => open('removeOutfit')}
                  >
                    저장한 코디 삭제
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <input
        className="visuallyHidden"
        ref={album}
        tabIndex={-1}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        aria-label="앨범 사진 파일"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        className="visuallyHidden"
        ref={camera}
        tabIndex={-1}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="카메라 촬영 파일"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {panel === 'new' && (
        <Sheet title="옷 등록" onClose={close}>
          <p className="hint">
            한 장에 한 벌씩 등록하세요. 앨범에서는 여러 장을 고를 수 있어요.
          </p>
          <div className="pickers">
            <button onClick={() => album.current?.click()}>
              <Icon name="photo" />
              앨범에서 선택
              <Icon name="right" />
            </button>
            <button onClick={() => camera.current?.click()}>
              <Icon name="camera" />
              사진 촬영
              <Icon name="right" />
            </button>
          </div>
          <p className="small">
            JPG · PNG · WebP / 장당 최대 16MB · 3,200만 화소
          </p>
        </Sheet>
      )}
      {(panel === 'import' || panel === 'edit') && (
        <GarmentForm
          files={files}
          edit={panel === 'edit' ? edit : undefined}
          onClose={close}
          onSaved={(g) => {
            select(g.id);
            setFilter('전체');
            setSearch('');
            void refresh();
            tell('의류를 저장했어요.');
            haptic('success');
          }}
        />
      )}
      {panel === 'save' && (
        <Sheet title="코디 저장" onClose={close}>
          <form onSubmit={save}>
            <label>
              코디 이름
              <input
                value={name}
                required
                autoFocus
                maxLength={80}
                placeholder="예: 주말 산책"
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <p className="small">{members.map((g) => g.name).join(' · ')}</p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy || !name.trim()}>
              {busy ? '저장 중' : '저장하기'}
            </button>
          </form>
        </Sheet>
      )}
      {panel === 'saved' && (
        <Sheet title="저장한 코디" onClose={close}>
          {outfits.length ? (
            outfits.map((o) => (
              <button
                key={o.id}
                className="savedRow"
                onClick={() => loadOutfit(o)}
              >
                <div className="miniLook">
                  {o.garmentIds.slice(0, 3).map((id) => {
                    const g = garments.find((i) => i.id === id);
                    return g ? <GarmentPhoto item={g} key={id} /> : null;
                  })}
                </div>
                <span>
                  <b>{o.name}</b>
                  <small>{o.garmentIds.length}벌</small>
                </span>
                <Icon name="right" />
              </button>
            ))
          ) : (
            <p className="hint">
              아직 저장한 코디가 없어요. 옷을 골라 이름을 붙여 저장해 주세요.
            </p>
          )}
        </Sheet>
      )}
      {panel === 'options' && (
        <Sheet title="데이터 설정" onClose={close}>
          <h3>이 기기의 옷장</h3>
          <p className="hint">
            사진과 코디는 현재 브라우저 또는 앱에 저장돼요. 다른 기기와
            동기화되지 않으며, 앱이나 사이트 데이터를 지우면 함께 삭제돼요.
          </p>
          <div className="pickers">
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const blob = await db.exportData();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download =
                    '내-옷장-' +
                    new Date().toISOString().slice(0, 10) +
                    '.json';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                })
              }
            >
              사진과 데이터 내보내기
              <Icon name="right" />
            </button>
            <button onClick={() => open('erase')}>
              이 기기의 데이터 삭제
              <Icon name="right" />
            </button>
          </div>
          <p className="small">
            표지 직물 · 이캇 머릿수건, 19세기 인도네시아. The Metropolitan
            Museum of Art, 55.111.66a. 공개 소장 이미지.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Sheet>
      )}
      {panel === 'discard' && (
        <Sheet title="작성 중인 코디를 닫을까요?" onClose={close}>
          <p className="hint">저장 후 변경한 조합과 이름은 사라져요.</p>
          <div className="actions">
            <button className="plain" onClick={close}>
              계속 편집
            </button>
            <button className="primary" onClick={() => pending.current()}>
              작업 전환
            </button>
          </div>
        </Sheet>
      )}
      {(panel === 'erase' ||
        panel === 'remove' ||
        panel === 'removeOutfit') && (
        <Sheet
          title={
            panel === 'erase'
              ? '모든 사진과 코디를 삭제할까요?'
              : panel === 'remove'
                ? '이 의류를 삭제할까요?'
                : '이 코디를 삭제할까요?'
          }
          onClose={close}
        >
          <p className="hint">
            {panel === 'erase'
              ? '이 기기의 옷장 전체가 삭제돼요. 되돌릴 수 없어요.'
              : panel === 'remove'
                ? (current?.name ?? '') + '의 원본 사진과 정보가 삭제돼요.'
                : '코디 조합만 삭제되고 옷장에 등록한 의류는 보관돼요.'}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="plain" disabled={busy} onClick={close}>
              취소
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  if (panel === 'erase') {
                    await db.clearData();
                    setIds([]);
                    setSavedId(undefined);
                    setName('');
                    select(null);
                    setDirty(false);
                    setMode('closet');
                  } else if (panel === 'remove' && current) {
                    await db.deleteGarment(current.id);
                    setIds(ids.filter((x) => x !== current.id));
                    select(null);
                  } else if (savedId) {
                    await db.deleteOutfit(savedId);
                    setSavedId(undefined);
                    setName('');
                    setIds([]);
                    setDirty(false);
                  }
                  await refresh();
                  open(null);
                  tell('삭제했어요.');
                })
              }
            >
              삭제하기
            </button>
          </div>
        </Sheet>
      )}
      <div className={'toast ' + (notice ? 'on' : '')} role="status">
        {notice}
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
