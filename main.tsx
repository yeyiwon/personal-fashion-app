import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import './style.css';
import Closet from './Closet';
import Looks from './Looks';
import Atelier from './Atelier';
import Settings from './Settings';
import Home from './Home';
import { RoomDock, RoomHeader } from './RoomControls';
import './rooms.css';
import Space from './Space';
import Lookbook from './Lookbook';
import { capabilities } from './featureStatus';
import { providerDirectory } from './provider-contracts';
import { StudioProvider, useStudio, type PageProps } from './studio';
import { Icon, Sheet, haptic } from './presentation';
import {
  sections,
  titles,
  stateRoutes,
  closetPages,
  lookPages,
  atelierPages,
} from './routes';
function route() {
  return location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
}
function Directory({ go }: Pick<PageProps, 'go'>) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('ko');
  const visible = sections
    .map((s) => ({
      ...s,
      items: Object.entries(s.pages).filter(
        ([, v]) => v.toLowerCase().includes(q) || s.title.includes(q),
      ),
    }))
    .filter((s) => s.items.length);
  return (
    <div className="directory">
      <h1>전체 메뉴</h1>
      <label className="menu-search">
        <Icon name="search" size={18} />
        <input
          placeholder="기능 찾기"
          aria-label="기능 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="directory-groups">
        {visible.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.items.map(([p, n]) => (
              <a
                key={p}
                href={'#/' + p}
                onClick={(e) => {
                  e.preventDefault();
                  go(p);
                }}
              >
                {n}
                <Icon name="right" size={15} />
              </a>
            ))}
          </section>
        ))}
      </div>
      {!visible.length && <p>일치하는 메뉴가 없어요.</p>}
      <details className="state-list capability-list">
        <summary>기능별 이용 범위</summary>
        {capabilities.map((c) => (
          <button key={c.label} onClick={() => go(c.page)}>
            <span>{c.label}</span>
            <small>{c.state}</small>
          </button>
        ))}
      </details>
      <details className="state-list">
        <summary>입력 및 연결 상태 살펴보기</summary>
        {Object.entries(stateRoutes).map(([p, n]) => (
          <button key={p} onClick={() => go(p)}>
            {n}
            <Icon name="right" size={14} />
          </button>
        ))}
      </details>
    </div>
  );
}
function Onboarding({ go }: Pick<PageProps, 'go'>) {
  const { setMode } = useStudio();
  return (
    <section className="welcome">
      <img src="/media/editorial/cover.webp" alt="트렌치와 와인 드레스 착장" />
      <div>
        <h1>
          내 옷으로 시작하는
          <br />
          패션 스튜디오
        </h1>
        <p>
          샘플 21벌로 룩을 만들어 보거나, 사진을 등록해 나만의 옷장을 열어
          보세요.
        </p>
        <button
          className="action"
          onClick={() => {
            setMode('sample');
            go('space');
          }}
        >
          샘플 옷장 둘러보기 <Icon name="arrow" />
        </button>
        <button
          className="quiet"
          onClick={() => {
            setMode('personal');
            go('register');
          }}
        >
          내 첫 옷 등록
        </button>
      </div>
    </section>
  );
}
function App() {
  const { mode, setMode } = useStudio();
  const [page, setPage] = useState(route),
    [modeOpen, showMode] = useState(false);
  const transition = useRef<ViewTransition | null>(null);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => {
      const next = route();
      setPage(next);
      showMode(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  useEffect(() => {
    document.title = (titles[page] ?? '페이지') + ' · Wardrobe';
  }, [page]);
  function go(next: string) {
    if (next === page) {
      window.scrollTo({ top: 0 });
      return;
    }
    transition.current?.skipTransition();
    const change = () => {
      history.pushState({ wardrobe: true }, '', '#/' + next);
      flushSync(() => {
        setPage(next);
        showMode(false);
      });
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    };
    const objectTransition =
      [
        'home',
        'closet',
        'garment',
        'direct',
        'space',
        'fitting',
        'model',
      ].includes(next) &&
      [
        'home',
        'closet',
        'garment',
        'direct',
        'space',
        'fitting',
        'model',
      ].includes(page);
    if (
      document.startViewTransition &&
      objectTransition &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      transition.current = document.startViewTransition(change);
    else change();
    haptic('selection');
  }
  const props = { page, go };
  let content =
    page === 'home' ? (
      <Home {...props} />
    ) : page === 'connections' ? (
      <section className="connections">
        <h1>외부 서비스 연결</h1>
        <p>
          현재 옷장에서 할 수 있는 일과 실제 서비스 연결에 필요한 권한을
          확인하세요.
        </p>
        <div>
          {Object.values(providerDirectory).map((provider) => (
            <details key={provider.name}>
              <summary>
                <b>{provider.name}</b>
                <small>외부 API 연동 필요</small>
              </summary>
              <dl>
                <dt>필요한 권한</dt>
                <dd>{provider.requires}</dd>
                <dt>현재 이용 가능</dt>
                <dd>{provider.local}</dd>
              </dl>
              <button className="quiet" onClick={() => go(provider.page)}>
                기능 열기 <Icon name="arrow" size={15} />
              </button>
            </details>
          ))}
        </div>
      </section>
    ) : page === 'lookbook' ? (
      <Lookbook {...props} />
    ) : page === 'space' ? (
      <Space {...props} />
    ) : page === 'tools' ? (
      <Directory go={go} />
    ) : page === 'onboarding' ? (
      <Onboarding go={go} />
    ) : closetPages.includes(page) ? (
      <Closet {...props} />
    ) : lookPages.includes(page) ? (
      <Looks key={mode + ':looks'} {...props} />
    ) : atelierPages.includes(page) ? (
      <Atelier key={mode + ':atelier'} {...props} />
    ) : ['account', 'preferences', 'data', 'privacy'].includes(page) ? (
      <Settings {...props} />
    ) : (
      <section className="notfound">
        <h1>이 화면을 찾을 수 없어요</h1>
        <button className="action" onClick={() => go('tools')}>
          전체 메뉴 열기
        </button>
      </section>
    );
  return (
    <>
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        본문으로 건너뛰기
      </a>
      <RoomHeader
        page={page}
        go={go}
        mode={mode}
        onMode={() => showMode(true)}
        back={() => {
          if (history.state?.wardrobe) history.back();
          else go('home');
        }}
      />
      <main
        id="main-content"
        tabIndex={-1}
        ref={main}
        className={'page-frame page-' + page}
      >
        {content}
      </main>
      <RoomDock page={page} go={go} />
      {modeOpen && (
        <Sheet title="사용할 옷장" onClose={() => showMode(false)}>
          {(
            [
              [
                'sample',
                '샘플 옷장',
                '준비된 의류 21벌과 다섯 가지 착장을 체험해요.',
              ],
              [
                'personal',
                '개인 옷장',
                '이 기기에 등록한 의류와 저장한 코디를 사용해요.',
              ],
            ] as const
          ).map(([v, n, s]) => (
            <button
              className="mode-choice"
              key={v}
              onClick={() => {
                setMode(v);
                showMode(false);
              }}
              aria-pressed={v === mode}
            >
              <span>
                <strong>{n}</strong>
                <small>{s}</small>
              </span>
              {v === mode ? (
                <Icon name="check" />
              ) : (
                <Icon name="right" size={16} />
              )}
            </button>
          ))}
        </Sheet>
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <StudioProvider>
    <App />
  </StudioProvider>,
);
