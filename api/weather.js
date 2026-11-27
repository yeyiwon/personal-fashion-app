const coordinates = {
  seoul: [37.5665, 126.978],
  busan: [35.1796, 129.0756],
  jeju: [33.4996, 126.5312],
  tokyo: [35.6762, 139.6503],
  paris: [48.8566, 2.3522],
};
const cache = new Map();
const inflight = new Map();
const threeHours = 3 * 3600 * 1000;

async function load(city) {
  const previous = cache.get(city);
  const now = Date.now();
  if (previous && previous.expires > now) return previous;
  const [lat, lon] = coordinates[city];
  const headers = {
    'User-Agent':
      'PersonalFashion/2.0 https://github.com/yeyiwon/personal-fashion-app',
    Accept: 'application/json',
  };
  if (previous?.modified) headers['If-Modified-Since'] = previous.modified;
  const response = await fetch(
    'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' +
      lat +
      '&lon=' +
      lon,
    {
      headers,
      signal: AbortSignal.timeout(8500),
    },
  );
  const expires = Math.max(
    now + threeHours,
    Date.parse(response.headers.get('expires') || '') || 0,
  );
  if (response.status === 304 && previous) {
    previous.expires = expires;
    return previous;
  }
  if (!response.ok) throw new Error('provider');
  const data = (await response.json()).properties;
  const issuedAt = data?.meta?.updated_at;
  if (
    !Number.isFinite(Date.parse(issuedAt)) ||
    !Array.isArray(data?.timeseries)
  )
    throw new Error('invalid forecast');
  const periods = data.timeseries
    .slice(0, 36)
    .map(({ time, data: period }) => ({
      time,
      temperature: period?.instant?.details?.air_temperature,
      symbol:
        period?.next_1_hours?.summary?.symbol_code ||
        period?.next_6_hours?.summary?.symbol_code ||
        '',
    }))
    .filter(
      (row) =>
        Number.isFinite(row.temperature) &&
        Number.isFinite(Date.parse(row.time)),
    );
  if (!periods.length) throw new Error('empty forecast');
  const next = {
    data: { city, issuedAt, periods },
    expires,
    modified: response.headers.get('last-modified'),
  };
  cache.set(city, next);
  return next;
}

export default async function weather(req, res) {
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
  const city = params.get('city');
  if ([...params].length !== 1 || !Object.hasOwn(coordinates, city))
    return reply(400, { error: '목록에서 도시를 선택해 주세요.' });
  try {
    if (!inflight.has(city))
      inflight.set(
        city,
        load(city).finally(() => inflight.delete(city)),
      );
    const result = await inflight.get(city);
    const seconds = Math.max(
      1,
      Math.ceil((result.expires - Date.now()) / 1000),
    );
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=' + seconds);
    return reply(200, result.data);
  } catch {
    return reply(503, {
      error: '날씨 제공처에 연결할 수 없어요. 직접 날씨를 선택해 주세요.',
    });
  }
}
