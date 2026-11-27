import { useEffect, useRef } from 'react';
type RGB = [number, number, number];
function color(a: RGB, b: RGB, t: number, alpha = 1) {
  return (
    'rgba(' +
    a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(',') +
    ',' +
    alpha +
    ')'
  );
}
function rgb(el: CSSStyleDeclaration, key: string): RGB {
  const v = el.getPropertyValue(key).trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as RGB;
}
// Curved shell cross-sections projected onto the mirror plane. Only render on resize, input or a state change.
export default function BelloSpace({
  kind = 'mirror',
  signal = 0,
}: {
  kind?: 'mirror' | 'rail' | 'atlas';
  signal?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    state = useRef({ x: 0, y: 0, pulse: 0 }),
    redraw = useRef<() => void>(() => {});
  useEffect(() => {
    state.current.pulse = 1;
    redraw.current();
  }, [signal]);
  useEffect(() => {
    const c = ref.current,
      host = c?.parentElement;
    if (!c || !host) return;
    const ctx = c.getContext('2d', { alpha: false });
    if (!ctx) return;
    let gpuReady = false,
      frame = 0,
      visible = true,
      goalX = 0,
      goalY = 0,
      last = 0;
    const reduced = matchMedia('(prefers-reduced-motion:reduce)');
    function draw(now: number) {
      frame = 0;
      if (!ctx || !c || !host || !visible || gpuReady) return;
      const { width: w, height: h } = host.getBoundingClientRect();
      if (!w || !h) return;
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      if (
        c.width !== Math.round(w * ratio) ||
        c.height !== Math.round(h * ratio)
      ) {
        c.width = Math.round(w * ratio);
        c.height = Math.round(h * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const p = state.current,
        k = reduced.matches ? 1 : Math.min(1, (now - last || 16) / 85);
      last = now;
      p.x += (goalX - p.x) * k;
      p.y += (goalY - p.y) * k;
      p.pulse = reduced.matches ? 0 : p.pulse * 0.88;
      const tokens = getComputedStyle(host),
        white = rgb(tokens, '--bello-optical'),
        silver = rgb(tokens, '--bello-silver'),
        lilac = rgb(tokens, '--bello-lavender'),
        ice = rgb(tokens, '--bello-hologram'),
        slate = rgb(tokens, '--bello-slate'),
        night = rgb(tokens, '--bello-midnight');
      const dark = document.documentElement.dataset.theme === 'dark',
        paper = dark ? night : white,
        edge = dark ? slate : silver;
      const cx = w * (0.5 + p.x * 0.012),
        floor = h * (kind === 'rail' ? 0.81 : 0.855),
        top = h * 0.095;
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, color(edge, slate, dark ? 0.52 : 0.23));
      bg.addColorStop(0.44, color(paper, edge, 0.2));
      bg.addColorStop(1, color(edge, lilac, 0.28));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const light = ctx.createRadialGradient(
        cx,
        floor * 0.54,
        1,
        cx,
        floor * 0.54,
        h * 0.66,
      );
      light.addColorStop(0, color(paper, white, dark ? 0.11 : 0.72));
      light.addColorStop(1, color(paper, paper, 0, 0));
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);
      // Ribbed, concave side walls. Separate curves catch different portions of a moving strip light.
      for (const side of [-1, 1]) {
        const edgeX = side < 0 ? 0 : w,
          dir = side < 0 ? 1 : -1;
        for (let i = 13; i >= 0; i--) {
          const t = i / 13,
            s = w * (0.035 + t * 0.195),
            bow = w * (0.03 + t * 0.042);
          ctx.beginPath();
          ctx.moveTo(edgeX + dir * s, -h * 0.1);
          ctx.bezierCurveTo(
            edgeX + dir * (s + bow),
            h * 0.17,
            edgeX + dir * (s - bow * 0.55),
            h * 0.48,
            edgeX + dir * s * 0.63,
            floor - h * 0.04,
          );
          ctx.quadraticCurveTo(
            edgeX + dir * s * 0.46,
            floor + h * 0.028,
            edgeX - dir * w * 0.1,
            h * 1.07,
          );
          ctx.lineTo(edgeX - dir * w * 0.15, -h * 0.1);
          ctx.closePath();
          const lighting = ctx.createLinearGradient(
            edgeX,
            0,
            edgeX + dir * s * 1.14,
            h * 0.06,
          );
          lighting.addColorStop(0, color(edge, slate, dark ? 0.83 : 0.56));
          lighting.addColorStop(0.66, color(edge, lilac, 0.18));
          lighting.addColorStop(0.9, color(edge, ice, 0.17 + 0.15 * p.pulse));
          lighting.addColorStop(0.97, color(white, silver, dark ? 0.83 : 0.1));
          lighting.addColorStop(1, color(edge, slate, 0.42));
          ctx.fillStyle = lighting;
          ctx.fill();
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = color(white, silver, 0.12, dark ? 0.3 : 0.58);
          ctx.stroke();
        }
      }
      const mw = Math.min(w * (kind === 'mirror' ? 0.65 : 0.72), h * 0.72),
        mh = floor - top,
        left = cx - mw / 2;
      ctx.beginPath();
      ctx.roundRect(left, top, mw, mh, [
        mw * 0.44,
        mw * 0.44,
        mw * 0.2,
        mw * 0.2,
      ]);
      const pane = ctx.createLinearGradient(left, 0, left + mw, h * 0.3);
      pane.addColorStop(0, color(ice, white, 0.6, dark ? 0.13 : 0.44));
      pane.addColorStop(0.25, color(white, silver, 0.15, 0.05));
      pane.addColorStop(0.73, color(white, silver, 0.3, 0.02));
      pane.addColorStop(1, color(lilac, white, 0.39, 0.28));
      ctx.fillStyle = pane;
      ctx.fill();
      ctx.strokeStyle = color(white, silver, 0.16, dark ? 0.36 : 0.85);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const floorGrad = ctx.createLinearGradient(0, floor - h * 0.04, 0, h);
      floorGrad.addColorStop(0, color(edge, white, 0.18, 0));
      floorGrad.addColorStop(0.23, color(edge, paper, 0.33));
      floorGrad.addColorStop(1, color(edge, slate, dark ? 0.84 : 0.22));
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, floor - h * 0.04, w, h - floor + h * 0.04);
      // A cantilevered runway follows the same receding curve as the live studio.
      const ledge = ctx.createLinearGradient(0, floor, w, h);
      ledge.addColorStop(0, color(edge, lilac, 0.15));
      ledge.addColorStop(0.47, color(paper, white, dark ? 0.1 : 0.46));
      ledge.addColorStop(1, color(edge, ice, 0.21));
      for (let layer = 2; layer >= 0; layer--) {
        const lip = layer * h * 0.004;
        ctx.beginPath();
        ctx.moveTo(-w * 0.1, floor + h * 0.1 + lip);
        ctx.bezierCurveTo(
          w * 0.25,
          floor + h * 0.025 + lip,
          w * 0.67,
          floor + h * 0.1 + lip,
          w * 1.1,
          floor - h * 0.045 + lip,
        );
        ctx.lineTo(w * 1.1, floor - h * 0.085 + lip);
        ctx.bezierCurveTo(
          w * 0.64,
          floor + h * 0.02 + lip,
          w * 0.35,
          floor - h * 0.014 + lip,
          -w * 0.1,
          floor + h * 0.008 + lip,
        );
        ctx.closePath();
        ctx.fillStyle = layer ? color(edge, slate, 0.17 + layer * 0.24) : ledge;
        ctx.fill();
      }
      if (
        !reduced.matches &&
        (Math.abs(p.x - goalX) + Math.abs(p.y - goalY) > 0.025 ||
          p.pulse > 0.025)
      )
        schedule();
    }
    function schedule() {
      if (!frame && visible && !gpuReady) frame = requestAnimationFrame(draw);
    }
    function move(e: globalThis.PointerEvent) {
      const b = host!.getBoundingClientRect();
      goalX = Math.max(
        -1,
        Math.min(1, ((e.clientX - b.left) / b.width - 0.5) * 2),
      );
      goalY = (e.clientY - b.top) / b.height - 0.5;
      schedule();
    }
    function syncGpu() {
      gpuReady = !!host?.querySelector('.optical-stage.ready');
      if (gpuReady) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else schedule();
    }
    const gpu = new MutationObserver(syncGpu);
    const optical = host.querySelector('.optical-stage');
    if (optical)
      gpu.observe(optical, { attributes: true, attributeFilter: ['class'] });
    syncGpu();
    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const observer = new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible) schedule();
    });
    observer.observe(host);
    host.addEventListener('pointermove', move, { passive: true });
    redraw.current = schedule;
    schedule();
    return () => {
      redraw.current = () => {};
      host.removeEventListener('pointermove', move);
      resize.disconnect();
      gpu.disconnect();
      theme.disconnect();
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [kind]);
  return <canvas ref={ref} className="bello-architecture" aria-hidden="true" />;
}
