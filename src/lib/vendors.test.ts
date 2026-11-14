import { describe, expect, it } from 'vitest';
import { normalizeVendorName } from './vendors';

describe('normalizeVendorName', () => {
  it('lowercases and strips punctuation and company suffixes', () => {
    expect(normalizeVendorName('Uline, Inc.')).toBe('uline');
    expect(normalizeVendorName('SYSCO Corporation')).toBe('sysco');
    expect(normalizeVendorName('  Grainger   LLC ')).toBe('grainger');
  });

  it('keeps multi-word names', () => {
    expect(normalizeVendorName('Blue Bottle Supply Co.')).toBe('blue bottle supply');
  });
});
