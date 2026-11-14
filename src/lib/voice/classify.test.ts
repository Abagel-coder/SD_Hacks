import { describe, expect, it } from 'vitest';
import { classifyOutcome, reportFromAnalysis } from './classify';

describe('classifyOutcome', () => {
  it('is denied when the vendor says no, whatever else was said', () => {
    expect(classifyOutcome({ bankChangeConfirmed: 'no', statedAmount: 1284.5, expectedAmount: 1284.5 })).toBe('denied');
  });

  it('is confirmed only with a yes and the right amount', () => {
    expect(classifyOutcome({ bankChangeConfirmed: 'yes', statedAmount: 1284.5, expectedAmount: 1284.5 })).toBe('confirmed');
    expect(classifyOutcome({ bankChangeConfirmed: 'yes', statedAmount: 1284, expectedAmount: 1284.5 })).toBe('confirmed');
  });

  it('is unclear with a yes and a wrong or missing amount', () => {
    expect(classifyOutcome({ bankChangeConfirmed: 'yes', statedAmount: 1500, expectedAmount: 1284.5 })).toBe('unclear');
    expect(classifyOutcome({ bankChangeConfirmed: 'yes', statedAmount: null, expectedAmount: 1284.5 })).toBe('unclear');
  });

  it('accepts a yes alone when there is no history to ask about', () => {
    expect(classifyOutcome({ bankChangeConfirmed: 'yes', statedAmount: null, expectedAmount: null })).toBe('confirmed');
  });

  it('is unclear when the answer was unclear', () => {
    expect(classifyOutcome({ bankChangeConfirmed: 'unclear', statedAmount: null, expectedAmount: 1284.5 })).toBe('unclear');
  });
});

describe('reportFromAnalysis', () => {
  const analysis = (confirmed: unknown, amount: unknown) => ({
    data_collection_results: { bank_change_confirmed: { value: confirmed }, stated_amount: { value: amount } },
  });

  it('reads the two collected values', () => {
    expect(reportFromAnalysis(analysis('Yes', 1284.5), 1284.5))
      .toEqual({ bankChangeConfirmed: 'yes', statedAmount: 1284.5, expectedAmount: 1284.5 });
    expect(reportFromAnalysis(analysis('no', 0), 1284.5))
      .toEqual({ bankChangeConfirmed: 'no', statedAmount: null, expectedAmount: 1284.5 });
  });

  it('parses an amount given as text', () => {
    expect(reportFromAnalysis(analysis('yes', '$1,284.50'), null)?.statedAmount).toBe(1284.5);
  });

  it('treats any other answer as unclear', () => {
    expect(reportFromAnalysis(analysis('maybe', 0), null)?.bankChangeConfirmed).toBe('unclear');
  });

  it('returns null when the field is missing', () => {
    expect(reportFromAnalysis({ data_collection_results: {} }, null)).toBeNull();
    expect(reportFromAnalysis(null, null)).toBeNull();
  });
});
