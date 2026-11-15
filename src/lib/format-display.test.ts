import { describe, expect, it } from 'vitest';
import { formatPhone, maskLongNumbers } from './format';

describe('formatPhone', () => {
  it('formats US E.164 and printed numbers the same way', () => {
    expect(formatPhone('+18002955510')).toBe('(800) 295-5510');
    expect(formatPhone('(800) 295-5510')).toBe('(800) 295-5510');
    expect(formatPhone('800.295.5510')).toBe('(800) 295-5510');
    expect(formatPhone('1-800-295-5510')).toBe('(800) 295-5510');
  });

  it('leaves non-US and unparseable values alone', () => {
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(formatPhone('call the office')).toBe('call the office');
    expect(formatPhone('555-0199')).toBe('555-0199');
  });
});

describe('maskLongNumbers', () => {
  it('masks runs of 8 or more digits to the last 4', () => {
    expect(maskLongNumbers('Bank account 000123456789 is on the scam blocklist.')).toBe(
      'Bank account •••• 6789 is on the scam blocklist.',
    );
  });

  it('keeps short numbers and amounts', () => {
    expect(maskLongNumbers('Bank account ending 6789, $4,870.00')).toBe('Bank account ending 6789, $4,870.00');
  });
});
