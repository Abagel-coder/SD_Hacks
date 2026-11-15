import { normalizeDomain } from '../risk/domains';
import { scoreInvoice, type RiskRules } from '../risk/engine';
import type {
  BlocklistHit, BlocklistKind, ExtractedInvoice, InvoiceRow, RiskCode, VendorIntel, VendorRow,
} from '../types';
import { digitsOnly } from '../util';

/** A blocklist row as it exists on the replayed branch. */
export interface BlocklistEntry {
  kind: BlocklistKind;
  value: string;
  reason: string | null;
  source_invoice_id: string | null;
  created_at: string;
}

export type ReplayLabel = 'fraud' | 'legit';

export interface ReplayCase {
  id: string;
  title: string;
  label: ReplayLabel;
  source: 'scenario' | 'history';
  input: { invoice: ExtractedInvoice; vendor: VendorRow | null; intel: VendorIntel; blocklistHits: BlocklistHit[] };
}

export interface CaseResult {
  id: string;
  title: string;
  label: ReplayLabel;
  source: ReplayCase['source'];
  frozen: boolean;
  score: number;
  codes: RiskCode[];
}

export interface Scorecard {
  fraudTotal: number;
  caught: number;
  missed: number;
  legitTotal: number;
  falseFreezes: number;
  cleanApprovals: number;
  cases: CaseResult[];
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function unavailableIntel(senderDomain: string | null): VendorIntel {
  return {
    available: false, senderDomain, realDomain: null, officialPhone: null, publicEmail: null,
    senderDomainMatches: null, senderDomainAgeDays: null, sources: [],
  };
}

/**
 * Turn a decided invoice into a replay case, as the system knew it when the invoice arrived.
 * Blocked = fraud, approved = legit; anything undecided is skipped. Only blocklist entries that
 * existed before the invoice, and that came from a different invoice, count. Otherwise a blocked
 * scam would be "caught" by the entry its own blocking created (hindsight).
 */
export function toReplayCase(row: InvoiceRow, vendor: VendorRow | null, blocklist: BlocklistEntry[]): ReplayCase | null {
  if (row.status !== 'approved' && row.status !== 'blocked') return null;

  const invoice: ExtractedInvoice = row.extracted
    ? { ...row.extracted, senderDomain: row.sender_domain ?? row.extracted.senderDomain }
    : {
        vendorName: row.vendor_name, invoiceNumber: row.invoice_number, senderEmail: row.sender_email,
        senderDomain: row.sender_domain, amount: row.amount, currency: row.currency,
        bankAccount: row.bank_account, bankRouting: row.bank_routing, dueDate: row.due_date, invoiceDate: row.invoice_date,
        urgencyPhrases: [], secrecyPhrases: [], phoneOnInvoice: null,
      };

  const arrived = Date.parse(row.created_at);
  const account = digitsOnly(row.bank_account);
  const domain = normalizeDomain(row.sender_domain);
  const blocklistHits: BlocklistHit[] = blocklist
    .filter((e) => e.source_invoice_id !== row.id && Date.parse(e.created_at) < arrived)
    .filter((e) => (e.kind === 'bank_account' && account !== '' && digitsOnly(e.value) === account)
      || (e.kind === 'domain' && domain !== null && e.value === domain))
    .map((e) => ({ kind: e.kind, value: e.value, reason: e.reason ?? '' }));

  return {
    id: row.id,
    title: `${row.vendor_name} ${money(row.amount)} from ${row.sender_domain ?? 'unknown sender'}`,
    label: row.status === 'blocked' ? 'fraud' : 'legit',
    source: 'history',
    input: { invoice, vendor, intel: row.intel ?? unavailableIntel(row.sender_domain), blocklistHits },
  };
}

export function evaluate(cases: ReplayCase[], rules: RiskRules): Scorecard {
  const results: CaseResult[] = cases.map((c) => {
    const r = scoreInvoice(c.input, rules);
    return {
      id: c.id, title: c.title, label: c.label, source: c.source,
      frozen: r.freeze, score: r.score, codes: r.reasons.map((x) => x.code),
    };
  });
  const fraud = results.filter((r) => r.label === 'fraud');
  const legit = results.filter((r) => r.label === 'legit');
  return {
    fraudTotal: fraud.length,
    caught: fraud.filter((r) => r.frozen).length,
    missed: fraud.filter((r) => !r.frozen).length,
    legitTotal: legit.length,
    falseFreezes: legit.filter((r) => r.frozen).length,
    cleanApprovals: legit.filter((r) => !r.frozen).length,
    cases: results,
  };
}

/** Score every case under both rule sets; `changed` lists the cases whose freeze decision flips. */
export function compareRules(cases: ReplayCase[], current: RiskRules, proposed: RiskRules): {
  current: Scorecard; proposed: Scorecard; changed: CaseResult[];
} {
  const a = evaluate(cases, current);
  const b = evaluate(cases, proposed);
  const changed = b.cases.filter((r, i) => r.frozen !== a.cases[i].frozen);
  return { current: a, proposed: b, changed };
}
