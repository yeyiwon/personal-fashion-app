import {
  parseRecognition,
  type RecognitionProvider,
  type RecognitionResult,
} from './providers';
// Explicit fixture injection only. The app's runtime does not import this module.
export function mockRecognition(
  result: Omit<RecognitionResult, 'source'>
): RecognitionProvider {
  return {
    async recognize() {
      return parseRecognition({ ...result, source: 'mock' });
    },
  };
}
