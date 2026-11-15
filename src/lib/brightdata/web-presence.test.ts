import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ googleSearch: vi.fn() }));
const { googleSearch } = await import('./client');
const { lookupWebPresence } = await import('./web-presence');

const r = (link: string, title = '', description = '') => ({ link, title, description });
afterEach(() => vi.clearAllMocks());

describe('lookupWebPresence', () => {
  it('searches for the exact domain with Google autocorrect off', async () => {
    vi.mocked(googleSearch).mockResolvedValue([r('https://www.uline.com/')]);
    await lookupWebPresence('uline.com');
    expect(googleSearch).toHaveBeenCalledWith('"uline.com"', { noAutocorrect: true });
  });

  it('counts results hosted on the domain or mentioning it in the title or snippet', async () => {
    vi.mocked(googleSearch).mockResolvedValue([
      r('https://www.uline.com/'),
      r('https://news.example.com/a', 'Shipping from uline.com', ''),
      r('https://other.example.com/b', '', 'Order at Uline.com today'),
      r('https://unrelated.example.com/c', 'Packaging tips', 'Boxes and tape'),
    ]);
    expect(await lookupWebPresence('uline.com')).toEqual({ results: 4, mentions: 3 });
  });

  it('reports zero mentions when Google only returns unrelated pages (the demo scam domain)', async () => {
    vi.mocked(googleSearch).mockResolvedValue([r('https://www.linkedin.com/pulse/x'), r('https://www.uline.com/')]);
    expect(await lookupWebPresence('u1ine.com')).toEqual({ results: 2, mentions: 0 });
  });

  it('returns null (unknown), never zero, when both queries fail or come back empty', async () => {
    vi.mocked(googleSearch).mockRejectedValue(new Error('Bright Data upstream 502'));
    expect(await lookupWebPresence('u1ine.com')).toBeNull();
    vi.mocked(googleSearch).mockResolvedValue([]);
    expect(await lookupWebPresence('u1ine.com')).toBeNull();
  });

  it('retries with a different query after a failure, so Bright Data\'s "recently failed" block does not apply', async () => {
    vi.mocked(googleSearch)
      .mockRejectedValueOnce(new Error('Bright Data upstream 502: redirect location was rejected'))
      .mockResolvedValueOnce([r('https://www.linkedin.com/pulse/x')]);
    expect(await lookupWebPresence('u1ine.com')).toEqual({ results: 1, mentions: 0 });
    expect(vi.mocked(googleSearch).mock.calls.map((c) => c[0])).toEqual(['"u1ine.com"', '"u1ine.com" invoice']);
  });

  it('retries the same way when the first query comes back empty', async () => {
    vi.mocked(googleSearch).mockResolvedValueOnce([]).mockResolvedValueOnce([r('https://a.example.com/'), r('https://b.example.com/')]);
    expect(await lookupWebPresence('u1ine.com')).toEqual({ results: 2, mentions: 0 });
  });
});

