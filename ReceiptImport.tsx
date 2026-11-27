import { Choice, Control, Feedback, Field } from './LiquidControls';
import { useState, useRef } from 'react';
import { type StudioGarment, useScopedState, useStudio } from './studio';
import { GarmentPhoto, Icon } from './presentation';

export type ReceiptChannel = 'email' | 'mall';
export interface DemoReceipt {
  id: string;
  garment: string;
  name: string;
  shop: string;
  date: string;
  price: number;
}
const fixtures: DemoReceipt[] = [
  {
    id: 'demo-winter-102-1',
    garment: 'sample-trench',
    name: '크롭 트렌치',
    shop: '스튜디오 02',
    date: '2026-11-12',
    price: 149000,
  },
  {
    id: 'demo-winter-108-1',
    garment: 'sample-bag',
    name: '에스프레소 숄더백',
    shop: '스튜디오 02',
    date: '2026-11-19',
    price: 79000,
  },
  {
    id: 'demo-winter-114-1',
    garment: 'sample-merino',
    name: '네이비 메리노 니트',
    shop: '룸 편집숍',
    date: '2026-11-21',
    price: 68000,
  },
];
export function DemoPurchaseRows({ go }: { go: (s: string) => void }) {
  const { garments, setActiveGarmentId } = useStudio();
  const [receipts] = useScopedState<DemoReceipt[]>('receipt-examples', []);
  if (!receipts.length) return null;
  return (
    <div className="wc-ledger">
      <h2>가져온 샘플 주문</h2>
      {receipts.map((row) => (
        <OrderRow
          row={row}
          item={garments.find((g) => g.id === row.garment)}
          key={row.id}
          onClick={() => {
            setActiveGarmentId(row.garment);
            go('garment');
          }}
        />
      ))}
    </div>
  );
}
function OrderRow({
  row,
  item,
  onClick,
}: {
  row: DemoReceipt;
  item?: StudioGarment;
  onClick: () => void;
}) {
  return (
    <Control onClick={onClick}>
      <span className="wc-ledger-img">
        {item && <GarmentPhoto item={item} />}
      </span>
      <span>
        <strong>{row.name}</strong>
        <small>{row.date} · 샘플</small>
      </span>
      <b>{row.price.toLocaleString('ko-KR')}원</b>
    </Control>
  );
}

export default function ReceiptImport({
  channel,
  close,
  readMail,
}: {
  channel: ReceiptChannel;
  close: () => void;
  readMail: (file: File) => void;
}) {
  const { mode, setMode, garments, notify } = useStudio();
  const [saved, setSaved] = useScopedState<DemoReceipt[]>(
    'receipt-examples',
    [],
  );
  const [stage, setStage] = useState<'scope' | 'pick' | 'confirm'>('scope');
  const [agreed, setAgreed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [store, setStore] = useState('스튜디오 02');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const isMail = channel === 'email';
  const candidates = isMail
    ? fixtures
    : fixtures.filter((row) => row.shop === store);
  const pending = candidates.filter(
    (row) => selected.includes(row.id) && !saved.some((r) => r.id === row.id),
  );
  function startDemo() {
    setMode('sample');
    setStage('pick');
    setSelected([]);
  }
  function confirm() {
    if (mode !== 'sample' || !agreed || !pending.length) return;
    try {
      setSaved((prev) => [
        ...prev,
        ...pending.filter((row) => !prev.some((prior) => prior.id === row.id)),
      ]);
      notify('선택한 주문을 샘플 보관함에 담았어요.');
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장할 공간을 확인해 주세요.');
    }
  }
  return (
    <section className="wc wc-narrow">
      <Control className="wc-back" onClick={close}>
        <Icon name="back" size={16} />
        구매 내역
      </Control>
      <div className="wc-title">
        <div>
          <h1>{isMail ? '이메일 주문서' : '승인 쇼핑몰'}</h1>
          <p>
            {stage === 'scope'
              ? '가져올 정보 확인'
              : stage === 'pick'
                ? '샘플 주문 선택'
                : '가져오기 전 확인'}
          </p>
        </div>
      </div>
      {stage === 'scope' ? (
        <>
          <p className="wc-description">
            {isMail
              ? '이메일 계정 연동 전이에요. 기기에서 선택한 .eml 주문서를 열어 상품 정보를 확인하고 직접 기록할 수 있어요.'
              : '연동이 승인된 쇼핑몰은 아직 없어요. 샘플 주문으로 승인 이후의 가져오기 과정을 확인할 수 있어요.'}
          </p>
          <dl className="wc-facts">
            <div>
              <dt>확인할 정보</dt>
              <dd>상품명 · 판매처 · 구매일 · 가격</dd>
            </div>
            <div>
              <dt>저장 범위</dt>
              <dd>직접 선택한 상품 정보</dd>
            </div>
          </dl>
          <label className="wc-check">
            <Field
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            선택한 주문 정보만 확인하는 데 동의해요
          </label>
          <div className="wc-actions">
            {isMail && (
              <Control
                className="wc-solid"
                disabled={!agreed}
                onClick={() => file.current?.click()}
              >
                기기의 .eml 열기
              </Control>
            )}
            <Control
              className={isMail ? 'wc-outline' : 'wc-solid'}
              disabled={!agreed}
              onClick={startDemo}
            >
              샘플 주문으로 체험
            </Control>
          </div>
          <Field
            ref={file}
            type="file"
            hidden
            accept=".eml,message/rfc822"
            aria-label="주문 이메일 파일"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readMail(f);
              e.target.value = '';
            }}
          />
        </>
      ) : (
        <>
          <p className="wc-hint">
            예시 판매처·주문·가격이에요. 선택 결과는 샘플 옷장의 구매 내역에만
            보관해요.
          </p>
          {stage === 'pick' ? (
            <>
              {!isMail && (
                <label className="wc-form-label">
                  샘플 판매처
                  <Choice
                    value={store}
                    onChange={(e) => {
                      setStore(e.target.value);
                      setSelected([]);
                    }}
                  >
                    <option>스튜디오 02</option>
                    <option>룸 편집숍</option>
                  </Choice>
                </label>
              )}
              <div className="wc-order-list">
                {candidates.map((row) => {
                  const duplicate = saved.some((r) => r.id === row.id);
                  const item = garments.find((g) => g.id === row.garment);
                  return (
                    <label key={row.id}>
                      <Field
                        type="checkbox"
                        disabled={duplicate}
                        checked={!duplicate && selected.includes(row.id)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(row.id)
                              ? prev.filter((i) => i !== row.id)
                              : [...prev, row.id],
                          )
                        }
                      />
                      <span className="wc-ledger-img">
                        {item && <GarmentPhoto item={item} />}
                      </span>
                      <span>
                        <strong>{row.name}</strong>
                        <small>
                          {row.shop} · {row.price.toLocaleString('ko-KR')}원
                        </small>
                        {duplicate && <small>이미 가져온 주문</small>}
                      </span>
                    </label>
                  );
                })}
              </div>
              <Control
                className="wc-solid"
                disabled={!pending.length}
                onClick={() => setStage('confirm')}
              >
                선택한 {pending.length}건 확인
              </Control>
            </>
          ) : (
            <>
              <div className="wc-ledger">
                {pending.map((row) => (
                  <div className="wc-confirm-line" key={row.id}>
                    <strong>{row.name}</strong>
                    <small>
                      {row.shop} · {row.date}
                    </small>
                    <b>{row.price.toLocaleString('ko-KR')}원</b>
                  </div>
                ))}
              </div>
              <div className="wc-actions">
                <Control className="wc-outline" onClick={() => setStage('pick')}>
                  다시 선택
                </Control>
                <Control
                  className="wc-solid"
                  disabled={!pending.length}
                  onClick={confirm}
                >
                  샘플 구매 내역에 담기
                </Control>
              </div>
            </>
          )}
        </>
      )}
      {error && (
        <Feedback role="alert" className="wc-alert">
          {error}
        </Feedback>
      )}
    </section>
  );
}
