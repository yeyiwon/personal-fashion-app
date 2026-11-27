import { useId } from 'react';

// Six overlapping iris leaves follow camera activation and the shutter press.
export function Aperture({ active = false }: { active?: boolean }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  return (
    <svg
      className="camera-iris"
      data-open={active || undefined}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={id + 'alloy'}
          x2="1"
          y2=".78"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="var(--bello-optical)" />
          <stop offset=".24" stopColor="var(--bello-silver)" />
          <stop offset=".53" stopColor="var(--bello-slate)" />
          <stop offset=".76" stopColor="var(--bello-lavender)" />
          <stop offset="1" stopColor="var(--bello-optical)" />
        </linearGradient>
        <radialGradient id={id + 'eye'} cx=".32" cy=".25" r=".88">
          <stop stopColor="var(--bello-hologram)" />
          <stop offset=".43" stopColor="var(--bello-slate)" />
          <stop offset="1" stopColor="var(--bello-midnight)" />
        </radialGradient>
        <clipPath id={id + 'rim'}>
          <circle cx="60" cy="60" r="46" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="58" fill={'url(#' + id + 'alloy)'} />
      <circle cx="60" cy="60" r="54" fill="var(--bello-midnight)" />
      <circle cx="60" cy="60" r="50" fill={'url(#' + id + 'eye)'} />
      <g clipPath={'url(#' + id + 'rim)'}>
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={'rotate(' + 60 * i + ' 60 60)'}>
            <path
              className="iris-leaf"
              d="M18 37Q29 10 68 11L89 17Q60 25 48 58L38 70Q33 54 18 37Z"
              fill={'url(#' + id + 'alloy)'}
              stroke="var(--bello-slate)"
              strokeWidth=".8"
            />
          </g>
        ))}
      </g>
      <path
        d="M24 43A41 41 0 0 1 50 21"
        fill="none"
        stroke="var(--bello-optical)"
        strokeLinecap="round"
        strokeWidth="2"
        opacity=".75"
      />
    </svg>
  );
}
