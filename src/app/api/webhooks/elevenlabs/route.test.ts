import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  getCall: vi.fn(), getCallByConversationId: vi.fn(), finalizeCall: vi.fn(), failCall: vi.fn(),
}));
vi.mock('@/lib/repo', async () => ({
  isUuid: (await vi.importActual<typeof import('@/lib/repo')>('@/lib/repo')).isUuid,
  getCall: m.getCall, getCallByConversationId: m.getCallByConversationId,
}));
vi.mock('@/lib/voice/finalize', () => ({ finalizeCall: m.finalizeCall, failCall: m.failCall }));

import { POST } from './route';

const SECRET = 'wsec_test';
const CALL_ID = '33333333-3333-3333-3333-333333333333';
const call = { id: CALL_ID };

function signedRequest(body: object, secret = SECRET): Request {
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const v0 = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return new Request('http://localhost/api/webhooks/elevenlabs', {
    method: 'POST', headers: { 'ElevenLabs-Signature': `t=${t},v0=${v0}` }, body: raw,
  });
}

const transcription = {
  type: 'post_call_transcription',
  data: {
    conversation_id: 'conv_1',
    conversation_initiation_client_data: { dynamic_variables: { call_id: CALL_ID } },
    transcript: [{ role: 'user', message: 'No. We never changed banks.' }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', SECRET);
  vi.stubEnv('ELEVENLABS_API_KEY', 'sk_test');
  m.getCall.mockResolvedValue(call);
  m.getCallByConversationId.mockResolvedValue(null);
});

describe('POST /api/webhooks/elevenlabs', () => {
  it('reports missing configuration instead of a bad signature', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '');
    const res = await POST(signedRequest(transcription));
    expect(res.status).toBe(500);
    expect(m.finalizeCall).not.toHaveBeenCalled();
  });

  it('rejects a bad signature', async () => {
    const res = await POST(signedRequest(transcription, 'wrong-secret'));
    expect(res.status).toBe(401);
    expect(m.finalizeCall).not.toHaveBeenCalled();
  });

  it('finalizes the call named by the call_id dynamic variable', async () => {
    const res = await POST(signedRequest(transcription));
    expect(res.status).toBe(200);
    expect(m.getCall).toHaveBeenCalledWith(CALL_ID);
    expect(m.finalizeCall).toHaveBeenCalledWith(call, transcription.data);
  });

  it('falls back to the conversation id', async () => {
    const event = { ...transcription, data: { ...transcription.data, conversation_initiation_client_data: null } };
    m.getCallByConversationId.mockResolvedValue(call);
    await POST(signedRequest(event));
    expect(m.getCallByConversationId).toHaveBeenCalledWith('conv_1');
    expect(m.finalizeCall).toHaveBeenCalled();
  });

  it('fails the call on an initiation failure', async () => {
    await POST(signedRequest({ type: 'call_initiation_failure', data: { ...transcription.data, failure_reason: 'busy' } }));
    expect(m.failCall).toHaveBeenCalledWith(call, 'busy');
  });

  it('acknowledges events for unknown calls, such as dashboard tests', async () => {
    m.getCall.mockResolvedValue(null);
    const res = await POST(signedRequest(transcription));
    expect(await res.json()).toEqual({ received: true, ignored: 'no matching call' });
    expect(m.finalizeCall).not.toHaveBeenCalled();
  });
});
