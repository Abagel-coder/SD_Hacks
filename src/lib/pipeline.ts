import { logAudit } from './audit';
import { verifyVendor } from './brightdata/verify-vendor';
import { explainRisk } from './gemini/explain';
import { extractInvoice } from './gemini/extract';
import { findBlocklistHits, findVendorByName, insertInvoice, saveRisk, saveVendorIntel } from './repo';
import { normalizeDomain } from './risk/domains';
import { scoreInvoice } from './risk/engine';
import type { InvoiceRow, InvoiceStatus, RiskResult, VendorIntel } from './types';
import { withTimeout } from './util';

export function fallbackExplanation(risk: RiskResult): string {
  if (risk.reasons.length === 0) {
    return "No risk signals found. This invoice matches the vendor's history.";
  }
  return `Risk score ${risk.score} out of 100. ${risk.reasons.map((r) => r.detail).join(' ')}`;
}

function unavailableIntel(senderDomain: string | null): VendorIntel {
  return {
    available: false, senderDomain, realDomain: null, officialPhone: null, publicEmail: null,
    senderDomainMatches: null, senderDomainAgeDays: null, sources: [],
  };
}

export async function processInvoice(input: {
  bytes: Buffer; mimeType: string; fileName: string; senderEmail?: string;
}): Promise<InvoiceRow> {
  // 1. Read the invoice. If this throws, nothing has been saved.
  const extracted = await extractInvoice({ bytes: input.bytes, mimeType: input.mimeType }, input.senderEmail);
  const senderDomain = normalizeDomain(extracted.senderDomain ?? extracted.senderEmail ?? input.senderEmail);

  // 2. Match the vendor and save the invoice as pending.
  const vendor = await findVendorByName(extracted.vendorName);
  const invoice = await insertInvoice({
    vendorId: vendor?.id ?? null, fileName: input.fileName, extracted, senderDomain,
  });
  await logAudit(invoice.id, 'agent', 'extract_invoice', { fileName: input.fileName }, extracted,
    'Gemini read the invoice fields.');
  await logAudit(invoice.id, 'agent', 'match_vendor', { vendorName: extracted.vendorName },
    { vendorId: vendor?.id ?? null },
    vendor ? `Matched to known vendor ${vendor.name}.` : 'No matching vendor in payment history.');

  // 3. Fact-check the vendor on the public web.
  let intel: VendorIntel;
  try {
    intel = await withTimeout(verifyVendor(extracted.vendorName, senderDomain, vendor?.intel ?? null), 25_000);
  } catch (err) {
    console.error('verifyVendor failed', err);
    intel = unavailableIntel(senderDomain);
  }
  if (vendor && intel.available) await saveVendorIntel(vendor.id, intel);
  await logAudit(invoice.id, 'agent', 'verify_vendor',
    { vendorName: extracted.vendorName, senderDomain }, intel,
    intel.available
      ? `Bright Data found the vendor's public domain ${intel.realDomain ?? 'unknown'} and phone ${intel.officialPhone ?? 'unknown'}.`
      : 'Bright Data was unavailable, so no public-web signals were scored.');

  // 4. Score.
  const blocklistHits = await findBlocklistHits(extracted.bankAccount, senderDomain);
  const risk = scoreInvoice({ invoice: { ...extracted, senderDomain }, vendor, intel, blocklistHits });
  await logAudit(invoice.id, 'agent', 'score_risk', { blocklistHits: blocklistHits.length }, risk,
    `Risk score ${risk.score} from ${risk.reasons.length} signal(s).`);

  // 5. Explain in plain English.
  let explanation: string;
  try {
    explanation = await withTimeout(explainRisk(extracted, risk), 10_000);
  } catch (err) {
    console.error('explainRisk failed', err);
    explanation = fallbackExplanation(risk);
  }

  // 6. Freeze or approve.
  const status: InvoiceStatus = risk.freeze ? 'frozen' : 'approved';
  const saved = await saveRisk(invoice.id, { risk, explanation, intel, status });
  await logAudit(invoice.id, 'agent', status === 'frozen' ? 'freeze_payment' : 'approve_payment',
    { score: risk.score }, { status },
    status === 'frozen'
      ? 'Payment frozen until the vendor is verified by phone.'
      : 'No blocking risk signals. Payment approved.');
  return saved;
}
