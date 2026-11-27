import { type Category, CATEGORIES } from './domain';

// Only authenticated server adapters may exchange asset IDs for provider inputs.
export interface RecognitionInput {
  assetId: string;
  garmentId: string;
  consentId: string;
}
export interface RecognitionResult {
  category: Category;
  pattern: string | null;
  material: string | null;
  source: 'provider' | 'mock';
}
export interface RecognitionProvider {
  recognize(input: RecognitionInput): Promise<RecognitionResult>;
}
export interface FittingInput {
  modelId: string;
  garmentIds: string[];
  consentId: string;
  idempotencyKey: string;
}
export interface FittingProvider {
  enqueue(input: FittingInput): Promise<{ jobId: string; status: 'queued' }>;
}
export function parseRecognition(value: unknown): RecognitionResult {
  if (!value || typeof value !== 'object') throw Error('인식 응답 형식 오류');
  const row = value as Record<string, unknown>;
  if (
    !CATEGORIES.includes(row.category as Category) ||
    ![row.pattern, row.material].every(
      (v) => v === null || (typeof v === 'string' && v.length <= 100)
    ) ||
    !['mock', 'provider'].includes(String(row.source))
  )
    throw Error('인식 응답 값 오류');
  return {
    category: row.category as Category,
    material: row.material as string | null,
    pattern: row.pattern as string | null,
    source: row.source as RecognitionResult['source'],
  };
}
