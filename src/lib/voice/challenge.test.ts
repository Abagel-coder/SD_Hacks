import { describe, expect, it } from 'vitest';
import { buildChallenge } from './challenge';

describe('buildChallenge', () => {
  it('asks about the second most recent invoice by month name', () => {
    const history = [
      { amount: 1405.2, invoice_date: '2026-08-28' },
      { amount: 1367.9, invoice_date: '2026-10-28' },
      { amount: 1284.5, invoice_date: '2026-09-28' },
    ];
    expect(buildChallenge(history, 'Harbor Coffee Roasters')).toEqual({
      question: 'What was the total amount on your September invoice to Harbor Coffee Roasters?',
      expectedAmount: 1284.5,
    });
  });

  it('uses the only invoice when there is just one', () => {
    expect(buildChallenge([{ amount: 500, invoice_date: '2026-03-02' }], 'Acme')?.question)
      .toBe('What was the total amount on your March invoice to Acme?');
  });

  it('returns null when there is no dated history', () => {
    expect(buildChallenge([], 'Acme')).toBeNull();
    expect(buildChallenge([{ amount: 500, invoice_date: null }], 'Acme')).toBeNull();
  });
});
