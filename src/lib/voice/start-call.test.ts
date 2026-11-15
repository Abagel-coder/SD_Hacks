import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallRow, InvoiceRow, VendorRow } from '../types';

const m = vi.hoisted(() => ({
  getInvoice: vi.fn(), getVendor: vi.fn(), getVendorHistory: vi.fn(), setInvoiceStatus: vi.fn(),
  createCall: vi.fn(), updateCall: vi.fn(), logAudit: vi.fn(), placeOutboundCall: vi.fn(), failCall: vi.fn(),
}));
vi.mock('../repo', () => ({
  getInvoice: m.getInvoice, getVendor: m.getVendor, getVendorHistory: m.getVendorHistory,
  setInvoiceStatus: m.setInvoiceStatus, createCall: m.createCall, updateCall: m.updateCall,
}));
vi.mock('../audit', () => ({ logAudit: m.logAudit }));
vi.mock('./elevenlabs', () => ({ placeOutboundCall: m.placeOutboundCall }));
vi.mock('./finalize', () => ({ failCall: m.failCall }));

import { dynamicVariablesFor, startVerificationCall } from './start-call';

const PUBLIC_PHONE = '+18002955510';
const INVOICE_PHONE = '+15555550199';
const DEMO_PHONE = '+16195550101';

const invoice = {
  id: '22222222-2222-2222-2222-222222222222', vendor_id: '11111111-1111-1111-1111-111111111111',
  vendor_name: 'Uline', bank_account: '000123456789', status: 'frozen',
  intel: null, extracted: { phoneOnInvoice: INVOICE_PHONE },
} as unknown as InvoiceRow;
const vendor = { id: invoice.vendor_id, name: 'Uline', verified_phone: PUBLIC_PHONE } as VendorRow;
const call = {
  id: '33333333-3333-3333-3333-333333333333', invoice_id: invoice.id,
  challenge_question: 'What was the total amount on your September invoice to Harbor Coffee Roasters?',
  challenge_answer: '1284.5',
} as CallRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MOCK_CALL', '0');
  vi.stubEnv('BUSINESS_NAME', 'Harbor Coffee Roasters');
  m.getInvoice.mockResolvedValue(invoice);
  m.getVendor.mockResolvedValue(vendor);
  m.getVendorHistory.mockResolvedValue([
    { amount: 1367.9, invoice_date: '2026-10-28' }, { amount: 1284.5, invoice_date: '2026-09-28' },
  ]);
  m.setInvoiceStatus.mockResolvedValue(true);
  m.createCall.mockImplementation(async (f) => ({ ...call, number_dialed: f.numberDialed }));
  m.placeOutboundCall.mockResolvedValue({ conversationId: 'conv_1' });
});
afterEach(() => vi.unstubAllEnvs());

describe('dynamicVariablesFor', () => {
  it('spaces the last four digits and never includes the expected answer', () => {
    const vars = dynamicVariablesFor(invoice, call);
    expect(vars).toMatchObject({ vendor_name: 'Uline', bank_last4: '6 7 8 9', call_id: call.id });
    expect(JSON.stringify(vars)).not.toContain('1284');
    expect(vars.bank_account_phrase).toBe('a new bank account ending in 6 7 8 9');
  });

  it('never tells the agent "unknown" when the invoice has no bank account', () => {
    const vars = dynamicVariablesFor({ ...invoice, bank_account: null }, call);
    expect(vars.bank_account_phrase).toBe('a new bank account');
    expect(JSON.stringify(vars)).not.toContain('unknown');
  });
});

describe('startVerificationCall', () => {
  it('never falls back to the phone number printed on the invoice', async () => {
    vi.stubEnv('ALLOWED_CALL_NUMBERS', INVOICE_PHONE);
    vi.stubEnv('DEMO_CALL_NUMBER', '');
    await expect(startVerificationCall(invoice.id, 'phone')).rejects.toThrow(`Refusing to dial ${PUBLIC_PHONE}`);
    expect(m.placeOutboundCall).not.toHaveBeenCalled();
    expect(m.setInvoiceStatus).not.toHaveBeenCalled();
  });

  it('dials the demo number and sends the question but not the answer', async () => {
    vi.stubEnv('ALLOWED_CALL_NUMBERS', DEMO_PHONE);
    vi.stubEnv('DEMO_CALL_NUMBER', DEMO_PHONE);
    await expect(startVerificationCall(invoice.id, 'phone')).resolves.toEqual({ callId: call.id, channel: 'phone' });
    expect(m.createCall).toHaveBeenCalledWith(expect.objectContaining({
      numberFound: PUBLIC_PHONE, numberDialed: DEMO_PHONE, challengeAnswer: '1284.5',
    }));
    const [dialed, vars] = m.placeOutboundCall.mock.calls[0];
    expect(dialed).toBe(DEMO_PHONE);
    expect(vars.challenge_question).toContain('September');
    expect(JSON.stringify(vars)).not.toContain('1284');
    expect(m.updateCall).toHaveBeenCalledWith(call.id, { conversationId: 'conv_1' });
  });

  it('marks the call failed when ElevenLabs cannot place it', async () => {
    vi.stubEnv('ALLOWED_CALL_NUMBERS', DEMO_PHONE);
    vi.stubEnv('DEMO_CALL_NUMBER', DEMO_PHONE);
    m.placeOutboundCall.mockRejectedValue(new Error('trial account'));
    await expect(startVerificationCall(invoice.id, 'phone')).rejects.toThrow('trial account');
    expect(m.failCall).toHaveBeenCalledWith(expect.objectContaining({ id: call.id }), 'trial account');
  });

  it('only verifies a frozen invoice', async () => {
    m.getInvoice.mockResolvedValue({ ...invoice, status: 'approved' });
    await expect(startVerificationCall(invoice.id, 'phone')).rejects.toThrow('Only a frozen invoice');
  });
});
