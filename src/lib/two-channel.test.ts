import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallRow, InvoiceRow, VendorRow } from './types';

const m = vi.hoisted(() => ({
  getInvoice: vi.fn(), getVendor: vi.fn(), getVendorHistory: vi.fn(), setInvoiceStatus: vi.fn(), createCall: vi.fn(),
  updateCall: vi.fn(), claimCall: vi.fn(), addToBlocklist: vi.fn(), updateVendorBank: vi.fn(), logAudit: vi.fn(),
  placeOutboundCall: vi.fn(), generateJson: vi.fn(), fetch: vi.fn(),
}));
vi.mock('./repo', () => ({
  getInvoice: m.getInvoice, getVendor: m.getVendor, getVendorHistory: m.getVendorHistory, setInvoiceStatus: m.setInvoiceStatus,
  createCall: m.createCall, updateCall: m.updateCall, claimCall: m.claimCall, addToBlocklist: m.addToBlocklist,
  updateVendorBank: m.updateVendorBank,
}));
vi.mock('./audit', () => ({ logAudit: m.logAudit }));
vi.mock('./voice/elevenlabs', () => ({ placeOutboundCall: m.placeOutboundCall }));
vi.mock('./gemini/client', () => ({ generateJson: m.generateJson }));

import { applyDecision, decide } from './decision';
import { reportFromAnalysis } from './voice/classify';
import { finalizeCall } from './voice/finalize';
import { dynamicVariablesFor, startVerificationCall } from './voice/start-call';

const invoice = {
  id: '22222222-2222-2222-2222-222222222222', vendor_id: '11111111-1111-1111-1111-111111111111', vendor_name: 'Uline',
  bank_account: '000123456789', sender_domain: 'u1ine.com', sender_email: 'billing@u1ine.com', status: 'frozen',
  invoice_date: '2026-11-14', intel: { publicEmail: 'from-intel@uline.com' }, extracted: { phoneOnInvoice: '+15555550199' },
} as unknown as InvoiceRow;
const vendor = {
  id: invoice.vendor_id, name: 'Uline', verified_phone: '+18002955510', public_email: 'customer.service@uline.com',
  real_domain: 'uline.com',
} as VendorRow;
const baseCall = {
  id: '33333333-3333-3333-3333-333333333333', invoice_id: invoice.id, channel: 'browser',
  challenge_question: 'What was the total on your September invoice?', challenge_answer: '1284.5',
} as CallRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MOCK_CALL', '1');
  vi.stubEnv('MOCK_GEMINI', '1');
  vi.stubEnv('MOCK_EMAIL', '1');
  m.getInvoice.mockResolvedValue(invoice);
  m.getVendor.mockResolvedValue(vendor);
  m.getVendorHistory.mockResolvedValue([]);
  m.setInvoiceStatus.mockResolvedValue(true);
  m.claimCall.mockResolvedValue(true);
  m.createCall.mockImplementation(async (f) => ({ ...baseCall, email_found: f.emailFound ?? null,
    email_sent_to: f.emailSentTo ?? null, email_code: f.emailCode ?? null, code_check: f.codeCheck ?? null }));
});
afterEach(() => vi.unstubAllEnvs());

describe('decide and applyDecision with escalate', () => {
  it('keeps the invoice frozen, saves nothing and blocklists nothing', async () => {
    expect(decide('escalate')).toEqual({ status: 'frozen', saveBank: false, blocklist: false });
    await applyDecision(invoice.id, baseCall.id, 'escalate');
    expect(m.setInvoiceStatus).toHaveBeenCalledWith(invoice.id, 'frozen', 'verifying');
    expect(m.addToBlocklist).not.toHaveBeenCalled();
    expect(m.updateVendorBank).not.toHaveBeenCalled();
    expect(m.logAudit).toHaveBeenCalledWith(invoice.id, 'agent', 'owner_alert', expect.anything(), expect.anything(),
      expect.stringContaining('emailed code'));
  });
});

describe('startVerificationCall with the email code', () => {
  it('does nothing new while EMAIL_CODE_CHECK is off', async () => {
    await startVerificationCall(invoice.id, 'browser');
    expect(m.createCall.mock.calls[0][0]).not.toHaveProperty('emailCode');
  });

  it('emails a code to the vendor\'s public address through the guard, never the invoice sender', async () => {
    vi.stubEnv('EMAIL_CODE_CHECK', '1');
    vi.stubEnv('ALLOWED_EMAIL_RECIPIENTS', 'demo@team.dev');
    vi.stubEnv('DEMO_EMAIL_TO', 'demo@team.dev');
    await startVerificationCall(invoice.id, 'browser');
    const f = m.createCall.mock.calls[0][0];
    expect(f.emailFound).toBe('customer.service@uline.com');
    expect(f.emailSentTo).toBe('demo@team.dev');
    expect(f.emailCode).toMatch(/^\d{6}$/);
    expect(f.codeCheck).toBeNull();
    expect(JSON.stringify(f)).not.toContain('u1ine.com');
  });

  it('still places the call, marked not_sent, when the guard refuses the address', async () => {
    vi.stubEnv('EMAIL_CODE_CHECK', '1');
    vi.stubEnv('ALLOWED_EMAIL_RECIPIENTS', '');
    await startVerificationCall(invoice.id, 'browser');
    const f = m.createCall.mock.calls[0][0];
    expect(f).toMatchObject({ emailFound: 'customer.service@uline.com', emailSentTo: null, emailCode: null, codeCheck: 'not_sent' });
  });

  it('tells the live agent where a code was sent via code_email (its step 4b), but never the code itself', () => {
    const call = { ...baseCall, email_found: 'customer.service@uline.com', email_sent_to: 'demo@team.dev', email_code: '429117', code_check: null };
    const vars = dynamicVariablesFor(invoice, call);
    expect(vars).toMatchObject({ code_email: 'c***@uline.com' });
    expect(JSON.stringify(vars)).not.toContain('429117');
    expect(dynamicVariablesFor(invoice, baseCall)).toMatchObject({ code_email: 'none' });
    expect(dynamicVariablesFor(invoice, { ...call, email_code: null, code_check: 'not_sent' })).toMatchObject({ code_email: 'none' });
  });
});

describe('finalizeCall with the email code', () => {
  const sent = { ...baseCall, email_found: 'customer.service@uline.com', email_sent_to: 'demo@team.dev', email_code: '429117', code_check: null } as CallRow;
  const conversation = (code: string) => ({
    conversation_id: 'conv_1',
    transcript: [{ role: 'user' as const, message: 'Yes.' }],
    analysis: { data_collection_results: {
      bank_change_confirmed: { value: 'yes' }, stated_amount: { value: 1284.5 }, code_read_back: { value: code },
    } },
  });

  it('reads the code back from the live agent\'s stated_code field, falling back to code_read_back', () => {
    const stated = { data_collection_results: { bank_change_confirmed: { value: 'yes' }, stated_amount: { value: 1284.5 }, stated_code: { value: '429117' } } };
    expect(reportFromAnalysis(stated, 1284.5)?.codeReadBack).toBe('429117');
    expect(reportFromAnalysis(conversation('4 2 9 1 1 7').analysis, 1284.5)?.codeReadBack).toBe('4 2 9 1 1 7');
  });

  it('approves when the live agent reports the right code in stated_code', async () => {
    await finalizeCall(sent, {
      conversation_id: 'conv_2', transcript: [{ role: 'user' as const, message: 'Yes.' }],
      analysis: { data_collection_results: { bank_change_confirmed: { value: 'yes' }, stated_amount: { value: 1284.5 }, stated_code: { value: '429117' } } },
    });
    expect(m.updateCall).toHaveBeenCalledWith(sent.id, expect.objectContaining({ outcome: 'confirmed', codeCheck: 'passed' }));
  });

  it('approves a "yes" with the right amount and the right code', async () => {
    await finalizeCall(sent, conversation('four two nine one one seven'));
    expect(m.updateCall).toHaveBeenCalledWith(sent.id, expect.objectContaining({ outcome: 'confirmed', codeCheck: 'passed' }));
    expect(vi.mocked(applyDecision)).toBeDefined();
    expect(m.setInvoiceStatus).toHaveBeenCalledWith(invoice.id, 'approved', 'verifying');
  });

  it('escalates a "yes" with the right amount but the wrong code: frozen, no blocklist', async () => {
    await finalizeCall(sent, conversation('111111'));
    expect(m.updateCall).toHaveBeenCalledWith(sent.id, expect.objectContaining({ outcome: 'unclear', codeCheck: 'failed' }));
    expect(m.setInvoiceStatus).toHaveBeenCalledWith(invoice.id, 'frozen', 'verifying');
    expect(m.addToBlocklist).not.toHaveBeenCalled();
  });

  it('a call without an emailed code is decided exactly as before', async () => {
    await finalizeCall(baseCall, conversation(''));
    expect(m.setInvoiceStatus).toHaveBeenCalledWith(invoice.id, 'approved', 'verifying');
    expect(m.updateCall.mock.calls[0][1]).not.toHaveProperty('codeCheck');
  });
});
