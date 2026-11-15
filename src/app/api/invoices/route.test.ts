import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/lib/rate-limit';

const processInvoice = vi.fn(async () => ({ id: 'inv1', status: 'approved' }));
vi.mock('@/lib/pipeline', () => ({ processInvoice }));
vi.mock('@/lib/repo', () => ({ listInvoices: vi.fn(async () => []) }));

const upload = (bytes: Uint8Array<ArrayBuffer>, name = 'invoice.pdf', type = 'application/pdf', ip = '9.9.9.9') => {
  const form = new FormData();
  form.append('file', new File([bytes], name, { type }));
  return new Request('https://x.test/api/invoices', { method: 'POST', body: form, headers: { 'x-forwarded-for': ip } });
};

describe('POST /api/invoices', () => {
  beforeEach(() => {
    resetRateLimits();
    processInvoice.mockClear();
  });

  it('processes a PDF', async () => {
    const { POST } = await import('./route');
    const res = await POST(upload(new TextEncoder().encode('%PDF-1.4 test')));
    expect(res.status).toBe(201);
    expect(processInvoice).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'application/pdf' }));
  });

  it('rejects a non-invoice file with 400 and never calls the pipeline', async () => {
    const { POST } = await import('./route');
    const res = await POST(upload(new TextEncoder().encode('MZ executable'), 'invoice.pdf'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/PDF, PNG or JPEG/);
    expect(processInvoice).not.toHaveBeenCalled();
  });

  it('rejects a file over 4 MB with 413', async () => {
    const { POST } = await import('./route');
    const big = new Uint8Array(4 * 1024 * 1024 + 10);
    big.set(new TextEncoder().encode('%PDF-'));
    const res = await POST(upload(big));
    expect(res.status).toBe(413);
    expect(processInvoice).not.toHaveBeenCalled();
  });

  it('returns 429 after 10 uploads a minute from one IP', async () => {
    const { POST } = await import('./route');
    const pdf = new TextEncoder().encode('%PDF-1.4 test');
    for (let i = 0; i < 10; i++) expect((await POST(upload(pdf, 'a.pdf', 'application/pdf', '7.7.7.7'))).status).toBe(201);
    expect((await POST(upload(pdf, 'a.pdf', 'application/pdf', '7.7.7.7'))).status).toBe(429);
  });
});
