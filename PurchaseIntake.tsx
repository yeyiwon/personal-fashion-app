import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReceiptImport, {
  DemoPurchaseRows,
  type ReceiptChannel,
} from './ReceiptImport';
import { readReceiptMessage } from './receiptMessage';
import { portableSha256 } from './images';
import { CATEGORIES, type Category } from './domain';
import { IMAGE_ACCEPT, localImageProcessor } from './images';
import { addPurchaseGarment, addGarment } from './storage';
import { GarmentPhoto, Icon, message, usePhoto } from './presentation';
import { useStudio, type PageProps } from './studio';

import { visionAvailable } from './localVision';
import { jpegData } from './avatarLayers';

function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function PurchaseIntake({ page, go }: PageProps) {
  const { mode, setMode, garments, refresh, setActiveGarmentId, notify } =
    useStudio();
  const [purchaseForm, open] = useState(false);
  const [channel, setChannel] = useState<ReceiptChannel | null>(null);
  const [mail, setMail] = useState<{ text: string; file: File } | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [shop, setShop] = useState('');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<Category>('상의');
  const [price, setPrice] = useState('');
  const [photo, setPhoto] = useState<File>();
  const [receipt, setReceipt] = useState<File>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const preview = usePhoto(receipt ?? null);
  const [ocrReady, setOcrReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => { let live = true; if (receipt) void visionAvailable().then(value => {if (live) setOcrReady(value);}); return () => {live = false;}; }, [receipt]);
  const receiptVersion = useRef(0);
  async function readReceipt() {
    if (!preview || reading) return;
    const version = receiptVersion.current;
    setReading(true); setError('');
    try {
      const image = await jpegData(preview, 1440);
      const response = await fetch('/api/room-vision', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({task:'receipt', image}), signal:AbortSignal.timeout(40000)});
      if (!response.ok) throw Error('문자를 읽지 못했어요. 다시 시도하거나 직접 입력해 주세요.');
      const body = await response.json();
      if (version !== receiptVersion.current) return;
      const recognized = Array.isArray(body.lines) ? body.lines.filter((x:unknown):x is string => typeof x === 'string') : [];
      setLines(recognized);
      if (!recognized.length) setError('읽을 수 있는 텍스트가 없어요. 상품 정보를 직접 입력해 주세요.');
    } catch(e) { if(version === receiptVersion.current) setError(message(e)); }
    finally { if(version === receiptVersion.current) setReading(false); }
  }
  const isLink = page === 'purchase-link';
  const editing = isLink || purchaseForm;
  const records = garments.filter(
    (g) => g.purchase || (mode === 'sample' && g.price !== null),
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (mode !== 'personal') {
      setMode('personal');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const evidence = mail?.file ?? receipt;
      const sourceKey = evidence
        ? portableSha256(await evidence.arrayBuffer()) +
          ':' +
          name.trim().toLocaleLowerCase()
        : undefined;
      const draft = {
        name,
        category,
        price: price === '' ? null : Number(price),
        purchase: {
          url: url.trim(),
          shop: shop.trim(),
          purchasedAt: date,
          sourceKey,
        },
      };
      const item = photo
        ? await addGarment(draft, await localImageProcessor.prepare(photo))
        : await addPurchaseGarment(draft);
      await refresh();
      setActiveGarmentId(item.id);
      notify('구매 정보와 함께 내 옷장에 등록했어요.');
      go('garment');
    } catch (err) {
      setError(message(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function readMail(file: File) {
    try {
      const local = await readReceiptMessage(file);
      setMode('personal');
      setMail(local);
      setError('');
      setChannel(null);
      open(true);
    } catch (e) {
      setChannel(null);
      setError(message(e));
    }
  }
  if (channel)
    return (
      <ReceiptImport
        key={channel}
        channel={channel}
        close={() => setChannel(null)}
        readMail={(f) => void readMail(f)}
      />
    );
  if (!editing)
    return (
      <div className="wc">
        <div className="wc-title">
          <div>
            <h1>구매 내역</h1>
            <p>
              {mode === 'sample'
                ? '샘플 주문을 선택해 가져오기를 체험해 보세요.'
                : '구매일과 판매처를 함께 기록한 옷이에요.'}
            </p>
          </div>
        </div>
        <div className="wc-actions">
          <button
            className="wc-solid"
            onClick={() => {
              setMode('personal');
              open(true);
            }}
          >
            구매 내역 캡처 등록
          </button>
          <button
            className="wc-outline"
            onClick={() => {
              setMode('personal');
              go('purchase-link');
            }}
          >
            상품 링크 입력
          </button>
        </div>
        <div className="wc-list">
          {(
            [
              ['email', '이메일 주문서', '선택한 .eml 파일 · 이메일 연결 과정'],
              ['mall', '승인 쇼핑몰', '연동 상태와 주문 선택'],
            ] as const
          ).map(([key, title, desc]) => (
            <button
              className="wc-row"
              key={key}
              onClick={() => setChannel(key)}
            >
              <Icon name="layer" />
              <span>
                <strong>{title}</strong>
                <small>{desc}</small>
              </span>
              <Icon name="right" size={16} />
            </button>
          ))}
        </div>
        {error && (
          <p className="wc-alert" role="alert">
            {error}
          </p>
        )}
        {mode === 'sample' && <DemoPurchaseRows go={go} />}
        {records.length ? (
          <div className="wc-ledger">
            {records.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveGarmentId(item.id);
                  go('garment');
                }}
              >
                <span className="wc-ledger-img">
                  <GarmentPhoto item={item} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.purchase?.shop || item.category}{' '}
                    {item.purchase?.purchasedAt || '· 샘플'}
                  </small>
                </span>
                <b>
                  {item.price === null
                    ? '금액 미입력'
                    : item.price.toLocaleString('ko-KR') + '원'}
                </b>
              </button>
            ))}
          </div>
        ) : mode === 'sample' ? null : (
          <div className="wc-empty">
            <Icon name="save" size={31} />
            <h2>구매 기록이 없어요</h2>
            <p>첫 구매 내역이나 상품 링크를 입력해 보세요.</p>
          </div>
        )}
      </div>
    );
  return (
    <div className="wc wc-narrow">
      <div className="wc-title">
        <div>
          <h1>{isLink ? '상품 링크 등록' : '구매 내역 등록'}</h1>
          <p>확인한 상품 정보를 내 옷장에 보관해요.</p>
        </div>
      </div>
      {mode === 'sample' ? (
        <div className="wc-empty">
          <p>구매 정보는 개인 옷장에 저장해요.</p>
          <button className="wc-solid" onClick={() => setMode('personal')}>
            내 옷장에서 등록하기
          </button>
        </div>
      ) : (
        <form className="wc-fields" onSubmit={submit}>
          {mail && (
            <details open>
              <summary>선택한 주문 이메일</summary>
              <pre className="wc-mail">{mail.text}</pre>
              <p className="wc-hint">
                확인할 상품 정보만 아래에 입력해 주세요. 이메일 본문은 저장되지
                않아요.
              </p>
            </details>
          )}
          {isLink ? (
            <label>
              상품 링크
              <input
                required
                type="url"
                placeholder="https://shop.example.com/item"
                maxLength={2048}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                구매 내역 캡처 <small>선택 · 이 화면에서만 확인</small>
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    receiptVersion.current++; setLines([]); setReading(false); setOcrReady(false);
                    if (f && f.size > 16 * 1024 * 1024) {
                      setError('16MB 이하의 캡처를 선택해 주세요.');
                      e.target.value = '';
                      setReceipt(undefined);
                    } else {
                      setReceipt(f);
                      setError('');
                    }
                  }}
                />
              </label>
              {preview && (
                <img
                  className="wc-receipt"
                  src={preview}
                  alt="입력할 때 참고하는 구매 내역"
                />
              )}
              {preview && ocrReady && <button type="button" className="wc-outline" onClick={()=>void readReceipt()} disabled={reading}>{reading ? '기기에서 읽는 중…' : '캡처에서 상품명 읽기'}</button>}
              {lines.length>0 && <div className="receipt-lines"><p>상품명으로 사용할 줄을 선택하세요.</p>{lines.map((line,i)=><button type="button" key={i} onClick={()=>setName(line.slice(0,80))}>{line}</button>)}</div>}
            </>
          )}
          <label>
            상품 이름
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="wc-cols">
            <label>
              분류
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              구매일
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <label>
            판매처 <small>선택</small>
            <input
              maxLength={100}
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
          </label>
          <label>
            구매 가격 <small>선택 · 원</small>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="9999999999"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          {!isLink && (
            <label>
              상품 링크 <small>선택</small>
              <input
                type="url"
                maxLength={2048}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </label>
          )}
          <label>
            의류 사진 <small>선택 · 옷장에 저장</small>
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              onChange={(e) => setPhoto(e.target.files?.[0])}
            />
          </label>
          {error && (
            <p role="alert" className="wc-alert">
              {error}
            </p>
          )}
          <button className="wc-solid full" disabled={busy}>
            {busy ? '저장 중' : '옷장에 등록'}
          </button>
        </form>
      )}
    </div>
  );
}
