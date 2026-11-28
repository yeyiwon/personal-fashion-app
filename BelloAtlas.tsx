import { Control, Field, Segment } from './LiquidControls';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './presentation';
import { SpaceFold } from './SpaceFold';
import './atlas-fold.css';
import { GlassSurface } from './RoomControls';
import type { ReactNode } from 'react';
import { titles } from './routes';
import { spaceFor } from './RoomNavigation';
import type { PageProps } from './studio';
export const atlasRooms = [
  ['closet', '옷장', 'closet'],
  ['ai', '스타일링', 'layer'],
  ['fitting', '피팅룸', 'fit'],
  ['shop', '쇼핑', 'shop'],
  ['lookbook', '기록', 'save'],
  ['account', '설정', 'settings'],
] as const;
export function BelloMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 27.5c.7-6 2.7-13.1 6.4-18.6C17 5.3 20.3 5 21.9 7c2.9 3.9-3.1 12.5-7.4 14.3 5.1-1.8 13.7-2.8 15.7.6 2.2 3.7-2.9 8.6-9.8 10.3C11.9 34.2 7.3 32.6 8 27.5Z"
        stroke="currentColor"
        strokeWidth="2.8"
      />
      <path
        d="M13 27c4.3-5.2 8.6-9 14.6-11.6 2.4-1.1 4.6-.7 5.1.8 1.2 3.3-3.4 6.2-6.8 7.8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
/** Sculpted room objects from the earlier orbit menu; kept for reuse. */
export function Relic({ i }: { i: number }) {
  const uid = useId().replace(/[^a-z0-9]/gi, ''),
    fill = 'url(#op' + uid + ')',
    hollow = 'url(#h' + uid + ')';
  return (
    <svg className="atlas-relic" viewBox="0 0 96 76" aria-hidden="true">
      <defs>
        <linearGradient
          id={'op' + uid}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="var(--bello-optical)" />
          <stop offset=".32" stopColor="var(--bello-silver)" />
          <stop offset=".51" stopColor="var(--bello-hologram)" />
          <stop offset=".73" stopColor="var(--bello-lavender)" />
          <stop offset="1" stopColor="var(--bello-slate)" />
        </linearGradient>
        <linearGradient id={'h' + uid}>
          <stop stopColor="var(--bello-slate)" />
          <stop offset=".43" stopColor="var(--bello-silver)" />
          <stop offset=".62" stopColor="var(--bello-optical)" />
          <stop offset=".92" stopColor="var(--bello-lavender)" />
        </linearGradient>
      </defs>
      <g
        stroke="var(--bello-slate)"
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill={fill}
      >
        {i === 0 ? (
          <>
            <path d="M12 59V24Q12 20 16 19L62 9L84 19V56l-47 12z" fill="none" />
            <path d="M15 24 61 14 79 20 35 32Z" />
            <path d="m28 30 8-2 3 4 7 3-2 10-4-1 1 12-16 4 1-14-4 3-2-8 6-7Z" />
            <path d="m50 26 8-2 3 4 7 3-2 10-4-1 1 12-16 4 1-14-4 3-2-8 6-7Z" />
          </>
        ) : i === 1 ? (
          <>
            {[0, 1, 2].map((x) => (
              <path
                key={x}
                transform={'translate(0,' + -10 * x + ')'}
                d="m11 48 37-14 35 13-34 17z"
                fill={x === 1 ? hollow : fill}
              />
            ))}
            <path d="m37 34 11-5 11 4-10 5Z" fill="var(--bello-optical)" />
          </>
        ) : i === 2 ? (
          <>
            <ellipse cx="48" cy="66" rx="25" ry="5" />
            <path d="M30 59V22Q31 13 39 10l19-4q10-2 10 10v38q0 7-8 9l-22 5q-8 1-8-9Z" />
            <path
              d="M36 56V22q0-6 6-8l16-3q5-1 5 5v37q0 4-5 6l-17 4q-5 1-5-7Z"
              fill={hollow}
            />
            <path
              d="m43 40 13-17m-11 23 12-14"
              fill="none"
              stroke="var(--bello-optical)"
            />
          </>
        ) : i === 3 ? (
          <>
            <path d="m21 31 34-9 16 8 6 30-39 8-18-9Z" />
            <path d="m21 31 16 8 34-9m-34 9 1 29" fill="none" />
            <path
              d="M32 33v-9c0-17 21-20 21-5v9m-11 8v-9c0-17 21-20 21-5v9"
              fill="none"
              strokeWidth="3"
            />
          </>
        ) : i === 4 ? (
          <>
            {[0, 1, 2].map((x) => (
              <g key={x} transform={'translate(' + x * 6 + ',' + x * -3 + ')'}>
                <path d="M17 22 53 13l10 6-1 41-36 8-9-5Z" />
                <path d="m26 30 29-7v25l-29 7Z" fill={hollow} />
              </g>
            ))}
          </>
        ) : (
          <>
            {[0, 55, 110].map((a) => (
              <ellipse
                key={a}
                cx="48"
                cy="38"
                rx="29"
                ry="11"
                stroke={hollow}
                strokeWidth="5.5"
                fill="none"
                transform={'rotate(' + a + ' 48 38)'}
              />
            ))}
            <circle cx="48" cy="38" r="6" />
          </>
        )}
      </g>
    </svg>
  );
}
export function BelloAtlas({
  page,
  go,
  open,
  close,
  indexContent,
}: { open: boolean; close: () => void; indexContent: ReactNode } & PageProps) {
  const [query, setQuery] = useState(''),
    [index, setIndex] = useState(false);
  const element = useRef<HTMLDialogElement>(null),
    last = useRef<HTMLElement | null>(null),
    search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dialog = element.current;
    if (!dialog) return;
    if (open) {
      last.current = document.activeElement as HTMLElement;
      setQuery('');
      setIndex(false);
      const box = last.current?.getBoundingClientRect();
      dialog.showModal();
      if (
        box &&
        last.current !== document.body &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const clip =
          'inset(' +
          Math.max(0, box.top) +
          'px ' +
          Math.max(0, innerWidth - box.right) +
          'px ' +
          Math.max(0, innerHeight - box.bottom) +
          'px ' +
          Math.max(0, box.left) +
          'px round ' +
          Math.max(16, box.height * 0.45) +
          'px)';
        dialog.animate(
          [
            { clipPath: clip },
            { clipPath: 'inset(0px 0px 0px 0px round 0px)' },
          ],
          { duration: 440, easing: 'cubic-bezier(.19,.8,.22,1)' },
        );
      }
    } else {
      dialog.close();
      if (last.current?.isConnected)
        last.current.focus({ preventScroll: true });
    }
  }, [open]);
  function travel(p: string) {
    if (p === page && page !== 'tools') {
      close();
      return;
    }
    go(p);
    if (page !== 'tools') close();
  }
  const matches = Object.entries(titles).filter(([, v]) =>
    v.includes(query.trim()),
  );
  const browsing = !query.trim() && !index;
  return (
    <dialog
      ref={element}
      className="bello-atlas fold-atlas"
      aria-label="공간 이동"
      onClick={(e) => e.target === e.currentTarget && close()}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="atlas-inner">
        <header>
          <div className="atlas-brand">
            <BelloMark /> BELLO
          </div>
          <Control aria-label="공간 닫기" onClick={close}>
            <Icon name="close" />
          </Control>
        </header>
        <div className="atlas-heading">
          <h2>공간 이동</h2>
          <div className="atlas-search">
            <Icon name="search" size={16} />
            <Field
              ref={search}
              type="search"
              aria-label="전체 기능 검색"
              placeholder="기능 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {query.trim() ? (
          <div className="atlas-results">
            {matches.length ? (
              matches.map(([p, t]) => (
                <Control
                  key={p}
                  onClick={() =>
                    p === 'tools' ? (setQuery(''), setIndex(true)) : travel(p)
                  }
                >
                  {t}
                  <Icon name="right" size={15} />
                </Control>
              ))
            ) : (
              <p>일치하는 기능이 없어요.</p>
            )}
          </div>
        ) : index ? (
          <div className="atlas-index">{indexContent}</div>
        ) : (
          <SpaceFold key={String(open)} page={page} go={travel} />
        )}
        <footer>
          <Control
            onClick={() => {
              setQuery('');
              setIndex(browsing);
            }}
          >
            <Icon name={browsing ? 'grid' : 'layer'} size={15} />
            {browsing ? '전체 기능 색인' : '공간으로 돌아가기'}
          </Control>
          <Control onClick={() => travel('home')}>
            <Icon name="home" size={15} />
            나의 공간
          </Control>
        </footer>
      </div>
    </dialog>
  );
}
export function ThemeChoice() {
  const [value, set] = useState(() => {
    try {
      return localStorage.getItem('bello.appearance') || 'system';
    } catch {
      return 'system';
    }
  });
  return (
    <Segment
      className="bello-theme-control"
      role="group"
      aria-label="화면 테마"
    >
      {[
        ['system', '기기 설정'],
        ['light', '라이트'],
        ['dark', '다크'],
      ].map(([k, n]) => (
        <Control
          key={k}
          aria-pressed={value === k}
          onClick={() => {
            set(k);
            try {
              localStorage.setItem('bello.appearance', k);
            } catch {}
            window.dispatchEvent(new Event('bello-theme'));
          }}
        >
          {n}
        </Control>
      ))}
    </Segment>
  );
}
export function useAppearance() {
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme:dark)');
    function sync() {
      let source = 'system';
      try {
        source = localStorage.getItem('bello.appearance') || source;
      } catch {}
      const v =
        source === 'system' ? (media.matches ? 'dark' : 'light') : source;
      document.documentElement.dataset.theme = v;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', v === 'dark' ? '#101520' : '#F4F7FC');
    }
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('bello-theme', sync);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('bello-theme', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
}
export function BelloHeader({
  page,
  go,
  onAtlas,
  onMode,
  mode,
}: { onAtlas: () => void; onMode: () => void; mode: string } & PageProps) {
  const room = spaceFor(page),
    label = atlasRooms[room][1];
  return (
    <header className="bello-header space-mast">
      <div>
        <Control
          className="atlas-trigger"
          aria-label="공간 이동"
          aria-haspopup="dialog"
          onClick={(e) => {
            e.currentTarget.focus({ preventScroll: true });
            onAtlas();
          }}
        >
          <GlassSurface />
          <BelloMark size={22} />
          <span>BELLO</span>
          <i />
          <Icon name={atlasRooms[room][2]} size={17} />
          <small>{label}</small>
        </Control>
        <Control
          className="header-back"
          aria-label="이전 화면"
          onClick={() => {
            if (history.state?.wardrobe) history.back();
            else go('home');
          }}
        >
          <Icon name="back" size={17} />
        </Control>
        <Control
          className="header-home"
          aria-label="드레스룸으로 돌아가기"
          onClick={() => go('home')}
        >
          <Icon name="home" size={17} />
        </Control>
        <Control className="mode-pin" onClick={onMode}>
          {mode === 'sample' ? '샘플 옷장' : '개인 옷장'}{' '}
          <Icon name="down" size={12} />
        </Control>
      </div>
    </header>
  );
}
