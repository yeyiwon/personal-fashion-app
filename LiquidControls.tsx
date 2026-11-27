import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const primaryClasses = new Set([
  'action',
  'primary',
  'wc-solid',
  'lk-primary',
  'lk-main',
  'at-next',
  'at-primary',
  'primary-room',
]);
const secondaryClasses = new Set([
  'quiet',
  'plain',
  'wc-outline',
  'lk-secondary',
  'at-secondary',
  'secondary-room',
]);

function materialFor(classes: string, pressed: boolean, children: ReactNode) {
  const names = classes.split(/\s+/);
  if (names.some((name) => secondaryClasses.has(name))) return 'lens';
  if (names.some((name) => primaryClasses.has(name))) return 'commit';
  if (pressed) return 'choice';
  if (!classes && typeof children === 'string') return 'command';
  return 'object';
}

// React 19 forwards refs to the original DOM control. Drag handlers, submit defaults,
// native constraints and file/camera pickers keep their original semantics.
export function Control({
  className = '',
  children,
  title,
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={className}
      data-ui={materialFor(
        className,
        props['aria-pressed'] !== undefined,
        children,
      )}
      data-tip={title || undefined}
      aria-label={props['aria-label'] || (!children ? title : undefined)}
    >
      {children}
    </button>
  );
}
export function Field({
  type = 'text',
  style,
  value,
  min,
  max,
  ...props
}: ComponentProps<'input'>) {
  const percent =
    ((Number(value ?? 50) - Number(min ?? 0)) /
      (Number(max ?? 100) - Number(min ?? 0))) *
    100;
  const track =
    type === 'range' && Number.isFinite(percent)
      ? { '--level': Math.min(100, Math.max(0, percent)) + '%' }
      : {};
  return (
    <input
      {...props}
      type={type}
      min={min}
      max={max}
      value={value}
      data-field={type}
      style={{ ...style, ...track } as CSSProperties}
    />
  );
}
export function TextArea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} data-field="text" />;
}

export function Feedback({
  children,
  role,
  className,
  ...props
}: ComponentProps<'p'>) {
  return (
    <p
      {...props}
      role={role}
      className={className}
      data-feedback={role === 'alert' ? 'error' : 'status'}
    >
      {children}
    </p>
  );
}

// The original select remains the label, form and change-event owner. The optical
// list opens next to it, inside the same modal top layer when necessary.
export function Choice({ children, ...props }: ComponentProps<'select'>) {
  const input = useRef<HTMLSelectElement>(null),
    list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [open, show] = useState(false),
    [cursor, move] = useState(0);
  const [position, place] = useState<CSSProperties>({});
  const options = Array.from(input.current?.options ?? []);
  function start() {
    if (props.disabled || open || !input.current) return;
    move(Math.max(0, input.current.selectedIndex));
    show(true);
  }
  function close(focus = false) {
    show(false);
    if (focus) input.current?.focus({ preventScroll: true });
  }
  function select(i: number) {
    const node = input.current;
    if (!node || !node.options[i] || node.options[i].disabled) return;
    node.selectedIndex = i;
    node.dispatchEvent(new Event('change', { bubbles: true }));
    close(true);
  }
  useLayoutEffect(() => {
    if (!open || !input.current || !list.current) return;
    const node = input.current,
      popup = list.current;
    // An ancestor dialog can transform during entry. The popover top layer
    // uses viewport coordinates even when the triggering field is transformed.
    popup.showPopover?.();
    function layout() {
      const box = node.getBoundingClientRect(),
        vv = window.visualViewport;
      const leftEdge = vv?.offsetLeft ?? 0,
        topEdge = vv?.offsetTop ?? 0;
      const right = leftEdge + (vv?.width ?? innerWidth),
        bottom = topEdge + (vv?.height ?? innerHeight);
      const width = Math.min(Math.max(184, box.width), right - leftEdge - 16);
      const above = box.top - topEdge - 12,
        below = bottom - box.bottom - 12;
      const up = below < 170 && above > below;
      const height = Math.min(300, Math.max(48, up ? above : below));
      place({
        width,
        left: Math.max(leftEdge + 8, Math.min(box.left, right - width - 8)),
        top: up ? box.top - 5 : box.bottom + 5,
        maxHeight: height,
        transform: up ? 'translateY(-100%)' : undefined,
      });
    }
    layout();
    popup.focus({ preventScroll: true });
    function outside(e: PointerEvent) {
      if (
        e.target instanceof Node &&
        !popup.contains(e.target) &&
        e.target !== node
      )
        close();
    }
    function scroll(e: Event) {
      if (!popup.contains(e.target as Node)) layout();
    }
    window.addEventListener('resize', layout);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('pointerdown', outside, true);
    window.visualViewport?.addEventListener('resize', layout);
    return () => {
      window.removeEventListener('resize', layout);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('pointerdown', outside, true);
      window.visualViewport?.removeEventListener('resize', layout);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      list.current?.children[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [open, cursor]);
  return (
    <span className="liquid-choice">
      <select
        {...props}
        ref={input}
        data-field="choice"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onPointerDown={(e) => {
          if (e.button === 0) {
            e.preventDefault();
            start();
          }
        }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          start();
        }}
        onKeyDown={(e) => {
          if ([' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            start();
          }
        }}
      >
        {children}
      </select>
      <svg
        className="choice-mark"
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
      >
        <path
          d="m4 6 4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {open &&
        createPortal(
          <div
            id={listId}
            ref={list}
            popover={
              typeof HTMLElement.prototype.showPopover === 'function'
                ? 'manual'
                : undefined
            }
            className="liquid-options"
            role="listbox"
            aria-label={
              input.current?.getAttribute('aria-label') ||
              input.current?.labels?.[0]?.childNodes[0]?.textContent?.trim() ||
              '항목 선택'
            }
            aria-activedescendant={listId + '-' + cursor}
            tabIndex={-1}
            style={position}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) close();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close(true);
                return;
              }
              if (e.key === 'Tab') {
                close(true);
                return;
              }
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(cursor);
                return;
              }
              const enabled = options
                .map((o, i) => (o.disabled ? -1 : i))
                .filter((i) => i >= 0);
              if (!enabled.length) return;
              let next = cursor;
              if (e.key === 'ArrowDown')
                next = enabled[(enabled.indexOf(cursor) + 1) % enabled.length];
              else if (e.key === 'ArrowUp')
                next =
                  enabled[
                    (enabled.indexOf(cursor) - 1 + enabled.length) %
                      enabled.length
                  ];
              else if (e.key === 'Home') next = enabled[0];
              else if (e.key === 'End') next = enabled.at(-1)!;
              else if (e.key.length === 1)
                next =
                  enabled.find((i) => options[i].text.startsWith(e.key)) ??
                  cursor;
              else return;
              e.preventDefault();
              move(next);
            }}
          >
            {options.map((option, i) => (
              <div
                key={i}
                id={listId + '-' + i}
                role="option"
                aria-selected={option.selected}
                aria-disabled={option.disabled}
                data-cursor={cursor === i || undefined}
                onPointerMove={() => move(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(i)}
              >
                <span>{option.text}</span>
                {option.selected && <span aria-hidden="true">✓</span>}
              </div>
            ))}
          </div>,
          input.current?.closest('dialog') ?? document.body,
        )}
    </span>
  );
}

export function Segment({
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    function sync() {
      if (!el) return;
      const selected = el.querySelector<HTMLElement>(
        ':scope > [aria-pressed=true], :scope > [aria-selected=true], :scope > button.active',
      );
      if (!selected) {
        el.removeAttribute('data-track');
        return;
      }
      const b = selected.getBoundingClientRect(),
        base = el.getBoundingClientRect();
      if (!b.width) return;
      el.dataset.track = 'true';
      el.style.setProperty(
        '--track-x',
        b.left - base.left + el.scrollLeft + 'px',
      );
      el.style.setProperty('--track-y', b.top - base.top + el.scrollTop + 'px');
      el.style.setProperty('--track-w', b.width + 'px');
      el.style.setProperty('--track-h', b.height + 'px');
    }
    const observer = new MutationObserver(sync);
    observer.observe(el, {
      subtree: true,
      attributes: true,
      childList: true,
      attributeFilter: ['aria-pressed', 'aria-selected', 'class'],
    });
    const resize = new ResizeObserver(sync);
    resize.observe(el);
    sync();
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  return (
    <div
      {...props}
      ref={host}
      className={className}
      data-segment=""
      role={props.role ?? 'group'}
    >
      {children}
    </div>
  );
}

// Delegate the one active touch to its surface. Idle controls allocate no observers
// or animation frames, including long clothing lists.
export function useControlLight() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    function point(e: PointerEvent) {
      if (!active) return;
      const rect = active.getBoundingClientRect();
      active.style.setProperty(
        '--glint-x',
        Math.max(
          0,
          Math.min(100, (100 * (e.clientX - rect.left)) / rect.width),
        ) + '%',
      );
    }
    function release() {
      if (active) {
        active.removeAttribute('data-touch');
        active.style.removeProperty('--glint-x');
        active = null;
      }
    }
    function down(e: PointerEvent) {
      release();
      active = (e.target as Element)?.closest<HTMLElement>(
        'button[data-ui]:not(:disabled),[data-field="choice"]',
      );
      if (active) {
        active.dataset.touch = 'true';
        point(e);
      }
    }
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointermove', point, { passive: true });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      release();
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', point);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, []);
}
