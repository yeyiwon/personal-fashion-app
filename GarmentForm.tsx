import { useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  CONDITIONS,
  type Garment,
  type GarmentDraft,
  type Category,
  type Condition,
} from './domain';
import { type PreparedImage, localImageProcessor } from './images';
import { addGarment, updateGarment } from './storage';
import { Sheet, Icon, usePhoto, message, GarmentPhoto } from './presentation';

export function GarmentForm({
  files,
  edit,
  onClose,
  onSaved,
}: {
  files: File[];
  edit?: Garment;
  onClose: () => void;
  onSaved: (item: Garment) => void;
}) {
  const [pos, setPos] = useState(0),
    file = files[pos];
  const [prepared, setPrepared] = useState<PreparedImage | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<GarmentDraft>(() =>
      edit ? { ...edit } : { name: '', category: '기타' }
    ),
    lock = useRef(false);
  const url = usePhoto(prepared?.preview ?? null);
  useEffect(() => {
    let live = true;
    setError('');
    setPrepared(null);
    if (edit) return;
    if (!file) return;
    setDraft({
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
      category: '기타',
      condition: '착용 중',
    });
    localImageProcessor
      .prepare(file)
      .then((data) => {
        if (live) {
          setPrepared(data);
          setDraft((d) => ({ ...d, color: data.color }));
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [file, edit]);
  const next = () => {
    if (pos + 1 < files.length) setPos((i) => i + 1);
    else onClose();
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || (!edit && !prepared)) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const item = edit
        ? await updateGarment(edit.id, draft)
        : await addGarment(draft, prepared!);
      onSaved(item);
      if (edit) onClose();
      else next();
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={edit ? '의류 정보 수정' : '옷 등록'}
      onClose={() => {
        if (!lock.current) onClose();
      }}
    >
      {!edit && files.length > 1 && (
        <p className="small">
          사진 {pos + 1} / {files.length} · 한 벌씩 확인해 주세요.
        </p>
      )}
      <form onSubmit={submit}>
        <div className="formPreview">
          {edit ? (
            <GarmentPhoto item={edit} />
          ) : url ? (
            <img src={url} alt="등록할 의류" />
          ) : (
            <span>
              {error ? '사진을 확인해 주세요' : '사진을 준비하고 있어요'}
            </span>
          )}
        </div>
        <label>
          의류 이름
          <input
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="fields">
          <label>
            분류
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as Category })
              }
            >
              {CATEGORIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select
              value={draft.condition ?? '착용 중'}
              onChange={(e) =>
                setDraft({ ...draft, condition: e.target.value as Condition })
              }
            >
              {CONDITIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="fields">
          <label>
            구매 가격 (선택)
            <input
              type="number"
              min="0"
              step="1"
              max="9999999999"
              inputMode="numeric"
              placeholder="원"
              value={draft.price ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  price: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            대표색
            <input
              aria-label="대표색"
              type="color"
              value={draft.color ?? '#888888'}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          {!edit && files.length > 1 && (
            <button
              type="button"
              className="plain"
              disabled={busy}
              onClick={next}
            >
              건너뛰기
            </button>
          )}
          <button className="primary" disabled={busy || (!edit && !prepared)}>
            <Icon name="check" />
            {busy ? '저장 중' : edit ? '변경 저장' : '옷장에 저장'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
