import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { itemName, outfitMembers, type Garment, type Outfit } from './domain';
import * as db from './storage';
import { sampleGarments, sampleOutfits } from './sample';

export type Mode = 'personal' | 'sample';
export interface StudioGarment extends Garment {
  image?: string;
  material?: string;
}
export interface PageProps {
  page: string;
  go: (page: string) => void;
}
type Setter<T> = Dispatch<SetStateAction<T>>;
interface Studio {
  mode: Mode;
  setMode: (value: Mode) => void;
  garments: StudioGarment[];
  outfits: Outfit[];
  refresh: () => Promise<void>;
  saveLook: (name: string, ids: string[], id?: string) => Promise<Outfit>;
  removeLook: (id: string) => Promise<void>;
  selectedIds: string[];
  setSelectedIds: Setter<string[]>;
  activeGarmentId: string | null;
  setActiveGarmentId: Setter<string | null>;
  editLookId: string | null;
  setEditLookId: Setter<string | null>;
  notify: (message: string) => void;
}
const Context = createContext<Studio | null>(null);
export function useStudio() {
  const store = useContext(Context);
  if (!store) throw Error('옷장을 열 수 없어요.');
  return store;
}
const prefix = 'wardrobe.studio.v2.';
const change = 'studio-scope-change';
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(change, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(change, listener);
    window.removeEventListener('storage', listener);
  };
}
function parse<T>(raw: string | null, fallback: T): T {
  try {
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    throw Error('기기에 저장할 공간이 부족하거나 저장이 차단되었어요.');
  }
  window.dispatchEvent(new Event(change));
}
function useKey<T>(key: string, initial: T): [T, Setter<T>] {
  const raw = useSyncExternalStore(subscribe, () => read(key));
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const cache = useRef<{ key: string; raw: string | null; value: T } | null>(
    null,
  );
  if (!cache.current || cache.current.key !== key || cache.current.raw !== raw)
    cache.current = { key, raw, value: parse(raw, initial) };
  const set = useCallback<Setter<T>>(
    (update) => {
      const value =
        typeof update === 'function'
          ? (update as (v: T) => T)(parse(read(key), initialRef.current))
          : update;
      write(key, JSON.stringify(value));
    },
    [key],
  );
  return [cache.current.value, set];
}
export function useScopedState<T>(key: string, initial: T): [T, Setter<T>] {
  const { mode } = useStudio();
  return useKey(prefix + mode + '.' + key, initial);
}
function rememberedMode(): Mode | null {
  const value = read(prefix + 'mode');
  return value === 'personal' || value === 'sample' ? value : null;
}
export function StudioProvider({ children }: { children: ReactNode }) {
  const [mode, choose] = useState<Mode>(rememberedMode() ?? 'sample');
  const [snapshot, setSnapshot] = useState<{
    garments: Garment[];
    outfits: Outfit[];
  }>({ garments: [], outfits: [] });
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const timer = useRef(0),
    revision = useRef(0),
    initial = useRef(true);
  const notify = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    setNotice(message);
    timer.current = window.setTimeout(() => setNotice(''), 3400);
  }, []);
  const refresh = useCallback(async () => {
    const seq = ++revision.current;
    try {
      const [garments, outfits] = await Promise.all([
        db.listGarments(),
        db.listOutfits(),
      ]);
      if (seq !== revision.current) return;
      setSnapshot({ garments, outfits });
      setError('');
      if (initial.current) {
        choose(
          rememberedMode() ??
            (garments.length || outfits.length ? 'personal' : 'sample'),
        );
        initial.current = false;
      }
    } catch (err) {
      if (seq === revision.current)
        setError(
          err instanceof Error ? err.message : '옷장을 불러오지 못했어요.',
        );
    } finally {
      if (seq === revision.current) setReady(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  const setMode = (next: Mode) => {
    choose(next);
    initial.current = false;
    try {
      write(prefix + 'mode', next);
    } catch (err) {
      notify(String(err));
    }
  };
  const scoped = prefix + mode + '.';
  const [selectedIds, setSelectedIds] = useKey<string[]>(
    scoped + 'selection',
    [],
  );
  const [activeGarmentId, setActiveGarmentId] = useKey<string | null>(
    scoped + 'garment',
    null,
  );
  const [editLookId, setEditLookId] = useKey<string | null>(
    scoped + 'editor',
    null,
  );
  const [sampleLooks, setSampleLooks] = useKey<Outfit[]>(
    prefix + 'sample.outfits',
    sampleOutfits,
  );
  const garments: StudioGarment[] =
    mode === 'sample' ? sampleGarments : snapshot.garments;
  const outfits = mode === 'sample' ? sampleLooks : snapshot.outfits;
  async function saveLook(name: string, ids: string[], id?: string) {
    if (mode === 'personal') {
      const look = await db.saveOutfit(name, ids, id);
      await refresh();
      return look;
    }
    const members = outfitMembers(ids),
      title = itemName(name);
    if (members.some((i) => !sampleGarments.some((g) => g.id === i)))
      throw Error('샘플 옷장에서 의류를 다시 선택해 주세요.');
    const now = new Date().toISOString();
    const entry: Outfit = {
      id: id ?? 'look-' + crypto.randomUUID(),
      name: title,
      garmentIds: members,
      createdAt: now,
      updatedAt: now,
    };
    setSampleLooks((list) => {
      const prev = list.find((o) => o.id === id);
      if (id && !prev) throw Error('저장한 코디를 찾을 수 없어요.');
      entry.createdAt = prev?.createdAt ?? now;
      return [entry, ...list.filter((o) => o.id !== entry.id)];
    });
    return entry;
  }
  async function removeLook(id: string) {
    if (mode === 'sample')
      setSampleLooks((list) => list.filter((o) => o.id !== id));
    else {
      await db.deleteOutfit(id);
      await refresh();
    }
  }
  return (
    <Context.Provider
      value={{
        mode,
        setMode,
        garments,
        outfits,
        refresh,
        saveLook,
        removeLook,
        selectedIds,
        setSelectedIds,
        activeGarmentId,
        setActiveGarmentId,
        editLookId,
        setEditLookId,
        notify,
      }}
    >
      {ready ? children : <div className="boot">옷장을 여는 중…</div>}
      {error && (
        <div className="store-error" role="alert">
          {error} <button onClick={() => void refresh()}>다시 열기</button>
        </div>
      )}
      <div role="status" className={'toast' + (notice ? ' visible' : '')}>
        {notice}
      </div>
    </Context.Provider>
  );
}
