import { Control } from './LiquidControls';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from 'react';
import { Icon } from './presentation';
import { OpticalStage } from './OpticalStage';
import { GlassSurface } from './RoomControls';

type Destination = readonly [string, string, string];
export function SpaceCarousel({
  rooms,
  initial,
  go,
  relic,
}: {
  rooms: readonly Destination[];
  initial: number;
  go: (p: string) => void;
  relic: (i: number) => ReactNode;
}) {
  const n = rooms.length,
    stage = useRef<HTMLDivElement>(null),
    frame = useRef(0);
  const motion = useRef({ at: initial, target: initial, speed: 0 });
  const [selected, pick] = useState(initial);
  const drag = useRef<{
    x: number;
    at: number;
    id: number;
    moved: boolean;
  } | null>(null);
  const nudged = useRef(0);
  const wrap = (v: number) => ((v % n) + n) % n;
  function project() {
    const el = stage.current;
    if (!el) return;
    el.querySelectorAll<HTMLAnchorElement>('.gallery-place').forEach(
      (item, i) => {
        const angle = ((i - motion.current.at) * Math.PI * 2) / n;
        const z = (1 + Math.cos(angle)) / 2;
        const x = 50 + Math.sin(angle) * (34 + z * 7);
        const y = 24 + z * 43;
        item.style.left = x + '%';
        item.style.top = y + '%';
        item.style.setProperty('--presence', String(z));
        item.style.width = 15 + z * z * 29 + '%';
        item.style.zIndex = String(Math.round(z * 30) + 1);
      },
    );
    el.dispatchEvent(new Event('bello-projection'));
  }
  function snap(target: number) {
    motion.current.target = target;
    pick(wrap(Math.round(target)));
    cancelAnimationFrame(frame.current);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      motion.current.at = target;
      motion.current.speed = 0;
      project();
      return;
    }
    let last = performance.now();
    function step(t: number) {
      const m = motion.current,
        dt = Math.min(0.03, (t - last) / 1000);
      last = t;
      m.speed += ((m.target - m.at) * 150 - m.speed * 23) * dt;
      m.at += m.speed * dt;
      if (Math.abs(m.target - m.at) + Math.abs(m.speed) < 0.003) {
        m.at = m.target;
        m.speed = 0;
        project();
        return;
      }
      project();
      frame.current = requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
  }
  useEffect(() => {
    project();
    return () => cancelAnimationFrame(frame.current);
  }, []);
  function choose(i: number) {
    const at = motion.current.at;
    snap(at + (((i - at + n * 5 + n / 2) % n) - n / 2));
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 7 && !d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    motion.current.at =
      d.at - dx / Math.max(70, e.currentTarget.clientWidth * 0.29);
    project();
  }
  function release(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    if (drag.current.moved) {
      nudged.current = performance.now();
      snap(Math.round(motion.current.at));
    }
    drag.current = null;
  }
  return (
    <div className="space-traverse">
      <div
        className="gallery-world"
        ref={stage}
        role="group"
        aria-label="여섯 공간 둘러보기"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            snap(
              Math.round(motion.current.target) +
                (e.key === 'ArrowRight' ? 1 : -1),
            );
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          cancelAnimationFrame(frame.current);
          drag.current = {
            x: e.clientX,
            at: motion.current.at,
            id: e.pointerId,
            moved: false,
          };
        }}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <svg
          className="gallery-guides"
          viewBox="0 0 400 360"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M-36 167C19 135 48 119 103 102C177 80 332 83 417 147" />
          <path d="M-15 177C20 209 72 242 141 258C224 278 335 251 414 190" />
          <path d="M-20 182C42 229 118 263 205 269C296 272 363 245 421 209" />
        </svg>
        {rooms.map(([p, label], i) => (
          <a
            href={'#/' + p}
            key={p}
            className="gallery-place"
            aria-label={label}
            aria-current={selected === i ? 'true' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              if (performance.now() - nudged.current < 250) return;
              if (i === selected) go(p);
              else choose(i);
            }}
          >
            {relic(i)}
            <span className="relic-shadow" />
            <span className="relic-name">{label}</span>
          </a>
        ))}
        <OpticalStage mode="atlas" />
      </div>
      <div className="space-selection">
        <Control
          onClick={() => snap(Math.round(motion.current.target) - 1)}
          aria-label="이전 공간"
        >
          <Icon name="back" size={20} />
        </Control>
        <Control className="space-enter" onClick={() => go(rooms[selected][0])}>
          <GlassSurface />
          <strong aria-live="polite">{rooms[selected][1]}</strong>
          <span>
            들어가기 <Icon name="arrow" size={16} />
          </span>
        </Control>
        <Control
          onClick={() => snap(Math.round(motion.current.target) + 1)}
          aria-label="다음 공간"
        >
          <Icon name="right" size={20} />
        </Control>
      </div>
    </div>
  );
}
