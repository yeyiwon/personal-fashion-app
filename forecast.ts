export const forecastCities = {
  seoul: '서울',
  busan: '부산',
  jeju: '제주',
  tokyo: '도쿄',
  paris: '파리',
} as const;
export type ForecastCity = keyof typeof forecastCities;
interface ForecastPeriod {
  time: string;
  temperature: number;
  symbol: string;
}

function condition(symbol: string) {
  if (symbol.includes('thunder')) return '뇌우';
  if (symbol.includes('sleet')) return '진눈깨비';
  if (symbol.includes('snow')) return '눈';
  if (symbol.includes('rain')) return '비';
  if (symbol.includes('fog')) return '안개';
  if (symbol.includes('partlycloudy')) return '구름 조금';
  if (symbol.includes('cloudy')) return '흐림';
  if (symbol.includes('clearsky') || symbol.includes('fair')) return '맑음';
  return '기온 예보';
}

export async function getForecast(city: ForecastCity, signal?: AbortSignal) {
  const response = await fetch('/api/weather?city=' + city, { signal });
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('application/json')
  )
    throw Error('예보를 불러올 수 없어요. 날씨를 직접 선택해 주세요.');
  const data = await response.json();
  if (
    data.city !== city ||
    !Array.isArray(data.periods) ||
    !Number.isFinite(Date.parse(data.issuedAt))
  )
    throw Error('예보 형식을 확인할 수 없어요.');
  const now = Date.now();
  const periods = (data.periods as ForecastPeriod[]).filter(
    ({ time, temperature }) =>
      Math.abs(Date.parse(time) - now) <= 3 * 3600000 &&
      Number.isFinite(temperature),
  );
  const current = periods.sort(
    (a, b) =>
      Math.abs(Date.parse(a.time) - now) - Math.abs(Date.parse(b.time) - now),
  )[0];
  if (!current)
    throw Error(
      '현재 시간에 해당하는 예보가 없어요. 날씨를 직접 선택해 주세요.',
    );
  return {
    city,
    label: forecastCities[city],
    time: current.time,
    issuedAt: data.issuedAt as string,
    temperature: current.temperature,
    condition: condition(current.symbol || ''),
  };
}
