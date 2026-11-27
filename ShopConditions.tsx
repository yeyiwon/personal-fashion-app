import { useState } from 'react';
import { useScopedState, useStudio } from './studio';
import { products, won, type Product } from './atelierData';

type Offer = {
  name: string;
  discount: number;
  coupon: number;
  ship: number;
  stock: number;
};
const stores: Offer[] = [
  { name: '셀렉트숍 A', discount: 3000, coupon: 2000, ship: 3500, stock: 6 },
  { name: '셀렉트숍 B', discount: 0, coupon: 3000, ship: 0, stock: 2 },
  { name: '셀렉트숍 C', discount: 7000, coupon: 0, ship: 2500, stock: 0 },
];
export function OfferConditions({
  product,
  option,
}: {
  product: Product;
  option: string;
}) {
  const [apply, setApply] = useState(true);
  const rows = stores
    .map((s) => ({
      ...s,
      total: product.price - s.discount - (apply ? s.coupon : 0) + s.ship,
      stock:
        s.stock === 0
          ? 0
          : Math.max(
              0,
              s.stock - (option === 'S' ? 2 : option === 'L' ? 1 : 0),
            ),
    }))
    .sort((a, b) => Number(!a.stock) - Number(!b.stock) || a.total - b.total);
  return (
    <div className="at-offers">
      <p className="at-note">
        동일 상품 · {product.tone} · {option}. 할인과 재고는 판매 조건 예시예요.
      </p>
      <label className="at-coupon">
        <input
          type="checkbox"
          checked={apply}
          onChange={(e) => setApply(e.target.checked)}
        />
        사용 가능한 쿠폰 적용
      </label>
      {rows.map((r) => (
        <div className="at-offer" key={r.name}>
          <header>
            <strong>{r.name}</strong>
            <span>{r.stock ? '재고 ' + r.stock + '개' : '품절'}</span>
          </header>
          <dl>
            <div>
              <dt>정가</dt>
              <dd>{won(product.price)}</dd>
            </div>
            <div>
              <dt>즉시 할인</dt>
              <dd>−{won(r.discount)}</dd>
            </div>
            <div>
              <dt>쿠폰</dt>
              <dd>−{won(apply ? r.coupon : 0)}</dd>
            </div>
            <div>
              <dt>배송비</dt>
              <dd>{r.ship ? won(r.ship) : '무료'}</dd>
            </div>
          </dl>
          <footer>
            <span>배송비 포함</span>
            <strong>{won(r.total)}</strong>
          </footer>
        </div>
      ))}
    </div>
  );
}

type Rule = { id: string; target: number; option: string };
export function PriceAlerts({
  product,
  option,
  go,
}: {
  product: Product;
  option: string;
  go: (page: string) => void;
}) {
  const [rows, setRows] = useScopedState<Rule[]>('price-alerts', []);
  const [amount, setAmount] = useState(
    String(
      rows.find((r) => r.id === product.id && r.option === option)?.target ??
        product.price,
    ),
  );
  const { notify } = useStudio();
  return (
    <>
      <header className="at-heading">
        <div>
          <h1>가격 알림</h1>
          <p>상품과 옵션별로 원하는 가격을 기기에 보관해요.</p>
        </div>
      </header>
      <section className="at-alert-box">
        <h2>{product.name}</h2>
        <p className="at-product-meta">
          {product.tone} · {option} · 샘플 가격 {won(product.price)}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount);
            if (!Number.isSafeInteger(n) || n < 1 || n > 100000000) return;
            setRows((prev) => [
              { id: product.id, target: n, option },
              ...prev.filter((r) => r.id !== product.id || r.option !== option),
            ]);
            notify('목표 가격을 저장했어요.');
          }}
        >
          <label className="at-field">
            목표 가격 (원)
            <input
              type="number"
              min={1}
              step={1}
              max={100000000}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button className="at-smallbtn">조건 저장</button>
        </form>
        <p className="at-note">
          현재는 목표가 저장까지 가능해요. 실시간 가격 수집과 푸시 알림은
          제휴사·알림 서비스 연결 후 제공돼요.
        </p>
      </section>
      <h3>저장한 조건</h3>
      {rows.length ? (
        <ul className="at-alert-list">
          {rows.map((r) => (
            <li key={r.id + '-' + r.option}>
              <div>
                <strong>
                  {products.find((p) => p.id === r.id)?.name ?? '저장한 상품'}
                </strong>
                <p>
                  {r.option} · {won(r.target)} 이하
                </p>
              </div>
              <button
                onClick={() =>
                  setRows((prev) =>
                    prev.filter((x) => x.id !== r.id || x.option !== r.option),
                  )
                }
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="at-note">저장된 가격 조건이 없어요.</p>
      )}
      <button className="at-textbtn" onClick={() => go('wishlist')}>
        관심 상품으로
      </button>
    </>
  );
}
