import { logAudit } from '../audit';
import { createCall, getInvoice, getVendor, getVendorHistory, setInvoiceStatus, updateCall } from '../repo';
import type { CallChannel, CallRow, InvoiceRow } from '../types';
import { digitsOnly, isMock } from '../util';
import { buildChallenge } from './challenge';
import { resolveDialNumber } from './dial-guard';
import { placeOutboundCall } from './elevenlabs';
import { failCall } from './finalize';

export class CallStartError extends Error {}

const businessName = () => process.env.BUSINESS_NAME || 'Harbor Coffee Roasters';

/** Values the agent's prompt reads. The expected challenge answer is deliberately absent. */
export function dynamicVariablesFor(invoice: InvoiceRow, call: CallRow): Record<string, string> {
  const last4 = digitsOnly(invoice.bank_account).slice(-4);
  return {
    business_name: businessName(),
    vendor_name: invoice.vendor_name,
    bank_last4: last4 ? last4.split('').join(' ') : 'unknown', // spaced so it is read digit by digit
    challenge_question: call.challenge_question ?? 'none',
    call_id: call.id,
    invoice_id: invoice.id,
  };
}

export async function startVerificationCall(
  invoiceId: string,
  channel?: CallChannel,
): Promise<{ callId: string; channel: CallChannel }> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new CallStartError('Invoice not found.');
  if (invoice.status !== 'frozen') throw new CallStartError('Only a frozen invoice can be verified.');

  const vendor = invoice.vendor_id ? await getVendor(invoice.vendor_id) : null;
  // The number comes from Neon or Bright Data. extracted.phoneOnInvoice is never used.
  const numberFound = vendor?.verified_phone ?? invoice.intel?.officialPhone ?? null;
  const chosen: CallChannel = channel ?? (process.env.CALL_CHANNEL === 'phone' ? 'phone' : 'browser');

  let numberDialed: string | null = null;
  if (chosen === 'phone' && !isMock('CALL')) {
    const resolved = resolveDialNumber(numberFound, {
      ALLOWED_CALL_NUMBERS: process.env.ALLOWED_CALL_NUMBERS,
      DEMO_CALL_NUMBER: process.env.DEMO_CALL_NUMBER,
    });
    if ('error' in resolved) throw new CallStartError(resolved.error);
    numberDialed = resolved.dialed;
  }

  const history = vendor ? await getVendorHistory(vendor.id) : [];
  const challenge = buildChallenge(history, businessName());

  if (!(await setInvoiceStatus(invoiceId, 'verifying', 'frozen'))) {
    throw new CallStartError('This invoice is already being verified.');
  }
  const call = await createCall({
    invoiceId, channel: chosen, numberFound, numberDialed,
    challengeQuestion: challenge?.question ?? null,
    challengeAnswer: challenge ? String(challenge.expectedAmount) : null,
  });
  await logAudit(invoiceId, 'owner', 'start_verification_call',
    { channel: chosen, numberOnInvoice: invoice.extracted?.phoneOnInvoice ?? null },
    { callId: call.id, numberFound, numberDialed },
    'Owner asked for phone verification. The agent uses the publicly verified number, never the one on the invoice.');

  if (chosen === 'phone' && !isMock('CALL') && numberDialed) {
    try {
      const { conversationId } = await placeOutboundCall(numberDialed, dynamicVariablesFor(invoice, call));
      if (conversationId) await updateCall(call.id, { conversationId });
    } catch (err) {
      await failCall(call, err instanceof Error ? err.message : 'could not place the call');
      throw err;
    }
  }
  return { callId: call.id, channel: chosen };
}
