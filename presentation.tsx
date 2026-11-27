import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { getImage } from './storage';
import type { Garment } from './domain';

export function Icon({ name, size = 21 }: { name: string; size?: number }) {
  const shapes: Record<string, ReactNode> = {
    closet: (
      <>
        <path d="M10 6a2 2 0 1 1 4 0c0 1.5-2 2.1-2 3.6l8.7 5.9c1 .7.6 2.5-.7 2.5H4c-1.3 0-1.7-1.8-.7-2.5L12 9.6" />
      </>
    ),
    outfit: (
      <>
        <rect x="3" y="4" width="12" height="15" rx="2" />
        <path d="m16 6 4.3 1.1a1.7 1.7 0 0 1 1.2 2.1l-3.2 11.1a1.7 1.7 0 0 1-2.1 1.1l-4-1.2" />
      </>
    ),
    plus: <path d="M12 4v16M4 12h16" />,
    right: <path d="m9 5 7 7-7 7" />,
    back: <path d="m14 5-7 7 7 7" />,
    settings: (
      <>
        <path d="M3 7h4m5 0h9M3 17h10m5 0h3" />
        <circle cx="9.5" cy="7" r="2.5" />
        <circle cx="15.5" cy="17" r="2.5" />
      </>
    ),
    photo: (
      <>
        <rect x="2.5" y="4" width="19" height="16" rx="3" />
        <circle cx="8" cy="9" r="1.5" />
        <path d="m4 18 5-5 3 3 4-5 5 6" />
      </>
    ),
    camera: (
      <>
        <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13" r="3.6" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m4 12 5 5L20 6" />,
    save: <path d="M6 3h12v18l-6-4-6 4Z" />,
    down: <path d="m6 9 6 6 6-6" />,
    edit: (
      <>
        <path d="m4 16-1 5 5-1L20 8l-4-4Z" />
        <path d="m13 7 4 4" />
      </>
    ),
    layer: <path d="m2 9 10-5 10 5-10 5Zm0 6 10 5 10-5" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}

export function usePhoto(blob: Blob | null) {
  const [entry, set] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    set({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return entry?.blob === blob ? entry.url : undefined;
}
// Keep a single decoded preview URL while any visible surface displays this garment.
// A one-frame grace period preserves identity when moving it between two layouts.
interface PhotoEntry {
  refs: number;
  url?: string;
  ready: Promise<string | undefined>;
  cleanup?: number;
}
const photos = new Map<string, PhotoEntry>();
function acquirePhoto(id: string) {
  let entry = photos.get(id);
  if (!entry) {
    const created: PhotoEntry = { refs: 0, ready: Promise.resolve(undefined) };
    created.ready = getImage(id)
      .then((blob) => {
        if (!blob || photos.get(id) !== created) return undefined;
        created.url = URL.createObjectURL(blob);
        return created.url;
      })
      .catch(() => undefined);
    photos.set(id, created);
    entry = created;
  }
  clearTimeout(entry.cleanup);
  entry.refs++;
  return entry;
}
function releasePhoto(id: string, entry: PhotoEntry) {
  if (--entry.refs) return;
  entry.cleanup = window.setTimeout(() => {
    if (entry.refs || photos.get(id) !== entry) return;
    if (entry.url) URL.revokeObjectURL(entry.url);
    photos.delete(id);
  }, 40);
}
export function GarmentPhoto({
  item,
  shared = false,
}: {
  item: Garment;
  shared?: boolean;
}) {
  const [record, set] = useState<{
    id: string;
    url: string | undefined;
  } | null>(null);
  useEffect(() => {
    let live = true;
    const entry = acquirePhoto(item.id);
    entry.ready.then((url) => {
      if (live) set({ id: item.id, url });
    });
    return () => {
      live = false;
      releasePhoto(item.id, entry);
    };
  }, [item.id]);
  const url =
    photos.get(item.id)?.url ??
    (record?.id === item.id ? record.url : undefined);
  return url ? (
    <img
      src={url}
      alt={item.name}
      draggable={false}
      style={
        shared
          ? ({ viewTransitionName: 'garment-' + item.id } as CSSProperties)
          : undefined
      }
    />
  ) : (
    <span className="photoFallback">
      {record?.id === item.id ? '사진을 불러올 수 없어요' : '사진 불러오는 중'}
    </span>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const elem = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    elem?.showModal();
    return () => {
      elem?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <section className="sheet">
        <header>
          <h2>{title}</h2>
          <button className="icon" aria-label="닫기" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}

export function haptic(value: 'selection' | 'success') {
  const bridge = (
    window as Window & {
      webkit?: {
        messageHandlers?: {
          wardrobeHaptic?: { postMessage: (value: string) => void };
        };
      };
    }
  ).webkit;
  bridge?.messageHandlers?.wardrobeHaptic?.postMessage(value);
}
export function message(err: unknown) {
  return err instanceof Error
    ? err.message
    : '처리하지 못했어요. 다시 시도해 주세요.';
}
