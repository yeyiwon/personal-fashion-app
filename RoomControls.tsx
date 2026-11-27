import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './presentation';
import { titles } from './routes';
import { type PageProps } from './studio';

export function ThreadMark({ size = 29 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        d="M4 31.5 13.5 8c2.5-6 11-3 8.6 3.4l-7 18c-2 5.6-10 3.4-7.6-2.7L15 9.4m3.7 21.1 8.9-23c2.1-5.3 10.4-2.9 8 3.5l-8.9 22"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Encode a rounded lens' surface normals once. Displacement bends pixels toward the rim,
// while the content and its accessible labels remain on a separate, undistorted layer.
function curvature(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  const px = ctx.createImageData(w, h),
    radius = Math.min(h / 2, 29),
    band = Math.min(11, h * 0.21);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - w / 2,
        dy = y + 0.5 - h / 2;
      const qx = Math.max(0, Math.abs(dx) - w / 2 + radius),
        qy = Math.max(0, Math.abs(dy) - h / 2 + radius);
      const len = Math.hypot(qx, qy),
        depth = radius - len;
      const bend =
        depth >= 0 && depth < band ? Math.pow(1 - depth / band, 1.5) : 0;
      const i = (y * w + x) * 4;
      px.data[i] = 128 + 120 * bend * (len ? qx / len : 0) * Math.sign(dx);
      px.data[i + 1] = 128 + 120 * bend * (len ? qy / len : 0) * Math.sign(dy);
      px.data[i + 2] = 128;
      px.data[i + 3] = 255;
    }
  ctx.putImageData(px, 0, 0);
  return cv.toDataURL();
}
export function GlassSurface({ morph }: { morph?: boolean } = {}) {
  const id = 'lens' + useId().replace(/[^a-z0-9]/gi, '');
  const ref = useRef<HTMLSpanElement>(null);
  const [map, setMap] = useState('');
  const silhouette = useRef<SVGPathElement>(null),
    spring = useRef({ at: 0, speed: 0 });
  useEffect(() => {
    if (morph === undefined) return;
    const target = morph ? 1 : 0,
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0,
      last = performance.now();
    function draw(time: number) {
      const dt = Math.min((time - last) / 1000, 0.025);
      last = time;
      const s = spring.current;
      if (reduced) {
        s.at = target;
        s.speed = 0;
      } else {
        s.speed += ((target - s.at) * 270 - s.speed * 26) * dt;
        s.at += s.speed * dt;
      }
      const t = s.at,
        rx = 0.105 - 0.036 * t,
        ry = 0.47 - 0.332 * t,
        neck = 0.088 * (1 - t),
        lip = 0.06 * (1 - t);
      const path =
        'M ' +
        rx +
        ' 0 C .21 0 .39 0 .48 ' +
        neck +
        ' C .53 ' +
        (neck + lip) +
        ' .57 0 .66 0 H ' +
        (1 - rx) +
        ' Q 1 0 1 ' +
        ry +
        ' V ' +
        (1 - ry) +
        ' Q 1 1 ' +
        (1 - rx) +
        ' 1 H .66 C .57 1 .53 ' +
        (1 - neck - lip) +
        ' .48 ' +
        (1 - neck) +
        ' C .39 1 .21 1 ' +
        rx +
        ' 1 Q 0 1 0 ' +
        (1 - ry) +
        ' V ' +
        ry +
        ' Q 0 0 ' +
        rx +
        ' 0 Z';
      silhouette.current?.setAttribute('d', path);
      if (Math.abs(s.at - target) > 0.0008 || Math.abs(s.speed) > 0.005)
        frame = requestAnimationFrame(draw);
    }
    draw(last);
    return () => cancelAnimationFrame(frame);
  }, [morph]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    function resize() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (el) {
          const b = el.getBoundingClientRect();
          setMap(
            curvature(
              Math.min(360, Math.max(1, Math.round(b.width))),
              Math.min(220, Math.max(1, Math.round(b.height))),
            ),
          );
        }
      }, 100);
    }
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    resize();
    return () => {
      obs.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return (
    <span
      aria-hidden="true"
      className="glass-skin"
      ref={ref}
      style={
        {
          clipPath: morph !== undefined ? 'url(#' + id + '-cut)' : undefined,
          '--optics': map ? 'url(#' + id + ')' : 'blur(5px)',
        } as CSSProperties
      }
    >
      <svg width="0" height="0" focusable="false">
        {morph !== undefined && (
          <defs>
            <clipPath id={id + '-cut'} clipPathUnits="objectBoundingBox">
              <path ref={silhouette} />
            </clipPath>
          </defs>
        )}
        {map && (
          <defs>
            <filter
              id={id}
              x="0"
              y="0"
              width="100%"
              height="100%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={map}
                x="0"
                y="0"
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                result="normal"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="normal"
                scale="17"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        )}
      </svg>
    </span>
  );
}

const rooms = [
  ['home', '홈', 'home'],
  ['closet', '내 옷장', 'closet'],
  ['ai', '코디', 'layer'],
  ['model', '개인 모델', 'model'],
  ['shop', '쇼핑', 'shop'],
  ['tools', '전체 메뉴', 'grid'],
];
const tasks: Record<string, [string, string, string]> = {
  home: ['stylist', '스타일리스트', 'studio'],
  closet: ['camera', '촬영', 'camera'],
  model: ['fitting', '피팅룸', 'fit'],
  space: ['register', '옷 등록', 'plus'],
  direct: ['saved', '저장 코디', 'save'],
  ai: ['direct', '직접 코디', 'outfit'],
  shop: ['wishlist', '관심 상품', 'save'],
};
export function RoomDock({ page, go }: PageProps) {
  const [open, setOpen] = useState(false);
  const dock = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [page]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!dock.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const task = tasks[page] ?? ['home', '홈', 'home'];
  const choice = (p: string) => {
    setOpen(false);
    go(p);
  };
  return (
    <nav
      className={'room-dock' + (open ? ' is-open' : '')}
      aria-label="공간과 작업"
      ref={dock}
      onBlur={(e) => {
        if (
          e.relatedTarget &&
          !e.currentTarget.contains(e.relatedTarget as Node)
        )
          setOpen(false);
      }}
      onPointerMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty(
          '--touch',
          (100 * (e.clientX - b.left)) / b.width + '%',
        );
      }}
    >
      <GlassSurface morph={open} />
      <div className="dock-fold" inert={!open}>
        <div>
          <div className="dock-rooms" id="room-links">
            {rooms.map(([p, label, ic]) => (
              <a
                key={p}
                href={'#/' + p}
                aria-current={page === p ? 'page' : undefined}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    choice(p);
                  }
                }}
              >
                <Icon name={ic} />
                <span>{label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="dock-line">
        <button
          ref={trigger}
          aria-expanded={open}
          aria-controls="room-links"
          onClick={() => setOpen(!open)}
        >
          <i className="dock-rosette">
            <ThreadMark size={24} />
          </i>
          <span>{open ? '공간 닫기' : '공간 이동'}</span>
          <Icon name="down" size={13} />
        </button>
        <button className="dock-context" onClick={() => choice(task[0])}>
          <Icon name={task[2]} size={16} />
          {task[1]}
        </button>
      </div>
    </nav>
  );
}
export function RoomHeader({
  page,
  go,
  mode,
  onMode,
  back,
}: {
  page: string;
  go: PageProps['go'];
  mode: string;
  onMode: () => void;
  back: () => void;
}) {
  const hero = ['home', 'closet', 'model'].includes(page);
  return (
    <header
      className={'room-header ' + (hero ? 'hero-header' : 'utility-header')}
    >
      <div className="room-head-inner">
        {hero ? (
          <a
            href="#/home"
            aria-label="Wardrobe 홈"
            className="room-word"
            onClick={(e) => {
              e.preventDefault();
              go('home');
            }}
          >
            <ThreadMark />
            <span>Wardrobe</span>
          </a>
        ) : (
          <button className="room-back" onClick={back}>
            <Icon name="back" size={16} />
            {titles[page] ?? '뒤로'}
          </button>
        )}
        <div>
          <button className="room-mode" aria-haspopup="dialog" onClick={onMode}>
            <i />
            {mode === 'sample' ? '샘플 옷장' : '개인 옷장'}
            <Icon name="down" size={12} />
          </button>
          <button
            aria-label="마이페이지"
            className="room-account"
            onClick={() => go('account')}
          >
            <Icon name="user" size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
