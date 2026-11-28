import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Control } from './LiquidControls';
import { Icon } from './presentation';
import { sections } from './routes';
import { spaceFor } from './RoomNavigation';

// Each space is one strand. Its functions unfold in place, so any screen is
// two taps from here and the strand itself is a one-tap door.
const strands: [entry: string, label: string, icon: string, hint: string][] = [
  ['closet', '옷장', 'closet', '촬영 · 등록 · 구매 내역'],
  ['ai', '스타일링', 'layer', 'AI 코디 · 직접 코디 · 팔레트'],
  ['fitting', '피팅룸', 'fit', '모델 · 가상 피팅'],
  ['shop', '쇼핑', 'shop', '맞춤 상품 · 가격 비교'],
  ['lookbook', '기록', 'save', '룩북 · 캘린더 · 여행'],
  ['account', '설정', 'settings', '취향 · 계정 · 데이터'],
];

export function SpaceFold({ page, go }: { page: string; go: (p: string) => void }) {
  const here = page === 'home' || page === 'tools' ? -1 : spaceFor(page);
  const [open, setOpen] = useState(here);
  function step(e: KeyboardEvent<HTMLElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const names = [...e.currentTarget.querySelectorAll<HTMLElement>('.fold-name')],
      at = names.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? names.length - 1 : at + (e.key === 'ArrowDown' ? 1 : -1);
    names[(next + names.length) % names.length].focus();
  }
  return (
    <nav className="space-fold" aria-label="공간" onKeyDown={step}>
      <div className="fold-row" data-here={page === 'home'} style={{ '--i': 0 } as CSSProperties}>
        <Control className="fold-name" onClick={() => go('home')} aria-current={page === 'home' ? 'page' : undefined}>
          <Icon name="home" size={18} />
          <span>
            <b>나의 공간</b>
            <small>옷을 꺼내 코디하는 곳</small>
          </span>
          <Icon name="arrow" size={16} />
        </Control>
      </div>
      {strands.map(([entry, label, icon, hint], i) => {
        const pages = Object.entries(sections[i].pages).filter(([id]) => id !== 'home'),
          wide = open === i;
        return (
          <div
            key={entry}
            className="fold-row"
            data-open={wide}
            data-here={here === i}
            style={{ '--i': i + 1 } as CSSProperties}
          >
            <div className="fold-head">
              <Control
                className="fold-name"
                aria-expanded={wide}
                aria-controls={'fold-' + entry}
                onClick={() => setOpen(wide ? -1 : i)}
              >
                <Icon name={icon} size={18} />
                <span>
                  <b>{label}</b>
                  <small>{wide ? pages.length + '개 기능' : hint}</small>
                </span>
              </Control>
              <Control className="fold-enter" aria-label={label + ' 들어가기'} onClick={() => go(entry)}>
                <Icon name="arrow" size={16} />
              </Control>
            </div>
            <div className="fold-body" id={'fold-' + entry} inert={!wide}>
              <div>
                {pages.map(([id, title]) => (
                  <Control
                    key={id}
                    className="fold-link"
                    aria-current={id === page ? 'page' : undefined}
                    onClick={() => go(id)}
                  >
                    {title}
                  </Control>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
