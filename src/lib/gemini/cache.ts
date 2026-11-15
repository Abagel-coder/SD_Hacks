import { createHash } from 'node:crypto';
import { getGeminiCache, putGeminiCache } from '../repo';

export type GeminiCacheKind = 'extract' | 'explain';

export function sha256(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Return the stored Gemini result for `kind:key`, or call Gemini and store what it returns.
 * The cache is a speed and quota optimisation only: any cache error falls through to a real call,
 * and a failed Gemini call is never stored.
 */
export async function cachedGemini<T>(kind: GeminiCacheKind, key: string, compute: () => Promise<T>): Promise<T> {
  const fullKey = `${kind}:${key}`;
  try {
    const hit = await getGeminiCache(fullKey);
    if (hit !== null && hit !== undefined) return hit as T;
  } catch (err) {
    console.error('Gemini cache read failed, calling Gemini', err);
  }
  const result = await compute();
  try {
    await putGeminiCache(fullKey, kind, result);
  } catch (err) {
    console.error('Gemini cache write failed', err);
  }
  return result;
}
