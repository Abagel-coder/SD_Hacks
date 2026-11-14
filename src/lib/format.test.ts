import { describe, expect, it } from 'vitest';
import { money } from './format';

describe('money', () => {
  it('formats with a currency symbol and two decimals', () => {
    expect(money(4870)).toBe('$4,870.00');
    expect(money(1284.5, 'USD')).toBe('$1,284.50');
  });

  it('falls back to USD for an unknown currency code', () => {
    expect(money(10, 'not-a-code')).toBe('$10.00');
  });
});
