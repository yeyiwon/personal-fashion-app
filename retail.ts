export interface RetailOffer {
  id: string;
  title: string;
  price: number | null;
  merchant: string;
  link: string;
  observedAt: string;
}
export async function searchRetail(
  query: string,
  signal?: AbortSignal,
): Promise<RetailOffer[]> {
  const res = await fetch(
    '/api/shopping?q=' + encodeURIComponent(query.trim()),
    { signal },
  );
  if (!res.headers.get('content-type')?.includes('application/json'))
    throw Error('이 환경에서는 제휴 쇼핑 연동을 사용할 수 없어요.');
  const json = await res.json();
  if (!res.ok || !Array.isArray(json.items))
    throw Error(
      typeof json.error === 'string' ? json.error : '상품을 불러오지 못했어요.',
    );
  return json.items as RetailOffer[];
}
