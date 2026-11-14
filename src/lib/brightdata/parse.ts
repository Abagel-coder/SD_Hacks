import { normalizeDomain } from '../risk/domains';
import { normalizeVendorName } from '../vendors';
import type { SerpResult } from './client';

const NOT_OFFICIAL = new Set([
  'wikipedia.org', 'linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com',
  'youtube.com', 'yelp.com', 'bbb.org', 'crunchbase.com', 'bloomberg.com', 'glassdoor.com',
  'indeed.com', 'zoominfo.com', 'dnb.com', 'mapquest.com', 'yellowpages.com', 'amazon.com',
  'reddit.com', 'google.com',
]);

export function pickOfficialDomain(results: SerpResult[], vendorName: string): string | null {
  const domains = results
    .map((result) => normalizeDomain(result.link))
    .filter((d): d is string => d !== null && !NOT_OFFICIAL.has(d));
  const compactName = normalizeVendorName(vendorName).replace(/ /g, '');
  const firstWord = normalizeVendorName(vendorName).split(' ')[0] ?? '';
  const byName = domains.find((d) => {
    const label = d.split('.')[0];
    return label.includes(compactName) || (firstWord.length >= 4 && label.includes(firstWord));
  });
  return byName ?? domains[0] ?? null;
}

export function registrationAgeDays(rdap: unknown, now: Date): number | null {
  const events = (rdap as { events?: { eventAction?: string; eventDate?: string }[] } | null)?.events;
  if (!Array.isArray(events)) return null;
  const registration = events.find((e) => e.eventAction === 'registration');
  if (!registration?.eventDate) return null;
  const registered = new Date(registration.eventDate).getTime();
  if (Number.isNaN(registered)) return null;
  return Math.floor((now.getTime() - registered) / 86_400_000);
}

export function toE164(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
