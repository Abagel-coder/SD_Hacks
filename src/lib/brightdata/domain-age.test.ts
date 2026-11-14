import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ fetchPage: vi.fn() }));
const { fetchPage } = await import('./client');
const { lookupDomainAgeDays } = await import('./domain-age');

const rdap = (registered: string) => ({ events: [{ eventAction: 'registration', eventDate: registered }] });
const never = () => new Promise<never>(() => {});
const respond = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue(new Response(body === undefined ? '' : JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('lookupDomainAgeDays', () => {
  it('treats a direct RDAP 404 as "not registered" without waiting for a hanging Web Unlocker', async () => {
    vi.mocked(fetchPage).mockImplementation(never);
    vi.stubGlobal('fetch', respond(404));
    const started = Date.now();
    expect(await lookupDomainAgeDays('u1ine.com')).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('returns the age from whichever source answers first', async () => {
    vi.mocked(fetchPage).mockImplementation(never);
    vi.stubGlobal('fetch', respond(200, rdap('1995-12-02T05:00:00Z')));
    expect(await lookupDomainAgeDays('uline.com')).toBeGreaterThan(11_000);
  });

  it('uses Web Unlocker when the direct request fails', async () => {
    vi.mocked(fetchPage).mockResolvedValue(JSON.stringify(rdap('1995-12-02T05:00:00Z')));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await lookupDomainAgeDays('uline.com')).toBeGreaterThan(11_000);
  });

  it('returns null when both sources fail', async () => {
    vi.mocked(fetchPage).mockRejectedValue(new Error('upstream 502'));
    vi.stubGlobal('fetch', respond(500));
    expect(await lookupDomainAgeDays('uline.com')).toBeNull();
  });
});
