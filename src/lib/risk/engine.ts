import type { BlocklistHit, ExtractedInvoice, RiskCode, RiskReason, RiskResult, VendorIntel, VendorRow } from '../types';
import { digitsOnly } from '../util';
import { isLookalike, normalizeDomain } from './domains';

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Every tunable number in the risk engine. The defaults are the production rules. */
export interface RiskRules {
  /** Points per rule. 0 turns the rule off entirely (no reason, no freeze). */
  points: Record<RiskCode, number>;
  /** Rules that freeze the payment on their own, whatever the score. */
  hardFreeze: Record<RiskCode, boolean>;
  freezeThreshold: number;
  /** AMOUNT_ANOMALY fires above this multiple of the vendor's normal maximum. */
  amountMultiplier: number;
  /** NEW_DOMAIN fires for a sender domain younger than this many days. */
  newDomainDays: number;
}

export const DEFAULT_RULES: RiskRules = {
  points: {
    BLOCKLIST_HIT: 100, BANK_CHANGED: 40, LOOKALIKE_DOMAIN: 30, DOMAIN_MISMATCH: 20, NEW_DOMAIN: 20,
    AMOUNT_ANOMALY: 20, URGENCY_OR_SECRECY: 15, UNKNOWN_VENDOR: 10, AI_FLAGGED: 15, NO_WEB_PRESENCE: 15,
  },
  hardFreeze: {
    BLOCKLIST_HIT: true, BANK_CHANGED: true, LOOKALIKE_DOMAIN: false, DOMAIN_MISMATCH: false, NEW_DOMAIN: false,
    AMOUNT_ANOMALY: false, URGENCY_OR_SECRECY: false, UNKNOWN_VENDOR: false, AI_FLAGGED: true, NO_WEB_PRESENCE: false,
  },
  freezeThreshold: 50,
  amountMultiplier: 1.5,
  newDomainDays: 90,
};

/** A copy of the production rules with some values changed (used by the backtest). */
export function withRules(over: {
  points?: Partial<Record<RiskCode, number>>;
  hardFreeze?: Partial<Record<RiskCode, boolean>>;
  freezeThreshold?: number;
  amountMultiplier?: number;
  newDomainDays?: number;
}): RiskRules {
  return {
    points: { ...DEFAULT_RULES.points, ...over.points },
    hardFreeze: { ...DEFAULT_RULES.hardFreeze, ...over.hardFreeze },
    freezeThreshold: over.freezeThreshold ?? DEFAULT_RULES.freezeThreshold,
    amountMultiplier: over.amountMultiplier ?? DEFAULT_RULES.amountMultiplier,
    newDomainDays: over.newDomainDays ?? DEFAULT_RULES.newDomainDays,
  };
}

export function scoreInvoice(input: {
  invoice: ExtractedInvoice;
  vendor: VendorRow | null;
  intel: VendorIntel;
  blocklistHits: BlocklistHit[];
}, rules: RiskRules = DEFAULT_RULES): RiskResult {
  const { invoice, vendor, intel, blocklistHits } = input;
  const reasons: RiskReason[] = [];
  let hardFreeze = false;
  const add = (code: RiskCode, detail: string) => {
    const points = rules.points[code];
    if (!(points > 0)) return;
    reasons.push({ code, points, detail });
    if (rules.hardFreeze[code]) hardFreeze = true;
  };

  for (const hit of blocklistHits) {
    const label = hit.kind === 'domain' ? 'Sender domain' : hit.kind === 'phone' ? 'Phone number' : 'Bank account';
    add('BLOCKLIST_HIT', `${label} ${hit.value} is on the scam blocklist (${hit.reason}).`);
  }

  if (vendor) {
    const accountOnFile = digitsOnly(vendor.bank_account);
    const accountGiven = digitsOnly(invoice.bankAccount);
    const routingOnFile = digitsOnly(vendor.bank_routing);
    const routingGiven = digitsOnly(invoice.bankRouting);
    const accountChanged = accountOnFile !== '' && accountGiven !== '' && accountOnFile !== accountGiven;
    const routingChanged = routingOnFile !== '' && routingGiven !== '' && routingOnFile !== routingGiven;
    if (accountChanged || routingChanged) {
      add('BANK_CHANGED', accountChanged
          ? `Bank account ending ${accountGiven.slice(-4)} does not match the account on file for ${vendor.name} (ending ${accountOnFile.slice(-4)}).`
          : `Routing number does not match the one on file for ${vendor.name}.`);
    }
  } else {
    add('UNKNOWN_VENDOR', `No payment history with "${invoice.vendorName}".`);
  }

  const sender = normalizeDomain(invoice.senderDomain ?? invoice.senderEmail);
  const real = normalizeDomain(vendor?.real_domain ?? intel.realDomain);
  if (sender && real && sender !== real) {
    if (isLookalike(sender, real)) {
      add('LOOKALIKE_DOMAIN', `Sender domain ${sender} imitates the vendor's real domain ${real}.`);
    } else {
      add('DOMAIN_MISMATCH', `Sender domain ${sender} is not the vendor's public domain ${real}.`);
    }
  }

  // P2: Bright Data web presence. Only for a sender that is not the vendor's real domain; a failed
  // search (null) is never treated as "no presence". Add-only, no freeze.
  const presence = intel.senderWebPresence;
  if (sender && sender !== real && presence && presence.results > 0 && presence.mentions === 0) {
    add('NO_WEB_PRESENCE', `Sender domain ${sender} has no public web presence: 0 of ${presence.results} search results mention it.`);
  }

  if (intel.senderDomainAgeDays !== null && intel.senderDomainAgeDays < rules.newDomainDays) {
    add('NEW_DOMAIN', `Sender domain was registered ${intel.senderDomainAgeDays} days ago.`);
  }

  if (vendor?.amount_max && invoice.amount > vendor.amount_max * rules.amountMultiplier) {
    add('AMOUNT_ANOMALY', `${money(invoice.amount)} is far above this vendor's normal range (${money(vendor.amount_min ?? 0)} to ${money(vendor.amount_max)}).`);
  }

  const phrases = [...invoice.urgencyPhrases, ...invoice.secrecyPhrases];
  if (phrases.length > 0) {
    add('URGENCY_OR_SECRECY', `Pressure language: "${phrases[0]}".`);
  }

  // P2: Gemini's second opinion. Add-only and capped at 15, so a prompt-injected invoice can only
  // fail to add points, never lower the score. A flag also freezes the payment: that only ever pushes
  // toward a verification call, never toward approval, so it is safe against injection.
  const ai = invoice.aiIndicators ?? [];
  if (ai.length > 0) {
    const more = ai.length > 1 ? ` (and ${ai.length - 1} more)` : '';
    add('AI_FLAGGED', `Gemini flagged: ${ai[0].signal}: "${ai[0].evidence.replace(/[.\s]+$/, '')}"${more}.`);
  }

  const sum = reasons.reduce((total, r) => total + r.points, 0);
  const score = Math.min(100, sum);
  return { score, reasons, freeze: hardFreeze || score >= rules.freezeThreshold };
}
