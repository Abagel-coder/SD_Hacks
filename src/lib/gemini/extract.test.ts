import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('../repo', () => ({
  getGeminiCache: vi.fn(async (key: string) => store.get(key) ?? null),
  putGeminiCache: vi.fn(async (key: string, _kind: string, value: unknown) => { store.set(key, value); }),
}));
vi.mock('./client', () => ({ generateJson: vi.fn() }));

const { generateJson } = await import('./client');
const { extractInvoice } = await import('./extract');

const RAW = {
  vendorName: 'Uline', invoiceNumber: 'ULI-2026-11', senderEmail: 'billing@u1ine.com', amount: 4870,
  currency: 'USD', bankAccount: '000123456789', bankRouting: '110000000', dueDate: '2026-11-16',
  invoiceDate: '2026-11-14', urgencyPhrases: ['pay today'], secrecyPhrases: [], phoneOnInvoice: '',
};

describe('extractInvoice cache', () => {
  beforeEach(() => {
    vi.stubEnv('MOCK_GEMINI', '0');
    vi.mocked(generateJson).mockResolvedValue(RAW);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    store.clear();
  });

  it('reads the same file only once', async () => {
    const file = { bytes: Buffer.from('%PDF scam'), mimeType: 'application/pdf' };
    const first = await extractInvoice(file);
    const second = await extractInvoice(file);
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('still applies the sender email typed by the user to a cached result', async () => {
    const file = { bytes: Buffer.from('%PDF scam'), mimeType: 'application/pdf' };
    await extractInvoice(file);
    const out = await extractInvoice(file, 'ap@uline.com');
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(out.senderDomain).toBe('uline.com');
  });

  it('calls Gemini again for a different file', async () => {
    await extractInvoice({ bytes: Buffer.from('%PDF one'), mimeType: 'application/pdf' });
    await extractInvoice({ bytes: Buffer.from('%PDF two'), mimeType: 'application/pdf' });
    expect(generateJson).toHaveBeenCalledTimes(2);
  });
});
