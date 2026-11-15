import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_EXTRACTED, MOCK_INTEL } from './mocks';
import { fallbackExplanation, processInvoice } from './pipeline';
import * as audit from './audit';
import * as embeddings from './embeddings';
import * as repo from './repo';
import { EMBEDDING_DIM } from './similar';
import type { InvoiceRow, VendorRow } from './types';

vi.mock('./repo', () => ({
  findVendorByName: vi.fn(),
  insertInvoice: vi.fn(),
  saveVendorIntel: vi.fn(),
  findBlocklistHits: vi.fn(),
  saveRisk: vi.fn(),
  saveInvoiceEmbedding: vi.fn(),
  findNearestBlocked: vi.fn(),
  saveSimilarScam: vi.fn(),
}));
vi.mock('./embeddings', () => ({ embedText: vi.fn() }));
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
    vi.mocked(embeddings.embedText).mockResolvedValue(new Array(EMBEDDING_DIM).fill(0.1));
    vi.mocked(repo.findNearestBlocked).mockResolvedValue(null);
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

describe('processInvoice similar-scam evidence', () => {
  const vendor = { id: '11111111-1111-1111-1111-111111111111', name: 'Uline', intel: null } as VendorRow;
  const input = { bytes: Buffer.from('pdf'), mimeType: 'application/pdf', fileName: 'scam-uline.pdf' };
  const blocked = { invoiceId: '33333333-3333-3333-3333-333333333333', blockedAt: '2026-11-14T16:26:00Z' };

  beforeEach(() => {
    vi.mocked(repo.findVendorByName).mockResolvedValue(vendor);
    vi.mocked(repo.insertInvoice).mockResolvedValue({ id: 'inv-1' } as InvoiceRow);
    vi.mocked(repo.findBlocklistHits).mockResolvedValue([]);
    vi.mocked(repo.saveRisk).mockImplementation(async (id, r) => ({ id, status: r.status }) as InvoiceRow);
    vi.mocked(embeddings.embedText).mockResolvedValue(new Array(EMBEDDING_DIM).fill(0.1));
  });

  afterEach(() => vi.clearAllMocks());

  const scoreSaved = () => vi.mocked(repo.saveRisk).mock.calls[0][1].risk;

  it('saves and audits a close match without changing the risk score', async () => {
    await processInvoice(input);
    const baseline = scoreSaved();
    vi.clearAllMocks();
    vi.mocked(repo.findVendorByName).mockResolvedValue(vendor);
    vi.mocked(repo.insertInvoice).mockResolvedValue({ id: 'inv-1' } as InvoiceRow);
    vi.mocked(repo.findBlocklistHits).mockResolvedValue([]);
    vi.mocked(repo.saveRisk).mockImplementation(async (id, r) => ({ id, status: r.status }) as InvoiceRow);
    vi.mocked(embeddings.embedText).mockResolvedValue(new Array(EMBEDDING_DIM).fill(0.1));
    vi.mocked(repo.findNearestBlocked).mockResolvedValue({ ...blocked, similarity: 0.97 });

    await processInvoice(input);

    expect(repo.saveInvoiceEmbedding).toHaveBeenCalledWith('inv-1', expect.any(Array));
    expect(repo.findNearestBlocked).toHaveBeenCalledWith(expect.any(Array), 'inv-1');
    expect(repo.saveSimilarScam).toHaveBeenCalledWith('inv-1', { ...blocked, similarity: 0.97 });
    expect(vi.mocked(audit.logAudit).mock.calls.map((c) => c[2])).toContain('similar_scam');
    expect(scoreSaved()).toEqual(baseline);
  });

  it('writes the block date in Pacific time in the audit message', async () => {
    vi.mocked(repo.findNearestBlocked).mockResolvedValue({
      ...blocked, blockedAt: '2026-11-15T00:26:00Z', similarity: 0.95,
    });
    await processInvoice(input);
    const call = vi.mocked(audit.logAudit).mock.calls.find((c) => c[2] === 'similar_scam');
    expect(call?.[5]).toContain('Similar to a scam blocked on Nov 14 (95% match)');
  });

  it('ignores a match below the threshold', async () => {
    vi.mocked(repo.findNearestBlocked).mockResolvedValue({ ...blocked, similarity: 0.5 });
    await processInvoice(input);
    expect(repo.saveInvoiceEmbedding).toHaveBeenCalled();
    expect(repo.saveSimilarScam).not.toHaveBeenCalled();
    expect(vi.mocked(audit.logAudit).mock.calls.map((c) => c[2])).not.toContain('similar_scam');
  });

  it('fails open when the embedding call fails', async () => {
    vi.mocked(embeddings.embedText).mockRejectedValue(new Error('quota'));
    const saved = await processInvoice(input);
    expect(saved.id).toBe('inv-1');
    expect(repo.saveInvoiceEmbedding).not.toHaveBeenCalled();
    expect(repo.findNearestBlocked).not.toHaveBeenCalled();
  });

  it('fails open when the vector query fails', async () => {
    vi.mocked(repo.findNearestBlocked).mockRejectedValue(new Error('extension "vector" is not available'));
    const saved = await processInvoice(input);
    expect(saved.id).toBe('inv-1');
    expect(repo.saveSimilarScam).not.toHaveBeenCalled();
  });
});
