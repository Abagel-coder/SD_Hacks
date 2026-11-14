import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_EXTRACTED, MOCK_INTEL } from './mocks';
import { fallbackExplanation, processInvoice } from './pipeline';
import * as repo from './repo';
import type { InvoiceRow, VendorRow } from './types';

vi.mock('./repo', () => ({
  findVendorByName: vi.fn(),
  insertInvoice: vi.fn(),
  saveVendorIntel: vi.fn(),
  findBlocklistHits: vi.fn(),
  saveRisk: vi.fn(),
}));
vi.mock('./audit', () => ({ logAudit: vi.fn() }));
vi.mock('./gemini/extract', () => ({ extractInvoice: vi.fn(async () => MOCK_EXTRACTED) }));
vi.mock('./gemini/explain', () => ({ explainRisk: vi.fn(async () => 'explained') }));
vi.mock('./brightdata/verify-vendor', () => ({ verifyVendor: vi.fn(async () => MOCK_INTEL) }));

describe('fallbackExplanation', () => {
  it('says so when there are no risk signals', () => {
    expect(fallbackExplanation({ score: 0, reasons: [], freeze: false }))
      .toBe("No risk signals found. This invoice matches the vendor's history.");
  });

  it('joins the reason details after the score', () => {
    const text = fallbackExplanation({
      score: 70, freeze: true,
      reasons: [
        { code: 'BANK_CHANGED', points: 40, detail: 'Bank account changed.' },
        { code: 'LOOKALIKE_DOMAIN', points: 30, detail: 'Domain imitates uline.com.' },
      ],
    });
    expect(text).toBe('Risk score 70 out of 100. Bank account changed. Domain imitates uline.com.');
  });
});

describe('processInvoice vendor intel caching', () => {
  const vendor = { id: '11111111-1111-1111-1111-111111111111', name: 'Uline', intel: null } as VendorRow;
  const input = { bytes: Buffer.from('pdf'), mimeType: 'application/pdf', fileName: 'scam-uline.pdf' };

  beforeEach(() => {
    vi.mocked(repo.findVendorByName).mockResolvedValue(vendor);
    vi.mocked(repo.insertInvoice).mockResolvedValue({ id: 'inv-1' } as InvoiceRow);
    vi.mocked(repo.findBlocklistHits).mockResolvedValue([]);
    vi.mocked(repo.saveRisk).mockImplementation(async (id, r) => ({ id, status: r.status }) as InvoiceRow);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('does not save mocked Bright Data intel onto the vendor', async () => {
    vi.stubEnv('MOCK_BRIGHTDATA', '1');
    await processInvoice(input);
    expect(repo.saveVendorIntel).not.toHaveBeenCalled();
  });

  it('saves live Bright Data intel onto the vendor', async () => {
    vi.stubEnv('MOCK_BRIGHTDATA', '0');
    await processInvoice(input);
    expect(repo.saveVendorIntel).toHaveBeenCalledWith(vendor.id, MOCK_INTEL);
  });
});
