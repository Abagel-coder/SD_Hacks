import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallRow } from '../types';

const m = vi.hoisted(() => ({
  claimCall: vi.fn(), updateCall: vi.fn(), logAudit: vi.fn(), applyDecision: vi.fn(), generateJson: vi.fn(),
}));
vi.mock('../repo', () => ({ claimCall: m.claimCall, updateCall: m.updateCall }));
vi.mock('../audit', () => ({ logAudit: m.logAudit }));
vi.mock('../decision', () => ({ applyDecision: m.applyDecision }));
vi.mock('../gemini/client', () => ({ generateJson: m.generateJson }));

import { MOCK_CONVERSATION } from './elevenlabs';
import { failCall, finalizeCall } from './finalize';

const call = {
  id: '33333333-3333-3333-3333-333333333333', invoice_id: '22222222-2222-2222-2222-222222222222',
  channel: 'phone', number_dialed: '+16195550101', challenge_answer: '1284.5',
} as CallRow;

const answered = (confirmed: string, amount: number) => ({
  conversation_id: 'conv_1',
  transcript: [{ role: 'user' as const, message: 'Yes, that was us.' }],
  analysis: { data_collection_results: { bank_change_confirmed: { value: confirmed }, stated_amount: { value: amount } } },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MOCK_GEMINI', '1');
  m.claimCall.mockResolvedValue(true);
});

describe('finalizeCall', () => {
  it('blocks on the mock "we never changed banks" call', async () => {
    await finalizeCall(call, MOCK_CONVERSATION);
    expect(m.updateCall).toHaveBeenCalledWith(call.id, expect.objectContaining({ outcome: 'denied' }));
    expect(m.updateCall.mock.calls[0][1].transcript).toHaveLength(5);
    expect(m.applyDecision).toHaveBeenCalledWith(call.invoice_id, call.id, 'denied');
  });

  it('confirms only when the vendor also knows the past invoice amount', async () => {
    await finalizeCall(call, answered('yes', 1284.5));
    expect(m.applyDecision).toHaveBeenLastCalledWith(call.invoice_id, call.id, 'confirmed');
    await finalizeCall(call, answered('yes', 1500));
    expect(m.applyDecision).toHaveBeenLastCalledWith(call.invoice_id, call.id, 'unclear');
  });

  it('strips expressive voice tags and empty turns from the transcript', async () => {
    await finalizeCall(call, {
      ...MOCK_CONVERSATION,
      transcript: [
        { role: 'agent', message: '[relieved] Thank you for confirming that.' },
        { role: 'agent', message: null },
        { role: 'agent', message: '[concerned] ' },
      ],
    });
    expect(m.updateCall.mock.calls[0][1].transcript).toEqual([
      { role: 'agent', message: 'Thank you for confirming that.' },
    ]);
  });

  it('does nothing when another request already finished the call', async () => {
    m.claimCall.mockResolvedValue(false);
    await finalizeCall(call, MOCK_CONVERSATION);
    expect(m.updateCall).not.toHaveBeenCalled();
    expect(m.applyDecision).not.toHaveBeenCalled();
  });

  it('asks Gemini to read the transcript when data collection is missing', async () => {
    vi.stubEnv('MOCK_GEMINI', '0');
    m.generateJson.mockResolvedValue({ bankChangeConfirmed: 'No', statedAmount: 0 });
    await finalizeCall(call, { ...MOCK_CONVERSATION, analysis: {} });
    expect(m.generateJson).toHaveBeenCalledOnce();
    expect(m.applyDecision).toHaveBeenCalledWith(call.invoice_id, call.id, 'denied');
  });

  it('treats a missing analysis as unclear when Gemini is mocked', async () => {
    await finalizeCall(call, { ...MOCK_CONVERSATION, analysis: {} });
    expect(m.applyDecision).toHaveBeenCalledWith(call.invoice_id, call.id, 'unclear');
  });
});

describe('failCall', () => {
  it('returns the invoice to frozen once', async () => {
    await failCall(call, 'busy');
    expect(m.claimCall).toHaveBeenCalledWith(call.id, 'failed');
    expect(m.applyDecision).toHaveBeenCalledWith(call.invoice_id, call.id, 'failed');
    m.claimCall.mockResolvedValue(false);
    await failCall(call, 'busy');
    expect(m.applyDecision).toHaveBeenCalledOnce();
  });
});
