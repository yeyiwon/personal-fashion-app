import { useId, useRef } from 'react';
import type { Figure } from './atelierData';
import { hairNames } from './atelierData';

type Ring = [number, number, number, number?, number?];
type Point = [number, number];
// A meridian profile gives each part a smooth contour. Elliptical cross sections
// keep the side and front measurements distinct as the illustration rotates.
function contour(points: Point[]) {
  if (!points.length) return '';
  let d = 'M' + points[0].join(' ');
  for (let i = 0; i < points.length; i++) {
    const a = points[(i + points.length - 1) % points.length],
      b = points[i],
      c = points[(i + 1) % points.length],
      e = points[(i + 2) % points.length];
    d +=
      ' C' +
      [
        b[0] + (c[0] - a[0]) / 7,
        b[1] + (c[1] - a[1]) / 7,
        c[0] - (e[0] - b[0]) / 7,
        c[1] - (e[1] - b[1]) / 7,
        ...c,
      ]
        .map((n) => n.toFixed(2))
        .join(' ');
  }
  return d + 'Z';
}
export function FigurePreview({
  figure: f,
  angle,
  turn,
  garments = [],
}: {
  figure: Figure;
  angle: number;
  turn: (v: number) => void;
  garments?: { category: string; color: string; name: string }[];
}) {
  const drag = useRef<{ x: number; a: number } | null>(null),
    uid = useId().replace(/[^a-z0-9]/gi, '');
  const a = (angle * Math.PI) / 180,
    cs = Math.cos(a),
    sn = Math.sin(a),
    mass = 1 + (f.weight - 56) * 0.003,
    sh = (f.base === 'm' ? 29 : 25) * (1 + (f.shoulder - 50) * 0.012) * mass;
  const waist =
      (f.base === 'm' ? 19 : 16) * (1 + ((f.waist ?? 50) - 50) * 0.013) * mass,
    hip =
      (f.base === 'm' ? 22 : 24) * (1 + ((f.hip ?? 50) - 50) * 0.012) * mass;
  const feet = 291,
    top = feet - (236 + (f.height - 168) * 0.72),
    pelvis = feet - ((feet - top) * f.leg) / 100,
    shoulder = top + 45;
  const belt = shoulder + (pelvis - shoulder) * 0.58 * ((f.torso ?? 100) / 100),
    hair = f.hairColor ?? '#40312e';
  function project(r: Ring) {
    const [y, rx, rz, x = 0, z = 0] = r;
    return {
      cx: 100 + x * cs + z * sn,
      y,
      w: Math.sqrt((rx * cs) ** 2 + (rz * sn) ** 2),
    };
  }
  const profile = (rings: Ring[]) => {
    const v = rings.map(project);
    return contour([
      ...v.map((p) => [p.cx - p.w, p.y] as Point),
      ...v.reverse().map((p) => [p.cx + p.w, p.y] as Point),
    ]);
  };
  const torso: Ring[] = [
    [top + 28, 5.5, 5],
    [top + 36, 6.5, 5.5],
    [shoulder, sh, 13],
    [shoulder + 17, sh * 0.85, 15],
    [belt, waist, 12.5],
    [pelvis - 12, hip, 16],
    [pelvis, hip * 0.8, 13],
    [pelvis + 4, 7, 6],
  ];
  const limb = (side: number, arm: boolean): Ring[] =>
    arm
      ? [
          [shoulder + 1, 5.2, 5.4, sh * side],
          [shoulder + 17, 5.9, 5.5, (sh + 3) * side],
          [belt + 2, 4.1, 4.2, (sh + 6) * side],
          [pelvis + 5, 3.2, 3.3, (sh + 8) * side, 1],
          [pelvis + 13, 2.5, 3, (sh + 8) * side, 1.4],
        ]
      : [
          [pelvis - 9, hip * 0.48, 11.5, hip * 0.46 * side],
          [pelvis + 13, hip * 0.44, 10.4, hip * 0.51 * side],
          [pelvis + (feet - pelvis) * 0.48, 5.9, 6.8, 10.4 * side, 1],
          [pelvis + (feet - pelvis) * 0.65, 6.6, 7.2, 10.7 * side, -0.8],
          [feet - 7, 3, 3.8, 10.8 * side],
          [feet - 1, 3.8, 7, 11 * side, 3.1],
        ];
  const head: Ring[] = [
    [top - 1, 3.1, 3.2],
    [top + 2, 8.6, 8.7],
    [top + 11, 10.4, 10.3],
    [top + 21, 8.4, 8.8, 0, 1],
    [top + 28, 4.3, 5, 0, 2],
  ];
  const hairDepth = { short: 12, bob: 26, long: 47 }[f.hair];
  const parts = [-1, 1]
    .flatMap((d) => [
      { key: 'leg' + d, depth: -d * sn * 0.1, r: limb(d, false) },
      { key: 'arm' + d, depth: -d * sn * 0.9, r: limb(d, true) },
    ])
    .concat([{ key: 'torso', depth: 0, r: torso }])
    .sort((x, y) => x.depth - y.depth);
  const hairBack = profile([
    [top - 2, 2.4, 2],
    [top, 7, 7],
    [top + 5, 10.6, 10.2, 0, -1],
    [top + 9, 10, 9.4, 0, -1.5],
    [top + hairDepth, Math.max(2, 6.8 - 2 * cs), 4.5, 0, -6],
  ]);
  const fill = 'url(#cloth' + uid + ')';
  return (
    <svg
      className="dress-form"
      viewBox="30 28 140 275"
      role="img"
      aria-label={
        '비율 도식 ' + angle + '도, 키 ' + f.height + 'cm, ' + hairNames[f.hair]
      }
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, a: angle };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current)
          turn(
            Math.round(
              (drag.current.a + (e.clientX - drag.current.x) * 1.5 + 720) % 360,
            ),
          );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <defs>
        <linearGradient
          id={'cloth' + uid}
          x1="0"
          y1=".2"
          x2="1"
          y2=".6"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="#999e90" />
          <stop offset=".25" stopColor="#d5d5c6" />
          <stop offset=".47" stopColor="#eceade" />
          <stop offset=".75" stopColor="#c5c7b7" />
          <stop offset="1" stopColor="#969a8c" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="293" rx="29" ry="3" fill="#8a9386" opacity=".27" />
      {parts.map((p) => (
        <g key={p.key}>
          <path
            d={profile(p.r)}
            fill={fill}
            stroke="#787e70"
            strokeWidth=".6"
          />
          {p.key === 'torso' && (
            <>
              {[torso[3], torso[4], torso[5]].map((r, i) => {
                const v = project(r);
                return (
                  <path
                    key={i}
                    d={
                      'M' +
                      (v.cx - v.w) +
                      ' ' +
                      v.y +
                      ' Q' +
                      v.cx +
                      ' ' +
                      (v.y + 4) +
                      ' ' +
                      (v.cx + v.w) +
                      ' ' +
                      v.y
                    }
                    fill="none"
                    stroke="#847167"
                    strokeWidth=".7"
                    strokeDasharray={i === 1 ? '2 1' : undefined}
                  />
                );
              })}
              <path
                d={
                  'M' +
                  (100 + 5 * sn) +
                  ' ' +
                  (top + 36) +
                  ' C' +
                  (100 + 16 * sn) +
                  ' ' +
                  (shoulder + 9) +
                  ' ' +
                  (100 + 12 * sn) +
                  ' ' +
                  belt +
                  ' ' +
                  (100 + 13 * sn) +
                  ' ' +
                  pelvis
                }
                fill="none"
                stroke="#9b8278"
                strokeWidth=".65"
              />
            </>
          )}
        </g>
      ))}
      {garments
        .slice()
        .sort(
          (a, b) =>
            ['하의', '원피스', '상의', '아우터'].indexOf(a.category) -
            ['하의', '원피스', '상의', '아우터'].indexOf(b.category),
        )
        .map((g) => {
          const color = g.color,
            k = g.category,
            hem = feet - 36;
          const upper: Ring[] = [
            [shoulder - 8, 8, 7],
            [shoulder + 1, sh + 4, 15],
            [shoulder + 19, sh - 1, 17],
            [belt, waist + 3, 15],
            [pelvis - 5, hip + 3, 17],
          ];
          if (k === '상의' || k === '아우터')
            return (
              <g key={g.name} fill={color}>
                <path d={profile(upper)} />
                {[-1, 1].map((i) => (
                  <path key={i} d={profile(limb(i, true).slice(0, 4))} />
                ))}
              </g>
            );
          if (k === '원피스' || (k === '하의' && /치마|스커트/.test(g.name)))
            return (
              <path
                key={g.name}
                d={profile([
                  ...(k === '원피스' ? upper.slice(0, 3) : []),
                  [belt, waist + 2, 15],
                  [pelvis, hip + 3, 18],
                  [hem, hip + 15, 22],
                  [hem + 1, hip + 14, 20],
                ])}
                fill={color}
              />
            );
          if (k === '하의')
            return (
              <g key={g.name} fill={color}>
                <path
                  d={profile([
                    [belt, waist + 2, 16],
                    [pelvis + 4, hip + 3, 18],
                  ])}
                />
                {[-1, 1].map((i) => (
                  <path
                    key={i}
                    d={profile(
                      limb(i, false)
                        .slice(0, 5)
                        .map(([y, rx, rz, x, z]) => [
                          y,
                          rx + 3.5,
                          rz + 2,
                          x,
                          z,
                        ]),
                    )}
                  />
                ))}
              </g>
            );
          if (k === '신발')
            return (
              <g key={g.name} fill={color}>
                {[-1, 1].map((i) => (
                  <path
                    key={i}
                    d={profile([
                      [feet - 6, 4, 5, i * 11],
                      [feet - 2, 5, 9, i * 11, 3],
                      [feet, 5, 9, i * 11, 3],
                    ])}
                  />
                ))}
              </g>
            );
          return null;
        })}
      {cs >= 0 && <path d={hairBack} fill={hair} />}
      <path d={profile(head)} fill={fill} stroke="#80857b" strokeWidth=".6" />
      {cs < 0 && <path d={hairBack} fill={hair} />}
      <path
        d={profile([
          [top - 2, 2, 2],
          [top, 7, 7],
          [top + 5, 10.6, 10.2],
          [top + 8, 9.8, 9.1, 0, -0.8],
          [top + 6, 5, 5, 0, 2.5],
        ])}
        fill={hair}
      />
    </svg>
  );
}
