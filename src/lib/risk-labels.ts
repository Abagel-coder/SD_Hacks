import type { RiskCode } from './types';

/** Plain-English title for each risk rule. Shared by the invoice risk panel and the backtest page. */
export const REASON_TITLE: Record<RiskCode, string> = {
  BLOCKLIST_HIT: 'Already on the scam blocklist',
  BANK_CHANGED: 'Bank details do not match history',
  LOOKALIKE_DOMAIN: 'Sender domain looks like the real vendor',
  DOMAIN_MISMATCH: 'Sender domain is not the vendor’s site',
  NEW_DOMAIN: 'Sender domain is brand new',
  AMOUNT_ANOMALY: 'Amount is far above normal',
  URGENCY_OR_SECRECY: 'Pressure or secrecy language',
  UNKNOWN_VENDOR: 'No payment history with this vendor',
  AI_FLAGGED: 'Gemini flagged a warning sign',
  NO_WEB_PRESENCE: 'Sender domain has no public web presence',
};
