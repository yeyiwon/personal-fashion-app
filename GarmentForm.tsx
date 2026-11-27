import { Choice, Control, Feedback, Field } from './LiquidControls';
import { analyseGarment, visionAvailable } from './localVision';
import { jpegData } from './avatarLayers';
import { useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  CONDITIONS,
  WardrobeError,
  type Garment,
  type GarmentDraft,
  type Category,
  type Condition,
} from './domain';
import { type PreparedImage, localImageProcessor } from './images';
import { addGarment, updateGarment, listGarments } from './storage';
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
  const [duplicate, setDuplicate] = useState<Garment>();
  const [draft, setDraft] = useState<GarmentDraft>(() =>
      edit ? { ...edit } : { name: '', category: '기타' },
    ),
    lock = useRef(false);
  const [analysis, setAnalysis] = useState<{
    category?: Category;
    cutout?: string | null;
    note: string;
  } | null>(null);
  const [hasVision, setHasVision] = useState(false);
  const analysisRun = useRef(0);
  useEffect(() => {
    let live = true;
    visionAvailable().then((v) => {
      if (live) setHasVision(v);
    });
    return () => {
      live = false;
      analysisRun.current++;
    };
  }, []);
  useEffect(() => {
    analysisRun.current++;
    setAnalysis(null);
  }, [file]);
  async function analyse() {
    if (!prepared) return;
    const seq = ++analysisRun.current;
    setAnalysis({ note: '이 Mac에서 사진을 분석하고 있어요…' });
    try {
      const result = await analyseGarment(
        await jpegData(prepared.preview, 720),
      );
      if (seq !== analysisRun.current) return;
      setAnalysis({
        category: result?.category,
        cutout: result?.cutout,
        note: result?.cutout
          ? '배경 분리 미리보기예요. 등록할 때 원본 사진을 보관해요.'
          : '피사체 경계를 확정하지 못했어요. 원본을 사용해요.',
      });
    } catch {
      if (seq === analysisRun.current)
        setAnalysis({
          note: '사진을 분석하지 못했어요. 직접 분류할 수 있어요.',
        });
    }
  }
  const url = usePhoto(prepared?.preview ?? null);
  useEffect(() => {
    let live = true;
    setError('');
    setPrepared(null);
    setDuplicate(undefined);
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
      if (
        e instanceof WardrobeError &&
        e.code === 'DUPLICATE' &&
        e.existingId
      ) {
        const existing = await listGarments().catch(() => []);
        setDuplicate(existing.find((g) => g.id === e.existingId));
      }
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
            <img src={analysis?.cutout || url} alt="등록할 의류" />
          ) : (
            <span>
              {error ? '사진을 확인해 주세요' : '사진을 준비하고 있어요'}
            </span>
          )}
        </div>
        {hasVision && prepared && (
          <div className="wc-form-note">
            <Control
              type="button"
              className="quiet"
              onClick={() => void analyse()}
            >
              기기 내 AI 분류·배경 분리
            </Control>
            {analysis && <Feedback role="status">{analysis.note}</Feedback>}
            {analysis?.category && (
              <Control
                type="button"
                className="quiet"
                onClick={() =>
                  setDraft((d) => ({ ...d, category: analysis.category! }))
                }
              >
                {analysis.category} 분류 적용
              </Control>
            )}
          </div>
        )}
        {duplicate && (
          <div className="wc-duplicate">
            <GarmentPhoto item={duplicate} />
            <div>
              <strong>이미 옷장에 있는 사진</strong>
              <p>
                {duplicate.name} · {duplicate.category}
              </p>
            </div>
          </div>
        )}
        {!edit && (
          <p className="wc-form-note">
            사진에서 대표색을 추출했어요. 이름과 분류를 직접 확인해 주세요.
          </p>
        )}
        <label>
          의류 이름
          <Field
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="fields">
          <label>
            분류
            <Choice
              aria-label="분류"
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as Category })
              }
            >
              {CATEGORIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Choice>
          </label>
          <label>
            상태
            <Choice
              aria-label="상태"
              value={draft.condition ?? '착용 중'}
              onChange={(e) =>
                setDraft({ ...draft, condition: e.target.value as Condition })
              }
            >
              {CONDITIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Choice>
          </label>
        </div>
        <div className="fields">
          <label>
            구매 가격 (선택)
            <Field
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
            <Field
              aria-label="대표색"
              type="color"
              value={draft.color ?? '#888888'}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </label>
        </div>
        {error && (
          <Feedback role="alert" className="error">
            {error}
          </Feedback>
        )}
        <div className="actions">
          {!edit && (files.length > 1 || duplicate) && (
            <Control
              type="button"
              className="plain"
              disabled={busy}
              onClick={next}
            >
              건너뛰기
            </Control>
          )}
          <Control
            className="primary"
            aria-busy={busy}
            disabled={busy || (!edit && !prepared)}
          >
            <Icon name="check" />
            {busy ? '저장 중' : edit ? '변경 저장' : '옷장에 저장'}
          </Control>
        </div>
      </form>
    </Sheet>
  );
}
