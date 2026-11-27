export const styleTools = ['outfit', 'palette', 'shopping', 'weather'] as const;
export type StyleTool = (typeof styleTools)[number];

export function readLocalIntent(question: string): StyleTool[] {
  const requested: StyleTool[] = [];
  if (/날씨|기온|추운|더운|비가|비 오는|눈 오는/.test(question))
    requested.push('weather');
  if (/컬러|색|팔레트|배색|톤/.test(question)) requested.push('palette');
  if (/구매|쇼핑|가격|사고|살까|사도|사는/.test(question))
    requested.push('shopping');
  if (/코디|입|조합|셔츠|재킷|출근|데이트|여행|옷장/.test(question))
    requested.push('outfit');
  return requested;
}

interface Session {
  prompt(
    input: string,
    options: { responseConstraint: object; signal: AbortSignal },
  ): Promise<string>;
  destroy(): void;
}
interface DeviceModel {
  availability(options: object): Promise<string>;
  create(options: object): Promise<Session>;
}
const options = {
  expectedInputs: [{ type: 'text', languages: ['ko'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
function device() {
  return (globalThis as typeof globalThis & { LanguageModel?: DeviceModel })
    .LanguageModel;
}
export async function deviceStylistAvailable() {
  try {
    return (await device()?.availability(options)) === 'available';
  } catch {
    return false;
  }
}
export async function deviceIntents(
  question: string,
  signal: AbortSignal,
): Promise<StyleTool[]> {
  const model = device();
  if (!model || !(await deviceStylistAvailable()))
    throw Error('기기 모델을 사용할 수 없어요.');
  signal.throwIfAborted();
  const session = await model.create({ ...options, signal });
  try {
    const schema = {
      type: 'object',
      properties: {
        tools: {
          type: 'array',
          uniqueItems: true,
          maxItems: 4,
          items: { type: 'string', enum: styleTools },
        },
      },
      required: ['tools'],
      additionalProperties: false,
    };
    const prompt =
      '한국어 스타일링 요청에 필요한 도구만 골라 주세요. outfit은 보유한 옷의 코디, palette는 색 조합, shopping은 구매 전 비교, weather는 날씨와 일정입니다. 관련 없는 요청은 빈 배열로 반환하세요. 요청: ' +
      question;
    const value: unknown = JSON.parse(
      await session.prompt(prompt, { responseConstraint: schema, signal }),
    );
    if (
      !value ||
      typeof value !== 'object' ||
      !('tools' in value) ||
      !Array.isArray(value.tools) ||
      value.tools.length > 4 ||
      value.tools.some((key: unknown) => !styleTools.includes(key as StyleTool))
    )
      throw Error('응답을 해석할 수 없어요.');
    return [...new Set(value.tools as StyleTool[])];
  } finally {
    session.destroy();
  }
}
