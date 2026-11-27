import { Control, Field } from './LiquidControls';
import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import './style.css';
import Closet from './Closet';
import Looks from './Looks';
import Atelier from './Atelier';
import Settings from './Settings';
import Home from './Home';
import { BelloAtlas, BelloHeader, useAppearance } from './BelloAtlas';
import './rooms.css';
import './bello.css';
import './liquid.css';
import { RoomNavigation, FeatureIndex } from './RoomNavigation';
import { CommonLens } from './RoomControls';
import { useControlLight } from './LiquidControls';
import Space from './Space';
import Lookbook from './Lookbook';
import { capabilities } from './featureStatus';
import BelloConnections from './BelloConnections';
import { StudioProvider, useStudio, type PageProps } from './studio';
import { Icon, Sheet, haptic } from './presentation';
import {
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
  const [group, setGroup] = useState(0);
  return (
    <div className="directory">
      <FeatureIndex group={group} setGroup={setGroup} go={go} />
      <details className="state-list capability-list">
        <summary>기능별 이용 범위</summary>
        {capabilities.map((c) => (
          <Control key={c.label} onClick={() => go(c.page)}>
            <span>{c.label}</span>
            <small>{c.state}</small>
          </Control>
        ))}
      </details>
      <details className="state-list">
        <summary>입력 및 연결 상태 살펴보기</summary>
        {Object.entries(stateRoutes).map(([p, n]) => (
          <Control key={p} onClick={() => go(p)}>
            {n}
            <Icon name="right" size={14} />
          </Control>
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
        <Control
          className="action"
          onClick={() => {
            setMode('sample');
            go('space');
          }}
        >
          샘플 옷장 둘러보기 <Icon name="arrow" />
        </Control>
        <Control
          className="quiet"
          onClick={() => {
            setMode('personal');
            go('register');
          }}
        >
          내 첫 옷 등록
        </Control>
      </div>
    </section>
  );
}
function App() {
  useAppearance();
  useControlLight();
  const [atlas, setAtlas] = useState(false);
  const { mode, setMode } = useStudio();
  const [page, setPage] = useState(route),
    [modeOpen, showMode] = useState(false);
  const transition = useRef<ViewTransition | null>(null);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => {
      const next = route();
      setPage(next);
      setAtlas(false);
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
    document.title = (titles[page] ?? '나의 공간') + ' · BELLO';
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
        setAtlas(false);
        showMode(false);
      });
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    };
    if (
      document.startViewTransition &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      transition.current = document.startViewTransition(change);
    else change();
    haptic('selection');
  }
  const props = { page, go };
  let content = ['home', 'stylist', 'model', 'fitting'].includes(page) ? (
    <Home
      key={mode + page}
      {...props}
      onMode={() => showMode(true)}
      onAtlas={() => setAtlas(true)}
    />
  ) : page === 'connections' ? (
    <BelloConnections go={go} />
  ) : page === 'lookbook' ? (
    <Lookbook {...props} />
  ) : page === 'space' ? (
    <Space {...props} />
  ) : page === 'tools' ? (
    <h1 className="visually-hidden">전체 메뉴</h1>
  ) : page === 'onboarding' ? (
    <Onboarding go={go} />
  ) : closetPages.includes(page) ? (
    <Closet {...props} />
  ) : lookPages.includes(page) ? (
    <Looks key={mode + ':looks'} {...props} />
  ) : atelierPages.includes(page) ? (
    <Atelier
      key={mode + ':atelier'}
      {...props}
      page={
        page === 'model-study'
          ? 'model'
          : page === 'fitting-board'
            ? 'fitting'
            : page
      }
    />
  ) : ['account', 'preferences', 'data', 'privacy'].includes(page) ? (
    <Settings {...props} />
  ) : (
    <section className="notfound">
      <h1>이 화면을 찾을 수 없어요</h1>
      <Control className="action" onClick={() => go('tools')}>
        전체 메뉴 열기
      </Control>
    </section>
  );
  return (
    <>
      <CommonLens />
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
      {!['home', 'stylist', 'model', 'fitting'].includes(page) && (
        <BelloHeader
          {...props}
          mode={mode}
          onMode={() => showMode(true)}
          onAtlas={() => setAtlas(true)}
        />
      )}
      {!['home', 'model', 'stylist', 'fitting', 'tools'].includes(page) && (
        <RoomNavigation {...props} />
      )}
      <main
        id="main-content"
        tabIndex={-1}
        ref={main}
        className={'page-frame page-' + page}
      >
        {content}
      </main>
      <BelloAtlas
        page={page}
        go={go}
        open={atlas || page === 'tools'}
        close={() => {
          setAtlas(false);
          if (page === 'tools') go('home');
        }}
        indexContent={
          <Directory
            go={(p) => {
              setAtlas(false);
              go(p);
            }}
          />
        }
      />
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
            <Control
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
            </Control>
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
