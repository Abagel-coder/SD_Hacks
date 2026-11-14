import type { CallOutcome, CallReport } from '../types';

export function classifyOutcome(report: CallReport): CallOutcome {
  if (report.bankChangeConfirmed === 'no') return 'denied';
  if (report.bankChangeConfirmed !== 'yes') return 'unclear';
  if (report.expectedAmount === null) return 'confirmed';
  if (report.statedAmount === null) return 'unclear';
  // Within 1 percent, so "about twelve eighty-four" still counts.
  const tolerance = Math.max(0.01, report.expectedAmount * 0.01);
  return Math.abs(report.statedAmount - report.expectedAmount) <= tolerance ? 'confirmed' : 'unclear';
}

export function reportFromAnalysis(analysis: unknown, expectedAmount: number | null): CallReport | null {
  const results = (analysis as {
    data_collection_results?: Record<string, { value?: unknown } | undefined>;
  } | null)?.data_collection_results;

  const confirmedRaw = results?.bank_change_confirmed?.value;
  if (typeof confirmedRaw !== 'string') return null;
  const answer = confirmedRaw.trim().toLowerCase();
  const bankChangeConfirmed = answer === 'yes' ? 'yes' : answer === 'no' ? 'no' : 'unclear';

  const amountRaw = results?.stated_amount?.value;
  const amount = typeof amountRaw === 'number'
    ? amountRaw
    : typeof amountRaw === 'string' ? Number(amountRaw.replace(/[^0-9.]/g, '')) : NaN;

  return {
    bankChangeConfirmed,
    statedAmount: Number.isFinite(amount) && amount > 0 ? amount : null,
    expectedAmount,
  };
}
