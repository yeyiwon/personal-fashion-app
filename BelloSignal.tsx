import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BelloOrb } from './BelloOrb';
export type SignalState =
  | 'waiting'
  | 'greeting'
  | 'thinking'
  | 'proposed'
  | 'acting'
  | 'complete'
  | 'error'
  | 'limited';
const shapes: Record<SignalState, [number, number, number]> = {
  waiting: [2, 0.13, 0],
  greeting: [3, 0.21, 0.4],
  thinking: [4, 0.3, 0.55],
  proposed: [3, 0.26, 1.3],
  acting: [5, 0.19, 1.5],
  complete: [2, 0.1, 1.1],
  error: [3, 0.09, -0.7],
  limited: [2, 0.05, -0.4],
};
/** BELLO's state body. WebGL lens where available, the SVG trace otherwise. */
export function BelloSignal({ state }: { state: SignalState }) {
  const [flat, setFlat] = useState(false);
  const fall = useCallback(() => setFlat(true), []);
  return flat ? <SvgSignal state={state} /> : <BelloOrb state={state} onUnsupported={fall} />;
}
function SvgSignal({ state }: { state: SignalState }) {
  const id = useId().replace(/[^a-z0-9]/gi, ''),
    path = useRef<SVGPathElement>(null),
    inner = useRef<SVGPathElement>(null),
    pose = useRef<number[]>([2, 0.13, 0]);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion:reduce)'),
      target = shapes[state];
    let frame = 0,
      last = performance.now(),
      phase = 0;
    function trace(t: number) {
      const dt = Math.min(0.045, (t - last) / 1000);
      last = t;
      const blend = reduced.matches ? 1 : 1 - Math.exp(-dt * 13);
      let diff = 0;
      pose.current = pose.current.map((x, i) => {
        diff += Math.abs(target[i] - x);
        return x + (target[i] - x) * blend;
      });
      if (state === 'thinking' && !reduced.matches) phase += dt * 2;
      const [lobes, amplitude, angle] = pose.current;
      function outline(radius: number, twist: number) {
        const points = Array.from({ length: 36 }, (_, i) => {
          const a = (i * Math.PI) / 18;
          const r =
            radius *
            (1 +
              amplitude * Math.cos(a * lobes + angle + phase + twist) +
              0.048 * Math.sin(a * 2 - angle));
          return [
            22 + r * Math.cos(a + 0.2),
            22 + r * 0.89 * Math.sin(a + 0.2),
          ];
        });
        return (
          points.reduce(
            (s, p, i) => {
              const q = points[(i + 1) % points.length];
              return (
                s +
                'Q' +
                p[0].toFixed(2) +
                ' ' +
                p[1].toFixed(2) +
                ' ' +
                ((q[0] + p[0]) / 2).toFixed(2) +
                ' ' +
                ((q[1] + p[1]) / 2).toFixed(2) +
                ' '
              );
            },
            'M' +
              (points[35][0] + points[0][0]) / 2 +
              ' ' +
              (points[35][1] + points[0][1]) / 2 +
              ' ',
          ) + 'Z'
        );
      }
      path.current?.setAttribute('d', outline(15, 0));
      inner.current?.setAttribute('d', outline(8.5, 1.4));
      if (
        !reduced.matches &&
        (diff > 0.004 || state === 'thinking') &&
        !document.hidden
      )
        frame = requestAnimationFrame(trace);
    }
    function sync() {
      cancelAnimationFrame(frame);
      if (!document.hidden) trace(performance.now());
    }
    sync();
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
    };
  }, [state]);
  return (
    <svg
      className="bello-signal"
      viewBox="0 0 44 44"
      aria-hidden="true"
      data-state={state}
    >
      <defs>
        <linearGradient id={id} x2=".88" y2="1">
          <stop stopColor="var(--bello-optical)" />
          <stop offset=".25" stopColor="var(--bello-hologram)" />
          <stop offset=".42" stopColor="var(--bello-slate)" />
          <stop offset=".59" stopColor="var(--bello-lavender)" />
          <stop offset=".8" stopColor="var(--bello-optical)" />
          <stop offset="1" stopColor="var(--bello-slate)" />
        </linearGradient>
      </defs>
      <path
        ref={path}
        fill={'url(#' + id + ')'}
        stroke="var(--key-ink)"
        strokeWidth=".7"
      />
      <path
        ref={inner}
        fill="var(--background)"
        fillOpacity=".80"
        stroke="var(--bello-optical)"
        strokeWidth=".9"
      />
    </svg>
  );
}
