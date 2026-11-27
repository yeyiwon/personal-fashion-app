import { useState, type CSSProperties, type ReactNode } from 'react';
import { type Figure, hairNames } from './atelierData';
import { FigurePreview } from './FigurePreview';
import { Icon } from './presentation';
import { GlassSurface } from './RoomControls';

const scales = [
  ['height', '키', 140, 205, 'cm', 168],
  ['weight', '몸무게', 35, 140, 'kg', 56],
  ['shoulder', '어깨', 30, 70, '', 50],
  ['waist', '허리', 30, 70, '', 50],
  ['hip', '골반', 30, 70, '', 50],
  ['torso', '상체', 85, 115, '%', 100],
  ['leg', '다리', 43, 58, '%', 51],
] as const;
type Dim = (typeof scales)[number][0];
type View = 'photo' | 'diagram' | 'own';
type Props = {
  figure: Figure;
  view: View;
  ownPhoto: string;
  angle: number;
  turn: (v: number) => void;
  setView: (v: View) => void;
  tweak: <K extends keyof Figure>(key: K, value: Figure[K]) => void;
  fitting: () => void;
  children: ReactNode;
};
function Tape({
  title,
  value,
  min,
  max,
  unit,
  change,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  change: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="tape-instrument">
      <button
        aria-label={title + ' 줄이기'}
        disabled={value <= min}
        onClick={() => change(Math.max(min, value - 1))}
      >
        −
      </button>
      <div
        className="tape-track"
        style={{ '--value': pct + '%' } as CSSProperties}
      >
        <div className="tape-grades" />
        <i className="tape-needle" />
        <div className="tape-ends">
          <span>{min}</span>
          <span>{max}</span>
        </div>
        <input
          aria-label={title}
          aria-valuetext={String(value) + (unit || ' 단계')}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => change(+e.target.value)}
        />
      </div>
      <button
        aria-label={title + ' 늘리기'}
        disabled={value >= max}
        onClick={() => change(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}
const names: Record<Dim, string> = {
  height: '키',
  weight: '몸무게',
  shoulder: '어깨 너비',
  waist: '허리 너비',
  hip: '골반 너비',
  torso: '상체 길이',
  leg: '다리 비율',
};
const pins: [Dim, number][] = [
  ['shoulder', 17],
  ['waist', 34],
  ['hip', 42],
  ['leg', 63],
];
export default function MeasureMirror({
  figure,
  view,
  ownPhoto,
  angle,
  turn,
  setView,
  tweak,
  fitting,
  children,
}: Props) {
  const [dim, select] = useState<Dim>('height'),
    [adjusting, activate] = useState(false);
  const spec = scales.find((x) => x[0] === dim)!;
  const value = figure[dim] ?? spec[5];
  function target(key: Dim) {
    select(key);
    activate(true);
    setView('diagram');
  }
  return (
    <section className="mirror-room">
      <div className="mirror-intro">
        <div>
          <span className="date-stamp">피팅룸</span>
          <h1>개인 모델</h1>
        </div>
        <div className="base-selector">
          {(['f', 'm'] as const).map((b) => (
            <button
              key={b}
              aria-pressed={b === figure.base}
              onClick={() => tweak('base', b)}
            >
              {b === 'f' ? '여성형' : '남성형'}
            </button>
          ))}
        </div>
      </div>
      <div className="mirror-layout">
        <div
          className={
            'mirror-bay ' + (view === 'diagram' ? 'drawing' : 'portrait')
          }
        >
          <div className="mirror-backing" aria-hidden="true" />
          <div className="mirror-plate">
            {view === 'diagram' ? (
              <>
                <div className="projection-grid" />
                <FigurePreview figure={figure} angle={angle} turn={turn} />
              </>
            ) : (
              <img
                className={'mirror-photo ' + (view === 'own' ? 'own' : '')}
                src={
                  view === 'own'
                    ? ownPhoto
                    : '/media/editorial/study-' + figure.base + '.jpg'
                }
                alt={
                  view === 'own'
                    ? '직접 선택한 전신 사진'
                    : (figure.base === 'f' ? '여성형' : '남성형') +
                      ' 기본 모델 착장 예시'
                }
              />
            )}
          </div>
          <span className="mirror-source">
            <i />
            {view === 'diagram'
              ? '비율 도식'
              : view === 'own'
                ? '내 참고 사진'
                : '실사 착장 예시'}
          </span>
          {view !== 'own' && (
            <div className="body-pins" aria-label="부위 선택">
              {pins.map(([k, y]) => (
                <button
                  key={k}
                  className={view === 'diagram' && dim === k ? 'chosen' : ''}
                  style={{ top: y + (view === 'diagram' ? 8 : 0) + '%' }}
                  aria-label={names[k] + ' 조절'}
                  onClick={() => target(k)}
                >
                  <i />
                  <span>{scales.find((d) => d[0] === k)![1]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mirror-switch">
            <GlassSurface />
            {(
              [
                ['photo', '실사 예시'],
                ['diagram', '비율 도식'],
                ...(ownPhoto ? [['own', '내 사진']] : []),
              ] as [View, string][]
            ).map(([v, n]) => (
              <button
                key={v}
                aria-pressed={v === view}
                onClick={() => {
                  setView(v);
                  activate(v === 'diagram');
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="measure-desk">
          <div className="measure-title">
            <div>
              <small>
                {view === 'diagram' ? '비율 도식 조절' : '모델 치수'}
              </small>
              <h2>{names[dim]}</h2>
            </div>
            <output>
              {value}
              <small>{spec[4] || ' / 100'}</small>
            </output>
          </div>
          <Tape
            title={names[dim]}
            value={value}
            min={spec[2]}
            max={spec[3]}
            unit={spec[4]}
            change={(n) => {
              activate(true);
              tweak(dim, n);
            }}
          />
          <div className="body-index" aria-label="조절할 항목">
            {scales.map(([k, l]) => (
              <button
                aria-pressed={k === dim}
                key={k}
                onClick={() => target(k)}
              >
                {l}
              </button>
            ))}
          </div>
          {view === 'diagram' && (
            <div className={'angle-wheel' + (adjusting ? ' active' : '')}>
              <div>
                <strong>시점</strong>
                <span>{angle}°</span>
                {[
                  [0, '정면'],
                  [90, '측면'],
                  [180, '후면'],
                ].map(([v, n]) => (
                  <button
                    key={v}
                    aria-pressed={angle === v}
                    onClick={() => turn(+v)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Tape
                title="모델 회전 각도"
                value={angle}
                min={0}
                max={359}
                unit="°"
                change={turn}
              />
            </div>
          )}
          <details className="mirror-detail">
            <summary>
              헤어 설정 <span>{hairNames[figure.hair]}</span>
              <Icon name="down" size={15} />
            </summary>
            <div className="hair-styles">
              {(Object.keys(hairNames) as Figure['hair'][]).map((h) => (
                <button
                  key={h}
                  aria-pressed={h === figure.hair}
                  onClick={() => tweak('hair', h)}
                >
                  {hairNames[h]}
                </button>
              ))}
            </div>
            <div className="hair-colors">
              {[
                ['#272525', '블랙'],
                ['#3f302b', '다크 브라운'],
                ['#8c6045', '체스트넛'],
                ['#b6a079', '애쉬 블론드'],
              ].map(([c, n]) => (
                <button
                  key={c}
                  aria-label={n}
                  aria-pressed={(figure.hairColor ?? '#3f302b') === c}
                  onClick={() => tweak('hairColor', c)}
                >
                  <i style={{ background: c }} />
                </button>
              ))}
            </div>
          </details>
          <details className="mirror-detail">
            <summary>
              참고 사진 <span>선택</span>
              <Icon name="down" size={15} />
            </summary>
            {children}
          </details>
          <p className="mirror-note">
            치수는 회전 가능한 도식에 반영돼요. 실사 착장은 고정된 예시이며 개인
            모델 생성은 연결 전이에요.
          </p>
          <button className="woven-btn" onClick={fitting}>
            이 모델로 피팅 준비 <Icon name="diagonal" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
