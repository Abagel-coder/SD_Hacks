import type { RiskReason, TranscriptTurn } from './types';

/**
 * Demo history for db:reset: past scam invoices that a verification call already stopped.
 * Every value here is made up. Constraints, enforced by seed-history.test.ts:
 * - never the on-stage scam's domain (u1ine.com) or account (000123456789 / ending 6789),
 *   so that upload still goes frozen → call → blocked with no blocklist hit;
 * - never a real vendor's account on file or a real vendor domain;
 * - no embeddings are written, so there is no similar-scam match either.
 */
export interface SampleScam {
  vendorName: 'Uline' | 'Grainger' | 'Sysco';
  daysAgo: number;
  amount: number;
  senderDomain: string;
  bankAccount: string;
  invoiceNumber: string;
  reasons: RiskReason[];
  denial: string;
}

const reasonsFor = (domain: string, realDomain: string, lookalike: boolean): RiskReason[] => [
  { code: 'BANK_CHANGED', points: 40, detail: 'Bank account differs from every past invoice from this vendor.' },
  lookalike
    ? { code: 'LOOKALIKE_DOMAIN', points: 40, detail: `Sender domain ${domain} imitates ${realDomain}.` }
    : { code: 'DOMAIN_MISMATCH', points: 30, detail: `Sender domain ${domain} is not the vendor's real domain ${realDomain}.` },
  { code: 'URGENCY_OR_SECRECY', points: 15, detail: 'Asks for payment to the new account before the due date.' },
];

export const SAMPLE_SCAMS: SampleScam[] = [
  {
    vendorName: 'Grainger', daysAgo: 27, amount: 3940.0, senderDomain: 'gra1nger.com',
    bankAccount: '771204958312', invoiceNumber: 'GRA-88412', reasons: reasonsFor('gra1nger.com', 'grainger.com', true),
    denial: "No, we haven't changed our bank. Please don't pay that.",
  },
  {
    vendorName: 'Sysco', daysAgo: 23, amount: 6215.5, senderDomain: 'sysc0-billing.com',
    bankAccount: '663019284475', invoiceNumber: 'SYS-55031', reasons: reasonsFor('sysc0-billing.com', 'sysco.com', true),
    denial: 'No. That email did not come from us.',
  },
  {
    vendorName: 'Uline', daysAgo: 18, amount: 4388.0, senderDomain: 'uline-payments.net',
    bankAccount: '918273645501', invoiceNumber: 'ULI-30977', reasons: reasonsFor('uline-payments.net', 'uline.com', false),
    denial: 'No, our banking details are the same as always.',
  },
  {
    vendorName: 'Grainger', daysAgo: 12, amount: 5120.75, senderDomain: 'grainger-invoices.com',
    bankAccount: '550918273364', invoiceNumber: 'GRA-88690', reasons: reasonsFor('grainger-invoices.com', 'grainger.com', false),
    denial: "No, we didn't send a bank change. That's not us.",
  },
  {
    vendorName: 'Sysco', daysAgo: 6, amount: 7480.0, senderDomain: 'sysco-remit.com',
    bankAccount: '829104736652', invoiceNumber: 'SYS-55218', reasons: reasonsFor('sysco-remit.com', 'sysco.com', false),
    denial: 'No. We never changed banks. Hold that payment.',
  },
  {
    vendorName: 'Uline', daysAgo: 2, amount: 2905.25, senderDomain: 'ulinepay.net',
    bankAccount: '704518293370', invoiceNumber: 'ULI-31104', reasons: reasonsFor('ulinepay.net', 'uline.com', true),
    denial: "No, that isn't our account.",
  },
];

export function riskScore(reasons: RiskReason[]): number {
  return Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0));
}

export function transcriptFor(scam: SampleScam, businessName: string): TranscriptTurn[] {
  const last4 = scam.bankAccount.slice(-4).split('').join(' ');
  return [
    { role: 'agent', message: `Hi, this is an automated verification call on behalf of ${businessName}. Am I speaking with someone at ${scam.vendorName} who handles billing?` },
    { role: 'user', message: 'Yes, accounts receivable.' },
    { role: 'agent', message: `Did ${scam.vendorName} recently change its bank account for payments to one ending in ${last4}?` },
    { role: 'user', message: scam.denial },
    { role: 'agent', message: `Thank you. The payment will be held and ${businessName} will follow up. Goodbye.` },
  ];
}

/** A timestamp `daysAgo` days before `now`, at the given hour and minute (UTC), plus `offsetMinutes`. */
export function at(now: Date, daysAgo: number, offsetMinutes = 0): Date {
  const d = new Date(now.getTime() - daysAgo * 86_400_000);
  d.setUTCHours(17, 10, 0, 0);
  return new Date(d.getTime() + offsetMinutes * 60_000);
}
