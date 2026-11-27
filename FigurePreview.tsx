import { useRef, type PointerEvent } from 'react';
import type { Figure } from './atelierData';
import { hairNames } from './atelierData';

type Vertex = [x: number, y: number, z: number];
type Ring = [
  y: number,
  radiusX: number,
  radiusZ: number,
  x?: number,
  z?: number,
];
type Facet = { verts: Vertex[]; rgb: number[]; light: number[] };
const segments = 16;
const toRgb = (color: string) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
function surface(rings: Ring[], color: string, first = 0, last = segments) {
  const facets: Facet[] = [];
  const rgb = toRgb(color);
  const point = ([y, rx, rz, x = 0, z = 0]: Ring, step: number): Vertex => [
    x + rx * Math.sin((step * 2 * Math.PI) / segments),
    y,
    z + rz * Math.cos((step * 2 * Math.PI) / segments),
  ];
  for (let r = 1; r < rings.length; r++)
    for (let j = first; j < last; j++) {
      const angle = ((j + 0.5) * 2 * Math.PI) / segments;
      const prev = rings[r - 1],
        next = rings[r];
      const slope =
        (prev[1] + prev[2] - next[1] - next[2]) /
        (2 * Math.max(1, next[0] - prev[0]));
      facets.push({
        verts: [
          point(prev, j),
          point(prev, j + 1),
          point(next, j + 1),
          point(next, j),
        ],
        rgb,
        light: [Math.sin(angle), slope, Math.cos(angle)],
      });
    }
  return facets;
}
function mesh(f: Figure) {
  const standing = 208 + (f.height - 165) * 0.8,
    top = 278 - standing;
  const body = (f.weight - 60) * 0.12;
  const sh =
    (f.base === 'm' ? 23.5 : 20.5) + (f.shoulder - 50) * 0.21 + body * 0.4;
  const hip =
      (f.base === 'm' ? 16.5 : 18.5) + body + ((f.hip ?? 50) - 50) * 0.18,
    waist = (f.base === 'm' ? 15 : 12.8) + body + ((f.waist ?? 50) - 50) * 0.18;
  const leg = (standing * f.leg) / 100;
  const crotch = 278 - leg,
    shoulder = top + 32;
  const mid =
    shoulder + (crotch - shoulder) * (0.58 + ((f.torso ?? 100) - 100) * 0.006);
  const facets: Facet[] = [];
  const add = (rings: Ring[], color: string, start?: number, end?: number) =>
    facets.push(...surface(rings, color, start, end));
  add(
    [
      [top + 16, 4, 4],
      [shoulder, 5.5, 5],
    ],
    '#aebfc9',
  );
  add(
    [
      [shoulder - 3, 5, 5],
      [shoulder + 2, sh, 8],
      [mid - 13, sh * 0.84, 10],
      [mid, waist, 9],
      [crotch - 13, hip, 12],
      [crotch, hip * 0.88, 9],
    ],
    '#bdcdd7',
  );
  for (const side of [-1, 1]) {
    const sx = (x: number) => side * x;
    add(
      [
        [crotch - 12, hip * 0.51, 9, sx(hip * 0.52)],
        [crotch + 7, hip * 0.48, 9, sx(hip * 0.55)],
        [crotch + leg * 0.49, 5.4 + body * 0.18, 6, sx(11)],
        [crotch + leg * 0.67, 6.4 + body * 0.25, 7, sx(11.8), -0.8],
        [275, 3.15, 3.8, sx(13)],
        [278, 4.2, 7.3, sx(13), 2],
      ],
      '#aabecb',
    );
    add(
      [
        [shoulder + 1, 2, 3, sx(sh - 2)],
        [shoulder + 6, 5.4 + body * 0.12, 5.7, sx(sh - 1)],
        [mid - 1, 3.8 + body * 0.08, 4.7, sx(sh + 6)],
        [mid + 12, 4.3, 4.4, sx(sh + 8), 1],
        [crotch + 8, 2.6, 3.3, sx(sh + 9), 2],
        [crotch + 15, 2.1, 2.5, sx(sh + 8), 2],
      ],
      '#b7c9d4',
    );
  }
  add(
    [
      [top - 3, 2, 2],
      [top, 8, 8],
      [top + 8, 10, 9.5],
      [top + 14, 8.2, 8],
      [top + 21, 4.5, 5, 0, 1],
    ],
    '#d4dce0',
  );
  // The nose, forehead and back hair give side and rear views different silhouettes.
  add(
    [
      [top + 7, 0.8, 1, 0, 8.3],
      [top + 13, 2, 2.6, 0, 9],
      [top + 14, 1.4, 1, 0, 8.9],
    ],
    '#b9c8cf',
  );
  const hair = f.hairColor ?? '#3f302b',
    bottom = { short: 14, bob: 27, long: 48 }[f.hair];
  add(
    [
      [top - 5, 0.4, 0.4],
      [top - 2, 7.7, 8.6],
      [top + 3, 10.5, 10.4],
      [top + 5, 10.4, 10],
    ],
    hair,
  );
  add(
    [
      [top + 4, 10.4, 10],
      [top + 10, 10.9, 10.8],
      [top + bottom, f.hair === 'long' ? 12 : 9, 8.9, 0, -1],
    ],
    hair,
    3,
    14,
  );
  return facets;
}
export function FigurePreview({
  figure,
  angle,
  turn,
}: {
  figure: Figure;
  angle: number;
  turn: (v: number) => void;
}) {
  const drag = useRef<{ x: number; start: number } | null>(null);
  const rad = (angle * Math.PI) / 180,
    co = Math.cos(rad),
    si = Math.sin(rad);
  const rotate = ([x, y, z]: Vertex): Vertex => [
    100 + x * co + z * si,
    y,
    -x * si + z * co,
  ];
  const faces = mesh(figure)
    .map((face) => {
      const pts = face.verts.map(rotate),
        [x, y, z] = face.light;
      const n = Math.hypot(x, y, z);
      const light =
        0.84 +
        (0.18 *
          ((x * co + z * si) * -0.45 - y * 0.42 + (-x * si + z * co) * 0.69)) /
          n;
      return {
        pts: pts.map(([a, b]) => a.toFixed(2) + ',' + b.toFixed(2)).join(' '),
        depth: pts.reduce((t, p) => t + p[2], 0) / 4,
        color:
          'rgb(' +
          face.rgb.map((v) => Math.min(255, Math.round(v * light))).join(',') +
          ')',
      };
    })
    .sort((a, b) => a.depth - b.depth);
  function move(e: PointerEvent<SVGSVGElement>) {
    if (drag.current)
      turn(
        Math.round(
          (drag.current.start + (e.clientX - drag.current.x) * 1.4 + 7200) %
            360,
        ),
      );
  }
  return (
    <svg
      className="at-figure-svg"
      viewBox="0 0 200 303"
      role="img"
      aria-label={`비율 모형 ${angle}도. 키 ${figure.height}cm, 다리 ${figure.leg}%, ${hairNames[figure.hair]}`}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, start: angle };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <g
        fill="none"
        stroke="#a8b7c6"
        strokeWidth=".6"
        strokeDasharray="2.5 2.5"
      >
        {[36, 85, 144, 204, 278].map((y) => (
          <path key={y} d={`M 24 ${y} H 176`} />
        ))}
      </g>
      <ellipse
        cx="100"
        cy="280"
        rx="30"
        ry="3.3"
        fill="#9faeb8"
        opacity=".34"
      />
      {faces.map((f, i) => (
        <polygon
          key={i}
          fill={f.color}
          stroke={f.color}
          strokeWidth=".45"
          strokeLinejoin="round"
          points={f.pts}
        />
      ))}
    </svg>
  );
}
