import { describe, expect, it } from 'vitest';
import { fallbackExplanation } from './pipeline';

describe('fallbackExplanation', () => {
  it('says so when there are no risk signals', () => {
    expect(fallbackExplanation({ score: 0, reasons: [], freeze: false }))
      .toBe("No risk signals found. This invoice matches the vendor's history.");
  });

  it('joins the reason details after the score', () => {
    const text = fallbackExplanation({
      score: 70, freeze: true,
      reasons: [
        { code: 'BANK_CHANGED', points: 40, detail: 'Bank account changed.' },
        { code: 'LOOKALIKE_DOMAIN', points: 30, detail: 'Domain imitates uline.com.' },
      ],
    });
    expect(text).toBe('Risk score 70 out of 100. Bank account changed. Domain imitates uline.com.');
  });
});
