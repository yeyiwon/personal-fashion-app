import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

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
