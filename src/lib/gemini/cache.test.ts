import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repo', () => ({ getGeminiCache: vi.fn(), putGeminiCache: vi.fn() }));
const { getGeminiCache, putGeminiCache } = await import('../repo');
const { cachedGemini, sha256 } = await import('./cache');

afterEach(() => vi.clearAllMocks());

describe('sha256', () => {
  it('hashes bytes and strings the same way', () => {
    expect(sha256(Buffer.from('abc'))).toBe(sha256('abc'));
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('cachedGemini', () => {
  it('returns a cached result without calling Gemini', async () => {
    vi.mocked(getGeminiCache).mockResolvedValue({ vendorName: 'Uline' });
    const compute = vi.fn();
    expect(await cachedGemini('extract', 'k1', compute)).toEqual({ vendorName: 'Uline' });
    expect(compute).not.toHaveBeenCalled();
    expect(getGeminiCache).toHaveBeenCalledWith('extract:k1');
  });

  it('calls Gemini on a miss and stores the result', async () => {
    vi.mocked(getGeminiCache).mockResolvedValue(null);
    const compute = vi.fn().mockResolvedValue('explained');
    expect(await cachedGemini('explain', 'k2', compute)).toBe('explained');
    expect(compute).toHaveBeenCalledTimes(1);
    expect(putGeminiCache).toHaveBeenCalledWith('explain:k2', 'explain', 'explained');
  });

  it('still calls Gemini when the cache read fails (for example, the table is missing)', async () => {
    vi.mocked(getGeminiCache).mockRejectedValue(new Error('relation "gemini_cache" does not exist'));
    const compute = vi.fn().mockResolvedValue('fresh');
    expect(await cachedGemini('explain', 'k3', compute)).toBe('fresh');
  });

  it('still returns the result when the cache write fails', async () => {
    vi.mocked(getGeminiCache).mockResolvedValue(null);
    vi.mocked(putGeminiCache).mockRejectedValue(new Error('connection reset'));
    expect(await cachedGemini('explain', 'k4', async () => 'fresh')).toBe('fresh');
  });

  it('does not cache a Gemini failure', async () => {
    vi.mocked(getGeminiCache).mockResolvedValue(null);
    await expect(cachedGemini('extract', 'k5', async () => { throw new Error('429'); })).rejects.toThrow('429');
    expect(putGeminiCache).not.toHaveBeenCalled();
  });
});
