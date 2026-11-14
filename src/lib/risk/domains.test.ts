import { describe, expect, it } from 'vitest';
import { editDistance, isLookalike, normalizeDomain } from './domains';

describe('normalizeDomain', () => {
  it('handles domains, URLs and emails', () => {
    expect(normalizeDomain('Uline.com')).toBe('uline.com');
    expect(normalizeDomain('https://www.uline.com/contact')).toBe('uline.com');
    expect(normalizeDomain('billing@mail.uline.com')).toBe('uline.com');
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
  });
});

describe('editDistance', () => {
  it('counts single-character edits', () => {
    expect(editDistance('uline.com', 'uline.com')).toBe(0);
    expect(editDistance('uline.com', 'u1ine.com')).toBe(1);
    expect(editDistance('uline.com', 'ulline.co')).toBe(2);
  });
});

describe('isLookalike', () => {
  it('flags near-miss spellings', () => {
    expect(isLookalike('u1ine.com', 'uline.com')).toBe(true);
    expect(isLookalike('uline.co', 'uline.com')).toBe(true);
  });

  it('flags domains that embed the real name', () => {
    expect(isLookalike('uline-billing.com', 'uline.com')).toBe(true);
    expect(isLookalike('payments-grainger.net', 'grainger.com')).toBe(true);
  });

  it('does not flag the real domain or unrelated domains', () => {
    expect(isLookalike('uline.com', 'uline.com')).toBe(false);
    expect(isLookalike('gmail.com', 'uline.com')).toBe(false);
  });
});
