import { MOCK_EXPLANATION } from '../mocks';
import type { ExtractedInvoice, RiskResult } from '../types';
import { isMock } from '../util';
import { cachedGemini, sha256 } from './cache';
import { generateText } from './client';

export async function explainRisk(invoice: ExtractedInvoice, risk: RiskResult): Promise<string> {
  if (isMock('GEMINI')) return MOCK_EXPLANATION;
  if (risk.reasons.length === 0) {
    return "No risk signals found. This invoice matches the vendor's history.";
  }

  const prompt = [
    'You explain invoice fraud risk to a busy small-business owner.',
    'Write two or three plain sentences saying why this invoice is risky and what could happen if it is paid.',
    'Use only the facts below. No bullet points, no jargon, no advice beyond "verify by phone".',
    '',
    `Vendor: ${invoice.vendorName}`,
    `Amount: ${invoice.amount} ${invoice.currency}`,
    `Sent from: ${invoice.senderEmail ?? 'unknown sender'}`,
    `Risk score: ${risk.score} out of 100`,
    'Signals:',
    ...risk.reasons.map((r) => `- ${r.detail}`),
  ].join('\n');

  return cachedGemini('explain', sha256(prompt), () => generateText(prompt));
}
