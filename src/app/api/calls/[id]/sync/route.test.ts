import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallRow } from '@/lib/types';

const m = vi.hoisted(() => ({
  getCall: vi.fn(), updateCall: vi.fn(), getConversation: vi.fn(), finalizeCall: vi.fn(), failCall: vi.fn(),
}));
vi.mock('@/lib/repo', () => ({ getCall: m.getCall, updateCall: m.updateCall }));
vi.mock('@/lib/voice/elevenlabs', () => ({ getConversation: m.getConversation, MOCK_CONVERSATION: {} }));
vi.mock('@/lib/voice/finalize', () => ({ finalizeCall: m.finalizeCall, failCall: m.failCall }));

import { POST } from './route';

const CALL_ID = '33333333-3333-3333-3333-333333333333';
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const call = (over: Partial<CallRow> = {}) =>
  ({ id: CALL_ID, status: 'initiated', conversation_id: null, started_at: minutesAgo(0), ...over }) as CallRow;

const sync = (body: object = {}) => POST(
  new Request(`http://localhost/api/calls/${CALL_ID}/sync`, { method: 'POST', body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: CALL_ID }) },
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MOCK_CALL', '0');
});

describe('POST /api/calls/:id/sync', () => {
  it('waits while a browser call has not connected yet', async () => {
    m.getCall.mockResolvedValue(call({ started_at: minutesAgo(1) }));
    await sync();
    expect(m.failCall).not.toHaveBeenCalled();
  });

  it('fails a call that never connected, so the invoice can be retried', async () => {
    const stale = call({ started_at: minutesAgo(4) });
    m.getCall.mockResolvedValue(stale);
    await sync();
    expect(m.failCall).toHaveBeenCalledWith(stale, 'the call never connected');
  });

  it('stores the conversation id from the browser and follows the conversation', async () => {
    const started = call({ started_at: minutesAgo(4) });
    m.getCall.mockResolvedValue(started);
    m.getConversation.mockResolvedValue({ status: 'in-progress' });
    await sync({ conversationId: 'conv_1' });
    expect(m.updateCall).toHaveBeenCalledWith(CALL_ID, { conversationId: 'conv_1' });
    expect(m.updateCall).toHaveBeenCalledWith(CALL_ID, { status: 'in_progress' });
    expect(m.failCall).not.toHaveBeenCalled();
  });

  it('finalizes a finished conversation', async () => {
    const connected = call({ conversation_id: 'conv_1' });
    m.getCall.mockResolvedValue(connected);
    m.getConversation.mockResolvedValue({ status: 'done' });
    await sync();
    expect(m.finalizeCall).toHaveBeenCalledWith(connected, { status: 'done' });
  });
});
