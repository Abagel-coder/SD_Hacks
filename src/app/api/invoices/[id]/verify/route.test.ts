import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/lib/rate-limit';

const getActiveCallForInvoice = vi.fn();
const startVerificationCall = vi.fn();
vi.mock('@/lib/repo', () => ({ getActiveCallForInvoice }));
vi.mock('@/lib/voice/start-call', () => ({ CallStartError: class extends Error {}, startVerificationCall }));

const call = () => new Request('https://x.test', { method: 'POST', body: '{"channel":"browser"}', headers: { 'x-forwarded-for': '3.3.3.3' } });
const params = { params: Promise.resolve({ id: 'inv1' }) };

describe('POST /api/invoices/[id]/verify', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.clearAllMocks();
  });

  it('returns the call already in progress instead of starting another', async () => {
    getActiveCallForInvoice.mockResolvedValue({ id: 'call1', channel: 'browser' });
    const { POST } = await import('./route');
    const res = await POST(call(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ callId: 'call1', channel: 'browser', existing: true });
    expect(startVerificationCall).not.toHaveBeenCalled();
  });

  it('starts a call when none is running', async () => {
    getActiveCallForInvoice.mockResolvedValue(null);
    startVerificationCall.mockResolvedValue({ callId: 'call2', channel: 'browser' });
    const { POST } = await import('./route');
    expect(await (await POST(call(), params)).json()).toEqual({ callId: 'call2', channel: 'browser' });
  });
});
