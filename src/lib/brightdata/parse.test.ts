import { describe, expect, it } from 'vitest';
import { pickOfficialDomain, registrationAgeDays, toE164 } from './parse';

const r = (link: string) => ({ link, title: '', description: '' });

describe('pickOfficialDomain', () => {
  it('skips directories and social sites', () => {
    const results = [r('https://en.wikipedia.org/wiki/Uline'), r('https://www.linkedin.com/company/uline'), r('https://www.uline.com/')];
    expect(pickOfficialDomain(results, 'Uline')).toBe('uline.com');
  });

  it('prefers a domain containing the vendor name over an earlier unrelated result', () => {
    const results = [r('https://www.supplyreviews.com/grainger'), r('https://www.grainger.com/')];
    expect(pickOfficialDomain(results, 'Grainger Inc')).toBe('grainger.com');
  });

  it('falls back to the first non-directory result', () => {
    expect(pickOfficialDomain([r('https://www.bbsupply.com/')], 'Blue Bottle Supply')).toBe('bbsupply.com');
  });

  it('returns null when there is nothing usable', () => {
    expect(pickOfficialDomain([r('https://www.facebook.com/uline')], 'Uline')).toBeNull();
  });
});

describe('registrationAgeDays', () => {
  const now = new Date('2026-11-14T00:00:00Z');

  it('reads the RDAP registration event', () => {
    const rdap = { events: [{ eventAction: 'last changed', eventDate: '2026-01-01T00:00:00Z' }, { eventAction: 'registration', eventDate: '2026-11-02T00:00:00Z' }] };
    expect(registrationAgeDays(rdap, now)).toBe(12);
  });

  it('returns null when there is no registration event', () => {
    expect(registrationAgeDays({ events: [] }, now)).toBeNull();
    expect(registrationAgeDays({ errorCode: 404 }, now)).toBeNull();
    expect(registrationAgeDays(null, now)).toBeNull();
  });
});

describe('toE164', () => {
  it('formats US numbers', () => {
    expect(toE164('(800) 295-5510')).toBe('+18002955510');
    expect(toE164('1-800-295-5510')).toBe('+18002955510');
    expect(toE164('+1 800 295 5510')).toBe('+18002955510');
  });

  it('returns null for anything that is not a full number', () => {
    expect(toE164('295-5510')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});
