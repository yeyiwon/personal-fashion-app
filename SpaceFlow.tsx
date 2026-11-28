import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, haptic } from './presentation';
import { sections } from './routes';
import { BelloMark } from './BelloAtlas';
import './space-flow.css';

// 공간 이동 — the BELLO mark is a reservoir. Pressing it lets droplets split
// off along two arcs; keep the finger down, slide onto one and release to go
// there in a single stroke. Resting on a droplet (or tapping it) makes its
// functions bud off as smaller drops. The list dialog remains for keyboard,
// search and the full index.
export const flowGate = {
  open: false,
  swallow: false,
  /** True while a pointer press is being handled here, so its click must not also open the dialog. */
  busy() {
    return this.open || this.swallow;
  },
};

type Drop = [entry: string, label: string, icon: string, reach: number, angle: number, size: number];
const drops: Drop[] = [
  ['home', '나의 공간', 'home', 140, 12, 30],
  ['closet', '옷장', 'closet', 140, 46, 30],
  ['ai', '스타일링', 'layer', 140, 80, 30],
  ['fitting', '피팅룸', 'fit', 232, 3, 30],
  ['shop', '쇼핑', 'shop', 232, 24, 30],
  ['lookbook', '기록', 'save', 232, 45, 30],
  ['account', '설정', 'settings', 232, 66, 30],
  ['search', '기능 검색', 'search', 232, 87, 23],
];
const SEARCH = 7;
type Spring = { v: number; s: number; k: number; c: number };
const spring = (k: number, c: number): Spring => ({ v: 0, s: 0, k, c });
function step(sp: Spring, target: number, dt: number, still: boolean) {
  if (still) {
    sp.v = target;
    sp.s = 0;
    return false;
  }
  for (let i = 0; i < 2; i++) {
    sp.s += (-sp.k * (sp.v - target) - sp.c * sp.s) * (dt / 2);
    sp.v += sp.s * (dt / 2);
  }
  return Math.abs(sp.v - target) > 0.002 || Math.abs(sp.s) > 0.02;
}
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function SpaceFlow({
  page,
  go,
  openIndex,
  blocked,
}: {
  page: string;
  go: (p: string) => void;
  openIndex: () => void;
  blocked: boolean;
}) {
  const [shown, setShown] = useState(false),
    [open, setOpen] = useState(false),
    [focus, setFocus] = useState(-1),
    [hot, setHot] = useState('');
  const live = useRef({ open, focus, hot, blocked });
  live.current = { open, focus, hot, blocked };
  const origin = useRef({ x: 44, y: 34 }),
    stroke = useRef<{ id: number; x: number; y: number; moved: boolean; since: number } | null>(null),
    finger = useRef({ x: 0, y: 0 }),
    sim = useRef({
      drops: drops.map((_, k) => ({ p: spring(250 - k * 17, 19), m: spring(190, 21), x: 0, y: 0, r: 0 })),
      pills: [] as { q: Spring; x: number; y: number; w: number; h: number }[],
      touch: spring(260, 22),
    }),
    circles = useRef<(SVGCircleElement | null)[]>([]),
    rects = useRef<(SVGRectElement | null)[]>([]),
    buttons = useRef<(HTMLButtonElement | null)[]>([]),
    pills = useRef<(HTMLButtonElement | null)[]>([]),
    well = useRef<SVGCircleElement>(null),
    tip = useRef<SVGCircleElement>(null);

  const list =
    focus > 0 && focus < SEARCH
      ? Object.entries(sections[focus - 1].pages)
          .filter(([id]) => id !== 'home')
          .sort(([a], [b]) => +(b === drops[focus][0]) - +(a === drops[focus][0]))
      : [];

  function close() {
    setOpen(false);
    setFocus(-1);
    setHot('');
    stroke.current = null;
    flowGate.open = false;
  }
  function travel(id: string) {
    haptic('selection');
    close();
    if (id === 'search') openIndex();
    else go(id);
  }
  const act = useRef({ close, travel });
  act.current = { close, travel };

  // Press on any 공간 이동 trigger opens the flow and starts a stroke.
  useEffect(() => {
    function hit(x: number, y: number) {
      const S = sim.current;
      for (let j = 0; j < S.pills.length; j++) {
        const p = S.pills[j];
        if (p.q.v > 0.5 && x >= p.x - 4 && x <= p.x + p.w + 4 && y >= p.y - 4 && y <= p.y + p.h + 4) return 'p' + j;
      }
      for (let k = 0; k < S.drops.length; k++) {
        const d = S.drops[k];
        if (d.p.v > 0.5 && Math.hypot(x - d.x, y - d.y) < d.r + 13) return 'd' + k;
      }
      return '';
    }
    function down(e: PointerEvent) {
      const trigger = (e.target as Element | null)?.closest?.('button[aria-label="공간 이동"]');
      if (!trigger || live.current.blocked || e.button > 0) return;
      if (live.current.open) return act.current.close();
      const box = trigger.getBoundingClientRect();
      origin.current = { x: box.left + Math.min(22, box.width / 2), y: box.top + box.height / 2 };
      finger.current = { x: e.clientX, y: e.clientY };
      stroke.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, since: performance.now() };
      flowGate.open = true;
      setShown(true);
      setOpen(true);
      setFocus(-1);
      setHot('');
    }
    function move(e: PointerEvent) {
      const st = stroke.current;
      if (!st || e.pointerId !== st.id) return;
      finger.current = { x: e.clientX, y: e.clientY };
      if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 14) st.moved = true;
      if (!st.moved) return;
      const next = hit(e.clientX, e.clientY);
      if (next !== live.current.hot) {
        st.since = performance.now();
        if (next) haptic('selection');
        setHot(next);
      }
    }
    function up(e: PointerEvent) {
      const st = stroke.current;
      if (!st || e.pointerId !== st.id) return;
      stroke.current = null;
      // The click that follows this release belongs to the stroke.
      flowGate.swallow = true;
      setTimeout(() => (flowGate.swallow = false), 400);
      if (!st.moved) return setHot('');
      const at = hit(e.clientX, e.clientY);
      if (at[0] === 'd') act.current.travel(drops[+at.slice(1)][0]);
      else if (at[0] === 'p') pills.current[+at.slice(1)]?.click();
      else act.current.close();
    }
    function key(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !live.current.open) return;
      if (live.current.focus >= 0) setFocus(-1);
      else act.current.close();
    }
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    const spent = () => setTimeout(() => (flowGate.swallow = false), 0);
    document.addEventListener('click', spent, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', spent, true);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (live.current.open) act.current.close();
  }, [page]);

  // Measure where the function drops will rest, then let them bud from the anchor.
  useLayoutEffect(() => {
    sim.current.pills = pills.current.slice(0, list.length).map((el, j) => {
      const b = el!.getBoundingClientRect();
      return { q: spring(230 - j * 9, 20), x: b.left, y: b.top, w: b.width, h: b.height };
    });
  }, [focus, list.length]);

  useEffect(() => {
    if (!shown) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0,
      last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const S = sim.current,
        L = live.current,
        O = origin.current,
        A = { x: Math.min(innerWidth - 60, O.x + 70), y: O.y + 70 };
      let moving = false;
      S.drops.forEach((d, k) => {
        const [, , , reach, angle, size] = drops[k];
        moving = step(d.p, L.open && (L.focus < 0 || L.focus === k) ? 1 : 0, dt, still) || moving;
        moving = step(d.m, L.focus === k ? 1 : 0, dt, still) || moving;
        const rad = (angle * Math.PI) / 180,
          tx = clamp(O.x + Math.cos(rad) * reach, 36, innerWidth - 36),
          ty = O.y + Math.sin(rad) * reach,
          px = O.x + (tx - O.x) * d.p.v,
          py = O.y + (ty - O.y) * d.p.v;
        d.x = px + (A.x - px) * d.m.v;
        d.y = py + (A.y - py) * d.m.v;
        d.r = size * (0.3 + 0.7 * clamp(d.p.v)) * (L.hot === 'd' + k ? 1.17 : 1);
        const c = circles.current[k],
          b = buttons.current[k];
        c?.setAttribute('cx', d.x.toFixed(1));
        c?.setAttribute('cy', d.y.toFixed(1));
        c?.setAttribute('r', Math.max(0, d.r).toFixed(1));
        if (b) {
          b.style.transform = `translate(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.6 + 0.4 * clamp(d.p.v)).toFixed(3)})`;
          b.style.opacity = clamp((d.p.v - 0.45) * 2.2).toFixed(2);
          b.style.pointerEvents = d.p.v > 0.6 ? 'auto' : 'none';
        }
      });
      S.pills.forEach((p, j) => {
        moving = step(p.q, L.open && L.focus >= 0 ? 1 : 0, dt, still) || moving;
        const q = clamp(p.q.v, 0, 1.2),
          w = 30 + (p.w - 30) * q,
          h = 30 + (p.h - 30) * q,
          cx = A.x + (p.x + p.w / 2 - A.x) * q,
          cy = A.y + (p.y + p.h / 2 - A.y) * q,
          grow = L.hot === 'p' + j ? 5 : 0,
          r = rects.current[j],
          b = pills.current[j];
        if (r) {
          r.setAttribute('x', (cx - w / 2 - grow).toFixed(1));
          r.setAttribute('y', (cy - h / 2 - grow / 2).toFixed(1));
          r.setAttribute('width', Math.max(0, w + grow * 2).toFixed(1));
          r.setAttribute('height', Math.max(0, h + grow).toFixed(1));
          r.setAttribute('rx', ((h + grow) / 2).toFixed(1));
        }
        if (b) b.style.opacity = clamp((p.q.v - 0.55) * 2.6).toFixed(2);
      });
      for (let j = S.pills.length; j < rects.current.length; j++) rects.current[j]?.setAttribute('width', '0');
      const st = stroke.current;
      moving = step(S.touch, st?.moved && !L.hot && L.focus < 0 ? 1 : 0, dt, still) || moving;
      tip.current?.setAttribute('cx', finger.current.x.toFixed(1));
      tip.current?.setAttribute('cy', finger.current.y.toFixed(1));
      tip.current?.setAttribute('r', (11 * clamp(S.touch.v)).toFixed(1));
      well.current?.setAttribute('cx', O.x.toFixed(1));
      well.current?.setAttribute('cy', O.y.toFixed(1));
      // Resting on a space mid-stroke opens its functions without lifting.
      if (st?.moved && L.hot[0] === 'd' && now - st.since > 380) {
        const k = +L.hot.slice(1);
        if (k > 0 && k < SEARCH && L.focus !== k) {
          st.since = now;
          haptic('selection');
          setFocus(k);
        }
      }
      if (!moving && !st) {
        if (!L.open) setShown(false);
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [shown, open, focus, hot]);

  if (!shown) return null;
  const here = sections.findIndex((s) => Object.hasOwn(s.pages, page)) + 1;
  return (
    <div className={'space-flow' + (open ? ' on' : '')} data-focus={focus >= 0}>
      <div className="flow-veil" onClick={() => (focus >= 0 ? setFocus(-1) : close())} />
      <svg className="flow-liquid" aria-hidden="true">
        <defs>
          <filter id="bello-flow" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="soft" />
            <feColorMatrix in="soft" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" result="body" />
            <feGaussianBlur in="body" stdDeviation="3.5" result="dome" />
            <feSpecularLighting
              in="dome"
              surfaceScale="6"
              specularConstant="0.85"
              specularExponent="24"
              style={{ lightingColor: 'var(--bello-optical)' }}
              result="shine"
            >
              <fePointLight x="-80" y="-160" z="240" />
            </feSpecularLighting>
            <feComposite in="shine" in2="body" operator="in" result="gloss" />
            <feComposite in="body" in2="gloss" operator="arithmetic" k1="0" k2="1" k3="0.6" k4="0" />
          </filter>
        </defs>
        <g filter="url(#bello-flow)">
          <circle ref={well} r="21" />
          {drops.map((d, k) => (
            <circle key={d[0]} ref={(el) => void (circles.current[k] = el)} r="0" />
          ))}
          {Array.from({ length: 12 }, (_, j) => (
            <rect key={j} ref={(el) => void (rects.current[j] = el)} width="0" height="0" />
          ))}
          <circle ref={tip} r="0" />
        </g>
      </svg>
      <span className="flow-mark" style={{ left: origin.current.x, top: origin.current.y }}>
        <BelloMark size={21} />
      </span>
      {drops.map(([entry, label, icon], k) => (
        <button
          key={entry}
          ref={(el) => void (buttons.current[k] = el)}
          className={'flow-drop' + (hot === 'd' + k ? ' hot' : '')}
          data-here={(k === 0 ? page === 'home' : k === here && page !== 'home') || undefined}
          aria-label={k === SEARCH ? label : undefined}
          aria-expanded={k > 0 && k < SEARCH ? focus === k : undefined}
          onClick={() =>
            k === 0 || k === SEARCH ? travel(entry) : (haptic('selection'), setFocus(focus === k ? -1 : k))
          }
        >
          <Icon name={icon} size={k === SEARCH ? 19 : 17} />
          {k !== SEARCH && <span>{label}</span>}
        </button>
      ))}
      {list.length > 0 && (
        <div
          className="flow-pod"
          role="group"
          aria-label={drops[focus][1] + ' 기능'}
          style={{ top: origin.current.y + 122 }}
        >
          {list.map(([id, title], j) => (
            <button
              key={id}
              ref={(el) => void (pills.current[j] = el)}
              className={'flow-pill' + (hot === 'p' + j ? ' hot' : '')}
              aria-current={id === page ? 'page' : undefined}
              onClick={() => travel(id)}
            >
              {title}
              {j === 0 && <Icon name="arrow" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
