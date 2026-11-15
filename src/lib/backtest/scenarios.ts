import type { ExtractedInvoice, VendorIntel, VendorRow } from '../types';
import type { ReplayCase } from './replay';

/**
 * Labelled attack and routine scenarios for the backtest. Pure data built from the seeded vendors,
 * so a replay needs no Gemini or Bright Data calls.
 */
const vendor = (name: string, domain: string, bank: string, min: number, max: number): VendorRow => ({
  id: `scenario-${domain}`, name, normalized_name: name.toLowerCase(), real_domain: domain,
  verified_phone: null, public_email: null, bank_account: bank, bank_routing: '110000000',
  amount_min: min, amount_max: max, intel: null, intel_fetched_at: null, created_at: '2026-05-01T00:00:00Z',
});

const ULINE = vendor('Uline', 'uline.com', '004417729035', 1100, 1500);
const GRAINGER = vendor('Grainger', 'grainger.com', '008823340917', 600, 950);
const SYSCO = vendor('Sysco', 'sysco.com', '002291847756', 2800, 3600);

const invoice = (v: VendorRow | null, over: Partial<ExtractedInvoice>): ExtractedInvoice => ({
  vendorName: v?.name ?? 'Unknown', invoiceNumber: 'SC-1', senderEmail: null, senderDomain: v?.real_domain ?? null,
  amount: v ? (v.amount_min! + v.amount_max!) / 2 : 500, currency: 'USD',
  bankAccount: v?.bank_account ?? null, bankRouting: '110000000', dueDate: null, invoiceDate: null,
  urgencyPhrases: [], secrecyPhrases: [], phoneOnInvoice: null, ...over,
});

const intel = (sender: string, real: string | null, over: Partial<VendorIntel> = {}): VendorIntel => ({
  available: true, senderDomain: sender, realDomain: real, officialPhone: null, publicEmail: null,
  senderDomainMatches: real ? sender === real : null,
  senderDomainAgeDays: sender === real ? 10_000 : null, sources: [],
  ...(sender !== real ? { senderWebPresence: { results: 9, mentions: 0 } } : {}),
  ...over,
});

const scenario = (
  id: string, title: string, label: ReplayCase['label'], v: VendorRow | null,
  inv: Partial<ExtractedInvoice>, intelOver: VendorIntel, blocklistHits: ReplayCase['input']['blocklistHits'] = [],
): ReplayCase => ({
  id, title, label, source: 'scenario',
  input: { invoice: invoice(v, inv), vendor: v, intel: intelOver, blocklistHits },
});

export const SCENARIOS: ReplayCase[] = [
  scenario('fraud-lookalike-bank-change', 'Lookalike domain u1ine.com, new bank account, 3x amount, "pay today"', 'fraud', ULINE,
    { senderDomain: 'u1ine.com', bankAccount: '000123456789', amount: 4870, urgencyPhrases: ['Payment must be sent today'] },
    intel('u1ine.com', 'uline.com')),
  scenario('fraud-compromised-mailbox', 'Real uline.com mailbox hijacked, only the bank account changed', 'fraud', ULINE,
    { bankAccount: '000987654321', amount: 1290 }, intel('uline.com', 'uline.com')),
  scenario('fraud-new-lookalike-domain', 'grainger-invoices.com registered 12 days ago, nobody on the web mentions it', 'fraud', GRAINGER,
    { senderDomain: 'grainger-invoices.com', amount: 880 }, intel('grainger-invoices.com', 'grainger.com', { senderDomainAgeDays: 12 })),
  scenario('fraud-known-scam-account', 'Pays into an account already on the scam blocklist', 'fraud', SYSCO,
    { bankAccount: '000123456789', amount: 3100 }, intel('sysco.com', 'sysco.com'),
    [{ kind: 'bank_account', value: '000123456789', reason: 'Vendor denied this bank change by phone' }]),
  scenario('fraud-unknown-vendor-gift-cards', 'Unknown "Acme Office Supply" asking for gift-card payment', 'fraud', null,
    { vendorName: 'Acme Office Supply', senderDomain: 'acme-office-supply.net', amount: 640,
      aiIndicators: [{ signal: 'Unusual payment method', evidence: 'Payment accepted by Apple gift cards only' }] },
    intel('acme-office-supply.net', null)),
  scenario('legit-routine-uline', 'Routine Uline invoice', 'legit', ULINE, { amount: 1318.4 }, intel('uline.com', 'uline.com')),
  scenario('legit-routine-grainger', 'Routine Grainger invoice', 'legit', GRAINGER, { amount: 812.5 }, intel('grainger.com', 'grainger.com')),
  scenario('legit-routine-sysco', 'Routine Sysco invoice', 'legit', SYSCO, { amount: 3150 }, intel('sysco.com', 'sysco.com')),
  scenario('legit-large-order', 'Sysco holiday order at 1.6x the usual maximum', 'legit', SYSCO,
    { amount: 5800 }, intel('sysco.com', 'sysco.com')),
  scenario('legit-polite-reminder', 'Uline invoice with "please pay promptly"', 'legit', ULINE,
    { urgencyPhrases: ['Please pay promptly'] }, intel('uline.com', 'uline.com')),
  scenario('legit-real-bank-change', 'Grainger really did change banks (sent from grainger.com)', 'legit', GRAINGER,
    { bankAccount: '008823340044' }, intel('grainger.com', 'grainger.com')),
];
