import type { BlocklistHit, ExtractedInvoice, RiskReason, RiskResult, VendorIntel, VendorRow } from '../types';
import { digitsOnly } from '../util';
import { isLookalike, normalizeDomain } from './domains';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function scoreInvoice(input: {
  invoice: ExtractedInvoice;
  vendor: VendorRow | null;
  intel: VendorIntel;
  blocklistHits: BlocklistHit[];
}): RiskResult {
  const { invoice, vendor, intel, blocklistHits } = input;
  const reasons: RiskReason[] = [];
  let hardFreeze = false;

  for (const hit of blocklistHits) {
    const label = hit.kind === 'domain' ? 'Sender domain' : hit.kind === 'phone' ? 'Phone number' : 'Bank account';
    reasons.push({
      code: 'BLOCKLIST_HIT', points: 100,
      detail: `${label} ${hit.value} is on the scam blocklist (${hit.reason}).`,
    });
    hardFreeze = true;
  }

  if (vendor) {
    const accountOnFile = digitsOnly(vendor.bank_account);
    const accountGiven = digitsOnly(invoice.bankAccount);
    const routingOnFile = digitsOnly(vendor.bank_routing);
    const routingGiven = digitsOnly(invoice.bankRouting);
    const accountChanged = accountOnFile !== '' && accountGiven !== '' && accountOnFile !== accountGiven;
    const routingChanged = routingOnFile !== '' && routingGiven !== '' && routingOnFile !== routingGiven;
    if (accountChanged || routingChanged) {
      reasons.push({
        code: 'BANK_CHANGED', points: 40,
        detail: accountChanged
          ? `Bank account ending ${accountGiven.slice(-4)} does not match the account on file for ${vendor.name} (ending ${accountOnFile.slice(-4)}).`
          : `Routing number does not match the one on file for ${vendor.name}.`,
      });
      hardFreeze = true;
    }
  } else {
    reasons.push({
      code: 'UNKNOWN_VENDOR', points: 10,
      detail: `No payment history with "${invoice.vendorName}".`,
    });
  }

  const sender = normalizeDomain(invoice.senderDomain ?? invoice.senderEmail);
  const real = normalizeDomain(vendor?.real_domain ?? intel.realDomain);
  if (sender && real && sender !== real) {
    if (isLookalike(sender, real)) {
      reasons.push({
        code: 'LOOKALIKE_DOMAIN', points: 30,
        detail: `Sender domain ${sender} imitates the vendor's real domain ${real}.`,
      });
    } else {
      reasons.push({
        code: 'DOMAIN_MISMATCH', points: 20,
        detail: `Sender domain ${sender} is not the vendor's public domain ${real}.`,
      });
    }
  }

  if (intel.senderDomainAgeDays !== null && intel.senderDomainAgeDays < 90) {
    reasons.push({
      code: 'NEW_DOMAIN', points: 20,
      detail: `Sender domain was registered ${intel.senderDomainAgeDays} days ago.`,
    });
  }

  if (vendor?.amount_max && invoice.amount > vendor.amount_max * 1.5) {
    reasons.push({
      code: 'AMOUNT_ANOMALY', points: 20,
      detail: `${money(invoice.amount)} is far above this vendor's normal range (${money(vendor.amount_min ?? 0)} to ${money(vendor.amount_max)}).`,
    });
  }

  const phrases = [...invoice.urgencyPhrases, ...invoice.secrecyPhrases];
  if (phrases.length > 0) {
    reasons.push({
      code: 'URGENCY_OR_SECRECY', points: 15,
      detail: `Pressure language: "${phrases[0]}".`,
    });
  }

  // P2: Gemini's second opinion. Add-only and capped at 15, so a prompt-injected invoice can only
  // fail to add points, never lower the score. On its own it can never reach the freeze threshold.
  const ai = invoice.aiIndicators ?? [];
  if (ai.length > 0) {
    const more = ai.length > 1 ? ` (and ${ai.length - 1} more)` : '';
    reasons.push({
      code: 'AI_FLAGGED', points: 15,
      detail: `Gemini flagged: ${ai[0].signal}: "${ai[0].evidence.replace(/[.\s]+$/, '')}"${more}.`,
    });
  }

  const sum = reasons.reduce((total, r) => total + r.points, 0);
  const score = Math.min(100, sum);
  return { score, reasons, freeze: hardFreeze || score >= 50 };
}
