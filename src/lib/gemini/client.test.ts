import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { generateJson, generateText } = await import('./client');

const apiError = (status: number, message = `HTTP ${status}`) => Object.assign(new Error(message), { status });
const ok = (text: string) => ({ text });
const modelsCalled = () => generateContent.mock.calls.map(([req]) => (req as { model: string }).model);

describe('Gemini client retry and fallback', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_MODEL', 'primary-lite');
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'fallback-lite');
    vi.stubEnv('GEMINI_RETRY_DELAY_MS', '0');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    generateContent.mockReset();
  });

  it('retries the same model once after a rate limit (429)', async () => {
    generateContent.mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(ok('{"a":1}'));
    expect(await generateJson([{ type: 'text', text: 'x' }], {})).toEqual({ a: 1 });
    expect(modelsCalled()).toEqual(['primary-lite', 'primary-lite']);
  });

  it('falls back to the second model when the primary keeps failing (quota exhausted or overloaded)', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce(ok('explained'));
    expect(await generateText('why')).toBe('explained');
    expect(modelsCalled()).toEqual(['primary-lite', 'primary-lite', 'fallback-lite']);
  });

  it('treats a network failure (no HTTP status) as retryable', async () => {
    generateContent.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(ok('fine'));
    expect(await generateText('why')).toBe('fine');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not retry a request the API rejected as invalid (400)', async () => {
    generateContent.mockRejectedValue(apiError(400, 'bad schema'));
    await expect(generateText('why')).rejects.toThrow('bad schema');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('gives up after two tries when the fallback model is the same as the primary', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'primary-lite');
    generateContent.mockRejectedValue(apiError(429, 'quota'));
    await expect(generateText('why')).rejects.toThrow('quota');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('throws the fallback error when every attempt fails', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(503, 'fallback overloaded'));
    await expect(generateText('why')).rejects.toThrow('fallback overloaded');
    expect(generateContent).toHaveBeenCalledTimes(3);
  });
});
