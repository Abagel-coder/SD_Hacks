import { logAudit } from '../audit';
import { createCall, getInvoice, getVendor, getVendorHistory, setInvoiceStatus, updateCall } from '../repo';
import type { CallChannel, CallRow, InvoiceRow, VendorRow } from '../types';
import { digitsOnly, isMock } from '../util';
import { buildChallenge } from './challenge';
import { resolveDialNumber } from './dial-guard';
import { emailCodeEnabled, generateCode, maskEmail, resolveEmailRecipient, sendCodeEmail } from './email-code';
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
    // P2 two-channel: the live agent's step 4b runs when code_email is not "none". Masked address only, never the code.
    code_email: call.email_code && call.code_check !== 'not_sent' && call.email_found ? maskEmail(call.email_found) : 'none',
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
  const challenge = buildChallenge(
    history, businessName(), invoice.invoice_date ?? new Date().toISOString().slice(0, 10),
  );

  if (!(await setInvoiceStatus(invoiceId, 'verifying', 'frozen'))) {
    throw new CallStartError('This invoice is already being verified.');
  }
  const email = await prepareEmailCode(invoice, vendor);
  const call = await createCall({
    invoiceId, channel: chosen, numberFound, numberDialed,
    challengeQuestion: challenge?.question ?? null,
    challengeAnswer: challenge ? String(challenge.expectedAmount) : null,
    ...email,
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

/**
 * P2 two-channel proof of control. With EMAIL_CODE_CHECK=1, email a one-time code to the vendor's
 * public address (web check or vendor record, never the invoice's sender) through the allow-list guard.
 * Any failure marks the call 'not_sent' and the call goes ahead exactly as before.
 */
async function prepareEmailCode(invoice: InvoiceRow, vendor: VendorRow | null): Promise<{
  emailFound?: string | null; emailSentTo?: string | null; emailCode?: string | null;
  codeCheck?: 'not_sent' | null;
}> {
  if (!emailCodeEnabled()) return {};
  const found = vendor?.public_email ?? invoice.intel?.publicEmail ?? null;
  const notSent = async (reason: string) => {
    await logAudit(invoice.id, 'system', 'email_code_not_sent', { emailFound: found }, { reason },
      `No verification code was emailed (${reason}). The call goes ahead without it.`);
    return { emailFound: found, emailSentTo: null, emailCode: null, codeCheck: 'not_sent' as const };
  };
  const resolved = resolveEmailRecipient(found, process.env);
  if ('error' in resolved) return notSent(resolved.error);
  const code = generateCode();
  try {
    await sendCodeEmail(resolved.sendTo, code, { businessName: businessName(), vendorName: invoice.vendor_name });
  } catch (err) {
    return notSent(err instanceof Error ? err.message : 'the email could not be sent');
  }
  await logAudit(invoice.id, 'agent', 'email_code_sent', { emailFound: found }, { sentTo: resolved.sendTo },
    `Emailed a one-time code to the vendor's public address ${maskEmail(found ?? '')}` +
      (resolved.sendTo !== found?.toLowerCase() ? ` (demo redirect to ${resolved.sendTo}).` : '.'));
  return { emailFound: found, emailSentTo: resolved.sendTo, emailCode: code, codeCheck: null };
}
