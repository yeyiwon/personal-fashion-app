const clean = (value) =>
  typeof value === 'string'
    ? value
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .slice(0, 200)
    : '';
export default async function shopping(req, res) {
  const reply = (status, value) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
  };
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return reply(405, { error: 'GET 요청만 지원해요.' });
  }
  const params = new URL(req.url, 'http://localhost').searchParams;
  const query = params.get('q')?.trim() || '';
  if ([...params].length !== 1 || query.length < 2 || query.length > 60)
    return reply(400, { error: '검색어를 2~60자로 입력해 주세요.' });
  const { ADPICK_SHOPPING_ENABLED, ADPICK_API_KEY } = process.env;
  if (ADPICK_SHOPPING_ENABLED !== 'true' || !ADPICK_API_KEY)
    return reply(503, {
      error:
        '제휴 상품 검색은 연동 전이에요. 쇼핑몰에서 직접 검색할 수 있어요.',
    });
  try {
    const url = new URL(
      'https://biz.adpick.co.kr/api/' +
        encodeURIComponent(ADPICK_API_KEY) +
        '/search',
    );
    url.search = new URLSearchParams({ q: query, limit: '12' }).toString();
    const result = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(7500),
    });
    if (!result.ok)
      return reply(result.status === 429 ? 429 : 502, {
        error:
          result.status === 429
            ? '요청이 많아요. 1분 뒤에 다시 시도해 주세요.'
            : '검색 제공처에서 상품을 가져올 수 없어요.',
      });
    const json = await result.json(),
      observedAt = new Date().toISOString();
    if (json.success !== true || !Array.isArray(json.data)) throw Error();
    const items = json.data.flatMap((item) => {
      if (
        !item ||
        typeof item.commissionlink !== 'string' ||
        !item.commissionlink.startsWith('https://') ||
        !clean(item.title)
      )
        return [];
      const price = /^\d[\d,]*원?$/.test(String(item.price))
        ? Number(String(item.price).replace(/[,원]/g, ''))
        : null;
      return [
        {
          id: item.commissionlink,
          title: clean(item.title),
          price: Number.isSafeInteger(price) && price > 0 ? price : null,
          merchant: clean(item.cp_name),
          link: item.commissionlink,
          observedAt,
        },
      ];
    });
    return reply(200, { items });
  } catch {
    return reply(502, {
      error: '쇼핑 제공처에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
    });
  }
}
