import { logAudit } from './audit';
import { addToBlocklist, getInvoice, getVendor, setInvoiceStatus, updateVendorBank } from './repo';
import { normalizeDomain } from './risk/domains';
import type { CallOutcome, InvoiceStatus } from './types';

export function decide(outcome: CallOutcome | 'failed' | 'escalate'): {
  status: InvoiceStatus; saveBank: boolean; blocklist: boolean;
} {
  switch (outcome) {
    case 'confirmed':
      return { status: 'approved', saveBank: true, blocklist: false };
    case 'denied':
    case 'unclear':
      return { status: 'blocked', saveBank: false, blocklist: true };
    case 'failed':
      return { status: 'frozen', saveBank: false, blocklist: false };
    // P2 two-channel: said yes but could not read back the emailed code. Not proof of fraud
    // (someone else may read that inbox), so hold the payment for the owner; blocklist nothing.
    case 'escalate':
      return { status: 'frozen', saveBank: false, blocklist: false };
  }
}

export async function applyDecision(
  invoiceId: string, callId: string, outcome: CallOutcome | 'failed' | 'escalate',
): Promise<void> {
  const decision = decide(outcome);
  // Compare-and-set: only the first decision for a verifying invoice wins.
  const moved = await setInvoiceStatus(invoiceId, decision.status, 'verifying');
  if (!moved) return;

  const invoice = await getInvoice(invoiceId);
  if (!invoice) return;
  const vendor = invoice.vendor_id ? await getVendor(invoice.vendor_id) : null;

  if (decision.saveBank && vendor && invoice.bank_account) {
    await updateVendorBank(vendor.id, invoice.bank_account, invoice.bank_routing);
    await logAudit(invoiceId, 'agent', 'save_bank_details',
      { vendorId: vendor.id, callId }, { bankAccountLast4: invoice.bank_account.slice(-4) },
      `${vendor.name} confirmed the change by a verification call, so the new bank details were saved.`);
  }

  if (decision.blocklist) {
    const reason = `Vendor ${outcome === 'denied' ? 'denied' : 'could not confirm'} this bank change by a verification call`;
    if (invoice.bank_account) {
      await addToBlocklist('bank_account', invoice.bank_account, reason, invoiceId);
    }
    // Never blocklist the vendor's own real domain.
    const sender = normalizeDomain(invoice.sender_domain);
    const real = normalizeDomain(vendor?.real_domain ?? invoice.intel?.realDomain ?? null);
    if (sender && sender !== real) {
      await addToBlocklist('domain', sender, reason, invoiceId);
    }
    await logAudit(invoiceId, 'agent', 'owner_alert', { callId, outcome },
      { blocklisted: { bankAccount: invoice.bank_account, domain: sender !== real ? sender : null } },
      'Payment blocked. Owner alerted with the call transcript.');
  }

  if (outcome === 'escalate') {
    await logAudit(invoiceId, 'agent', 'owner_alert', { callId, outcome },
      { status: decision.status, blocklisted: null },
      'The person on the call said yes but could not read back the emailed code sent to the vendor\'s public address. ' +
      'Payment stays frozen for the owner to check; nothing was blocklisted.');
  }

  const reasons: Record<CallOutcome | 'failed' | 'escalate', string> = {
    confirmed: 'Vendor confirmed the bank change and answered the history question correctly.',
    denied: 'Vendor said they did not request a bank change.',
    unclear: 'The call did not produce a clear, verified confirmation.',
    failed: 'The call could not be completed. Payment stays frozen until it is verified.',
    escalate: 'Confirmed by phone but failed the emailed-code check, so it was escalated to the owner.',
  };
  await logAudit(invoiceId, 'agent', 'decision', { callId, outcome },
    { status: decision.status }, reasons[outcome]);
}
